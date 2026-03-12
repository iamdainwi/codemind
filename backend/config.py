"""
config.py
All configuration for CodeMind backend.
Nothing is hardcoded in logic files — import from here.
"""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

# ── Endee ─────────────────────────────────────────────────────────────────────
ENDEE_HOST        = os.getenv("ENDEE_HOST", "http://localhost:8080")
ENDEE_AUTH_TOKEN  = os.getenv("ENDEE_AUTH_TOKEN", "")
ENDEE_INDEX_NAME  = "codemind"
ENDEE_DIM         = 384          # all-MiniLM-L6-v2 output dimension

# ── Embeddings ────────────────────────────────────────────────────────────────
EMBEDDING_MODEL   = "all-MiniLM-L6-v2"

# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_HOST       = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL      = os.getenv("OLLAMA_MODEL", "codellama")   # or codellama

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_URL         = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB          = os.getenv("MONGO_DB", "codemind")

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET        = os.getenv("JWT_SECRET", "codemind-secret-change-in-production")
JWT_ALGORITHM     = "HS256"
JWT_EXPIRY_HOURS  = 72           

# ── Ingestion ─────────────────────────────────────────────────────────────────
CHUNK_LINES       = 60           
CHUNK_OVERLAP     = 10           

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".go", ".java", ".cpp", ".c", ".h",
    ".rs", ".rb", ".php", ".cs", ".swift",
    ".kt", ".md", ".txt", ".yaml", ".yml",
    ".json", ".toml", ".env.example",
}

# ── Logging ───────────────────────────────────────────────────────────────────
def setup_logging() -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )
    return logging.getLogger("codemind")

logger = setup_logging()