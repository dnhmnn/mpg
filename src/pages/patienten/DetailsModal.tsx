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
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    let body = ''
    if (type === 'patient') {
      const pd = doc as Patient
      const p = parsePayload(pd.payload)
      body = `
        <h1 style="font-size:18px;margin-bottom:16px">Notfallprotokoll</h1>
        <h2>Einsatzdaten</h2>
        <table><tr><td>Einsatz-Nr.</td><td>${p.einsatz_nr||'—'}</td><td>Auftrags-Nr.</td><td>${p.auftrags_nr||'—'}</td></tr>
        <tr><td>Rufname</td><td>${p.rufname||'—'}</td><td>Fahrzeug</td><td>${p.fahrzeug||'—'}</td></tr>
        <tr><td>Zeit Einsatz</td><td>${p.zeit_einsatz||'—'}</td><td>Einsatzart</td><td>${p.einsatz_art||'—'}</td></tr></table>
        <h2>Patient</h2>
        <table><tr><td>Name</td><td>${p.name||'—'} ${p.vorname||''}</td><td>Geburtsdatum</td><td>${p.gebdatum||'—'}</td></tr>
        <tr><td>Alter</td><td>${p.alter||'—'}</td><td>Krankenkasse</td><td>${p.kasse||'—'}</td></tr>
        <tr><td>Vers.-Nr.</td><td>${p.versnr||'—'}</td><td>Hausarzt</td><td>${p.hausarzt||'—'}</td></tr></table>
        <h2>Vitalparameter</h2>
        <table><tr><td>RR</td><td>${p.rr_sys||'—'}/${p.rr_dia||'—'} mmHg</td><td>HF</td><td>${p.hf||'—'} /min</td></tr>
        <tr><td>SpO2</td><td>${p.spo2||'—'} %</td><td>AF</td><td>${p.af||'—'} /min</td></tr>
        <tr><td>Temp</td><td>${p.temp||'—'} °C</td><td>BZ</td><td>${p.bz_mg||'—'} mg/dl</td></tr>
        <tr><td>GCS</td><td>${calcGCS(p)}</td><td>Schmerz</td><td>${p.schmerz||'—'}/10</td></tr></table>
        <h2>Notfallgeschehen</h2><p>${p.notfallgeschehen||'—'}</p>
        ${pd.admin_name ? `<h2>Gegenzeichnung</h2><p>${pd.admin_name} — ${fmtDateTime(pd.admin_datum)}</p>${pd.admin_unterschrift ? `<img src="${pd.admin_unterschrift}" style="max-width:300px;border:1px solid #ccc">` : ''}` : ''}
      `
    } else {
      const nd = doc as Nacherfassung
      body = `
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
        ${nd.nacherfasst_unterschrift ? `<img src="${nd.nacherfasst_unterschrift}" style="max-width:300px;border:1px solid #ccc">` : ''}
      `
    }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Protokoll</title>
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
