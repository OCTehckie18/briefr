from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class CohortCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=40)
    section: str = Field(min_length=1, max_length=40)
    academicYear: str = Field(min_length=1, max_length=20)
    description: str = Field(default="", max_length=500)


class CohortOut(CohortCreate):
    id: str
    createdBy: str
    createdAt: datetime


class StudentCreate(BaseModel):
    studentId: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=120)
    email: Optional[str] = None
    cohortId: str = Field(min_length=1)


class StudentOut(StudentCreate):
    id: str
    createdAt: datetime


class RubricDimension(BaseModel):
    key: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    maxScore: int = Field(default=5, ge=1, le=100)


class RubricCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    dimensions: List[RubricDimension] = Field(min_length=1, max_length=20)


class RubricOut(RubricCreate):
    id: str
    createdBy: str
    createdAt: datetime


class AcademicSessionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    topic: str = Field(min_length=1, max_length=500)
    cohortId: str = Field(min_length=1)
    rubricId: str = Field(min_length=1)
    participantIds: List[str] = Field(default_factory=list, max_length=100)
    scheduledAt: Optional[datetime] = None
    durationMinutes: int = Field(default=45, ge=1, le=480)
    meetingId: Optional[str] = None


class AcademicSessionOut(AcademicSessionCreate):
    id: str
    evaluatorId: str
    status: Literal[
        "draft", "scheduled", "processing", "ready_for_review", "published"
    ]
    createdAt: datetime
