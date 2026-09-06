/**
 * App.jsx
 * ────────
 * Root application component.
 *
 * Layout:
 *   Header
 *   ├── Sidebar (controls)
 *   │    ├── Location selector (home / office)
 *   │    ├── Departure time picker
 *   │    └── Evaluate button
 *   └── Map  +  Result panel (right / below on mobile)
 */

import { useState, useCallback } from 'react'
import MapPicker from './components/MapPicker'
import ResultCard from './components/ResultCard'
import LocationSearch from './components/LocationSearch'
import { evaluateCommute } from './api/client'

// Mapbox public token — read from env or fall back to empty string (triggers demo mode)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

// Default Kolkata locations for demo convenience
const DEFAULT_HOME   = { lat: 22.5726, lng: 88.3639, name: 'Esplanade, Kolkata, West Bengal, India' }
const DEFAULT_OFFICE = { lat: 22.5780, lng: 88.4310, name: 'Sector V, Salt Lake, Kolkata, West Bengal, India' }

// Removed formatDateTime and defaultDeparture since we evaluate for "now"

function formatCoord(loc) {
  if (!loc) return 'Not set — click map'
  return `${loc.lat.toFixed(4)}°N, ${loc.lng.toFixed(4)}°E`
}

/* ── About Section ──────────────────────────────────────────────── */
function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-section-inner">
        {/* Header */}
        <div>
          <div className="about-header">
            <div className="about-header-icon" aria-hidden>ℹ️</div>
            <div>
              <h2 className="about-title">About This App</h2>
              <div className="about-subtitle">Commute Friction Engine · v1.0</div>
            </div>
          </div>
          <p className="about-description" style={{ marginTop: '0.75rem' }}>
            <strong>Should I WFH?</strong> is a real-time commute analysis tool designed for Kolkata.
            It aggregates live weather data, traffic conditions, and hyperlocal alerts to compute a
            <em> Commute Friction Score</em> — a single number from 0–100 that tells you whether
            it's worth braving your commute today.
          </p>
        </div>

        <hr className="about-divider" />

        {/* Feature Cards */}
        <div>
          <p className="panel-title">✨ Key Features</p>
          <div className="about-cards-grid">
            <div className="about-card">
              <div className="about-card-icon">🌧️</div>
              <div className="about-card-title">Rain-Aware Scoring</div>
              <div className="about-card-text">
                Factors in past 6 hours and upcoming 6 hours of precipitation. Waterlogging
                persists long after rain stops — our algorithm accounts for that.
              </div>
            </div>
            <div className="about-card">
              <div className="about-card-icon">🚗</div>
              <div className="about-card-title">Live Traffic Analysis</div>
              <div className="about-card-text">
                Compares your real-time commute duration against the historical baseline
                to measure actual delay percentage on your route.
              </div>
            </div>
            <div className="about-card">
              <div className="about-card-icon">🚨</div>
              <div className="about-card-title">Override Triggers</div>
              <div className="about-card-text">
                Automatically flags mandatory WFH when road closures or waterlogging
                events are detected directly on your commute path.
              </div>
            </div>
          </div>
        </div>

        <hr className="about-divider" />

        {/* How It Works */}
        <div>
          <p className="panel-title">⚙️ How It Works</p>
          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <div className="step-title">Set Your Locations</div>
                <div className="step-desc">
                  Pin your home and office on the map, or search by name. The app remembers
                  your locations for convenience.
                </div>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <div className="step-title">Fetch Real-Time Data</div>
                <div className="step-desc">
                  The backend fires parallel async requests to Mapbox (driving time),
                  Open-Meteo (rainfall), and TomTom (traffic incidents) to build a complete picture.
                </div>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <div className="step-title">Compute the Friction Score</div>
                <div className="step-desc">
                  A weighted algorithm calculates your score: Past Rainfall (40%), Current/Future
                  Rainfall (20%), and Traffic Delay (40%). A score ≥ 65 means WFH.
                </div>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">4</div>
              <div className="step-content">
                <div className="step-title">Get Your Verdict</div>
                <div className="step-desc">
                  Receive a clear WFO, WFH, or Mandatory WFH recommendation along with a
                  detailed breakdown of each contributing factor.
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="about-divider" />

        {/* APIs Used */}
        <div>
          <p className="panel-title">🔌 APIs & Data Sources</p>
          <div className="api-list">
            <div className="api-badge">
              <div className="api-badge-icon mapbox">🗺️</div>
              <div className="api-badge-content">
                <div className="api-badge-name">Mapbox Directions API</div>
                <div className="api-badge-desc">
                  Provides driving-traffic routing with real-time travel duration and
                  route polylines for visual display.
                </div>
              </div>
              <span className="api-badge-tag freemium">Freemium</span>
            </div>
            <div className="api-badge">
              <div className="api-badge-icon openmeteo">🌦️</div>
              <div className="api-badge-content">
                <div className="api-badge-name">WeatherAPI</div>
                <div className="api-badge-desc">
                  Provides comprehensive weather data including historical and forecast precipitation
                  grids for past 6h and next 6h windows.
                </div>
              </div>
              <span className="api-badge-tag freemium">Freemium</span>
            </div>
            <div className="api-badge">
              <div className="api-badge-icon tomtom">🚦</div>
              <div className="api-badge-content">
                <div className="api-badge-name">TomTom Traffic Incidents</div>
                <div className="api-badge-desc">
                  Real-time traffic incident data including road closures, accidents,
                  and construction on your commute bounding box.
                </div>
              </div>
              <span className="api-badge-tag freemium">Freemium</span>
            </div>
            <div className="api-badge">
              <div className="api-badge-icon geocoding">📍</div>
              <div className="api-badge-content">
                <div className="api-badge-name">Mapbox Geocoding API</div>
                <div className="api-badge-desc">
                  Forward and reverse geocoding for location search autocomplete
                  and human-readable address display.
                </div>
              </div>
              <span className="api-badge-tag freemium">Freemium</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [homeLocation,   setHomeLocation]   = useState(DEFAULT_HOME)
  const [officeLocation, setOfficeLocation] = useState(DEFAULT_OFFICE)
  const [isReturnTrip,   setIsReturnTrip]   = useState(false)
  const [activePin,      setActivePin]      = useState(null)
  const [result,         setResult]         = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState(null)

  const handleLocationSet = useCallback(async (type, lngLat) => {
    setActivePin(null)
    const locWithCoords = { ...lngLat, name: formatCoord(lngLat) }
    
    // Set temp coords immediately so marker moves instantly
    if (type === 'home') setHomeLocation(locWithCoords)
    if (type === 'office') setOfficeLocation(locWithCoords)

    // Reverse geocode
    if (MAPBOX_TOKEN) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place,neighborhood&limit=1`
        const res = await fetch(url)
        const data = await res.json()
        if (data.features && data.features.length > 0) {
          locWithCoords.name = data.features[0].place_name
        }
      } catch (err) {
        console.error('Reverse geocoding error:', err)
      }
    }

    if (type === 'home') setHomeLocation(locWithCoords)
    if (type === 'office') setOfficeLocation(locWithCoords)
  }, [])

  const handleUseGPS = async (type) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const locWithCoords = { lat: latitude, lng: longitude, name: 'Current Location' }
        if (MAPBOX_TOKEN) {
          try {
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place,neighborhood&limit=1`
            const res = await fetch(url)
            const data = await res.json()
            if (data.features && data.features.length > 0) {
              locWithCoords.name = data.features[0].place_name
            }
          } catch (err) {
            console.error('Reverse geocoding error:', err)
          }
        }
        if (type === 'home') setHomeLocation(locWithCoords)
        if (type === 'office') setOfficeLocation(locWithCoords)
        setLoading(false)
      },
      (err) => {
        setError('Could not get current location: ' + err.message)
        setLoading(false)
      }
    )
  }

  const handleEvaluate = async () => {
    if (!homeLocation || !officeLocation) return
    setLoading(true)
    setError(null)
    try {
      const data = await evaluateCommute({
        homeLocation,
        officeLocation,
        isReturnTrip,
      })
      setResult(data)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        'Could not reach the backend. Make sure it\'s running on port 8000.'
      )
    } finally {
      setLoading(false)
    }
  }

  const canEvaluate = homeLocation && officeLocation && !loading

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-logo" aria-hidden>🏠</div>
        <div>
          <div className="header-title">Should I WFH?</div>
          <div className="header-sub">Commute Friction Engine · Kolkata</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a href="#about" style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
            transition: 'color 0.2s'
          }} onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
             onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>
            About
          </a>
          <span className="header-badge">Live Analysis</span>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main>
        <div className="main-content">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="sidebar">

            {/* Location Selector */}
            <div className="panel">
              <p className="panel-title">📍 Your Locations</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative' }}>
                {/* Swap Button */}
                <div style={{ position: 'absolute', top: '50%', left: '1.25rem', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                  <button
                    onClick={() => setIsReturnTrip(!isReturnTrip)}
                    className="swap-button"
                    title="Swap locations"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'var(--bg-panel)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                    </svg>
                  </button>
                </div>

                {isReturnTrip ? (
                  <>
                    <LocationSearch
                      mapboxToken={MAPBOX_TOKEN}
                      placeholder="Office (Origin)"
                      value={officeLocation?.name || formatCoord(officeLocation)}
                      active={activePin === 'office'}
                      iconClass="office"
                      onClick={() => setActivePin(activePin === 'office' ? null : 'office')}
                      onSelect={(loc) => {
                        setOfficeLocation({ lat: loc.lngLat.lat, lng: loc.lngLat.lng, name: loc.name })
                        setActivePin(null)
                      }}
                      onUseGPS={() => handleUseGPS('office')}
                    />
                    <LocationSearch
                      mapboxToken={MAPBOX_TOKEN}
                      placeholder="Home (Destination)"
                      value={homeLocation?.name || formatCoord(homeLocation)}
                      active={activePin === 'home'}
                      iconClass="home"
                      onClick={() => setActivePin(activePin === 'home' ? null : 'home')}
                      onSelect={(loc) => {
                        setHomeLocation({ lat: loc.lngLat.lat, lng: loc.lngLat.lng, name: loc.name })
                        setActivePin(null)
                      }}
                    />
                  </>
                ) : (
                  <>
                    <LocationSearch
                      mapboxToken={MAPBOX_TOKEN}
                      placeholder="Home (Origin)"
                      value={homeLocation?.name || formatCoord(homeLocation)}
                      active={activePin === 'home'}
                      iconClass="home"
                      onClick={() => setActivePin(activePin === 'home' ? null : 'home')}
                      onSelect={(loc) => {
                        setHomeLocation({ lat: loc.lngLat.lat, lng: loc.lngLat.lng, name: loc.name })
                        setActivePin(null)
                      }}
                      onUseGPS={() => handleUseGPS('home')}
                    />
                    <LocationSearch
                      mapboxToken={MAPBOX_TOKEN}
                      placeholder="Office (Destination)"
                      value={officeLocation?.name || formatCoord(officeLocation)}
                      active={activePin === 'office'}
                      iconClass="office"
                      onClick={() => setActivePin(activePin === 'office' ? null : 'office')}
                      onSelect={(loc) => {
                        setOfficeLocation({ lat: loc.lngLat.lat, lng: loc.lngLat.lng, name: loc.name })
                        setActivePin(null)
                      }}
                    />
                  </>
                )}
              </div>
            </div>



            {/* CTA — desktop only (mobile has fixed bottom bar) */}
            <button
              id="btn-evaluate"
              className="btn-evaluate btn-evaluate-desktop"
              onClick={handleEvaluate}
              disabled={!canEvaluate}
              aria-busy={loading}
            >
              {loading
                ? <><div className="spinner" aria-hidden />&nbsp;Analysing commute…</>
                : '⚡ Should I WFH?'
              }
            </button>

            {/* Error */}
            {error && (
              <div className="alert-item" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                <span className="alert-icon" style={{ color: '#ef4444' }}>✕</span>
                <span>{error}</span>
              </div>
            )}

            {/* Result on mobile (below controls) */}
            <div className="result-mobile" style={{ display: 'none' }} aria-hidden="true">
              {/* Hidden on desktop — result shown in right column */}
            </div>

          </aside>

          {/* ── Map (right column on desktop) ────────────────────── */}
          <section className="map-section">

            {/* Map */}
            <div className="map-container">
              <MapPicker
                mapboxToken={MAPBOX_TOKEN}
                homeLocation={homeLocation}
                officeLocation={officeLocation}
                activePin={activePin}
                onLocationSet={handleLocationSet}
              />
            </div>

          </section>

        </div>

        {/* ── About Section ────────────────────────────────────────────── */}
        <AboutSection />

      </main>

      {/* ── Mobile bottom CTA bar ───────────────────────────────────────── */}
      <div className="mobile-cta-bar">
        <button
          id="btn-evaluate-mobile"
          className="btn-evaluate"
          onClick={handleEvaluate}
          disabled={!canEvaluate}
          aria-busy={loading}
        >
          {loading
            ? <><div className="spinner" aria-hidden />&nbsp;Analysing commute…</>
            : '⚡ Should I WFH?'
          }
        </button>
        {error && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        Commute Friction Engine · Data from Mapbox, WeatherAPI, TomTom · Built for Kolkata
      </footer>

      {/* ── Result Modal ──────────────────────────────────────────────────────── */}
      {result && (
        <div className="modal-overlay" onClick={() => setResult(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close" 
              onClick={() => setResult(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <ResultCard result={result} />
          </div>
        </div>
      )}
    </div>
  )
}
