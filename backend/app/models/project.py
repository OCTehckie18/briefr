from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    adminId: str
    createdAt: datetime
