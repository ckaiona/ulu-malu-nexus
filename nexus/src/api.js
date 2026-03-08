// Azure Functions API client
// Set VITE_API_BASE in .env to your Function App URL
// e.g. https://ulu-guardian.azurewebsites.net/api
const BASE = import.meta.env.VITE_API_BASE || '/api'
const KEY  = import.meta.env.VITE_FUNCTION_KEY || ''

const headers = () => ({
  'Content-Type': 'application/json',
  ...(KEY ? { 'x-functions-key': KEY } : {})
})

export const api = {
  // EmailDrafts
  getDrafts:    () => fetch(`${BASE}/drafts`, { headers: headers() }).then(r => r.json()),
  approveDraft: (id) => fetch(`${BASE}/drafts/${id}/approve`, { method: 'PATCH', headers: headers() }).then(r => r.json()),
  rejectDraft:  (id) => fetch(`${BASE}/drafts/${id}/reject`,  { method: 'PATCH', headers: headers() }).then(r => r.json()),

  // SecurityAlerts
  getAlerts: () => fetch(`${BASE}/alerts`, { headers: headers() }).then(r => r.json()),

  // PentestScans
  getScans:    () => fetch(`${BASE}/pentest-queue`, { headers: headers() }).then(r => r.json()),
  queueScan:   (body) => fetch(`${BASE}/pentest-queue`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  updateScan:  (body) => fetch(`${BASE}/pentest-queue`, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),

  // Reports
  generateReport: (body) => fetch(`${BASE}/report-generator`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  getReports: () => fetch(`${BASE}/reports`, { headers: headers() }).then(r => r.json()),

  // AuditLog
  getAuditLog: (limit = 100) => fetch(`${BASE}/audit-log?limit=${limit}`, { headers: headers() }).then(r => r.json()),

  // AI Pentest Agent
  analyzePentest: (body) => fetch(`${BASE}/pentest-analyze`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),

  // Passive Recon (Tier 1)
  reconTarget: (body) => fetch(`${BASE}/pentest-recon`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),

  // Active Scan (Tier 2) — triggers nmap + nuclei Container App Job
  runScan: (body) => fetch(`${BASE}/pentest-run`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
}
