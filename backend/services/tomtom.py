"""
services/tomtom.py
──────────────────
Queries the TomTom Traffic Incidents API for any active
incidents (specifically ROAD_CLOSED) that intersect with
the bounding box of the user's route.

Docs: https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

from core.config import get_settings

log = logging.getLogger(__name__)

TOMTOM_BASE = "https://api.tomtom.com/traffic/services/5/incidentDetails"

# Incident category codes from TomTom docs
ROAD_CLOSED_CATEGORIES = {6}     # 6 = Road Closed in TomTom taxonomy


@dataclass
class IncidentResult:
    road_closed_on_route: bool
    incident_count: int
    summaries: list[str] = field(default_factory=list)


async def get_incidents(
    home_lat: float,
    home_lng: float,
    office_lat: float,
    office_lng: float,
) -> IncidentResult:
    """
    Fetch incidents within the bounding box of the route.
    Falls back gracefully if the key is absent or the request fails.
    """
    settings = get_settings()

    if not settings.tomtom_api_key or settings.demo_mode:
        return _mock_result()

    # Compute bounding box with a small buffer
    min_lat = min(home_lat, office_lat) - 0.02
    max_lat = max(home_lat, office_lat) + 0.02
    min_lng = min(home_lng, office_lng) - 0.02
    max_lng = max(home_lng, office_lng) + 0.02

    bbox = f"{min_lat},{min_lng},{max_lat},{max_lng}"

    params = {
        "key": settings.tomtom_api_key,
        "bbox": bbox,
        "fields": "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,aci{probabilityOfOccurrence,numberOfReports,lastReportTime}}}}",
        "language": "en-GB",
        "categoryFilter": "0,1,2,3,4,5,6,7,8,9,10,11,14",
        "timeValidityFilter": "present",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(TOMTOM_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()

        incidents = data.get("incidents", [])
        road_closed = False
        summaries: list[str] = []

        for inc in incidents:
            props = inc.get("properties", {})
            category = props.get("iconCategory", -1)
            if category in ROAD_CLOSED_CATEGORIES:
                road_closed = True
            events = props.get("events", [])
            for ev in events:
                desc = ev.get("description", "")
                if desc:
                    summaries.append(desc)

        return IncidentResult(
            road_closed_on_route=road_closed,
            incident_count=len(incidents),
            summaries=summaries[:5],   # cap at 5 for the response payload
        )

    except Exception as exc:
        log.warning("TomTom request failed (%s), assuming no incidents", exc)
        return IncidentResult(road_closed_on_route=False, incident_count=0)


def _mock_result() -> IncidentResult:
    """Demo mode — no closures, one minor incident."""
    return IncidentResult(
        road_closed_on_route=False,
        incident_count=1,
        summaries=["Minor congestion near Ultadanga flyover"],
    )
