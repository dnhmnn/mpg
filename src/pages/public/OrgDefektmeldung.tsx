import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubWrap, PubSendBar, inp, lbl, field, ta } from './pubStyles'

type Severity = 'low' | 'medium' | 'high' | 'critical'

interface DeviceSummary { id: string; name: string; type: string; location: string }
interface UserHit { id: string; name: string; email: string }

const SEVERITY_CFG: Record<Severity, { label: string; desc: string; color: string; bg: string }> = {
  low:      { label: 'Gering',   desc: 'Gerät noch nutzbar',          color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
  medium:   { label: 'Mittel',   desc: 'Eingeschränkte Funktion',      color: '#ea580c', bg: 'rgba(234,88,12,0.08)'  },
  high:     { label: 'Hoch',     desc: 'Nicht mehr einsatzbereit',     color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
  critical: { label: 'Kritisch', desc: 'Sicherheitsrelevanter Defekt', color: '#7f1d1d', bg: 'rgba(127,29,29,0.12)'  },
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderLeft: '3px solid #600812', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '.85rem 1rem', fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.12em', borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
        {title}
      </div>
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  )
}

function UserSearch({ orgId, value, onChange }: {
  orgId: string; value: UserHit | null; onChange: (u: UserHit | null) => void
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
        setOpen(true)
      }
    }, 350)
  }

  function select(u: UserHit) {
    onChange(u); setQuery(''); setResults([]); setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 8 }}>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(96,8,18,0.04)', border: '1.5px solid rgba(96,8,18,0.15)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#600812', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontStyle: 'italic', fontSize: 13, flexShrink: 0 }}>
            {value.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ flex: 1, fontWeight: 700, fontStyle: 'italic', color: '#1a0e08', fontSize: 14 }}>{value.name}</span>
          <button type="button" onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      ) : (
        <input style={inp} type="text" value={query} onChange={e => onInput(e.target.value)} placeholder="Name suchen…" />
      )}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
          {results.map(u => (
            <button key={u.id} type="button" onMouseDown={() => select(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', borderBottom: '0.5px solid rgba(96,8,18,0.08)', fontFamily: 'inherit' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#600812', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontStyle: 'italic', fontSize: 13, flexShrink: 0 }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: '#1a0e08' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)', zIndex: 50, marginTop: 2 }}>
          Kein Benutzer gefunden
        </div>
      )}
    </div>
  )
}

export default function OrgDefektmeldung() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('device') || ''

  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [selectedId, setSelectedId] = useState(preselectedId)
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    pb.collection('mpg_devices').getFullList<DeviceSummary>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
      fields: 'id,name,type,location',
    }).then(setDevices).catch(() => {})
  }, [org.id])

  const selectedDevice = devices.find(d => d.id === selectedId)

  async function submit() {
    if (!selectedId) { setError('Bitte ein Gerät auswählen.'); return }
    if (!description.trim()) { setError('Bitte eine Beschreibung eingeben.'); return }
    if (!selectedUser) { setError('Bitte einen Benutzer auswählen.'); return }
    setError('')
    setSending(true)
    try {
      await pb.collection('mpg_defect_reports').create({
        device_id: selectedId,
        device_name: selectedDevice?.name || '',
        organization_id: org.id,
        reporter_name: selectedUser.name,
        reporter_user_id: selectedUser.id,
        description: description.trim(),
        severity,
        status: 'pending',
      })
      setSuccess(true)
    } catch (e: any) {
      setError('Fehler: ' + (e?.message || 'Unbekannter Fehler'))
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setSuccess(false)
    setDescription('')
    setSeverity('medium')
    setSelectedUser(null)
    setError('')
    if (!preselectedId) setSelectedId('')
  }

  if (success) return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: '#fff', borderLeft: '3px solid #16a34a', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
        <div style={{ width: 52, height: 52, background: 'rgba(22,163,74,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: '#1a0e08', marginBottom: 8 }}>Meldung eingegangen</div>
        <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24 }}>
          Die Defektmeldung für <strong style={{ fontStyle: 'normal', color: '#1a0e08' }}>{selectedDevice?.name}</strong> wurde übermittelt und wird geprüft.
        </div>
        <button style={{ background: '#600812', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' }} onClick={reset}>
          Neue Meldung
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)' }}>
      <header style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(`/${orgCode}`)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#600812', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08' }}>Defektmeldung</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{org.org_name}</div>
          </div>
        </div>
      </header>

      <PubWrap>
        {/* Gerät */}
        <Card title="Gerät *">
          <label style={lbl}>
            Medizinprodukt auswählen
            {devices.length === 0 ? (
              <div style={{ ...inp, marginTop: 6, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine Geräte gefunden</div>
            ) : (
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                style={{ ...inp, appearance: 'none', WebkitAppearance: 'none' }}
              >
                <option value="">– Gerät auswählen –</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.location ? ` · ${d.location}` : ''} ({d.type})
                  </option>
                ))}
              </select>
            )}
          </label>
        </Card>

        {/* Beschreibung */}
        <Card title="Beschreibung">
          <label style={lbl}>
            Was ist defekt? *
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Was genau ist defekt? Wie macht sich das Problem bemerkbar?"
              rows={4}
              style={ta}
            />
          </label>
        </Card>

        {/* Schweregrad */}
        <Card title="Schweregrad">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {(Object.entries(SEVERITY_CFG) as [Severity, typeof SEVERITY_CFG[Severity]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSeverity(key)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${severity === key ? cfg.color : 'rgba(96,8,18,0.12)'}`,
                  background: severity === key ? cfg.bg : 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left' as const,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.label}</div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>{cfg.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Gemeldet von — last */}
        <Card title="Gemeldet von">
          <label style={lbl}>Benutzer *</label>
          <UserSearch orgId={org.id} value={selectedUser} onChange={setSelectedUser} />
        </Card>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.06)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#dc2626', fontStyle: 'italic', marginBottom: '.75rem' }}>
            {error}
          </div>
        )}
      </PubWrap>

      <PubSendBar onSubmit={submit} sending={sending} label="Defekt melden" small />
    </div>
  )
}
