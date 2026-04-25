import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { inp, lbl } from './pubStyles'

type Person = { vorname: string; nachname: string }
type Mann = { tf: Person; m1: Person; m2: Person; m3: Person }

const empty = (): Person => ({ vorname: '', nachname: '' })

const FIELDS: { key: keyof Mann; label: string }[] = [
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
  const [mann, setMann] = useState<Mann>({ tf: empty(), m1: empty(), m2: empty(), m3: empty() })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState('')

  function set(key: keyof Mann, field: keyof Person, value: string) {
    setMann(m => ({ ...m, [key]: { ...m[key], [field]: value } }))
  }

  async function save() {
    setSaving(true)
    setOfflineMsg('')
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem(`offline_queue_${orgCode}`) || '[]')
      queue.push({ type: 'draft', payload: { mannschaft: mann }, status: 'offen', organization_id: orgId })
      localStorage.setItem(`offline_queue_${orgCode}`, JSON.stringify(queue))
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                <div>
                  <label style={lbl}>Vorname</label>
                  <input style={inp} type="text" value={mann[key].vorname} onChange={e => set(key, 'vorname', e.target.value)} placeholder="Vorname" />
                </div>
                <div>
                  <label style={lbl}>Nachname</label>
                  <input style={inp} type="text" value={mann[key].nachname} onChange={e => set(key, 'nachname', e.target.value)} placeholder="Nachname" />
                </div>
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
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        )}
      </div>
    </div>
  )
}
