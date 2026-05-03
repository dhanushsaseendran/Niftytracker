import { useState, useEffect, useRef } from 'react'
import { niftyData, bankNiftyData, sensexData } from '../data/mockData.js'

// ── Mock tick (used when no live URL is configured) ───────────────────────────
function tickPrice(base, volatility = 0.0004) {
  const delta = base * volatility * (Math.random() - 0.48)
  return +(base + delta).toFixed(2)
}

// ── Map live-data.json → component state ─────────────────────────────────────
function mapLiveData(d, prevNifty, prevBankNifty, prevSensex) {
  const nifty = {
    ...prevNifty,
    price:     d.price,
    open:      d.open      ?? prevNifty.open,
    high:      d.high      ?? prevNifty.high,
    low:       d.low       ?? prevNifty.low,
    change:    d.change,
    changePct: d.changePct,
    signal:    d.signal    ?? 'NEUTRAL',
    ema9:      { value: d.ema9?.value  ?? prevNifty.ema9.value,  angle: d.ema9?.angle  ?? prevNifty.ema9.angle  },
    ema15:     { value: d.ema15?.value ?? prevNifty.ema15.value, angle: d.ema15?.angle ?? prevNifty.ema15.angle },
    emaStatus: d.emaStatus   ?? 'Neutral',
    vwap:      { value: d.vwap?.value  ?? prevNifty.vwap.value,  status: d.vwap?.status ?? prevNifty.vwap.status },
    keyLevels: { status: d.keyLevelStatus ?? 'Neutral' },
    trend:     { status: d.trendStatus   ?? 'Neutral' },
    sparkline: [...prevNifty.sparkline.slice(1), d.price],
  }

  const bnPrice = d.bankNifty?.price ?? prevBankNifty.price
  const bankNifty = {
    ...prevBankNifty,
    price:     bnPrice,
    change:    d.bankNifty?.change    ?? prevBankNifty.change,
    changePct: d.bankNifty?.changePct ?? prevBankNifty.changePct,
    status:    d.bankNifty?.status    ?? prevBankNifty.status,
    sparkline: [...prevBankNifty.sparkline.slice(1), bnPrice],
  }

  const sxPrice = d.sensex?.price ?? prevSensex.price
  const sensex = {
    ...prevSensex,
    price:     sxPrice,
    change:    d.sensex?.change    ?? prevSensex.change,
    changePct: d.sensex?.changePct ?? prevSensex.changePct,
    status:    d.sensex?.status    ?? prevSensex.status,
    sparkline: [...prevSensex.sparkline.slice(1), sxPrice],
  }

  return { nifty, bankNifty, sensex }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useLiveData(githubRawUrl) {
  const [nifty,     setNifty]     = useState(niftyData)
  const [bankNifty, setBankNifty] = useState(bankNiftyData)
  const [sensex,    setSensex]    = useState(sensexData)
  const [time,      setTime]      = useState(new Date())
  const [isLive,    setIsLive]    = useState(false)

  // Refs so the fetch closure always reads the latest state without re-subscribing
  const niftyRef     = useRef(niftyData)
  const bankNiftyRef = useRef(bankNiftyData)
  const sensexRef    = useRef(sensexData)

  useEffect(() => { niftyRef.current     = nifty     }, [nifty])
  useEffect(() => { bankNiftyRef.current = bankNifty }, [bankNifty])
  useEffect(() => { sensexRef.current    = sensex    }, [sensex])

  // ── Mock price tick (only runs while no live URL is active) ────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setTime(now)
      if (isLive) return   // live data active – skip mock ticks

      const h = now.getHours(), m = now.getMinutes()
      const marketOpen = h >= 9 && (h < 15 || (h === 15 && m <= 30))
      if (!marketOpen) return

      setNifty(prev => {
        const price = tickPrice(prev.price)
        return { ...prev, price,
          change:    +(price - prev.open).toFixed(2),
          changePct: +((price - prev.open) / prev.open * 100).toFixed(2),
          sparkline: [...prev.sparkline.slice(1), price],
        }
      })
      setBankNifty(prev => {
        const base  = prev.price - prev.change
        const price = tickPrice(prev.price, 0.0005)
        return { ...prev, price,
          change:    +(price - base).toFixed(2),
          changePct: +((price - base) / base * 100).toFixed(2),
          sparkline: [...prev.sparkline.slice(1), price],
        }
      })
      setSensex(prev => {
        const base  = prev.price - prev.change
        const price = tickPrice(prev.price, 0.0003)
        return { ...prev, price,
          change:    +(price - base).toFixed(2),
          changePct: +((price - base) / base * 100).toFixed(2),
          sparkline: [...prev.sparkline.slice(1), price],
        }
      })
    }, 3000)
    return () => clearInterval(id)
  }, [isLive])

  // ── GitHub raw fetch (every 60 s when URL is configured) ──────────────────
  useEffect(() => {
    if (!githubRawUrl) {
      setIsLive(false)
      return
    }

    async function fetchData() {
      try {
        // Cache-bust so GitHub CDN always returns the latest committed file
        const res = await fetch(`${githubRawUrl}?t=${Date.now()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const d = await res.json()

        const { nifty: n, bankNifty: bn, sensex: s } =
          mapLiveData(d, niftyRef.current, bankNiftyRef.current, sensexRef.current)

        setNifty(n)
        setBankNifty(bn)
        setSensex(s)
        setTime(new Date())
        setIsLive(true)
      } catch (err) {
        console.warn('[useLiveData] fetch failed – staying on mock data:', err.message)
        setIsLive(false)
      }
    }

    fetchData()                              // run immediately on mount / URL change
    const id = setInterval(fetchData, 60_000) // then every 60 s
    return () => clearInterval(id)
  }, [githubRawUrl])

  return { nifty, bankNifty, sensex, time, isLive }
}
