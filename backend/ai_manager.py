"""
DERZEN - Local AI manager (Ollama).

Talks to Ollama over HTTP on this machine. No cloud calls, no API keys. When
Ollama is unreachable it raises a clear error instead of pretending to work.

query      one shot prompt to text
chat       multi turn, used by the dashboard assistant
query_json parse a JSON answer out of a small model, which needs a bit of
           cleanup because tiny models like to wrap JSON in chatter
"""
from __future__ import annotations

import json
import re
from typing import Any, List, Optional

import httpx

import config

JSON_BLOCK = re.compile(r"(\{.*\}|\[.*\])", re.S)


class AIError(RuntimeError):
    """Raised when the local AI backend is unavailable or returns an error."""


async def is_available() -> bool:
    """True when the Ollama server answers a tags request."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{config.OLLAMA_URL}/api/tags")
            return resp.status_code == 200
    except httpx.HTTPError:
        return False


async def list_models() -> List[str]:
    """Names of the models installed locally."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{config.OLLAMA_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()
        return [m["name"] for m in data.get("models", [])]
    except httpx.HTTPError:
        return []


async def query(
    prompt: str,
    model: Optional[str] = None,
    system: str = "",
    temperature: float = 0.4,
    num_ctx: int = 0,
) -> str:
    """Send one prompt and return the generated text."""
    if not (prompt or "").strip():
        raise AIError("Prompt is empty.")
    payload: dict = {
        "model": model or config.DEFAULT_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system:
        payload["system"] = system
    if num_ctx:
        payload["options"]["num_ctx"] = num_ctx
    try:
        async with httpx.AsyncClient(timeout=config.AI_TIMEOUT) as client:
            resp = await client.post(f"{config.OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise AIError(
            f"Could not reach the local AI at {config.OLLAMA_URL}. "
            f"Is 'ollama serve' running? ({exc})"
        ) from exc
    return (data.get("response") or "").strip()


async def chat(
    messages: List[dict],
    model: Optional[str] = None,
    system: str = "",
    temperature: float = 0.4,
) -> str:
    """
    Multi turn call. messages is a list of {"role": "user"|"assistant",
    "content": str}. Falls back to the generate endpoint on older Ollama builds.
    """
    history = list(messages or [])
    if system:
        history = [{"role": "system", "content": system}] + history
    payload = {
        "model": model or config.DEFAULT_MODEL,
        "messages": history,
        "stream": False,
        "options": {"temperature": temperature},
    }
    try:
        async with httpx.AsyncClient(timeout=config.AI_TIMEOUT) as client:
            resp = await client.post(f"{config.OLLAMA_URL}/api/chat", json=payload)
            if resp.status_code == 404:
                flat = "\n\n".join(
                    f"{m.get('role', 'user').upper()}: {m.get('content', '')}"
                    for m in history
                )
                return await query(flat, model=model, temperature=temperature)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise AIError(
            f"Could not reach the local AI at {config.OLLAMA_URL}. ({exc})"
        ) from exc
    return ((data.get("message") or {}).get("content") or "").strip()


def extract_json(text: str) -> Any:
    """Pull the first JSON object or array out of a model answer."""
    raw = (text or "").strip()
    if not raw:
        return None
    fence = chr(96) * 3
    if fence in raw:
        parts = raw.split(fence)
        for part in parts:
            candidate = part.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            if candidate.startswith(("{", "[")):
                raw = candidate
                break
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = JSON_BLOCK.search(raw)
    if not match:
        return None
    snippet = match.group(1)
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        # last resort: trailing commas are the usual sin
        cleaned = re.sub(r",\s*([}\]])", r"\1", snippet)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return None


async def query_json(
    prompt: str, model: Optional[str] = None, retries: int = 2
) -> Any:
    """Ask for JSON and keep asking until something parses, or give up cleanly."""
    ask = prompt + "\n\nAnswer with valid JSON only. No explanation, no prose."
    for attempt in range(max(1, retries)):
        text = await query(ask, model=model, temperature=0.1 if attempt else 0.2)
        parsed = extract_json(text)
        if parsed is not None:
            return parsed
        ask = (
            prompt
            + "\n\nYour last answer was not valid JSON. Reply with the JSON "
              "value only, starting with { or [."
        )
    return None


async def status() -> dict:
    """Small snapshot for the dashboard strip."""
    online = await is_available()
    models = await list_models() if online else []
    return {
        "online": online,
        "url": config.OLLAMA_URL,
        "model": config.DEFAULT_MODEL,
        "fast_model": config.FAST_MODEL,
        "models": models,
        "model_installed": any(
            m.split(":")[0] == config.DEFAULT_MODEL.split(":")[0] for m in models
        ),
    }
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
