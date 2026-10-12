"""
api/v1/repos.py
Repo endpoints: upload ZIP, list, get, delete.
File upload triggers background ingest (both AST + fixed strategies).
"""
import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
import aiofiles
from motor.motor_asyncio import AsyncIOMotorDatabase

from api.deps import get_current_user, get_database
from core.config import settings
from core.exceptions import RepoNotFoundError, RepoAccessDeniedError
from features.auth.models import UserDocument
from features.repos import repository as repo_repo
from features.repos.service import ingest_repository, get_repo_for_user, delete_repository

router = APIRouter(prefix="/repos", tags=["repos"])


def _success(data) -> dict:
    return {"success": True, "data": data, "error": None}


def _error(code: str, message: str) -> dict:
    return {"success": False, "data": None, "error": {"code": code, "message": message}}


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_repo(
    zip_file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    """
    Upload a Python codebase as a ZIP file.
    Triggers background ingest with both AST and fixed-window strategies.
    Returns immediately with the repo_id — poll GET /repos/{repo_id} for status.
    """
    if not zip_file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail=_error("INVALID_FILE", "Only .zip files are accepted."),
        )

    # Save the uploaded file
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    repo_id = str(uuid.uuid4())
    zip_path = upload_dir / f"{repo_id}.zip"

    async with aiofiles.open(zip_path, "wb") as f:
        content = await zip_file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=_error("FILE_TOO_LARGE", f"Max upload size is {settings.MAX_UPLOAD_SIZE_MB}MB."),
            )
        await f.write(content)

    # Create the repo document with status "pending"
    repo = await repo_repo.create_repo(db, user.id, zip_file.filename)
    # Override with our predetermined repo_id — we need to update the just-created doc
    # (simpler: store with the auto-generated _id but track zip via repo.id)
    actual_repo_id = repo.id

    # Rename zip to use actual repo_id
    final_zip = upload_dir / f"{actual_repo_id}.zip"
    zip_path.rename(final_zip)

    # Fire-and-forget background task
    asyncio.create_task(ingest_repository(db, actual_repo_id, final_zip))

    return _success({
        "repo_id": actual_repo_id,
        "name": zip_file.filename,
        "status": "pending",
        "message": "Ingest started. Poll GET /repos/{repo_id} for status.",
    })


@router.get("")
async def list_repos(
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    repos = await repo_repo.list_repos_for_user(db, user.id)
    data = [
        {
            "repo_id": r.id,
            "name": r.name,
            "status": r.status,
            "file_count": r.file_count,
            "chunk_count_ast": r.chunk_count_ast,
            "chunk_count_fixed": r.chunk_count_fixed,
            "created_at": r.created_at.isoformat(),
        }
        for r in repos
    ]
    return _success(data)


@router.get("/{repo_id}")
async def get_repo(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    try:
        repo = await get_repo_for_user(db, repo_id, user.id)
    except (RepoNotFoundError, RepoAccessDeniedError) as exc:
        raise HTTPException(status_code=404, detail=_error(exc.code, exc.message))
    return _success({
        "repo_id": repo.id,
        "name": repo.name,
        "status": repo.status,
        "file_count": repo.file_count,
        "chunk_count_ast": repo.chunk_count_ast,
        "chunk_count_fixed": repo.chunk_count_fixed,
        "duration_ms_ast": repo.duration_ms_ast,
        "duration_ms_fixed": repo.duration_ms_fixed,
        "skipped_files": repo.skipped_files,
        "error_message": repo.error_message,
        "created_at": repo.created_at.isoformat(),
    })


@router.delete("/{repo_id}")
async def delete_repo(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    try:
        await delete_repository(db, repo_id, user.id)
    except (RepoNotFoundError, RepoAccessDeniedError) as exc:
        raise HTTPException(status_code=404, detail=_error(exc.code, exc.message))
    return _success({})
