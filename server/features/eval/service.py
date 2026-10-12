"""
features/eval/service.py
Orchestrates evaluation runs comparing AST vs fixed-window chunking.
Loads a dataset from disk, runs retrieval + generation for both strategies,
computes all metrics, and persists results to MongoDB.
"""
import json
import logging
from datetime import datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase

from core.ollama import get_llm
from features.eval import repository
from features.eval.metrics import compute_all_metrics
from pipeline.retriever import retrieve, format_context

logger = logging.getLogger(__name__)

# Default dataset path (relative to server root)
DATASETS_DIR = Path(__file__).parent.parent.parent / "evaluation" / "datasets"


async def run_evaluation(
    db: AsyncIOMotorDatabase,
    run_id: str,
    repo_id: str,
    dataset_id: str,
) -> None:
    """
    Background evaluation task — fire-and-forget via asyncio.create_task().

    For each query in the dataset:
    1. Retrieve top-5 chunks from AST collection.
    2. Retrieve top-5 chunks from fixed collection.
    3. Generate an answer using the AST context.
    4. Compute all metrics for both strategies.

    Persists aggregate metrics to MongoDB eval_runs collection.
    """
    await repository.update_eval_run(db, run_id, status="running")
    k = 5

    # Load dataset
    dataset_path = DATASETS_DIR / f"{dataset_id}.json"
    if not dataset_path.exists():
        await repository.update_eval_run(
            db, run_id,
            status="error",
            error_message=f"Dataset '{dataset_id}' not found at {dataset_path}",
        )
        return

    try:
        with open(dataset_path) as f:
            dataset = json.load(f)
    except Exception as exc:
        await repository.update_eval_run(db, run_id, status="error", error_message=str(exc))
        return

    llm = get_llm()
    ast_metrics_per_query = []
    fixed_metrics_per_query = []

    for entry in dataset:
        query = entry["query"]
        relevant_ids = set(entry["relevant_chunk_ids"])
        reference_answer = entry.get("reference_answer", "")

        try:
            # Retrieve from both strategies
            ast_results = retrieve(query, repo_id, strategy="ast", k=k)
            fixed_results = retrieve(query, repo_id, strategy="fixed", k=k)

            # Generate answer from AST context (primary strategy)
            ast_context = format_context(ast_results)
            prompt = (
                f"Answer the following question about the codebase based on "
                f"the provided context.\n\nContext:\n{ast_context}\n\nQuestion: {query}\n\nAnswer:"
            )
            generated = llm.invoke(prompt)

            # Chunk stats from ChromaDB metadata
            ast_node_types = [r.node_type for r in ast_results]
            fixed_node_types = [r.node_type for r in fixed_results]
            ast_token_counts = [r.metadata.get("token_count", len(r.content) // 4) for r in ast_results]
            fixed_token_counts = [r.metadata.get("token_count", len(r.content) // 4) for r in fixed_results]

            ast_m = compute_all_metrics(
                retrieved_ids=[r.chunk_id for r in ast_results],
                relevant_ids=relevant_ids,
                generated_answer=generated,
                reference_answer=reference_answer,
                chunk_token_counts=ast_token_counts,
                chunk_node_types=ast_node_types,
                k=k,
            )
            fixed_m = compute_all_metrics(
                retrieved_ids=[r.chunk_id for r in fixed_results],
                relevant_ids=relevant_ids,
                generated_answer=generated,
                reference_answer=reference_answer,
                chunk_token_counts=fixed_token_counts,
                chunk_node_types=fixed_node_types,
                k=k,
            )

            ast_metrics_per_query.append(ast_m)
            fixed_metrics_per_query.append(fixed_m)

        except Exception as exc:
            logger.warning("Eval query failed (query='%s'): %s", query, exc)

    def _avg(metrics_list: list[dict], key: str) -> float:
        vals = [m[key] for m in metrics_list if key in m]
        return round(sum(vals) / len(vals), 4) if vals else 0.0

    metric_keys = [
        "precision_at_k", "recall_at_k", "mrr", "rouge_l",
        "chunk_size_mean", "chunk_size_std", "chunk_size_min", "chunk_size_max",
        "boundary_accuracy",
    ]

    avg_ast = {k: _avg(ast_metrics_per_query, k) for k in metric_keys}
    avg_fixed = {k: _avg(fixed_metrics_per_query, k) for k in metric_keys}

    await repository.update_eval_run(
        db, run_id,
        status="complete",
        ast_metrics=avg_ast,
        fixed_metrics=avg_fixed,
        completed_at=datetime.utcnow(),
    )

    logger.info(
        "[eval] Complete run_id=%s repo=%s dataset=%s ast_p@k=%.3f fixed_p@k=%.3f",
        run_id, repo_id, dataset_id,
        avg_ast.get("precision_at_k", 0),
        avg_fixed.get("precision_at_k", 0),
    )
