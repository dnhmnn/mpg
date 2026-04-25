import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, inp, sel, ta, field, lbl } from './pubStyles'

type Med = { name: string; dose: string; unit: string; route: string; time: string; note: string }
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.35rem', border: '0.5px solid var(--border-medium)', borderRadius: 999, padding: '.2rem .5rem', background: 'var(--bg-subtle)', fontSize: '.9rem', cursor: 'pointer', margin: '2px', color: 'var(--text)' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }
const now = () => { const d = new Date(); return d.toISOString().slice(0,16) }

export default function OrgPatienten() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [gcs, setGcs] = useState({ e: 0, v: 0, m: 0 })
  const [sigUrl, setSigUrl] = useState('')
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
    data.medications = meds; data.photos = photos; data.signature = sigUrl
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
    try {
      const rec = await pb.collection('patients').create({ title: `Patientendoku: ${vorname} ${name}`, payload: data, status: 'offen', organization_id: org.id })
      localStorage.removeItem('patientendoku_' + orgCode)
      setSuccess(`PAT-${new Date().getFullYear()}-${rec.id.slice(0, 8)}`)
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  if (success) return (
    <PubWrap>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 480, margin: '2rem auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 56, height: 56, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem' }}>✅</div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>Erfolgreich übermittelt!</h2>
        <p style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>{success}</p>
        <button style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setSuccess(null); setMeds([]); setPhotos([]); setGcs({ e: 0, v: 0, m: 0 }); clearSig() }}>+ Neues Formular</button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`Patientendoku – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)}
      extra={<>
        <button onClick={saveLocal} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit' }}>💾 Speichern</button>
        <button onClick={() => { if (confirm('Formular zurücksetzen?')) { formRef.current?.reset(); setMeds([]); setPhotos([]); setGcs({ e: 0, v: 0, m: 0 }); clearSig() } }} style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit' }}>🗑 Reset</button>
      </>}
    />
    <PubWrap>
      <form ref={formRef}>
        {/* Einsatzdaten */}
        <PubSection title="🚑 Einsatzdaten" open>
          <div style={grid}>
            <label style={lbl}>Einsatz-Nr.<input style={inp} name="einsatz_nr" type="text" /></label>
            <label style={lbl}>Auftrags-Nr.<input style={inp} name="auftrags_nr" type="text" /></label>
            <label style={lbl}>Rufname<input style={inp} name="rufname" type="text" /></label>
            <label style={lbl}>Fahrzeug<input style={inp} name="fahrzeug" type="text" placeholder="z.B. 46/1" /></label>
            <label style={lbl}>Datum/Uhrzeit<input style={inp} name="zeit_einsatz" type="datetime-local" defaultValue={now()} /></label>
            <label style={lbl}>Einsatz-Art<input style={inp} name="einsatz_art" type="text" /></label>
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
          <div style={field}><label style={lbl}>Infos / Ethik / Patientenverfügung<textarea style={ta} name="infos" /></label></div>
        </PubSection>

        {/* Notfallgeschehen */}
        <PubSection title="📋 Notfallgeschehen / Anamnese">
          <textarea style={ta} name="notfallgeschehen" placeholder="Freitext…" />
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
          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
            {[['o2_nasal','Nasensonde'],['o2_maske','Maske'],['o2_reservoir','Reservoir']].map(([n,l]) => (
              <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
            ))}
            <label style={lbl}>Flow (l/min)<input style={{ ...inp, width: 100 }} name="o2_flow" type="number" step="0.5" /></label>
          </div>
        </PubSection>

        {/* Neurologie */}
        <PubSection title="🧠 Neurologie">
          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '.5rem' }}>
            {[['neu_unauff','Unauffällig'],['neu_sprachstoerung','Sprachstörung'],['neu_seitenzeichen','Seitenzeichen'],['neu_bewusstlos','Bewusstlos']].map(([n,l]) => (
              <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
            ))}
          </div>
          <div style={grid}>
            {[['pw_r','Pupille re.'],['pw_l','Pupille li.']].map(([n,l]) => (
              <div key={n}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{l}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {[['eng','eng'],['mittel','mittel'],['weit','weit']].map(([v,lx]) => <label key={v} style={pill}><input type="radio" name={n} value={v} /> {lx}</label>)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
                  <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginRight: 6, alignSelf: 'center' }}>LR:</span>
                  {[['prompt','prompt'],['träge','träge'],['keine','keine']].map(([v,lx]) => <label key={v} style={pill}><input type="radio" name={n === 'pw_r' ? 'lr_r' : 'lr_l'} value={v} /> {lx}</label>)}
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
            {[['haut_unauff','Unauffällig'],['haut_falten','Stehende Falten'],['haut_oedeme','Ödeme'],['haut_kaltschweissig','Kaltschweißig'],['haut_exanthem','Exanthem']].map(([n,l]) => (
              <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
            ))}
          </div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Psyche</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {[['psy_erregt','Erregt'],['psy_aggr','Aggressiv'],['psy_depressiv','Depressiv'],['psy_aengstlich','Ängstlich'],['psy_verwirrt','Verwirrt'],['psy_suizidal','Suizidal']].map(([n,l]) => (
              <label key={n} style={pill}><input type="checkbox" name={n} /> {l}</label>
            ))}
          </div>
        </PubSection>

        {/* Verletzungen */}
        <PubSection title="🩹 Verletzungen">
          <textarea style={ta} name="verletz_text" placeholder="Beschreibung…" />
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
        <PubSection title="⚡ Reanimation">
          <div style={grid}>
            <label style={lbl}>Rea-Beginn<input style={inp} name="rea_beginn" type="datetime-local" /></label>
            <label style={lbl}>Erst-Rhythmus<select style={sel} name="rea_initial"><option value="">—</option>{['Asystolie','PEA','VF','pVT'].map(v=><option key={v}>{v}</option>)}</select></label>
            <label style={lbl}>Schocks<input style={inp} name="rea_shocks" type="number" min={0} /></label>
            <label style={lbl}>ROSC<select style={sel} name="rea_rosc"><option value="">—</option><option>ja</option><option>nein</option></select></label>
          </div>
        </PubSection>

        {/* Übergabe */}
        <PubSection title="🤝 Übergabe / Transport">
          <div style={grid}>
            <label style={lbl}>Übergabe an<input style={inp} name="ue_name" type="text" /></label>
            <label style={lbl}>Zeitpunkt<input style={inp} name="ue_zeit" type="datetime-local" /></label>
            <label style={lbl}>Ziel<input style={inp} name="ziel_bez" type="text" /></label>
            <label style={lbl}>Einsatzende<input style={inp} name="einsatzende" type="datetime-local" /></label>
          </div>
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
