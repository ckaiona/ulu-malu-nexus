/**
 * BriefingGenerator — AI-powered executive briefings.
 * Per spec: NO timelines, NO dates, NO delivery commitments in slides.
 * Content is tailored per exec role.
 */
import { useState } from 'react'
import { api } from '../api'

const A = '#00E6C3', GREEN = '#00FF88', WARN = '#FF6B35', BORDER = '#1A3A5C', CARD = '#0D1F35'

const TYPES = [
  { id: 'security-posture', label: 'Security Posture',    icon: '◉', desc: 'Risk, alerts, threat landscape' },
  { id: 'pentest-summary',  label: 'Pentest Summary',     icon: '⬡', desc: 'Findings, CVSS, remediation' },
  { id: 'cmmc-gap',         label: 'CMMC Gap Analysis',   icon: '◆', desc: 'Compliance gaps, POA&M' },
  { id: 'pnl',              label: 'P&L / Cost Report',   icon: '◈', desc: 'Billing, ROI, cost analysis' },
]

// Real org structure per spec
const EXECS = [
  { name: 'Gregory Hester – CEO',    value: 'Gregory Hester',  focus: 'Business posture, strategic risks, growth metrics' },
  { name: 'Russ Stinehour – CFO',    value: 'Russ Stinehour',  focus: 'Billing, cost analysis, financial impact, ROI of AI automation' },
  { name: "Hali'a Hester – COO",     value: "Hali'a Hester",   focus: 'Operations throughput, SLA compliance, automation coverage' },
  { name: 'Eric Daley – CTO',        value: 'Eric Daley',       focus: 'Technical architecture, threat landscape, system health, agent performance' },
]

const CLIENTS = ['HEMIC', 'HMSA', 'Pacific Defense', 'Internal – ULU Malu']

export default function BriefingGenerator() {
  const [form, setForm] = useState({
    report_type: 'security-posture',
    generated_for: 'Gregory Hester',
    topic: '',
    context: ''
  })
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedExec = EXECS.find(e => e.value === form.generated_for)

  const generate = async () => {
    if (!form.topic.trim()) { setError('Topic is required'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await api.generateReport({
        ...form,
        context: `Executive focus: ${selectedExec?.focus || ''}. ${form.context}\n\nIMPORTANT: Do NOT include timelines, dates, or delivery commitments in this briefing.`
      })
      if (r.error) throw new Error(r.error)
      setResult(r)
    } catch (e) {
      setError(e.message || 'Generation failed')
    }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, animation: 'fadeIn .3s ease' }}>
      <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginBottom: 4 }}>EXECUTIVE BRIEFING GENERATOR</div>
      <div style={{ fontSize: 10, color: '#1A4060', marginBottom: 20 }}>Generates slide-ready content. No timelines or date commitments included.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 960 }}>
        {/* Report type */}
        <div>
          <div style={{ fontSize: 10, color: '#5A7FA0', marginBottom: 10, letterSpacing: 1 }}>BRIEFING TYPE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TYPES.map(t => (
              <div key={t.id} onClick={() => set('report_type', t.id)}
                style={{ background: form.report_type === t.id ? `${A}15` : CARD,
                  border: `1px solid ${form.report_type === t.id ? A : BORDER}`,
                  borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ color: A, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontSize: 11, color: '#C8E0F4', marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 9, color: '#3A6080' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: '#5A7FA0', marginBottom: 6, letterSpacing: 1 }}>EXECUTIVE RECIPIENT</div>
            <select value={form.generated_for} onChange={e => set('generated_for', e.target.value)}
              style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: '10px 12px', color: '#C8E0F4', fontFamily: 'monospace', fontSize: 11 }}>
              {EXECS.map(e => <option key={e.value} value={e.value}>{e.name}</option>)}
            </select>
            {selectedExec && (
              <div style={{ fontSize: 9, color: '#2A5A7A', marginTop: 6, padding: '6px 8px',
                background: `${A}08`, borderRadius: 4, borderLeft: `2px solid ${A}44` }}>
                Focus: {selectedExec.focus}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#5A7FA0', marginBottom: 6, letterSpacing: 1 }}>CLIENT / SUBJECT</div>
            <select value={form.client} onChange={e => set('client', e.target.value)}
              style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: '10px 12px', color: '#C8E0F4', fontFamily: 'monospace', fontSize: 11 }}>
              {CLIENTS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#5A7FA0', marginBottom: 6, letterSpacing: 1 }}>BRIEFING TOPIC</div>
            <input value={form.topic} onChange={e => set('topic', e.target.value)}
              placeholder="e.g. Q1 2026 Security & Cloud Review"
              style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: '10px 12px', color: '#C8E0F4', fontFamily: 'monospace', fontSize: 11 }} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#5A7FA0', marginBottom: 6, letterSpacing: 1 }}>ADDITIONAL CONTEXT</div>
            <textarea value={form.context} onChange={e => set('context', e.target.value)}
              placeholder="Paste findings, metrics, or notes to include..."
              rows={4}
              style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: '10px 12px', color: '#C8E0F4', fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} />
          </div>
        </div>
      </div>

      {error && <div style={{ color: WARN, fontSize: 11, marginTop: 16 }}>⚠ {error}</div>}

      <button onClick={generate} disabled={loading}
        style={{ marginTop: 20, padding: '14px 32px',
          background: loading ? `${A}33` : `${A}22`,
          border: `1px solid ${A}`, color: A, borderRadius: 8,
          cursor: loading ? 'default' : 'pointer', fontFamily: 'monospace', fontSize: 13 }}>
        {loading ? '◈ GENERATING...' : '◆ GENERATE BRIEFING'}
      </button>

      {result && (
        <div style={{ marginTop: 24, background: CARD, border: `1px solid ${GREEN}44`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: GREEN, fontSize: 11, marginBottom: 8 }}>✓ Briefing generated — ID: {result.report_id}</div>
          <div style={{ fontSize: 10, color: '#5A7FA0', marginBottom: 12 }}>Saved to SharePoint · Ready for slide import</div>
          {result.file_url && (
            <a href={result.file_url} target="_blank" rel="noreferrer"
              style={{ color: A, fontSize: 11, textDecoration: 'none' }}>
              ◈ Open in SharePoint →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
