import json
import re
from groq import AsyncGroq
from app.config import settings

client = AsyncGroq(api_key=settings.LLM_API_KEY)

SYSTEM_PROMPT = """
You are a meeting minutes analyzer. Given a raw meeting transcript, extract all action items.

Return ONLY a valid JSON array. No explanation, no markdown, no code fences.

Each item must have exactly these fields:
{
  "title": "short action item title (max 10 words)",
  "description": "one sentence describing the task",
  "assigneeHint": "name or role mentioned as responsible (empty string if unclear)",
  "deadlineHint": "deadline mentioned in natural language (empty string if none)",
  "priority": "high | medium | low"
}

If there are no action items, return an empty array: []
"""


async def extract_tasks_from_transcript(raw_text: str) -> list:
    """
    Send transcript text to Groq LLM and extract structured action items.
    Retries up to 3 times on parse failure.
    """
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Transcript:\n\n{raw_text}"},
                ],
                temperature=0.1,
                max_tokens=1000,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown code fences if the LLM wraps its output
            raw = re.sub(r"```json|```", "", raw).strip()
            return json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            if attempt == 2:
                raise ValueError(f"LLM extraction failed after 3 attempts: {e}")
    return []
