import { useState, useEffect, useMemo } from 'react'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

interface Notiz {
  id: string
  title: string
  content: string
  tags: string[]
  color: string
  pinned: boolean
  shared: boolean
  user_id: string
  user_name: string
  organization_id: string
  created: string
  updated: string
}

// Akzentfarben für Notizen (LBF-Statusfarben)
const NOTE_COLORS = [
  { value: '#600812', label: 'Rot' },
  { value: '#16a34a', label: 'Grün' },
  { value: '#d97706', label: 'Amber' },
  { value: '#1e3a8a', label: 'Blau' },
  { value: '#8a7a68', label: 'Grau' },
]

const EMPTY_FORM = { title: '', content: '', tags: '', color: '#600812', pinned: false, shared: false }

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days} Tag${days === 1 ? '' : 'en'}`
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Notizen() {
  const { user, loading: authLoading } = useAuth()

  const [notes, setNotes] = useState<Notiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [scope, setScope] = useState<'alle' | 'meine' | 'geteilt'>('alle')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.organization_id) loadNotes()
  }, [user])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3500)
  }

  async function loadNotes() {
    if (!user?.organization_id) return
    try {
      setLoading(true)
      setError('')
      const list = await pb.collection('notizen').getFullList<Notiz>({
        filter: `organization_id = "${user.organization_id}" && (user_id = "${user.id}" || shared = true)`,
        sort: '-updated',
        requestKey: `notizen-${Date.now()}`,
      })
      setNotes(list.map(n => ({ ...n, tags: Array.isArray(n.tags) ? n.tags : [] })))
    } catch (e: any) {
      console.error('Error loading notes:', e)
      setError('Fehler beim Laden — existiert die Collection "notizen" in PocketBase?')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setEditorOpen(true)
  }

  function openEdit(n: Notiz) {
    setEditingId(n.id)
    setForm({
      title: n.title, content: n.content, tags: (n.tags || []).join(', '),
      color: n.color || '#600812', pinned: !!n.pinned, shared: !!n.shared,
    })
    setEditorOpen(true)
  }

  async function saveNote() {
    if (!user) return
    if (!form.title.trim() && !form.content.trim()) { alert('Titel oder Inhalt eingeben.'); return }
    if (saving) return
    setSaving(true)
    const data = {
      title: form.title.trim(),
      content: form.content,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      color: form.color,
      pinned: form.pinned,
      shared: form.shared,
      user_id: user.id,
      user_name: user.name || '',
      organization_id: user.organization_id,
    }
    try {
      if (editingId) {
        await pb.collection('notizen').update(editingId, data)
        showMsg('✅ Notiz gespeichert!')
      } else {
        await pb.collection('notizen').create(data)
        showMsg('✅ Notiz angelegt!')
      }
      setEditorOpen(false)
      await loadNotes()
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message))
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote() {
    if (!editingId) return
    if (!confirm('Notiz wirklich löschen?')) return
    try {
      await pb.collection('notizen').delete(editingId)
      setEditorOpen(false)
      showMsg('✅ Notiz gelöscht!')
      await loadNotes()
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function togglePin(n: Notiz, e: React.MouseEvent) {
    e.stopPropagation()
    if (n.user_id !== user?.id && !user?.supervisor) return
    try {
      await pb.collection('notizen').update(n.id, { pinned: !n.pinned })
      setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !n.pinned } : x))
    } catch { /* still shown on next load */ }
  }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => (n.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [notes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notes
      .filter(n => scope === 'alle' ? true : scope === 'meine' ? n.user_id === user?.id : n.shared)
      .filter(n => !tagFilter || (n.tags || []).includes(tagFilter))
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  }, [notes, search, tagFilter, scope, user])

  if (authLoading) return null

  if (user && !user.supervisor && !(user as any).permissions?.notizen) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Atkinson Hyperlegible', sans-serif" }}>
        <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '28px 32px', textAlign: 'center', boxShadow: 'var(--lbf-shadow)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>Kein Zugriff</div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>Dir fehlt die Berechtigung „Notizen".</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* MASTHEAD HEADER */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: '#600812', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Notizen</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, background: '#600812', color: '#fff', padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Neu
          </button>
        </div>
      </div>

      {/* TOAST */}
      {message && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: message.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {message.text}
        </div>
      )}

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 80px', boxSizing: 'border-box' as const }}>

        {/* SEARCH */}
        <input
          type="text"
          placeholder="Notizen durchsuchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 10 }}
        />

        {/* FILTER CHIPS */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16 }}>
          {([['alle', 'Alle'], ['meine', 'Meine'], ['geteilt', 'Geteilt']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setScope(key)} style={{ padding: '6px 14px', borderRadius: 999, border: scope === key ? '1.5px solid #600812' : '1px solid rgba(96,8,18,0.15)', background: scope === key ? '#600812' : 'transparent', color: scope === key ? '#fff' : 'var(--warm-gray)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
          {allTags.length > 0 && <div style={{ width: 1, background: 'rgba(96,8,18,0.12)', margin: '2px 4px' }} />}
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} style={{ padding: '6px 12px', borderRadius: 999, border: tagFilter === tag ? '1.5px solid #600812' : '1px solid rgba(96,8,18,0.15)', background: tagFilter === tag ? 'rgba(96,8,18,0.08)' : 'transparent', color: '#600812', fontWeight: 700, fontStyle: 'italic', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              #{tag}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 16, borderRadius: 12, marginBottom: 16, fontWeight: 600 }}>{error}</div>
        )}

        {/* NOTES */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', fontStyle: 'italic', background: 'var(--lbf-card)', borderRadius: 12 }}>Lade Notizen…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: 'var(--lbf-card)', borderRadius: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>Keine Notizen</div>
            <div style={{ fontStyle: 'italic', fontSize: 13 }}>Leg mit „Neu" deine erste Notiz an.</div>
          </div>
        ) : (
          <div style={{ columnWidth: 280, columnGap: 12 }}>
            {filtered.map(n => (
              <div
                key={n.id}
                onClick={() => openEdit(n)}
                style={{
                  breakInside: 'avoid' as const, marginBottom: 12, cursor: 'pointer',
                  background: 'var(--lbf-card)', borderRadius: 12,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  borderLeft: `3px solid ${n.color || '#600812'}`,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '14px 14px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {n.title && <div style={{ flex: 1, fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: 'var(--lbf-text)', lineHeight: 1.3 }}>{n.title}</div>}
                    <button onClick={(e) => togglePin(n, e)} title={n.pinned ? 'Lösen' : 'Anpinnen'} style={{ marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: n.pinned ? '#600812' : 'rgba(138,122,104,0.4)', padding: 2 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={n.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 3h6l1 7 3 2v2H5v-2l3-2 1-7z"/></svg>
                    </button>
                  </div>
                  {n.content && (
                    <div style={{ fontSize: 13.5, color: 'var(--lbf-text)', opacity: 0.82, lineHeight: 1.55, marginTop: n.title ? 6 : 0, whiteSpace: 'pre-wrap' as const, display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {n.content}
                    </div>
                  )}
                  {(n.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 10 }}>
                      {n.tags.map(t => <span key={t} style={{ fontStyle: 'italic', fontWeight: 700, color: '#600812', fontSize: 12 }}>#{t}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{relTime(n.updated)}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>
                    {n.shared ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a5 5 0 015-5h2"/><circle cx="17" cy="7" r="3"/><path d="M21 21v-2a5 5 0 00-5-5h-2"/></svg>
                        {n.user_id === user?.id ? 'Geteilt' : n.user_name}
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        Privat
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDITOR MODAL */}
      {editorOpen && (
        <div onClick={() => setEditorOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--lbf-card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90dvh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 8px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 0', overflowY: 'auto' as const, flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 14 }}>
                {editingId ? 'Notiz bearbeiten' : 'Neue Notiz'}
              </div>
              <input
                type="text"
                placeholder="Titel"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' as const }}
              />
              <textarea
                placeholder="Schreib alles Wichtige auf…"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                rows={10}
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, lineHeight: 1.6, color: 'var(--lbf-text)', fontFamily: 'inherit', resize: 'vertical' as const, minHeight: 180, boxSizing: 'border-box' as const }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, margin: '10px 0 14px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Tags (mit Komma trennen)</label>
                <input
                  type="text"
                  placeholder="z.B. RTW, Wartung, Ideen"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-input-bg, transparent)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {NOTE_COLORS.map(c => (
                    <button key={c.value} title={c.label} onClick={() => setForm({ ...form, color: c.value })} style={{ width: 26, height: 26, borderRadius: '50%', background: c.value, border: form.color === c.value ? '2.5px solid var(--lbf-text)' : '2.5px solid transparent', cursor: 'pointer', padding: 0 }} />
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>
                  <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#600812' }} />
                  Anpinnen
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>
                  <input type="checkbox" checked={form.shared} onChange={e => setForm({ ...form, shared: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#600812' }} />
                  Mit Organisation teilen
                </label>
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.1)', background: 'rgba(250,249,247,0.8)', padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
              {editingId && (user?.id === notes.find(n => n.id === editingId)?.user_id || user?.supervisor) && (
                <button onClick={deleteNote} style={{ border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#dc2626', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setEditorOpen(false)} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={saveNote} disabled={saving} style={{ border: 'none', background: '#600812', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
