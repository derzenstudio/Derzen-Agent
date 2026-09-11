"""
DERZEN - Report writing.

Takes whatever the earlier pipeline steps produced and turns it into a real
document: title, overview, the sections you asked for, optional tables, and an
optional appendix holding the raw material.

The local model does the writing. Because the target machine may only run a
tiny model, long material is condensed in chunks first and the final pass only
ever sees a digest. Every prompt goes through rules.wrap so the tone, wording
and formatting settings from the Settings page are respected.
"""
from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

import ai_manager
import config
import file_manager
import rules

DEFAULT_SECTIONS = ["Overview", "Key findings", "Detail", "Recommended next steps"]

CHUNK_CHARS = 5500
MAX_CHUNKS = 14
DIGEST_TARGET = 7000


def _coerce(value: Any) -> str:
    """Flatten any node result into readable text."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (list, tuple)):
        return "\n\n".join(_coerce(v) for v in value if v is not None)
    if isinstance(value, dict):
        parts = []
        for key, val in value.items():
            body = _coerce(val)
            if body:
                parts.append(f"## {key}\n{body}")
        return "\n\n".join(parts)
    return str(value)


def gather_material(sources: Sequence[Any]) -> str:
    """Join several upstream results into one material block."""
    chunks = [c for c in (_coerce(s) for s in sources) if c]
    return "\n\n-----\n\n".join(chunks)


def _split(text: str, size: int = CHUNK_CHARS) -> List[str]:
    """Split on paragraph boundaries, never mid sentence."""
    text = (text or "").strip()
    if len(text) <= size:
        return [text] if text else []
    paras = re.split(r"\n\s*\n", text)
    out: List[str] = []
    buf = ""
    for para in paras:
        if len(buf) + len(para) + 2 > size and buf:
            out.append(buf.strip())
            buf = ""
        if len(para) > size:
            for i in range(0, len(para), size):
                out.append(para[i : i + size])
            continue
        buf += para + "\n\n"
    if buf.strip():
        out.append(buf.strip())
    return out[:MAX_CHUNKS]


async def _condense(title: str, material: str) -> str:
    """
    Map step. Pull the facts out of each chunk so the writing pass gets a short,
    dense digest instead of a wall of scraped text.
    """
    chunks = _split(material)
    if len(chunks) <= 1:
        return material
    prompt = (
        "Pull every concrete fact out of the text below that relates to the "
        "topic. Keep numbers, names, dates, prices and direct claims exactly as "
        "written. Drop navigation text, adverts and repeated boilerplate. "
        "Answer with short lines only, no preamble.\n\n"
        "TOPIC: {title}\n\nTEXT:\n{chunk}"
    )

    async def one(chunk: str) -> str:
        try:
            out = await ai_manager.query(prompt.format(title=title or "the topic", chunk=chunk))
            return (out or "").strip()
        except Exception:
            return chunk[:900]

    limit = asyncio.Semaphore(2)

    async def guarded(chunk: str) -> str:
        async with limit:
            return await one(chunk)

    digested = await asyncio.gather(*[guarded(c) for c in chunks])
    joined = "\n".join(d for d in digested if d)
    return joined[:DIGEST_TARGET] if joined else material[:DIGEST_TARGET]


def _plan(sections: Optional[Sequence[str]]) -> List[str]:
    if not sections:
        return list(DEFAULT_SECTIONS)
    if isinstance(sections, str):
        parts = [s.strip() for s in re.split(r"[,;\n]", sections) if s.strip()]
        return parts or list(DEFAULT_SECTIONS)
    return [str(s).strip() for s in sections if str(s).strip()] or list(DEFAULT_SECTIONS)


def _build_prompt(
    title: str,
    digest: str,
    audience: str,
    sections: List[str],
    include_tables: bool,
) -> str:
    heads = "\n".join(f"## {s}" for s in sections)
    table_line = (
        "Where the material contains comparable items, figures or options, "
        "present them as a Markdown table with a header row.\n"
        if include_tables
        else "Do not use tables.\n"
    )
    return (
        f"Write a report titled '{title}'.\n"
        f"Reader: {audience or 'an internal team that needs to act on this'}.\n\n"
        "Use Markdown. Start with a single # line holding the title, then use "
        "exactly these second level headings in this order:\n"
        f"{heads}\n\n"
        f"{table_line}"
        "Write in full sentences under every heading. Use bullet points only "
        "for lists of separate items. Use only what the material says. If "
        "something is missing, write that it is missing rather than filling the "
        "gap. No closing sign off, no meta commentary about being an AI.\n\n"
        f"MATERIAL:\n{digest}"
    )


def _fallback(title: str, sections: List[str], material: str) -> str:
    lines = [ln.strip() for ln in material.splitlines() if ln.strip()]
    bullets = "\n".join(f"- {ln[:200]}" for ln in lines[:10]) or "- No material was collected."
    out = [f"# {title}", ""]
    for name in sections:
        out.append(f"## {name}")
        if name.lower().startswith(("key", "detail", "finding")):
            out.append(bullets)
        elif name.lower().startswith(("recommend", "next")):
            out.append("- Check the appendix and rerun the pipeline once the local model is reachable.")
        else:
            out.append(
                "The local model could not be reached, so the collected material "
                "is reproduced below without rewriting."
            )
        out.append("")
    return "\n".join(out)


async def summarise(text: str, limit_words: int = 120, use_rules: bool = True) -> str:
    """Short plain summary, used for WhatsApp and email bodies."""
    text = (text or "").strip()
    if not text:
        return ""
    prompt = (
        f"Summarise the report below in under {limit_words} words for a message "
        "someone reads on a phone. Plain sentences, no headings, no bullet "
        "points, no markdown.\n\n" + text[:6000]
    )
    try:
        out = await ai_manager.query(rules.wrap(prompt, use_rules))
        cleaned = rules.restyle((out or "").strip())
        if cleaned:
            return cleaned
    except Exception:
        pass
    plain = re.sub(r"[#*>\-]+", " ", text)
    plain = re.sub(r"\s+", " ", plain).strip()
    words = plain.split(" ")
    return " ".join(words[:limit_words]) + ("..." if len(words) > limit_words else "")


async def build(
    title: str = "",
    material: Any = "",
    audience: str = "",
    sections: Optional[Sequence[str]] = None,
    include_tables: bool = True,
    include_appendix: bool = False,
    use_rules: bool = True,
    filename: str = "",
    save: bool = True,
) -> Dict[str, Any]:
    """
    Build a report and return
    {"report", "summary", "document", "path", "filename", "title"}.

    report   - the finished Markdown document
    document - same text, kept as its own key so exporters can take it directly
    summary  - short phone friendly version for messages
    path     - saved Markdown copy inside Reports/ (empty when save is off)
    """
    title = (title or "").strip() or "DERZEN Report"
    raw = _coerce(material)
    plan = _plan(sections)

    if not raw:
        body = _fallback(title, plan, "")
    else:
        digest = await _condense(title, raw)
        prompt = rules.wrap(
            _build_prompt(title, digest, audience, plan, include_tables), use_rules
        )
        try:
            drafted = await ai_manager.query(prompt)
        except Exception:
            drafted = ""
        drafted = rules.restyle((drafted or "").strip())
        body = drafted if len(drafted) > 80 else _fallback(title, plan, raw)

    if not body.lstrip().startswith("#"):
        body = f"# {title}\n\n{body}"

    stamp = datetime.now().strftime("%d %B %Y, %H:%M")
    body = body.rstrip() + f"\n\nPrepared {stamp}\n"

    if include_appendix and raw:
        body += "\n## Appendix, source material\n\n" + raw.strip() + "\n"

    summary = await summarise(body, use_rules=use_rules)

    path = ""
    name = (filename or "").strip()
    if save:
        if not name:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "report"
            name = f"{slug}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
        if not name.lower().endswith(".md"):
            name += ".md"
        relative = f"{config.SUBDIRS.get('reports', 'Reports')}/{name}"
        try:
            path = str(file_manager.save_file(relative, body))
        except Exception:
            path = ""

    return {
        "title": title,
        "report": body,
        "document": body,
        "summary": summary,
        "path": path,
        "filename": name,
    }


# Kept so older saved pipelines that still call generate keep working.
async def generate(
    title: str,
    sources: Sequence[Any],
    filename: Optional[str] = None,
    include_appendix: bool = True,
) -> Dict[str, Any]:
    return await build(
        title=title,
        material=gather_material(sources),
        include_appendix=include_appendix,
        filename=filename or "",
    )
"""
DERZEN - Report generation.

Turns raw pipeline output (AI answers, scraped data, social analysis, etc.) into
a clean, human-readable summary report suitable for busy staff. Reports are
written into the sandboxed Reports/ subdirectory via file_manager, so they never
escape ALLOWED_BASE. When a local model is available the summary is drafted by
Ollama; otherwise a deterministic template is used so the node never fails.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import ai_manager
import config
import file_manager

_SUMMARY_PROMPT = (
    "You are a research assistant writing a concise executive summary for a "
    "busy team. Using ONLY the material below, produce a clear report with: a "
    "one-paragraph overview, 3-6 key findings as bullet points, and a short "
    "'Recommended next steps' section. Be factual and do not invent data.\n\n"
    "TOPIC: {title}\n\nMATERIAL:\n{material}\n"
)


def _coerce(value: Any) -> str:
    """Flatten any node result into readable text."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (list, tuple)):
        return "\n".join(_coerce(v) for v in value if v is not None)
    if isinstance(value, dict):
        return "\n".join(f"{k}: {_coerce(v)}" for k, v in value.items())
    return str(value)


def gather_material(sources: List[Any]) -> str:
    """Join multiple upstream results into one material block."""
    chunks = [c for c in (_coerce(s) for s in sources) if c]
    return "\n\n---\n\n".join(chunks)


async def build_summary(title: str, material: str) -> str:
    """Draft an executive summary with the local AI, falling back to a template."""
    material = (material or "").strip()
    if not material:
        material = "(No upstream data was provided to summarise.)"
    try:
        drafted = await ai_manager.query(
            _SUMMARY_PROMPT.format(title=title or "Research summary", material=material[:8000])
        )
        if drafted and drafted.strip():
            return drafted.strip()
    except Exception:
        pass
    # Deterministic fallback so a report is always produced.
    lines = [ln.strip() for ln in material.splitlines() if ln.strip()]
    bullets = "\n".join(f"- {ln}" for ln in lines[:6]) or "- No findings available."
    return (
        f"Overview\nAutomated summary for '{title or 'Research summary'}'. The "
        f"local AI was unavailable, so the raw findings are listed below.\n\n"
        f"Key findings\n{bullets}\n\n"
        f"Recommended next steps\n- Review the source material for detail.\n"
    )


def render_report(title: str, summary: str, material: str = "") -> str:
    """Wrap the summary in a titled, timestamped report document."""
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    header = f"# {title or 'DERZEN Research Report'}\n\nGenerated: {stamp}\n\n"
    body = summary.strip() + "\n"
    if material.strip():
        body += "\n\n## Appendix - source material\n\n" + material.strip() + "\n"
    return header + body


async def generate(
    title: str,
    sources: List[Any],
    filename: Optional[str] = None,
    include_appendix: bool = True,
) -> Dict[str, str]:
    """
    Build a report from upstream sources, save it into Reports/, and return a
    dict with the report text and the saved path. Used by the report_generate
    pipeline node.
    """
    material = gather_material(sources)
    summary = await build_summary(title, material)
    document = render_report(title, summary, material if include_appendix else "")

    reports_dir = config.SUBDIRS.get("reports", "Reports")
    safe_name = (filename or "").strip()
    if not safe_name:
        slug = "".join(c if c.isalnum() else "-" for c in (title or "report")).strip("-")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        safe_name = f"{(slug or 'report').lower()}-{stamp}.md"
    relative = f"{reports_dir}/{safe_name}"
    path = file_manager.save_file(relative, document)
    return {"summary": summary, "report": document, "path": str(path), "filename": safe_name}
