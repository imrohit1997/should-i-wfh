"""
services/weather.py
────────────────────
Fetches precipitation data from the WeatherAPI.com API.
Requires WEATHER_API_KEY in .env.

We request:
  • Hourly precipitation for the past 6 h (using history.json)
  • Hourly precipitation for the next 6 h (using forecast.json)

Implements a 15-minute TTL cache to prevent rate-limit 429s.
"""

from __future__ import annotations

import logging
import asyncio
import time
from datetime import datetime, timedelta, timezone

import httpx

from core.config import get_settings

log = logging.getLogger(__name__)

_WEATHER_CACHE: dict[tuple[float, float], tuple[float, float, float]] = {}
CACHE_TTL_SECONDS = 900  # 15 minutes


async def get_precipitation(lat: float, lng: float) -> tuple[float, float]:
    """
    Returns (past_6h_mm, next_6h_mm) precipitation totals.
    Falls back to (0, 0) on failure.
    """
    settings = get_settings()

    if settings.demo_mode or not settings.weather_api_key:
        return _mock()

    # Round to ~1km accuracy to improve cache hits
    cache_key = (round(lat, 2), round(lng, 2))
    now_ts = time.time()

    if cache_key in _WEATHER_CACHE:
        cached_ts, past_rain, future_rain = _WEATHER_CACHE[cache_key]
        if now_ts - cached_ts < CACHE_TTL_SECONDS:
            log.info("Weather cache hit for %s", cache_key)
            return past_rain, future_rain

    log.info("Weather cache miss for %s, fetching from WeatherAPI...", cache_key)
    
    now = datetime.now(timezone.utc)
    past_start = now - timedelta(hours=6)
    future_end = now + timedelta(hours=6)

    # Prepare concurrent requests to history (yesterday/today) and forecast (today/tomorrow)
    # We always fetch today and yesterday for history to be safe with timezone boundaries,
    # and forecast days=2 to cover today and tomorrow.
    
    q = f"{lat},{lng}"
    
    async def fetch(client: httpx.AsyncClient, url: str, params: dict) -> list[dict]:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            hours = []
            if "forecast" in data and "forecastday" in data["forecast"]:
                for fday in data["forecast"]["forecastday"]:
                    hours.extend(fday.get("hour", []))
            return hours
        except Exception as exc:
            log.warning("WeatherAPI request failed: %s for URL: %s", exc, url)
            return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            history_url = f"{settings.weather_api_base_url}/history.json"
            forecast_url = f"{settings.weather_api_base_url}/forecast.json"
            
            # Fetch yesterday's history in case the 6h window crosses midnight
            yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
            
            history_task = fetch(client, history_url, {
                "key": settings.weather_api_key,
                "q": q,
                "dt": yesterday_str
            })
            
            # Fetch forecast (covers today and tomorrow, getting both past and future hours)
            forecast_task = fetch(client, forecast_url, {
                "key": settings.weather_api_key,
                "q": q,
                "days": 2
            })
            
            history_hours, forecast_hours = await asyncio.gather(history_task, forecast_task)
            
            # Combine and deduplicate hours by time_epoch
            all_hours = {}
            for h in history_hours + forecast_hours:
                if "time_epoch" in h:
                    all_hours[h["time_epoch"]] = h
                    
            past_total = 0.0
            future_total = 0.0

            for epoch, h_data in all_hours.items():
                t = datetime.fromtimestamp(epoch, tz=timezone.utc)
                precip = float(h_data.get("precip_mm", 0.0))
                
                if past_start <= t <= now:
                    past_total += precip
                elif now < t <= future_end:
                    future_total += precip

            past_total = round(past_total, 2)
            future_total = round(future_total, 2)
            
            _WEATHER_CACHE[cache_key] = (now_ts, past_total, future_total)
            return past_total, future_total

    except Exception as exc:
        log.warning("Weather calculation failed (%s), using zeros", exc)
        return 0.0, 0.0


def _mock() -> tuple[float, float]:
    """Demo values — moderate past rain, light upcoming rain."""
    return 18.5, 4.2
