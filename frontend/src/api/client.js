/**
 * api/client.js
 * ─────────────
 * Axios-based API wrapper for the FastAPI backend.
 * During development, Vite proxies /api → http://localhost:8000.
 */

import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * POST /api/v1/evaluate-commute
 *
 * @param {object} params
 * @param {{ lat: number, lng: number }} params.homeLocation
 * @param {{ lat: number, lng: number }} params.officeLocation
 * @param {string} params.departureTime  ISO-8601 string
 * @returns {Promise<import('./types').EvaluateResponse>}
 */
export async function evaluateCommute({ homeLocation, officeLocation, isReturnTrip }) {
  const { data } = await api.post('/evaluate-commute', {
    home_location:   { lat: homeLocation.lat,   lng: homeLocation.lng },
    office_location: { lat: officeLocation.lat,  lng: officeLocation.lng },
    is_return_trip: isReturnTrip || false,
  })
  return data
}
