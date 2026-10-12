"""
api/v1/auth.py
Auth endpoints: register, login, logout, me.
Session cookie is set/cleared here — the only place cookies are written.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

from api.deps import get_current_user, get_database
from core.config import settings
from core.exceptions import UserAlreadyExistsError, InvalidCredentialsError
from features.auth.models import UserDocument
from features.auth.service import register_user, login_user

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "session"


class AuthRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    username: str


def _success(data: dict) -> dict:
    return {"success": True, "data": data, "error": None}


def _error(code: str, message: str) -> dict:
    return {"success": False, "data": None, "error": {"code": code, "message": message}}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: AuthRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    try:
        user = await register_user(db, body.username, body.password)
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=_error(exc.code, exc.message))
    return _success({"user_id": user.id, "username": user.username})


@router.post("/login")
async def login(
    body: AuthRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    try:
        user, token = await login_user(db, body.username, body.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail=_error(exc.code, exc.message))

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
    )
    return _success({"user_id": user.id, "username": user.username})


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return _success({})


@router.get("/me")
async def me(user: UserDocument = Depends(get_current_user)):
    return _success({"user_id": user.id, "username": user.username})
