const https = require('https')
const { URL } = require('url')

/**
 * Returns a short-lived Azure Speech token.
 * Supports both:
 *  - Classic regional endpoint: ${region}.api.cognitive.microsoft.com
 *  - Azure AI Services (multi-service) endpoint: ai-*.cognitiveservices.azure.com
 *
 * SWA app settings required:
 *   SPEECH_KEY      — subscription key (from AI Services resource)
 *   SPEECH_REGION   — Azure region, e.g. eastus (used by Speech SDK)
 *   SPEECH_ENDPOINT — (optional) custom endpoint, e.g. https://ai-xgsn7koaekgj6.cognitiveservices.azure.com
 *
 * Token is valid for 10 minutes. The key never leaves the server.
 */
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors() }
    return
  }

  const key      = process.env.SPEECH_KEY
  const region   = process.env.SPEECH_REGION   || 'eastus'
  const endpoint = process.env.SPEECH_ENDPOINT || null

  if (!key) {
    context.res = {
      status: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'SPEECH_KEY not configured.' })
    }
    return
  }

  try {
    const token = await issueToken(key, region, endpoint)
    context.res = {
      status: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        region,
        // Pass the AI Services hostname back so the SDK can use it as a custom endpoint
        endpoint: endpoint || null,
      })
    }
  } catch (e) {
    context.res = {
      status: 502,
      headers: cors(),
      body: JSON.stringify({ error: `Token error: ${e.message}` })
    }
  }
}

function issueToken(key, region, customEndpoint) {
  return new Promise((resolve, reject) => {
    // Use custom AI Services endpoint if provided, otherwise fall back to regional STS
    let hostname, path
    if (customEndpoint) {
      const parsed = new URL(customEndpoint.endsWith('/') ? customEndpoint.slice(0, -1) : customEndpoint)
      hostname = parsed.hostname
      path = '/sts/v1.0/issuetoken'
    } else {
      hostname = `${region}.api.cognitive.microsoft.com`
      path = '/sts/v1.0/issuetoken'
    }

    const opts = {
      hostname,
      path,
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
      timeout: 10000,
    }

    const req = https.request(opts, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data)
        else reject(new Error(`STS ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('STS timeout')))
    req.end()
  })
}

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
