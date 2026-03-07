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
  const [status, setStatus]         = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [lastCmd, setLastCmd]       = useState('')
  const recognitionRef              = useRef(null)
  const wantListening               = useRef(false)

  const supported = typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  const stopListening = useCallback(() => {
    wantListening.current = false
    recognitionRef.current?.stop()
    setStatus('idle')
  }, [])

  const startListening = useCallback(() => {
    if (!supported) return
    if (wantListening.current) { stopListening(); return }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition

    const startRec = () => {
      const rec = new SR()
      rec.lang = 'en-US'
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.continuous = true
      recognitionRef.current = rec

      rec.onresult = (e) => {
        const last = e.results[e.results.length - 1]
        const interim = last[0].transcript
        setTranscript(interim)
        if (last.isFinal) {
          setStatus('processing')
          const match = matchCommand(interim)
          if (match) {
            setLastCmd(`"${interim}" → ${match.nav}`)
            onNav(match.nav)
            if (match.client && onClientHint) onClientHint(match.nav, match.client)
          } else {
            setLastCmd(`"${interim}" — not recognized`)
          }
          setTranscript('')
          setTimeout(() => { if (wantListening.current) setStatus('listening') }, 800)
        }
      }

      rec.onerror = (e) => {
        if (e.error !== 'no-speech') setStatus('error')
        setTimeout(() => { if (wantListening.current) setStatus('listening') }, 1500)
      }

      rec.onend = () => {
        if (wantListening.current) setTimeout(startRec, 200)
        else setStatus('idle')
      }

      rec.start()
    }

    wantListening.current = true
    setStatus('listening')
    setTranscript('')
    startRec()
  }, [supported, onNav, onClientHint, stopListening])

  useEffect(() => () => { wantListening.current = false; recognitionRef.current?.stop() }, [])

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
