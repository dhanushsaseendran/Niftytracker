import { useState } from 'react'

let nextId = 100

export default function KeyLevelsPage({ levels, onChange, onBack, currentPrice = 24650 }) {
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [error, setError]       = useState('')

  function addLevel() {
    const val = parseFloat(newValue.replace(/,/g, ''))
    if (isNaN(val) || val <= 0) { setError('Enter a valid price level'); return }
    const duplicate = levels.find(l => Math.abs(parseFloat(l.value) - val) < 1)
    if (duplicate) { setError(`${val} already exists`); return }
    setError('')
    onChange([
      ...levels,
      { id: ++nextId, label: newLabel.trim() || `Level ${val}`, value: String(val) }
    ].sort((a, b) => parseFloat(b.value) - parseFloat(a.value)))
    setNewValue('')
    setNewLabel('')
  }

  function removeLevel(id) {
    onChange(levels.filter(l => l.id !== id))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') addLevel()
  }

  const sorted = [...levels].sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
  // currentPrice passed in as prop from App (live price)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16,
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
        borderRadius: 14, padding: 14, marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700,
          letterSpacing: '0.06em', marginBottom: 10 }}>
          ADD NEW LEVEL
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: error ? 8 : 0 }}>
          <input
            value={newValue}
            onChange={e => { setNewValue(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="Price e.g. 24500"
            style={{
              flex: 1, background: '#111', border: `1px solid ${error ? '#ff3355' : '#2a2a2a'}`,
              borderRadius: 8, padding: '10px 12px',
              fontSize: 15, fontWeight: 700, color: '#fff',
              outline: 'none', fontVariantNumeric: 'tabular-nums',
            }}
          />
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Label (optional)"
            style={{
              flex: 1.2, background: '#111', border: '1px solid #2a2a2a',
              borderRadius: 8, padding: '10px 12px',
              fontSize: 13, color: '#ccc', outline: 'none',
            }}
          />
          <button
            onClick={addLevel}
            style={{
              width: 44, height: 44, borderRadius: 8, flexShrink: 0,
              background: 'rgba(0,230,118,0.15)', border: '1px solid #00e676',
              color: '#00e676', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 11, color: '#ff3355', fontWeight: 600 }}>{error}</div>
        )}
      </div>

      {/* ── Levels list ── */}
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
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 14, overflow: 'hidden', flex: 1,
        }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr auto',
            padding: '8px 14px', borderBottom: '1px solid #222',
          }}>
            <span style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em' }}>PRICE</span>
            <span style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em' }}>LABEL</span>
            <span style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em', paddingRight: 4 }}>DIST</span>
          </div>

          {sorted.map((lvl, i) => {
            const price = parseFloat(lvl.value)
            const dist  = Math.abs(price - currentPrice)
            const above = price > currentPrice
            const inZone = dist <= 50

            return (
              <div
                key={lvl.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '12px 14px',
                  borderBottom: i < sorted.length - 1 ? '1px solid #222' : 'none',
                  background: inZone ? 'rgba(0,230,118,0.04)' : 'transparent',
                  gap: 8,
                }}
              >
                {/* Price */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                </div>

                {/* Label */}
                <div style={{ flex: 1, fontSize: 12, color: '#666' }}>{lvl.label}</div>

                {/* Distance + direction */}
                <div style={{
                  fontSize: 11, fontWeight: 600, textAlign: 'right',
                  color: above ? '#ff3355' : '#00e676',
                  minWidth: 56,
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
      )}
    </div>
  )
}
