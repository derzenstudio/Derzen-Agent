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
