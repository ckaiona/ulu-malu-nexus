import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import KiaiChat from './components/KiaiChat'
import Dashboard from './pages/Dashboard'
import ReviewDrafts from './pages/ReviewDrafts'
import BriefingGenerator from './pages/BriefingGenerator'
import PentestQueue from './pages/PentestQueue'
import AuditLog from './pages/AuditLog'
import Analytics from './pages/Analytics'

const A = '#00E6C3', WARN = '#FF6B35', GREEN = '#00FF88', BORDER = '#1A3A5C', CARD = '#0D1F35'

const QUICK_ACTIONS = [
  ['⬡', 'LAUNCH PENTEST',   A,        'pentest'],
  ['◈', 'DEPLOY AI AGENT',  '#00AAFF','dashboard'],
  ['◆', 'SEND OUTREACH',    '#FFD166','drafts'],
  ['◉', 'RUN SCENARIOS',    GREEN,    'briefing'],
  ['◇', 'AUDIT INVOICES',   WARN,     'auditlog'],
  ['⊛', 'THREAT SCAN',      WARN,     'pentest'],
]

const AZURE_RESOURCES = [
  { name: 'kiai-guardian',  type: 'AI Services',    ok: true  },
  { name: 'ulu-malu-kv',    type: 'Key Vault',       ok: true  },
  { name: 'rg-uluguardian', type: 'Resource Group',  ok: true  },
  { name: 'MS Foundry',     type: 'Sign-in required',ok: false },
]

const ULU_STACK = ['Copilot Studio','Azure Foundry','Azure Functions','Logic Apps','Key Vault','SharePoint','Power BI']

const PAGES = {
  dashboard: Dashboard,
  drafts:    ReviewDrafts,
  briefing:  BriefingGenerator,
  pentest:   PentestQueue,
  auditlog:  AuditLog,
  analytics: Analytics,
}

function RightPanel({ onNav }) {
  return (
    <div style={{ width: 190, background: '#080F1C', borderLeft: `1px solid ${BORDER}`,
      padding: '16px 12px', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>

      <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginBottom: 12 }}>QUICK ACTIONS</div>
      {QUICK_ACTIONS.map(([icon, label, color, page]) => (
        <button key={label} onClick={() => onNav(page)}
          style={{ width: '100%', padding: '10px 14px', marginBottom: 8, background: 'transparent',
            border: `1px solid ${BORDER}`, borderRadius: 8, color: '#5A7FA0', fontSize: 11,
            cursor: 'pointer', textAlign: 'left', fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = '#5A7FA0' }}>
          <span style={{ color }}>{icon}</span>{label}
        </button>
      ))}

      <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 12 }}>
        <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginBottom: 10 }}>AZURE RESOURCES</div>
        {AZURE_RESOURCES.map((r, i) => (
          <div key={i} style={{ marginBottom: 8, padding: '6px 8px', background: CARD,
            borderRadius: 6, border: `1px solid ${r.ok ? BORDER : WARN + '44'}` }}>
            <div style={{ fontSize: 9, color: r.ok ? '#5A9ABA' : WARN, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
            <div style={{ fontSize: 8, color: r.ok ? '#2A4A60' : WARN + '88' }}>{r.type}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 12 }}>
        <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginBottom: 10 }}>ULU STACK</div>
        {ULU_STACK.map(s => (
          <div key={s} style={{ fontSize: 9, color: '#1A4A6A', padding: '3px 0',
            display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0A4A3A',
              display: 'inline-block', flexShrink: 0 }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [nav, setNav]               = useState('dashboard')
  const [clientHint, setClientHint] = useState(null)
  const [pageData, setPageData]     = useState({})

  const handleClientHint = (page, client) => {
    setClientHint({ page, client })
    setNav(page)
  }

  const handlePageData = useCallback((data) => {
    setPageData(data)
  }, [])

  const Page = PAGES[nav] || Dashboard

  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: '#060F1E',
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,230,195,0.012) 2px,rgba(0,230,195,0.012) 4px)' }} />
      <Header alertCount={3} onNav={setNav} onClientHint={handleClientHint} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={nav} onNav={setNav} />
        <Page clientHint={clientHint} onPageData={handlePageData} />
        <RightPanel onNav={setNav} />
      </div>
      <KiaiChat currentPage={nav} pageData={pageData} onNav={setNav} />
    </div>
  )
}
