/**
 * ReviewDrafts — shows only the logged-in user's own drafts.
 * Per spec: the person the email is addressed TO approves their own drafts.
 * OwnerEmail field on each draft identifies whose queue it belongs to.
 */
import { useState, useEffect } from 'react'
import { api } from '../api'

const A = '#00E6C3', WARN = '#FF6B35', GREEN = '#00FF88', BORDER = '#1A3A5C', CARD = '#0D1F35'

// Mock data — each draft has OwnerEmail so the UI can filter
const MOCK = [
  { DraftId: 'D001', OwnerEmail: 'eric.daley@ulumalusystems.com',  AddressedTo: 'client@hemic.com',  Subject: 'Re: Cloud Infrastructure Review',  SenderPersona: 'Eric Daley – CTO',             Status: 'Pending', ClientName: 'HEMIC',           Body: 'Thank you for reaching out regarding the cloud infrastructure review. We have completed our assessment and I\'d like to schedule a call this week to walk through our findings and recommendations.' },
  { DraftId: 'D002', OwnerEmail: 'caiona@ulumalusystems.com',      AddressedTo: 'vendor@crowdstrike.com', Subject: 'Re: SentinelOne Integration',   SenderPersona: 'Camille Aiona – Lead AI Architect', Status: 'Pending', ClientName: 'CrowdStrike',      Body: 'Thank you for the integration documentation. I\'ve reviewed the API specifications and have a few technical questions before we proceed with the deployment.' },
  { DraftId: 'D003', OwnerEmail: 'caiona@ulumalusystems.com',      AddressedTo: 'cfo@koretech.io',       Subject: 'Re: Invoice #2024-089',          SenderPersona: 'Camille Aiona – Finance Lead',       Status: 'Pending', ClientName: 'KoreTech Labs',    Body: 'Following up on invoice #2024-089. Please let me know if you need clarification on any line items or if there are any concerns we can address.' },
]

// In production this comes from MSAL token — hardcoded for demo
const CURRENT_USER = 'caiona@ulumalusystems.com'

export default function ReviewDrafts() {
  const [allDrafts, setAllDrafts]   = useState(MOCK)
  const [selected, setSelected]     = useState(null)
  const [acting, setActing]         = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    api.getDrafts()
      .then(d => { if (d?.length) setAllDrafts(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Each user sees only their own drafts — OwnerEmail must match logged-in user
  const myDrafts  = allDrafts.filter(d => (d.OwnerEmail || '').toLowerCase() === CURRENT_USER.toLowerCase())
  const pending   = myDrafts.filter(d => d.Status === 'Pending')
  const processed = myDrafts.filter(d => d.Status !== 'Pending')

  const act = async (id, action) => {
    setActing(id)
    try {
      await (action === 'approve' ? api.approveDraft(id) : api.rejectDraft(id))
      setAllDrafts(d => d.map(x => x.DraftId === id
        ? { ...x, Status: action === 'approve' ? 'Approved' : 'Rejected' } : x))
      if (selected?.DraftId === id)
        setSelected(s => ({ ...s, Status: action === 'approve' ? 'Approved' : 'Rejected' }))
    } catch { }
    setActing(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', animation: 'fadeIn .3s ease' }}>
      {/* List panel */}
      <div style={{ width: 320, borderRight: `1px solid ${BORDER}`, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginBottom: 4 }}>
          YOUR DRAFTS — PENDING ({pending.length})
        </div>
        <div style={{ fontSize: 9, color: '#1A4060', marginBottom: 12 }}>
          Logged in as: <span style={{ color: A }}>{CURRENT_USER}</span>
        </div>

        {pending.map(d => (
          <div key={d.DraftId} onClick={() => setSelected(d)}
            style={{ background: selected?.DraftId === d.DraftId ? `${A}15` : CARD,
              border: `1px solid ${selected?.DraftId === d.DraftId ? A : BORDER}`,
              borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}>
            <div style={{ fontSize: 11, color: '#C8E0F4', marginBottom: 4 }}>{d.Subject}</div>
            <div style={{ fontSize: 9, color: '#5A7FA0' }}>To: {d.AddressedTo}</div>
            <div style={{ fontSize: 9, color: '#3A6080', marginTop: 2 }}>{d.ClientName}</div>
          </div>
        ))}

        {pending.length === 0 && !loading && (
          <div style={{ fontSize: 10, color: '#1A4060', textAlign: 'center', marginTop: 20 }}>
            No pending drafts
          </div>
        )}

        {processed.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginTop: 12, marginBottom: 4 }}>
              PROCESSED ({processed.length})
            </div>
            {processed.map(d => (
              <div key={d.DraftId} onClick={() => setSelected(d)}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: '12px 14px', cursor: 'pointer', opacity: .55 }}>
                <div style={{ fontSize: 11, color: '#6A8AAA', marginBottom: 4 }}>{d.Subject}</div>
                <div style={{ fontSize: 9, color: d.Status === 'Approved' ? GREEN : WARN }}>{d.Status}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {selected ? (
          <>
            <div style={{ fontSize: 9, color: '#2A5A7A', letterSpacing: 2, marginBottom: 12 }}>DRAFT REVIEW</div>
            <div style={{ fontSize: 16, color: '#C8E0F4', marginBottom: 4 }}>{selected.Subject}</div>
            <div style={{ fontSize: 11, color: '#5A7FA0', marginBottom: 4 }}>
              To: <span style={{ color: '#8AB0C8' }}>{selected.AddressedTo}</span>
            </div>
            <div style={{ fontSize: 11, color: '#5A7FA0', marginBottom: 20 }}>
              From persona: <span style={{ color: A }}>{selected.SenderPersona}</span>
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
              padding: 20, fontSize: 13, color: '#A0C8E0', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
              {selected.Body}
            </div>

            {selected.Status === 'Pending' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => act(selected.DraftId, 'approve')}
                  disabled={!!acting}
                  style={{ flex: 1, padding: 14, background: `${GREEN}22`, border: `1px solid ${GREEN}`,
                    color: GREEN, borderRadius: 8, cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}>
                  ✓ APPROVE & SEND
                </button>
                <button onClick={() => act(selected.DraftId, 'reject')}
                  disabled={!!acting}
                  style={{ flex: 1, padding: 14, background: 'transparent', border: `1px solid ${BORDER}`,
                    color: '#5A7FA0', borderRadius: 8, cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}>
                  ✗ REJECT
                </button>
              </div>
            )}

            {selected.Status !== 'Pending' && (
              <div style={{ color: selected.Status === 'Approved' ? GREEN : WARN, fontSize: 12 }}>
                {selected.Status === 'Approved' ? '✓ Approved and sent' : '✗ Rejected'}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#2A5A7A', fontSize: 12, marginTop: 60, textAlign: 'center' }}>
            Select a draft to review and send
          </div>
        )}
      </div>
    </div>
  )
}
