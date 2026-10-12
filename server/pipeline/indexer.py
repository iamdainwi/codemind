"""
pipeline/indexer.py
Orchestrates the full ingest pipeline:
  ZIP extraction → .py file discovery → chunking → embedding → ChromaDB upsert

Both strategies (ast and fixed) are indexed for every upload,
enabling side-by-side evaluation without re-uploading.

Research data is captured in IngestResult and logged at INFO level.
"""
import logging
import time
import zipfile
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from core.chroma import get_collection
from core.exceptions import InvalidZipError, IngestError
from core.ollama import get_embeddings
from pipeline.chunkers.base import Chunk
from pipeline.chunkers.ast_chunker import ASTChunker
from pipeline.chunkers.fixed_chunker import FixedChunker
from pipeline.embedder import embed_chunks

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    """
    Captures all statistics from a single ingest run.
    This is research data — persisted to MongoDB by the repos feature.
    """
    repo_id: str
    strategy: Literal["ast", "fixed"]
    file_count: int
    chunk_count: int
    duration_ms: int
    skipped_files: int = 0


def _get_chunker(strategy: Literal["ast", "fixed"]) -> ASTChunker | FixedChunker:
    if strategy == "ast":
        return ASTChunker()
    return FixedChunker()


async def ingest_zip(
    zip_path: Path,
    repo_id: str,
    strategy: Literal["ast", "fixed"],
) -> IngestResult:
    """
    Full ingest pipeline for a single strategy.

    Steps:
    1. Validate and extract ZIP to a temp directory.
    2. Walk all .py files recursively.
    3. Chunk each file using the selected strategy.
    4. Embed chunks in batches via Ollama.
    5. Upsert all chunks into the ChromaDB collection: repo_{repo_id}_{strategy}.
    6. Return IngestResult with research-relevant statistics.

    Args:
        zip_path: Path to the uploaded .zip file.
        repo_id:  Unique repository ID.
        strategy: "ast" or "fixed".

    Raises:
        InvalidZipError: If the file is not a valid ZIP archive.
        IngestError:     If chunking or embedding fails critically.
    """
    t_start = time.monotonic()

    # --- Validate ZIP ---
    if not zipfile.is_zipfile(zip_path):
        raise InvalidZipError()

    chunker = _get_chunker(strategy)
    all_chunks: list[Chunk] = []
    file_count = 0
    skipped_files = 0

    # --- Extract and chunk ---
    with tempfile.TemporaryDirectory() as tmp_dir:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp_dir)

        tmp_path = Path(tmp_dir)
        py_files = list(tmp_path.rglob("*.py"))

        logger.info(
            "[ingest] repo=%s strategy=%s found %d .py files",
            repo_id, strategy, len(py_files),
        )

        for py_file in py_files:
            try:
                source = py_file.read_text(encoding="utf-8", errors="replace")
                # Relative path from the zip root
                rel_path = str(py_file.relative_to(tmp_path))
                chunks = chunker.chunk(source, rel_path)
                all_chunks.extend(chunks)
                file_count += 1
            except Exception as exc:
                logger.warning("Skipping %s: %s", py_file, exc)
                skipped_files += 1

    if not all_chunks:
        raise IngestError("No chunks produced — ensure the ZIP contains .py files.")

    # --- Embed ---
    logger.info(
        "[ingest] repo=%s strategy=%s embedding %d chunks",
        repo_id, strategy, len(all_chunks),
    )
    try:
        vectors = embed_chunks(all_chunks)
    except Exception as exc:
        raise IngestError(f"Embedding failed: {exc}") from exc

    # --- Upsert to ChromaDB ---
    collection = get_collection(repo_id, strategy)
    ids = [c.chunk_id for c in all_chunks]
    documents = [c.content for c in all_chunks]
    metadatas = [
        {k: str(v) for k, v in c.metadata.items()}  # ChromaDB requires string values
        for c in all_chunks
    ]

    # Upsert in batches (ChromaDB has internal limits)
    batch_size = 500
    for i in range(0, len(all_chunks), batch_size):
        collection.upsert(
            ids=ids[i : i + batch_size],
            documents=documents[i : i + batch_size],
            embeddings=vectors[i : i + batch_size],
            metadatas=metadatas[i : i + batch_size],
        )

    duration_ms = int((time.monotonic() - t_start) * 1000)

    result = IngestResult(
        repo_id=repo_id,
        strategy=strategy,
        file_count=file_count,
        chunk_count=len(all_chunks),
        duration_ms=duration_ms,
        skipped_files=skipped_files,
    )

    logger.info(
        "[ingest] COMPLETE repo=%s strategy=%s files=%d chunks=%d skipped=%d duration=%dms",
        repo_id, strategy, file_count, len(all_chunks), skipped_files, duration_ms,
    )

    return result
