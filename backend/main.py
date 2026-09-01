"""
main.py
────────
FastAPI application entry point.

Startup sequence:
  1. Load settings (validates env vars)
  2. Start Selenium scraper daemon (background thread)
  3. Mount API router under /api/v1
  4. Serve

Run locally:
  cd backend
  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.cache import alert_cache
from core.config import get_settings
from routers.evaluate import router as evaluate_router
from services.scraper import start_scraper_daemon

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: runs startup logic before yield, teardown after."""
    settings = get_settings()
    log.info("Starting WFH Decision Engine (demo_mode=%s)", settings.demo_mode)

    # Start Selenium scraper in a daemon thread
    start_scraper_daemon(alert_cache)

    yield  # ← app is running here

    log.info("Shutting down WFH Decision Engine")


# ── App ───────────────────────────────────────────────────────────────────────

settings = get_settings()

app = FastAPI(
    title="WFH Decision Engine",
    description=(
        "Proactive commute-analysis tool that evaluates real-time weather, "
        "traffic, and hyper-local alerts to recommend WFH or WFO."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(evaluate_router, prefix="/api/v1")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Meta"])
async def health():
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "mapbox_configured": bool(settings.mapbox_token),
        "tomtom_configured": bool(settings.tomtom_api_key),
    }
