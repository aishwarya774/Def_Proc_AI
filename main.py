"""
HybridRAG — FastAPI Application Entry Point
No Docker required. Run with: uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat, documents, health

app = FastAPI(
    title="HybridRAG API",
    description="Hybrid Local + Cloud RAG System — Proof of Concept",
    version="2.0-poc",
)

# ── CORS (allow React frontend) ─────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routes ──────────────────────────────────────────
app.include_router(health.router,     prefix="",              tags=["Health"])
app.include_router(chat.router,       prefix="/api/chat",     tags=["Chat"])
app.include_router(documents.router,  prefix="/api/documents", tags=["Documents"])


@app.get("/")
async def root():
    return {
        "app": "HybridRAG",
        "version": "2.0-poc",
        "docs": "/docs",
        "status": "/status",
    }
