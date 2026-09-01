"""
core/scorer.py
──────────────
The Commute Friction Score algorithm as specified in the plan (§4).

Weight distribution
───────────────────
  Past rainfall  (0–40 pts) : waterlogging persists after rain stops
  Future rainfall(0–20 pts) : active rain during commute window
  Traffic delay  (0–40 pts) : live travel time vs baseline

Override triggers (score → 100 / Mandatory WFH)
────────────────────────────────────────────────
  • TomTom ROAD_CLOSED on route
  • Selenium scraper flags waterlogging on route node
"""

from __future__ import annotations

from models.schemas import ScoreFactor, Verdict


WFH_THRESHOLD = 65          # score >= this → WFH
PAST_RAIN_MAX = 40.0
FUTURE_RAIN_MAX = 20.0
TRAFFIC_MAX = 40.0


def _past_rain_score(mm: float) -> tuple[float, str]:
    """
    0-10mm  → 0 pts
    10-30mm → linear 0→20 pts  (plan says "linear scale to 20 points")
    >30mm   → 40 pts (full weight)
    """
    if mm <= 0:
        return 0.0, "No significant past rainfall"
    if mm <= 10:
        return 0.0, f"Light past rain ({mm:.1f}mm) — no waterlogging risk"
    if mm <= 30:
        pts = ((mm - 10) / 20) * 20  # linear 0→20
        return round(pts, 1), f"Moderate past rain ({mm:.1f}mm) — some waterlogging risk"
    return PAST_RAIN_MAX, f"Heavy past rain ({mm:.1f}mm) — high waterlogging risk"


def _future_rain_score(mm: float) -> tuple[float, str]:
    """Linear map: 0mm → 0 pts, 10mm+ → 20 pts."""
    if mm <= 0:
        return 0.0, "No rain expected during commute"
    pts = min(mm / 10.0, 1.0) * FUTURE_RAIN_MAX
    return round(pts, 1), f"Expected rain: {mm:.1f}mm in next 6h"


def _traffic_score(live_min: float, baseline_min: float) -> tuple[float, str]:
    """
    Delay % = (live - baseline) / baseline.
    50% delay → full 40 pts (plan: "a 50% increase … maxes out this category").
    """
    if baseline_min <= 0:
        return 0.0, "No baseline travel time available"
    delay_pct = max(0.0, (live_min - baseline_min) / baseline_min)
    pts = min(delay_pct / 0.50, 1.0) * TRAFFIC_MAX
    delay_display = (live_min - baseline_min)
    return round(pts, 1), (
        f"Live commute {live_min:.0f}min vs baseline {baseline_min:.0f}min "
        f"(+{delay_display:.0f}min, {delay_pct * 100:.0f}% slower)"
    )


def compute_score(
    *,
    past_rain_mm: float,
    future_rain_mm: float,
    live_commute_min: float,
    baseline_commute_min: float,
    road_closed_on_route: bool,
    waterlogging_alert: bool,
) -> tuple[float, Verdict, str | None, list[ScoreFactor]]:
    """
    Returns (score, verdict, override_reason, factors).
    """

    # ── Override triggers ────────────────────────────────────────────────
    if road_closed_on_route:
        reason = "Road closure detected directly on your route (TomTom)"
        return 100.0, Verdict.MANDATORY_WFH, reason, []
    if waterlogging_alert:
        reason = "Active waterlogging alert on a major route node (local scraper)"
        return 100.0, Verdict.MANDATORY_WFH, reason, []

    # ── Factor calculation ────────────────────────────────────────────────
    pr_pts, pr_detail = _past_rain_score(past_rain_mm)
    fr_pts, fr_detail = _future_rain_score(future_rain_mm)
    tr_pts, tr_detail = _traffic_score(live_commute_min, baseline_commute_min)

    factors = [
        ScoreFactor(
            name="Past Rainfall (6h)",
            contribution=pr_pts,
            max_contribution=PAST_RAIN_MAX,
            detail=pr_detail,
        ),
        ScoreFactor(
            name="Upcoming Rainfall (6h)",
            contribution=fr_pts,
            max_contribution=FUTURE_RAIN_MAX,
            detail=fr_detail,
        ),
        ScoreFactor(
            name="Traffic Delay",
            contribution=tr_pts,
            max_contribution=TRAFFIC_MAX,
            detail=tr_detail,
        ),
    ]

    score = pr_pts + fr_pts + tr_pts
    score = min(round(score, 1), 100.0)

    # Primary factor = highest contributor
    primary = max(factors, key=lambda f: f.contribution)

    verdict = Verdict.WFH if score >= WFH_THRESHOLD else Verdict.WFO

    return score, verdict, None, factors
