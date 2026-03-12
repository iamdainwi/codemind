# CodeMind — AI-Powered Code Knowledge Base

> Upload your codebase, ask questions in plain English, and get cited answers.  
> Built with **Endee** vector database at its core.

---

## ✨ Features

| # | Feature | Description | Endee Usage |
|---|---------|-------------|-------------|
| 1 | **Ingest Codebase** | Upload ZIP or individual code files. System chunks, embeds, and indexes everything. | `index.upsert()` — store code chunk vectors with metadata |
| 2 | **RAG Chat** | Ask questions about your code in plain English, get cited answers. | `index.query()` — retrieve relevant chunks for context |
| 3 | **Semantic Search** | Describe what you're looking for, find relevant files by meaning. | `index.query()` — similarity search across all chunks |
| 4 | **Recommendations** | Select a file, see similar files from the codebase. | `index.query()` — mean-vector similarity + filtering |
| 5 | **Agentic Q&A** | Complex questions: agent decomposes → multi-search → synthesize. | `index.query()` × N — multiple searches per sub-question |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│                   Next.js 15 + Tailwind + shadcn/ui             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Upload Panel  │  │   Tab Bar    │  │   File Card          │  │
│  │ • Drag & Drop │  │ Ask|Search|  │  │ • Recommendations    │  │
│  │ • File List   │  │ Agent       │  │ • Similar files      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────┬───────┴──────────────────────┘              │
│                   │  Next.js API Routes (proxy)                 │
└───────────────────┼─────────────────────────────────────────────┘
                    │ HTTP / SSE
┌───────────────────┼─────────────────────────────────────────────┐
│                   │          BACKEND                             │
│                   │     FastAPI (Python)                         │
│                   │                                              │
│  ┌────────────────▼──────────────────────────────────────────┐  │
│  │ main.py — Routes                                          │  │
│  │  POST /ingest  POST /ask  POST /agent                     │  │
│  │  GET  /search  GET  /recommend  GET  /files               │  │
│  └──┬────────────────┬────────────────┬──────────────────────┘  │
│     │                │                │                          │
│  ┌──▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐                  │
│  │ingestion│  │   rag.py    │  │  agent.py   │                  │
│  │  .py    │  │ Embed→Search│  │ Decompose→  │                  │
│  │ Chunk→  │  │  →Prompt→   │  │ MultiSearch│                  │
│  │ Embed→  │  │  Ollama     │  │ →Synthesize│                  │
│  │ Store   │  └──────┬──────┘  └─────┬──────┘                  │
│  └──┬──────┘         │               │                          │
│     │                │               │                          │
│  ┌──▼────────────────▼───────────────▼──────────────────────┐  │
│  │         endee_client.py (SDK Wrapper)                     │  │
│  │  ensure_index() │ upsert_chunks() │ search()             │  │
│  │  get_file_chunks() │ recommend() │ list_files()          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP
                ┌─────────▼─────────┐      ┌──────────────────┐
                │   Endee Vector DB │      │  Ollama (local)  │
                │   localhost:8080  │      │  localhost:11434  │
                │   384-dim cosine  │      │  codellama/llama3│
                └───────────────────┘      └──────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Vector DB | **Endee** (Docker) | Store & search code embeddings |
| Embeddings | `all-MiniLM-L6-v2` (384-dim) | Convert code to vectors |
| LLM | **Ollama** (codellama / llama3) | Generate answers from context |
| Backend | **FastAPI** (Python 3.11+) | API server with SSE streaming |
| Frontend | **Next.js 15** + Tailwind + shadcn/ui | Dark-themed developer UI |

---

## 🚀 Setup

### Prerequisites

- **Docker** — for Endee vector DB
- **Python 3.11+** — for backend
- **Node.js 18+** — for frontend
- **Ollama** — for local LLM

### 1. Start Endee

```bash
docker run -p 8080:8080 -v endee-data:/data endeeio/endee-server:latest
```

### 2. Start Ollama

```bash
ollama pull codellama    # or: ollama pull llama3
ollama serve             # if not already running
```

### 3. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Verify Endee connection
python test_endee.py

# Start API server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

Open **http://localhost:3000**

---

## 📁 Project Structure

```
codemind/
├── backend/
│   ├── main.py              # FastAPI routes
│   ├── config.py            # All configuration
│   ├── endee_client.py      # Endee SDK wrapper
│   ├── ingestion.py         # File parsing → chunking → embedding → storing
│   ├── rag.py               # RAG pipeline (search → prompt → stream)
│   ├── agent.py             # Agentic pipeline (decompose → multi-search → synthesize)
│   ├── test_endee.py        # End-to-end Endee validation
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.tsx          # Main two-panel layout
    │   ├── layout.tsx        # Root layout with dark theme
    │   └── api/              # 6 proxy routes → backend
    └── components/
        ├── UploadPanel.tsx   # File upload + indexed files list
        ├── ChatPanel.tsx     # RAG chat with streaming
        ├── SearchPanel.tsx   # Semantic search results
        ├── AgentPanel.tsx    # Agentic Q&A with live steps
        └── FileCard.tsx      # File recommendations
```

---

## 🔍 How Endee Powers Every Feature

### Ingestion
Each code file is split into **60-line chunks** with **10-line overlap**, embedded using `all-MiniLM-L6-v2`, and stored via `index.upsert()` with metadata `{file_path, language, chunk_index, text}`.

### RAG Chat
User question → `model.encode()` → `index.query(top_k=6)` → retrieved chunks become LLM context → Ollama generates cited answer.

### Semantic Search
Query → embed → `index.query(top_k=8)` → return ranked chunks with similarity scores. No LLM involved.

### Recommendations
Select a file → retrieve all its chunks → compute **mean embedding** → `index.query()` → filter out same file → return top-4 similar files.

### Agentic Q&A
Complex question → Ollama **decomposes** into 3 sub-questions → `index.query()` for **each** sub-question → **deduplicate** chunks → Ollama **synthesizes** comprehensive answer with citations.

---

## 📝 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest` | Upload code file or ZIP |
| `POST` | `/ask` | RAG Q&A (SSE stream) |
| `POST` | `/agent` | Agentic Q&A (SSE stream) |
| `GET` | `/search?q=...&top_k=8` | Semantic search |
| `GET` | `/recommend?file_path=...&top_k=4` | File recommendations |
| `GET` | `/files` | List all indexed files |
| `GET` | `/health` | Health check |

All responses follow: `{"success": true, "data": {...}, "error": null}`

---

Built for the **Endee.io** campus placement evaluation — demonstrating Semantic Search, RAG, Recommendations, and Agentic AI, all powered by Endee vector database.
