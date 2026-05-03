export default function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: 14,
      padding: '16px 16px',
      border: '1px solid #2a2a2a',
      ...style,
    }}>
      {children}
    </div>
  )
}
