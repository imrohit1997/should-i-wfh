/**
 * components/ScoreGauge.jsx
 * ──────────────────────────
 * Animated SVG arc gauge displaying the Commute Friction Score (0–100).
 * Colour transitions: green (WFO) → amber (borderline) → red (WFH).
 */

import { useEffect, useRef } from 'react'

const R = 80           // arc radius
const CX = 110         // SVG centre X
const CY = 110         // SVG centre Y
const ARC_START = 210  // degrees — bottom-left
const ARC_END   = 330  // degrees — total sweep = 300°
const SWEEP     = 300  // degrees

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const s = polarToXY(cx, cy, r, startAngle)
  const e = polarToXY(cx, cy, r, endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

function scoreToColor(score) {
  if (score >= 65) return ['#ef4444', '#dc2626']
  if (score >= 45) return ['#f59e0b', '#d97706']
  return ['#10b981', '#059669']
}

export default function ScoreGauge({ score = 0, animated = true }) {
  const fillRef = useRef(null)
  const prevScore = useRef(0)

  const fillAngle = ARC_START + (score / 100) * SWEEP
  const trackPath = describeArc(CX, CY, R, ARC_START, ARC_START + SWEEP)
  const fillPath  = describeArc(CX, CY, R, ARC_START, fillAngle)
  const [colorA, colorB] = scoreToColor(score)

  const gradId = `gauge-grad-${Math.round(score)}`

  // Animate score number from prev to current
  const numRef = useRef(null)
  useEffect(() => {
    if (!numRef.current || !animated) return
    const start = prevScore.current
    const end   = score
    const duration = 900
    const startTime = performance.now()

    const step = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      if (numRef.current) numRef.current.textContent = current
      if (progress < 1) requestAnimationFrame(step)
      else prevScore.current = end
    }
    requestAnimationFrame(step)
  }, [score, animated])

  return (
    <div className="gauge-wrapper">
      <svg
        className="gauge-svg"
        width="220"
        height="180"
        viewBox="0 0 220 180"
        role="img"
        aria-label={`Commute Friction Score: ${score} out of 100`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={colorA} />
            <stop offset="100%" stopColor={colorB} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Fill — animated via CSS transition on stroke-dasharray would require
            SVG length calc; we redraw the path on each score update instead */}
        {score > 0 && (
          <path
            ref={fillRef}
            d={fillPath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ transition: 'stroke 0.5s ease' }}
          />
        )}

        {/* Score number */}
        <text
          ref={numRef}
          x={CX}
          y={CY - 8}
          className="gauge-score-text"
          fill={colorA}
        >
          {score}
        </text>

        {/* Label */}
        <text x={CX} y={CY + 22} className="gauge-label-text">
          / 100
        </text>
        <text x={CX} y={CY + 40} className="gauge-label-text">
          FRICTION SCORE
        </text>
      </svg>
    </div>
  )
}
