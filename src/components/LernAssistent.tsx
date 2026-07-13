import { useState, useRef, useEffect } from 'react'
import { pb } from '../lib/pocketbase'

interface Msg { role: 'user' | 'assistant'; content: string }

const VORSCHLAEGE = [
  'Erkläre mir das ABCDE-Schema',
  'Wie erkenne ich einen Schlaganfall? (FAST)',
  'Was bedeutet SAMPLER bei der Anamnese?',
]

// Schwebender Lern-Assistent (Mistral, serverseitig über /ki/chat) für die Lernbar
export default function LernAssistent() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const frage = (text ?? input).trim()
    if (!frage || loading) return
    setError('')
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content: frage }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await pb.send('/ki/chat', { method: 'POST', body: { messages: next } }) as { success?: boolean; antwort?: string; error?: string }
      if (res?.success && res.antwort) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.antwort! }])
      } else {
        setError(res?.error || 'Keine Antwort erhalten')
      }
    } catch (e: any) {
      setError(e?.message || 'Assistent nicht erreichbar (Hook ki-assist.pb.js auf dem Server?)')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        title="Lern-Assistent"
        style={{
          position: 'fixed', right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 200,
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#600812', color: '#fde8d8', boxShadow: '0 4px 16px rgba(96,8,18,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/>
          <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/>
        </svg>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--lbf-card)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 560, height: 'min(78dvh, 640px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Kopf */}
            <div style={{ padding: '16px 18px 12px', borderBottom: '0.5px solid rgba(96,8,18,0.1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Lern-Assistent</div>
                <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                  Für Lern- und Ausbildungszwecke — ersetzt keine SAA/ärztliche Entscheidung.
                </div>
              </div>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setError('') }} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Neu</button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Verlauf */}
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', textAlign: 'center', marginBottom: 14 }}>
                    Frag mich etwas zu medizinischen oder einsatztaktischen Themen.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {VORSCHLAEGE.map(v => (
                      <button key={v} onClick={() => send(v)} style={{ border: '1px solid rgba(96,8,18,0.15)', background: 'rgba(96,8,18,0.03)', color: '#600812', borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontStyle: 'italic' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#600812' : 'rgba(96,8,18,0.05)',
                  color: m.role === 'user' ? '#fde8d8' : 'var(--lbf-text)',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '10px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              ))}
              {loading && (
                <div style={{ alignSelf: 'flex-start', fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', padding: '6px 4px' }}>denkt nach…</div>
              )}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 12px', borderRadius: 10, fontSize: 12 }}>{error}</div>
              )}
            </div>

            {/* Eingabe */}
            <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', borderTop: '0.5px solid rgba(96,8,18,0.1)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder="Deine Frage…"
                style={{ flex: 1, padding: '11px 14px', borderRadius: 999, border: '1px solid rgba(96,8,18,0.15)', background: 'transparent', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: loading || !input.trim() ? 'rgba(96,8,18,0.25)' : '#600812', color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
