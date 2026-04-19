"""
Documents API — Upload, list, delete documents.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ingestion import (
    save_upload,
    ingest_document,
    list_documents,
    delete_document,
)

router = APIRouter()


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and ingest a document (PDF, DOCX, TXT, MD)."""
    allowed = {".pdf", ".docx", ".txt", ".md"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""

    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed)}",
        )

    try:
        # Save to disk
        content = await file.read()
        filepath = save_upload(content, file.filename)

        # Ingest into vector store
        result = ingest_document(filepath, file.filename)
        return {
            "status": "ok",
            "document": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
@router.get("/")
async def get_documents():
    """List all uploaded documents."""
    return list_documents()


@router.delete("/{filename}")
async def remove_document(filename: str):
    """Delete an uploaded document."""
    success = delete_document(filename)
    if not success:
        raise HTTPException(status_code=404, detail=f"Document not found: {filename}")
    return {"status": "deleted", "name": filename}
