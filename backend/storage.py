"""
DERZEN - Pipeline and run persistence.

Pipelines live as one JSON file each inside the sandboxed Pipelines directory.
Finished runs live the same way inside Runs. No database, nothing outside the
sandbox, and every file stays readable by hand.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

import config

RUN_KEEP = 200


def _safe_id(value: str) -> str:
    """Reduce an id to a filesystem safe token (no separators at all)."""
    return "".join(ch for ch in str(value) if ch.isalnum() or ch in "-_")[:80]


def _pipelines_dir():
    return config.subdir("pipelines")


def _runs_dir():
    return config.subdir("runs")


# --------------------------------------------------------------- pipelines
def list_pipelines() -> List[dict]:
    """Every saved pipeline, newest first."""
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
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_pipeline(pipeline: dict) -> dict:
    """Create or update a pipeline. Assigns an id and timestamps."""
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


# -------------------------------------------------------------------- runs
def save_run(report: dict) -> dict:
    """
    Persist a finished pipeline run. The runner hands over the dict it built,
    so this only adds an id plus a timestamp and trims the archive.
    """
    record = dict(report or {})
    if not record.get("run_id"):
        record["run_id"] = uuid.uuid4().hex
    record.setdefault("saved", datetime.now().isoformat(timespec="seconds"))
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = _runs_dir() / f"{stamp}-{_safe_id(record['run_id'])[:8]}.json"
    try:
        path.write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")
    except OSError:
        return record
    _trim_runs()
    return record


def _trim_runs() -> None:
    files = sorted(_runs_dir().glob("*.json"))
    excess = len(files) - RUN_KEEP
    for path in files[:excess] if excess > 0 else []:
        try:
            path.unlink()
        except OSError:
            pass


def list_runs(limit: int = 25) -> List[dict]:
    """
    Recent runs, newest first, trimmed down to what the dashboard shows.
    Full step output stays on disk and is fetched only through get_run.
    """
    out: List[dict] = []
    for path in sorted(_runs_dir().glob("*.json"), reverse=True)[: max(1, limit)]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        steps = data.get("steps") or []
        out.append(
            {
                "run_id": data.get("run_id", path.stem),
                "file": path.name,
                "pipeline": data.get("pipeline") or data.get("name") or "pipeline",
                "status": data.get("status", "unknown"),
                "started": data.get("started"),
                "finished": data.get("finished") or data.get("saved"),
                "duration": data.get("duration"),
                "steps": len(steps),
                "failed": sum(1 for s in steps if s.get("status") == "error"),
                "summary": (data.get("summary") or "")[:400],
                "files": data.get("files") or [],
                "links": data.get("links") or [],
            }
        )
    return out


def get_run(run_id: str) -> Optional[dict]:
    token = _safe_id(run_id)
    for path in sorted(_runs_dir().glob("*.json"), reverse=True):
        if token in path.stem:
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return None
    return None


def delete_run(run_id: str) -> bool:
    token = _safe_id(run_id)
    hit = False
    for path in list(_runs_dir().glob("*.json")):
        if token in path.stem:
            try:
                path.unlink()
                hit = True
            except OSError:
                pass
    return hit
"""
DERZEN - Pipeline and run persistence.

Pipelines live as one JSON file each inside the sandboxed Pipelines directory.
Finished runs live the same way inside Runs. No database, nothing outside the
sandbox, and every file stays readable by hand.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

import config

RUN_KEEP = 200


def _safe_id(value: str) -> str:
    """Reduce an id to a filesystem safe token (no separators at all)."""
    return "".join(ch for ch in str(value) if ch.isalnum() or ch in "-_")[:80]


def _pipelines_dir():
    return config.subdir("pipelines")


def _runs_dir():
    return config.subdir("runs")


# --------------------------------------------------------------- pipelines
def list_pipelines() -> List[dict]:
    """Every saved pipeline, newest first."""
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
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_pipeline(pipeline: dict) -> dict:
    """Create or update a pipeline. Assigns an id and timestamps."""
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


# -------------------------------------------------------------------- runs
def save_run(report: dict) -> dict:
    """
    Persist a finished pipeline run. The runner hands over the dict it built,
    so this only adds an id plus a timestamp and trims the archive.
    """
    record = dict(report or {})
    if not record.get("run_id"):
        record["run_id"] = uuid.uuid4().hex
    record.setdefault("saved", datetime.now().isoformat(timespec="seconds"))
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = _runs_dir() / f"{stamp}-{_safe_id(record['run_id'])[:8]}.json"
    try:
        path.write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")
    except OSError:
        return record
    _trim_runs()
    return record


def _trim_runs() -> None:
    files = sorted(_runs_dir().glob("*.json"))
    excess = len(files) - RUN_KEEP
    for path in files[:excess] if excess > 0 else []:
        try:
            path.unlink()
        except OSError:
            pass


def list_runs(limit: int = 25) -> List[dict]:
    """
    Recent runs, newest first, trimmed down to what the dashboard shows.
    Full step output stays on disk and is fetched only through get_run.
    """
    out: List[dict] = []
    for path in sorted(_runs_dir().glob("*.json"), reverse=True)[: max(1, limit)]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        steps = data.get("steps") or []
        out.append(
            {
                "run_id": data.get("run_id", path.stem),
                "file": path.name,
                "pipeline": data.get("pipeline") or data.get("name") or "pipeline",
                "status": data.get("status", "unknown"),
                "started": data.get("started"),
                "finished": data.get("finished") or data.get("saved"),
                "duration": data.get("duration"),
                "steps": len(steps),
                "failed": sum(1 for s in steps if s.get("status") == "error"),
                "summary": (data.get("summary") or "")[:400],
                "files": data.get("files") or [],
                "links": data.get("links") or [],
            }
        )
    return out


def get_run(run_id: str) -> Optional[dict]:
    token = _safe_id(run_id)
    for path in sorted(_runs_dir().glob("*.json"), reverse=True):
        if token in path.stem:
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return None
    return None


def delete_run(run_id: str) -> bool:
    token = _safe_id(run_id)
    hit = False
    for path in list(_runs_dir().glob("*.json")):
        if token in path.stem:
            try:
                path.unlink()
                hit = True
            except OSError:
                pass
    return hit
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
