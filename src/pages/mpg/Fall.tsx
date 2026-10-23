// Ein Fall (Defekt) als eigene, verlinkbare Seite.

import { Link, useParams, useSearchParams } from 'react-router-dom'
import { defektAusKontrolle, sperrtDefekt } from '../../lib/mpg/zustand'
import { darfBeheben } from '../../lib/mpg/rechte'
import { useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { Karte, Leer, SCHWERE_RAND, SchwereMarke, SeitenKopf, fmtDateTime, knopfRand, knopfVollWenn, kursivGrau, useBreit } from './teile'

export default function Fall() {
  const { id = '' } = useParams()
  const [such] = useSearchParams()
  const m = useMpg()
  const { blocker, banner } = useLadestand()
  const breit = useBreit()
  if (blocker) return blocker
  const zurueck = `/mpg/meldungen${such.get('teil') ? `?teil=${such.get('teil')}` : ''}`
  const d = m.defects.find(x => x.id === id)
  if (!d) return <><SeitenKopf zurueck={zurueck} titel="Fall nicht gefunden" /><Leer>Diesen Defekt gibt es nicht (mehr).</Leer></>

  const offen = d.status !== 'resolved'
  // Unklar gesendetes Beheben: auch wenn der Defekt schon behoben aussieht, erreichbar lassen
  const versuchDa = !!m.blattVersuch(`beheben:${d.id}`)
  const zeilen: [string, string][] = [
    ['Gemeldet', `${fmtDateTime(d.created)} · ${d.reported_by}`],
    ...(offen ? [] : [['Behoben', `${d.resolved_by || '—'}${d.updated ? ` · ${fmtDateTime(d.updated)}` : ''}`] as [string, string]]),
    ...(d.resolved_notes ? [['Was wurde gemacht', d.resolved_notes] as [string, string]] : []),
  ]
  return (
    <>
      <SeitenKopf zurueck={zurueck} titel={m.geraeteName(d.device_id, d.device_name)} unter={offen ? (sperrtDefekt(d.severity) ? 'Offener Defekt — Gerät gesperrt' : 'Offener Mangel') : 'Behoben'}
        rechts={offen ? <SchwereMarke severity={d.severity} /> : undefined} />
      {!breit && banner}
      <Karte rand={offen ? SCHWERE_RAND[d.severity] : 'rgba(var(--lbf-grau-rgb),0.4)'} style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{d.description}</div>
      </Karte>
      <Karte style={{ marginBottom: 16 }}>
        {zeilen.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: i ? '0.5px solid var(--lbf-border-light)' : undefined }}>
            <div style={{ width: 120, flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)', paddingTop: 2 }}>{k}</div>
            <div style={{ fontSize: 14, fontStyle: 'italic', overflowWrap: 'anywhere' }}>{v}</div>
          </div>
        ))}
      </Karte>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {versuchDa
          ? <button onClick={() => m.setBlatt({ art: 'beheben', defekt: d })} style={knopfVollWenn(true, '#dc2626')}>Beheben nicht sicher gespeichert — öffnen</button>
          : offen && darfBeheben(m.user, d.severity) && <button onClick={() => m.setBlatt({ art: 'beheben', defekt: d })} style={knopfVollWenn(true, '#16a34a')}>Als behoben markieren</button>}
        <Link to={`/mpg/geraete/${d.device_id}`} style={{ ...knopfRand, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Zum Gerät</Link>
      </div>
      {!m.devices.some(g => g.id === d.device_id) && <div style={{ ...kursivGrau, marginTop: 8 }}>Das Gerät gibt es nicht mehr.</div>}
      {offen && !darfBeheben(m.user, d.severity) && <div style={{ ...kursivGrau, marginTop: 8 }}>Einen Defekt „{d.severity === 'critical' ? 'kritisch' : 'hoch'}“ schließt, wer „MPG verwalten“ hat — {defektAusKontrolle(d.description) ? `die Sperre hebt erst eine bestandene ${defektAusKontrolle(d.description) === 'stk' ? 'STK' : 'MTK'} auf.` : 'das Beheben hebt die Sperre auf.'}</div>}
    </>
  )
}
