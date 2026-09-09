"""
DERZEN - Pipeline execution engine.

Walks a pipeline's node graph starting at the START node, following each node's
outgoing connection. Results from earlier nodes are stored in a context dict and
made available to later nodes through {{variable}} substitution. BRANCH nodes
choose their next node based on a simple truthy/comparison condition. Every step
is recorded in an execution log with timing, matching the shape the frontend
Task Scheduler renders.
"""
from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import ai_manager
import file_manager
import runtime
from automation import browser

_VAR = re.compile(r"{{\s*([\w.]+)\s*}}")


def substitute(value: Any, context: Dict[str, Any]) -> Any:
    """Replace {{name}} tokens in a string using the run context."""
    if not isinstance(value, str):
        return value
    return _VAR.sub(lambda m: str(context.get(m.group(1), "")), value)


def _node_map(nodes: List[dict]) -> Dict[str, dict]:
    return {n["id"]: n for n in nodes}


def _find_start(nodes: List[dict]) -> Optional[dict]:
    return next((n for n in nodes if n.get("type") == "start"), None)


def _next_id(node: dict, branch: str = "next") -> Optional[str]:
    conns = node.get("connections", {}) or {}
    return conns.get(branch) or conns.get("next")


def _truthy(condition: str, context: Dict[str, Any]) -> bool:
    """Evaluate a BRANCH condition after variable substitution.

    Supports '!= ""', '== "x"', '> n', '< n' and bare truthiness. Deliberately
    tiny and safe - no eval of arbitrary code.
    """
    expr = substitute(condition, context).strip()
    for op in ("!=", "==", ">=", "<=", ">", "<"):
        if op in expr:
            left, right = (s.strip().strip('"').strip("'") for s in expr.split(op, 1))
            try:
                lf, rf = float(left), float(right)
                left, right = lf, rf  # type: ignore[assignment]
            except ValueError:
                pass
            return {
                "!=": left != right,
                "==": left == right,
                ">=": left >= right,
                "<=": left <= right,
                ">": left > right,
                "<": left < right,
            }[op]
    return bool(expr) and expr.lower() not in {"false", "0", ""}


async def _run_node(node: dict, context: Dict[str, Any]) -> Any:
    """Execute a single node and return its result value (also stored in context)."""
    runtime.check_not_stopped()
    ntype = node.get("type")
    cfg = {k: substitute(v, context) for k, v in (node.get("config") or {}).items()}

    if ntype in ("start", "end"):
        return None
    if ntype == "wait":
        await asyncio.sleep(float(cfg.get("seconds", 0) or 0))
        return None
    if ntype == "ai_query":
        return await ai_manager.query(str(cfg.get("prompt", "")))
    if ntype == "ai_browser":
        return await browser.ask_web_ai(
            str(cfg.get("ai_service", "chatgpt")),
            str(cfg.get("prompt", "")),
            int(cfg.get("wait_seconds", 30) or 30),
        )
    if ntype == "web_scrape":
        urls = [u for u in str(cfg.get("urls", "")).splitlines() if u.strip()]
        return await browser.scrape(urls)
    if ntype == "social_analyze":
        import social

        return await social.analyze(
            str(cfg.get("platform", "twitter")),
            str(cfg.get("query", "")),
            int(cfg.get("post_count", 10) or 10),
            bool(cfg.get("analyze_sentiment", True)),
        )
    if ntype == "email_send":
        import email_listener

        email_listener.send_email(
            str(cfg.get("to", "")), str(cfg.get("subject", "")), str(cfg.get("body", ""))
        )
        return "sent"
    if ntype == "whatsapp":
        import whatsapp_listener

        await whatsapp_listener.send_message(
            str(cfg.get("contact", "")), str(cfg.get("message", ""))
        )
        return "sent"
    if ntype == "file_save":
        path = file_manager.save_file(
            str(cfg.get("filename", "output.txt")), str(cfg.get("content", ""))
        )
        return str(path)
    if ntype == "branch":
        return _truthy(str(cfg.get("condition", "")), context)
    raise ValueError(f"Unknown node type: {ntype}")


async def run_pipeline(pipeline: dict) -> dict:
    """Execute a pipeline end to end and return a structured run report."""
    nodes = pipeline.get("nodes", [])
    nmap = _node_map(nodes)
    current = _find_start(nodes)
    if current is None:
        raise ValueError("Pipeline has no START node.")

    context: Dict[str, Any] = {}
    log: List[dict] = []
    started = time.time()
    steps = 0

    while current is not None and steps < 200:
        steps += 1
        step_start = time.time()
        label = current.get("type", "node")
        status = "success"
        detail = ""
        try:
            result = await _run_node(current, context)
            context[current["id"]] = result
            # Friendly aliases so templates can use readable names.
            if current.get("type") == "ai_query":
                context["ai_answer"] = result
                context["ai_response"] = result
            elif current.get("type") == "web_scrape":
                context["scraped_data"] = result
            detail = _summarise(result)
        except runtime.EmergencyStopped:
            status = "error"
            detail = "Emergency stop engaged - pipeline halted."
            log.append(_entry(step_start, label, status, detail))
            break
        except Exception as exc:  # noqa: BLE001 - record and stop
            status = "error"
            detail = str(exc)
            log.append(_entry(step_start, label, status, detail))
            break

        log.append(_entry(step_start, label, status, detail))

        if current.get("type") == "end":
            break
        if current.get("type") == "branch":
            branch = "true" if context[current["id"]] else "false"
            current = nmap.get(_next_id(current, branch) or "")
        else:
            current = nmap.get(_next_id(current) or "")

    return {
        "pipeline": pipeline.get("name", "Untitled"),
        "started": datetime.fromtimestamp(started).isoformat(timespec="seconds"),
        "total_seconds": round(time.time() - started, 1),
        "steps": steps,
        "status": log[-1]["status"] if log else "success",
        "log": log,
    }


def _entry(step_start: float, label: str, status: str, detail: str) -> dict:
    return {
        "time": datetime.now().strftime("%H:%M:%S"),
        "step": label,
        "status": status,
        "duration": f"{time.time() - step_start:.1f}s",
        "details": detail[:300],
    }


def _summarise(result: Any) -> str:
    if result is None:
        return "done"
    if isinstance(result, dict):
        return f"{len(result)} item(s)"
    text = str(result)
    return text[:200]
