"""
ChromaDB Vector Store — In-Process (no server needed)
Uses HuggingFace all-MiniLM-L6-v2 for embeddings (~90 MB download on first run).
"""

import chromadb
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.core.config import settings

# ── Embedding model (runs locally, no GPU needed) ────────────
_embeddings = None

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


# ── ChromaDB client (persistent, in-process) ────────────────
_client = None

def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
        )
    return _client


# ── LangChain vector store wrapper ──────────────────────────
_vectorstore = None

def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            client=get_chroma_client(),
            collection_name=settings.CHROMA_COLLECTION,
            embedding_function=get_embeddings(),
        )
    return _vectorstore


def reset_vectorstore():
    """Delete all documents and recreate the collection."""
    global _vectorstore
    client = get_chroma_client()
    try:
        client.delete_collection(settings.CHROMA_COLLECTION)
    except Exception:
        pass
    _vectorstore = None
    return get_vectorstore()
