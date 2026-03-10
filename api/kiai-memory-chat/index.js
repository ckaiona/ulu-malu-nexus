/**
 * kiai-memory-chat — Kia'i AI chat with persistent memory
 *
 * Calls Azure AI Foundry (inside ULU Malu tenant) with recalled memories injected
 * into the system prompt, making Kia'i "psychic" — proactively surfacing relevant
 * past context. Zero data leaves the Azure tenant.
 *
 * POST { message, history, context, image? }
 * Returns { reply }
 *
 * Required SWA app settings:
 *   AZURE_AI_PROJECT_ENDPOINT  — e.g. https://ai-xgsn7koaekgj6.services.ai.azure.com
 *   AZURE_AI_API_KEY           — Foundry resource API key (from Azure portal)
 *   AZURE_AI_DEPLOYMENT        — model deployment name (default: grok-4-1-fast-reasoning)
 *   MEMORY_STORAGE_CONNECTION  — Azure Storage connection string (memory disabled if missing)
 */

const https  = require('https')
const crypto = require('crypto')

const TABLE     = 'KiaiMemories'
const PARTITION = 'memory'

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors() }
    return
  }

  const { message, history = [], context: ctx = {}, image } = req.body || {}
  if (!message && !image) {
    context.res = { status: 400, headers: cors(), body: JSON.stringify({ error: 'message required' }) }
    return
  }

  const endpoint   = process.env.AZURE_AI_PROJECT_ENDPOINT
  const apiKey     = process.env.AZURE_AI_API_KEY
  const deployment = process.env.AZURE_AI_DEPLOYMENT || 'grok-4-1-fast-reasoning'
  const conn       = process.env.MEMORY_STORAGE_CONNECTION

  if (!endpoint || !apiKey) {
    context.res = {
      status: 503, headers: cors(),
      body: JSON.stringify({ error: 'AZURE_AI_PROJECT_ENDPOINT and AZURE_AI_API_KEY must be configured' })
    }
    return
  }

  // Load recent memories (non-fatal if storage not configured or unreachable)
  let memories = []
  let storageConfig = null
  if (conn) {
    try {
      storageConfig = parseConn(conn)
      const client = ctx.pageData?.clientName || ''
      memories = await getMemories(storageConfig.account, storageConfig.key, client, 25)
    } catch (_) {}
  }

  // Build messages: system prompt (with memory) + history + current user turn
  const sysPrompt = buildSystemPrompt(ctx, memories)
  const msgs = [{ role: 'system', content: sysPrompt }]
  history.forEach(m => { if (m.role && m.content) msgs.push({ role: m.role, content: m.content }) })

  // Image support: include as base64 in user message (Foundry supports vision models)
  const userContent = image
    ? [
        { type: 'image_url', image_url: { url: `data:${image.media_type};base64,${image.data}` } },
        { type: 'text', text: message || 'What do you see in this image?' }
      ]
    : message
  msgs.push({ role: 'user', content: userContent })

  try {
    const reply = await callFoundry(endpoint, apiKey, deployment, msgs)

    // Auto-save conversation to memory (don't let save failure kill the response)
    if (storageConfig && message) {
      const client = ctx.pageData?.clientName || extractClient(message)
      const summary = message.slice(0, 250) + (reply ? ` → ${reply.slice(0, 150)}` : '')
      saveMemory(storageConfig, summary, 'conversation', client, ctx.currentPage || '', 3)
        .catch(() => {})
    }

    context.res = {
      status: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    }
  } catch (e) {
    context.res = {
      status: 502, headers: cors(),
      body: JSON.stringify({ error: e.message })
    }
  }
}

// ── System prompt with memory injection ──────────────────────────────────────

function buildSystemPrompt({ currentPage = 'dashboard', pageData = {} }, memories) {
  const memBlock = memories.length > 0
    ? `\n\nPERSISTENT MEMORY — Recalled from past sessions (${memories.length} entries):\n` +
      memories.map(m =>
        `• [${(m.createdAt || '').slice(0, 10)}]${m.client ? ` [${m.client}]` : ''} ${m.summary}`
      ).join('\n') +
      '\n\nUse your memory proactively. Surface relevant past context without waiting to be asked.'
    : ''

  const pageCtx = Object.keys(pageData).length > 0
    ? `\nCurrent page data: ${JSON.stringify(pageData).slice(0, 400)}`
    : ''

  return `You are Kia'i (kee-AH-ee), a senior AI security operations assistant for ULU Malu Systems — a managed security services provider serving healthcare, defense, and enterprise clients in Hawaiʻi and the Pacific.

Current NEXUS dashboard page: ${currentPage}${pageCtx}${memBlock}

Your capabilities:
- Analyze security findings, draft incident reports, summarize threats and risks
- Navigate the dashboard by including [NAV:pagename] anywhere in your reply
  Pages: dashboard, drafts, briefing, pentest, auditlog, analytics
- Recall and proactively surface past incidents, client context, and threat patterns
- Assist with email drafts, briefings, and executive summaries

Be concise, technical, and action-oriented. Respond in the same language as the operator.`
}

// ── Azure AI Foundry ──────────────────────────────────────────────────────────

function callFoundry(endpoint, apiKey, deployment, messages) {
  const url  = new URL(`${endpoint.replace(/\/$/, '')}/models/chat/completions?api-version=2024-05-01-preview`)
  const body = JSON.stringify({ model: deployment, messages, max_tokens: 1024, temperature: 0.7 })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (j.error) return reject(new Error(j.error.message || `Foundry error ${res.statusCode}`))
          resolve(j.choices?.[0]?.message?.content || '')
        } catch { reject(new Error('Failed to parse Foundry response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Azure Table Storage helpers ───────────────────────────────────────────────

function parseConn(conn) {
  const parts = {}
  conn.split(';').forEach(p => {
    const idx = p.indexOf('=')
    if (idx > 0) parts[p.slice(0, idx).trim()] = p.slice(idx + 1).trim()
  })
  return { account: parts.AccountName, key: parts.AccountKey }
}

function sign(account, key, method, contentType, date, resource) {
  const str = `${method}\n\n${contentType}\n${date}\n/${account}/${resource}`
  return 'SharedKeyLite ' + account + ':' +
    crypto.createHmac('sha256', Buffer.from(key, 'base64')).update(str, 'utf8').digest('base64')
}

function tableReq(account, key, method, resource, query, body) {
  const date    = new Date().toUTCString()
  const ct      = body ? 'application/json' : ''
  const auth    = sign(account, key, method, ct, date, resource)
  const host    = `${account}.table.core.windows.net`
  const path    = `/${resource}${query ? '?' + query : ''}`
  const payload = body ? JSON.stringify(body) : null

  return new Promise((resolve, reject) => {
    const headers = {
      Authorization: auth,
      'x-ms-date': date,
      'x-ms-version': '2019-02-02',
      Accept: 'application/json;odata=nometadata',
      DataServiceVersion: '3.0'
    }
    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }
    const req = https.request({ hostname: host, path, method, headers }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode >= 400 && res.statusCode !== 409)
          return reject(new Error(`Table ${res.statusCode}: ${data.slice(0, 200)}`))
        try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function getMemories(account, key, client, top) {
  const filter = client
    ? `PartitionKey eq '${PARTITION}' and client eq '${client.replace(/'/g, "''")}'`
    : `PartitionKey eq '${PARTITION}'`
  const result = await tableReq(account, key, 'GET', TABLE,
    `$filter=${encodeURIComponent(filter)}&$top=${top}`, null)
  return result.value || []
}

async function saveMemory({ account, key }, summary, type, client, page, importance) {
  // Ensure table exists first (409 = already exists, ignored)
  await tableReq(account, key, 'POST', 'Tables', null, { TableName: TABLE }).catch(() => {})
  const rev  = String(9999999999999 - Date.now()).padStart(13, '0')
  const rand = Math.random().toString(36).slice(2, 7)
  return tableReq(account, key, 'POST', TABLE, null, {
    PartitionKey: PARTITION,
    RowKey: `${rev}-${rand}`,
    summary, type, client: client || '', page: page || '', importance,
    createdAt: new Date().toISOString()
  })
}

function extractClient(text) {
  const m = text.match(/(?:for|client|regarding)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
  return m ? m[1] : ''
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}
