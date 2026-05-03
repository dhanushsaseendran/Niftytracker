import { signalHistory } from '../data/mockData.js'

const RESULT_STYLE = {
  'Active':      { color: '#00e676', bg: 'rgba(0,230,118,0.12)' },
  'Target Hit':  { color: '#00e676', bg: 'rgba(0,230,118,0.12)' },
  'Stopped Out': { color: '#ff3355', bg: 'rgba(255,51,85,0.12)' },
}

export default function SignalsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatChip label="Total" value={signalHistory.length} color="#888" />
        <StatChip label="Wins"  value={signalHistory.filter(s => s.result === 'Target Hit').length} color="#00e676" />
        <StatChip label="Losses" value={signalHistory.filter(s => s.result === 'Stopped Out').length} color="#ff3355" />
      </div>

      {/* Signal cards */}
      {signalHistory.map(sig => (
        <SignalCard key={sig.id} sig={sig} />
      ))}

      {signalHistory.length === 0 && (
        <div style={{
          textAlign: 'center', color: '#444',
          padding: 48, fontSize: 14,
        }}>
          No signals yet today
        </div>
      )}
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #2a2a2a',
      borderRadius: 10, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function SignalCard({ sig }) {
  const isBuy = sig.type === 'BUY'
  const typeColor = isBuy ? '#00e676' : '#ff3355'
  const typeBg = isBuy ? 'rgba(0,230,118,0.08)' : 'rgba(255,51,85,0.08)'
  const result = RESULT_STYLE[sig.result] || { color: '#888', bg: 'rgba(136,136,136,0.1)' }

  const ts = new Date(sig.timestamp)
  const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

  return (
    <div style={{
      background: '#1a1a1a',
      border: `1px solid #2a2a2a`,
      borderLeft: `3px solid ${typeColor}`,
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '1px solid #222',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Type badge */}
          <span style={{
            padding: '3px 12px', borderRadius: 20,
            fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
            color: typeColor, background: typeBg,
            border: `1px solid ${typeColor}`,
          }}>
            {sig.type}
          </span>
          {/* Pattern name */}
          <span style={{ fontSize: 12, color: '#aaa', fontWeight: 500 }}>
            {sig.pattern}
          </span>
        </div>
        {/* Timestamp */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#888', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</div>
          <div style={{ fontSize: 10, color: '#555' }}>{dateStr}</div>
        </div>
      </div>

      {/* Entry price + result */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #222',
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 3, fontWeight: 600, letterSpacing: '0.04em' }}>ENTRY PRICE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {sig.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 20,
          fontSize: 12, fontWeight: 700,
          color: result.color, background: result.bg,
        }}>
          {sig.result}
        </span>
      </div>

      {/* Level grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#222' }}>
        <LevelCell label="Support"    value={sig.support}    dist={sig.supportDist}    color="#00e676" />
        <LevelCell label="Resistance" value={sig.resistance} dist={sig.resistanceDist} color="#ff3355" />
        <LevelCell label="SSL"        value={sig.ssl}        dist={sig.sslDist}        color="#00e676" />
        <LevelCell label="BSL"        value={sig.bsl}        dist={sig.bslDist}        color="#ff3355" />
      </div>

      {/* Bank Nifty alignment */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px',
      }}>
        <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>Bank Nifty Aligned</span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: sig.bankNiftyAlign ? '#00e676' : '#ff3355',
        }}>
          {sig.bankNiftyAlign ? '✓ Yes' : '✗ No'}
        </span>
      </div>
    </div>
  )
}

function LevelCell({ label, value, dist, color }) {
  return (
    <div style={{ background: '#141414', padding: '8px 14px' }}>
      <div style={{ fontSize: 10, color: '#555', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 3 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString('en-IN')}
        </span>
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{dist}pts</span>
      </div>
    </div>
  )
}
