"""
main.py
FastAPI application for CodeMind.

Routes:
  POST /auth/register   — Create account
  POST /auth/login      — Login, get JWT
  GET  /auth/me         — Get current user info
  POST /ingest          — Upload code file or ZIP → index into Endee (protected)
  POST /ask             — RAG Q&A with SSE streaming (protected)
  POST /agent           — Agentic Q&A with SSE streaming (protected)
  GET  /search          — Pure semantic search on Endee (protected)
  GET  /recommend       — Similar files for a given file_path (protected)
  GET  /files           — List all indexed files (protected)
  GET  /health          — Health check
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import logger
from ingestion import ingest_file_bytes, ingest_zip_bytes
from rag import stream_rag_answer
from agent import stream_agent_answer
from endee_client import endee
from auth import (
    RegisterRequest, LoginRequest, AuthResponse, UserOut,
    register_user, login_user, get_user_profile,
    get_current_user,
)

app = FastAPI(title="CodeMind API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def ok(data) -> dict:
    """Standard success response."""
    return {"success": True, "data": data, "error": None}

def err(msg: str) -> dict:
    """Standard error response."""
    return {"success": False, "data": None, "error": msg}


# ── Request models ────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    top_k: int = 6

class AgentRequest(BaseModel):
    question: str


# ── AUTH ROUTES ───────────────────────────────────────────────────────────────

@app.post("/auth/register")
async def auth_register(req: RegisterRequest):
    """Create a new user account and return a JWT token."""
    result = register_user(req)
    return ok({"token": result.token, "user": result.user.model_dump()})


@app.post("/auth/login")
async def auth_login(req: LoginRequest):
    """Login with email + password, return JWT token."""
    result = login_user(req)
    return ok({"token": result.token, "user": result.user.model_dump()})


@app.get("/auth/me")
async def auth_me(user: UserOut = Depends(get_current_user)):
    """Get current authenticated user info."""
    profile = get_user_profile(user.id)
    return ok({"user": profile.model_dump()})


# ── POST /ingest (PROTECTED) ─────────────────────────────────────────────────

@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    user: UserOut = Depends(get_current_user),
):
    """
    Upload a code file (.py, .js, .ts, etc.) or a ZIP archive.
    All supported files are chunked, embedded, and stored in Endee.
    Files are tagged with the authenticated user's ID.

    Returns: files_indexed, chunks_stored, files list, skipped list
    """
    try:
        data = await file.read()
        filename = file.filename or "upload"
        logger.info(f"Ingest request: '{filename}' ({len(data)} bytes) by user={user.id[:8]}...")

        if filename.endswith(".zip"):
            result = ingest_zip_bytes(data, user_id=user.id)
        else:
            result = ingest_file_bytes(filename, data, user_id=user.id)

        logger.info(
            f"Ingest complete: {result['files_indexed']} files, "
            f"{result['chunks_stored']} chunks"
        )
        return ok(result)

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Ingest error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /ask (PROTECTED) ────────────────────────────────────────────────────

@app.post("/ask")
async def ask(
    request: AskRequest,
    user: UserOut = Depends(get_current_user),
):
    """
    RAG pipeline: embed question → search Endee → stream Ollama answer.
    Only searches the authenticated user's indexed code.
    Returns a Server-Sent Events stream.
    """
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    return StreamingResponse(
        stream_rag_answer(request.question, top_k=request.top_k, user_id=user.id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── POST /agent (PROTECTED) ──────────────────────────────────────────────────

@app.post("/agent")
async def agent(
    request: AgentRequest,
    user: UserOut = Depends(get_current_user),
):
    """
    Agentic Q&A: decompose → multi-search Endee → synthesize.
    Only searches the authenticated user's indexed code.
    Returns a Server-Sent Events stream.
    """
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    return StreamingResponse(
        stream_agent_answer(request.question, user_id=user.id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /search (PROTECTED) ──────────────────────────────────────────────────

@app.get("/search")
async def search(
    q: str = Query(..., description="Search query — describe what you're looking for"),
    top_k: int = Query(8, ge=1, le=20),
    user: UserOut = Depends(get_current_user),
):
    """
    Pure semantic search on Endee (user-scoped). No LLM involved.
    Returns ranked code chunks with similarity scores.
    """
    if not q.strip():
        raise HTTPException(status_code=422, detail="Query 'q' cannot be empty")

    try:
        from ingestion import _get_model

        model = _get_model()
        vector = model.encode([q]).tolist()[0]
        hits = endee.search(vector, top_k=top_k, user_id=user.id)

        return ok({"query": q, "results": hits, "count": len(hits)})
    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /recommend (PROTECTED) ───────────────────────────────────────────────

@app.get("/recommend")
async def recommend(
    file_path: str = Query(..., description="File path to find similar files for"),
    top_k: int = Query(4, ge=1, le=10),
    user: UserOut = Depends(get_current_user),
):
    """
    Find files similar to the given file_path using Endee vector similarity.
    Only searches within the authenticated user's indexed files.
    """
    if not file_path.strip():
        raise HTTPException(status_code=422, detail="file_path cannot be empty")

    try:
        recs = endee.recommend(file_path=file_path, top_k=top_k, user_id=user.id)
        return ok({"file_path": file_path, "recommendations": recs})
    except Exception as e:
        logger.error(f"Recommend error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /files (PROTECTED) ───────────────────────────────────────────────────

@app.get("/files")
async def list_files(user: UserOut = Depends(get_current_user)):
    """
    Return all unique files indexed by the authenticated user.
    Each entry: {file_path, language}
    """
    try:
        files = endee.list_files(user_id=user.id)
        return ok({"files": files, "count": len(files)})
    except Exception as e:
        logger.error(f"List files error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /health ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — verify API is up."""
    return {"status": "ok", "service": "CodeMind API"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)