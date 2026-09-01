"""
services/weather.py
────────────────────
Fetches precipitation data from the Open-Meteo API.
No API key required — completely free for non-commercial use.

We request:
  • Hourly precipitation for the past 6 h  (historical endpoint)
  • Hourly precipitation for the next 6 h  (forecast endpoint)

Docs: https://open-meteo.com/en/docs
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

from core.config import get_settings

log = logging.getLogger(__name__)


async def get_precipitation(lat: float, lng: float) -> tuple[float, float]:
    """
    Returns (past_6h_mm, next_6h_mm) precipitation totals.
    Falls back to (0, 0) on failure.
    """
    settings = get_settings()

    if settings.demo_mode:
        return _mock()

    now = datetime.now(timezone.utc)
    past_start = now - timedelta(hours=6)
    future_end = now + timedelta(hours=6)

    date_fmt = "%Y-%m-%d"
    params = {
        "latitude": lat,
        "longitude": lng,
        "hourly": "precipitation",
        "start_date": past_start.strftime(date_fmt),
        "end_date": future_end.strftime(date_fmt),
        "timezone": "UTC",
    }

    url = f"{settings.open_meteo_base_url}/forecast"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        times = data["hourly"]["time"]         # list of "YYYY-MM-DDTHH:00"
        precip = data["hourly"]["precipitation"]

        past_total = 0.0
        future_total = 0.0

        for t_str, p in zip(times, precip):
            t = datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)
            if past_start <= t <= now:
                past_total += p or 0.0
            elif now < t <= future_end:
                future_total += p or 0.0

        return round(past_total, 2), round(future_total, 2)

    except Exception as exc:
        log.warning("Open-Meteo request failed (%s), using zeros", exc)
        return 0.0, 0.0


def _mock() -> tuple[float, float]:
    """Demo values — moderate past rain, light upcoming rain."""
    return 18.5, 4.2
