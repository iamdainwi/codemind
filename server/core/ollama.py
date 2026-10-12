"""
core/ollama.py
Ollama LLM and Embedding model wrappers.
All model names are read from settings — never hardcoded.
"""
import logging
from functools import lru_cache
from langchain_ollama import OllamaLLM, OllamaEmbeddings
from core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_llm() -> OllamaLLM:
    """
    Return a cached OllamaLLM instance for the configured chat model.
    Streaming is handled at the chain level via astream().
    """
    logger.info("Initializing Ollama LLM: %s", settings.OLLAMA_LLM_MODEL)
    return OllamaLLM(
        model=settings.OLLAMA_LLM_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
        temperature=0.2,
    )


@lru_cache(maxsize=1)
def get_embeddings() -> OllamaEmbeddings:
    """
    Return a cached OllamaEmbeddings instance for the configured embedding model.
    """
    logger.info("Initializing Ollama Embeddings: %s", settings.OLLAMA_EMBED_MODEL)
    return OllamaEmbeddings(
        model=settings.OLLAMA_EMBED_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
    )
