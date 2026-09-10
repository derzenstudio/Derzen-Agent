"""
DERZEN - Central configuration.

All settings come from environment variables (loaded from .env). There are no
hardcoded secrets or paths. Two values are REQUIRED and have no default for
security reasons: WHITELIST_CONTACTS and ALLOWED_BASE.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class ConfigError(RuntimeError):
    """Raised when required configuration is missing or invalid."""


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigError(
            f"Required environment variable '{name}' is not set. "
            f"Copy .env.example to .env and fill it in."
        )
    return value


def _flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


# Required (no defaults)
WHITELIST_CONTACTS = [
    c.strip().lower() for c in _require("WHITELIST_CONTACTS").split(",") if c.strip()
]
ALLOWED_BASE = Path(_require("ALLOWED_BASE")).resolve()

# Server
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = _flag("DEBUG", False)
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")

# Subdirectories (relative to ALLOWED_BASE)
SUBDIRS = {
    "downloads": os.getenv("DOWNLOAD_SUBDIR", "Downloads"),
    "reports": os.getenv("REPORTS_SUBDIR", "Reports"),
    "models": os.getenv("MODELS_SUBDIR", "Models"),
    "assets": os.getenv("ASSETS_SUBDIR", "Assets"),
    "logs": os.getenv("LOGS_SUBDIR", "Logs"),
    "pipelines": os.getenv("PIPELINES_SUBDIR", "Pipelines"),
    "browser": os.getenv("BROWSER_DATA_SUBDIR", "BrowserData"),
}

# Email (optional)
EMAIL_SENDER = os.getenv("EMAIL_SENDER", "").strip()
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "").strip()
IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
EMAIL_ENABLED = bool(EMAIL_SENDER and EMAIL_PASSWORD)

# WhatsApp (optional)
WHATSAPP_ENABLED = _flag("WHATSAPP_ENABLED", False)

# AI
AI_BACKEND = os.getenv("AI_BACKEND", "ollama")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.2")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

# Browser
BROWSER_HEADLESS = _flag("BROWSER_HEADLESS", False)


def ensure_directories() -> None:
    """Create ALLOWED_BASE and all configured subdirectories if missing."""
    ALLOWED_BASE.mkdir(parents=True, exist_ok=True)
    for name in SUBDIRS.values():
        (ALLOWED_BASE / name).mkdir(parents=True, exist_ok=True)


def subdir(kind: str) -> Path:
    """Return the absolute path of a configured subdirectory."""
    return ALLOWED_BASE / SUBDIRS[kind]


def is_whitelisted(contact: str) -> bool:
    """True if the given contact (email/phone) is on the whitelist."""
    return contact.strip().lower() in WHITELIST_CONTACTS
