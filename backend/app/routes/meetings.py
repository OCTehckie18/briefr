from fastapi import APIRouter, Depends, HTTPException
from app.db import meetings_col
from app.dependencies import get_current_user, require_admin
from app.models.meeting import MeetingCreate, MeetingOut
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()


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
    }
    result = await meetings_col.insert_one(meeting_doc)
    meeting_doc["_id"] = result.inserted_id

    return MeetingOut(
        id=str(meeting_doc["_id"]),
        title=meeting_doc["title"],
        projectId=meeting_doc["projectId"],
        hostId=meeting_doc["hostId"],
        memberIds=meeting_doc["memberIds"],
        scheduledAt=meeting_doc["scheduledAt"],
        createdAt=meeting_doc["createdAt"],
    )


@router.get("", response_model=list[MeetingOut])
async def list_meetings(current_user: dict = Depends(get_current_user)):
    """List meetings. Admin sees all, member sees meetings they are part of."""
    user_id = str(current_user["_id"])

    if current_user.get("role") == "admin":
        query = {}
    else:
        query = {"memberIds": user_id}

    meetings = []
    async for m in meetings_col.find(query).sort("createdAt", -1):
        meetings.append(
            MeetingOut(
                id=str(m["_id"]),
                title=m["title"],
                projectId=m.get("projectId", ""),
                hostId=m.get("hostId", ""),
                memberIds=m.get("memberIds", []),
                scheduledAt=m.get("scheduledAt"),
                createdAt=m.get("createdAt", datetime.now(timezone.utc)),
            )
        )
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

    return MeetingOut(
        id=str(meeting["_id"]),
        title=meeting["title"],
        projectId=meeting.get("projectId", ""),
        hostId=meeting.get("hostId", ""),
        memberIds=meeting.get("memberIds", []),
        scheduledAt=meeting.get("scheduledAt"),
        createdAt=meeting.get("createdAt", datetime.now(timezone.utc)),
    )
