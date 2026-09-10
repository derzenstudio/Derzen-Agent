"""
DERZEN - Pipeline execution engine.

Runs a pipeline as a graph, not as a straight line. Several steps can run at
the same moment, and a step that several arrows point into waits for all of
them and receives every result in order. That is what makes "read one site and
ask three online services, then combine the four answers" behave the way it
looks on the canvas.

Data flow is automatic. A step is handed whatever feeds it, so you only write
{{...}} when you want something specific. The names that always exist:

    {{prev}}        everything feeding this step, joined
    {{inputs.0}}    the first feeding step, {{inputs.1}} the second, and so on
    {{topic}}       the topic typed into START
    {{summary}}     short version of the newest report
    {{report}}      full text of the newest report
    {{report_path}} where that report was written
    {{file_path}}   the newest saved file
    {{drive_link}}  the newest Drive link
    {{transcript}}  the newest online AI conversation
    {{any_step_id}} the result of that step

A run never dies on the first error. A failed step is recorded, its branch
stops, and the rest of the graph carries on where it can.
"""
from __future__ import annotations

import asyncio
import inspect
import re
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

import ai_manager
import nodes as catalog
import rules
import runtime
import storage

_VAR = re.compile(r"{{\s*([\w.\-]+)\s*}}")
MAX_STEPS = 400


# ── Values ───────────────────────────────────────────────────────────────────
def as_text(value: Any) -> str:
    """Flatten any step result into readable text."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple)):
        return "\n\n".join(as_text(v) for v in value if v is not None)
    if isinstance(value, dict):
        parts = []
        for key, item in value.items():
            body = as_text(item)
            if body:
                parts.append(f"{key}:\n{body}")
        return "\n\n".join(parts)
    return str(value)


def substitute(value: Any, context: Dict[str, Any]) -> Any:
    if not isinstance(value, str) or "{{" not in value:
        return value
    return _VAR.sub(lambda m: as_text(_lookup(context, m.group(1))), value)


def _lookup(context: Dict[str, Any], name: str) -> Any:
    if name in context:
        return context[name]
    if "." in name:
        head, tail = name.split(".", 1)
        holder = context.get(head)
        if isinstance(holder, (list, tuple)) and tail.isdigit():
            index = int(tail)
            return holder[index] if index < len(holder) else ""
        if isinstance(holder, dict):
            return holder.get(tail, "")
    return ""


def _flag(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None or value == "":
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _int(value: Any, default: int) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _chunks(text: str, size: int) -> List[str]:
    size = max(500, size)
    if len(text) <= size:
        return [text] if text else []
    out: List[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        cut = text.rfind("\n", start + int(size * 0.6), end)
        if cut == -1 or end == len(text):
            cut = end
        out.append(text[start:cut])
        start = cut
    return [c for c in out if c.strip()]


# ── Graph ────────────────────────────────────────────────────────────────────
Edge = Tuple[str, str, str]


def _build(pipeline: dict) -> Tuple[List[dict], Dict[str, dict], List[Edge]]:
    raw = pipeline.get("nodes", []) or []
    prepared = [catalog.with_defaults(n) for n in raw if n.get("id")]
    by_id = {n["id"]: n for n in prepared}
    edges: List[Edge] = []
    for node in prepared:
        for port, target in (node.get("connections") or {}).items():
            if target and target in by_id:
                edges.append((node["id"], port, target))
    return prepared, by_id, edges


def validate(pipeline: dict) -> List[str]:
    """Problems worth blocking a save for. Empty list means the graph is sound."""
    prepared, by_id, edges = _build(pipeline)
    problems: List[str] = []
    starts = [n for n in prepared if n["type"] == "start"]
    if len(starts) != 1:
        problems.append(f"A pipeline needs exactly one START step, this one has {len(starts)}.")
    if not any(n["type"] == "end" for n in prepared):
        problems.append("There is no FINISH step.")
    for node in prepared:
        if node["type"] not in catalog.VALID_TYPES:
            problems.append(f"Step {node['id']} has an unknown type '{node['type']}'.")
    reachable = {n["id"] for n in starts}
    changed = True
    while changed:
        changed = False
        for src, _port, dst in edges:
            if src in reachable and dst not in reachable:
                reachable.add(dst)
                changed = True
    for node in prepared:
        if node["id"] not in reachable:
            problems.append(f"Step {node['id']} is not connected to START, it will never run.")
    for node in prepared:
        if node["type"] == "branch":
            ports = {p for p, t in (node.get("connections") or {}).items() if t}
            if not {"true", "false"} <= ports:
                problems.append(f"Decision step {node['id']} needs both a YES and a NO arrow.")
    return problems


# ── Step handlers ────────────────────────────────────────────────────────────
async def _handle(node: dict, cfg: dict, inputs: List[Any], context: Dict[str, Any]) -> Any:
    ntype = node["type"]
    material = "\n\n".join(t for t in (as_text(i) for i in inputs) if t)

    if ntype == "start":
        topic = str(cfg.get("topic", "")).strip()
        if topic:
            context["topic"] = topic
        return topic

    if ntype == "end":
        return material

    if ntype == "wait":
        await asyncio.sleep(max(0.0, float(_int(cfg.get("seconds"), 0))))
        return material

    if ntype == "branch":
        return _condition(str(cfg.get("condition", "")), material, context)

    if ntype == "merge":
        return _merge(node, inputs, cfg, context)

    if ntype == "web_scrape":
        import automation

        urls = [u.strip() for u in str(cfg.get("urls", "")).splitlines() if u.strip()]
        if not urls:
            urls = re.findall(r"https?://\S+", material)[:10]
        if not urls:
            raise ValueError("No addresses to read. Type them in, or feed this step a list.")
        return await automation.browser.scrape(
            urls,
            max_chars=_int(cfg.get("max_chars"), 20000),
            follow_links=_flag(cfg.get("follow_links")),
        )

    if ntype == "social_analyze":
        import social

        return await social.analyze(
            str(cfg.get("platform", "twitter")),
            str(cfg.get("query", "")).strip() or str(context.get("topic", "")),
            _int(cfg.get("post_count"), 15),
            _flag(cfg.get("analyze_sentiment"), True),
        )

    if ntype == "ai_query":
        prompt = _compose(cfg, material, "Read the material and pull out what matters.")
        answer = await ai_manager.query(
            rules.wrap(prompt, _flag(cfg.get("use_rules"), True)),
            str(cfg.get("model", "")).strip() or None,
        )
        context["ai_answer"] = answer
        return answer

    if ntype == "ai_browser":
        from webai import driver

        prompt = _compose(cfg, material, "Read the material and give a structured answer.")
        answer = await driver.ask(
            str(cfg.get("provider", "chatgpt")),
            prompt,
            _int(cfg.get("wait_seconds"), 180),
            new_chat=_flag(cfg.get("new_chat"), True),
        )
        context["online_answer"] = answer
        return answer

    if ntype == "ai_fanout":
        from webai import driver

        raw = cfg.get("providers", "")
        picks = raw if isinstance(raw, list) else str(raw).replace("\n", ",").split(",")
        prompt = _compose(cfg, material, "Read the material and give a structured answer.")
        answers = await driver.ask_many(picks, prompt, _int(cfg.get("wait_seconds"), 180))
        context["online_answers"] = answers
        return answers

    if ntype == "ai_converse":
        return await _converse(cfg, material, context)

    if ntype == "chunk_map":
        return await _chunk_map(cfg, material)

    if ntype == "report_build":
        import report

        built = await report.build(
            title=str(cfg.get("title", "")).strip() or str(context.get("topic", "")) or "Research report",
            material=material,
            audience=str(cfg.get("audience", "")),
            sections=[s.strip() for s in str(cfg.get("sections", "")).splitlines() if s.strip()],
            include_tables=_flag(cfg.get("include_tables"), True),
            include_appendix=_flag(cfg.get("include_appendix"), False),
            use_rules=_flag(cfg.get("use_rules"), True),
        )
        context["report"] = built["report"]
        context["summary"] = built["summary"]
        context["document"] = built["document"]
        return built

    if ntype == "file_export":
        from exporters import document as exporter

        body = str(cfg.get("content", "")).strip() or material or as_text(context.get("report", ""))
        saved = exporter.export(
            body=body,
            structured=context.get("document"),
            filename=str(cfg.get("filename", "")).strip() or "derzen-output",
            fmt=str(cfg.get("format", "md")),
            folder=str(cfg.get("folder", "Reports")),
            title=str(cfg.get("title", "")).strip() or str(context.get("topic", "")) or "DERZEN output",
        )
        context["file_path"] = saved["path"]
        context["file_name"] = saved["name"]
        return saved

    if ntype == "sheets_write":
        return await _sheet(cfg, material, context)

    if ntype == "drive_upload":
        import drive

        path = str(cfg.get("path", "")).strip() or str(context.get("file_path", "")) or str(context.get("report_path", ""))
        if not path:
            raise ValueError("Nothing has been saved yet, so there is nothing to upload.")
        result = await drive.upload_auto(
            path,
            method=str(cfg.get("method", "auto")),
            folder_id=str(cfg.get("folder_id", "")).strip() or None,
            name=str(cfg.get("name", "")).strip() or None,
        )
        context["drive_link"] = result.get("link", "")
        return result

    if ntype == "email_send":
        import email_listener

        body = str(cfg.get("body", "")).strip() or material or as_text(context.get("summary", ""))
        return await email_listener.send(
            to=str(cfg.get("to", "")),
            subject=str(cfg.get("subject", "")).strip() or str(context.get("topic", "")) or "DERZEN report",
            body=body,
            method=str(cfg.get("method", "auto")),
            attachment=str(context.get("file_path", "")) if _flag(cfg.get("attach")) else "",
        )

    if ntype == "whatsapp_send":
        import whatsapp_listener

        message = str(cfg.get("message", "")).strip() or material or as_text(context.get("summary", ""))
        return await whatsapp_listener.send(
            mode=str(cfg.get("mode", "chat_list")),
            contact=str(cfg.get("contact", "")),
            phone=str(cfg.get("phone", "")),
            message=message,
            open_only=_flag(cfg.get("open_only")),
        )

    raise ValueError(f"Unknown step type: {ntype}")


def _compose(cfg: dict, material: str, fallback: str) -> str:
    """Build the prompt, attaching upstream material unless the step said not to."""
    prompt = str(cfg.get("prompt", "")).strip() or fallback
    if _flag(cfg.get("include_inputs"), True) and material:
        prompt += "\n\nMATERIAL FROM EARLIER STEPS\n" + material
    return prompt


def _merge(node: dict, inputs: List[Any], cfg: dict, context: Dict[str, Any]) -> str:
    separator = str(cfg.get("separator", "\n\n----\n\n")).replace("\\n", "\n")
    sources = context.get("_sources", {}).get(node["id"], [])
    blocks: List[str] = []
    for index, value in enumerate(inputs):
        body = as_text(value)
        if not body:
            continue
        if _flag(cfg.get("labelled"), True):
            name = sources[index] if index < len(sources) else f"source {index + 1}"
            blocks.append(f"From {name}:\n{body}")
        else:
            blocks.append(body)
    return separator.join(blocks)


def _condition(raw: str, material: str, context: Dict[str, Any]) -> bool:
    expr = substitute(raw, context).strip()
    if not expr:
        return bool(material.strip())
    low = expr.lower()
    if " contains " in low:
        left, right = expr.split(" contains ", 1) if " contains " in expr else low.split(" contains ", 1)
        return right.strip().strip('"').strip("'").lower() in left.lower()
    for op in ("!=", "==", ">=", "<=", ">", "<"):
        if op in expr:
            left, right = (s.strip().strip('"').strip("'") for s in expr.split(op, 1))
            try:
                left_v: Any = float(left)
                right_v: Any = float(right)
            except ValueError:
                left_v, right_v = left, right
            return {
                "!=": left_v != right_v,
                "==": left_v == right_v,
                ">=": left_v >= right_v,
                "<=": left_v <= right_v,
                ">": left_v > right_v,
                "<": left_v < right_v,
            }[op]
    return bool(expr) and low not in {"false", "0", "no", "none"}


async def _local(prompt: str) -> str:
    """Local AI call that degrades to an empty string instead of exploding."""
    try:
        return (await ai_manager.query(rules.wrap(prompt))).strip()
    except Exception:  # noqa: BLE001
        return ""


async def _converse(cfg: dict, material: str, context: Dict[str, Any]) -> str:
    """Local AI holds a real back and forth with an online service until done."""
    from webai import driver

    objective = str(cfg.get("objective", "")).strip() or (
        "Every part of the material is covered, facts are separated from opinion, "
        "and nothing is left vague."
    )
    max_turns = max(1, _int(cfg.get("max_turns"), 8))
    wait_seconds = _int(cfg.get("wait_seconds"), 180)
    pieces = _chunks(material, _int(cfg.get("chunk_chars"), 6000)) or [""]
    total = len(pieces)

    conversation = await driver.open_conversation(str(cfg.get("provider", "chatgpt")), new_chat=True)

    opening = str(cfg.get("opening", "")).strip()
    if not opening:
        opening = await _local(
            "You are briefing another AI that will do the heavy analysis. Write the "
            "opening message only, no preamble about yourself. Say what the goal is, "
            "what shape the answer should take, and that material arrives in "
            f"{total} parts. Goal: {objective}"
        )
    if not opening:
        opening = (
            f"I will send material in {total} parts. After each part, pull out the "
            f"facts, figures and claims worth keeping. Goal: {objective}"
        )

    first = opening
    if pieces[0]:
        first += f"\n\nPART 1 OF {total}\n{pieces[0]}"
    reply = await conversation.ask(first, wait_seconds)

    queue = list(pieces[1:])
    turn = 1
    while turn < max_turns:
        runtime.check_not_stopped()
        turn += 1
        if queue:
            piece = queue.pop(0)
            index = total - len(queue)
            follow = await _local(
                "Write the next short message to the analysing AI. React to what it "
                "just said, correct it if it drifted, then tell it what to do with the "
                f"next part. Two or three sentences, no greeting.\n\nGoal: {objective}"
                f"\n\nIts last reply:\n{reply[:3000]}"
            )
            follow = follow or "Keep the same treatment for the next part."
            message = f"{follow}\n\nPART {index} OF {total}\n{piece}"
        else:
            decision = await _local(
                "Decide whether the goal below has been met by the conversation so "
                "far. If it has, reply with the single word DONE. If it has not, reply "
                "with the next message to send, and nothing else.\n\n"
                f"Goal: {objective}\n\nLast reply:\n{reply[:4000]}"
            )
            if not decision or decision.upper().startswith("DONE"):
                break
            message = decision
        reply = await conversation.ask(message, wait_seconds)

    transcript = conversation.transcript()
    context["transcript"] = transcript
    return transcript


async def _chunk_map(cfg: dict, material: str) -> str:
    """Same instruction over every piece of oversized material, then stitched."""
    pieces = _chunks(material, _int(cfg.get("chunk_chars"), 6000))
    if not pieces:
        return ""
    instruction = str(cfg.get("prompt", "")).strip() or (
        "Condense this piece. Keep every fact, figure and name. Drop repetition."
    )
    engine = str(cfg.get("engine", "local")).lower()
    provider = str(cfg.get("provider", "chatgpt"))
    wait_seconds = _int(cfg.get("wait_seconds"), 180)
    out: List[str] = []
    for index, piece in enumerate(pieces, start=1):
        runtime.check_not_stopped()
        prompt = f"{instruction}\n\nPIECE {index} OF {len(pieces)}\n{piece}"
        if engine == "online":
            from webai import driver

            answer = await driver.ask(provider, prompt, wait_seconds, new_chat=(index == 1))
        else:
            answer = await ai_manager.query(rules.wrap(prompt))
        out.append(f"Piece {index}\n{answer.strip()}")
    return "\n\n".join(out)


async def _sheet(cfg: dict, material: str, context: Dict[str, Any]) -> dict:
    """Build a readable spreadsheet, locally or on Drive."""
    from exporters import document as exporter

    body = str(cfg.get("content", "")).strip() or material
    rows = await exporter.rows_from_text(body)
    saved = exporter.save_sheet(
        filename=str(cfg.get("filename", "")).strip() or "derzen-sheet",
        rows=rows,
        folder="Reports",
        title=str(context.get("topic", "")) or "DERZEN data",
    )
    context["file_path"] = saved["path"]
    if str(cfg.get("target", "local")).lower() == "drive":
        import drive

        result = await drive.upload_auto(
            saved["path"],
            method="auto",
            folder_id=str(cfg.get("folder_id", "")).strip() or None,
            name=None,
            as_google_doc=True,
        )
        saved["link"] = result.get("link", "")
        context["drive_link"] = saved["link"]
    return saved


# ── Scheduler ────────────────────────────────────────────────────────────────
async def _emit(callback: Optional[Callable], payload: dict) -> None:
    if callback is None:
        return
    try:
        outcome = callback(payload)
        if inspect.isawaitable(outcome):
            await outcome
    except Exception:  # noqa: BLE001 - progress reporting must never break a run
        pass


def _entry(started: float, node: dict, status: str, detail: str) -> dict:
    return {
        "id": node["id"],
        "time": datetime.now().strftime("%H:%M:%S"),
        "step": catalog.BY_TYPE.get(node["type"], {}).get("label", node["type"]),
        "type": node["type"],
        "status": status,
        "duration": f"{time.time() - started:.1f}s",
        "details": detail[:400],
    }


async def run_pipeline(pipeline: dict, on_event: Optional[Callable] = None) -> dict:
    """Execute a pipeline graph and return a structured run report."""
    prepared, by_id, edges = _build(pipeline)
    if not prepared:
        raise ValueError("This pipeline has no steps.")
    start_nodes = [n for n in prepared if n["type"] == "start"]
    if not start_nodes:
        raise ValueError("This pipeline has no START step.")

    order = {node["id"]: i for i, node in enumerate(prepared)}
    incoming: Dict[str, List[Edge]] = {n["id"]: [] for n in prepared}
    outgoing: Dict[str, List[Edge]] = {n["id"]: [] for n in prepared}
    for edge in edges:
        outgoing[edge[0]].append(edge)
        incoming[edge[2]].append(edge)

    state: Dict[Edge, str] = {edge: "pending" for edge in edges}
    results: Dict[str, Any] = {}
    done: set = set()
    context: Dict[str, Any] = {"_sources": {}}
    log: List[dict] = []
    began = time.time()
    executed = 0
    failed = False

    def resolved(node_id: str) -> bool:
        return all(state[e] != "pending" for e in incoming[node_id])

    def live_inputs(node_id: str) -> List[Edge]:
        return [e for e in incoming[node_id] if state[e] == "live"]

    def kill(node_id: str) -> None:
        for edge in outgoing[node_id]:
            if state[edge] == "pending":
                state[edge] = "dead"

    async def execute(node: dict) -> None:
        nonlocal executed, failed
        node_id = node["id"]
        feeds = sorted(live_inputs(node_id), key=lambda e: order.get(e[0], 0))
        inputs = [results.get(e[0]) for e in feeds]
        context["_sources"][node_id] = [
            catalog.BY_TYPE.get(by_id[e[0]]["type"], {}).get("label", e[0]) for e in feeds
        ]
        context["inputs"] = inputs
        context["prev"] = "\n\n".join(t for t in (as_text(i) for i in inputs) if t)
        cfg = {k: substitute(v, context) for k, v in (node.get("config") or {}).items()}

        started = time.time()
        await _emit(on_event, {"event": "step_start", "id": node_id, "type": node["type"]})
        try:
            runtime.check_not_stopped()
            value = await _handle(node, cfg, inputs, context)
            results[node_id] = value
            context[node_id] = value
            detail = as_text(value)[:400] or "done"
            log.append(_entry(started, node, "success", detail))
            chosen = None
            if node["type"] == "branch":
                chosen = "true" if value else "false"
            for edge in outgoing[node_id]:
                state[edge] = "live" if (chosen is None or edge[1] == chosen) else "dead"
        except runtime.EmergencyStopped:
            failed = True
            log.append(_entry(started, node, "error", "Emergency stop engaged."))
            kill(node_id)
        except Exception as exc:  # noqa: BLE001 - one bad step must not end the run
            failed = True
            results[node_id] = f"[{node['type']} failed: {exc}]"
            log.append(_entry(started, node, "error", str(exc)))
            kill(node_id)
        finally:
            done.add(node_id)
            executed += 1
            await _emit(
                on_event,
                {"event": "step_end", "id": node_id, "status": log[-1]["status"] if log else "success"},
            )

    for node in start_nodes:
        for edge in incoming[node["id"]]:
            state[edge] = "dead"

    while executed < MAX_STEPS:
        if runtime.is_engaged():
            break
        for node in prepared:
            if node["id"] in done or not resolved(node["id"]):
                continue
            if incoming[node["id"]] and not live_inputs(node["id"]):
                done.add(node["id"])
                log.append(_entry(time.time(), node, "skipped", "no live path reached this step"))
                kill(node["id"])
        ready = [
            node
            for node in prepared
            if node["id"] not in done and resolved(node["id"]) and (live_inputs(node["id"]) or node["type"] == "start")
        ]
        if not ready:
            break
        await asyncio.gather(*(execute(node) for node in ready))

    total = round(time.time() - began, 1)
    status = "error" if failed else "success"
    report = {
        "pipeline": pipeline.get("name", "Untitled"),
        "pipeline_id": pipeline.get("id", ""),
        "started": datetime.fromtimestamp(began).isoformat(timespec="seconds"),
        "total_seconds": total,
        "steps": len([e for e in log if e["status"] != "skipped"]),
        "status": status,
        "log": log,
        "summary": as_text(context.get("summary", "")),
        "report": as_text(context.get("report", "")),
        "file_path": str(context.get("file_path", "")),
        "drive_link": str(context.get("drive_link", "")),
        "outputs": {k: as_text(v)[:4000] for k, v in results.items()},
    }
    try:
        storage.save_run(report)
    except Exception:  # noqa: BLE001 - history is nice to have, not essential
        pass
    await _emit(on_event, {"event": "run_end", "status": status})
    return report
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
    if ntype == "report_generate":
        import report

        # Sources: comma/newline separated node ids or friendly keys. If none
        # are given, summarise every result produced so far.
        raw_sources = str(cfg.get("sources", "")).replace(",", "\n")
        keys = [k.strip() for k in raw_sources.splitlines() if k.strip()]
        if keys:
            material = [context.get(k) for k in keys]
        else:
            material = [v for k, v in context.items() if not k.endswith("_report")]
        result = await report.generate(
            str(cfg.get("title", "Research report")),
            material,
            str(cfg.get("filename", "")).strip() or None,
            str(cfg.get("include_appendix", "true")).strip().lower() not in ("false", "0", "no", "off"),
        )
        context["report_text"] = result.get("report", "")
        context["report_summary"] = result.get("summary", "")
        context["report_path"] = result.get("path", "")
        return result
    if ntype == "drive_upload":
        import drive

        # Upload a sandboxed file to Google Drive. Defaults to the most recent
        # report if no explicit path is provided.
        rel = str(cfg.get("path", "")).strip() or str(context.get("report_path", "")).strip()
        if not rel:
            raise ValueError("drive_upload: no file path to upload.")
        result = drive.upload(
            rel,
            str(cfg.get("folder_id", "")).strip() or None,
            str(cfg.get("name", "")).strip() or None,
        )
        context["drive_link"] = result.get("link", "")
        context["drive_file_id"] = result.get("id", "")
        return result
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
            elif current.get("type") == "report_generate" and isinstance(result, dict):
                context["report"] = result.get("report", "")
                context["summary"] = result.get("summary", "")
            elif current.get("type") == "drive_upload" and isinstance(result, dict):
                context["uploaded_link"] = result.get("link", "")
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
