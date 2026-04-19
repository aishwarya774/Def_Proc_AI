"""
Chat API — POST /api/chat and POST /api/chat/stream
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.rag import run_rag_query, stream_rag_query
import json

router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    provider: str = "auto"           # "auto" | "local" | "cloud"
    top_k: int = 5
    model: str | None = None

    @property
    def force_provider(self) -> str | None:
        """Map friendly names to internal provider names."""
        mapping = {"local": "ollama", "cloud": "openai", "auto": None}
        return mapping.get(self.provider)


class ChatResponse(BaseModel):
    answer: str
    provider: str
    routing_reason: str
    model: str
    sources: list[dict]


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        result = await run_rag_query(
            query=req.query,
            force_provider=req.force_provider,
            top_k=req.top_k,
            model_override=req.model,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """SSE endpoint for streaming token-by-token responses."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    async def event_generator():
        try:
            async for event in stream_rag_query(
                query=req.query,
                force_provider=req.force_provider,
                top_k=req.top_k,
                model_override=req.model,
            ):
                event_type = event["type"]
                data = json.dumps(event["data"])
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
