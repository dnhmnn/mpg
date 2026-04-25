import { useState, useRef, useEffect } from 'react'
import { pb } from '../../lib/pocketbase'
import { inp, lbl } from './pubStyles'

type UserHit = { id: string; name: string; email: string }
type Selection = UserHit | null
type Pos = 'tf' | 'm1' | 'm2' | 'm3'

const FIELDS: { key: Pos; label: string }[] = [
  { key: 'tf', label: 'Teamführer' },
  { key: 'm1', label: 'Mannschaft 1' },
  { key: 'm2', label: 'Mannschaft 2' },
  { key: 'm3', label: 'Mannschaft 3' },
]

const icon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

function UserSearch({ label, orgId, value, onChange }: {
  label: string; orgId: string; value: Selection; onChange: (u: Selection) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function onInput(q: string) {
    setQuery(q)
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await pb.collection('users').getList(1, 8, {
          filter: `organization_id = "${orgId}" && name ~ "${q.trim()}"`,
          sort: 'name',
        })
        setResults(res.items.map(u => ({ id: u.id, name: u.name, email: u.email })))
        setOpen(true)
      } catch {
        setResults([])
      }
    }, 350)
  }

  function select(u: UserHit) {
    onChange(u)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={lbl}>{label}</label>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, background: 'var(--bg-subtle)', border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {value.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{value.name}</span>
          <button type="button" onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      ) : (
        <input
          style={inp}
          type="text"
          value={query}
          onChange={e => onInput(e.target.value)}
          placeholder="Name suchen…"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
      )}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
          {results.map(u => (
            <button key={u.id} type="button" onMouseDown={() => select(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', borderBottom: '0.5px solid var(--border)', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text-secondary)', zIndex: 50, marginTop: 2 }}>
          Kein Benutzer gefunden
        </div>
      )}
    </div>
  )
}

export default function OrgPatientenMannschaft({
  orgId, orgCode, onDraftCreated,
}: {
  orgId: string; orgCode: string; onDraftCreated: (id: string) => void
}) {
  const [sel, setSel] = useState<Record<Pos, Selection>>({ tf: null, m1: null, m2: null, m3: null })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState('')

  function set(pos: Pos, u: Selection) {
    setSel(s => ({ ...s, [pos]: u }))
  }

  async function save() {
    setSaving(true)
    setOfflineMsg('')
    const mannschaft = Object.fromEntries(
      FIELDS.map(f => [f.key, sel[f.key] ? { id: sel[f.key]!.id, name: sel[f.key]!.name } : null])
    )
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem(`offline_queue_${orgCode}`) || '[]')
      queue.push({ type: 'draft', payload: { mannschaft }, status: 'offen', organization_id: orgId })
      localStorage.setItem(`offline_queue_${orgCode}`, JSON.stringify(queue))
      setSaved(true)
      setOfflineMsg('Offline gespeichert – wird beim nächsten Öffnen dieser Seite automatisch übermittelt.')
      setSaving(false)
      return
    }
    try {
      const rec = await pb.collection('patients').create({
        title: `Entwurf – ${new Date().toLocaleDateString('de-DE')}`,
        payload: { mannschaft },
        status: 'offen',
        organization_id: orgId,
      })
      onDraftCreated(rec.id)
      setSaved(true)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
        {icon} Mannschaft
      </div>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {FIELDS.map(f => (
            <UserSearch key={f.key} label={f.label} orgId={orgId} value={sel[f.key]} onChange={u => set(f.key, u)} />
          ))}
        </div>
        {offlineMsg && (
          <div style={{ background: '#fef9c3', border: '0.5px solid #eab308', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', color: '#854d0e', marginBottom: '.75rem' }}>
            {offlineMsg}
          </div>
        )}
        {saved ? (
          <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>✓ Entwurf angelegt – sichtbar in Patienten & Unitas</div>
        ) : (
          <button type="button" disabled={saving} onClick={save} style={{ background: saving ? 'var(--bg-hover)' : 'var(--accent)', color: saving ? 'var(--text-secondary)' : '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '.95rem', fontFamily: 'inherit' }}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        )}
      </div>
    </div>
  )
}
