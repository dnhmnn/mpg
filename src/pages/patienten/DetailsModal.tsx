import type { Patient, Nacherfassung } from './types'
import { parsePayload, calcGCS, fmtDate, fmtDateTime } from './types'

interface Props {
  doc: Patient | Nacherfassung
  type: 'patient' | 'nach'
  onClose: () => void
}

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '14px' }}>
      <span style={{ fontWeight: 600, minWidth: '140px', flexShrink: 0, opacity: 0.7 }}>{label}:</span>
      <span>{String(value)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.5, marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>{title}</div>
      {children}
    </div>
  )
}

function bools(obj: Record<string, boolean | undefined>, labels: Record<string, string>): string {
  return Object.entries(labels).filter(([k]) => obj[k]).map(([, v]) => v).join(', ') || '—'
}

export default function DetailsModal({ doc, type, onClose }: Props) {
  function printDoc() {
    const w = window.open('', '_blank', 'width=1000,height=750')
    if (!w) return

    if (type === 'patient') {
      const pd = doc as Patient
      const p = parsePayload(pd.payload)
      const gcsTotal = (p.gcs_e || 0) + (p.gcs_v || 0) + (p.gcs_m || 0)
      const meds = p.medications || []
      const verlauf = p.verlauf || []

      // tag-badge helpers: .tag renders as a grey pill; .tag.active = dark filled
      const tag = (on: boolean | undefined, label: string) =>
        `<span class="tag${on?' active':''}">${label}</span>`

      const B = (t:string) => `<div style="font-size:5pt;font-weight:bold;background:#d0d0d0;padding:1pt 3pt;text-transform:uppercase;letter-spacing:.4pt;border-bottom:0.5pt solid #888">${t}</div>`
      const hdr = (sub:string) => `<div style="border:1pt solid #000;display:flex;align-items:center;justify-content:space-between;padding:2pt 6pt;margin-bottom:2pt"><div style="font-size:8pt;font-weight:bold;letter-spacing:.5pt;text-transform:uppercase">NOTFALLEINSATZPROTOKOLL</div><div style="font-size:5pt;color:#444">${sub}</div><div style="font-size:10pt;font-weight:bold;letter-spacing:2pt">MIND</div></div>`
      const blk = (title:string, content:string) => `<div style="border:0.5pt solid #888;margin-bottom:1.5pt;overflow:hidden">${B(title)}${content}</div>`
      const row = (cols:string, cells:string) => `<div style="display:grid;grid-template-columns:${cols};border-top:0.5pt solid #ccc">${cells}</div>`
      const cell = (lbl:string, val:string) => `<div style="padding:1pt 3pt;border-right:0.5pt solid #ccc"><div style="font-size:4pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:0.5pt">${lbl}</div><div style="font-weight:bold;font-size:6pt;min-height:7pt">${val||''}</div></div>`
      const cellL = (lbl:string, val:string) => `<div style="padding:1pt 3pt;border-right:0.5pt solid #ccc"><div style="font-size:4pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:0.5pt">${lbl}</div><div style="font-size:6pt;min-height:7pt;white-space:pre-wrap">${val||''}</div></div>`
      const naca = ['0','I','II','III','IV','V','VI','VII'].map(v=>`<span class="tag naca${p.naca===v?' active':''}">${v}</span>`).join('')
      const cr = (items:[boolean|undefined,string][]) => `<div style="display:flex;flex-wrap:wrap;gap:1pt;padding:1.5pt 3pt">${items.map(([on,l])=>tag(on,l)).join('')}</div>`
      const catRow = (cat:string, items:[boolean|undefined,string][]) => `<div style="display:flex;flex-wrap:wrap;gap:0.5pt;padding:0.5pt 3pt;border-top:0.5pt solid #e0e0e0;align-items:center"><span style="font-size:3.5pt;font-weight:bold;color:#444;text-transform:uppercase;min-width:30pt;flex-shrink:0">${cat}</span>${items.map(([on,l])=>tag(on,l)).join('')}</div>`
      const vitG = [['RR syst.',p.rr_sys],['RR diast.',p.rr_dia],['HF /min',p.hf],['SpO₂ %',p.spo2],['AF /min',p.af],['Temp °C',p.temp],['BZ mg/dl',p.bz_mg],['etCO₂',p.etco2],['Schmerz NRS',p.schmerz]].map(([l,v])=>`<div style="text-align:center;border-right:0.5pt solid #ccc;padding:1pt 0.5pt"><div style="font-size:4pt;color:#666">${l}</div><div style="font-size:8pt;font-weight:bold">${v||'—'}</div></div>`).join('')

      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>MIND Notfalleinsatzprotokoll</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,Helvetica,sans-serif;font-size:6pt;color:#000;background:#fff}
        .pg{padding:3.5mm 5mm;max-width:210mm;margin:0 auto}
        .pb{page-break-before:always}
        table{width:100%;border-collapse:collapse}
        th{background:#d0d0d0;font-size:4pt;text-transform:uppercase;padding:1pt 2pt;border:0.5pt solid #888;letter-spacing:.3pt}
        td{padding:1pt 2pt;border:0.5pt solid #ccc;font-size:6pt}
        .tag{display:inline-block;font-size:4pt;padding:0.5pt 2pt;border:0.6pt solid #888;border-radius:2pt;margin:0.5pt 1pt 0.5pt 0;background:#f0f0f0;color:#333}
        .tag.active{background:#222;color:#fff;border-color:#222}
        .tag.naca{min-width:12pt;text-align:center;font-weight:bold}
        .pbtn{position:fixed;bottom:20px;right:20px;background:#222;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer}
        @media print{.pbtn{display:none}}
      </style>
      </head><body>

      <div class="pg">
      ${hdr('Erstellt: '+new Date().toLocaleString('de-DE'))}

      ${blk('Einsatzdaten',
        row('1fr 1.2fr 1fr 1fr 1fr 1fr',
          cell('Einsatz-Nr.',p.einsatz_nr||'')+cell('Auftrags-Nr. (ILS)',p.auftrags_nr||'')+cell('Datum',new Date().toLocaleDateString('de-DE'))+cell('Alarmzeit',p.zeit_einsatz||'')+cell('Eintreffen',p.zeit_eintreffen||'')+cell('Transportbeginn',p.zeit_transport||'')
        )+row('1fr 1fr 1fr 2fr',
          cell('Übergabe',p.zeit_uebergabe||'')+cell('Rufname',p.rufname||'')+cell('Fahrzeug / Einheit',p.fahrzeug||'')+cell('Einsatzart / Stichwort',p.einsatz_art||'')
        )+row('2fr 1fr',
          cell('Einsatzort / Adresse',p.einsatz_adresse||'')+cell('Transportziel',p.transport_ziel||'')
        )+row('1fr 1fr 1fr 1fr',
          cell('Teamführer',p.mannschaft_tf||'')+cell('Mannschaft 1',p.mannschaft_1||'')+cell('Mannschaft 2',p.mannschaft_2||'')+cell('Mannschaft 3',p.mannschaft_3||'')
        )
      )}

      ${blk('Patientenstammdaten',
        row('2fr 1fr .6fr',
          cell('Name, Vorname',[p.name,p.vorname].filter(Boolean).join(', '))+cell('Geburtsdatum',p.gebdatum||'')+cell('Alter',p.alter||'')
        )+row('2fr 1fr 1fr',
          cell('Straße',p.strasse||'')+cell('PLZ / Ort',p.plz_ort||'')+cell('Telefon',p.telefon||p.mobil||'')
        )+row('1.5fr 1fr 1.5fr 1.5fr',
          cell('Krankenkasse',p.kasse||'')+cell('Vers.-Nr.',p.versnr||'')+cell('Hausarzt',p.hausarzt||'')+cell('Angehöriger / Kontakt',p.angehoeriger||'')
        )
      )}

      ${blk('Notfallgeschehen / Anamnese',
        row('1fr',cellL('Notfallgeschehen',p.notfallgeschehen||''))+
        row('1fr',cellL('Verlaufsbeschreibung',p.verlaufsbeschreibung||''))+
        row('1fr 1fr',cellL('Vorerkrankungen',p.vorerkrankungen||'')+cellL('Dauermedikation Patient',p.vormedikation_patient||''))+
        row('1fr',cell('Allergien / Unverträglichkeiten',p.allergien||'Keine bekannt'))
      )}

      <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:1pt;margin-bottom:2pt">
        ${blk('NACA-Score',`<div style="padding:1.5pt 3pt;display:flex;gap:1pt">${naca}</div>`)}
        ${blk('Bewusstsein',cr([[p.bewusstsein==='nicht beurteilbar','Nicht beurteilbar'],[p.bewusstsein==='wach','Wach'],[p.bewusstsein==='getrübt','Getrübt'],[p.bewusstsein==='bewusstlos','Bewusstlos'],[p.bewusstsein==='reaktionslos','Reaktionslos'],[p.bewusstsein==='auf Ansprache','Auf Ansprache'],[p.bewusstsein==='Reaktion auf Schmerz','Reaktion auf Schmerz'],[p.bewusstsein==='analgosediert / Narkose','Analgosediert / Narkose']]))}
        ${blk('Neurologie',
          `<div style="padding:1pt 3pt;display:flex;flex-wrap:wrap;gap:1pt;align-items:center">${tag(p.neu_unauff,'Unauffällig')}${tag(p.neu_sprachstoerung,'Sprachstörung')}${tag(p.neu_demenz,'Demenz')}${tag(p.neu_meningismus,'Meningismus')}${tag(p.neu_seitenzeichen,'Seitenzeichen')}${tag(p.neu_kein_laecheln,'Kein Lächeln')}${tag(p.neu_sehstoerung,'Sehstörung')}${tag(p.neu_querschnitt,'Querschnitt')}${tag(p.neu_babinski,'Babinski')}${tag(p.neu_vorbestehend,'Vorbestehende Defizite')}${p.neu_sonstige?`<span style="font-size:5pt;margin-left:4pt">${p.neu_sonstige}</span>`:''}<span style="font-size:5pt;margin-left:6pt;color:#666">Zeit: <b>${p.neu_zeit||'—'}</b></span></div>`+
          `<div style="padding:1pt 3pt;border-top:0.5pt solid #ccc"><div style="font-size:4pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">Extremitätenbewegung</div><div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:1pt;font-size:5pt"><div></div><div style="text-align:center;font-weight:bold">Re</div><div style="text-align:center;font-weight:bold">Li</div><div>Arm</div><div style="text-align:center">${p.ext_r_arm||'—'}</div><div style="text-align:center">${p.ext_l_arm||'—'}</div><div>Bein</div><div style="text-align:center">${p.ext_r_bein||'—'}</div><div style="text-align:center">${p.ext_l_bein||'—'}</div></div></div>`
        )}
      </div>

      <div style="display:grid;grid-template-columns:1fr 88pt;gap:1pt;margin-bottom:2pt">
        <div>
          ${blk('Vitalzeichen',`<div style="display:grid;grid-template-columns:repeat(9,1fr)">${vitG}</div>`+
            row('1fr 1fr',
              `<div style="padding:1.5pt 3pt;border-right:0.5pt solid #ccc"><div style="font-size:5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">Pupillen rechts</div><div style="font-size:6pt"><b>${p.pw_r||'—'}</b>${p.pw_r_entrundet?' entr.':''} · LR: ${p.lr_r||'—'}</div></div>`+
              `<div style="padding:1.5pt 3pt"><div style="font-size:5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">Pupillen links</div><div style="font-size:6pt"><b>${p.pw_l||'—'}</b>${p.pw_l_entrundet?' entr.':''} · LR: ${p.lr_l||'—'}</div></div>`
            )+
            `<div style="border-top:0.5pt solid #ccc;padding:1.5pt 3pt"><div style="font-size:5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">O₂-Gabe</div><div style="display:flex;flex-wrap:wrap;gap:1pt">${tag(p.o2,'O₂')}${tag(p.o2_nasal,'Nasal')}${tag(p.o2_maske,'Maske')}${tag(p.o2_reservoir,'Reservoir')}${p.o2_flow?`<span style="font-size:5pt;align-self:center">${p.o2_flow} l/min</span>`:''}</div></div>`
          )}
        </div>
        <div>
          ${blk('GCS',`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 34pt">`+
            [['Augen (E)',p.gcs_e],['Verbal (V)',p.gcs_v],['Motorik (M)',p.gcs_m]].map(([l,v])=>`<div style="text-align:center;border-right:0.5pt solid #ccc;padding:2pt 1pt"><div style="font-size:5pt;color:#666">${l}</div><div style="font-size:8pt;font-weight:bold">${v||'—'}</div></div>`).join('')+
            `<div style="text-align:center;padding:2pt 1pt;background:#efefef"><div style="font-size:5pt;color:#666">Σ</div><div style="font-size:10pt;font-weight:bold">${gcsTotal||'—'}</div></div></div>`
          )}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1pt;margin-bottom:2pt">
        <div>
          ${blk('EKG-Befund / Rhythmus',cr([[p.sr,'Sinusrhythmus'],[p.stemi,'STEMI'],[p.vf,'Kammerflimmern'],[p.asystole,'Asystolie']])+
            (p.ekg_standort||p.ekg_persnr?`<div style="padding:1pt 5pt 3pt;font-size:5pt">EKG: ${p.ekg_standort||''} ${p.ekg_persnr?'· Pers.-Nr. '+p.ekg_persnr:''}</div>`:'')
          )}
          ${blk('Atmung',cr([[p.atm_apnoe,'Apnoe'],[p.atm_stridor,'Stridor'],[p.atm_dyspnoe,'Dyspnoe'],[p.atm_zyanose,'Zyanose']]))}
        </div>
        <div>
          ${blk('Haut',cr([[p.haut_unauff,'Unauffällig'],[p.haut_falten,'Fältchentest pos.'],[p.haut_oedeme,'Ödeme'],[p.haut_dekubitus,'Dekubitus'],[p.haut_kaltschweissig,'Kaltschweißig'],[p.haut_exanthem,'Exanthem']]))}
          ${blk('Psyche',cr([[p.psy_erregt,'Erregt'],[p.psy_aggr,'Aggressiv'],[p.psy_verlangsamt,'Verlangsamt'],[p.psy_depressiv,'Depressiv'],[p.psy_aengstlich,'Ängstlich'],[p.psy_euphorisch,'Euphorisch'],[p.psy_wahnhaft,'Wahnhaft'],[p.psy_verwirrt,'Verwirrt'],[p.psy_suizidal,'Suizidal'],[p.psy_motor_unruhig,'Motor. unruhig']]))}
        </div>
      </div>

      ${blk('Erstdiagnose / Verdachtsdiagnose',
        (p.erstdiagnose_text?`<div style="padding:1pt 3pt;font-size:6pt;font-weight:bold">${p.erstdiagnose_text}</div>`:'')+
        cr([[p.e_keine,'Keine Erkrankung/Verletzung']])+
        catRow('ZNS',[[p.e_zns_schlaganfall,'Schlaganfall'],[p.e_zns_tia,'TIA'],[p.e_zns_blutung,'Intrakr. Blutung'],[p.e_zns_lyse,'Lyse'],[p.e_zns_krampf,'Krampfanfall'],[p.e_zns_status_epilept,'Status epilept.'],[p.e_zns_meningitis,'Meningitis'],[p.e_zns_synkope,'Synkope'],[p.e_zns_sonstige,'Sonstige']])+
        catRow('Herz-Kreislauf',[[p.e_hk_acs,'ACS'],[p.e_hk_stemi_vw,'STEMI VW'],[p.e_hk_stemi_hw,'STEMI HW'],[p.e_hk_tachy,'Tachy'],[p.e_hk_brady,'Brady'],[p.e_hk_embolie,'Lungenembolie'],[p.e_hk_ortho,'Orthostatisch'],[p.e_hk_insuff,'Herzinsuff./Lungenödem'],[p.e_hk_hypert,'Hypert. Notfall'],[p.e_hk_kard_schock,'Kard. Schock'],[p.e_hk_schrittmacher,'SM/ICD-Fehlfunktion'],[p.e_hk_sonstige,'Sonstige']])+
        catRow('Atmung',[[p.e_atm_asthma,'Asthma'],[p.e_atm_status_asthm,'Status asthm.'],[p.e_atm_copd,'COPD'],[p.e_atm_pneumonie,'Pneumonie'],[p.e_atm_hypervent,'Hyperventilation'],[p.e_atm_aspiration,'Aspiration'],[p.e_atm_haemoptysen,'Hämoptysen'],[p.e_atm_sonstige,'Sonstige']])+
        catRow('Abdomen',[[p.e_abd_akut,'Akutes Abdomen'],[p.e_abd_gi_ob,'GI-Blutung ob.'],[p.e_abd_gi_un,'GI-Blutung un.'],[p.e_abd_kolik,'Kolik'],[p.e_abd_enteritis,'Enteritis'],[p.e_abd_sonstige,'Sonstige']])+
        catRow('Psychiatrie',[[p.e_psy_psychose,'Psychose/Manie'],[p.e_psy_angst,'Angst/Depression'],[p.e_psy_intox_akzid,'Intox. akzid.'],[p.e_psy_intox_alkohol,'Intox. Alkohol'],[p.e_psy_intox_drogen,'Intox. Drogen'],[p.e_psy_intox_medis,'Intox. Medis'],[p.e_psy_intox_sonstige,'Intox. Sonstige'],[p.e_psy_entzug,'Entzug/Delir'],[p.e_psy_suizid,'Suizid(versuch)'],[p.e_psy_krise,'Psych. Krise'],[p.e_psy_sonstige,'Sonstige']])+
        catRow('Stoffwechsel',[[p.e_stw_hypo,'Hypoglykämie'],[p.e_stw_hyper,'Hyperglykämie'],[p.e_stw_exsiccose,'Exsiccose'],[p.e_stw_uraemie,'Urämie/ANV'],[p.e_stw_sonstige,'Sonstige']])+
        catRow('Pädiatrie',[[p.e_paed_fieberkrampf,'Fieberkrampf'],[p.e_paed_pseudokrupp,'Pseudokrupp'],[p.e_paed_sids,'SIDS/Near-SIDS']])+
        catRow('Gynäkologie',[[p.e_gyn_schwanger,'Schwangerschaft'],[p.e_gyn_geburt,'Droh./präklin. Geburt'],[p.e_gyn_eklampsie,'(Prä-)Eklampsie'],[p.e_gyn_blutung,'Vag. Blutung'],[p.e_gyn_sonstige,'Sonstige']])+
        catRow('Weitere',[[p.e_anaphylaxie,'Anaphylaxie'],[p.e_hitze,'Hitzeerschöpfung'],[p.e_unterkuehlung,'Unterkühlung'],[p.e_sepsis,'Sepsis/sept. Schock'],[p.e_influenza,'Influenza'],[p.e_hepatitis_hiv,'Hepatitis/HIV'],[p.e_lumbago,'Akutes Lumbago'],[p.e_epistaxis,'Epistaxis'],[p.e_soziales,'Soziales Problem'],[p.e_behandlungskompl,'Behandlungskompl.'],[p.e_weitere_sonstige,'Sonstige']])
      )}
      </div>

      <div class="pg pb">
      ${hdr('Seite 2 · '+([p.name,p.vorname].filter(Boolean).join(', ')||'—')+' · geb. '+(p.gebdatum||'—'))}

      ${(()=>{
        const cols = Math.max(14, verlauf.length)
        const W = 560, H = 120
        const cw = W / cols
        const sy = (v: number) => Math.max(0, Math.min(H, 220 - Math.max(40, Math.min(220, v))))
        const scaleVals = [220,200,180,160,140,120,100,80,60,40]
        const hLines = scaleVals.map(v=>{
          const y = sy(v)
          const bold = v===200||v===100
          return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${bold?'#555':'#ccc'}" stroke-width="${bold?1:0.5}"/>`
        }).join('')
        const vLines = Array.from({length:cols+1},(_,i)=>
          `<line x1="${i*cw}" y1="0" x2="${i*cw}" y2="${H}" stroke="#ccc" stroke-width="0.5"/>`
        ).join('')
        const shading = Array.from({length:cols},(_,i)=>
          i%2===0?`<rect x="${i*cw}" y="0" width="${cw}" height="${H}" fill="#f5f5f5"/>`:'').join('')
        const dots = (key:'rr_sys'|'rr_dia'|'hf', fill:string, stroke:string, r:number) =>
          verlauf.map((vr,i)=>{
            const n = Number(vr[key]); if(!vr[key]||isNaN(n)) return ''
            return `<circle cx="${(i+0.5)*cw}" cy="${sy(n)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`
          }).join('')
        const lines = (key:'rr_sys'|'rr_dia'|'hf', stroke:string) => {
          const pts = verlauf.map((vr,i)=>{const n=Number(vr[key]);return vr[key]&&!isNaN(n)?`${(i+0.5)*cw},${sy(n)}`:null}).filter(Boolean)
          if(pts.length<2) return ''
          return `<polyline points="${pts.join(' ')}" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`
        }
        const scaleLabels = scaleVals.map(v=>`<text x="30" y="${sy(v)+3}" text-anchor="end" font-size="6" fill="#555" font-weight="${v===200||v===100?'bold':'normal'}">${v===220?'≥220':v===40?'≤40':v}</text>`).join('')
        const zeitRow = Array.from({length:cols},(_,i)=>`<div style="border-right:0.5pt solid #ccc;padding:1pt;font-size:5pt;text-align:center;overflow:hidden;min-width:0">${verlauf[i]?.zeit||''}</div>`).join('')
        const bottomCells = (key:'spo2'|'etco2'|'schmerz') => Array.from({length:cols},(_,i)=>`<div style="border-right:0.5pt solid #ccc;padding:1pt;font-size:5pt;text-align:center">${verlauf[i]?.[key]||''}</div>`).join('')
        const legend = `<text x="2" y="9" font-size="6" fill="#555">● RR sys</text><text x="40" y="9" font-size="6" fill="#555">○ RR dia</text><text x="80" y="9" font-size="6" fill="#1c3a5e">○ Puls</text>`
        return `<div style="border:0.5pt solid #888;margin-bottom:2pt;overflow:hidden">
          <div style="font-size:5pt;font-weight:bold;background:#d0d0d0;padding:1pt 3pt;text-transform:uppercase;letter-spacing:.5pt;border-bottom:0.5pt solid #888">Verlaufsbeschreibung</div>
          <div style="display:flex">
            <div style="width:36pt;flex-shrink:0;border-right:0.5pt solid #888;font-size:5pt">
              <div style="height:9pt;border-bottom:0.5pt solid #ccc;padding:1pt 3pt;display:flex;align-items:center">Zeit</div>
              <div style="position:relative;height:${H}pt;border-bottom:0.5pt solid #ccc">
                <svg viewBox="0 0 34 ${H}" width="35pt" height="${H}pt" style="display:block;overflow:visible">${scaleLabels}</svg>
              </div>
              <div style="height:8pt;border-bottom:0.5pt solid #ccc;padding:1pt 3pt;display:flex;align-items:center">O₂ [l/min]</div>
              <div style="height:8pt;border-bottom:0.5pt solid #ccc;padding:1pt 3pt;display:flex;align-items:center">SpO₂ [%]</div>
              <div style="height:8pt;padding:1pt 3pt;display:flex;align-items:center">etCO₂ [mmHg]</div>
            </div>
            <div style="flex:1;min-width:0;overflow:hidden">
              <div style="height:9pt;border-bottom:0.5pt solid #ccc;display:grid;grid-template-columns:repeat(${cols},1fr)">${zeitRow}</div>
              <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}pt" style="display:block;border-bottom:0.5pt solid #ccc">
                ${shading}${hLines}${vLines}
                ${lines('rr_sys','#c0392b')}${lines('rr_dia','#e74c3c')}${lines('hf','#1c3a5e')}
                ${dots('rr_sys','#c0392b','#c0392b',3)}
                ${dots('rr_dia','none','#c0392b',3)}
                ${dots('hf','none','#1c3a5e',2.5)}
                <svg x="0" y="0" width="${W}" height="12"><rect width="${W}" height="12" fill="rgba(255,255,255,0.7)"/>${legend}</svg>
              </svg>
              <div style="height:8pt;border-bottom:0.5pt solid #ccc;display:grid;grid-template-columns:repeat(${cols},1fr)">${bottomCells('o2')}</div>
              <div style="height:8pt;border-bottom:0.5pt solid #ccc;display:grid;grid-template-columns:repeat(${cols},1fr)">${bottomCells('spo2')}</div>
              <div style="height:8pt;display:grid;grid-template-columns:repeat(${cols},1fr)">${bottomCells('etco2')}</div>
            </div>
          </div>
        </div>`
      })()}

      ${blk('Verletzungen / Trauma',
        cr([[p.v_keine,'Keine Verletzung']])+
        catRow('Körper',[[!!p.v_sht,p.v_sht?'SHT ('+p.v_sht+')':'SHT'],[!!p.v_gesicht,p.v_gesicht?'Gesicht ('+p.v_gesicht+')':'Gesicht'],[!!p.v_hals,p.v_hals?'Hals ('+p.v_hals+')':'Hals'],[!!p.v_thorax,p.v_thorax?'Thorax ('+p.v_thorax+')':'Thorax'],[!!p.v_abdomen,p.v_abdomen?'Abdomen ('+p.v_abdomen+')':'Abdomen'],[!!p.v_ws,p.v_ws?'Wirbelsäule ('+p.v_ws+')':'Wirbelsäule'],[!!p.v_becken,p.v_becken?'Becken ('+p.v_becken+')':'Becken'],[!!p.v_obext,p.v_obext?'Obere Ext. ('+p.v_obext+')':'Obere Ext.'],[!!p.v_untext,p.v_untext?'Untere Ext. ('+p.v_untext+')':'Untere Ext.'],[!!p.v_weich,p.v_weich?'Weichteile ('+p.v_weich+')':'Weichteile']])+
        catRow('Besonder.',[[p.v_verbrennung,'Verbrennung'+(p.v_verbrennung_grad?' Grad '+p.v_verbrennung_grad:'')+(p.v_verbrennung_pct?' '+p.v_verbrennung_pct+'%':'')],[p.v_veraetzung,'Verätzung'],[p.v_verschuettung,'Verschüttung'],[p.v_einklemmung,'Einklemmung'],[p.v_inhalation,'Inhalationstrauma'],[p.v_elektrounfall,'Elektrounfall'],[p.v_ertrinken,'Beinahe-Ertrinken'],[p.v_tauchunfall,'Tauchunfall'],[p.v_haemo_schock,'Hämorr. Schock']])+
        catRow('Mechanismus',[[p.v_trauma_stumpf,'Trauma stumpf'],[p.v_trauma_penetr,'Trauma penetr.'],[p.v_sturz_eben,'Sturz ebenerdig'],[p.v_sturz_unter3m,'Sturz <3m'],[p.v_sturz_ueber3m,'Sturz >3m']])+
        catRow('Verkehr',[[p.v_vt_fussgaenger,'Fußgänger'],[p.v_vt_escooter,'E-Scooter'],[p.v_vt_fahrrad,'Fahrrad'],[p.v_vt_ebike,'E-Bike'],[p.v_vt_motorrad,'Motorrad/Sozius'],[p.v_vt_pkw,'PKW Insasse'],[p.v_vt_lkw,'LKW Insasse'],[p.v_vt_bus,'Bus Insasse']])+
        catRow('Gewalt',[[p.v_gew_schlag,'Schlag'],[p.v_gew_schuss,'Schuss'],[p.v_gew_stich,'Stich'],[p.v_gew_sonstige,'Gewalt Sonstige'],[p.v_gew_verbrechen,'Gewaltverbrechen']])+
        (p.v_sonstige?`<div style="padding:1pt 3pt;font-size:5pt">${p.v_sonstige}</div>`:'')+
        (p.verletz_text?`<div style="padding:1pt 3pt;font-size:5pt;border-top:0.5pt solid #ccc;white-space:pre-wrap">${p.verletz_text}</div>`:'')
      )}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1pt;margin-bottom:2pt">
        <div>
          ${blk('Atemwegsmanagement',cr([[p.awm_freihalten,'Freihalten'],[p.awm_absaugung,'Absaugung'],[p.awm_opa,'OPA/Guedel'],[p.awm_npa,'NPA/Wendl'],[p.awm_lma,'LMA/SGA'],[p.awm_intubation,'Intubation (OTI)']]))}
          ${blk('Lagerung',cr([[p.lag_flach,'Flachlagerung'],[p.lag_schock,'Schocklagerung'],[p.lag_ok_hoch,'OK hoch'],[p.lag_ssl,'Stabile Seitenlage'],[p.lag_sitzend,'Sitzend'],[p.lag_haengend,'Hängeposition']]))}
          ${blk('Immobilisation',cr([[p.immo_hws,'HWS-Orthese'],[p.immo_spineboard,'Spineboard'],[p.immo_vakuum,'Vakuummatratze']]))}
        </div>
        <div>
          ${blk('Reanimation',cr([[p.rean,'CPR durchgeführt']])+
            (p.rean?row('1fr 1fr 1fr',cell('Beginn',p.rean_beginn||'')+cell('Ende',p.rean_ende||'')+cell('Defibrillationen',p.rean_defib||'')):'')
          )}
          ${blk('Venöser Zugang',row('1fr 1fr 1fr',cell('Art',p.zugang_art||'')+cell('Gauge',p.zugang_gauge||'')+cell('Region',p.zugang_region||'')))}
          ${blk('Infusion',row('1fr 1fr',cell('Art',p.inf_art||'')+cell('Menge (ml)',p.inf_menge||'')))}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1pt;margin-bottom:2pt">
        ${blk('Beatmung',cr([[p.beat_manuell,'Manuell'],[p.beat_maschinell,'Maschinell'],[p.beat_niv,'NIV'],[p.beat_notfallnarkose,'Notfallnarkose']])+
          row('1fr 1fr 1fr 1fr 1fr',cell('FiO₂',p.beat_fio2||'')+cell('AF /min',p.beat_af||'')+cell('PEEP mbar',p.beat_peep||'')+cell('Pmax mbar',p.beat_pmax||'')+cell('AMV l/min',p.beat_amv||''))
        )}
        ${blk('Defibrillation',cr([[p.defi_aed,'AED'],[p.defi_defi,'Defi'],[p.defi_mono,'Monophasisch'],[p.defi_bi,'Biphasisch']])+
          `<div style="padding:1pt 5pt 2pt;font-size:5pt;color:#555">Erstanwendung: `+[p.defi_erstanw_laie&&'Laie',p.defi_erstanw_fr&&'First Resp.',p.defi_erstanw_rd&&'Rettungsdienst',p.defi_erstanw_arzt&&'Arzt'].filter(Boolean).join(', ')+`</div>`+
          row('1fr 1fr 1fr 1fr',cell('Zeitpunkt 1. Defi',p.defi_zeitpunkt||'')+cell('ROSC',p.defi_rosc||'')+cell('Anzahl',p.defi_anzahl||'')+cell('Energie (kJ)',p.defi_energie||''))
        )}
      </div>

      ${blk('Übergabe / Besonderheiten',
        row('1fr 1fr',cell('Übergabe Ziel',p.uebergabe_ziel||'')+cell('Übergabe an (Name)',p.uebergabe_name||''))+
        cr([[p.ev_transportverweigerung,'Transportverweigerung'],[p.ev_nur_untersuchung,'Nur Untersuchung/Behandlung'],[p.ev_zwangseinweisung,'Zwangseinweisung'],[p.ev_transport_sondersignal,'Transport mit Sondersignal'],[p.ev_manv,'MANV'],[p.ev_lna,'LNA am Einsatz'],[p.ev_schwerlast,'Schwerlasttransport']])+
        `<div style="padding:1.5pt 3pt;border-top:0.5pt solid #ccc"><div style="font-size:5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">Bemerkungen</div><div style="font-size:5pt;min-height:10pt;white-space:pre-wrap">${p.bemerkungen||''}</div></div>`
      )}

      ${blk('Medikamente / Therapie',`<div style="padding:1.5pt 3pt"><table><thead><tr><th>Zeit</th><th>Medikament</th><th>Dosis</th><th>Einheit</th><th>Applikationsweg</th><th>Hinweis</th></tr></thead><tbody>${meds.length>0?meds.map(m=>`<tr><td>${m.time||''}</td><td>${m.name||''}</td><td>${m.dose||''}</td><td>${m.unit||''}</td><td>${m.route||''}</td><td>${m.note||''}</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:#aaa;font-style:italic">—</td></tr>'}</tbody></table></div>`)}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1pt;margin-top:2pt">
        ${blk('Unterschrift Patient / Einwilligung',p.signature?`<div style="padding:2pt"><img src="${p.signature}" style="max-height:32pt"></div>`:'<div style="min-height:28pt;border-top:0.5pt solid #ccc"></div>')}
        ${blk('Gegenzeichnung / Stempel',pd.admin_name?
          row('1fr 1fr',cell('Name',pd.admin_name)+cell('Datum',fmtDateTime(pd.admin_datum)))+(pd.admin_unterschrift?`<div style="padding:2pt"><img src="${pd.admin_unterschrift}" style="max-height:32pt"></div>`:'<div style="min-height:14pt"></div>'):
          '<div style="min-height:28pt;border-top:0.5pt solid #ccc"></div>'
        )}
      </div>
      </div>

      <button class="pbtn" onclick="window.print()">Drucken / PDF</button>
      </body></html>`

      w.document.write(html)
      w.document.close()
      return
    }

    // Nacherfassung
    const nd = doc as Nacherfassung
    const body = `
      <h1 style="font-size:18px;margin-bottom:16px">Nacherfassung</h1>
      <table>
        <tr><td>Stichwort</td><td>${nd.stichwort||'—'}</td><td>Kategorie</td><td>${nd.kategorie||'—'}</td></tr>
        <tr><td>Alarmzeit</td><td>${nd.datum_alarmzeit||'—'}</td><td>Einsatzende</td><td>${nd.datum_einsatzende||'—'}</td></tr>
        <tr><td>Adresse</td><td colspan="3">${nd.adresse||'—'}</td></tr>
        <tr><td>Meldebild</td><td colspan="3">${nd.meldebild||'—'}</td></tr>
      </table>
      <h2>Sachverhalt</h2><p>${nd.sachverhalt||'—'}</p>
      <h2>Nacherfasst von</h2>
      <p>${nd.nacherfasst_von_name||'—'} (${nd.nacherfasst_von_qualifikation||'—'}) — ${fmtDateTime(nd.nacherfasst_datum)}</p>
      ${nd.nacherfasst_unterschrift?`<img src="${nd.nacherfasst_unterschrift}" style="max-width:300px;border:1px solid #ccc">`:''}
    `
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nacherfassung</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000}
      h1,h2{margin:12px 0 6px}h2{font-size:13px;border-bottom:1px solid #ccc;padding-bottom:2px}
      table{border-collapse:collapse;width:100%;margin-bottom:8px}
      td{padding:3px 8px;border:1px solid #ddd;vertical-align:top}td:first-child{font-weight:bold;width:120px;background:#f5f5f5}
      @media print{button{display:none}}</style></head>
      <body>${body}<br><button onclick="window.print()" style="padding:8px 16px;margin-top:16px">Drucken / PDF</button></body></html>`)
    w.document.close()
  }

  const isPatient = type === 'patient'
  const pd = isPatient ? (doc as Patient) : null
  const p = pd ? parsePayload(pd.payload) : null
  const nd = !isPatient ? (doc as Nacherfassung) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '18px 18px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '17px' }}>{isPatient ? 'Patientendokumentation' : 'Nacherfassung'}</h3>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 8px' }}>

          {isPatient && p && (
            <>
              <Section title="Einsatzdaten">
                <Row label="Einsatz-Nr." value={p.einsatz_nr} />
                <Row label="Auftrags-Nr." value={p.auftrags_nr} />
                <Row label="Rufname" value={p.rufname} />
                <Row label="Fahrzeug" value={p.fahrzeug} />
                <Row label="Zeit Einsatz" value={p.zeit_einsatz} />
                <Row label="Einsatzart" value={p.einsatz_art} />
              </Section>
              <Section title="Patient">
                <Row label="Name" value={[p.name, p.vorname].filter(Boolean).join(' ')} />
                <Row label="Geburtsdatum" value={p.gebdatum} />
                <Row label="Alter" value={p.alter} />
                <Row label="Krankenkasse" value={p.kasse} />
                <Row label="Vers.-Nr." value={p.versnr} />
                <Row label="Hausarzt" value={p.hausarzt} />
                <Row label="Angehöriger" value={p.angehoeriger} />
              </Section>
              <Section title="Vitalparameter">
                <Row label="RR" value={p.rr_sys && p.rr_dia ? `${p.rr_sys}/${p.rr_dia} mmHg` : undefined} />
                <Row label="HF" value={p.hf ? `${p.hf} /min` : undefined} />
                <Row label="SpO2" value={p.spo2 ? `${p.spo2} %` : undefined} />
                <Row label="AF" value={p.af ? `${p.af} /min` : undefined} />
                <Row label="Temp" value={p.temp ? `${p.temp} °C` : undefined} />
                <Row label="BZ" value={p.bz_mg ? `${p.bz_mg} mg/dl` : undefined} />
                <Row label="GCS" value={calcGCS(p)} />
                <Row label="Schmerz" value={p.schmerz ? `${p.schmerz}/10` : undefined} />
              </Section>
              <Section title="Notfallgeschehen">
                <p style={{ fontSize: '14px', margin: 0 }}>{p.notfallgeschehen || '—'}</p>
              </Section>
              {(p.medications || []).length > 0 && (
                <Section title="Medikamente">
                  {(p.medications || []).map((m, i) => (
                    <div key={i} style={{ fontSize: '14px', marginBottom: '4px' }}>
                      {m.name} {m.dose} {m.unit} ({m.route}) {m.time && `— ${m.time}`}
                    </div>
                  ))}
                </Section>
              )}
              {pd?.admin_name && (
                <Section title="Gegenzeichnung">
                  <Row label="MPG-Beauftragter" value={pd.admin_name} />
                  <Row label="Datum" value={fmtDateTime(pd.admin_datum)} />
                  {pd.admin_unterschrift && (
                    <img src={pd.admin_unterschrift} alt="Unterschrift" style={{ maxWidth: '280px', marginTop: '8px', border: '1px solid var(--border)', borderRadius: '6px' }} />
                  )}
                </Section>
              )}
            </>
          )}

          {!isPatient && nd && (
            <>
              <Section title="Einsatz">
                <Row label="Stichwort" value={nd.stichwort} />
                <Row label="Kategorie" value={nd.kategorie} />
                <Row label="Alarmzeit" value={nd.datum_alarmzeit} />
                <Row label="Einsatzende" value={nd.datum_einsatzende} />
                <Row label="ILS-Nummer" value={nd.einsatznummer_ils} />
                <Row label="Adresse" value={nd.adresse} />
                <Row label="Meldebild" value={nd.meldebild} />
              </Section>
              <Section title="Sachverhalt">
                <p style={{ fontSize: '14px', margin: 0 }}>{nd.sachverhalt || '—'}</p>
              </Section>
              <Section title="Nacherfasst von">
                <Row label="Name" value={nd.nacherfasst_von_name} />
                <Row label="Qualifikation" value={nd.nacherfasst_von_qualifikation} />
                <Row label="Datum" value={fmtDateTime(nd.nacherfasst_datum)} />
                {nd.nacherfasst_unterschrift && (
                  <img src={nd.nacherfasst_unterschrift} alt="Unterschrift" style={{ maxWidth: '280px', marginTop: '8px', border: '1px solid var(--border)', borderRadius: '6px' }} />
                )}
              </Section>
            </>
          )}

        </div>
        <div style={{ display: 'flex', gap: '10px', padding: '12px 20px calc(16px + env(safe-area-inset-bottom))', flexShrink: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', color: 'var(--text)', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>Schließen</button>
          <button onClick={printDoc} style={{ flex: 1, padding: '12px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>PDF erstellen</button>
        </div>
      </div>
    </div>
  )
}
