from fastapi import APIRouter, Depends, HTTPException
from app.db import tasks_col
from app.dependencies import get_current_user, require_admin
from app.models.task import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskOut
from bson import ObjectId
from datetime import datetime, timezone
import asyncio

router = APIRouter()


def _task_out(t: dict) -> TaskOut:
    """Convert a MongoDB task document to TaskOut model."""
    return TaskOut(
        id=str(t["_id"]),
        title=t["title"],
        description=t.get("description"),
        transcriptId=t.get("transcriptId", ""),
        projectId=t.get("projectId", ""),
        assignedTo=t.get("assignedTo"),
        deadline=t.get("deadline"),
        priority=t.get("priority", "medium"),
        status=t.get("status", "todo"),
        publicationStatus=t.get("publicationStatus", "draft"),
        createdAt=t.get("createdAt", datetime.now(timezone.utc)),
    )


@router.post("", response_model=TaskOut)
async def create_task(
    data: TaskCreate, current_user: dict = Depends(require_admin)
):
    """Create a reviewable task. It is emailed only after an explicit publish."""
    task_doc = {
        "title": data.title,
        "description": data.description,
        "transcriptId": data.transcriptId,
        "projectId": data.projectId,
        "assignedTo": data.assignedTo.model_dump() if data.assignedTo else None,
        "deadline": data.deadline,
        "priority": data.priority,
        "status": data.status,
        "publicationStatus": "draft",
        "createdAt": datetime.now(timezone.utc),
    }
    result = await tasks_col.insert_one(task_doc)
    task_doc["_id"] = result.inserted_id

    return _task_out(task_doc)


@router.get("", response_model=list[TaskOut])
async def list_tasks(current_user: dict = Depends(get_current_user)):
    """List tasks. Admin sees all, member sees only their assigned tasks."""
    user_id = str(current_user["_id"])

    if current_user.get("role") == "admin":
        query = {}
    else:
        query = {"assignedTo.userId": user_id}

    tasks = []
    async for t in tasks_col.find(query).sort("createdAt", -1):
        tasks.append(_task_out(t))
    return tasks


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single task by ID."""
    try:
        task = await tasks_col.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return _task_out(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str, data: TaskUpdate, current_user: dict = Depends(require_admin)
):
    """Update a task (any field). Admin only."""
    try:
        task = await tasks_col.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = data.model_dump(exclude_none=True)
    if "assignedTo" in update_data and update_data["assignedTo"]:
        # assignedTo is already a dict from model_dump
        pass

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await tasks_col.update_one(
        {"_id": ObjectId(task_id)}, {"$set": update_data}
    )

    updated = await tasks_col.find_one({"_id": ObjectId(task_id)})
    return _task_out(updated)


@router.patch("/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: str,
    data: TaskStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update task status. Any user can update their own task's status."""
    try:
        task = await tasks_col.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Members can only update their own tasks
    user_id = str(current_user["_id"])
    is_admin = current_user.get("role") == "admin"
    assigned_user = task.get("assignedTo", {})

    if not is_admin:
        if not assigned_user or assigned_user.get("userId") != user_id:
            raise HTTPException(
                status_code=403, detail="You can only update your own tasks"
            )

    await tasks_col.update_one(
        {"_id": ObjectId(task_id)}, {"$set": {"status": data.status}}
    )

    updated = await tasks_col.find_one({"_id": ObjectId(task_id)})
    return _task_out(updated)


@router.delete("/{task_id}")
async def delete_task(
    task_id: str, current_user: dict = Depends(require_admin)
):
    """Delete a task. Admin only."""
    try:
        result = await tasks_col.delete_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"detail": "Task deleted"}


@router.post("/{task_id}/publish", response_model=TaskOut)
async def publish_task(
    task_id: str, current_user: dict = Depends(require_admin)
):
    """Publish a reviewed task and notify its assignee exactly once."""
    try:
        task = await tasks_col.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("publicationStatus", "draft") == "published":
        return _task_out(task)

    await tasks_col.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "publicationStatus": "published",
            "publishedAt": datetime.now(timezone.utc),
            "publishedBy": str(current_user["_id"]),
        }},
    )
    published = await tasks_col.find_one({"_id": ObjectId(task_id)})

    assigned_to = published.get("assignedTo") or {}
    if assigned_to.get("email"):
        from app.services.email import send_task_assignment_email
        deadline = published.get("deadline")
        deadline_str = deadline.strftime("%B %d, %Y") if deadline else "No deadline"
        asyncio.create_task(send_task_assignment_email(
            to_email=assigned_to["email"],
            to_name=assigned_to.get("name", "there"),
            task_title=published.get("title", "New task"),
            deadline=deadline_str,
            kanban_url="http://localhost:5173/kanban",
        ))

    return _task_out(published)
