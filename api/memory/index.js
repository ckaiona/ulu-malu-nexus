/**
 * Kia'i Memory — Azure Table Storage CRUD for persistent AI memory
 *
 * GET  /api/memory?limit=30&client=acme  — retrieve recent memories (newest first)
 * POST /api/memory { summary, type, client, page, importance, tags } — save memory
 *
 * Required SWA app setting:
 *   MEMORY_STORAGE_CONNECTION — Azure Storage connection string
 *   Format: DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
 *
 * Table: KiaiMemories
 * RowKey uses reverse timestamp so entities sort newest-first in ascending order.
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

  const conn = process.env.MEMORY_STORAGE_CONNECTION
  if (!conn) {
    context.res = {
      status: 503, headers: cors(),
      body: JSON.stringify({ error: 'Memory storage not configured', memories: [] })
    }
    return
  }

  const { account, key } = parseConn(conn)

  if (req.method === 'GET') {
    const limit  = Math.min(parseInt(req.query?.limit || '30'), 100)
    const client = req.query?.client || null
    try {
      const filter = client
        ? `PartitionKey eq '${PARTITION}' and client eq '${client.replace(/'/g, "''")}'`
        : `PartitionKey eq '${PARTITION}'`
      const result = await tableReq(account, key, 'GET', TABLE,
        `$filter=${encodeURIComponent(filter)}&$top=${limit}`, null)
      context.res = {
        status: 200,
        headers: { ...cors(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories: result.value || [] })
      }
    } catch (e) {
      context.res = { status: 502, headers: cors(), body: JSON.stringify({ error: e.message, memories: [] }) }
    }
    return
  }

  if (req.method === 'POST') {
    const { summary, type = 'general', client = '', page = '', importance = 3, tags = '' } = req.body || {}
    if (!summary) {
      context.res = { status: 400, headers: cors(), body: JSON.stringify({ error: 'summary required' }) }
      return
    }
    try {
      // Ensure table exists (409 = already exists, fine)
      await tableReq(account, key, 'POST', 'Tables', null, { TableName: TABLE }).catch(() => {})

      const rev  = String(9999999999999 - Date.now()).padStart(13, '0')
      const rand = Math.random().toString(36).slice(2, 7)
      await tableReq(account, key, 'POST', TABLE, null, {
        PartitionKey: PARTITION,
        RowKey: `${rev}-${rand}`,
        summary, type, client, page, importance, tags,
        createdAt: new Date().toISOString()
      })
      context.res = {
        status: 201,
        headers: { ...cors(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      }
    } catch (e) {
      context.res = { status: 502, headers: cors(), body: JSON.stringify({ error: e.message }) }
    }
    return
  }

  context.res = { status: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) }
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

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}
