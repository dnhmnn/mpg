import { useState, useRef } from 'react'
import { pb } from '../../lib/pocketbase'
import { inp, lbl } from './pubStyles'

type Field = 'tf' | 'm1' | 'm2' | 'm3'
type Mann = Record<Field, string>
type Status = Record<Field, 'found' | 'not_found' | null>

const FIELDS: { key: Field; label: string }[] = [
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

export default function OrgPatientenMannschaft({
  orgId, orgCode, onDraftCreated,
}: {
  orgId: string; orgCode: string; onDraftCreated: (id: string) => void
}) {
  const [mann, setMann] = useState<Mann>({ tf: '', m1: '', m2: '', m3: '' })
  const [status, setStatus] = useState<Status>({ tf: null, m1: null, m2: null, m3: null })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState('')
  const timers = useRef<Partial<Record<Field, ReturnType<typeof setTimeout>>>>({})

  function onInput(field: Field, value: string) {
    setMann(m => ({ ...m, [field]: value }))
    setStatus(s => ({ ...s, [field]: null }))
    clearTimeout(timers.current[field])
    if (!value.trim()) return
    timers.current[field] = setTimeout(async () => {
      try {
        const res = await pb.collection('users').getList(1, 1, {
          filter: `name ~ "${value.trim()}" || username ~ "${value.trim()}"`,
        })
        setStatus(s => ({ ...s, [field]: res.totalItems > 0 ? 'found' : 'not_found' }))
      } catch {
        setStatus(s => ({ ...s, [field]: 'not_found' }))
      }
    }, 500)
  }

  async function save() {
    setSaving(true)
    setOfflineMsg('')
    if (!navigator.onLine) {
      const key = `offline_queue_${orgCode}`
      const queue = JSON.parse(localStorage.getItem(key) || '[]')
      queue.push({ type: 'draft', payload: { mannschaft: mann }, status: 'offen', organization_id: orgId })
      localStorage.setItem(key, JSON.stringify(queue))
      setSaved(true)
      setOfflineMsg('Offline gespeichert – wird beim nächsten Öffnen dieser Seite automatisch übermittelt.')
      setSaving(false)
      return
    }
    try {
      const rec = await pb.collection('patients').create({
        title: `Entwurf – ${new Date().toLocaleDateString('de-DE')}`,
        payload: { mannschaft: mann },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem', marginBottom: '1rem' }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingRight: status[key] === 'not_found' ? 110 : 36 }} type="text" value={mann[key]} onChange={e => onInput(key, e.target.value)} placeholder="Name eingeben…" />
                {status[key] && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '.8rem', color: status[key] === 'found' ? '#16a34a' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {status[key] === 'found' ? '✓ Gefunden' : 'Nicht gefunden'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {offlineMsg && (
          <div style={{ background: '#fef9c3', border: '0.5px solid #eab308', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', color: '#854d0e', marginBottom: '.75rem' }}>
            {offlineMsg}
          </div>
        )}
        {saved ? (
          <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>✓ Entwurf angelegt</div>
        ) : (
          <button type="button" disabled={saving} onClick={save} style={{ background: saving ? 'var(--bg-hover)' : 'var(--accent)', color: saving ? 'var(--text-secondary)' : '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '.95rem', fontFamily: 'inherit' }}>
            {saving ? 'Speichert…' : 'Entwurf anlegen'}
          </button>
        )}
      </div>
    </div>
  )
}
