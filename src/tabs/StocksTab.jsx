import { useState, useMemo } from 'react'
import { nifty50Stocks } from '../data/mockData.js'
import Sparkline from '../components/Sparkline.jsx'

const SORTS = ['All', 'Gainers', 'Losers', 'A→Z']

export default function StocksTab() {
  const [sort, setSort] = useState('All')
  const [search, setSearch] = useState('')

  const stocks = useMemo(() => {
    let list = [...nifty50Stocks]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    }
    if (sort === 'Gainers') list.sort((a, b) => b.change - a.change)
    else if (sort === 'Losers') list.sort((a, b) => a.change - b.change)
    else if (sort === 'A→Z') list.sort((a, b) => a.ticker.localeCompare(b.ticker))
    return list
  }, [sort, search])

  const gainers = nifty50Stocks.filter(s => s.change >= 0).length
  const losers = nifty50Stocks.length - gainers

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Market breadth summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
      }}>
        <BreadthChip label="Total" value={nifty50Stocks.length} color="#888" />
        <BreadthChip label="Gainers" value={gainers} color="#00e676" />
        <BreadthChip label="Losers" value={losers} color="#ff3355" />
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: '#555', fontSize: 14,
        }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ticker or name…"
          style={{
            width: '100%',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 10,
            padding: '10px 12px 10px 36px',
            fontSize: 13,
            color: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {/* Sort pills */}
      <div style={{ display: 'flex', gap: 8 }}>
        {SORTS.map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12, fontWeight: 600,
              border: `1px solid ${sort === s ? '#00e676' : '#2a2a2a'}`,
              background: sort === s ? 'rgba(0,230,118,0.12)' : '#1a1a1a',
              color: sort === s ? '#00e676' : '#666',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Stock rows */}
      <div style={{
        background: '#1a1a1a', borderRadius: 14,
        border: '1px solid #2a2a2a', overflow: 'hidden',
      }}>
        {stocks.map((stock, i) => (
          <StockRow key={stock.ticker} stock={stock} last={i === stocks.length - 1} />
        ))}
        {stocks.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#555', fontSize: 13 }}>
            No results for "{search}"
          </div>
        )}
      </div>
    </div>
  )
}

function BreadthChip({ label, value, color }) {
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #2a2a2a',
      borderRadius: 10, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function StockRow({ stock, last }) {
  const isPositive = stock.change >= 0
  const color = isPositive ? '#00e676' : '#ff3355'
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid #222',
      gap: 10,
    }}>
      {/* Ticker + name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{stock.ticker}</div>
        <div style={{
          fontSize: 11, color: '#555', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {stock.name}
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline data={stock.sparkline} width={48} height={22} positive={isPositive} />

      {/* Price + change */}
      <div style={{ textAlign: 'right', minWidth: 72 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>
          {isPositive ? '+' : ''}{stock.change.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}
