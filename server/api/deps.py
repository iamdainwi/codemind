"""
api/deps.py
FastAPI dependency functions — shared across all routers.
This is the ONLY place where session cookie reading happens.
"""
from fastapi import Cookie, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.db import get_db
from core.exceptions import UnauthenticatedError
from features.auth.models import UserDocument
from features.auth.service import get_current_user_from_token


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency returning the shared MongoDB database handle."""
    return get_db()


async def get_current_user(
    session: str | None = Cookie(default=None),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserDocument:
    """
    FastAPI dependency that resolves the session cookie to a UserDocument.
    Raises HTTP 401 if the cookie is missing, invalid, or expired.

    Usage:
        @router.get("/protected")
        async def handler(user: UserDocument = Depends(get_current_user)):
            ...
    """
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHENTICATED", "message": "Authentication required."},
        )
    try:
        user = await get_current_user_from_token(db, session)
        return user
    except UnauthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": exc.code, "message": exc.message},
        )
