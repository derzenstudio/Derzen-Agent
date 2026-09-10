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
