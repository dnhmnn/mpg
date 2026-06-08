import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'

type Severity = 'low' | 'medium' | 'high' | 'critical'

interface DeviceSummary {
  id: string
  name: string
  type: string
  location: string
}

const SEVERITY_CFG: Record<Severity, { label: string; color: string; bg: string }> = {
  low:      { label: 'Gering',   color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
  medium:   { label: 'Mittel',   color: '#ea580c', bg: 'rgba(234,88,12,0.08)'  },
  high:     { label: 'Hoch',     color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
  critical: { label: 'Kritisch', color: '#7f1d1d', bg: 'rgba(127,29,29,0.12)'  },
}

function pik(ch: React.ReactNode, sz = 20) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ch}</svg>
  )
}

export default function OrgDefektmeldung() {
  const { org } = useOrg()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('device') || ''

  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [selectedId, setSelectedId] = useState(preselectedId)
  const [reporterName, setReporterName] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    pb.collection('mpg_devices').getFullList<DeviceSummary>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
      fields: 'id,name,type,location',
    }).then(r => { setDevices(r); setLoadingDevices(false) }).catch(() => setLoadingDevices(false))
  }, [org.id])

  const selectedDevice = devices.find(d => d.id === selectedId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !description.trim()) return
    setSubmitting(true)
    setError('')
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
      setSubmitted(true)
    } catch {
      setError('Fehler beim Senden. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  const baseStyle: React.CSSProperties = {
    minHeight: '100dvh',
    background: '#faf9f7',
    fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 calc(40px + env(safe-area-inset-bottom))',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid rgba(96,8,18,0.15)', background: '#fff',
    fontSize: 15, color: '#1a0e08', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  }

  if (submitted) {
    return (
      <div style={{ ...baseStyle, justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff' }}>
            {pik(<polyline points="20 6 9 17 4 12"/>, 28)}
          </div>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#1a0e08', marginBottom: 8 }}>Meldung eingegangen</div>
          <div style={{ fontSize: 14, color: '#8a7a68', fontStyle: 'italic', marginBottom: 24 }}>
            Deine Defektmeldung für <strong style={{ fontStyle: 'normal', color: '#1a0e08' }}>{selectedDevice?.name}</strong> wurde übermittelt und wird geprüft.
          </div>
          <button
            onClick={() => { setSubmitted(false); setDescription(''); setReporterName(''); setSeverity('medium'); if (!preselectedId) setSelectedId('') }}
            style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Neue Meldung
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={baseStyle}>
      {/* Header */}
      <div style={{ width: '100%', background: '#600812', padding: 'calc(env(safe-area-inset-top) + 24px) 24px 24px', textAlign: 'center' }}>
        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'rgba(253,232,216,0.7)', marginBottom: 4 }}>{org.org_name}</div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#fde8d8', lineHeight: 1.25 }}>Defektmeldung</div>
        <div style={{ fontStyle: 'italic', fontSize: 13, color: 'rgba(253,232,216,0.7)', marginTop: 8 }}>Medizinprodukt als defekt melden</div>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ width: '100%', maxWidth: 560, padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Device selector */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#600812' }}>
            Gerät *
          </span>
          {loadingDevices ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: '#fff', fontSize: 14, color: '#8a7a68', fontStyle: 'italic' }}>Geräteliste wird geladen…</div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: '#fff', fontSize: 14, color: '#8a7a68', fontStyle: 'italic' }}>Keine Geräte gefunden</div>
          ) : (
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} required style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }}>
              <option value="">– Gerät auswählen –</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.location ? ` (${d.location})` : ''} · {d.type}
                </option>
              ))}
            </select>
          )}
        </label>

        {/* Reporter name */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#600812' }}>
            Dein Name (optional)
          </span>
          <input
            type="text"
            value={reporterName}
            onChange={e => setReporterName(e.target.value)}
            placeholder="Anonym"
            style={inputStyle}
          />
        </label>

        {/* Description */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#600812' }}>
            Beschreibung *
          </span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Was genau ist defekt? Wie macht sich das Problem bemerkbar?"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </label>

        {/* Severity */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#600812' }}>
            Schweregrad
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.entries(SEVERITY_CFG) as [Severity, typeof SEVERITY_CFG[Severity]][]).map(([key, cfg]) => (
              <button
                key={key} type="button"
                onClick={() => setSeverity(key)}
                style={{ padding: '12px', borderRadius: 10, border: `1.5px solid ${severity === key ? cfg.color : 'rgba(96,8,18,0.12)'}`, background: severity === key ? cfg.bg : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: cfg.color }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </label>

        {error && (
          <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.06)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, fontSize: 13, color: '#dc2626', fontStyle: 'italic' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedId || !description.trim()}
          style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: (submitting || !selectedId || !description.trim()) ? 'rgba(96,8,18,0.35)' : '#600812', color: '#fff', fontSize: 16, fontWeight: 700, cursor: (submitting || !selectedId || !description.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {submitting ? 'Wird gesendet…' : 'Defekt melden'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, fontStyle: 'italic', color: '#8a7a68', opacity: 0.6 }}>
          © 2025 Responda Systems
        </div>
      </form>
    </div>
  )
}
