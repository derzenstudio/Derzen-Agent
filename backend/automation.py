"""
DERZEN - Scraping browser (throwaway Chromium).

This module is only for reading public pages. It runs in its own Playwright
Chromium with a profile under the sandboxed BrowserData directory, so it never
touches the signed in Chrome the rest of the system drives over CDP.

Anything that needs a logged in account (Gmail, WhatsApp Web, Drive, the online
AI chats) goes through chrome_bridge and webai.driver instead.
"""
from __future__ import annotations

import asyncio
import re
from typing import Dict, Iterable, List
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright, Browser, BrowserContext, Playwright

import config
import runtime

# Elements that only add navigation noise to the extracted text.
STRIP_SELECTORS = (
    "script, style, noscript, svg, iframe, header, footer, nav, aside, "
    "[role=navigation], [role=banner], [role=contentinfo], .cookie, #cookie, "
    ".advert, .ads, .newsletter, .subscribe, .social-share"
)

READ_JS = """
(sel) => {
  const doc = document.cloneNode(true);
  doc.querySelectorAll(sel).forEach(n => n.remove());
  const main = doc.querySelector('article') || doc.querySelector('main') || doc.body;
  const title = document.title || '';
  const text = (main ? main.innerText : '') || '';
  const links = [...document.querySelectorAll('a[href]')]
    .map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 120) }))
    .filter(l => l.href.startsWith('http'));
  return { title, text, links };
}
"""

BLANK_RUNS = re.compile(r"\n{3,}")
SPACES = re.compile(r"[ \t]{2,}")


def tidy(text: str) -> str:
    """Collapse the whitespace soup that innerText usually returns."""
    text = (text or "").replace("\r", "")
    text = SPACES.sub(" ", text)
    text = BLANK_RUNS.sub("\n\n", text)
    lines = [ln.strip() for ln in text.split("\n")]
    out: List[str] = []
    for line in lines:
        if not line and out and not out[-1]:
            continue
        out.append(line)
    return "\n".join(out).strip()


class BrowserAutomation:
    """Owns the Playwright lifecycle for scraping and screenshots."""

    def __init__(self) -> None:
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._lock = asyncio.Lock()

    async def _ensure_context(self) -> BrowserContext:
        runtime.check_not_stopped()
        async with self._lock:
            if self._context is not None:
                return self._context
            self._pw = await async_playwright().start()
            self._context = await self._pw.chromium.launch_persistent_context(
                user_data_dir=str(config.subdir("browser")),
                headless=config.BROWSER_HEADLESS,
                args=["--disable-blink-features=AutomationControlled"],
            )
            self._context.set_default_timeout(45000)
            self._browser = self._context.browser
            return self._context

    # ------------------------------------------------------------- scraping
    async def _read_one(self, context: BrowserContext, url: str, max_chars: int) -> dict:
        runtime.check_not_stopped()
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            await page.wait_for_timeout(700)
            data = await page.evaluate(READ_JS, STRIP_SELECTORS)
            text = tidy(data.get("text", ""))
            return {
                "url": url,
                "title": (data.get("title") or "").strip(),
                "text": text[:max_chars],
                "chars": len(text),
                "links": data.get("links") or [],
                "ok": True,
            }
        except Exception as exc:  # noqa: BLE001 - one bad URL must not kill the batch
            return {"url": url, "title": "", "text": "", "chars": 0, "links": [],
                    "ok": False, "error": str(exc)[:300]}
        finally:
            try:
                await page.close()
            except Exception:
                pass

    async def scrape(
        self,
        urls: Iterable[str],
        max_chars: int = 20000,
        follow_links: bool = False,
        max_followed: int = 4,
    ) -> Dict[str, str]:
        """
        Read every URL and return {url: text}. With follow_links on, up to
        max_followed same-domain article links per page are read as well and
        appended under their own heading.
        """
        targets = [u.strip() for u in urls if str(u).strip()]
        targets = [u if "://" in u else "https://" + u for u in targets]
        if not targets:
            return {}

        context = await self._ensure_context()
        limit = asyncio.Semaphore(max(1, config.MAX_PARALLEL_TABS))

        async def guarded(u: str):
            async with limit:
                return await self._read_one(context, u, max_chars)

        pages = await asyncio.gather(*[guarded(u) for u in targets])
        results: Dict[str, str] = {}

        for page in pages:
            body = page["text"] if page["ok"] else f"[could not read: {page.get('error', 'unknown')}]"
            if page["title"]:
                body = f"{page['title']}\n\n{body}"
            results[page["url"]] = body

        if follow_links:
            extra = []
            for page in pages:
                if not page["ok"]:
                    continue
                extra.extend(self._pick_links(page, max_followed))
            extra = [u for u in dict.fromkeys(extra) if u not in results][: max_followed * 2]
            if extra:
                async def guarded2(u: str):
                    async with limit:
                        return await self._read_one(context, u, max_chars // 2 or 4000)

                followed = await asyncio.gather(*[guarded2(u) for u in extra])
                for page in followed:
                    if page["ok"] and page["chars"] > 400:
                        results[page["url"]] = f"{page['title']}\n\n{page['text']}"
        return results

    @staticmethod
    def _pick_links(page: dict, count: int) -> List[str]:
        """Pick same-host links that look like real content, not chrome."""
        host = urlparse(page["url"]).netloc
        skip = ("login", "signup", "signin", "privacy", "terms", "cookie",
                "contact", "careers", "account", "cart", "#")
        picked: List[str] = []
        for link in page.get("links", []):
            href = link.get("href", "")
            if not href or urlparse(href).netloc != host:
                continue
            low = href.lower()
            if any(s in low for s in skip):
                continue
            if len(link.get("text", "")) < 18:
                continue
            picked.append(urljoin(page["url"], href.split("#")[0]))
            if len(picked) >= count:
                break
        return picked

    # ---------------------------------------------------------- screenshots
    async def screenshot(self, url: str, relative_path: str) -> str:
        """Navigate to a URL and save a full page screenshot into the sandbox."""
        import file_manager

        target = file_manager.validate_path(relative_path)
        context = await self._ensure_context()
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(1200)
            await page.screenshot(path=str(target), full_page=True)
            return str(target)
        finally:
            await page.close()

    async def cleanup(self) -> None:
        """Close the browser and Playwright. Safe to call repeatedly."""
        if self._context is not None:
            try:
                await self._context.close()
            except Exception:
                pass
            self._context = None
        if self._pw is not None:
            try:
                await self._pw.stop()
            except Exception:
                pass
            self._pw = None
        self._browser = None

    def is_running(self) -> bool:
        return self._context is not None


# Module level singleton used across the app.
browser = BrowserAutomation()
"""
DERZEN - Scraping browser (throwaway Chromium).

This module is only for reading public pages. It runs in its own Playwright
Chromium with a profile under the sandboxed BrowserData directory, so it never
touches the signed in Chrome the rest of the system drives over CDP.

Anything that needs a logged in account (Gmail, WhatsApp Web, Drive, the online
AI chats) goes through chrome_bridge and webai.driver instead.
"""
from __future__ import annotations

import asyncio
import re
from typing import Dict, Iterable, List
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright, Browser, BrowserContext, Playwright

import config
import runtime

# Elements that only add navigation noise to the extracted text.
STRIP_SELECTORS = (
    "script, style, noscript, svg, iframe, header, footer, nav, aside, "
    "[role=navigation], [role=banner], [role=contentinfo], .cookie, #cookie, "
    ".advert, .ads, .newsletter, .subscribe, .social-share"
)

READ_JS = """
(sel) => {
  const doc = document.cloneNode(true);
  doc.querySelectorAll(sel).forEach(n => n.remove());
  const main = doc.querySelector('article') || doc.querySelector('main') || doc.body;
  const title = document.title || '';
  const text = (main ? main.innerText : '') || '';
  const links = [...document.querySelectorAll('a[href]')]
    .map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 120) }))
    .filter(l => l.href.startsWith('http'));
  return { title, text, links };
}
"""

BLANK_RUNS = re.compile(r"\n{3,}")
SPACES = re.compile(r"[ \t]{2,}")


def tidy(text: str) -> str:
    """Collapse the whitespace soup that innerText usually returns."""
    text = (text or "").replace("\r", "")
    text = SPACES.sub(" ", text)
    text = BLANK_RUNS.sub("\n\n", text)
    lines = [ln.strip() for ln in text.split("\n")]
    out: List[str] = []
    for line in lines:
        if not line and out and not out[-1]:
            continue
        out.append(line)
    return "\n".join(out).strip()


class BrowserAutomation:
    """Owns the Playwright lifecycle for scraping and screenshots."""

    def __init__(self) -> None:
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._lock = asyncio.Lock()

    async def _ensure_context(self) -> BrowserContext:
        runtime.check_not_stopped()
        async with self._lock:
            if self._context is not None:
                return self._context
            self._pw = await async_playwright().start()
            self._context = await self._pw.chromium.launch_persistent_context(
                user_data_dir=str(config.subdir("browser")),
                headless=config.BROWSER_HEADLESS,
                args=["--disable-blink-features=AutomationControlled"],
            )
            self._context.set_default_timeout(45000)
            self._browser = self._context.browser
            return self._context

    # ------------------------------------------------------------- scraping
    async def _read_one(self, context: BrowserContext, url: str, max_chars: int) -> dict:
        runtime.check_not_stopped()
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            await page.wait_for_timeout(700)
            data = await page.evaluate(READ_JS, STRIP_SELECTORS)
            text = tidy(data.get("text", ""))
            return {
                "url": url,
                "title": (data.get("title") or "").strip(),
                "text": text[:max_chars],
                "chars": len(text),
                "links": data.get("links") or [],
                "ok": True,
            }
        except Exception as exc:  # noqa: BLE001 - one bad URL must not kill the batch
            return {"url": url, "title": "", "text": "", "chars": 0, "links": [],
                    "ok": False, "error": str(exc)[:300]}
        finally:
            try:
                await page.close()
            except Exception:
                pass

    async def scrape(
        self,
        urls: Iterable[str],
        max_chars: int = 20000,
        follow_links: bool = False,
        max_followed: int = 4,
    ) -> Dict[str, str]:
        """
        Read every URL and return {url: text}. With follow_links on, up to
        max_followed same-domain article links per page are read as well and
        appended under their own heading.
        """
        targets = [u.strip() for u in urls if str(u).strip()]
        targets = [u if "://" in u else "https://" + u for u in targets]
        if not targets:
            return {}

        context = await self._ensure_context()
        limit = asyncio.Semaphore(max(1, config.MAX_PARALLEL_TABS))

        async def guarded(u: str):
            async with limit:
                return await self._read_one(context, u, max_chars)

        pages = await asyncio.gather(*[guarded(u) for u in targets])
        results: Dict[str, str] = {}

        for page in pages:
            body = page["text"] if page["ok"] else f"[could not read: {page.get('error', 'unknown')}]"
            if page["title"]:
                body = f"{page['title']}\n\n{body}"
            results[page["url"]] = body

        if follow_links:
            extra = []
            for page in pages:
                if not page["ok"]:
                    continue
                extra.extend(self._pick_links(page, max_followed))
            extra = [u for u in dict.fromkeys(extra) if u not in results][: max_followed * 2]
            if extra:
                async def guarded2(u: str):
                    async with limit:
                        return await self._read_one(context, u, max_chars // 2 or 4000)

                followed = await asyncio.gather(*[guarded2(u) for u in extra])
                for page in followed:
                    if page["ok"] and page["chars"] > 400:
                        results[page["url"]] = f"{page['title']}\n\n{page['text']}"
        return results

    @staticmethod
    def _pick_links(page: dict, count: int) -> List[str]:
        """Pick same-host links that look like real content, not chrome."""
        host = urlparse(page["url"]).netloc
        skip = ("login", "signup", "signin", "privacy", "terms", "cookie",
                "contact", "careers", "account", "cart", "#")
        picked: List[str] = []
        for link in page.get("links", []):
            href = link.get("href", "")
            if not href or urlparse(href).netloc != host:
                continue
            low = href.lower()
            if any(s in low for s in skip):
                continue
            if len(link.get("text", "")) < 18:
                continue
            picked.append(urljoin(page["url"], href.split("#")[0]))
            if len(picked) >= count:
                break
        return picked

    # ---------------------------------------------------------- screenshots
    async def screenshot(self, url: str, relative_path: str) -> str:
        """Navigate to a URL and save a full page screenshot into the sandbox."""
        import file_manager

        target = file_manager.validate_path(relative_path)
        context = await self._ensure_context()
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(1200)
            await page.screenshot(path=str(target), full_page=True)
            return str(target)
        finally:
            await page.close()

    async def cleanup(self) -> None:
        """Close the browser and Playwright. Safe to call repeatedly."""
        if self._context is not None:
            try:
                await self._context.close()
            except Exception:
                pass
            self._context = None
        if self._pw is not None:
            try:
                await self._pw.stop()
            except Exception:
                pass
            self._pw = None
        self._browser = None

    def is_running(self) -> bool:
        return self._context is not None


# Module level singleton used across the app.
browser = BrowserAutomation()
"""
DERZEN - Browser automation via Playwright (Chromium).

Provides web scraping, screenshots, and driving online AI web UIs. A single
persistent browser context is reused (so logins / WhatsApp sessions survive) and
stored under the sandboxed BrowserData directory. The emergency-stop flag from
runtime.py is honoured: when set, the browser is torn down and new work refused.
"""
from __future__ import annotations

from typing import List

from playwright.async_api import async_playwright, Browser, BrowserContext, Playwright

import config
import runtime

AI_SERVICE_URLS = {
    "chatgpt": "https://chat.openai.com",
    "claude": "https://claude.ai",
    "gemini": "https://gemini.google.com",
    "perplexity": "https://www.perplexity.ai",
}


class BrowserAutomation:
    """Owns the Playwright lifecycle and exposes high-level actions."""

    def __init__(self) -> None:
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None

    async def _ensure_context(self) -> BrowserContext:
        runtime.check_not_stopped()
        if self._context is not None:
            return self._context
        self._pw = await async_playwright().start()
        user_data = str(config.subdir("browser"))
        self._context = await self._pw.chromium.launch_persistent_context(
            user_data_dir=user_data,
            headless=config.BROWSER_HEADLESS,
        )
        self._browser = self._context.browser
        return self._context

    async def scrape(self, urls: List[str]) -> dict:
        """Open each URL and return its visible text keyed by URL."""
        context = await self._ensure_context()
        results: dict = {}
        for url in [u.strip() for u in urls if u.strip()]:
            runtime.check_not_stopped()
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(1500)
                results[url] = (await page.inner_text("body"))[:20000]
            except Exception as exc:  # noqa: BLE001 - report per-URL, keep going
                results[url] = f"[error: {exc}]"
            finally:
                await page.close()
        return results

    async def ask_web_ai(self, service: str, prompt: str, wait_seconds: int = 30) -> str:
        """Open an online AI web UI, submit a prompt, and read the reply.

        Selectors for third-party sites drift over time; this uses resilient
        role-based lookups and returns whatever text the page produced.
        """
        service = service.lower()
        if service not in AI_SERVICE_URLS:
            raise ValueError(f"Unknown AI service: {service}")
        context = await self._ensure_context()
        page = await context.new_page()
        try:
            await page.goto(AI_SERVICE_URLS[service], wait_until="domcontentloaded")
            box = page.get_by_role("textbox")
            await box.first.click(timeout=30000)
            await box.first.fill(prompt)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(max(1, wait_seconds) * 1000)
            return (await page.inner_text("body"))[:20000]
        finally:
            await page.close()

    async def screenshot(self, url: str, relative_path: str) -> str:
        """Navigate to a URL and save a full-page screenshot into the sandbox."""
        import file_manager

        target = file_manager.validate_path(relative_path)
        context = await self._ensure_context()
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await page.screenshot(path=str(target), full_page=True)
            return str(target)
        finally:
            await page.close()

    async def cleanup(self) -> None:
        """Close the browser and Playwright. Safe to call repeatedly."""
        if self._context is not None:
            await self._context.close()
            self._context = None
        if self._pw is not None:
            await self._pw.stop()
            self._pw = None
        self._browser = None


# Module-level singleton used across the app.
browser = BrowserAutomation()
