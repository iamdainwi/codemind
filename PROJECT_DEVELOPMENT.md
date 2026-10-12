# CodeMind — Project Development Guidelines

> **Title:** CodeMind: A Locally-Deployed AST-Aware Retrieval-Augmented Generation Framework for Codebase Question Answering  
> **Stack:** Next.js 16 · FastAPI · LangChain · ChromaDB · MongoDB · Ollama  
> **Audience:** AI agents and human developers contributing to this codebase.  
> **Rule #0:** Read this file completely before writing or modifying any code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack & Versions](#4-tech-stack--versions)
5. [Server (FastAPI) — Layer & Feature Structure](#5-server-fastapi--layer--feature-structure)
6. [Client (Next.js) — Layer & Feature Structure](#6-client-nextjs--layer--feature-structure)
7. [Core Pipeline — How the RAG Works](#7-core-pipeline--how-the-rag-works)
8. [Evaluation Module](#8-evaluation-module)
9. [Testing Guidelines](#9-testing-guidelines)
10. [API Contract](#10-api-contract)
11. [Environment & Configuration](#11-environment--configuration)
12. [Code Style & Conventions](#12-code-style--conventions)
13. [Git Workflow](#13-git-workflow)
14. [Agent-Specific Rules](#14-agent-specific-rules)

---

## 1. Project Overview

**CodeMind** investigates whether **AST-based chunking** of Python codebases produces measurably better retrieval and answer quality compared to **fixed-window (naive) chunking**, when used inside a locally-deployed RAG pipeline.

### Problem Statement

Current RAG-based code assistants rely on generic, structure-agnostic text chunking strategies that fragment code in ways that harm retrieval relevance and downstream answer quality. This project empirically compares:

| Strategy | Description |
|---|---|
| **AST chunking** | Parse Python with `tree-sitter`; extract semantic units (functions, classes, methods) as chunks |
| **Fixed-window chunking** | Split by token/character count with optional overlap (the naive baseline) |

The hypothesis: **AST-aware chunks preserve semantic boundaries -> better retrieval -> more accurate answers.**

### Core Features

1. **Codebase Ingestion** — User uploads a `.zip` of a Python codebase
2. **Chunking** — Both AST and fixed-window strategies (selectable at ingest time)
3. **Embedding** — `gemma-embedding-2:570m` via Ollama
4. **Vector Store** — ChromaDB (embedded, local file mode)
5. **LLM** — `gemma4:e2b-mlx` via Ollama, streamed via SSE
6. **Chat** — Session-based Q&A with LangChain memory backed by MongoDB
7. **User Management** — Session-based auth (cookies), user data in MongoDB
8. **Evaluation Dashboard** — Compare AST vs fixed-window on retrieval + answer metrics
9. **Offline Eval Scripts** — Reproducible benchmark scripts for the research paper

---

## 2. Repository Layout

```
codemind/                          <- monorepo root
|-- PROJECT_DEVELOPMENT.md         <- this file
|-- .gitignore                     <- root gitignore
|
|-- client/                        <- Next.js 16 frontend
|   |-- app/                       <- App Router pages & layouts
|   |   |-- (auth)/                <- Auth route group (login, register)
|   |   |-- (app)/                 <- Protected route group
|   |   |   |-- dashboard/         <- Repo management page
|   |   |   |-- chat/[repoId]/     <- Chat interface per indexed repo
|   |   |   `-- eval/              <- Evaluation results dashboard
|   |   |-- layout.tsx
|   |   `-- globals.css
|   |-- components/
|   |   |-- ui/                    <- shadcn/base-ui primitives (auto-generated, DO NOT EDIT)
|   |   |-- layout/                <- Sidebar, Navbar, Shell
|   |   |-- chat/                  <- ChatWindow, MessageBubble, StreamingText
|   |   |-- upload/                <- ZipUploader, IngestProgress
|   |   `-- eval/                  <- MetricsChart, ComparisonTable
|   |-- lib/
|   |   |-- api/                   <- Typed fetch wrappers for each backend route
|   |   |-- hooks/                 <- useChat, useSession, useEval custom hooks
|   |   |-- stores/                <- Zustand stores
|   |   `-- utils.ts               <- shadcn cn() utility
|   |-- types/                     <- Shared TypeScript interfaces
|   |-- next.config.ts
|   |-- tsconfig.json
|   `-- components.json            <- shadcn config (style: base-nova, Nova preset)
|
`-- server/                        <- FastAPI backend
    |-- main.py                    <- FastAPI app entry point
    |-- pyproject.toml
    |-- requirements.txt
    |-- .env.example
    |
    |-- api/                       <- HTTP layer only - routers, request/response models
    |   |-- v1/
    |   |   |-- auth.py            <- /auth/login, /auth/logout, /auth/me
    |   |   |-- repos.py           <- /repos (upload, list, delete)
    |   |   |-- chat.py            <- /chat/{repo_id}/stream (SSE)
    |   |   `-- eval.py            <- /eval/{repo_id}/run, /eval/{repo_id}/results
    |   `-- deps.py                <- FastAPI dependencies (get_current_user, get_db)
    |
    |-- core/                      <- Shared config, DB clients, exceptions
    |   |-- config.py              <- Pydantic Settings - reads from .env
    |   |-- db.py                  <- MongoDB motor client singleton
    |   |-- chroma.py              <- ChromaDB client singleton
    |   |-- ollama.py              <- Ollama LLM + Embedding wrappers
    |   |-- exceptions.py          <- Custom exception classes
    |   `-- security.py            <- Session/cookie helpers
    |
    |-- features/                  <- One sub-package per domain feature
    |   |-- auth/
    |   |   |-- models.py
    |   |   |-- repository.py
    |   |   `-- service.py
    |   |-- repos/
    |   |   |-- models.py
    |   |   |-- repository.py
    |   |   |-- service.py
    |   |   `-- schemas.py
    |   |-- chat/
    |   |   |-- models.py
    |   |   |-- repository.py
    |   |   |-- service.py
    |   |   `-- memory.py
    |   `-- eval/
    |       |-- models.py
    |       |-- repository.py
    |       |-- service.py
    |       `-- metrics.py
    |
    |-- pipeline/                  <- Core RAG pipeline components (NO FastAPI imports)
    |   |-- chunkers/
    |   |   |-- base.py            <- Abstract BaseChunker interface
    |   |   |-- ast_chunker.py     <- tree-sitter Python AST chunker
    |   |   `-- fixed_chunker.py   <- Character/token fixed-window chunker
    |   |-- embedder.py            <- Wraps Ollama embedding model
    |   |-- indexer.py             <- Zip extraction -> chunking -> ChromaDB upsert
    |   `-- retriever.py           <- ChromaDB similarity search wrapper
    |
    `-- evaluation/                <- Offline evaluation scripts
        |-- README.md
        |-- datasets/              <- Curated Python repos + Q&A pairs (gold standard)
        |-- run_benchmark.py       <- CLI: python run_benchmark.py --strategy ast|fixed
        |-- compute_metrics.py     <- Reusable metric functions
        `-- reports/               <- Output JSON/CSV reports (gitignored)
```

---

## 3. Architecture Overview

```
+------------------------------------------------------------------+
|                         Browser (Next.js)                         |
|  Upload ZIP -> Dashboard -> Chat Interface -> Eval Dashboard       |
+-----------------------------------+------------------------------+
                                    | HTTP / SSE
                                    v
+------------------------------------------------------------------+
|                     FastAPI Server (uvicorn)                       |
|                                                                    |
|  api/v1/  -->  features/  -->  pipeline/                          |
|  (routers)    (services)    (chunkers, embedder, retriever)        |
+-------+--------------+--------------+--------------+--------------+
        |              |              |              |
        v              v              v              v
   +--------+   +----------+   +----------+  +----------+
   |MongoDB |   | ChromaDB |   |  Ollama  |  | File sys |
   |(users, |   |(vectors, |   |  LLM +   |  |(uploaded |
   | chats, |   | chunks)  |   | Embedder)|  |  ZIPs)   |
   | eval)  |   +----------+   +----------+  +----------+
   +--------+
```

### Data Flow — Ingest

```
1. User uploads ZIP  ->  api/v1/repos.py
2. repos service      ->  pipeline/indexer.py
3. indexer            ->  extract .py files from ZIP
4. indexer            ->  chunkers/ast_chunker.py  OR  chunkers/fixed_chunker.py
5. chunks             ->  pipeline/embedder.py  (calls Ollama embedding model)
6. embeddings         ->  ChromaDB upsert (collection: repo_{id}_{strategy})
7. repo metadata      ->  MongoDB (features/repos/repository.py)
```

### Data Flow — Chat Query

```
1. User sends message  ->  api/v1/chat.py  (SSE response)
2. chat service         ->  features/chat/memory.py  (load history from MongoDB)
3. chat service         ->  pipeline/retriever.py  (ChromaDB search)
4. retrieved chunks     ->  LangChain RAG chain  ->  Ollama LLM
5. LLM tokens streamed  ->  SSE to frontend  (native EventSource)
6. final response        ->  features/chat/repository.py  ->  MongoDB
```

---

## 4. Tech Stack & Versions

### Server

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | `>=0.115` | HTTP framework |
| `uvicorn[standard]` | `>=0.30` | ASGI server |
| `motor` | `>=3.5` | Async MongoDB driver |
| `pymongo` | `>=4.8` | Sync MongoDB (eval scripts) |
| `chromadb` | `>=0.5` | Local embedded vector store |
| `langchain` | `>=0.3` | RAG chain orchestration |
| `langchain-community` | `>=0.3` | MongoDBChatMessageHistory |
| `langchain-ollama` | `>=0.2` | Ollama LLM + Embeddings |
| `tree-sitter` | `>=0.23` | AST parsing |
| `tree-sitter-python` | `>=0.23` | Python grammar for tree-sitter |
| `pydantic-settings` | `>=2.4` | Config from `.env` |
| `python-multipart` | `>=0.0.9` | File upload support |
| `rouge-score` | `>=0.1.2` | ROUGE-L metric |
| `pytest` | `>=8` | Testing |
| `pytest-asyncio` | `>=0.24` | Async test support |
| `httpx` | `>=0.27` | Async HTTP client (for tests) |
| `bcrypt` | `>=4.1` | Password hashing |
| `aiofiles` | `>=23` | Async file I/O |

### Client

| Package | Version | Purpose |
|---|---|---|
| `next` | `16.4.0` | App framework (App Router) |
| `react` | `19.3.0` | UI runtime |
| `@base-ui/react` | `>=1.9` | shadcn base component library |
| `tailwindcss` | `^4` | Styling |
| `lucide-react` | `^1.55` | Icons |
| `tw-animate-css` | `^1.4` | Animation utilities |
| `zustand` | `>=5` | Lightweight client state |
| `recharts` | `>=2.12` | Eval metrics charts |

### Models (Ollama — must be pulled locally before running)

| Model Tag | Role |
|---|---|
| `gemma4:e2b-mlx` | Chat LLM (streaming) |
| `gemma-embedding-2:570m` | Text embeddings |

> **IMPORTANT:** Always verify model names against `ollama list` before using. Tags are case-sensitive. Never hardcode model names — always read from `settings`.

---

## 5. Server (FastAPI) — Layer & Feature Structure

### Layering Rules (Strict)

Dependencies only flow **downward**:

```
api/          ->  (HTTP only: routing, request parsing, response serialization)
features/     ->  (Business logic: services, repositories, domain models)
pipeline/     ->  (Core algorithms: chunking, embedding, retrieval — NO FastAPI imports)
core/         ->  (Cross-cutting: config, DB clients, security — NO feature imports)
```

**Violations that are NEVER acceptable:**
- Importing from `api/` inside `features/` or `pipeline/`
- Importing from `features/` inside `pipeline/`
- Putting business logic inside router functions — routers call services ONLY

### Feature Package Pattern

Every feature under `features/<name>/` must follow:

```
models.py      <- MongoDB document shape (Pydantic BaseModel — NOT an ODM)
repository.py  <- Async functions that talk to MongoDB. No business logic here.
service.py     <- Business logic. Calls repository + pipeline. Raises custom exceptions.
schemas.py     <- Pydantic request/response schemas used by api/v1/ routers.
```

### `core/config.py` — Single Source of Truth for All Config

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "codemind"
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_LLM_MODEL: str = "gemma4:e2b-mlx"
    OLLAMA_EMBED_MODEL: str = "gemma-embedding-2:570m"
    SESSION_SECRET_KEY: str  # required — no default, must be in .env
    SESSION_MAX_AGE: int = 86400
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE_MB: int = 100

    model_config = ConfigDict(env_file=".env")

settings = Settings()
```

### Authentication — Session-Based (Cookies)

- Use `starlette.middleware.sessions.SessionMiddleware` with a secret key
- On login, store `user_id` in the session dict (server-side signed cookie)
- `api/deps.py` exposes a `get_current_user` FastAPI dependency that reads the session
- All `/api/v1/*` routes (except `/auth/login` and `/auth/register`) require this dependency
- **Do NOT use JWTs. Do NOT use OAuth. Do NOT use bearer tokens.**

### Streaming — SSE (Server-Sent Events)

```python
from fastapi.responses import StreamingResponse
import json

async def stream_generator(chain, inputs):
    async for chunk in chain.astream(inputs):
        yield f"data: {json.dumps({'token': chunk})}\n\n"
    yield "data: [DONE]\n\n"

@router.get("/chat/{repo_id}/stream")
async def stream_chat(repo_id: str, q: str, user=Depends(get_current_user)):
    return StreamingResponse(
        stream_generator(...),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
```

On the frontend, use the native `EventSource` API. **Do NOT use WebSockets.**

---

## 6. Client (Next.js) — Layer & Feature Structure

### App Router Route Groups

```
app/
|-- (auth)/              <- No AppShell. No auth check.
|   |-- login/page.tsx
|   `-- register/page.tsx
`-- (app)/               <- Protected. Wrapped in AppShell layout.
    |-- layout.tsx        <- AppShell (Sidebar + Topbar + auth guard)
    |-- dashboard/
    |   `-- page.tsx      <- List indexed repos, upload new ZIP
    |-- chat/
    |   `-- [repoId]/
    |       `-- page.tsx  <- Chat interface for a specific indexed repo
    `-- eval/
        `-- page.tsx      <- Evaluation metrics dashboard
```

### Component Categories

| Directory | Rule |
|---|---|
| `components/ui/` | shadcn auto-generated. **NEVER hand-edit.** Run `npx shadcn add <component>` to add more. |
| `components/layout/` | AppShell, Sidebar, Topbar |
| `components/chat/` | ChatWindow, MessageBubble, StreamingText (renders SSE tokens live) |
| `components/upload/` | ZipUploader (drag-and-drop + click), IngestProgressBar |
| `components/eval/` | MetricsChart (Recharts), ComparisonTable (AST vs Fixed side-by-side) |

### `lib/api/` — Typed API Client Layer

Every backend route has a corresponding typed async function in `lib/api/`. **No raw `fetch` calls are allowed outside this layer.**

```typescript
// lib/api/chat.ts — pattern for SSE streaming
export async function* streamChat(
  repoId: string,
  query: string
): AsyncGenerator<string, void, unknown> {
  const url = `/api/v1/chat/${repoId}/stream?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { credentials: "include" });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    const lines = text.split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === "[DONE]") return;
      const parsed = JSON.parse(data);
      yield parsed.token as string;
    }
  }
}
```

### Custom Hooks

| Hook | File | Responsibility |
|---|---|---|
| `useSession` | `hooks/useSession.ts` | Read current user session, redirect to `/login` if unauthenticated |
| `useChat` | `hooks/useChat.ts` | Message state, calls `streamChat`, appends SSE tokens incrementally |
| `useIngest` | `hooks/useIngest.ts` | Upload ZIP, poll ingest status via `GET /repos/{id}` |
| `useEval` | `hooks/useEval.ts` | Fetch eval results, trigger eval runs |

### Styling Rules

- Dark mode is the **default** — the entire UI is dark-first
- Use Tailwind v4 utility classes — never inline styles
- Design tokens are in `app/globals.css` (shadcn Nova preset — already set up)
- Use `tw-animate-css` for entrance/exit animations on modals and slide-in panels
- Do NOT create `.module.css` files unless there is an insurmountable Tailwind limitation

---

## 7. Core Pipeline — How the RAG Works

### `pipeline/chunkers/base.py` — The Chunk Contract

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List

@dataclass
class Chunk:
    content: str           # The actual code text of this chunk
    file_path: str         # Source file path (relative to zip root)
    chunk_id: str          # Unique ID: "{file_path}::{node_name}" or "{file_path}::chunk_{i}"
    start_line: int
    end_line: int
    node_type: str         # "function" | "class" | "method" | "module" | "fixed"
    metadata: dict = field(default_factory=dict)  # e.g., {"name": "DataLoader", "class": "Trainer"}

class BaseChunker(ABC):
    @abstractmethod
    def chunk(self, source_code: str, file_path: str) -> List[Chunk]:
        """Split source_code into semantic chunks. Must be deterministic."""
        ...
```

### `pipeline/chunkers/ast_chunker.py` — The Research Contribution

- Uses `tree-sitter` with `tree-sitter-python` grammar
- Extracts: **top-level functions**, **classes**, **methods inside classes**
- Each node becomes exactly ONE chunk — never split inside a function body
- Falls back to the entire file as a single `"module"` chunk if parsing fails
- `chunk_id` format: `"{file_path}::{class_name}.{method_name}"` or `"{file_path}::{function_name}"`

### `pipeline/chunkers/fixed_chunker.py` — The Baseline

- Splits by character count with configurable `chunk_size` and `chunk_overlap`
- Default: `chunk_size=1000`, `chunk_overlap=200`
- `node_type` is always `"fixed"`
- `chunk_id` format: `"{file_path}::chunk_{index}"`

### `pipeline/indexer.py` — Orchestration

```python
async def ingest_zip(
    zip_path: Path,
    repo_id: str,
    strategy: Literal["ast", "fixed"],
    chroma_client,
    embedder,
) -> IngestResult:
    # 1. Extract ZIP to temp dir (use Python's zipfile module)
    # 2. Walk all .py files recursively
    # 3. Chunk each file with the selected chunker
    # 4. Embed chunks in batches (batch_size=32 to avoid Ollama OOM)
    # 5. Upsert to ChromaDB collection named f"repo_{repo_id}_{strategy}"
    # 6. Log: file count, chunk count, strategy, duration_ms
    # 7. Return IngestResult (all of the above — this is research data)
```

### ChromaDB Collection Naming Convention

Each indexed repo creates **two** ChromaDB collections (one per strategy):

```
repo_{repo_id}_ast     <- AST-chunked vectors
repo_{repo_id}_fixed   <- Fixed-window-chunked vectors
```

- Chat queries use `_ast` by default
- The eval module queries **both** for side-by-side metric comparison
- **Never deviate from this naming pattern**

### LangChain Memory — MongoDB Backed

```python
# features/chat/memory.py
from langchain_community.chat_message_histories import MongoDBChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

def get_message_history(session_id: str) -> MongoDBChatMessageHistory:
    return MongoDBChatMessageHistory(
        connection_string=settings.MONGODB_URI,
        session_id=session_id,
        database_name=settings.MONGODB_DB,
        collection_name="chat_histories",
    )
```

Wrap the RAG chain with `RunnableWithMessageHistory` and pass `get_message_history` as the factory.

---

## 8. Evaluation Module

### Metrics to Compute

| Metric | Category | What It Proves |
|---|---|---|
| **Precision@K** | Retrieval quality | Of the K chunks retrieved, what fraction are actually relevant? Higher = fewer irrelevant chunks polluting context. |
| **Recall@K** | Retrieval quality | Of all relevant chunks, what fraction did we retrieve in top-K? Higher = better coverage. |
| **MRR** | Retrieval quality | Mean Reciprocal Rank — was the first relevant chunk near the top? |
| **ROUGE-L** | Answer quality | LCS-based overlap of generated answer vs reference answer. |
| **Chunk size distribution** | Chunking quality | Mean/std/min/max token counts per chunk. AST chunks should be more consistent. |
| **Boundary accuracy** | Chunking quality | % of chunks that start and end at semantic boundaries (function/class def lines). |

### Ground Truth Dataset Format

Located at `server/evaluation/datasets/`. Each entry:

```json
{
  "repo_id": "sample_repo_001",
  "query": "What does the DataLoader class do?",
  "relevant_chunk_ids": [
    "dataloader.py::DataLoader.__init__",
    "dataloader.py::DataLoader.load"
  ],
  "reference_answer": "The DataLoader class loads..."
}
```

`relevant_chunk_ids` must match the `chunk_id` field stored in ChromaDB metadata.

### Offline Benchmark Script Usage

```bash
# From server/evaluation/
python run_benchmark.py --strategy ast --dataset datasets/python_oss_sample.json --output reports/ast_results.json
python run_benchmark.py --strategy fixed --dataset datasets/python_oss_sample.json --output reports/fixed_results.json
```

Output JSON structure:
```json
{
  "strategy": "ast",
  "dataset": "python_oss_sample",
  "timestamp": "2026-10-12T18:00:00",
  "metrics": {
    "precision_at_5": 0.72,
    "recall_at_5": 0.68,
    "mrr": 0.61,
    "rouge_l_avg": 0.54,
    "chunk_size_mean": 312.4,
    "chunk_size_std": 88.2,
    "boundary_accuracy": 1.0
  },
  "per_query_results": [...]
}
```

### Frontend Eval Dashboard

- Route: `/eval`
- Fetches from `GET /api/v1/eval/results` — returns latest AST + fixed results
- Side-by-side comparison table for all 6 metric categories
- Recharts bar chart for Precision@K, Recall@K, MRR, ROUGE-L
- "Run New Evaluation" button triggers `POST /api/v1/eval/{repo_id}/run`
- Show raw chunk size distribution histogram using Recharts

---

## 9. Testing Guidelines

> **Dual purpose:** Tests verify correctness AND generate empirical evidence for the research paper.

### Test Structure

```
server/tests/
|-- conftest.py                              <- Shared fixtures
|-- fixtures/
|   `-- sample_python_repo.zip               <- Curated test repo (consistent across all tests)
|-- unit/
|   |-- test_ast_chunker.py
|   |-- test_fixed_chunker.py
|   `-- test_metrics.py
`-- integration/
    |-- test_ingest_pipeline.py
    |-- test_retrieval_comparison.py          <- KEY research evidence test
    `-- test_chat_stream.py
```

### Unit Tests

#### `test_ast_chunker.py` — Critical Coverage

```python
def test_function_becomes_one_chunk():
    code = "def add(a, b):\n    return a + b\n"
    chunks = ASTChunker().chunk(code, "math.py")
    assert len(chunks) == 1
    assert chunks[0].node_type == "function"

def test_class_and_methods_are_separate_chunks():
    code = "class Foo:\n    def bar(self): pass\n    def baz(self): pass\n"
    chunks = ASTChunker().chunk(code, "foo.py")
    types = [c.node_type for c in chunks]
    assert "class" in types
    assert types.count("method") == 2

def test_fixed_chunker_crosses_function_boundaries():
    # Research evidence: proves fixed chunker violates semantic boundaries
    code = "def alpha():\n    return 1\ndef beta():\n    return 2\n"
    chunks = FixedChunker(chunk_size=60, chunk_overlap=0).chunk(code, "f.py")
    multi_fn = [c for c in chunks if "alpha" in c.content and "beta" in c.content]
    assert len(multi_fn) > 0  # Fixed chunker DOES cross boundaries — this is the problem
    # Research Note: This test documents the boundary violation that AST chunking solves.

def test_ast_chunk_ids_are_unique():
    code = "def foo(): pass\ndef bar(): pass\n"
    chunks = ASTChunker().chunk(code, "test.py")
    ids = [c.chunk_id for c in chunks]
    assert len(ids) == len(set(ids))
```

#### `test_metrics.py`

```python
def test_precision_at_k():
    retrieved = ["a", "b", "c"]
    relevant = {"a", "c", "d"}
    assert precision_at_k(retrieved, relevant, k=3) == pytest.approx(2/3)

def test_mrr_first_hit():
    retrieved = ["x", "a", "b"]
    relevant = {"a"}
    assert mrr(retrieved, relevant) == pytest.approx(0.5)  # 1/rank_2

def test_rouge_l_perfect():
    assert rouge_l("hello world", "hello world") == pytest.approx(1.0)

def test_rouge_l_zero_overlap():
    assert rouge_l("cats sleep", "dogs run") == pytest.approx(0.0)
```

### Integration Tests — Research Evidence

#### `test_retrieval_comparison.py`

This is the most important file in the project:

```python
# Research Note: This test generates empirical evidence that AST chunking
# achieves higher Precision@K and Recall@K than fixed-window chunking
# on function-level retrieval queries. Results are printed for paper inclusion.

@pytest.mark.asyncio
@pytest.mark.skipif(not OLLAMA_AVAILABLE, reason="Ollama not running")
async def test_ast_precision_higher_than_fixed(indexer, chroma_tmp, embedder, sample_zip):
    """
    RESEARCH HYPOTHESIS: AST P@5 >= Fixed P@5 for semantic code queries.
    """
    repo_id = "research_test_001"
    
    await indexer.ingest_zip(sample_zip, repo_id, strategy="ast", ...)
    await indexer.ingest_zip(sample_zip, repo_id, strategy="fixed", ...)
    
    test_cases = [
        {
            "query": "How does the DataLoader initialize?",
            "relevant_ids": {"dataloader.py::DataLoader.__init__"}
        },
    ]
    
    for case in test_cases:
        ast_results = retriever.retrieve(case["query"], f"repo_{repo_id}_ast", k=5)
        fixed_results = retriever.retrieve(case["query"], f"repo_{repo_id}_fixed", k=5)
        
        ast_p = precision_at_k([r.id for r in ast_results], case["relevant_ids"], k=5)
        fixed_p = precision_at_k([r.id for r in fixed_results], case["relevant_ids"], k=5)
        
        # Print for research paper evidence capture (visible with pytest -s)
        print(f"\n[RESEARCH] Query: '{case['query']}'")
        print(f"  AST   Precision@5: {ast_p:.4f}")
        print(f"  Fixed Precision@5: {fixed_p:.4f}")
        print(f"  Delta: {ast_p - fixed_p:+.4f}")
        
        assert ast_p >= fixed_p
```

### Running Tests

```bash
cd server

# Unit tests (no external services needed)
pytest tests/unit/ -v

# Integration tests (requires Ollama running)
OLLAMA_AVAILABLE=true pytest tests/integration/ -v -s

# Generate JSON report for research paper
OLLAMA_AVAILABLE=true pytest tests/integration/test_retrieval_comparison.py \
  --json-report \
  --json-report-file=evaluation/reports/pytest_evidence.json \
  -v -s
```

### Testing Rules

1. **No real Ollama calls in unit tests** — mock `OllamaEmbeddings` and `OllamaLLM`
2. **Integration tests gate on `OLLAMA_AVAILABLE=true`** — use `pytest.mark.skipif` with env var check
3. **Integration tests use isolated MongoDB** — database `codemind_test`, dropped before each session
4. **Integration tests use `tmp_path` fixture for ChromaDB** — never touch production data
5. **All research metric prints must use the `[RESEARCH]` prefix** for easy grep in CI logs
6. **Test fixtures must use the same `sample_python_repo.zip`** — ensures reproducibility across runs

---

## 10. API Contract

All endpoints are under `/api/v1/`. Session cookie is required for protected routes.

### Response Envelope (All Endpoints)

```json
// Success
{ "success": true, "data": { ... }, "error": null }

// Error
{ "success": false, "data": null, "error": { "code": "REPO_NOT_FOUND", "message": "Repository not found." } }
```

### Auth Endpoints

| Method | Path | Request Body | Response Data | Notes |
|---|---|---|---|---|
| `POST` | `/auth/register` | `{username, password}` | `{user_id, username}` | Hash password with bcrypt |
| `POST` | `/auth/login` | `{username, password}` | `{user_id, username}` | Sets session cookie |
| `POST` | `/auth/logout` | — | `{}` | Clears session cookie |
| `GET` | `/auth/me` | — | `{user_id, username}` | Protected |

### Repo Endpoints

| Method | Path | Request | Response Data | Notes |
|---|---|---|---|---|
| `POST` | `/repos/upload` | `multipart: zip_file, strategy` | `{repo_id, status, chunk_count}` | Triggers async ingest |
| `GET` | `/repos` | — | `[{repo_id, name, status, strategy, created_at}]` | User's repos only |
| `GET` | `/repos/{repo_id}` | — | `{repo_id, name, status, chunk_count, file_count, duration_ms}` | |
| `DELETE` | `/repos/{repo_id}` | — | `{}` | Deletes ChromaDB collection too |

### Chat Endpoints

| Method | Path | Params | Response | Notes |
|---|---|---|---|---|
| `GET` | `/chat/{repo_id}/stream` | `?q=<query>` | SSE stream | `text/event-stream` |
| `GET` | `/chat/{repo_id}/history` | — | `[{role, content, timestamp}]` | |
| `DELETE` | `/chat/{repo_id}/history` | — | `{}` | Clears MongoDB history |

### Eval Endpoints

| Method | Path | Request Body | Response Data | Notes |
|---|---|---|---|---|
| `POST` | `/eval/{repo_id}/run` | `{dataset_id}` | `{run_id, status}` | Async — poll with GET |
| `GET` | `/eval/{repo_id}/results` | — | `{ast: {...metrics}, fixed: {...metrics}}` | |
| `GET` | `/eval/results` | — | `[{repo_id, ...}]` | All results for user |

---

## 11. Environment & Configuration

### `server/.env.example`

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=codemind
CHROMA_PERSIST_DIR=./data/chroma
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=gemma4:e2b-mlx
OLLAMA_EMBED_MODEL=gemma-embedding-2:570m
SESSION_SECRET_KEY=replace-with-a-very-long-random-string
SESSION_MAX_AGE=86400
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_SIZE_MB=100
OLLAMA_AVAILABLE=false
```

### `client/.env.local.example`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Starting Services (Docker Compose — Recommended)

```bash
# Run all services (MongoDB, ChromaDB, FastAPI backend, Next.js frontend)
docker compose up --build -d

# View real-time logs
docker compose logs -f

# Stop all containers
docker compose down
```

### Starting Services (Local Bare-Metal Order)

```bash
# 1. Start MongoDB
mongod --dbpath ./server/data/mongodb

# 2. Start Ollama (ensure models are pulled)
ollama pull gemma4:e2b-mlx
ollama pull gemma-embedding-2:570m
ollama serve

# 3. Start FastAPI server
cd server && uvicorn main:app --reload --port 8000

# 4. Start Next.js frontend
cd client && npm run dev
```

---

## 12. Code Style & Conventions

### Python

- **Formatter:** `ruff format`
- **Linter:** `ruff check`
- **Type hints:** Required on all function signatures
- **Async:** All I/O must be `async def` — no `time.sleep`, no sync file reads in routes
- **Pydantic v2:** Use `model_config = ConfigDict(...)` — never the v1 `class Config:` pattern
- **Error handling:** Raise `HTTPException` only in `api/` layer. Features raise from `core/exceptions.py`
- **Docstrings:** Required on all public service and pipeline functions

### TypeScript

- `"strict": true` in tsconfig — never disable
- No `any` — use `unknown` + type narrowing
- Server Components by default — `"use client"` only when event handlers, hooks, or browser APIs are needed
- Named exports only — except `page.tsx` and `layout.tsx` (Next.js requirement)
- Interfaces for object shapes; `type` for unions/intersections

### Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Python files | `snake_case` | `ast_chunker.py` |
| Python classes | `PascalCase` | `ASTChunker` |
| Python functions | `snake_case` | `ingest_zip` |
| TS component files | `PascalCase.tsx` | `ChatWindow.tsx` |
| TS hook files | `useCamelCase.ts` | `useChat.ts` |
| MongoDB collections | `snake_case` plural | `chat_histories` |
| ChromaDB collections | `repo_{id}_{strategy}` | `repo_abc123_ast` |
| Env vars | `SCREAMING_SNAKE_CASE` | `OLLAMA_BASE_URL` |

---

## 13. Git Workflow

### Branch Names

```
feature/<description>    e.g. feature/ast-chunker
fix/<description>        e.g. fix/chroma-collection-delete
eval/<description>       e.g. eval/precision-metric
test/<description>       e.g. test/retrieval-comparison
```

### Commit Message Format (Conventional Commits)

```
feat(pipeline): implement AST chunker with tree-sitter
fix(chat): handle SSE connection drop gracefully
test(eval): add AST vs fixed Precision@K research assertion
docs: update API contract with eval endpoints
chore(deps): add rouge-score and pytest-json-report
```

### `.gitignore` Additions (Root)

```gitignore
.DS_Store
server/data/
server/.env
server/evaluation/reports/
server/__pycache__/
server/.venv/
client/.next/
client/node_modules/
client/.env.local
```

---

## 14. Agent-Specific Rules

### Before Writing Any Code

1. Identify which layer the code belongs to: `api/`, `features/`, `pipeline/`, or `core/`
2. Check if the function already exists elsewhere before creating a new one
3. Verify the ChromaDB collection name follows `repo_{repo_id}_{strategy}`
4. Confirm all new models use Pydantic v2 syntax

### Hard Rules — NEVER Do

| Rule | Reason |
|---|---|
| Import `fastapi` inside `pipeline/` | Pipeline must be framework-agnostic for standalone eval scripts |
| Put MongoDB queries in `api/` routers | Violates layering — belongs in `features/*/repository.py` |
| Hardcode `"gemma4:e2b-mlx"` or any model name | Always use `settings.OLLAMA_LLM_MODEL` |
| Edit files in `client/components/ui/` | shadcn-managed — run `npx shadcn add` instead |
| Use `fetch()` directly in React components | Use `lib/api/` typed wrappers only |
| Skip `get_current_user` dependency on a protected route | Security violation |
| Store plaintext passwords | Always hash with `bcrypt` |
| Use synchronous file I/O in async routes | Use `aiofiles` |
| Deviate from the SSE response format | Frontend depends on `data: {"token": "..."}` format |

### Hard Rules — ALWAYS Do

| Rule | Reason |
|---|---|
| Add a docstring to every new service function | Readability and maintainability |
| Add `# Research Note:` comments in comparison tests | Documents empirical significance |
| Log chunk count, strategy, and duration in indexer | This is research data |
| Return `IngestResult` with `chunk_count`, `file_count`, `strategy`, `duration_ms` | Research data collection |
| Use the standard response envelope on every endpoint | Frontend depends on `{success, data, error}` |
| Write a unit test for every new chunker/metric function | Research assertions need verified primitives |

### When Adding a New Feature

1. Create `features/<name>/models.py`, `repository.py`, `service.py`, `schemas.py`
2. Create `api/v1/<name>.py` router
3. Register the router in `main.py` with prefix `/api/v1/<name>`
4. Write unit tests in `tests/unit/test_<name>.py`
5. Update the **API Contract** section in this document
6. Update **Repository Layout** if new directories were added

### When Modifying the Pipeline

- Any change to `ASTChunker` or `FixedChunker` requires re-running `test_retrieval_comparison.py` to confirm research assertions still hold
- Do NOT change the `chunk_id` format without updating `evaluation/datasets/*.json` and all related tests
- Chunk ID contract: `{file_path}::{node_name}` for AST, `{file_path}::chunk_{index}` for fixed

---

*Last updated: 2026-10-12 | CodeMind Final Year Project*
