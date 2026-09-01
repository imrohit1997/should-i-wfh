"""
core/cache.py
─────────────
Thread-safe in-memory cache for Selenium scraper alerts.
The scraper daemon writes alert flags here; the evaluate
endpoint reads from it without hitting the network.
"""

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class AlertCacheEntry:
    """Represents a single scraped alert event."""
    source: str                         # e.g. "kolkata_traffic_police"
    keywords_matched: list[str]         # e.g. ["waterlogging", "EM Bypass"]
    raw_text: str                        # original scraped snippet
    captured_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AlertCache:
    """
    A simple in-memory store for scraper results.

    Thread-safety: A single RLock protects all mutations so the
    scraper daemon (background thread) and the FastAPI request
    handlers can access the cache concurrently without data races.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._entries: list[AlertCacheEntry] = []
        self._last_updated: Optional[datetime] = None

    # ── Write ────────────────────────────────────────────────────────────

    def update(self, entries: list[AlertCacheEntry]) -> None:
        """Replace all current entries with a fresh batch from the scraper."""
        with self._lock:
            self._entries = entries
            self._last_updated = datetime.now(timezone.utc)

    # ── Read ─────────────────────────────────────────────────────────────

    def get_all(self) -> list[AlertCacheEntry]:
        """Return a snapshot of all current alerts."""
        with self._lock:
            return list(self._entries)

    def has_waterlogging(self) -> bool:
        """True if any active alert contains the 'waterlogging' keyword."""
        with self._lock:
            return any(
                "waterlogging" in kw.lower()
                for entry in self._entries
                for kw in entry.keywords_matched
            )

    @property
    def last_updated(self) -> Optional[datetime]:
        with self._lock:
            return self._last_updated


# ── Singleton ─────────────────────────────────────────────────────────────────

alert_cache = AlertCache()
