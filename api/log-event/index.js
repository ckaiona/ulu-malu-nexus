const https  = require('https')
const crypto = require('crypto')

const WS_ID  = process.env.LA_WORKSPACE_ID
const WS_KEY = process.env.LA_WORKSPACE_KEY

/**
 * Accepts telemetry events from NEXUS frontend and writes them to
 * Log Analytics custom tables so Power BI (or KQL queries) can consume them.
 *
 * Event types written:
 *  - NexusAlert_CL       → security alert activity
 *  - NexusAgentCall_CL   → Kia'i AI chat usage
 *  - NexusPentest_CL     → pentest queue events
 *  - NexusClientHealth_CL→ client risk/compliance snapshots
 */
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() }
    return
  }

  if (!WS_ID || !WS_KEY) {
    context.res = { status: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Log Analytics not configured' }) }
    return
  }

  const { logType, records } = req.body || {}
  if (!logType || !Array.isArray(records) || records.length === 0) {
    context.res = { status: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'logType and records[] required' }) }
    return
  }

  // Stamp server-side timestamp so records can't be backdated
  const stamped = records.map(r => ({ ...r, TimeGenerated: new Date().toISOString() }))
  const body    = JSON.stringify(stamped)

  try {
    await postToLogAnalytics(logType, body)
    context.res = { status: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, count: records.length }) }
  } catch (e) {
    context.res = { status: 502, headers: corsHeaders(), body: JSON.stringify({ error: e.message }) }
  }
}

function postToLogAnalytics(logType, body) {
  const date      = new Date().toUTCString()
  const signature = buildSignature(WS_KEY, date, body.length, 'POST', 'application/json', '/api/logs')

  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${WS_ID}.ods.opinsights.azure.com`,
      path:     '/api/logs?api-version=2016-04-01',
      method:   'POST',
      headers:  {
        'Content-Type':    'application/json',
        'Authorization':   `SharedKey ${WS_ID}:${signature}`,
        'Log-Type':        logType,
        'x-ms-date':       date,
        'Content-Length':  Buffer.byteLength(body),
      }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve()
        else reject(new Error(`LA ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function buildSignature(key, date, contentLength, method, contentType, resource) {
  const stringToSign = `${method}\n${contentLength}\n${contentType}\nx-ms-date:${date}\n${resource}`
  const decodedKey   = Buffer.from(key, 'base64')
  const hmac         = crypto.createHmac('sha256', decodedKey)
  hmac.update(stringToSign)
  return hmac.digest('base64')
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
