/**
 * components/LocationSearch.jsx
 * ─────────────────────────────
 * Autocomplete input using the Mapbox Geocoding API.
 */

import { useState, useEffect, useRef } from 'react'

export default function LocationSearch({
  mapboxToken,
  placeholder,
  value,
  onSelect,
  active,
  onClick,
  icon,
  iconClass,
}) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Sync internal query state with external value when it changes (e.g. via map click)
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query || query === value || !mapboxToken) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&autocomplete=true&limit=5&proximity=88.3639,22.5726&country=in&language=en`
        const res = await fetch(url)
        const data = await res.json()
        setResults(data.features || [])
        setIsOpen(true)
      } catch (err) {
        console.error('Geocoding error:', err)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, mapboxToken, value])

  return (
    <div 
      ref={wrapperRef}
      className={`location-row ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{ position: 'relative', overflow: 'visible', padding: '0.5rem 0.75rem' }}
    >
      <span className={`location-dot ${iconClass}`} />
      
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div className="location-label" style={{ marginBottom: '2px' }}>{placeholder}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <input
            type="text"
            className="location-input"
            placeholder="Search location..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              padding: 0,
              minWidth: 0,
            }}
          />
          {query && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setQuery('')
                setResults([])
                setIsOpen(false)
              }}
              title="Clear"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0, paddingLeft: '0.5rem' }}>
        {active ? '✕ Cancel' : '✏️ Map'}
      </span>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <ul className="autocomplete-dropdown">
          {results.map((feature) => (
            <li 
              key={feature.id} 
              className="autocomplete-item"
              onClick={(e) => {
                e.stopPropagation()
                setQuery(feature.place_name)
                setIsOpen(false)
                onSelect({
                  name: feature.place_name,
                  lngLat: { lat: feature.center[1], lng: feature.center[0] }
                })
              }}
            >
              <div className="autocomplete-item-text">{feature.text}</div>
              <div className="autocomplete-item-sub">{feature.place_name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
