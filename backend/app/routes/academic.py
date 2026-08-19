from datetime import datetime, timezone

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
