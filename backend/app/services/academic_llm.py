import json
import re
from datetime import datetime, timezone

from groq import AsyncGroq

from app.config import settings


async def generate_academic_assessments(transcript: str, participants: list[dict], rubric: dict) -> dict:
    if not settings.LLM_API_KEY:
        raise ValueError("LLM_API_KEY is not configured")

    participant_text = "\n".join(
        f"Student ID: {item['studentId']} | Name: {item['name']} | Speaker: {item['speaker']}"
        for item in participants
    )
    rubric_text = json.dumps(rubric.get("dimensions", []), ensure_ascii=False)
    # Keep the request within Groq's developer-tier TPM budget. The full raw
    # transcript remains stored and available for later evidence review; the
    # generation pass uses a bounded excerpt to avoid 413 rate-limit failures.
    bounded_transcript = transcript[:12000]
    if len(transcript) > len(bounded_transcript):
        bounded_transcript += "\n[Transcript shortened for assessment generation.]"

    prompt = f"""Assess each mapped student in this group discussion. Return ONLY valid JSON.

Participants:
{participant_text}

Rubric dimensions (score from 0 to maxScore):
{rubric_text}

Rules:
- Use only transcript evidence; never invent participation.
- Include one or more short verbatim evidence excerpts when possible.
- Evidence timestamps may be blank when the transcript has no timestamp.
- Return every participant, even if evidence is limited.

Output schema:
{{"assessments":[{{"studentId":"...","scores":[{{"key":"...","label":"...","score":0,"maxScore":5,"rationale":"...","evidence":[{{"quote":"...","timestamp":""}}]}}],"strengths":["..."],"improvements":["..."],"summary":"..."}}]}}

Transcript:
{bounded_transcript}"""
    client = AsyncGroq(api_key=settings.LLM_API_KEY)
    messages = [
        {"role": "system", "content": "You are a careful academic group-discussion evaluator."},
        {"role": "user", "content": prompt},
    ]
    model = settings.ACADEMIC_LLM_MODEL
    try:
        response = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=settings.ACADEMIC_LLM_MAX_TOKENS
        )
    except Exception as exc:
        # Keep deployments resilient when an older .env still references a
        # recently deprecated Groq model.
        if model == "llama-3.3-70b-versatile" and settings.LLM_FALLBACK_MODEL != model:
            response = await client.chat.completions.create(
                model=settings.LLM_FALLBACK_MODEL,
                messages=messages,
                temperature=0.1,
                max_tokens=settings.ACADEMIC_LLM_MAX_TOKENS,
            )
        else:
            raise exc
    raw = re.sub(r"```json|```", "", response.choices[0].message.content or "").strip()
    result = json.loads(raw)
    if not isinstance(result.get("assessments"), list):
        raise ValueError("Assessment response missing assessments")
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    return result
