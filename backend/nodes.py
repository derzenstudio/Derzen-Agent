# test line 1
# test line 2
"""
DERZEN - Node catalog.

Single source of truth for every pipeline step. The executor validates against
this file and the frontend builds its palette and property panel from the
/api/nodes endpoint, so the builder and the runner can no longer drift apart.

Each entry declares:
    type     stable identifier written into saved pipelines
    label    text shown in the builder
    group    palette section
    summary  plain language description
    inputs   "none" | "one" | "many"  (how many upstream steps may feed it)
    outputs  port names this step can connect from
    fields   configuration inputs rendered by the property panel
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from webai.registry import provider_choices


def _f(
    key: str,
    label: str,
    ftype: str = "text",
    default: Any = "",
    placeholder: str = "",
    help_text: str = "",
    options: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "type": ftype,
        "default": default,
        "placeholder": placeholder,
        "help": help_text,
        "options": options or [],
    }


def _opts(pairs) -> List[Dict[str, str]]:
    return [{"value": v, "label": l} for v, l in pairs]


FORMAT_OPTIONS = _opts(
    [
        ("md", "Markdown (.md)"),
        ("txt", "Plain text (.txt)"),
        ("html", "Web page (.html)"),
        ("css", "Stylesheet (.css)"),
        ("js", "Script (.js)"),
        ("pdf", "PDF document (.pdf)"),
        ("docx", "Word document (.docx)"),
        ("xlsx", "Spreadsheet (.xlsx)"),
        ("csv", "Comma separated (.csv)"),
        ("json", "Structured data (.json)"),
    ]
)

PLATFORM_OPTIONS = _opts(
    [
        ("twitter", "Twitter / X"),
        ("instagram", "Instagram"),
        ("linkedin", "LinkedIn"),
        ("facebook", "Facebook"),
        ("reddit", "Reddit"),
        ("youtube", "YouTube"),
    ]
)

WHATSAPP_MODES = _opts(
    [
        ("chat_list", "Open the chat by contact name in the WhatsApp tab"),
        ("wa_me", "Open a wa.me link with the text already filled in"),
        ("number", "Open the chat by phone number in the WhatsApp tab"),
    ]
)


def _catalog() -> List[Dict[str, Any]]:
    providers = provider_choices()
    return [
        {
            "type": "start",
            "label": "START",
            "group": "Flow",
            "summary": "Where the pipeline begins. Every pipeline needs exactly one.",
            "inputs": "none",
            "outputs": ["next"],
            "fields": [
                _f("topic", "Topic or subject (optional)", "text", "", "kopi specialty di Bandung",
                   "Available to every later step as {{topic}}."),
            ],
        },
        {
            "type": "end",
            "label": "FINISH",
            "group": "Flow",
            "summary": "Where the pipeline stops.",
            "inputs": "many",
            "outputs": [],
            "fields": [],
        },
        {
            "type": "wait",
            "label": "WAIT",
            "group": "Flow",
            "summary": "Pause before the next step runs.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [_f("seconds", "Seconds to wait", "number", 5, "5")],
        },
        {
            "type": "branch",
            "label": "DECIDE",
            "group": "Flow",
            "summary": "Send the run down the YES path or the NO path.",
            "inputs": "many",
            "outputs": ["true", "false"],
            "fields": [
                _f("condition", "Go YES when this is true", "text", "", '{{prev}} contains "risk"',
                   'Supports contains, ==, !=, >, <, and plain truthiness.'),
            ],
        },
        {
            "type": "merge",
            "label": "COMBINE RESULTS",
            "group": "Flow",
            "summary": "Join everything from the steps feeding into it. Use this after parallel steps.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("labelled", "Label each source", "checkbox", True, "",
                   "Writes the step name above each block so later steps know where text came from."),
                _f("separator", "Text between blocks", "text", "\n\n----\n\n"),
            ],
        },
        {
            "type": "web_scrape",
            "label": "READ WEBSITES",
            "group": "Gather",
            "summary": "Open pages in the automation browser and take their text.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("urls", "Addresses, one per line", "textarea", "",
                   "https://news.ycombinator.com\nhttps://techcrunch.com"),
                _f("max_chars", "Characters to keep per page", "number", 20000, "20000"),
                _f("follow_links", "Also read links found on the page", "checkbox", False),
            ],
        },
        {
            "type": "social_analyze",
            "label": "READ SOCIAL MEDIA",
            "group": "Gather",
            "summary": "Search a platform and summarise what people are saying.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("platform", "Platform", "select", "twitter", options=PLATFORM_OPTIONS),
                _f("query", "Search for", "text", "", "specialty coffee jakarta"),
                _f("post_count", "Posts to consider", "number", 15, "15"),
                _f("analyze_sentiment", "Summarise sentiment", "checkbox", True),
            ],
        },
        {
            "type": "ai_query",
            "label": "ASK LOCAL AI",
            "group": "Think",
            "summary": "Ask Ollama on this machine. Upstream results are attached automatically.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("prompt", "Instruction", "textarea", "",
                   "Pull out the ten most useful facts and drop anything repeated."),
                _f("model", "Model (blank uses the default)", "text", "", "tinyllama"),
                _f("include_inputs", "Attach results from earlier steps", "checkbox", True),
                _f("use_rules", "Apply the writing rules", "checkbox", True),
            ],
        },
        {
            "type": "ai_browser",
            "label": "ASK ONLINE AI",
            "group": "Think",
            "summary": "Type into a logged in AI website, wait for the real answer, take it.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("provider", "Service", "select", "chatgpt", options=providers),
                _f("prompt", "What to ask", "textarea", "", "Read the material below and rank it by impact."),
                _f("include_inputs", "Attach results from earlier steps", "checkbox", True),
                _f("new_chat", "Start a fresh conversation", "checkbox", True),
                _f("wait_seconds", "Give up after this many seconds", "number", 180, "180",
                   "This is a ceiling, not a fixed pause. The step returns as soon as the answer stops growing."),
            ],
        },
        {
            "type": "ai_fanout",
            "label": "ASK SEVERAL ONLINE AI",
            "group": "Think",
            "summary": "Send one prompt to several services at the same time and keep every answer.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("providers", "Services", "multiselect", "chatgpt,gemini,claude", options=providers),
                _f("prompt", "What to ask", "textarea", ""),
                _f("include_inputs", "Attach results from earlier steps", "checkbox", True),
                _f("wait_seconds", "Give up after this many seconds", "number", 180, "180"),
            ],
        },
        {
            "type": "ai_converse",
            "label": "WORK IT OUT WITH ONLINE AI",
            "group": "Think",
            "summary": "The local AI keeps replying to the online AI until the job is finished, then hands over the whole transcript.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("provider", "Service", "select", "chatgpt", options=providers),
                _f("objective", "What has to be true before it stops", "textarea", "",
                   "Every source is covered, numbers are separated from opinion, nothing is left vague."),
                _f("opening", "First message (blank lets the local AI write it)", "textarea", ""),
                _f("max_turns", "Most rounds allowed", "number", 8, "8"),
                _f("chunk_chars", "Characters of material per round", "number", 6000, "6000"),
                _f("wait_seconds", "Give up on one reply after this many seconds", "number", 180, "180"),
            ],
        },
        {
            "type": "chunk_map",
            "label": "PROCESS IN PIECES",
            "group": "Think",
            "summary": "Cut oversized material into pieces, run the same instruction on each, then stitch it back.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("prompt", "Instruction for every piece", "textarea", ""),
                _f("chunk_chars", "Characters per piece", "number", 6000, "6000"),
                _f("engine", "Run each piece with", "select", "local",
                   options=_opts([("local", "Local AI"), ("online", "Online AI")])),
                _f("provider", "Service when using online AI", "select", "chatgpt", options=providers),
                _f("wait_seconds", "Give up after this many seconds", "number", 180, "180"),
            ],
        },
        {
            "type": "report_build",
            "label": "WRITE THE REPORT",
            "group": "Produce",
            "summary": "Turn everything gathered so far into a structured document with headings, findings and tables.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("title", "Report title", "text", "", "Weekly research"),
                _f("audience", "Who reads it", "text", "", "owner and two managers"),
                _f("sections", "Sections, one per line (blank picks sensible ones)", "textarea", ""),
                _f("include_tables", "Ask for a comparison table", "checkbox", True),
                _f("include_appendix", "Keep the raw material at the end", "checkbox", False),
                _f("use_rules", "Apply the writing rules", "checkbox", True),
            ],
        },
        {
            "type": "file_export",
            "label": "SAVE A FILE",
            "group": "Produce",
            "summary": "Write the result to disk in the format you pick. Styling is applied per format.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("filename", "File name without extension", "text", "", "weekly-research"),
                _f("format", "Format", "select", "pdf", options=FORMAT_OPTIONS),
                _f("folder", "Folder inside the sandbox", "text", "Reports", "Reports"),
                _f("title", "Document title", "text", ""),
                _f("content", "What to save (blank uses the previous step)", "textarea", "", "{{prev}}"),
            ],
        },
        {
            "type": "sheets_write",
            "label": "MAKE A SPREADSHEET",
            "group": "Produce",
            "summary": "Build a formatted sheet locally, or push it into Google Sheets through the open Chrome tab.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("filename", "File name without extension", "text", "", "weekly-figures"),
                _f("target", "Where", "select", "local",
                   options=_opts([("local", "Save an .xlsx here"), ("drive", "Upload to Drive as a Sheet")])),
                _f("content", "Table source (blank uses the previous step)", "textarea", ""),
                _f("folder_id", "Drive folder id (optional)", "text", ""),
            ],
        },
        {
            "type": "drive_upload",
            "label": "PUT IT ON DRIVE",
            "group": "Deliver",
            "summary": "Upload a saved file and get a link back for the summary message.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("path", "File to upload (blank uses the newest one)", "text", ""),
                _f("method", "How", "select", "auto",
                   options=_opts([("auto", "API if configured, otherwise the Chrome tab"),
                                  ("api", "Google API"),
                                  ("chrome", "The open Chrome tab")])),
                _f("folder_id", "Drive folder id (optional)", "text", ""),
                _f("name", "Name on Drive (optional)", "text", ""),
            ],
        },
        {
            "type": "email_send",
            "label": "SEND AN EMAIL",
            "group": "Deliver",
            "summary": "Send through the open Gmail tab or through SMTP.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("method", "How", "select", "auto",
                   options=_opts([("auto", "Gmail tab if open, otherwise SMTP"),
                                  ("gmail", "The open Gmail tab"),
                                  ("smtp", "SMTP")])),
                _f("to", "To", "text", "", "someone@company.com"),
                _f("subject", "Subject", "text", ""),
                _f("body", "Message (blank uses the previous step)", "textarea", "",
                   "{{summary}}\n\nFull report: {{drive_link}}"),
                _f("attach", "Attach the saved file", "checkbox", False),
            ],
        },
        {
            "type": "whatsapp_send",
            "label": "SEND A WHATSAPP",
            "group": "Deliver",
            "summary": "Message a whitelisted contact from the WhatsApp tab, or hand you a wa.me link with the text ready.",
            "inputs": "many",
            "outputs": ["next"],
            "fields": [
                _f("mode", "How", "select", "chat_list", options=WHATSAPP_MODES),
                _f("contact", "Contact name as it appears in the chat list", "text", "", "Boss"),
                _f("phone", "Phone number in international form", "text", "", "628123456789"),
                _f("message", "Message (blank uses the previous step)", "textarea", "",
                   "{{summary}}\n\nReport: {{drive_link}}"),
                _f("open_only", "Only open the link, do not press send", "checkbox", False,
                   help_text="Useful with wa.me when you want to read it before it goes out."),
            ],
        },
    ]


CATALOG: List[Dict[str, Any]] = _catalog()
BY_TYPE: Dict[str, Dict[str, Any]] = {n["type"]: n for n in CATALOG}
VALID_TYPES = set(BY_TYPE)


def catalog() -> List[Dict[str, Any]]:
    """Return the catalog, rebuilt so provider lists stay current."""
    return _catalog()


def defaults_for(node_type: str) -> Dict[str, Any]:
    """Default config for a node type."""
    spec = BY_TYPE.get(node_type)
    if not spec:
        return {}
    return {f["key"]: f["default"] for f in spec["fields"]}


def with_defaults(node: Dict[str, Any]) -> Dict[str, Any]:
    """Fill any missing config keys on a node without touching what is set."""
    cfg = dict(defaults_for(node.get("type", "")))
    cfg.update(node.get("config") or {})
    node = dict(node)
    node["config"] = cfg
    return node


def accepts_many(node_type: str) -> bool:
    return BY_TYPE.get(node_type, {}).get("inputs") == "many"


def groups() -> List[str]:
    seen: List[str] = []
    for node in CATALOG:
        if node["group"] not in seen:
            seen.append(node["group"])
    return seen
