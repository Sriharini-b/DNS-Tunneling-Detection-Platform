import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Plus, Trash2, Send, Edit2, CheckSquare,
  ShieldAlert, Globe, ChevronDown, ChevronUp, Bot, User
} from 'lucide-react'
import {
  listChatSessions, createChatSession, getChatMessages,
  deleteChatSession, deleteChatMessage, renameChatSession, ChatSession, ChatMessage
} from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'

// ── Structured Card (domain analysis result) ──────────────────────────────────

function StructuredCard({ data }: { data: any }) {
  const verdictColor = data.verdict === 'High'
    ? 'var(--color-danger)'
    : data.verdict === 'Medium'
    ? 'var(--color-warning)'
    : 'var(--color-success)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Summary */}
      <div style={{ padding: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.375rem' }}>
          Summary
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{data.summary}</div>
      </div>

      {/* Technical DNS Findings */}
      <div style={{ padding: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', fontWeight: 600, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Globe size={10} /> Technical DNS Findings
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{data.technical_dns_findings}</div>
      </div>

      {/* Comparison */}
      {Array.isArray(data.comparison_to_criteria) && (
        <div style={{ padding: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-warning)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Comparison to CY-04 Detection Criteria
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingLeft: 0, listStyle: 'none' }}>
            {data.comparison_to_criteria.map((item: string, i: number) => (
              <li key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text)', display: 'flex', gap: '0.5rem' }}>
                <span style={{ color: 'var(--color-warning)', flexShrink: 0 }}>›</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verdict */}
      <div style={{ padding: '0.875rem', background: `${verdictColor}11`, border: `1px solid ${verdictColor}44`, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldAlert size={20} color={verdictColor} />
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            TUNNELING RESEMBLANCE VERDICT
          </div>
          <div style={{ fontWeight: 700, color: verdictColor, fontSize: '1rem' }}>{data.verdict} Risk</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{data.verdict_justification}</div>
        </div>
      </div>
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, onDelete }: { msg: ChatMessage; onDelete: (id: number) => void }) {
  const isUser = msg.role === 'user'
  const [showRaw, setShowRaw] = useState(false)

  // Try to parse structured card
  let structured: any = null
  if (!isUser && msg.metadata_json) {
    try { structured = JSON.parse(msg.metadata_json) } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
      {/* Role icon + delete message button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        fontSize: '0.7rem',
        color: 'var(--color-text-muted)',
        width: '100%',
        maxWidth: isUser ? '75%' : '85%',
        marginLeft: isUser ? 'auto' : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {isUser ? <User size={12} /> : <Bot size={12} color="var(--color-primary)" />}
          {isUser ? 'You' : 'DNS Shield AI'}
          <span style={{ opacity: 0.5 }}>{new Date(msg.created_at).toLocaleTimeString()}</span>
        </div>
        <button
          onClick={() => {
            if (window.confirm('Delete this message?')) {
              onDelete(msg.id)
            }
          }}
          title="Delete message"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            opacity: 0.7,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.7rem',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.color = 'var(--color-danger)'
            e.currentTarget.style.background = 'var(--color-danger)15'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '0.7'
            e.currentTarget.style.color = 'var(--color-text-muted)'
            e.currentTarget.style.background = 'none'
          }}
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>

      {isUser ? (
        <div className="bubble-user">
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{msg.content}</div>
        </div>
      ) : (
        <div className="bubble-assistant" style={{ width: '100%', maxWidth: '85%' }}>
          {structured ? (
            <>
              <StructuredCard data={structured} />
              <button
                onClick={() => setShowRaw(r => !r)}
                style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showRaw ? 'Hide raw' : 'View raw JSON'}
              </button>
              {showRaw && (
                <pre style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', overflow: 'auto', maxHeight: '200px', background: 'var(--color-surface)', padding: '0.5rem', borderRadius: '0.375rem' }}>
                  {JSON.stringify(structured, null, 2)}
                </pre>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
              <MarkdownRenderer content={msg.content} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ streamText }: { streamText: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
        <Bot size={12} color="var(--color-primary)" /> DNS Shield AI
      </div>
      <div className="bubble-assistant" style={{ maxWidth: '85%' }}>
        {streamText ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {streamText}
            <span style={{ display: 'inline-block', width: '2px', height: '14px', background: 'var(--color-primary)', marginLeft: '2px', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', height: '20px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--color-primary)', opacity: 0.7,
                animation: `bounce 1s ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Chat Page ────────────────────────────────────────────────────────────

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { scrollToBottom() }, [messages, streamText])

  const loadSessions = async () => {
    const r = await listChatSessions(searchQuery || undefined)
    setSessions(r.data)
  }

  const loadMessages = async (id: string) => {
    const r = await getChatMessages(id)
    setMessages(r.data)
  }

  const selectSession = (id: string) => {
    setActiveSession(id)
    loadMessages(id)
    setError(null)
  }

  const newSession = async () => {
    const r = await createChatSession()
    setSessions(s => [r.data, ...s])
    setActiveSession(r.data.id)
    setMessages([])
    setError(null)
  }

  const deleteSession = async (id: string) => {
    await deleteChatSession(id)
    setSessions(s => s.filter(x => x.id !== id))
    if (activeSession === id) { setActiveSession(null); setMessages([]) }
  }

  const deleteMessage = async (msgId: number) => {
    try {
      await deleteChatMessage(msgId)
      setMessages(m => m.filter(x => x.id !== msgId))
    } catch (e) {
      console.error('Failed to delete message:', e)
    }
  }

  const startRename = (session: ChatSession) => {
    setEditingId(session.id)
    setEditTitle(session.title || '')
  }

  const saveRename = async () => {
    if (!editingId) return
    await renameChatSession(editingId, editTitle)
    setSessions(s => s.map(x => x.id === editingId ? { ...x, title: editTitle } : x))
    setEditingId(null)
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setError(null)
    setStreamText('')

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: Date.now(), session_id: activeSession, role: 'user',
      content, metadata_json: null, created_at: new Date().toISOString()
    }
    setMessages(m => [...m, tempUserMsg])

    try {
      const resp = await fetch(`http://localhost:8000/api/chat/sessions/${activeSession}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setError(err.detail || `Server error ${resp.status}`)
        setSending(false)
        return
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.chunk) { accumulated += json.chunk; setStreamText(accumulated) }
            if (json.done) {
              setStreamText('')
              await loadMessages(activeSession)
              await loadSessions()
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError('Connection error. Is the backend running on port 8000?')
    } finally {
      setSending(false)
      setStreamText('')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sessions Sidebar */}
      <div style={{
        width: '280px', borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden'
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={newSession}>
            <Plus size={14} /> New Chat
          </button>
          <input
            className="input" style={{ marginTop: '0.75rem' }}
            placeholder="Search conversations..." value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); loadSessions() }}
          />
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {sessions.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 1rem' }}>
              No conversations yet. Start one!
            </div>
          )}
          {sessions.map(s => (
            <div key={s.id} onClick={() => selectSession(s.id)} className="session-item" style={{
              padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
              background: activeSession === s.id ? 'var(--color-primary)1a' : 'transparent',
              border: activeSession === s.id ? '1px solid var(--color-primary)33' : '1px solid transparent',
              marginBottom: '0.25rem', transition: 'all 0.15s',
            }}>
              {editingId === s.id ? (
                <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveRename()} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} autoFocus />
                  <button onClick={saveRename} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <CheckSquare size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={13} color={activeSession === s.id ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {new Date(s.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); startRename(s) }}
                      title="Rename conversation"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                        padding: '0.3rem',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-surface-2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'none'; }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (window.confirm(`Delete conversation "${s.title || 'Untitled'}"?`)) {
                          deleteSession(s.id)
                        }
                      }}
                      title="Delete conversation"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-danger)',
                        padding: '0.3rem',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-danger)22'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={18} color="var(--color-primary)" /> DNS Intelligence AI
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
              Ask about any domain for live DNS analysis, WHOIS lookup, and tunneling risk assessment
            </p>
          </div>
          {activeSession && (
            <button
              onClick={() => {
                if (window.confirm('Delete this entire conversation?')) {
                  deleteSession(activeSession)
                }
              }}
              className="btn-secondary"
              style={{
                color: 'var(--color-danger)',
                borderColor: 'var(--color-danger)44',
                fontSize: '0.75rem',
                padding: '0.4rem 0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
              title="Delete this entire conversation"
            >
              <Trash2 size={13} /> Delete Chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!activeSession && (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Bot size={48} color="var(--color-primary)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                Start a conversation
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                Ask about a domain (e.g. <code style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>example.com</code>) for live analysis, or ask a general question about DNS tunneling.
              </div>
              <button className="btn-primary" style={{ margin: '1.5rem auto 0', display: 'flex' }} onClick={newSession}>
                <Plus size={14} /> New Conversation
              </button>
            </div>
          )}

          {messages.map(m => <MessageBubble key={m.id} msg={m} onDelete={deleteMessage} />)}
          {sending && <TypingIndicator streamText={streamText} />}
          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', padding: '0.75rem', background: 'var(--color-danger)11', borderRadius: '0.5rem', border: '1px solid var(--color-danger)33' }}>
              ⚠ {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeSession && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <textarea
                className="input"
                rows={2}
                style={{ resize: 'none', flex: 1, fontFamily: 'inherit' }}
                placeholder="Type a domain (e.g. suspicious-site.net) or a question about DNS tunneling..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                disabled={sending}
              />
              <button className="btn-primary" onClick={sendMessage} disabled={!input.trim() || sending}
                style={{ padding: '0.75rem', aspectRatio: '1', justifyContent: 'center' }}>
                <Send size={16} />
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              Enter ↵ to send · Shift+Enter for new line · Domain names trigger live DNS + WHOIS + web search
            </div>
          </div>
        )}
      </div>

      <style>{`
        .session-actions { opacity: 0; }
        div:hover > div > .session-actions { opacity: 1; }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
