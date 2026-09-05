# Should I WFH? — Commute Friction Engine

> Real-time weather, traffic, and hyperlocal alert analysis for Kolkata commuters.

---

## What it does

Computes a **Commute Friction Score** (0–100) from three live data sources:

| Factor | Weight | Data source |
|---|---|---|
| Past 6h rainfall (waterlogging proxy) | 40 pts | Open-Meteo |
| Next 6h rainfall (active rain) | 20 pts | Open-Meteo |
| Live traffic delay vs baseline | 40 pts | Mapbox Directions |

**Override triggers** → score forced to 100 (Mandatory WFH):
- TomTom reports a `ROAD_CLOSED` on your route
- Selenium scraper flags a *waterlogging* alert from local traffic feeds

**Verdict thresholds:**
- `< 65` → **WFO** (go to office)
- `≥ 65` → **WFH** (stay home)
- Override → **Mandatory WFH**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python · FastAPI · Uvicorn |
| Scraper daemon | Selenium · webdriver-manager |
| Frontend | React · Vite · Mapbox GL JS |
| Weather data | Open-Meteo (free, no key) |
| Routing | Mapbox Directions API |
| Incidents | TomTom Traffic Incidents API |

---

## Project Structure

```
should_I_WFH/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── routers/evaluate.py  # POST /api/v1/evaluate-commute
│   ├── services/
│   │   ├── mapbox.py        # Live + baseline travel time
│   │   ├── weather.py       # Open-Meteo precipitation
│   │   ├── tomtom.py        # Incident detection
│   │   └── scraper.py       # Selenium scraper daemon
│   ├── core/
│   │   ├── config.py        # Pydantic settings
│   │   ├── scorer.py        # Friction Score algorithm
│   │   └── cache.py         # Thread-safe alert cache
│   ├── models/schemas.py    # Pydantic request/response
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── LocationSearch.jsx
    │   │   ├── MapPicker.jsx
    │   │   ├── ScoreGauge.jsx
    │   │   ├── ResultCard.jsx
    │   │   └── FactorList.jsx
    │   └── api/client.js
    └── vite.config.js
```

---

## Quick Start

### 1 — Clone & configure

```bash
cd backend
copy .env.example .env
# Edit .env and add your Mapbox + TomTom keys
```

### 2 — Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/health` to verify.

> **Demo mode**: If you don't add API keys, set `DEMO_MODE=true` in `.env`.
> The app returns plausible mock data so you can explore the UI immediately.

### 3 — Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — the Vite dev server proxies `/api` to port 8000.

---

## UI / UX & Responsiveness

The frontend is designed with an emphasis on **responsive layouts** across devices:
- **Mobile First**: Dynamic viewport-based (`vh`) heights are used for the map container and search dropdowns to prevent overflow on smaller devices and adapt seamlessly to any screen height.
- **Desktop Modes**:
  - The main application layout utilizes CSS Grid to display a split-view on desktop (Left panel with location inputs and About section, Right section spanning the full height with the interactive map).
  - The Verdict pop-up expands into a spacious landscape grid side-by-side mode on desktop displays, completely eliminating the need for vertical scrolling.

---

## API Keys (Free Tier)

| Service | Sign up | Free tier |
|---|---|---|
| **Mapbox** | [mapbox.com](https://www.mapbox.com) | 50k requests/month |
| **TomTom** | [developer.tomtom.com](https://developer.tomtom.com) | 2,500 requests/day |
| **Open-Meteo** | — | Unlimited (no key needed) |

Add keys to `backend/.env`:

```env
MAPBOX_TOKEN=pk.xxxxxxxx
TOMTOM_API_KEY=xxxxxxxx
```

---

## API Reference

### `POST /api/v1/evaluate-commute`

**Request:**
```json
{
  "home_location":   { "lat": 22.5726, "lng": 88.3639 },
  "office_location": { "lat": 22.5780, "lng": 88.4310 }
}
```

**Response:**
```json
{
  "verdict": "WFH",
  "score": 72.5,
  "threshold": 65,
  "primary_factor": "Past Rainfall (6h)",
  "factors": [...],
  "commute_duration_live_min": 42,
  "commute_duration_baseline_min": 28,
  "precipitation_past_6h_mm": 18.5,
  "precipitation_next_6h_mm": 4.2,
  "alerts": ["Minor congestion near Ultadanga flyover"],
  "demo_mode": false
}
```

Interactive docs: `http://localhost:8000/docs`

---

## Deployment

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Cloudflare Pages / Vercel | Static, auto-deploys from git |
| Backend | Render / SnapDeploy | Free Docker-native hosting |

Set `VITE_MAPBOX_TOKEN` as a frontend environment variable on Cloudflare/Vercel.
Set all backend env vars in the hosting dashboard.

---

## Scraper Notes

The Selenium daemon scrapes the Kolkata Traffic Police feed every 15 minutes.
It requires **Google Chrome** installed on the host (webdriver-manager auto-downloads ChromeDriver).

To disable scraping (e.g. in CI), the daemon logs a warning and exits gracefully if Selenium is unavailable.
