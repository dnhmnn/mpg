import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, inp, sel, ta, field, lbl } from './pubStyles'
import OrgPatientenMannschaft from './OrgPatientenMannschaft'

type Med = { name: string; dose: string; unit: string; route: string; time: string; note: string }
type VRow = { zeit: string; rr_sys: string; rr_dia: string; hf: string; o2: string; spo2: string; etco2: string; schmerz: string }
const emptyV = (): VRow => ({ zeit: '', rr_sys: '', rr_dia: '', hf: '', o2: '', spo2: '', etco2: '', schmerz: '' })
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.35rem', border: '0.5px solid var(--border-medium)', borderRadius: 999, padding: '.2rem .5rem', background: 'var(--bg-subtle)', fontSize: '.9rem', cursor: 'pointer', margin: '2px', color: 'var(--text)' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }
const now = () => { const d = new Date(); return d.toISOString().slice(0,16) }
const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {ch}
  </svg>
)

export default function OrgPatienten() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [verlauf, setVerlauf] = useState<VRow[]>([emptyV()])
  const [photos, setPhotos] = useState<string[]>([])
  const [gcs, setGcs] = useState({ e: 0, v: 0, m: 0 })
  const [sigUrl, setSigUrl] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftMannschaft, setDraftMannschaft] = useState<Record<string, { id: string; name: string } | null>>({})
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>()
  const draftIdRef = useRef<string | null>(null)
  const gcsSum = gcs.e + gcs.v + gcs.m

  // Canvas signature
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let drawing = false
    const pos = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) } }
    const down = (e: PointerEvent) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault() }
    const move = (e: PointerEvent) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); e.preventDefault() }
    const up = () => { drawing = false; setSigUrl(canvas.toDataURL()) }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up)
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up) }
  }, [])

  useEffect(() => {
    if (!navigator.onLine) return
    const key = `offline_queue_${orgCode}`
    const queue: any[] = JSON.parse(localStorage.getItem(key) || '[]')
    if (!queue.length) return
    Promise.all(queue.map((item: any) => {
      const { type, ...data } = item
      return pb.collection('patients').create(data)
    })).then(() => localStorage.removeItem(key)).catch(() => {})
  }, [orgCode])

  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const id = draftIdRef.current; if (!id || !navigator.onLine) return
      try { await pb.collection('patients').update(id, { payload: collectData() }) } catch {}
    }, 1500)
  }

  function clearSig() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setSigUrl('')
  }

  function collectData() {
    const data: Record<string, unknown> = {}
    formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach(el => {
      if (!el.name) return
      if ((el as HTMLInputElement).type === 'checkbox') data[el.name] = (el as HTMLInputElement).checked
      else if ((el as HTMLInputElement).type === 'radio') { if ((el as HTMLInputElement).checked) data[el.name] = el.value }
      else data[el.name] = el.value
    })
    data.medications = meds
    data.verlauf = verlauf.filter(r => r.zeit || r.rr_sys || r.hf)
    data.photos = photos
    data.signature = sigUrl
    data.mannschaft = draftMannschaft
    return data
  }

  function saveLocal() {
    localStorage.setItem('patientendoku_' + orgCode, JSON.stringify(collectData()))
    alert('Entwurf gespeichert!')
  }

  async function submit() {
    const data = collectData()
    const name = data.name as string; const vorname = data.vorname as string; const geb = data.gebdatum as string
    if (!name || !vorname || !geb) { alert('Bitte Name, Vorname und Geburtsdatum ausfüllen.'); return }
    setSending(true)
    if (!navigator.onLine) {
      const key = `offline_queue_${orgCode}`
      const queue = JSON.parse(localStorage.getItem(key) || '[]')
      queue.push({ type: 'full', title: `Patientendoku: ${vorname} ${name}`, payload: data, status: 'offen', organization_id: org.id, draftId })
      localStorage.setItem(key, JSON.stringify(queue))
      setSending(false)
      setSuccess('OFFLINE')
      return
    }
    try {
      let rec: any
      if (draftId) {
        rec = await pb.collection('patients').update(draftId, { title: `Patientendoku: ${vorname} ${name}`, payload: data, status: 'offen' })
      } else {
        rec = await pb.collection('patients').create({ title: `Patientendoku: ${vorname} ${name}`, payload: data, status: 'offen', organization_id: org.id })
      }
      setSuccess(`PAT-${new Date().getFullYear()}-${rec.id.slice(0, 8)}`)
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  if (success) return (
    <PubWrap>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 480, margin: '2rem auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 56, height: 56, background: success === 'OFFLINE' ? '#fef9c3' : '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: success === 'OFFLINE' ? '#854d0e' : '#15803d' }}>{success === 'OFFLINE' ? pik(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>, 28) : pik(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, 28)}</div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>{success === 'OFFLINE' ? 'Offline gespeichert' : 'Erfolgreich übermittelt!'}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem', fontSize: '.9rem' }}>{success === 'OFFLINE' ? 'Wird beim nächsten Öffnen dieser Seite automatisch übermittelt.' : success}</p>
        <button style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setSuccess(null); setMeds([]); setVerlauf([emptyV()]); setPhotos([]); setGcs({ e: 0, v: 0, m: 0 }); clearSig() }}>+ Neues Formular</button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`Patientendoku – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)}
      extra={<>
        <button onClick={saveLocal} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{pik(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>, 15)} Speichern</button>
        <button onClick={() => { if (confirm('Formular zurücksetzen?')) { formRef.current?.reset(); setMeds([]); setVerlauf([emptyV()]); setPhotos([]); setGcs({ e: 0, v: 0, m: 0 }); clearSig() } }} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{pik(<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>, 15)} Reset</button>
      </>}
    />
    <PubWrap>
      <OrgPatientenMannschaft orgId={org.id} orgCode={orgCode} onDraftCreated={(id, mann) => { setDraftId(id); setDraftMannschaft(mann) }} />
      <form ref={formRef} onChange={() => scheduleAutoSave()}>
        {/* Einsatzdaten */}
        <PubSection title="Einsatzdaten" open icon={pik(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>)}>
          <div style={grid}>
            <label style={lbl}>Einsatz-Nr.<input style={inp} name="einsatz_nr" type="text" /></label>
            <label style={lbl}>Auftrags-Nr. (ILS)<input style={inp} name="auftrags_nr" type="text" /></label>
            <label style={lbl}>Rufname<input style={inp} name="rufname" type="text" /></label>
            <label style={lbl}>Fahrzeug / Einheit<input style={inp} name="fahrzeug" type="text" /></label>
            <label style={lbl}>Einsatzart / Stichwort<input style={inp} name="einsatz_art" type="text" /></label>
            <label style={lbl}>Alarmzeit<input style={inp} name="zeit_einsatz" type="datetime-local" defaultValue={now()} /></label>
            <label style={lbl}>Eintreffen<input style={inp} name="zeit_eintreffen" type="datetime-local" /></label>
            <label style={lbl}>Transportbeginn<input style={inp} name="zeit_transport" type="datetime-local" /></label>
            <label style={lbl}>Übergabe<input style={inp} name="zeit_uebergabe" type="datetime-local" /></label>
            <label style={lbl}>Einsatzort / Adresse<input style={inp} name="einsatz_adresse" type="text" /></label>
            <label style={lbl}>Transportziel<input style={inp} name="transport_ziel" type="text" /></label>
          </div>
        </PubSection>

        {/* Stammdaten */}
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

        {/* Notfallgeschehen */}
        <PubSection title="Notfallgeschehen / Anamnese" icon={pik(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>)}>
          <div style={field}><label style={lbl}>Notfallgeschehen<textarea style={ta} name="notfallgeschehen" placeholder="Freitext…" /></label></div>
          <div style={field}><label style={lbl}>Verlaufsbeschreibung<textarea style={ta} name="verlaufsbeschreibung" /></label></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
            <div style={field}><label style={lbl}>Vorerkrankungen<textarea style={ta} name="vorerkrankungen" /></label></div>
            <div style={field}><label style={lbl}>Dauermedikation Patient<textarea style={ta} name="vormedikation_patient" /></label></div>
          </div>
          <div style={field}><label style={lbl}>Allergien / Unverträglichkeiten<input style={inp} name="allergien" type="text" placeholder="Keine bekannt" /></label></div>
          <div style={{ marginTop: '.75rem' }}>
            <label style={{ ...lbl, marginBottom: 6 }}>Fotos</label>
            <input type="file" accept="image/*" capture="environment" multiple onChange={async e => {
              const files = Array.from(e.target.files || [])
              const b64s = await Promise.all(files.map(f => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f) })))
              setPhotos(p => [...p, ...b64s])
            }} />
            {photos.length > 0 && <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.5)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '1px 5px', fontWeight: 700 }}>×</button>
                </div>
              ))}
            </div>}
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

        {/* GCS */}
        <PubSection title="Glasgow Coma Scale" icon={pik(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>)}>
          {([['gcs_e', 'Augenöffnung (E)', [['4','spontan'],['3','auf Geräusch'],['2','auf Druck'],['1','keine']]], ['gcs_v', 'Verbale Antwort (V)', [['5','orientiert'],['4','verwirrt'],['3','Wörter'],['2','Laute'],['1','keine']]], ['gcs_m', 'Motorik (M)', [['6','folgt'],['5','lokalisiert'],['4','beugt norm.'],['3','beugt abnorm.'],['2','streckt'],['1','keine']]]] as [string, string, [string,string][]][]).map(([name, title, opts]) => (
            <div key={name} style={{ marginBottom: '.75rem' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {opts.map(([v, l]) => (
                  <label key={v} style={pill}>
                    <input type="radio" name={name} value={v} onChange={() => setGcs(g => ({ ...g, [name.slice(4)]: Number(v) }))} />
                    {l} ({v})
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontWeight: 700, color: 'var(--text)' }}>GCS Summe: <span style={{ fontSize: '1.2rem' }}>{gcsSum || '—'}</span></div>
        </PubSection>

        {/* Messwerte */}
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

        {/* Neurologie */}
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

        {/* Rhythmus */}
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

        {/* Haut & Psyche */}
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

        {/* Erstdiagnose Kategorien */}
        <PubSection title="Erstdiagnose / Diagnose-Kategorien" icon={pik(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>)}>
          <div style={field}><label style={pill}><input type="checkbox" name="e_keine" /> Keine Erkrankung / Verletzung</label></div>
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
          ] as [string, [string,string][]][]).map(([cat, items]) => (
            <div key={cat} style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.5rem', marginTop: '.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{cat}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {items.map(([n,l]) => <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>)}
              </div>
            </div>
          ))}
        </PubSection>

        {/* Verlauf */}
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
                    <td style={{ border: '0.5px solid var(--border)', padding: 4 }}><button type="button" onClick={() => setVerlauf(vv => vv.filter((_,j) => j !== i))} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', borderRadius: 6, cursor: 'pointer', fontWeight: 700, color: 'var(--accent)', padding: '4px 8px' }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setVerlauf(vv => [...vv, emptyV()])} style={{ marginTop: '.5rem', border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.45rem .75rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>+ Zeile hinzufügen</button>
        </PubSection>

        {/* Verletzungen */}
        <PubSection title="Verletzungen / Trauma" icon={pik(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>)}>
          <div style={{ marginBottom: '.5rem' }}><label style={pill}><input type="checkbox" name="v_keine" /> Keine Verletzung</label></div>
          {([
            ['Körper', [['v_sht','SHT'],['v_gesicht','Gesicht'],['v_hals','Hals'],['v_thorax','Thorax'],['v_abdomen','Abdomen'],['v_ws','Wirbelsäule'],['v_becken','Becken'],['v_obext','Obere Ext.'],['v_untext','Untere Ext.'],['v_weich','Weichteile']]],
            ['Besonderheiten', [['v_verbrennung','Verbrennung'],['v_veraetzung','Verätzung'],['v_verschuettung','Verschüttung'],['v_einklemmung','Einklemmung'],['v_inhalation','Inhalationstrauma'],['v_elektrounfall','Elektrounfall'],['v_ertrinken','Beinahe-Ertrinken'],['v_tauchunfall','Tauchunfall'],['v_haemo_schock','Hämorr. Schock']]],
            ['Mechanismus', [['v_trauma_stumpf','Stumpf'],['v_trauma_penetr','Penetrierend'],['v_sturz_eben','Sturz ebenerdig'],['v_sturz_unter3m','Sturz <3m'],['v_sturz_ueber3m','Sturz >3m']]],
            ['Verkehr', [['v_vt_fussgaenger','Fußgänger'],['v_vt_escooter','E-Scooter'],['v_vt_fahrrad','Fahrrad'],['v_vt_ebike','E-Bike'],['v_vt_motorrad','Motorrad'],['v_vt_pkw','PKW'],['v_vt_lkw','LKW'],['v_vt_bus','Bus']]],
            ['Gewalt', [['v_gew_schlag','Schlag'],['v_gew_schuss','Schuss'],['v_gew_stich','Stich'],['v_gew_verbrechen','Gewaltverbrechen'],['v_gew_sonstige','Sonstige']]],
          ] as [string,[string,string][]][]).map(([cat, items]) => (
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

        {/* Atemwegsmanagement, Lagerung, Immobilisation */}
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

        {/* Beatmung / Defibrillation */}
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

        {/* Zugang & Medikamente */}
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

        {/* Reanimation */}
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

        {/* Übergabe */}
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

        {/* Unterschrift */}
        <PubSection title="Unterschrift" open icon={pik(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>)}>
          <div style={grid}>
            <label style={lbl}>Name Ausfüller<input style={inp} name="ausfueller_name" type="text" /></label>
            <label style={lbl}>Datum/Uhrzeit<input style={inp} name="ausfueller_zeit" type="datetime-local" defaultValue={now()} /></label>
          </div>
          <div style={{ marginTop: '.75rem', border: '0.5px dashed var(--border-medium)', borderRadius: 12, padding: '.75rem', background: 'var(--bg-subtle)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Unterschrift (Finger/Maus)</div>
            <canvas ref={canvasRef} width={800} height={200} style={{ width: '100%', height: 160, border: '0.5px solid var(--border)', borderRadius: 10, touchAction: 'none', cursor: 'crosshair', background: '#fff' }} />
            <button type="button" onClick={clearSig} style={{ marginTop: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', padding: '.35rem .6rem', borderRadius: 8, cursor: 'pointer', fontSize: '.9rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{pik(<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>, 15)} Signatur löschen</button>
          </div>
        </PubSection>
      </form>
    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} label="Absenden" />
  </>
}
