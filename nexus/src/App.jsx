import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import ReviewDrafts from './pages/ReviewDrafts'
import BriefingGenerator from './pages/BriefingGenerator'
import PentestQueue from './pages/PentestQueue'
import AuditLog from './pages/AuditLog'

const PAGES = {
  dashboard: Dashboard,
  drafts:    ReviewDrafts,
  briefing:  BriefingGenerator,
  pentest:   PentestQueue,
  auditlog:  AuditLog,
}

export default function App() {
  const [nav, setNav]             = useState('dashboard')
  const [clientHint, setClientHint] = useState(null)

  const handleClientHint = (page, client) => {
    setClientHint({ page, client })
    setNav(page)
  }

  const Page = PAGES[nav] || Dashboard

  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: '#060F1E',
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,230,195,0.012) 2px,rgba(0,230,195,0.012) 4px)' }} />
      <Header alertCount={3} onNav={setNav} onClientHint={handleClientHint} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar active={nav} onNav={setNav} />
        <Page clientHint={clientHint} />
      </div>
    </div>
  )
}
