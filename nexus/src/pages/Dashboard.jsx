/**
 * Dashboard — full ULU Malu service portfolio view.
 * Per spec: HEMIC and other clients receive cloud, app dev, AI, compliance,
 * AND cybersecurity services. This dashboard reflects all of them.
 */
import { useState, useEffect } from 'react'
import StatCard from '../components/StatCard'
import { api } from '../api'

const A = '#00E6C3', WARN = '#FF6B35', GREEN = '#00FF88', BORDER = '#1A3A5C', CARD = '#0D1F35'

function Badge({ status }) {
  const map = {
    secure:   [GREEN,    '#0A2A14'],
    healthy:  [GREEN,    '#0A2A14'],
    warning:  ['#FFD166','#2A2810'],
    critical: [WARN,     '#2A1208'],
    open:     [WARN,     '#2A1208'],
    degraded: ['#FFD166','#2A2810'],
  }
  const [c, bg] = map[status?.toLowerCase()] || ['#5A9ABA','#0A2030']
  return (
    <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4,
      color: c, background: bg, border: `1px solid ${c}33` }}>
      {status?.toUpperCase()}
    </span>
  )
}

function MiniBar({ v, accent }) {
  const c = accent || (v > 60 ? WARN : v > 30 ? '#FFD166' : GREEN)
  return (
    <div style={{ background: '#0A1A2E', borderRadius: 3, height: 5, width: '100%' }}>
      <div style={{ height: '100%', width: `${v}%`, background: c, borderRadius: 3 }} />
    </div>
  )
}

// Mock data reflecting full service portfolio
const MOCK_CLIENTS = [
  { name: 'HEMIC',                       riskScore: 12, cloudHealth: 98, appUptime: 99.9, complianceScore: 94, alerts: 1,  aiUtilization: 76, status: 'secure' },
  { name: 'HMSA',                        riskScore: 21, cloudHealth: 95, appUptime: 99.1, complianceScore: 88, alerts: 2,  aiUtilization: 41, status: 'secure' },
  { name: 'Pacific Defense',             riskScore: 8,  cloudHealth: 99, appUptime: 100,  complianceScore: 97, alerts: 0,  aiUtilization: 60, status: 'secure' },
  { name: 'Maui Land & Pineapple (MLP)', riskScore: 18, cloudHealth: 93, appUptime: 98.7, complianceScore: 85, alerts: 1,  aiUtilization: 33, status: 'secure' },
  { name: 'Terruya Brothers (TBL)',       riskScore: 15, cloudHealth: 96, appUptime: 99.2, complianceScore: 89, alerts: 0,  aiUtilization: 28, status: 'secure' },
]

const MOCK_ALERTS = [
  { AlertId: 'A001', ClientName: 'HEMIC',    Severity: 'medium', Title: 'SSL cert expiring in 14 days',           Status: 'Open', DetectedDate: '2026-03-04', ServiceArea: 'Cloud' },
  { AlertId: 'A002', ClientName: 'HMSA',     Severity: 'low',    Title: 'Unused IAM role detected',               Status: 'Open', DetectedDate: '2026-03-03', ServiceArea: 'Compliance' },
  { AlertId: 'A003', ClientName: 'HMSA',     Severity: 'medium', Title: 'App response time spike (2.4s avg)',      Status: 'Open', DetectedDate: '2026-03-05', ServiceArea: 'App Dev' },
]

const SERVICE_AREAS = ['Cloud Infrastructure', 'Application Dev', 'AI Services', 'Cybersecurity', 'Compliance']

export default function Dashboard({ onPageData }) {
  const [clients, setClients] = useState(MOCK_CLIENTS)
  const [alerts,  setAlerts]  = useState(MOCK_ALERTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getAlerts()])
      .then(([a]) => { if (a?.length) setAlerts(a) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Report data to Kia'i context whenever it changes
  useEffect(() => {
    onPageData?.({
      clients: clients.map(c => ({ name: c.name, status: c.status, alerts: c.alerts, complianceScore: c.complianceScore })),
      alerts:  alerts.map(a => ({ id: a.AlertId, client: a.ClientName, severity: a.Severity, title: a.Title, status: a.Status })),
      summary: { totalAlerts: alerts.length, activeClients: clients.length }
    })
  }, [clients, alerts, onPageData])

  const totalAlerts   = alerts.length
  const criticalCount = alerts.filter(a => a.Severity === 'high' || a.Severity === 'critical').length
  const avgCompliance = Math.round(clients.reduce((s, c) => s + c.complianceScore, 0) / clients.length)
  const avgCloud      = Math.round(clients.reduce((s, c) => s + c.cloudHealth, 0) / clients.length)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease' }}>

      {/* Top stat cards — full service view */}
      <div style={{ display: 'flex', gap: 12 }}>
        <StatCard label="Active Clients"    value={clients.length} sub="Full managed services"    accent={A} />
        <StatCard label="Cloud Health"      value={`${avgCloud}%`} sub="Avg across all tenants"   accent={GREEN} />
        <StatCard label="Compliance Score"  value={`${avgCompliance}%`} sub="NIST / PCI-DSS / RMF" accent="#00AAFF" />
        <StatCard label="Open Alerts"       value={totalAlerts}    sub={`${criticalCount} critical`} accent={criticalCount > 0 ? WARN : '#5A9ABA'} />
      </div>

      {/* Client posture — full service grid */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: A, letterSpacing: 2 }}>CLIENT SERVICE POSTURE</span>
          <span style={{ fontSize: 9, color: '#2A5A7A' }}>{loading ? 'SYNCING...' : 'LIVE'}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['CLIENT', 'SECURITY', 'CLOUD', 'APP UPTIME', 'COMPLIANCE', 'AI UTIL', 'ALERTS', 'STATUS'].map(h =>
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 400, fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#A0C8E0', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '12px 16px', width: 90 }}>
                  <MiniBar v={100 - c.riskScore} />
                  <div style={{ fontSize: 9, color: c.riskScore > 40 ? WARN : GREEN, marginTop: 3 }}>Risk {c.riskScore}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: c.cloudHealth > 95 ? GREEN : '#FFD166' }}>{c.cloudHealth}%</td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: c.appUptime > 99 ? GREEN : '#FFD166' }}>{c.appUptime}%</td>
                <td style={{ padding: '12px 16px', width: 100 }}>
                  <MiniBar v={c.complianceScore} accent="#00AAFF" />
                  <div style={{ fontSize: 9, color: '#5A9ABA', marginTop: 3 }}>{c.complianceScore}%</div>
                </td>
                <td style={{ padding: '12px 16px', width: 100 }}>
                  <MiniBar v={c.aiUtilization} accent={A} />
                  <div style={{ fontSize: 9, color: A, marginTop: 3 }}>{c.aiUtilization}%</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: c.alerts > 0 ? WARN : '#3A6080' }}>{c.alerts}</td>
                <td style={{ padding: '12px 16px' }}><Badge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Service area coverage */}
      <div style={{ display: 'flex', gap: 12 }}>
        {SERVICE_AREAS.map(area => (
          <div key={area} style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, color: '#3A6080', letterSpacing: 1, marginBottom: 8 }}>{area.toUpperCase()}</div>
            <div style={{ fontSize: 22, color: GREEN, fontWeight: 700 }}>✓</div>
            <div style={{ fontSize: 9, color: '#2A5A7A', marginTop: 4 }}>Active</div>
          </div>
        ))}
      </div>

      {/* Active alerts */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 11, color: A, letterSpacing: 2 }}>ACTIVE ALERTS</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['CLIENT', 'SERVICE AREA', 'SEVERITY', 'ALERT', 'DETECTED'].map(h =>
              <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 400, fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '12px 20px', fontSize: 12, color: '#A0C8E0' }}>{a.ClientName}</td>
                <td style={{ padding: '12px 20px', fontSize: 10, color: '#5A7FA0' }}>{a.ServiceArea || '—'}</td>
                <td style={{ padding: '12px 20px' }}><Badge status={a.Severity} /></td>
                <td style={{ padding: '12px 20px', fontSize: 11, color: '#8AB0C8' }}>{a.Title}</td>
                <td style={{ padding: '12px 20px', fontSize: 10, color: '#2A5A7A' }}>{a.DetectedDate?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
