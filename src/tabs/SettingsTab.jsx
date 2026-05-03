import { useState, useEffect } from 'react'
import Card from '../components/Card.jsx'

const STORAGE_KEY = 'nifty_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export default function SettingsTab({ onNavigate }) {
  const saved0 = loadSettings()

  const [ghOwner,      setGhOwner]      = useState(saved0.ghOwner      ?? '')
  const [ghRepo,       setGhRepo]       = useState(saved0.ghRepo        ?? '')
  const [clientId,     setClientId]     = useState(saved0.clientId      ?? '')
  const [accessToken,  setAccessToken]  = useState(saved0.accessToken   ?? '')
  const [fcmKey,       setFcmKey]       = useState(saved0.fcmKey        ?? '')
  const [pushEnabled,  setPushEnabled]  = useState(saved0.pushEnabled   ?? true)
  const [soundEnabled, setSoundEnabled] = useState(saved0.soundEnabled  ?? true)
  const [preMarket,    setPreMarket]    = useState(saved0.preMarket      ?? false)
  const [flash,        setFlash]        = useState(false)   // "Saved!" feedback

  // Compute raw URL on the fly for preview
  const rawUrl = ghOwner && ghRepo
    ? `https://raw.githubusercontent.com/${ghOwner.trim()}/${ghRepo.trim()}/main/live-data.json`
    : ''

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ghOwner, ghRepo,
      clientId, accessToken, fcmKey,
      pushEnabled, soundEnabled, preMarket,
    }))
    // Notify App that settings changed so it re-reads the URL
    window.dispatchEvent(new Event('nifty_settings_changed'))
    setFlash(true)
    setTimeout(() => setFlash(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── GitHub ── */}
      <SectionHeader title="GitHub (live data source)" icon="🐙" />
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
              RAW URL (auto-constructed)
            </div>
            <div style={{ fontSize: 11, color: '#4a8a4a', wordBreak: 'break-all',
              fontFamily: 'monospace' }}>
              {rawUrl}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 11, color: '#444' }}>
            Enter username + repo to enable live data from GitHub Actions.
          </div>
        )}
      </Card>

      {/* ── Dhan API ── */}
      <SectionHeader title="Dhan API" icon="🔑" />
      <Card>
        <FieldRow label="Client ID"    value={clientId}    onChange={setClientId}    placeholder="e.g. 1100012345" />
        <Divider />
        <FieldRow label="Access Token" value={accessToken} onChange={setAccessToken} placeholder="Bearer token from Dhan" secret />
      </Card>

      {/* ── Push Notifications ── */}
      <SectionHeader title="Push Notifications" icon="🔔" />
      <Card>
        <FieldRow label="FCM Server Key" value={fcmKey} onChange={setFcmKey} placeholder="Firebase server key" secret />
        <Divider />
        <ToggleRow label="Enable Push Alerts"  sub="Signal notifications to your phone" value={pushEnabled}  onChange={setPushEnabled} />
        <Divider />
        <ToggleRow label="Sound Alert"         sub="Play sound when signal fires"        value={soundEnabled} onChange={setSoundEnabled} />
        <Divider />
        <ToggleRow label="Pre-Market Alerts"   sub="Notify before 9:15 AM open"         value={preMarket}   onChange={setPreMarket} />
      </Card>

      {/* ── Strategy (read-only info) ── */}
      <SectionHeader title="Strategy" icon="⚙️" />
      <Card>
        <InfoRow label="EMA Fast"         value="9" />
        <Divider />
        <InfoRow label="EMA Slow"         value="15" />
        <Divider />
        <InfoRow label="Min Angle"        value="30°  (hard condition)" />
        <Divider />
        <InfoRow label="Candle Interval"  value="5 min" />
        <Divider />
        <InfoRow label="Level Confluence" value="±50 pts  (hard condition)" />
        <Divider />
        <InfoRow label="BSL / SSL Warning" value="< 50 pts" />
        <Divider />
        <InfoRow label="Confirmation"     value="Bank Nifty + Sensex" />
      </Card>

      {/* ── Key Levels nav row ── */}
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
