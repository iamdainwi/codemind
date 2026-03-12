"""
rag.py
RAG pipeline for CodeMind.

Flow:
  1. Embed the user's question
  2. Search Endee for top-k relevant code chunks (filtered by user_id)
  3. Build a code-aware prompt with retrieved context
  4. Stream the response from Ollama token by token
"""

from typing import AsyncGenerator, List, Dict
from sentence_transformers import SentenceTransformer
import ollama as ollama_client

from config import logger, EMBEDDING_MODEL, OLLAMA_MODEL, OLLAMA_HOST
from endee_client import endee


# ── Embedding model (reuse singleton from ingestion if already loaded) ────────

_model: SentenceTransformer | None = None

def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model '{EMBEDDING_MODEL}'...")
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_rag_prompt(question: str, chunks: List[Dict]) -> str:
    """
    Build a prompt that gives the LLM retrieved code context
    and instructs it to answer with file citations.
    """
    context_blocks = []
    for i, chunk in enumerate(chunks, 1):
        context_blocks.append(
            f"[{i}] FILE: {chunk['file_path']} (chunk {chunk['chunk_index']})\n"
            f"```{chunk['language']}\n{chunk['text']}\n```"
        )

    context = "\n\n".join(context_blocks)

    citations = "\n".join(
        [f"[{i}] {c['file_path']}" for i, c in enumerate(chunks, 1)]
    )

    return (
        "You are CodeMind, an expert code assistant. "
        "You answer questions about codebases based ONLY on the provided source code context.\n\n"
        "RULES:\n"
        "- Use inline citations like [1], [2] immediately after each claim\n"
        "- If the answer is not in the context, say so — do not hallucinate\n"
        "- Format code examples in markdown code blocks\n"
        "- Be concise and precise — this is for developers\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"REFERENCES:\n{citations}\n\n"
        f"QUESTION: {question}\n\n"
        "ANSWER:"
    )


# ── RAG pipeline ──────────────────────────────────────────────────────────────

async def stream_rag_answer(question: str, top_k: int = 6, user_id: str = "") -> AsyncGenerator[str, None]:
    """
    Full RAG pipeline — yields SSE-compatible strings.

    Yields:
        event strings of type: "status", "sources", "token", "done", "error"
    """
    import json

    try:
        # Step 1: Embed question
        yield f"event: status\ndata: {json.dumps('Searching codebase...')}\n\n"
        model = _get_model()
        query_vector = model.encode([question]).tolist()[0]

        # Step 2: Search Endee (filtered by user_id)
        hits = endee.search(query_vector, top_k=top_k, user_id=user_id)

        if not hits:
            yield f"event: error\ndata: {json.dumps('No relevant code found in the indexed codebase.')}\n\n"
            return

        # Emit sources
        sources = [{"file_path": h["file_path"], "score": h["score"], "language": h["language"]} for h in hits]
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        # Step 3: Build prompt
        yield f"event: status\ndata: {json.dumps('Generating answer...')}\n\n"
        prompt = _build_rag_prompt(question, hits)

        # Step 4: Stream Ollama
        client = ollama_client.Client(host=OLLAMA_HOST)
        stream = client.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )

        for part in stream:
            token = part["message"]["content"]
            if token:
                yield f"event: token\ndata: {json.dumps(token)}\n\n"

        yield f"event: done\ndata: {json.dumps('Done')}\n\n"

    except Exception as e:
        logger.error(f"RAG error: {e}", exc_info=True)
        yield f"event: error\ndata: {json.dumps(str(e))}\n\n"


def rag_answer_sync(question: str, top_k: int = 6, user_id: str = "") -> str:
    """
    Synchronous RAG — returns full answer as string (used in agent pipeline).
    """
    model = _get_model()
    query_vector = model.encode([question]).tolist()[0]
    hits = endee.search(query_vector, top_k=top_k, user_id=user_id)

    if not hits:
        return "No relevant code found for this sub-question."

    prompt = _build_rag_prompt(question, hits)
    client = ollama_client.Client(host=OLLAMA_HOST)

    response = client.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        stream=False,
    )
    return response["message"]["content"]