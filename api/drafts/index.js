/**
 * drafts — reads AI-generated email drafts from Azure Table Storage (NexusDrafts table)
 * and handles approve/reject actions.
 *
 * GET  /api/drafts              — list all drafts
 * PATCH /api/drafts/{id}/approve — mark approved (would send via Graph API)
 * PATCH /api/drafts/{id}/reject  — mark rejected
 *
 * Requires: MEMORY_STORAGE_CONNECTION app setting
 */

const https  = require('https')
const crypto = require('crypto')

const TABLE     = 'NexusDrafts'
const PARTITION = 'draft'

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors() }
    return
  }

  const conn = process.env.MEMORY_STORAGE_CONNECTION
  if (!conn) {
    context.res = { status: 503, headers: cors(), body: JSON.stringify({ error: 'Storage not configured' }) }
    return
  }

  const { account, key } = parseConn(conn)

  // GET — list drafts
  if (req.method === 'GET') {
    try {
      const filter = `PartitionKey eq '${PARTITION}'`
      const result = await tableReq(account, key, 'GET', TABLE,
        `$filter=${encodeURIComponent(filter)}&$top=50`, null)
      const drafts = (result.value || []).map(row => ({
        DraftId:       row.DraftId,
        OwnerEmail:    row.OwnerEmail,
        AddressedTo:   row.AddressedTo,
        Subject:       row.Subject,
        SenderPersona: row.SenderPersona,
        ClientName:    row.ClientName,
        Status:        row.Status || 'Pending',
        Body:          row.Body,
        OriginalBody:  row.OriginalBody,
        createdAt:     row.createdAt,
        _rowKey:       row.RowKey,
      }))
      context.res = {
        status: 200,
        headers: { ...cors(), 'Content-Type': 'application/json' },
        body: JSON.stringify(drafts)
      }
    } catch (e) {
      context.res = { status: 502, headers: cors(), body: JSON.stringify({ error: e.message }) }
    }
    return
  }

  // PATCH approve/reject — url is /api/drafts/{id}/approve or /api/drafts/{id}/reject
  if (req.method === 'PATCH') {
    const url   = req.url || ''
    const action = url.includes('/approve') ? 'Approved' : url.includes('/reject') ? 'Rejected' : null
    const draftId = req.params?.id || url.split('/').filter(Boolean).slice(-2, -1)[0]

    if (!action || !draftId) {
      context.res = { status: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid action' }) }
      return
    }

    try {
      // Find the entity by DraftId
      const filter = `PartitionKey eq '${PARTITION}' and DraftId eq '${draftId}'`
      const result = await tableReq(account, key, 'GET', TABLE,
        `$filter=${encodeURIComponent(filter)}&$top=1`, null)
      const row = result.value?.[0]
      if (!row) {
        context.res = { status: 404, headers: cors(), body: JSON.stringify({ error: 'Draft not found' }) }
        return
      }

      // Merge-update the Status field
      const resource = `${TABLE}(PartitionKey='${PARTITION}',RowKey='${row.RowKey}')`
      await tableReq(account, key, 'MERGE', resource, null, { Status: action })

      // TODO: if action === 'Approved', send via Microsoft Graph API here
      context.res = {
        status: 200,
        headers: { ...cors(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, status: action })
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
        if (res.statusCode >= 400)
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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}
