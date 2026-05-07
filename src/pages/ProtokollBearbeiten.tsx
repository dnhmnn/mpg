import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { PubSection, PubHeader, PubWrap, inp, sel, ta, field, lbl } from './public/pubStyles'
import DauermedikationPicker, { type DauerMed } from './public/DauermedikationPicker'
import AnamneseAssistent from './public/AnamneseAssistent'
import EinsatzTimeline from './public/EinsatzTimeline'

type Med = { name: string; dose: string; unit: string; route: string; time: string; note: string }
type VRow = { zeit: string; rr_sys: string; rr_dia: string; hf: string; o2: string; spo2: string; etco2: string; schmerz: string }
const emptyV = (): VRow => ({ zeit: '', rr_sys: '', rr_dia: '', hf: '', o2: '', spo2: '', etco2: '', schmerz: '' })
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.35rem', border: '0.5px solid var(--border-medium)', borderRadius: 999, padding: '.2rem .5rem', background: 'var(--bg-subtle)', fontSize: '.9rem', cursor: 'pointer', margin: '2px', color: 'var(--text)' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }
const now = () => { const d = new Date(); return d.toISOString().slice(0, 16) }
const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

export default function ProtokollBearbeiten() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>()
  const refS3  = useRef<HTMLInputElement>(null)
  const refS4  = useRef<HTMLInputElement>(null)
  const refUeg = useRef<HTMLInputElement>(null)
  const refS1  = useRef<HTMLInputElement>(null)
  const refS2  = useRef<HTMLInputElement>(null)

  const [meds, setMeds] = useState<Med[]>([])
  const [dauerMeds, setDauerMeds] = useState<DauerMed[]>([])
  const [verlauf, setVerlauf] = useState<VRow[]>([emptyV()])
  const [verlaufText, setVerlaufText] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [gcs, setGcs] = useState({ e: 0, v: 0, m: 0 })
  const [sigUrl, setSigUrl] = useState('')
  const [locked, setLocked] = useState(false)
  const [lockedReason, setLockedReason] = useState('')
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alarmzeit, setAlarmzeit] = useState(now())
  const [einsatzAdresse, setEinsatzAdresse] = useState('')
  const [notfallText, setNotfallText] = useState('')
  const [anamneseModus, setAnamneseModus] = useState<'freitext' | 'klick'>('freitext')
  const [snapMesswerte, setSnapMesswerte] = useState<Record<string, string>>({})
  const [verlaufModal, setVerlaufModal] = useState(false)
  const [mannschaft, setMannschaft] = useState<Record<string, { name: string } | null>>({})
  const [rueckfragen, setRueckfragen] = useState<{ id: string; frage: string; antwort?: string; status: string; created: string }[]>([])
  const [rqAntworten, setRqAntworten] = useState<Record<string, string>>({})

  const MESS_FIELDS = ['rr_sys', 'rr_dia', 'hf', 'af', 'spo2', 'etco2', 'temp', 'bz_mg', 'schmerz']
  const gcsSum = gcs.e + gcs.v + gcs.m

  function openKlick() {
    const snap: Record<string, string> = {}
    MESS_FIELDS.forEach(n => {
      const el = formRef.current?.querySelector<HTMLInputElement>(`[name="${n}"]`)
      if (el) snap[n] = el.value
    })
    setSnapMesswerte(snap)
    setAnamneseModus('klick')
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || locked) return
    const ctx = canvas.getContext('2d')!
    let drawing = false
    const pos = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) } }
    const down = (e: PointerEvent) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault() }
    const move = (e: PointerEvent) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); e.preventDefault() }
    const up = () => { drawing = false; setSigUrl(canvas.toDataURL()); scheduleAutoSave() }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up)
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up) }
  }, [locked, loading])

  useEffect(() => { if (user && patientId) loadRecord() }, [user, patientId])

  async function loadRecord() {
    try {
      const rec = await pb.collection('patients').getOne(patientId!)
      const p = rec.payload || {}
      if (p.mannschaft) setMannschaft(p.mannschaft)
      if (p.medications?.length) setMeds(p.medications)
      if (Array.isArray(p.dauermedikation)) setDauerMeds(p.dauermedikation)
      if (p.verlauf?.length) setVerlauf(p.verlauf)
      if (Array.isArray(p.photos)) setPhotos(p.photos)
      if (p.gcs_e) setGcs({ e: Number(p.gcs_e) || 0, v: Number(p.gcs_v) || 0, m: Number(p.gcs_m) || 0 })
      if (p.notfallgeschehen) setNotfallText(p.notfallgeschehen)
      if (p.verlaufsbeschreibung) setVerlaufText(p.verlaufsbeschreibung)
      if (p.zeit_einsatz) setAlarmzeit(p.zeit_einsatz)
      if (p.einsatz_adresse) setEinsatzAdresse(p.einsatz_adresse)
      if (Array.isArray(p.rueckfragen)) setRueckfragen(p.rueckfragen as any)
      if (p.signature) {
        setSigUrl(p.signature)
        const img = new Image()
        img.onload = () => { const ctx = canvasRef.current?.getContext('2d'); if (ctx) ctx.drawImage(img, 0, 0) }
        img.src = p.signature
      }
      const age = Date.now() - new Date(rec.created).getTime()
      if (rec.status !== 'offen') { setLocked(true); setLockedReason('Dieses Protokoll wurde abgeschlossen.') }
      else if (age > 24 * 60 * 60 * 1000) {
        setLocked(true); setLockedReason('Dieses Protokoll wurde nach 24 Stunden automatisch gesperrt.')
        pb.collection('patients').update(patientId!, { status: 'archiviert' }).catch(() => {})
      }
      setTimeout(() => {
        const form = formRef.current; if (!form) return
        const skip = new Set(['notfallgeschehen', 'verlaufsbeschreibung', 'zeit_einsatz', 'einsatz_adresse'])
        form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]').forEach(el => {
          if (skip.has(el.name)) return
          const v = p[el.name]; if (v === undefined || v === null) return
          if ((el as HTMLInputElement).type === 'checkbox') (el as HTMLInputElement).checked = !!v
          else if ((el as HTMLInputElement).type === 'radio') (el as HTMLInputElement).checked = el.value === String(v)
          else el.value = String(v)
        })
      }, 50)
    } catch { alert('Protokoll nicht gefunden.'); navigate('/unitas') }
    finally { setLoading(false) }
  }

  function clearSig() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setSigUrl('')
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (!patientId || locked) return
      try { await pb.collection('patients').update(patientId, { payload: collectData() }) } catch {}
    }, 1500)
  }

  function collectData() {
    const data: Record<string, unknown> = {}
    formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach(el => {
      if (!el.name) return
      if ((el as HTMLInputElement).type === 'checkbox') data[el.name] = (el as HTMLInputElement).checked
      else if ((el as HTMLInputElement).type === 'radio') { if ((el as HTMLInputElement).checked) data[el.name] = el.value }
      else data[el.name] = el.value
    })
    data.mannschaft = mannschaft
    data.medications = meds
    data.dauermedikation = dauerMeds
    data.verlauf = verlauf.filter(r => r.zeit || r.rr_sys || r.hf)
    data.photos = photos
    data.signature = sigUrl
    data.gcs_e = gcs.e; data.gcs_v = gcs.v; data.gcs_m = gcs.m
    data.rueckfragen = rueckfragen
    return data
  }

  async function submit() {
    setSending(true)
    try {
      await pb.collection('patients').update(patientId!, { payload: collectData() })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  async function finish() {
    if (!sigUrl) { alert('Bitte zuerst unterschreiben.'); return }
    setSending(true)
    try {
      await pb.collection('patients').update(patientId!, { payload: collectData(), status: 'archiviert' })
      setLocked(true); setLockedReason('Dieses Protokoll wurde abgeschlossen.')
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  async function respondToRueckfrage(id: string) {
    const antwort = rqAntworten[id]?.trim()
    if (!antwort) return
    const updated = rueckfragen.map(rq =>
      rq.id === id ? { ...rq, antwort, status: 'beantwortet' } : rq
    )
    try {
      await pb.collection('patients').update(patientId!, { payload: { ...collectData(), rueckfragen: updated } })
      setRueckfragen(updated)
      setRqAntworten(prev => ({ ...prev, [id]: '' }))
    } catch (e: any) { alert('Fehler: ' + e.message) }
  }

  const mannNames = ['tf', 'm1', 'm2', 'm3'].map(k => mannschaft[k]?.name).filter(Boolean).join(', ')

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Lade…</div>
  )
  if (!user) { navigate('/login'); return null }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <PubHeader title="Protokoll bearbeiten" onBack={() => navigate('/unitas')} />
      <PubWrap>

        {mannNames && (
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '12px 16px', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            {pik(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>)}
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text)' }}>Mannschaft:</strong> {mannNames}</span>
          </div>
        )}

        {lockedReason && (
          <div style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: '.75rem', color: '#991b1b', fontWeight: 600, fontSize: '.9rem' }}>
            🔒 {lockedReason}
          </div>
        )}

        <form ref={formRef} onChange={() => !locked && scheduleAutoSave()}>
          <fieldset disabled={locked} style={{ border: 'none', margin: 0, padding: 0 }}>

            <PubSection title="Einsatzdaten" open icon={pik(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>)}>
              <div style={grid}>
                <label style={lbl}>Einsatz-Nr.<input style={inp} name="einsatz_nr" type="text" /></label>
                <label style={lbl}>Auftrags-Nr. (ILS)<input style={inp} name="auftrags_nr" type="text" /></label>
                <label style={lbl}>Rufname<input style={inp} name="rufname" type="text" /></label>
                <label style={lbl}>Fahrzeug / Einheit<input style={inp} name="fahrzeug" type="text" /></label>
                <label style={lbl}>Einsatzart / Stichwort<input style={inp} name="einsatz_art" type="text" /></label>
                <label style={lbl}>Alarmzeit<input style={inp} name="zeit_einsatz" type="datetime-local" value={alarmzeit} onChange={e => setAlarmzeit(e.target.value)} /></label>
                <input type="hidden" name="zeit_status3"    ref={refS3} />
                <input type="hidden" name="zeit_eintreffen" ref={refS4} />
                <input type="hidden" name="zeit_uebergabe"  ref={refUeg} />
                <input type="hidden" name="zeit_status1"    ref={refS1} />
                <input type="hidden" name="zeit_status2"    ref={refS2} />
                <label style={lbl}>Einsatzort / Adresse<input style={inp} name="einsatz_adresse" type="text" value={einsatzAdresse} onChange={e => setEinsatzAdresse(e.target.value)} /></label>
                <label style={lbl}>Transportziel<input style={inp} name="transport_ziel" type="text" /></label>
              </div>
            </PubSection>

            <PubSection title="Einsatz-Zeitstrahl" icon={pik(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>)}>
              <EinsatzTimeline
                alarmzeit={alarmzeit}
                defaultStandort=""
                defaultEinsatzort={einsatzAdresse}
                onTimesChange={times => {
                  if (refS3.current)  refS3.current.value  = times.status3
                  if (refS4.current)  refS4.current.value  = times.eintreffen
                  if (refUeg.current) refUeg.current.value = times.uebergabe
                  if (refS1.current)  refS1.current.value  = times.status1
                  if (refS2.current)  refS2.current.value  = times.status2
                }}
              />
            </PubSection>

            <PubSection title="Pat-Stammdaten" icon={pik(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>)}>
              <div style={grid}>
                <label style={lbl}>Name *<input style={inp} name="name" type="text" /></label>
                <label style={lbl}>Vorname *<input style={inp} name="vorname" type="text" /></label>
                <label style={lbl}>Geb.-Datum *<input style={inp} name="gebdatum" type="date" /></label>
                <label style={lbl}>Alter<input style={inp} name="alter" type="number" min={0} /></label>
                <label style={lbl}>Telefon<input style={inp} name="telefon" type="text" /></label>
                <label style={lbl}>Mobil<input style={inp} name="mobil" type="text" /></label>
                <label style={lbl}>Straße<input style={inp} name="strasse" type="text" /></label>
                <label style={lbl}>PLZ, Ort<input style={inp} name="plz_ort" type="text" /></label>
                <label style={lbl}>Kasse<input style={inp} name="kasse" type="text" /></label>
                <label style={lbl}>Vers.-Nr.<input style={inp} name="versnr" type="text" /></label>
                <label style={lbl}>Hausarzt<input style={inp} name="hausarzt" type="text" /></label>
                <label style={lbl}>Angehöriger<input style={inp} name="angehoeriger" type="text" /></label>
              </div>
            </PubSection>

            <PubSection title="Notfallgeschehen / Anamnese" open icon={pik(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>)}>
              <div style={field}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={lbl}>Notfallgeschehen</span>
                  <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--border-medium)', flexShrink: 0 }}>
                    {(['freitext', 'klick'] as const).map(m => (
                      <button key={m} type="button" onClick={() => m === 'klick' ? openKlick() : setAnamneseModus(m)} style={{ padding: '4px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '.78rem', fontWeight: anamneseModus === m ? 700 : 400, background: anamneseModus === m ? 'var(--accent)' : 'transparent', color: anamneseModus === m ? '#fff' : 'var(--text-secondary)', transition: 'all .15s' }}>
                        {m === 'freitext' ? 'Freitext' : 'Klickstruktur'}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea style={{ ...ta, display: anamneseModus === 'klick' ? 'none' : undefined }} name="notfallgeschehen" value={notfallText} onChange={e => setNotfallText(e.target.value)} placeholder="Freitext…" />
                {anamneseModus === 'klick' && (
                  <AnamneseAssistent messwerte={snapMesswerte} verlauf={verlauf} onComplete={text => { setNotfallText(text); setAnamneseModus('freitext') }} onCancel={() => setAnamneseModus('freitext')} />
                )}
              </div>
              <div style={field}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={lbl}>Verlaufsbeschreibung</span>
                  <button type="button" onClick={() => setVerlaufModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    {pik(<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>, 14)} Vitalwerte
                  </button>
                </div>
                <textarea style={ta} name="verlaufsbeschreibung" value={verlaufText} onChange={e => setVerlaufText(e.target.value)} />
                {verlaufModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setVerlaufModal(false)}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 8px 40px rgba(0,0,0,.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.1rem', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-subtle)' }}>
                        <span style={{ fontWeight: 700, fontSize: '.95rem' }}>Vitalwerte — Zeile auswählen</span>
                        <button type="button" onClick={() => setVerlaufModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
                      </div>
                      <div style={{ padding: '1rem', overflowX: 'auto' }}>
                        {verlauf.filter(r => r.zeit || r.rr_sys || r.hf || r.spo2).length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', textAlign: 'center', margin: 0 }}>Noch keine Vitalwerte eingetragen.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
                            <thead><tr>{['Zeit','RR sys','RR dia','HF','O₂','SpO₂','etCO₂','Schmerz',''].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '5px 8px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                            <tbody>
                              {verlauf.map((r, i) => {
                                if (!r.zeit && !r.rr_sys && !r.hf && !r.spo2) return null
                                const parts: string[] = []
                                if (r.zeit) parts.push(`Zeit: ${r.zeit}`)
                                if (r.rr_sys || r.rr_dia) parts.push(`RR: ${r.rr_sys || '–'}/${r.rr_dia || '–'} mmHg`)
                                if (r.hf) parts.push(`HF: ${r.hf}/min`)
                                if (r.spo2) parts.push(`SpO₂: ${r.spo2} %`)
                                if (r.etco2) parts.push(`etCO₂: ${r.etco2} mmHg`)
                                if (r.o2) parts.push(`O₂: ${r.o2} l/min`)
                                if (r.schmerz) parts.push(`Schmerz: ${r.schmerz}/10`)
                                return (
                                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => { setVerlaufText(parts.join(', ')); setVerlaufModal(false) }}>
                                    {(['zeit','rr_sys','rr_dia','hf','o2','spo2','etco2','schmerz'] as (keyof VRow)[]).map(k => (
                                      <td key={k} style={{ border: '0.5px solid var(--border)', padding: '5px 8px', color: r[k] ? 'var(--text)' : 'var(--text-secondary)' }}>{r[k] || '–'}</td>
                                    ))}
                                    <td style={{ border: '0.5px solid var(--border)', padding: '5px 8px' }}><span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '.78rem', whiteSpace: 'nowrap' }}>Übernehmen</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div style={field}><label style={lbl}>Vorerkrankungen<textarea style={ta} name="vorerkrankungen" /></label></div>
                <div style={field}><label style={lbl}>Dauermedikation Patient (Freitext)<textarea style={ta} name="vormedikation_patient" /></label></div>
              </div>
              <div style={field}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Dauermedikation
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>Wirkstoff aus Datenbank übernehmen oder Barcode scannen</span>
                </div>
                {locked ? (
                  dauerMeds.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {dauerMeds.map((m, i) => (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg-subtle)', border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: '6px 10px', fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>{m.name}</span>
                          {m.wirkstoff && <span style={{ color: 'var(--text-secondary)' }}>({m.wirkstoff})</span>}
                          {m.dosis && <span>{m.dosis}</span>}
                          {m.pzn && <span style={{ fontSize: 11 }}>PZN {m.pzn}</span>}
                        </div>
                      ))}
                    </div>
                  ) : <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine eingetragen</span>
                ) : (
                  <DauermedikationPicker value={dauerMeds} onChange={v => { setDauerMeds(v); scheduleAutoSave() }} />
                )}
              </div>
              <div style={field}><label style={lbl}>Allergien / Unverträglichkeiten<input style={inp} name="allergien" type="text" placeholder="Keine bekannt" /></label></div>
              <div style={{ marginTop: '.75rem' }}>
                <label style={{ ...lbl, marginBottom: 6 }}>Fotos</label>
                <input type="file" accept="image/*" capture="environment" multiple onChange={async e => {
                  const files = Array.from(e.target.files || [])
                  const b64s = await Promise.all(files.map(f => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f) })))
                  setPhotos(p => [...p, ...b64s])
                }} />
                {photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                    {photos.map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />
                        <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.5)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '1px 5px', fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PubSection>

            <PubSection title="NACA / Bewusstsein / Verdachtsdiagnose" open icon={pik(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>)}>
              <div style={{ marginBottom: '.75rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>NACA-Score</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {['0','I','II','III','IV','V','VI','VII'].map(v => <label key={v} style={pill}><input type="radio" name="naca" value={v} /> {v}</label>)}
                </div>
              </div>
              <div style={{ marginBottom: '.75rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Bewusstsein</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {['nicht beurteilbar','wach','getrübt','bewusstlos','reaktionslos','auf Ansprache','Reaktion auf Schmerz','analgosediert / Narkose'].map(v => <label key={v} style={pill}><input type="radio" name="bewusstsein" value={v} /> {v}</label>)}
                </div>
              </div>
              <div style={field}><label style={lbl}>Verdachtsdiagnose / Erstdiagnose<input style={inp} name="erstdiagnose_text" type="text" /></label></div>
            </PubSection>

            <PubSection title="Glasgow Coma Scale" icon={pik(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>)}>
              {([['gcs_e','Augenöffnung (E)',[['4','spontan'],['3','auf Geräusch'],['2','auf Druck'],['1','keine']]],['gcs_v','Verbale Antwort (V)',[['5','orientiert'],['4','verwirrt'],['3','Wörter'],['2','Laute'],['1','keine']]],['gcs_m','Motorik (M)',[['6','folgt'],['5','lokalisiert'],['4','beugt norm.'],['3','beugt abnorm.'],['2','streckt'],['1','keine']]]] as [string,string,[string,string][]][]).map(([name,title,opts]) => (
                <div key={name} style={{ marginBottom: '.75rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {opts.map(([v,l]) => <label key={v} style={pill}><input type="radio" name={name} value={v} onChange={() => setGcs(g => ({ ...g, [name.slice(4)]: Number(v) }))} /> {l} ({v})</label>)}
                  </div>
                </div>
              ))}
              <div style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontWeight: 700, color: 'var(--text)' }}>GCS Summe: <span style={{ fontSize: '1.2rem' }}>{gcsSum || '—'}</span></div>
            </PubSection>

            <PubSection title="Messwerte / Atmung" icon={pik(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>)}>
              <div style={grid}>
                {[['rr_sys','RR syst. (mmHg)'],['rr_dia','RR diast. (mmHg)'],['hf','HF (/min)'],['af','AF (/min)'],['spo2','SpO₂ (%)'],['etco2','etCO₂ (mmHg)'],['temp','Temp (°C)'],['bz_mg','BZ (mg/dl)'],['schmerz','Schmerz (0–10)']].map(([n,l]) => (
                  <label key={n} style={lbl}>{l}<input style={inp} name={n} type="number" step={n === 'temp' ? '0.1' : '1'} /></label>
                ))}
              </div>
              <div style={{ marginTop: '.75rem', fontWeight: 700 }}>Atmung</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {[['atm_apnoe','Apnoe'],['atm_stridor','Stridor'],['atm_dyspnoe','Dyspnoe'],['atm_zyanose','Zyanose'],['atm_beatmung','Beatmung'],['atm_verlegung','Atemwegsverlegung']].map(([n,l]) => (
                  <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
                ))}
              </div>
              <div style={{ marginTop: '.5rem', fontWeight: 700 }}>O₂-Gabe</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem', alignItems: 'center' }}>
                {[['o2','O₂'],['o2_nasal','Nasensonde'],['o2_maske','Maske'],['o2_reservoir','Reservoir']].map(([n,l]) => (
                  <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
                ))}
                <label style={{ ...lbl, marginLeft: '.5rem' }}>Flow (l/min)<input style={{ ...inp, width: 100 }} name="o2_flow" type="number" step="0.5" /></label>
              </div>
            </PubSection>

            <PubSection title="Neurologie" icon={pik(<><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></>)}>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                {[['neu_unauff','Unauffällig'],['neu_sprachstoerung','Sprachstörung'],['neu_demenz','Demenz'],['neu_meningismus','Meningismus'],['neu_seitenzeichen','Seitenzeichen'],['neu_kein_laecheln','Kein Lächeln'],['neu_sehstoerung','Sehstörung'],['neu_querschnitt','Querschnitt'],['neu_babinski','Babinski'],['neu_vorbestehend','Vorbestehende Defizite']].map(([n,l]) => (
                  <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '.75rem' }}>
                <label style={lbl}>Sonstige Neurologie<input style={inp} name="neu_sonstige" type="text" /></label>
                <label style={lbl}>Zeitpunkt Symptombeginn<input style={inp} name="neu_zeit" type="time" /></label>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Extremitätenbewegung</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '.75rem' }}>
                {[['ext_r_arm','Arm rechts'],['ext_l_arm','Arm links'],['ext_r_bein','Bein rechts'],['ext_l_bein','Bein links']].map(([n,l]) => (
                  <div key={n}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--text)' }}>{l}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {['unauff.','vermindert','Parese','keine'].map(v => <label key={v} style={pill}><input type="radio" name={n} value={v} /> {v}</label>)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Pupillen</div>
              <div style={grid}>
                {[['pw_r','Pupille re.','lr_r'],['pw_l','Pupille li.','lr_l']].map(([n,l,lr]) => (
                  <div key={n}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--text)' }}>{l}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {['eng','mittel','weit'].map(v => <label key={v} style={pill}><input type="radio" name={n} value={v} /> {v}</label>)}
                      <label style={pill}><input type="checkbox" name={n === 'pw_r' ? 'pw_r_entrundet' : 'pw_l_entrundet'} /> entrundet</label>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
                      <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginRight: 6, alignSelf: 'center' }}>LR:</span>
                      {['prompt','träge','keine'].map(v => <label key={v} style={pill}><input type="radio" name={lr} value={v} /> {v}</label>)}
                    </div>
                  </div>
                ))}
              </div>
            </PubSection>

            <PubSection title="Rhythmus / EKG" icon={pik(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>)}>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {[['sr','Sinusrhythmus'],['stemi','STEMI'],['vf','Kammerflimmern'],['asystole','Asystolie'],['arrh_abs','Abs. Arrhythmie']].map(([n,l]) => (
                  <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
                ))}
              </div>
              <div style={grid}>
                <label style={lbl}>Standort<input style={inp} name="ekg_standort" type="text" /></label>
                <label style={lbl}>Pers-Nr.<input style={inp} name="ekg_persnr" type="text" /></label>
              </div>
            </PubSection>

            <PubSection title="Haut / Psyche" icon={pik(<><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>)}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Haut</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                {[['haut_unauff','Unauffällig'],['haut_falten','Fältchentest pos.'],['haut_oedeme','Ödeme'],['haut_dekubitus','Dekubitus'],['haut_kaltschweissig','Kaltschweißig'],['haut_exanthem','Exanthem']].map(([n,l]) => (
                  <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
                ))}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Psyche</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {[['psy_erregt','Erregt'],['psy_aggr','Aggressiv'],['psy_verlangsamt','Verlangsamt'],['psy_depressiv','Depressiv'],['psy_aengstlich','Ängstlich'],['psy_euphorisch','Euphorisch'],['psy_wahnhaft','Wahnhaft'],['psy_verwirrt','Verwirrt'],['psy_suizidal','Suizidal'],['psy_motor_unruhig','Motor. unruhig']].map(([n,l]) => (
                  <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
                ))}
              </div>
            </PubSection>

            <PubSection title="Erstdiagnose / Diagnose-Kategorien" icon={pik(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>)}>
              <div style={field}><label style={pill}><input type="checkbox" name="e_keine" /> Keine Erkrankung / Verletzung</label></div>
              {([
                ['ZNS',[['e_zns_schlaganfall','Schlaganfall'],['e_zns_tia','TIA'],['e_zns_blutung','Intrakr. Blutung'],['e_zns_lyse','Lyse'],['e_zns_krampf','Krampfanfall'],['e_zns_status_epilept','Status epilept.'],['e_zns_meningitis','Meningitis'],['e_zns_synkope','Synkope'],['e_zns_sonstige','Sonstige']]],
                ['Herz-Kreislauf',[['e_hk_acs','ACS'],['e_hk_stemi_vw','STEMI VW'],['e_hk_stemi_hw','STEMI HW'],['e_hk_tachy','Tachy'],['e_hk_brady','Brady'],['e_hk_embolie','Lungenembolie'],['e_hk_ortho','Orthostatisch'],['e_hk_insuff','Herzinsuff./Lungenödem'],['e_hk_hypert','Hypert. Notfall'],['e_hk_kard_schock','Kard. Schock'],['e_hk_schrittmacher','SM/ICD-Fehlfunktion'],['e_hk_sonstige','Sonstige']]],
                ['Atmung',[['e_atm_asthma','Asthma'],['e_atm_status_asthm','Status asthm.'],['e_atm_copd','COPD'],['e_atm_pneumonie','Pneumonie'],['e_atm_hypervent','Hyperventilation'],['e_atm_aspiration','Aspiration'],['e_atm_haemoptysen','Hämoptysen'],['e_atm_sonstige','Sonstige']]],
                ['Abdomen',[['e_abd_akut','Akutes Abdomen'],['e_abd_gi_ob','GI-Blutung ob.'],['e_abd_gi_un','GI-Blutung un.'],['e_abd_kolik','Kolik'],['e_abd_enteritis','Enteritis'],['e_abd_sonstige','Sonstige']]],
                ['Psychiatrie',[['e_psy_psychose','Psychose/Manie'],['e_psy_angst','Angst/Depression'],['e_psy_intox_akzid','Intox. akzid.'],['e_psy_intox_alkohol','Intox. Alkohol'],['e_psy_intox_drogen','Intox. Drogen'],['e_psy_intox_medis','Intox. Medis'],['e_psy_intox_sonstige','Intox. Sonstige'],['e_psy_entzug','Entzug/Delir'],['e_psy_suizid','Suizid(versuch)'],['e_psy_krise','Psych. Krise'],['e_psy_sonstige','Sonstige']]],
                ['Stoffwechsel',[['e_stw_hypo','Hypoglykämie'],['e_stw_hyper','Hyperglykämie'],['e_stw_exsiccose','Exsiccose'],['e_stw_uraemie','Urämie/ANV'],['e_stw_sonstige','Sonstige']]],
                ['Pädiatrie',[['e_paed_fieberkrampf','Fieberkrampf'],['e_paed_pseudokrupp','Pseudokrupp'],['e_paed_sids','SIDS/Near-SIDS']]],
                ['Gynäkologie',[['e_gyn_schwanger','Schwangerschaft'],['e_gyn_geburt','Droh./präklin. Geburt'],['e_gyn_eklampsie','(Prä-)Eklampsie'],['e_gyn_blutung','Vag. Blutung'],['e_gyn_sonstige','Sonstige']]],
                ['Weitere',[['e_anaphylaxie','Anaphylaxie'],['e_hitze','Hitzeerschöpfung'],['e_unterkuehlung','Unterkühlung'],['e_sepsis','Sepsis/sept. Schock'],['e_influenza','Influenza'],['e_hepatitis_hiv','Hepatitis/HIV'],['e_lumbago','Akutes Lumbago'],['e_epistaxis','Epistaxis'],['e_soziales','Soziales Problem'],['e_behandlungskompl','Behandlungskompl.'],['e_weitere_sonstige','Sonstige']]],
              ] as [string,[string,string][]][]).map(([cat,items]) => (
                <div key={cat} style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.5rem', marginTop: '.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{cat}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {items.map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
                  </div>
                </div>
              ))}
            </PubSection>

            <PubSection title="Verlauf" icon={pik(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>)}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                  <thead><tr>{['Zeit','RR sys','RR dia','HF','O₂ l/min','SpO₂ %','etCO₂',''].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', fontWeight: 700, color: 'var(--text)', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {verlauf.map((r, i) => (
                      <tr key={i}>
                        {(['zeit','rr_sys','rr_dia','hf','o2','spo2','etco2'] as (keyof VRow)[]).map(k => (
                          <td key={k} style={{ border: '0.5px solid var(--border)', padding: 4 }}>
                            <input style={{ ...inp, marginTop: 0, minWidth: 60 }} type={k === 'zeit' ? 'time' : 'number'} value={r[k]} onChange={e => setVerlauf(vv => vv.map((row, j) => j === i ? { ...row, [k]: e.target.value } : row))} />
                          </td>
                        ))}
                        <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><button type="button" onClick={() => setVerlauf(vv => vv.filter((_, j) => j !== i))} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', borderRadius: 6, cursor: 'pointer', fontWeight: 700, color: 'var(--accent)', padding: '4px 8px' }}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setVerlauf(vv => [...vv, emptyV()])} style={{ marginTop: '.5rem', border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.45rem .75rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>+ Zeile hinzufügen</button>
              {(() => {
                const rows = verlauf.filter(r => r.zeit)
                if (rows.length < 1) return null
                const W = 560, H = 200, PAD = { l: 38, r: 12, t: 14, b: 28 }
                const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b
                const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
                const times = rows.map(r => toMin(r.zeit))
                const tMin = Math.min(...times), tMax = Math.max(...times), tSpan = tMax - tMin || 1
                const cx = (t: number) => PAD.l + ((t - tMin) / tSpan) * iW
                const SERIES = [{ key: 'rr_sys', label: 'RR sys', color: '#ef4444', min: 0, max: 220 }, { key: 'rr_dia', label: 'RR dia', color: '#f87171', min: 0, max: 220 }, { key: 'hf', label: 'HF', color: '#3b82f6', min: 0, max: 220 }, { key: 'spo2', label: 'SpO₂', color: '#22c55e', min: 70, max: 100 }, { key: 'etco2', label: 'etCO₂', color: '#f97316', min: 0, max: 80 }] as { key: keyof VRow; label: string; color: string; min: number; max: number }[]
                const cy = (v: number, min: number, max: number) => PAD.t + (1 - (v - min) / (max - min)) * iH
                const gridH = 220, bigStep = 55
                const gridYBig = Array.from({ length: Math.floor(gridH / bigStep) + 1 }, (_, i) => i * bigStep)
                const gridYSmall = Array.from({ length: Math.floor(gridH / 10) + 1 }, (_, i) => i * 10)
                return (
                  <div style={{ marginTop: '1rem', border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
                    <div style={{ padding: '8px 12px 0', fontSize: '.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Verlaufsgrafik</div>
                    <div style={{ overflowX: 'auto', padding: '0 4px 8px' }}>
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, height: 'auto', display: 'block' }}>
                        {gridYSmall.map(v => <line key={`gs${v}`} x1={PAD.l} y1={cy(v,0,gridH)} x2={W-PAD.r} y2={cy(v,0,gridH)} stroke="var(--border)" strokeWidth={0.4} />)}
                        {gridYBig.map(v => <line key={`gb${v}`} x1={PAD.l} y1={cy(v,0,gridH)} x2={W-PAD.r} y2={cy(v,0,gridH)} stroke="var(--border-medium)" strokeWidth={0.8} />)}
                        {rows.map((_, i) => <line key={`gx${i}`} x1={cx(times[i])} y1={PAD.t} x2={cx(times[i])} y2={H-PAD.b} stroke="var(--border-medium)" strokeWidth={0.8} />)}
                        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H-PAD.b} stroke="var(--text-secondary)" strokeWidth={1} />
                        <line x1={PAD.l} y1={H-PAD.b} x2={W-PAD.r} y2={H-PAD.b} stroke="var(--text-secondary)" strokeWidth={1} />
                        {gridYBig.map(v => <text key={v} x={PAD.l-4} y={cy(v,0,gridH)+3.5} textAnchor="end" fontSize={9} fill="var(--text-secondary)">{v}</text>)}
                        {rows.map((r, i) => <text key={i} x={cx(times[i])} y={H-5} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">{r.zeit}</text>)}
                        {SERIES.map(s => {
                          const pts = rows.map((r, i) => ({ x: cx(times[i]), y: cy(parseFloat(r[s.key] as string), s.min, s.max), v: r[s.key] })).filter(p => p.v !== '' && !isNaN(p.y))
                          if (!pts.length) return null
                          const d = pts.map((p, i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ')
                          return (
                            <g key={s.key}>
                              {pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />}
                              {pts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={4} fill={s.color} /><text x={p.x} y={p.y-6} textAnchor="middle" fontSize={8} fill={s.color} fontWeight="bold">{p.v}</text></g>)}
                            </g>
                          )
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

            <PubSection title="Verletzungen / Trauma" icon={pik(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>)}>
              <div style={{ marginBottom: '.5rem' }}><label style={pill}><input type="checkbox" name="v_keine" /> Keine Verletzung</label></div>
              {([
                ['Körper',[['v_sht','SHT'],['v_gesicht','Gesicht'],['v_hals','Hals'],['v_thorax','Thorax'],['v_abdomen','Abdomen'],['v_ws','Wirbelsäule'],['v_becken','Becken'],['v_obext','Obere Ext.'],['v_untext','Untere Ext.'],['v_weich','Weichteile']]],
                ['Besonderheiten',[['v_verbrennung','Verbrennung'],['v_veraetzung','Verätzung'],['v_verschuettung','Verschüttung'],['v_einklemmung','Einklemmung'],['v_inhalation','Inhalationstrauma'],['v_elektrounfall','Elektrounfall'],['v_ertrinken','Beinahe-Ertrinken'],['v_tauchunfall','Tauchunfall'],['v_haemo_schock','Hämorr. Schock']]],
                ['Mechanismus',[['v_trauma_stumpf','Stumpf'],['v_trauma_penetr','Penetrierend'],['v_sturz_eben','Sturz ebenerdig'],['v_sturz_unter3m','Sturz <3m'],['v_sturz_ueber3m','Sturz >3m']]],
                ['Verkehr',[['v_vt_fussgaenger','Fußgänger'],['v_vt_escooter','E-Scooter'],['v_vt_fahrrad','Fahrrad'],['v_vt_ebike','E-Bike'],['v_vt_motorrad','Motorrad'],['v_vt_pkw','PKW'],['v_vt_lkw','LKW'],['v_vt_bus','Bus']]],
                ['Gewalt',[['v_gew_schlag','Schlag'],['v_gew_schuss','Schuss'],['v_gew_stich','Stich'],['v_gew_verbrechen','Gewaltverbrechen'],['v_gew_sonstige','Sonstige']]],
              ] as [string,[string,string][]][]).map(([cat,items]) => (
                <div key={cat} style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.5rem', marginTop: '.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{cat}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {items.map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.75rem', marginTop: '.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '.5rem', marginBottom: '.5rem' }}>
                  <label style={lbl}>Verbrennung Grad<input style={inp} name="v_verbrennung_grad" type="text" placeholder="I / II / III" /></label>
                  <label style={lbl}>Verbrennung %<input style={inp} name="v_verbrennung_pct" type="number" /></label>
                </div>
                <label style={lbl}>Sonstige Verletzungen<input style={inp} name="v_sonstige" type="text" /></label>
                <div style={{ marginTop: '.5rem' }}><label style={lbl}>Freitext Verletzungen<textarea style={ta} name="verletz_text" /></label></div>
              </div>
            </PubSection>

            <PubSection title="Atemwege / Lagerung / Immobilisation" icon={pik(<><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></>)}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Atemwegsmanagement</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                {[['awm_freihalten','Freihalten'],['awm_absaugung','Absaugung'],['awm_opa','OPA/Guedel'],['awm_npa','NPA/Wendl'],['awm_lma','LMA/SGA'],['awm_intubation','Intubation (OTI)']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Lagerung</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                {[['lag_flach','Flachlagerung'],['lag_schock','Schocklagerung'],['lag_ok_hoch','OK hoch'],['lag_ssl','Stabile Seitenlage'],['lag_sitzend','Sitzend'],['lag_haengend','Hängeposition']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Immobilisation</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {[['immo_hws','HWS-Orthese'],['immo_spineboard','Spineboard'],['immo_vakuum','Vakuummatratze']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
            </PubSection>

            <PubSection title="Beatmung / Defibrillation" icon={pik(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>)}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Beatmung</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {[['beat_manuell','Manuell'],['beat_maschinell','Maschinell'],['beat_niv','NIV'],['beat_notfallnarkose','Notfallnarkose']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '.5rem', marginBottom: '.75rem' }}>
                {[['beat_fio2','FiO₂'],['beat_af','AF /min'],['beat_peep','PEEP mbar'],['beat_pmax','Pmax mbar'],['beat_amv','AMV l/min']].map(([n,l]) => <label key={n} style={lbl}>{l}<input style={inp} name={n} type="number" /></label>)}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Defibrillation</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {[['defi_aed','AED'],['defi_defi','Defi'],['defi_mono','Monophasisch'],['defi_bi','Biphasisch']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--text)' }}>Erstanwendung durch</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {[['defi_erstanw_laie','Laie'],['defi_erstanw_fr','First Resp.'],['defi_erstanw_rd','Rettungsdienst'],['defi_erstanw_arzt','Arzt']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '.5rem' }}>
                {[['defi_zeitpunkt','Zeitpunkt 1. Defi'],['defi_rosc','ROSC'],['defi_anzahl','Anzahl'],['defi_energie','Energie (kJ)']].map(([n,l]) => <label key={n} style={lbl}>{l}<input style={inp} name={n} type="text" /></label>)}
              </div>
            </PubSection>

            <PubSection title="Zugang / Infusion / Medikamente" icon={pik(<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>)}>
              <div style={grid}>
                <label style={lbl}>Zugang Art<select style={sel} name="zugang_art"><option value="">—</option><option value="iv">i.v.</option><option value="io">i.o.</option></select></label>
                <label style={lbl}>Region<input style={inp} name="zugang_region" type="text" /></label>
                <label style={lbl}>Gauge<input style={inp} name="zugang_gauge" type="number" /></label>
                <label style={lbl}>Infusion<input style={inp} name="inf_art" type="text" placeholder="NaCl 0,9% …" /></label>
                <label style={lbl}>Menge (ml)<input style={inp} name="inf_menge" type="number" /></label>
              </div>
              <div style={{ fontWeight: 700, margin: '1rem 0 .5rem' }}>Medikamente</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
                  <thead><tr>{['Medikament','Dosis','Einheit','Route','Zeit','Hinweis',''].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {meds.map((m, i) => (
                      <tr key={i}>
                        {(['name','dose','unit'] as (keyof Med)[]).map(k => <td key={k} style={{ border: '0.5px solid var(--border)', padding: 4 }}><input style={{ ...inp, marginTop: 0 }} value={m[k]} onChange={e => setMeds(ms => ms.map((r,j) => j===i ? {...r,[k]:e.target.value} : r))} /></td>)}
                        <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><select style={{ ...sel, marginTop: 0 }} value={m.route} onChange={e => setMeds(ms => ms.map((r,j) => j===i ? {...r,route:e.target.value} : r))}><option value="">—</option>{['i.v.','i.o.','p.o.','s.c.','i.m.','inhal.'].map(v=><option key={v}>{v}</option>)}</select></td>
                        <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><input style={{ ...inp, marginTop: 0 }} type="time" value={m.time} onChange={e => setMeds(ms => ms.map((r,j) => j===i ? {...r,time:e.target.value} : r))} /></td>
                        <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><input style={{ ...inp, marginTop: 0 }} value={m.note} onChange={e => setMeds(ms => ms.map((r,j) => j===i ? {...r,note:e.target.value} : r))} /></td>
                        <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><button type="button" onClick={() => setMeds(ms => ms.filter((_,j) => j!==i))} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', borderRadius: 6, cursor: 'pointer', fontWeight: 700, color: 'var(--accent)', padding: '4px 8px' }}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setMeds(ms => [...ms, { name:'',dose:'',unit:'',route:'',time:'',note:'' }])} style={{ marginTop: '.5rem', border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.45rem .75rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>+ Zeile hinzufügen</button>
            </PubSection>

            <PubSection title="Reanimation" icon={pik(<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>)}>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                <label style={pill}><input type="checkbox" name="rean" /> CPR durchgeführt</label>
                <label style={pill}><input type="checkbox" name="rean_tod" /> Todesfeststellung</label>
              </div>
              <div style={grid}>
                <label style={lbl}>Uhrzeit Todesfeststellung<input style={inp} name="rean_tod_zeit" type="time" /></label>
                <label style={lbl}>Beginn Reanimation<input style={inp} name="rean_beginn" type="datetime-local" /></label>
                <label style={lbl}>Ende Reanimation<input style={inp} name="rean_ende" type="datetime-local" /></label>
                <label style={lbl}>Defibrillationen<input style={inp} name="rean_defib" type="number" min={0} /></label>
              </div>
            </PubSection>

            <PubSection title="Übergabe / Besonderheiten" icon={pik(<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>)}>
              <div style={grid}>
                <label style={lbl}>Übergabe Ziel<input style={inp} name="uebergabe_ziel" type="text" /></label>
                <label style={lbl}>Übergabe an (Name)<input style={inp} name="uebergabe_name" type="text" /></label>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', margin: '.75rem 0 .5rem' }}>
                {[['ev_transportverweigerung','Transportverweigerung'],['ev_nur_untersuchung','Nur Untersuchung'],['ev_zwangseinweisung','Zwangseinweisung'],['ev_transport_sondersignal','Transport mit Sondersignal'],['ev_manv','MANV'],['ev_lna','LNA am Einsatz'],['ev_schwerlast','Schwerlasttransport']].map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
              <label style={lbl}>Bemerkungen<textarea style={ta} name="bemerkungen" /></label>
            </PubSection>

            <PubSection title="Unterschrift" open icon={pik(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>)}>
              <div style={grid}>
                <label style={lbl}>Name Ausfüller<input style={inp} name="ausfueller_name" type="text" /></label>
                <label style={lbl}>Datum/Uhrzeit<input style={inp} name="ausfueller_zeit" type="datetime-local" /></label>
              </div>
              <div style={{ marginTop: '.75rem', border: '0.5px dashed var(--border-medium)', borderRadius: 12, padding: '.75rem', background: 'var(--bg-subtle)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Unterschrift (Finger/Maus)</div>
                {locked && sigUrl ? (
                  <img src={sigUrl} alt="Unterschrift" style={{ maxWidth: '100%', border: '0.5px solid var(--border)', borderRadius: 8 }} />
                ) : locked ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Keine Unterschrift hinterlegt.</div>
                ) : (
                  <>
                    <canvas ref={canvasRef} width={800} height={200} style={{ width: '100%', height: 160, border: '0.5px solid var(--border)', borderRadius: 10, touchAction: 'none', cursor: 'crosshair', background: '#fff' }} />
                    <button type="button" onClick={clearSig} style={{ marginTop: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', padding: '.35rem .6rem', borderRadius: 8, cursor: 'pointer', fontSize: '.9rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}>Signatur löschen</button>
                  </>
                )}
              </div>
              {!locked && (
                <button type="button" disabled={sending} onClick={finish} style={{ marginTop: '1rem', width: '100%', background: sending ? 'var(--bg-hover)' : '#16a34a', color: sending ? 'var(--text-secondary)' : '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '1.05rem', fontFamily: 'inherit' }}>
                  {sending ? 'Wird abgeschlossen…' : 'Protokoll abschließen'}
                </button>
              )}
              {!locked && <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '.5rem', textAlign: 'center' }}>Nach dem Abschließen kann das Protokoll nicht mehr bearbeitet werden.</p>}
            </PubSection>

          </fieldset>
        </form>

        {/* Rückfragen vom Supervisor – immer sichtbar, auch wenn gesperrt */}
        {rueckfragen.length > 0 && (
          <PubSection title={`Rückfragen vom Supervisor (${rueckfragen.filter(r => r.status === 'offen').length} offen)`} open icon={pik(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>)}>
            {rueckfragen.map(rq => (
              <div key={rq.id} style={{
                background: rq.status === 'beantwortet' ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${rq.status === 'beantwortet' ? '#bbf7d0' : '#fcd34d'}`,
                borderRadius: 10, padding: 12, marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Rückfrage</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(rq.created).toLocaleString('de-DE')}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: rq.status === 'beantwortet' ? '#dcfce7' : '#fef9c3', color: rq.status === 'beantwortet' ? '#166534' : '#92400e' }}>
                    {rq.status === 'beantwortet' ? 'Beantwortet' : 'Offen'}
                  </span>
                </div>
                <div style={{ fontSize: 14, padding: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 6, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>Frage:</div>
                  {rq.frage}
                </div>
                {rq.status === 'beantwortet' && rq.antwort ? (
                  <div style={{ fontSize: 14, background: '#dcfce7', borderRadius: 6, padding: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 2 }}>Deine Stellungnahme:</div>
                    {rq.antwort}
                  </div>
                ) : (
                  <>
                    <label style={{ ...lbl, marginBottom: 4 }}>Stellungnahme:</label>
                    <textarea
                      value={rqAntworten[rq.id] || ''}
                      onChange={e => setRqAntworten(prev => ({ ...prev, [rq.id]: e.target.value }))}
                      rows={3}
                      placeholder="Antwort eingeben…"
                      style={{ ...ta, marginBottom: 8 }}
                    />
                    <button
                      onClick={() => respondToRueckfrage(rq.id)}
                      disabled={!rqAntworten[rq.id]?.trim()}
                      style={{
                        padding: '10px 20px',
                        background: !rqAntworten[rq.id]?.trim() ? 'var(--bg-secondary)' : '#16a34a',
                        color: !rqAntworten[rq.id]?.trim() ? 'var(--text-secondary)' : '#fff',
                        border: 'none', borderRadius: 10, fontWeight: 700,
                        cursor: !rqAntworten[rq.id]?.trim() ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', fontSize: 14,
                      }}
                    >
                      Stellungnahme absenden
                    </button>
                  </>
                )}
              </div>
            ))}
          </PubSection>
        )}

      </PubWrap>

      {!locked && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '0.5px solid var(--border)', padding: '.75rem 1rem', zIndex: 20 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {saved && <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>Gespeichert</span>}
            <button disabled={sending} onClick={submit} style={{ background: sending ? 'var(--bg-hover)' : 'var(--accent)', border: 'none', color: sending ? 'var(--text-secondary)' : '#fff', padding: '12px 28px', borderRadius: 12, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>
              {sending ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      <style>{`details > summary::-webkit-details-marker { display: none; }`}</style>
    </div>
  )
}
