import { useState, useMemo } from 'react'

// Artikel-Leseansicht im Nachschlagewerk-Stil (AMBOSS-Prinzip):
// '## Überschrift'  -> auf-/zuklappbarer Abschnitt
// '!!! cave <Text>'  -> rote Warn-Box       (bis zur Leerzeile)
// '!!! merke <Text>' -> Merke-Box (amber)
// '!!! tipp <Text>'  -> Tipp-Box (grün)
// '- <Text>'         -> Aufzählung, **fett**, *kursiv*

type BoxTyp = 'cave' | 'merke' | 'tipp'
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'box'; typ: BoxTyp; text: string }
interface Sektion { titel: string; blocks: Block[] }

const BOX_STYLE: Record<BoxTyp, { label: string; color: string; bg: string }> = {
  cave: { label: 'Cave', color: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
  merke: { label: 'Merke', color: '#d97706', bg: 'rgba(217,119,6,0.07)' },
  tipp: { label: 'Tipp', color: '#16a34a', bg: 'rgba(22,163,74,0.06)' },
}

function parseInhalt(inhalt: string): { intro: Block[]; sektionen: Sektion[] } {
  const intro: Block[] = []
  const sektionen: Sektion[] = []
  let blocks = intro
  let para: string[] = []
  let list: string[] = []
  let box: { typ: BoxTyp; lines: string[] } | null = null

  const flush = () => {
    if (box) { blocks.push({ kind: 'box', typ: box.typ, text: box.lines.join(' ').trim() }); box = null }
    if (list.length) { blocks.push({ kind: 'list', items: list }); list = [] }
    if (para.length) { const t = para.join(' ').trim(); if (t) blocks.push({ kind: 'p', text: t }); para = [] }
  }

  for (const raw of (inhalt || '').split('\n')) {
    const line = raw.trimEnd()
    const t = line.trim()
    const h = t.match(/^#{2,3}\s+(.+)$/)
    if (h) { flush(); sektionen.push({ titel: h[1].trim(), blocks: [] }); blocks = sektionen[sektionen.length - 1].blocks; continue }
    const b = t.match(/^!!!\s*(cave|merke|tipp)\b[:\s]*(.*)$/i)
    if (b) { flush(); box = { typ: b[1].toLowerCase() as BoxTyp, lines: b[2] ? [b[2]] : [] }; continue }
    if (!t) { flush(); continue }
    if (box) { box.lines.push(t); continue }
    if (/^[-•*]\s+/.test(t)) { if (para.length) flush(); list.push(t.replace(/^[-•*]\s+/, '')); continue }
    if (list.length) flush()
    para.push(t)
  }
  flush()
  return { intro, sektionen }
}

function Inline({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g), [text])
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <b key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</b>
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <i key={i}>{p.slice(1, -1)}</i>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((bl, i) => {
        if (bl.kind === 'p') return <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--lbf-text)', margin: '0 0 10px' }}><Inline text={bl.text} /></p>
        if (bl.kind === 'list') return (
          <ul key={i} style={{ margin: '0 0 10px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {bl.items.map((it, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--lbf-text)' }}><Inline text={it} /></li>)}
          </ul>
        )
        const s = BOX_STYLE[bl.typ]
        return (
          <div key={i} style={{ borderLeft: `3px solid ${s.color}`, background: s.bg, borderRadius: '0 10px 10px 0', padding: '10px 13px', margin: '0 0 10px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--lbf-text)' }}><Inline text={bl.text} /></div>
          </div>
        )
      })}
    </>
  )
}

export default function WissenArtikelView({ titel, inhalt, tags, bildUrl, quelle, onEdit, onClose }: {
  titel: string
  inhalt: string
  tags: string[]
  bildUrl?: string
  quelle?: string
  onEdit?: () => void
  onClose: () => void
}) {
  const { intro, sektionen } = useMemo(() => parseInhalt(inhalt), [inhalt])
  // Erster Abschnitt offen, Rest zugeklappt — wie ein Nachschlagewerk
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]))
  const toggle = (i: number) => setOpen(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })
  const alleOffen = open.size >= sektionen.length && sektionen.length > 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--warm-bg)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 680, height: '94dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Kopf */}
        <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: '14px 18px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 4 }}>Wissensbasis</div>
              <div style={{ fontStyle: 'italic', fontWeight: 800, fontSize: 20, color: 'var(--lbf-text)', lineHeight: 1.25 }}>{titel || '(ohne Titel)'}</div>
              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {tags.map(t => <span key={t} style={{ fontStyle: 'italic', fontWeight: 700, color: '#600812', fontSize: 12 }}>#{t}</span>)}
                </div>
              )}
            </div>
            {onEdit && (
              <button onClick={onEdit} style={{ border: '1px solid rgba(96,8,18,0.25)', background: 'transparent', color: '#600812', borderRadius: 9, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Bearbeiten</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Inhalt */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px calc(24px + env(safe-area-inset-bottom))' }}>
          {bildUrl && (
            <img src={bildUrl} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 14 }} />
          )}

          {intro.length > 0 && (
            <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '14px 16px 6px', marginBottom: 12 }}>
              <Blocks blocks={intro} />
            </div>
          )}

          {sektionen.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setOpen(alleOffen ? new Set() : new Set(sektionen.map((_, i) => i)))}
                style={{ background: 'none', border: 'none', color: '#600812', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                {alleOffen ? 'Alle zuklappen' : 'Alle aufklappen'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sektionen.map((s, i) => {
              const isOpen = open.has(i)
              return (
                <div key={i} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  <button onClick={() => toggle(i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: '#600812' }}>{s.titel}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '2px 16px 8px', borderTop: '0.5px solid rgba(96,8,18,0.08)' }}>
                      <div style={{ paddingTop: 10 }}><Blocks blocks={s.blocks} /></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {quelle && (
            <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 14, textAlign: 'center' }}>Quelle: {quelle}</div>
          )}
        </div>
      </div>
    </div>
  )
}
