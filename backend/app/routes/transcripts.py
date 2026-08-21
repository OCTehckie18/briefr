from fastapi import APIRouter, Depends, HTTPException, Query
from app.db import transcripts_col, tasks_col, users_col
from app.dependencies import get_current_user, require_admin
from app.models.transcript import TranscriptCreate, TranscriptOut
from bson import ObjectId
from datetime import datetime, timezone
import re

router = APIRouter()


def _transcript_out(t: dict, include_raw: bool = True) -> TranscriptOut:
    """Convert a MongoDB transcript document to TranscriptOut."""
    return TranscriptOut(
        id=str(t["_id"]),
        meetingId=t["meetingId"],
        rawText=t.get("rawText", "") if include_raw else "",
        segments=t.get("segments", []),
        extractedTasks=t.get("extractedTasks", []),
        structuredExtraction=t.get("structuredExtraction"),
        createdAt=t.get("createdAt", datetime.now(timezone.utc)),
    )


@router.post("", response_model=TranscriptOut)
async def create_transcript(
    data: TranscriptCreate, current_user: dict = Depends(require_admin)
):
    """Create a new transcript linked to a meeting. Admin only."""
    transcript_doc = {
        "meetingId": data.meetingId,
        "rawText": data.rawText,
        "segments": data.segments,
        "extractedTasks": [],
        "structuredExtraction": None,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await transcripts_col.insert_one(transcript_doc)
    transcript_doc["_id"] = result.inserted_id
    return _transcript_out(transcript_doc)


@router.post("/{transcript_id}/process")
async def process_transcript(
    transcript_id: str,
    meeting_date: str = Query(..., description="Anchor date for the meeting, e.g. 2026-07-28"),
    current_user: dict = Depends(require_admin),
):
    """
    Run the full SKILL.md pipeline on a transcript (admin only):
    1. Call Groq LLM with SKILL.md instructions to get per-person kanban/calendar JSON.
    2. Match each person name to a user in the DB (case-insensitive).
    3. Bulk-insert Task documents — matched users get full assignedTo, unmatched get null.
    4. Store the structured LLM result on the transcript document.
    Returns a summary of what was created and which names weren't matched.
    """
    # Load transcript
    try:
        transcript = await transcripts_col.find_one({"_id": ObjectId(transcript_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transcript ID")

    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    raw_text = transcript.get("rawText", "")
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Transcript has no rawText to process")

    # ── 1. Call LLM ──────────────────────────────────────────────────────────
    from app.services.llm import extract_structured_tasks

    try:
        structured = await extract_structured_tasks(raw_text, meeting_date)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    people: dict = structured.get("people", {})

    # ── 2. Build name → user map from the DB ─────────────────────────────────
    # Load all users once and do case-insensitive name matching.
    all_users = []
    async for u in users_col.find({}, {"_id": 1, "name": 1, "email": 1}):
        all_users.append(u)

    def find_user(person_name: str):
        pattern = re.compile(r"^\s*" + re.escape(person_name.strip()) + r"\s*$", re.IGNORECASE)
        for u in all_users:
            if pattern.match(u.get("name", "")):
                return u
        return None

    # ── 3. Insert Task documents ──────────────────────────────────────────────
    transcript_id_str = str(transcript["_id"])
    meeting_id_str = transcript.get("meetingId", "")
    
    from app.db import meetings_col
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id_str)})
        project_id_str = str(meeting.get("projectId", "")) if meeting else ""
    except Exception:
        project_id_str = ""

    tasks_created = 0
    matched_users: list[str] = []
    unmatched_names: list[str] = []
    task_docs: list[dict] = []

    for person_name, person_data in people.items():
        kanban_items: list = person_data.get("kanban", [])
        calendar_items: list = person_data.get("calendar", [])

        # Build a deadline lookup by title (from the calendar list)
        deadline_by_title: dict[str, str] = {
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

            task_doc = {
                "title": item.get("title", ""),
                "description": item.get("description"),
                "transcriptId": transcript_id_str,
                "projectId": project_id_str,
                "assignedTo": assigned_to,
                "deadline": parsed_deadline,
                "priority": item.get("priority", "medium"),
                "status": item.get("status", "todo"),
                "publicationStatus": "draft",
                "createdAt": datetime.now(timezone.utc),
            }
            task_docs.append(task_doc)

    if task_docs:
        await tasks_col.insert_many(task_docs)
        tasks_created = len(task_docs)

    # ── 4. Store structured extraction on the transcript ─────────────────────
    await transcripts_col.update_one(
        {"_id": ObjectId(transcript_id)},
        {"$set": {"structuredExtraction": structured}},
    )

    return {
        "detail": "Processing complete",
        "meeting_date": meeting_date,
        "tasks_created": tasks_created,
        "matched_users": matched_users,
        "unmatched_names": unmatched_names,
        "people_in_transcript": list(people.keys()),
    }


@router.post("/{transcript_id}/extract")
async def extract_tasks(
    transcript_id: str, current_user: dict = Depends(require_admin)
):
    """Trigger legacy flat LLM extraction on a transcript. Admin only."""
    try:
        transcript = await transcripts_col.find_one(
            {"_id": ObjectId(transcript_id)}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transcript ID")

    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    return {"detail": "Use /process endpoint for the structured SKILL.md pipeline."}


@router.get("/{transcript_id}", response_model=TranscriptOut)
async def get_transcript(
    transcript_id: str, current_user: dict = Depends(get_current_user)
):
    """Get a single transcript. Members see rawText only if admin."""
    try:
        transcript = await transcripts_col.find_one(
            {"_id": ObjectId(transcript_id)}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transcript ID")

    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    is_admin = current_user.get("role") == "admin"
    return _transcript_out(transcript, include_raw=is_admin)


@router.get("")
async def list_transcripts(current_user: dict = Depends(get_current_user)):
    """List transcripts. Members see metadata only (no rawText)."""
    is_admin = current_user.get("role") == "admin"
    transcripts = []

    async for t in transcripts_col.find().sort("createdAt", -1):
        transcripts.append(_transcript_out(t, include_raw=is_admin))

    return transcripts
