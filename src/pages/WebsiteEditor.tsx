import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import LandingRenderer from '../components/LandingRenderer'
import {
  DEFAULT_DESIGN, DEF_NAV, SECTION_LABEL, defaultHomeSections, newSection, uid,
  type Btn, type Design, type GlobalSettings, type PageRec, type Section, type SectionType, type Tier,
} from '../lib/landingSchema'

const RED = '#600812'
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const btn: React.CSSProperties = { border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: RED, borderRadius: 9, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const btnP: React.CSSProperties = { ...btn, background: RED, color: '#fff', border: 'none' }
const card: React.CSSProperties = { background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 14, marginBottom: 10 }

function Field({ label, value, onChange, textarea, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lbl}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />}
      {hint && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

export default function WebsiteEditor() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'seiten' | 'design' | 'global' | 'medien'>('seiten')
  const [pages, setPages] = useState<PageRec[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [global, setGlobal] = useState<GlobalSettings>({})
  const [media, setMedia] = useState<{ id: string; url: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [openSec, setOpenSec] = useState<string>('')
  const [showPreview, setShowPreview] = useState(true)
  const [picker, setPicker] = useState<((url: string) => void) | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!authLoading && user && !user.supervisor) navigate('/hub') }, [authLoading, user, navigate])
  useEffect(() => { if (user) load() }, [user])

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function load() {
    setLoading(true)
    try {
      const g = await pb.collection('landing_content').getFullList({ sort: '-created' }).catch(() => [])
      const gRec = (g[0] || {}) as any
      setGlobal(gRec)
      let list: PageRec[] = []
      try {
        const recs = await pb.collection('landing_pages').getFullList({ sort: 'sort' })
        list = recs.map((r: any) => ({ ...r, sections: Array.isArray(r.sections) ? r.sections : [] }))
      } catch { list = [] }
      if (list.length === 0) {
        // Startseite aus dem bisherigen Inhalt vorbelegen — sieht aus wie die Live-Seite
        list = [{ slug: '', title: 'Startseite', sections: defaultHomeSections(gRec), published: true, in_nav: false, sort: 0 }]
      }
      setPages(list)
      setActiveId(list[0].id || 'neu')
      try {
        const m = await pb.collection('landing_media').getFullList({ sort: '-created' })
        setMedia(m.map((r: any) => ({ id: r.id, name: r.name || r.bild, url: `${(pb as any).baseURL}/api/files/${r.collectionId}/${r.id}/${r.bild}` })))
      } catch { setMedia([]) }
    } finally { setLoading(false) }
  }

  const active = pages.find(p => (p.id || 'neu') === activeId) || pages[0]

  function patchPage(patch: Partial<PageRec>) {
    setPages(prev => prev.map(p => (p.id || 'neu') === activeId ? { ...p, ...patch } : p))
  }
  function patchSection(sid: string, patch: Partial<Section>) {
    if (!active) return
    patchPage({ sections: active.sections.map(s => s.id === sid ? { ...s, ...patch } : s) })
  }
  function moveSection(sid: string, dir: -1 | 1) {
    if (!active) return
    const arr = [...active.sections]
    const i = arr.findIndex(s => s.id === sid)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    patchPage({ sections: arr })
  }

  async function savePage() {
    if (!active || saving) return
    setSaving(true)
    try {
      const data = {
        slug: (active.slug || '').replace(/^\/+|\/+$/g, ''),
        title: active.title, seo_title: active.seo_title || '', seo_description: active.seo_description || '',
        sections: active.sections, published: active.published !== false,
        in_nav: !!active.in_nav, sort: active.sort ?? 0,
      }
      if (active.id) await pb.collection('landing_pages').update(active.id, data)
      else {
        const rec = await pb.collection('landing_pages').create(data)
        patchPage({ id: (rec as any).id })
        setActiveId((rec as any).id)
      }
      flash('✅ Seite gespeichert')
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFehlt die Collection "landing_pages" in PocketBase?')
    } finally { setSaving(false) }
  }

  async function saveGlobal() {
    if (saving) return
    setSaving(true)
    try {
      const data = {
        nav_items: global.nav_items || DEF_NAV, contact_email: global.contact_email || '',
        design: global.design || {}, footer_copy: global.footer_copy || '',
        impressum: global.impressum || '', datenschutz: global.datenschutz || '',
      }
      const list = await pb.collection('landing_content').getFullList({ sort: '-created' })
      if (list.length) await pb.collection('landing_content').update(list[0].id, data)
      else await pb.collection('landing_content').create(data)
      flash('✅ Einstellungen gespeichert')
    } catch (e: any) { alert('Fehler: ' + e.message) } finally { setSaving(false) }
  }

  async function addPage() {
    const title = prompt('Titel der neuen Seite?', 'Über uns')
    if (!title) return
    const slug = prompt('URL-Pfad (ohne /)?', title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    if (slug === null) return
    const p: PageRec = { slug: slug.replace(/^\/+|\/+$/g, ''), title, sections: [newSection('hero')], published: true, in_nav: true, sort: pages.length }
    setPages(prev => [...prev, p]); setActiveId('neu')
  }
  async function deletePage() {
    if (!active) return
    if ((active.slug || '') === '') { alert('Die Startseite kann nicht gelöscht werden.'); return }
    if (!confirm(`Seite „${active.title}" wirklich löschen?`)) return
    try { if (active.id) await pb.collection('landing_pages').delete(active.id) } catch { /* egal */ }
    setPages(prev => prev.filter(p => (p.id || 'neu') !== activeId))
    setActiveId(pages[0]?.id || 'neu')
  }

  async function uploadImage(f: File | undefined) {
    if (!f) return
    try {
      const fd = new FormData()
      fd.append('bild', f); fd.append('name', f.name)
      const rec = await pb.collection('landing_media').create(fd) as any
      const url = `${(pb as any).baseURL}/api/files/${rec.collectionId}/${rec.id}/${rec.bild}`
      setMedia(prev => [{ id: rec.id, name: f.name, url }, ...prev])
      flash('✅ Bild hochgeladen')
      if (picker) { picker(url); setPicker(null) }
    } catch (e: any) {
      alert('Fehler beim Upload: ' + e.message + '\n\nFehlt die Collection "landing_media" (Felder: bild=File, name=Text)?')
    }
  }

  if (authLoading || loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade…</div>

  const design: Design = { ...DEFAULT_DESIGN, ...(global.design || {}) }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 200, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
        <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/supervisor')} style={{ border: 'none', background: 'none', color: RED, cursor: 'pointer', padding: 0, display: 'flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Website-Editor</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>responda.systems · nur Supervisor</div>
          </div>
          <button onClick={() => setShowPreview(v => !v)} style={btn}>{showPreview ? 'Vorschau aus' : 'Vorschau'}</button>
          <button onClick={tab === 'seiten' ? savePage : saveGlobal} disabled={saving} style={{ ...btnP, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 0, borderTop: '0.5px solid rgba(96,8,18,0.08)' }}>
          {([['seiten', 'Seiten'], ['design', 'Design'], ['global', 'Navigation & Recht'], ['medien', 'Medien']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: tab === k ? RED : 'var(--warm-gray)', borderBottom: tab === k ? `2px solid ${RED}` : '2px solid transparent' }}>{l}</button>
          ))}
        </div>
      </div>

      {msg && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: '#16a34a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14 }}>{msg}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, maxWidth: 1500, margin: '0 auto' }}>
        {/* ── Editor-Spalte ── */}
        <div style={{ flex: showPreview ? '0 0 46%' : '1 1 auto', minWidth: 0, maxWidth: showPreview ? '46%' : 820, margin: showPreview ? undefined : '0 auto' }}>

          {tab === 'seiten' && active && (
            <>
              {/* Seitenauswahl */}
              <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={activeId} onChange={e => { setActiveId(e.target.value); setOpenSec('') }} style={{ ...inp, flex: 1, minWidth: 150 }}>
                  {pages.map(p => <option key={p.id || 'neu'} value={p.id || 'neu'}>{p.title}{(p.slug || '') === '' ? ' (Start)' : ` · /${p.slug}`}</option>)}
                </select>
                <button onClick={addPage} style={btn}>+ Seite</button>
                <button onClick={deletePage} style={{ ...btn, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}>Löschen</button>
              </div>

              {/* Seiteneinstellungen */}
              <div style={card}>
                <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Seite</div>
                <Field label="Titel" value={active.title} onChange={v => patchPage({ title: v })} />
                <Field label="URL-Pfad" value={active.slug} onChange={v => patchPage({ slug: v })} placeholder="ueber-uns" hint={(active.slug || '') === '' ? 'Leer = Startseite (responda.systems)' : `responda.systems/${active.slug}`} />
                <Field label="SEO-Titel (Browser-Tab & Google)" value={active.seo_title || ''} onChange={v => patchPage({ seo_title: v })} />
                <Field label="SEO-Beschreibung" value={active.seo_description || ''} onChange={v => patchPage({ seo_description: v })} textarea />
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--lbf-text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={active.published !== false} onChange={e => patchPage({ published: e.target.checked })} style={{ width: 16, height: 16, accentColor: RED }} /> Veröffentlicht
                  </label>
                  {(active.slug || '') !== '' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--lbf-text)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!active.in_nav} onChange={e => patchPage({ in_nav: e.target.checked })} style={{ width: 16, height: 16, accentColor: RED }} /> In Navigation zeigen
                    </label>
                  )}
                </div>
              </div>

              {/* Sektionen */}
              <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '18px 0 8px' }}>Abschnitte ({active.sections.length})</div>
              {active.sections.map((s, i) => (
                <div key={s.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setOpenSec(openSec === s.id ? '' : s.id)} style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{SECTION_LABEL[s.type]}</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(s.heading || s.eyebrow || '(ohne Titel)').replace(/<[^>]+>/g, '')}</div>
                    </button>
                    <button onClick={() => moveSection(s.id, -1)} disabled={i === 0} style={{ ...btn, padding: '5px 8px', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                    <button onClick={() => moveSection(s.id, 1)} disabled={i === active.sections.length - 1} style={{ ...btn, padding: '5px 8px', opacity: i === active.sections.length - 1 ? 0.3 : 1 }}>↓</button>
                    <button onClick={() => { if (confirm('Abschnitt löschen?')) patchPage({ sections: active.sections.filter(x => x.id !== s.id) }) }} style={{ ...btn, padding: '5px 8px', color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}>×</button>
                  </div>

                  {openSec === s.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(96,8,18,0.1)' }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label style={lbl}>Hintergrund</label>
                          <select value={s.bg || 'warm'} onChange={e => patchSection(s.id, { bg: e.target.value as any })} style={inp}>
                            <option value="warm">Elfenbein</option><option value="white">Weiß</option><option value="dark">Dunkelrot</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={lbl}>Anker (für Navigation)</label>
                          <input value={s.anchor || ''} onChange={e => patchSection(s.id, { anchor: e.target.value })} placeholder="features" style={inp} />
                        </div>
                      </div>

                      {s.type !== 'image' && <Field label="Kleine Überschrift (Eyebrow)" value={s.eyebrow || ''} onChange={v => patchSection(s.id, { eyebrow: v })} />}
                      <Field label="Überschrift" value={s.heading || ''} onChange={v => patchSection(s.id, { heading: v })} hint="<em>Wort</em> färbt rot · <br> erzeugt Zeilenumbruch" />
                      {s.type !== 'image' && <Field label="Untertitel" value={s.sub || ''} onChange={v => patchSection(s.id, { sub: v })} textarea />}

                      {s.type === 'text' && <Field label="Text" value={s.body || ''} onChange={v => patchSection(s.id, { body: v })} textarea />}

                      {(s.type === 'hero' || s.type === 'cta') && (
                        <>
                          <label style={lbl}>Buttons</label>
                          {(s.buttons || []).map((b, bi) => (
                            <div key={bi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <input value={b.label} onChange={e => patchSection(s.id, { buttons: s.buttons!.map((x, k) => k === bi ? { ...x, label: e.target.value } : x) })} placeholder="Beschriftung" style={{ ...inp, flex: 1 }} />
                              <input value={b.href} onChange={e => patchSection(s.id, { buttons: s.buttons!.map((x, k) => k === bi ? { ...x, href: e.target.value } : x) })} placeholder="#kontakt" style={{ ...inp, flex: 1 }} />
                              <select value={b.style} onChange={e => patchSection(s.id, { buttons: s.buttons!.map((x, k) => k === bi ? { ...x, style: e.target.value as Btn['style'] } : x) })} style={{ ...inp, width: 90 }}>
                                <option value="cream">Creme</option><option value="ghost">Umriss</option><option value="primary">Rot</option>
                              </select>
                              <button onClick={() => patchSection(s.id, { buttons: s.buttons!.filter((_, k) => k !== bi) })} style={{ ...btn, color: '#dc2626', padding: '5px 9px' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => patchSection(s.id, { buttons: [...(s.buttons || []), { label: 'Button', href: '#', style: 'cream' }] })} style={{ ...btn, marginBottom: 10 }}>+ Button</button>
                        </>
                      )}

                      {s.type === 'hero' && (
                        <>
                          <Field label="Badges (kommagetrennt)" value={(s.badges || []).join(', ')} onChange={v => patchSection(s.id, { badges: v.split(',').map(x => x.trim()).filter(Boolean) })} />
                          <label style={lbl}>Hintergrundbild (optional)</label>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            <input value={s.image || ''} onChange={e => patchSection(s.id, { image: e.target.value })} placeholder="Bild-URL" style={{ ...inp, flex: 1 }} />
                            <button onClick={() => { setPicker(() => (url: string) => patchSection(s.id, { image: url })); setTab('medien') }} style={btn}>Wählen</button>
                          </div>
                        </>
                      )}

                      {s.type === 'image' && (
                        <>
                          <label style={lbl}>Bild</label>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            <input value={s.image || ''} onChange={e => patchSection(s.id, { image: e.target.value })} placeholder="Bild-URL" style={{ ...inp, flex: 1 }} />
                            <button onClick={() => { setPicker(() => (url: string) => patchSection(s.id, { image: url })); setTab('medien') }} style={btn}>Wählen</button>
                          </div>
                          <Field label="Bildunterschrift" value={s.caption || ''} onChange={v => patchSection(s.id, { caption: v })} />
                        </>
                      )}

                      {s.type === 'contact' && <Field label="E-Mail für Anfragen" value={s.email || ''} onChange={v => patchSection(s.id, { email: v })} />}

                      {s.type === 'cards' && (
                        <>
                          <label style={lbl}>Darstellung</label>
                          <select value={s.variant || 'feature'} onChange={e => patchSection(s.id, { variant: e.target.value as any })} style={{ ...inp, marginBottom: 10 }}>
                            <option value="feature">Weiße Karten mit Icon</option>
                            <option value="audience">Schlichte Karten mit rotem Balken</option>
                          </select>
                          {(s.items || []).map((it, ii) => (
                            <div key={ii} style={{ background: 'rgba(96,8,18,0.03)', borderRadius: 9, padding: 10, marginBottom: 8 }}>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                <input value={it.title} onChange={e => patchSection(s.id, { items: s.items!.map((x, k) => k === ii ? { ...x, title: e.target.value } : x) })} placeholder="Titel" style={{ ...inp, flex: 1, fontWeight: 700 }} />
                                <button onClick={() => patchSection(s.id, { items: s.items!.filter((_, k) => k !== ii) })} style={{ ...btn, color: '#dc2626', padding: '5px 9px' }}>×</button>
                              </div>
                              <textarea value={it.description} onChange={e => patchSection(s.id, { items: s.items!.map((x, k) => k === ii ? { ...x, description: e.target.value } : x) })} placeholder="Beschreibung" rows={2} style={{ ...inp, resize: 'vertical' }} />
                            </div>
                          ))}
                          <button onClick={() => patchSection(s.id, { items: [...(s.items || []), { title: '', description: '' }] })} style={btn}>+ Karte</button>
                        </>
                      )}

                      {s.type === 'pricing' && (
                        <>
                          {(s.tiers || []).map((t, ti) => {
                            const up = (patch: Partial<Tier>) => patchSection(s.id, { tiers: s.tiers!.map((x, k) => k === ti ? { ...x, ...patch } : x) })
                            return (
                              <div key={ti} style={{ background: 'rgba(96,8,18,0.03)', borderRadius: 9, padding: 10, marginBottom: 8 }}>
                                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                  <input value={t.name} onChange={e => up({ name: e.target.value })} placeholder="Name" style={{ ...inp, flex: 1, fontWeight: 700 }} />
                                  <input value={t.price} onChange={e => up({ price: e.target.value })} placeholder="49" style={{ ...inp, width: 90 }} />
                                  <button onClick={() => patchSection(s.id, { tiers: s.tiers!.filter((_, k) => k !== ti) })} style={{ ...btn, color: '#dc2626', padding: '5px 9px' }}>×</button>
                                </div>
                                <input value={t.period} onChange={e => up({ period: e.target.value })} placeholder="pro Monat · bis 25 Nutzer" style={{ ...inp, marginBottom: 6 }} />
                                <textarea value={(t.features || []).join('\n')} onChange={e => up({ features: e.target.value.split('\n').filter(Boolean) })} placeholder="Ein Merkmal pro Zeile" rows={4} style={{ ...inp, marginBottom: 6, resize: 'vertical' }} />
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input value={t.cta || ''} onChange={e => up({ cta: e.target.value })} placeholder="Jetzt anfragen" style={{ ...inp, flex: 1 }} />
                                  <input value={t.badge || ''} onChange={e => up({ badge: e.target.value })} placeholder="Empfohlen" style={{ ...inp, width: 110 }} />
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--lbf-text)', whiteSpace: 'nowrap' }}>
                                    <input type="checkbox" checked={!!t.featured} onChange={e => up({ featured: e.target.checked })} style={{ accentColor: RED }} /> Hervorheben
                                  </label>
                                </div>
                              </div>
                            )
                          })}
                          <button onClick={() => patchSection(s.id, { tiers: [...(s.tiers || []), { name: '', price: '', period: '', features: [''], cta: 'Jetzt anfragen' }] })} style={btn}>+ Paket</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ ...card, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(SECTION_LABEL) as SectionType[]).map(t => (
                  <button key={t} onClick={() => { const ns = newSection(t); patchPage({ sections: [...active.sections, ns] }); setOpenSec(ns.id) }} style={btn}>+ {SECTION_LABEL[t]}</button>
                ))}
              </div>
            </>
          )}

          {tab === 'design' && (
            <div style={card}>
              <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Farben & Form</div>
              {([['primary', 'Primärfarbe (Akzent)'], ['dark', 'Dunkler Hintergrund (Hero/Footer)'], ['text', 'Textfarbe'], ['gray', 'Sekundärtext'], ['bg', 'Seitenhintergrund'], ['white', 'Kartenfläche'], ['cream', 'Creme (Text auf Dunkel)']] as const).map(([k, l]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                  <input type="color" value={(design as any)[k]} onChange={e => setGlobal(g => ({ ...g, design: { ...(g.design || {}), [k]: e.target.value } }))} style={{ width: 42, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lbf-text)' }}>{l}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--warm-gray)' }}>{(design as any)[k]}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <label style={lbl}>Eckenrundung: {design.radius}px</label>
                <input type="range" min={0} max={28} value={design.radius} onChange={e => setGlobal(g => ({ ...g, design: { ...(g.design || {}), radius: Number(e.target.value) } }))} style={{ width: '100%', accentColor: RED }} />
              </div>
              <button onClick={() => setGlobal(g => ({ ...g, design: {} }))} style={{ ...btn, marginTop: 14 }}>Auf Standard zurücksetzen</button>
            </div>
          )}

          {tab === 'global' && (
            <>
              <div style={card}>
                <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Navigation</div>
                {(global.nav_items?.length ? global.nav_items : DEF_NAV).map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={n.label} onChange={e => setGlobal(g => { const a = [...(g.nav_items?.length ? g.nav_items : DEF_NAV)]; a[i] = { ...a[i], label: e.target.value }; return { ...g, nav_items: a } })} placeholder="Beschriftung" style={{ ...inp, flex: 1 }} />
                    <input value={n.href} onChange={e => setGlobal(g => { const a = [...(g.nav_items?.length ? g.nav_items : DEF_NAV)]; a[i] = { ...a[i], href: e.target.value }; return { ...g, nav_items: a } })} placeholder="#features oder /ueber-uns" style={{ ...inp, flex: 1 }} />
                    <button onClick={() => setGlobal(g => ({ ...g, nav_items: (g.nav_items?.length ? g.nav_items : DEF_NAV).filter((_, k) => k !== i) }))} style={{ ...btn, color: '#dc2626', padding: '5px 9px' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setGlobal(g => ({ ...g, nav_items: [...(g.nav_items?.length ? g.nav_items : DEF_NAV), { label: '', href: '' }] }))} style={btn}>+ Menüpunkt</button>
              </div>
              <div style={card}>
                <Field label="Kontakt-E-Mail" value={global.contact_email || ''} onChange={v => setGlobal(g => ({ ...g, contact_email: v }))} />
                <Field label="Footer-Zeile" value={global.footer_copy || ''} onChange={v => setGlobal(g => ({ ...g, footer_copy: v }))} placeholder={`© ${new Date().getFullYear()} Responda Systems`} />
              </div>
              <div style={card}>
                <Field label="Impressum" value={global.impressum || ''} onChange={v => setGlobal(g => ({ ...g, impressum: v }))} textarea hint="Leer lassen = Standardtext verwenden" />
                <Field label="Datenschutzerklärung" value={global.datenschutz || ''} onChange={v => setGlobal(g => ({ ...g, datenschutz: v }))} textarea hint="Leer lassen = Standardtext verwenden" />
              </div>
            </>
          )}

          {tab === 'medien' && (
            <div style={card}>
              <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Medien</div>
              {picker && <div style={{ background: 'rgba(217,119,6,0.1)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5, color: 'var(--lbf-text)', marginBottom: 10 }}>Bild antippen, um es einzusetzen. <button onClick={() => setPicker(null)} style={{ ...btn, padding: '3px 8px', marginLeft: 6 }}>Abbrechen</button></div>}
              <button onClick={() => fileRef.current?.click()} style={{ ...btnP, width: '100%', padding: 11, marginBottom: 12 }}>Bild hochladen</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; uploadImage(f) }} />
              {media.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Noch keine Bilder.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                  {media.map(m => (
                    <div key={m.id} onClick={() => { if (picker) { picker(m.url); setPicker(null); setTab('seiten') } }} style={{ cursor: picker ? 'pointer' : 'default', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
                      <img src={m.url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                      <div style={{ fontSize: 10, padding: '5px 6px', color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Live-Vorschau ── */}
        {showPreview && active && (
          <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: 110 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Live-Vorschau</div>
            <div style={{ border: '1px solid rgba(96,8,18,0.15)', borderRadius: 14, overflow: 'hidden', height: 'calc(100dvh - 150px)', overflowY: 'auto', background: '#fff' }}>
              <LandingRenderer page={active} global={global} preview />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
