from datetime import datetime, timezone
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db import (
    academic_cohorts_col,
    academic_rubrics_col,
    academic_sessions_col,
    academic_students_col,
    academic_assessments_col,
    academic_reports_col,
)
from app.dependencies import get_current_user, require_admin
from app.models.academic import (
    AcademicSessionCreate,
    AcademicSessionOut,
    CohortCreate,
    CohortOut,
    RubricCreate,
    RubricOut,
    StudentCreate,
    StudentOut,
    ParticipantMappingUpdate,
)
from app.models.assessment import AcademicAssessmentOut, AcademicAssessmentReview
from app.models.report import AcademicReportOut

router = APIRouter()


def _id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid resource ID") from exc


def _cohort_out(doc: dict) -> CohortOut:
    return CohortOut(
        id=str(doc["_id"]),
        name=doc["name"],
        grade=doc["grade"],
        section=doc["section"],
        academicYear=doc["academicYear"],
        description=doc.get("description", ""),
        createdBy=doc["createdBy"],
        createdAt=doc["createdAt"],
    )


def _student_out(doc: dict) -> StudentOut:
    return StudentOut(
        id=str(doc["_id"]),
        studentId=doc["studentId"],
        name=doc["name"],
        email=doc.get("email"),
        cohortId=doc["cohortId"],
        createdAt=doc["createdAt"],
    )


def _rubric_out(doc: dict) -> RubricOut:
    return RubricOut(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description", ""),
        dimensions=doc["dimensions"],
        createdBy=doc["createdBy"],
        createdAt=doc["createdAt"],
    )


def _session_out(doc: dict) -> AcademicSessionOut:
    return AcademicSessionOut(
        id=str(doc["_id"]),
        title=doc["title"],
        topic=doc["topic"],
        cohortId=doc["cohortId"],
        rubricId=doc["rubricId"],
        participantIds=doc.get("participantIds", []),
        scheduledAt=doc.get("scheduledAt"),
        durationMinutes=doc.get("durationMinutes", 45),
        meetingId=doc.get("meetingId"),
        evaluatorId=doc["evaluatorId"],
        status=doc.get("status", "draft"),
        createdAt=doc["createdAt"],
    )


@router.post("/cohorts", response_model=CohortOut)
async def create_cohort(data: CohortCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    doc = {**data.model_dump(), "createdBy": str(current_user["_id"]), "createdAt": now}
    result = await academic_cohorts_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _cohort_out(doc)


@router.get("/cohorts", response_model=list[CohortOut])
async def list_cohorts(current_user: dict = Depends(get_current_user)):
    return [_cohort_out(doc) async for doc in academic_cohorts_col.find().sort("name", 1)]


@router.post("/students", response_model=StudentOut)
async def create_student(data: StudentCreate, current_user: dict = Depends(require_admin)):
    if not await academic_cohorts_col.find_one({"_id": _id(data.cohortId)}):
        raise HTTPException(status_code=404, detail="Cohort not found")
    doc = {**data.model_dump(), "createdAt": datetime.now(timezone.utc)}
    result = await academic_students_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _student_out(doc)


@router.get("/students", response_model=list[StudentOut])
async def list_students(
    cohortId: str | None = None, current_user: dict = Depends(get_current_user)
):
    query = {"cohortId": cohortId} if cohortId else {}
    return [_student_out(doc) async for doc in academic_students_col.find(query).sort("name", 1)]


@router.post("/rubrics", response_model=RubricOut)
async def create_rubric(data: RubricCreate, current_user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    doc = {
        **data.model_dump(),
        "createdBy": str(current_user["_id"]),
        "createdAt": now,
    }
    result = await academic_rubrics_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _rubric_out(doc)


@router.get("/rubrics", response_model=list[RubricOut])
async def list_rubrics(current_user: dict = Depends(get_current_user)):
    return [_rubric_out(doc) async for doc in academic_rubrics_col.find().sort("name", 1)]


@router.post("/sessions", response_model=AcademicSessionOut)
async def create_session(
    data: AcademicSessionCreate, current_user: dict = Depends(require_admin)
):
    if not await academic_cohorts_col.find_one({"_id": _id(data.cohortId)}):
        raise HTTPException(status_code=404, detail="Cohort not found")
    if not await academic_rubrics_col.find_one({"_id": _id(data.rubricId)}):
        raise HTTPException(status_code=404, detail="Rubric not found")
    now = datetime.now(timezone.utc)
    doc = {
        **data.model_dump(),
        "evaluatorId": str(current_user["_id"]),
        "status": "scheduled" if data.scheduledAt else "draft",
        "createdAt": now,
    }
    result = await academic_sessions_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _session_out(doc)


@router.get("/sessions", response_model=list[AcademicSessionOut])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    query = {} if current_user.get("role") == "admin" else {"evaluatorId": str(current_user["_id"])}
    return [_session_out(doc) async for doc in academic_sessions_col.find(query).sort("createdAt", -1)]


def _speaker_names(raw_text: str) -> list[str]:
    names: list[str] = []
    for line in raw_text.splitlines():
        match = re.match(r"^\s*(?:\[[^\]]+\]\s*)?([^:\n]{1,100}):\s*.+$", line)
        if match:
            name = match.group(1).strip()
            if name and name.lower() not in {item.lower() for item in names}:
                names.append(name)
    return names


@router.get("/transcripts/{transcript_id}/context")
async def get_transcript_context(
    transcript_id: str, current_user: dict = Depends(get_current_user)
):
    from app.db import transcripts_col

    transcript = await transcripts_col.find_one({"_id": _id(transcript_id)})
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    session = await academic_sessions_col.find_one({"meetingId": transcript.get("meetingId")})
    students: list[dict] = []
    session_out = None
    if session:
        participant_ids = session.get("participantIds", [])
        async for student in academic_students_col.find({"_id": {"$in": [_id(value) for value in participant_ids]}}).sort("name", 1):
            students.append({"id": str(student["_id"]), "studentId": student["studentId"], "name": student["name"]})
        session_out = _session_out(session).model_dump()
    else:
        # Recorded transcripts created by the legacy ingest flow may predate
        # an academic-session link. Keep mapping usable while that link is
        # established by exposing the authenticated academic student roster.
        async for student in academic_students_col.find().sort("name", 1):
            students.append({"id": str(student["_id"]), "studentId": student["studentId"], "name": student["name"]})

    return {
        "transcriptId": transcript_id,
        "meetingId": transcript.get("meetingId", ""),
        "rawText": transcript.get("rawText", ""),
        "speakers": _speaker_names(transcript.get("rawText", "")),
        "students": students,
        "session": session_out,
        "mappings": transcript.get("academicParticipantMappings", {}),
        "finalized": transcript.get("academicMappingFinalized", False),
    }


@router.patch("/transcripts/{transcript_id}/mapping")
async def update_transcript_mapping(
    transcript_id: str,
    data: ParticipantMappingUpdate,
    current_user: dict = Depends(require_admin),
):
    from app.db import transcripts_col

    transcript = await transcripts_col.find_one({"_id": _id(transcript_id)})
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    session = await academic_sessions_col.find_one({"meetingId": transcript.get("meetingId")})
    allowed_ids = set(session.get("participantIds", [])) if session else set()
    if allowed_ids and any(value not in allowed_ids for value in data.mappings.values()):
        raise HTTPException(status_code=400, detail="Mapping includes a student outside this session")

    await transcripts_col.update_one(
        {"_id": _id(transcript_id)},
        {"$set": {
            "academicParticipantMappings": data.mappings,
            "academicMappingFinalized": data.finalize,
            "academicMappingUpdatedAt": datetime.now(timezone.utc),
        }},
    )
    return {"detail": "Participant mapping updated", "finalized": data.finalize, "mappings": data.mappings}


@router.post("/transcripts/{transcript_id}/assess", response_model=list[AcademicAssessmentOut])
async def assess_transcript(
    transcript_id: str, current_user: dict = Depends(require_admin)
):
    from app.db import transcripts_col
    from app.services.academic_llm import generate_academic_assessments

    transcript = await transcripts_col.find_one({"_id": _id(transcript_id)})
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    if not transcript.get("academicMappingFinalized"):
        raise HTTPException(status_code=400, detail="Finalize participant mapping before assessment")

    session = await academic_sessions_col.find_one({"meetingId": transcript.get("meetingId")})
    rubric = await academic_rubrics_col.find_one({"_id": _id(session["rubricId"])}) if session else await academic_rubrics_col.find_one()
    if not rubric:
        raise HTTPException(status_code=400, detail="No academic rubric is available")

    mappings = transcript.get("academicParticipantMappings", {})
    students_by_id: dict[str, dict] = {}
    async for student in academic_students_col.find({"_id": {"$in": [_id(value) for value in mappings.values()]}}):
        students_by_id[str(student["_id"])] = student
    participants = []
    for speaker, student_id in mappings.items():
        student = students_by_id.get(student_id)
        if student:
            participants.append({"speaker": speaker, "studentId": student_id, "name": student["name"]})
    if not participants:
        raise HTTPException(status_code=400, detail="No mapped students found")

    try:
        generated = await generate_academic_assessments(transcript.get("rawText", ""), participants, rubric)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=502, detail=f"Academic assessment generation failed: {exc}") from exc

    await academic_assessments_col.delete_many({"transcriptId": transcript_id})
    now = datetime.now(timezone.utc)
    documents = []
    for item in generated["assessments"]:
        if item.get("studentId") not in students_by_id:
            continue
        document = {
            "transcriptId": transcript_id,
            "sessionId": str(session["_id"]) if session else "",
            "studentId": item["studentId"],
            "scores": item.get("scores", []),
            "aiScores": item.get("scores", []),
            "strengths": item.get("strengths", []),
            "improvements": item.get("improvements", []),
            "summary": item.get("summary", ""),
            "status": "ai_recommendation",
            "generatedAt": now,
        }
        result = await academic_assessments_col.insert_one(document)
        document["_id"] = result.inserted_id
        documents.append(document)

    return [AcademicAssessmentOut(id=str(doc["_id"]), **{key: value for key, value in doc.items() if key != "_id"}) for doc in documents]


@router.get("/assessments", response_model=list[AcademicAssessmentOut])
async def list_assessments(
    transcriptId: str | None = None, current_user: dict = Depends(get_current_user)
):
    query = {"transcriptId": transcriptId} if transcriptId else {}
    return [AcademicAssessmentOut(id=str(doc["_id"]), **{key: value for key, value in doc.items() if key != "_id"}) async for doc in academic_assessments_col.find(query).sort("generatedAt", -1)]


@router.patch("/assessments/{assessment_id}/review", response_model=AcademicAssessmentOut)
async def review_assessment(
    assessment_id: str,
    data: AcademicAssessmentReview,
    current_user: dict = Depends(require_admin),
):
    assessment = await academic_assessments_col.find_one({"_id": _id(assessment_id)})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    reviewed_at = datetime.now(timezone.utc)
    await academic_assessments_col.update_one(
        {"_id": _id(assessment_id)},
        {"$set": {
            "scores": [score.model_dump() for score in data.scores],
            "reviewNote": data.reviewNote,
            "reviewedBy": str(current_user["_id"]),
            "reviewedAt": reviewed_at,
            "status": "reviewed",
        }, "$push": {"reviewHistory": {
            "scores": [score.model_dump() for score in data.scores],
            "reviewNote": data.reviewNote,
            "reviewedBy": str(current_user["_id"]),
            "reviewedAt": reviewed_at,
        }}},
    )
    assessment.update({
        "scores": [score.model_dump() for score in data.scores],
        "reviewNote": data.reviewNote,
        "reviewedBy": str(current_user["_id"]),
        "reviewedAt": reviewed_at,
        "status": "reviewed",
    })
    return AcademicAssessmentOut(id=str(assessment["_id"]), **{key: value for key, value in assessment.items() if key != "_id"})


@router.post("/assessments/{assessment_id}/publish", response_model=AcademicReportOut)
async def publish_assessment(
    assessment_id: str, current_user: dict = Depends(require_admin)
):
    assessment = await academic_assessments_col.find_one({"_id": _id(assessment_id)})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.get("status") != "reviewed":
        raise HTTPException(status_code=400, detail="Review the assessment before publishing")

    existing = await academic_reports_col.find_one({"assessmentId": assessment_id})
    if existing:
        return AcademicReportOut(id=str(existing["_id"]), **{key: value for key, value in existing.items() if key != "_id"})

    published_at = datetime.now(timezone.utc)
    report = {
        "assessmentId": assessment_id,
        "transcriptId": assessment["transcriptId"],
        "studentId": assessment["studentId"],
        "scores": assessment["scores"],
        "strengths": assessment.get("strengths", []),
        "improvements": assessment.get("improvements", []),
        "summary": assessment.get("summary", ""),
        "publishedBy": str(current_user["_id"]),
        "publishedAt": published_at,
    }
    result = await academic_reports_col.insert_one(report)
    report["_id"] = result.inserted_id
    return AcademicReportOut(id=str(result.inserted_id), **{key: value for key, value in report.items() if key != "_id"})


@router.get("/reports", response_model=list[AcademicReportOut])
async def list_reports(current_user: dict = Depends(get_current_user)):
    return [AcademicReportOut(id=str(doc["_id"]), **{key: value for key, value in doc.items() if key != "_id"}) async for doc in academic_reports_col.find().sort("publishedAt", -1)]
