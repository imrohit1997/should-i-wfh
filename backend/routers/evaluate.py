"""
routers/evaluate.py
────────────────────
POST /api/v1/evaluate-commute

Orchestrates parallel data fetching and calls the scorer.
Returns a structured EvaluateResponse.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from core.cache import alert_cache
from core.config import get_settings
from core.scorer import compute_score
from models.schemas import EvaluateRequest, EvaluateResponse, Verdict
from services.mapbox import get_route
from services.tomtom import get_incidents
from services.weather import get_precipitation

log = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/evaluate-commute",
    response_model=EvaluateResponse,
    summary="Compute the Commute Friction Score",
    description=(
        "Accepts home & office coordinates plus a departure time. "
        "Returns a WFH/WFO verdict, detailed score breakdown, and "
        "the primary contributing factor."
    ),
)
async def evaluate_commute(payload: EvaluateRequest) -> EvaluateResponse:
    settings = get_settings()

    home = payload.home_location
    office = payload.office_location
    is_return_trip = payload.is_return_trip

    origin = office if is_return_trip else home
    destination = home if is_return_trip else office

    # ── Parallel data fetch ────────────────────────────────────────────────────
    route_task = asyncio.create_task(
        get_route(origin.lat, origin.lng, destination.lat, destination.lng)
    )
    weather_task = asyncio.create_task(
        get_precipitation(origin.lat, origin.lng)
    )
    incidents_task = asyncio.create_task(
        get_incidents(origin.lat, origin.lng, destination.lat, destination.lng)
    )

    route, (past_rain, future_rain), incidents = await asyncio.gather(
        route_task, weather_task, incidents_task
    )

    # ── Alert cache ────────────────────────────────────────────────────────────
    waterlogging_alert = alert_cache.has_waterlogging()
    cached_alerts = [e.raw_text for e in alert_cache.get_all()]

    # ── Score ──────────────────────────────────────────────────────────────────
    score, verdict, override_reason, factors = compute_score(
        past_rain_mm=past_rain,
        future_rain_mm=future_rain,
        live_commute_min=route.live_duration_min,
        baseline_commute_min=route.baseline_duration_min,
        road_closed_on_route=incidents.road_closed_on_route,
        waterlogging_alert=waterlogging_alert,
        is_return_trip=is_return_trip,
    )

    # Primary factor label
    primary_factor = (
        override_reason.split("(")[0].strip()
        if override_reason
        else (max(factors, key=lambda f: f.contribution).name if factors else "N/A")
    )

    # Include TomTom incident summaries in alert list
    all_alerts = cached_alerts + incidents.summaries

    return EvaluateResponse(
        verdict=verdict,
        score=score,
        threshold=65,
        primary_factor=primary_factor,
        factors=factors,
        override_reason=override_reason,
        commute_duration_live_min=route.live_duration_min,
        commute_duration_baseline_min=route.baseline_duration_min,
        precipitation_past_6h_mm=past_rain,
        precipitation_next_6h_mm=future_rain,
        alerts=all_alerts,
        cache_last_updated=alert_cache.last_updated,
        demo_mode=settings.demo_mode or not settings.mapbox_token,
    )
