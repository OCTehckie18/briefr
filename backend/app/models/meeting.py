from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class MeetingCreate(BaseModel):
    title: str
    projectId: str
    memberIds: List[str] = []
    scheduledAt: Optional[datetime] = None
    meetingLink: Optional[str] = None  # Google Meet URL for bot auto-join


class MeetingOut(BaseModel):
    id: str
    title: str
    projectId: str
    hostId: str
    memberIds: List[str] = []
    scheduledAt: Optional[datetime] = None
    createdAt: datetime
    meetingLink: Optional[str] = None
    botStatus: Optional[str] = None  # pending | joining | recording | done | failed
