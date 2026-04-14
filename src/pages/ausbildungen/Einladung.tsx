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

function fmtDateTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface TokenRecord {
  id: string
  token: string
  termin_id: string
  termin_name: string
  termin_datum: string
  termin_ort: string
  termin_beschreibung: string
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

    // Check if already responded
    const saved = localStorage.getItem(`einladung_${token}`)
    if (saved === 'zusagen' || saved === 'absagen') {
      setSubmitted(saved)
    }

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

  if (loading) {
    return (
      <div style={{minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#64748b', fontSize: '15px'}}>Lade...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
        <div style={{background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>?</div>
          <div style={{fontWeight: 700, fontSize: '18px', marginBottom: '8px', color: '#0f172a'}}>Link nicht gefunden</div>
          <div style={{color: '#64748b', fontSize: '14px'}}>{error}</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
        <div style={{background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'}}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
            background: submitted === 'zusagen' ? '#dcfce7' : '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {submitted === 'zusagen' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
          <div style={{fontWeight: 700, fontSize: '20px', marginBottom: '8px', color: '#0f172a'}}>
            {submitted === 'zusagen' ? 'Zugesagt' : 'Abgesagt'}
          </div>
          <div style={{color: '#64748b', fontSize: '14px', marginBottom: '20px'}}>
            {submitted === 'zusagen'
              ? 'Du hast zugesagt. Wir freuen uns auf dich!'
              : 'Du hast abgesagt. Schade, vielleicht beim nächsten Mal.'}
          </div>
          {record && (
            <div style={{background: '#f8fafc', borderRadius: '10px', padding: '14px', textAlign: 'left'}}>
              <div style={{fontWeight: 700, fontSize: '15px', marginBottom: '6px'}}>{record.termin_name}</div>
              <div style={{fontSize: '13px', color: '#64748b'}}>{fmtDateTime(record.termin_datum)}</div>
              {record.termin_ort && <div style={{fontSize: '13px', color: '#64748b', marginTop: '2px'}}>{record.termin_ort}</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
      <div style={{background: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'}}>
        {/* Header */}
        <div style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '28px 28px 24px', color: '#fff'}}>
          <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px'}}>Einladung</div>
          <div style={{fontSize: '22px', fontWeight: 700, marginBottom: '6px'}}>{record?.termin_name}</div>
          <div style={{fontSize: '14px', color: 'rgba(255,255,255,0.65)'}}>{fmtDateTime(record?.termin_datum)}</div>
          {record?.termin_ort && <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '2px'}}>{record.termin_ort}</div>}
        </div>

        <div style={{padding: '24px 28px'}}>
          {record?.termin_beschreibung && (
            <div style={{fontSize: '14px', color: '#374151', marginBottom: '24px', lineHeight: 1.6}}>
              {record.termin_beschreibung}
            </div>
          )}

          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px'}}>Dein Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              style={{width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'}}
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
              style={{flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 700, fontSize: '15px', cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !name.trim() ? 0.6 : 1, fontFamily: 'inherit'}}
            >
              Absagen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
