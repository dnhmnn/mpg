import { useState, useEffect, useMemo } from 'react'
import { pb } from '../lib/pocketbase'
import WissenArtikelView from './WissenArtikelView'
import { WISSEN_KATEGORIEN, kategorieOrDefault } from '../lib/wissenKategorien'

// Nachschlagewerk-Regal in der Lernbar-Bibliothek: Wissensbasis-Artikel als
// helle Elfenbein-Bände mit rotem Rücken — bewusst anders als die dunklen
// Lernbücher. Wird über die Bibliothek-Suche/-Tags mitgefiltert. Nur lesen.

interface Artikel {
  id: string
  collectionId: string
  titel: string
  inhalt: string
  tags: string | string[]
  bild?: string
  quelle?: string
  kategorie?: string
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

export default function WissenBibliothek({ organizationId, search, activeTag }: {
  organizationId: string
  search: string
  activeTag: string | null
}) {
  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [viewing, setViewing] = useState<Artikel | null>(null)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    ;(async () => {
      try {
        const list = await pb.collection('wissen').getFullList<Artikel>({
          filter: `organization_id = "${organizationId}"`, sort: 'titel', requestKey: `wissen-lib-${Date.now()}`,
        })
        if (!cancelled) setArtikel(list)
      } catch { if (!cancelled) setArtikel([]) }
    })()
    return () => { cancelled = true }
  }, [organizationId])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    return artikel.filter(a => {
      if (activeTag && !parseTags(a.tags).some(t => t.toLowerCase() === activeTag.toLowerCase())) return false
      if (!q) return true
      return a.titel.toLowerCase().includes(q) || a.inhalt.toLowerCase().includes(q) || parseTags(a.tags).some(t => t.toLowerCase().includes(q))
    })
  }, [artikel, search, activeTag])

  const gruppen = useMemo(() =>
    WISSEN_KATEGORIEN
      .map(k => ({ name: k, items: filtered.filter(a => kategorieOrDefault(a.kategorie) === k) }))
      .filter(g => g.items.length > 0),
  [filtered])

  if (filtered.length === 0) return null

  const renderBand = (a: Artikel) => {
          const tags = parseTags(a.tags)
          const bild = fileUrl(a)
          return (
            <div key={a.id} onClick={() => setViewing(a)} style={{
              cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
              aspectRatio: '3/4', position: 'relative',
              background: 'linear-gradient(165deg, #fdf8f0 0%, #f0e3cf 100%)',
              boxShadow: '3px 5px 18px rgba(0,0,0,0.22), inset -3px 0 8px rgba(0,0,0,0.08)',
              border: '0.5px solid rgba(96,8,18,0.12)',
            }}>
              {/* Roter Buchrücken */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: '#600812', zIndex: 3 }} />
              {/* Kleines Abbildungs-Fenster wie bei Fachbänden */}
              {bild && (
                <div style={{ position: 'absolute', top: 12, left: 18, right: 10, height: '34%', borderRadius: 6, overflow: 'hidden', border: '0.5px solid rgba(96,8,18,0.15)', background: '#fff' }}>
                  <img src={bild} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} />
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 10px 12px 18px' }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(96,8,18,0.55)', marginBottom: 5 }}>Wissen</div>
                <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: '#600812', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const } as React.CSSProperties}>
                  {a.titel || '(ohne Titel)'}
                </div>
                {tags.length > 0 && (
                  <div style={{ fontSize: 9, color: 'rgba(96,8,18,0.5)', fontStyle: 'italic', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tags.slice(0, 3).map(t => `#${t}`).join(' ')}
                  </div>
                )}
              </div>
            </div>
          )
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
        Nachschlagewerk
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {gruppen.map(g => (
          <div key={g.name}>
            {/* Fachgebiets-Überschrift — übergeordnete Struktur wie in einem Nachschlagewerk */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <div style={{ fontStyle: 'italic', fontWeight: 800, fontSize: 14, color: 'var(--lbf-text)' }}>{g.name}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)' }}>{g.items.length}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {g.items.map(renderBand)}
            </div>
          </div>
        ))}
      </div>

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
