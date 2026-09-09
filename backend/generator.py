"""
DERZEN - AI pipeline generator.

Turns a plain-English description into a pipeline graph. It first asks the local
AI to emit a JSON node list; if the AI is unavailable or returns something
unparseable, it falls back to a deterministic keyword-based builder so the
feature still produces a valid, runnable pipeline (never a fake placeholder).
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List

import ai_manager

VALID_TYPES = {
    "start", "end", "ai_query", "ai_browser", "web_scrape", "social_analyze",
    "email_send", "whatsapp", "file_save", "wait", "branch",
}


def _new_node(ntype: str, index: int, config: dict | None = None) -> dict:
    return {
        "id": f"n{index}_{ntype}",
        "type": ntype,
        "position": {"x": 120 + index * 220, "y": 200},
        "config": config or {},
        "connections": {},
    }


def _chain(types: List[str]) -> List[dict]:
    """Build a straight-line pipeline from a list of node types."""
    nodes = [_new_node(t, i) for i, t in enumerate(types)]
    for a, b in zip(nodes, nodes[1:]):
        a["connections"]["next"] = b["id"]
    return nodes


def _fallback(prompt: str) -> List[str]:
    """Pick a sensible node sequence from keywords in the prompt."""
    p = prompt.lower()
    seq: List[str] = ["start"]
    if any(k in p for k in ("scrape", "website", "news", "read", "research")):
        seq.append("web_scrape")
    if any(k in p for k in ("twitter", "instagram", "linkedin", "facebook", "social", "sentiment")):
        seq.append("social_analyze")
    if any(k in p for k in ("chatgpt", "claude", "gemini", "perplexity", "online ai")):
        seq.append("ai_browser")
    seq.append("ai_query")  # analysis step is almost always wanted
    if any(k in p for k in ("report", "save", "csv", "file", "spreadsheet", "xlsx")):
        seq.append("file_save")
    if any(k in p for k in ("email", "mail", "send to")):
        seq.append("email_send")
    if any(k in p for k in ("whatsapp", "message", "alert", "notify")):
        seq.append("whatsapp")
    seq.append("end")
    return seq


async def generate(prompt: str) -> dict:
    """Return a complete, runnable pipeline for the given description."""
    nodes: List[dict] | None = None

    if await ai_manager.is_available():
        instruction = (
            "You design automation pipelines. Given a request, reply with ONLY a "
            "JSON array of steps. Each step is an object with 'type' (one of: "
            f"{sorted(VALID_TYPES)}) and optional 'config'. Begin with a 'start' "
            "step and end with an 'end' step. Request: " + prompt
        )
        try:
            raw = await ai_manager.query(instruction)
            start, end = raw.find("["), raw.rfind("]")
            parsed = json.loads(raw[start : end + 1])
            types = [s.get("type") for s in parsed if s.get("type") in VALID_TYPES]
            if types and types[0] == "start" and types[-1] == "end":
                nodes = _chain(types)
                for node, step in zip(nodes, parsed):
                    if isinstance(step.get("config"), dict):
                        node["config"].update(step["config"])
        except (json.JSONDecodeError, ValueError, KeyError, TypeError):
            nodes = None

    if nodes is None:
        nodes = _chain(_fallback(prompt))

    return {
        "id": uuid.uuid4().hex,
        "name": prompt[:60] if prompt else "Generated Pipeline",
        "description": prompt,
        "nodes": nodes,
        "created": datetime.now().isoformat(timespec="seconds"),
    }
