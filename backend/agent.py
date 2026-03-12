"""
agent.py
Agentic Q&A pipeline for CodeMind.

Flow:
  1. Decompose complex question into 3 sub-questions via Ollama
  2. Run Endee semantic search for each sub-question (filtered by user_id)
  3. Deduplicate results across all sub-queries
  4. Synthesize a comprehensive final answer with citations
  5. Stream each step back to the UI as SSE events
"""

import json
import re
from typing import AsyncGenerator, List, Dict

import ollama as ollama_client
from sentence_transformers import SentenceTransformer

from config import logger, EMBEDDING_MODEL, OLLAMA_MODEL, OLLAMA_HOST
from endee_client import endee


# ── Embedding model ───────────────────────────────────────────────────────────

_model: SentenceTransformer | None = None

def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


# ── Step 1: Decompose ─────────────────────────────────────────────────────────

def _decompose_question(question: str) -> List[str]:
    """
    Use Ollama to break a complex question into 3 targeted sub-questions.
    Falls back to [question] if decomposition fails.
    """
    prompt = (
        f"You are a code analysis assistant. A developer has a complex question about their codebase:\n"
        f'"{question}"\n\n'
        "Break this into exactly 3 specific, focused sub-questions that together answer the original.\n"
        "Each sub-question should target a different aspect of the codebase.\n"
        "Output ONLY the 3 sub-questions, one per line, no numbering, no explanations."
    )

    try:
        client = ollama_client.Client(host=OLLAMA_HOST)
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
        )
        text = response["message"]["content"].strip()
        lines = [
            re.sub(r"^\d+[\.\\)]\s*", "", line).strip()
            for line in text.splitlines()
            if line.strip() and len(line.strip()) > 5
        ]
        sub_questions = lines[:3] if lines else [question]
        logger.info(f"Decomposed into {len(sub_questions)} sub-questions")
        return sub_questions
    except Exception as e:
        logger.warning(f"Decomposition failed: {e}. Using original question.")
        return [question]


# ── Step 2: Multi-search ──────────────────────────────────────────────────────

def _multi_search(sub_questions: List[str], top_k: int = 4, user_id: str = "") -> List[Dict]:
    """
    Search Endee for each sub-question and merge results.
    Deduplicates by (file_path, chunk_index) to avoid repeating chunks.
    """
    model = _get_model()
    seen: set = set()
    all_chunks = []

    for q in sub_questions:
        vector = model.encode([q]).tolist()[0]
        hits = endee.search(vector, top_k=top_k, user_id=user_id)
        for hit in hits:
            key = (hit["file_path"], hit["chunk_index"])
            if key not in seen:
                seen.add(key)
                hit["source_query"] = q
                all_chunks.append(hit)

    logger.info(f"Multi-search: {len(all_chunks)} unique chunks from {len(sub_questions)} queries")
    return all_chunks


# ── Step 3: Synthesize ────────────────────────────────────────────────────────

def _build_synthesis_prompt(
    original_question: str,
    sub_questions: List[str],
    chunks: List[Dict],
) -> str:
    """Build the final synthesis prompt with all retrieved context."""
    context_blocks = []
    for i, chunk in enumerate(chunks, 1):
        context_blocks.append(
            f"[{i}] FILE: {chunk['file_path']} (chunk {chunk['chunk_index']})\n"
            f"RELEVANT TO: {chunk.get('source_query', '')}\n"
            f"```{chunk['language']}\n{chunk['text']}\n```"
        )

    context = "\n\n".join(context_blocks)
    citations = "\n".join(
        [f"[{i}] {c['file_path']}" for i, c in enumerate(chunks, 1)]
    )
    sub_q_text = "\n".join([f"  - {q}" for q in sub_questions])

    return (
        "You are CodeMind, an expert code assistant. "
        "Answer the developer's question comprehensively using ONLY the provided code context.\n\n"
        "RULES:\n"
        "- Cite sources with [N] inline after every claim\n"
        "- Structure your answer with clear sections if needed\n"
        "- Include relevant code snippets in markdown blocks\n"
        "- Do not hallucinate — only use what's in the context\n\n"
        f"ORIGINAL QUESTION: {original_question}\n\n"
        f"SUB-QUESTIONS EXPLORED:\n{sub_q_text}\n\n"
        f"CODE CONTEXT:\n{context}\n\n"
        f"REFERENCES:\n{citations}\n\n"
        "COMPREHENSIVE ANSWER:"
    )


# ── Main agent pipeline ───────────────────────────────────────────────────────

async def stream_agent_answer(question: str, user_id: str = "") -> AsyncGenerator[str, None]:
    """
    Full agentic pipeline — yields SSE events.

    SSE event types:
        step    — agent progress update  {"step": N, "message": str, "status": "done"|"in-progress"}
        sources — retrieved chunks list
        token   — streamed answer token
        done    — completion signal
        error   — error message
    """
    try:
        # ── Step 1: Decompose ──────────────────────────────────────────────
        yield f"event: step\ndata: {json.dumps({'step': 1, 'message': 'Decomposing question into sub-queries...', 'status': 'in-progress'})}\n\n"

        sub_questions = _decompose_question(question)

        yield f"event: step\ndata: {json.dumps({'step': 1, 'message': f'Decomposed into {len(sub_questions)} sub-questions', 'status': 'done'})}\n\n"
        yield f"event: subquestions\ndata: {json.dumps(sub_questions)}\n\n"

        # ── Step 2: Multi-search ───────────────────────────────────────────
        yield f"event: step\ndata: {json.dumps({'step': 2, 'message': f'Searching codebase for {len(sub_questions)} queries...', 'status': 'in-progress'})}\n\n"

        chunks = _multi_search(sub_questions, top_k=4, user_id=user_id)

        if not chunks:
            yield f"event: error\ndata: {json.dumps('No relevant code found in the indexed codebase.')}\n\n"
            return

        yield f"event: step\ndata: {json.dumps({'step': 2, 'message': f'Found {len(chunks)} unique code chunks', 'status': 'done'})}\n\n"

        # Emit sources for UI
        sources = [
            {"file_path": c["file_path"], "score": c["score"], "language": c["language"]}
            for c in chunks
        ]
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        # ── Step 3: Synthesize ─────────────────────────────────────────────
        yield f"event: step\ndata: {json.dumps({'step': 3, 'message': 'Synthesizing comprehensive answer...', 'status': 'in-progress'})}\n\n"

        prompt = _build_synthesis_prompt(question, sub_questions, chunks)
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

        yield f"event: step\ndata: {json.dumps({'step': 3, 'message': 'Answer synthesized', 'status': 'done'})}\n\n"
        yield f"event: done\ndata: {json.dumps('Agent complete')}\n\n"

    except Exception as e:
        logger.error(f"Agent error: {e}", exc_info=True)
        yield f"event: error\ndata: {json.dumps(str(e))}\n\n"