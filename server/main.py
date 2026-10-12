"""
main.py — FastAPI application entry point for CodeMind.

Registers all routers, configures CORS, and manages DB lifecycle events.
Start with: uvicorn main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1 import auth, repos, chat, eval as eval_router
from core.db import get_mongo_client, close_mongo_client
from core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("codemind")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle for MongoDB connection."""
    logger.info("Starting CodeMind API server...")
    # Trigger client creation on startup (validates connectivity)
    get_mongo_client()
    yield
    logger.info("Shutting down CodeMind API server...")
    await close_mongo_client()


app = FastAPI(
    title="CodeMind API",
    description=(
        "AST-Aware Retrieval-Augmented Generation Framework for Codebase Question Answering. "
        "Locally deployed with Ollama, ChromaDB, and MongoDB."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js dev server and local production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,   # Required for session cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api/v1
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(repos.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(eval_router.router, prefix=API_PREFIX)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "codemind-api"}
