import { useState } from 'react'

const A = '#00E6C3', BORDER = '#1A3A5C'

const ACTIONS = [
  { id: 'pentest',  icon: '◉', label: 'Launch Pentest',  nav: 'pentest' },
  { id: 'agent',    icon: '⬡', label: 'Deploy AI Agent', nav: null },
  { id: 'outreach', icon: '◈', label: 'Send Outreach',   nav: 'drafts' },
  { id: 'scenario', icon: '◆', label: 'Run Scenarios',   nav: null },
  { id: 'invoices', icon: '◇', label: 'Audit Invoices',  nav: 'auditlog' },
  { id: 'shield',   icon: '⬢', label: 'Threat Scan',     nav: 'shield' },
  { id: 'azure',    icon: '▣', label: 'Azure Resources', nav: null },
]

export default function RightRail({ onNav }) {
  const [flash, setFlash] = useState(null)

  function handleClick(action) {
    if (action.nav) {
      onNav(action.nav)
    } else {
      setFlash(action.id)
      setTimeout(() => setFlash(null), 1200)
    }
  }

  return (
    <div style={{ width: 180, background: '#080F1C', borderLeft: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 14px 12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>QUICK ACTIONS</div>
      </div>
      <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {ACTIONS.map(a => {
          const isFlash = flash === a.id
          return (
            <div key={a.id} onClick={() => handleClick(a)} style={{
              padding: '10px 14px', cursor: 'pointer', marginBottom: 2,
              borderRight: `2px solid ${isFlash ? A : 'transparent'}`,
              background: isFlash ? `${A}12` : 'transparent',
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${A}08`}
            onMouseLeave={e => e.currentTarget.style.background = isFlash ? `${A}12` : 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ color: isFlash ? A : '#2A5A7A', fontSize: 13 }}>{a.icon}</span>
                <span style={{ fontSize: 9, color: isFlash ? A : '#3A6080', letterSpacing: 1 }}>{a.label}</span>
              </div>
              {isFlash && (
                <div style={{ fontSize: 8, color: A, paddingLeft: 21, letterSpacing: 1, opacity: 0.7 }}>
                  COMING SOON
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
