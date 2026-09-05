"""
core/config.py
──────────────
Centralised settings loaded from environment / .env file.
Pydantic-settings validates types at startup so misconfigured
deployments fail fast rather than silently returning bad data.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # ── Mapbox ─────────────────────────────────────────────────────────────
    mapbox_token: str = ""

    # ── TomTom ─────────────────────────────────────────────────────────────
    tomtom_api_key: str = ""

    # ── WeatherAPI ─────────────────────────────────────────────────────────
    weather_api_key: str = ""
    weather_api_base_url: str = "http://api.weatherapi.com/v1"

    # ── Scraper ────────────────────────────────────────────────────────────
    scraper_interval_seconds: int = 900          # 15 minutes

    # ── App behaviour ──────────────────────────────────────────────────────
    demo_mode: bool = False                       # Return mock data when True

    # ── CORS ───────────────────────────────────────────────────────────────
    allowed_origins: str = "http://localhost:5173,http://localhost:4173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (safe to call repeatedly)."""
    return Settings()
