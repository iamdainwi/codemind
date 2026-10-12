"""
features/auth/repository.py
MongoDB queries for user documents. No business logic — only DB operations.
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from features.auth.models import UserDocument


async def find_user_by_username(db: AsyncIOMotorDatabase, username: str) -> UserDocument | None:
    """Fetch a user document by username, or None if not found."""
    doc = await db.users.find_one({"username": username})
    if doc is None:
        return None
    return UserDocument(
        id=str(doc["_id"]),
        username=doc["username"],
        hashed_password=doc["hashed_password"],
        created_at=doc.get("created_at"),
    )


async def find_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> UserDocument | None:
    """Fetch a user document by MongoDB _id string, or None if not found."""
    from bson import ObjectId
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    doc = await db.users.find_one({"_id": oid})
    if doc is None:
        return None
    return UserDocument(
        id=str(doc["_id"]),
        username=doc["username"],
        hashed_password=doc["hashed_password"],
        created_at=doc.get("created_at"),
    )


async def create_user(db: AsyncIOMotorDatabase, username: str, hashed_password: str) -> UserDocument:
    """Insert a new user document and return it with the assigned _id."""
    from datetime import datetime
    doc = {
        "username": username,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(doc)
    return UserDocument(
        id=str(result.inserted_id),
        username=username,
        hashed_password=hashed_password,
        created_at=doc["created_at"],
    )


async def username_exists(db: AsyncIOMotorDatabase, username: str) -> bool:
    """Return True if a user with this username already exists."""
    count = await db.users.count_documents({"username": username})
    return count > 0
