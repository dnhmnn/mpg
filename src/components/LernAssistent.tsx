import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { pb } from '../lib/pocketbase'

interface Quelle { titel: string; url: string }
interface Msg { role: 'user' | 'assistant'; content: string; quellen?: Quelle[] }

const VORSCHLAEGE = [
  'Erkläre mir das ABCDE-Schema',
  'Wie erkenne ich einen Schlaganfall? (FAST)',
  'Was bedeutet SAMPLER bei der Anamnese?',
  'Vorgehen bei Anaphylaxie?',
]

// ── Leichter Markdown-Renderer im LBF-Stil (fett, kursiv, Listen, Überschriften) ──
function inlineMd(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={`${keyPrefix}-b${i++}`} style={{ fontWeight: 700 }}>{m[1]}</strong>)
    else out.push(<em key={`${keyPrefix}-i${i++}`}>{m[2]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function renderMd(content: string): ReactNode {
  const lines = content.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let key = 0

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={`p${key++}`} style={{ margin: '0 0 10px', lineHeight: 1.65 }}>{inlineMd(para.join(' '), `p${key}`)}</p>)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const l = list
      blocks.push(
        <div key={`l${key++}`} style={{ margin: '2px 0 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {l.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 9, lineHeight: 1.55 }}>
              <span style={{ color: '#600812', fontWeight: 700, flexShrink: 0, minWidth: l.ordered ? 17 : 'auto' }}>
                {l.ordered ? `${idx + 1}.` : '–'}
              </span>
              <span>{inlineMd(item, `l${key}-${idx}`)}</span>
            </div>
          ))}
        </div>
      )
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    const h = line.match(/^#{1,4}\s+(.*)/)
    const ul = line.match(/^[-•*]\s+(.*)/)
    const ol = line.match(/^\d+[.)]\s+(.*)/)
    if (!line) { flushPara(); flushList(); continue }
    if (h) {
      flushPara(); flushList()
      blocks.push(
        <div key={`h${key++}`} style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '14px 0 7px' }}>
          {h[1].replace(/\*\*/g, '')}
        </div>
      )
    } else if (ul) {
      flushPara()
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] } }
      list.items.push(ul[1])
    } else if (ol) {
      flushPara()
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] } }
      list.items.push(ol[1])
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara(); flushList()
  return <div style={{ marginBottom: -10 }}>{blocks}</div>
}

function SparkleBadge({ size = 26 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="#fde8d8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/>
        <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/>
      </svg>
    </div>
  )
}

// Lern-Assistent (Mistral über /ki/chat) — Antworten primär auf Basis von
// Nerdfallmedizin & Notfallguru, Quellen werden unter der Antwort verlinkt.
export default function LernAssistent() {
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
      const res = await pb.send('/ki/chat', {
        method: 'POST',
        body: { messages: next.map(m => ({ role: m.role, content: m.content })) },
      }) as { success?: boolean; antwort?: string; quellen?: Quelle[]; error?: string }
      if (res?.success && res.antwort) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.antwort!, quellen: res.quellen || [] }])
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px - 76px - env(safe-area-inset-top) - env(safe-area-inset-bottom))', maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        @keyframes laMsgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes laDot { 0%, 60%, 100% { opacity: 0.25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        .la-msg { animation: laMsgIn 0.35s ease both; }
        .la-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #600812; margin-right: 4px; animation: laDot 1.2s infinite; }
        .la-dot:nth-child(2) { animation-delay: 0.15s; }
        .la-dot:nth-child(3) { animation-delay: 0.3s; }
        .la-chip { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .la-chip:active { transform: scale(0.98); }
        .la-send { transition: opacity 0.15s, transform 0.12s; }
        .la-send:active { transform: scale(0.94); }
      `}</style>

      {/* Verlauf */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {messages.length === 0 && !loading && (
          <div style={{ marginTop: 'clamp(12px, 8vh, 64px)', textAlign: 'center' }} className="la-msg">
            <div style={{ display: 'inline-flex', marginBottom: 16 }}><SparkleBadge size={58} /></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>Lern-Assistent</div>
            <div style={{ fontStyle: 'italic', fontWeight: 800, fontSize: 26, color: 'var(--lbf-text)', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Was möchtest du lernen?
            </div>
            <div style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--warm-gray)', maxWidth: 340, margin: '0 auto 26px', lineHeight: 1.6 }}>
              Antworten auf Basis von Nerdfallmedizin & Notfallguru — für Lernzwecke, ersetzt keine SAA oder ärztliche Entscheidung.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400, margin: '0 auto' }}>
              {VORSCHLAEGE.map(v => (
                <button key={v} onClick={() => send(v)} className="la-chip"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '0.5px solid rgba(96,8,18,0.14)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', textAlign: 'left' }}>
                  <span style={{ fontStyle: 'italic' }}>{v}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} className="la-msg" style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
            <div style={{ background: '#600812', color: '#fde8d8', borderRadius: '16px 16px 5px 16px', padding: '11px 16px', fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', boxShadow: '0 2px 8px rgba(96,8,18,0.18)' }}>
              {m.content}
            </div>
          </div>
        ) : (
          <div key={i} className="la-msg" style={{ alignSelf: 'stretch' }}>
            <div style={{ background: 'var(--lbf-card)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 16px 9px', borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
                <SparkleBadge size={22} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Assistent</span>
              </div>
              <div style={{ padding: '14px 18px 16px', fontSize: 14.5, color: 'var(--lbf-text)' }}>
                {renderMd(m.content)}
              </div>
              {(m.quellen?.length ?? 0) > 0 && (
                <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '10px 18px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 6 }}>Quellen</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {m.quellen!.map(q => (
                      <a key={q.url} href={q.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontStyle: 'italic', fontWeight: 600, color: '#600812', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        {q.titel || q.url.replace(/^https?:\/\//, '').slice(0, 60)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="la-msg" style={{ alignSelf: 'stretch' }}>
            <div style={{ background: 'var(--lbf-card)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <SparkleBadge size={22} />
              <span><span className="la-dot" /><span className="la-dot" /><span className="la-dot" /></span>
              <span style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--warm-gray)' }}>liest Nerdfallmedizin & Notfallguru…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="la-msg" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '11px 14px', borderRadius: 12, fontSize: 12.5 }}>{error}</div>
        )}
      </div>

      {/* Eingabe */}
      <div style={{ padding: '8px 14px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--lbf-card)', border: '0.5px solid rgba(96,8,18,0.14)', borderRadius: 16, padding: '6px 6px 6px 18px', boxShadow: '0 2px 12px rgba(96,8,18,0.07)' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="Frag den Assistenten…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--lbf-text)', fontSize: 15, fontFamily: 'inherit', padding: '8px 0' }}
          />
          {messages.length > 0 && !loading && (
            <button onClick={() => { setMessages([]); setError('') }} title="Neues Gespräch"
              style={{ border: 'none', background: 'transparent', color: 'var(--warm-gray)', cursor: 'pointer', padding: 8, display: 'flex', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            </button>
          )}
          <button onClick={() => send()} disabled={loading || !input.trim()} className="la-send"
            style={{ width: 40, height: 40, borderRadius: 13, border: 'none', background: loading || !input.trim() ? 'rgba(96,8,18,0.18)' : '#600812', color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 7, opacity: 0.8 }}>
          Für Lernzwecke · ersetzt keine SAA oder ärztliche Entscheidung
        </div>
      </div>
    </div>
  )
}
