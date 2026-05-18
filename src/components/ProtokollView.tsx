import type { PatientPayload } from '../pages/patienten/types'
import { PubSection, PubWrap, lbl, inp } from '../pages/public/pubStyles'

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }
const activePill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '0.5px solid transparent', borderRadius: 999, padding: '.2rem .6rem', background: 'var(--accent)', fontSize: '.9rem', margin: '2px', color: '#fff', fontWeight: 700 }
const inactivePill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: '0.5px solid var(--border-medium)', borderRadius: 999, padding: '.2rem .6rem', background: 'var(--bg-subtle)', fontSize: '.9rem', margin: '2px', color: 'var(--text)', fontWeight: 400 }

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

function changedStyle(key: string, cf?: Set<string>, tf?: Set<string>): React.CSSProperties {
  if (cf?.has(key)) return { background: 'rgba(234,179,8,0.1)', borderLeft: '3px solid #d97706', paddingLeft: 8, borderRadius: 4, marginLeft: -8 }
  if (tf?.has(key)) return { background: 'rgba(22,163,74,0.07)', borderLeft: '3px solid #16a34a', paddingLeft: 8, borderRadius: 4, marginLeft: -8 }
  return {}
}

function Val({ label, value, cf, tf, fieldKey }: { label: string; value?: string | number | null; cf?: Set<string>; tf?: Set<string>; fieldKey?: string }) {
  const highlight = fieldKey ? changedStyle(fieldKey, cf, tf) : {}
  return (
    <div style={highlight}>
      <label style={lbl}>
        {label}
        <div style={{ ...inp, color: (value !== null && value !== undefined && value !== '') ? 'var(--text)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', marginTop: 6 }}>
          {(value !== null && value !== undefined && value !== '') ? String(value) : '—'}
        </div>
      </label>
    </div>
  )
}

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

interface Props {
  payload: PatientPayload
  changedFields?: Set<string>
  tfChangedFields?: Set<string>
}

export default function ProtokollView({ payload, changedFields: cf, tfChangedFields: tf }: Props) {
  const p = payload as any
  const mann = p.mannschaft || {}
  const meds = p.medications || []
  const verlauf: any[] = p.verlauf || []
  const gcsSum = (p.gcs_e || 0) + (p.gcs_v || 0) + (p.gcs_m || 0)

  const vv = (fieldKey: string, label: string, value?: string | number | null) => (
    <Val key={fieldKey} fieldKey={fieldKey} label={label} value={value} cf={cf} tf={tf} />
  )

  return (
    <PubWrap>
      {/* Änderungen-Legende */}
      {((cf?.size ?? 0) > 0 || (tf?.size ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '.75rem', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 10, border: '0.5px solid var(--border)', fontSize: 12 }}>
          {(cf?.size ?? 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#d97706', flexShrink: 0 }} />Durch Verantwortlichen geändert</span>}
          {(tf?.size ?? 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#16a34a', flexShrink: 0 }} />Durch Teamführer nachbearbeitet</span>}
        </div>
      )}

      {/* Mannschaft */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {pik(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>)} Mannschaft
        </div>
        <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }}>
          <Val label="Teamführer" value={mann?.tf?.name} cf={cf} tf={tf} fieldKey="mannschaft" />
          <Val label="Mannschaft 1" value={mann?.m1?.name} />
          <Val label="Mannschaft 2" value={mann?.m2?.name} />
          <Val label="Mannschaft 3" value={mann?.m3?.name} />
        </div>
      </div>

      {/* Einsatzdaten */}
      <PubSection title="Einsatzdaten" open icon={pik(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>)}>
        <div style={grid}>
          {vv('einsatz_nr','Einsatz-Nr.',p.einsatz_nr)}
          {vv('auftrags_nr','Auftrags-Nr. (ILS)',p.auftrags_nr)}
          {vv('rufname','Rufname',p.rufname)}
          {vv('fahrzeug','Fahrzeug / Einheit',p.fahrzeug)}
          {vv('einsatz_art','Einsatzart / Stichwort',p.einsatz_art)}
          {vv('zeit_einsatz','Alarmzeit',p.zeit_einsatz)}
          {vv('einsatz_adresse','Einsatzort / Adresse',p.einsatz_adresse)}
          {vv('transport_ziel','Transportziel',p.transport_ziel)}
        </div>
        <div style={{ ...grid, marginTop: '.75rem' }}>
          {vv('zeit_status3','Status 3',p.zeit_status3)}
          {vv('zeit_eintreffen','Eintreffen',p.zeit_eintreffen)}
          {vv('zeit_status1','Status 1',p.zeit_status1)}
          {vv('zeit_status2','Status 2',p.zeit_status2)}
          {vv('zeit_uebergabe','Übergabe',p.zeit_uebergabe)}
        </div>
      </PubSection>

      {/* Einsatz-Zeitstrahl */}
      <PubSection title="Einsatz-Zeitstrahl" icon={pik(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>)}>
        {(() => {
          const STEP_COLORS = ['#6B1A2A','#9E2A3A','#C94D6A','#2563eb','#16a34a','#166534']
          const fmtDT = (v?: string) => {
            if (!v) return null
            try { const d = new Date(v); if (isNaN(d.getTime())) return null; return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) } catch { return null }
          }
          const steps = [
            { label: 'Alarm',    sub: 'Meldungseingang',  badge: '!', time: fmtDT(p.zeit_einsatz) },
            { label: 'Status 3', sub: 'Ausgerückt',        badge: '3', time: fmtDT(p.zeit_status3) },
            { label: 'Status 4', sub: 'Eintreffen',        badge: '4', time: fmtDT(p.zeit_eintreffen) },
            { label: 'Übergabe', sub: 'Patient übergeben', badge: '✓', time: fmtDT(p.zeit_uebergabe) },
            { label: 'Status 1', sub: 'Wieder frei',       badge: '1', time: fmtDT(p.zeit_status1) },
            { label: 'Status 2', sub: 'Am Standort',       badge: '2', time: fmtDT(p.zeit_status2) },
          ]
          return (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', position: 'relative', minWidth: 480, paddingBottom: 8 }}>
                <div style={{ position: 'absolute', left: `calc(100% / ${steps.length * 2})`, right: `calc(100% / ${steps.length * 2})`, top: 13, height: 2, background: 'var(--border)' }} />
                {steps.map((step, i) => {
                  const color = STEP_COLORS[i]; const known = !!step.time
                  return (
                    <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                      {i > 0 && known && <div style={{ position: 'absolute', right: '50%', top: 13, height: 2, left: 0, background: color, zIndex: 0 }} />}
                      <div style={{ width: 28, height: 28, borderRadius: '50%', position: 'relative', zIndex: 1, flexShrink: 0, background: known ? color : 'var(--bg)', border: `2px solid ${known ? color : 'var(--border-medium)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: known ? `0 0 0 4px ${color}22` : 'none' }}>
                        <span style={{ fontSize: '.62rem', fontWeight: 800, color: known ? '#fff' : 'var(--text-secondary)', lineHeight: 1 }}>{step.badge}</span>
                      </div>
                      <div style={{ textAlign: 'center', marginTop: 8, padding: '0 3px' }}>
                        <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{step.label}</div>
                        <div style={{ fontSize: '.67rem', color: 'var(--text-secondary)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{step.sub}</div>
                        <div style={{ fontSize: '.9rem', fontWeight: 800, marginTop: 6, color: known ? color : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{step.time ?? '–'}</div>
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
          {vv('name','Name',p.name)}
          {vv('vorname','Vorname',p.vorname)}
          {vv('gebdatum','Geb.-Datum',p.gebdatum)}
          {vv('alter','Alter',p.alter)}
          {vv('telefon','Telefon',p.telefon)}
          {vv('mobil','Mobil',p.mobil)}
          {vv('strasse','Straße',p.strasse)}
          {vv('plz_ort','PLZ, Ort',p.plz_ort)}
          {vv('kasse','Kasse',p.kasse)}
          {vv('versnr','Vers.-Nr.',p.versnr)}
          {vv('hausarzt','Hausarzt',p.hausarzt)}
          {vv('angehoeriger','Angehöriger',p.angehoeriger)}
        </div>
      </PubSection>

      {/* Notfallgeschehen */}
      <PubSection title="Notfallgeschehen / Anamnese" open icon={pik(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>)}>
        {vv('notfallgeschehen','Notfallgeschehen',p.notfallgeschehen)}
        {vv('verlaufsbeschreibung','Verlaufsbeschreibung',p.verlaufsbeschreibung)}
        <div style={{ ...grid, marginTop: '.5rem' }}>
          {vv('vorerkrankungen','Vorerkrankungen',p.vorerkrankungen)}
          {vv('vormedikation_patient','Dauermedikation (Freitext)',p.vormedikation_patient)}
        </div>
        {(p.dauermedikation as any[])?.length > 0 && (
          <div style={{ marginTop: '.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)', marginBottom: 6 }}>Dauermedikation</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(p.dauermedikation as any[]).map((m: any, i: number) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg-subtle)', border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: '6px 10px', fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{m.name}</span>
                  {m.wirkstoff && <span style={{ color: 'var(--text-secondary)' }}>({m.wirkstoff})</span>}
                  {m.dosis && <span style={{ color: 'var(--text-secondary)', marginLeft: 2 }}>{m.dosis}</span>}
                  {m.pzn && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 2 }}>PZN {m.pzn}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {vv('allergien','Allergien / Unverträglichkeiten',p.allergien)}
        {p.photos?.length > 0 && (
          <div style={{ marginTop: '.75rem' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>Fotos</div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {(p.photos as string[]).map((src, i) => <img key={i} src={src} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--border)' }} />)}
            </div>
          </div>
        )}
      </PubSection>

      {/* NACA / Bewusstsein */}
      <PubSection title="NACA / Bewusstsein / Verdachtsdiagnose" open icon={pik(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>)}>
        <PillGroup title="NACA-Score" items={['0','I','II','III','IV','V','VI','VII'].map(v => [p.naca === v, v] as [boolean,string])} />
        <PillGroup title="Bewusstsein" items={['nicht beurteilbar','wach','getrübt','bewusstlos','reaktionslos','auf Ansprache','Reaktion auf Schmerz','analgosediert / Narkose'].map(v => [p.bewusstsein === v, v] as [boolean,string])} />
        {vv('erstdiagnose_text','Verdachtsdiagnose / Erstdiagnose',p.erstdiagnose_text)}
      </PubSection>

      {/* GCS */}
      <PubSection title="Glasgow Coma Scale" icon={pik(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>)}>
        {([
          ['gcs_e','Augenöffnung (E)',[['4','spontan'],['3','auf Geräusch'],['2','auf Druck'],['1','keine']]],
          ['gcs_v','Verbale Antwort (V)',[['5','orientiert'],['4','verwirrt'],['3','Wörter'],['2','Laute'],['1','keine']]],
          ['gcs_m','Motorik (M)',[['6','folgt'],['5','lokalisiert'],['4','beugt norm.'],['3','beugt abnorm.'],['2','streckt'],['1','keine']]],
        ] as any[]).map(([key, title, opts]: [string, string, [string,string][]]) => (
          <PillGroup key={key} title={title} items={opts.map(([v, l]) => [p[key] === Number(v) || p[key] === v, `${l} (${v})`] as [boolean,string])} />
        ))}
        <div style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontWeight: 700, color: 'var(--text)' }}>
          GCS Summe: <span style={{ fontSize: '1.2rem' }}>{gcsSum || '—'}</span>
        </div>
      </PubSection>

      {/* Messwerte / Atmung */}
      <PubSection title="Messwerte / Atmung" icon={pik(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>)}>
        <div style={grid}>
          {([['rr_sys','RR syst. (mmHg)'],['rr_dia','RR diast. (mmHg)'],['hf','HF (/min)'],['af','AF (/min)'],['spo2','SpO₂ (%)'],['etco2','etCO₂ (mmHg)'],['temp','Temp (°C)'],['bz_mg','BZ (mg/dl)'],['schmerz','Schmerz (0–10)']] as [string,string][]).map(([n,l]) => vv(n,l,p[n]))}
        </div>
        <PillGroup title="Atmung" items={[['atm_apnoe','Apnoe'],['atm_stridor','Stridor'],['atm_dyspnoe','Dyspnoe'],['atm_zyanose','Zyanose'],['atm_beatmung','Beatmung'],['atm_verlegung','Atemwegsverlegung']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <PillGroup title="O₂-Gabe" items={[['o2','O₂'],['o2_nasal','Nasensonde'],['o2_maske','Maske'],['o2_reservoir','Reservoir']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        {vv('o2_flow','Flow (l/min)',p.o2_flow)}
      </PubSection>

      {/* Neurologie */}
      <PubSection title="Neurologie" icon={pik(<><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></>)}>
        <Pills items={[['neu_unauff','Unauffällig'],['neu_sprachstoerung','Sprachstörung'],['neu_demenz','Demenz'],['neu_meningismus','Meningismus'],['neu_seitenzeichen','Seitenzeichen'],['neu_kein_laecheln','Kein Lächeln'],['neu_sehstoerung','Sehstörung'],['neu_querschnitt','Querschnitt'],['neu_babinski','Babinski'],['neu_vorbestehend','Vorbestehende Defizite']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <div style={{ ...grid, marginTop: '.5rem' }}>
          {vv('neu_sonstige','Sonstige Neurologie',p.neu_sonstige)}
          {vv('neu_zeit','Zeitpunkt Symptombeginn',p.neu_zeit)}
        </div>
        <PillGroup title="Extremitätenbewegung" items={[['ext_r_arm','Arm re.'],['ext_l_arm','Arm li.'],['ext_r_bein','Bein re.'],['ext_l_bein','Bein li.']].map(([n,l]) => [!!p[n], `${l}: ${p[n] || '—'}`] as [boolean,string])} />
        <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)', marginTop: '.5rem' }}>Pupillen</div>
        <div style={grid}>
          {[['pw_r','Pupille re.','lr_r'],['pw_l','Pupille li.','lr_l']].map(([n,l,lr]) => (
            <div key={n}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{l}</div>
              <Pills items={['eng','mittel','weit'].map(v => [p[n] === v, v] as [boolean,string])} />
              <div style={{ marginTop: 4, fontSize: '.8rem', color: 'var(--text-secondary)' }}>LR: <Pills items={['prompt','träge','keine'].map(v => [p[lr] === v, v] as [boolean,string])} /></div>
            </div>
          ))}
        </div>
      </PubSection>

      {/* Rhythmus / EKG */}
      <PubSection title="Rhythmus / EKG" icon={pik(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>)}>
        <Pills items={[['sr','Sinusrhythmus'],['stemi','STEMI'],['vf','Kammerflimmern'],['asystole','Asystolie'],['arrh_abs','Abs. Arrhythmie']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <div style={{ ...grid, marginTop: '.5rem' }}>
          {vv('ekg_standort','Standort',p.ekg_standort)}
          {vv('ekg_persnr','Pers-Nr.',p.ekg_persnr)}
        </div>
      </PubSection>

      {/* Haut / Psyche */}
      <PubSection title="Haut / Psyche" icon={pik(<><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>)}>
        <PillGroup title="Haut" items={[['haut_unauff','Unauffällig'],['haut_falten','Fältchentest pos.'],['haut_oedeme','Ödeme'],['haut_dekubitus','Dekubitus'],['haut_kaltschweissig','Kaltschweißig'],['haut_exanthem','Exanthem']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <PillGroup title="Psyche" items={[['psy_erregt','Erregt'],['psy_aggr','Aggressiv'],['psy_verlangsamt','Verlangsamt'],['psy_depressiv','Depressiv'],['psy_aengstlich','Ängstlich'],['psy_euphorisch','Euphorisch'],['psy_wahnhaft','Wahnhaft'],['psy_verwirrt','Verwirrt'],['psy_suizidal','Suizidal'],['psy_motor_unruhig','Motor. unruhig']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
      </PubSection>

      {/* Diagnose-Kategorien */}
      <PubSection title="Erstdiagnose / Diagnose-Kategorien" icon={pik(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>)}>
        <Pill active={!!p.e_keine} label="Keine Erkrankung / Verletzung" />
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
        ] as any[]).map(([cat, items]: [string, [string,string][]]) => <CatGroup key={cat} cat={cat} items={items} p={p} />)}
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
        <Pill active={!!p.v_keine} label="Keine Verletzung" />
        {([
          ['Körper',[['v_sht','SHT'],['v_gesicht','Gesicht'],['v_hals','Hals'],['v_thorax','Thorax'],['v_abdomen','Abdomen'],['v_ws','Wirbelsäule'],['v_becken','Becken'],['v_obext','Obere Ext.'],['v_untext','Untere Ext.'],['v_weich','Weichteile']]],
          ['Besonderheiten',[['v_verbrennung','Verbrennung'],['v_veraetzung','Verätzung'],['v_verschuettung','Verschüttung'],['v_einklemmung','Einklemmung'],['v_inhalation','Inhalationstrauma'],['v_elektrounfall','Elektrounfall'],['v_ertrinken','Beinahe-Ertrinken'],['v_tauchunfall','Tauchunfall'],['v_haemo_schock','Hämorr. Schock']]],
          ['Mechanismus',[['v_trauma_stumpf','Stumpf'],['v_trauma_penetr','Penetrierend'],['v_sturz_eben','Sturz ebenerdig'],['v_sturz_unter3m','Sturz <3m'],['v_sturz_ueber3m','Sturz >3m']]],
          ['Verkehr',[['v_vt_fussgaenger','Fußgänger'],['v_vt_escooter','E-Scooter'],['v_vt_fahrrad','Fahrrad'],['v_vt_ebike','E-Bike'],['v_vt_motorrad','Motorrad'],['v_vt_pkw','PKW'],['v_vt_lkw','LKW'],['v_vt_bus','Bus']]],
          ['Gewalt',[['v_gew_schlag','Schlag'],['v_gew_schuss','Schuss'],['v_gew_stich','Stich'],['v_gew_verbrechen','Gewaltverbrechen'],['v_gew_sonstige','Sonstige']]],
        ] as any[]).map(([cat, items]: [string, [string,string][]]) => <CatGroup key={cat} cat={cat} items={items} p={p} />)}
        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '.75rem', marginTop: '.75rem' }}>
          <div style={grid}>
            {vv('v_verbrennung_grad','Verbrennung Grad',p.v_verbrennung_grad)}
            {vv('v_verbrennung_pct','Verbrennung %',p.v_verbrennung_pct)}
          </div>
          {vv('v_sonstige','Sonstige Verletzungen',p.v_sonstige)}
          {vv('verletz_text','Freitext Verletzungen',p.verletz_text)}
        </div>
      </PubSection>

      {/* Atemwege / Lagerung */}
      <PubSection title="Atemwege / Lagerung / Immobilisation" icon={pik(<><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></>)}>
        <PillGroup title="Atemwegsmanagement" items={[['awm_freihalten','Freihalten'],['awm_absaugung','Absaugung'],['awm_opa','OPA/Guedel'],['awm_npa','NPA/Wendl'],['awm_lma','LMA/SGA'],['awm_intubation','Intubation (OTI)']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <PillGroup title="Lagerung" items={[['lag_flach','Flachlagerung'],['lag_schock','Schocklagerung'],['lag_ok_hoch','OK hoch'],['lag_ssl','Stabile Seitenlage'],['lag_sitzend','Sitzend'],['lag_haengend','Hängeposition']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <PillGroup title="Immobilisation" items={[['immo_hws','HWS-Orthese'],['immo_spineboard','Spineboard'],['immo_vakuum','Vakuummatratze']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
      </PubSection>

      {/* Beatmung / Defibrillation */}
      <PubSection title="Beatmung / Defibrillation" icon={pik(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>)}>
        <PillGroup title="Beatmung" items={[['beat_manuell','Manuell'],['beat_maschinell','Maschinell'],['beat_niv','NIV'],['beat_notfallnarkose','Notfallnarkose']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <div style={grid}>
          {([['beat_fio2','FiO₂'],['beat_af','AF /min'],['beat_peep','PEEP mbar'],['beat_pmax','Pmax mbar'],['beat_amv','AMV l/min']] as [string,string][]).map(([n,l]) => vv(n,l,p[n]))}
        </div>
        <PillGroup title="Defibrillation" items={[['defi_aed','AED'],['defi_defi','Defi'],['defi_mono','Monophasisch'],['defi_bi','Biphasisch']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <PillGroup title="Erstanwendung durch" items={[['defi_erstanw_laie','Laie'],['defi_erstanw_fr','First Resp.'],['defi_erstanw_rd','Rettungsdienst'],['defi_erstanw_arzt','Arzt']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <div style={grid}>
          {([['defi_zeitpunkt','Zeitpunkt 1. Defi'],['defi_rosc','ROSC'],['defi_anzahl','Anzahl'],['defi_energie','Energie (kJ)']] as [string,string][]).map(([n,l]) => vv(n,l,p[n]))}
        </div>
      </PubSection>

      {/* Zugang / Infusion / Medikamente */}
      <PubSection title="Zugang / Infusion / Medikamente" icon={pik(<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>)}>
        <div style={grid}>
          {vv('zugang_art','Zugang Art',p.zugang_art)}
          {vv('zugang_region','Region',p.zugang_region)}
          {vv('zugang_gauge','Gauge',p.zugang_gauge)}
          {vv('inf_art','Infusion',p.inf_art)}
          {vv('inf_menge','Menge (ml)',p.inf_menge)}
        </div>
        {meds.length > 0 && (
          <>
            <div style={{ fontWeight: 700, margin: '1rem 0 .5rem', color: 'var(--text)' }}>Medikamente</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
                <thead><tr>{['Medikament','Dosis','Einheit','Route','Zeit','Hinweis'].map(h => <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {meds.map((m: any, i: number) => (
                    <tr key={i}>
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
        <Pills items={[['rean','CPR durchgeführt'],['rean_tod','Todesfeststellung']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        <div style={{ ...grid, marginTop: '.5rem' }}>
          {vv('rean_tod_zeit','Uhrzeit Todesfeststellung',p.rean_tod_zeit)}
          {vv('rean_beginn','Beginn Reanimation',p.rean_beginn)}
          {vv('rean_ende','Ende Reanimation',p.rean_ende)}
          {vv('rean_defib','Defibrillationen',p.rean_defib)}
        </div>
      </PubSection>

      {/* Übergabe */}
      <PubSection title="Übergabe / Besonderheiten" open icon={pik(<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>)}>
        <div style={grid}>
          {vv('uebergabe_ziel','Übergabe Ziel',p.uebergabe_ziel)}
          {vv('uebergabe_name','Übergabe an (Name)',p.uebergabe_name)}
        </div>
        <div style={{ marginTop: '.5rem' }}>
          <Pills items={[['ev_transportverweigerung','Transportverweigerung'],['ev_nur_untersuchung','Nur Untersuchung'],['ev_zwangseinweisung','Zwangseinweisung'],['ev_transport_sondersignal','Transport mit Sondersignal'],['ev_manv','MANV'],['ev_lna','LNA am Einsatz'],['ev_schwerlast','Schwerlasttransport']].map(([n,l]) => [!!p[n], l] as [boolean,string])} />
        </div>
        <div style={{ marginTop: '.5rem' }}>{vv('bemerkungen','Bemerkungen',p.bemerkungen)}</div>
      </PubSection>

      {/* Unterschrift */}
      <PubSection title="Unterschrift" open icon={pik(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>)}>
        <div style={grid}>
          {vv('ausfueller_name','Name Ausfüller',p.ausfueller_name)}
          {vv('ausfueller_zeit','Datum/Uhrzeit',p.ausfueller_zeit)}
        </div>
        {p.signature && (
          <img src={p.signature} alt="Unterschrift" style={{ maxWidth: 300, marginTop: '.75rem', border: '0.5px solid var(--border)', borderRadius: 8 }} />
        )}
      </PubSection>
    </PubWrap>
  )
}
