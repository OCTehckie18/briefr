from fastapi import APIRouter, Depends, HTTPException
from app.db import transcripts_col, tasks_col
from app.dependencies import get_current_user, require_admin
from app.models.transcript import TranscriptCreate, TranscriptOut
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()


@router.post("", response_model=TranscriptOut)
async def create_transcript(
    data: TranscriptCreate, current_user: dict = Depends(require_admin)
):
    """Create a new transcript linked to a meeting. Admin only."""
    transcript_doc = {
        "meetingId": data.meetingId,
        "rawText": data.rawText,
        "extractedTasks": [],
        "createdAt": datetime.now(timezone.utc),
    }
    result = await transcripts_col.insert_one(transcript_doc)
    transcript_doc["_id"] = result.inserted_id

    return TranscriptOut(
        id=str(transcript_doc["_id"]),
        meetingId=transcript_doc["meetingId"],
        rawText=transcript_doc["rawText"],
        extractedTasks=transcript_doc["extractedTasks"],
        createdAt=transcript_doc["createdAt"],
    )


@router.post("/{transcript_id}/extract")
async def extract_tasks(
    transcript_id: str, current_user: dict = Depends(require_admin)
):
    """Trigger LLM extraction on a transcript. Admin only."""
    try:
        transcript = await transcripts_col.find_one(
            {"_id": ObjectId(transcript_id)}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transcript ID")

    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    # Import LLM service here to avoid circular imports on startup
    from app.services.llm import extract_tasks_from_transcript

    try:
        extracted = await extract_tasks_from_transcript(transcript["rawText"])
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Store extracted tasks back in the transcript document
    await transcripts_col.update_one(
        {"_id": ObjectId(transcript_id)},
        {"$set": {"extractedTasks": extracted}},
    )

    return {"extractedTasks": extracted}


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

    raw_text = transcript.get("rawText", "")
    # Members cannot see rawText
    if current_user.get("role") != "admin":
        raw_text = ""

    return TranscriptOut(
        id=str(transcript["_id"]),
        meetingId=transcript["meetingId"],
        rawText=raw_text,
        extractedTasks=transcript.get("extractedTasks", []),
        createdAt=transcript.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("")
async def list_transcripts(current_user: dict = Depends(get_current_user)):
    """List transcripts. Members see metadata only (no rawText)."""
    is_admin = current_user.get("role") == "admin"
    transcripts = []

    async for t in transcripts_col.find().sort("createdAt", -1):
        item = {
            "id": str(t["_id"]),
            "meetingId": t["meetingId"],
            "extractedTasks": t.get("extractedTasks", []),
            "createdAt": t.get("createdAt", datetime.now(timezone.utc)),
        }
        if is_admin:
            item["rawText"] = t.get("rawText", "")
        else:
            item["rawText"] = ""
        transcripts.append(item)

    return transcripts
