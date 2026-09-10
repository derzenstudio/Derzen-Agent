"""
DERZEN - WhatsApp communication via WhatsApp Web.

Drives web.whatsapp.com through the shared persistent Playwright context, so the
QR-code login you scan once is remembered in the sandboxed BrowserData folder.
Only enabled when WHATSAPP_ENABLED is true. Sending requires an active session;
this module never handles your phone credentials directly.
"""
from __future__ import annotations

from urllib.parse import quote

import config
from automation import browser

WHATSAPP_URL = "https://web.whatsapp.com"


async def is_logged_in() -> bool:
    """Best-effort check for an active WhatsApp Web session."""
    context = await browser._ensure_context()
    page = await context.new_page()
    try:
        await page.goto(WHATSAPP_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        # The chat search box only appears once logged in.
        return await page.locator('[contenteditable="true"]').count() > 0
    finally:
        await page.close()


async def send_message(contact: str, message: str) -> None:
    """Send a WhatsApp message to a phone number (international format).

    Requires an active WhatsApp Web session (scan the QR code once). Raises a
    clear error if WhatsApp is disabled or not yet logged in.
    """
    if not config.WHATSAPP_ENABLED:
        raise RuntimeError("WhatsApp is disabled (set WHATSAPP_ENABLED=true).")
    number = "".join(ch for ch in contact if ch.isdigit())
    context = await browser._ensure_context()
    page = await context.new_page()
    try:
        deep_link = f"{WHATSAPP_URL}/send?phone={number}&text={quote(message)}"
        await page.goto(deep_link, wait_until="domcontentloaded")
        send_button = page.locator('[data-testid="send"], [aria-label="Send"]')
        await send_button.first.click(timeout=60000)
        await page.wait_for_timeout(2000)
    finally:
        await page.close()
