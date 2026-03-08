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

// ─── A2A (Agent2Agent) Protocol ───────────────────────────────────────────────

const A2A_BASE = `https://nexus-mcp-server.nicebay-f86289ec.eastus2.azurecontainerapps.io`

// Agent Card — required by A2A spec so orchestrators can discover capabilities
app.get('/.well-known/agent.json', (req, res) => {
  res.json({
    name: 'NEXUS Security Ops',
    description: 'ULU Malu NEXUS security operations agent. Handles security alerts, penetration testing queue, passive reconnaissance, AI pentest analysis, report generation, and audit logs.',
    url: `${A2A_BASE}/a2a`,
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false },
    skills: [
      { id: 'get_alerts',          name: 'Get Security Alerts',      description: 'Return all current security alerts with severity, status, client, and description.' },
      { id: 'get_scans',           name: 'Get Pentest Queue',         description: 'Return queued, running, and completed penetration test scans.' },
      { id: 'recon_target',        name: 'Passive Recon',             description: 'Probe a target URL for security headers, TLS posture, tech fingerprints, CORS, and cookies. No attack payloads.' },
      { id: 'analyze_pentest',     name: 'AI Pentest Analysis',       description: 'Analyze raw scan output and return structured findings with CVSS, OWASP categories, remediation, and a security playbook.' },
      { id: 'queue_scan',          name: 'Queue Pentest Scan',        description: 'Add a new authorized penetration test scan to the NEXUS queue.' },
      { id: 'generate_report',     name: 'Generate Security Report',  description: 'Generate an executive or technical security report for a client.' },
      { id: 'get_audit_log',       name: 'Get Audit Log',             description: 'Return recent operator actions, AI decisions, and system events.' },
      { id: 'run_pentest_pipeline',name: 'Run Full Pentest Pipeline',  description: 'Run passive recon then AI analysis in one call. Returns findings, playbook, and risk summary.' },
    ]
  })
})

// A2A message endpoint — handles task requests from orchestrators
app.post('/a2a', async (req, res) => {
  const { id, method, params } = req.body || {}
  if (method !== 'tasks/send') {
    return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not supported' } })
  }

  const taskId   = params?.id || `task-${Date.now()}`
  const userText = params?.message?.parts?.find(p => p.type === 'text')?.text || ''

  try {
    let result = ''
    const lower = userText.toLowerCase()

    if (lower.includes('alert')) {
      const data = await nexus('/alerts')
      result = JSON.stringify(data, null, 2)
    } else if (lower.includes('scan') && lower.includes('queue')) {
      const data = await nexus('/pentest-queue')
      result = JSON.stringify(data, null, 2)
    } else if (lower.includes('audit')) {
      const data = await nexus('/audit-log?limit=20')
      result = JSON.stringify(data, null, 2)
    } else if (lower.includes('recon')) {
      const urlMatch = userText.match(/https?:\/\/[^\s]+/)
      if (!urlMatch) return res.json(a2aError(id, taskId, 'Please provide a target URL for recon.'))
      const data = await nexus('/pentest-recon', 'POST', { targetUrl: urlMatch[0], scanType: 'external' })
      result = data.reconData || JSON.stringify(data, null, 2)
    } else if (lower.includes('analyz') || lower.includes('pentest')) {
      const urlMatch = userText.match(/https?:\/\/[^\s]+/)
      const clientMatch = userText.match(/for ([A-Za-z0-9 ]+?)(?:\s+at|\s+on|$)/)
      const data = await nexus('/pentest-analyze', 'POST', {
        clientName: clientMatch?.[1]?.trim() || 'Unknown Client',
        targetUrl:  urlMatch?.[0] || '',
        scanType:   'external',
      })
      result = data.riskSummary || JSON.stringify(data, null, 2)
    } else if (lower.includes('report')) {
      const clientMatch = userText.match(/for ([A-Za-z0-9 ]+?)(?:\s+report|$)/)
      const data = await nexus('/report-generator', 'POST', {
        clientName: clientMatch?.[1]?.trim() || 'Unknown Client',
        reportType: lower.includes('technical') ? 'technical' : 'executive',
      })
      result = data.report || JSON.stringify(data, null, 2)
    } else {
      // Default: return alerts as general status
      const data = await nexus('/alerts')
      result = `NEXUS Status — ${data.length} active alerts:\n` + JSON.stringify(data, null, 2)
    }

    res.json({
      jsonrpc: '2.0', id,
      result: {
        id: taskId,
        status: { state: 'completed' },
        artifacts: [{ parts: [{ type: 'text', text: result }] }]
      }
    })
  } catch (err) {
    res.json(a2aError(id, taskId, `NEXUS error: ${err.message}`))
  }
})

function a2aError(id, taskId, message) {
  return {
    jsonrpc: '2.0', id,
    result: {
      id: taskId,
      status: { state: 'failed', message },
      artifacts: [{ parts: [{ type: 'text', text: message }] }]
    }
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10)
app.listen(PORT, () => {
  console.log(`ULU Malu NEXUS MCP Server — port ${PORT}`)
  console.log(`NEXUS API: ${NEXUS_API}`)
  console.log(`Tools: get_alerts, get_scans, recon_target, analyze_pentest, queue_scan, generate_report, get_audit_log, run_pentest_pipeline`)
})
