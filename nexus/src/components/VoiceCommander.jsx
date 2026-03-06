import { useState, useEffect, useRef, useCallback } from 'react'

const A = '#00E6C3', WARN = '#FF6B35', BORDER = '#1A3A5C'

// Voice command routing — maps spoken phrases to actions
const COMMANDS = [
  { patterns: ['show alerts', 'open alerts', 'dashboard', 'home'],           nav: 'dashboard' },
  { patterns: ['review drafts', 'show drafts', 'drafts', 'open drafts'],     nav: 'drafts' },
  { patterns: ['audit log', 'show audit', 'audit'],                          nav: 'auditlog' },
  { patterns: ['pentest', 'pentest queue', 'scans', 'show scans'],           nav: 'pentest' },
  { patterns: ['briefing', 'create briefing', 'generate report', 'reports'], nav: 'briefing' },
  // Parametric — "create briefing for HEMIC" / "queue pentest for KoreTech"
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

export default function VoiceCommander({ onNav, onClientHint }) {
  const [status, setStatus]       = useState('idle')   // idle | listening | processing | error
  const [transcript, setTranscript] = useState('')
  const [lastCmd, setLastCmd]     = useState('')
  const recognitionRef            = useRef(null)
  const timeoutRef                = useRef(null)

  const supported = typeof window !== 'undefined' && 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    clearTimeout(timeoutRef.current)
    setStatus('idle')
  }, [])

  const startListening = useCallback(() => {
    if (!supported || status === 'listening') { stopListening(); return }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = false
    recognitionRef.current = rec

    setStatus('listening')
    setTranscript('')

    rec.onresult = (e) => {
      const interim = Array.from(e.results).map(r => r[0].transcript).join('')
      setTranscript(interim)
      if (e.results[e.results.length - 1].isFinal) {
        setStatus('processing')
        const match = matchCommand(interim)
        if (match) {
          setLastCmd(`"${interim}" → ${match.nav}`)
          onNav(match.nav)
          if (match.client && onClientHint) onClientHint(match.nav, match.client)
        } else {
          setLastCmd(`"${interim}" — not recognized`)
        }
        setTimeout(() => setStatus('idle'), 1500)
      }
    }

    rec.onerror = (e) => {
      setStatus(e.error === 'no-speech' ? 'idle' : 'error')
      setTimeout(() => setStatus('idle'), 2000)
    }

    rec.onend = () => { if (status === 'listening') setStatus('idle') }

    rec.start()

    // Auto-stop after 8 seconds
    timeoutRef.current = setTimeout(stopListening, 8000)
  }, [status, supported, onNav, onClientHint, stopListening])

  useEffect(() => () => { recognitionRef.current?.stop(); clearTimeout(timeoutRef.current) }, [])

  if (!supported) return null

  const stateColor = { idle: '#2A5A7A', listening: A, processing: '#FFD166', error: WARN }[status]
  const stateLabel = { idle: '', listening: 'LISTENING', processing: 'PROCESSING', error: 'ERROR' }[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Status label */}
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

      {/* Mic button */}
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
