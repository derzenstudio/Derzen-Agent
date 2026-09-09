"""
DERZEN - Local AI manager (Ollama backend).

Talks to a locally running Ollama server over HTTP. No cloud calls, no API keys.
If Ollama is unreachable this raises a clear error rather than pretending to work.
"""
from __future__ import annotations

import httpx

import config


class AIError(RuntimeError):
    """Raised when the local AI backend is unavailable or returns an error."""


async def is_available() -> bool:
    """Return True if the Ollama server responds to a tags request."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{config.OLLAMA_URL}/api/tags")
            return resp.status_code == 200
    except httpx.HTTPError:
        return False


async def list_models() -> list[str]:
    """Return the names of locally installed Ollama models."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{config.OLLAMA_URL}/api/tags")
        resp.raise_for_status()
        data = resp.json()
    return [m["name"] for m in data.get("models", [])]


async def query(prompt: str, model: str | None = None) -> str:
    """Send a prompt to the local model and return the generated text."""
    if not prompt.strip():
        raise AIError("Prompt is empty.")
    model = model or config.DEFAULT_MODEL
    payload = {"model": model, "prompt": prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{config.OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise AIError(
            f"Could not reach the local AI at {config.OLLAMA_URL}. "
            f"Is 'ollama serve' running? ({exc})"
        ) from exc
    return (data.get("response") or "").strip()
