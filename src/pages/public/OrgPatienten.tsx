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
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
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
        <div style={{ width: 56, height: 56, background: success === 'OFFLINE' ? '#fef9c3' : '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem' }}>{success === 'OFFLINE' ? '💾' : '✅'}</div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>{success === 'OFFLINE' ? 'Offline gespeichert' : 'Erfolgreich übermittelt!'}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem', fontSize: '.9rem' }}>{success === 'OFFLINE' ? 'Wird beim nächsten Öffnen dieser Seite automatisch übermittelt.' : success}</p>
        <button style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setSuccess(null); setMeds([]); setVerlauf([emptyV()]); setPhotos([]); setGcs({ e: 0, v: 0, m: 0 }); clearSig() }}>+ Neues Formular</button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`Patientendoku – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)}
      extra={<>
        <button onClick={saveLocal} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit' }}>💾 Speichern</button>
        <button onClick={() => { if (confirm('Formular zurücksetzen?')) { formRef.current?.reset(); setMeds([]); setVerlauf([emptyV()]); setPhotos([]); setGcs({ e: 0, v: 0, m: 0 }); clearSig() } }} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit' }}>🗑 Reset</button>
      </>}
    />
    <PubWrap>
      <OrgPatientenMannschaft orgId={org.id} orgCode={orgCode} onDraftCreated={id => setDraftId(id)} />
      <form ref={formRef}>
        {/* Einsatzdaten */}
        <PubSection title="🚑 Einsatzdaten" open>
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
        <PubSection title="🪪 Pat-Stammdaten">
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
        <PubSection title="📋 Notfallgeschehen / Anamnese">
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

        <PubSection title="🔢 NACA / Bewusstsein / Verdachtsdiagnose" open>
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
        <PubSection title="👁 Glasgow Coma Scale">
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
        <PubSection title="🩺 Messwerte / Atmung">
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
        <PubSection title="🧠 Neurologie">
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
        <PubSection title="💓 Rhythmus / EKG">
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
        <PubSection title="🖐 Haut / Psyche">
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
        <PubSection title="🏥 Erstdiagnose / Diagnose-Kategorien">
          <div style={field}><label style={pill}><input type="checkbox" name="e_keine" /> Keine Erkrankung / Verletzung</label></div>
          {([
            ['ZNS', [['e_zns_schlaganfall','Schlaganfall'],['e_zns_tia','TIA'],['e_zns_blutung','Intrakr. Blutung'],['e_zns_lyse','Lyse'],['e_zns_krampf','Krampfanfall'],['e_zns_status_epilept','Status epilept.'],['e_zns_meningitis','Meningitis'],['e_zns_synkope','Synkope'],['e_zns_sonstige','Sonstige']]],
            ['Herz-Kreislauf', [['e_hk_acs','ACS'],['e_hk_stemi_vw','STEMI VW'],['e_hk_stemi_hw','STEMI HW'],['e_hk_tachy','Tachy'],['e_hk_brady','Brady'],['e_hk_embolie','Lungenembolie'],['e_hk_ortho','Orthostatisch'],['e_hk_insuff','Herzinsuff./Lungenödem'],['e_hk_hypert','Hypert. Notfall'],['e_hk_kard_schock','Kard. Schock'],['e_hk_schrittmacher','SM/ICD-Fehlfunktion'],['e_hk_sonstige','Sonstige']]],
            ['Atmung', [['e_atm_asthma','Asthma'],['e_atm_status_asthm','Status asthm.'],['e_atm_copd','COPD'],['e_atm_pneumonie','Pneumonie'],['e_atm_hypervent','Hyperventilation'],['e_atm_aspiration','Aspiration'],['e_atm_haemoptysen','Hämoptysen'],['e_atm_sonstige','Sonstige']]],
            ['Abdomen', [['e_abd_akut','Akutes Abdomen'],['e_abd_gi_ob','GI-Blutung ob.'],['e_abd_gi_un','GI-Blutung un.'],['e_abd_kolik','Kolik'],['e_abd_enteritis','Enteritis'],['e_abd_sonstige','Sonstige']]],
            ['Psychiatrie', [['e_psy_psychose','Psychose/Manie'],['e_psy_angst','Angst/Depression'],['e_psy_intox_akzid','Intox. akzid.'],['e_psy_intox_alkohol','Intox. Alkohol'],['e_psy_intox_drogen','Intox. Drogen'],['e_psy_intox_medis','Intox. Medis'],['e_psy_entzug','Entzug/Delir'],['e_psy_suizid','Suizid(versuch)'],['e_psy_krise','Psych. Krise'],['e_psy_sonstige','Sonstige']]],
            ['Stoffwechsel', [['e_stw_hypo','Hypoglykämie'],['e_stw_hyper','Hyperglykämie'],['e_stw_exsiccose','Exsiccose'],['e_stw_uraemie','Urämie/ANV'],['e_stw_sonstige','Sonstige']]],
            ['Pädiatrie', [['e_paed_fieberkrampf','Fieberkrampf'],['e_paed_pseudokrupp','Pseudokrupp'],['e_paed_sids','SIDS/Near-SIDS']]],
            ['Gynäkologie', [['e_gyn_schwanger','Schwangerschaft'],['e_gyn_geburt','Droh./präklin. Geburt'],['e_gyn_eklampsie','(Prä-)Eklampsie'],['e_gyn_blutung','Vag. Blutung'],['e_gyn_sonstige','Sonstige']]],
            ['Weitere', [['e_anaphylaxie','Anaphylaxie'],['e_hitze','Hitzeerschöpfung'],['e_unterkuehlung','Unterkühlung'],['e_sepsis','Sepsis/sept. Schock'],['e_influenza','Influenza'],['e_lumbago','Akutes Lumbago'],['e_epistaxis','Epistaxis'],['e_soziales','Soziales Problem'],['e_weitere_sonstige','Sonstige']]],
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
        <PubSection title="📈 Verlauf">
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
        <PubSection title="🩹 Verletzungen / Trauma">
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
        <PubSection title="🫁 Atemwege / Lagerung / Immobilisation">
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
        <PubSection title="⚡ Beatmung / Defibrillation">
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
        <PubSection title="💉 Zugang / Infusion / Medikamente">
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
        <PubSection title="❤️ Reanimation">
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
        <PubSection title="🤝 Übergabe / Besonderheiten">
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
        <PubSection title="✍️ Unterschrift" open>
          <div style={grid}>
            <label style={lbl}>Name Ausfüller<input style={inp} name="ausfueller_name" type="text" /></label>
            <label style={lbl}>Datum/Uhrzeit<input style={inp} name="ausfueller_zeit" type="datetime-local" defaultValue={now()} /></label>
          </div>
          <div style={{ marginTop: '.75rem', border: '0.5px dashed var(--border-medium)', borderRadius: 12, padding: '.75rem', background: 'var(--bg-subtle)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Unterschrift (Finger/Maus)</div>
            <canvas ref={canvasRef} width={800} height={200} style={{ width: '100%', height: 160, border: '0.5px solid var(--border)', borderRadius: 10, touchAction: 'none', cursor: 'crosshair', background: '#fff' }} />
            <button type="button" onClick={clearSig} style={{ marginTop: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', padding: '.35rem .6rem', borderRadius: 8, cursor: 'pointer', fontSize: '.9rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}>🗑 Signatur löschen</button>
          </div>
        </PubSection>
      </form>
    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} label="Absenden" />
  </>
}
