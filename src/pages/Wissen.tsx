import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

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

const EMPTY = { titel: '', inhalt: '', tags: '', quelle: '' }

export default function Wissen() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [search, setSearch] = useState('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [removeBild, setRemoveBild] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && user && !user.supervisor) navigate('/hub')
  }, [authLoading, user, navigate])

  useEffect(() => { if (user?.organization_id) load() }, [user])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg({ text, type }); setTimeout(() => setMsg(null), 3500)
  }

  async function load() {
    if (!user?.organization_id) return
    try {
      setLoading(true); setError('')
      const list = await pb.collection('wissen').getFullList<Artikel>({
        filter: `organization_id = "${user.organization_id}"`, sort: '-updated', requestKey: `wissen-${Date.now()}`,
      })
      setArtikel(list)
    } catch (e: any) {
      setError('Fehler beim Laden — existiert die Collection "wissen" in PocketBase?')
    } finally { setLoading(false) }
  }

  function openNew() {
    setEditingId(null); setForm({ ...EMPTY }); setFile(null); setPreview(''); setRemoveBild(false); setEditorOpen(true)
  }
  function openEdit(a: Artikel) {
    setEditingId(a.id)
    setForm({ titel: a.titel, inhalt: a.inhalt, tags: parseTags(a.tags).join(', '), quelle: a.quelle || '' })
    setFile(null); setPreview(fileUrl(a)); setRemoveBild(false); setEditorOpen(true)
  }
  function pickFile(f: File | undefined) { if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setRemoveBild(false) } }

  async function save() {
    if (!user) return
    if (!form.titel.trim() && !form.inhalt.trim()) { alert('Titel oder Inhalt eingeben.'); return }
    if (saving) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('titel', form.titel.trim())
      fd.append('inhalt', form.inhalt)
      fd.append('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)))
      fd.append('quelle', form.quelle.trim())
      fd.append('organization_id', user.organization_id || '')
      if (file) fd.append('bild', file)
      else if (removeBild) fd.append('bild', '')
      if (editingId) { await pb.collection('wissen').update(editingId, fd); showMsg('✅ Artikel gespeichert!') }
      else { await pb.collection('wissen').create(fd); showMsg('✅ Artikel angelegt!') }
      setEditorOpen(false)
      await load()
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFalls die Collection "wissen" fehlt, bitte erst in PocketBase anlegen.')
    } finally { setSaving(false) }
  }

  async function del() {
    if (!editingId) return
    if (!confirm('Diesen Wissensartikel wirklich löschen?')) return
    try { await pb.collection('wissen').delete(editingId); setEditorOpen(false); showMsg('✅ Gelöscht!'); await load() }
    catch (e: any) { alert('Fehler: ' + e.message) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return artikel
    return artikel.filter(a => a.titel.toLowerCase().includes(q) || a.inhalt.toLowerCase().includes(q) || parseTags(a.tags).some(t => t.toLowerCase().includes(q)))
  }, [artikel, search])

  if (authLoading) return null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/supervisor')} style={{ display: 'flex', border: 'none', background: 'none', color: '#600812', cursor: 'pointer', padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Wissensbasis</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>Grundlage des KI-Assistenten · nur Supervisor</div>
          </div>
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, background: '#600812', color: '#fff', padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Artikel
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: msg.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>{msg.text}</div>
      )}

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 16px 80px' }}>
        <div style={{ background: 'rgba(96,8,18,0.04)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.55, marginBottom: 16 }}>
          Alles hier ist die geprüfte Grundlage, aus der der Lern-Assistent antwortet. Je mehr saubere Artikel (mit Schlagwörtern und ggf. Bild), desto besser die Antworten.
        </div>

        <input type="text" placeholder="Wissensbasis durchsuchen…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 14, borderRadius: 12, marginBottom: 16, fontWeight: 600 }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--lbf-card)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>{artikel.length === 0 ? 'Noch keine Artikel' : 'Kein Treffer'}</div>
            <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>{artikel.length === 0 ? 'Lege mit „Artikel" den ersten Wissenseintrag an.' : 'Suchbegriff anpassen.'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(a => (
              <div key={a.id} onClick={() => openEdit(a)} style={{ display: 'flex', gap: 12, background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #600812', padding: '12px 14px', cursor: 'pointer' }}>
                {fileUrl(a) && <img src={fileUrl(a)} alt="" style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff', border: '0.5px solid rgba(96,8,18,0.1)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{a.titel || '(ohne Titel)'}</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.inhalt}</div>
                  {parseTags(a.tags).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {parseTags(a.tags).slice(0, 6).map(t => <span key={t} style={{ fontStyle: 'italic', fontWeight: 700, color: '#600812', fontSize: 12 }}>#{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      {editorOpen && (
        <div onClick={() => setEditorOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--lbf-card)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 620, maxHeight: '92dvh', overflowY: 'auto', padding: '18px 18px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>{editingId ? 'Artikel bearbeiten' : 'Neuer Wissensartikel'}</div>

            <input type="text" value={form.titel} onChange={e => setForm({ ...form, titel: e.target.value })} placeholder="Titel (z.B. Sinustachykardie)"
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontStyle: 'italic', fontWeight: 700, fontSize: 19, color: 'var(--lbf-text)', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }} />

            {/* Bild */}
            <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed rgba(96,8,18,0.3)', borderRadius: 12, padding: preview ? 0 : '22px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
              {preview ? <img src={preview} alt="" style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'contain', background: '#fff' }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: '#600812' }}>Bild hinzufügen (optional)</span>}
            </div>
            {preview && <button onClick={() => { setFile(null); setPreview(''); setRemoveBild(true) }} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 12, padding: 0, fontFamily: 'inherit' }}>Bild entfernen</button>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0])} />

            <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Inhalt</label>
            <textarea value={form.inhalt} onChange={e => setForm({ ...form, inhalt: e.target.value })} rows={9} placeholder="Der Fachtext, aus dem die KI antwortet…"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 160, boxSizing: 'border-box', marginBottom: 12 }} />

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Schlagwörter (Komma-getrennt)</label>
              <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="EKG, Tachykardie, Rhythmus"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Wichtig — daran findet die KI den Artikel zur Frage.</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Quelle / Lizenz (optional)</label>
              <input type="text" value={form.quelle} onChange={e => setForm({ ...form, quelle: e.target.value })} placeholder="z.B. eigene SOP / ERC-Leitlinie 2021"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {editingId && <button onClick={del} style={{ border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#dc2626', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setEditorOpen(false)} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={save} disabled={saving} style={{ border: 'none', background: '#600812', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Speichern…' : 'Speichern'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
