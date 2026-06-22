import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PocketBase from 'pocketbase'

const pb = new PocketBase('https://api.responda.systems')

function parseDate(str: string | null | undefined): Date {
  if (!str) return new Date(NaN)
  let s = str.trim().replace(' ', 'T')
  if (!s.endsWith('Z') && !s.includes('+') && !/ [+-]\d{2}:\d{2}$/.test(s)) s += 'Z'
  return new Date(s)
}

function fmtDate(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toICSDate(str: string): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

interface TokenRecord {
  id: string; token: string; termin_id: string; termin_name: string
  termin_datum: string; termin_end_datum?: string; termin_ort: string
  termin_beschreibung: string; organization_id?: string
}

function CalendarButtons({ record }: { record: TokenRecord }) {
  const start = toICSDate(record.termin_datum)
  const end = record.termin_end_datum ? toICSDate(record.termin_end_datum) : start
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(record.termin_name)}&dates=${start}/${end}` +
    `&details=${encodeURIComponent(record.termin_beschreibung || '')}` +
    `&location=${encodeURIComponent(record.termin_ort || '')}`

  function downloadICS() {
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Responda//Einladung//DE',
      'BEGIN:VEVENT',`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${record.termin_name}`,
      `DESCRIPTION:${(record.termin_beschreibung || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${record.termin_ort || ''}`, 'END:VEVENT','END:VCALENDAR'].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${record.termin_name.replace(/\s+/g, '_')}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '9px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', flex: 1,
    background: 'var(--lbf-card)', border: '1px solid var(--lbf-border)',
    color: 'var(--lbf-text)',
  }

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
        Zum Kalender hinzufügen
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <a href={googleUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84-.62-.7z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </a>
        <button onClick={downloadICS} style={btn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Apple / iCal
        </button>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img src="/logo.svg" alt="Responda" style={{ width: 26, height: 26, objectFit: 'contain' }} />
      </div>
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--lbf-text)', letterSpacing: '-0.01em' }}>Responda</span>
    </div>
  )
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <span style={{ color: 'rgba(253,232,216,0.6)', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'rgba(253,232,216,0.85)', fontStyle: 'italic' }}>{text}</span>
    </div>
  )
}

export default function Einladung() {
  const { token } = useParams<{ token: string }>()
  const [record, setRecord] = useState<TokenRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState<'zusagen' | 'absagen' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setError('Ungültiger Link.'); setLoading(false); return }
    const saved = localStorage.getItem(`einladung_${token}`)
    const savedName = localStorage.getItem(`einladung_${token}_name`)
    if (savedName) setName(savedName)
    if (saved === 'zusagen' || saved === 'absagen') setSubmitted(saved as 'zusagen' | 'absagen')
    loadToken()
  }, [token])

  async function loadToken() {
    try {
      const result = await pb.collection('ausbildungen_einladungs_tokens').getFirstListItem(
        `token = "${token}"`, { requestKey: `inv-${Date.now()}` }
      )
      setRecord(result as unknown as TokenRecord)
    } catch {
      setError('Dieser Einladungslink ist ungültig oder abgelaufen.')
    } finally {
      setLoading(false)
    }
  }

  async function respond(status: 'zusagen' | 'absagen') {
    if (!name.trim()) { alert('Bitte gib deinen Namen ein.'); return }
    if (!record || !token) return
    setSubmitting(true)
    const trimmedName = name.trim()
    const payload = {
      token, termin_id: record.termin_id, name: trimmedName, status,
      organization_id: record.organization_id,
    }
    try {
      let saved: { id: string } | null = null

      // 0. Bevorzugt: serverseitiger Upsert-Hook (aktualisiert sicher, geräteübergreifend)
      try {
        const res = await pb.send('/einladung/respond', {
          method: 'POST',
          body: { token, name: trimmedName, status },
          requestKey: `rsvp-hook-${Date.now()}`,
        }) as { id?: string; success?: boolean }
        if (res?.success && res.id) saved = { id: res.id }
      } catch { saved = null }

      // 1. Fallback (Hook nicht verfügbar): bekannter Datensatz aus diesem Browser -> aktualisieren
      const savedId = localStorage.getItem(`einladung_${token}_id`)
      if (!saved && savedId) {
        try {
          saved = await pb.collection('ausbildungen_einladungen').update(savedId, payload, { requestKey: `rsvp-upd-${Date.now()}` })
        } catch { saved = null }
      }

      // 2. Sonst: bestehende Antwort gleichen Namens für diesen Token suchen
      if (!saved) {
        try {
          const existing = await pb.collection('ausbildungen_einladungen').getFirstListItem(
            `token = "${token}" && name = "${trimmedName.replace(/"/g, '')}"`,
            { requestKey: `rsvp-find-${Date.now()}` }
          )
          saved = await pb.collection('ausbildungen_einladungen').update(existing.id, payload, { requestKey: `rsvp-upd2-${Date.now()}` })
        } catch { saved = null }
      }

      // 3. Sonst: neu anlegen
      if (!saved) {
        saved = await pb.collection('ausbildungen_einladungen').create(payload, { requestKey: `rsvp-${Date.now()}` })
      }

      localStorage.setItem(`einladung_${token}`, status)
      localStorage.setItem(`einladung_${token}_name`, trimmedName)
      if (saved?.id) localStorage.setItem(`einladung_${token}_id`, saved.id)
      setSubmitted(status)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const page: React.CSSProperties = {
    minHeight: '100dvh', background: 'var(--warm-bg)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '32px 20px',
    fontFamily: "'Atkinson Hyperlegible', Georgia, serif",
  }

  if (loading) {
    return (
      <div style={page}>
        <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 15 }}>Laden…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={page}>
        <Logo />
        <div style={{ background: 'var(--lbf-card)', borderRadius: 16, padding: '32px 28px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: 'var(--lbf-shadow)', borderLeft: '3px solid rgba(96,8,18,0.25)' }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: 'var(--lbf-text)' }}>Link nicht gefunden</div>
          <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 14 }}>{error}</div>
        </div>
      </div>
    )
  }

  const startTime = fmtTime(record?.termin_datum)
  const endTime = record?.termin_end_datum ? fmtTime(record.termin_end_datum) : ''

  if (submitted) {
    return (
      <div style={page}>
        <Logo />
        <div style={{ background: 'var(--lbf-card)', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: 'var(--lbf-shadow)' }}>
          {/* Karten-Header */}
          <div style={{ background: '#3d0408', padding: '28px 28px 24px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(253,232,216,0.45)', marginBottom: 10 }}>Einladung · Responda</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: '#fde8d8', letterSpacing: '-0.02em', marginBottom: 14 }}>{record?.termin_name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <InfoRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} text={fmtDate(record?.termin_datum)} />
              {startTime && <InfoRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} text={`${startTime}${endTime ? ` – ${endTime}` : ''} Uhr`} />}
              {record?.termin_ort && <InfoRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>} text={record.termin_ort} />}
            </div>
          </div>

          <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
                background: submitted === 'zusagen' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${submitted === 'zusagen' ? '#16a34a' : '#dc2626'}`,
              }}>
                {submitted === 'zusagen'
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                }
              </div>
              <div style={{ fontWeight: 800, fontSize: 20, fontStyle: 'italic', color: 'var(--lbf-text)', marginBottom: 4 }}>
                {submitted === 'zusagen' ? 'Zugesagt' : 'Abgesagt'}
              </div>
              <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 13 }}>
                {submitted === 'zusagen' ? 'Wir freuen uns auf dich!' : 'Schade, vielleicht beim nächsten Mal.'}
              </div>
            </div>
            {submitted === 'zusagen' && record && <CalendarButtons record={record} />}
            <button
              onClick={() => setSubmitted(null)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1px solid var(--lbf-border)', background: 'transparent',
                color: 'var(--warm-gray)', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Antwort ändern
            </button>
            <div style={{ textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: -10 }}>
              Du kannst deine Rückmeldung jederzeit anpassen.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <Logo />
      <div style={{ background: 'var(--lbf-card)', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: 'var(--lbf-shadow)' }}>

        {/* Karten-Header dunkelrot */}
        <div style={{ background: '#3d0408', padding: '28px 28px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(253,232,216,0.45)', marginBottom: 10 }}>Einladung · Responda</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: '#fde8d8', letterSpacing: '-0.02em', marginBottom: 14 }}>{record?.termin_name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InfoRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} text={fmtDate(record?.termin_datum)} />
            {startTime && <InfoRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} text={`${startTime}${endTime ? ` – ${endTime}` : ''} Uhr`} />}
            {record?.termin_ort && <InfoRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>} text={record.termin_ort} />}
          </div>
        </div>

        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {record?.termin_beschreibung && (
            <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', paddingTop: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Details</div>
              <p style={{ fontSize: 14, color: 'var(--lbf-text)', lineHeight: 1.65, margin: 0, opacity: 0.85 }}>{record.termin_beschreibung}</p>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Dein Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--lbf-input-border)',
                background: 'var(--lbf-input-bg)',
                fontSize: 15, fontFamily: 'inherit', color: 'var(--lbf-text)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => respond('zusagen')}
              disabled={submitting || !name.trim()}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                background: submitting || !name.trim() ? 'rgba(96,8,18,0.4)' : '#600812',
                color: '#fff', fontWeight: 700, fontSize: 15,
                cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontStyle: 'italic',
              }}
            >
              Zusagen
            </button>
            <button
              onClick={() => respond('absagen')}
              disabled={submitting || !name.trim()}
              style={{
                flex: 1, padding: '13px', borderRadius: 12,
                border: '1px solid var(--lbf-border)',
                background: 'transparent',
                color: 'var(--warm-gray)', fontWeight: 700, fontSize: 15,
                cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer',
                opacity: submitting || !name.trim() ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              Absagen
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
        responda.systems
      </div>
    </div>
  )
}
