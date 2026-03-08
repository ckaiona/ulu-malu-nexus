/**
 * NEXUS Active Scanner — Tier 2
 *
 * Reads target from env vars set by Container App Job execution.
 * Runs: nmap port scan + nuclei vulnerability scan
 * Posts raw output to NEXUS pentest-analyze endpoint → claude-opus-4-6 analysis
 * Updates scan status in pentest-queue via PATCH
 *
 * Required env vars (injected per job execution):
 *   TARGET_URL        e.g. https://example.com
 *   SCAN_TYPE         external | web-app | api | internal
 *   CLIENT_NAME       e.g. HEMIC Health
 *   SCAN_ID           e.g. S001
 *   NEXUS_API         SWA api base e.g. https://blue-meadow-061a5911e.2.azurestaticapps.net/api
 *   NEXUS_FUNCTION_KEY (optional)
 */

const { execSync, spawn } = require('child_process')
const https = require('https')
const http  = require('http')
const { URL } = require('url')

const TARGET_URL  = process.env.TARGET_URL  || ''
const SCAN_TYPE   = process.env.SCAN_TYPE   || 'external'
const CLIENT_NAME = process.env.CLIENT_NAME || 'Unknown Client'
const SCAN_ID     = process.env.SCAN_ID     || ''
const NEXUS_API   = process.env.NEXUS_API   || 'https://blue-meadow-061a5911e.2.azurestaticapps.net/api'
const NEXUS_KEY   = process.env.NEXUS_FUNCTION_KEY || ''

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[NEXUS-SCAN ${new Date().toISOString()}] ${msg}`)
}

function nexusFetch(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${NEXUS_API}${path}`)
    const lib = url.protocol === 'https:' ? https : http
    const payload = body ? JSON.stringify(body) : null
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(NEXUS_KEY ? { 'x-functions-key': NEXUS_KEY } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 120000,
    }
    const req = lib.request(opts, res => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    if (payload) req.write(payload)
    req.end()
  })
}

function updateScanStatus(status, findingsCount = 0) {
  if (!SCAN_ID) return Promise.resolve()
  return nexusFetch('/pentest-queue', 'PATCH', {
    scan_id:        SCAN_ID,
    status,
    findings_count: findingsCount,
  }).catch(e => log(`Status update failed: ${e.message}`))
}

// ── nmap ─────────────────────────────────────────────────────────────────────

function runNmap(target) {
  return new Promise(resolve => {
    let parsed
    try { parsed = new URL(target.startsWith('http') ? target : `https://${target}`) }
    catch { return resolve(`nmap error: invalid target ${target}`) }

    const host = parsed.hostname
    const args = [
      '-sV',                   // version detection
      '-sC',                   // default scripts
      '--script=vuln,http-headers,ssl-enum-ciphers',
      '-T4',                   // aggressive timing
      '--open',                // only open ports
      '-p', '21,22,23,25,53,80,110,143,443,445,3306,3389,5432,6379,8080,8443,8888,9200,27017',
      '--host-timeout', '120s',
      host,
    ]

    log(`nmap ${host}`)
    const chunks = []
    const proc = spawn('nmap', args, { timeout: 150000 })
    proc.stdout.on('data', d => chunks.push(d.toString()))
    proc.stderr.on('data', d => chunks.push(`[stderr] ${d.toString()}`))
    proc.on('close', code => {
      const out = chunks.join('')
      resolve(`=== NMAP SCAN: ${host} ===\nExit code: ${code}\n\n${out}`)
    })
    proc.on('error', e => resolve(`nmap not available: ${e.message}`))
  })
}

// ── nuclei ───────────────────────────────────────────────────────────────────

function runNuclei(target, scanType) {
  return new Promise(resolve => {
    // Select templates based on scan type
    const templateArgs = []
    if (scanType === 'web-app' || scanType === 'api') {
      templateArgs.push('-t', 'http/cves', '-t', 'http/misconfiguration', '-t', 'http/exposures')
    } else if (scanType === 'external') {
      templateArgs.push('-t', 'http/cves', '-t', 'http/misconfiguration', '-t', 'ssl', '-t', 'dns')
    } else {
      templateArgs.push('-t', 'http/misconfiguration', '-t', 'ssl')
    }

    const args = [
      '-u', target,
      ...templateArgs,
      '-severity', 'critical,high,medium',
      '-timeout', '5',
      '-c', '10',              // concurrency
      '-rate-limit', '50',
      '-silent',
      '-json',
    ]

    log(`nuclei ${target}`)
    const chunks = []
    const proc = spawn('nuclei', args, { timeout: 300000 })
    proc.stdout.on('data', d => chunks.push(d.toString()))
    proc.stderr.on('data', () => {})
    proc.on('close', () => {
      const raw = chunks.join('')
      // Parse JSON lines from nuclei output
      const lines = raw.split('\n').filter(Boolean)
      const findings = []
      for (const line of lines) {
        try {
          const obj = JSON.parse(line)
          findings.push(
            `[${(obj.info?.severity || 'INFO').toUpperCase()}] ${obj.info?.name || obj['template-id']}\n` +
            `  Template: ${obj['template-id']}\n` +
            `  Matched: ${obj['matched-at'] || target}\n` +
            `  ${obj.info?.description || ''}`
          )
        } catch { if (line.trim()) findings.push(line) }
      }
      const out = findings.length
        ? findings.join('\n\n')
        : '(no nuclei findings at selected severity)'
      resolve(`=== NUCLEI SCAN: ${target} ===\n\n${out}`)
    })
    proc.on('error', e => resolve(`nuclei not available: ${e.message}`))
  })
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TARGET_URL) {
    log('ERROR: TARGET_URL not set')
    process.exit(1)
  }

  log(`Starting Tier-2 scan: ${CLIENT_NAME} | ${TARGET_URL} | ${SCAN_TYPE}`)

  // Mark scan as Running
  await updateScanStatus('Running')

  // Run tools in parallel
  const [nmapOut, nucleiOut] = await Promise.all([
    runNmap(TARGET_URL),
    runNuclei(TARGET_URL, SCAN_TYPE),
  ])

  const rawFindings = [nmapOut, nucleiOut].join('\n\n' + '='.repeat(60) + '\n\n')
  log(`Raw findings: ${rawFindings.length} chars`)

  // Send to AI analysis
  log('Sending to pentest-analyze...')
  let analysisResult = {}
  try {
    analysisResult = await nexusFetch('/pentest-analyze', 'POST', {
      scanId:      SCAN_ID,
      clientName:  CLIENT_NAME,
      targetUrl:   TARGET_URL,
      scanType:    SCAN_TYPE,
      rawFindings,
    })
    log(`Analysis complete: ${analysisResult.findings?.length || 0} findings`)
  } catch (e) {
    log(`Analysis failed: ${e.message}`)
    analysisResult = { error: e.message, rawFindings }
  }

  // Update scan status to Completed
  const findingsCount = analysisResult.findings?.length || 0
  await updateScanStatus('Completed', findingsCount)

  log(`Done. ${findingsCount} findings for ${CLIENT_NAME}`)
}

main().catch(e => {
  log(`FATAL: ${e.message}`)
  process.exit(1)
})
