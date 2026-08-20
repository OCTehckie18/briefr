from datetime import datetime
from typing import List

from pydantic import BaseModel

from app.models.assessment import AssessmentDimensionScore


class AcademicReportOut(BaseModel):
    id: str
    assessmentId: str
    transcriptId: str
    studentId: str
    scores: List[AssessmentDimensionScore]
    strengths: List[str]
    improvements: List[str]
    summary: str
    publishedBy: str
    publishedAt: datetime
