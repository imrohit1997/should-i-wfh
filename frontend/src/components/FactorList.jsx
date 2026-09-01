/**
 * components/FactorList.jsx
 * ──────────────────────────
 * Renders the score breakdown with animated progress bars.
 */

import { useEffect, useRef } from 'react'

function FactorBar({ contribution, maxContribution }) {
  const fillRef = useRef(null)
  const pct = maxContribution > 0 ? (contribution / maxContribution) * 100 : 0

  useEffect(() => {
    if (!fillRef.current) return
    // Small delay so the CSS transition fires after mount
    const t = setTimeout(() => {
      if (fillRef.current) fillRef.current.style.width = `${pct}%`
    }, 80)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div className="factor-bar-track">
      <div
        ref={fillRef}
        className="factor-bar-fill"
        style={{ width: '0%' }}
        role="progressbar"
        aria-valuenow={contribution}
        aria-valuemax={maxContribution}
      />
    </div>
  )
}

export default function FactorList({ factors = [] }) {
  if (!factors.length) return null

  return (
    <div className="factor-list">
      {factors.map((f) => (
        <div key={f.name} className="factor-item">
          <div className="factor-header">
            <span className="factor-name">{f.name}</span>
            <span className="factor-score">
              {f.contribution.toFixed(1)}&thinsp;/&thinsp;{f.max_contribution}
            </span>
          </div>
          <FactorBar
            contribution={f.contribution}
            maxContribution={f.max_contribution}
          />
          <span className="factor-detail">{f.detail}</span>
        </div>
      ))}
    </div>
  )
}
