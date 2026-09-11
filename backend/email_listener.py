"""
DERZEN - Email out, and an optional inbox watcher.

Two ways out:

  chrome  writes the mail in the Gmail tab you already have signed in. No app
          password, no SMTP, and the sent mail lands in your normal Sent box.
  smtp    the classic route, used when Chrome is not attached.

Inbound is unchanged in spirit: an optional IMAP poller that only ever hands a
message to the app when the sender is on WHITELIST_CONTACTS.
"""
from __future__ import annotations

import asyncio
import email
import imaplib
import mimetypes
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path
from typing import Awaitable, Callable, List, Optional

import config

GMAIL_MATCH = "mail.google.com"
COMPOSE_URL = "https://mail.google.com/mail/u/0/#inbox?compose=new"

TO_BOX = [
    "textarea[name=to]",
    "input[aria-label='To recipients']",
    "input[peoplekit-id]",
    "div[aria-label='To recipients'] input",
]
SUBJECT_BOX = ["input[name=subjectbox]", "input[aria-label=Subject]"]
BODY_BOX = [
    "div[aria-label='Message Body']",
    "div[g_editable=true][role=textbox]",
    "div[contenteditable=true][role=textbox]",
]
SEND_BUTTON = [
    "div[role=button][data-tooltip^=Send]",
    "div[aria-label^='Send ']",
    "div[role=button]:has-text('Send')",
]


class EmailError(RuntimeError):
    """Raised when a message could not be sent."""


def _guard(to: str) -> None:
    if not to:
        raise EmailError("No recipient was given.")
    if not config.is_whitelisted(to):
        raise EmailError(
            f"'{to}' is not on WHITELIST_CONTACTS, so nothing was sent. "
            f"Add the address to .env first."
        )


# ------------------------------------------------------------------- smtp
def send_email(to: str, subject: str, body: str, attachment: str = "") -> None:
    """Plain SMTP send. Raises when email credentials are not configured."""
    if not config.EMAIL_ENABLED:
        raise EmailError("SMTP is not configured (set EMAIL_SENDER and EMAIL_PASSWORD).")
    msg = EmailMessage()
    msg["From"] = config.EMAIL_SENDER
    msg["To"] = to
    msg["Subject"] = subject or "(no subject)"
    msg.set_content(body or "")

    if attachment:
        path = Path(attachment)
        if path.exists() and path.is_file():
            guessed, _ = mimetypes.guess_type(path.name)
            major, _, minor = (guessed or "application/octet-stream").partition("/")
            msg.add_attachment(
                path.read_bytes(), maintype=major, subtype=minor or "octet-stream",
                filename=path.name,
            )

    with smtplib.SMTP(config.SMTP_SERVER, config.SMTP_PORT) as server:
        server.starttls()
        server.login(config.EMAIL_SENDER, config.EMAIL_PASSWORD)
        server.send_message(msg)


# ------------------------------------------------------------------ gmail
async def send_via_gmail_tab(
    to: str, subject: str, body: str, attachment: str = ""
) -> dict:
    """Compose and send inside the Gmail tab that is already signed in."""
    import chrome_bridge

    page = await chrome_bridge.open_tab(config.GMAIL_URL, match=GMAIL_MATCH)
    await page.goto(COMPOSE_URL, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(3500)

    to_box = await chrome_bridge.first_visible(page, TO_BOX, timeout_ms=20000)
    if to_box is None:
        raise EmailError(
            "The Gmail compose window did not open. Check that the tab is signed in."
        )
    await to_box.click()
    await page.keyboard.insert_text(to)
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(400)

    subject_box = await chrome_bridge.first_visible(page, SUBJECT_BOX, timeout_ms=8000)
    if subject_box is not None:
        await subject_box.click()
        await page.keyboard.insert_text(subject or "(no subject)")

    body_box = await chrome_bridge.first_visible(page, BODY_BOX, timeout_ms=8000)
    if body_box is None:
        raise EmailError("Could not find the Gmail message body.")
    await body_box.click()
    await page.keyboard.insert_text(body or "")
    await page.wait_for_timeout(500)

    attached = ""
    if attachment:
        path = Path(attachment)
        if path.exists() and path.is_file():
            try:
                await page.locator("input[type=file]").first.set_input_files(str(path))
                await page.wait_for_timeout(3500)
                attached = path.name
            except Exception as exc:  # noqa: BLE001 - send the mail anyway
                attached = f"(attachment failed: {exc})"

    button = await chrome_bridge.first_visible(page, SEND_BUTTON, timeout_ms=8000)
    if button is not None:
        await button.click()
    else:
        await page.keyboard.press("Control+Enter")
    await page.wait_for_timeout(2500)

    return {"method": "chrome", "to": to, "subject": subject, "attached": attached}


# ----------------------------------------------------------------- public
async def send(
    to: str,
    subject: str = "",
    body: str = "",
    method: str = "auto",
    attachment: str = "",
) -> dict:
    """
    Send one email. method is chrome, smtp or auto.
    auto drives the Gmail tab first and only drops to SMTP if that fails.
    """
    to = (to or "").strip()
    _guard(to)
    method = (method or config.EMAIL_METHOD or "auto").strip().lower()

    if method == "smtp":
        await asyncio.to_thread(send_email, to, subject, body, attachment)
        return {"method": "smtp", "to": to, "subject": subject,
                "attached": Path(attachment).name if attachment else ""}

    if method == "chrome":
        return await send_via_gmail_tab(to, subject, body, attachment)

    try:
        return await send_via_gmail_tab(to, subject, body, attachment)
    except Exception as chrome_error:  # noqa: BLE001
        if not config.EMAIL_ENABLED:
            raise EmailError(
                f"Gmail tab send failed and SMTP is not configured. {chrome_error}"
            ) from chrome_error
        await asyncio.to_thread(send_email, to, subject, body, attachment)
        return {"method": "smtp", "to": to, "subject": subject,
                "attached": Path(attachment).name if attachment else "",
                "note": f"Gmail tab failed, SMTP used instead. {chrome_error}"}


async def status() -> dict:
    import chrome_bridge

    return {
        "smtp_ready": config.EMAIL_ENABLED,
        "method": config.EMAIL_METHOD,
        "tab_open": await chrome_bridge.find_tab(GMAIL_MATCH) is not None,
    }


# ---------------------------------------------------------------- inbound
def _fetch_unseen() -> List[dict]:
    """Unseen mail from whitelisted senders. Everything else is left alone."""
    messages: List[dict] = []
    with imaplib.IMAP4_SSL(config.IMAP_SERVER, config.IMAP_PORT) as imap:
        imap.login(config.EMAIL_SENDER, config.EMAIL_PASSWORD)
        imap.select("INBOX")
        status_code, data = imap.search(None, "UNSEEN")
        if status_code != "OK":
            return messages
        for num in data[0].split():
            status_code, raw = imap.fetch(num, "(RFC822)")
            if status_code != "OK":
                continue
            parsed = email.message_from_bytes(raw[0][1])
            sender = parseaddr(parsed.get("From", ""))[1]
            if not config.is_whitelisted(sender):
                continue
            messages.append(
                {
                    "from": sender,
                    "subject": parsed.get("Subject", ""),
                    "body": _body_of(parsed),
                }
            )
    return messages


def _body_of(parsed: email.message.Message) -> str:
    if parsed.is_multipart():
        for part in parsed.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                return payload.decode(errors="ignore") if payload else ""
        return ""
    payload = parsed.get_payload(decode=True)
    return payload.decode(errors="ignore") if payload else ""


class EmailListener:
    """Background poller that calls a callback for each whitelisted command."""

    def __init__(self, on_command: Callable[[dict], Awaitable[None]], interval: int = 30):
        self._on_command = on_command
        self._interval = interval
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def _loop(self) -> None:
        while self._running:
            try:
                for msg in await asyncio.to_thread(_fetch_unseen):
                    await self._on_command(msg)
            except Exception:  # noqa: BLE001 - keep polling through transient faults
                pass
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        if not config.EMAIL_ENABLED or self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    @property
    def running(self) -> bool:
        return self._running
"""
DERZEN - Email communication and inbox monitoring.

Sends reports/alerts over SMTP and (optionally) polls an IMAP inbox for commands.
Credentials come only from environment variables via config; nothing is stored
in code. Every inbound sender is checked against the whitelist before its message
is ever acted upon - unauthorised senders are logged and ignored.
"""
from __future__ import annotations

import asyncio
import email
import imaplib
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Awaitable, Callable, List

import config


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via SMTP. Raises if email is not configured."""
    if not config.EMAIL_ENABLED:
        raise RuntimeError("Email is not configured (set EMAIL_SENDER / EMAIL_PASSWORD).")
    msg = EmailMessage()
    msg["From"] = config.EMAIL_SENDER
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(config.SMTP_SERVER, config.SMTP_PORT) as server:
        server.starttls()
        server.login(config.EMAIL_SENDER, config.EMAIL_PASSWORD)
        server.send_message(msg)


def _fetch_unseen() -> List[dict]:
    """Fetch unseen messages from whitelisted senders and mark them read."""
    messages: List[dict] = []
    with imaplib.IMAP4_SSL(config.IMAP_SERVER, config.IMAP_PORT) as imap:
        imap.login(config.EMAIL_SENDER, config.EMAIL_PASSWORD)
        imap.select("INBOX")
        status, data = imap.search(None, "UNSEEN")
        if status != "OK":
            return messages
        for num in data[0].split():
            status, raw = imap.fetch(num, "(RFC822)")
            if status != "OK":
                continue
            parsed = email.message_from_bytes(raw[0][1])
            sender = parseaddr(parsed.get("From", ""))[1]
            if not config.is_whitelisted(sender):
                continue  # unauthorised sender - ignored
            messages.append(
                {
                    "from": sender,
                    "subject": parsed.get("Subject", ""),
                    "body": _body_of(parsed),
                }
            )
    return messages


def _body_of(parsed: email.message.Message) -> str:
    if parsed.is_multipart():
        for part in parsed.walk():
            if part.get_content_type() == "text/plain":
                return part.get_payload(decode=True).decode(errors="ignore")
        return ""
    return parsed.get_payload(decode=True).decode(errors="ignore")


class EmailListener:
    """Background poller that invokes a callback for each whitelisted command."""

    def __init__(self, on_command: Callable[[dict], Awaitable[None]], interval: int = 30):
        self._on_command = on_command
        self._interval = interval
        self._task: asyncio.Task | None = None
        self._running = False

    async def _loop(self) -> None:
        while self._running:
            try:
                for msg in await asyncio.to_thread(_fetch_unseen):
                    await self._on_command(msg)
            except Exception:  # noqa: BLE001 - keep polling despite transient errors
                pass
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        if not config.EMAIL_ENABLED or self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
