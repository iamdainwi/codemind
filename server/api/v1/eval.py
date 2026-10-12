"""
api/v1/eval.py
Eval endpoints: trigger eval run, get results.
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from api.deps import get_current_user, get_database
from core.exceptions import RepoNotFoundError, RepoAccessDeniedError, EvalNotFoundError
from features.auth.models import UserDocument
from features.eval import repository as eval_repo
from features.eval.service import run_evaluation
from features.repos.service import get_repo_for_user

router = APIRouter(prefix="/eval", tags=["eval"])


def _success(data) -> dict:
    return {"success": True, "data": data, "error": None}


def _error(code: str, message: str) -> dict:
    return {"success": False, "data": None, "error": {"code": code, "message": message}}


class EvalRunRequest(BaseModel):
    dataset_id: str = "python_oss_sample"


@router.post("/{repo_id}/run", status_code=202)
async def trigger_eval(
    repo_id: str,
    body: EvalRunRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    """
    Trigger an evaluation run comparing AST vs fixed-window chunking.
    Returns immediately with a run_id — check GET /eval/{repo_id}/results for completion.
    """
    try:
        await get_repo_for_user(db, repo_id, user.id)
    except (RepoNotFoundError, RepoAccessDeniedError) as exc:
        raise HTTPException(status_code=404, detail=_error(exc.code, exc.message))

    run = await eval_repo.create_eval_run(db, repo_id, user.id, body.dataset_id)
    asyncio.create_task(run_evaluation(db, run.id, repo_id, body.dataset_id))

    return _success({"run_id": run.id, "status": "pending"})


@router.get("/{repo_id}/results")
async def get_results(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    run = await eval_repo.get_latest_eval_for_repo(db, repo_id)
    if run is None:
        raise HTTPException(
            status_code=404,
            detail=_error("EVAL_NOT_FOUND", f"No completed evaluation for repo '{repo_id}'."),
        )
    return _success({
        "run_id": run.id,
        "repo_id": run.repo_id,
        "dataset_id": run.dataset_id,
        "status": run.status,
        "ast_metrics": run.ast_metrics,
        "fixed_metrics": run.fixed_metrics,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    })


@router.get("/results")
async def list_results(
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    runs = await eval_repo.list_evals_for_user(db, user.id)
    data = [
        {
            "run_id": r.id,
            "repo_id": r.repo_id,
            "status": r.status,
            "dataset_id": r.dataset_id,
            "created_at": r.created_at.isoformat(),
        }
        for r in runs
    ]
    return _success(data)
