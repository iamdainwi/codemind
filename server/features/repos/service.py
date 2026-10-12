"""
features/repos/service.py
Business logic for repository management and ingest orchestration.
Runs both AST and fixed ingest strategies so evaluation is always possible.
"""
import asyncio
import logging
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase

from core.chroma import delete_collection
from core.exceptions import RepoNotFoundError, RepoAccessDeniedError
from features.repos import repository
from features.repos.models import RepoDocument
from pipeline.indexer import ingest_zip

logger = logging.getLogger(__name__)


async def ingest_repository(
    db: AsyncIOMotorDatabase,
    repo_id: str,
    zip_path: Path,
) -> None:
    """
    Background ingest task: run both AST and fixed strategies sequentially.
    Updates the repo document in MongoDB throughout with status and stats.

    This function is fire-and-forget — called via asyncio.create_task().
    """
    await repository.update_repo_status(db, repo_id, status="indexing")
    total_skipped = 0
    file_count = 0

    try:
        # --- AST ingest ---
        logger.info("[service] Starting AST ingest for repo=%s", repo_id)
        ast_result = await ingest_zip(zip_path, repo_id, strategy="ast")
        file_count = ast_result.file_count
        total_skipped = ast_result.skipped_files

        await repository.update_repo_status(
            db, repo_id,
            chunk_count_ast=ast_result.chunk_count,
            duration_ms_ast=ast_result.duration_ms,
            file_count=ast_result.file_count,
        )

        # --- Fixed ingest ---
        logger.info("[service] Starting Fixed ingest for repo=%s", repo_id)
        fixed_result = await ingest_zip(zip_path, repo_id, strategy="fixed")
        total_skipped += fixed_result.skipped_files

        await repository.update_repo_status(
            db, repo_id,
            chunk_count_fixed=fixed_result.chunk_count,
            duration_ms_fixed=fixed_result.duration_ms,
            skipped_files=total_skipped,
            status="ready",
        )

        logger.info(
            "[service] Ingest complete: repo=%s ast_chunks=%d fixed_chunks=%d",
            repo_id, ast_result.chunk_count, fixed_result.chunk_count,
        )

    except Exception as exc:
        logger.error("[service] Ingest failed for repo=%s: %s", repo_id, exc)
        await repository.update_repo_status(
            db, repo_id, status="error", error_message=str(exc)
        )
    finally:
        # Clean up the uploaded zip
        try:
            zip_path.unlink(missing_ok=True)
        except Exception:
            pass


async def get_repo_for_user(
    db: AsyncIOMotorDatabase, repo_id: str, user_id: str
) -> RepoDocument:
    """Fetch a repo, verifying it belongs to the requesting user."""
    repo = await repository.get_repo(db, repo_id)
    if repo is None:
        raise RepoNotFoundError(repo_id)
    if repo.user_id != user_id:
        raise RepoAccessDeniedError(repo_id)
    return repo


async def delete_repository(
    db: AsyncIOMotorDatabase, repo_id: str, user_id: str
) -> None:
    """
    Delete a repo document from MongoDB and its two ChromaDB collections.
    Verifies ownership before deletion.
    """
    repo = await get_repo_for_user(db, repo_id, user_id)
    delete_collection(repo_id, "ast")
    delete_collection(repo_id, "fixed")
    await repository.delete_repo(db, repo_id)
    logger.info("[service] Deleted repo=%s for user=%s", repo_id, user_id)
