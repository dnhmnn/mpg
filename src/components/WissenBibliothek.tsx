import { useState, useEffect, useMemo } from 'react'
import { pb } from '../lib/pocketbase'
import WissenArtikelView from './WissenArtikelView'

// Nachschlagewerk für Mitglieder (Lernbar-Tab "Wissen"):
// durchsuchbare Wissensbasis-Artikel im AMBOSS-Prinzip — nur lesen, kein Bearbeiten.

interface Artikel {
  id: string
  collectionId: string
  titel: string
  inhalt: string
  tags: string | string[]
  bild?: string
  quelle?: string
  organization_id: string
  updated: string
}

function fileUrl(a: Artikel): string {
  return a.bild ? `${(pb as any).baseURL || (pb as any).baseUrl}/api/files/${a.collectionId}/${a.id}/${a.bild}` : ''
}
function parseTags(v: string | string[]): string[] {
  if (Array.isArray(v)) return v
  if (!v) return []
  try { const p = JSON.parse(v); if (Array.isArray(p)) return p } catch { /* kein JSON */ }
  return String(v).split(',').map(t => t.trim()).filter(Boolean)
}
function previewText(inhalt: string): string {
  return (inhalt || '').replace(/^#{2,3}\s+/gm, '').replace(/^!!!\s*\w+[:\s]*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
}

export default function WissenBibliothek({ organizationId }: { organizationId: string }) {
  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [viewing, setViewing] = useState<Artikel | null>(null)

  useEffect(() => {
    if (!organizationId) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const list = await pb.collection('wissen').getFullList<Artikel>({
          filter: `organization_id = "${organizationId}"`, sort: 'titel', requestKey: `wissen-lib-${Date.now()}`,
        })
        if (!cancelled) setArtikel(list)
      } catch { if (!cancelled) setArtikel([]) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [organizationId])

  const topTags = useMemo(() => {
    const count = new Map<string, number>()
    for (const a of artikel) for (const t of parseTags(a.tags)) count.set(t, (count.get(t) || 0) + 1)
    return [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(e => e[0])
  }, [artikel])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return artikel.filter(a => {
      if (tagFilter && !parseTags(a.tags).some(t => t.toLowerCase() === tagFilter.toLowerCase())) return false
      if (!q) return true
      return a.titel.toLowerCase().includes(q) || a.inhalt.toLowerCase().includes(q) || parseTags(a.tags).some(t => t.toLowerCase().includes(q))
    })
  }, [artikel, search, tagFilter])

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Nachschlagewerk</div>
      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
        Geprüfte Wissensbasis eurer Organisation — dieselbe Grundlage, aus der der Assistent antwortet.
      </div>

      <input type="text" placeholder="Wissen durchsuchen…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />

      {topTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {topTags.map(t => {
            const active = tagFilter.toLowerCase() === t.toLowerCase()
            return (
              <button key={t} onClick={() => setTagFilter(active ? '' : t)}
                style={{ border: `1px solid ${active ? '#600812' : 'rgba(96,8,18,0.2)'}`, background: active ? '#600812' : 'transparent', color: active ? '#fff' : '#600812', borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 700, fontStyle: 'italic', cursor: 'pointer', fontFamily: 'inherit' }}>
                #{t}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--lbf-card)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>{artikel.length === 0 ? 'Noch keine Einträge' : 'Kein Treffer'}</div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>
            {artikel.length === 0 ? 'Die Wissensbasis wird gerade aufgebaut.' : 'Suchbegriff oder Filter anpassen.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(a => (
            <div key={a.id} onClick={() => setViewing(a)} style={{ display: 'flex', gap: 12, background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #600812', padding: '12px 14px', cursor: 'pointer' }}>
              {fileUrl(a) && <img src={fileUrl(a)} alt="" style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff', border: '0.5px solid rgba(96,8,18,0.1)' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{a.titel || '(ohne Titel)'}</div>
                <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewText(a.inhalt)}</div>
                {parseTags(a.tags).length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {parseTags(a.tags).slice(0, 5).map(t => <span key={t} style={{ fontStyle: 'italic', fontWeight: 700, color: '#600812', fontSize: 12 }}>#{t}</span>)}
                  </div>
                )}
              </div>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warm-gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ alignSelf: 'center', flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <WissenArtikelView
          titel={viewing.titel}
          inhalt={viewing.inhalt}
          tags={parseTags(viewing.tags)}
          bildUrl={fileUrl(viewing) || undefined}
          quelle={viewing.quelle || undefined}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
