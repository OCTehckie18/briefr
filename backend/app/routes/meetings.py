from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.db import meetings_col
from app.dependencies import get_current_user, require_admin
from app.models.meeting import MeetingCreate, MeetingOut
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

router = APIRouter()

BOT_STATUSES = {"pending", "joining", "recording", "done", "failed"}


def _meeting_out(m: dict) -> MeetingOut:
    """Convert a MongoDB meeting document to MeetingOut."""
    return MeetingOut(
        id=str(m["_id"]),
        title=m["title"],
        projectId=m.get("projectId", ""),
        hostId=m.get("hostId", ""),
        memberIds=m.get("memberIds", []),
        scheduledAt=m.get("scheduledAt"),
        createdAt=m.get("createdAt", datetime.now(timezone.utc)),
        meetingLink=m.get("meetingLink"),
        botStatus=m.get("botStatus"),
    )


@router.post("", response_model=MeetingOut)
async def create_meeting(
    data: MeetingCreate, current_user: dict = Depends(require_admin)
):
    """Create a new meeting. Admin only."""
    meeting_doc = {
        "title": data.title,
        "projectId": data.projectId,
        "hostId": str(current_user["_id"]),
        "memberIds": data.memberIds,
        "scheduledAt": data.scheduledAt,
        "createdAt": datetime.now(timezone.utc),
        "meetingLink": data.meetingLink,
        # Automatically set botStatus to "pending" when a meetingLink is provided
        "botStatus": "pending" if data.meetingLink else None,
    }
    result = await meetings_col.insert_one(meeting_doc)
    meeting_doc["_id"] = result.inserted_id
    return _meeting_out(meeting_doc)


@router.get("", response_model=list[MeetingOut])
async def list_meetings(current_user: dict = Depends(get_current_user)):
    """List meetings. Admin sees all, member sees meetings they are part of."""
    user_id = str(current_user["_id"])
    query = {} if current_user.get("role") == "admin" else {"memberIds": user_id}

    meetings = []
    async for m in meetings_col.find(query).sort("createdAt", -1):
        meetings.append(_meeting_out(m))
    return meetings


@router.get("/{meeting_id}", response_model=MeetingOut)
async def get_meeting(
    meeting_id: str, current_user: dict = Depends(get_current_user)
):
    """Get a single meeting by ID."""
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid meeting ID")

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return _meeting_out(meeting)


class BotStatusUpdate(BaseModel):
    status: str


@router.patch("/{meeting_id}/bot-status")
async def update_bot_status(
    meeting_id: str,
    data: BotStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update the bot status for a meeting.
    Called internally by the bot microservice after each status change.
    """
    if data.status not in BOT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(BOT_STATUSES)}",
        )

    try:
        result = await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"botStatus": data.status}},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid meeting ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return {"detail": f"Bot status updated to '{data.status}'", "meetingId": meeting_id}
