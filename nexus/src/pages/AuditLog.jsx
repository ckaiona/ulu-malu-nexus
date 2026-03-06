import { useState, useEffect } from 'react'
import { api } from '../api'

const A = '#00E6C3', GREEN = '#00FF88', WARN = '#FF6B35', BORDER = '#1A3A5C', CARD = '#0D1F35'

const MOCK = [
  { LogId: 'L001', Action: 'DRAFT_CREATED', PerformedBy: 'email-processor', AgentName: 'KumuGrok', TargetEntity: 'email-abc123', Details: 'Category: CMMC-Compliance | Urgency: high | DraftId: D001', Timestamp: '2026-03-05T17:30:00Z' },
  { LogId: 'L002', Action: 'PENTEST_QUEUED', PerformedBy: 'pentest-queue', AgentName: 'PentestForge', TargetEntity: 'S001', Details: 'Client: HEMIC Health | Type: external', Timestamp: '2026-03-05T17:15:00Z' },
  { LogId: 'L003', Action: 'SECURITY_ALERT_CREATED', PerformedBy: 'security-alert-sync', AgentName: 'ThreatHorizon', TargetEntity: 'A001', Details: 'Severity: high | Client: KoreTech Labs | Exposed RDP', Timestamp: '2026-03-05T17:00:00Z' },
  { LogId: 'L004', Action: 'REPORT_GENERATED', PerformedBy: 'report-generator', AgentName: 'KumuGrok', TargetEntity: 'R001', Details: 'Type: security-posture | For: HMSA', Timestamp: '2026-03-05T16:45:00Z' },
  { LogId: 'L005', Action: 'EMAIL_LOGGED', PerformedBy: 'email-processor', AgentName: 'KumuGrok', TargetEntity: 'email-def456', Details: 'Category: Personal | No reply needed', Timestamp: '2026-03-05T16:30:00Z' },
]

const ACTION_COLOR = {
  DRAFT_CREATED: '#00AAFF',
  PENTEST_QUEUED: '#FFD166',
  PENTEST_COMPLETED: '#00FF88',
  SECURITY_ALERT_CREATED: '#FF6B35',
  REPORT_GENERATED: '#00E6C3',
  EMAIL_LOGGED: '#5A9ABA',
  EMAIL_FETCH_ERROR: '#FF6B35',
  DRAFT_ERROR: '#FF6B35',
}

export default function AuditLog() {
  const [logs, setLogs] = useState(MOCK)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAuditLog(200).then(l => { if (l?.length) setLogs(l) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = filter
    ? logs.filter(l => l.Action?.includes(filter) || l.AgentName?.includes(filter) || l.PerformedBy?.includes(filter))
    : logs

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, animation: 'fadeIn .3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>AUDIT LOG ({filtered.length})</div>
        <input value={filter} onChange={e => setFilter(e.target.value.toUpperCase())}
          placeholder="Filter by action or agent..."
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6,
            padding: '6px 12px', color: '#C8E0F4', fontFamily: 'monospace', fontSize: 10, width: 240 }} />
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['TIME', 'ACTION', 'AGENT', 'BY', 'TARGET', 'DETAILS'].map(h =>
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 400, fontSize: 9, color: '#2A5A7A', letterSpacing: 2 }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => {
              const c = ACTION_COLOR[l.Action] || '#5A9ABA'
              return (
                <tr key={l.LogId || i} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '10px 16px', fontSize: 9, color: '#2A5A7A', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {l.Timestamp ? new Date(l.Timestamp).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 9, color: c, background: `${c}15`, border: `1px solid ${c}33`,
                      borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                      {l.Action}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 10, color: A }}>{l.AgentName}</td>
                  <td style={{ padding: '10px 16px', fontSize: 10, color: '#5A7FA0' }}>{l.PerformedBy}</td>
                  <td style={{ padding: '10px 16px', fontSize: 10, color: '#3A6080', fontFamily: 'monospace' }}>{l.TargetEntity?.slice(0, 20)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 10, color: '#5A7FA0', maxWidth: 320,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.Details}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {loading && <div style={{ padding: 20, fontSize: 10, color: '#2A5A7A', textAlign: 'center' }}>Syncing from SharePoint...</div>}
      </div>
    </div>
  )
}
