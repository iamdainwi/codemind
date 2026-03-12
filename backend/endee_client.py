"""
endee_client.py
Clean wrapper around the Endee Python SDK.

All methods accept a `user_id` parameter for per-user data isolation.
Vectors are stored with user_id in metadata, and queries filter by user_id.

NOTE: Endee query results are plain dicts — use item['id'], item['similarity'],
item['meta'], NOT item.id or item.similarity.
"""

from typing import List, Dict, Any
import numpy as np
from endee import Endee, Precision
from config import (
    logger, ENDEE_HOST, ENDEE_AUTH_TOKEN,
    ENDEE_INDEX_NAME, ENDEE_DIM,
)


class EndeeClient:
    """Wrapper providing upsert, search, recommend, and list operations."""

    def __init__(self) -> None:
        token = ENDEE_AUTH_TOKEN or ""
        self._client = Endee(token) if token else Endee()
        self._client.set_base_url(f"{ENDEE_HOST}/api/v1")
        self._index_name = ENDEE_INDEX_NAME
        self._index = None
        self._ensure_index()

    # ── Setup ─────────────────────────────────────────────────────────────────

    def _ensure_index(self) -> None:
        """Create the Endee index if it doesn't exist, then cache the handle."""
        try:
            self._index = self._client.get_index(name=self._index_name)
            logger.info(f"Connected to existing Endee index '{self._index_name}'")
        except Exception:
            logger.info(f"Creating Endee index '{self._index_name}'...")
            self._client.create_index(
                name=self._index_name,
                dimension=ENDEE_DIM,
                space_type="cosine",
                precision=Precision.INT8,
            )
            self._index = self._client.get_index(name=self._index_name)
            logger.info(f"Created Endee index '{self._index_name}'")

    # ── Write ─────────────────────────────────────────────────────────────────

    def upsert_chunks(self, chunks: List[Dict[str, Any]], user_id: str = "") -> int:
        """
        Upsert a list of code chunks into Endee.

        Each chunk must have:
            id         : str   — unique identifier
            vector     : list  — 384-dim float list
            file_path  : str   — relative path inside codebase
            language   : str   — detected language (e.g. "python")
            chunk_index: int   — position within the file
            text       : str   — raw source code for this chunk
        """
        if not chunks:
            return 0

        items = [
            {
                "id": c["id"],
                "vector": c["vector"],
                "meta": {
                    "file_path":   c["file_path"],
                    "language":    c["language"],
                    "chunk_index": c["chunk_index"],
                    "text":        c["text"],
                    "user_id":     user_id,
                },
            }
            for c in chunks
        ]

        self._index.upsert(items)
        logger.info(f"Upserted {len(items)} chunks into Endee (user={user_id[:8]}...)")
        return len(items)

    # ── Read ──────────────────────────────────────────────────────────────────

    def search(self, query_vector: List[float], top_k: int = 8, user_id: str = "") -> List[Dict]:
        """
        Semantic search — find top-k most similar chunks for a given user.

        Returns list of dicts:
            {text, file_path, language, chunk_index, score}
        """
        results = self._index.query(vector=query_vector, top_k=top_k * 3)
        hits = []
        for r in results:
            if user_id and r["meta"].get("user_id", "") != user_id:
                continue
            hits.append({
                "text":        r["meta"].get("text", ""),
                "file_path":   r["meta"].get("file_path", ""),
                "language":    r["meta"].get("language", ""),
                "chunk_index": r["meta"].get("chunk_index", 0),
                "score":       round(r["similarity"], 4),
            })
            if len(hits) >= top_k:
                break
        return hits

    def get_file_chunks(self, file_path: str, user_id: str = "") -> List[Dict]:
        """
        Retrieve all stored chunks that belong to a specific file for a user.
        Uses a broad top_k query then filters client-side.
        """
        dummy = [0.0] * ENDEE_DIM
        results = self._index.query(vector=dummy, top_k=500, include_vectors=True)
        chunks = []
        for r in results:
            meta = r["meta"]
            if meta.get("file_path") == file_path and (not user_id or meta.get("user_id", "") == user_id):
                chunks.append({
                    "vector":      r.get("vector", []),
                    "text":        meta.get("text", ""),
                    "chunk_index": meta.get("chunk_index", 0),
                })
        return chunks

    def recommend(self, file_path: str, top_k: int = 4, user_id: str = "") -> List[Dict]:
        """
        Recommend files similar to the given file_path for a specific user.

        Strategy:
          1. Retrieve all chunks for file_path (owned by user)
          2. Compute mean vector across those chunks
          3. Search Endee with the mean vector
          4. Filter out same file + other users, deduplicate by file_path
          5. Return top_k unique files
        """
        chunks = self.get_file_chunks(file_path, user_id=user_id)
        if not chunks:
            logger.warning(f"No chunks found for '{file_path}'. Cannot recommend.")
            return []

        vectors = [c["vector"] for c in chunks if c.get("vector")]
        if not vectors:
            logger.warning(f"Chunks for '{file_path}' have no stored vectors.")
            return []

        mean_vec = np.mean(vectors, axis=0).tolist()
        results = self._index.query(vector=mean_vec, top_k=top_k * 10)

        seen: set = set()
        recommendations = []
        for r in results:
            meta = r["meta"]
            fp = meta.get("file_path", "")
            if fp == file_path or fp in seen:
                continue
            if user_id and meta.get("user_id", "") != user_id:
                continue
            seen.add(fp)
            recommendations.append({
                "file_path": fp,
                "language":  meta.get("language", ""),
                "score":     round(r["similarity"], 4),
            })
            if len(recommendations) >= top_k:
                break

        logger.info(f"Recommendations for '{file_path}': {len(recommendations)} files")
        return recommendations

    def list_files(self, user_id: str = "") -> List[Dict]:
        """
        Return a deduplicated list of all indexed files for a user.
        Each entry: {file_path, language}
        """
        dummy = [0.0] * ENDEE_DIM
        results = self._index.query(vector=dummy, top_k=500)
        seen: set = set()
        files = []
        for r in results:
            meta = r["meta"]
            fp = meta.get("file_path", "")
            if user_id and meta.get("user_id", "") != user_id:
                continue
            if fp and fp not in seen:
                seen.add(fp)
                files.append({
                    "file_path": fp,
                    "language":  meta.get("language", ""),
                })
        files.sort(key=lambda x: x["file_path"])
        return files


# Singleton — import `endee` everywhere instead of instantiating repeatedly
endee = EndeeClient()