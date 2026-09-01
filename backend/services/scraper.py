"""
services/scraper.py
────────────────────
Background Selenium scraper daemon.

Runs on a configurable interval (default 15 min) as a
daemon thread started from the FastAPI lifespan event.

Target: Kolkata Traffic Police Twitter/X embedded feed.
Scraping strategy:
  1. Open a headless Chrome browser
  2. Navigate to the target page
  3. Extract visible text from tweet-like elements
  4. Apply keyword intersection against known route nodes
  5. Write matched alerts to the in-memory AlertCache

NOTE: If Selenium / Chrome is not available (e.g., CI environments),
      the scraper logs a warning and exits gracefully.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from datetime import datetime, timezone

from core.cache import AlertCache, AlertCacheEntry
from core.config import get_settings

log = logging.getLogger(__name__)

# ── Keyword sets ──────────────────────────────────────────────────────────────
ALERT_KEYWORDS = frozenset(
    ["waterlogging", "slow", "diversion", "block", "closed", "jam", "flood"]
)

# Major route nodes for Kolkata — extend as needed
ROUTE_KEYWORDS = frozenset([
    "em bypass", "ultadanga", "park street", "esplanade", "salt lake",
    "rashbehari", "gariahat", "dhakuria", "airport", "dumdum",
    "vip road", "belgachia", "sealdah", "howrah", "ruby",
])

TARGET_URL = "https://twitter.com/KolkataPolice"

# ─────────────────────────────────────────────────────────────────────────────


def _extract_alerts(page_text: str) -> list[AlertCacheEntry]:
    """
    Given the full page text, find paragraphs that contain
    both an alert keyword AND a route keyword.
    """
    entries: list[AlertCacheEntry] = []

    # Split on sentence-ish boundaries
    sentences = re.split(r"[\n.!?]+", page_text)

    for sentence in sentences:
        lower = sentence.lower()
        matched_alerts = [kw for kw in ALERT_KEYWORDS if kw in lower]
        matched_routes = [kw for kw in ROUTE_KEYWORDS if kw in lower]

        if matched_alerts and matched_routes:
            entries.append(
                AlertCacheEntry(
                    source="kolkata_traffic_police",
                    keywords_matched=matched_alerts + matched_routes,
                    raw_text=sentence.strip()[:280],  # 280-char cap
                )
            )

    return entries


def _run_scraper_once(cache: AlertCache) -> None:
    """Execute a single scrape cycle."""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.common.by import By
    except ImportError:
        log.warning("Selenium not available — skipping scrape cycle")
        return

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,900")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/120 Safari/537.36"
    )

    driver = None
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.get(TARGET_URL)

        # Wait up to 15s for tweet content to appear
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "article"))
        )

        page_text = driver.find_element(By.TAG_NAME, "body").text
        entries = _extract_alerts(page_text)
        cache.update(entries)
        log.info(
            "Scraper: %d alert(s) captured at %s",
            len(entries),
            datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        log.warning("Scraper cycle failed: %s", exc)
        # Don't wipe existing cache on failure — stale data is better than none
    finally:
        if driver:
            driver.quit()


def start_scraper_daemon(cache: AlertCache) -> threading.Thread:
    """
    Start the scraper as a background daemon thread.
    Returns the thread so the caller can join it if needed.
    """
    settings = get_settings()
    interval = settings.scraper_interval_seconds

    def _loop() -> None:
        log.info("Scraper daemon started (interval=%ds)", interval)
        while True:
            _run_scraper_once(cache)
            time.sleep(interval)

    thread = threading.Thread(target=_loop, name="scraper-daemon", daemon=True)
    thread.start()
    return thread
