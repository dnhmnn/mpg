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

const iconMannschaft = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

const iconQR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/>
  </svg>
)

function UserSearch({ label, orgId, value, onChange }: {
  label: string; orgId: string; value: Selection; onChange: (u: Selection) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function confirmManual() {
    if (!manualName.trim()) return
    onChange({ id: '', name: manualName.trim(), email: '' })
    setManualName('')
    setManualMode(false)
  }

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
        setOpen(false)
        setManualMode(true)
      }
    }, 350)
  }

  function select(u: UserHit) {
    onChange(u)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  if (manualMode && !value) {
    return (
      <div>
        <label style={lbl}>{label}</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            style={{ ...inp, flex: 1, margin: 0 }}
            type="text"
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), confirmManual())}
            placeholder="Name eingeben…"
            autoFocus
          />
          <button type="button" onClick={confirmManual}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 14px', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
            OK
          </button>
        </div>
      </div>
    )
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

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'var(--bg-hover)' : 'var(--accent)',
  color: disabled ? 'var(--text-secondary)' : '#fff',
  border: 'none', borderRadius: 10, padding: '10px 20px',
  fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '.95rem', fontFamily: 'inherit',
})

export default function OrgPatientenMannschaft({
  orgId, orgCode, onDraftCreated, onQrSaved,
}: {
  orgId: string
  orgCode: string
  onDraftCreated: (id: string, mannschaft: Record<string, { id: string; name: string } | null>) => void
  onQrSaved?: (code: string, created: string) => void
}) {
  const [sel, setSel] = useState<Record<Pos, Selection>>({ tf: null, m1: null, m2: null, m3: null })
  const [savingMannschaft, setSavingMannschaft] = useState(false)
  const [mannschaftSaved, setMannschaftSaved] = useState(false)
  const [mannschaftOffline, setMannschaftOffline] = useState('')

  const [qrCode, setQrCode] = useState('')
  const [savingQr, setSavingQr] = useState(false)
  const [qrSaved, setQrSaved] = useState(false)
  const [qrOffline, setQrOffline] = useState('')

  const draftIdRef = useRef<string | null>(null)

  function set(pos: Pos, u: Selection) {
    setSel(s => ({ ...s, [pos]: u }))
    setMannschaftSaved(false)
  }

  async function saveMannschaft() {
    setSavingMannschaft(true)
    setMannschaftOffline('')
    const mannschaft = Object.fromEntries(
      FIELDS.map(f => [f.key, sel[f.key] ? { id: sel[f.key]!.id, name: sel[f.key]!.name } : null])
    )
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem(`offline_queue_${orgCode}`) || '[]')
      queue.push({ type: 'draft', payload: { mannschaft }, status: 'offen', organization_id: orgId })
      localStorage.setItem(`offline_queue_${orgCode}`, JSON.stringify(queue))
      setMannschaftSaved(true)
      setMannschaftOffline('Offline gespeichert – wird beim nächsten Öffnen übermittelt.')
      setSavingMannschaft(false)
      return
    }
    try {
      if (draftIdRef.current) {
        await pb.collection('patients').update(draftIdRef.current, { payload: { mannschaft } })
      } else {
        const rec = await pb.collection('patients').create({
          title: `Entwurf – ${new Date().toLocaleDateString('de-DE')}`,
          payload: { mannschaft },
          status: 'offen',
          organization_id: orgId,
        })
        draftIdRef.current = rec.id
        onDraftCreated(rec.id, mannschaft)
      }
      setMannschaftSaved(true)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSavingMannschaft(false)
    }
  }

  async function saveQr() {
    const code = qrCode.trim()
    if (code.length !== 4) { alert('Bitte eine 4-stellige Nummer eingeben.'); return }
    setSavingQr(true)
    setQrOffline('')
    const created = new Date().toISOString()
    if (!navigator.onLine) {
      onQrSaved?.(code, created)
      setQrSaved(true)
      setQrOffline('Offline gespeichert – wird beim Absenden übermittelt.')
      setSavingQr(false)
      return
    }
    try {
      if (draftIdRef.current) {
        // Merge access_code into existing draft payload
        const existing = await pb.collection('patients').getOne(draftIdRef.current)
        const existingPayload = typeof existing.payload === 'string'
          ? JSON.parse(existing.payload)
          : existing.payload ?? {}
        await pb.collection('patients').update(draftIdRef.current, {
          payload: { ...existingPayload, access_code: code, access_code_created: created },
        })
      }
      // Always propagate up so final form submit includes it
      onQrSaved?.(code, created)
      setQrSaved(true)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSavingQr(false)
    }
  }

  return (
    <>
      {/* Mannschaft card */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {iconMannschaft} Mannschaft
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {FIELDS.map(f => (
              <UserSearch key={f.key} label={f.label} orgId={orgId} value={sel[f.key]} onChange={u => set(f.key, u)} />
            ))}
          </div>
          {mannschaftOffline && (
            <div style={{ background: '#fef9c3', border: '0.5px solid #eab308', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', color: '#854d0e', marginBottom: '.75rem' }}>
              {mannschaftOffline}
            </div>
          )}
          {mannschaftSaved ? (
            <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>✓ Mannschaft gespeichert</div>
          ) : (
            <button type="button" disabled={savingMannschaft} onClick={saveMannschaft} style={btnPrimary(savingMannschaft)}>
              {savingMannschaft ? 'Speichert…' : 'Mannschaft speichern'}
            </button>
          )}
        </div>
      </div>

      {/* QR-Code card */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {iconQR} QR-Code für Rettungsdienst
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ flex: '0 0 auto' }}>
              <label style={lbl}>4-stelliger Code</label>
              <input
                style={{ ...inp, width: 100, letterSpacing: '0.2em', fontWeight: 800, fontSize: '1.3rem', textAlign: 'center', color: '#c0392b', margin: 0 }}
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={qrCode}
                onChange={e => { setQrCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setQrSaved(false) }}
              />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 10, lineHeight: 1.4 }}>
              Nummer vom gedruckten QR-Label eingeben.<br/>
              Rettungsdienst kann das Protokoll 24 h einsehen.
            </span>
          </div>
          {qrOffline && (
            <div style={{ background: '#fef9c3', border: '0.5px solid #eab308', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', color: '#854d0e', marginBottom: '.75rem' }}>
              {qrOffline}
            </div>
          )}
          {qrSaved ? (
            <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>✓ QR-Code {qrCode} verknüpft</div>
          ) : (
            <button type="button" disabled={savingQr || qrCode.length !== 4} onClick={saveQr}
              style={btnPrimary(savingQr || qrCode.length !== 4)}>
              {savingQr ? 'Speichert…' : 'QR-Code speichern'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
