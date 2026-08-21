"""
Briefr Bot Internal Route
---------------------------
Receives the completed transcript from the Node.js bot microservice and
triggers the full SKILL.md extraction pipeline (LLM → tasks → DB).

POST /api/bot/transcript-ready
  Body: { meetingId, transcript, meeting_date, segments, captureMode }

This is an internal endpoint — it uses a shared secret or is firewalled
to only accept calls from localhost. For now, any authenticated user can
call it, but a dedicated internal secret is recommended in production.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import meetings_col, transcripts_col
from app.dependencies import get_current_user

log = logging.getLogger(__name__)
router = APIRouter()


class TranscriptReadyPayload(BaseModel):
    meetingId: str
    transcript: str
    meeting_date: str  # YYYY-MM-DD — used as the anchor date for LLM deadline parsing
    segments: list[dict[str, Any]] = Field(default_factory=list)
    captureMode: Optional[str] = None  # "speaker_glow" | "fallback_chunked" | None


@router.post("/transcript-ready")
async def transcript_ready(
    payload: TranscriptReadyPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Called by the bot microservice when a meeting recording session is complete.
    Creates a transcript document and triggers the structured LLM extraction pipeline.
    """
    meeting_id = payload.meetingId
    raw_text = payload.transcript.strip()
    meeting_date = payload.meeting_date

    if not raw_text:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    # ── 1. Verify meeting exists ──────────────────────────────────────────────
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid meeting ID")

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    log.info(
        f"[BotRoute] Received transcript for meeting {meeting_id} "
        f"({len(raw_text)} chars, captureMode={payload.captureMode})"
    )

    # ── 2. Create the transcript document ────────────────────────────────────
    transcript_doc = {
        "meetingId": meeting_id,
        "rawText": raw_text,
        # Structured dialogue entries (speaker_glow mode) or Whisper segments
        # (fallback_chunked mode). Both are stored so the LLM pipeline can use
        # whichever level of detail is available.
        "segments": payload.segments,
        # captureMode tells downstream consumers whether speaker attribution is
        # available in segments ("speaker_glow") or absent ("fallback_chunked").
        "captureMode": payload.captureMode or "fallback_chunked",
        "extractedTasks": [],
        "structuredExtraction": None,
        "createdAt": datetime.now(timezone.utc),
        "source": "bot",  # Mark as bot-generated, not manually ingested
    }
    result = await transcripts_col.insert_one(transcript_doc)
    transcript_id = result.inserted_id
    transcript_doc["_id"] = transcript_id

    log.info(f"[BotRoute] Transcript created: {transcript_id}")

    # ── 3. Trigger LLM extraction (reuse process_transcript logic) ────────────
    from app.services.llm import extract_structured_tasks
    import re

    users_col_ref = None
    try:
        from app.db import users_col as users_col_ref
    except ImportError:
        pass

    # Load all users for name matching
    from app.db import users_col, tasks_col

    try:
        structured = await extract_structured_tasks(raw_text, meeting_date)
    except ValueError as e:
        log.error(f"[BotRoute] LLM extraction failed: {e}")
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)}, {"$set": {"botStatus": "failed"}}
        )
        raise HTTPException(status_code=500, detail=f"LLM extraction failed: {e}")

    people: dict = structured.get("people", {})

    # Name → user lookup
    all_users = []
    async for u in users_col.find({}, {"_id": 1, "name": 1, "email": 1}):
        all_users.append(u)

    def find_user(person_name: str):
        pattern = re.compile(
            r"^\s*" + re.escape(person_name.strip()) + r"\s*$", re.IGNORECASE
        )
        for u in all_users:
            if pattern.match(u.get("name", "")):
                return u
        return None

    # Build task docs
    transcript_id_str = str(transcript_id)
    task_docs = []
    matched_users = []
    unmatched_names = []

    for person_name, person_data in people.items():
        kanban_items = person_data.get("kanban", [])
        calendar_items = person_data.get("calendar", [])

        deadline_by_title = {
            item["title"]: item["deadline"]
            for item in calendar_items
            if "deadline" in item and item.get("deadline")
        }

        user = find_user(person_name)
        if user:
            if person_name not in matched_users:
                matched_users.append(person_name)
            assigned_to = {
                "userId": str(user["_id"]),
                "name": user["name"],
                "email": user.get("email", ""),
            }
        else:
            if person_name not in unmatched_names:
                unmatched_names.append(person_name)
            assigned_to = None

        for item in kanban_items:
            raw_deadline = deadline_by_title.get(item["title"])
            parsed_deadline = None
            if raw_deadline:
                try:
                    parsed_deadline = datetime.fromisoformat(
                        raw_deadline.replace("Z", "+00:00")
                    )
                except ValueError:
                    parsed_deadline = None

            task_docs.append(
                {
                    "title": item.get("title", ""),
                    "description": item.get("description"),
                    "transcriptId": transcript_id_str,
                    "projectId": str(meeting.get("projectId", "")),
                    "assignedTo": assigned_to,
                    "deadline": parsed_deadline,
                    "priority": item.get("priority", "medium"),
                    "status": item.get("status", "todo"),
                    "publicationStatus": "draft",
                    "createdAt": datetime.now(timezone.utc),
                }
            )

    if task_docs:
        await tasks_col.insert_many(task_docs)

    # Store structured result on the transcript
    await transcripts_col.update_one(
        {"_id": transcript_id},
        {"$set": {"structuredExtraction": structured}},
    )

    # Update meeting bot status to done
    await meetings_col.update_one(
        {"_id": ObjectId(meeting_id)}, {"$set": {"botStatus": "done"}}
    )

    log.info(
        f"[BotRoute] Extraction complete — {len(task_docs)} tasks, "
        f"matched: {matched_users}, unmatched: {unmatched_names}"
    )

    return {
        "detail": "Transcript processed successfully",
        "transcriptId": transcript_id_str,
        "tasks_created": len(task_docs),
        "matched_users": matched_users,
        "unmatched_names": unmatched_names,
        "captureMode": payload.captureMode,
    }
