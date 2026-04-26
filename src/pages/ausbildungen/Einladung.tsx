import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PocketBase from 'pocketbase'

const pb = new PocketBase('https://api.responda.systems')

function parseDate(str: string | null | undefined): Date {
  if (!str) return new Date(NaN)
  let s = str.trim().replace(' ', 'T')
  if (!s.endsWith('Z') && !s.includes('+') && !/ [+-]\d{2}:\d{2}$/.test(s)) {
    s += 'Z'
  }
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
  id: string
  token: string
  termin_id: string
  termin_name: string
  termin_datum: string
  termin_end_datum?: string
  termin_ort: string
  termin_beschreibung: string
}

function CalendarButtons({ record }: { record: TokenRecord }) {
  const start = toICSDate(record.termin_datum)
  const end = record.termin_end_datum ? toICSDate(record.termin_end_datum) : start

  // Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(record.termin_name)}` +
    `&dates=${start}/${end}` +
    `&details=${encodeURIComponent(record.termin_beschreibung || '')}` +
    `&location=${encodeURIComponent(record.termin_ort || '')}`

  // iCal / Apple (.ics download)
  function downloadICS() {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Responda//Einladung//DE',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${record.termin_name}`,
      `DESCRIPTION:${(record.termin_beschreibung || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${record.termin_ort || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${record.termin_name.replace(/\s+/g, '_')}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 16px', borderRadius: '10px', fontWeight: 600,
    fontSize: '13px', cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'inherit', border: 'none', flex: 1, justifyContent: 'center'
  }

  return (
    <div>
      <div style={{fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px'}}>
        Zum Kalender hinzufügen
      </div>
      <div style={{display: 'flex', gap: '8px'}}>
        <a href={googleUrl} target="_blank" rel="noreferrer" style={{...btnBase, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google
        </a>
        <button onClick={downloadICS} style={{...btnBase, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Apple / iCal
        </button>
      </div>
    </div>
  )
}

function RespondaLogo() {
  return (
    <div style={{textAlign: 'center', marginBottom: '24px'}}>
      <svg width="140" height="32" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="#0f172a"/>
        <path d="M8 10h10a6 6 0 0 1 0 12H8V10z" fill="none" stroke="white" strokeWidth="2"/>
        <circle cx="18" cy="16" r="3" fill="white"/>
        <text x="40" y="22" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="18" fill="#0f172a" letterSpacing="-0.5">responda</text>
      </svg>
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
    if (saved === 'zusagen' || saved === 'absagen') setSubmitted(saved)
    loadToken()
  }, [token])

  async function loadToken() {
    try {
      const result = await pb.collection('ausbildungen_einladungs_tokens').getFirstListItem(
        `token = "${token}"`,
        { requestKey: `inv-${Date.now()}` }
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
    try {
      await pb.collection('ausbildungen_einladungen').create({
        token,
        termin_id: record.termin_id,
        name: name.trim(),
        status
      }, { requestKey: `rsvp-${Date.now()}` })
      localStorage.setItem(`einladung_${token}`, status)
      setSubmitted(status)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px 20px'
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{color: 'var(--text-secondary)', fontSize: '15px'}}>Lade...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <RespondaLogo />
        <div style={{background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-md)'}}>
          <div style={{fontWeight: 700, fontSize: '18px', marginBottom: '8px', color: 'var(--text)'}}>Link nicht gefunden</div>
          <div style={{color: 'var(--text-secondary)', fontSize: '14px'}}>{error}</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        <RespondaLogo />
        <div style={{background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '440px', width: '100%', overflow: 'hidden', boxShadow: 'var(--shadow-md)'}}>
          <div style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '24px 28px', color: '#fff'}}>
            <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px'}}>Einladung</div>
            <div style={{fontSize: '20px', fontWeight: 700, marginBottom: '4px'}}>{record?.termin_name}</div>
            <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.65)'}}>{fmtDate(record?.termin_datum)}</div>
            {record && (
              <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '2px'}}>
                {fmtTime(record.termin_datum)}{record.termin_end_datum && fmtTime(record.termin_end_datum) ? ` – ${fmtTime(record.termin_end_datum)} Uhr` : ' Uhr'}
              </div>
            )}
            {record?.termin_ort && <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '2px'}}>{record.termin_ort}</div>}
          </div>

          <div style={{padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
            <div style={{textAlign: 'center'}}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%', margin: '0 auto 12px',
                background: submitted === 'zusagen' ? '#dcfce7' : '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {submitted === 'zusagen'
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B03050" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                }
              </div>
              <div style={{fontWeight: 700, fontSize: '18px', color: 'var(--text)', marginBottom: '4px'}}>
                {submitted === 'zusagen' ? 'Zugesagt' : 'Abgesagt'}
              </div>
              <div style={{color: 'var(--text-secondary)', fontSize: '13px'}}>
                {submitted === 'zusagen' ? 'Wir freuen uns auf dich!' : 'Schade, vielleicht beim nächsten Mal.'}
              </div>
            </div>

            {submitted === 'zusagen' && record && <CalendarButtons record={record} />}
          </div>
        </div>
      </div>
    )
  }

  const startTime = fmtTime(record?.termin_datum)
  const endTime = record?.termin_end_datum ? fmtTime(record.termin_end_datum) : ''

  return (
    <div style={pageStyle}>
      <RespondaLogo />
      <div style={{background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '440px', width: '100%', overflow: 'hidden', boxShadow: 'var(--shadow-md)'}}>
        {/* Header */}
        <div style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '28px 28px 24px', color: '#fff'}}>
          <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px'}}>Einladung</div>
          <div style={{fontSize: '22px', fontWeight: 700, marginBottom: '8px'}}>{record?.termin_name}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.7)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {fmtDate(record?.termin_datum)}
            </div>
            {startTime && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.7)'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {startTime}{endTime ? ` – ${endTime}` : ''} Uhr
              </div>
            )}
            {record?.termin_ort && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.7)'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {record.termin_ort}
              </div>
            )}
          </div>
        </div>

        <div style={{padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
          {record?.termin_beschreibung && (
            <div style={{fontSize: '14px', color: 'var(--text)', lineHeight: 1.6}}>
              {record.termin_beschreibung}
            </div>
          )}

          <div>
            <label style={{display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px'}}>Dein Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              style={{width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '15px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'}}
            />
          </div>

          <div style={{display: 'flex', gap: '10px'}}>
            <button
              onClick={() => respond('zusagen')}
              disabled={submitting || !name.trim()}
              style={{flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !name.trim() ? 0.6 : 1, fontFamily: 'inherit'}}
            >
              Zusagen
            </button>
            <button
              onClick={() => respond('absagen')}
              disabled={submitting || !name.trim()}
              style={{flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, fontSize: '15px', cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !name.trim() ? 0.6 : 1, fontFamily: 'inherit'}}
            >
              Absagen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
