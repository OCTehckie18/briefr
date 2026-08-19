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
{transcript}"""
    client = AsyncGroq(api_key=settings.LLM_API_KEY)
    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a careful academic group-discussion evaluator."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=8000,
    )
    raw = re.sub(r"```json|```", "", response.choices[0].message.content or "").strip()
    result = json.loads(raw)
    if not isinstance(result.get("assessments"), list):
        raise ValueError("Assessment response missing assessments")
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    return result
