import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { parsePayload, calcGCS } from '../patienten/types'
import type { PatientPayload } from '../patienten/types'
import { PubSection, PubWrap } from './pubStyles'

function F({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, color: '#111827', whiteSpace: 'pre-wrap' }}>{String(value)}</div>
    </div>
  )
}

function Grid({ children, cols = 'repeat(auto-fit, minmax(160px, 1fr))' }: { children: React.ReactNode; cols?: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '4px 16px', marginBottom: 8 }}>{children}</div>
}

function Tag({ active, label }: { active?: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      border: `0.5px solid ${active ? 'transparent' : '#e5e7eb'}`,
      borderRadius: 999, padding: '3px 10px', margin: '2px',
      fontSize: 13,
      background: active ? '#111827' : '#f9fafb',
      color: active ? '#fff' : '#6b7280',
      fontWeight: active ? 700 : 400,
    }}>{label}</span>
  )
}

function Tags({ items }: { items: [boolean | undefined, string][] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 8 }}>
      {items.map(([active, label]) => <Tag key={label} active={active} label={label} />)}
    </div>
  )
}

function CatSection({ label, items }: { label: string; items: [boolean | undefined, string][] }) {
  return (
    <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: 6, marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <Tags items={items} />
    </div>
  )
}

type Status = 'loading' | 'auth' | 'valid' | 'expired' | 'notfound' | 'error' | 'locked'

const MAX_ATTEMPTS = 5
const attemptsKey = (c: string) => `dob_attempts_${c}`

function getAttempts(c: string) {
  try { return parseInt(localStorage.getItem(attemptsKey(c)) || '0', 10) } catch { return 0 }
}
function bumpAttempts(c: string) {
  const n = getAttempts(c) + 1
  try { localStorage.setItem(attemptsKey(c), String(n)) } catch {}
  return n
}
function clearAttempts(c: string) {
  try { localStorage.removeItem(attemptsKey(c)) } catch {}
}
function normDob(d: string) {
  const s = d.trim()
  // yyyy-mm-dd → dd.mm.yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-')
    return `${day}.${m}.${y}`
  }
  return s
}

export default function PatientView() {
  const { code } = useParams<{ code: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [p, setP] = useState<PatientPayload | null>(null)
  const [expiry, setExpiry] = useState<Date | null>(null)
  const [dobInput, setDobInput] = useState('')
  const [dobError, setDobError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)

  useEffect(() => {
    if (!code) { setStatus('notfound'); return }
    if (getAttempts(code) >= MAX_ATTEMPTS) { setStatus('locked'); return }
    loadByCode(code)
  }, [code])

  async function loadByCode(c: string) {
    try {
      const records = await pb.collection('patients').getList(1, 200, {
        filter: `payload ~ '"access_code":"${c}"'`,
      })
      const rec = records.items[0]
      if (!rec) { setStatus('notfound'); return }
      const payload = parsePayload(rec.payload)
      if (!payload.access_code || payload.access_code !== c) { setStatus('notfound'); return }
      if (!payload.access_code_created) { setStatus('expired'); return }
      const created = new Date(payload.access_code_created)
      const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000)
      if (new Date() > expires) { setStatus('expired'); return }
      setP(payload)
      setExpiry(expires)
      // If no DOB stored in record, skip auth gate
      if (!payload.gebdatum) {
        setStatus('valid')
      } else {
        setAttemptsLeft(MAX_ATTEMPTS - getAttempts(c))
        setStatus('auth')
      }
    } catch (e: any) {
      if (e?.status === 403 || e?.status === 401) {
        setStatus('error')
      } else {
        setStatus('notfound')
      }
    }
  }

  function verifyDob() {
    if (!p || !code || !dobInput) return
    const stored = normDob(p.gebdatum || '')
    const entered = normDob(dobInput)
    if (stored === entered) {
      clearAttempts(code)
      setStatus('valid')
    } else {
      const n = bumpAttempts(code)
      const left = MAX_ATTEMPTS - n
      if (left <= 0) {
        setStatus('locked')
      } else {
        setDobError(`Falsches Geburtsdatum. Noch ${left} Versuch${left === 1 ? '' : 'e'}.`)
        setAttemptsLeft(left)
      }
    }
  }

  const icon = (ch: React.ReactNode, sz = 18) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {ch}
    </svg>
  )

  const centerCard = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {children}
      </div>
    </div>
  )

  if (status === 'loading') return centerCard(
    <>
      <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#c0392b', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ color: '#6b7280' }}>Lade Patientendaten…</div>
    </>
  )

  if (status === 'auth') return centerCard(
    <>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
      <h2 style={{ color: '#111827', margin: '0 0 6px', fontSize: '1.2rem' }}>Zugang bestätigen</h2>
      <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: 14, lineHeight: 1.5 }}>
        Bitte Geburtsdatum des Patienten eingeben um das Protokoll einzusehen.
      </p>
      <input
        type="date"
        value={dobInput}
        onChange={e => { setDobInput(e.target.value); setDobError('') }}
        onKeyDown={e => e.key === 'Enter' && verifyDob()}
        style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${dobError ? '#c0392b' : '#e5e7eb'}`, borderRadius: 10, fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8, outline: 'none' }}
        autoFocus
      />
      {dobError && (
        <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{dobError}</div>
      )}
      {!dobError && (
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
          {attemptsLeft} von {MAX_ATTEMPTS} Versuchen verbleibend
        </div>
      )}
      <button
        onClick={verifyDob}
        disabled={!dobInput}
        style={{ width: '100%', padding: '12px', background: dobInput ? '#c0392b' : '#e5e7eb', color: dobInput ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: dobInput ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
      >
        Zugang öffnen
      </button>
    </>
  )

  if (status === 'locked') return centerCard(
    <>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h2 style={{ color: '#c0392b', margin: '0 0 8px' }}>Zugang gesperrt</h2>
      <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>
        Zu viele Fehleingaben. Bitte einsatzkräfte der Organisation kontaktieren.
      </p>
    </>
  )

  if (status === 'expired') return centerCard(
    <>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏱</div>
      <h2 style={{ color: '#c0392b', margin: '0 0 8px' }}>Zugang abgelaufen</h2>
      <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Der 24-Stunden-Zugang für dieses Protokoll ist abgelaufen.</p>
    </>
  )

  if (status === 'notfound' || status === 'error') return centerCard(
    <>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
      <h2 style={{ color: '#111827', margin: '0 0 8px' }}>Nicht gefunden</h2>
      <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Dieser Code ist ungültig oder das Protokoll existiert nicht.</p>
    </>
  )

  if (!p) return null

  const gcsTotal = (p.gcs_e || 0) + (p.gcs_v || 0) + (p.gcs_m || 0)
  const meds = p.medications || []

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, background: '#c0392b', color: '#fff', zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '12px 1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Patientendokumentation</div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>
              Code {code} · Gültig bis {expiry?.toLocaleString('de-DE')}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '4px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
            LESE-ZUGANG
          </div>
        </div>
      </header>

      <PubWrap>

        <PubSection title="🚑 Einsatzdaten" open>
          <Grid>
            <F label="Einsatz-Nr." value={p.einsatz_nr} />
            <F label="Auftrags-Nr. (ILS)" value={p.auftrags_nr} />
            <F label="Rufname" value={p.rufname} />
            <F label="Fahrzeug / Einheit" value={p.fahrzeug} />
            <F label="Einsatzart / Stichwort" value={p.einsatz_art} />
            <F label="Alarmzeit" value={p.zeit_einsatz} />
            <F label="Einsatzort / Adresse" value={p.einsatz_adresse} />
            <F label="Transportziel" value={p.transport_ziel} />
          </Grid>
          <Grid cols="repeat(auto-fit, minmax(120px, 1fr))">
            <F label="Status 3 (Eintreffen)" value={p.zeit_eintreffen} />
            <F label="Transportbeginn" value={p.zeit_transport} />
            <F label="Übergabe" value={p.zeit_uebergabe} />
          </Grid>
        </PubSection>

        <PubSection title="👥 Mannschaft" open>
          <Grid>
            <F label="Teamführer" value={p.mannschaft_tf} />
            <F label="Mannschaft 1" value={p.mannschaft_1} />
            <F label="Mannschaft 2" value={p.mannschaft_2} />
            <F label="Mannschaft 3" value={p.mannschaft_3} />
          </Grid>
        </PubSection>

        <PubSection title="🧑 Pat-Stammdaten" open>
          <Grid>
            <F label="Name" value={p.name} />
            <F label="Vorname" value={p.vorname} />
            <F label="Geb.-Datum" value={p.gebdatum} />
            <F label="Alter" value={p.alter} />
            <F label="Telefon" value={p.telefon} />
            <F label="Mobil" value={p.mobil} />
          </Grid>
          <Grid>
            <F label="Straße" value={p.strasse} />
            <F label="PLZ / Ort" value={p.plz_ort} />
            <F label="Krankenkasse" value={p.kasse} />
            <F label="Vers.-Nr." value={p.versnr} />
            <F label="Hausarzt" value={p.hausarzt} />
            <F label="Angehöriger" value={p.angehoeriger} />
          </Grid>
          <F label="Vorerkrankungen" value={p.vorerkrankungen} />
          <F label="Vormedikation" value={p.vormedikation_patient} />
          <F label="Allergien" value={p.allergien} />
          <F label="Weitere Informationen" value={p.infos} />
        </PubSection>

        <PubSection title="📋 Notfallgeschehen / Anamnese">
          <F label="Notfallgeschehen" value={p.notfallgeschehen} />
          <F label="Verlaufsbeschreibung" value={p.verlaufsbeschreibung} />
          {p.photos && p.photos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Fotos</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.photos.map((ph, i) => (
                  <img key={i} src={ph} alt={`Foto ${i + 1}`} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                ))}
              </div>
            </div>
          )}
        </PubSection>

        <PubSection title="📊 NACA / Bewusstsein / Verdachtsdiagnose">
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>NACA-Score</div>
            <Tags items={['0','I','II','III','IV','V','VI','VII'].map(v => [p.naca === v, v] as [boolean, string])} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Bewusstsein</div>
            <Tags items={['wach','somnolent','soporös','komatös','bewusstlos'].map(v => [p.bewusstsein === v, v] as [boolean, string])} />
          </div>
          <F label="Verdachtsdiagnose" value={p.erstdiagnose_text} />
        </PubSection>

        <PubSection title="🧠 GCS">
          <Grid cols="repeat(3, 1fr)">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Augen (E)</div>
              <Tags items={([['4','spontan'],['3','auf Ansprache'],['2','auf Schmerz'],['1','keine']] as [string,string][]).map(([v,l]) => [p.gcs_e === Number(v), `${v} – ${l}`] as [boolean, string])} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Verbal (V)</div>
              <Tags items={([['5','orientiert'],['4','verwirrt'],['3','inadäquat'],['2','unverständlich'],['1','keine']] as [string,string][]).map(([v,l]) => [p.gcs_v === Number(v), `${v} – ${l}`] as [boolean, string])} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Motorik (M)</div>
              <Tags items={([['6','gezielt'],['5','auf Aufforderung'],['4','Beugeabwehr'],['3','Beugesynergismus'],['2','Strecksynergismus'],['1','keine']] as [string,string][]).map(([v,l]) => [p.gcs_m === Number(v), `${v} – ${l}`] as [boolean, string])} />
            </div>
          </Grid>
          {gcsTotal > 0 && (
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginTop: 8 }}>GCS Gesamt: {gcsTotal} / 15</div>
          )}
        </PubSection>

        <PubSection title="📈 Messwerte / Atmung">
          <Grid>
            <F label="RR systolisch" value={p.rr_sys ? `${p.rr_sys} mmHg` : undefined} />
            <F label="RR diastolisch" value={p.rr_dia ? `${p.rr_dia} mmHg` : undefined} />
            <F label="Herzfrequenz" value={p.hf ? `${p.hf} /min` : undefined} />
            <F label="SpO₂" value={p.spo2 ? `${p.spo2} %` : undefined} />
            <F label="Atemfrequenz" value={p.af ? `${p.af} /min` : undefined} />
            <F label="Temperatur" value={p.temp ? `${p.temp} °C` : undefined} />
            <F label="BZ" value={p.bz_mg ? `${p.bz_mg} mg/dl` : undefined} />
            <F label="etCO₂" value={p.etco2} />
            <F label="Schmerz NRS" value={p.schmerz} />
          </Grid>
          <Tags items={[
            [p.atm_apnoe, 'Apnoe'], [p.atm_stridor, 'Stridor'], [p.atm_dyspnoe, 'Dyspnoe'], [p.atm_zyanose, 'Zyanose'],
          ]} />
          {(p.o2 || p.o2_nasal || p.o2_maske || p.o2_reservoir) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>O₂-Gabe</div>
              <Tags items={[
                [p.o2_nasal, 'Nasal'], [p.o2_maske, 'Maske'], [p.o2_reservoir, 'Reservoirmaske'],
              ]} />
              <F label="Flow" value={p.o2_flow ? `${p.o2_flow} l/min` : undefined} />
            </div>
          )}
        </PubSection>

        <PubSection title="🧬 Neurologie">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Neurologischer Befund</div>
          <Tags items={[
            [p.neu_unauff, 'unauffällig'], [p.neu_sprachstoerung, 'Sprachstörung'], [p.neu_demenz, 'Demenz'],
            [p.neu_meningismus, 'Meningismus'], [p.neu_seitenzeichen, 'Seitenzeichen'], [p.neu_kein_laecheln, 'kein Lächeln'],
            [p.neu_sehstoerung, 'Sehstörung'], [p.neu_querschnitt, 'Querschnitt'], [p.neu_babinski, 'Babinski'],
            [p.neu_vorbestehend, 'vorbestehend'],
          ]} />
          <F label="Sonstige" value={p.neu_sonstige} />
          <Grid>
            <F label="Extremitäten re. Arm" value={p.ext_r_arm} />
            <F label="Extremitäten li. Arm" value={p.ext_l_arm} />
            <F label="Extremitäten re. Bein" value={p.ext_r_bein} />
            <F label="Extremitäten li. Bein" value={p.ext_l_bein} />
          </Grid>
          <Grid>
            <F label="Pupillen re." value={p.pw_r} />
            <F label="Pupillen li." value={p.pw_l} />
            <F label="Lichtreaktion re." value={p.lr_r} />
            <F label="Lichtreaktion li." value={p.lr_l} />
          </Grid>
        </PubSection>

        <PubSection title="❤️ Rhythmus / EKG">
          <Tags items={[
            [p.sr, 'Sinusrhythmus'], [p.stemi, 'STEMI'], [p.vf, 'VF/VT'], [p.asystole, 'Asystolie'],
          ]} />
          <Grid>
            <F label="EKG-Standort" value={p.ekg_standort} />
            <F label="EKG-Pers.-Nr." value={p.ekg_persnr} />
          </Grid>
        </PubSection>

        <PubSection title="🏥 Haut / Psyche">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Haut</div>
          <Tags items={[
            [p.haut_unauff, 'unauffällig'], [p.haut_falten, 'Hautfalten'], [p.haut_oedeme, 'Ödeme'],
            [p.haut_dekubitus, 'Dekubitus'], [p.haut_kaltschweissig, 'kaltschweißig'], [p.haut_exanthem, 'Exanthem'],
          ]} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 8 }}>Psyche</div>
          <Tags items={[
            [p.psy_erregt, 'erregt'], [p.psy_aggr, 'aggressiv'], [p.psy_verlangsamt, 'verlangsamt'],
            [p.psy_depressiv, 'depressiv'], [p.psy_aengstlich, 'ängstlich'], [p.psy_euphorisch, 'euphorisch'],
            [p.psy_wahnhaft, 'wahnhaft'], [p.psy_verwirrt, 'verwirrt'], [p.psy_suizidal, 'suizidal'], [p.psy_motor_unruhig, 'motorisch unruhig'],
          ]} />
        </PubSection>

        <PubSection title="🔬 Diagnose-Kategorien">
          <CatSection label="ZNS" items={[
            [p.e_zns_schlaganfall,'Schlaganfall'],[p.e_zns_tia,'TIA'],[p.e_zns_blutung,'Blutung'],[p.e_zns_lyse,'Lyse'],
            [p.e_zns_krampf,'Krampf'],[p.e_zns_status_epilept,'Status epilepticus'],[p.e_zns_meningitis,'Meningitis'],[p.e_zns_synkope,'Synkope'],[p.e_zns_sonstige,'Sonstige'],
          ]} />
          <CatSection label="Herz-Kreislauf" items={[
            [p.e_hk_acs,'ACS'],[p.e_hk_stemi_vw,'STEMI VW'],[p.e_hk_stemi_hw,'STEMI HW'],[p.e_hk_tachy,'Tachykardie'],
            [p.e_hk_brady,'Bradykardie'],[p.e_hk_embolie,'Embolie'],[p.e_hk_ortho,'Orthostatisch'],[p.e_hk_insuff,'Herzinsuffizienz'],[p.e_hk_hypert,'Hypertonie'],
            [p.e_hk_kard_schock,'Kardiogener Schock'],[p.e_hk_schrittmacher,'Schrittmacher'],[p.e_hk_sonstige,'Sonstige'],
          ]} />
          <CatSection label="Atmung" items={[
            [p.e_atm_asthma,'Asthma'],[p.e_atm_status_asthm,'Status asthmaticus'],[p.e_atm_copd,'COPD'],[p.e_atm_pneumonie,'Pneumonie'],
            [p.e_atm_hypervent,'Hyperventilation'],[p.e_atm_aspiration,'Aspiration'],
          ]} />
        </PubSection>

        {meds.length > 0 && (
          <PubSection title="💊 Medikamente">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['Medikament','Dosis','Einheit','Route','Zeit','Bemerkung'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '6px 8px' }}>{m.dose}</td>
                      <td style={{ padding: '6px 8px' }}>{m.unit}</td>
                      <td style={{ padding: '6px 8px' }}>{m.route}</td>
                      <td style={{ padding: '6px 8px' }}>{m.time}</td>
                      <td style={{ padding: '6px 8px', color: '#6b7280' }}>{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PubSection>
        )}

        <PubSection title="📡 Verlauf (Vitalparameter)">
          {p.verlauf && p.verlauf.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['Zeit','RR sys','RR dia','HF','SpO₂','AF','Temp','BZ','etCO₂','Schmerz','O₂','Bemerkung'].map(h => (
                      <th key={h} style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.verlauf.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {[r.zeit,r.rr_sys,r.rr_dia,r.hf,r.spo2,r.af,r.temp,r.bz,r.etco2,r.schmerz,r.o2,r.bemerkung].map((v, j) => (
                        <td key={j} style={{ padding: '5px 6px', color: v ? '#111827' : '#d1d5db' }}>{v || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div style={{ color: '#9ca3af', fontSize: 13 }}>Keine Verlaufswerte eingetragen.</div>}
        </PubSection>

        <PubSection title="🤕 Verletzungen / Trauma">
          <Tags items={[[p.v_keine, 'Kein Trauma']]} />
          <F label="Verletzungen" value={p.verletz_text} />
          <CatSection label="Körper" items={[
            [!!p.v_sht, `SHT${p.v_sht ? ` (${p.v_sht})` : ''}`],
            [!!p.v_thorax, `Thorax${p.v_thorax ? ` (${p.v_thorax})` : ''}`],
            [!!p.v_abdomen, `Abdomen${p.v_abdomen ? ` (${p.v_abdomen})` : ''}`],
            [!!p.v_ws, `WS${p.v_ws ? ` (${p.v_ws})` : ''}`],
            [!!p.v_becken, `Becken${p.v_becken ? ` (${p.v_becken})` : ''}`],
          ]} />
          <CatSection label="Besonderheiten" items={[
            [p.v_verbrennung, 'Verbrennung'], [p.v_veraetzung, 'Verätzung'], [p.v_verschuettung, 'Verschüttung'],
            [p.v_einklemmung, 'Einklemmung'], [p.v_inhalation, 'Inhalation'], [p.v_elektrounfall, 'Elektrounfall'],
            [p.v_ertrinken, 'Ertrinken'], [p.v_tauchunfall, 'Tauchunfall'], [p.v_haemo_schock, 'Häm. Schock'],
          ]} />
          <CatSection label="Mechanismus" items={[
            [p.v_trauma_stumpf, 'Stumpf'], [p.v_trauma_penetr, 'Penetrierend'],
            [p.v_sturz_eben, 'Sturz (eben)'], [p.v_sturz_unter3m, 'Sturz < 3m'], [p.v_sturz_ueber3m, 'Sturz > 3m'],
          ]} />
        </PubSection>

        <PubSection title="🫁 Atemwege / Lagerung / Beatmung">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Atemwegssicherung</div>
          <Tags items={[
            [p.awm_freihalten,'Freihalten'],[p.awm_absaugung,'Absaugung'],[p.awm_opa,'OPA'],[p.awm_npa,'NPA'],[p.awm_lma,'LMA'],[p.awm_intubation,'Intubation'],
          ]} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 8 }}>Lagerung</div>
          <Tags items={[
            [p.lag_flach,'Flach'],[p.lag_schock,'Schocklage'],[p.lag_ok_hoch,'OK hoch'],[p.lag_ssl,'SSL'],[p.lag_sitzend,'Sitzend'],[p.lag_haengend,'Hängend'],
          ]} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 8 }}>Beatmung</div>
          <Tags items={[
            [p.beat_manuell,'Manuell'],[p.beat_maschinell,'Maschinell'],[p.beat_niv,'NIV'],[p.beat_notfallnarkose,'Notfallnarkose'],
          ]} />
          <Grid>
            <F label="FiO₂" value={p.beat_fio2} />
            <F label="AF" value={p.beat_af} />
            <F label="PEEP" value={p.beat_peep} />
            <F label="pmax" value={p.beat_pmax} />
            <F label="AMV" value={p.beat_amv} />
          </Grid>
        </PubSection>

        <PubSection title="⚡ Defibrillation">
          <Tags items={[
            [p.defi_aed,'AED'],[p.defi_defi,'Defibrillator'],[p.defi_mono,'Monophasisch'],[p.defi_bi,'Biphasisch'],
          ]} />
          <Grid>
            <F label="Zeitpunkt" value={p.defi_zeitpunkt} />
            <F label="ROSC" value={p.defi_rosc} />
            <F label="Anzahl" value={p.defi_anzahl} />
            <F label="Energie" value={p.defi_energie} />
          </Grid>
        </PubSection>

        {p.rean && (
          <PubSection title="💓 Reanimation">
            <Grid>
              <F label="Beginn" value={p.rean_beginn} />
              <F label="Ende" value={p.rean_ende} />
            </Grid>
            <Tags items={[[p.rean_tod, 'Exitus letalis']]} />
            <F label="Todesuhrzeit" value={p.rean_tod_zeit} />
          </PubSection>
        )}

        <PubSection title="🏥 Zugang / Infusion">
          <Tags items={[
            [p.zugang_peripher,'Peripher'],[p.zugang_intraossar,'Intraossär'],[p.zugang_transnasal,'Transnasal'],[p.zugang_erschwert,'Erschwert'],
          ]} />
          <Grid>
            <F label="Art" value={p.zugang_art} />
            <F label="Gauge" value={p.zugang_gauge} />
            <F label="Region" value={p.zugang_region} />
            <F label="Infusion" value={p.inf_art} />
            <F label="Menge" value={p.inf_menge ? `${p.inf_menge} ml` : undefined} />
          </Grid>
        </PubSection>

        <PubSection title="🚨 Übergabe / Besonderheiten">
          <Grid>
            <F label="Übergabe an" value={p.uebergabe_name} />
            <F label="Ziel" value={p.uebergabe_ziel} />
          </Grid>
          <F label="Bemerkungen" value={p.bemerkungen} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 8 }}>Besondere Vorkommnisse</div>
          <Tags items={[
            [p.ev_transport_sondersignal,'Sondersignal'],[p.ev_zwangseinweisung,'Zwangseinweisung'],[p.ev_transportverweigerung,'Transportverweigerung'],
            [p.ev_nur_untersuchung,'Nur Untersuchung'],[p.ev_manv,'MANV'],[p.ev_lna,'LNA'],[p.ev_schwerlast,'Schwerlast'],
          ]} />
        </PubSection>

        {p.signature && (
          <PubSection title="✍️ Unterschrift">
            <img src={p.signature} alt="Unterschrift" style={{ maxWidth: 300, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          </PubSection>
        )}

        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16, margin: '1.5rem 0', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⏱ Zugang endet {expiry?.toLocaleString('de-DE')}</div>
          <div style={{ fontSize: 13, color: '#92400e' }}>Nach Ablauf ist dieses Protokoll nicht mehr einsehbar.</div>
        </div>

      </PubWrap>
    </div>
  )
}
