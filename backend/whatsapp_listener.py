"""
DERZEN - WhatsApp sending through the WhatsApp Web tab you already have open.

Three ways to send, picked per pipeline step:

  chat_list  search the chat list by saved contact name, open the chat, type,
             send. This is the safe default: nothing leaves the machine except
             the message itself, to a contact that is already on the whitelist.
  wa_me      open https://wa.me/<number>?text=... with the text prefilled. Use
             open_only when a human should read it before pressing send.
  number     open the chat by phone number inside the existing WhatsApp tab.

Nothing here touches your phone, your credentials or the QR code. The tab has
to be linked already.
"""
from __future__ import annotations

import asyncio
import re
from typing import List, Optional
from urllib.parse import quote

import chrome_bridge
import config

WHATSAPP_MATCH = "web.whatsapp.com"
CHUNK = 3200

SEARCH_BOX = [
    "div[contenteditable=true][data-tab='3']",
    "[data-testid='chat-list-search']",
    "div[title='Search input textbox']",
    "#side div[contenteditable=true]",
]

MESSAGE_BOX = [
    "footer div[contenteditable=true][data-tab='10']",
    "[data-testid='conversation-compose-box-input']",
    "footer div[contenteditable=true]",
    "div[contenteditable=true][data-tab='6']",
]

SEND_BUTTON = [
    "[data-testid='send']",
    "button[aria-label='Send']",
    "span[data-icon='send']",
    "button[data-tab='11']",
]

CHAT_ROWS = "#pane-side div[role=listitem], #pane-side div[role=row]"
CHAT_TITLE = "header span[title], header div[title]"


class WhatsAppError(RuntimeError):
    """Raised when a message could not be delivered."""


def _digits(value: str) -> str:
    number = "".join(ch for ch in str(value or "") if ch.isdigit())
    if number and config.WHATSAPP_COUNTRY_CODE and number.startswith("0"):
        number = config.WHATSAPP_COUNTRY_CODE.lstrip("+") + number[1:]
    return number


def _chunks(message: str) -> List[str]:
    """Split a long report into pieces WhatsApp will accept comfortably."""
    text = (message or "").strip()
    if len(text) <= CHUNK:
        return [text] if text else []
    parts: List[str] = []
    buf = ""
    for para in re.split(r"\n\s*\n", text):
        if len(buf) + len(para) + 2 > CHUNK and buf:
            parts.append(buf.strip())
            buf = ""
        if len(para) > CHUNK:
            for i in range(0, len(para), CHUNK):
                parts.append(para[i : i + CHUNK])
            continue
        buf += para + "\n\n"
    if buf.strip():
        parts.append(buf.strip())
    total = len(parts)
    return [f"({i + 1}/{total})\n{p}" if total > 1 else p for i, p in enumerate(parts)]


def _guard(target: str) -> None:
    if not config.WHATSAPP_ENABLED:
        raise WhatsAppError("WhatsApp sending is off. Set WHATSAPP_ENABLED=true in .env.")
    if not target:
        raise WhatsAppError("No WhatsApp contact or number was given.")
    if not config.is_whitelisted(target):
        raise WhatsAppError(
            f"'{target}' is not on WHITELIST_CONTACTS, so nothing was sent. "
            f"Add the contact to .env first."
        )


async def _open_whatsapp():
    page = await chrome_bridge.open_tab(config.WHATSAPP_URL, match=WHATSAPP_MATCH)
    await page.wait_for_timeout(1500)
    if await page.locator("canvas[aria-label*='scan'], div[data-ref]").count():
        raise WhatsAppError(
            "WhatsApp Web is showing the QR screen. Link the tab yourself, then rerun."
        )
    return page


async def _type_message(page, box, text: str) -> None:
    """
    Type into the compose box line by line. A plain Enter sends the message, so
    line breaks go in as shift+Enter and only the final Enter actually sends.
    """
    await box.click()
    await page.wait_for_timeout(200)
    lines = text.split("\n")
    for index, line in enumerate(lines):
        if line:
            await page.keyboard.insert_text(line)
        if index < len(lines) - 1:
            await page.keyboard.press("Shift+Enter")
    await page.wait_for_timeout(300)


async def _press_send(page) -> None:
    button = await chrome_bridge.first_visible(page, SEND_BUTTON, timeout_ms=6000)
    if button is not None:
        await button.click()
    else:
        await page.keyboard.press("Enter")
    await page.wait_for_timeout(1200)


async def _open_chat_by_name(page, contact: str) -> str:
    """Search the chat list, open the best match, return the opened chat title."""
    search = await chrome_bridge.first_visible(page, SEARCH_BOX, timeout_ms=20000)
    if search is None:
        raise WhatsAppError("Could not find the WhatsApp search box. Is the tab loaded?")
    await search.click()
    await page.keyboard.press("Control+A")
    await page.keyboard.press("Backspace")
    await page.keyboard.insert_text(contact)
    await page.wait_for_timeout(2200)

    rows = page.locator(CHAT_ROWS)
    count = await rows.count()
    if not count:
        raise WhatsAppError(f"No chat named '{contact}' showed up in the list.")

    wanted = contact.strip().lower()
    chosen = None
    for i in range(min(count, 8)):
        row = rows.nth(i)
        try:
            label = (await row.inner_text())[:200].lower()
        except Exception:
            continue
        if wanted in label:
            chosen = row
            break
    if chosen is None:
        chosen = rows.first
    await chosen.click()
    await page.wait_for_timeout(1600)

    try:
        title = await page.locator(CHAT_TITLE).first.get_attribute("title")
    except Exception:
        title = None
    opened = (title or "").strip()
    if opened and wanted not in opened.lower():
        raise WhatsAppError(
            f"Opened chat is '{opened}' but the step asked for '{contact}'. "
            f"Nothing was sent."
        )
    return opened or contact


async def _send_in_open_chat(page, message: str) -> int:
    box = await chrome_bridge.first_visible(page, MESSAGE_BOX, timeout_ms=20000)
    if box is None:
        raise WhatsAppError("The message box did not appear. The chat may not be open.")
    sent = 0
    for part in _chunks(message):
        await _type_message(page, box, part)
        await _press_send(page)
        sent += 1
        await asyncio.sleep(0.8)
    return sent


# ------------------------------------------------------------------ public
async def send(
    mode: str = "chat_list",
    contact: str = "",
    phone: str = "",
    message: str = "",
    open_only: bool = False,
) -> dict:
    """
    Deliver a message and report what happened.
    Returns {"mode", "target", "parts", "sent", "link", "note"}.
    """
    mode = (mode or config.WHATSAPP_MODE or "chat_list").strip().lower()
    message = (message or "").strip()
    if not message:
        raise WhatsAppError("There is nothing to send, the message is empty.")

    if mode == "wa_me":
        number = _digits(phone or contact)
        _guard(number or contact)
        link = f"https://wa.me/{number}?text={quote(message[:1800])}"
        page = await chrome_bridge.open_tab(link, match="wa.me", force_new=True)
        await page.wait_for_timeout(2500)
        if open_only:
            return {
                "mode": mode, "target": number, "parts": 1, "sent": 0, "link": link,
                "note": "Tab opened with the text filled in. Press send yourself.",
            }
        # wa.me hands over to WhatsApp Web, which needs a click on continue first.
        cont = await chrome_bridge.first_visible(
            page, ["a[href*='web.whatsapp.com']", "#action-button"], timeout_ms=6000
        )
        if cont is not None:
            await cont.click()
            await page.wait_for_timeout(4000)
        sent = 0
        try:
            await _press_send(page)
            sent = 1
        except Exception as exc:
            return {
                "mode": mode, "target": number, "parts": 1, "sent": 0, "link": link,
                "note": f"Text is filled in but send did not complete: {exc}",
            }
        return {"mode": mode, "target": number, "parts": 1, "sent": sent,
                "link": link, "note": "Sent through the wa.me link."}

    page = await _open_whatsapp()

    if mode == "number":
        number = _digits(phone or contact)
        _guard(number or contact)
        await page.goto(
            f"https://web.whatsapp.com/send?phone={number}",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        await page.wait_for_timeout(4000)
        if open_only:
            return {"mode": mode, "target": number, "parts": 0, "sent": 0, "link": "",
                    "note": "Chat opened, nothing sent."}
        parts = await _send_in_open_chat(page, message)
        return {"mode": mode, "target": number, "parts": parts, "sent": parts,
                "link": "", "note": "Sent by number in the open WhatsApp tab."}

    # default: chat_list
    name = (contact or "").strip()
    _guard(name or _digits(phone))
    opened = await _open_chat_by_name(page, name)
    if open_only:
        return {"mode": "chat_list", "target": opened, "parts": 0, "sent": 0,
                "link": "", "note": "Chat opened, nothing sent."}
    parts = await _send_in_open_chat(page, message)
    return {"mode": "chat_list", "target": opened, "parts": parts, "sent": parts,
            "link": "", "note": f"Sent to '{opened}' from the chat list."}


async def is_logged_in() -> bool:
    """True when the WhatsApp tab is linked and showing the chat list."""
    try:
        page = await chrome_bridge.find_tab(WHATSAPP_MATCH)
        if page is None:
            return False
        return await page.locator("#pane-side").count() > 0
    except Exception:
        return False


async def status() -> dict:
    return {
        "enabled": config.WHATSAPP_ENABLED,
        "mode": config.WHATSAPP_MODE,
        "tab_open": await chrome_bridge.find_tab(WHATSAPP_MATCH) is not None,
        "linked": await is_logged_in(),
    }


async def send_message(contact: str, message: str, mode: Optional[str] = None) -> dict:
    """Kept for older pipelines and the email command handler."""
    return await send(mode=mode or config.WHATSAPP_MODE, contact=contact,
                      phone=contact, message=message)
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
