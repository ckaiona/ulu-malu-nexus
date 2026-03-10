const A = '#00E6C3', DARK = '#060F1E', BORDER = '#1A3A5C'

const NAV = [
  { id: 'dashboard',  icon: '⬡', label: 'Dashboard',  sub: 'Overview' },
  { id: 'drafts',     icon: '◈', label: 'Drafts',      sub: 'Review & Send' },
  { id: 'briefing',   icon: '◆', label: 'Briefings',   sub: 'AI Reports' },
  { id: 'pentest',    icon: '◉', label: 'Pentest',     sub: 'Scan Queue' },
  { id: 'shield',     icon: '⬢', label: 'Threat Shield', sub: 'Live Defense' },
  { id: 'auditlog',   icon: '◇', label: 'Audit Log',   sub: 'All Actions' },
]

export default function Sidebar({ active, onNav }) {
  return (
    <div style={{ width: 200, background: '#080F1C', borderRight: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 18px 12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ color: A, fontSize: 15, fontWeight: 700, letterSpacing: 3,
          textShadow: `0 0 16px ${A}88` }}>◈ ULU MALU</div>
        <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginTop: 2 }}>NEXUS v3.0</div>
      </div>
      <div style={{ flex: 1, padding: '12px 0' }}>
        {NAV.map(n => {
          const on = active === n.id
          return (
            <div key={n.id} onClick={() => onNav(n.id)} style={{
              padding: '12px 18px', cursor: 'pointer',
              borderLeft: `2px solid ${on ? A : 'transparent'}`,
              background: on ? `${A}08` : 'transparent', marginBottom: 2
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ color: on ? A : '#2A5A7A' }}>{n.icon}</span>
                <span style={{ fontSize: 10, color: on ? '#C8E0F4' : '#3A6080' }}>{n.label}</span>
              </div>
              <div style={{ fontSize: 9, color: on ? '#5A9ABA' : '#1A4060', paddingLeft: 22 }}>{n.sub}</div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '12px 18px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 9, color: '#1A4060', letterSpacing: 2, marginBottom: 8 }}>STACK</div>
        {['Grok Beta', 'Azure Functions', 'SharePoint', 'MS Graph'].map(s => (
          <div key={s} style={{ fontSize: 9, color: '#2A5A7A', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0A4A3A', display: 'inline-block' }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}
