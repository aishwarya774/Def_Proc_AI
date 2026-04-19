"""
HybridRAG Configuration — No-Docker Proof of Concept
All services run natively: Ollama on localhost, ChromaDB in-process.
"""

from pydantic_settings import BaseSettings
from pathlib import Path
import os


class Settings(BaseSettings):
    # ── Ollama (native install) ──────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3:mini"
    OLLAMA_TIMEOUT: int = 120

    # ── OpenAI (optional cloud fallback) ─────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── ChromaDB (in-process, local folder) ──────────────────
    CHROMA_PERSIST_DIR: str = str(
        Path(__file__).resolve().parents[3] / "data" / "chromadb"
    )
    CHROMA_COLLECTION: str = "hybridrag_docs"

    # ── Document uploads ─────────────────────────────────────
    UPLOAD_DIR: str = str(
        Path(__file__).resolve().parents[3] / "data" / "uploads"
    )

    # ── Embedding model (runs in-process, ~90 MB) ────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ── RAG parameters ───────────────────────────────────────
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    TOP_K: int = 5

    # ── Router thresholds ────────────────────────────────────
    COMPLEXITY_THRESHOLD: float = 0.7
    LONG_QUERY_WORDS: int = 150
    SENSITIVE_KEYWORDS: list[str] = [
        "password", "secret", "confidential", "private",
        "ssn", "credit card", "bank", "salary", "medical",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
