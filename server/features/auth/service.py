"""
features/auth/service.py
Business logic for user registration, login, and session management.
Raises custom exceptions from core/exceptions.py — never HTTPException.
"""
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.exceptions import (
    InvalidCredentialsError,
    UserAlreadyExistsError,
    UserNotFoundError,
    UnauthenticatedError,
)
from core.security import hash_password, verify_password, sign_user_id, verify_session_token
from features.auth.models import UserDocument
from features.auth import repository


async def register_user(db: AsyncIOMotorDatabase, username: str, password: str) -> UserDocument:
    """
    Register a new user account.

    Validates uniqueness, hashes the password, and persists the user to MongoDB.
    Returns the created UserDocument (without the raw password).
    """
    if await repository.username_exists(db, username):
        raise UserAlreadyExistsError(username)

    hashed = hash_password(password)
    user = await repository.create_user(db, username, hashed)
    return user


async def login_user(db: AsyncIOMotorDatabase, username: str, password: str) -> tuple[UserDocument, str]:
    """
    Authenticate a user and return (UserDocument, session_token).

    The session_token is a signed cookie value to set in the response.
    Raises InvalidCredentialsError on bad username or wrong password.
    """
    user = await repository.find_user_by_username(db, username)
    if user is None:
        raise InvalidCredentialsError()

    if not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError()

    token = sign_user_id(user.id)
    return user, token


async def get_current_user_from_token(db: AsyncIOMotorDatabase, token: str) -> UserDocument:
    """
    Resolve a session token to a UserDocument.
    Raises UnauthenticatedError if the token is invalid or expired.
    """
    user_id = verify_session_token(token)
    if user_id is None:
        raise UnauthenticatedError()

    user = await repository.find_user_by_id(db, user_id)
    if user is None:
        raise UnauthenticatedError()

    return user
