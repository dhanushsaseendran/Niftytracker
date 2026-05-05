import { useState, useEffect, useRef } from 'react'
import { niftyData, bankNiftyData, sensexData } from '../data/mockData.js'

// ─────────────────────────────────────────────────────────────────────────────
// Browser Notification helper
// ─────────────────────────────────────────────────────────────────────────────

async function requestNotifPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function fireNotification(signal, price) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const isBuy  = signal.includes('BUY')
  const isSell = signal.includes('SELL')
  if (!isBuy && !isSell) return

  const emoji  = isBuy ? '🟢' : '🔴'
  const title  = `${emoji} NIFTY ${signal}`
  const body   = `Price: ${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const icon   = '/icons/icon-192.png'

  // Try Service Worker first (works when PWA is in background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION', title, body, icon,
    })
  } else {
    // Fallback: foreground notification
    new Notification(title, { body, icon, badge: icon, vibrate: [200, 100, 200] })
  }
}

// Request permission once on load (call from App or hook mount)
export async function initNotifications() {
  return requestNotifPermission()
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const YAHOO_BASE      = 'https://query1.finance.yahoo.com/v8/finance/chart'
const CORS_PROXY      = 'https://corsproxy.io/?url='   // fallback if direct blocked
const FETCH_INTERVAL  = 30_000   // 30 s between Yahoo fetches
const MIN_ANGLE       = 30
const LEVEL_ZONE      = 50

// ─────────────────────────────────────────────────────────────────────────────
// Technical indicator helpers (mirror of Python strategy)
// ─────────────────────────────────────────────────────────────────────────────

function calcEMA(prices, period) {
  const k = 2 / (period + 1)
  const out = [prices[0]]
  for (let i = 1; i < prices.length; i++)
    out.push(prices[i] * k + out[i - 1] * (1 - k))
  return out
}

function calcAngle(vals, lookback = 5) {
  if (vals.length < lookback) return 0
  const pts  = vals.slice(-lookback)
  const n    = pts.length
  const meanX = (n - 1) / 2
  const meanY = pts.reduce((a, b) => a + b, 0) / n
  let numer = 0, denom = 0
  for (let i = 0; i < n; i++) {
    numer += (i - meanX) * (pts[i] - meanY)
    denom += (i - meanX) ** 2
  }
  const slope     = denom !== 0 ? numer / denom : 0
  const normSlope = meanY ? slope / (meanY / 100) : slope
  return Math.round(Math.atan(normSlope) * (180 / Math.PI))
}

function calcVWAP(candles) {
  let tpVol = 0, vol = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    tpVol += tp * (c.volume || 1)
    vol   += (c.volume || 1)
  }
  return vol > 0 ? tpVol / vol : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Yahoo Finance fetch
// ─────────────────────────────────────────────────────────────────────────────

async function yahooFetch(symbol, proxy = false) {
  const raw = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=5m&range=5d&includePrePost=false`
  const url = proxy ? `${CORS_PROXY}${encodeURIComponent(raw)}` : raw
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
  const json  = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`No chart data for ${symbol}`)

  const ts    = result.timestamp || []
  const q     = result.indicators?.quote?.[0] || {}
  const meta  = result.meta || {}

  const candles = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    candles.push({
      ts:     ts[i],
      open:   q.open?.[i]   ?? q.close[i],
      high:   q.high?.[i]   ?? q.close[i],
      low:    q.low?.[i]    ?? q.close[i],
      close:  q.close[i],
      volume: q.volume?.[i] ?? 0,
    })
  }
  return { candles, meta }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal computation (matches Python strategy logic)
// ─────────────────────────────────────────────────────────────────────────────

function computeNifty(candles, meta, keyLevels, prevSparkline) {
  const price   = meta.regularMarketPrice ?? candles.at(-1)?.close ?? 0
  const prevCl  = meta.chartPreviousClose ?? price

  // Today's candles only for VWAP and day OHLC
  const now      = new Date()
  const todayStr = now.toDateString()
  const today    = candles.filter(c => new Date(c.ts * 1000).toDateString() === todayStr)
  const dayOpen  = today[0]?.open ?? prevCl
  const dayHigh  = today.length ? Math.max(...today.map(c => c.high))  : price
  const dayLow   = today.length ? Math.min(...today.map(c => c.low))   : price

  const change    = +(price - dayOpen).toFixed(2)
  const changePct = +((change / dayOpen) * 100).toFixed(2)

  // Use last 40 candles for EMA warmup
  const recent = candles.slice(-40)
  const closes = recent.map(c => c.close)

  // Defaults
  let signal = 'NEUTRAL', emaStatus = 'Neutral'
  let vwapStatus = 'Neutral', keyLevelStatus = 'Neutral'
  let ema9val = price, ema15val = price, angle9 = 0, angle15 = 0
  let vwapVal = price

  if (closes.length >= 17) {
    const ema9v  = calcEMA(closes, 9)
    const ema15v = calcEMA(closes, 15)

    ema9val  = +ema9v.at(-1).toFixed(2)
    ema15val = +ema15v.at(-1).toFixed(2)
    angle9   = calcAngle(ema9v)
    angle15  = calcAngle(ema15v)

    const ema9prev  = ema9v.at(-2)
    const ema15prev = ema15v.at(-2)

    emaStatus = ema9val > ema15val ? 'Positive' : 'Negative'

    // VWAP from today's candles
    vwapVal    = today.length > 0 ? +calcVWAP(today).toFixed(2) : price
    vwapStatus = price > vwapVal ? 'Positive' : 'Negative'

    // Key level confluence
    const lvls      = keyLevels.map(l => parseFloat(l.value))
    const levelDist = lvls.length > 0
      ? Math.min(...lvls.map(l => Math.abs(l - price)))
      : Infinity
    keyLevelStatus = levelDist <= LEVEL_ZONE ? 'Positive' : 'Neutral'

    // Signal — hard conditions (same as Python)
    const bullCross = ema9prev <= ema15prev && ema9val > ema15val
    const bearCross = ema9prev >= ema15prev && ema9val < ema15val

    if      (bullCross && angle9 >= MIN_ANGLE  && levelDist <= LEVEL_ZONE)
      signal = price > vwapVal ? 'STRONG BUY'  : 'BUY'
    else if (bearCross && angle9 <= -MIN_ANGLE && levelDist <= LEVEL_ZONE)
      signal = price < vwapVal ? 'STRONG SELL' : 'SELL'
  }

  return {
    price, open: dayOpen, high: dayHigh, low: dayLow, change, changePct,
    signal, emaStatus, vwapStatus, keyLevelStatus,
    ema9:  { value: ema9val,  angle: angle9  },
    ema15: { value: ema15val, angle: angle15 },
    vwap:  { value: vwapVal,  status: vwapStatus },
    keyLevels: { status: keyLevelStatus },
    trend: { status: 'Neutral' },
    sparkline: [...(prevSparkline || []).slice(1), price],
  }
}

function computeIndex(candles, meta, prevSparkline) {
  const price   = meta.regularMarketPrice ?? candles.at(-1)?.close ?? 0
  const prevCl  = meta.chartPreviousClose ?? price
  const change    = +(price - prevCl).toFixed(2)
  const changePct = +((change / prevCl) * 100).toFixed(2)

  const closes = candles.slice(-20).map(c => c.close)
  let status   = 'Neutral'
  if (closes.length >= 15) {
    const e9  = calcEMA(closes, 9)
    const e15 = calcEMA(closes, 15)
    status = e9.at(-1) > e15.at(-1) ? 'Positive' : 'Negative'
  }

  return { price, change, changePct, status, sparkline: [...(prevSparkline || []).slice(1), price] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock tick (used while Yahoo is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

function tickPrice(base, vol = 0.0004) {
  return +(base + base * vol * (Math.random() - 0.48)).toFixed(2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useLiveData(githubRawUrl, keyLevels = []) {
  const [nifty,     setNifty]     = useState(niftyData)
  const [bankNifty, setBankNifty] = useState(bankNiftyData)
  const [sensex,    setSensex]    = useState(sensexData)
  const [time,      setTime]      = useState(new Date())
  const [isLive,    setIsLive]    = useState(false)
  const [dataSource, setDataSource] = useState('mock')  // 'yahoo' | 'github' | 'mock'

  // Keep latest refs to avoid stale closures
  const refs = useRef({ nifty: niftyData, bankNifty: bankNiftyData, sensex: sensexData, keyLevels, prevSignal: 'NEUTRAL' })

  // Request notification permission once on mount
  useEffect(() => { initNotifications() }, [])
  useEffect(() => { refs.current.nifty     = nifty     }, [nifty])
  useEffect(() => { refs.current.bankNifty = bankNifty }, [bankNifty])
  useEffect(() => { refs.current.sensex    = sensex    }, [sensex])
  useEffect(() => { refs.current.keyLevels = keyLevels }, [keyLevels])

  // ── Yahoo Finance (primary) ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let useProxy  = false

    async function fetchAll() {
      try {
        const [nRes, bnRes, sxRes] = await Promise.all([
          yahooFetch('^NSEI',    useProxy),
          yahooFetch('^NSEBANK', useProxy),
          yahooFetch('^BSESN',   useProxy),
        ])

        if (cancelled) return

        const r = refs.current
        const n  = computeNifty(nRes.candles,  nRes.meta,  r.keyLevels, r.nifty.sparkline)
        const bn = computeIndex(bnRes.candles, bnRes.meta, r.bankNifty.sparkline)
        const sx = computeIndex(sxRes.candles, sxRes.meta, r.sensex.sparkline)

        setNifty(n)
        setBankNifty(bn)
        setSensex(sx)
        setTime(new Date())
        setIsLive(true)
        setDataSource('yahoo')

        // Fire browser notification on signal change
        if (n.signal !== 'NEUTRAL' && n.signal !== refs.current.prevSignal) {
          fireNotification(n.signal, n.price)
        }
        refs.current.prevSignal = n.signal
      } catch (err) {
        if (cancelled) return
        if (!useProxy) {
          // Retry once with CORS proxy
          useProxy = true
          try {
            const [nRes, bnRes, sxRes] = await Promise.all([
              yahooFetch('^NSEI',    true),
              yahooFetch('^NSEBANK', true),
              yahooFetch('^BSESN',   true),
            ])
            if (cancelled) return
            const r = refs.current
            const n  = computeNifty(nRes.candles,  nRes.meta,  r.keyLevels, r.nifty.sparkline)
            const bn = computeIndex(bnRes.candles, bnRes.meta, r.bankNifty.sparkline)
            const sx = computeIndex(sxRes.candles, sxRes.meta, r.sensex.sparkline)
            setNifty(n); setBankNifty(bn); setSensex(sx)
            setTime(new Date()); setIsLive(true); setDataSource('yahoo')
            if (n.signal !== 'NEUTRAL' && n.signal !== refs.current.prevSignal) {
              fireNotification(n.signal, n.price)
            }
            refs.current.prevSignal = n.signal
            return
          } catch { /* fall through to GitHub */ }
        }
        console.warn('[Yahoo] fetch failed:', err.message, '— trying GitHub fallback')
        setDataSource(prev => prev === 'yahoo' ? 'github' : prev)
      }
    }

    fetchAll()
    const id = setInterval(fetchAll, FETCH_INTERVAL)
    return () => { cancelled = true; clearInterval(id) }
  }, [])   // runs once; keyLevels read from ref

  // ── GitHub raw fallback (used only when Yahoo fails) ──────────────────────
  useEffect(() => {
    if (!githubRawUrl || dataSource === 'yahoo') return

    async function fetchGH() {
      try {
        const res = await fetch(`${githubRawUrl}?t=${Date.now()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const d = await res.json()

        const r = refs.current
        setNifty(prev => ({
          ...prev, ...d,
          ema9:  d.ema9  ?? prev.ema9,
          ema15: d.ema15 ?? prev.ema15,
          vwap:  d.vwap  ?? prev.vwap,
          keyLevels: { status: d.keyLevelStatus ?? 'Neutral' },
          trend: { status: d.trendStatus ?? 'Neutral' },
          sparkline: [...prev.sparkline.slice(1), d.price],
        }))
        setBankNifty(prev => ({
          ...prev, ...(d.bankNifty ?? {}),
          sparkline: [...prev.sparkline.slice(1), d.bankNifty?.price ?? prev.price],
        }))
        setSensex(prev => ({
          ...prev, ...(d.sensex ?? {}),
          sparkline: [...prev.sparkline.slice(1), d.sensex?.price ?? prev.price],
        }))
        setTime(new Date()); setIsLive(true); setDataSource('github')
      } catch (err) {
        console.warn('[GitHub] fetch failed:', err.message)
        setIsLive(false)
      }
    }

    fetchGH()
    const id = setInterval(fetchGH, 60_000)
    return () => clearInterval(id)
  }, [githubRawUrl, dataSource])

  // ── Mock tick (when both Yahoo and GitHub fail) ───────────────────────────
  useEffect(() => {
    if (isLive) return
    const id = setInterval(() => {
      const now = new Date()
      setTime(now)
      const h = now.getHours(), m = now.getMinutes()
      if (!(h >= 9 && (h < 15 || (h === 15 && m <= 30)))) return
      setNifty(prev => {
        const p = tickPrice(prev.price)
        return { ...prev, price: p, change: +(p - prev.open).toFixed(2),
          changePct: +((p - prev.open) / prev.open * 100).toFixed(2),
          sparkline: [...prev.sparkline.slice(1), p] }
      })
      setBankNifty(prev => {
        const base = prev.price - prev.change, p = tickPrice(prev.price, 0.0005)
        return { ...prev, price: p, change: +(p - base).toFixed(2),
          changePct: +((p - base) / base * 100).toFixed(2),
          sparkline: [...prev.sparkline.slice(1), p] }
      })
      setSensex(prev => {
        const base = prev.price - prev.change, p = tickPrice(prev.price, 0.0003)
        return { ...prev, price: p, change: +(p - base).toFixed(2),
          changePct: +((p - base) / base * 100).toFixed(2),
          sparkline: [...prev.sparkline.slice(1), p] }
      })
    }, 3000)
    return () => clearInterval(id)
  }, [isLive])

  return { nifty, bankNifty, sensex, time, isLive, dataSource }
}
