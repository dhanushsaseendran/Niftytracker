import { useState } from 'react'

let nextId = 100

export default function KeyLevelsPage({ levels, onChange, onBack, currentPrice = 24650 }) {
  const [newValue, setNewValue] = useState('')
  const [error, setError]       = useState('')

  function addLevel() {
    const val = parseFloat(newValue.replace(/,/g, ''))
    if (isNaN(val) || val <= 0) { setError('Enter a valid price level'); return }
    const duplicate = levels.find(l => Math.abs(parseFloat(l.value) - val) < 1)
    if (duplicate) { setError(`${val} already exists`); return }
    setError('')
    onChange([
      ...levels,
      { id: ++nextId, label: `Level ${val}`, value: String(val) }
    ].sort((a, b) => parseFloat(b.value) - parseFloat(a.value)))
    setNewValue('')
  }

  function removeLevel(id) {
    onChange(levels.filter(l => l.id !== id))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') addLevel()
  }

  const sorted = [...levels].sort((a, b) => parseFloat(b.value) - parseFloat(a.value))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16, flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#1a1a1a', border: '1px solid #2a2a2a',
            color: '#fff', fontSize: 18, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Key Levels</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
            {levels.length} level{levels.length !== 1 ? 's' : ''} · signals fire within ±50 pts
          </div>
        </div>
      </div>

      {/* ── Add new level ── */}
      <div style={{
        background: '#1a1a1a', border: '1px solid #2a2a2a',
        borderRadius: 14, padding: 14, marginBottom: 12, flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700,
          letterSpacing: '0.06em', marginBottom: 10 }}>
          ADD NEW LEVEL
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newValue}
            onChange={e => { setNewValue(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="Enter price e.g. 24500"
            style={{
              flex: 1, background: '#111', border: `1px solid ${error ? '#ff3355' : '#2a2a2a'}`,
              borderRadius: 8, padding: '10px 12px',
              fontSize: 15, fontWeight: 700, color: '#fff',
              outline: 'none', fontVariantNumeric: 'tabular-nums',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={addLevel}
            style={{
              padding: '0 20px', height: 44, borderRadius: 8, flexShrink: 0,
              background: 'rgba(0,230,118,0.15)', border: '1px solid #00e676',
              color: '#00e676', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            Add
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 11, color: '#ff3355', fontWeight: 600, marginTop: 8 }}>{error}</div>
        )}
      </div>

      {/* ── Levels list (scrollable) ── */}
      {sorted.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          color: '#333',
        }}>
          <div style={{ fontSize: 32 }}>📊</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No key levels yet</div>
          <div style={{ fontSize: 11, color: '#2a2a2a' }}>Add a price level above to get started</div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 14, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Column headers — sticky */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            padding: '8px 14px', borderBottom: '1px solid #222',
            position: 'sticky', top: 0,
            background: '#1a1a1a', zIndex: 1, flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em' }}>PRICE</span>
            <span style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em', marginRight: 24 }}>DIST</span>
            <span />
          </div>

          {/* Scrollable rows */}
          <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
            {sorted.map((lvl, i) => {
              const price  = parseFloat(lvl.value)
              const dist   = Math.abs(price - currentPrice)
              const above  = price > currentPrice
              const inZone = dist <= 50

              return (
                <div
                  key={lvl.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '11px 14px',
                    borderBottom: i < sorted.length - 1 ? '1px solid #222' : 'none',
                    background: inZone ? 'rgba(0,230,118,0.04)' : 'transparent',
                    gap: 8,
                  }}
                >
                  {/* Price + IN ZONE badge */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 700, color: '#fff',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {price.toLocaleString('en-IN')}
                    </span>
                    {inZone && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#00e676',
                        background: 'rgba(0,230,118,0.15)',
                        padding: '1px 6px', borderRadius: 4, letterSpacing: '0.04em',
                      }}>
                        IN ZONE
                      </span>
                    )}
                  </div>

                  {/* Distance + direction */}
                  <div style={{
                    fontSize: 11, fontWeight: 600, textAlign: 'right',
                    color: above ? '#ff3355' : '#00e676',
                    minWidth: 60,
                  }}>
                    {above ? '▲' : '▼'} {dist.toFixed(0)} pts
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeLevel(lvl.id)}
                    style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: 'rgba(255,51,85,0.1)', border: '1px solid rgba(255,51,85,0.2)',
                      color: '#ff3355', fontSize: 15, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
