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

export default function App() {
  const [homeLocation,   setHomeLocation]   = useState(DEFAULT_HOME)
  const [officeLocation, setOfficeLocation] = useState(DEFAULT_OFFICE)
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

  const handleEvaluate = async () => {
    if (!homeLocation || !officeLocation) return
    setLoading(true)
    setError(null)
    try {
      const data = await evaluateCommute({
        homeLocation,
        officeLocation,
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
        <span className="header-badge">Live Analysis</span>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main>
        <div className="main-content">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="sidebar">

            {/* Location Selector */}
            <div className="panel">
              <p className="panel-title">📍 Your Locations</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {/* Home */}
                <LocationSearch
                  mapboxToken={MAPBOX_TOKEN}
                  placeholder="Home"
                  value={homeLocation?.name || formatCoord(homeLocation)}
                  active={activePin === 'home'}
                  iconClass="home"
                  onClick={() => setActivePin(activePin === 'home' ? null : 'home')}
                  onSelect={(loc) => {
                    setHomeLocation({ lat: loc.lngLat.lat, lng: loc.lngLat.lng, name: loc.name })
                    setActivePin(null)
                  }}
                />

                {/* Office */}
                <LocationSearch
                  mapboxToken={MAPBOX_TOKEN}
                  placeholder="Office"
                  value={officeLocation?.name || formatCoord(officeLocation)}
                  active={activePin === 'office'}
                  iconClass="office"
                  onClick={() => setActivePin(activePin === 'office' ? null : 'office')}
                  onSelect={(loc) => {
                    setOfficeLocation({ lat: loc.lngLat.lat, lng: loc.lngLat.lng, name: loc.name })
                    setActivePin(null)
                  }}
                />
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

          {/* ── Map + Result (right column on desktop) ────────────────────── */}
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

            {/* Result card */}
            {result
              ? <ResultCard result={result} />
              : !loading && (
                  <div className="panel idle-state">
                    <div className="idle-icon" aria-hidden>🌧️</div>
                    <p className="idle-text">
                      Set your home and office locations on the map, pick a departure time,
                      and hit <strong>Should I WFH?</strong> to get your personalised commute verdict.
                    </p>
                  </div>
                )
            }
          </section>

        </div>
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
        Commute Friction Engine · Data from Mapbox, Open-Meteo, TomTom · Built for Kolkata
      </footer>
    </div>
  )
}
