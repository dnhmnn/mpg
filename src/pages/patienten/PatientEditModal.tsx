import type { PatientPayload, Medication, VitalRow } from './types'
import { calcGCS } from './types'

interface Props {
  payload: PatientPayload
  setP: <K extends keyof PatientPayload>(key: K, value: PatientPayload[K]) => void
  onClose: () => void
  onSaveAndSign: () => void
}

const s = {
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 } as React.CSSProperties,
  box: { background: 'var(--bg-card)', borderRadius: '18px 18px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' as const },
  header: { padding: '16px 20px 0', flexShrink: 0 },
  body: { overflowY: 'auto' as const, flex: 1, padding: '0 20px 8px' },
  footer: { padding: '12px 20px calc(16px + env(safe-area-inset-bottom))', display: 'flex', gap: '10px', flexShrink: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)' },
  btnP: { flex: 1, padding: '12px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' } as React.CSSProperties,
  btnS: { flex: 1, padding: '12px', background: 'var(--bg-secondary)', color: 'var(--text)', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' } as React.CSSProperties,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.6, marginBottom: '4px' }}>{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, type = 'text', placeholder = '' }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
  )
}

function Cb({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', marginRight: '12px' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Radio({ name, value, current, onChange, label }: { name: string; value: string; current: string; onChange: (v: string) => void; label: string; key?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer', marginRight: '10px' }}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} />
      {label}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details style={{ marginBottom: '12px' }} open>
      <summary style={{ fontWeight: 700, fontSize: '14px', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--border)', marginBottom: '10px', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
        {title} <span style={{ opacity: 0.4, fontSize: '12px' }}>▼</span>
      </summary>
      {children}
    </details>
  )
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>{children}</div>
}

function CbRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 0', marginBottom: '8px' }}>{children}</div>
}

export default function PatientEditModal({ payload, setP, onClose, onSaveAndSign }: Props) {
  const p = payload

  const EMPTY_VROW: VitalRow = { zeit:'', rr_sys:'', rr_dia:'', hf:'', spo2:'', af:'', temp:'', bz:'', etco2:'', schmerz:'', o2:'', bemerkung:'' }
  function addVRow() { setP('verlauf', [...(p.verlauf||[]), {...EMPTY_VROW}]) }
  function updateVRow(i: number, key: keyof VitalRow, value: string) {
    const rows = [...(p.verlauf||[])]
    rows[i] = { ...rows[i], [key]: value }
    setP('verlauf', rows)
  }
  function removeVRow(i: number) { setP('verlauf', (p.verlauf||[]).filter((_,j)=>j!==i)) }

  function addMed() {
    setP('medications', [...(p.medications || []), { name: '', dose: '', unit: '', route: '', time: '', note: '' }])
  }
  function updateMed(i: number, key: keyof Medication, value: string) {
    const meds = [...(p.medications || [])]
    meds[i] = { ...meds[i], [key]: value }
    setP('medications', meds)
  }
  function removeMed(i: number) {
    setP('medications', (p.medications || []).filter((_, j) => j !== i))
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={{ margin: '0 0 12px', fontSize: '17px' }}>Patientendokumentation</h3>
        </div>
        <div style={s.body}>

          <Section title="Einsatzdaten">
            <Row2>
              <Field label="Einsatz-Nr."><Inp value={p.einsatz_nr||''} onChange={v => setP('einsatz_nr', v)} /></Field>
              <Field label="Auftrags-Nr."><Inp value={p.auftrags_nr||''} onChange={v => setP('auftrags_nr', v)} /></Field>
              <Field label="Rufname"><Inp value={p.rufname||''} onChange={v => setP('rufname', v)} /></Field>
              <Field label="Fahrzeug / Einheit"><Inp value={p.fahrzeug||''} onChange={v => setP('fahrzeug', v)} /></Field>
              <Field label="Einsatzart / Stichwort"><Inp value={p.einsatz_art||''} onChange={v => setP('einsatz_art', v)} /></Field>
            </Row2>
            <Field label="Einsatzort / Adresse"><Inp value={p.einsatz_adresse||''} onChange={v => setP('einsatz_adresse', v)} placeholder="Straße, PLZ Ort" /></Field>
            <Row2>
              <Field label="Alarmzeit"><Inp value={p.zeit_einsatz||''} onChange={v => setP('zeit_einsatz', v)} type="time" /></Field>
              <Field label="Eintreffzeit"><Inp value={p.zeit_eintreffen||''} onChange={v => setP('zeit_eintreffen', v)} type="time" /></Field>
              <Field label="Transportbeginn"><Inp value={p.zeit_transport||''} onChange={v => setP('zeit_transport', v)} type="time" /></Field>
              <Field label="Übergabe"><Inp value={p.zeit_uebergabe||''} onChange={v => setP('zeit_uebergabe', v)} type="time" /></Field>
            </Row2>
            <Field label="Transportziel (Krankenhaus)"><Inp value={p.transport_ziel||''} onChange={v => setP('transport_ziel', v)} placeholder="Klinikum..." /></Field>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', marginTop: '4px' }}>Mannschaft</div>
            <Row2>
              <Field label="Teamführer"><Inp value={p.mannschaft_tf||''} onChange={v => setP('mannschaft_tf', v)} /></Field>
              <Field label="Mannschaft 1"><Inp value={p.mannschaft_1||''} onChange={v => setP('mannschaft_1', v)} /></Field>
              <Field label="Mannschaft 2"><Inp value={p.mannschaft_2||''} onChange={v => setP('mannschaft_2', v)} /></Field>
              <Field label="Mannschaft 3"><Inp value={p.mannschaft_3||''} onChange={v => setP('mannschaft_3', v)} /></Field>
            </Row2>
          </Section>

          <Section title="Patientenstammdaten">
            <Row2>
              <Field label="Nachname"><Inp value={p.name||''} onChange={v => setP('name', v)} /></Field>
              <Field label="Vorname"><Inp value={p.vorname||''} onChange={v => setP('vorname', v)} /></Field>
              <Field label="Geburtsdatum"><Inp value={p.gebdatum||''} onChange={v => setP('gebdatum', v)} type="date" /></Field>
              <Field label="Alter"><Inp value={p.alter||''} onChange={v => setP('alter', v)} /></Field>
              <Field label="Telefon"><Inp value={p.telefon||''} onChange={v => setP('telefon', v)} /></Field>
              <Field label="Mobil"><Inp value={p.mobil||''} onChange={v => setP('mobil', v)} /></Field>
              <Field label="Straße"><Inp value={p.strasse||''} onChange={v => setP('strasse', v)} /></Field>
              <Field label="PLZ / Ort"><Inp value={p.plz_ort||''} onChange={v => setP('plz_ort', v)} /></Field>
              <Field label="Krankenkasse"><Inp value={p.kasse||''} onChange={v => setP('kasse', v)} /></Field>
              <Field label="Vers.-Nr."><Inp value={p.versnr||''} onChange={v => setP('versnr', v)} /></Field>
            </Row2>
            <Field label="Hausarzt"><Inp value={p.hausarzt||''} onChange={v => setP('hausarzt', v)} /></Field>
            <Field label="Angehöriger"><Inp value={p.angehoeriger||''} onChange={v => setP('angehoeriger', v)} /></Field>
            <Field label="Infos">
              <textarea value={p.infos||''} onChange={e => setP('infos', e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
          </Section>

          <Section title="Notfallgeschehen / Anamnese">
            <Field label="Notfallgeschehen / Beschwerden">
              <textarea value={p.notfallgeschehen||''} onChange={e => setP('notfallgeschehen', e.target.value)} rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
            <Field label="Vorerkrankungen">
              <textarea value={p.vorerkrankungen||''} onChange={e => setP('vorerkrankungen', e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
            <Field label="Allergien"><Inp value={p.allergien||''} onChange={v => setP('allergien', v)} placeholder="Keine bekannt / ..." /></Field>
            <Field label="Verlaufsbeschreibung">
              <textarea value={p.verlaufsbeschreibung||''} onChange={e => setP('verlaufsbeschreibung', e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
            <Field label="Dauermedikation Patient">
              <textarea value={p.vormedikation_patient||''} onChange={e => setP('vormedikation_patient', e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
          </Section>

          <Section title="Verlauf / Vitalzeichen-Kurve">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Zeit','RR sys','RR dia','HF','SpO₂','AF','Temp','BZ','etCO₂','Schmerz','O₂ l/min','Bemerkung',''].map(h => (
                      <th key={h} style={{ padding: '4px 6px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(p.verlauf||[]).map((vr, i) => (
                    <tr key={i}>
                      {(['zeit','rr_sys','rr_dia','hf','spo2','af','temp','bz','etco2','schmerz','o2','bemerkung'] as (keyof VitalRow)[]).map(k => (
                        <td key={k} style={{ padding: '2px', border: '1px solid var(--border)' }}>
                          <input value={vr[k]} onChange={e => updateVRow(i, k, e.target.value)}
                            style={{ width: '100%', padding: '4px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '12px', minWidth: k === 'bemerkung' ? '100px' : '44px' }} />
                        </td>
                      ))}
                      <td style={{ padding: '2px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <button onClick={() => removeVRow(i)} style={{ color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={addVRow} style={{ marginTop: '8px', fontSize: '14px', color: '#c0392b', background: 'none', border: '1px dashed #c0392b', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', width: '100%' }}>+ Zeile hinzufügen</button>
          </Section>

          <Section title="Vitalparameter">
            <Row2>
              <Field label="RR syst. (mmHg)"><Inp value={p.rr_sys||''} onChange={v => setP('rr_sys', v)} /></Field>
              <Field label="RR diast. (mmHg)"><Inp value={p.rr_dia||''} onChange={v => setP('rr_dia', v)} /></Field>
              <Field label="HF (/min)"><Inp value={p.hf||''} onChange={v => setP('hf', v)} /></Field>
              <Field label="SpO2 (%)"><Inp value={p.spo2||''} onChange={v => setP('spo2', v)} /></Field>
              <Field label="AF (/min)"><Inp value={p.af||''} onChange={v => setP('af', v)} /></Field>
              <Field label="Temp (°C)"><Inp value={p.temp||''} onChange={v => setP('temp', v)} /></Field>
              <Field label="BZ (mg/dl)"><Inp value={p.bz_mg||''} onChange={v => setP('bz_mg', v)} /></Field>
              <Field label="Schmerz (NRS 0–10)"><Inp value={p.schmerz||''} onChange={v => setP('schmerz', v)} /></Field>
              <Field label="etCO2"><Inp value={p.etco2||''} onChange={v => setP('etco2', v)} /></Field>
            </Row2>
          </Section>

          <Section title="NACA / Bewusstsein">
            <Row2>
              <Field label="NACA-Score">
                <select value={p.naca||''} onChange={e => setP('naca', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">–</option>
                  <option value="0">0 – Keine Erkrankung/Verletzung</option>
                  <option value="I">I – Geringfügig</option>
                  <option value="II">II – Leicht</option>
                  <option value="III">III – Mäßig schwer</option>
                  <option value="IV">IV – Schwer, keine Lebensgefahr</option>
                  <option value="V">V – Akute Lebensgefahr</option>
                  <option value="VI">VI – Reanimation</option>
                  <option value="VII">VII – Tod</option>
                </select>
              </Field>
              <Field label="Bewusstsein">
                <select value={p.bewusstsein||''} onChange={e => setP('bewusstsein', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">–</option>
                  <option>nicht beurteilbar</option>
                  <option>wach</option>
                  <option>getrübt</option>
                  <option>bewusstlos</option>
                  <option>reaktionslos</option>
                  <option>auf Ansprache</option>
                  <option>Reaktion auf Schmerz</option>
                  <option>analgosediert / Narkose</option>
                </select>
              </Field>
            </Row2>
            <Field label="Verdachtsdiagnose / Erstdiagnose">
              <Inp value={p.erstdiagnose_text||''} onChange={v => setP('erstdiagnose_text', v)} placeholder="Freitexteingabe…" />
            </Field>
          </Section>

          <Section title="Neurologie">
            <Row2>
              <Field label="Zeit"><Inp value={p.neu_zeit||''} onChange={v => setP('neu_zeit', v)} type="time" /></Field>
              <Field label=""><div style={{ paddingTop: '20px' }}><Cb label="Unauffällig" checked={!!p.neu_unauff} onChange={v => setP('neu_unauff', v)} /></div></Field>
            </Row2>
            <Row2>
              <Field label="Pupillenweite re.">
                <div style={{ display: 'flex' }}>
                  {['eng','mittel','weit'].map(v => <Radio key={v} name="pw_r" value={v} current={p.pw_r||'mittel'} onChange={v2 => setP('pw_r', v2)} label={v} />)}
                </div>
              </Field>
              <Field label="Pupillenweite li.">
                <div style={{ display: 'flex' }}>
                  {['eng','mittel','weit'].map(v => <Radio key={v} name="pw_l" value={v} current={p.pw_l||'mittel'} onChange={v2 => setP('pw_l', v2)} label={v} />)}
                </div>
              </Field>
            </Row2>
            <CbRow>
              <Cb label="Entrundet re." checked={!!p.pw_r_entrundet} onChange={v => setP('pw_r_entrundet', v)} />
              <Cb label="Entrundet li." checked={!!p.pw_l_entrundet} onChange={v => setP('pw_l_entrundet', v)} />
            </CbRow>
            <Row2>
              <Field label="Lichtreaktion re.">
                <div style={{ display: 'flex' }}>
                  {['prompt','träge','keine'].map(v => <Radio key={v} name="lr_r" value={v} current={p.lr_r||'prompt'} onChange={v2 => setP('lr_r', v2)} label={v} />)}
                </div>
              </Field>
              <Field label="Lichtreaktion li.">
                <div style={{ display: 'flex' }}>
                  {['prompt','träge','keine'].map(v => <Radio key={v} name="lr_l" value={v} current={p.lr_l||'prompt'} onChange={v2 => setP('lr_l', v2)} label={v} />)}
                </div>
              </Field>
            </Row2>
            <CbRow>
              <Cb label="Sprachstörung" checked={!!p.neu_sprachstoerung} onChange={v => setP('neu_sprachstoerung', v)} />
              <Cb label="Demenz" checked={!!p.neu_demenz} onChange={v => setP('neu_demenz', v)} />
              <Cb label="Meningismus" checked={!!p.neu_meningismus} onChange={v => setP('neu_meningismus', v)} />
              <Cb label="Seitenzeichen" checked={!!p.neu_seitenzeichen} onChange={v => setP('neu_seitenzeichen', v)} />
              <Cb label="Kein Lächeln" checked={!!p.neu_kein_laecheln} onChange={v => setP('neu_kein_laecheln', v)} />
              <Cb label="Sehstörung" checked={!!p.neu_sehstoerung} onChange={v => setP('neu_sehstoerung', v)} />
              <Cb label="Querschnittssymptomatik" checked={!!p.neu_querschnitt} onChange={v => setP('neu_querschnitt', v)} />
              <Cb label="Babinski" checked={!!p.neu_babinski} onChange={v => setP('neu_babinski', v)} />
              <Cb label="Vorbestehende Defizite" checked={!!p.neu_vorbestehend} onChange={v => setP('neu_vorbestehend', v)} />
            </CbRow>
            <Field label="Neurologische Sonstige"><Inp value={p.neu_sonstige||''} onChange={v => setP('neu_sonstige', v)} /></Field>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Extremitätenbewegung</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: '10px', fontSize: '13px' }}>
              <div></div>
              <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>Rechts</div>
              <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>Links</div>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>Arm</div>
              {(['ext_r_arm','ext_l_arm'] as const).map(k => (
                <select key={k} value={p[k]||''} onChange={e => setP(k, e.target.value)}
                  style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">–</option>
                  <option value="1">1 – Normal</option>
                  <option value="2">2 – Leicht vermindert</option>
                  <option value="3">3 – Stark vermindert</option>
                  <option value="4">4 – Fehlend</option>
                </select>
              ))}
              <div style={{ fontWeight: 600, fontSize: '12px' }}>Bein</div>
              {(['ext_r_bein','ext_l_bein'] as const).map(k => (
                <select key={k} value={p[k]||''} onChange={e => setP(k, e.target.value)}
                  style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">–</option>
                  <option value="1">1 – Normal</option>
                  <option value="2">2 – Leicht vermindert</option>
                  <option value="3">3 – Stark vermindert</option>
                  <option value="4">4 – Fehlend</option>
                </select>
              ))}
            </div>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Glasgow Coma Scale (GCS: {calcGCS(p)})</div>
            <Row2>
              <Field label="Augen (E 1–4)">
                <select value={p.gcs_e||4} onChange={e => setP('gcs_e', +e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value={1}>1 – Keine</option><option value={2}>2 – Auf Schmerz</option>
                  <option value={3}>3 – Auf Aufforderung</option><option value={4}>4 – Spontan</option>
                </select>
              </Field>
              <Field label="Verbal (V 1–5)">
                <select value={p.gcs_v||5} onChange={e => setP('gcs_v', +e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value={1}>1 – Keine</option><option value={2}>2 – Unverständlich</option>
                  <option value={3}>3 – Einzelne Wörter</option><option value={4}>4 – Verwirrt</option>
                  <option value={5}>5 – Orientiert</option>
                </select>
              </Field>
              <Field label="Motorik (M 1–6)">
                <select value={p.gcs_m||6} onChange={e => setP('gcs_m', +e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value={1}>1 – Keine</option><option value={2}>2 – Strecksynergismen</option>
                  <option value={3}>3 – Beugesynergismen</option><option value={4}>4 – Auf Schmerz</option>
                  <option value={5}>5 – Gezielte Abwehr</option><option value={6}>6 – Auf Aufforderung</option>
                </select>
              </Field>
            </Row2>
          </Section>

          <Section title="Haut">
            <CbRow>
              <Cb label="Unauffällig" checked={!!p.haut_unauff} onChange={v => setP('haut_unauff', v)} />
              <Cb label="Hautfalten" checked={!!p.haut_falten} onChange={v => setP('haut_falten', v)} />
              <Cb label="Ödeme" checked={!!p.haut_oedeme} onChange={v => setP('haut_oedeme', v)} />
              <Cb label="Dekubitus" checked={!!p.haut_dekubitus} onChange={v => setP('haut_dekubitus', v)} />
              <Cb label="Kaltschweißig" checked={!!p.haut_kaltschweissig} onChange={v => setP('haut_kaltschweissig', v)} />
              <Cb label="Exanthem" checked={!!p.haut_exanthem} onChange={v => setP('haut_exanthem', v)} />
            </CbRow>
          </Section>

          <Section title="Psyche">
            <CbRow>
              <Cb label="Erregt" checked={!!p.psy_erregt} onChange={v => setP('psy_erregt', v)} />
              <Cb label="Aggressiv" checked={!!p.psy_aggr} onChange={v => setP('psy_aggr', v)} />
              <Cb label="Verlangsamt" checked={!!p.psy_verlangsamt} onChange={v => setP('psy_verlangsamt', v)} />
              <Cb label="Depressiv" checked={!!p.psy_depressiv} onChange={v => setP('psy_depressiv', v)} />
              <Cb label="Ängstlich" checked={!!p.psy_aengstlich} onChange={v => setP('psy_aengstlich', v)} />
              <Cb label="Euphorisch" checked={!!p.psy_euphorisch} onChange={v => setP('psy_euphorisch', v)} />
              <Cb label="Wahnhaft" checked={!!p.psy_wahnhaft} onChange={v => setP('psy_wahnhaft', v)} />
              <Cb label="Verwirrt" checked={!!p.psy_verwirrt} onChange={v => setP('psy_verwirrt', v)} />
              <Cb label="Suizidal" checked={!!p.psy_suizidal} onChange={v => setP('psy_suizidal', v)} />
              <Cb label="Motor. unruhig" checked={!!p.psy_motor_unruhig} onChange={v => setP('psy_motor_unruhig', v)} />
            </CbRow>
          </Section>

          <Section title="Atmung">
            <CbRow>
              <Cb label="Apnoe" checked={!!p.atm_apnoe} onChange={v => setP('atm_apnoe', v)} />
              <Cb label="Stridor" checked={!!p.atm_stridor} onChange={v => setP('atm_stridor', v)} />
              <Cb label="Dyspnoe" checked={!!p.atm_dyspnoe} onChange={v => setP('atm_dyspnoe', v)} />
              <Cb label="Zyanose" checked={!!p.atm_zyanose} onChange={v => setP('atm_zyanose', v)} />
            </CbRow>
            <CbRow>
              <Cb label="O₂" checked={!!p.o2} onChange={v => setP('o2', v)} />
              <Cb label="Nasal" checked={!!p.o2_nasal} onChange={v => setP('o2_nasal', v)} />
              <Cb label="Maske" checked={!!p.o2_maske} onChange={v => setP('o2_maske', v)} />
              <Cb label="Reservoir" checked={!!p.o2_reservoir} onChange={v => setP('o2_reservoir', v)} />
            </CbRow>
            <Field label="O₂-Flow (l/min)"><Inp value={p.o2_flow||''} onChange={v => setP('o2_flow', v)} /></Field>
          </Section>

          <Section title="Atemwegsmanagement">
            <CbRow>
              <Cb label="Freihalten" checked={!!p.awm_freihalten} onChange={v => setP('awm_freihalten', v)} />
              <Cb label="Absaugung" checked={!!p.awm_absaugung} onChange={v => setP('awm_absaugung', v)} />
              <Cb label="OPA (Guedel)" checked={!!p.awm_opa} onChange={v => setP('awm_opa', v)} />
              <Cb label="NPA (Wendl)" checked={!!p.awm_npa} onChange={v => setP('awm_npa', v)} />
              <Cb label="LMA / SGA" checked={!!p.awm_lma} onChange={v => setP('awm_lma', v)} />
              <Cb label="Intubation (OTI)" checked={!!p.awm_intubation} onChange={v => setP('awm_intubation', v)} />
            </CbRow>
          </Section>

          <Section title="Lagerung">
            <CbRow>
              <Cb label="Flachlagerung" checked={!!p.lag_flach} onChange={v => setP('lag_flach', v)} />
              <Cb label="Schocklagerung" checked={!!p.lag_schock} onChange={v => setP('lag_schock', v)} />
              <Cb label="Oberkörper hoch" checked={!!p.lag_ok_hoch} onChange={v => setP('lag_ok_hoch', v)} />
              <Cb label="Stabile Seitenlage" checked={!!p.lag_ssl} onChange={v => setP('lag_ssl', v)} />
              <Cb label="Sitzend" checked={!!p.lag_sitzend} onChange={v => setP('lag_sitzend', v)} />
              <Cb label="Hängeposition" checked={!!p.lag_haengend} onChange={v => setP('lag_haengend', v)} />
            </CbRow>
          </Section>

          <Section title="Reanimation">
            <CbRow>
              <Cb label="Reanimation durchgeführt" checked={!!p.rean} onChange={v => setP('rean', v)} />
              <Cb label="Todesfeststellung" checked={!!p.rean_tod} onChange={v => setP('rean_tod', v)} />
            </CbRow>
            {p.rean_tod && (
              <Field label="Uhrzeit Todesfeststellung"><Inp value={p.rean_tod_zeit||''} onChange={v => setP('rean_tod_zeit', v)} type="time" /></Field>
            )}
            {p.rean && (
              <Row2>
                <Field label="Beginn"><Inp value={p.rean_beginn||''} onChange={v => setP('rean_beginn', v)} type="time" /></Field>
                <Field label="Ende"><Inp value={p.rean_ende||''} onChange={v => setP('rean_ende', v)} type="time" /></Field>
                <Field label="Defibrillationen (Anzahl)"><Inp value={p.rean_defib||''} onChange={v => setP('rean_defib', v)} /></Field>
              </Row2>
            )}
          </Section>

          <Section title="Immobilisation">
            <CbRow>
              <Cb label="HWS-Orthese" checked={!!p.immo_hws} onChange={v => setP('immo_hws', v)} />
              <Cb label="Spineboard" checked={!!p.immo_spineboard} onChange={v => setP('immo_spineboard', v)} />
              <Cb label="Vakuummatratze" checked={!!p.immo_vakuum} onChange={v => setP('immo_vakuum', v)} />
            </CbRow>
          </Section>

          <Section title="Rhythmus / EKG">
            <CbRow>
              <Cb label="Sinusrhythmus" checked={!!p.sr} onChange={v => setP('sr', v)} />
              <Cb label="STEMI" checked={!!p.stemi} onChange={v => setP('stemi', v)} />
              <Cb label="Kammerflimmern" checked={!!p.vf} onChange={v => setP('vf', v)} />
              <Cb label="Asystolie" checked={!!p.asystole} onChange={v => setP('asystole', v)} />
            </CbRow>
            <Row2>
              <Field label="EKG-Standort"><Inp value={p.ekg_standort||''} onChange={v => setP('ekg_standort', v)} /></Field>
              <Field label="EKG Pers.-Nr."><Inp value={p.ekg_persnr||''} onChange={v => setP('ekg_persnr', v)} /></Field>
            </Row2>
          </Section>

          <Section title="Diagnosen / Erkrankungen">
            <Field label="Erstdiagnose / Verdachtsdiagnose (Freitext)">
              <Inp value={p.erstdiagnose_text||''} onChange={v => setP('erstdiagnose_text', v)} placeholder="Freitexteingabe…" />
            </Field>
            <CbRow><Cb label="Keine Erkrankung / Verletzung" checked={!!p.e_keine} onChange={v => setP('e_keine', v)} /></CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>ZNS</div>
            <CbRow>
              <Cb label="Schlaganfall" checked={!!p.e_zns_schlaganfall} onChange={v => setP('e_zns_schlaganfall', v)} />
              <Cb label="TIA" checked={!!p.e_zns_tia} onChange={v => setP('e_zns_tia', v)} />
              <Cb label="Intrakranielle Blutung" checked={!!p.e_zns_blutung} onChange={v => setP('e_zns_blutung', v)} />
              <Cb label="Im Lysefenster" checked={!!p.e_zns_lyse} onChange={v => setP('e_zns_lyse', v)} />
              <Cb label="Krampfanfall" checked={!!p.e_zns_krampf} onChange={v => setP('e_zns_krampf', v)} />
              <Cb label="Status epilepticus" checked={!!p.e_zns_status_epilept} onChange={v => setP('e_zns_status_epilept', v)} />
              <Cb label="Meningitis" checked={!!p.e_zns_meningitis} onChange={v => setP('e_zns_meningitis', v)} />
              <Cb label="Synkope" checked={!!p.e_zns_synkope} onChange={v => setP('e_zns_synkope', v)} />
              <Cb label="ZNS Sonstige" checked={!!p.e_zns_sonstige} onChange={v => setP('e_zns_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Herz-Kreislauf</div>
            <CbRow>
              <Cb label="Akutes Koronarsyndrom" checked={!!p.e_hk_acs} onChange={v => setP('e_hk_acs', v)} />
              <Cb label="STEMI Vorderwand" checked={!!p.e_hk_stemi_vw} onChange={v => setP('e_hk_stemi_vw', v)} />
              <Cb label="STEMI Hinterwand" checked={!!p.e_hk_stemi_hw} onChange={v => setP('e_hk_stemi_hw', v)} />
              <Cb label="Rhythmusstörung Tachy" checked={!!p.e_hk_tachy} onChange={v => setP('e_hk_tachy', v)} />
              <Cb label="Rhythmusstörung Brady" checked={!!p.e_hk_brady} onChange={v => setP('e_hk_brady', v)} />
              <Cb label="Lungenembolie" checked={!!p.e_hk_embolie} onChange={v => setP('e_hk_embolie', v)} />
              <Cb label="Orthostatische Fehlregulation" checked={!!p.e_hk_ortho} onChange={v => setP('e_hk_ortho', v)} />
              <Cb label="Herzinsuffizienz / Lungenödem" checked={!!p.e_hk_insuff} onChange={v => setP('e_hk_insuff', v)} />
              <Cb label="Hypertensiver Notfall" checked={!!p.e_hk_hypert} onChange={v => setP('e_hk_hypert', v)} />
              <Cb label="Kardiogener Schock" checked={!!p.e_hk_kard_schock} onChange={v => setP('e_hk_kard_schock', v)} />
              <Cb label="Schrittmacher-/ICD-Fehlfunktion" checked={!!p.e_hk_schrittmacher} onChange={v => setP('e_hk_schrittmacher', v)} />
              <Cb label="HK Sonstige" checked={!!p.e_hk_sonstige} onChange={v => setP('e_hk_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Atmung</div>
            <CbRow>
              <Cb label="Asthma (Anfall)" checked={!!p.e_atm_asthma} onChange={v => setP('e_atm_asthma', v)} />
              <Cb label="Status asthmaticus" checked={!!p.e_atm_status_asthm} onChange={v => setP('e_atm_status_asthm', v)} />
              <Cb label="COPD" checked={!!p.e_atm_copd} onChange={v => setP('e_atm_copd', v)} />
              <Cb label="Pneumonie / Bronchitis" checked={!!p.e_atm_pneumonie} onChange={v => setP('e_atm_pneumonie', v)} />
              <Cb label="Hyperventilationssyndrom" checked={!!p.e_atm_hypervent} onChange={v => setP('e_atm_hypervent', v)} />
              <Cb label="Aspiration" checked={!!p.e_atm_aspiration} onChange={v => setP('e_atm_aspiration', v)} />
              <Cb label="Hämoptysen" checked={!!p.e_atm_haemoptysen} onChange={v => setP('e_atm_haemoptysen', v)} />
              <Cb label="Atmung Sonstige" checked={!!p.e_atm_sonstige} onChange={v => setP('e_atm_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Abdomen</div>
            <CbRow>
              <Cb label="Akutes Abdomen" checked={!!p.e_abd_akut} onChange={v => setP('e_abd_akut', v)} />
              <Cb label="GI-Blutung obere" checked={!!p.e_abd_gi_ob} onChange={v => setP('e_abd_gi_ob', v)} />
              <Cb label="GI-Blutung untere" checked={!!p.e_abd_gi_un} onChange={v => setP('e_abd_gi_un', v)} />
              <Cb label="Kolik (Niere/Galle)" checked={!!p.e_abd_kolik} onChange={v => setP('e_abd_kolik', v)} />
              <Cb label="Enteritis" checked={!!p.e_abd_enteritis} onChange={v => setP('e_abd_enteritis', v)} />
              <Cb label="Abdomen Sonstige" checked={!!p.e_abd_sonstige} onChange={v => setP('e_abd_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Psychiatrie</div>
            <CbRow>
              <Cb label="Psychose / Manie / Erregungszustand" checked={!!p.e_psy_psychose} onChange={v => setP('e_psy_psychose', v)} />
              <Cb label="Angst / Depression" checked={!!p.e_psy_angst} onChange={v => setP('e_psy_angst', v)} />
              <Cb label="Intoxikation akzidentell" checked={!!p.e_psy_intox_akzid} onChange={v => setP('e_psy_intox_akzid', v)} />
              <Cb label="Intoxikation Alkohol" checked={!!p.e_psy_intox_alkohol} onChange={v => setP('e_psy_intox_alkohol', v)} />
              <Cb label="Intoxikation Drogen" checked={!!p.e_psy_intox_drogen} onChange={v => setP('e_psy_intox_drogen', v)} />
              <Cb label="Intoxikation Medikamente" checked={!!p.e_psy_intox_medis} onChange={v => setP('e_psy_intox_medis', v)} />
              <Cb label="Intoxikation Sonstige" checked={!!p.e_psy_intox_sonstige} onChange={v => setP('e_psy_intox_sonstige', v)} />
              <Cb label="Entzug / Delir" checked={!!p.e_psy_entzug} onChange={v => setP('e_psy_entzug', v)} />
              <Cb label="Suizid(versuch)" checked={!!p.e_psy_suizid} onChange={v => setP('e_psy_suizid', v)} />
              <Cb label="Psychosoziale Krise" checked={!!p.e_psy_krise} onChange={v => setP('e_psy_krise', v)} />
              <Cb label="Psychiatrie Sonstige" checked={!!p.e_psy_sonstige} onChange={v => setP('e_psy_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Stoffwechsel</div>
            <CbRow>
              <Cb label="Hypoglykämie" checked={!!p.e_stw_hypo} onChange={v => setP('e_stw_hypo', v)} />
              <Cb label="Hyperglykämie" checked={!!p.e_stw_hyper} onChange={v => setP('e_stw_hyper', v)} />
              <Cb label="Exsiccose" checked={!!p.e_stw_exsiccose} onChange={v => setP('e_stw_exsiccose', v)} />
              <Cb label="Urämie / ANV" checked={!!p.e_stw_uraemie} onChange={v => setP('e_stw_uraemie', v)} />
              <Cb label="Stoffwechsel Sonstige" checked={!!p.e_stw_sonstige} onChange={v => setP('e_stw_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Pädiatrie</div>
            <CbRow>
              <Cb label="Fieberkrampf" checked={!!p.e_paed_fieberkrampf} onChange={v => setP('e_paed_fieberkrampf', v)} />
              <Cb label="Pseudokrupp" checked={!!p.e_paed_pseudokrupp} onChange={v => setP('e_paed_pseudokrupp', v)} />
              <Cb label="SIDS / Near-SIDS" checked={!!p.e_paed_sids} onChange={v => setP('e_paed_sids', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Gynäkologie</div>
            <CbRow>
              <Cb label="Schwangerschaft" checked={!!p.e_gyn_schwanger} onChange={v => setP('e_gyn_schwanger', v)} />
              <Cb label="Drohende / präklinische Geburt" checked={!!p.e_gyn_geburt} onChange={v => setP('e_gyn_geburt', v)} />
              <Cb label="(Prä-)Eklampsie" checked={!!p.e_gyn_eklampsie} onChange={v => setP('e_gyn_eklampsie', v)} />
              <Cb label="Vaginale Blutung" checked={!!p.e_gyn_blutung} onChange={v => setP('e_gyn_blutung', v)} />
              <Cb label="Gynäkologie Sonstige" checked={!!p.e_gyn_sonstige} onChange={v => setP('e_gyn_sonstige', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '3px' }}>Weitere</div>
            <CbRow>
              <Cb label="Anaphylaktische Reaktion" checked={!!p.e_anaphylaxie} onChange={v => setP('e_anaphylaxie', v)} />
              <Cb label="Hitzeerschöpfung / Hitzeschlag" checked={!!p.e_hitze} onChange={v => setP('e_hitze', v)} />
              <Cb label="Unterkühlung / Erfrierung" checked={!!p.e_unterkuehlung} onChange={v => setP('e_unterkuehlung', v)} />
              <Cb label="Sepsis / sept. Schock" checked={!!p.e_sepsis} onChange={v => setP('e_sepsis', v)} />
              <Cb label="Influenza" checked={!!p.e_influenza} onChange={v => setP('e_influenza', v)} />
              <Cb label="Hepatitis / HIV" checked={!!p.e_hepatitis_hiv} onChange={v => setP('e_hepatitis_hiv', v)} />
              <Cb label="Akutes Lumbago" checked={!!p.e_lumbago} onChange={v => setP('e_lumbago', v)} />
              <Cb label="Epistaxis" checked={!!p.e_epistaxis} onChange={v => setP('e_epistaxis', v)} />
              <Cb label="Soziales Problem" checked={!!p.e_soziales} onChange={v => setP('e_soziales', v)} />
              <Cb label="Behandlungskomplikation" checked={!!p.e_behandlungskompl} onChange={v => setP('e_behandlungskompl', v)} />
              <Cb label="Weitere Sonstige" checked={!!p.e_weitere_sonstige} onChange={v => setP('e_weitere_sonstige', v)} />
            </CbRow>
          </Section>

          <Section title="Medikamente">
            {(p.medications || []).map((med, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                <Row2>
                  <Field label="Medikament"><Inp value={med.name} onChange={v => updateMed(i, 'name', v)} /></Field>
                  <Field label="Dosis"><Inp value={med.dose} onChange={v => updateMed(i, 'dose', v)} /></Field>
                  <Field label="Einheit"><Inp value={med.unit} onChange={v => updateMed(i, 'unit', v)} placeholder="mg, ml…" /></Field>
                  <Field label="Applikation"><Inp value={med.route} onChange={v => updateMed(i, 'route', v)} placeholder="i.v., s.c.…" /></Field>
                  <Field label="Zeit"><Inp value={med.time} onChange={v => updateMed(i, 'time', v)} type="time" /></Field>
                  <Field label="Hinweis"><Inp value={med.note} onChange={v => updateMed(i, 'note', v)} /></Field>
                </Row2>
                <button onClick={() => removeMed(i)} style={{ fontSize: '12px', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Entfernen</button>
              </div>
            ))}
            <button onClick={addMed} style={{ fontSize: '14px', color: '#c0392b', background: 'none', border: '1px dashed #c0392b', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', width: '100%' }}>+ Medikament hinzufügen</button>
          </Section>

          <Section title="Zugang / Infusion">
            <Row2>
              <Field label="Zugang Art"><Inp value={p.zugang_art||''} onChange={v => setP('zugang_art', v)} placeholder="peripher, zentral…" /></Field>
              <Field label="Gauge"><Inp value={p.zugang_gauge||''} onChange={v => setP('zugang_gauge', v)} /></Field>
              <Field label="Region"><Inp value={p.zugang_region||''} onChange={v => setP('zugang_region', v)} /></Field>
              <Field label="Infusion Art"><Inp value={p.inf_art||''} onChange={v => setP('inf_art', v)} /></Field>
              <Field label="Infusion Menge (ml)"><Inp value={p.inf_menge||''} onChange={v => setP('inf_menge', v)} /></Field>
            </Row2>
          </Section>

          <Section title="Beatmung / Defibrillation">
            <CbRow>
              <Cb label="Manuell" checked={!!p.beat_manuell} onChange={v => setP('beat_manuell', v)} />
              <Cb label="Maschinell" checked={!!p.beat_maschinell} onChange={v => setP('beat_maschinell', v)} />
              <Cb label="NIV" checked={!!p.beat_niv} onChange={v => setP('beat_niv', v)} />
              <Cb label="Notfallnarkose" checked={!!p.beat_notfallnarkose} onChange={v => setP('beat_notfallnarkose', v)} />
            </CbRow>
            <Row2>
              <Field label="FiO2"><Inp value={p.beat_fio2||''} onChange={v => setP('beat_fio2', v)} /></Field>
              <Field label="AF (/min)"><Inp value={p.beat_af||''} onChange={v => setP('beat_af', v)} /></Field>
              <Field label="AMV (l/min)"><Inp value={p.beat_amv||''} onChange={v => setP('beat_amv', v)} /></Field>
              <Field label="PEEP (mbar)"><Inp value={p.beat_peep||''} onChange={v => setP('beat_peep', v)} /></Field>
              <Field label="Pmax (mbar)"><Inp value={p.beat_pmax||''} onChange={v => setP('beat_pmax', v)} /></Field>
            </Row2>
            <div style={{ fontWeight: 600, fontSize: '13px', margin: '8px 0 6px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>Defibrillation</div>
            <CbRow>
              <Cb label="AED" checked={!!p.defi_aed} onChange={v => setP('defi_aed', v)} />
              <Cb label="Defi" checked={!!p.defi_defi} onChange={v => setP('defi_defi', v)} />
              <Cb label="Monophasisch" checked={!!p.defi_mono} onChange={v => setP('defi_mono', v)} />
              <Cb label="Biphasisch" checked={!!p.defi_bi} onChange={v => setP('defi_bi', v)} />
            </CbRow>
            <CbRow>
              <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.6, marginRight: '6px', alignSelf: 'center' }}>Erstanw.:</span>
              <Cb label="Laie" checked={!!p.defi_erstanw_laie} onChange={v => setP('defi_erstanw_laie', v)} />
              <Cb label="First Resp." checked={!!p.defi_erstanw_fr} onChange={v => setP('defi_erstanw_fr', v)} />
              <Cb label="Rettungsdienst" checked={!!p.defi_erstanw_rd} onChange={v => setP('defi_erstanw_rd', v)} />
              <Cb label="Arzt" checked={!!p.defi_erstanw_arzt} onChange={v => setP('defi_erstanw_arzt', v)} />
            </CbRow>
            <Row2>
              <Field label="Zeitpunkt 1. Defi"><Inp value={p.defi_zeitpunkt||''} onChange={v => setP('defi_zeitpunkt', v)} type="time" /></Field>
              <Field label="ROSC"><Inp value={p.defi_rosc||''} onChange={v => setP('defi_rosc', v)} type="time" /></Field>
              <Field label="Anzahl Defi"><Inp value={p.defi_anzahl||''} onChange={v => setP('defi_anzahl', v)} /></Field>
              <Field label="Energie (kJ)"><Inp value={p.defi_energie||''} onChange={v => setP('defi_energie', v)} /></Field>
            </Row2>
          </Section>

          <Section title="Übergabe / Besonderheiten">
            <Field label="Übergabe Ziel">
              <select value={p.uebergabe_ziel||''} onChange={e => setP('uebergabe_ziel', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)' }}>
                <option value="">–</option>
                <option>ZNA/INA</option>
                <option>Schockraum</option>
                <option>Stroke Unit</option>
                <option>Herzkatheterlabor</option>
                <option>CPU</option>
                <option>Intensivstation</option>
                <option>Allgemeinstation</option>
                <option>OP direkt</option>
                <option>Praxis</option>
                <option>Hausarzt/KV-Arzt</option>
                <option>Fachambulanz</option>
                <option>Einsatzstelle</option>
                <option>Sonstige</option>
              </select>
            </Field>
            <Field label="Übergabe an (Name)"><Inp value={p.uebergabe_name||''} onChange={v => setP('uebergabe_name', v)} /></Field>
            <CbRow>
              <Cb label="Transportverweigerung" checked={!!p.ev_transportverweigerung} onChange={v => setP('ev_transportverweigerung', v)} />
              <Cb label="Nur Untersuchung/Behandlung" checked={!!p.ev_nur_untersuchung} onChange={v => setP('ev_nur_untersuchung', v)} />
              <Cb label="Zwangseinweisung" checked={!!p.ev_zwangseinweisung} onChange={v => setP('ev_zwangseinweisung', v)} />
              <Cb label="Transport mit Sondersignal" checked={!!p.ev_transport_sondersignal} onChange={v => setP('ev_transport_sondersignal', v)} />
              <Cb label="MANV" checked={!!p.ev_manv} onChange={v => setP('ev_manv', v)} />
              <Cb label="LNA am Einsatz" checked={!!p.ev_lna} onChange={v => setP('ev_lna', v)} />
              <Cb label="Schwerlasttransport" checked={!!p.ev_schwerlast} onChange={v => setP('ev_schwerlast', v)} />
            </CbRow>
            <Field label="Bemerkungen">
              <textarea value={p.bemerkungen||''} onChange={e => setP('bemerkungen', e.target.value)} rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
          </Section>

          <Section title="Verletzungen / Trauma">
            <CbRow><Cb label="Keine Verletzung" checked={!!p.v_keine} onChange={v => setP('v_keine', v)} /></CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '4px', marginBottom: '4px' }}>Körperregion – Schwere (leicht / mittel / schwer / geschlossen)</div>
            {([
              ['v_sht','Schädel-Hirn'],['v_gesicht','Gesicht'],['v_hals','Hals'],
              ['v_thorax','Thorax'],['v_abdomen','Abdomen'],['v_ws','Wirbelsäule'],
              ['v_becken','Becken'],['v_obext','Obere Extremitäten'],['v_untext','Untere Extremitäten'],['v_weich','Weichteile']
            ] as [keyof typeof p, string][]).map(([k,lbl]) => (
              <div key={String(k)} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px' }}>{lbl}</span>
                <select value={p[k] as string||''} onChange={e => setP(k, e.target.value)}
                  style={{ padding: '5px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">–</option>
                  <option value="leicht">leicht</option>
                  <option value="mittel">mittel</option>
                  <option value="schwer">schwer</option>
                  <option value="geschlossen">geschlossen</option>
                </select>
              </div>
            ))}
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '8px', marginBottom: '4px' }}>Besondere Verletzungsarten</div>
            <CbRow>
              <Cb label="Verbrennung / Verbrühung" checked={!!p.v_verbrennung} onChange={v => setP('v_verbrennung', v)} />
              <Cb label="Verätzung" checked={!!p.v_veraetzung} onChange={v => setP('v_veraetzung', v)} />
              <Cb label="Verschüttung" checked={!!p.v_verschuettung} onChange={v => setP('v_verschuettung', v)} />
              <Cb label="Einklemmung" checked={!!p.v_einklemmung} onChange={v => setP('v_einklemmung', v)} />
              <Cb label="Inhalationstrauma" checked={!!p.v_inhalation} onChange={v => setP('v_inhalation', v)} />
              <Cb label="Elektrounfall" checked={!!p.v_elektrounfall} onChange={v => setP('v_elektrounfall', v)} />
              <Cb label="Beinahe-Ertrinken" checked={!!p.v_ertrinken} onChange={v => setP('v_ertrinken', v)} />
              <Cb label="Tauchunfall" checked={!!p.v_tauchunfall} onChange={v => setP('v_tauchunfall', v)} />
              <Cb label="Hämorrhagischer Schock" checked={!!p.v_haemo_schock} onChange={v => setP('v_haemo_schock', v)} />
            </CbRow>
            {p.v_verbrennung && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Field label="Verbrennungsgrad"><Inp value={p.v_verbrennung_grad||''} onChange={v => setP('v_verbrennung_grad', v)} placeholder="Grad…" /></Field>
                <Field label="Verbrannte Fläche (%)"><Inp value={p.v_verbrennung_pct||''} onChange={v => setP('v_verbrennung_pct', v)} /></Field>
              </div>
            )}
            <Field label="Verletzungen Sonstige"><Inp value={p.v_sonstige||''} onChange={v => setP('v_sonstige', v)} /></Field>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '8px', marginBottom: '4px' }}>Unfallmechanismus</div>
            <CbRow>
              <Cb label="Trauma stumpf" checked={!!p.v_trauma_stumpf} onChange={v => setP('v_trauma_stumpf', v)} />
              <Cb label="Trauma penetrierend" checked={!!p.v_trauma_penetr} onChange={v => setP('v_trauma_penetr', v)} />
              <Cb label="Sturz ebenerdig" checked={!!p.v_sturz_eben} onChange={v => setP('v_sturz_eben', v)} />
              <Cb label="Sturz &lt;3 m" checked={!!p.v_sturz_unter3m} onChange={v => setP('v_sturz_unter3m', v)} />
              <Cb label="Sturz &gt;3 m" checked={!!p.v_sturz_ueber3m} onChange={v => setP('v_sturz_ueber3m', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '4px' }}>Verkehrsteilnehmer</div>
            <CbRow>
              <Cb label="Fußgänger" checked={!!p.v_vt_fussgaenger} onChange={v => setP('v_vt_fussgaenger', v)} />
              <Cb label="E-Scooter" checked={!!p.v_vt_escooter} onChange={v => setP('v_vt_escooter', v)} />
              <Cb label="Fahrrad" checked={!!p.v_vt_fahrrad} onChange={v => setP('v_vt_fahrrad', v)} />
              <Cb label="E-Bike" checked={!!p.v_vt_ebike} onChange={v => setP('v_vt_ebike', v)} />
              <Cb label="Motorrad / Sozius" checked={!!p.v_vt_motorrad} onChange={v => setP('v_vt_motorrad', v)} />
              <Cb label="PKW Insasse" checked={!!p.v_vt_pkw} onChange={v => setP('v_vt_pkw', v)} />
              <Cb label="LKW Insasse" checked={!!p.v_vt_lkw} onChange={v => setP('v_vt_lkw', v)} />
              <Cb label="Bus Insasse" checked={!!p.v_vt_bus} onChange={v => setP('v_vt_bus', v)} />
            </CbRow>
            <div style={{ fontWeight: 600, fontSize: '12px', opacity: 0.7, marginTop: '6px', marginBottom: '4px' }}>Gewaltanwendung</div>
            <CbRow>
              <Cb label="Schlag" checked={!!p.v_gew_schlag} onChange={v => setP('v_gew_schlag', v)} />
              <Cb label="Schuss" checked={!!p.v_gew_schuss} onChange={v => setP('v_gew_schuss', v)} />
              <Cb label="Stich" checked={!!p.v_gew_stich} onChange={v => setP('v_gew_stich', v)} />
              <Cb label="Gewalt Sonstige" checked={!!p.v_gew_sonstige} onChange={v => setP('v_gew_sonstige', v)} />
              <Cb label="Gewaltverbrechen" checked={!!p.v_gew_verbrechen} onChange={v => setP('v_gew_verbrechen', v)} />
            </CbRow>
          </Section>

        </div>
        <div style={s.footer}>
          <button style={s.btnS} onClick={onClose}>Abbrechen</button>
          <button style={s.btnP} onClick={onSaveAndSign}>Speichern & Gegenzeichnen</button>
        </div>
      </div>
    </div>
  )
}
