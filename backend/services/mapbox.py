"""
services/mapbox.py
──────────────────
Fetches live travel time + baseline and the route polyline
from the Mapbox Directions API.

Profile: driving-traffic (live traffic-aware routing)
Docs: https://docs.mapbox.com/api/navigation/directions/
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from core.config import get_settings

log = logging.getLogger(__name__)

MAPBOX_BASE = "https://api.mapbox.com/directions/v5/mapbox"

# Baseline profile uses driving (no live traffic) for comparison
LIVE_PROFILE = "driving-traffic"
BASE_PROFILE = "driving"


@dataclass
class RouteResult:
    live_duration_min: float         # seconds → minutes, live traffic
    baseline_duration_min: float     # seconds → minutes, no traffic
    polyline: str                    # encoded polyline (precision 5)
    distance_km: float


async def get_route(
    home_lat: float,
    home_lng: float,
    office_lat: float,
    office_lng: float,
) -> RouteResult:
    """
    Query Mapbox Directions for both live-traffic and baseline durations.
    Falls back to a mock result if the API key is missing or the request fails.
    """
    settings = get_settings()

    if not settings.mapbox_token or settings.demo_mode:
        return _mock_result()

    coords = f"{home_lng},{home_lat};{office_lng},{office_lat}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        live_dur, polyline, distance = await _fetch_route(
            client, LIVE_PROFILE, coords, settings.mapbox_token
        )
        base_dur, *_ = await _fetch_route(
            client, BASE_PROFILE, coords, settings.mapbox_token
        )

    return RouteResult(
        live_duration_min=live_dur / 60,
        baseline_duration_min=base_dur / 60,
        polyline=polyline,
        distance_km=distance / 1000,
    )


async def _fetch_route(
    client: httpx.AsyncClient, profile: str, coords: str, token: str
) -> tuple[float, str, float]:
    """Return (duration_seconds, polyline_str, distance_meters)."""
    url = f"{MAPBOX_BASE}/{profile}/{coords}"
    params = {
        "access_token": token,
        "geometries": "polyline",
        "overview": "simplified",
    }
    try:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        route = data["routes"][0]
        return (
            route["duration"],
            route["geometry"],
            route["distance"],
        )
    except Exception as exc:
        log.warning("Mapbox request failed (%s), using mock", exc)
        return 1800.0, "", 8000.0


def _mock_result() -> RouteResult:
    """Return plausible demo data for Kolkata (Salt Lake → Park Street)."""
    return RouteResult(
        live_duration_min=42.0,
        baseline_duration_min=28.0,
        polyline="",
        distance_km=9.2,
    )
