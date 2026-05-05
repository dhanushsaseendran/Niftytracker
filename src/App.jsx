import { useState, useEffect, useCallback } from 'react'
import Header        from './components/Header.jsx'
import BottomNav     from './components/BottomNav.jsx'
import NiftyTab      from './tabs/NiftyTab.jsx'
import StocksTab     from './tabs/StocksTab.jsx'
import SignalsTab    from './tabs/SignalsTab.jsx'
import SettingsTab   from './tabs/SettingsTab.jsx'
import KeyLevelsPage from './tabs/KeyLevelsPage.jsx'
import { useLiveData }       from './hooks/useLiveData.js'
import { DEFAULT_KEY_LEVELS } from './data/mockData.js'

const HEADER_H = 148
const NAV_H    = 64

// Read the raw GitHub URL from localStorage (built from ghOwner + ghRepo)
function readGithubUrl() {
  try {
    const s = JSON.parse(localStorage.getItem('nifty_settings') || '{}')
    if (s.ghOwner && s.ghRepo) {
      return `https://raw.githubusercontent.com/${s.ghOwner.trim()}/${s.ghRepo.trim()}/main/live-data.json`
    }
  } catch { /* ignore */ }
  return ''
}

export default function App() {
  const [tab,       setTab]       = useState('nifty')
  const [subPage,   setSubPage]   = useState(null)      // e.g. 'keyLevels'
  const [keyLevels, setKeyLevels] = useState(DEFAULT_KEY_LEVELS)
  const [githubUrl, setGithubUrl] = useState(readGithubUrl)

  // Re-read URL whenever Settings saves
  useEffect(() => {
    function onSettingsChanged() {
      setGithubUrl(readGithubUrl())
    }
    window.addEventListener('nifty_settings_changed', onSettingsChanged)
    return () => window.removeEventListener('nifty_settings_changed', onSettingsChanged)
  }, [])

  const { nifty, bankNifty, sensex, time, isLive, dataSource } = useLiveData(githubUrl, keyLevels)

  function navigate(page) {
    setSubPage(page)
    setTimeout(() => {
      const el = document.getElementById('scroll-area')
      if (el) el.scrollTop = 0
    }, 0)
  }

  function goBack() {
    setSubPage(null)
  }

  function handleTabChange(t) {
    setSubPage(null)
    setTab(t)
  }

  // Derive nearest levels from live price for SSL/BSL warning
  const levelsBelow = keyLevels
    .map(l => parseFloat(l.value))
    .filter(v => v < nifty.price)
    .sort((a, b) => b - a)   // closest first

  const levelsAbove = keyLevels
    .map(l => parseFloat(l.value))
    .filter(v => v >= nifty.price)
    .sort((a, b) => a - b)   // closest first

  const nearestSupport    = levelsBelow[0] ?? null
  const nearestResistance = levelsAbove[0] ?? null
  const supportDist       = nearestSupport    ? +(nifty.price - nearestSupport).toFixed(2)    : null
  const resistanceDist    = nearestResistance ? +(nearestResistance - nifty.price).toFixed(2) : null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#000',
      maxWidth: 480, margin: '0 auto',
    }}>
      {/* Fixed header — always visible */}
      <Header nifty={nifty} time={time} isLive={isLive} dataSource={dataSource} />

      {/* Scrollable content */}
      <div
        id="scroll-area"
        style={{
          position: 'absolute',
          top: HEADER_H, bottom: NAV_H,
          left: 0, right: 0,
          overflowY: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px 8px',
        }}
      >
        {/* ── Key Levels sub-page (shown over any tab) ── */}
        {subPage === 'keyLevels' && (
          <KeyLevelsPage
            levels={keyLevels}
            onChange={setKeyLevels}
            onBack={goBack}
            currentPrice={nifty.price}
          />
        )}

        {/* ── Main tabs (hidden when sub-page is open) ── */}
        {!subPage && (
          <>
            {tab === 'nifty' && (
              <NiftyTab
                nifty={nifty}
                bankNifty={bankNifty}
                sensex={sensex}
                nearestSupport={nearestSupport}
                nearestResistance={nearestResistance}
                supportDist={supportDist}
                resistanceDist={resistanceDist}
              />
            )}
            {tab === 'stocks'   && <StocksTab />}
            {tab === 'signals'  && <SignalsTab />}
            {tab === 'settings' && <SettingsTab onNavigate={navigate} />}
          </>
        )}
      </div>

      {/* Fixed bottom nav */}
      <BottomNav active={tab} onChange={handleTabChange} />
    </div>
  )
}
