const https = require('https')

/**
 * Returns a short-lived Azure Cognitive Services speech token.
 * Token is valid for 10 minutes. The subscription key stays server-side.
 */
module.exports = async function (context, req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() }
    return
  }

  const key    = process.env.SPEECH_KEY
  const region = process.env.SPEECH_REGION || 'eastus'

  if (!key) {
    context.res = {
      status: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Speech key not configured on server.' })
    }
    return
  }

  try {
    const token = await issueToken(key, region)
    context.res = {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, region })
    }
  } catch (e) {
    context.res = {
      status: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: `Token error: ${e.message}` })
    }
  }
}

function issueToken(key, region) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${region}.api.cognitive.microsoft.com`,
      path: '/sts/v1.0/issuetoken',
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data)
        else reject(new Error(`STS ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}
