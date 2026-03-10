/**
 * ThreatShield — Continuous Security Monitoring Dashboard
 * Always-on defense: ransomware, credentials, exposed services,
 * data exfiltration, backdoors, endpoint protection, identity security.
 * Best defense is a better offense.
 */
import { useState, useEffect, useCallback } from 'react'

const A = '#00E6C3', WARN = '#FF6B35', GREEN = '#00FF88', RED = '#FF3355',
      BORDER = '#1A3A5C', CARD = '#0D1F35', CYAN = '#00AAFF'

/* ── severity helpers ── */
function ThreatBadge({ level }) {
  const map = {
    critical: [RED,     '#2A0810'],
    high:     [WARN,    '#2A1208'],
    medium:   ['#FFD166','#2A2810'],
    low:      [GREEN,   '#0A2A14'],
    info:     ['#5A9ABA','#0A2030'],
    clear:    [GREEN,   '#0A2A14'],
  }
  const [c, bg] = map[level?.toLowerCase()] || ['#5A9ABA','#0A2030']
  return (
    <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 4,
      color: c, background: bg, border: `1px solid ${c}33`, fontWeight: 600 }}>
      {level?.toUpperCase()}
    </span>
  )
}

function Pulse({ color, size = 8 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        animation: 'pulse 2s infinite', opacity: 0.6 }} />
      <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: color }} />
      <style>{`@keyframes pulse { 0%,100% { transform:scale(1); opacity:0.6 } 50% { transform:scale(1.8); opacity:0 } }`}</style>
    </span>
  )
}

function MiniBar({ v, max = 100, color }) {
  const pct = Math.min(100, (v / max) * 100)
  const c = color || (pct > 75 ? RED : pct > 40 ? WARN : GREEN)
  return (
    <div style={{ background: '#0A1A2E', borderRadius: 3, height: 5, width: '100%' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3,
        transition: 'width 0.5s ease' }} />
    </div>
  )
}

/* ── Kill Chain phases ── */
const KILL_CHAIN = [
  { phase: 'Reconnaissance',    icon: '🔍', desc: 'Port scans, OSINT, DNS enum' },
  { phase: 'Initial Access',    icon: '🚪', desc: 'Phishing, exploit, brute force' },
  { phase: 'Persistence',       icon: '🪝', desc: 'Backdoors, scheduled tasks, registry' },
  { phase: 'Lateral Movement',  icon: '🕸️', desc: 'Pass-the-hash, RDP pivot, SMB' },
  { phase: 'Data Exfiltration', icon: '📤', desc: 'DNS tunnel, cloud upload, staging' },
  { phase: 'Encryption',        icon: '🔒', desc: 'Ransomware payload, file lock' },
]

/* ── Mock continuous monitoring data ── */
const MOCK_THREAT_FEEDS = [
  { id: 'TF-001', vector: 'Ransomware',        client: 'HEMIC',            severity: 'low',      status: 'Monitored',  detail: 'No ransomware indicators — 0 suspicious encryption ops in 24h', phase: 'Encryption', lastScan: '2m ago' },
  { id: 'TF-002', vector: 'Exposed RDP',        client: 'HMSA',             severity: 'medium',   status: 'Flagged',    detail: 'RDP port 3389 open on 2 endpoints — recommend restrict to VPN only', phase: 'Initial Access', lastScan: '5m ago' },
  { id: 'TF-003', vector: 'Credential Leak',    client: 'HEMIC',            severity: 'high',     status: 'Active',     detail: '3 employee emails found in dark web breach dump (2026-03-07)', phase: 'Reconnaissance', lastScan: '1m ago' },
  { id: 'TF-004', vector: 'Weak VPN',           client: 'Pacific Defense',  severity: 'low',      status: 'Monitored',  detail: 'VPN configs verified — AES-256, MFA enforced, no split tunnel', phase: 'Initial Access', lastScan: '8m ago' },
  { id: 'TF-005', vector: 'Data Loss',          client: 'MLP',              severity: 'medium',   status: 'Flagged',    detail: 'Unusual OneDrive bulk download (420 files) by user J.Tanaka', phase: 'Data Exfiltration', lastScan: '3m ago' },
  { id: 'TF-006', vector: 'Backdoor',           client: 'TBL',              severity: 'low',      status: 'Monitored',  detail: 'No unauthorized persistence mechanisms detected', phase: 'Persistence', lastScan: '12m ago' },
  { id: 'TF-007', vector: 'Phished Creds',      client: 'HMSA',             severity: 'high',     status: 'Active',     detail: 'Suspicious login from Lagos, Nigeria — user K.Patel, MFA bypassed via token replay', phase: 'Initial Access', lastScan: '30s ago' },
  { id: 'TF-008', vector: 'Exposed Server',     client: 'HEMIC',            severity: 'medium',   status: 'Flagged',    detail: 'Dev API server responding on public IP — no auth middleware', phase: 'Reconnaissance', lastScan: '6m ago' },
  { id: 'TF-009', vector: 'Stolen Passwords',   client: 'Pacific Defense',  severity: 'low',      status: 'Monitored',  detail: 'Password policy enforced — 0 accounts with compromised creds', phase: 'Reconnaissance', lastScan: '15m ago' },
  { id: 'TF-010', vector: 'Lateral Movement',   client: 'MLP',              severity: 'medium',   status: 'Investigating', detail: 'Abnormal SMB traffic from WORKSTATION-14 to fileserver — SOC isolating host', phase: 'Lateral Movement', lastScan: '1m ago' },
]

const MOCK_ENDPOINT_STATUS = [
  { client: 'HEMIC',           total: 340, protected: 338, isolated: 1, offline: 1 },
  { client: 'HMSA',            total: 520, protected: 515, isolated: 3, offline: 2 },
  { client: 'Pacific Defense', total: 180, protected: 180, isolated: 0, offline: 0 },
  { client: 'MLP',             total: 95,  protected: 93,  isolated: 1, offline: 1 },
  { client: 'TBL',             total: 62,  protected: 62,  isolated: 0, offline: 0 },
]

const MOCK_IDENTITY_EVENTS = [
  { time: '07:42', user: 'K.Patel@hmsa.com',          event: 'MFA bypass — token replay',           risk: 'critical' },
  { time: '07:38', user: 'J.Tanaka@mlp.com',          event: 'Bulk file download (420 files)',       risk: 'high' },
  { time: '07:21', user: 'admin@hemic.com',            event: 'Global Admin login from new device',   risk: 'medium' },
  { time: '06:55', user: 'svc-backup@pacdef.mil',      event: 'Service account password rotation',    risk: 'low' },
  { time: '06:30', user: 'R.Kalani@tbl.com',           event: 'Normal sign-in',                       risk: 'info' },
]

function StatusBadge({ s }) {
  const map = {
    'Monitored':     [GREEN,   '#0A2A14'],
    'Flagged':       ['#FFD166','#2A2810'],
    'Active':        [RED,     '#2A0810'],
    'Investigating': [CYAN,    '#0A1A30'],
    'Contained':     [A,       '#0A2A20'],
  }
  const [c, bg] = map[s] || ['#5A9ABA','#0A2030']
  return (
    <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 4,
      color: c, background: bg, border: `1px solid ${c}33` }}>
      {s?.toUpperCase()}
    </span>
  )
}

export default function ThreatShield({ onPageData }) {
  const [feeds]     = useState(MOCK_THREAT_FEEDS)
  const [endpoints] = useState(MOCK_ENDPOINT_STATUS)
  const [identity]  = useState(MOCK_IDENTITY_EVENTS)
  const [uptime]    = useState(99.97)
  const [tick, setTick] = useState(0)

  // Simulate live pulse
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(iv)
  }, [])

  const activeThreats  = feeds.filter(f => f.severity === 'high' || f.severity === 'critical').length
  const flaggedCount   = feeds.filter(f => f.status === 'Flagged' || f.status === 'Investigating').length
  const totalEndpoints = endpoints.reduce((s, e) => s + e.total, 0)
  const isolatedTotal  = endpoints.reduce((s, e) => s + e.isolated, 0)

  useEffect(() => {
    onPageData?.({
      activeThreats, flaggedCount, totalEndpoints, isolatedTotal,
      feeds: feeds.map(f => ({ id: f.id, vector: f.vector, client: f.client, severity: f.severity, status: f.status })),
    })
  }, [feeds, onPageData])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease' }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 11, color: A, letterSpacing: 3, fontWeight: 700 }}>THREAT SHIELD</div>
            <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>CONTINUOUS SECURITY OPERATIONS</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pulse color={GREEN} />
          <span style={{ fontSize: 10, color: GREEN, letterSpacing: 1 }}>MONITORING ACTIVE</span>
          <span style={{ fontSize: 9, color: '#2A5A7A', marginLeft: 8 }}>Uptime {uptime}%</span>
        </div>
      </div>

      {/* ── Top stat cards ── */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Active Threats',    value: activeThreats,  accent: activeThreats > 0 ? RED : GREEN, sub: 'Require immediate action' },
          { label: 'Flagged Items',     value: flaggedCount,   accent: WARN, sub: 'Under investigation' },
          { label: 'Endpoints Guarded', value: totalEndpoints, accent: A, sub: `${isolatedTotal} isolated` },
          { label: 'Attack Vectors',    value: feeds.length,   accent: CYAN, sub: 'Monitored continuously' },
          { label: 'SOC Uptime',        value: `${uptime}%`,   accent: GREEN, sub: '24/7/365 coverage' },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 9, color: '#3A6080', letterSpacing: 1, marginBottom: 6 }}>{c.label.toUpperCase()}</div>
            <div style={{ fontSize: 26, color: c.accent, fontWeight: 700 }}>{c.value}</div>
            <div style={{ fontSize: 9, color: '#2A5A7A', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Kill Chain Coverage ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontSize: 9, color: A, letterSpacing: 2, marginBottom: 14 }}>KILL CHAIN COVERAGE — INTERCEPT AT EVERY PHASE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {KILL_CHAIN.map((k, i) => {
            const threats = feeds.filter(f => f.phase === k.phase)
            const worst = threats.reduce((w, t) => {
              const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
              return (order[t.severity] || 0) > (order[w] || 0) ? t.severity : w
            }, 'clear')
            const colorMap = { critical: RED, high: WARN, medium: '#FFD166', low: GREEN, clear: '#1A3A5C' }
            return (
              <div key={k.phase} style={{ flex: 1, position: 'relative' }}>
                <div style={{ background: '#0A1A2E', border: `1px solid ${colorMap[worst]}44`,
                  borderRadius: 8, padding: '12px 10px', textAlign: 'center', minHeight: 90,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                  <div style={{ fontSize: 9, color: colorMap[worst], fontWeight: 600, letterSpacing: 1 }}>{k.phase.toUpperCase()}</div>
                  <div style={{ fontSize: 8, color: '#2A5A7A', marginTop: 4 }}>{k.desc}</div>
                  {threats.length > 0 && (
                    <div style={{ fontSize: 9, color: colorMap[worst], marginTop: 6, fontWeight: 700 }}>
                      {threats.length} alert{threats.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                {i < KILL_CHAIN.length - 1 && (
                  <div style={{ position: 'absolute', right: -8, top: '50%', color: '#1A3A5C', fontSize: 12 }}>→</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Threat Feed — main table ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: A, letterSpacing: 2 }}>LIVE THREAT FEED</span>
            <Pulse color={activeThreats > 0 ? RED : GREEN} size={6} />
          </div>
          <span style={{ fontSize: 9, color: '#2A5A7A' }}>Auto-refresh • {tick} cycles</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['ID', 'VECTOR', 'CLIENT', 'PHASE', 'SEVERITY', 'STATUS', 'DETAIL', 'LAST SCAN'].map(h =>
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 400, fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {feeds.map((f, i) => (
              <tr key={f.id} style={{ borderTop: `1px solid ${BORDER}`,
                background: (f.severity === 'critical' || f.severity === 'high') ? `${RED}06` : 'transparent' }}>
                <td style={{ padding: '12px 14px', fontSize: 10, color: A, fontFamily: 'monospace' }}>{f.id}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: '#C8E0F4', fontWeight: 600 }}>{f.vector}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: '#A0C8E0' }}>{f.client}</td>
                <td style={{ padding: '12px 14px', fontSize: 9, color: '#5A9ABA' }}>{f.phase}</td>
                <td style={{ padding: '12px 14px' }}><ThreatBadge level={f.severity} /></td>
                <td style={{ padding: '12px 14px' }}><StatusBadge s={f.status} /></td>
                <td style={{ padding: '12px 14px', fontSize: 10, color: '#6A8AA0', maxWidth: 260 }}>{f.detail}</td>
                <td style={{ padding: '12px 14px', fontSize: 9, color: '#2A5A7A' }}>{f.lastScan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Bottom split: Endpoints + Identity ── */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* Endpoint Protection */}
        <div style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, color: A, letterSpacing: 2 }}>ENDPOINT PROTECTION</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['CLIENT', 'TOTAL', 'PROTECTED', 'ISOLATED', 'OFFLINE'].map(h =>
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 400, fontSize: 9, color: '#2A5A7A', letterSpacing: 1 }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {endpoints.map((e, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: '#A0C8E0' }}>{e.client}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A9ABA' }}>{e.total}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: GREEN }}>{e.protected}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: e.isolated > 0 ? WARN : '#3A6080' }}>{e.isolated}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: e.offline > 0 ? RED : '#3A6080' }}>{e.offline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Identity & Access Events */}
        <div style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, color: A, letterSpacing: 2 }}>IDENTITY & ACCESS EVENTS</span>
          </div>
          <div style={{ padding: '6px 0' }}>
            {identity.map((ev, i) => (
              <div key={i} style={{ padding: '10px 20px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                display: 'flex', alignItems: 'center', gap: 12,
                background: ev.risk === 'critical' ? `${RED}08` : 'transparent' }}>
                <span style={{ fontSize: 9, color: '#2A5A7A', minWidth: 40, fontFamily: 'monospace' }}>{ev.time}</span>
                <ThreatBadge level={ev.risk} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#A0C8E0' }}>{ev.user}</div>
                  <div style={{ fontSize: 9, color: '#5A7FA0', marginTop: 2 }}>{ev.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
