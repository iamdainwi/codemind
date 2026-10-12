"""
api/v1/chat.py
Chat endpoints: SSE streaming, history, clear history.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from api.deps import get_current_user, get_database
from core.exceptions import RepoNotFoundError, RepoAccessDeniedError
from features.auth.models import UserDocument
from features.chat.service import stream_rag_response, get_chat_history, clear_chat_history
from features.repos.service import get_repo_for_user

router = APIRouter(prefix="/chat", tags=["chat"])


def _success(data) -> dict:
    return {"success": True, "data": data, "error": None}


def _error(code: str, message: str) -> dict:
    return {"success": False, "data": None, "error": {"code": code, "message": message}}


@router.get("/{repo_id}/stream")
async def stream_chat(
    repo_id: str,
    q: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    """
    SSE endpoint — streams LLM response tokens as Server-Sent Events.

    Client usage (JavaScript):
        const es = new EventSource(`/api/v1/chat/${repoId}/stream?q=...`);
        es.onmessage = (e) => {
          if (e.data === '[DONE]') { es.close(); return; }
          const { token } = JSON.parse(e.data);
          appendToken(token);
        };

    Each event: data: {"token": "..."}\n\n
    Final event: data: [DONE]\n\n
    """
    # Verify repo ownership before streaming
    try:
        repo = await get_repo_for_user(db, repo_id, user.id)
    except (RepoNotFoundError, RepoAccessDeniedError) as exc:
        raise HTTPException(status_code=404, detail=_error(exc.code, exc.message))

    if repo.status != "ready":
        raise HTTPException(
            status_code=400,
            detail=_error("REPO_NOT_READY", f"Repository is not ready. Current status: {repo.status}"),
        )

    if not q.strip():
        raise HTTPException(
            status_code=400,
            detail=_error("EMPTY_QUERY", "Query cannot be empty."),
        )

    return StreamingResponse(
        stream_rag_response(q.strip(), repo_id, user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/{repo_id}/history")
async def get_history(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    history = get_chat_history(user.id, repo_id)
    return _success(history)


@router.delete("/{repo_id}/history")
async def clear_history(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: UserDocument = Depends(get_current_user),
):
    clear_chat_history(user.id, repo_id)
    return _success({})
