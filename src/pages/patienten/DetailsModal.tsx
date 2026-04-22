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

      const B = (t:string) => `<div style="font-size:6.5pt;font-weight:bold;background:#d0d0d0;padding:2pt 5pt;text-transform:uppercase;letter-spacing:.4pt;border-bottom:0.5pt solid #888">${t}</div>`
      const hdr = (sub:string) => `<div style="border:1pt solid #000;display:flex;align-items:center;justify-content:space-between;padding:5pt 10pt;margin-bottom:4pt"><div style="font-size:13pt;font-weight:bold;letter-spacing:.5pt;text-transform:uppercase">NOTFALLEINSATZPROTOKOLL</div><div style="font-size:6pt;color:#444">${sub}</div><div style="font-size:17pt;font-weight:bold;letter-spacing:2pt">MIND</div></div>`
      const blk = (title:string, content:string) => `<div style="border:0.5pt solid #888;margin-bottom:4pt;overflow:hidden">${B(title)}${content}</div>`
      const row = (cols:string, cells:string) => `<div style="display:grid;grid-template-columns:${cols};border-top:0.5pt solid #ccc">${cells}</div>`
      const cell = (lbl:string, val:string) => `<div style="padding:2.5pt 5pt;border-right:0.5pt solid #ccc"><div style="font-size:5.5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">${lbl}</div><div style="font-weight:bold;font-size:8.5pt;min-height:9pt">${val||''}</div></div>`
      const cellL = (lbl:string, val:string) => `<div style="padding:2.5pt 5pt;border-right:0.5pt solid #ccc"><div style="font-size:5.5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">${lbl}</div><div style="font-size:8.5pt;min-height:12pt;white-space:pre-wrap">${val||''}</div></div>`
      // NACA boxes: dark-filled when active, same visual as .tag.active
      const naca = ['0','I','II','III','IV','V','VI','VII'].map(v=>`<span class="tag naca${p.naca===v?' active':''}">${v}</span>`).join('')
      const cr = (items:[boolean|undefined,string][]) => `<div style="display:flex;flex-wrap:wrap;gap:2pt;padding:3pt 5pt">${items.map(([on,l])=>tag(on,l)).join('')}</div>`
      const vitG = [['RR syst.',p.rr_sys],['RR diast.',p.rr_dia],['HF /min',p.hf],['SpO₂ %',p.spo2],['AF /min',p.af],['Temp °C',p.temp],['BZ mg/dl',p.bz_mg],['etCO₂',p.etco2],['Schmerz NRS',p.schmerz]].map(([l,v])=>`<div style="text-align:center;border-right:0.5pt solid #ccc;padding:2pt 1pt"><div style="font-size:5pt;color:#666">${l}</div><div style="font-size:10pt;font-weight:bold">${v||'—'}</div></div>`).join('')

      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>MIND Notfalleinsatzprotokoll</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;color:#000;background:#fff}
        .pg{padding:8mm 10mm;max-width:210mm;margin:0 auto}
        .pb{page-break-before:always}
        table{width:100%;border-collapse:collapse}
        th{background:#d0d0d0;font-size:6pt;text-transform:uppercase;padding:2pt 4pt;border:0.5pt solid #888;letter-spacing:.3pt}
        td{padding:2pt 4pt;border:0.5pt solid #ccc;font-size:8pt}
        .tag{display:inline-block;font-size:6.5pt;padding:1pt 4pt;border:0.6pt solid #888;border-radius:2pt;margin:1pt 2pt 1pt 0;background:#f0f0f0;color:#333}
        .tag.active{background:#222;color:#fff;border-color:#222}
        .tag.naca{min-width:14pt;text-align:center;font-weight:bold}
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

      <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:4pt;margin-bottom:4pt">
        ${blk('NACA-Score',`<div style="padding:3pt 5pt;display:flex;gap:1.5pt">${naca}</div>`)}
        ${blk('Bewusstsein',cr([[p.bewusstsein==='wach','Wach'],[p.bewusstsein==='somnolent','Somnolent'],[p.bewusstsein==='soporös','Soporös'],[p.bewusstsein==='komatös','Komatös']]))}
        ${blk('Neurologie',`<div style="padding:3pt 5pt;display:flex;gap:10pt;align-items:center">${tag(p.neu_unauff,'Unauffällig')}<span style="font-size:7pt">Zeit: <b>${p.neu_zeit||'—'}</b></span></div>`)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 88pt;gap:4pt;margin-bottom:4pt">
        <div>
          ${blk('Vitalzeichen',`<div style="display:grid;grid-template-columns:repeat(9,1fr)">${vitG}</div>`+
            row('1fr 1fr',
              `<div style="padding:2.5pt 5pt;border-right:0.5pt solid #ccc"><div style="font-size:5.5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">Pupillen rechts</div><div style="font-size:7.5pt"><b>${p.pw_r||'—'}</b>${p.pw_r_entrundet?' entr.':''} · LR: ${p.lr_r||'—'}</div></div>`+
              `<div style="padding:2.5pt 5pt"><div style="font-size:5.5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">Pupillen links</div><div style="font-size:7.5pt"><b>${p.pw_l||'—'}</b>${p.pw_l_entrundet?' entr.':''} · LR: ${p.lr_l||'—'}</div></div>`
            )+
            `<div style="border-top:0.5pt solid #ccc;padding:2.5pt 5pt"><div style="font-size:5.5pt;color:#666;text-transform:uppercase;letter-spacing:.3pt;margin-bottom:1pt">O₂-Gabe</div><div style="display:flex;flex-wrap:wrap;gap:2pt">${tag(p.o2,'O₂')}${tag(p.o2_nasal,'Nasal')}${tag(p.o2_maske,'Maske')}${tag(p.o2_reservoir,'Reservoir')}${p.o2_flow?`<span style="font-size:7pt;align-self:center">${p.o2_flow} l/min</span>`:''}</div></div>`
          )}
        </div>
        <div>
          ${blk('GCS',`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 34pt">`+
            [['Augen (E)',p.gcs_e],['Verbal (V)',p.gcs_v],['Motorik (M)',p.gcs_m]].map(([l,v])=>`<div style="text-align:center;border-right:0.5pt solid #ccc;padding:2pt 1pt"><div style="font-size:5pt;color:#666">${l}</div><div style="font-size:10pt;font-weight:bold">${v||'—'}</div></div>`).join('')+
            `<div style="text-align:center;padding:2pt 1pt;background:#efefef"><div style="font-size:5pt;color:#666">Σ</div><div style="font-size:13pt;font-weight:bold">${gcsTotal||'—'}</div></div></div>`
          )}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4pt;margin-bottom:4pt">
        <div>
          ${blk('EKG-Befund / Rhythmus',cr([[p.sr,'Sinusrhythmus'],[p.stemi,'STEMI'],[p.vf,'Kammerflimmern'],[p.asystole,'Asystolie']])+
            (p.ekg_standort||p.ekg_persnr?`<div style="padding:1pt 5pt 3pt;font-size:7pt">EKG: ${p.ekg_standort||''} ${p.ekg_persnr?'· Pers.-Nr. '+p.ekg_persnr:''}</div>`:'')
          )}
          ${blk('Atmung',cr([[p.atm_apnoe,'Apnoe'],[p.atm_stridor,'Stridor'],[p.atm_dyspnoe,'Dyspnoe'],[p.atm_zyanose,'Zyanose']]))}
        </div>
        <div>
          ${blk('Haut',cr([[p.haut_unauff,'Unauffällig'],[p.haut_falten,'Fältchentest pos.'],[p.haut_oedeme,'Ödeme'],[p.haut_dekubitus,'Dekubitus'],[p.haut_kaltschweissig,'Kaltschweißig'],[p.haut_exanthem,'Exanthem']]))}
          ${blk('Psyche',cr([[p.psy_erregt,'Erregt'],[p.psy_aggr,'Aggressiv'],[p.psy_verlangsamt,'Verlangsamt'],[p.psy_depressiv,'Depressiv'],[p.psy_aengstlich,'Ängstlich'],[p.psy_euphorisch,'Euphorisch'],[p.psy_wahnhaft,'Wahnhaft'],[p.psy_verwirrt,'Verwirrt'],[p.psy_suizidal,'Suizidal'],[p.psy_motor_unruhig,'Motor. unruhig']]))}
        </div>
      </div>
      </div>

      <div class="pg pb">
      ${hdr('Seite 2 · '+([p.name,p.vorname].filter(Boolean).join(', ')||'—')+' · geb. '+(p.gebdatum||'—'))}

      ${(()=>{
        const emptyRow = `<tr>${Array(11).fill('<td style="border:0.5pt solid #ccc;padding:4pt 4pt;height:12pt">&nbsp;</td>').join('')}</tr>`
        const dataRows = verlauf.map(vr=>`<tr>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center;font-weight:bold">${vr.zeit||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.rr_sys||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.rr_dia||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.hf||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.spo2||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.af||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.temp||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.bz||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.etco2||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">${vr.schmerz||''}</td>
          <td style="border:0.5pt solid #ccc;padding:2pt 4pt">${vr.bemerkung||''}</td>
        </tr>`).join('')
        const extraRows = Math.max(0, 5 - verlauf.length)
        return `<div style="border:0.5pt solid #888;margin-bottom:4pt;overflow:hidden">
          <div style="font-size:6.5pt;font-weight:bold;background:#d0d0d0;padding:2pt 5pt;text-transform:uppercase;letter-spacing:.4pt;border-bottom:0.5pt solid #888">Verlauf / Vitalzeichen-Kurve</div>
          <table style="width:100%;border-collapse:collapse;font-size:7pt">
            <thead><tr style="background:#eee">
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center;white-space:nowrap">Zeit</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">RR sys</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">RR dia</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">HF</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">SpO₂</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">AF</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">Temp</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">BZ</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">etCO₂</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">Schmerz</th>
              <th style="border:0.5pt solid #ccc;padding:2pt 4pt;text-align:center">Bemerkung</th>
            </tr></thead>
            <tbody>${dataRows}${emptyRow.repeat(extraRows)}</tbody>
          </table>
        </div>`
      })()}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4pt;margin-bottom:4pt">
        ${blk('Erstdiagnose / Verdachtsdiagnose',cr([[p.diag_krampf,'Krampfanfall'],[p.diag_synkope,'Synkope'],[p.diag_apoplex,'Apoplex'],[p.diag_sht,'SHT'],[p.diag_acs,'ACS'],[p.diag_insuff,'Herzinsuffizienz'],[p.diag_hypo,'Hypoglykämie'],[p.diag_resp_insuff,'Resp. Insufzienz']]))}
        ${blk('Verletzungen / Befunde',`<div style="padding:4pt 5pt;min-height:28pt;font-size:8.5pt;white-space:pre-wrap">${p.verletz_text||''}</div>`)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4pt;margin-bottom:4pt">
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

      ${blk('Medikamente / Therapie',`<div style="padding:3pt 5pt"><table><thead><tr><th>Zeit</th><th>Medikament</th><th>Dosis</th><th>Einheit</th><th>Applikationsweg</th><th>Hinweis</th></tr></thead><tbody>${meds.length>0?meds.map(m=>`<tr><td>${m.time||''}</td><td>${m.name||''}</td><td>${m.dose||''}</td><td>${m.unit||''}</td><td>${m.route||''}</td><td>${m.note||''}</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:#aaa;font-style:italic">—</td></tr>'}</tbody></table></div>`)}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4pt;margin-top:4pt">
        ${blk('Unterschrift Patient / Einwilligung',p.signature?`<div style="padding:4pt"><img src="${p.signature}" style="max-height:48pt"></div>`:'<div style="min-height:40pt;border-top:0.5pt solid #ccc"></div>')}
        ${blk('Gegenzeichnung / Stempel',pd.admin_name?
          row('1fr 1fr',cell('Name',pd.admin_name)+cell('Datum',fmtDateTime(pd.admin_datum)))+(pd.admin_unterschrift?`<div style="padding:4pt"><img src="${pd.admin_unterschrift}" style="max-height:48pt"></div>`:'<div style="min-height:24pt"></div>'):
          '<div style="min-height:40pt;border-top:0.5pt solid #ccc"></div>'
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
