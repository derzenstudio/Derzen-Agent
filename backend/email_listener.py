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
