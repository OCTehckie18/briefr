from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel, Field


class EvidenceExcerpt(BaseModel):
    quote: str
    timestamp: str = ""


class AssessmentDimensionScore(BaseModel):
    key: str
    label: str
    score: float = Field(ge=0)
    maxScore: float = Field(gt=0)
    rationale: str
    evidence: List[EvidenceExcerpt] = Field(default_factory=list)


class AcademicAssessmentOut(BaseModel):
    id: str
    transcriptId: str
    sessionId: str
    studentId: str
    scores: List[AssessmentDimensionScore]
    strengths: List[str]
    improvements: List[str]
    summary: str
    status: Literal["ai_recommendation", "reviewed"]
    generatedAt: datetime
