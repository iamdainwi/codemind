# CodeMind: AST-Aware Retrieval-Augmented Generation for Codebase Question Answering

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.4+-black.svg)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5+-orange.svg)](https://www.trychroma.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Local_Inference-black.svg)](https://ollama.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **CodeMind** is an open-source, locally deployed, privacy-preserving Retrieval-Augmented Generation (RAG) framework engineered specifically for Python codebase question answering. By parsing source code into Abstract Syntax Trees (AST) via `tree-sitter`, CodeMind ensures that every indexed code chunk represents a complete, compilable syntactic unit (classes, functions, methods). This design prevents the context truncation and hallucinatory overconfidence inherent to conventional fixed-window text chunking.

---

## Table of Contents

- [Overview & Research Motivation](#overview--research-motivation)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
  - [Architecture Diagram](#architecture-diagram)
  - [Ingestion Pipeline](#ingestion-pipeline)
  - [Retrieval & Generation Pipeline](#retrieval--generation-pipeline)
- [Empirical Research & Benchmark Results](#empirical-research--benchmark-results)
  - [Experimental Setup](#experimental-setup)
  - [Quantitative Results Matrix](#quantitative-results-matrix)
  - [Model Calibration & Confidence-Missed Error (CME)](#model-calibration--confidence-missed-error-cme)
  - [Generated Publication Figures](#generated-publication-figures)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quickstart & Installation](#quickstart--installation)
  - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Method 2: Manual Local Development](#method-2-manual-local-development)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
- [Running Benchmarks & Reproducing Research](#running-benchmarks--reproducing-research)
- [Directory Structure](#directory-structure)
- [Testing](#testing)
- [Research Paper & Citation](#research-paper--citation)
- [Contributing & Code Style](#contributing--code-style)
- [License & Acknowledgments](#license--acknowledgments)

---

## Overview & Research Motivation

Standard Retrieval-Augmented Generation (RAG) systems for code commonly apply structure-agnostic chunking—splitting source files at arbitrary character or token boundaries with sliding-window overlap. When applied to programming languages, this naive approach suffers from three fundamental failure modes:

1. **Syntactic Cleaving**: Signatures are cut from bodies, control statements are bisected, and docstrings are isolated from their target functions.
2. **Context Pollution**: Sub-token fragments surface as lexical false-positives, populating context windows with uninformative code snippets.
3. **Deceptive Overconfidence (Hallucination Bait)**: When presented with partial syntactic context, Large Language Models frequently complete missing logic from parametric memory, hallucinating arguments or return types while asserting high confidence.

**CodeMind** directly addresses these challenges by substituting fixed-window slicing with **Abstract Syntax Tree (AST)-aware chunking**. Using tree-sitter grammars, CodeMind extracts each top-level function, class, and method as an autonomous semantic unit.

```
Conventional Fixed-Window (Naive):
+--------------------+--------------------+--------------------+
| ...def train_step( | batch, optimizer): |  loss = criterion..|  <- Truncated mid-expression
+--------------------+--------------------+--------------------+

CodeMind AST-Aware:
+--------------------------------------------------------------+
| def train_step(batch, optimizer):                            |  <- Complete semantic unit
|     loss = criterion(model(batch.x), batch.y)                |     Preserves 100% boundary
|     loss.backward(); optimizer.step(); return loss           |     integrity & citations
+--------------------------------------------------------------+
```

---

## Key Features

- **AST-Aware Syntax Chunking**: Full Python AST parsing via `tree-sitter` and `tree-sitter-python`. Functions, classes, and decorated methods are extracted as discrete semantic blocks with complete boundary preservation.
- **Dual-Collection Indexing**: Every ingested repository automatically populates parallel collections (`repo_{id}_ast` and `repo_{id}_fixed`) in ChromaDB, enabling rigorous side-by-side comparative evaluation under identical vector spaces.
- **100% Local & Air-Gapped Privacy**: Operates entirely on local hardware using Ollama (`embeddinggemma-2:570m` for embeddings and `gemma4:e2b-mlx` for generation). No proprietary APIs or third-party cloud services are invoked; source code never leaves the machine.
- **Model Calibration & CME Analysis**: Introduces the **Confidence-Missed Error (CME)** rate metric to quantify LLM overconfidence under retrieval failure ($P@5 \le 0.20 \land \text{Confidence} \ge 4$).
- **Streaming RAG with Real-Time SSE**: Low-latency token streaming over HTTP Server-Sent Events (SSE) with interactive markdown rendering, code block syntax highlighting, and source citations.
- **Interactive Evaluation Dashboard**: Built-in Next.js interface providing real-time side-by-side metric tables and Recharts visualizations for Precision@K, Recall@K, MRR, ROUGE-L, and chunk size distributions.
- **Automated Research Benchmark Suite**: Production-grade offline benchmarking harness with paired Student's $t$-tests, paired Cohen's $d_z$ effect sizes, Wilson 95% confidence intervals, and automated vector PDF figure generation.

---

## System Architecture

### Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                               Browser (Next.js 16)                              |
|   ZIP Upload  |  Repository Explorer  |  Interactive Chat  |  Eval Dashboard    |
+---------------------------------------+-----------------------------------------+
                                        | HTTP REST / Server-Sent Events (SSE)
                                        v
+---------------------------------------------------------------------------------+
|                            FastAPI Backend (Port 8000)                          |
|                                                                                 |
|   +-----------------------+   +----------------------+   +------------------+   |
|   | api/v1/ (Routers)     |-->| features/ (Services) |-->| pipeline/ (Core) |   |
|   | auth, repos, chat, eval|  | business logic & DB  |   | chunk, embed, RAG|   |
|   +-----------------------+   +----------------------+   +------------------+   |
+-----------+-----------------------+----------------------+----------------------+
            |                       |                      |
            v                       v                      v
     +--------------+       +---------------+      +---------------+
     |   MongoDB    |       |   ChromaDB    |      |  Local Ollama |
     | (Port 27017) |       |  (Port 8001)  |      | (Port 11434)  |
     | Users, Chats,|       | repo_{id}_ast |      | Embeddings &  |
     | Repos, Eval  |       | repo_{id}_fix |      | LLM Inference |
     +--------------+       +---------------+      +---------------+
```

### Ingestion Pipeline

1. **Archive Ingestion**: The user uploads a codebase as a `.zip` archive via `POST /api/v1/repos`.
2. **Extraction & Discovery**: Archives are securely uncompressed into isolated temporary directories; all `.py` source files are cataloged recursively.
3. **Dual Chunking**:
   - `ASTChunker`: Traverses the tree-sitter AST, extracting top-level functions, classes, and member methods into discrete chunks annotated with line ranges and symbol identifiers (`file.py::ClassName.method_name`).
   - `FixedChunker`: Splits raw text into fixed 1,000-character windows with 200-character overlap.
4. **Vector Embedding**: Chunks are embedded in batches of 32 using Ollama's `embeddinggemma-2:570m` (768-dimensional vectors).
5. **Collection Upsert**: Vectors and metadata are stored in isolated ChromaDB collections (`repo_{repo_id}_ast` and `repo_{repo_id}_fixed`) using cosine distance.
6. **Metadata Persistence**: Ingestion statistics (file count, chunk count, duration) are saved to MongoDB.

### Retrieval & Generation Pipeline

1. **Query Encoding**: User queries are embedded into the 768-dimensional space via Ollama.
2. **Similarity Search**: ChromaDB retrieves the top-$K$ nearest chunks from the active strategy collection.
3. **Context Construction**: Chunks are formatted into structured citations specifying relative file paths, symbol boundaries, and line numbers.
4. **LLM Invocation**: The prompt and MongoDB-backed conversation history are submitted to `gemma4:e2b-mlx`.
5. **Streaming Response & Calibration**: Tokens are streamed via SSE. The model provides a grounded answer and a self-reported confidence integer ($1\text{--}5$) parsed via regular expressions.

---

## Empirical Research & Benchmark Results

### Experimental Setup

The empirical validation was conducted on two real-world Python codebases across **15 natural language queries** targeting specific architectural symbols:
1. `sample_repo_001`: Synthetic neural training pipeline (`dataloader.py`, `models.py`, `trainer.py`, `utils.py`).
2. `codemind-main`: Production CodeMind backend service (`auth.py`, `agent.py`, `ast_chunker.py`, `github.py`, `rag.py`).

- **Hardware**: Apple MacBook Air M3, 24 GB Unified RAM, 512 GB SSD.
- **Embedding Model**: `embeddinggemma-2:570m` ($d = 768$).
- **Language Model**: `gemma4:e2b-mlx` (temperature = $0.0$, local Ollama execution).
- **Statistical Rigor**: Paired two-tailed Student's $t$-tests, paired Cohen's $d_z$ effect sizes, and Wilson 95% score confidence intervals for binomial proportions.

### Quantitative Results Matrix

| Metric | AST-Aware Chunker (Ours) | Fixed-Window Baseline | Absolute Delta ($\Delta$) | Relative Gain | Cohen's $d$ | $p$-value (Paired $t$-test) | 95% Wilson CI (AST vs. Fixed) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Precision@1** | 53.3% | **60.0%** | $-6.7\%$ | $-11.1\%$ | $-0.26$ | $p = 0.334$ | — |
| **Precision@5** | **36.0%** | 22.7% | $+13.3\%$ | **+58.8%** | **+0.46** | **$p = 0.096$** | — |
| **Precision@10** | **21.3%** | 12.7% | $+8.7\%$ | **+68.4%** | **+0.70** | **$p = 0.017$** | — |
| **Recall@5** | **93.3%** | **93.3%** | $+0.0\%$ | $+0.0\%$ | $0.00$ | $p = 1.000$ | $[70.2\%, 98.8\%]$ vs. $[70.2\%, 98.8\%]$ |
| **Mean Reciprocal Rank (MRR)** | 0.717 | **0.763** | $-0.046$ | $-6.1\%$ | $-0.20$ | $p = 0.448$ | — |
| **NDCG@5** | 0.710 | **0.777** | $-0.067$ | $-8.6\%$ | $-0.25$ | $p = 0.358$ | — |
| **ROUGE-1 F1** | **0.352** | 0.330 | $+0.021$ | $+6.5\%$ | $+0.23$ | $p = 0.390$ | — |
| **ROUGE-L F1** | **0.304** | 0.282 | $+0.021$ | **+7.6%** | **+0.26** | $p = 0.336$ | — |
| **Boundary Accuracy** | **100.0%** | 11.7% | $+88.3\%$ | **+757.1%** | **+6.84** | **$p = 2.30 \times 10^{-13}$** | $[79.6\%, 100.0\%]$ vs. $[3.7\%, 37.9\%]$ |
| **Mean Confidence (1–5)** | 4.80 | **5.00** | $-0.20$ | $-4.0\%$ | $-0.26$ | $p = 0.334$ | — |
| **Confidence-Missed Error (CME)** | **46.7%** | 80.0% | $-33.3\%$ | **-41.7%** | **-0.54** | **$p = 0.055$** | $[24.8\%, 69.9\%]$ vs. $[54.8\%, 93.0\%]$ |

### Model Calibration & Confidence-Missed Error (CME)

In software engineering QA, an assistant must exhibit calibrated uncertainty: when context retrieval fails, the model should abstain rather than hallucinate with false certainty. We formalize this using the **Confidence-Missed Error (CME)** rate:

$$\text{CME Rate} = \frac{1}{N} \sum_{i=1}^N \mathbb{I}(\text{Confidence}_i \ge 4 \land P@5_i \le 0.20)$$

- **Finding**: AST chunking reduces the CME rate from **80.0%** to **46.7%** (a **41.7% relative reduction**, $p = 0.055$, Cohen's $d = -0.54$).
- **Explanation**: Preserving syntax boundaries ensures that when relevant units are missing from top-$K$, the model observes complete, un-truncated adjacent functions and correctly senses that the target symbol is absent, lowering its confidence. Conversely, arbitrary fixed-window slices feed fragmented signatures and partial statements that bait the LLM into confident hallucination.

### Generated Publication Figures

Vector PDFs and 300 DPI PNGs are automatically compiled into [`benchmark results/figures/`](benchmark%20results/figures/):

| Figure File | Description |
|---|---|
| [`fig1_retrieval_performance_comparison.pdf`](benchmark%20results/figures/fig1_retrieval_performance_comparison.pdf) | Grouped bar chart comparing Precision@5, Recall@5, MRR, NDCG@5, ROUGE-L, Boundary Accuracy, and Confidence. |
| [`fig2_precision_recall_vs_k.pdf`](benchmark%20results/figures/fig2_precision_recall_vs_k.pdf) | Precision@K and Recall@K curves across $K \in \{1, 2, 3, 5, 8, 10\}$. |
| [`fig3_chunk_size_distribution.pdf`](benchmark%20results/figures/fig3_chunk_size_distribution.pdf) | Boxplot and Kernel Density Estimation (KDE) demonstrating natural AST size variation vs. rigid fixed slicing. |
| [`fig4_answer_quality_rouge.pdf`](benchmark%20results/figures/fig4_answer_quality_rouge.pdf) | Downstream generation ROUGE scores alongside Model Calibration and CME error rates. |
| [`fig5_empirical_correlation_heatmap.pdf`](benchmark%20results/figures/fig5_empirical_correlation_heatmap.pdf) | Correlation matrix between Syntactic Boundary Preservation, Confidence, and Retrieval metrics. |

---

## Tech Stack

### Backend
- **Framework**: FastAPI 0.115+ (ASGI via Uvicorn)
- **Language**: Python 3.11+
- **Parsing**: `tree-sitter 0.23+`, `tree-sitter-python 0.23+`
- **RAG Orchestration**: `langchain 0.3+`, `langchain-community`, `langchain-ollama`
- **Vector Database**: `chromadb 0.5+` (Cosine distance space)
- **Document Database**: `motor 3.5+` (Async MongoDB driver), `pymongo 4.8+`
- **Evaluation & Statistics**: `scipy`, `pandas`, `numpy`, `matplotlib`, `seaborn`, `rouge-score`
- **Authentication**: `starlette.middleware.sessions` (Server-side signed cookies, bcrypt)

### Frontend
- **Framework**: Next.js 16.4 (App Router)
- **Runtime**: React 19.3
- **Styling**: Tailwind CSS v4, `tw-animate-css`
- **Component Primitives**: shadcn UI (`@base-ui/react`, Nova preset)
- **Visualization**: Recharts 3.10+
- **State Management**: Zustand 5.0+
- **Icons**: Lucide React

### Local Inference
- **Server**: Ollama
- **Embedding Model**: `embeddinggemma-2:570m` ($d = 768$)
- **Generation Model**: `gemma4:e2b-mlx`

---

## Prerequisites

Before starting, ensure the following dependencies are installed on your host system:

1. **Docker & Docker Compose** (version 24.0+)
2. **Python 3.11+** (for manual local development)
3. **Node.js 20+ & npm** (for client development)
4. **Ollama**: Installed and running locally ([Download Ollama](https://ollama.com/download))

Pull the required models in Ollama:

```bash
ollama pull embeddinggemma-2:570m
ollama pull gemma4:e2b-mlx
```

Verify that both models are present:

```bash
ollama list
```

---

## Quickstart & Installation

### Method 1: Docker Compose (Recommended)

The fastest way to deploy the complete CodeMind system (FastAPI, Next.js, MongoDB, and ChromaDB) is via Docker Compose:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iamdainwi/codemind.git
   cd codemind
   ```

2. **Configure environment variables**:
   ```bash
   cp server/.env.example server/.env
   ```
   *Generate a session secret key and update `server/.env`:*
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

3. **Start the stack**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify running containers**:
   ```bash
   docker compose ps
   ```

5. **Access the application**:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **FastAPI Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **ChromaDB API**: [http://localhost:8001/api/v2/heartbeat](http://localhost:8001/api/v2/heartbeat)

---

### Method 2: Manual Local Development

#### 1. Start Support Databases
Start MongoDB and ChromaDB using Docker or native local services:

```bash
docker run -d --name codemind-mongo -p 27017:27017 -v mongo_data:/data/db mongo:7.0
docker run -d --name codemind-chroma -p 8001:8000 -v chroma_data:/chroma/chroma chromadb/chroma:latest
```

#### 2. Backend Setup (FastAPI)
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create .env configuration
cp .env.example .env
# Edit .env and ensure SESSION_SECRET_KEY is populated

# Start the development server
uvicorn main:app --reload --port 8000
```

#### 3. Frontend Setup (Next.js)
In a separate terminal:

```bash
cd client
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration Reference

The backend configuration is managed via Pydantic Settings in [`server/core/config.py`](server/core/config.py). Variables can be defined in `server/.env`:

| Variable | Type | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | string | `mongodb://localhost:27017` | MongoDB connection URI string |
| `MONGODB_DB` | string | `codemind` | Target MongoDB database name |
| `CHROMA_SERVER_HOST` | string | `localhost` | ChromaDB HTTP host (empty for embedded persistent client) |
| `CHROMA_SERVER_PORT` | string | `8001` | ChromaDB HTTP port |
| `CHROMA_PERSIST_DIR` | string | `./data/chroma` | Local directory for embedded ChromaDB storage |
| `OLLAMA_BASE_URL` | string | `http://localhost:11434` | Endpoint of the local Ollama instance |
| `OLLAMA_LLM_MODEL` | string | `gemma4:e2b-mlx` | Model tag for conversational generation |
| `OLLAMA_EMBED_MODEL`| string | `embeddinggemma-2:570m` | Model tag for 768-d embeddings |
| `SESSION_SECRET_KEY`| string | *Required* | 64-char hex key for signing session cookies |
| `SESSION_MAX_AGE`   | integer| `86400` | Session cookie validity duration in seconds (24h) |
| `UPLOAD_DIR`        | string | `./data/uploads` | Path for temporary storage of ingested ZIP archives |
| `MAX_UPLOAD_SIZE_MB`| integer| `100` | Maximum allowable upload file size in megabytes |

---

## API Reference

The FastAPI service exposes interactive OpenAPI documentation at `/docs` and `/redoc`.

### Authentication
- `POST /api/v1/auth/register` — Register a new account (`username`, `password`).
- `POST /api/v1/auth/login` — Authenticate and receive a signed HTTP-only session cookie.
- `POST /api/v1/auth/logout` — Invalidate the active session.
- `GET /api/v1/auth/me` — Return currently authenticated user profile.

### Repositories
- `POST /api/v1/repos` — Upload a repository `.zip` archive. Automatically triggers dual AST and fixed-window indexing.
- `GET /api/v1/repos` — List all repositories belonging to the active user.
- `GET /api/v1/repos/{repo_id}` — Get status, file count, and chunking statistics for a repository.
- `DELETE /api/v1/repos/{repo_id}` — Delete a repository and drop its ChromaDB collections.

### Chat & Streaming RAG
- `GET /api/v1/chat/{repo_id}/stream?q={query}` — Stream conversational answer via Server-Sent Events (SSE). Chunks tokens in real time.
- `GET /api/v1/chat/{repo_id}/history` — Retrieve session message history.
- `DELETE /api/v1/chat/{repo_id}/history` — Clear conversation memory.

### Evaluation
- `POST /api/v1/eval/{repo_id}/run` — Trigger an evaluation run across both chunking strategies on the repository.
- `GET /api/v1/eval/{repo_id}/results` — Fetch comparative metric breakdown (Precision, Recall, MRR, ROUGE-L).
- `GET /api/v1/eval/results` — Fetch the global list of evaluation runs.

### System
- `GET /health` — Service health check and readiness probe.

---

## Running Benchmarks & Reproducing Research

CodeMind includes an end-to-end evaluation harness that executes genuine retrievals and local inference without fabricated data.

### 1. Execute Comprehensive Benchmark Suite
To reproduce the full empirical benchmark report, CSV dataset, and vector figures:

```bash
# Ensure ChromaDB and Ollama are running
python3 server/evaluation/run_comprehensive_benchmark.py
```

This script:
1. Executes all 15 benchmark queries across both AST and Fixed-window strategies.
2. Performs local generation using `gemma4:e2b-mlx` and extracts calibration confidence integers.
3. Computes paired Student's $t$-tests and paired Cohen's $d_z$ effect sizes.
4. Calculates exact 95% Wilson score confidence intervals for Boundary Accuracy, Recall@5, and CME.
5. Emits publication figures into `benchmark results/figures/`.
6. Regenerates [`benchmark results/RESEARCH_BENCHMARK_REPORT.md`](benchmark%20results/RESEARCH_BENCHMARK_REPORT.md) and [`benchmark results/benchmark_empirical_results.json`](benchmark%20results/benchmark_empirical_results.json).

### 2. Run Offline Benchmark CLI
To evaluate a custom dataset formatted as JSON:

```bash
# Run AST evaluation
python3 server/evaluation/run_benchmark.py --strategy ast --dataset server/evaluation/datasets/python_oss_sample.json --output reports/ast_results.json

# Run Fixed-Window evaluation
python3 server/evaluation/run_benchmark.py --strategy fixed --dataset server/evaluation/datasets/python_oss_sample.json --output reports/fixed_results.json
```

---

## Directory Structure

```
codemind/
├── .gitignore
├── docker-compose.yml              # Multi-container orchestration (FastAPI, Next.js, Mongo, Chroma)
├── paper.tex                       # IEEE conference research paper LaTeX source
├── paper.pdf                       # Compiled research manuscript
├── PROJECT_DEVELOPMENT.md          # Internal developer standards & architecture specification
│
├── benchmark results/              # Verified empirical benchmark artifacts
│   ├── RESEARCH_BENCHMARK_REPORT.md# Executive research summary & LaTeX tables
│   ├── benchmark_empirical_results.json # Full machine-readable aggregate metrics & per-query logs
│   ├── per_query_analysis.csv      # CSV spreadsheet of all 15 query executions
│   └── figures/                    # Publication-grade figures (PNG + Vector PDF)
│       ├── fig1_retrieval_performance_comparison.{pdf,png}
│       ├── fig2_precision_recall_vs_k.{pdf,png}
│       ├── fig3_chunk_size_distribution.{pdf,png}
│       ├── fig4_answer_quality_rouge.{pdf,png}
│       └── fig5_empirical_correlation_heatmap.{pdf,png}
│
├── client/                         # Next.js 16 App Router frontend
│   ├── app/
│   │   ├── (auth)/                 # Unprotected auth pages (login, register)
│   │   ├── (app)/                  # Protected workspace (dashboard, chat, eval)
│   │   │   ├── dashboard/          # Codebase management & upload interface
│   │   │   ├── chat/[repoId]/      # RAG conversation view with streaming SSE
│   │   │   └── eval/               # Metrics dashboard & side-by-side comparison
│   │   ├── globals.css             # Tailwind v4 theme & shadcn tokens
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/                   # ChatWindow, StreamingText, MessageBubble
│   │   ├── eval/                   # MetricsChart (Recharts), ComparisonTable
│   │   ├── upload/                 # ZipUploader drag-and-drop component
│   │   └── ui/                     # shadcn component primitives
│   ├── lib/api/                    # Typed backend API client functions
│   └── types/                      # TypeScript domain interfaces
│
└── server/                         # FastAPI backend service
    ├── main.py                     # Application entry point, lifespan, CORS
    ├── requirements.txt            # Pinned Python dependencies
    ├── Dockerfile
    ├── api/                        # HTTP transport layer
    │   └── v1/                     # API routers (auth, repos, chat, eval)
    ├── core/                       # Core singletons (config, db, chroma, ollama)
    ├── features/                   # Domain features (models, services, repositories)
    │   ├── auth/                   # User sessions & password hashing
    │   ├── repos/                  # ZIP management & repository state
    │   ├── chat/                   # RAG chains & MongoDB message history
    │   └── eval/                   # Metric calculations & evaluation persistence
    ├── pipeline/                   # Pure RAG algorithms (No HTTP dependencies)
    │   ├── chunkers/
    │   │   ├── base.py             # Abstract BaseChunker & Chunk dataclass
    │   │   ├── ast_chunker.py      # tree-sitter Python AST chunker (Research contribution)
    │   │   └── fixed_chunker.py    # Fixed-window character chunker (Baseline)
    │   ├── embedder.py             # Batch vector embedding wrapper
    │   ├── indexer.py              # ZIP extraction & ChromaDB ingestion
    │   └── retriever.py            # Similarity search & context assembly
    ├── evaluation/                 # Research evaluation scripts & datasets
    │   ├── datasets/               # Curated query-symbol ground truth files
    │   ├── compute_metrics.py      # Reusable standalone metric utilities
    │   ├── run_benchmark.py        # Generic CLI evaluation runner
    │   └── run_comprehensive_benchmark.py # Full empirical evaluation harness
    └── tests/                      # Pytest verification suite
        ├── unit/                   # Unit tests (AST chunker, fixed chunker, metrics)
        └── integration/            # Ingestion, retrieval comparison, streaming tests
```

---

## Testing

The project maintains comprehensive unit and integration test coverage. Tests verify functional correctness and prevent regressions in metric computation:

```bash
cd server
source .venv/bin/activate

# Run all unit tests
pytest tests/unit

# Run specific chunker verification
pytest tests/unit/test_ast_chunker.py -v

# Run integration tests
pytest tests/integration
```

---

## Research Paper & Citation

If you use CodeMind in academic research, benchmark studies, or software engineering tools, please cite our paper:

```bibtex
@inproceedings{codemind2026,
  author    = {Dainwi Kumar and Bhagyashree Patel and Ranjith M},
  title     = {CodeMind: AST-Aware Retrieval-Augmented Generation for Code Question Answering},
  booktitle = {Proceedings of the International Conference on Software Engineering and Artificial Intelligence},
  year      = {2026},
  publisher = {IEEE},
  address   = {Greater Noida, India}
}
```

---

## Contributing & Code Style

Contributions are welcome. Please ensure your modifications adhere to the repository standards:

1. **Python Layering Rule**: Code in `server/pipeline/` must remain pure algorithms and must **never** import from `server/features/` or `server/api/`.
2. **Code Style**:
   - Python code adheres to [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html) and passes `ruff check .`.
   - TypeScript code follows strict ESLint guidelines.
3. **Deterministic Chunking**: Chunkers must produce deterministic output for identical input source files.
4. **Pull Requests**: Include accompanying unit tests in `server/tests/` for all new features or bug fixes.

---

## License & Acknowledgments

This project is licensed under the [MIT License](LICENSE).

### Acknowledgments
- Developed at the **School of Computer Science & Engineering, Galgotias University**, Greater Noida, India.
- Sincere gratitude to **Mr. Ranjith M** (Project Guide) for guidance on RAG architecture and evaluation design.
- Built on foundational open-source technologies: [`tree-sitter`](https://tree-sitter.github.io/), [`FastAPI`](https://fastapi.tiangolo.com/), [`ChromaDB`](https://www.trychroma.com/), [`Ollama`](https://ollama.com/), and [`Next.js`](https://nextjs.org/).
