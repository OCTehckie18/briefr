from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TranscriptCreate(BaseModel):
    meetingId: str
    rawText: str


class TranscriptOut(BaseModel):
    id: str
    meetingId: str
    rawText: str
    extractedTasks: list = []
    createdAt: datetime
