import { useState } from 'react'

const PERIODS = ['Today', '1W', '1M', '3M', 'YTD']

export default function Header({ nifty, time, isLive = false }) {
  const [period, setPeriod] = useState('Today')
  const [showPeriods, setShowPeriods] = useState(false)

  const isPositive = nifty.change >= 0
  const accentColor = isPositive ? '#00e676' : '#ff3355'

  const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Dot: green + pulse = live data  |  amber + slow blink = mock/demo
  const dotColor  = isLive ? '#00e676' : '#ffaa00'
  const dotShadow = isLive ? '0 0 6px #00e676' : '0 0 6px #ffaa00'
  const dotAnim   = isLive ? 'pulse 2s infinite' : 'pulse 3s infinite'
  const dotLabel  = isLive ? 'LIVE' : 'DEMO'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'linear-gradient(180deg, #0d0d0d 85%, rgba(0,0,0,0) 100%)',
      padding: '14px 16px 12px',
    }}>
      {/* Row 1: symbol + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Live / Demo dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, boxShadow: dotShadow,
            display: 'inline-block', animation: dotAnim,
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: '#fff' }}>
            NIFTY 50
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            color: dotColor, opacity: 0.85,
          }}>
            {dotLabel}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
          {timeStr}
        </span>
      </div>

      {/* Row 2: price + change */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
        <span style={{
          fontSize: 38, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.02em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmt(nifty.price)}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: accentColor, lineHeight: 1.2 }}>
            {isPositive ? '+' : ''}{fmt(nifty.change)}
          </span>
          <span style={{ fontSize: 12, color: accentColor, lineHeight: 1.2 }}>
            ({isPositive ? '+' : ''}{nifty.changePct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Row 3: period selector + OHLC */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Period dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriods(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#252525', border: '1px solid #333',
              borderRadius: 8, padding: '4px 10px',
              fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
            }}
          >
            {period}
            <span style={{ fontSize: 9, color: '#888' }}>▼</span>
          </button>
          {showPeriods && (
            <div style={{
              position: 'absolute', top: '110%', left: 0,
              background: '#252525', border: '1px solid #333',
              borderRadius: 8, overflow: 'hidden', zIndex: 200, minWidth: 80,
            }}>
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setShowPeriods(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', fontSize: 12, fontWeight: 600,
                    color: p === period ? '#00e676' : '#fff',
                    background: p === period ? 'rgba(0,230,118,0.1)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* O / H / L chips */}
        <OHLChip label="O" value={nifty.open} color="#888" />
        <OHLChip label="H" value={nifty.high} color="#00e676" />
        <OHLChip label="L" value={nifty.low} color="#ff3355" />
      </div>

      <style>{`
        @keyframes pulse {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:0.5;transform:scale(0.8)}
        }
      `}</style>
    </div>
  )
}

function OHLChip({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
