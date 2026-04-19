# HybridRAG v2.0 — No-Docker Setup Guide

## What Changed (and Why)

The Docker-based architecture needed 4 containers running simultaneously, consuming 3.5GB+ RAM.
This version runs everything natively:

| Component | Old (Docker) | New (Native) | RAM Saved |
|-----------|-------------|-------------|-----------|
| Ollama | Container (~2.5 GB) | Native install (~1.5 GB) | ~1 GB |
| ChromaDB | Separate server container | In-process Python library | ~500 MB |
| Backend | Container with build overhead | Direct `uvicorn` | ~200 MB |
| Frontend | Nginx container | Vite dev server | ~100 MB |
| **Total** | **~3.5 GB+** | **~1.7 GB** | **~1.8 GB** |

Same features. Same code. Same offline-first privacy. Just no Docker overhead.

---

## Setup on Windows Surface Tablet

### Step 1: Install Ollama (one time)

Download from: https://ollama.com/download/windows

After install, open PowerShell and run:

```
ollama pull phi3:mini
```

Wait for download (~2.2 GB). Verify:

```
ollama list
```

You should see `phi3:mini` in the list. Ollama runs as a Windows service automatically.

### Step 2: Install Python dependencies

Open Git Bash. Navigate to project:

```bash
cd /e/hybrid-rag/backend
```

Create virtual environment (keeps things clean):

```bash
python -m venv venv
source venv/Scripts/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

This downloads the embedding model (~90 MB) on first run. Total install: ~500 MB.

### Step 3: Start the backend

```bash
cd /e/hybrid-rag/backend
source venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

Test it:

```bash
curl http://localhost:8000/status
```

You should see:
```json
{"backend":"ok","ollama":"connected","chromadb":"ready","openai":"not_configured"}
```

### Step 4: Start the frontend

Open a second Git Bash window:

```bash
cd /e/hybrid-rag/frontend
npm install
npm run dev
```

Open browser: http://localhost:3000

### Step 5: Upload a document and test

1. Drag a PDF or DOCX into the upload zone on the left sidebar
2. Wait for "uploaded" confirmation
3. Type a question in the chat box
4. You should get a response with source citations

---

## Setup on GitHub Codespaces

### Step 1: Open Codespace

1. Go to your GitHub repo
2. Click Code → Codespaces → Create codespace on main
3. Wait for environment to start

### Step 2: Install Ollama in Codespaces

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Start Ollama in background:

```bash
ollama serve &
```

Pull the model:

```bash
ollama pull phi3:mini
```

### Step 3: Start the backend

```bash
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --reload --port 8000
```

### Step 4: Start the frontend

Open a new terminal tab (click + in terminal panel):

```bash
cd frontend
npm install
npm run dev
```

Click the port 3000 link in the Ports tab to open the UI.

### Step 5: Test

Same as Windows — upload a document, ask a question.

---

## Project File Structure

```
hybrid-rag/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py            ← Settings (Ollama URL, paths, thresholds)
│   │   │   └── vectorstore.py       ← ChromaDB in-process + HuggingFace embeddings
│   │   ├── services/
│   │   │   ├── router.py            ← Smart LLM routing logic
│   │   │   ├── rag.py               ← RAG query engine (retrieve + generate)
│   │   │   └── ingestion.py         ← Document loading, chunking, embedding
│   │   ├── api/
│   │   │   ├── chat.py              ← POST /api/chat and /api/chat/stream
│   │   │   ├── documents.py         ← Upload, list, delete documents
│   │   │   └── health.py            ← GET /status and /health
│   │   └── templates/               ← (Future: Noting Sheet / RFP templates)
│   ├── requirements.txt
│   └── venv/                        ← Python virtual environment (not in git)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  ← Ironclad Ledger UI (wired to real API)
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js               ← Proxies /api to backend on port 8000
│   ├── tailwind.config.js
│   └── postcss.config.js
├── data/
│   ├── uploads/                     ← Uploaded documents stored here
│   └── chromadb/                    ← Vector database stored here
├── .env.example                     ← Environment config template
├── .gitignore
└── README.md
```

---

## API Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| GET | /status | System health (Ollama, ChromaDB, OpenAI) |
| GET | /health | Simple health check |
| POST | /api/chat | Send query, get RAG response |
| POST | /api/chat/stream | SSE streaming response |
| POST | /api/documents/upload | Upload and ingest a document |
| GET | /api/documents | List all uploaded documents |
| DELETE | /api/documents/{name} | Delete a document |
| GET | /docs | Swagger API documentation |

---

## Testing Commands

### Test status:
```bash
curl http://localhost:8000/status
```

### Test chat:
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"hello","provider":"auto"}'
```

### Upload a document:
```bash
curl -X POST http://localhost:8000/api/documents/upload \
  -F "file=@/path/to/document.pdf"
```

### List documents:
```bash
curl http://localhost:8000/api/documents
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Ollama: disconnected" | Make sure Ollama is running: `ollama list` (Windows) or `ollama serve &` (Codespaces) |
| "No module named app" | Run uvicorn from the `backend/` directory |
| Chat returns empty | Check backend terminal for error messages |
| Frontend can't reach API | Vite proxy handles this — make sure backend is on port 8000 |
| Embedding model download slow | First run downloads ~90 MB. Wait for it to complete. |
| "docx2txt not installed" | Run `pip install docx2txt` in your venv |
| Port already in use | Kill the process: `lsof -i :8000` then `kill <PID>` |

---

## What's Next

1. **Test end-to-end**: Upload a document, ask questions, verify sources
2. **Share Noting Sheet / RFP samples**: Templates will be added to `backend/app/templates/`
3. **Commit to GitHub**: `git add . && git commit -m "v2.0: no-Docker PoC" && git push`
