import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

type Med = { name: string; dose: string; unit: string; route: string; time: string; note: string }
type VRow = { zeit: string; rr_sys: string; rr_dia: string; hf: string; o2: string; spo2: string; etco2: string; schmerz: string }
const emptyV = (): VRow => ({ zeit: '', rr_sys: '', rr_dia: '', hf: '', o2: '', spo2: '', etco2: '', schmerz: '' })

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '0.5px solid var(--border-strong)', borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', marginTop: 4 }
const sel: React.CSSProperties = { ...inp }
const ta: React.CSSProperties = { ...inp, minHeight: 80, resize: 'vertical' }
const lbl: React.CSSProperties = { display: 'block', fontWeight: 600, color: 'var(--text)', fontSize: 14 }
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.3rem', border: '0.5px solid var(--border-medium)', borderRadius: 999, padding: '.2rem .5rem', background: 'var(--bg-subtle)', fontSize: '.9rem', cursor: 'pointer', margin: '2px', color: 'var(--text)' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }
const cardHead: React.CSSProperties = { padding: '.85rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)' }
const cardBody: React.CSSProperties = { padding: '1rem' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={cardHead}>{title}</div>
      <div style={cardBody}>{children}</div>
    </div>
  )
}

export default function ProtokollBearbeiten() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)

  const [meds, setMeds] = useState<Med[]>([])
  const [verlauf, setVerlauf] = useState<VRow[]>([emptyV()])
  const [gcs, setGcs] = useState({ e: 0, v: 0, m: 0 })
  const [mannschaft, setMannschaft] = useState<Record<string, { name: string } | null>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockedReason, setLockedReason] = useState('')
  const [sigUrl, setSigUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { if (user && patientId) loadRecord() }, [user, patientId])

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
  }, [locked])

  async function loadRecord() {
    try {
      const rec = await pb.collection('patients').getOne(patientId!)
      const p = rec.payload || {}
      if (p.mannschaft) setMannschaft(p.mannschaft)
      if (p.medications?.length) setMeds(p.medications)
      if (p.verlauf?.length) setVerlauf(p.verlauf)
      if (p.gcs_e) setGcs({ e: Number(p.gcs_e) || 0, v: Number(p.gcs_v) || 0, m: Number(p.gcs_m) || 0 })
      if (p.signature) setSigUrl(p.signature)
      const age = Date.now() - new Date(rec.created).getTime()
      const over24h = age > 24 * 60 * 60 * 1000
      if (rec.status !== 'offen') { setLocked(true); setLockedReason('Dieses Protokoll wurde abgeschlossen.') }
      else if (over24h) {
        setLocked(true); setLockedReason('Dieses Protokoll wurde nach 24 Stunden automatisch gesperrt.')
        pb.collection('patients').update(patientId!, { status: 'archiviert' }).catch(() => {})
      }
      setTimeout(() => {
        const form = formRef.current; if (!form) return
        form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]').forEach(el => {
          const v = p[el.name]
          if (v === undefined || v === null) return
          if (el.type === 'checkbox') (el as HTMLInputElement).checked = !!v
          else if (el.type === 'radio') (el as HTMLInputElement).checked = el.value === v
          else el.value = String(v)
        })
      }, 50)
    } catch {
      alert('Protokoll nicht gefunden.')
      navigate('/unitas')
    } finally {
      setLoading(false)
    }
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
      try { await pb.collection('patients').update(patientId, { payload: { ...collectData(), signature: sigUrl } }) } catch {}
    }, 1500)
  }

  async function finish() {
    if (!sigUrl) { alert('Bitte zuerst unterschreiben.'); return }
    setSending(true)
    try {
      await pb.collection('patients').update(patientId!, { payload: { ...collectData(), signature: sigUrl }, status: 'archiviert' })
      setLocked(true); setLockedReason('Dieses Protokoll wurde abgeschlossen.')
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
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
    data.verlauf = verlauf.filter(r => r.zeit || r.rr_sys || r.hf)
    data.gcs_e = gcs.e; data.gcs_v = gcs.v; data.gcs_m = gcs.m
    return data
  }

  async function submit() {
    setSending(true)
    try {
      await pb.collection('patients').update(patientId!, { payload: { ...collectData(), signature: sigUrl } })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  const gcsSum = gcs.e + gcs.v + gcs.m

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Lade…</div>
  )
  if (!user) { navigate('/login'); return null }

  const mannNames = ['tf','m1','m2','m3'].map(k => mannschaft[k]?.name).filter(Boolean).join(', ')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1rem', height: 54, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/unitas')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 16, cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Zurück
          </button>
          <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Protokoll bearbeiten</h1>
          <div style={{ width: 72 }} />
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem 1rem 120px' }}>
        {/* Mannschaft (read-only) */}
        {mannNames && (
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '12px 16px', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text)' }}>Mannschaft:</strong> {mannNames}</span>
          </div>
        )}

        {lockedReason && (
          <div style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: '.75rem', color: '#991b1b', fontWeight: 600, fontSize: '.9rem' }}>
            🔒 {lockedReason}
          </div>
        )}

        <form ref={formRef} onChange={() => !locked && scheduleAutoSave()}>
          <Section title="🚑 Einsatzdaten">
            <div style={grid}>
              <label style={lbl}>Einsatz-Nr.<input style={inp} name="einsatz_nr" type="text" /></label>
              <label style={lbl}>Alarmzeit<input style={inp} name="zeit_einsatz" type="datetime-local" /></label>
              <label style={lbl}>Eintreffen<input style={inp} name="zeit_eintreffen" type="datetime-local" /></label>
              <label style={lbl}>Transportbeginn<input style={inp} name="zeit_transport" type="datetime-local" /></label>
              <label style={lbl}>Übergabe<input style={inp} name="zeit_uebergabe" type="datetime-local" /></label>
              <label style={lbl}>Einsatzort<input style={inp} name="einsatz_adresse" type="text" /></label>
              <label style={lbl}>Transportziel<input style={inp} name="transport_ziel" type="text" /></label>
              <label style={lbl}>Fahrzeug / Rufname<input style={inp} name="fahrzeug" type="text" /></label>
            </div>
          </Section>

          <Section title="🪪 Patient">
            <div style={grid}>
              <label style={lbl}>Name<input style={inp} name="name" type="text" /></label>
              <label style={lbl}>Vorname<input style={inp} name="vorname" type="text" /></label>
              <label style={lbl}>Geb.-Datum<input style={inp} name="gebdatum" type="date" /></label>
              <label style={lbl}>Alter<input style={inp} name="alter" type="number" min={0} /></label>
              <label style={lbl}>Kasse<input style={inp} name="kasse" type="text" /></label>
              <label style={lbl}>Vers.-Nr.<input style={inp} name="versnr" type="text" /></label>
            </div>
          </Section>

          <Section title="📋 Notfallgeschehen">
            <label style={lbl}>Notfallgeschehen<textarea style={ta} name="notfallgeschehen" /></label>
            <label style={{ ...lbl, marginTop: '.75rem' }}>Vorerkrankungen<textarea style={ta} name="vorerkrankungen" /></label>
            <label style={{ ...lbl, marginTop: '.75rem' }}>Allergien<input style={inp} name="allergien" type="text" /></label>
          </Section>

          <Section title="🔢 NACA / Bewusstsein">
            <div style={{ marginBottom: '.75rem' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>NACA-Score</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {['0','I','II','III','IV','V','VI','VII'].map(v => <label key={v} style={pill}><input type="radio" name="naca" value={v} /> {v}</label>)}
              </div>
            </div>
            <div style={{ marginBottom: '.75rem' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Bewusstsein</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {['wach','getrübt','bewusstlos','reaktionslos','auf Ansprache','Reaktion auf Schmerz'].map(v => <label key={v} style={pill}><input type="radio" name="bewusstsein" value={v} /> {v}</label>)}
              </div>
            </div>
            <label style={lbl}>Verdachtsdiagnose<input style={inp} name="erstdiagnose_text" type="text" /></label>
          </Section>

          <Section title="👁 GCS">
            {([['gcs_e','Augen (E)',[['4','spontan'],['3','Geräusch'],['2','Druck'],['1','keine']]],['gcs_v','Verbal (V)',[['5','orientiert'],['4','verwirrt'],['3','Wörter'],['2','Laute'],['1','keine']]],['gcs_m','Motorik (M)',[['6','folgt'],['5','lokalisiert'],['4','Beugung n.'],['3','Beugung a.'],['2','Streckung'],['1','keine']]]] as [string,string,[string,string][]][]).map(([name,title,opts]) => (
              <div key={name} style={{ marginBottom: '.75rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {opts.map(([v,l]) => <label key={v} style={pill}><input type="radio" name={name} value={v} onChange={() => setGcs(g => ({ ...g, [name.slice(4)]: Number(v) }))} /> {l} ({v})</label>)}
                </div>
              </div>
            ))}
            <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '8px 12px', fontWeight: 700 }}>Summe: {gcsSum || '—'}</div>
          </Section>

          <Section title="🩺 Messwerte">
            <div style={grid}>
              {[['rr_sys','RR syst.'],['rr_dia','RR diast.'],['hf','HF /min'],['spo2','SpO₂ %'],['etco2','etCO₂'],['temp','Temp °C'],['bz_mg','BZ mg/dl'],['schmerz','Schmerz 0–10']].map(([n,l]) => (
                <label key={n} style={lbl}>{l}<input style={inp} name={n} type="number" /></label>
              ))}
            </div>
          </Section>

          <Section title="📈 Verlauf">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                <thead><tr>{['Zeit','RR sys','RR dia','HF','O₂','SpO₂','etCO₂',''].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', fontWeight: 700, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {verlauf.map((r, i) => (
                    <tr key={i}>
                      {(['zeit','rr_sys','rr_dia','hf','o2','spo2','etco2'] as (keyof VRow)[]).map(k => (
                        <td key={k} style={{ border: '0.5px solid var(--border)', padding: 4 }}>
                          <input style={{ ...inp, marginTop: 0, minWidth: 55 }} type={k === 'zeit' ? 'time' : 'number'} value={r[k]} onChange={e => setVerlauf(vv => vv.map((row,j) => j===i ? {...row,[k]:e.target.value} : row))} />
                        </td>
                      ))}
                      <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><button type="button" onClick={() => setVerlauf(vv => vv.filter((_,j) => j!==i))} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', borderRadius: 6, cursor: 'pointer', fontWeight: 700, color: 'var(--accent)', padding: '4px 8px' }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setVerlauf(vv => [...vv, emptyV()])} style={{ marginTop: '.5rem', border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.45rem .75rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>+ Zeile</button>
          </Section>

          <Section title="💉 Medikamente">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
                <thead><tr>{['Medikament','Dosis','Einheit','Route','Zeit','Hinweis',''].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
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
            <button type="button" onClick={() => setMeds(ms => [...ms, { name:'',dose:'',unit:'',route:'',time:'',note:'' }])} style={{ marginTop: '.5rem', border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.45rem .75rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>+ Zeile</button>
          </Section>

          <Section title="🤝 Übergabe / Bemerkungen">
            <div style={grid}>
              <label style={lbl}>Übergabe Ziel<input style={inp} name="uebergabe_ziel" type="text" disabled={locked} /></label>
              <label style={lbl}>Übergabe an<input style={inp} name="uebergabe_name" type="text" disabled={locked} /></label>
            </div>
            <label style={{ ...lbl, marginTop: '.75rem' }}>Bemerkungen<textarea style={ta} name="bemerkungen" disabled={locked} /></label>
          </Section>

          <Section title="✍️ Unterschrift & Abschließen">
            {locked && sigUrl ? (
              <img src={sigUrl} alt="Unterschrift" style={{ maxWidth: '100%', border: '0.5px solid var(--border)', borderRadius: 8 }} />
            ) : locked ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>Keine Unterschrift hinterlegt.</div>
            ) : (
              <>
                <div style={{ border: '0.5px dashed var(--border-medium)', borderRadius: 12, padding: '.75rem', background: 'var(--bg-subtle)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Unterschrift (Finger / Maus)</div>
                  <canvas ref={canvasRef} width={800} height={200} style={{ width: '100%', height: 160, border: '0.5px solid var(--border)', borderRadius: 10, touchAction: 'none', cursor: 'crosshair', background: '#fff' }} />
                  <button type="button" onClick={clearSig} style={{ marginTop: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', padding: '.35rem .6rem', borderRadius: 8, cursor: 'pointer', fontSize: '.9rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}>Löschen</button>
                </div>
                <button type="button" disabled={sending} onClick={finish} style={{ marginTop: '1rem', width: '100%', background: sending ? 'var(--bg-hover)' : '#16a34a', color: sending ? 'var(--text-secondary)' : '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '1.05rem', fontFamily: 'inherit' }}>
                  {sending ? 'Wird abgeschlossen…' : '✓ Protokoll abschließen'}
                </button>
                <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '.5rem', textAlign: 'center' }}>Nach dem Abschließen kann das Protokoll nicht mehr bearbeitet werden.</p>
              </>
            )}
          </Section>
        </form>
      </div>

      {!locked && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '0.5px solid var(--border)', padding: '.75rem 1rem', zIndex: 20 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {saved && <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>✓ Automatisch gespeichert</span>}
            <button disabled={sending} onClick={submit} style={{ background: sending ? 'var(--bg-hover)' : 'var(--accent)', border: 'none', color: sending ? 'var(--text-secondary)' : '#fff', padding: '12px 28px', borderRadius: 12, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>
              {sending ? 'Speichert…' : 'Manuell speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
