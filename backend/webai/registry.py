"""
DERZEN - Online AI provider registry.

Reads providers.json so the list of usable services is data, not code. Drop a
providers.local.json next to it to add or override entries without touching the
repository, which keeps your edits safe across a git pull.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

_HERE = Path(__file__).parent
_BUILTIN = _HERE / "providers.json"
_OVERRIDE = _HERE / "providers.local.json"

_cache: Dict[str, Any] | None = None


def _read(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if isinstance(data, list):
        return data
    return data.get("providers", [])


def _load() -> Dict[str, Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for entry in _read(_BUILTIN) + _read(_OVERRIDE):
        pid = str(entry.get("id", "")).strip().lower()
        if not pid:
            continue
        base = merged.get(pid, {})
        base.update(entry)
        base["id"] = pid
        merged[pid] = base
    return merged


def all_providers() -> Dict[str, Dict[str, Any]]:
    global _cache
    if _cache is None:
        _cache = _load()
    return _cache


def reload() -> None:
    """Forget the cached file so edits are picked up without a restart."""
    global _cache
    _cache = None


def get(provider_id: str) -> Dict[str, Any]:
    pid = (provider_id or "").strip().lower()
    found = all_providers().get(pid)
    if not found:
        known = ", ".join(sorted(all_providers())) or "none"
        raise ValueError(f"Unknown online AI service '{provider_id}'. Known services: {known}")
    return found


def provider_choices() -> List[Dict[str, str]]:
    """Options for the builder dropdowns."""
    return [
        {"value": p["id"], "label": p.get("label", p["id"])}
        for p in sorted(all_providers().values(), key=lambda x: x.get("label", x["id"]).lower())
    ]


def selectors(provider_id: str, kind: str) -> List[str]:
    """Selector list for one part of a provider page, always a list."""
    value = get(provider_id).get(kind, [])
    if isinstance(value, str):
        return [value]
    return [str(v) for v in value]
