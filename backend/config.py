"""
DERZEN - Central configuration.

Every setting comes from environment variables loaded out of .env. Nothing is
hardcoded. Two values are REQUIRED and deliberately have no fallback, because
guessing them would weaken the sandbox: WHITELIST_CONTACTS and ALLOWED_BASE.
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


# ----------------------------------------------------------------- required
WHITELIST_CONTACTS = [
    c.strip().lower() for c in _require("WHITELIST_CONTACTS").split(",") if c.strip()
]
ALLOWED_BASE = Path(_require("ALLOWED_BASE")).resolve()

# ------------------------------------------------------------------- server
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = _flag("DEBUG", False)
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")

# --------------------------------------------------------------- sandbox fs
SUBDIRS = {
    "downloads": os.getenv("DOWNLOAD_SUBDIR", "Downloads"),
    "reports": os.getenv("REPORTS_SUBDIR", "Reports"),
    "models": os.getenv("MODELS_SUBDIR", "Models"),
    "assets": os.getenv("ASSETS_SUBDIR", "Assets"),
    "logs": os.getenv("LOGS_SUBDIR", "Logs"),
    "pipelines": os.getenv("PIPELINES_SUBDIR", "Pipelines"),
    "browser": os.getenv("BROWSER_DATA_SUBDIR", "BrowserData"),
    "config": os.getenv("CONFIG_SUBDIR", "Config"),
    "runs": os.getenv("RUNS_SUBDIR", "Runs"),
    "exports": os.getenv("EXPORTS_SUBDIR", "Exports"),
}

# -------------------------------------------------------------------- email
EMAIL_SENDER = os.getenv("EMAIL_SENDER", "").strip()
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "").strip()
IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
EMAIL_ENABLED = bool(EMAIL_SENDER and EMAIL_PASSWORD)

# Preferred way to send mail: "chrome" drives the already logged in Gmail tab,
# "smtp" uses the credentials above, "auto" tries Chrome then falls back.
EMAIL_METHOD = os.getenv("EMAIL_METHOD", "auto").strip().lower()

# ----------------------------------------------------------------- whatsapp
WHATSAPP_ENABLED = _flag("WHATSAPP_ENABLED", False)
# chat_list = find the contact in the open WhatsApp Web tab by name
# wa_me     = open a wa.me link with the message prefilled
WHATSAPP_MODE = os.getenv("WHATSAPP_MODE", "chat_list").strip().lower()
WHATSAPP_COUNTRY_CODE = os.getenv("WHATSAPP_COUNTRY_CODE", "").strip()

# ----------------------------------------------------------------- local ai
AI_BACKEND = os.getenv("AI_BACKEND", "ollama")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.2")
FAST_MODEL = os.getenv("FAST_MODEL", "").strip() or DEFAULT_MODEL
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
AI_TIMEOUT = int(os.getenv("AI_TIMEOUT", "300"))

# ------------------------------------------------------------------ browser
# Scraping runs in its own throwaway Chromium. Anything that touches a logged
# in account attaches to the real Chrome over CDP instead.
BROWSER_HEADLESS = _flag("BROWSER_HEADLESS", False)
CHROME_ATTACH = _flag("CHROME_ATTACH", True)
CHROME_CDP_URL = os.getenv("CHROME_CDP_URL", "http://127.0.0.1:9222")
CHROME_PROFILE_DIR = os.getenv("CHROME_PROFILE_DIR", "").strip()
CHROME_BINARY = os.getenv("CHROME_BINARY", "").strip()

# Tabs the bridge expects to already be open and signed in.
GMAIL_URL = os.getenv("GMAIL_URL", "https://mail.google.com/")
WHATSAPP_URL = os.getenv("WHATSAPP_URL", "https://web.whatsapp.com/")
DRIVE_URL = os.getenv("DRIVE_URL", "https://drive.google.com/")

# -------------------------------------------------------------------- drive
DRIVE_METHOD = os.getenv("DRIVE_METHOD", "auto").strip().lower()
DRIVE_FOLDER_ID = os.getenv("DRIVE_FOLDER_ID", "").strip()

# ------------------------------------------------------------------ runtime
MAX_PARALLEL_TABS = int(os.getenv("MAX_PARALLEL_TABS", "4"))
STEP_TIMEOUT = int(os.getenv("STEP_TIMEOUT", "900"))


def ensure_directories() -> None:
    """Create ALLOWED_BASE and every configured subdirectory if missing."""
    ALLOWED_BASE.mkdir(parents=True, exist_ok=True)
    for name in SUBDIRS.values():
        (ALLOWED_BASE / name).mkdir(parents=True, exist_ok=True)


def subdir(kind: str) -> Path:
    """Absolute path of a configured subdirectory, created on demand."""
    path = ALLOWED_BASE / SUBDIRS[kind]
    path.mkdir(parents=True, exist_ok=True)
    return path


def is_whitelisted(contact: str) -> bool:
    """True if the contact (email address, phone or saved name) is allowed."""
    value = contact.strip().lower()
    if not value:
        return False
    if value in WHITELIST_CONTACTS:
        return True
    # phone numbers get compared digits only, so +62 812-3456 matches 628123456
    digits = "".join(ch for ch in value if ch.isdigit())
    if digits:
        for allowed in WHITELIST_CONTACTS:
            allowed_digits = "".join(ch for ch in allowed if ch.isdigit())
            if allowed_digits and allowed_digits == digits:
                return True
    return False


def describe() -> dict:
    """Small, non secret snapshot used by the dashboard status strip."""
    return {
        "base": str(ALLOWED_BASE),
        "model": DEFAULT_MODEL,
        "fast_model": FAST_MODEL,
        "ollama": OLLAMA_URL,
        "chrome_attach": CHROME_ATTACH,
        "cdp": CHROME_CDP_URL,
        "email_method": EMAIL_METHOD,
        "email_enabled": EMAIL_ENABLED,
        "whatsapp_enabled": WHATSAPP_ENABLED,
        "whatsapp_mode": WHATSAPP_MODE,
        "whitelist_count": len(WHITELIST_CONTACTS),
    }
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
