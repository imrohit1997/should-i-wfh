/**
 * components/MapPicker.jsx
 * ─────────────────────────
 * Interactive Mapbox GL JS map for pin-drop location selection.
 *
 * Bugs fixed:
 *   - Stale closure on activePin: map click handler used a ref so it always
 *     reads the latest activePin value.
 *   - Auto fly-to: when homeLocation/officeLocation changes from a search
 *     selection, the map flies smoothly to that location.
 *   - Markers wait for the map style to load before being added.
 */

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

// Kolkata default centre
const DEFAULT_CENTER = [88.3639, 22.5726]
const DEFAULT_ZOOM   = 12

const HOME_COLOR   = '#10b981'   // emerald
const OFFICE_COLOR = '#6366f1'   // indigo

function createMarkerEl(color, label) {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 34px; height: 34px;
    background: ${color};
    border: 3px solid #fff;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  `
  const inner = document.createElement('span')
  inner.textContent = label
  inner.style.cssText = `
    display: block;
    transform: rotate(45deg);
    font-size: 14px;
    line-height: 1;
    user-select: none;
  `
  el.appendChild(inner)
  return el
}

export default function MapPicker({
  mapboxToken,
  homeLocation,
  officeLocation,
  activePin,
  onLocationSet,
}) {
  const containerRef   = useRef(null)
  const mapRef         = useRef(null)
  const homeMarker     = useRef(null)
  const officeMarker   = useRef(null)
  // Keep a live ref to activePin so the map click handler never goes stale
  const activePinRef   = useRef(activePin)
  const onLocationRef  = useRef(onLocationSet)
  const mapReadyRef    = useRef(false)

  // Keep refs current on every render
  useEffect(() => { activePinRef.current = activePin }, [activePin])
  useEffect(() => { onLocationRef.current = onLocationSet }, [onLocationSet])

  // ── Initialise map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = mapboxToken || ''

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

    // Use ref so click always reads the latest activePin
    map.on('click', (e) => {
      const pin = activePinRef.current
      if (pin === 'home' || pin === 'office') {
        const { lng, lat } = e.lngLat
        onLocationRef.current(pin, { lat, lng })
      }
    })

    map.on('mousemove', () => {
      map.getCanvas().style.cursor = activePinRef.current ? 'crosshair' : 'grab'
    })

    map.on('load', () => {
      mapReadyRef.current = true
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      mapReadyRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken])

  // ── Cursor update ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = activePin ? 'crosshair' : 'grab'
  }, [activePin])

  // ── Sync home marker + fly-to ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !homeLocation) return

    const lngLat = [homeLocation.lng, homeLocation.lat]

    const addMarker = () => {
      if (homeMarker.current) {
        homeMarker.current.setLngLat(lngLat)
      } else {
        const el = createMarkerEl(HOME_COLOR, '🏠')
        homeMarker.current = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(lngLat)
          .addTo(map)

        homeMarker.current.on('dragend', () => {
          const { lng, lat } = homeMarker.current.getLngLat()
          onLocationRef.current('home', { lat, lng })
        })
      }
      // Fly to the location when set via search (not drag)
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 13), duration: 800 })
    }

    if (map.isStyleLoaded()) {
      addMarker()
    } else {
      map.once('load', addMarker)
    }
  }, [homeLocation])

  // ── Sync office marker + fly-to ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !officeLocation) return

    const lngLat = [officeLocation.lng, officeLocation.lat]

    const addMarker = () => {
      if (officeMarker.current) {
        officeMarker.current.setLngLat(lngLat)
      } else {
        const el = createMarkerEl(OFFICE_COLOR, '🏢')
        officeMarker.current = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(lngLat)
          .addTo(map)

        officeMarker.current.on('dragend', () => {
          const { lng, lat } = officeMarker.current.getLngLat()
          onLocationRef.current('office', { lat, lng })
        })
      }
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 13), duration: 800 })
    }

    if (map.isStyleLoaded()) {
      addMarker()
    } else {
      map.once('load', addMarker)
    }
  }, [officeLocation])

  // ── Fit both markers in view when both are set ────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !homeLocation || !officeLocation) return

    const fitBounds = () => {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([homeLocation.lng, homeLocation.lat])
      bounds.extend([officeLocation.lng, officeLocation.lat])
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 900 })
    }

    if (map.isStyleLoaded()) {
      fitBounds()
    } else {
      map.once('load', fitBounds)
    }
  // Only fit bounds on initial load (both locations present from defaults)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hintText =
    activePin === 'home'   ? '📍 Click map to place Home pin'
    : activePin === 'office' ? '📍 Click map to place Office pin'
    : homeLocation && officeLocation ? 'Drag pins to refine · or search above'
    : 'Select a location above, then click the map'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div className="map-hint">{hintText}</div>
    </div>
  )
}
