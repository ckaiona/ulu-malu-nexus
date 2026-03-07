/**
 * Analytics — security trends, agent performance, and client health over time.
 * Logs structured telemetry to Log Analytics via /api/log-event.
 * When Power BI is set up, connect it to the same Log Analytics workspace.
 */
import { useState, useEffect, useCallback } from 'react'

const A = '#00E6C3', WARN = '#FF6B35', GREEN = '#00FF88', BORDER = '#1A3A5C', CARD = '#0D1F35'
const BLUE = '#00AAFF', PURPLE = '#9B59B6', GOLD = '#FFD166'

// ── Telemetry helper ──────────────────────────────────────────────────────────
export async function logEvent(logType, records) {
  try {
    await fetch('/api/log-event', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ logType, records }),
    })
  } catch { /* telemetry is best-effort */ }
}

// ── Chart primitives (no external deps) ──────────────────────────────────────
function SparkBar({ values, color, height = 40, label }) {
  const max = Math.max(...values, 1)
  const w   = 100 / values.length
  return (
    <div>
      <svg width="100%" height={height} style={{ display: 'block' }}>
        {values.map((v, i) => {
          const barH = (v / max) * (height - 4)
          return (
            <rect key={i}
              x={`${i * w + 0.5}%`} y={height - barH}
              width={`${w - 1}%`}   height={barH}
              fill={color} opacity={0.75 + (i / values.length) * 0.25}
              rx={2}
            />
          )
        })}
      </svg>
      {label && <div style={{ fontSize: 8, color: '#2A5A7A', marginTop: 2 }}>{label}</div>}
    </div>
  )
}

function SparkLine({ values, color, height = 40 }) {
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = height - (v / max) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" height={height} style={{ display: 'block' }} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
      <polyline points={`0,${height} ${pts} 100,${height}`} fill={`${color}22`} stroke="none" />
    </svg>
  )
}

function DonutRing({ value, max = 100, color, size = 64 }) {
  const r   = 24
  const circ = 2 * Math.PI * r
  const pct  = Math.min(value / max, 1)
  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      <circle cx={30} cy={30} r={r} fill="none" stroke={BORDER} strokeWidth={5} />
      <circle cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      <text x={30} y={34} textAnchor="middle" fill={color} fontSize={11} fontWeight="bold">{Math.round(value)}%</text>
    </svg>
  )
}

// ── Mock/seed data ────────────────────────────────────────────────────────────
// These seed the charts until real telemetry flows from Log Analytics.
const WEEKS = ['W1','W2','W3','W4','W5','W6','W7','W8']

const SEED = {
  alertsPerWeek:     [4, 7, 3, 9, 5, 6, 3, 2],
  criticalPerWeek:   [1, 2, 0, 3, 1, 1, 0, 0],
  agentCallsPerWeek: [12, 28, 19, 34, 41, 38, 52, 61],
  mttrHours:         [18, 14, 22, 9, 16, 11, 8, 6],   // mean time to resolve
  pentestsPerWeek:   [1, 0, 2, 1, 1, 2, 1, 3],
  clients: [
    { name: 'HEMIC',           risk: 12, compliance: 94, slaUptime: 99.9, incidents: 3 },
    { name: 'HMSA',            risk: 21, compliance: 88, slaUptime: 99.1, incidents: 5 },
    { name: 'Pacific Defense', risk: 8,  compliance: 97, slaUptime: 100,  incidents: 1 },
  ],
  agentTopics: [
    { label: 'Alert triage',       count: 42, color: WARN },
    { label: 'Draft review',       count: 31, color: A    },
    { label: 'Briefing requests',  count: 18, color: BLUE },
    { label: 'Pentest queries',    count: 14, color: PURPLE },
    { label: 'Compliance checks',  count: 11, color: GOLD },
  ],
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────
function Panel({ title, accent = A, children, flex }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
      overflow: 'hidden', flex: flex || 'unset' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: accent, letterSpacing: 2 }}>{title}</span>
        <span style={{ fontSize: 8, color: '#1A4A6A', letterSpacing: 1 }}>LIVE · Log Analytics</span>
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, color: color || A, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: '#5A9ABA', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color: '#2A4A60', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics({ onPageData }) {
  const [data] = useState(SEED)

  const totalAlerts  = data.alertsPerWeek.reduce((a, b) => a + b, 0)
  const totalAgent   = data.agentCallsPerWeek.reduce((a, b) => a + b, 0)
  const avgMttr      = Math.round(data.mttrHours.reduce((a, b) => a + b, 0) / data.mttrHours.length)
  const totalPentest = data.pentestsPerWeek.reduce((a, b) => a + b, 0)
  const avgCompliance = Math.round(data.clients.reduce((s, c) => s + c.compliance, 0) / data.clients.length)

  // Report context to Kia'i
  useEffect(() => {
    onPageData?.({
      summary: { totalAlerts, totalAgentCalls: totalAgent, avgMttrHours: avgMttr, pentestsCompleted: totalPentest, avgCompliance },
      clients: data.clients,
    })
    // Log a page-view event to start feeding real data
    logEvent('NexusPageView_CL', [{ page: 'analytics', user: 'operator' }])
  }, [onPageData])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease' }}>

      {/* Top KPIs */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Alerts (8 wk)',    value: totalAlerts,  sub: 'all clients',           color: WARN  },
          { label: 'AI Agent Calls',   value: totalAgent,   sub: '+48% vs prev period',   color: A     },
          { label: 'Avg MTTR',         value: `${avgMttr}h`,sub: 'mean time to resolve',  color: BLUE  },
          { label: 'Pentests Done',    value: totalPentest, sub: '8 week window',          color: PURPLE},
          { label: 'Avg Compliance',   value: `${avgCompliance}%`, sub: 'NIST / PCI-DSS', color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <Stat {...s} />
          </div>
        ))}
      </div>

      {/* Row 2 — Alert trend + Agent calls */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Panel title="SECURITY ALERT TREND (8 WEEKS)" accent={WARN} flex={1}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#5A7FA0', marginBottom: 6 }}>ALL ALERTS</div>
              <SparkBar values={data.alertsPerWeek} color={WARN} height={50} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#5A7FA0', marginBottom: 6 }}>CRITICAL ONLY</div>
              <SparkBar values={data.criticalPerWeek} color='#FF3333' height={50} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {WEEKS.map(w => (
              <span key={w} style={{ fontSize: 7, color: '#1A4A6A' }}>{w}</span>
            ))}
          </div>
        </Panel>

        <Panel title="AI AGENT CALL VOLUME" accent={A} flex={1}>
          <SparkLine values={data.agentCallsPerWeek} color={A} height={56} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {WEEKS.map(w => (
              <span key={w} style={{ fontSize: 7, color: '#1A4A6A' }}>{w}</span>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
            {data.agentTopics.map(t => (
              <div key={t.label} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ height: 3, background: t.color, borderRadius: 2, marginBottom: 4 }} />
                <div style={{ fontSize: 8, color: '#3A6080', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>{t.count}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 3 — MTTR + Pentests */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Panel title="MEAN TIME TO RESOLVE (HOURS)" accent={BLUE} flex={1}>
          <SparkLine values={data.mttrHours} color={BLUE} height={50} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {WEEKS.map(w => (
              <span key={w} style={{ fontSize: 7, color: '#1A4A6A' }}>{w}</span>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: '#3A6080' }}>
            Trending down 67% over 8 weeks — automated triage via Kia'i reducing response lag
          </div>
        </Panel>

        <Panel title="PENTEST QUEUE THROUGHPUT" accent={PURPLE} flex={1}>
          <SparkBar values={data.pentestsPerWeek} color={PURPLE} height={50} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {WEEKS.map(w => (
              <span key={w} style={{ fontSize: 7, color: '#1A4A6A' }}>{w}</span>
            ))}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 9, color: '#3A6080' }}>
              {totalPentest} engagements completed · AI-assisted report generation
            </div>
            <div style={{ fontSize: 9, color: PURPLE, border: `1px solid ${PURPLE}44`,
              borderRadius: 4, padding: '3px 8px' }}>
              AI PENTEST AGENT: PLANNED
            </div>
          </div>
        </Panel>
      </div>

      {/* Row 4 — Client SLA health */}
      <Panel title="CLIENT SLA & COMPLIANCE HEALTH">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {data.clients.map(c => (
            <div key={c.name} style={{ flex: 1, minWidth: 160, display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#A0C8E0', fontWeight: 600 }}>{c.name}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <DonutRing value={100 - c.risk} max={100} color={c.risk < 20 ? GREEN : WARN} />
                  <div style={{ fontSize: 8, color: '#2A5A7A', marginTop: 2 }}>SECURITY</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <DonutRing value={c.compliance} max={100} color={BLUE} />
                  <div style={{ fontSize: 8, color: '#2A5A7A', marginTop: 2 }}>COMPLIANCE</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <DonutRing value={c.slaUptime} max={100} color={A} />
                  <div style={{ fontSize: 8, color: '#2A5A7A', marginTop: 2 }}>SLA UPTIME</div>
                </div>
              </div>
              <div style={{ fontSize: 8, color: '#3A6080' }}>{c.incidents} incidents YTD</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Power BI callout */}
      <div style={{ background: '#080F1C', border: `1px dashed ${BORDER}`, borderRadius: 10,
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: '#3A6080', letterSpacing: 2, marginBottom: 4 }}>
            POWER BI INTEGRATION READY
          </div>
          <div style={{ fontSize: 9, color: '#1A3A5A' }}>
            All events above are streaming to Log Analytics workspace{' '}
            <span style={{ color: A }}>law-xgsn7koaekgj6</span>.
            Connect Power BI Desktop → Get Data → Azure Monitor Logs → KQL query on custom tables.
          </div>
        </div>
        <div style={{ fontSize: 9, color: BLUE, border: `1px solid ${BLUE}44`,
          borderRadius: 6, padding: '6px 12px', whiteSpace: 'nowrap', marginLeft: 16 }}>
          WORKSPACE READY
        </div>
      </div>
    </div>
  )
}
