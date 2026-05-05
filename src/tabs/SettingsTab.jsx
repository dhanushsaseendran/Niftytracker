import { useState, useEffect, useRef } from 'react'
import Card from '../components/Card.jsx'

const STORAGE_KEY = 'nifty_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// ── detect iOS ────────────────────────────────────────────────────────────────
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isInStandaloneMode() {
  return ('standalone' in navigator && navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
}

export default function SettingsTab({ onNavigate }) {
  const saved0 = loadSettings()

  const [ghOwner,      setGhOwner]      = useState(saved0.ghOwner      ?? '')
  const [ghRepo,       setGhRepo]       = useState(saved0.ghRepo        ?? '')
  const [soundEnabled, setSoundEnabled] = useState(saved0.soundEnabled  ?? true)
  const [preMarket,    setPreMarket]    = useState(saved0.preMarket      ?? false)
  const [flash,        setFlash]        = useState(false)

  // ── PWA install ──────────────────────────────────────────────────────────────
  const [installPrompt,  setInstallPrompt]  = useState(null)   // deferred event
  const [installState,   setInstallState]   = useState('unknown') // 'unknown' | 'available' | 'installed' | 'ios'

  useEffect(() => {
    if (isInStandaloneMode()) { setInstallState('installed'); return }
    if (isIOS())              { setInstallState('ios');       return }

    function onBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setInstallState('available')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Already installed (appinstalled fires if user installed elsewhere)
    window.addEventListener('appinstalled', () => setInstallState('installed'))

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallState('installed')
    setInstallPrompt(null)
  }

  // ── Notification permission ──────────────────────────────────────────────────
  const [notifState, setNotifState] = useState(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission   // 'default' | 'granted' | 'denied'
  })

  async function handleEnableNotif() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifState(result)
    if (result === 'granted') {
      // Fire a test notification so the user knows it worked
      new Notification('🔔 Notifications enabled!', {
        body: 'You will be alerted on BUY / SELL signals.',
        icon: '/icons/icon-192.png',
      })
    }
  }

  // ── Compute raw URL preview ───────────────────────────────────────────────────
  const rawUrl = ghOwner && ghRepo
    ? `https://raw.githubusercontent.com/${ghOwner.trim()}/${ghRepo.trim()}/main/live-data.json`
    : ''

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ghOwner, ghRepo, soundEnabled, preMarket,
    }))
    window.dispatchEvent(new Event('nifty_settings_changed'))
    setFlash(true)
    setTimeout(() => setFlash(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Install App ── */}
      <SectionHeader title="Install App" icon="📱" />
      <Card>
        {installState === 'installed' ? (
          <StatusRow icon="✅" text="App is installed on this device" color="#00e676" />
        ) : installState === 'available' ? (
          <ActionButton
            label="Install App"
            sub="Add Nifty Tracker to your home screen"
            icon="⬇️"
            color="#00e676"
            onClick={handleInstall}
          />
        ) : installState === 'ios' ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              Install on iPhone / iPad
            </div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
              1. Tap the <span style={{ color: '#00aaff' }}>Share</span> button (□↑) in Safari{'\n'}
              2. Scroll down and tap <span style={{ color: '#00aaff' }}>Add to Home Screen</span>{'\n'}
              3. Tap <span style={{ color: '#00aaff' }}>Add</span>
            </div>
          </div>
        ) : (
          <StatusRow icon="ℹ️" text="Open in Chrome and visit the site to install" color="#888" />
        )}
      </Card>

      {/* ── Notifications ── */}
      <SectionHeader title="Notifications" icon="🔔" />
      <Card>
        {notifState === 'granted' ? (
          <>
            <StatusRow icon="✅" text="Notifications are enabled" color="#00e676" />
            <Divider />
            <ToggleRow label="Sound Alert"       sub="Play sound when signal fires"    value={soundEnabled} onChange={setSoundEnabled} />
            <Divider />
            <ToggleRow label="Pre-Market Alerts" sub="Notify before 9:15 AM open"     value={preMarket}   onChange={setPreMarket} />
          </>
        ) : notifState === 'denied' ? (
          <div>
            <StatusRow icon="🚫" text="Notifications blocked" color="#ff3355" />
            <div style={{ fontSize: 11, color: '#666', marginTop: 8, lineHeight: 1.5 }}>
              Go to browser Settings → Site Settings → Notifications → find this site → Allow.
            </div>
          </div>
        ) : notifState === 'unsupported' ? (
          <StatusRow icon="⚠️" text="Notifications not supported on this browser" color="#ffaa00" />
        ) : (
          <ActionButton
            label="Enable Notifications"
            sub="Get alerted when BUY / SELL signal fires"
            icon="🔔"
            color="#00e676"
            onClick={handleEnableNotif}
          />
        )}
      </Card>

      {/* ── GitHub ── */}
      <SectionHeader title="GitHub (live data fallback)" icon="🐙" />
      <Card>
        <FieldRow
          label="GitHub Username"
          value={ghOwner}
          onChange={setGhOwner}
          placeholder="e.g. johndoe"
        />
        <Divider />
        <FieldRow
          label="Repository Name"
          value={ghRepo}
          onChange={setGhRepo}
          placeholder="e.g. nifty-tracker"
        />
        {rawUrl ? (
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#0a1a0a',
            border: '1px solid #1a3a1a', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#3a6a3a', fontWeight: 700,
              letterSpacing: '0.04em', marginBottom: 3 }}>
              RAW URL
            </div>
            <div style={{ fontSize: 11, color: '#4a8a4a', wordBreak: 'break-all',
              fontFamily: 'monospace' }}>
              {rawUrl}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 11, color: '#444' }}>
            Optional: enter username + repo to enable GitHub fallback data.
          </div>
        )}
      </Card>

      {/* ── Strategy ── */}
      <SectionHeader title="Strategy" icon="⚙️" />
      <Card>
        <InfoRow label="EMA Fast"         value="9" />
        <Divider />
        <InfoRow label="EMA Slow"         value="15" />
        <Divider />
        <InfoRow label="Min Angle"        value="30°" />
        <Divider />
        <InfoRow label="Candle Interval"  value="5 min" />
        <Divider />
        <InfoRow label="Level Confluence" value="±50 pts" />
        <Divider />
        <InfoRow label="Data Source"      value="Yahoo Finance (30s)" />
      </Card>

      {/* ── Key Levels ── */}
      <SectionHeader title="Levels" icon="📊" />
      <Card style={{ padding: 0 }}>
        <NavRow
          icon="📊"
          label="Key Levels"
          sub="Support & resistance levels for signal confluence"
          onClick={() => onNavigate('keyLevels')}
        />
      </Card>

      {/* ── Save ── */}
      <button
        onClick={save}
        style={{
          width: '100%', padding: 14,
          background: flash ? 'rgba(0,230,118,0.25)' : 'rgba(0,230,118,0.15)',
          border: '1.5px solid #00e676',
          borderRadius: 12, fontSize: 14, fontWeight: 700,
          color: '#00e676', cursor: 'pointer',
          letterSpacing: '0.04em', transition: 'all 0.2s',
        }}
      >
        {flash ? '✓ Saved!' : 'Save Settings'}
      </button>

      <div style={{ height: 8 }} />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#666',
        letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#222', margin: '10px 0' }} />
}

function StatusRow({ icon, text, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{text}</span>
    </div>
  )
}

function ActionButton({ label, sub, icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 12, padding: '6px 0',
        background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `rgba(0,230,118,0.12)`, border: `1px solid rgba(0,230,118,0.25)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ color: '#444', fontSize: 18 }}>›</span>
    </button>
  )
}

function FieldRow({ label, value, onChange, placeholder, secret }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <div style={{ fontSize: 11, color: '#555', fontWeight: 600,
        letterSpacing: '0.04em', marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', background: '#111',
            border: '1px solid #2a2a2a', borderRadius: 8,
            padding: `9px ${secret ? 36 : 12}px 9px 12px`,
            fontSize: 13, color: '#fff', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {secret && (
          <button
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555',
            }}
          >
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
    </div>
  )
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 46, height: 26, borderRadius: 13,
          background: value ? '#00e676' : '#2a2a2a',
          border: 'none', cursor: 'pointer',
          position: 'relative', flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3,
          left: value ? 23 : 3,
          width: 20, height: 20,
          borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
          display: 'block',
        }} />
      </button>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</span>
    </div>
  )
}

function NavRow({ icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 12, padding: '14px 16px',
        background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 9,
        background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: '#444', fontSize: 16 }}>›</span>
    </button>
  )
}
