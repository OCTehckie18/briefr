from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class AssignedTo(BaseModel):
    userId: str
    name: str
    email: str


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    transcriptId: str
    projectId: str
    assignedTo: Optional[AssignedTo] = None
    deadline: Optional[datetime] = None
    priority: Literal["high", "medium", "low"] = "medium"
    status: Literal["todo", "in_progress", "done"] = "todo"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignedTo: Optional[AssignedTo] = None
    deadline: Optional[datetime] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    status: Optional[Literal["todo", "in_progress", "done"]] = None


class TaskStatusUpdate(BaseModel):
    status: Literal["todo", "in_progress", "done"]


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    transcriptId: str
    projectId: str
    assignedTo: Optional[AssignedTo] = None
    deadline: Optional[datetime] = None
    priority: str
    status: str
    publicationStatus: str = "draft"
    createdAt: datetime
