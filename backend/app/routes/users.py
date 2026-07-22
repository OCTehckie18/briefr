from fastapi import APIRouter, Depends, HTTPException
from app.db import users_col
from app.dependencies import get_current_user, require_admin
from app.models.user import UserOut
from bson import ObjectId

router = APIRouter()


@router.get("", response_model=list[UserOut])
async def list_users(current_user: dict = Depends(require_admin)):
    """List all users. Admin only."""
    users = []
    async for user in users_col.find():
        users.append(
            UserOut(
                id=str(user["_id"]),
                name=user["name"],
                email=user["email"],
                role=user["role"],
            )
        )
    return users


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single user by ID. Any authenticated user."""
    try:
        user = await users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
    )
