"""
DERZEN - Bridge to the Chrome you already have open.

Attaches to a running Chrome over the DevTools protocol instead of launching a
second browser. That is what lets DERZEN work inside the session where you are
already signed in to Gmail, WhatsApp Web, Drive and the AI sites, without ever
handling a password or a one time code.

Chrome has to be started once with the debugging port open:

    chrome.exe --remote-debugging-port=9222 --user-data-dir="C:/ChromeAgent"

start-chrome.bat in the repository root does exactly that. A Chrome that was
started without the flag cannot be attached to, and there is no way around it.

Tab handling is deliberate: ask for a URL and the bridge looks through the tabs
you already have. If one matches it is focused and reused, otherwise a new tab
is opened. Nothing you have open is closed.
"""
from __future__ import annotations

import asyncio
from typing import List, Optional
from urllib.parse import urlparse

from playwright.async_api import async_playwright

import config
import runtime


class ChromeBridgeError(RuntimeError):
    """Raised when the running Chrome cannot be reached or driven."""


def _host_path(url: str) -> str:
    """Reduce a URL to host plus first path piece, which is what tab matching needs."""
    try:
        parsed = urlparse(url if "://" in url else "https://" + url)
    except ValueError:
        return url.lower()
    host = (parsed.netloc or "").lower().removeprefix("www.")
    first = parsed.path.strip("/").split("/")[0] if parsed.path else ""
    return host + ("/" + first if first else "")


class ChromeBridge:
    """Owns the attached Chrome connection. One per process."""

    def __init__(self) -> None:
        self._pw = None
        self._browser = None
        self._lock = asyncio.Lock()

    async def context(self):
        runtime.check_not_stopped()
        async with self._lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser.contexts[0]
            if self._pw is None:
                self._pw = await async_playwright().start()
            try:
                self._browser = await self._pw.chromium.connect_over_cdp(
                    config.CHROME_CDP_URL, timeout=15000
                )
            except Exception as exc:  # noqa: BLE001 - turn it into advice
                raise ChromeBridgeError(
                    f"Could not attach to Chrome at {config.CHROME_CDP_URL}. "
                    f"Close Chrome and start it again with start-chrome.bat, "
                    f"then try the step again. ({exc})"
                ) from exc
            if not self._browser.contexts:
                raise ChromeBridgeError(
                    "Chrome answered but has no window open. Open a window and retry."
                )
            return self._browser.contexts[0]

    async def is_attached(self) -> bool:
        try:
            await self.context()
            return True
        except ChromeBridgeError:
            return False

    async def pages(self) -> List:
        context = await self.context()
        return [p for p in context.pages if not p.is_closed()]

    async def list_tabs(self) -> List[dict]:
        out = []
        for page in await self.pages():
            try:
                out.append({"url": page.url, "title": await page.title()})
            except Exception:  # noqa: BLE001 - a tab can die mid loop
                continue
        return out

    async def find_tab(self, match: str):
        """Return an open tab whose address looks like 'match', or None."""
        if not match:
            return None
        wanted = _host_path(match)
        for page in await self.pages():
            try:
                if _host_path(page.url).startswith(wanted) or wanted in page.url.lower():
                    return page
            except Exception:  # noqa: BLE001
                continue
        return None

    async def open_tab(self, url: str, match: Optional[str] = None, force_new: bool = False):
        """Focus a matching tab or open a new one, then return the page."""
        context = await self.context()
        if not force_new:
            existing = await self.find_tab(match or url)
            if existing is not None:
                await existing.bring_to_front()
                if url and _host_path(existing.url) != _host_path(url):
                    await existing.goto(url, wait_until="domcontentloaded", timeout=60000)
                    await existing.wait_for_timeout(1500)
                return existing
        page = await context.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.bring_to_front()
        await page.wait_for_timeout(2000)
        return page

    async def close(self) -> None:
        """Detach. Your Chrome and every tab in it stay exactly as they are."""
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:  # noqa: BLE001
                pass
            self._browser = None
        if self._pw is not None:
            try:
                await self._pw.stop()
            except Exception:  # noqa: BLE001
                pass
            self._pw = None


bridge = ChromeBridge()


# Convenience wrappers so callers never touch the singleton directly.
async def context():
    return await bridge.context()


async def open_tab(url: str, match: Optional[str] = None, force_new: bool = False):
    return await bridge.open_tab(url, match=match, force_new=force_new)


async def find_tab(match: str):
    return await bridge.find_tab(match)


async def list_tabs() -> List[dict]:
    return await bridge.list_tabs()


async def is_attached() -> bool:
    return await bridge.is_attached()


async def close() -> None:
    await bridge.close()


async def first_visible(page, selectors: List[str], timeout_ms: int = 12000):
    """Shared selector walker. Third party markup shifts, so always try a list."""
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < deadline:
        for selector in selectors:
            try:
                locator = page.locator(selector).last
                if await locator.count() and await locator.is_visible():
                    return locator
            except Exception:  # noqa: BLE001
                continue
        await asyncio.sleep(0.4)
    return None


async def type_text(page, locator, text: str) -> None:
    """Put text into a box whether it is a textarea or a contenteditable."""
    await locator.click()
    await page.wait_for_timeout(250)
    await page.keyboard.insert_text(text)
    await page.wait_for_timeout(250)
