"""
pipeline/retriever.py
ChromaDB similarity search wrapper.
Returns ranked RetrievalResult objects for use in the RAG chain and eval module.
"""
import logging
from dataclasses import dataclass
from typing import List, Literal

from core.chroma import get_collection
from core.ollama import get_embeddings

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """A single retrieved chunk with its similarity score."""
    chunk_id: str
    content: str
    file_path: str
    node_type: str
    score: float          # ChromaDB distance (lower = more similar)
    metadata: dict


def retrieve(
    query: str,
    repo_id: str,
    strategy: Literal["ast", "fixed"],
    k: int = 5,
) -> List[RetrievalResult]:
    """
    Retrieve the top-k most relevant chunks for a query.

    Embeds the query using the same Ollama model used during ingest,
    then queries ChromaDB for nearest neighbours.

    Args:
        query:    Natural language question about the codebase.
        repo_id:  Repository ID (used to identify the ChromaDB collection).
        strategy: "ast" or "fixed" — selects which collection to query.
        k:        Number of results to return.

    Returns:
        List of RetrievalResult, ordered by relevance (most relevant first).
    """
    embeddings_model = get_embeddings()
    query_vector = embeddings_model.embed_query(query)

    collection = get_collection(repo_id, strategy)
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=min(k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    retrieval_results: List[RetrievalResult] = []

    if not results["ids"] or not results["ids"][0]:
        return retrieval_results

    ids = results["ids"][0]
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    for chunk_id, doc, meta, dist in zip(ids, documents, metadatas, distances):
        retrieval_results.append(
            RetrievalResult(
                chunk_id=chunk_id,
                content=doc,
                file_path=meta.get("file_path", ""),
                node_type=meta.get("node_type", ""),
                score=dist,
                metadata=meta,
            )
        )

    logger.debug(
        "Retrieved %d chunks for query (strategy=%s, repo=%s)",
        len(retrieval_results),
        strategy,
        repo_id,
    )
    return retrieval_results


def format_context(results: List[RetrievalResult]) -> str:
    """
    Format retrieved chunks into a single context string for the LLM prompt.
    Each chunk is prefixed with its file path and node type.
    """
    parts = []
    for r in results:
        header = f"# File: {r.file_path} [{r.node_type}]"
        parts.append(f"{header}\n{r.content}")
    return "\n\n---\n\n".join(parts)
