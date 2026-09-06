"""
models/schemas.py
─────────────────
Pydantic v2 request / response models for the evaluate-commute endpoint.
These are the canonical API contracts described in the plan (§5).
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ── Sub-models ────────────────────────────────────────────────────────────────

class LatLng(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    lng: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")


class ScoreFactor(BaseModel):
    name: str                         # human-readable label
    contribution: float               # points this factor added (0–max)
    max_contribution: float           # cap for this factor
    detail: str                       # short explanation


class Verdict(str, Enum):
    WFH = "WFH"
    WFO = "WFO"
    MANDATORY_WFH = "MANDATORY_WFH"   # triggered by override conditions
    LEAVE_NOW = "LEAVE_NOW"           # return trip: clear or impending rain
    WAIT_IT_OUT = "WAIT_IT_OUT"       # return trip: wait for traffic/rain to pass
    STAY_IN_OFFICE = "STAY_IN_OFFICE" # return trip: mandatory stay


# ── Request ───────────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    home_location: LatLng
    office_location: LatLng
    departure_time: datetime = Field(
        default_factory=datetime.utcnow,
        description="ISO-8601 UTC departure time",
    )
    is_return_trip: bool = Field(
        default=False,
        description="If True, commutes from office to home.",
    )


# ── Response ──────────────────────────────────────────────────────────────────

class EvaluateResponse(BaseModel):
    verdict: Verdict
    score: float = Field(..., ge=0, le=100, description="Commute Friction Score (0–100)")
    threshold: int = Field(65, description="Score at which WFH is recommended")
    primary_factor: str              # e.g. "Past Rainfall" — the top contributor
    factors: list[ScoreFactor]       # detailed breakdown
    override_reason: Optional[str] = None   # set when score is forced to 100
    commute_duration_live_min: Optional[float] = None   # live travel time
    commute_duration_baseline_min: Optional[float] = None  # baseline travel time
    precipitation_past_6h_mm: Optional[float] = None
    precipitation_next_6h_mm: Optional[float] = None
    alerts: list[str] = Field(default_factory=list)  # scraped alert snippets
    cache_last_updated: Optional[datetime] = None
    demo_mode: bool = False
