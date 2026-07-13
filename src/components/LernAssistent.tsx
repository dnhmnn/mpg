import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { pb } from '../lib/pocketbase'

interface Quelle { titel: string; url: string }
interface Msg { role: 'user' | 'assistant'; content: string; quellen?: Quelle[] }

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
      blocks.push(<p key={`p${key++}`} style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{inlineMd(para.join(' '), `p${key}`)}</p>)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const l = list
      blocks.push(
        <div key={`l${key++}`} style={{ margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {l.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, lineHeight: 1.55 }}>
              <span style={{ color: '#600812', fontWeight: 700, flexShrink: 0, minWidth: l.ordered ? 16 : 'auto' }}>
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
        <div key={`h${key++}`} style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '12px 0 6px' }}>
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
  return <div style={{ marginBottom: -8 }}>{blocks}</div>
}

const VORSCHLAEGE = [
  'Erkläre mir das ABCDE-Schema',
  'Wie erkenne ich einen Schlaganfall? (FAST)',
  'Was bedeutet SAMPLER bei der Anamnese?',
  'Vorgehen bei Anaphylaxie?',
]

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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px - 76px - env(safe-area-inset-top) - env(safe-area-inset-bottom))', maxWidth: 600, margin: '0 auto' }}>

      {/* Kopf */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Lern-Assistent</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
            Antworten primär auf Basis von Nerdfallmedizin & Notfallguru — für Lernzwecke, ersetzt keine SAA/ärztliche Entscheidung.
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setError('') }} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Neu</button>
        )}
      </div>

      {/* Verlauf */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(96,8,18,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/>
                  <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/>
                </svg>
              </div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>
                Frag mich etwas zu medizinischen oder einsatztaktischen Themen.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {VORSCHLAEGE.map(v => (
                <button key={v} onClick={() => send(v)} style={{ border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: '#600812', borderRadius: 999, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontStyle: 'italic' }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            <div style={{
              background: m.role === 'user' ? '#600812' : 'var(--lbf-card)',
              color: m.role === 'user' ? '#fde8d8' : 'var(--lbf-text)',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              boxShadow: m.role === 'assistant' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
              borderLeft: m.role === 'assistant' ? '3px solid #600812' : 'none',
              padding: m.role === 'assistant' ? '12px 16px' : '10px 14px',
              fontSize: 14, lineHeight: 1.6,
              whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
            }}>
              {m.role === 'assistant' ? renderMd(m.content) : m.content}
            </div>
            {m.role === 'assistant' && (m.quellen?.length ?? 0) > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Quellen</span>
                {m.quellen!.map(q => (
                  <a key={q.url} href={q.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontStyle: 'italic', color: '#600812', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    {q.titel || q.url.replace(/^https?:\/\//, '').slice(0, 60)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', padding: '6px 4px' }}>
            sucht in Nerdfallmedizin & Notfallguru…
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 12px', borderRadius: 10, fontSize: 12 }}>{error}</div>
        )}
      </div>

      {/* Eingabe */}
      <div style={{ padding: '8px 14px 10px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Deine Frage…"
          style={{ flex: 1, padding: '12px 15px', borderRadius: 999, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: loading || !input.trim() ? 'rgba(96,8,18,0.25)' : '#600812', color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )
}
