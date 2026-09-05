/**
 * components/ResultCard.jsx
 * ──────────────────────────
 * Displays the full verdict — badge, headline, gauge, stats, factor list, alerts.
 */

import ScoreGauge from './ScoreGauge'
import FactorList from './FactorList'

const VERDICT_CONFIG = {
  WFO: {
    cls: 'wfo',
    badge: 'Work From Office',
    emoji: '🏢',
    headline: 'Head in — your commute looks clear.',
    icon: '✅',
  },
  WFH: {
    cls: 'wfh',
    badge: 'Work From Home',
    emoji: '🏠',
    headline: 'Stay home — your commute is rough today.',
    icon: '⚠️',
  },
  MANDATORY_WFH: {
    cls: 'mandatory',
    badge: 'Mandatory WFH',
    emoji: '🚨',
    headline: 'Do NOT commute — critical condition detected.',
    icon: '🚨',
  },
}

function StatChip({ label, value, unit }) {
  return (
    <div className="stat-chip">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? '—'}</span>
      {unit && <span className="stat-unit">{unit}</span>}
    </div>
  )
}

export default function ResultCard({ result }) {
  if (!result) return null

  const cfg = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.WFO

  const liveMins  = result.commute_duration_live_min?.toFixed(0)
  const baseMins  = result.commute_duration_baseline_min?.toFixed(0)
  const pastRain  = result.precipitation_past_6h_mm?.toFixed(1)
  const futureRain= result.precipitation_next_6h_mm?.toFixed(1)

  return (
    <div className={`verdict-card ${cfg.cls} fade-up`}>
      <div className="verdict-left">
        {/* Badge */}
        <div>
          <span className={`verdict-badge ${cfg.cls}`}>
            {cfg.icon}&nbsp;{cfg.badge}
          </span>
        </div>

        {/* Gauge + Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <ScoreGauge score={result.score} animated />
          <h2 className="verdict-headline" style={{ textAlign: 'center' }}>
            {cfg.headline}
          </h2>
          {result.override_reason && (
            <p className="verdict-sub" style={{ textAlign: 'center', maxWidth: 420 }}>
              {result.override_reason}
            </p>
          )}
          {!result.override_reason && (
            <p className="verdict-sub" style={{ textAlign: 'center', maxWidth: 420 }}>
              Primary factor: <strong style={{ color: 'var(--text-primary)' }}>{result.primary_factor}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="verdict-right">
        {/* Stats */}
        <div className="stats-row">
          <StatChip label="Live commute"    value={liveMins}   unit="min" />
          <StatChip label="Baseline"        value={baseMins}   unit="min" />
          <StatChip label="Past rain (6h)"  value={pastRain}   unit="mm"  />
          <StatChip label="Rain forecast"   value={futureRain} unit="mm"  />
        </div>

        {/* Factor breakdown */}
        {result.factors?.length > 0 && (
          <div>
            <p className="panel-title">Score Breakdown</p>
            <FactorList factors={result.factors} />
          </div>
        )}

        {/* Alerts */}
        {result.alerts?.length > 0 && (
          <div>
            <p className="panel-title">Active Alerts</p>
            <div className="alerts-list">
              {result.alerts.map((alert, i) => (
                <div key={i} className="alert-item">
                  <span className="alert-icon">⚠</span>
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demo banner */}
        {result.demo_mode && (
          <div className="demo-banner">
            <span>ℹ</span>
            <span>
              <strong>Demo mode</strong> — showing mock data. Add your API keys to{' '}
              <code>backend/.env</code> for live results.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
