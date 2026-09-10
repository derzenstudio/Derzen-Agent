"""
DERZEN - Online AI driver.

Types into an AI website that you are already signed in to, waits for the reply
to actually finish, and returns only the new answer. Three things make this
different from a blind sleep:

  1. the answer is read from the assistant message element, not from the whole
     page, so navigation text and your own prompt are not mixed in;
  2. the step returns as soon as the text stops growing and the stop button
     disappears, so a short answer does not cost you the full wait;
  3. the tab stays open and owned by a Conversation object, so a follow up
     question really is a follow up and not a fresh chat.

Every tab lives in your normal Chrome through chrome_bridge, because that is
where your logins are. Nothing here signs in, solves a captcha, or stores a
credential.
"""
from __future__ import annotations

import asyncio
import time
from typing import Dict, List, Optional

import chrome_bridge
import runtime
from webai import registry

MIN_SETTLE = 3.0
POLL = 1.2
STABLE_POLLS = 3


class WebAIError(RuntimeError):
    """Raised when a provider page cannot be driven."""


async def _first_visible(page, selectors: List[str], timeout_ms: int = 15000):
    """Return the first locator from the list that is actually on screen."""
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        for selector in selectors:
            locator = page.locator(selector).last
            try:
                if await locator.count() and await locator.is_visible():
                    return locator
            except Exception:  # noqa: BLE001 - selector churn on third party pages
                continue
        await asyncio.sleep(0.4)
    return None


async def _busy(page, selectors: List[str]) -> bool:
    for selector in selectors:
        try:
            locator = page.locator(selector).last
            if await locator.count() and await locator.is_visible():
                return True
        except Exception:  # noqa: BLE001
            continue
    return False


async def _read_answer(page, selectors: List[str]) -> str:
    for selector in selectors:
        try:
            locator = page.locator(selector)
            count = await locator.count()
            if count:
                return (await locator.nth(count - 1).inner_text()).strip()
        except Exception:  # noqa: BLE001
            continue
    return ""


class Conversation:
    """One open tab holding one ongoing chat with one service."""

    def __init__(self, provider_id: str, page, spec: Dict):
        self.provider_id = provider_id
        self.label = spec.get("label", provider_id)
        self.page = page
        self.spec = spec
        self.turns: List[Dict[str, str]] = []

    async def ask(self, message: str, wait_seconds: int = 180) -> str:
        """Send one message and return the reply text."""
        runtime.check_not_stopped()
        message = (message or "").strip()
        if not message:
            raise WebAIError("Nothing to send.")

        page = self.page
        box = await _first_visible(page, self.spec.get("input", []))
        if box is None:
            raise WebAIError(
                f"Could not find the message box on {self.label}. "
                f"Open the tab yourself and check you are signed in."
            )

        before = await _read_answer(page, self.spec.get("message", []))

        await box.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Delete")
        await page.keyboard.insert_text(message)
        await page.wait_for_timeout(400)

        send = await _first_visible(page, self.spec.get("send", []), timeout_ms=3000)
        if send is not None:
            try:
                await send.click(timeout=8000)
            except Exception:  # noqa: BLE001 - disabled or covered, fall back to the key
                await page.keyboard.press(self.spec.get("submit_key", "Enter"))
        else:
            await page.keyboard.press(self.spec.get("submit_key", "Enter"))

        answer = await self._wait_for_answer(before, wait_seconds)
        self.turns.append({"ask": message, "reply": answer})
        return answer

    async def _wait_for_answer(self, before: str, wait_seconds: int) -> str:
        page = self.page
        busy_sel = self.spec.get("busy", [])
        msg_sel = self.spec.get("message", [])
        started = time.time()
        ceiling = max(10, int(wait_seconds or 180))
        last = ""
        stable = 0

        while time.time() - started < ceiling:
            runtime.check_not_stopped()
            await asyncio.sleep(POLL)
            current = await _read_answer(page, msg_sel)
            if current == before or not current:
                continue
            if current == last:
                stable += 1
            else:
                stable = 0
                last = current
            if time.time() - started < MIN_SETTLE:
                continue
            if stable >= STABLE_POLLS and not await _busy(page, busy_sel):
                return current

        if last:
            return last + "\n\n[cut off: the reply was still growing when the time limit hit]"
        raise WebAIError(
            f"{self.label} produced no reply within {ceiling}s. The page may be asking "
            f"you to sign in, or the selectors for this service need updating in "
            f"backend/webai/providers.json."
        )

    def transcript(self) -> str:
        lines: List[str] = []
        for i, turn in enumerate(self.turns, start=1):
            lines.append(f"Round {i} question:\n{turn['ask']}")
            lines.append(f"Round {i} answer from {self.label}:\n{turn['reply']}")
        return "\n\n".join(lines)


async def open_conversation(provider_id: str, new_chat: bool = True) -> Conversation:
    """Focus or open the tab for a service and return a Conversation for it."""
    spec = registry.get(provider_id)
    url = spec.get("new_chat_url") if new_chat else spec.get("url")
    page = await chrome_bridge.open_tab(
        url or spec.get("url", ""),
        match=spec.get("url", ""),
        force_new=bool(new_chat),
    )
    return Conversation(spec["id"], page, spec)


async def ask(provider_id: str, prompt: str, wait_seconds: int = 180, new_chat: bool = True) -> str:
    """One question, one answer."""
    conversation = await open_conversation(provider_id, new_chat=new_chat)
    return await conversation.ask(prompt, wait_seconds)


async def ask_many(
    provider_ids: List[str], prompt: str, wait_seconds: int = 180
) -> Dict[str, str]:
    """Ask several services the same thing at the same time."""
    ids = [p.strip().lower() for p in provider_ids if p and p.strip()]

    async def one(pid: str):
        try:
            return pid, await ask(pid, prompt, wait_seconds, new_chat=True)
        except Exception as exc:  # noqa: BLE001 - one dead service must not kill the rest
            return pid, f"[{pid} failed: {exc}]"

    results = await asyncio.gather(*(one(pid) for pid in ids))
    return dict(results)


async def check(provider_id: str) -> Dict[str, object]:
    """Report whether a service looks ready to drive, for the dashboard strip."""
    spec = registry.get(provider_id)
    try:
        page = await chrome_bridge.find_tab(spec.get("url", ""))
        if page is None:
            return {"id": spec["id"], "label": spec.get("label"), "ready": False, "detail": "no tab open"}
        box = await _first_visible(page, spec.get("input", []), timeout_ms=2500)
        return {
            "id": spec["id"],
            "label": spec.get("label"),
            "ready": box is not None,
            "detail": "ready" if box is not None else "tab open but no message box, check the sign in",
        }
    except Exception as exc:  # noqa: BLE001
        return {"id": spec["id"], "label": spec.get("label"), "ready": False, "detail": str(exc)}
