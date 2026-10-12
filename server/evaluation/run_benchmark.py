"""
server/evaluation/run_benchmark.py
Offline CLI benchmark script for evaluating retrieval and generation strategies.

Usage:
    python run_benchmark.py --strategy ast --dataset datasets/python_oss_sample.json --output reports/ast_results.json
    python run_benchmark.py --strategy fixed --dataset datasets/python_oss_sample.json --output reports/fixed_results.json
"""
import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add server root to sys.path
SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))

from core.chroma import get_client
from core.ollama import get_llm
from features.eval.metrics import (
    precision_at_k,
    recall_at_k,
    mrr,
    rouge_l,
    chunk_size_stats,
    boundary_accuracy,
)
from pipeline.retriever import retrieve, format_context

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("benchmark")


def run_benchmark(strategy: str, dataset_path: Path, output_path: Path, k: int = 5, repo_id: str = "sample_repo_001"):
    if not dataset_path.exists():
        logger.error(f"Dataset file not found: {dataset_path}")
        sys.exit(1)

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    llm = get_llm()
    per_query_results = []
    p_at_k_list = []
    r_at_k_list = []
    mrr_list = []
    rouge_l_list = []
    all_token_counts = []
    all_node_types = []

    logger.info(f"Starting benchmark: strategy={strategy}, dataset={dataset_path.stem}, queries={len(data)}")

    for idx, item in enumerate(data, start=1):
        query = item["query"]
        relevant_ids = set(item.get("relevant_chunk_ids", []))
        reference_answer = item.get("reference_answer", "")
        item_repo_id = item.get("repo_id", repo_id)

        try:
            results = retrieve(query, item_repo_id, strategy=strategy, k=k)
            retrieved_ids = [r.chunk_id for r in results]
            node_types = [r.node_type for r in results]
            token_counts = [r.metadata.get("token_count", len(r.content) // 4) for r in results]

            all_node_types.extend(node_types)
            all_token_counts.extend(token_counts)

            p_val = precision_at_k(retrieved_ids, relevant_ids, k=k)
            r_val = recall_at_k(retrieved_ids, relevant_ids, k=k)
            mrr_val = mrr(retrieved_ids, relevant_ids)

            p_at_k_list.append(p_val)
            r_at_k_list.append(r_val)
            mrr_list.append(mrr_val)

            # Generate response if LLM available
            try:
                context = format_context(results)
                prompt = (
                    f"Answer the following question about the codebase based on the provided context.\n\n"
                    f"Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"
                )
                generated_answer = llm.invoke(prompt)
                rouge_val = rouge_l(generated_answer, reference_answer)
            except Exception as llm_err:
                logger.warning(f"LLM generation failed for query {idx} ({llm_err}). Skipping ROUGE-L.")
                generated_answer = ""
                rouge_val = 0.0

            rouge_l_list.append(rouge_val)

            per_query_results.append({
                "query": query,
                "retrieved_ids": retrieved_ids,
                "relevant_ids": list(relevant_ids),
                "precision_at_k": round(p_val, 4),
                "recall_at_k": round(r_val, 4),
                "mrr": round(mrr_val, 4),
                "rouge_l": round(rouge_val, 4),
                "generated_answer": generated_answer,
                "reference_answer": reference_answer,
            })

            logger.info(f"Query {idx}/{len(data)}: P@{k}={p_val:.2f}, R@{k}={r_val:.2f}, MRR={mrr_val:.2f}")

        except Exception as e:
            logger.error(f"Error evaluating query {idx} '{query}': {e}")
            per_query_results.append({
                "query": query,
                "error": str(e),
            })

    def avg(lst):
        return round(sum(lst) / len(lst), 4) if lst else 0.0

    size_stats = chunk_size_stats(all_token_counts)
    bound_acc = round(boundary_accuracy(all_node_types), 4)

    benchmark_summary = {
        "strategy": strategy,
        "dataset": dataset_path.stem,
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": {
            f"precision_at_{k}": avg(p_at_k_list),
            f"recall_at_{k}": avg(r_at_k_list),
            "mrr": avg(mrr_list),
            "rouge_l_avg": avg(rouge_l_list),
            "chunk_size_mean": size_stats["mean"],
            "chunk_size_std": size_stats["std"],
            "boundary_accuracy": bound_acc,
        },
        "per_query_results": per_query_results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_summary, f, indent=2)

    logger.info(f"Benchmark completed successfully! Results written to {output_path}")
    print("\n--- BENCHMARK RESULTS SUMMARY ---")
    print(f"Strategy:            {strategy}")
    print(f"Precision@{k}:        {benchmark_summary['metrics'][f'precision_at_{k}']:.4f}")
    print(f"Recall@{k}:           {benchmark_summary['metrics'][f'recall_at_{k}']:.4f}")
    print(f"MRR:                 {benchmark_summary['metrics']['mrr']:.4f}")
    print(f"ROUGE-L Avg:         {benchmark_summary['metrics']['rouge_l_avg']:.4f}")
    print(f"Boundary Accuracy:   {bound_acc * 100:.1f}%")
    print("---------------------------------\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run CodeMind offline benchmark")
    parser.add_argument("--strategy", choices=["ast", "fixed"], required=True, help="Chunking strategy to evaluate")
    parser.add_argument("--dataset", type=Path, default=Path("datasets/python_oss_sample.json"), help="Path to ground truth dataset JSON")
    parser.add_argument("--output", type=Path, default=None, help="Output JSON results path")
    parser.add_argument("--k", type=int, default=5, help="Top-K retrieval depth")
    parser.add_argument("--repo-id", type=str, default="sample_repo_001", help="Target repository id in ChromaDB")
    args = parser.parse_args()

    default_output = Path("reports") / f"{args.strategy}_results.json"
    output_file = args.output if args.output else default_output

    run_benchmark(args.strategy, args.dataset, output_file, k=args.k, repo_id=args.repo_id)
