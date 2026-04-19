"""
Document Ingestion — Load, chunk, and embed documents into ChromaDB.
Supports: PDF, DOCX, TXT, MD
"""

import os
import shutil
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
)
from app.core.config import settings
from app.core.vectorstore import get_vectorstore, get_embeddings

# Try docx loader
try:
    from langchain_community.document_loaders import Docx2txtLoader
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False


def _get_loader(filepath: str):
    """Pick the right document loader based on file extension."""
    ext = Path(filepath).suffix.lower()

    if ext == ".pdf":
        return PyPDFLoader(filepath)
    elif ext in (".txt", ".md"):
        return TextLoader(filepath, encoding="utf-8")
    elif ext == ".docx":
        if not HAS_DOCX:
            raise ValueError("docx2txt not installed. Run: pip install docx2txt")
        return Docx2txtLoader(filepath)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def ingest_document(filepath: str, filename: str | None = None) -> dict:
    """
    Load a document, split into chunks, embed, and store in ChromaDB.

    Returns:
        { "name": str, "chunks": int, "type": str, "size_kb": float }
    """
    if filename is None:
        filename = Path(filepath).name

    ext = Path(filepath).suffix.lower().lstrip(".")
    size_kb = round(os.path.getsize(filepath) / 1024, 1)

    # Load
    loader = _get_loader(filepath)
    raw_docs = loader.load()

    # Add metadata
    for doc in raw_docs:
        doc.metadata["source"] = filename

    # Split
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
    )
    chunks = splitter.split_documents(raw_docs)

    # Embed & store
    vs = get_vectorstore()
    vs.add_documents(chunks)

    return {
        "name": filename,
        "chunks": len(chunks),
        "type": ext.upper(),
        "size_kb": size_kb,
    }


def save_upload(file_bytes: bytes, filename: str) -> str:
    """Save uploaded file to disk and return the full path."""
    dest = os.path.join(settings.UPLOAD_DIR, filename)
    with open(dest, "wb") as f:
        f.write(file_bytes)
    return dest


def list_documents() -> list[dict]:
    """List all uploaded documents."""
    docs = []
    upload_dir = settings.UPLOAD_DIR
    if not os.path.exists(upload_dir):
        return docs

    for fname in os.listdir(upload_dir):
        fpath = os.path.join(upload_dir, fname)
        if os.path.isfile(fpath):
            ext = Path(fname).suffix.lower().lstrip(".")
            size_kb = round(os.path.getsize(fpath) / 1024, 1)
            docs.append({
                "name": fname,
                "type": ext.upper(),
                "size_kb": size_kb,
            })
    return docs


def delete_document(filename: str) -> bool:
    """Delete an uploaded document (file only; ChromaDB chunks remain)."""
    fpath = os.path.join(settings.UPLOAD_DIR, filename)
    if os.path.exists(fpath):
        os.remove(fpath)
        return True
    return False
