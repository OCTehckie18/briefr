import json
import re
from datetime import datetime, timezone
from groq import AsyncGroq
from app.config import settings

client = AsyncGroq(api_key=settings.LLM_API_KEY)

# ── SKILL.md system prompt ────────────────────────────────────────────────────
# Full instructions from the meeting-action-items skill, plus a strict
# JSON-only output instruction so the model never wraps the result in prose.
STRUCTURED_SYSTEM_PROMPT = """
You are a meeting minutes analyzer that extracts per-person action items from meeting transcripts (Google Meet or Microsoft Teams exports) and returns them as structured JSON.

## Your job

Given a raw meeting transcript and a meeting date (the anchor date), produce ONE valid JSON object — no prose, no markdown, no code fences, just the raw JSON.

## Step 1 — Anchor date

Use the meeting date provided in the user message. All relative deadline expressions ("by Friday", "next week", "end of month") must be resolved to real ISO 8601 dates anchored to that date.

## Step 2 — Identify every participant

List every distinct speaker name in the transcript. Every speaker must appear in the output `people` map, even if they have zero tasks.

## Step 3 — Extract action items and assign ownership

Read for commitments, assignments, and follow-ups:
- Self-commitment: "I'll send the report by Friday" → task belongs to the speaker.
- Direct assignment: "Priya, can you own the vendor follow-up?" / "Yeah, I've got it" → task belongs to Priya.
- Third-person assignment: "Let's have Marcus handle onboarding docs" with no objection → task belongs to Marcus.

If ownership is genuinely ambiguous, use best judgment and lean toward whoever is most clearly implicated.

For each task determine:
- title: imperative, task-focused, 8 words or fewer (e.g. "Send Q3 deck to leadership").
- description: one sentence capturing the actual ask, in your own words.
- priority:
  - "high" = explicit urgency ("ASAP", "before the client call tomorrow", tied to a blocker)
  - "low" = explicitly deprioritized ("whenever you get a chance", "no rush", "nice to have")
  - "medium" = everything else (the default)
- deadline: resolve relative language against the anchor date:
  - "by Friday" → the next Friday on/after the anchor date
  - "next week" → Friday of the following week
  - "end of month" → last calendar day of the current month
  - If NO deadline was stated or implied, omit the task from calendar and do NOT invent a deadline.

## Step 4 — Output format rules

- kanban includes EVERY task assigned to that person, with or without a deadline.
- calendar includes ONLY tasks that have a resolved deadline. Tasks without deadlines must NOT appear in calendar.
- Every calendar entry must also appear in kanban (kanban is the full list; calendar is the dated subset).
- deadline is ALWAYS full ISO 8601 with time and Z suffix: "2026-08-01T00:00:00.000Z". Use T00:00:00.000Z when only a date is implied.
- status is ALWAYS "todo" — these are freshly extracted tasks.
- title and description must be identical between the kanban and calendar copies of the same task.
- If a person has zero tasks, both arrays stay empty ([]) — still include them in people.
- generated_at is the current UTC timestamp in ISO 8601 format.

## Output schema (return ONLY this, no other text)

{
  "meeting_date": "<YYYY-MM-DD from the user message>",
  "generated_at": "<current UTC ISO timestamp>",
  "people": {
    "<Full Name>": {
      "kanban": [
        {
          "title": "<string>",
          "description": "<string>",
          "priority": "high|medium|low",
          "status": "todo"
        }
      ],
      "calendar": [
        {
          "title": "<string>",
          "description": "<string>",
          "priority": "high|medium|low",
          "status": "todo",
          "deadline": "<ISO 8601 datetime Z>"
        }
      ]
    }
  }
}
"""


async def extract_structured_tasks(raw_text: str, meeting_date: str) -> dict:
    """
    Send a meeting transcript + anchor date to Groq and return the structured
    per-person kanban/calendar JSON as defined in the meeting-action-items skill.

    Retries up to 3 times on JSON parse failure.

    Args:
        raw_text: The full raw transcript text.
        meeting_date: ISO date string for the meeting, e.g. "2026-07-28".

    Returns:
        Parsed dict matching the SKILL.md output schema with 'people' key.
    """
    user_message = (
        f"Meeting date: {meeting_date}\n\n"
        f"Transcript:\n\n{raw_text}"
    )

    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": STRUCTURED_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                max_tokens=4000,
            )
            raw = response.choices[0].message.content.strip()
            # Strip any accidental markdown code fences the model might add
            raw = re.sub(r"```json|```", "", raw).strip()
            parsed = json.loads(raw)

            # Basic shape validation
            if "people" not in parsed:
                raise ValueError("LLM response missing 'people' key")

            # Stamp generated_at if the model omitted it
            if "generated_at" not in parsed:
                parsed["generated_at"] = datetime.now(timezone.utc).isoformat()

            return parsed

        except (json.JSONDecodeError, ValueError, Exception) as e:
            if attempt == 2:
                raise ValueError(
                    f"Structured LLM extraction failed after 3 attempts: {e}"
                )

    return {}
