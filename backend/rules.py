"""
DERZEN - Writing rules.

One saved profile that decides how everything DERZEN produces sounds: the
report, the email, the WhatsApp summary and the dashboard replies. The local AI
receives it as a preamble on every generative step, and a finished draft can be
run through it once more as a rewrite pass.

Rules live in Config/rules.json inside the sandbox, so a git pull never
overwrites them.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

import ai_manager
import config

RULES_FILE = "Config/rules.json"

DEFAULTS: Dict[str, Any] = {
    "enabled": True,
    "language": "English",
    "tone": "direct and calm, no hype",
    "audience": "a busy owner who skims first and reads second",
    "person": "third person",
    "length": "as short as the material allows",
    "sentence_style": "varied length, plain words, no filler openers",
    "must_include": "",
    "banned_words": "delve, leverage, robust, seamless, unlock, elevate, game changer, in today's fast paced world, it is important to note",
    "banned_punctuation": "em dash",
    "formatting": "headings in sentence case, short paragraphs, tables only when comparing things, no decorative emoji",
    "extra": "",
}

FIELDS = [
    {"key": "enabled", "label": "Apply these rules", "type": "checkbox"},
    {"key": "language", "label": "Language", "type": "text"},
    {"key": "tone", "label": "Tone", "type": "text"},
    {"key": "audience", "label": "Who is reading", "type": "text"},
    {"key": "person", "label": "Point of view", "type": "text"},
    {"key": "length", "label": "Length habit", "type": "text"},
    {"key": "sentence_style", "label": "Sentence style", "type": "text"},
    {"key": "must_include", "label": "Words or phrases to prefer", "type": "textarea"},
    {"key": "banned_words", "label": "Words and phrases to avoid", "type": "textarea"},
    {"key": "banned_punctuation", "label": "Punctuation to avoid", "type": "text"},
    {"key": "formatting", "label": "Formatting habits", "type": "textarea"},
    {"key": "extra", "label": "Anything else", "type": "textarea"},
]


def _path():
    target = config.ALLOWED_BASE / "Config"
    target.mkdir(parents=True, exist_ok=True)
    return target / "rules.json"


def load() -> Dict[str, Any]:
    """Current rules, with any missing key filled from the defaults."""
    merged = dict(DEFAULTS)
    path = _path()
    if path.exists():
        try:
            merged.update(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            pass
    return merged


def save(values: Dict[str, Any]) -> Dict[str, Any]:
    """Write the rules and return what was stored."""
    current = load()
    for key in DEFAULTS:
        if key in values:
            current[key] = values[key]
    _path().write_text(json.dumps(current, indent=2), encoding="utf-8")
    return current


def _lines(rules: Dict[str, Any]) -> List[str]:
    out = [
        f"Write in {rules['language']}.",
        f"Tone: {rules['tone']}.",
        f"Reader: {rules['audience']}.",
        f"Point of view: {rules['person']}.",
        f"Length: {rules['length']}.",
        f"Sentences: {rules['sentence_style']}.",
        f"Formatting: {rules['formatting']}.",
    ]
    if str(rules.get("banned_words", "")).strip():
        out.append(f"Never use these words or phrases: {rules['banned_words']}.")
    if str(rules.get("banned_punctuation", "")).strip():
        out.append(f"Never use this punctuation: {rules['banned_punctuation']}.")
    if str(rules.get("must_include", "")).strip():
        out.append(f"Prefer this vocabulary where it fits: {rules['must_include']}.")
    if str(rules.get("extra", "")).strip():
        out.append(str(rules["extra"]).strip())
    out.append("Do not open with a summary of the question. Start with the answer.")
    return out


def preamble(override: Dict[str, Any] | None = None) -> str:
    """The block of instructions prepended to a generative prompt."""
    rules = load()
    if override:
        rules.update(override)
    if not rules.get("enabled", True):
        return ""
    body = "\n".join(f"- {line}" for line in _lines(rules))
    return "House writing rules, follow all of them:\n" + body + "\n\n"


def wrap(prompt: str, use_rules: bool = True) -> str:
    """Prepend the rules to a prompt when the step asked for them."""
    if not use_rules:
        return prompt
    return preamble() + prompt


async def restyle(text: str) -> str:
    """Run a finished draft through the rules once more. Falls back to the draft."""
    if not text.strip() or not load().get("enabled", True):
        return text
    try:
        redone = await ai_manager.query(
            preamble()
            + "Rewrite the passage below so it follows every rule above. Keep all "
            + "facts, numbers and structure. Change only wording and rhythm. Return "
            + "the rewritten passage and nothing else.\n\n"
            + text
        )
        return redone.strip() or text
    except Exception:  # noqa: BLE001 - styling must never break a run
        return text
