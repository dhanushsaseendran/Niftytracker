export default function StatusBadge({ status }) {
  const positive = status === 'Positive'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: positive ? 'rgba(0,230,118,0.15)' : 'rgba(255,51,85,0.15)',
      color: positive ? '#00e676' : '#ff3355',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 8 }}>{positive ? '▲' : '▼'}</span>
      {status}
    </span>
  )
}
