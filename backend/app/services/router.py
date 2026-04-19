"""
Smart Query Router — Decides Ollama (local) vs OpenAI (cloud).

Rules:
  1. Sensitive keywords detected    → ALWAYS local
  2. No OpenAI API key configured   → ALWAYS local
  3. High complexity score (>0.7)   → Route to cloud
  4. Long query (>150 words)        → Route to cloud
  5. Default                        → Local (free, private)
"""

import re
from app.core.config import settings


def _complexity_score(query: str) -> float:
    """Estimate query complexity from 0.0 to 1.0."""
    score = 0.0
    words = query.split()
    word_count = len(words)

    # Length factor
    if word_count > 100:
        score += 0.3
    elif word_count > 50:
        score += 0.2
    elif word_count > 20:
        score += 0.1

    # Technical vocabulary
    tech_words = {
        "analyze", "compare", "contrast", "evaluate", "synthesize",
        "implications", "correlation", "methodology", "framework",
        "architecture", "algorithm", "optimization", "trade-off",
        "comprehensive", "multi-step", "reasoning",
    }
    tech_count = sum(1 for w in words if w.lower() in tech_words)
    score += min(tech_count * 0.1, 0.3)

    # Question complexity (multiple sub-questions)
    question_marks = query.count("?")
    if question_marks > 1:
        score += 0.2

    # Numbered lists or multi-part requests
    if re.search(r"\d+\.", query):
        score += 0.1

    return min(score, 1.0)


def _has_sensitive_content(query: str) -> bool:
    """Check if query contains privacy-sensitive keywords."""
    lower = query.lower()
    return any(kw in lower for kw in settings.SENSITIVE_KEYWORDS)


def route_query(query: str, force_provider: str | None = None) -> dict:
    """
    Decide which LLM provider to use.

    Returns:
        {
            "provider": "ollama" | "openai",
            "model": str,
            "reason": str,
        }
    """
    # ── Forced override ──────────────────────────────────────
    if force_provider == "ollama":
        return {
            "provider": "ollama",
            "model": settings.OLLAMA_MODEL,
            "reason": "User forced local provider",
        }

    if force_provider == "openai":
        if not settings.OPENAI_API_KEY:
            return {
                "provider": "ollama",
                "model": settings.OLLAMA_MODEL,
                "reason": "OpenAI requested but no API key configured — falling back to local",
            }
        return {
            "provider": "openai",
            "model": settings.OPENAI_MODEL,
            "reason": "User forced cloud provider",
        }

    # ── Auto routing ─────────────────────────────────────────

    # Rule 1: Sensitive content → always local
    if _has_sensitive_content(query):
        return {
            "provider": "ollama",
            "model": settings.OLLAMA_MODEL,
            "reason": "Sensitive content detected — routed to local for privacy",
        }

    # Rule 2: No API key → always local
    if not settings.OPENAI_API_KEY:
        return {
            "provider": "ollama",
            "model": settings.OLLAMA_MODEL,
            "reason": "No OpenAI API key — using local model",
        }

    # Rule 3: High complexity → cloud
    complexity = _complexity_score(query)
    if complexity > settings.COMPLEXITY_THRESHOLD:
        return {
            "provider": "openai",
            "model": settings.OPENAI_MODEL,
            "reason": f"High complexity ({complexity:.1f}) — routed to cloud for better reasoning",
        }

    # Rule 4: Long query → cloud
    word_count = len(query.split())
    if word_count > settings.LONG_QUERY_WORDS:
        return {
            "provider": "openai",
            "model": settings.OPENAI_MODEL,
            "reason": f"Long query ({word_count} words) — routed to cloud for context handling",
        }

    # Rule 5: Default → local
    return {
        "provider": "ollama",
        "model": settings.OLLAMA_MODEL,
        "reason": "Standard query — using local model (free, private)",
    }
