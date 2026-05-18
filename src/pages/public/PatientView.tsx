import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { parsePayload } from '../patienten/types'
import type { PatientPayload } from '../patienten/types'
import { PubWrap } from './pubStyles'
import ProtokollView from '../../components/ProtokollView'

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

// ─── Rate limiting ────────────────────────────────────────────────────────────
type Status = 'loading' | 'auth' | 'valid' | 'expired' | 'notfound' | 'error' | 'locked'
const MAX_ATTEMPTS = 5
const attemptsKey = (c: string) => `dob_attempts_${c}`
function getAttempts(c: string) { try { return parseInt(localStorage.getItem(attemptsKey(c)) || '0', 10) } catch { return 0 } }
function bumpAttempts(c: string) { const n = getAttempts(c) + 1; try { localStorage.setItem(attemptsKey(c), String(n)) } catch {}; return n }
function clearAttempts(c: string) { try { localStorage.removeItem(attemptsKey(c)) } catch {} }
function normDob(d: string) {
  const s = d.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, day] = s.split('-'); return `${day}.${m}.${y}` }
  return s
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PatientView() {
  const { code } = useParams<{ code: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [p, setP] = useState<PatientPayload | null>(null)
  const [expiry, setExpiry] = useState<Date | null>(null)
  const [recId, setRecId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [dobInput, setDobInput] = useState('')
  const [dobError, setDobError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)

  useEffect(() => {
    if (!code) { setStatus('notfound'); return }
    if (getAttempts(code) >= MAX_ATTEMPTS) { setStatus('locked'); return }
    loadByCode(code)
  }, [code])

  async function logAccess(event: string, payload?: PatientPayload, rid?: string, oid?: string) {
    try {
      const name = payload ? [payload.vorname, payload.name].filter(Boolean).join(' ') : ''
      await pb.collection('access_logs').create({ access_code: code, patient_id: rid || recId, patient_name: name, organization_id: oid || orgId, event, user_agent: navigator.userAgent })
    } catch {}
  }

  async function loadByCode(c: string) {
    try {
      const records = await pb.collection('patients').getList(1, 200, { filter: `payload ~ '"access_code":"${c}"'` })
      const rec = records.items[0]
      if (!rec) { setStatus('notfound'); return }
      const payload = parsePayload(rec.payload)
      if (!payload.access_code || payload.access_code !== c) { setStatus('notfound'); return }
      if (!payload.access_code_created) { setStatus('expired'); return }
      const created = new Date(payload.access_code_created)
      const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000)
      if (new Date() > expires) { await logAccess('expired', payload, rec.id, rec.organization_id); setStatus('expired'); return }
      setP(payload); setExpiry(expires); setRecId(rec.id); setOrgId(rec.organization_id || '')
      if (!payload.gebdatum) { await logAccess('granted', payload, rec.id, rec.organization_id); setStatus('valid') }
      else { setAttemptsLeft(MAX_ATTEMPTS - getAttempts(c)); setStatus('auth') }
    } catch (e: any) {
      setStatus(e?.status === 403 || e?.status === 401 ? 'error' : 'notfound')
    }
  }

  async function verifyDob() {
    if (!p || !code || !dobInput) return
    if (normDob(p.gebdatum || '') === normDob(dobInput)) {
      clearAttempts(code); await logAccess('granted'); setStatus('valid')
    } else {
      const n = bumpAttempts(code); const left = MAX_ATTEMPTS - n
      if (left <= 0) { await logAccess('locked'); setStatus('locked') }
      else { await logAccess('dob_failed'); setDobError(`Falsches Geburtsdatum. Noch ${left} Versuch${left === 1 ? '' : 'e'}.`); setAttemptsLeft(left) }
    }
  }

  const centerCard = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>{children}</div>
    </div>
  )

  if (status === 'loading') return centerCard(<><div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#c0392b', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><div style={{ color: '#6b7280' }}>Lade Patientendaten…</div></>)

  if (status === 'auth') return centerCard(<>
    <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
    <h2 style={{ color: '#111827', margin: '0 0 16px', fontSize: '1.2rem' }}>Zugang bestätigen</h2>
    {p && (p.vorname || p.name || p.rufname) && (
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
        {(p.vorname || p.name) && <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 4 }}>{[p.vorname, p.name].filter(Boolean).join(' ')}</div>}
        {p.rufname && <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>{pik(<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>, 13)}Funkrufname: <strong style={{ color: '#374151' }}>{p.rufname}</strong></div>}
      </div>
    )}
    <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: 14, lineHeight: 1.5 }}>Geburtsdatum des Patienten eingeben um das Protokoll einzusehen.</p>
    <input type="date" value={dobInput} onChange={e => { setDobInput(e.target.value); setDobError('') }} onKeyDown={e => e.key === 'Enter' && verifyDob()} style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${dobError ? '#c0392b' : '#e5e7eb'}`, borderRadius: 10, fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8, outline: 'none' }} autoFocus />
    {dobError ? <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{dobError}</div> : <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>{attemptsLeft} von {MAX_ATTEMPTS} Versuchen verbleibend</div>}
    <button onClick={verifyDob} disabled={!dobInput} style={{ width: '100%', padding: '12px', background: dobInput ? '#c0392b' : '#e5e7eb', color: dobInput ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: dobInput ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Zugang öffnen</button>
  </>)

  if (status === 'locked') return centerCard(<><div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div><h2 style={{ color: '#c0392b', margin: '0 0 8px' }}>Zugang gesperrt</h2><p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Zu viele Fehleingaben. Bitte Einsatzkräfte der Organisation kontaktieren.</p></>)
  if (status === 'expired') return centerCard(<><div style={{ fontSize: 48, marginBottom: 16 }}>⏱</div><h2 style={{ color: '#c0392b', margin: '0 0 8px' }}>Zugang abgelaufen</h2><p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Der 24-Stunden-Zugang für dieses Protokoll ist abgelaufen.</p></>)
  if (status === 'notfound' || status === 'error') return centerCard(<><div style={{ fontSize: 48, marginBottom: 16 }}>❌</div><h2 style={{ color: '#111827', margin: '0 0 8px' }}>Nicht gefunden</h2><p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Dieser Code ist ungültig oder das Protokoll existiert nicht.</p></>)
  if (!p) return null

  const changedFields = new Set<string>((p as any)._changed_fields || [])
  const tfChangedFields = new Set<string>((p as any)._tf_changed_fields || [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <header style={{ position: 'sticky', top: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1rem', height: 54, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Patientendokumentation</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Code {code} · Gültig bis {expiry?.toLocaleString('de-DE')}</div>
          </div>
          <div style={{ background: '#c0392b', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>LESE-ZUGANG</div>
        </div>
      </header>

      <PubWrap>
        <ProtokollView payload={p} changedFields={changedFields} tfChangedFields={tfChangedFields} />

        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16, margin: '1.5rem 0', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Zugang endet {expiry?.toLocaleString('de-DE')}</div>
          <div style={{ fontSize: 13, color: '#92400e' }}>Nach Ablauf ist dieses Protokoll nicht mehr einsehbar.</div>
        </div>
      </PubWrap>
    </div>
  )
}
