"""
pipeline/embedder.py
Embedding helper — wraps the Ollama embedding model.
Processes chunks in batches to avoid memory pressure on Ollama.
"""
import logging
from typing import List

from pipeline.chunkers.base import Chunk
from core.ollama import get_embeddings

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = 32


def embed_chunks(chunks: List[Chunk], batch_size: int = DEFAULT_BATCH_SIZE) -> List[List[float]]:
    """
    Embed a list of Chunk objects using the Ollama embedding model.

    Processes in batches to avoid OOM on the Ollama server.
    Returns a list of embedding vectors in the same order as the input chunks.

    Args:
        chunks:     List of Chunk objects to embed.
        batch_size: Number of chunks per Ollama request. Default 32.

    Returns:
        List of float vectors, one per chunk.
    """
    embeddings_model = get_embeddings()
    all_vectors: List[List[float]] = []

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        texts = [c.content for c in batch]

        logger.debug(
            "Embedding batch %d/%d (%d chunks)",
            i // batch_size + 1,
            (len(chunks) + batch_size - 1) // batch_size,
            len(batch),
        )

        vectors = embeddings_model.embed_documents(texts)
        all_vectors.extend(vectors)

    return all_vectors
