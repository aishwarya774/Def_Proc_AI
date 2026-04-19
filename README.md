# HybridRAG v2.0 — Hybrid Local + Cloud RAG System

**Offline-first document Q&A with smart routing between local and cloud LLMs.**

## What Is This?

HybridRAG lets you upload documents (PDF, DOCX, TXT, MD) and ask questions about them using AI. It automatically routes queries between:

- **Local (Ollama)** — Private, free, works offline. Uses phi3:mini.
- **Cloud (OpenAI)** — Better reasoning for complex queries. Optional.

The smart router decides based on privacy, complexity, and query length.

## Quick Start

### 1. Install Ollama
Download from https://ollama.com and run:
```bash
ollama pull phi3:mini
```

### 2. Start Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate    # Windows Git Bash
# source venv/bin/activate      # Mac/Linux/Codespaces
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open Browser
http://localhost:3000

## Architecture

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   React UI   │────▶│   FastAPI Backend     │────▶│   Ollama    │
│  (port 3000) │     │   (port 8000)         │     │ (port 11434)│
│              │     │                       │     │  phi3:mini  │
│  Ironclad    │     │  ┌─────────────────┐  │     └─────────────┘
│  Ledger UI   │     │  │  Smart Router   │  │            │
│              │     │  │  ┌───────────┐  │  │     ┌──────┴──────┐
│  - Chat      │     │  │  │ Privacy   │  │  │     │   OpenAI    │
│  - Upload    │     │  │  │ Complexity│  │  │     │  (optional) │
│  - Sources   │     │  │  │ Length    │  │  │     │  gpt-4o-mini│
│  - Status    │     │  │  └───────────┘  │  │     └─────────────┘
└──────────────┘     │  └─────────────────┘  │
                     │  ┌─────────────────┐  │
                     │  │ ChromaDB        │  │
                     │  │ (in-process)    │  │
                     │  │ HuggingFace     │  │
                     │  │ embeddings      │  │
                     │  └─────────────────┘  │
                     └──────────────────────┘
```

## Features

- **Smart Routing**: Auto-selects local or cloud LLM per query
- **Document Ingestion**: PDF, DOCX, TXT, MD via drag-and-drop
- **Vector Search**: ChromaDB with all-MiniLM-L6-v2 embeddings
- **Source Citations**: Responses include source document + page references
- **Provider Override**: User can force Local / Cloud / Auto mode
- **Offline Operation**: Works 100% without internet
- **Ironclad Ledger UI**: Professional two-pane design system

## Full Documentation

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.
