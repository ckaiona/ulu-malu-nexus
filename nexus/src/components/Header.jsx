import { useState, useEffect } from 'react'
import VoiceCommander from './VoiceCommander'
import { useAuth } from '../lib/useAuth'

const A = '#00E6C3', WARN = '#FF6B35', GREEN = '#00FF88', BORDER = '#1A3A5C'

function Dot({ c = GREEN }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8, marginRight: 6 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c, animation: 'pulse 2s infinite' }} />
    </span>
  )
}

function UserBadge() {
  const { isAuthenticated, msalEnabled, account, profile, photo, login, logout } = useAuth()

  if (!msalEnabled) {
    // MSAL not configured — show static placeholder
    return (
      <span style={{ background: `${A}22`, border: `1px solid ${A}44`, borderRadius: 6,
        padding: '3px 10px', color: A, fontSize: 10 }}>
        caiona@ulumalusystems.com
      </span>
    )
  }

  if (!isAuthenticated) {
    return (
      <button onClick={login} style={{ background: `${A}22`, border: `1px solid ${A}66`, borderRadius: 6,
        padding: '3px 12px', color: A, fontSize: 10, cursor: 'pointer' }}>
        🔑 SIGN IN
      </button>
    )
  }

  const displayName = profile?.displayName || account?.name || account?.username || 'User'
  const email = profile?.mail || account?.username || ''

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {photo
        ? <img src={photo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${A}66` }} />
        : <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${A}33`,
            border: `1px solid ${A}66`, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10, color: A }}>
            {displayName[0]?.toUpperCase()}
          </span>
      }
      <span style={{ background: `${A}22`, border: `1px solid ${A}44`, borderRadius: 6,
        padding: '3px 10px', color: A, fontSize: 10, cursor: 'pointer' }}
        onClick={logout} title={`${email} — click to sign out`}>
        {displayName.split(' ')[0].toUpperCase()}
      </span>
    </div>
  )
}

export default function Header({ alertCount = 0, onNav, onClientHint }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  return (
    <div style={{ height: 52, background: '#080F1C', borderBottom: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Dot c={GREEN} />
        <span style={{ fontSize: 10, color: '#3A7A5A' }}>ZERO-TRUST ACTIVE</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 10 }}>
        <VoiceCommander onNav={onNav} onClientHint={onClientHint} />
        <span style={{ color: '#2A5A7A' }}>{time.toLocaleTimeString('en-US', { hour12: false })} HST</span>
        {alertCount > 0 && <><Dot c={WARN} /><span style={{ color: '#8A4A2A' }}>{alertCount} ALERT{alertCount > 1 ? 'S' : ''}</span></>}
        <UserBadge />
      </div>
    </div>
  )
}
