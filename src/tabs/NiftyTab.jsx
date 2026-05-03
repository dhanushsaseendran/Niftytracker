import Card from '../components/Card.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Sparkline from '../components/Sparkline.jsx'
// Sparkline still used in IndexRow (Bank Nifty / Sensex price charts)

const SIGNAL_STYLES = {
  'STRONG BUY':  { color: '#00e676', bg: 'rgba(0,230,118,0.08)', border: '#00e676' },
  'BUY':         { color: '#00e676', bg: 'rgba(0,230,118,0.06)', border: '#00e676' },
  'STRONG SELL': { color: '#ff3355', bg: 'rgba(255,51,85,0.08)',  border: '#ff3355' },
  'SELL':        { color: '#ff3355', bg: 'rgba(255,51,85,0.06)',  border: '#ff3355' },
  'NEUTRAL':     { color: '#888',    bg: 'rgba(136,136,136,0.08)', border: '#555'  },
}

export default function NiftyTab({
  nifty, bankNifty, sensex,
  nearestSupport, nearestResistance, supportDist, resistanceDist,
}) {
  const sig = SIGNAL_STYLES[nifty.signal] || SIGNAL_STYLES['NEUTRAL']
  const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 })

  // SSL/BSL warning thresholds (< 50 pts → warn)
  const sslWarning = supportDist    !== null && supportDist    < 50
  const bslWarning = resistanceDist !== null && resistanceDist < 50

  // Bank Nifty & Sensex confirmation flags
  const bankConfirmed   = bankNifty.status === 'Positive'
  const sensexConfirmed = sensex.status    === 'Positive'
  const bothConfirmed   = bankConfirmed && sensexConfirmed

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── 1. Signal Card ─────────────────────────────────────────── */}
      <Card>
        {/* Signal banner */}
        <div style={{
          border: `1.5px solid ${sig.border}`,
          background: sig.bg,
          borderRadius: 10, padding: '10px 16px',
          textAlign: 'center', marginBottom: 14,
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.1em', color: sig.color }}>
            {nifty.signal}
          </span>
        </div>

        {/* 2×2 indicator mini-grid — all 6 cells, no sparklines */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MiniIndicator label="9/15 EMA"     status={nifty.emaStatus}        />
          <MiniIndicator label="KEY LEVELS"   status={nifty.keyLevels.status} />
          <MiniIndicator label="VWAP"         status={nifty.vwap.status}      />
          <MiniIndicator label="MARKET TREND" status={nifty.trend.status}     />
          <MiniIndicator label="BANK NIFTY"   status={bankConfirmed ? 'Positive' : 'Negative'} />
          <MiniIndicator label="SENSEX"       status={sensexConfirmed ? 'Positive' : 'Negative'} />
        </div>
      </Card>

      {/* ── 2. 9/15 EMA Card ───────────────────────────────────────── */}
      <Card>
        <CardHeader title="9 / 15 EMA" status={nifty.emaStatus} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <EMARow label="9 EMA"  value={nifty.ema9.value}  angle={nifty.ema9.angle} />
          <EMARow label="15 EMA" value={nifty.ema15.value} angle={nifty.ema15.angle} />
        </div>
      </Card>

      {/* ── 3. Key Levels Card ─────────────────────────────────────── */}
      <Card>
        <CardHeader title="Key Levels" status={nifty.keyLevels.status} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {nearestSupport !== null
            ? <LevelRow label="Nearest Support"    value={nearestSupport}    dist={supportDist}    color="#00e676" isNear={supportDist <= 50} />
            : <EmptyLevel label="Nearest Support" />
          }
          {nearestResistance !== null
            ? <LevelRow label="Nearest Resistance" value={nearestResistance} dist={resistanceDist} color="#ff3355" isNear={resistanceDist <= 50} />
            : <EmptyLevel label="Nearest Resistance" />
          }
        </div>
      </Card>

      {/* ── 4. SSL / BSL Warning Card ──────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>SSL / BSL</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            color: (sslWarning || bslWarning) ? '#ffaa00' : '#00e676',
            background: (sslWarning || bslWarning) ? 'rgba(255,170,0,0.12)' : 'rgba(0,230,118,0.12)',
          }}>
            {(sslWarning || bslWarning) ? '⚠ Reversal Risk' : '✓ Safe'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* SSL — sell-side liquidity = nearest support below */}
          <LiqRow
            label="SSL"
            sublabel="Sell-Side Liquidity (below)"
            value={nearestSupport}
            dist={supportDist}
            warn={sslWarning}
            warnMsg="< 50 pts — reversal risk ↓"
            safeMsg="Safe — far from sell-side liquidity"
            direction="below"
          />
          {/* BSL — buy-side liquidity = nearest resistance above */}
          <LiqRow
            label="BSL"
            sublabel="Buy-Side Liquidity (above)"
            value={nearestResistance}
            dist={resistanceDist}
            warn={bslWarning}
            warnMsg="< 50 pts — reversal risk ↑"
            safeMsg="Safe — far from buy-side liquidity"
            direction="above"
          />
        </div>
      </Card>

      {/* ── 5. VWAP Card ───────────────────────────────────────────── */}
      <Card>
        <CardHeader title="VWAP" status={nifty.vwap.status} />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>VWAP Level</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(nifty.vwap.value)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Distance</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: nifty.price > nifty.vwap.value ? '#00e676' : '#ff3355' }}>
              {nifty.price > nifty.vwap.value ? '+' : ''}{(nifty.price - nifty.vwap.value).toFixed(2)}
            </div>
          </div>
        </div>
      </Card>

      {/* ── 6. Bank Nifty Card ─────────────────────────────────────── */}
      <Card>
        <CardHeader title="Bank Nifty" status={bankNifty.status} />
        <IndexRow data={bankNifty} />
      </Card>

      {/* ── 7. Sensex Card ─────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Sensex" status={sensex.status} />
        <IndexRow data={sensex} />
      </Card>

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function CardHeader({ title, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{title}</span>
      <StatusBadge status={status} />
    </div>
  )
}


function MiniIndicator({ label, status }) {
  return (
    <div style={{ background: '#111', borderRadius: 10, padding: '10px 12px', border: '1px solid #222' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <StatusBadge status={status} />
    </div>
  )
}

function EMARow({ label, value, angle }) {
  const bullish = angle >= 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', background: '#111', borderRadius: 8,
    }}>
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: bullish ? '#00e676' : '#ff3355',
          background: bullish ? 'rgba(0,230,118,0.12)' : 'rgba(255,51,85,0.12)',
          padding: '2px 8px', borderRadius: 6,
        }}>
          {Math.abs(angle)}° {bullish ? '↑' : '↓'}
        </span>
      </div>
    </div>
  )
}

function LevelRow({ label, value, dist, color, isNear }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', background: '#111', borderRadius: 8,
    }}>
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString('en-IN')}
        </span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>
          {dist.toFixed(0)} pts
          {isNear && (
            <span style={{
              marginLeft: 4, fontSize: 10,
              background: 'rgba(0,230,118,0.12)', color: '#00e676',
              padding: '1px 6px', borderRadius: 4,
            }}>near</span>
          )}
        </span>
      </div>
    </div>
  )
}

function EmptyLevel({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', background: '#111', borderRadius: 8,
    }}>
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#333' }}>—</span>
    </div>
  )
}

function LiqRow({ label, sublabel, value, dist, warn, warnMsg, safeMsg, direction }) {
  const color  = warn ? '#ffaa00' : '#00e676'
  const bg     = warn ? 'rgba(255,170,0,0.08)' : 'rgba(0,230,118,0.06)'
  const border = warn ? 'rgba(255,170,0,0.2)'  : 'rgba(0,230,118,0.15)'

  return (
    <div style={{
      padding: '10px 12px', background: bg,
      border: `1px solid ${border}`, borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{label} </span>
          <span style={{ fontSize: 11, color: '#555' }}>{sublabel}</span>
        </div>
        {value !== null && (
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {value.toLocaleString('en-IN')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>
          {warn ? '⚠' : '✓'}
        </span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>
          {value !== null
            ? (warn ? warnMsg : `${dist?.toFixed(0)} pts away — ${safeMsg}`)
            : 'No level data'}
        </span>
      </div>
    </div>
  )
}

function IndexRow({ data }) {
  const isPositive = data.change >= 0
  const color = isPositive ? '#00e676' : '#ff3355'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {data.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 12, color, marginTop: 3, fontWeight: 600 }}>
          {isPositive ? '+' : ''}{data.change.toFixed(2)} ({isPositive ? '+' : ''}{data.changePct.toFixed(2)}%)
        </div>
      </div>
      <Sparkline data={data.sparkline} width={72} height={32} positive={isPositive} />
    </div>
  )
}
