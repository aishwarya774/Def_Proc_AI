"""
Health & Status API — Check Ollama, ChromaDB, OpenAI availability.
"""

import httpx
from fastapi import APIRouter
from app.core.config import settings
from app.core.vectorstore import get_chroma_client

router = APIRouter()


@router.get("/status")
async def system_status():
    """Check all service statuses."""

    # ── Ollama ───────────────────────────────────────────────
    ollama_status = "disconnected"
    ollama_model = None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                ollama_status = "connected"
                models = resp.json().get("models", [])
                model_names = [m["name"] for m in models]
                ollama_model = settings.OLLAMA_MODEL if any(
                    settings.OLLAMA_MODEL in n for n in model_names
                ) else None
    except Exception:
        pass

    # ── ChromaDB (in-process, always available) ──────────────
    chromadb_status = "disconnected"
    doc_count = 0
    try:
        client = get_chroma_client()
        collections = client.list_collections()
        chromadb_status = "ready"
        for col in collections:
            doc_count += col.count()
    except Exception:
        pass

    # ── OpenAI ───────────────────────────────────────────────
    openai_status = "configured" if settings.OPENAI_API_KEY else "not_configured"

    return {
        "backend": "ok",
        "ollama": ollama_status,
        "ollama_model": ollama_model,
        "chromadb": chromadb_status,
        "chromadb_chunks": doc_count,
        "openai": openai_status,
        "default_model": settings.OLLAMA_MODEL,
    }


@router.get("/health")
async def health():
    return {"status": "ok"}
