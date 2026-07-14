import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { pb } from '../lib/pocketbase'

interface Buchung { item_id: string; name: string; unit: string; type: 'ein' | 'aus'; menge: number; mhd: string; charge: string }
interface Props {
  onClose: () => void
  onExecuteBookings: (b: Buchung[]) => Promise<void>
}

// ── kleiner Markdown-Renderer (LBF) ──
function inlineMd(text: string, k: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={`${k}b${i++}`} style={{ fontWeight: 700 }}>{m[1]}</strong>)
    else out.push(<em key={`${k}i${i++}`}>{m[2]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
function renderMd(content: string): ReactNode {
  const lines = content.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = [], list: string[] | null = null, ordered = false, key = 0
  const flushP = () => { if (para.length) { blocks.push(<p key={`p${key++}`} style={{ margin: '0 0 9px', lineHeight: 1.6 }}>{inlineMd(para.join(' '), `p${key}`)}</p>); para = [] } }
  const flushL = () => { if (list) { const l = list, ord = ordered; blocks.push(<div key={`l${key++}`} style={{ margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>{l.map((it, idx) => <div key={idx} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}><span style={{ color: '#600812', fontWeight: 700, flexShrink: 0 }}>{ord ? `${idx + 1}.` : '–'}</span><span>{inlineMd(it, `l${key}-${idx}`)}</span></div>)}</div>); list = null } }
  for (const raw of lines) {
    const line = raw.trim()
    const h = line.match(/^#{1,4}\s+(.*)/), ul = line.match(/^[-•*]\s+(.*)/), ol = line.match(/^\d+[.)]\s+(.*)/)
    if (!line) { flushP(); flushL(); continue }
    if (h) { flushP(); flushL(); blocks.push(<div key={`h${key++}`} style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '12px 0 6px' }}>{h[1].replace(/\*\*/g, '')}</div>) }
    else if (ul) { flushP(); if (!list || ordered) { flushL(); list = []; ordered = false } list.push(ul[1]) }
    else if (ol) { flushP(); if (!list || !ordered) { flushL(); list = []; ordered = true } list.push(ol[1]) }
    else { flushL(); para.push(line) }
  }
  flushP(); flushL()
  return <div style={{ marginBottom: -9 }}>{blocks}</div>
}

const FRAGE_CHIPS = ['Was soll ich bestellen?', 'Was läuft in 30 Tagen ab?', 'Was verbrauchen wir am meisten?', 'Wo ist wenig Bestand?']

export default function LagerAssistent({ onClose, onExecuteBookings }: Props) {
  const [modus, setModus] = useState<'fragen' | 'buchen'>('fragen')

  // Fragen
  const [frage, setFrage] = useState('')
  const [antwort, setAntwort] = useState('')
  const [loadingF, setLoadingF] = useState(false)
  const [errF, setErrF] = useState('')
  const antRef = useRef<HTMLDivElement>(null)
  useEffect(() => { antRef.current?.scrollTo({ top: antRef.current.scrollHeight }) }, [antwort, loadingF])

  // Buchen
  const [text, setText] = useState('')
  const [buchungen, setBuchungen] = useState<Buchung[] | null>(null)
  const [loadingB, setLoadingB] = useState(false)
  const [errB, setErrB] = useState('')
  const [booking, setBooking] = useState(false)

  async function ask(q?: string) {
    const f = (q ?? frage).trim()
    if (!f || loadingF) return
    setFrage(f); setErrF(''); setLoadingF(true); setAntwort('')
    try {
      const res = await pb.send('/lager/assist', { method: 'POST', body: { frage: f } }) as { success?: boolean; antwort?: string; error?: string }
      if (res?.success && res.antwort) setAntwort(res.antwort)
      else setErrF(res?.error || 'Keine Antwort')
    } catch (e: any) { setErrF(e?.message || 'Assistent nicht erreichbar (Hook lager-assist.pb.js auf dem Server?)') }
    finally { setLoadingF(false) }
  }

  async function parse() {
    if (!text.trim() || loadingB) return
    setErrB(''); setLoadingB(true); setBuchungen(null)
    try {
      const res = await pb.send('/lager/parse-buchung', { method: 'POST', body: { text: text.trim() } }) as { success?: boolean; buchungen?: Buchung[]; error?: string }
      if (res?.success) setBuchungen(res.buchungen || [])
      else setErrB(res?.error || 'Konnte Text nicht verstehen')
    } catch (e: any) { setErrB(e?.message || 'Assistent nicht erreichbar') }
    finally { setLoadingB(false) }
  }

  async function execute() {
    if (!buchungen?.length || booking) return
    setBooking(true)
    try {
      await onExecuteBookings(buchungen)
      setText(''); setBuchungen(null)
      onClose()
    } catch (e: any) { setErrB('Fehler beim Buchen: ' + (e?.message || e)) }
    finally { setBooking(false) }
  }

  return (
    <div className="lager-modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="lager-modal" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fde8d8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></svg>
          </div>
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Lager-Assistent</div>
          <button onClick={onClose} style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Modus-Umschalter */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid rgba(96,8,18,0.1)' }}>
          {(['fragen', 'buchen'] as const).map(mo => (
            <button key={mo} onClick={() => setModus(mo)} style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', color: modus === mo ? '#600812' : 'var(--warm-gray)', borderBottom: modus === mo ? '2px solid #600812' : '2px solid transparent', marginBottom: -2 }}>
              {mo === 'fragen' ? 'Fragen' : 'Schnell buchen'}
            </button>
          ))}
        </div>

        {modus === 'fragen' ? (
          <>
            <div ref={antRef} style={{ flex: 1, overflowY: 'auto', minHeight: 120, marginBottom: 12 }}>
              {loadingF ? (
                <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', padding: '8px 2px' }}>schaut ins Lager…</div>
              ) : antwort ? (
                <div style={{ background: 'var(--lbf-card)', border: '1px solid rgba(96,8,18,0.1)', borderLeft: '3px solid #600812', borderRadius: 12, padding: '13px 16px', fontSize: 14, color: 'var(--lbf-text)' }}>{renderMd(antwort)}</div>
              ) : errF ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '11px 14px', borderRadius: 10, fontSize: 13 }}>{errF}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  {FRAGE_CHIPS.map(c => (
                    <button key={c} onClick={() => ask(c)} style={{ textAlign: 'left', border: '1px solid rgba(96,8,18,0.15)', background: 'rgba(96,8,18,0.03)', color: '#600812', borderRadius: 999, padding: '10px 15px', fontSize: 13, fontWeight: 600, fontStyle: 'italic', cursor: 'pointer', fontFamily: 'inherit' }}>{c}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="lager-input" style={{ flex: 1 }} value={frage} onChange={e => setFrage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask() }} placeholder="Frag dein Lager…" />
              <button className="lager-btn primary" onClick={() => ask()} disabled={loadingF || !frage.trim()}>Fragen</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 8 }}>
              Schreib in normaler Sprache, was gebucht werden soll — z.B. „50 Einmalhandschuhe M eingebucht, Charge L123, läuft 2027 ab".
            </div>
            <textarea className="lager-input" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="z.B. 2 Beatmungsbeutel entnommen und 500 Kompressen geliefert, Charge 88A" style={{ resize: 'vertical', marginBottom: 10 }} />
            <button className="lager-btn primary" style={{ width: '100%', marginBottom: 12 }} onClick={parse} disabled={loadingB || !text.trim()}>{loadingB ? 'Verstehe…' : 'Buchung erkennen'}</button>

            {errB && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '11px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{errB}</div>}

            {buchungen && (buchungen.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Kein passender Artikel erkannt — Namen wie im Lager verwenden.</div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Erkannt — bitte prüfen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
                  {buchungen.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 10, borderLeft: `3px solid ${b.type === 'ein' ? '#16a34a' : '#dc2626'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{b.name}</div>
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                          {b.type === 'ein' ? 'Einbuchen' : 'Ausbuchen'} · {b.menge} {b.unit}
                          {b.charge ? ` · Charge ${b.charge}` : ''}{b.mhd ? ` · MHD ${b.mhd}` : ''}
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 16, color: b.type === 'ein' ? '#16a34a' : '#dc2626' }}>{b.type === 'ein' ? '+' : '−'}{b.menge}</span>
                    </div>
                  ))}
                </div>
                <button className="lager-btn primary" style={{ width: '100%' }} onClick={execute} disabled={booking}>{booking ? 'Buche…' : `${buchungen.length} Buchung${buchungen.length > 1 ? 'en' : ''} ausführen`}</button>
              </>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
