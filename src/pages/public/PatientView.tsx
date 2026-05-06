import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { parsePayload } from '../patienten/types'
import type { PatientPayload } from '../patienten/types'
import { PubSection, PubWrap, lbl, inp } from './pubStyles'

// ─── same helpers as OrgPatienten ────────────────────────────────────────────
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }
const activePill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '0.5px solid transparent', borderRadius: 999, padding: '.2rem .6rem', background: 'var(--accent)', fontSize: '.9rem', margin: '2px', color: '#fff', fontWeight: 700 }
const inactivePill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '0.5px solid var(--border-medium)', borderRadius: 999, padding: '.2rem .6rem', background: 'var(--bg-subtle)', fontSize: '.9rem', margin: '2px', color: 'var(--text)', fontWeight: 400 }

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

// Read-only field — looks identical to lbl+inp in OrgPatienten
function Val({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <label style={lbl}>
      {label}
      <div style={{ ...inp, color: (value !== null && value !== undefined && value !== '') ? 'var(--text)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', marginTop: 6 }}>
        {(value !== null && value !== undefined && value !== '') ? String(value) : '—'}
      </div>
    </label>
  )
}

// Read-only pill — mirrors OrgPatienten checkbox/radio pills
function Pill({ active, label }: { active?: boolean; label: string }) {
  return <span style={active ? activePill : inactivePill}>{label}</span>
}

function Pills({ items }: { items: [boolean | undefined, string][] }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap' }}>{items.map(([a, l]) => <Pill key={l} active={!!a} label={l} />)}</div>
}

function PillGroup({ title, items }: { title: string; items: [boolean | undefined, string][] }) {
  return (
    <div style={{ marginBottom: '.75rem' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{title}</div>
      <Pills items={items} />
    </div>
  )
}

function CatGroup({ cat, items, p }: { cat: string; items: [string, string][]; p: any }) {
  return (
    <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.5rem', marginTop: '.5rem' }}>
      <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{cat}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {items.map(([n, l]) => <Pill key={n} active={!!p[n]} label={l} />)}
      </div>
    </div>
  )
}

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

  // ── Mannschaft ───────────────────────────────────────────────────────────
  const mann = (p as any).mannschaft || {}
  const meds = (p as any).medications || []
  const verlauf: any[] = (p as any).verlauf || []
  const gcsSum = ((p as any).gcs_e || 0) + ((p as any).gcs_v || 0) + ((p as any).gcs_m || 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header — matches PubHeader style but red for Rettungsdienst */}
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

        {/* Mannschaft */}
        <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
            {pik(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>)} Mannschaft
          </div>
          <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }}>
            <Val label="Teamführer" value={mann?.tf?.name} />
            <Val label="Mannschaft 1" value={mann?.m1?.name} />
            <Val label="Mannschaft 2" value={mann?.m2?.name} />
            <Val label="Mannschaft 3" value={mann?.m3?.name} />
          </div>
        </div>

        {/* Einsatzdaten */}
        <PubSection title="Einsatzdaten" open icon={pik(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>)}>
          <div style={grid}>
            <Val label="Einsatz-Nr." value={(p as any).einsatz_nr} />
            <Val label="Auftrags-Nr. (ILS)" value={(p as any).auftrags_nr} />
            <Val label="Rufname" value={(p as any).rufname} />
            <Val label="Fahrzeug / Einheit" value={(p as any).fahrzeug} />
            <Val label="Einsatzart / Stichwort" value={(p as any).einsatz_art} />
            <Val label="Alarmzeit" value={(p as any).zeit_einsatz} />
            <Val label="Einsatzort / Adresse" value={(p as any).einsatz_adresse} />
            <Val label="Transportziel" value={(p as any).transport_ziel} />
          </div>
          <div style={{ ...grid, marginTop: '.75rem' }}>
            <Val label="Status 3" value={(p as any).zeit_status3} />
            <Val label="Eintreffen" value={(p as any).zeit_eintreffen} />
            <Val label="Status 1" value={(p as any).zeit_status1} />
            <Val label="Status 2" value={(p as any).zeit_status2} />
            <Val label="Übergabe" value={(p as any).zeit_uebergabe} />
          </div>
        </PubSection>

        {/* Einsatz-Zeitstrahl */}
        <PubSection title="Einsatz-Zeitstrahl" icon={pik(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>)}>
          {(() => {
            const STEP_COLORS = ['#6B1A2A', '#9E2A3A', '#C94D6A', '#2563eb', '#16a34a', '#166534']
            const fmtDT = (v?: string) => {
              if (!v) return null
              try {
                const d = new Date(v)
                if (isNaN(d.getTime())) return null
                return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              } catch { return null }
            }
            const steps = [
              { label: 'Alarm',    sub: 'Meldungseingang',   badge: '!', time: fmtDT((p as any).zeit_einsatz) },
              { label: 'Status 3', sub: 'Ausgerückt',         badge: '3', time: fmtDT((p as any).zeit_status3) },
              { label: 'Status 4', sub: 'Eintreffen',         badge: '4', time: fmtDT((p as any).zeit_eintreffen) },
              { label: 'Übergabe', sub: 'Patient übergeben',  badge: '✓', time: fmtDT((p as any).zeit_uebergabe) },
              { label: 'Status 1', sub: 'Wieder frei',        badge: '1', time: fmtDT((p as any).zeit_status1) },
              { label: 'Status 2', sub: 'Am Standort',        badge: '2', time: fmtDT((p as any).zeit_status2) },
            ]
            return (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', position: 'relative', minWidth: 480, paddingBottom: 8 }}>
                  <div style={{ position: 'absolute', left: `calc(100% / ${steps.length * 2})`, right: `calc(100% / ${steps.length * 2})`, top: 13, height: 2, background: 'var(--border)' }} />
                  {steps.map((step, i) => {
                    const color = STEP_COLORS[i]
                    const known = !!step.time
                    return (
                      <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        {i > 0 && known && <div style={{ position: 'absolute', right: '50%', top: 13, height: 2, left: 0, background: color, zIndex: 0 }} />}
                        <div style={{ width: 28, height: 28, borderRadius: '50%', position: 'relative', zIndex: 1, flexShrink: 0, background: known ? color : 'var(--bg)', border: `2px solid ${known ? color : 'var(--border-medium)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: known ? `0 0 0 4px ${color}22` : 'none' }}>
                          <span style={{ fontSize: '.62rem', fontWeight: 800, color: known ? '#fff' : 'var(--text-secondary)', lineHeight: 1 }}>{step.badge}</span>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 8, padding: '0 3px' }}>
                          <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{step.label}</div>
                          <div style={{ fontSize: '.67rem', color: 'var(--text-secondary)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{step.sub}</div>
                          <div style={{ fontSize: '.9rem', fontWeight: 800, marginTop: 6, color: known ? color : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {step.time ?? '–'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </PubSection>

        {/* Pat-Stammdaten */}
        <PubSection title="Pat-Stammdaten" open icon={pik(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>)}>
          <div style={grid}>
            <Val label="Name" value={(p as any).name} />
            <Val label="Vorname" value={(p as any).vorname} />
            <Val label="Geb.-Datum" value={(p as any).gebdatum} />
            <Val label="Alter" value={(p as any).alter} />
            <Val label="Telefon" value={(p as any).telefon} />
            <Val label="Mobil" value={(p as any).mobil} />
            <Val label="Straße" value={(p as any).strasse} />
            <Val label="PLZ, Ort" value={(p as any).plz_ort} />
            <Val label="Kasse" value={(p as any).kasse} />
            <Val label="Vers.-Nr." value={(p as any).versnr} />
            <Val label="Hausarzt" value={(p as any).hausarzt} />
            <Val label="Angehöriger" value={(p as any).angehoeriger} />
          </div>
        </PubSection>

        {/* Notfallgeschehen */}
        <PubSection title="Notfallgeschehen / Anamnese" open icon={pik(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>)}>
          <Val label="Notfallgeschehen" value={(p as any).notfallgeschehen} />
          <Val label="Verlaufsbeschreibung" value={(p as any).verlaufsbeschreibung} />
          <div style={{ ...grid, marginTop: '.5rem' }}>
            <Val label="Vorerkrankungen" value={(p as any).vorerkrankungen} />
            <Val label="Dauermedikation Patient" value={(p as any).vormedikation_patient} />
          </div>
          <Val label="Allergien / Unverträglichkeiten" value={(p as any).allergien} />
          {(p as any).photos?.length > 0 && (
            <div style={{ marginTop: '.75rem' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>Fotos</div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                {(p as any).photos.map((src: string, i: number) => <img key={i} src={src} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />)}
              </div>
            </div>
          )}
        </PubSection>

        {/* NACA / Bewusstsein */}
        <PubSection title="NACA / Bewusstsein / Verdachtsdiagnose" open icon={pik(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>)}>
          <PillGroup title="NACA-Score" items={['0','I','II','III','IV','V','VI','VII'].map(v => [(p as any).naca === v, v])} />
          <PillGroup title="Bewusstsein" items={['nicht beurteilbar','wach','getrübt','bewusstlos','reaktionslos','auf Ansprache','Reaktion auf Schmerz','analgosediert / Narkose'].map(v => [(p as any).bewusstsein === v, v])} />
          <Val label="Verdachtsdiagnose / Erstdiagnose" value={(p as any).erstdiagnose_text} />
        </PubSection>

        {/* GCS */}
        <PubSection title="Glasgow Coma Scale" icon={pik(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>)}>
          {([
            ['gcs_e', 'Augenöffnung (E)', [['4','spontan'],['3','auf Geräusch'],['2','auf Druck'],['1','keine']]],
            ['gcs_v', 'Verbale Antwort (V)', [['5','orientiert'],['4','verwirrt'],['3','Wörter'],['2','Laute'],['1','keine']]],
            ['gcs_m', 'Motorik (M)', [['6','folgt'],['5','lokalisiert'],['4','beugt norm.'],['3','beugt abnorm.'],['2','streckt'],['1','keine']]],
          ] as [string, string, [string,string][]][]).map(([key, title, opts]) => (
            <PillGroup key={key} title={title} items={opts.map(([v, l]) => [(p as any)[key] === Number(v) || (p as any)[key] === v, `${l} (${v})`])} />
          ))}
          <div style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontWeight: 700, color: 'var(--text)' }}>
            GCS Summe: <span style={{ fontSize: '1.2rem' }}>{gcsSum || '—'}</span>
          </div>
        </PubSection>

        {/* Messwerte / Atmung */}
        <PubSection title="Messwerte / Atmung" icon={pik(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>)}>
          <div style={grid}>
            {([['rr_sys','RR syst. (mmHg)'],['rr_dia','RR diast. (mmHg)'],['hf','HF (/min)'],['af','AF (/min)'],['spo2','SpO₂ (%)'],['etco2','etCO₂ (mmHg)'],['temp','Temp (°C)'],['bz_mg','BZ (mg/dl)'],['schmerz','Schmerz (0–10)']] as [string,string][]).map(([n,l]) => (
              <Val key={n} label={l} value={(p as any)[n]} />
            ))}
          </div>
          <PillGroup title="Atmung" items={[['atm_apnoe','Apnoe'],['atm_stridor','Stridor'],['atm_dyspnoe','Dyspnoe'],['atm_zyanose','Zyanose'],['atm_beatmung','Beatmung'],['atm_verlegung','Atemwegsverlegung']].map(([n,l]) => [!!(p as any)[n], l])} />
          <PillGroup title="O₂-Gabe" items={[['o2','O₂'],['o2_nasal','Nasensonde'],['o2_maske','Maske'],['o2_reservoir','Reservoir']].map(([n,l]) => [!!(p as any)[n], l])} />
          <Val label="Flow (l/min)" value={(p as any).o2_flow} />
        </PubSection>

        {/* Neurologie */}
        <PubSection title="Neurologie" icon={pik(<><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></>)}>
          <Pills items={[['neu_unauff','Unauffällig'],['neu_sprachstoerung','Sprachstörung'],['neu_demenz','Demenz'],['neu_meningismus','Meningismus'],['neu_seitenzeichen','Seitenzeichen'],['neu_kein_laecheln','Kein Lächeln'],['neu_sehstoerung','Sehstörung'],['neu_querschnitt','Querschnitt'],['neu_babinski','Babinski'],['neu_vorbestehend','Vorbestehende Defizite']].map(([n,l]) => [!!(p as any)[n], l])} />
          <div style={{ ...grid, marginTop: '.5rem' }}>
            <Val label="Sonstige Neurologie" value={(p as any).neu_sonstige} />
            <Val label="Zeitpunkt Symptombeginn" value={(p as any).neu_zeit} />
          </div>
          <PillGroup title="Extremitätenbewegung" items={[['ext_r_arm','Arm re.'],['ext_l_arm','Arm li.'],['ext_r_bein','Bein re.'],['ext_l_bein','Bein li.']].map(([n,l]) => [!!(p as any)[n], `${l}: ${(p as any)[n] || '—'}`])} />
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)', marginTop: '.5rem' }}>Pupillen</div>
          <div style={grid}>
            {[['pw_r','Pupille re.','lr_r'],['pw_l','Pupille li.','lr_l']].map(([n,l,lr]) => (
              <div key={n}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{l}</div>
                <Pills items={['eng','mittel','weit'].map(v => [(p as any)[n] === v, v])} />
                <div style={{ marginTop: 4, fontSize: '.8rem', color: 'var(--text-secondary)' }}>LR: <Pills items={['prompt','träge','keine'].map(v => [(p as any)[lr] === v, v])} /></div>
              </div>
            ))}
          </div>
        </PubSection>

        {/* Rhythmus / EKG */}
        <PubSection title="Rhythmus / EKG" icon={pik(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>)}>
          <Pills items={[['sr','Sinusrhythmus'],['stemi','STEMI'],['vf','Kammerflimmern'],['asystole','Asystolie'],['arrh_abs','Abs. Arrhythmie']].map(([n,l]) => [!!(p as any)[n], l])} />
          <div style={{ ...grid, marginTop: '.5rem' }}>
            <Val label="Standort" value={(p as any).ekg_standort} />
            <Val label="Pers-Nr." value={(p as any).ekg_persnr} />
          </div>
        </PubSection>

        {/* Haut / Psyche */}
        <PubSection title="Haut / Psyche" icon={pik(<><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>)}>
          <PillGroup title="Haut" items={[['haut_unauff','Unauffällig'],['haut_falten','Fältchentest pos.'],['haut_oedeme','Ödeme'],['haut_dekubitus','Dekubitus'],['haut_kaltschweissig','Kaltschweißig'],['haut_exanthem','Exanthem']].map(([n,l]) => [!!(p as any)[n], l])} />
          <PillGroup title="Psyche" items={[['psy_erregt','Erregt'],['psy_aggr','Aggressiv'],['psy_verlangsamt','Verlangsamt'],['psy_depressiv','Depressiv'],['psy_aengstlich','Ängstlich'],['psy_euphorisch','Euphorisch'],['psy_wahnhaft','Wahnhaft'],['psy_verwirrt','Verwirrt'],['psy_suizidal','Suizidal'],['psy_motor_unruhig','Motor. unruhig']].map(([n,l]) => [!!(p as any)[n], l])} />
        </PubSection>

        {/* Diagnose-Kategorien */}
        <PubSection title="Erstdiagnose / Diagnose-Kategorien" icon={pik(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>)}>
          <Pill active={!!(p as any).e_keine} label="Keine Erkrankung / Verletzung" />
          {([
            ['ZNS', [['e_zns_schlaganfall','Schlaganfall'],['e_zns_tia','TIA'],['e_zns_blutung','Intrakr. Blutung'],['e_zns_lyse','Lyse'],['e_zns_krampf','Krampfanfall'],['e_zns_status_epilept','Status epilept.'],['e_zns_meningitis','Meningitis'],['e_zns_synkope','Synkope'],['e_zns_sonstige','Sonstige']]],
            ['Herz-Kreislauf', [['e_hk_acs','ACS'],['e_hk_stemi_vw','STEMI VW'],['e_hk_stemi_hw','STEMI HW'],['e_hk_tachy','Tachy'],['e_hk_brady','Brady'],['e_hk_embolie','Lungenembolie'],['e_hk_ortho','Orthostatisch'],['e_hk_insuff','Herzinsuff./Lungenödem'],['e_hk_hypert','Hypert. Notfall'],['e_hk_kard_schock','Kard. Schock'],['e_hk_schrittmacher','SM/ICD-Fehlfunktion'],['e_hk_sonstige','Sonstige']]],
            ['Atmung', [['e_atm_asthma','Asthma'],['e_atm_status_asthm','Status asthm.'],['e_atm_copd','COPD'],['e_atm_pneumonie','Pneumonie'],['e_atm_hypervent','Hyperventilation'],['e_atm_aspiration','Aspiration'],['e_atm_haemoptysen','Hämoptysen'],['e_atm_sonstige','Sonstige']]],
            ['Abdomen', [['e_abd_akut','Akutes Abdomen'],['e_abd_gi_ob','GI-Blutung ob.'],['e_abd_gi_un','GI-Blutung un.'],['e_abd_kolik','Kolik'],['e_abd_enteritis','Enteritis'],['e_abd_sonstige','Sonstige']]],
            ['Psychiatrie', [['e_psy_psychose','Psychose/Manie'],['e_psy_angst','Angst/Depression'],['e_psy_intox_akzid','Intox. akzid.'],['e_psy_intox_alkohol','Intox. Alkohol'],['e_psy_intox_drogen','Intox. Drogen'],['e_psy_intox_medis','Intox. Medis'],['e_psy_intox_sonstige','Intox. Sonstige'],['e_psy_entzug','Entzug/Delir'],['e_psy_suizid','Suizid(versuch)'],['e_psy_krise','Psych. Krise'],['e_psy_sonstige','Sonstige']]],
            ['Stoffwechsel', [['e_stw_hypo','Hypoglykämie'],['e_stw_hyper','Hyperglykämie'],['e_stw_exsiccose','Exsiccose'],['e_stw_uraemie','Urämie/ANV'],['e_stw_sonstige','Sonstige']]],
            ['Pädiatrie', [['e_paed_fieberkrampf','Fieberkrampf'],['e_paed_pseudokrupp','Pseudokrupp'],['e_paed_sids','SIDS/Near-SIDS']]],
            ['Gynäkologie', [['e_gyn_schwanger','Schwangerschaft'],['e_gyn_geburt','Droh./präklin. Geburt'],['e_gyn_eklampsie','(Prä-)Eklampsie'],['e_gyn_blutung','Vag. Blutung'],['e_gyn_sonstige','Sonstige']]],
            ['Weitere', [['e_anaphylaxie','Anaphylaxie'],['e_hitze','Hitzeerschöpfung'],['e_unterkuehlung','Unterkühlung'],['e_sepsis','Sepsis/sept. Schock'],['e_influenza','Influenza'],['e_hepatitis_hiv','Hepatitis/HIV'],['e_lumbago','Akutes Lumbago'],['e_epistaxis','Epistaxis'],['e_soziales','Soziales Problem'],['e_behandlungskompl','Behandlungskompl.'],['e_weitere_sonstige','Sonstige']]],
          ] as [string,[string,string][]][]).map(([cat, items]) => <CatGroup key={cat} cat={cat} items={items} p={p} />)}
        </PubSection>

        {/* Verlauf */}
        <PubSection title="Verlauf" open icon={pik(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>)}>
          {verlauf.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Keine Verlaufswerte eingetragen.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                <thead><tr>{['Zeit','RR sys','RR dia','HF','O₂ l/min','SpO₂ %','etCO₂','Schmerz','Bemerkung'].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', fontWeight: 700, color: 'var(--text)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {verlauf.map((r, i) => (
                    <tr key={i}>
                      {(['zeit','rr_sys','rr_dia','hf','o2','spo2','etco2','schmerz','bemerkung'] as string[]).map(k => (
                        <td key={k} style={{ border: '0.5px solid var(--border)', padding: '5px 8px', color: r[k] ? 'var(--text)' : 'var(--text-secondary)' }}>{r[k] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Verlaufsgrafik — identical to OrgPatienten */}
          {(() => {
            const rows = verlauf.filter((r: any) => r.zeit)
            if (rows.length < 1) return null
            const W = 560, H = 200, PAD = { l: 38, r: 12, t: 14, b: 28 }
            const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b
            const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
            const times = rows.map((r: any) => toMin(r.zeit))
            const tMin = Math.min(...times), tMax = Math.max(...times), tSpan = tMax - tMin || 1
            const cx = (t: number) => PAD.l + ((t - tMin) / tSpan) * iW
            const SERIES = [
              { key: 'rr_sys', label: 'RR sys', color: '#ef4444', min: 0, max: 220 },
              { key: 'rr_dia', label: 'RR dia', color: '#f87171', min: 0, max: 220 },
              { key: 'hf',     label: 'HF',     color: '#3b82f6', min: 0, max: 220 },
              { key: 'spo2',   label: 'SpO₂',   color: '#22c55e', min: 70, max: 100 },
              { key: 'etco2',  label: 'etCO₂',  color: '#f97316', min: 0,  max: 80  },
            ]
            const cy = (v: number, min: number, max: number) => PAD.t + (1 - (v - min) / (max - min)) * iH
            const gridH = 220, smallStep = 10, bigStep = 55
            const gridYSmall = Array.from({ length: Math.floor(gridH / smallStep) + 1 }, (_, i) => i * smallStep)
            const gridYBig = Array.from({ length: Math.floor(gridH / bigStep) + 1 }, (_, i) => i * bigStep)
            return (
              <div style={{ marginTop: '1rem', border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
                <div style={{ padding: '8px 12px 0', fontSize: '.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Verlaufsgrafik</div>
                <div style={{ overflowX: 'auto', padding: '0 4px 8px' }}>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, height: 'auto', display: 'block' }}>
                    {gridYSmall.map(v => <line key={`gs${v}`} x1={PAD.l} y1={cy(v,0,gridH)} x2={W-PAD.r} y2={cy(v,0,gridH)} stroke="var(--border)" strokeWidth={0.4} />)}
                    {gridYBig.map(v => <line key={`gb${v}`} x1={PAD.l} y1={cy(v,0,gridH)} x2={W-PAD.r} y2={cy(v,0,gridH)} stroke="var(--border-medium)" strokeWidth={0.8} />)}
                    {rows.map((_: any, i: number) => <line key={`gx${i}`} x1={cx(times[i])} y1={PAD.t} x2={cx(times[i])} y2={H-PAD.b} stroke="var(--border-medium)" strokeWidth={0.8} />)}
                    <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H-PAD.b} stroke="var(--text-secondary)" strokeWidth={1} />
                    <line x1={PAD.l} y1={H-PAD.b} x2={W-PAD.r} y2={H-PAD.b} stroke="var(--text-secondary)" strokeWidth={1} />
                    {gridYBig.map(v => <text key={v} x={PAD.l-4} y={cy(v,0,gridH)+3.5} textAnchor="end" fontSize={9} fill="var(--text-secondary)">{v}</text>)}
                    {rows.map((r: any, i: number) => <text key={i} x={cx(times[i])} y={H-5} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">{r.zeit}</text>)}
                    {SERIES.map(s => {
                      const pts = rows.map((r: any, i: number) => ({ x: cx(times[i]), y: cy(parseFloat(r[s.key]), s.min, s.max), v: r[s.key] })).filter((pt: any) => pt.v && !isNaN(pt.y))
                      if (!pts.length) return null
                      const d = pts.map((pt: any, i: number) => `${i===0?'M':'L'}${pt.x},${pt.y}`).join(' ')
                      return <g key={s.key}>{pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />}{pts.map((pt: any, i: number) => <g key={i}><circle cx={pt.x} cy={pt.y} r={4} fill={s.color} /><text x={pt.x} y={pt.y-6} textAnchor="middle" fontSize={8} fill={s.color} fontWeight="bold">{pt.v}</text></g>)}</g>
                    })}
                  </svg>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '0 12px 10px', fontSize: '.78rem' }}>
                  {SERIES.map(s => <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 18, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} /><span style={{ color: 'var(--text-secondary)' }}>{s.label}</span></span>)}
                </div>
              </div>
            )
          })()}
        </PubSection>

        {/* Verletzungen / Trauma */}
        <PubSection title="Verletzungen / Trauma" icon={pik(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>)}>
          <Pill active={!!(p as any).v_keine} label="Keine Verletzung" />
          {([
            ['Körper', [['v_sht','SHT'],['v_gesicht','Gesicht'],['v_hals','Hals'],['v_thorax','Thorax'],['v_abdomen','Abdomen'],['v_ws','Wirbelsäule'],['v_becken','Becken'],['v_obext','Obere Ext.'],['v_untext','Untere Ext.'],['v_weich','Weichteile']]],
            ['Besonderheiten', [['v_verbrennung','Verbrennung'],['v_veraetzung','Verätzung'],['v_verschuettung','Verschüttung'],['v_einklemmung','Einklemmung'],['v_inhalation','Inhalationstrauma'],['v_elektrounfall','Elektrounfall'],['v_ertrinken','Beinahe-Ertrinken'],['v_tauchunfall','Tauchunfall'],['v_haemo_schock','Hämorr. Schock']]],
            ['Mechanismus', [['v_trauma_stumpf','Stumpf'],['v_trauma_penetr','Penetrierend'],['v_sturz_eben','Sturz ebenerdig'],['v_sturz_unter3m','Sturz <3m'],['v_sturz_ueber3m','Sturz >3m']]],
            ['Verkehr', [['v_vt_fussgaenger','Fußgänger'],['v_vt_escooter','E-Scooter'],['v_vt_fahrrad','Fahrrad'],['v_vt_ebike','E-Bike'],['v_vt_motorrad','Motorrad'],['v_vt_pkw','PKW'],['v_vt_lkw','LKW'],['v_vt_bus','Bus']]],
            ['Gewalt', [['v_gew_schlag','Schlag'],['v_gew_schuss','Schuss'],['v_gew_stich','Stich'],['v_gew_verbrechen','Gewaltverbrechen'],['v_gew_sonstige','Sonstige']]],
          ] as [string,[string,string][]][]).map(([cat, items]) => <CatGroup key={cat} cat={cat} items={items} p={p} />)}
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.75rem', marginTop: '.75rem' }}>
            <div style={grid}>
              <Val label="Verbrennung Grad" value={(p as any).v_verbrennung_grad} />
              <Val label="Verbrennung %" value={(p as any).v_verbrennung_pct} />
            </div>
            <Val label="Sonstige Verletzungen" value={(p as any).v_sonstige} />
            <Val label="Freitext Verletzungen" value={(p as any).verletz_text} />
          </div>
        </PubSection>

        {/* Atemwege / Lagerung */}
        <PubSection title="Atemwege / Lagerung / Immobilisation" icon={pik(<><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></>)}>
          <PillGroup title="Atemwegsmanagement" items={[['awm_freihalten','Freihalten'],['awm_absaugung','Absaugung'],['awm_opa','OPA/Guedel'],['awm_npa','NPA/Wendl'],['awm_lma','LMA/SGA'],['awm_intubation','Intubation (OTI)']].map(([n,l]) => [!!(p as any)[n], l])} />
          <PillGroup title="Lagerung" items={[['lag_flach','Flachlagerung'],['lag_schock','Schocklagerung'],['lag_ok_hoch','OK hoch'],['lag_ssl','Stabile Seitenlage'],['lag_sitzend','Sitzend'],['lag_haengend','Hängeposition']].map(([n,l]) => [!!(p as any)[n], l])} />
          <PillGroup title="Immobilisation" items={[['immo_hws','HWS-Orthese'],['immo_spineboard','Spineboard'],['immo_vakuum','Vakuummatratze']].map(([n,l]) => [!!(p as any)[n], l])} />
        </PubSection>

        {/* Beatmung / Defibrillation */}
        <PubSection title="Beatmung / Defibrillation" icon={pik(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>)}>
          <PillGroup title="Beatmung" items={[['beat_manuell','Manuell'],['beat_maschinell','Maschinell'],['beat_niv','NIV'],['beat_notfallnarkose','Notfallnarkose']].map(([n,l]) => [!!(p as any)[n], l])} />
          <div style={grid}>
            {[['beat_fio2','FiO₂'],['beat_af','AF /min'],['beat_peep','PEEP mbar'],['beat_pmax','Pmax mbar'],['beat_amv','AMV l/min']].map(([n,l]) => <Val key={n} label={l} value={(p as any)[n]} />)}
          </div>
          <PillGroup title="Defibrillation" items={[['defi_aed','AED'],['defi_defi','Defi'],['defi_mono','Monophasisch'],['defi_bi','Biphasisch']].map(([n,l]) => [!!(p as any)[n], l])} />
          <PillGroup title="Erstanwendung durch" items={[['defi_erstanw_laie','Laie'],['defi_erstanw_fr','First Resp.'],['defi_erstanw_rd','Rettungsdienst'],['defi_erstanw_arzt','Arzt']].map(([n,l]) => [!!(p as any)[n], l])} />
          <div style={grid}>
            {[['defi_zeitpunkt','Zeitpunkt 1. Defi'],['defi_rosc','ROSC'],['defi_anzahl','Anzahl'],['defi_energie','Energie (kJ)']].map(([n,l]) => <Val key={n} label={l} value={(p as any)[n]} />)}
          </div>
        </PubSection>

        {/* Zugang / Infusion / Medikamente */}
        <PubSection title="Zugang / Infusion / Medikamente" icon={pik(<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>)}>
          <div style={grid}>
            <Val label="Zugang Art" value={(p as any).zugang_art} />
            <Val label="Region" value={(p as any).zugang_region} />
            <Val label="Gauge" value={(p as any).zugang_gauge} />
            <Val label="Infusion" value={(p as any).inf_art} />
            <Val label="Menge (ml)" value={(p as any).inf_menge} />
          </div>
          {meds.length > 0 && (
            <>
              <div style={{ fontWeight: 700, margin: '1rem 0 .5rem', color: 'var(--text)' }}>Medikamente</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
                  <thead><tr>{['Medikament','Dosis','Einheit','Route','Zeit','Hinweis'].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {meds.map((m: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        {['name','dose','unit','route','time','note'].map(k => <td key={k} style={{ border: '0.5px solid var(--border)', padding: '6px 8px', color: m[k] ? 'var(--text)' : 'var(--text-secondary)' }}>{m[k] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </PubSection>

        {/* Reanimation */}
        <PubSection title="Reanimation" icon={pik(<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>)}>
          <Pills items={[['rean','CPR durchgeführt'],['rean_tod','Todesfeststellung']].map(([n,l]) => [!!(p as any)[n], l])} />
          <div style={{ ...grid, marginTop: '.5rem' }}>
            <Val label="Uhrzeit Todesfeststellung" value={(p as any).rean_tod_zeit} />
            <Val label="Beginn Reanimation" value={(p as any).rean_beginn} />
            <Val label="Ende Reanimation" value={(p as any).rean_ende} />
            <Val label="Defibrillationen" value={(p as any).rean_defib} />
          </div>
        </PubSection>

        {/* Übergabe */}
        <PubSection title="Übergabe / Besonderheiten" open icon={pik(<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>)}>
          <div style={grid}>
            <Val label="Übergabe Ziel" value={(p as any).uebergabe_ziel} />
            <Val label="Übergabe an (Name)" value={(p as any).uebergabe_name} />
          </div>
          <div style={{ marginTop: '.5rem' }}>
            <Pills items={[['ev_transportverweigerung','Transportverweigerung'],['ev_nur_untersuchung','Nur Untersuchung'],['ev_zwangseinweisung','Zwangseinweisung'],['ev_transport_sondersignal','Transport mit Sondersignal'],['ev_manv','MANV'],['ev_lna','LNA am Einsatz'],['ev_schwerlast','Schwerlasttransport']].map(([n,l]) => [!!(p as any)[n], l])} />
          </div>
          <div style={{ marginTop: '.5rem' }}><Val label="Bemerkungen" value={(p as any).bemerkungen} /></div>
        </PubSection>

        {/* Unterschrift */}
        <PubSection title="Unterschrift" open icon={pik(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>)}>
          <div style={grid}>
            <Val label="Name Ausfüller" value={(p as any).ausfueller_name} />
            <Val label="Datum/Uhrzeit" value={(p as any).ausfueller_zeit} />
          </div>
          {(p as any).signature && (
            <img src={(p as any).signature} alt="Unterschrift" style={{ maxWidth: 300, marginTop: '.75rem', border: '0.5px solid var(--border)', borderRadius: 8 }} />
          )}
        </PubSection>

        {/* Ablauf-Banner */}
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16, margin: '1.5rem 0', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⏱ Zugang endet {expiry?.toLocaleString('de-DE')}</div>
          <div style={{ fontSize: 13, color: '#92400e' }}>Nach Ablauf ist dieses Protokoll nicht mehr einsehbar.</div>
        </div>

      </PubWrap>
    </div>
  )
}
