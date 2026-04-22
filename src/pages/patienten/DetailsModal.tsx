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
      const tags = (items: { val?: boolean; label: string }[]) =>
        items.map(t => `<span class="tag${t.val ? ' active' : ''}">${t.label}</span>`).join('')

      const html = `<!DOCTYPE html><html lang="de"><head>
        <meta charset="UTF-8"><title>Notfalleinsatzprotokoll</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#000;background:#fff}
          .page{padding:8mm 10mm;max-width:210mm;margin:0 auto}
          .hdr{display:flex;justify-content:space-between;border-bottom:2pt solid #000;padding-bottom:4pt;margin-bottom:6pt}
          .hdr-title{font-size:14pt;font-weight:bold}
          .block{border:0.5pt solid #999;border-radius:2pt;margin-bottom:5pt;overflow:hidden}
          .block-title{font-size:7.5pt;font-weight:bold;background:#eee;padding:2pt 5pt;text-transform:uppercase;letter-spacing:.3pt;border-bottom:0.5pt solid #ccc}
          .row{display:grid;border-top:0.5pt solid #eee}
          .row:first-of-type{border-top:none}
          .cell{padding:3pt 5pt;border-right:0.5pt solid #eee}
          .cell:last-child{border-right:none}
          .lbl{font-size:6.5pt;color:#777;text-transform:uppercase}
          .val{font-weight:bold;min-height:10pt;font-size:9pt}
          .vitals{display:grid;grid-template-columns:repeat(8,1fr)}
          .vital{text-align:center;border-right:0.5pt solid #eee;padding:3pt 2pt}
          .vital:last-child{border-right:none}
          .vlbl{font-size:6.5pt;color:#777}
          .vval{font-size:11pt;font-weight:bold}
          .gcs-wrap{display:grid;grid-template-columns:1fr 1fr 1fr 48pt}
          .gcs-cell{text-align:center;border-right:0.5pt solid #eee;padding:3pt 2pt}
          .gcs-cell:last-child{border-right:none;background:#f5f5f5}
          .gcs-total{font-size:16pt;font-weight:bold}
          .tag{display:inline-block;border:0.5pt solid #999;border-radius:2pt;padding:1pt 4pt;margin:1pt;font-size:7.5pt}
          .tag.active{background:#222;color:#fff;border-color:#222}
          table{width:100%;border-collapse:collapse}
          th,td{border:0.5pt solid #ccc;padding:2pt 4pt;font-size:8pt}
          th{background:#eee;text-transform:uppercase;font-size:7.5pt}
          .two{display:grid;grid-template-columns:1fr 1fr;gap:5pt;margin-bottom:5pt}
          .print-btn{position:fixed;bottom:20px;right:20px;background:#c0392b;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer}
          @media print{.print-btn{display:none}}
        </style>
      </head><body><div class="page">

        <div class="hdr">
          <div>
            <div class="hdr-title">NOTFALLEINSATZPROTOKOLL</div>
            <div style="font-size:7.5pt;color:#555">Responda · Erstellt: ${new Date().toLocaleString('de-DE')}</div>
          </div>
          <div style="font-size:7pt;color:#aaa;align-self:flex-end">MIND</div>
        </div>

        <div class="block">
          <div class="block-title">Einsatzdaten</div>
          <div class="row" style="grid-template-columns:1fr 1fr 1fr 1fr">
            <div class="cell"><div class="lbl">Einsatz-Nr.</div><div class="val">${p.einsatz_nr||'—'}</div></div>
            <div class="cell"><div class="lbl">Auftrags-Nr.</div><div class="val">${p.auftrags_nr||'—'}</div></div>
            <div class="cell"><div class="lbl">Zeit Einsatz</div><div class="val">${p.zeit_einsatz||'—'}</div></div>
            <div class="cell"><div class="lbl">Rufname</div><div class="val">${p.rufname||'—'}</div></div>
          </div>
          <div class="row" style="grid-template-columns:1fr 1fr">
            <div class="cell"><div class="lbl">Fahrzeug / Einheit</div><div class="val">${p.fahrzeug||'—'}</div></div>
            <div class="cell"><div class="lbl">Einsatzart</div><div class="val">${p.einsatz_art||'—'}</div></div>
          </div>
        </div>

        <div class="block">
          <div class="block-title">Patientendaten</div>
          <div class="row" style="grid-template-columns:2fr 1fr .6fr 1.2fr 1.4fr">
            <div class="cell"><div class="lbl">Name, Vorname</div><div class="val">${[p.name,p.vorname].filter(Boolean).join(', ')||'—'}</div></div>
            <div class="cell"><div class="lbl">Geburtsdatum</div><div class="val">${p.gebdatum||'—'}</div></div>
            <div class="cell"><div class="lbl">Alter</div><div class="val">${p.alter||'—'}</div></div>
            <div class="cell"><div class="lbl">Krankenkasse</div><div class="val">${p.kasse||'—'}</div></div>
            <div class="cell"><div class="lbl">Vers.-Nr.</div><div class="val">${p.versnr||'—'}</div></div>
          </div>
          <div class="row" style="grid-template-columns:1fr 1fr">
            <div class="cell"><div class="lbl">Hausarzt</div><div class="val">${p.hausarzt||'—'}</div></div>
            <div class="cell"><div class="lbl">Angehöriger</div><div class="val">${p.angehoeriger||'—'}</div></div>
          </div>
        </div>

        <div class="block">
          <div class="block-title">Notfallgeschehen / Anamnese</div>
          <div style="padding:5pt 6pt;min-height:36pt;font-size:9pt;white-space:pre-wrap">${p.notfallgeschehen||'—'}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 150pt;gap:5pt;margin-bottom:5pt">
          <div class="block" style="margin:0">
            <div class="block-title">Vitalzeichen</div>
            <div class="vitals">
              <div class="vital"><div class="vlbl">RR syst.</div><div class="vval">${p.rr_sys||'—'}</div></div>
              <div class="vital"><div class="vlbl">RR diast.</div><div class="vval">${p.rr_dia||'—'}</div></div>
              <div class="vital"><div class="vlbl">HF /min</div><div class="vval">${p.hf||'—'}</div></div>
              <div class="vital"><div class="vlbl">SpO₂ %</div><div class="vval">${p.spo2||'—'}</div></div>
              <div class="vital"><div class="vlbl">AF /min</div><div class="vval">${p.af||'—'}</div></div>
              <div class="vital"><div class="vlbl">Temp °C</div><div class="vval">${p.temp||'—'}</div></div>
              <div class="vital"><div class="vlbl">BZ mg/dl</div><div class="vval">${p.bz_mg||'—'}</div></div>
              <div class="vital"><div class="vlbl">etCO₂</div><div class="vval">${p.etco2||'—'}</div></div>
            </div>
            <div class="row" style="grid-template-columns:1fr 1fr">
              <div class="cell"><div class="lbl">Schmerz (NRS)</div><div class="val">${p.schmerz||'—'}/10</div></div>
              <div class="cell"><div class="lbl">O₂-Gabe</div><div class="val">${p.o2?[p.o2_nasal&&'Nasal',p.o2_maske&&'Maske',p.o2_reservoir&&'Reservoir',p.o2_flow&&(p.o2_flow+' L/min')].filter(Boolean).join(', '):'—'}</div></div>
            </div>
          </div>
          <div class="block" style="margin:0">
            <div class="block-title">GCS</div>
            <div class="gcs-wrap">
              <div class="gcs-cell"><div class="vlbl">Augen (E)</div><div class="vval">${p.gcs_e||'—'}</div></div>
              <div class="gcs-cell"><div class="vlbl">Verbal (V)</div><div class="vval">${p.gcs_v||'—'}</div></div>
              <div class="gcs-cell"><div class="vlbl">Motorik (M)</div><div class="vval">${p.gcs_m||'—'}</div></div>
              <div class="gcs-cell"><div class="vlbl">Gesamt</div><div class="gcs-total">${gcsTotal||'—'}</div></div>
            </div>
            <div class="block-title">Pupillen</div>
            <div class="row" style="grid-template-columns:1fr 1fr">
              <div class="cell"><div class="lbl">Links</div><div class="val">${p.pw_l||'—'}${p.pw_l_entrundet?' entr.':''}</div><div style="font-size:7.5pt">LR: ${p.lr_l||'—'}</div></div>
              <div class="cell"><div class="lbl">Rechts</div><div class="val">${p.pw_r||'—'}${p.pw_r_entrundet?' entr.':''}</div><div style="font-size:7.5pt">LR: ${p.lr_r||'—'}</div></div>
            </div>
          </div>
        </div>

        <div class="two">
          <div class="block" style="margin:0">
            <div class="block-title">EKG-Befund</div>
            <div style="padding:4pt 5pt">${tags([{val:p.sr,label:'Sinusrhythmus'},{val:p.stemi,label:'STEMI'},{val:p.vf,label:'Kammerflimmern'},{val:p.asystole,label:'Asystolie'}])}</div>
            <div class="block-title">Atmung</div>
            <div style="padding:4pt 5pt">${tags([{val:p.atm_apnoe,label:'Apnoe'},{val:p.atm_stridor,label:'Stridor'},{val:p.atm_dyspnoe,label:'Dyspnoe'},{val:p.atm_zyanose,label:'Zyanose'}])}</div>
          </div>
          <div class="block" style="margin:0">
            <div class="block-title">Verdachtsdiagnosen</div>
            <div style="padding:4pt 5pt">${tags([{val:p.diag_krampf,label:'Krampfanfall'},{val:p.diag_synkope,label:'Synkope'},{val:p.diag_apoplex,label:'Apoplex'},{val:p.diag_sht,label:'SHT'},{val:p.diag_acs,label:'ACS'},{val:p.diag_insuff,label:'Herzinsuffizienz'},{val:p.diag_hypo,label:'Hypoglykämie'},{val:p.diag_resp_insuff,label:'Resp. Insuff.'}])}</div>
            <div class="block-title">Haut / Psyche</div>
            <div style="padding:4pt 5pt">${tags([{val:p.haut_unauff,label:'Haut unauff.'},{val:p.haut_kaltschweissig,label:'kaltschweißig'},{val:p.haut_oedeme,label:'Ödeme'},{val:p.haut_dekubitus,label:'Dekubitus'},{val:p.psy_erregt,label:'erregt'},{val:p.psy_verwirrt,label:'verwirrt'},{val:p.psy_suizidal,label:'suizidal'},{val:p.psy_aggr,label:'aggressiv'}])}</div>
          </div>
        </div>

        ${meds.length > 0 ? `<div class="block">
          <div class="block-title">Medikamente</div>
          <div style="padding:4pt 5pt">
            <table><thead><tr><th>Zeit</th><th>Medikament</th><th>Dosis</th><th>Einheit</th><th>Applikation</th><th>Bemerkung</th></tr></thead>
            <tbody>${meds.map(m=>`<tr><td>${m.time||'—'}</td><td>${m.name||'—'}</td><td>${m.dose||'—'}</td><td>${m.unit||'—'}</td><td>${m.route||'—'}</td><td>${m.note||''}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>` : ''}

        <div class="two">
          <div class="block" style="margin:0">
            <div class="block-title">Venöser Zugang / Infusion</div>
            <div style="padding:4pt 5pt;font-size:9pt">${p.zugang_art||p.zugang_gauge||p.zugang_region?[p.zugang_art,p.zugang_gauge?p.zugang_gauge+'G':'',p.zugang_region].filter(Boolean).join(' · '):'—'}${p.inf_art?`<br>${p.inf_art} ${p.inf_menge||''}`:''}
            </div>
          </div>
          <div class="block" style="margin:0">
            <div class="block-title">Verletzungen / Sonstiges</div>
            <div style="padding:4pt 5pt;font-size:9pt;white-space:pre-wrap;min-height:24pt">${p.verletz_text||'—'}</div>
          </div>
        </div>

        ${p.signature ? `<div class="block">
          <div class="block-title">Unterschrift Patient / Einwilligung</div>
          <div style="padding:5pt"><img src="${p.signature}" style="max-height:50pt;border:0.5pt solid #ccc"></div>
        </div>` : ''}

        ${pd.admin_name ? `<div class="block">
          <div class="block-title">Gegenzeichnung MPG-Beauftragter</div>
          <div class="row" style="grid-template-columns:1fr 1fr">
            <div class="cell"><div class="lbl">Name</div><div class="val">${pd.admin_name}</div></div>
            <div class="cell"><div class="lbl">Datum</div><div class="val">${fmtDateTime(pd.admin_datum)}</div></div>
          </div>
          ${pd.admin_unterschrift?`<div style="padding:5pt;border-top:0.5pt solid #eee"><img src="${pd.admin_unterschrift}" style="max-height:50pt;border:0.5pt solid #ccc"></div>`:''}
        </div>` : ''}

      </div>
      <button class="print-btn" onclick="window.print()">Drucken / PDF</button>
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
