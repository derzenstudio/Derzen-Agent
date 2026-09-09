"""
DERZEN - Sandboxed file operations.

Every path is validated against config.ALLOWED_BASE. Any attempt to escape the
sandbox (path traversal, absolute paths outside the base) raises SecurityError
and is refused. Nothing here can read or write outside ALLOWED_BASE.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List

import config


class SecurityError(Exception):
    """Raised when a requested path would escape the sandbox."""


def validate_path(requested: str) -> Path:
    """Resolve 'requested' inside ALLOWED_BASE, refusing any escape."""
    base = config.ALLOWED_BASE
    candidate = (base / requested).resolve()
    if candidate != base and base not in candidate.parents:
        raise SecurityError(f"Access denied outside sandbox: {requested}")
    return candidate


def list_dir(directory: str = "") -> List[dict]:
    """List entries in a sandboxed directory (non-recursive)."""
    target = validate_path(directory)
    if not target.exists():
        return []
    entries: List[dict] = []
    for child in sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        stat = child.stat()
        entries.append(
            {
                "name": child.name + ("/" if child.is_dir() else ""),
                "type": "folder" if child.is_dir() else "file",
                "size": _human_size(stat.st_size) if child.is_file() else "--",
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "items": sum(1 for _ in child.iterdir()) if child.is_dir() else None,
            }
        )
    return entries


def save_file(relative_path: str, content: str) -> Path:
    """Write text content to a sandboxed path, creating parents as needed."""
    target = validate_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target


def save_bytes(relative_path: str, data: bytes) -> Path:
    """Write binary content to a sandboxed path."""
    target = validate_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def read_file(relative_path: str) -> str:
    """Read text content from a sandboxed path."""
    return validate_path(relative_path).read_text(encoding="utf-8")


def disk_usage() -> dict:
    """Return disk usage figures for the volume holding ALLOWED_BASE."""
    import shutil

    total, used, free = shutil.disk_usage(config.ALLOWED_BASE)
    return {
        "total": _human_size(total),
        "used": _human_size(used),
        "free": _human_size(free),
        "usage_percent": round(used / total * 100, 1) if total else 0.0,
    }


def _human_size(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num < 1024 or unit == "TB":
            return f"{num:.1f} {unit}" if unit != "B" else f"{int(num)} B"
        num /= 1024
    return f"{num:.1f} TB"
