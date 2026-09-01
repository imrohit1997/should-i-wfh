# Technical Design Document: WFH vs WFO Decision Engine
    
## 1. System Overview
The WFH vs WFO Decision Engine is a proactive commute-analysis tool designed to evaluate real-time weather, traffic, and hyper-local alerts to recommend the optimal work location. The system aggregates data from freemium external APIs and custom scrapers to compute a "Commute Friction Score."

## 2. Architecture & Tech Stack

### 2.1 Core Stack (The "Two-Piece" Stack)
*   **Backend API:** Python (FastAPI). Lightweight, highly concurrent, and native support for async API calls to external data providers.
*   **Web Scraper Submodule:** Python with **Selenium** and **Telethon**. Selenium is utilized for robust, headless browser scraping of dynamic social media feeds (e.g., Kolkata Traffic Police), while Telethon handles automated push notifications to Telegram.
*   **Frontend:** React.js or Vue.js (built with Vite for static hosting).

### 2.2 Deployment & Hosting
*   **Frontend Deployment:** **Cloudflare Pages** or **Vercel**. Provides automated Git deployments and unlimited bandwidth for the static frontend.
*   **Backend Deployment:** **Render** (750 free hours/month) or **SnapDeploy** (free Docker-native tier). This managed approach abstracts away the deeper VPC configurations, load balancing, and instance management typically required when architecting environments on AWS, keeping the deployment entirely cost-free and maintenance-light.

### 2.3 External Data Integrations
*   **Geocoding & Routing:** Mapbox Directions API (`profile=driving-traffic`).
*   **Weather Data:** Open-Meteo API (Historical & Forecast Precipitation).
*   **Incident Data:** TomTom Traffic Incidents API.

---

## 3. Data Flow & Component Design

### 3.1 The Request Pipeline
1.  **Input:** User provides Home and Office coordinates (via map pin-drop on the UI).
2.  **Parallel Data Fetching:** The backend initiates asynchronous requests:
    *   `GET` Mapbox API for live travel time.
    *   `GET` Open-Meteo for past 6h and next 6h precipitation grids.
    *   `GET` TomTom API for active incidents on the bounding box of the route.
    *   `READ` local cache for the latest scraped traffic alerts.
3.  **Computation:** The Decision Algorithm processes the normalized data.
4.  **Output:** Returns a JSON response containing the final score, verdict, and the primary contributing factor.

### 3.2 The Alert Scraper Daemon (Selenium)
To bypass the lack of localized weather impact data (like waterlogging), a background Python script runs periodically (e.g., every 15 minutes during morning hours):
*   Initializes a headless Selenium WebDriver.
*   Navigates to local traffic authority feeds.
*   Extracts text and applies a keyword intersection matrix (`['waterlogging', 'slow', 'diversion']` + `[Route Street Names]`).
*   Saves active flags to the backend cache.

---

## 4. Decision Algorithm (The Friction Score)

The system calculates a base score out of 100. A score >= 65 triggers a WFH recommendation.

### 4.1 Weight Distribution
*   **Past Rainfall (40%):** Waterlogging persists after the rain stops.
    *   *Logic:* 0-10mm = 0 points. 10-30mm = linear scale to 20 points. >30mm = 40 points.
*   **Current/Future Rainfall (20%):** Active rain during the commute window.
    *   *Logic:* Base precipitation rate mapped linearly to a max of 20 points.
*   **Traffic Delay (40%):** Calculated from Mapbox live traffic vs baseline.
    *   *Logic:* Delay % * multiplier. E.g., a 50% increase in travel time maxes out this category at 40 points.

### 4.2 The Override Triggers (Multiplier: Infinity)
Regardless of the baseline score, the system automatically returns `100` (Mandatory WFH) if:
*   The TomTom API flags a `ROAD_CLOSED` incident directly intersecting the Mapbox polyline.
*   The Selenium scraper flags a "waterlogging" event on a major node in the user's route.

---

## 5. API Contracts

### 5.1 Endpoint: `/api/v1/evaluate-commute`
**Method:** POST
**Payload:**
```json
{
  "home_location": {"lat": 22.5726, "lng": 88.3639},
  "office_location": {"lat": 22.5780, "lng": 88.4310},
  "departure_time": "2026-09-02T08:30:00Z"
}