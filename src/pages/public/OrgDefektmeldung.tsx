import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubWrap, PubSendBar, inp, lbl, field, ta } from './pubStyles'

type Severity = 'low' | 'medium' | 'high' | 'critical'

interface DeviceSummary { id: string; name: string; type: string; location: string }

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

export default function OrgDefektmeldung() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('device') || ''

  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [selectedId, setSelectedId] = useState(preselectedId)
  const [reporterName, setReporterName] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
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
    setError('')
    setSending(true)
    try {
      await pb.collection('mpg_defect_reports').create({
        device_id: selectedId,
        device_name: selectedDevice?.name || '',
        organization_id: org.id,
        reporter_name: reporterName.trim() || 'Anonym',
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
    setReporterName('')
    setSeverity('medium')
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
          <div style={field}>
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
          </div>
          <div style={field}>
            <label style={lbl}>
              Dein Name (optional)
              <input
                type="text"
                value={reporterName}
                onChange={e => setReporterName(e.target.value)}
                placeholder="Anonym"
                style={inp}
              />
            </label>
          </div>
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
