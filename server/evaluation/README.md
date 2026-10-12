# CodeMind — Offline Evaluation Module

This module contains the offline evaluation suite, benchmark datasets, and CLI benchmarking scripts used to generate empirical comparisons between AST-aware chunking and fixed-window chunking for our research paper.

## Directory Structure

- `datasets/`: Curated JSON ground-truth datasets specifying semantic code queries and relevant qualified chunk identifiers.
- `run_benchmark.py`: Command-line benchmark runner that queries ChromaDB across both chunking strategies and computes comparative metrics.
- `compute_metrics.py`: Reusable metric functions (Precision@K, Recall@K, MRR, ROUGE-L, Boundary Accuracy).
- `reports/`: Target output directory for JSON and CSV benchmark logs.

## Running the Benchmark

```bash
# 1. Evaluate AST-based chunking strategy
python run_benchmark.py --strategy ast --dataset datasets/python_oss_sample.json --output reports/ast_results.json

# 2. Evaluate Fixed-window baseline chunking strategy
python run_benchmark.py --strategy fixed --dataset datasets/python_oss_sample.json --output reports/fixed_results.json
```
