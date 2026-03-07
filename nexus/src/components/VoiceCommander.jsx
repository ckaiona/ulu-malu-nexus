import { useState, useEffect, useRef, useCallback } from 'react'

const A = '#00E6C3', WARN = '#FF6B35', BORDER = '#1A3A5C'

// Voice command routing — maps spoken phrases to actions
const COMMANDS = [
  { patterns: ['show alerts', 'open alerts', 'dashboard', 'home'],           nav: 'dashboard' },
  { patterns: ['review drafts', 'show drafts', 'drafts', 'open drafts'],     nav: 'drafts' },
  { patterns: ['audit log', 'show audit', 'audit'],                          nav: 'auditlog' },
  { patterns: ['pentest', 'pentest queue', 'scans', 'show scans', 'analyze pentest', 'run analysis'], nav: 'pentest' },
  { patterns: ['briefing', 'create briefing', 'generate report', 'reports'], nav: 'briefing' },
  { patterns: ['analytics', 'show analytics', 'trends', 'show trends', 'kpis'], nav: 'analytics' },
  { patterns: ['briefing for'],   nav: 'briefing',  extract: 'client' },
  { patterns: ['pentest for'],    nav: 'pentest',   extract: 'client' },
]

function matchCommand(transcript) {
  const t = transcript.toLowerCase().trim()
  for (const cmd of COMMANDS) {
    for (const pattern of cmd.patterns) {
      if (t.includes(pattern)) {
        let client = null
        if (cmd.extract === 'client') {
          const idx = t.indexOf(pattern) + pattern.length
          client = transcript.slice(idx).trim() || null
        }
        return { nav: cmd.nav, client }
      }
    }
  }
  return null
}

// Load Azure Speech SDK from CDN (cached on window)
function loadSpeechSDK() {
  if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://aka.ms/csspeech/jsbrowserpackageraw'
    s.onload  = () => resolve(window.SpeechSDK)
    s.onerror = () => reject(new Error('Failed to load Speech SDK'))
    document.head.appendChild(s)
  })
}

async function fetchSpeechToken() {
  const res = await fetch('/api/speech-token')
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
  return res.json() // { token, region }
}

export default function VoiceCommander({ onNav, onClientHint }) {
  const [status, setStatus]       = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [lastCmd, setLastCmd]     = useState('')
  const recognizerRef             = useRef(null)
  const wantListening             = useRef(false)

  const stopListening = useCallback(() => {
    wantListening.current = false
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => { recognizerRef.current?.close(); recognizerRef.current = null },
        () => { recognizerRef.current?.close(); recognizerRef.current = null }
      )
    }
    setStatus('idle')
  }, [])

  const startListening = useCallback(async () => {
    if (wantListening.current) { stopListening(); return }

    setStatus('listening')
    wantListening.current = true

    try {
      const [SDK, { token, region }] = await Promise.all([loadSpeechSDK(), fetchSpeechToken()])

      if (!wantListening.current) return // user cancelled while loading

      const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region)
      speechConfig.speechRecognitionLanguage = 'en-US'
      const audioConfig  = SDK.AudioConfig.fromDefaultMicrophoneInput()
      const recognizer   = new SDK.SpeechRecognizer(speechConfig, audioConfig)
      recognizerRef.current = recognizer

      recognizer.recognizing = (_, e) => {
        setTranscript(e.result.text)
      }

      recognizer.recognized = (_, e) => {
        const text = e.result.text
        if (!text) return
        setTranscript(text)
        setStatus('processing')
        const match = matchCommand(text)
        if (match) {
          setLastCmd(`"${text}" → ${match.nav}`)
          onNav(match.nav)
          if (match.client && onClientHint) onClientHint(match.nav, match.client)
        } else {
          setLastCmd(`"${text}" — not recognized`)
        }
        setTranscript('')
        setTimeout(() => { if (wantListening.current) setStatus('listening') }, 800)
      }

      recognizer.canceled = (_, e) => {
        if (e.errorCode !== 0) {
          setLastCmd(`Error: ${e.errorDetails || 'Speech error'}`)
          setStatus('error')
          setTimeout(() => setStatus('idle'), 3000)
          wantListening.current = false
        }
      }

      recognizer.sessionStopped = () => {
        if (!wantListening.current) setStatus('idle')
      }

      recognizer.startContinuousRecognitionAsync(
        () => {},
        (err) => {
          setLastCmd(`Mic error: ${err}`)
          setStatus('error')
          setTimeout(() => setStatus('idle'), 3000)
          wantListening.current = false
        }
      )
    } catch (err) {
      setLastCmd(`${err.message}`)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
      wantListening.current = false
    }
  }, [onNav, onClientHint, stopListening])

  useEffect(() => () => {
    wantListening.current = false
    recognizerRef.current?.close()
  }, [])

  const stateColor = { idle: '#2A5A7A', listening: A, processing: '#FFD166', error: WARN }[status]
  const stateLabel = { idle: '', listening: 'LISTENING', processing: 'PROCESSING', error: 'ERROR' }[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {status !== 'idle' && (
        <div style={{ fontSize: 9, color: stateColor, letterSpacing: 2, animation: status === 'listening' ? 'pulse 1s infinite' : 'none' }}>
          {stateLabel}
          {transcript && status === 'listening' && (
            <span style={{ color: '#5A9ABA', marginLeft: 6, letterSpacing: 0, fontStyle: 'italic' }}>
              "{transcript}"
            </span>
          )}
        </div>
      )}

      {lastCmd && status === 'idle' && (
        <div style={{ fontSize: 9, color: '#3A6080', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastCmd}
        </div>
      )}

      <button
        onClick={status === 'listening' ? stopListening : startListening}
        title={status === 'listening' ? 'Stop listening' : 'Voice command'}
        style={{
          width: 32, height: 32, borderRadius: '50%', border: `1px solid ${stateColor}`,
          background: status === 'listening' ? `${A}22` : 'transparent',
          color: stateColor, cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, transition: 'all .2s',
          boxShadow: status === 'listening' ? `0 0 12px ${A}66` : 'none',
          flexShrink: 0
        }}
      >
        {status === 'listening' ? '⏹' : '🎙'}
      </button>
    </div>
  )
}
