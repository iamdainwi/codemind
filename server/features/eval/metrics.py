"""
features/eval/metrics.py
Core metric computation functions for the evaluation module.

These functions are intentionally pure (no I/O, no DB) so they can be:
1. Called from features/eval/service.py (API-triggered eval)
2. Imported directly by server/evaluation/compute_metrics.py (offline scripts)
3. Unit-tested in isolation in tests/unit/test_metrics.py

Research metrics implemented:
- Precision@K         | retrieval quality
- Recall@K            | retrieval quality
- MRR                 | retrieval quality
- ROUGE-L             | answer quality
- Chunk size stats    | chunking quality (mean/std/min/max token counts)
- Boundary accuracy   | chunking quality (% of AST chunks at semantic boundaries)
"""
import math
import statistics
from typing import List, Set

from rouge_score import rouge_scorer


def precision_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """
    Precision@K — fraction of top-k retrieved chunks that are relevant.
    Range: [0, 1]. Higher is better.

    Research Note: AST chunking should yield higher P@K because semantic
    chunks align better with function-level queries.
    """
    if k == 0 or not retrieved_ids:
        return 0.0
    top_k = retrieved_ids[:k]
    hits = sum(1 for rid in top_k if rid in relevant_ids)
    return hits / k


def recall_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """
    Recall@K — fraction of relevant chunks found within top-K results.
    Range: [0, 1]. Higher is better.

    Research Note: AST chunks map 1:1 to functions/methods, so relevant
    chunk IDs are exact. Fixed chunks may split a relevant function across
    multiple chunks, artificially inflating recall but polluting precision.
    """
    if not relevant_ids:
        return 0.0
    top_k = set(retrieved_ids[:k])
    hits = len(top_k & relevant_ids)
    return hits / len(relevant_ids)


def mrr(retrieved_ids: List[str], relevant_ids: Set[str]) -> float:
    """
    Mean Reciprocal Rank — 1/rank of the first relevant result.
    Range: (0, 1]. Higher is better. Returns 0 if no relevant result found.

    Research Note: MRR rewards strategies that rank relevant chunks
    near the top, where the LLM context window will prioritise them.
    """
    for rank, rid in enumerate(retrieved_ids, start=1):
        if rid in relevant_ids:
            return 1.0 / rank
    return 0.0


def rouge_l(hypothesis: str, reference: str) -> float:
    """
    ROUGE-L F1 score based on Longest Common Subsequence.
    Range: [0, 1]. Higher = more overlap between generated and reference answer.

    Research Note: Better retrieval (from AST chunking) should yield
    more accurate answers and thus higher ROUGE-L against reference answers.
    """
    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=False)
    scores = scorer.score(reference, hypothesis)
    return scores["rougeL"].fmeasure


def chunk_size_stats(token_counts: List[int]) -> dict:
    """
    Compute descriptive statistics over a list of chunk token counts.
    Used to characterize the size distribution of each chunking strategy.

    Research Note: AST chunks should have lower std-dev (more consistent sizes)
    and lower max (no oversized chunks that waste context window space).
    """
    if not token_counts:
        return {"mean": 0, "std": 0, "min": 0, "max": 0, "count": 0}
    return {
        "mean": round(statistics.mean(token_counts), 2),
        "std": round(statistics.stdev(token_counts) if len(token_counts) > 1 else 0.0, 2),
        "min": min(token_counts),
        "max": max(token_counts),
        "count": len(token_counts),
    }


def boundary_accuracy(chunks_node_types: List[str]) -> float:
    """
    Proportion of chunks that start at a semantic boundary.
    For AST chunks: all chunks are at boundaries -> 1.0.
    For fixed chunks: none are guaranteed -> typically < 1.0.

    Accepts a list of node_type strings from chunk metadata.
    Semantic boundaries: "function", "class", "method" (NOT "fixed", NOT "module").

    Research Note: AST chunking achieves 1.0 by construction.
    Fixed chunking achieves < 1.0, quantifying its structural ignorance.
    """
    if not chunks_node_types:
        return 0.0
    semantic_types = {"function", "class", "method"}
    at_boundary = sum(1 for nt in chunks_node_types if nt in semantic_types)
    return at_boundary / len(chunks_node_types)


def compute_all_metrics(
    retrieved_ids: List[str],
    relevant_ids: Set[str],
    generated_answer: str,
    reference_answer: str,
    chunk_token_counts: List[int],
    chunk_node_types: List[str],
    k: int = 5,
) -> dict:
    """
    Compute all evaluation metrics in one call.
    Returns a flat dict ready for JSON serialisation and MongoDB storage.
    """
    size_stats = chunk_size_stats(chunk_token_counts)
    return {
        "precision_at_k": precision_at_k(retrieved_ids, relevant_ids, k),
        "recall_at_k": recall_at_k(retrieved_ids, relevant_ids, k),
        "mrr": mrr(retrieved_ids, relevant_ids),
        "rouge_l": rouge_l(generated_answer, reference_answer),
        "chunk_size_mean": size_stats["mean"],
        "chunk_size_std": size_stats["std"],
        "chunk_size_min": size_stats["min"],
        "chunk_size_max": size_stats["max"],
        "chunk_count": size_stats["count"],
        "boundary_accuracy": boundary_accuracy(chunk_node_types),
        "k": k,
    }
