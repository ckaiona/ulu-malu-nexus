import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import express from 'express'
import { z } from 'zod'

const NEXUS_API    = process.env.NEXUS_API_BASE    || 'https://blue-meadow-061a5911e.2.azurestaticapps.net/api'
const FUNCTION_KEY = process.env.NEXUS_FUNCTION_KEY || ''

async function nexus(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (FUNCTION_KEY) headers['x-functions-key'] = FUNCTION_KEY
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${NEXUS_API}${path}`, opts)
  if (!r.ok) throw new Error(`NEXUS API ${r.status}: ${await r.text()}`)
  return r.json()
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name:    'ulu-malu-nexus',
  version: '1.0.0',
})

// Security Alerts
server.tool(
  'get_alerts',
  'Get current security alerts from NEXUS. Returns severity, status, client, and description for all active alerts.',
  {},
  async () => {
    const data = await nexus('/alerts')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// Pentest Queue
server.tool(
  'get_scans',
  'Get the pentest scan queue. Returns all queued, running, and completed scans with client name, target URL, and finding counts.',
  {},
  async () => {
    const data = await nexus('/pentest-queue')
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// Passive Recon
server.tool(
  'recon_target',
  'Run passive Tier-1 reconnaissance on a target URL. Probes security headers, TLS posture, technology fingerprints, CORS policy, cookie flags, robots.txt, and security.txt without sending any attack payloads. Only use on authorized targets.',
  {
    targetUrl: z.string().describe('Target URL to probe, e.g. https://example.com'),
    scanType:  z.string().optional().describe('Scan type context: external, web-app, api, internal'),
  },
  async ({ targetUrl, scanType }) => {
    const data = await nexus('/pentest-recon', 'POST', { targetUrl, scanType: scanType || 'external' })
    return { content: [{ type: 'text', text: data.reconData || JSON.stringify(data, null, 2) }] }
  }
)

// AI Pentest Analysis
server.tool(
  'analyze_pentest',
  'AI-powered pentest analysis using claude-opus-4-6. Parses raw tool output (nmap, nuclei, Burp) and returns structured findings with CVSS scores, OWASP categories, and remediation steps, plus an auto-written security playbook. If rawFindings is omitted, generates a threat model from target and scan type alone.',
  {
    clientName:  z.string().describe('Client name, e.g. HEMIC Health'),
    targetUrl:   z.string().optional().describe('Target URL'),
    scanType:    z.string().describe('Scan type: external, web-app, api, internal'),
    rawFindings: z.string().optional().describe('Raw tool output to analyze. Leave empty to generate threat model.'),
  },
  async ({ clientName, targetUrl, scanType, rawFindings }) => {
    const data = await nexus('/pentest-analyze', 'POST', { clientName, targetUrl, scanType, rawFindings })
    // Return a human-readable summary + full JSON
    const summary = data.riskSummary
      ? `## Risk Summary\n${data.riskSummary}\n\n## Findings (${data.findings?.length || 0})\n` +
        (data.findings || []).map(f =>
          `- **[${f.severity}] ${f.title}** (CVSS ${f.cvss}, ${f.owasp})\n  ${f.description}\n  Remediation: ${f.remediation}`
        ).join('\n\n') +
        `\n\n## Playbook\n${data.playbook || ''}`
      : JSON.stringify(data, null, 2)
    return { content: [{ type: 'text', text: summary }] }
  }
)

// Queue a new scan
server.tool(
  'queue_scan',
  'Add a new pentest scan to the NEXUS queue. Requires prior written authorization from the client.',
  {
    clientName: z.string().describe('Client name'),
    targetUrl:  z.string().describe('Target URL to scan'),
    scanType:   z.enum(['external', 'internal', 'web-app', 'api']).describe('Type of scan'),
  },
  async ({ clientName, targetUrl, scanType }) => {
    const data = await nexus('/pentest-queue', 'POST', {
      client_name:          clientName,
      target_url:           targetUrl,
      scan_type:            scanType,
      authorization_status: 'approved',
      authorization_type:   'written',
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// Generate report
server.tool(
  'generate_report',
  'Generate a security briefing report for a client. Returns a formatted executive-ready report.',
  {
    clientName: z.string().describe('Client name'),
    reportType: z.enum(['executive', 'technical', 'pentest-summary', 'incident']).describe('Report type'),
    context:    z.string().optional().describe('Additional context or findings to include'),
  },
  async ({ clientName, reportType, context }) => {
    const data = await nexus('/report-generator', 'POST', { clientName, reportType, context })
    return { content: [{ type: 'text', text: data.report || JSON.stringify(data, null, 2) }] }
  }
)

// Audit log
server.tool(
  'get_audit_log',
  'Get the NEXUS audit log showing recent operator actions, AI decisions, and system events.',
  {
    limit: z.number().optional().describe('Number of entries to return (default 50, max 500)'),
  },
  async ({ limit }) => {
    const data = await nexus(`/audit-log?limit=${limit || 50}`)
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// Full recon + analyze pipeline (convenience tool)
server.tool(
  'run_pentest_pipeline',
  'Convenience tool: runs passive recon on the target, then immediately feeds results into AI analysis. Returns full findings, playbook, and risk summary in one call. Only use on authorized targets.',
  {
    clientName: z.string().describe('Client name'),
    targetUrl:  z.string().describe('Target URL — must be an authorized target'),
    scanType:   z.enum(['external', 'internal', 'web-app', 'api']).describe('Type of scan'),
  },
  async ({ clientName, targetUrl, scanType }) => {
    // Step 1: recon
    const recon = await nexus('/pentest-recon', 'POST', { targetUrl, scanType })
    const reconData = recon.reconData || ''

    // Step 2: analyze with recon data
    const analysis = await nexus('/pentest-analyze', 'POST', {
      clientName, targetUrl, scanType, rawFindings: reconData
    })

    const output = [
      `## NEXUS Pentest Pipeline — ${clientName}`,
      `Target: ${targetUrl} | Type: ${scanType}`,
      '',
      '### Passive Recon',
      reconData.split('\n').slice(0, 30).join('\n') + (reconData.split('\n').length > 30 ? '\n...' : ''),
      '',
      `### AI Analysis — ${analysis.findings?.length || 0} findings`,
      analysis.riskSummary || '',
      '',
      ...(analysis.findings || []).map(f =>
        `**[${f.severity}] ${f.title}** (CVSS ${f.cvss})\n${f.description}\nRemediation: ${f.remediation}`
      ),
      '',
      '### Playbook',
      analysis.playbook || '',
    ].join('\n')

    return { content: [{ type: 'text', text: output }] }
  }
)

// ─── Express / SSE transport ──────────────────────────────────────────────────

const app = express()
app.use(express.json())

// Allow CORS for MCP clients (Claude Desktop, VS Code, etc.)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const transports = {}

// SSE endpoint — MCP client connects here first
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res)
  transports[transport.sessionId] = transport
  res.on('close', () => {
    delete transports[transport.sessionId]
    console.log(`Session ${transport.sessionId} disconnected`)
  })
  console.log(`Session ${transport.sessionId} connected`)
  await server.connect(transport)
})

// Messages endpoint — MCP client POSTs tool calls here
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId
  const transport = transports[sessionId]
  if (!transport) return res.status(404).json({ error: 'Session not found' })
  await transport.handlePostMessage(req, res, req.body)
})

app.get('/health', (req, res) =>
  res.json({ status: 'ok', server: 'ulu-malu-nexus-mcp', tools: 8, nexusApi: NEXUS_API })
)

const PORT = parseInt(process.env.PORT || '3000', 10)
app.listen(PORT, () => {
  console.log(`ULU Malu NEXUS MCP Server — port ${PORT}`)
  console.log(`NEXUS API: ${NEXUS_API}`)
  console.log(`Tools: get_alerts, get_scans, recon_target, analyze_pentest, queue_scan, generate_report, get_audit_log, run_pentest_pipeline`)
})
