from fastapi import APIRouter, HTTPException, Depends
from app.db import users_col
from app.models.user import UserCreate, UserLogin, UserOut, TokenResponse, RefreshRequest
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.dependencies import get_current_user
from bson import ObjectId
from datetime import datetime, timezone
from jose import JWTError

router = APIRouter()


def _user_out(user: dict) -> UserOut:
    """Convert a MongoDB user document to UserOut model."""
    return UserOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
    )


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    """Register a new user. Returns access + refresh tokens."""
    # Check if email already exists
    existing = await users_col.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": data.role,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await users_col.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    user_id = str(result.inserted_id)
    return TokenResponse(
        access_token=create_access_token(user_id, data.role),
        refresh_token=create_refresh_token(user_id),
        user=_user_out(user_doc),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Authenticate user and return tokens."""
    user = await users_col.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    return TokenResponse(
        access_token=create_access_token(user_id, user["role"]),
        refresh_token=create_refresh_token(user_id),
        user=_user_out(user),
    )


@router.post("/refresh")
async def refresh_token(data: RefreshRequest):
    """Exchange a valid refresh token for a new access token."""
    try:
        payload = decode_refresh_token(data.refresh_token)
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "access_token": create_access_token(str(user["_id"]), user["role"]),
    }


@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return _user_out(current_user)
