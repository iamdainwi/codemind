"""
auth.py
JWT-based authentication backed by MongoDB.

Provides:
  - POST /auth/register  — create user, return JWT
  - POST /auth/login     — verify credentials, return JWT
  - GET  /auth/me        — return current user info
  - get_current_user()   — FastAPI dependency for protected routes
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from config import (
    logger,
    MONGO_URL, MONGO_DB,
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS,
)

# ── MongoDB connection ────────────────────────────────────────────────────────

_mongo_client = MongoClient(MONGO_URL)
_db = _mongo_client[MONGO_DB]
_users = _db["users"]

# Ensure unique email index
_users.create_index("email", unique=True)
# Sparse so that email/password users (no github_id field) are not affected
_users.create_index("github_id", unique=True, sparse=True)

logger.info(f"Connected to MongoDB: {MONGO_DB}")


# ── Request / Response models ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """Registration request body."""
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public user info (no password)."""
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    """JWT token response."""
    token: str
    user: UserOut


# ── Password hashing ─────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

def _create_token(user_id: str, email: str) -> str:
    """Create a signed JWT token."""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises on invalid/expired."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Auth dependency ───────────────────────────────────────────────────────────

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> UserOut:
    """
    FastAPI dependency — extract and verify the JWT from the Authorization header.
    Returns the authenticated UserOut or raises 401.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return UserOut(id=user_id, name="", email=payload.get("email", ""))


# ── Service functions ─────────────────────────────────────────────────────────

def register_user(req: RegisterRequest) -> AuthResponse:
    """Create a new user in MongoDB and return a JWT."""
    hashed = _hash_password(req.password)

    doc = {
        "name": req.name.strip(),
        "email": req.email.strip().lower(),
        "password_hash": hashed,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = _users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user_id = str(result.inserted_id)
    token = _create_token(user_id, doc["email"])
    user = UserOut(id=user_id, name=doc["name"], email=doc["email"])

    logger.info(f"Registered user: {doc['email']}")
    return AuthResponse(token=token, user=user)


def login_user(req: LoginRequest) -> AuthResponse:
    """Verify credentials and return a JWT."""
    user = _users.find_one({"email": req.email.strip().lower()})

    if not user or not _verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = _create_token(user_id, user["email"])
    user_out = UserOut(id=user_id, name=user["name"], email=user["email"])

    logger.info(f"Login: {user['email']}")
    return AuthResponse(token=token, user=user_out)


def get_user_profile(user_id: str) -> UserOut:
    """Fetch user profile by ID."""
    from bson import ObjectId

    user = _users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserOut(id=str(user["_id"]), name=user["name"], email=user["email"])


# ── GitHub token helpers ──────────────────────────────────────────────────────

def find_or_create_github_user(
    github_id: int,
    github_login: str,
    email: str,
    name: str,
    github_token: str,
) -> AuthResponse:
    """
    Sign in or sign up using GitHub OAuth.

    Look-up order:
      1. User with matching github_id  (returning GitHub user)
      2. User with matching email      (existing email/password account linking GitHub)
      3. Create a new account          (first-time GitHub sign-in)

    Returns a CodeMind JWT + UserOut ready to hand to the frontend.
    """
    update_fields = {
        "github_id": github_id,
        "github_username": github_login,
        "github_token": github_token,
    }

    # 1. Existing GitHub-linked account
    user = _users.find_one({"github_id": github_id})

    # 2. Existing email/password account — link GitHub to it
    if not user and email:
        user = _users.find_one({"email": email.strip().lower()})

    if user:
        _users.update_one({"_id": user["_id"]}, {"$set": update_fields})
        user_id = str(user["_id"])
        token = _create_token(user_id, user["email"])
        logger.info(f"GitHub login (existing user): {user['email']} (@{github_login})")
        return AuthResponse(
            token=token,
            user=UserOut(id=user_id, name=user["name"], email=user["email"]),
        )

    # 3. New user — create account (no password)
    # GitHub may return null email for users with private email settings
    user_email = email.strip().lower() if email else f"{github_login}@users.noreply.github.com"
    doc = {
        "name": name or github_login,
        "email": user_email,
        "password_hash": "",          # GitHub-only account; password login disabled
        "auth_provider": "github",
        **update_fields,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = _users.insert_one(doc)
    except DuplicateKeyError:
        # Race: another request just inserted the same email — fetch and return it
        user = _users.find_one({"email": user_email})
        if user:
            _users.update_one({"_id": user["_id"]}, {"$set": update_fields})
            user_id = str(user["_id"])
            token = _create_token(user_id, user["email"])
            return AuthResponse(
                token=token,
                user=UserOut(id=user_id, name=user["name"], email=user["email"]),
            )
        raise

    user_id = str(result.inserted_id)
    token = _create_token(user_id, doc["email"])
    logger.info(f"GitHub signup (new user): {doc['email']} (@{github_login})")
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, name=doc["name"], email=doc["email"]),
    )


def store_github_token(user_id: str, github_token: str, github_username: str = "") -> None:
    """Persist a GitHub OAuth access token for the given user."""
    from bson import ObjectId

    _users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"github_token": github_token, "github_username": github_username}},
    )
    logger.info(f"Stored GitHub token for user {user_id[:8]}... (@{github_username})")


def get_github_token(user_id: str) -> Optional[str]:
    """Return the stored GitHub access token for a user, or None if not connected."""
    from bson import ObjectId

    doc = _users.find_one({"_id": ObjectId(user_id)}, {"github_token": 1})
    return doc.get("github_token") if doc else None


def get_github_status(user_id: str) -> Dict:
    """Return GitHub connection status: {connected, username}."""
    from bson import ObjectId

    doc = _users.find_one(
        {"_id": ObjectId(user_id)},
        {"github_token": 1, "github_username": 1},
    )
    if not doc or not doc.get("github_token"):
        return {"connected": False, "username": None}
    return {"connected": True, "username": doc.get("github_username", "")}
