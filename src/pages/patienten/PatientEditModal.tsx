import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import type { Patient, PatientPayload, Medication, VitalRow } from './types'
import { PubSection, inp, sel, ta, field, lbl } from '../public/pubStyles'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'

interface RQ { id: string; frage: string; created_by?: string; status: 'offen' | 'beantwortet'; created: string }
interface SN { id: string; rueckfrage_id: string; text: string; created: string }

interface Props {
  patient: Patient
  payload: PatientPayload
  original: PatientPayload
  onClose: () => void
  onSave: (payload: PatientPayload) => void
  onSaveAndSign: (payload: PatientPayload) => void
  onRefresh: () => void
}

const CH: React.CSSProperties = { background: '#fef3c7', borderColor: '#d97706', borderWidth: 2 }
const pil: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', border: '0.5px solid var(--border-medium)',
  borderRadius: 999, padding: '.15rem .6rem', background: 'var(--bg-subtle)',
  fontSize: 13, color: 'var(--text)', margin: '2px 2px 2px 0',
}

function F({ l, children, ch }: { l: string; children: React.ReactNode; ch?: boolean }) {
  return (
    <div style={{ ...field, ...(ch ? { borderLeft: '3px solid #d97706', paddingLeft: 8, marginLeft: -8 } : {}) }}>
      <label style={{ ...lbl, ...(ch ? { color: '#d97706' } : {}) }}>{l}</label>
      {children}
    </div>
  )
}
function G2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>{children}</div>
}
function CbRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 0', marginBottom: 10 }}>{children}</div>
}
function Cat({ t }: { t: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4, paddingTop: 6, borderTop: '0.5px solid var(--border)' }}>{t}</div>
}

export default function PatientEditModal({ patient, payload: initialPayload, original, onClose, onSave, onSaveAndSign, onRefresh }: Props) {
  const { user } = useAuth()
  const [lp, setLp] = useState<PatientPayload>(() => ({ ...initialPayload }))
  const [newFrage, setNewFrage] = useState('')
  const [sendingFrage, setSendingFrage] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [mannSearch, setMannSearch] = useState<Record<string, string>>({})
  const [mannResults, setMannResults] = useState<Record<string, any[]>>({})

  function upLp<K extends keyof PatientPayload>(key: K, value: PatientPayload[K]) {
    setLp(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (lp.access_code) {
      QRCode.toDataURL(`${window.location.origin}/p/${lp.access_code}`, { width: 300, margin: 2 }).then(setQrDataUrl)
    }
  }, [lp.access_code])

  const hl  = (k: keyof PatientPayload): React.CSSProperties =>
    JSON.stringify((original as any)[k]) !== JSON.stringify((lp as any)[k]) ? CH : {}
  const H   = (k: keyof PatientPayload) => ({ ...inp, ...hl(k) })
  const HS  = (k: keyof PatientPayload) => ({ ...sel, ...hl(k) })
  const HT  = (k: keyof PatientPayload) => ({ ...ta,  ...hl(k) })
  const hlCb = (k: keyof PatientPayload): React.CSSProperties =>
    (original as any)[k] !== (lp as any)[k]
      ? { accentColor: '#f59e0b', outline: '2px solid #fcd34d', borderRadius: 3 } : {}
  const isChanged = (k: keyof PatientPayload) =>
    JSON.stringify((original as any)[k]) !== JSON.stringify((lp as any)[k])

  const rueckfragen: RQ[] = Array.isArray(lp.rueckfragen) ? (lp.rueckfragen as RQ[]) : []
  const stellungnahmen: SN[] = Array.isArray(lp.stellungnahmen) ? (lp.stellungnahmen as SN[]) : []
  const openRQ = rueckfragen.filter(r => r.status === 'offen').length

  async function sendRueckfrage() {
    if (!newFrage.trim() || sendingFrage) return
    setSendingFrage(true)
    try {
      const rq: RQ = { id: Date.now().toString(), frage: newFrage.trim(), created_by: user?.name || 'Admin', status: 'offen', created: new Date().toISOString() }
      const updated = [...rueckfragen, rq]
      setLp(prev => ({ ...prev, rueckfragen: updated as any }))
      await pb.collection('patients').update(patient.id, { payload: { ...lp, rueckfragen: updated } })
      setNewFrage('')
      onRefresh()
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSendingFrage(false) }
  }

  function generateCode() {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    setLp(prev => ({ ...prev, access_code: code, access_code_created: new Date().toISOString() }))
  }

  const EMPTYV: VitalRow = { zeit: '', rr_sys: '', rr_dia: '', hf: '', spo2: '', af: '', temp: '', bz: '', etco2: '', schmerz: '', o2: '', bemerkung: '' }
  function addV() { upLp('verlauf', [...(lp.verlauf || []), { ...EMPTYV }]) }
  function upV(i: number, k: keyof VitalRow, v: string) {
    const rows = [...(lp.verlauf || [])]; rows[i] = { ...rows[i], [k]: v }; upLp('verlauf', rows)
  }
  function rmV(i: number) { upLp('verlauf', (lp.verlauf || []).filter((_, j) => j !== i)) }

  function addMed() { upLp('medications', [...(lp.medications || []), { name: '', dose: '', unit: '', route: '', time: '', note: '' }]) }
  function upMed(i: number, k: keyof Medication, v: string) {
    const meds = [...(lp.medications || [])]; meds[i] = { ...meds[i], [k]: v }; upLp('medications', meds)
  }
  function rmMed(i: number) { upLp('medications', (lp.medications || []).filter((_, j) => j !== i)) }

  async function searchMannschaft(role: string, text: string) {
    setMannSearch(prev => ({ ...prev, [role]: text }))
    if (text.length < 2) { setMannResults(prev => ({ ...prev, [role]: [] })); return }
    try {
      const results = await pb.collection('users').getFullList({
        filter: `organization_id="${(patient as any).organization_id}"&&(name~"${text}"||email~"${text}")`,
        fields: 'id,name,email',
        sort: 'name',
      })
      setMannResults(prev => ({ ...prev, [role]: results }))
    } catch { setMannResults(prev => ({ ...prev, [role]: [] })) }
  }

  function pickMannUser(role: string, u: any) {
    const updated = { ...(lp.mannschaft || {}), [role]: { id: u.id, name: u.name, persnr: u.persnr || '' } }
    setLp(prev => ({ ...prev, mannschaft: updated }))
    setMannSearch(prev => ({ ...prev, [role]: '' }))
    setMannResults(prev => ({ ...prev, [role]: [] }))
  }

  function clearMannUser(role: string) {
    const updated = { ...(lp.mannschaft || {}), [role]: null }
    setLp(prev => ({ ...prev, mannschaft: updated }))
  }

  function Cb({ k, label }: { k: keyof PatientPayload; label: string }) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', marginRight: 12, marginBottom: 4 }}>
        <input type="checkbox" checked={!!((lp as any)[k])} onChange={e => upLp(k, e.target.checked as any)} style={hlCb(k)} />
        {label}
      </label>
    )
  }
  function Rad({ name, v, cur, set, label }: { name: string; v: string; cur: string; set: (x: string) => void; label: string }) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, cursor: 'pointer', marginRight: 10 }}>
        <input type="radio" name={name} value={v} checked={cur === v} onChange={() => set(v)} />
        {label}
      </label>
    )
  }

  const m = ((lp.mannschaft || {}) as Record<string, { id?: string; name?: string; persnr?: string } | null>)
  function MRow({ role, label: rl }: { role: string; label: string }) {
    const linked = m[role]
    const srchText = mannSearch[role] || ''
    const results = mannResults[role] || []
    return (
      <div style={{ ...field, position: 'relative' }}>
        <label style={lbl}>{rl}</label>
        {linked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', border: '0.5px solid #93c5fd', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
              {linked.name || '—'}{linked.persnr && <span style={{ opacity: .7, fontSize: 12 }}>&nbsp;· #{linked.persnr}</span>}
            </span>
            <button type="button" onClick={() => clearMannUser(role)} style={{ background: 'none', border: '0.5px solid var(--border)', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>×</button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={srchText}
              onChange={e => searchMannschaft(role, e.target.value)}
              placeholder="Name suchen…"
              style={inp}
            />
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 2 }}>
                {results.map((u: any) => (
                  <div key={u.id} onMouseDown={() => pickMannUser(role, u)} style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '0.5px solid var(--border)' }}>
                    {u.name}<span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>{u.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const dauerMeds: any[] = Array.isArray(lp.dauermedikation) ? lp.dauermedikation : []
  const gcsT = (lp.gcs_e || 0) + (lp.gcs_v || 0) + (lp.gcs_m || 0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)', overflowY: 'auto' }}>

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1rem', height: 54, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 16, cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Zurück
          </button>
          <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Protokoll</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, minWidth: 32 }}>
            {openRQ > 0 && <span style={{ background: '#fcd34d', borderRadius: 999, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#92400e' }}>!</span>}
          </div>
        </div>
      </header>

      {/* Answered RQ banner */}
      {stellungnahmen.length > 0 && (
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '10px 16px', textAlign: 'center', fontSize: 14, color: '#166534', fontWeight: 600 }}>
          {stellungnahmen.length} Stellungnahme{stellungnahmen.length !== 1 ? 'n' : ''} vom Teamleader eingegangen ↓
        </div>
      )}

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem 1rem 120px' }}>

        {/* Change legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', fontSize: 13, color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-block', width: 16, height: 16, background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 4 }} />
          Geänderte Felder sind amber markiert
        </div>

        {/* 1. Einsatzdaten */}
        <PubSection title="Einsatzdaten" open>
          <G2>
            <F l="Einsatz-Nr." ch={isChanged('einsatz_nr')}><input type="text" value={lp.einsatz_nr || ''} onChange={e => upLp('einsatz_nr', e.target.value)} style={H('einsatz_nr')} /></F>
            <F l="Auftrags-Nr." ch={isChanged('auftrags_nr')}><input type="text" value={lp.auftrags_nr || ''} onChange={e => upLp('auftrags_nr', e.target.value)} style={H('auftrags_nr')} /></F>
            <F l="Rufname" ch={isChanged('rufname')}><input type="text" value={lp.rufname || ''} onChange={e => upLp('rufname', e.target.value)} style={H('rufname')} /></F>
            <F l="Fahrzeug / Einheit" ch={isChanged('fahrzeug')}><input type="text" value={lp.fahrzeug || ''} onChange={e => upLp('fahrzeug', e.target.value)} style={H('fahrzeug')} /></F>
            <F l="Einsatzart / Stichwort" ch={isChanged('einsatz_art')}><input type="text" value={lp.einsatz_art || ''} onChange={e => upLp('einsatz_art', e.target.value)} style={H('einsatz_art')} /></F>
          </G2>
          <F l="Einsatzort / Adresse" ch={isChanged('einsatz_adresse')}><input type="text" value={lp.einsatz_adresse || ''} onChange={e => upLp('einsatz_adresse', e.target.value)} placeholder="Straße, PLZ Ort" style={H('einsatz_adresse')} /></F>
          <G2>
            <F l="Alarmzeit" ch={isChanged('zeit_einsatz')}><input type="time" value={lp.zeit_einsatz || ''} onChange={e => upLp('zeit_einsatz', e.target.value)} style={H('zeit_einsatz')} /></F>
            <F l="Eintreffzeit" ch={isChanged('zeit_eintreffen')}><input type="time" value={lp.zeit_eintreffen || ''} onChange={e => upLp('zeit_eintreffen', e.target.value)} style={H('zeit_eintreffen')} /></F>
            <F l="Transportbeginn" ch={isChanged('zeit_transport')}><input type="time" value={lp.zeit_transport || ''} onChange={e => upLp('zeit_transport', e.target.value)} style={H('zeit_transport')} /></F>
            <F l="Übergabe" ch={isChanged('zeit_uebergabe')}><input type="time" value={lp.zeit_uebergabe || ''} onChange={e => upLp('zeit_uebergabe', e.target.value)} style={H('zeit_uebergabe')} /></F>
          </G2>
          <F l="Transportziel (Krankenhaus)" ch={isChanged('transport_ziel')}><input type="text" value={lp.transport_ziel || ''} onChange={e => upLp('transport_ziel', e.target.value)} placeholder="Klinikum…" style={H('transport_ziel')} /></F>

          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, marginTop: 4 }}>Mannschaft</div>
          <G2>
            <MRow role="tf" label="Teamführer" />
            <MRow role="m1" label="Mannschaft 1" />
            <MRow role="m2" label="Mannschaft 2" />
            <MRow role="m3" label="Mannschaft 3" />
          </G2>

          <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 12, marginTop: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>QR-Code für Rettungsdienst</div>
            {lp.access_code ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, letterSpacing: '0.2em', color: '#c0392b' }}>{lp.access_code}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gültig für 24 Stunden</div>
                  {lp.access_code_created && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Erstellt: {new Date(lp.access_code_created).toLocaleString('de-DE')}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setShowQR(true)} style={{ padding: '8px 12px', background: '#007aff', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>QR anzeigen</button>
                  <button type="button" onClick={generateCode} style={{ padding: '8px 12px', background: 'var(--bg-secondary)', color: 'var(--text)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Neu generieren</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>Noch kein Code. Generiere einen 4-stelligen Code für den Rettungsdienst.</div>
                <button type="button" onClick={generateCode} style={{ padding: '10px 16px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Code generieren</button>
              </div>
            )}
          </div>
        </PubSection>

        {/* QR Modal */}
        {showQR && lp.access_code && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowQR(false)}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 800, letterSpacing: '0.3em', color: '#c0392b', margin: '8px 0' }}>{lp.access_code}</div>
              {qrDataUrl && <img src={qrDataUrl} alt="QR Code" style={{ width: 220, height: 220, display: 'block', margin: '0 auto 12px' }} />}
              <button onClick={() => setShowQR(false)} style={{ padding: '10px 24px', background: '#222', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Schließen</button>
            </div>
          </div>
        )}

        {/* 2. Patientenstammdaten */}
        <PubSection title="Patientenstammdaten" open>
          <G2>
            <F l="Nachname" ch={isChanged('name')}><input type="text" value={lp.name || ''} onChange={e => upLp('name', e.target.value)} style={H('name')} /></F>
            <F l="Vorname" ch={isChanged('vorname')}><input type="text" value={lp.vorname || ''} onChange={e => upLp('vorname', e.target.value)} style={H('vorname')} /></F>
            <F l="Geburtsdatum" ch={isChanged('gebdatum')}><input type="date" value={lp.gebdatum || ''} onChange={e => upLp('gebdatum', e.target.value)} style={H('gebdatum')} /></F>
            <F l="Alter" ch={isChanged('alter')}><input type="text" value={lp.alter || ''} onChange={e => upLp('alter', e.target.value)} style={H('alter')} /></F>
            <F l="Telefon" ch={isChanged('telefon')}><input type="text" value={lp.telefon || ''} onChange={e => upLp('telefon', e.target.value)} style={H('telefon')} /></F>
            <F l="Mobil" ch={isChanged('mobil')}><input type="text" value={lp.mobil || ''} onChange={e => upLp('mobil', e.target.value)} style={H('mobil')} /></F>
            <F l="Straße" ch={isChanged('strasse')}><input type="text" value={lp.strasse || ''} onChange={e => upLp('strasse', e.target.value)} style={H('strasse')} /></F>
            <F l="PLZ / Ort" ch={isChanged('plz_ort')}><input type="text" value={lp.plz_ort || ''} onChange={e => upLp('plz_ort', e.target.value)} style={H('plz_ort')} /></F>
            <F l="Krankenkasse" ch={isChanged('kasse')}><input type="text" value={lp.kasse || ''} onChange={e => upLp('kasse', e.target.value)} style={H('kasse')} /></F>
            <F l="Vers.-Nr." ch={isChanged('versnr')}><input type="text" value={lp.versnr || ''} onChange={e => upLp('versnr', e.target.value)} style={H('versnr')} /></F>
          </G2>
          <F l="Hausarzt" ch={isChanged('hausarzt')}><input type="text" value={lp.hausarzt || ''} onChange={e => upLp('hausarzt', e.target.value)} style={H('hausarzt')} /></F>
          <F l="Angehöriger" ch={isChanged('angehoeriger')}><input type="text" value={lp.angehoeriger || ''} onChange={e => upLp('angehoeriger', e.target.value)} style={H('angehoeriger')} /></F>
          <F l="Infos" ch={isChanged('infos')}><textarea value={lp.infos || ''} onChange={e => upLp('infos', e.target.value)} rows={2} style={HT('infos')} /></F>
        </PubSection>

        {/* 3. Notfallgeschehen / Anamnese */}
        <PubSection title="Notfallgeschehen / Anamnese" open>
          <F l="Notfallgeschehen / Beschwerden" ch={isChanged('notfallgeschehen')}><textarea value={lp.notfallgeschehen || ''} onChange={e => upLp('notfallgeschehen', e.target.value)} rows={3} style={HT('notfallgeschehen')} /></F>
          <F l="Vorerkrankungen" ch={isChanged('vorerkrankungen')}><textarea value={lp.vorerkrankungen || ''} onChange={e => upLp('vorerkrankungen', e.target.value)} rows={2} style={HT('vorerkrankungen')} /></F>
          <F l="Allergien" ch={isChanged('allergien')}><input type="text" value={lp.allergien || ''} onChange={e => upLp('allergien', e.target.value)} placeholder="Keine bekannt / …" style={H('allergien')} /></F>
          <F l="Verlaufsbeschreibung" ch={isChanged('verlaufsbeschreibung')}><textarea value={lp.verlaufsbeschreibung || ''} onChange={e => upLp('verlaufsbeschreibung', e.target.value)} rows={2} style={HT('verlaufsbeschreibung')} /></F>
          <F l="Dauermedikation Patient (Freitext)" ch={isChanged('vormedikation_patient')}><textarea value={lp.vormedikation_patient || ''} onChange={e => upLp('vormedikation_patient', e.target.value)} rows={2} style={HT('vormedikation_patient')} /></F>
          {dauerMeds.length > 0 && (
            <div style={field}>
              <label style={lbl}>Dauermedikation (gescannt)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 6 }}>
                {dauerMeds.map((med: any, i: number) => (
                  <span key={i} style={pil}>{med.name || med.handelsname || med.pzn || String(med)}</span>
                ))}
              </div>
            </div>
          )}
        </PubSection>

        {/* 4. Verlauf / Vitalzeichen-Kurve */}
        <PubSection title="Verlauf / Vitalzeichen-Kurve">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Zeit', 'RR sys', 'RR dia', 'HF', 'SpO₂', 'AF', 'Temp', 'BZ', 'etCO₂', 'Schmerz', 'O₂ l/min', 'Bemerkung', ''].map(h => (
                    <th key={h} style={{ padding: '4px 6px', border: '1px solid var(--border)', fontWeight: 600, fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(lp.verlauf || []).map((vr, i) => (
                  <tr key={i}>
                    {(['zeit', 'rr_sys', 'rr_dia', 'hf', 'spo2', 'af', 'temp', 'bz', 'etco2', 'schmerz', 'o2', 'bemerkung'] as (keyof VitalRow)[]).map(k => (
                      <td key={k} style={{ padding: 2, border: '1px solid var(--border)' }}>
                        <input value={vr[k]} onChange={e => upV(i, k, e.target.value)}
                          style={{ width: '100%', padding: 4, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12, minWidth: k === 'bemerkung' ? 100 : 44 }} />
                      </td>
                    ))}
                    <td style={{ padding: 2, border: '1px solid var(--border)', textAlign: 'center' }}>
                      <button onClick={() => rmV(i)} style={{ color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addV} style={{ marginTop: 8, fontSize: 14, color: '#c0392b', background: 'none', border: '1px dashed #c0392b', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', width: '100%' }}>+ Zeile hinzufügen</button>
        </PubSection>

        {/* 5. Vitalparameter */}
        <PubSection title="Vitalparameter">
          <G2>
            <F l="RR syst. (mmHg)" ch={isChanged('rr_sys')}><input type="text" value={lp.rr_sys || ''} onChange={e => upLp('rr_sys', e.target.value)} style={H('rr_sys')} /></F>
            <F l="RR diast. (mmHg)" ch={isChanged('rr_dia')}><input type="text" value={lp.rr_dia || ''} onChange={e => upLp('rr_dia', e.target.value)} style={H('rr_dia')} /></F>
            <F l="HF (/min)" ch={isChanged('hf')}><input type="text" value={lp.hf || ''} onChange={e => upLp('hf', e.target.value)} style={H('hf')} /></F>
            <F l="SpO2 (%)" ch={isChanged('spo2')}><input type="text" value={lp.spo2 || ''} onChange={e => upLp('spo2', e.target.value)} style={H('spo2')} /></F>
            <F l="AF (/min)" ch={isChanged('af')}><input type="text" value={lp.af || ''} onChange={e => upLp('af', e.target.value)} style={H('af')} /></F>
            <F l="Temp (°C)" ch={isChanged('temp')}><input type="text" value={lp.temp || ''} onChange={e => upLp('temp', e.target.value)} style={H('temp')} /></F>
            <F l="BZ (mg/dl)" ch={isChanged('bz_mg')}><input type="text" value={lp.bz_mg || ''} onChange={e => upLp('bz_mg', e.target.value)} style={H('bz_mg')} /></F>
            <F l="Schmerz (NRS 0–10)" ch={isChanged('schmerz')}><input type="text" value={lp.schmerz || ''} onChange={e => upLp('schmerz', e.target.value)} style={H('schmerz')} /></F>
            <F l="etCO2" ch={isChanged('etco2')}><input type="text" value={lp.etco2 || ''} onChange={e => upLp('etco2', e.target.value)} style={H('etco2')} /></F>
          </G2>
        </PubSection>

        {/* 6. NACA / Bewusstsein */}
        <PubSection title="NACA / Bewusstsein">
          <G2>
            <F l="NACA-Score">
              <select value={lp.naca || ''} onChange={e => upLp('naca', e.target.value)} style={HS('naca')}>
                <option value="">–</option>
                {['0 – Keine Erkrankung/Verletzung', 'I – Geringfügig', 'II – Leicht', 'III – Mäßig schwer', 'IV – Schwer, keine Lebensgefahr', 'V – Akute Lebensgefahr', 'VI – Reanimation', 'VII – Tod'].map((o, i) => (
                  <option key={i} value={['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]}>{o}</option>
                ))}
              </select>
            </F>
            <F l="Bewusstsein">
              <select value={lp.bewusstsein || ''} onChange={e => upLp('bewusstsein', e.target.value)} style={HS('bewusstsein')}>
                <option value="">–</option>
                {['nicht beurteilbar', 'wach', 'getrübt', 'bewusstlos', 'reaktionslos', 'auf Ansprache', 'Reaktion auf Schmerz', 'analgosediert / Narkose'].map(o => <option key={o}>{o}</option>)}
              </select>
            </F>
          </G2>
          <F l="Verdachtsdiagnose / Erstdiagnose" ch={isChanged('erstdiagnose_text')}><input type="text" value={lp.erstdiagnose_text || ''} onChange={e => upLp('erstdiagnose_text', e.target.value)} placeholder="Freitexteingabe…" style={H('erstdiagnose_text')} /></F>
        </PubSection>

        {/* 7. Neurologie */}
        <PubSection title="Neurologie">
          <G2>
            <F l="Zeit" ch={isChanged('neu_zeit')}><input type="time" value={lp.neu_zeit || ''} onChange={e => upLp('neu_zeit', e.target.value)} style={H('neu_zeit')} /></F>
            <div style={{ paddingTop: 28 }}><Cb k="neu_unauff" label="Unauffällig" /></div>
          </G2>
          <G2>
            <F l="Pupillenweite re.">
              <div style={{ display: 'flex' }}>
                {['eng', 'mittel', 'weit'].map(v => <Rad key={v} name="pw_r" v={v} cur={lp.pw_r || 'mittel'} set={v2 => upLp('pw_r', v2)} label={v} />)}
              </div>
            </F>
            <F l="Pupillenweite li.">
              <div style={{ display: 'flex' }}>
                {['eng', 'mittel', 'weit'].map(v => <Rad key={v} name="pw_l" v={v} cur={lp.pw_l || 'mittel'} set={v2 => upLp('pw_l', v2)} label={v} />)}
              </div>
            </F>
          </G2>
          <CbRow>
            <Cb k="pw_r_entrundet" label="Entrundet re." />
            <Cb k="pw_l_entrundet" label="Entrundet li." />
          </CbRow>
          <G2>
            <F l="Lichtreaktion re.">
              <div style={{ display: 'flex' }}>
                {['prompt', 'träge', 'keine'].map(v => <Rad key={v} name="lr_r" v={v} cur={lp.lr_r || 'prompt'} set={v2 => upLp('lr_r', v2)} label={v} />)}
              </div>
            </F>
            <F l="Lichtreaktion li.">
              <div style={{ display: 'flex' }}>
                {['prompt', 'träge', 'keine'].map(v => <Rad key={v} name="lr_l" v={v} cur={lp.lr_l || 'prompt'} set={v2 => upLp('lr_l', v2)} label={v} />)}
              </div>
            </F>
          </G2>
          <CbRow>
            <Cb k="neu_sprachstoerung" label="Sprachstörung" />
            <Cb k="neu_demenz" label="Demenz" />
            <Cb k="neu_meningismus" label="Meningismus" />
            <Cb k="neu_seitenzeichen" label="Seitenzeichen" />
            <Cb k="neu_kein_laecheln" label="Kein Lächeln" />
            <Cb k="neu_sehstoerung" label="Sehstörung" />
            <Cb k="neu_querschnitt" label="Querschnittssymptomatik" />
            <Cb k="neu_babinski" label="Babinski" />
            <Cb k="neu_vorbestehend" label="Vorbestehende Defizite" />
          </CbRow>
          <F l="Neurologische Sonstige" ch={isChanged('neu_sonstige')}><input type="text" value={lp.neu_sonstige || ''} onChange={e => upLp('neu_sonstige', e.target.value)} style={H('neu_sonstige')} /></F>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Extremitätenbewegung</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
            <div /><div style={{ textAlign: 'center', fontWeight: 600, fontSize: 12 }}>Rechts</div><div style={{ textAlign: 'center', fontWeight: 600, fontSize: 12 }}>Links</div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>Arm</div>
            {(['ext_r_arm', 'ext_l_arm'] as const).map(k => (
              <select key={k} value={lp[k] || ''} onChange={e => upLp(k, e.target.value)}
                style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg)', color: 'var(--text)', ...hl(k) }}>
                <option value="">–</option><option value="1">1 – Normal</option><option value="2">2 – Leicht vermindert</option>
                <option value="3">3 – Stark vermindert</option><option value="4">4 – Fehlend</option>
              </select>
            ))}
            <div style={{ fontWeight: 600, fontSize: 12 }}>Bein</div>
            {(['ext_r_bein', 'ext_l_bein'] as const).map(k => (
              <select key={k} value={lp[k] || ''} onChange={e => upLp(k, e.target.value)}
                style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg)', color: 'var(--text)', ...hl(k) }}>
                <option value="">–</option><option value="1">1 – Normal</option><option value="2">2 – Leicht vermindert</option>
                <option value="3">3 – Stark vermindert</option><option value="4">4 – Fehlend</option>
              </select>
            ))}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Glasgow Coma Scale (GCS: {gcsT > 0 ? gcsT : '—'})</div>
          <G2>
            <F l="Augen (E 1–4)">
              <select value={lp.gcs_e || 4} onChange={e => upLp('gcs_e', +e.target.value)} style={HS('gcs_e')}>
                <option value={1}>1 – Keine</option><option value={2}>2 – Auf Schmerz</option>
                <option value={3}>3 – Auf Aufforderung</option><option value={4}>4 – Spontan</option>
              </select>
            </F>
            <F l="Verbal (V 1–5)">
              <select value={lp.gcs_v || 5} onChange={e => upLp('gcs_v', +e.target.value)} style={HS('gcs_v')}>
                <option value={1}>1 – Keine</option><option value={2}>2 – Unverständlich</option>
                <option value={3}>3 – Einzelne Wörter</option><option value={4}>4 – Verwirrt</option><option value={5}>5 – Orientiert</option>
              </select>
            </F>
            <F l="Motorik (M 1–6)">
              <select value={lp.gcs_m || 6} onChange={e => upLp('gcs_m', +e.target.value)} style={HS('gcs_m')}>
                <option value={1}>1 – Keine</option><option value={2}>2 – Strecksynergismen</option>
                <option value={3}>3 – Beugesynergismen</option><option value={4}>4 – Auf Schmerz</option>
                <option value={5}>5 – Gezielte Abwehr</option><option value={6}>6 – Auf Aufforderung</option>
              </select>
            </F>
          </G2>
        </PubSection>

        {/* 8. Haut */}
        <PubSection title="Haut">
          <CbRow>
            <Cb k="haut_unauff" label="Unauffällig" /><Cb k="haut_falten" label="Hautfalten" />
            <Cb k="haut_oedeme" label="Ödeme" /><Cb k="haut_dekubitus" label="Dekubitus" />
            <Cb k="haut_kaltschweissig" label="Kaltschweißig" /><Cb k="haut_exanthem" label="Exanthem" />
          </CbRow>
        </PubSection>

        {/* 9. Psyche */}
        <PubSection title="Psyche">
          <CbRow>
            <Cb k="psy_erregt" label="Erregt" /><Cb k="psy_aggr" label="Aggressiv" />
            <Cb k="psy_verlangsamt" label="Verlangsamt" /><Cb k="psy_depressiv" label="Depressiv" />
            <Cb k="psy_aengstlich" label="Ängstlich" /><Cb k="psy_euphorisch" label="Euphorisch" />
            <Cb k="psy_wahnhaft" label="Wahnhaft" /><Cb k="psy_verwirrt" label="Verwirrt" />
            <Cb k="psy_suizidal" label="Suizidal" /><Cb k="psy_motor_unruhig" label="Motor. unruhig" />
          </CbRow>
        </PubSection>

        {/* 10. Atmung */}
        <PubSection title="Atmung">
          <CbRow>
            <Cb k="atm_apnoe" label="Apnoe" /><Cb k="atm_stridor" label="Stridor" />
            <Cb k="atm_dyspnoe" label="Dyspnoe" /><Cb k="atm_zyanose" label="Zyanose" />
          </CbRow>
          <CbRow>
            <Cb k="o2" label="O₂" /><Cb k="o2_nasal" label="Nasal" />
            <Cb k="o2_maske" label="Maske" /><Cb k="o2_reservoir" label="Reservoir" />
          </CbRow>
          <F l="O₂-Flow (l/min)" ch={isChanged('o2_flow')}><input type="text" value={lp.o2_flow || ''} onChange={e => upLp('o2_flow', e.target.value)} style={H('o2_flow')} /></F>
        </PubSection>

        {/* 11. Atemwegsmanagement */}
        <PubSection title="Atemwegsmanagement">
          <CbRow>
            <Cb k="awm_freihalten" label="Freihalten" /><Cb k="awm_absaugung" label="Absaugung" />
            <Cb k="awm_opa" label="OPA (Guedel)" /><Cb k="awm_npa" label="NPA (Wendl)" />
            <Cb k="awm_lma" label="LMA / SGA" /><Cb k="awm_intubation" label="Intubation (OTI)" />
          </CbRow>
        </PubSection>

        {/* 12. Lagerung */}
        <PubSection title="Lagerung">
          <CbRow>
            <Cb k="lag_flach" label="Flachlagerung" /><Cb k="lag_schock" label="Schocklagerung" />
            <Cb k="lag_ok_hoch" label="Oberkörper hoch" /><Cb k="lag_ssl" label="Stabile Seitenlage" />
            <Cb k="lag_sitzend" label="Sitzend" /><Cb k="lag_haengend" label="Hängeposition" />
          </CbRow>
        </PubSection>

        {/* 13. Reanimation */}
        <PubSection title="Reanimation">
          <CbRow>
            <Cb k="rean" label="Reanimation durchgeführt" />
            <Cb k="rean_tod" label="Todesfeststellung" />
          </CbRow>
          {lp.rean_tod && <F l="Uhrzeit Todesfeststellung" ch={isChanged('rean_tod_zeit')}><input type="time" value={lp.rean_tod_zeit || ''} onChange={e => upLp('rean_tod_zeit', e.target.value)} style={H('rean_tod_zeit')} /></F>}
          {lp.rean && (
            <G2>
              <F l="Beginn" ch={isChanged('rean_beginn')}><input type="time" value={lp.rean_beginn || ''} onChange={e => upLp('rean_beginn', e.target.value)} style={H('rean_beginn')} /></F>
              <F l="Ende" ch={isChanged('rean_ende')}><input type="time" value={lp.rean_ende || ''} onChange={e => upLp('rean_ende', e.target.value)} style={H('rean_ende')} /></F>
              <F l="Defibrillationen (Anzahl)" ch={isChanged('rean_defib')}><input type="text" value={lp.rean_defib || ''} onChange={e => upLp('rean_defib', e.target.value)} style={H('rean_defib')} /></F>
            </G2>
          )}
        </PubSection>

        {/* 14. Immobilisation */}
        <PubSection title="Immobilisation">
          <CbRow>
            <Cb k="immo_hws" label="HWS-Orthese" />
            <Cb k="immo_spineboard" label="Spineboard" />
            <Cb k="immo_vakuum" label="Vakuummatratze" />
          </CbRow>
        </PubSection>

        {/* 15. Rhythmus / EKG */}
        <PubSection title="Rhythmus / EKG">
          <CbRow>
            <Cb k="sr" label="Sinusrhythmus" /><Cb k="stemi" label="STEMI" />
            <Cb k="vf" label="Kammerflimmern" /><Cb k="asystole" label="Asystolie" />
          </CbRow>
          <G2>
            <F l="EKG-Standort" ch={isChanged('ekg_standort')}><input type="text" value={lp.ekg_standort || ''} onChange={e => upLp('ekg_standort', e.target.value)} style={H('ekg_standort')} /></F>
            <F l="EKG Pers.-Nr." ch={isChanged('ekg_persnr')}><input type="text" value={lp.ekg_persnr || ''} onChange={e => upLp('ekg_persnr', e.target.value)} style={H('ekg_persnr')} /></F>
          </G2>
        </PubSection>

        {/* 16. Diagnosen / Erkrankungen */}
        <PubSection title="Diagnosen / Erkrankungen">
          <CbRow><Cb k="e_keine" label="Keine Erkrankung / Verletzung" /></CbRow>
          <Cat t="ZNS" />
          <CbRow>
            <Cb k="e_zns_schlaganfall" label="Schlaganfall" /><Cb k="e_zns_tia" label="TIA" />
            <Cb k="e_zns_blutung" label="Intrakranielle Blutung" /><Cb k="e_zns_lyse" label="Im Lysefenster" />
            <Cb k="e_zns_krampf" label="Krampfanfall" /><Cb k="e_zns_status_epilept" label="Status epilepticus" />
            <Cb k="e_zns_meningitis" label="Meningitis" /><Cb k="e_zns_synkope" label="Synkope" />
            <Cb k="e_zns_sonstige" label="ZNS Sonstige" />
          </CbRow>
          <Cat t="Herz-Kreislauf" />
          <CbRow>
            <Cb k="e_hk_acs" label="Akutes Koronarsyndrom" /><Cb k="e_hk_stemi_vw" label="STEMI Vorderwand" />
            <Cb k="e_hk_stemi_hw" label="STEMI Hinterwand" /><Cb k="e_hk_tachy" label="Rhythmusstörung Tachy" />
            <Cb k="e_hk_brady" label="Rhythmusstörung Brady" /><Cb k="e_hk_embolie" label="Lungenembolie" />
            <Cb k="e_hk_ortho" label="Orthostatische Fehlregulation" /><Cb k="e_hk_insuff" label="Herzinsuffizienz / Lungenödem" />
            <Cb k="e_hk_hypert" label="Hypertensiver Notfall" /><Cb k="e_hk_kard_schock" label="Kardiogener Schock" />
            <Cb k="e_hk_schrittmacher" label="Schrittmacher-/ICD-Fehlfunktion" /><Cb k="e_hk_sonstige" label="HK Sonstige" />
          </CbRow>
          <Cat t="Atmung" />
          <CbRow>
            <Cb k="e_atm_asthma" label="Asthma (Anfall)" /><Cb k="e_atm_status_asthm" label="Status asthmaticus" />
            <Cb k="e_atm_copd" label="COPD" /><Cb k="e_atm_pneumonie" label="Pneumonie / Bronchitis" />
            <Cb k="e_atm_hypervent" label="Hyperventilationssyndrom" /><Cb k="e_atm_aspiration" label="Aspiration" />
            <Cb k="e_atm_haemoptysen" label="Hämoptysen" /><Cb k="e_atm_sonstige" label="Atmung Sonstige" />
          </CbRow>
          <Cat t="Abdomen" />
          <CbRow>
            <Cb k="e_abd_akut" label="Akutes Abdomen" /><Cb k="e_abd_gi_ob" label="GI-Blutung obere" />
            <Cb k="e_abd_gi_un" label="GI-Blutung untere" /><Cb k="e_abd_kolik" label="Kolik (Niere/Galle)" />
            <Cb k="e_abd_enteritis" label="Enteritis" /><Cb k="e_abd_sonstige" label="Abdomen Sonstige" />
          </CbRow>
          <Cat t="Psychiatrie" />
          <CbRow>
            <Cb k="e_psy_psychose" label="Psychose / Manie / Erregungszustand" /><Cb k="e_psy_angst" label="Angst / Depression" />
            <Cb k="e_psy_intox_akzid" label="Intoxikation akzidentell" /><Cb k="e_psy_intox_alkohol" label="Intoxikation Alkohol" />
            <Cb k="e_psy_intox_drogen" label="Intoxikation Drogen" /><Cb k="e_psy_intox_medis" label="Intoxikation Medikamente" />
            <Cb k="e_psy_intox_sonstige" label="Intoxikation Sonstige" /><Cb k="e_psy_entzug" label="Entzug / Delir" />
            <Cb k="e_psy_suizid" label="Suizid(versuch)" /><Cb k="e_psy_krise" label="Psychosoziale Krise" />
            <Cb k="e_psy_sonstige" label="Psychiatrie Sonstige" />
          </CbRow>
          <Cat t="Stoffwechsel" />
          <CbRow>
            <Cb k="e_stw_hypo" label="Hypoglykämie" /><Cb k="e_stw_hyper" label="Hyperglykämie" />
            <Cb k="e_stw_exsiccose" label="Exsiccose" /><Cb k="e_stw_uraemie" label="Urämie / ANV" />
            <Cb k="e_stw_sonstige" label="Stoffwechsel Sonstige" />
          </CbRow>
          <Cat t="Pädiatrie" />
          <CbRow>
            <Cb k="e_paed_fieberkrampf" label="Fieberkrampf" /><Cb k="e_paed_pseudokrupp" label="Pseudokrupp" />
            <Cb k="e_paed_sids" label="SIDS / Near-SIDS" />
          </CbRow>
          <Cat t="Gynäkologie" />
          <CbRow>
            <Cb k="e_gyn_schwanger" label="Schwangerschaft" /><Cb k="e_gyn_geburt" label="Drohende / präklinische Geburt" />
            <Cb k="e_gyn_eklampsie" label="(Prä-)Eklampsie" /><Cb k="e_gyn_blutung" label="Vaginale Blutung" />
            <Cb k="e_gyn_sonstige" label="Gynäkologie Sonstige" />
          </CbRow>
          <Cat t="Weitere" />
          <CbRow>
            <Cb k="e_anaphylaxie" label="Anaphylaktische Reaktion" /><Cb k="e_hitze" label="Hitzeerschöpfung / Hitzeschlag" />
            <Cb k="e_unterkuehlung" label="Unterkühlung / Erfrierung" /><Cb k="e_sepsis" label="Sepsis / sept. Schock" />
            <Cb k="e_influenza" label="Influenza" /><Cb k="e_hepatitis_hiv" label="Hepatitis / HIV" />
            <Cb k="e_lumbago" label="Akutes Lumbago" /><Cb k="e_epistaxis" label="Epistaxis" />
            <Cb k="e_soziales" label="Soziales Problem" /><Cb k="e_behandlungskompl" label="Behandlungskomplikation" />
            <Cb k="e_weitere_sonstige" label="Weitere Sonstige" />
          </CbRow>
        </PubSection>

        {/* 17. Medikamente */}
        <PubSection title="Medikamente">
          {(lp.medications || []).map((med, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <G2>
                <F l="Medikament"><input type="text" value={med.name} onChange={e => upMed(i, 'name', e.target.value)} style={inp} /></F>
                <F l="Dosis"><input type="text" value={med.dose} onChange={e => upMed(i, 'dose', e.target.value)} style={inp} /></F>
                <F l="Einheit"><input type="text" value={med.unit} onChange={e => upMed(i, 'unit', e.target.value)} placeholder="mg, ml…" style={inp} /></F>
                <F l="Applikation"><input type="text" value={med.route} onChange={e => upMed(i, 'route', e.target.value)} placeholder="i.v., s.c.…" style={inp} /></F>
                <F l="Zeit"><input type="time" value={med.time} onChange={e => upMed(i, 'time', e.target.value)} style={inp} /></F>
                <F l="Hinweis"><input type="text" value={med.note} onChange={e => upMed(i, 'note', e.target.value)} style={inp} /></F>
              </G2>
              <button onClick={() => rmMed(i)} style={{ fontSize: 12, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Entfernen</button>
            </div>
          ))}
          <button onClick={addMed} style={{ fontSize: 14, color: '#c0392b', background: 'none', border: '1px dashed #c0392b', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', width: '100%' }}>+ Medikament hinzufügen</button>
        </PubSection>

        {/* 18. Zugang / Infusion */}
        <PubSection title="Zugang / Infusion">
          <G2>
            <F l="Zugang Art" ch={isChanged('zugang_art')}><input type="text" value={lp.zugang_art || ''} onChange={e => upLp('zugang_art', e.target.value)} placeholder="peripher, zentral…" style={H('zugang_art')} /></F>
            <F l="Gauge" ch={isChanged('zugang_gauge')}><input type="text" value={lp.zugang_gauge || ''} onChange={e => upLp('zugang_gauge', e.target.value)} style={H('zugang_gauge')} /></F>
            <F l="Region" ch={isChanged('zugang_region')}><input type="text" value={lp.zugang_region || ''} onChange={e => upLp('zugang_region', e.target.value)} style={H('zugang_region')} /></F>
            <F l="Infusion Art" ch={isChanged('inf_art')}><input type="text" value={lp.inf_art || ''} onChange={e => upLp('inf_art', e.target.value)} style={H('inf_art')} /></F>
            <F l="Infusion Menge (ml)" ch={isChanged('inf_menge')}><input type="text" value={lp.inf_menge || ''} onChange={e => upLp('inf_menge', e.target.value)} style={H('inf_menge')} /></F>
          </G2>
        </PubSection>

        {/* 19. Beatmung / Defibrillation */}
        <PubSection title="Beatmung / Defibrillation">
          <CbRow>
            <Cb k="beat_manuell" label="Manuell" /><Cb k="beat_maschinell" label="Maschinell" />
            <Cb k="beat_niv" label="NIV" /><Cb k="beat_notfallnarkose" label="Notfallnarkose" />
          </CbRow>
          <G2>
            <F l="FiO2" ch={isChanged('beat_fio2')}><input type="text" value={lp.beat_fio2 || ''} onChange={e => upLp('beat_fio2', e.target.value)} style={H('beat_fio2')} /></F>
            <F l="AF (/min)" ch={isChanged('beat_af')}><input type="text" value={lp.beat_af || ''} onChange={e => upLp('beat_af', e.target.value)} style={H('beat_af')} /></F>
            <F l="AMV (l/min)" ch={isChanged('beat_amv')}><input type="text" value={lp.beat_amv || ''} onChange={e => upLp('beat_amv', e.target.value)} style={H('beat_amv')} /></F>
            <F l="PEEP (mbar)" ch={isChanged('beat_peep')}><input type="text" value={lp.beat_peep || ''} onChange={e => upLp('beat_peep', e.target.value)} style={H('beat_peep')} /></F>
            <F l="Pmax (mbar)" ch={isChanged('beat_pmax')}><input type="text" value={lp.beat_pmax || ''} onChange={e => upLp('beat_pmax', e.target.value)} style={H('beat_pmax')} /></F>
          </G2>
          <div style={{ fontWeight: 600, fontSize: 13, margin: '8px 0 6px', paddingTop: 4, borderTop: '1px solid var(--border)' }}>Defibrillation</div>
          <CbRow>
            <Cb k="defi_aed" label="AED" /><Cb k="defi_defi" label="Defi" />
            <Cb k="defi_mono" label="Monophasisch" /><Cb k="defi_bi" label="Biphasisch" />
          </CbRow>
          <CbRow>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: .6, marginRight: 6, alignSelf: 'center' }}>Erstanw.:</span>
            <Cb k="defi_erstanw_laie" label="Laie" /><Cb k="defi_erstanw_fr" label="First Resp." />
            <Cb k="defi_erstanw_rd" label="Rettungsdienst" /><Cb k="defi_erstanw_arzt" label="Arzt" />
          </CbRow>
          <G2>
            <F l="Zeitpunkt 1. Defi" ch={isChanged('defi_zeitpunkt')}><input type="time" value={lp.defi_zeitpunkt || ''} onChange={e => upLp('defi_zeitpunkt', e.target.value)} style={H('defi_zeitpunkt')} /></F>
            <F l="ROSC" ch={isChanged('defi_rosc')}><input type="time" value={lp.defi_rosc || ''} onChange={e => upLp('defi_rosc', e.target.value)} style={H('defi_rosc')} /></F>
            <F l="Anzahl Defi" ch={isChanged('defi_anzahl')}><input type="text" value={lp.defi_anzahl || ''} onChange={e => upLp('defi_anzahl', e.target.value)} style={H('defi_anzahl')} /></F>
            <F l="Energie (kJ)" ch={isChanged('defi_energie')}><input type="text" value={lp.defi_energie || ''} onChange={e => upLp('defi_energie', e.target.value)} style={H('defi_energie')} /></F>
          </G2>
        </PubSection>

        {/* 20. Übergabe / Besonderheiten */}
        <PubSection title="Übergabe / Besonderheiten">
          <F l="Übergabe Ziel">
            <select value={lp.uebergabe_ziel || ''} onChange={e => upLp('uebergabe_ziel', e.target.value)} style={HS('uebergabe_ziel')}>
              <option value="">–</option>
              {['ZNA/INA', 'Schockraum', 'Stroke Unit', 'Herzkatheterlabor', 'CPU', 'Intensivstation', 'Allgemeinstation', 'OP direkt', 'Praxis', 'Hausarzt/KV-Arzt', 'Fachambulanz', 'Einsatzstelle', 'Sonstige'].map(o => <option key={o}>{o}</option>)}
            </select>
          </F>
          <F l="Übergabe an (Name)" ch={isChanged('uebergabe_name')}><input type="text" value={lp.uebergabe_name || ''} onChange={e => upLp('uebergabe_name', e.target.value)} style={H('uebergabe_name')} /></F>
          <CbRow>
            <Cb k="ev_transportverweigerung" label="Transportverweigerung" />
            <Cb k="ev_nur_untersuchung" label="Nur Untersuchung/Behandlung" />
            <Cb k="ev_zwangseinweisung" label="Zwangseinweisung" />
            <Cb k="ev_transport_sondersignal" label="Transport mit Sondersignal" />
            <Cb k="ev_manv" label="MANV" /><Cb k="ev_lna" label="LNA am Einsatz" />
            <Cb k="ev_schwerlast" label="Schwerlasttransport" />
          </CbRow>
          <F l="Bemerkungen" ch={isChanged('bemerkungen')}><textarea value={lp.bemerkungen || ''} onChange={e => upLp('bemerkungen', e.target.value)} rows={3} style={HT('bemerkungen')} /></F>
        </PubSection>

        {/* 21. Verletzungen / Trauma */}
        <PubSection title="Verletzungen / Trauma">
          <CbRow><Cb k="v_keine" label="Keine Verletzung" /></CbRow>
          <div style={{ fontWeight: 600, fontSize: 12, opacity: .7, marginTop: 4, marginBottom: 4 }}>Körperregion – Schwere</div>
          {([['v_sht', 'Schädel-Hirn'], ['v_gesicht', 'Gesicht'], ['v_hals', 'Hals'], ['v_thorax', 'Thorax'], ['v_abdomen', 'Abdomen'], ['v_ws', 'Wirbelsäule'], ['v_becken', 'Becken'], ['v_obext', 'Obere Extremitäten'], ['v_untext', 'Untere Extremitäten'], ['v_weich', 'Weichteile']] as [keyof PatientPayload, string][]).map(([k, lbl2]) => (
            <div key={String(k)} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '4px', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{lbl2}</span>
              <select value={(lp[k] as string) || ''} onChange={e => upLp(k, e.target.value as any)}
                style={{ padding: 5, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg)', color: 'var(--text)', ...hl(k) }}>
                <option value="">–</option><option value="leicht">leicht</option>
                <option value="mittel">mittel</option><option value="schwer">schwer</option>
                <option value="geschlossen">geschlossen</option>
              </select>
            </div>
          ))}
          <div style={{ fontWeight: 600, fontSize: 12, opacity: .7, marginTop: 8, marginBottom: 4 }}>Besondere Verletzungsarten</div>
          <CbRow>
            <Cb k="v_verbrennung" label="Verbrennung / Verbrühung" /><Cb k="v_veraetzung" label="Verätzung" />
            <Cb k="v_verschuettung" label="Verschüttung" /><Cb k="v_einklemmung" label="Einklemmung" />
            <Cb k="v_inhalation" label="Inhalationstrauma" /><Cb k="v_elektrounfall" label="Elektrounfall" />
            <Cb k="v_ertrinken" label="Beinahe-Ertrinken" /><Cb k="v_tauchunfall" label="Tauchunfall" />
            <Cb k="v_haemo_schock" label="Hämorrhagischer Schock" />
          </CbRow>
          {lp.v_verbrennung && (
            <G2>
              <F l="Verbrennungsgrad" ch={isChanged('v_verbrennung_grad')}><input type="text" value={lp.v_verbrennung_grad || ''} onChange={e => upLp('v_verbrennung_grad', e.target.value)} placeholder="Grad…" style={H('v_verbrennung_grad')} /></F>
              <F l="Verbrannte Fläche (%)" ch={isChanged('v_verbrennung_pct')}><input type="text" value={lp.v_verbrennung_pct || ''} onChange={e => upLp('v_verbrennung_pct', e.target.value)} style={H('v_verbrennung_pct')} /></F>
            </G2>
          )}
          <F l="Verletzungen Sonstige" ch={isChanged('v_sonstige')}><input type="text" value={lp.v_sonstige || ''} onChange={e => upLp('v_sonstige', e.target.value)} style={H('v_sonstige')} /></F>
          <div style={{ fontWeight: 600, fontSize: 12, opacity: .7, marginTop: 8, marginBottom: 4 }}>Unfallmechanismus</div>
          <CbRow>
            <Cb k="v_trauma_stumpf" label="Trauma stumpf" /><Cb k="v_trauma_penetr" label="Trauma penetrierend" />
            <Cb k="v_sturz_eben" label="Sturz ebenerdig" /><Cb k="v_sturz_unter3m" label="Sturz &lt;3 m" />
            <Cb k="v_sturz_ueber3m" label="Sturz &gt;3 m" />
          </CbRow>
          <div style={{ fontWeight: 600, fontSize: 12, opacity: .7, marginTop: 6, marginBottom: 4 }}>Verkehrsteilnehmer</div>
          <CbRow>
            <Cb k="v_vt_fussgaenger" label="Fußgänger" /><Cb k="v_vt_escooter" label="E-Scooter" />
            <Cb k="v_vt_fahrrad" label="Fahrrad" /><Cb k="v_vt_ebike" label="E-Bike" />
            <Cb k="v_vt_motorrad" label="Motorrad / Sozius" /><Cb k="v_vt_pkw" label="PKW Insasse" />
            <Cb k="v_vt_lkw" label="LKW Insasse" /><Cb k="v_vt_bus" label="Bus Insasse" />
          </CbRow>
          <div style={{ fontWeight: 600, fontSize: 12, opacity: .7, marginTop: 6, marginBottom: 4 }}>Gewaltanwendung</div>
          <CbRow>
            <Cb k="v_gew_schlag" label="Schlag" /><Cb k="v_gew_schuss" label="Schuss" />
            <Cb k="v_gew_stich" label="Stich" /><Cb k="v_gew_sonstige" label="Gewalt Sonstige" />
            <Cb k="v_gew_verbrechen" label="Gewaltverbrechen" />
          </CbRow>
        </PubSection>

        {/* 22. Rückfragen / Stellungnahmen */}
        <PubSection title={`Rückfragen / Stellungnahmen${rueckfragen.length ? ` (${rueckfragen.length})` : ''}`} open>
          {rueckfragen.length === 0 && (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 12px' }}>Keine Rückfragen vorhanden.</p>
          )}
          {rueckfragen.map((rq, i) => (
            <div key={rq.id} style={{
              background: rq.status === 'beantwortet' ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${rq.status === 'beantwortet' ? '#bbf7d0' : '#fcd34d'}`,
              borderRadius: 10, padding: 12, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Rückfrage #{i + 1}{rq.created_by ? ` · ${rq.created_by}` : ''}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(rq.created).toLocaleString('de-DE')}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: rq.status === 'beantwortet' ? '#dcfce7' : '#fef9c3',
                  color: rq.status === 'beantwortet' ? '#166534' : '#92400e',
                }}>
                  {rq.status === 'beantwortet' ? 'Beantwortet' : 'Offen'}
                </span>
              </div>
              <div style={{ fontSize: 14, marginBottom: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{rq.created_by ? `${rq.created_by} fragt:` : 'Frage:'}</div>
                {rq.frage}
              </div>
              {(() => {
                const sn = stellungnahmen.find(s => s.rueckfrage_id === rq.id)
                return sn ? (
                  <div style={{ fontSize: 14, background: '#dcfce7', borderRadius: 6, padding: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>Stellungnahme des Teamleiters:</span>
                      <span style={{ fontSize: 11, color: '#166534' }}>{new Date(sn.created).toLocaleString('de-DE')}</span>
                    </div>
                    {sn.text}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Noch keine Stellungnahme eingegangen.</div>
                )
              })()}
            </div>
          ))}

          <div style={{ marginTop: rueckfragen.length ? 4 : 0 }}>
            <label style={{ ...lbl, marginBottom: 6 }}>Neue Rückfrage an Teamleader senden:</label>
            <textarea
              value={newFrage} onChange={e => setNewFrage(e.target.value)} rows={3}
              placeholder="Rückfrage eingeben – der Teamleader wird aufgefordert, Stellung zu nehmen…"
              style={{ ...ta, marginBottom: 8 }}
            />
            <button
              onClick={sendRueckfrage}
              disabled={sendingFrage || !newFrage.trim()}
              style={{
                padding: '10px 20px',
                background: sendingFrage || !newFrage.trim() ? 'var(--bg-secondary)' : '#2563eb',
                color: sendingFrage || !newFrage.trim() ? 'var(--text-secondary)' : '#fff',
                border: 'none', borderRadius: 10, fontWeight: 700,
                cursor: sendingFrage || !newFrage.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 14,
              }}
            >
              {sendingFrage ? 'Sende…' : 'Rückfrage senden'}
            </button>
          </div>
        </PubSection>

      </div>

      {/* Bottom bar */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '0.5px solid var(--border)', padding: 'calc(0.75rem) 1rem calc(0.75rem + env(safe-area-inset-bottom))', zIndex: 20 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: 'var(--bg-secondary)', color: 'var(--text)', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Abbrechen
          </button>
          <button onClick={() => {
            const changedKeys = (Object.keys(lp) as (keyof typeof lp)[]).filter(k => k !== '_changed_fields' && isChanged(k))
            onSave({ ...lp, _changed_fields: changedKeys })
          }} style={{ flex: 2, padding: 12, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Speichern
          </button>
          <button onClick={() => {
            const changedKeys = (Object.keys(lp) as (keyof typeof lp)[]).filter(k => k !== '_changed_fields' && isChanged(k))
            onSaveAndSign({ ...lp, _changed_fields: changedKeys })
          }} style={{ flex: 2, padding: 12, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Gegenzeichnen
          </button>
        </div>
      </div>
    </div>
  )
}
