// Gerätebuch: ein Gerät mit Zustand und Gründen, Fristen, offenen Defekten und Meldungen;
// Verlauf (Prüfungen seitenweise) und Stammdaten. Verlinkbar: /mpg/geraete/:id?teil=…

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { INTERVALL_TEXT, intervallVon, lageText, tagText, monateVon, kalendertag } from '../../lib/mpg/fristen'
import { pbFehlerText } from '../../lib/pbFehler'
import { useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { PruefungEintrag } from './PruefungEintrag'
import {
  Abschnitt, Aktionen, Karte, Leer, Reiter, SCHWERE_RAND, STUFE_FARBE, SchwereMarke, SeitenKopf, ZustandMarke,
  fmtDate, knopfGefahr, knopfLeise, knopfRand, knopfVoll, kursivGrau, relativeDate, useBreit,
} from './teile'
import type { Device, Inspection } from './typen'

type Teil = 'ueberblick' | 'verlauf' | 'stammdaten'
const SEITE = 20

export default function Geraet() {
  const { id = '' } = useParams()
  const m = useMpg()
  const navigate = useNavigate()
  const [such, setSuch] = useSearchParams()
  const teil = (['ueberblick', 'verlauf', 'stammdaten'].includes(such.get('teil') || '') ? such.get('teil') : 'ueberblick') as Teil
  const { blocker, banner } = useLadestand()
  const breit = useBreit()
  const device = m.devices.find(d => d.id === id)

  if (blocker) return blocker
  if (!device) return <><SeitenKopf zurueck="/mpg/geraete" titel="Gerät nicht gefunden" /><Leer>Dieses Gerät gibt es nicht (mehr).</Leer></>

  const z = m.zustand(device)
  const setTeil = (t: Teil) => { const n = new URLSearchParams(such); if (t === 'ueberblick') n.delete('teil'); else n.set('teil', t); setSuch(n, { replace: true }) }

  return (
    <>
      <SeitenKopf zurueck="/mpg/geraete" titel={device.name}
        unter={[device.type, device.location, device.serial_number && `S/N ${device.serial_number}`].filter(Boolean).join(' · ')}
        rechts={<ZustandMarke stufe={z.stufe} />} />

      {/* breit steht der Hinweis schon über der Liste daneben */}
      {!breit && banner}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Link to={`/mpg/geraete/${device.id}/pruefen`} style={{ ...knopfVoll, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Prüfen</Link>
        <button onClick={() => m.setBlatt({ art: 'defekt', device })} style={knopfGefahr}>
          {m.unklarerDefekt(device.id) ? 'Mangel erneut senden' : 'Mangel melden'}
        </button>
        <Link to={`/mpg/geraete/${device.id}/bearbeiten`} style={{ ...knopfRand, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Bearbeiten</Link>
        <button onClick={() => m.schalteEinsatzbereit(device)} disabled={m.busy} style={knopfRand}>
          {device.operational === false ? 'Freigeben' : 'Sperren'}
        </button>
      </div>

      <Reiter wert={teil} onWahl={setTeil} optionen={[['ueberblick', 'Überblick'], ['verlauf', 'Verlauf'], ['stammdaten', 'Stammdaten']]} />

      {teil === 'ueberblick' && <Ueberblick device={device} />}
      {teil === 'verlauf' && <Verlauf key={device.id} device={device} />}
      {teil === 'stammdaten' && (
        <>
          <Stammdaten device={device} />
          <div style={{ marginTop: 20 }}>
            <button disabled={m.busy} style={{ ...knopfGefahr, fontSize: 13 }}
              onClick={async () => { if (await m.loescheGeraet(device)) navigate('/mpg/geraete') }}>Gerät löschen</button>
            <div style={{ ...kursivGrau, marginTop: 6 }}>Nur ohne Prüfungen und Defekte — sonst bleibt es als Nachweis erhalten.</div>
          </div>
        </>
      )}
    </>
  )
}

function Ueberblick({ device }: { device: Device }) {
  const m = useMpg()
  const z = m.zustand(device)
  const defekte = m.offeneDefekteVon(device.id)
  const meldungen = m.offeneMeldungenVon(device.id)
  return (
    <>
      <Abschnitt titel="Zustand">
        <Karte rand={STUFE_FARBE[z.stufe]} style={{ padding: '12px 14px' }}>
          {z.gruende.length === 0
            ? <div style={{ fontSize: 14, fontStyle: 'italic' }}>Einsatzbereit — keine offenen Punkte.</div>
            : z.gruende.map((g, i) => <div key={i} style={{ fontSize: 14, fontStyle: 'italic', marginTop: i ? 3 : 0, color: g.stufe === 'gesperrt' ? 'var(--lbf-fehler-text)' : 'var(--lbf-text)' }}>{g.text}</div>)}
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Fristen">
        <Karte>
          {z.fristen.map((f, i) => (
            <div key={f.art} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: i ? '0.5px solid var(--lbf-border-light)' : undefined, alignItems: 'baseline' }}>
              <div style={{ width: 70, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>{f.bezeichnung}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: f.lage === 'ueberfaellig' || f.lage === 'offen' || f.lage === 'heute' ? 'var(--lbf-akzent)' : 'var(--lbf-text)' }}>
                  {f.naechste ? `fällig ${tagText(f.naechste)}` : 'noch nicht durchgeführt'}
                </div>
                <div style={kursivGrau}>{f.letzte ? `zuletzt ${tagText(f.letzte)}` : 'kein Datum eingetragen'}{f.naechste ? ` · ${lageText(f)}` : ''}</div>
              </div>
            </div>
          ))}
        </Karte>
      </Abschnitt>

      {meldungen.length > 0 && (
        <Abschnitt titel={`Meldungen von außen (${meldungen.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meldungen.map(r => (
              <Karte key={r.id} rand={SCHWERE_RAND[r.severity]}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div style={{ fontSize: 14 }}>{r.description}</div><SchwereMarke severity={r.severity} /></div>
                  <div style={{ ...kursivGrau, marginTop: 4 }}>{relativeDate(r.created)} · {r.reporter_name || 'Anonym'}</div>
                  {m.unklareBestaetigung(r.id) && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-fehler-text)', marginTop: 4 }}>Bestätigung nicht sicher gespeichert — bitte erneut senden</div>}
                </div>
                <Aktionen>
                  <button onClick={() => m.setBlatt({ art: 'bestaetigen', meldung: r })} style={{ ...knopfLeise, background: 'var(--lbf-akzent-grund)', color: '#fff' }}>Bestätigen</button>
                  <button onClick={() => m.setBlatt({ art: 'ablehnen', meldung: r })} style={knopfLeise}>Ablehnen</button>
                </Aktionen>
              </Karte>
            ))}
          </div>
        </Abschnitt>
      )}

      <Abschnitt titel={`Offene Defekte (${defekte.length})`}>
        {defekte.length === 0
          ? <div style={{ ...kursivGrau, fontSize: 13 }}>Keine offenen Defekte.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {defekte.map(d => (
                <Karte key={d.id} rand={SCHWERE_RAND[d.severity]}>
                  <Link to={`/mpg/meldungen/${d.id}`} style={{ display: 'block', padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{d.description}</div><SchwereMarke severity={d.severity} /></div>
                    <div style={{ ...kursivGrau, marginTop: 4 }}>{relativeDate(d.created)} · {d.reported_by}</div>
                  </Link>
                  <Aktionen>
                    <button onClick={() => m.setBlatt({ art: 'beheben', defekt: d })} style={{ ...knopfLeise, background: '#16a34a', color: '#fff' }}>Beheben</button>
                  </Aktionen>
                </Karte>
              ))}
            </div>}
      </Abschnitt>
    </>
  )
}

function Verlauf({ device }: { device: Device }) {
  const m = useMpg()
  const [liste, setListe] = useState<Inspection[]>([])
  const [seite, setSeite] = useState(1)
  const [mehr, setMehr] = useState(false)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  // Nur die Antwort der neuesten Anfrage zählt — eine verspätete ältere darf nicht überschreiben
  const gen = useRef(0)

  async function lade(s: number) {
    const g = ++gen.current
    setLaedt(true)
    try {
      const r = await pb.collection('mpg_inspections').getList<Inspection>(s, SEITE, {
        filter: pb.filter('organization_id = {:o} && device_id = {:d}', { o: m.user!.organization_id, d: device.id }),
        sort: '-inspection_date', requestKey: null,
      })
      if (g !== gen.current) return
      setListe(l => s === 1 ? r.items : [...l, ...r.items])
      setMehr(r.page < r.totalPages)
      setSeite(s)
      setFehler('')
    } catch (e) {
      if (g === gen.current) setFehler(pbFehlerText(e))
    } finally {
      if (g === gen.current) setLaedt(false)
    }
  }
  // Neu laden, wenn sich der Prüfstand des Geräts ändert (neue Prüfung gespeichert)
  useEffect(() => { lade(1) }, [device.id, device.last_inspection])

  const defekte = m.defects.filter(d => d.device_id === device.id)
  return (
    <>
      <Abschnitt titel="Prüfungen">
        {fehler && <div style={{ ...kursivGrau, color: 'var(--lbf-fehler-text)', marginBottom: 8 }}>{fehler} <button onClick={() => lade(1)} style={knopfLeise}>Erneut</button></div>}
        {!laedt && !fehler && liste.length === 0 && <div style={{ ...kursivGrau, fontSize: 13 }}>Noch keine Prüfungen.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(p => <PruefungEintrag key={p.id} p={p} />)}
        </div>
        {laedt && <div style={{ ...kursivGrau, marginTop: 8 }}>Lädt …</div>}
        {mehr && !laedt && <button onClick={() => lade(seite + 1)} style={{ ...knopfRand, marginTop: 10, width: '100%' }}>Ältere laden</button>}
      </Abschnitt>
      <Abschnitt titel={`Defekte (${defekte.length})`}>
        {defekte.length === 0 && <div style={{ ...kursivGrau, fontSize: 13 }}>Keine Defekte gemeldet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {defekte.map(d => (
            <Karte key={d.id} rand={d.status === 'resolved' ? 'rgba(var(--lbf-grau-rgb),0.4)' : SCHWERE_RAND[d.severity]}>
              <Link to={`/mpg/meldungen/${d.id}`} style={{ display: 'block', padding: '10px 14px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{d.description}</div>
                  {d.status === 'resolved' ? <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Behoben</span> : <SchwereMarke severity={d.severity} />}
                </div>
                <div style={{ ...kursivGrau, marginTop: 3 }}>gemeldet {fmtDate(d.created)} · {d.reported_by}{d.status === 'resolved' && d.resolved_by ? ` · behoben von ${d.resolved_by}` : ''}</div>
                {d.resolved_notes && <div style={{ ...kursivGrau, marginTop: 2 }}>{d.resolved_notes}</div>}
              </Link>
            </Karte>
          ))}
        </div>
      </Abschnitt>
    </>
  )
}

function Stammdaten({ device }: { device: Device }) {
  const zeilen: [string, string][] = [
    ['Bezeichnung', device.name],
    ['Gerätetyp', device.type],
    ['Seriennummer', device.serial_number || '—'],
    ['Standort', device.location || '—'],
    ['Prüfintervall', INTERVALL_TEXT[intervallVon(device.interval)]],
    ['STK', device.has_stk ? `alle ${monateVon(device.stk_interval_months)} Monate · zuletzt ${tagText(kalendertag(device.last_stk))}` : 'nicht erforderlich'],
    ['MTK', device.has_mtk ? `alle ${monateVon(device.mtk_interval_months)} Monate · zuletzt ${tagText(kalendertag(device.last_mtk))}` : 'nicht erforderlich'],
    ['Angelegt', fmtDate(device.created)],
  ]
  return (
    <Karte>
      {zeilen.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: i ? '0.5px solid var(--lbf-border-light)' : undefined }}>
          <div style={{ width: 110, flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)', paddingTop: 2 }}>{k}</div>
          <div style={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</div>
        </div>
      ))}
    </Karte>
  )
}
