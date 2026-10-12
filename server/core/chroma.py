from __future__ import annotations
import logging
import chromadb
from chromadb import Collection
from core.config import settings

logger = logging.getLogger(__name__)

_client: chromadb.api.client.ClientAPI | None = None


def get_chroma_client():
    """Return the shared ChromaDB client (HTTP or Persistent)."""
    global _client
    if _client is None:
        if settings.CHROMA_SERVER_HOST:
            _client = chromadb.HttpClient(
                host=settings.CHROMA_SERVER_HOST,
                port=settings.CHROMA_SERVER_PORT,
            )
            logger.info(
                "ChromaDB HttpClient connected to %s:%s",
                settings.CHROMA_SERVER_HOST,
                settings.CHROMA_SERVER_PORT,
            )
        else:
            _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            logger.info("ChromaDB PersistentClient created at: %s", settings.CHROMA_PERSIST_DIR)
    return _client


def get_collection(repo_id: str, strategy: str) -> Collection:
    """
    Get or create a ChromaDB collection for a repo+strategy pair.
    Naming convention: repo_{repo_id}_{strategy}
    """
    name = f"repo_{repo_id}_{strategy}"
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=name,
        metadata={"repo_id": repo_id, "strategy": strategy},
    )
    return collection


def delete_collection(repo_id: str, strategy: str) -> None:
    """Delete the ChromaDB collection for a repo+strategy pair."""
    name = f"repo_{repo_id}_{strategy}"
    client = get_chroma_client()
    try:
        client.delete_collection(name=name)
        logger.info("Deleted ChromaDB collection: %s", name)
    except Exception as exc:
        logger.warning("Could not delete collection %s: %s", name, exc)


def collection_exists(repo_id: str, strategy: str) -> bool:
    """Check if a collection already exists for this repo+strategy."""
    name = f"repo_{repo_id}_{strategy}"
    client = get_chroma_client()
    existing = [c.name for c in client.list_collections()]
    return name in existing
