export default function StatCard({ label, value, sub, accent = '#00E6C3' }) {
  return (
    <div style={{ background: '#0D1F35', border: `1px solid #1A3A5C`, borderRadius: 10,
      padding: '16px 20px', flex: 1,
      boxShadow: `0 0 12px ${accent}22, inset 0 0 8px ${accent}08` }}>
      <div style={{ fontSize: 10, color: '#5A7FA0', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#3A6080', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
