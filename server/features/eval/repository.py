"""
features/eval/repository.py
MongoDB queries for eval run documents.
"""
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from features.eval.models import EvalRunDocument


def _doc_to_run(doc: dict) -> EvalRunDocument:
    return EvalRunDocument(
        id=str(doc["_id"]),
        repo_id=doc["repo_id"],
        user_id=doc["user_id"],
        dataset_id=doc.get("dataset_id", ""),
        status=doc.get("status", "pending"),
        error_message=doc.get("error_message"),
        ast_metrics=doc.get("ast_metrics"),
        fixed_metrics=doc.get("fixed_metrics"),
        created_at=doc.get("created_at", datetime.utcnow()),
        completed_at=doc.get("completed_at"),
    )


async def create_eval_run(
    db: AsyncIOMotorDatabase, repo_id: str, user_id: str, dataset_id: str
) -> EvalRunDocument:
    now = datetime.utcnow()
    doc = {
        "repo_id": repo_id,
        "user_id": user_id,
        "dataset_id": dataset_id,
        "status": "pending",
        "created_at": now,
    }
    result = await db.eval_runs.insert_one(doc)
    return EvalRunDocument(
        id=str(result.inserted_id),
        repo_id=repo_id,
        user_id=user_id,
        dataset_id=dataset_id,
        created_at=now,
    )


async def update_eval_run(db: AsyncIOMotorDatabase, run_id: str, **fields) -> None:
    await db.eval_runs.update_one({"_id": ObjectId(run_id)}, {"$set": fields})


async def get_latest_eval_for_repo(
    db: AsyncIOMotorDatabase, repo_id: str
) -> EvalRunDocument | None:
    doc = await db.eval_runs.find_one(
        {"repo_id": repo_id, "status": "complete"},
        sort=[("created_at", -1)],
    )
    return _doc_to_run(doc) if doc else None


async def list_evals_for_user(
    db: AsyncIOMotorDatabase, user_id: str
) -> list[EvalRunDocument]:
    cursor = db.eval_runs.find({"user_id": user_id}).sort("created_at", -1)
    docs = await cursor.to_list(length=50)
    return [_doc_to_run(d) for d in docs]
