"""
features/repos/repository.py
MongoDB queries for repository documents. No business logic.
"""
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from features.repos.models import RepoDocument


def _doc_to_repo(doc: dict) -> RepoDocument:
    return RepoDocument(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        name=doc["name"],
        strategy=doc.get("strategy", "both"),
        status=doc["status"],
        file_count=doc.get("file_count", 0),
        chunk_count_ast=doc.get("chunk_count_ast", 0),
        chunk_count_fixed=doc.get("chunk_count_fixed", 0),
        duration_ms_ast=doc.get("duration_ms_ast", 0),
        duration_ms_fixed=doc.get("duration_ms_fixed", 0),
        skipped_files=doc.get("skipped_files", 0),
        error_message=doc.get("error_message"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


async def create_repo(db: AsyncIOMotorDatabase, user_id: str, name: str) -> RepoDocument:
    """Create a new repo document with status 'pending'."""
    now = datetime.utcnow()
    doc = {
        "user_id": ObjectId(user_id),
        "name": name,
        "strategy": "both",
        "status": "pending",
        "file_count": 0,
        "chunk_count_ast": 0,
        "chunk_count_fixed": 0,
        "duration_ms_ast": 0,
        "duration_ms_fixed": 0,
        "skipped_files": 0,
        "error_message": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.repos.insert_one(doc)
    return RepoDocument(id=str(result.inserted_id), user_id=user_id, name=name,
                        strategy="both", status="pending", created_at=now, updated_at=now)


async def update_repo_status(db: AsyncIOMotorDatabase, repo_id: str, **fields) -> None:
    """Update arbitrary fields on a repo document."""
    fields["updated_at"] = datetime.utcnow()
    await db.repos.update_one({"_id": ObjectId(repo_id)}, {"$set": fields})


async def get_repo(db: AsyncIOMotorDatabase, repo_id: str) -> RepoDocument | None:
    try:
        doc = await db.repos.find_one({"_id": ObjectId(repo_id)})
    except Exception:
        return None
    return _doc_to_repo(doc) if doc else None


async def list_repos_for_user(db: AsyncIOMotorDatabase, user_id: str) -> list[RepoDocument]:
    cursor = db.repos.find({"user_id": ObjectId(user_id)}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [_doc_to_repo(d) for d in docs]


async def delete_repo(db: AsyncIOMotorDatabase, repo_id: str) -> bool:
    result = await db.repos.delete_one({"_id": ObjectId(repo_id)})
    return result.deleted_count > 0
