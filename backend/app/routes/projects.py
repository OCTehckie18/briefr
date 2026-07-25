from fastapi import APIRouter, Depends, HTTPException
from app.db import projects_col
from app.dependencies import get_current_user, require_admin
from app.models.project import ProjectCreate, ProjectOut
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()


@router.post("", response_model=ProjectOut)
async def create_project(
    data: ProjectCreate, current_user: dict = Depends(require_admin)
):
    """Create a new project. Admin only."""
    project_doc = {
        "name": data.name,
        "description": data.description,
        "adminId": str(current_user["_id"]),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await projects_col.insert_one(project_doc)
    project_doc["_id"] = result.inserted_id

    return ProjectOut(
        id=str(project_doc["_id"]),
        name=project_doc["name"],
        description=project_doc["description"],
        adminId=project_doc["adminId"],
        createdAt=project_doc["createdAt"],
    )


@router.get("", response_model=list[ProjectOut])
async def list_projects(current_user: dict = Depends(get_current_user)):
    """List all projects. Any authenticated user can see all projects."""
    projects = []
    async for p in projects_col.find():
        projects.append(
            ProjectOut(
                id=str(p["_id"]),
                name=p["name"],
                description=p.get("description", ""),
                adminId=p.get("adminId", ""),
                createdAt=p.get("createdAt", datetime.now(timezone.utc)),
            )
        )
    return projects


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str, current_user: dict = Depends(get_current_user)
):
    """Get a single project by ID."""
    try:
        project = await projects_col.find_one({"_id": ObjectId(project_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectOut(
        id=str(project["_id"]),
        name=project["name"],
        description=project.get("description", ""),
        adminId=project.get("adminId", ""),
        createdAt=project.get("createdAt", datetime.now(timezone.utc)),
    )
