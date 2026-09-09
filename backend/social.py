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
