import type { PatientPayload, Medication } from './types'
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
                  <option>wach</option>
                  <option>somnolent</option>
                  <option>soporös</option>
                  <option>komatös</option>
                </select>
              </Field>
            </Row2>
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
            </CbRow>
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

          <Section title="Diagnosen">
            <CbRow>
              <Cb label="Krampfanfall" checked={!!p.diag_krampf} onChange={v => setP('diag_krampf', v)} />
              <Cb label="Synkope" checked={!!p.diag_synkope} onChange={v => setP('diag_synkope', v)} />
              <Cb label="Apoplex" checked={!!p.diag_apoplex} onChange={v => setP('diag_apoplex', v)} />
              <Cb label="SHT" checked={!!p.diag_sht} onChange={v => setP('diag_sht', v)} />
              <Cb label="ACS" checked={!!p.diag_acs} onChange={v => setP('diag_acs', v)} />
              <Cb label="Herzinsuffizienz" checked={!!p.diag_insuff} onChange={v => setP('diag_insuff', v)} />
              <Cb label="Hypoglykämie" checked={!!p.diag_hypo} onChange={v => setP('diag_hypo', v)} />
              <Cb label="Resp. Insufzienz" checked={!!p.diag_resp_insuff} onChange={v => setP('diag_resp_insuff', v)} />
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

          <Section title="Verletzungen">
            <textarea value={p.verletz_text||''} onChange={e => setP('verletz_text', e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
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
