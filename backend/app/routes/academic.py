from datetime import datetime, timezone
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.db import (
    academic_cohorts_col,
    academic_rubrics_col,
    academic_sessions_col,
    academic_students_col,
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
