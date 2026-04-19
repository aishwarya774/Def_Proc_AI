"""
RAG Query Engine — Retrieve relevant chunks then generate an answer.
Supports both synchronous and streaming responses.
"""

import asyncio
from langchain_community.chat_models import ChatOllama
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document
from app.core.config import settings
from app.core.vectorstore import get_vectorstore
from app.services.router import route_query


# ── Prompt template ──────────────────────────────────────────
RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are HybridRAG, an intelligent document assistant.
Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information, say so clearly.
Always cite which source document your answer comes from.

Context:
{context}"""),
    ("human", "{question}"),
])


def _get_llm(provider: str, model: str):
    """Create the appropriate LLM instance."""
    if provider == "ollama":
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=model,
            timeout=settings.OLLAMA_TIMEOUT,
            temperature=0.1,
        )
    else:
        return ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model=model,
            temperature=0.1,
        )


def _format_context(docs: list[Document]) -> str:
    """Format retrieved documents into a context string."""
    parts = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", "")
        page_str = f" (page {page + 1})" if page != "" else ""
        parts.append(f"[Source {i}: {source}{page_str}]\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def _format_sources(docs: list[Document]) -> list[dict]:
    """Extract source metadata for the response."""
    sources = []
    seen = set()
    for doc in docs:
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", "")
        key = f"{source}_{page}"
        if key not in seen:
            seen.add(key)
            sources.append({
                "source": source,
                "page": (page + 1) if isinstance(page, int) else None,
                "snippet": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
            })
    return sources


async def run_rag_query(
    query: str,
    force_provider: str | None = None,
    top_k: int | None = None,
    model_override: str | None = None,
) -> dict:
    """
    Full RAG pipeline: route → retrieve → generate → return.

    Returns:
        {
            "answer": str,
            "provider": str,
            "routing_reason": str,
            "model": str,
            "sources": list[dict],
        }
    """
    if top_k is None:
        top_k = settings.TOP_K

    # Route
    routing = route_query(query, force_provider)
    provider = routing["provider"]
    model = model_override or routing["model"]

    # Retrieve
    vs = get_vectorstore()
    try:
        docs = vs.similarity_search(query, k=top_k)
    except Exception:
        docs = []

    # Generate
    llm = _get_llm(provider, model)
    context = _format_context(docs) if docs else "No documents have been uploaded yet."
    prompt = RAG_PROMPT.format_messages(context=context, question=query)

    # Run in executor to avoid blocking (ChatOllama is sync)
    response = await asyncio.to_thread(llm.invoke, prompt)

    return {
        "answer": response.content,
        "provider": provider,
        "routing_reason": routing["reason"],
        "model": model,
        "sources": _format_sources(docs),
    }


async def stream_rag_query(
    query: str,
    force_provider: str | None = None,
    top_k: int | None = None,
    model_override: str | None = None,
):
    """
    Streaming RAG pipeline — yields Server-Sent Events.

    Yields dicts:
        { "type": "metadata", "data": { provider, model, routing_reason } }
        { "type": "token",    "data": { content } }
        { "type": "sources",  "data": [ ... ] }
        { "type": "done",     "data": {} }
    """
    if top_k is None:
        top_k = settings.TOP_K

    # Route
    routing = route_query(query, force_provider)
    provider = routing["provider"]
    model = model_override or routing["model"]

    # Send metadata first
    yield {
        "type": "metadata",
        "data": {
            "provider": provider,
            "model": model,
            "routing_reason": routing["reason"],
        },
    }

    # Retrieve
    vs = get_vectorstore()
    try:
        docs = vs.similarity_search(query, k=top_k)
    except Exception:
        docs = []

    # Stream tokens
    llm = _get_llm(provider, model)
    context = _format_context(docs) if docs else "No documents have been uploaded yet."
    prompt = RAG_PROMPT.format_messages(context=context, question=query)

    async for chunk in llm.astream(prompt):
        if chunk.content:
            yield {
                "type": "token",
                "data": {"content": chunk.content},
            }

    # Send sources
    yield {
        "type": "sources",
        "data": _format_sources(docs),
    }

    yield {"type": "done", "data": {}}
