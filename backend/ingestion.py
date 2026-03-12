"""
ingestion.py
Parses code files, chunks them by lines, embeds them, and stores in Endee.

Supports:
  - Individual files (any supported extension)
  - ZIP archives (extracts all supported files automatically)
"""

import io
import uuid
import zipfile
from pathlib import Path
from typing import List, Dict, Tuple

from sentence_transformers import SentenceTransformer

from config import (
    logger, EMBEDDING_MODEL,
    CHUNK_LINES, CHUNK_OVERLAP,
    SUPPORTED_EXTENSIONS,
)
from endee_client import endee


# ── Embedding model (singleton) ───────────────────────────────────────────────

_model: SentenceTransformer | None = None

def _get_model() -> SentenceTransformer:
    """Load the embedding model once and reuse."""
    global _model
    if _model is None:
        logger.info(f"Loading embedding model '{EMBEDDING_MODEL}'...")
        _model = SentenceTransformer(EMBEDDING_MODEL)
        logger.info("Embedding model loaded")
    return _model


# ── Language detection ────────────────────────────────────────────────────────

_EXT_TO_LANG: Dict[str, str] = {
    ".py":   "python",  ".js":  "javascript", ".ts":  "typescript",
    ".tsx":  "tsx",     ".jsx": "jsx",         ".go":  "go",
    ".java": "java",    ".cpp": "cpp",         ".c":   "c",
    ".h":    "c",       ".rs":  "rust",        ".rb":  "ruby",
    ".php":  "php",     ".cs":  "csharp",      ".swift": "swift",
    ".kt":   "kotlin",  ".md":  "markdown",    ".txt": "text",
    ".yaml": "yaml",    ".yml": "yaml",        ".json": "json",
    ".toml": "toml",
}

def _detect_language(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    return _EXT_TO_LANG.get(ext, "text")


# ── Chunking ──────────────────────────────────────────────────────────────────

def _chunk_by_lines(
    text: str,
    chunk_lines: int = CHUNK_LINES,
    overlap: int = CHUNK_OVERLAP,
) -> List[str]:
    """
    Split source code into overlapping line-based chunks.

    Args:
        text:        Full file content.
        chunk_lines: Number of lines per chunk.
        overlap:     Lines of overlap between consecutive chunks.

    Returns:
        List of text chunks.
    """
    lines = text.splitlines()
    if not lines:
        return []

    chunks = []
    start = 0
    while start < len(lines):
        end = min(start + chunk_lines, len(lines))
        chunk = "\n".join(lines[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(lines):
            break
        start = end - overlap

    return chunks


# ── Core ingestion ────────────────────────────────────────────────────────────

def _ingest_single_file(
    file_path: str,
    content: str,
    user_id: str = "",
) -> Tuple[int, int]:
    """
    Process one file: chunk → embed → store in Endee.

    Args:
        file_path: Relative path used as identifier (e.g. "src/main.py")
        content:   Raw file text content.
        user_id:   Owner user ID for data isolation.

    Returns:
        (chunk_count, vectors_stored)
    """
    if not content.strip():
        logger.warning(f"Skipping empty file: {file_path}")
        return 0, 0

    language = _detect_language(file_path)
    raw_chunks = _chunk_by_lines(content)

    if not raw_chunks:
        return 0, 0

    model = _get_model()
    vectors = model.encode(raw_chunks, show_progress_bar=False).tolist()

    chunks_to_store = []
    for i, (chunk_text, vector) in enumerate(zip(raw_chunks, vectors)):
        chunks_to_store.append({
            "id":          str(uuid.uuid4()),
            "vector":      vector,
            "file_path":   file_path,
            "language":    language,
            "chunk_index": i,
            "text":        chunk_text,
        })

    stored = endee.upsert_chunks(chunks_to_store, user_id=user_id)
    logger.info(f"Indexed '{file_path}' — {stored} chunks ({language})")
    return len(raw_chunks), stored


def ingest_file_bytes(filename: str, data: bytes, user_id: str = "") -> Dict:
    """
    Ingest a single file from raw bytes (e.g. from FastAPI UploadFile).

    Returns:
        {files_indexed, chunks_stored, files: [{file_path, language, chunks}]}
    """
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: '{ext}'")

    content = data.decode("utf-8", errors="replace")
    chunk_count, stored = _ingest_single_file(filename, content, user_id=user_id)

    return {
        "files_indexed":  1,
        "chunks_stored":  stored,
        "files": [
            {
                "file_path": filename,
                "language":  _detect_language(filename),
                "chunks":    chunk_count,
            }
        ],
    }


def ingest_zip_bytes(data: bytes, user_id: str = "") -> Dict:
    """
    Ingest a ZIP archive from raw bytes.
    Extracts all files with supported extensions and indexes them.

    Returns:
        {files_indexed, chunks_stored, files: [...], skipped: [...]}
    """
    results = {
        "files_indexed": 0,
        "chunks_stored": 0,
        "files":         [],
        "skipped":       [],
    }

    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise ValueError("Invalid ZIP file")

    for entry in zf.infolist():
        # Skip directories and hidden files
        if entry.is_dir():
            continue
        path = Path(entry.filename)
        if any(part.startswith(".") for part in path.parts):
            continue
        if any(part in {"node_modules", "__pycache__", ".git", "dist", "build", ".next"}
               for part in path.parts):
            continue

        ext = path.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            results["skipped"].append(entry.filename)
            continue

        try:
            raw = zf.read(entry.filename)
            content = raw.decode("utf-8", errors="replace")
            chunk_count, stored = _ingest_single_file(entry.filename, content, user_id=user_id)

            results["files_indexed"] += 1
            results["chunks_stored"] += stored
            results["files"].append({
                "file_path": entry.filename,
                "language":  _detect_language(entry.filename),
                "chunks":    chunk_count,
            })
        except Exception as e:
            logger.warning(f"Failed to index '{entry.filename}': {e}")
            results["skipped"].append(entry.filename)

    zf.close()
    logger.info(
        f"ZIP ingestion complete: {results['files_indexed']} files, "
        f"{results['chunks_stored']} chunks, {len(results['skipped'])} skipped"
    )
    return results