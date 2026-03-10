/**
 * KiaiChat — Kia'i AI assistant chat bubble for NEXUS dashboard.
 *
 * Features:
 *  - Floating bubble, bottom-right, expandable panel
 *  - Sends messages to kiai_chat Azure Function → claude-opus-4-6
 *  - Session chat history (cleared on page refresh)
 *  - Voice dictation via Web Speech API (mic button in input row)
 *  - Image support: Ctrl+V paste, drag-and-drop, paperclip upload
 *  - Thumbnail preview before sending
 *  - [NAV:pagename] action parsing — navigates dashboard on Kia'i's command
 *  - Dashboard context (current page + page data) sent with every message
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/useAuth'

const A      = '#00E6C3'
const NAVY   = '#060F1E'
const CARD   = '#0D1F35'
const BORDER = '#1A3A5C'
const WARN   = '#FF6B35'
const TEXT   = '#C8E6F0'
const DIM    = '#3A6080'

const KIAI_URL = import.meta.env.VITE_KIAI_URL ||
  'https://kiai-nexus-functions.azurewebsites.net/api/kiai_chat'

// Strip [NAV:x] from display text and return { text, navTarget }
function parseReply(reply) {
  const navMatch = reply.match(/\[NAV:(\w+)\]/)
  const navTarget = navMatch ? navMatch[1] : null
  const text = reply.replace(/\[NAV:\w+\]\s*/g, '').trim()
  return { text, navTarget }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function isImageFile(file) {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)
}

export default function KiaiChat({ currentPage, pageData, onNav }) {
  const { isAuthenticated, msalEnabled, account, profile, login } = useAuth()
  const [open,     setOpen]     = useState(false)
  const [input,    setInput]    = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Aloha! I'm Kia'i. Ask me about your dashboard, draft a reply, or say \"navigate to audit log\"." }
  ])
  const [loading,  setLoading]  = useState(false)
  const [image,    setImage]    = useState(null)   // { data: base64, media_type, previewUrl }
  const [dragOver, setDragOver] = useState(false)
  const [listening, setListening] = useState(false)

  const bottomRef     = useRef(null)
  const inputRef      = useRef(null)
  const fileInputRef  = useRef(null)
  const recognitionRef = useRef(null)

  // Scroll to bottom on new message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // ── Voice dictation ──────────────────────────────────────────────────────
  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startVoice = useCallback(async () => {
    if (!supported || listening) return
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Mic access was blocked. Allow microphone in your browser settings and try again.' }])
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    recognitionRef.current = rec
    setListening(true)

    rec.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join('')
      setInput(text)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setMessages(m => [...m, { role: 'assistant', content: 'Mic access was blocked. Allow microphone in your browser settings and try again.' }])
      }
      if (e.error !== 'no-speech') setListening(false)
    }
    rec.onend = () => setListening(false)
    rec.start()
  }, [supported, listening])

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  // ── Image handling ───────────────────────────────────────────────────────
  const attachImage = useCallback(async (file) => {
    if (!isImageFile(file)) return
    const data = await fileToBase64(file)
    setImage({ data, media_type: file.type, previewUrl: URL.createObjectURL(file) })
  }, [])

  // Paste
  const handlePaste = useCallback((e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imgItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (imgItem) {
      e.preventDefault()
      attachImage(imgItem.getAsFile())
    }
  }, [attachImage])

  // Drag-and-drop on the whole panel
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) attachImage(file)
  }, [attachImage])

  const clearImage = () => {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl)
    setImage(null)
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text && !image) return

    const userMsg = { role: 'user', content: text, image: image?.previewUrl }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    clearImage()
    setLoading(true)

    // History for API: text only for prior turns
    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }))

    const userName  = profile?.displayName || account?.name || account?.username || null
    const userEmail = profile?.mail        || account?.username || null

    const body = {
      message: text,
      history,
      context: { currentPage, pageData: pageData || {}, user: { name: userName, email: userEmail } },
      ...(image ? { image: { data: image.data, media_type: image.media_type } } : {}),
    }

    try {
      const res = await fetch(KIAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      const { text: replyText, navTarget } = parseReply(data.reply || data.error || 'No response.')

      setMessages(prev => [...prev, { role: 'assistant', content: replyText }])

      if (navTarget && onNav) {
        onNav(navTarget)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ Connection error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }, [input, image, messages, currentPage, pageData, onNav])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const bubbleStyle = {
    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
    width: 48, height: 48, borderRadius: '50%',
    background: `linear-gradient(135deg, ${A}33, ${A}11)`,
    border: `1.5px solid ${A}`,
    boxShadow: `0 0 20px ${A}44`,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 20,
    transition: 'all .2s',
  }

  const panelStyle = {
    position: 'fixed', bottom: 80, right: 24, zIndex: 1000,
    width: 380, height: 520,
    background: NAVY, border: `1px solid ${BORDER}`,
    borderRadius: 12,
    boxShadow: `0 8px 40px rgba(0,0,0,.6), 0 0 30px ${A}22`,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Courier New', monospace",
  }

  return (
    <>
      {/* Floating bubble */}
      <div
        style={bubbleStyle}
        onClick={() => setOpen(o => !o)}
        title="Chat with Kia'i"
      >
        {open ? '✕' : '🤖'}
      </div>

      {/* Chat panel */}
      {open && (
        <div
          style={panelStyle}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Drag-over overlay */}
          {dragOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: `${A}11`, border: `2px dashed ${A}`,
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: A, fontSize: 13,
              letterSpacing: 2, pointerEvents: 'none',
            }}>
              DROP IMAGE HERE
            </div>
          )}

          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', gap: 10,
            background: CARD,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: A, boxShadow: `0 0 6px ${A}`,
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ color: A, fontSize: 12, letterSpacing: 2, fontWeight: 'bold' }}>
              KIA'I
            </span>
            <span style={{ color: DIM, fontSize: 10, marginLeft: 'auto' }}>
              {isAuthenticated && (profile?.displayName || account?.name)
                ? `${(profile?.displayName || account?.name).split(' ')[0].toUpperCase()} · `
                : ''}
              {currentPage?.toUpperCase()} · claude-opus-4-6
            </span>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: 8, alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? `${BORDER}` : `${A}22`,
                  border: `1px solid ${msg.role === 'user' ? BORDER : A}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10,
                }}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>

                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Image preview (user messages with images) */}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="attached"
                      style={{ maxWidth: '100%', borderRadius: 6, border: `1px solid ${BORDER}` }}
                    />
                  )}
                  {/* Text bubble */}
                  {msg.content && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                      background: msg.role === 'user' ? `${BORDER}` : `${CARD}`,
                      color: TEXT,
                      border: `1px solid ${msg.role === 'user' ? '#2A5A7A' : BORDER}`,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: `${A}22`, border: `1px solid ${A}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                }}>
                  🤖
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: 6, height: 6, borderRadius: '50%', background: A,
                      animation: `bounce 1s infinite ${j * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Image preview strip */}
          {image && (
            <div style={{
              padding: '6px 16px', borderTop: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 8,
              background: CARD,
            }}>
              <img
                src={image.previewUrl}
                alt="preview"
                style={{ height: 40, borderRadius: 4, border: `1px solid ${BORDER}` }}
              />
              <span style={{ color: DIM, fontSize: 10, flex: 1 }}>Image attached</span>
              <button
                onClick={clearImage}
                style={{
                  background: 'none', border: 'none', color: WARN,
                  cursor: 'pointer', fontSize: 14, padding: 2,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Auth gate — shown when MSAL is enabled but user is not signed in */}
          {msalEnabled && !isAuthenticated && (
            <div style={{
              padding: '20px 16px', borderTop: `1px solid ${BORDER}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              background: CARD,
            }}>
              <div style={{ fontSize: 10, color: DIM, letterSpacing: 1, textAlign: 'center' }}>
                SIGN IN TO CHAT WITH KIA'I
              </div>
              <button
                onClick={login}
                style={{
                  background: `${A}22`, border: `1px solid ${A}`,
                  color: A, borderRadius: 6, padding: '8px 20px',
                  cursor: 'pointer', fontSize: 11, letterSpacing: 2,
                }}
              >
                🔑 SIGN IN WITH MICROSOFT
              </button>
            </div>
          )}

          {/* Input row — shown when not gated */}
          {(!msalEnabled || isAuthenticated) && <div style={{
            padding: '10px 12px', borderTop: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column', gap: 8,
            background: CARD,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask Kia'i anything… (paste image with Cmd+V)"
              rows={2}
              style={{
                background: '#0A1525', border: `1px solid ${BORDER}`,
                borderRadius: 6, color: TEXT, fontSize: 12,
                padding: '8px 10px', resize: 'none', outline: 'none',
                fontFamily: "'Courier New', monospace", lineHeight: 1.4,
                width: '100%', boxSizing: 'border-box',
              }}
            />

            {/* Listening indicator */}
            {listening && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 6,
                background: `${A}15`, border: `1px solid ${A}66`,
                animation: 'listenPulse 1s infinite',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: A, animation: 'pulse 0.6s infinite' }} />
                <span style={{ color: A, fontSize: 10, letterSpacing: 2 }}>LISTENING</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              {/* Paperclip */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach image"
                style={{
                  background: 'none', border: `1px solid ${BORDER}`,
                  color: DIM, borderRadius: 6, padding: '4px 8px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) attachImage(e.target.files[0]); e.target.value = '' }}
              />

              {/* Mic button — dictates into input */}
              {supported && (
                <button
                  onClick={listening ? stopVoice : startVoice}
                  title={listening ? 'Stop dictation' : 'Dictate message'}
                  style={{
                    background: listening ? `${A}22` : 'none',
                    border: `1px solid ${listening ? A : BORDER}`,
                    color: listening ? A : DIM,
                    borderRadius: 6, padding: '4px 8px',
                    cursor: 'pointer', fontSize: 14,
                    boxShadow: listening ? `0 0 8px ${A}44` : 'none',
                    transition: 'all .2s',
                  }}
                >
                  {listening ? '⏹' : '🎙'}
                </button>
              )}

              {/* Send */}
              <button
                onClick={sendMessage}
                disabled={loading || (!input.trim() && !image)}
                style={{
                  background: loading || (!input.trim() && !image) ? `${BORDER}` : `${A}22`,
                  border: `1px solid ${loading || (!input.trim() && !image) ? BORDER : A}`,
                  color: loading || (!input.trim() && !image) ? DIM : A,
                  borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
                  fontSize: 11, letterSpacing: 1, fontFamily: "'Courier New', monospace",
                  transition: 'all .2s',
                }}
              >
                SEND
              </button>
            </div>
          </div>}
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes listenPulse {
          0%, 100% { box-shadow: 0 0 6px ${A}44; }
          50%       { box-shadow: 0 0 14px ${A}88; }
        }
      `}</style>
    </>
  )
}
