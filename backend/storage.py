"""
DERZEN - Pipeline persistence.

Pipelines are stored as individual JSON files inside the sandboxed Pipelines
directory (config.subdir('pipelines')). This gives durable, human-readable
storage with no external database. All paths go through file_manager so they
can never escape the sandbox.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

import config


def _pipelines_dir():
    d = config.subdir("pipelines")
    d.mkdir(parents=True, exist_ok=True)
    return d


def list_pipelines() -> List[dict]:
    """Return all saved pipelines, newest first."""
    items: List[dict] = []
    for path in _pipelines_dir().glob("*.json"):
        try:
            items.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    items.sort(key=lambda p: p.get("created", ""), reverse=True)
    return items


def get_pipeline(pipeline_id: str) -> Optional[dict]:
    path = _pipelines_dir() / f"{_safe_id(pipeline_id)}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_pipeline(pipeline: dict) -> dict:
    """Create or update a pipeline. Assigns an id and created timestamp."""
    pipeline = dict(pipeline)
    if not pipeline.get("id"):
        pipeline["id"] = uuid.uuid4().hex
    pipeline.setdefault("created", datetime.now().isoformat(timespec="seconds"))
    pipeline["updated"] = datetime.now().isoformat(timespec="seconds")
    path = _pipelines_dir() / f"{_safe_id(pipeline['id'])}.json"
    path.write_text(json.dumps(pipeline, indent=2), encoding="utf-8")
    return pipeline


def delete_pipeline(pipeline_id: str) -> bool:
    path = _pipelines_dir() / f"{_safe_id(pipeline_id)}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def _safe_id(pipeline_id: str) -> str:
    """Reduce an id to a filesystem-safe token (no separators)."""
    return "".join(ch for ch in pipeline_id if ch.isalnum() or ch in "-_")
