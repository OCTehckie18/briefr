from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class TranscriptCreate(BaseModel):
    meetingId: str
    rawText: str
    segments: List[dict[str, Any]] = Field(default_factory=list)


class TranscriptOut(BaseModel):
    id: str
    meetingId: str
    rawText: str
    segments: List[dict[str, Any]] = Field(default_factory=list)
    extractedTasks: list = []
    structuredExtraction: Optional[dict] = None
    createdAt: datetime
