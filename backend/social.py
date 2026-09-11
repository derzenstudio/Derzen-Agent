"""
DERZEN - Public social search and read.

Opens a platform's public search page in the scraping Chromium, pulls the
visible post text, then asks the local model what the mood and the themes are.
No accounts, no API keys, no logins. Platforms that hide everything behind a
login wall will return little, and the result says so instead of inventing it.
"""
from __future__ import annotations

from urllib.parse import quote_plus

import ai_manager
import rules
from automation import browser

SEARCH_URLS = {
    "twitter": "https://twitter.com/search?q={q}&f=live",
    "x": "https://x.com/search?q={q}&f=live",
    "instagram": "https://www.instagram.com/explore/tags/{q}/",
    "linkedin": "https://www.linkedin.com/search/results/content/?keywords={q}",
    "facebook": "https://www.facebook.com/search/posts/?q={q}",
    "reddit": "https://www.reddit.com/search/?q={q}&sort=new",
    "youtube": "https://www.youtube.com/results?search_query={q}",
    "tiktok": "https://www.tiktok.com/search?q={q}",
    "news": "https://news.google.com/search?q={q}",
}

LOGIN_WALLED = {"instagram", "facebook", "linkedin", "tiktok"}

PLATFORMS = sorted(SEARCH_URLS.keys())


def _search_url(platform: str, query: str) -> str:
    platform = (platform or "").strip().lower()
    if platform not in SEARCH_URLS:
        raise ValueError(
            f"Unsupported platform: {platform}. Pick one of {', '.join(PLATFORMS)}."
        )
    token = quote_plus(query.strip())
    if platform == "instagram":
        token = "".join(ch for ch in query.strip().lower() if ch.isalnum())
    return SEARCH_URLS[platform].format(q=token)


async def analyze(
    platform: str,
    query: str,
    post_count: int = 10,
    analyze_sentiment: bool = True,
) -> dict:
    """Search a platform and, when asked, summarise the mood and the themes."""
    platform = (platform or "twitter").strip().lower()
    url = _search_url(platform, query)
    scraped = await browser.scrape([url], max_chars=14000)
    raw_text = scraped.get(url, "") or ""

    thin = len(raw_text.strip()) < 400
    result: dict = {
        "platform": platform,
        "query": query,
        "url": url,
        "requested_posts": post_count,
        "chars": len(raw_text),
        "raw_excerpt": raw_text[:4000],
    }

    if thin:
        note = (
            f"{platform} returned almost no readable text. "
            + (
                "This platform hides search results behind a login, so public "
                "scraping cannot see them."
                if platform in LOGIN_WALLED
                else "The page may have loaded slowly or blocked the request."
            )
        )
        result["analysis"] = note
        result["thin"] = True
        return result

    if analyze_sentiment:
        prompt = (
            f"Below is the raw text of a {platform} search page for '{query}'. "
            f"Read up to {post_count} posts out of it. Report the overall mood "
            f"(positive, mixed or negative), the recurring themes, and anything "
            f"that looks like a trend. Ignore menus, buttons and advert text. "
            f"Stay under 220 words and do not invent posts that are not "
            f"there.\n\n{raw_text[:9000]}"
        )
        try:
            answer = await ai_manager.query(rules.wrap(prompt, True))
            result["analysis"] = rules.restyle(answer)
        except Exception as exc:  # noqa: BLE001
            result["analysis"] = f"(local model unavailable: {exc})"
    result["thin"] = False
    return result
"""
DERZEN - Social media analysis.

Uses the shared browser to open a platform's public search page for a query,
collects the visible post text, then asks the local AI to summarise sentiment
and themes. All heavy lifting reuses automation.browser and ai_manager so there
is no separate scraping stack to maintain.
"""
from __future__ import annotations

import ai_manager
from automation import browser

SEARCH_URLS = {
    "twitter": "https://twitter.com/search?q={q}&f=live",
    "instagram": "https://www.instagram.com/explore/tags/{q}/",
    "linkedin": "https://www.linkedin.com/search/results/content/?keywords={q}",
    "facebook": "https://www.facebook.com/search/posts/?q={q}",
}


def _search_url(platform: str, query: str) -> str:
    if platform not in SEARCH_URLS:
        raise ValueError(f"Unsupported platform: {platform}")
    from urllib.parse import quote_plus

    return SEARCH_URLS[platform].format(q=quote_plus(query.strip()))


async def analyze(
    platform: str,
    query: str,
    post_count: int = 10,
    analyze_sentiment: bool = True,
) -> dict:
    """Search a platform for a query and optionally summarise sentiment."""
    platform = platform.lower()
    url = _search_url(platform, query)
    scraped = await browser.scrape([url])
    raw_text = scraped.get(url, "")

    result: dict = {
        "platform": platform,
        "query": query,
        "requested_posts": post_count,
        "raw_excerpt": raw_text[:4000],
    }

    if analyze_sentiment and raw_text and not raw_text.startswith("[error"):
        prompt = (
            f"You are analysing up to {post_count} social posts from {platform} "
            f"about '{query}'. Below is the raw page text. Summarise the overall "
            f"sentiment (positive / neutral / negative), the main themes, and any "
            f"notable trends. Keep it under 200 words.\n\n{raw_text[:8000]}"
        )
        result["analysis"] = await ai_manager.query(prompt)
    return result
