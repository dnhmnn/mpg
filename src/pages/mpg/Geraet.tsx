// Gerätebuch: ein Gerät mit Zustand und Gründen, Fristen, offenen Defekten und Meldungen;
// Verlauf (Einträge im Gerätebuch, Prüfungen seitenweise, Defekte) und Stammdaten.
// Verlinkbar: /mpg/geraete/:id?teil=…
// Was ein Gerät freigibt oder den Bestand ändert, zeigt die Seite nur mit „MPG verwalten“
// (src/lib/mpg/rechte.ts).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { kalendertag, lageText, plusMonate, tagText, type Frist } from '../../lib/mpg/fristen'
import { stammdatenText, taktText } from '../../lib/mpg/aktionen'
import { KONTROLLE_NAME, type KontrollArt } from '../../lib/mpg/kontrollen'
import { darfBeheben } from '../../lib/mpg/rechte'
import { istAusserBetrieb } from '../../lib/mpg/zustand'
import { pbFehlerText } from '../../lib/pbFehler'
import { useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { PruefungEintrag } from './PruefungEintrag'
import { GeraetebuchEintrag } from './GeraetebuchEintrag'
import { AUFBEWAHRUNG_JAHRE } from './blaetter'
import {
  Abschnitt, Aktionen, Karte, Leer, Marke, Reiter, SCHWERE_RAND, STUFE_FARBE, SchwereMarke, SeitenKopf, ZustandMarke,
  fmtDate, fmtDateTime, knopfGefahr, knopfLeise, knopfRand, knopfVoll, kursivGrau, relativeDate, useBreit,
} from './teile'
import type { Device, Ereignis, Inspection } from './typen'

type Teil = 'ueberblick' | 'verlauf' | 'stammdaten'
const UNKLAR_BLAETTER: ['sperren' | 'freigeben' | 'ausserBetrieb' | 'wiederInBetrieb', string][] = [
  ['sperren', 'Sperre'], ['freigeben', 'Freigabe'], ['ausserBetrieb', 'Außerbetriebnahme'], ['wiederInBetrieb', 'Wieder in Betrieb'],
]
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
  const ausser = istAusserBetrieb(device)
  const setTeil = (t: Teil) => { const n = new URLSearchParams(such); if (t === 'ueberblick') n.delete('teil'); else n.set('teil', t); setSuch(n, { replace: true }) }
  const knopfLink = { ...knopfRand, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } as const

  return (
    <>
      <SeitenKopf zurueck="/mpg/geraete" titel={device.name}
        unter={[device.type, device.location, device.serial_number && `S/N ${device.serial_number}`].filter(Boolean).join(' · ')}
        rechts={ausser ? <Marke grund="rgba(var(--lbf-grau-rgb),0.12)" schrift="var(--warm-gray)">Außer Betrieb</Marke> : <ZustandMarke stufe={z.stufe} />} />

      {/* breit steht der Hinweis schon über der Liste daneben */}
      {!breit && banner}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {!ausser && <>
          <Link to={`/mpg/geraete/${device.id}/pruefen`} style={{ ...knopfVoll, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Prüfen</Link>
          <button onClick={() => m.setBlatt({ art: 'defekt', device })} style={knopfGefahr}>
            {m.unklarerDefekt(device.id) ? 'Mangel erneut senden' : 'Mangel melden'}
          </button>
          {device.operational === false
            ? m.darfVerwalten && <button onClick={() => m.setBlatt({ art: 'freigeben', device })} disabled={m.busy} style={knopfRand}>Freigeben</button>
            : <button onClick={() => m.setBlatt({ art: 'sperren', device })} disabled={m.busy} style={knopfRand}>Sperren</button>}
        </>}
        {ausser && m.unklarerDefekt(device.id) && <button onClick={() => m.setBlatt({ art: 'defekt', device })} style={knopfGefahr}>Mangel erneut senden</button>}
        {m.buch && <button onClick={() => m.setBlatt({ art: 'vermerk', device })} style={knopfRand}>Vermerk</button>}
        {!ausser && m.darfVerwalten && <Link to={`/mpg/geraete/${device.id}/bearbeiten`} style={knopfLink}>Bearbeiten</Link>}
        {ausser && m.darfVerwalten && <button onClick={() => m.setBlatt({ art: 'wiederInBetrieb', device })} disabled={m.busy} style={knopfRand}>Wieder in Betrieb nehmen</button>}
      </div>

      {/* Unklar gesendet und das Blatt geschlossen: nicht liegen lassen */}
      {UNKLAR_BLAETTER.filter(([art]) => m.blattVersuch(`${art}:${device.id}`)).map(([art, name]) => (
        <Karte key={art} rand="#dc2626" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, fontStyle: 'italic', color: 'var(--lbf-fehler-text)' }}>{name} nicht sicher gespeichert — bitte öffnen und erneut senden oder verwerfen.</div>
          <button onClick={() => m.setBlatt({ art, device })} style={{ ...knopfRand, padding: '8px 12px', fontSize: 12 }}>Öffnen</button>
        </Karte>
      ))}
      {m.defects.filter(d => d.device_id === device.id && m.blattVersuch(`beheben:${d.id}`)).map(d => (
        <Karte key={`beheben:${d.id}`} rand="#dc2626" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, fontStyle: 'italic', color: 'var(--lbf-fehler-text)' }}>Beheben des Defekts „{d.description.split('\n')[0].slice(0, 60)}“ nicht sicher gespeichert — bitte öffnen und erneut senden oder verwerfen.</div>
          <button onClick={() => m.setBlatt({ art: 'beheben', defekt: d })} style={{ ...knopfRand, padding: '8px 12px', fontSize: 12 }}>Öffnen</button>
        </Karte>
      ))}
      {(['stk', 'mtk'] as const).filter(k => m.blattVersuch(`kontrolle-${k}:${device.id}`)).map(k => (
        <Karte key={k} rand="#dc2626" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, fontStyle: 'italic', color: 'var(--lbf-fehler-text)' }}>{KONTROLLE_NAME[k]} nicht sicher gespeichert — bitte öffnen und erneut senden oder verwerfen.</div>
          <button onClick={() => m.setBlatt({ art: 'kontrolle', device, kontrolle: k })} style={{ ...knopfRand, padding: '8px 12px', fontSize: 12 }}>Öffnen</button>
        </Karte>
      ))}

      <Reiter wert={teil} onWahl={setTeil} optionen={[['ueberblick', 'Überblick'], ['verlauf', 'Verlauf'], ['stammdaten', 'Stammdaten']]} />

      {teil === 'ueberblick' && <Ueberblick device={device} />}
      {teil === 'verlauf' && <Verlauf key={device.id} device={device} />}
      {teil === 'stammdaten' && (
        <>
          <Stammdaten device={device} />
          {m.darfVerwalten && !ausser && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <button disabled={m.busy} style={{ ...knopfGefahr, fontSize: 13 }} onClick={() => m.setBlatt({ art: 'ausserBetrieb', device })}>Außer Betrieb nehmen</button>
                <div style={{ ...kursivGrau, marginTop: 6 }}>Ausgemustert, verschrottet, zurückgegeben: Das Gerät verlässt den Bestand, sein Gerätebuch bleibt.</div>
              </div>
              <div>
                <button disabled={m.busy} style={{ ...knopfRand, fontSize: 13, color: 'var(--lbf-fehler-text)' }}
                  onClick={async () => { if (await m.loescheGeraet(device)) navigate('/mpg/geraete') }}>Gerät löschen</button>
                <div style={{ ...kursivGrau, marginTop: 6 }}>Nur ein versehentlich angelegtes Gerät ohne Prüfungen, Defekte und Einträge.</div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

/** Außer Betrieb: wann, warum, wohin — und wie lange die Nachweise aufzubewahren sind. */
function AusserBetriebKarte({ device }: { device: Device }) {
  const seit = kalendertag(device.ausser_betrieb)
  const zeilen: [string, string][] = [
    ['Seit', seit ? tagText(seit) : '—'],
    ['Grund', device.ausser_betrieb_grund || '—'],
    ['Verbleib', device.verbleib || '—'],
    ['Aufbewahren bis', seit ? `${tagText(plusMonate(seit, AUFBEWAHRUNG_JAHRE * 12))} — Gerätebuch, Prüfungen und Defekte` : '—'],
  ]
  return (
    <Abschnitt titel="Außer Betrieb">
      <Karte rand="rgba(var(--lbf-grau-rgb),0.4)">
        {zeilen.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: i ? '0.5px solid var(--lbf-border-light)' : undefined }}>
            <div style={{ width: 110, flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)', paddingTop: 2 }}>{k}</div>
            <div style={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{v}</div>
          </div>
        ))}
      </Karte>
    </Abschnitt>
  )
}

/**
 * Der Grund der aktuellen Sperre: der letzte Eintrag „gesperrt“ — aber nur, wenn danach keine
 * Freigabe kam (sonst stammt die Sperre aus einer Zeit ohne Gerätebuch und der Grund wäre alt).
 */
function useLetzteSperre(device: Device): Ereignis | null {
  const m = useMpg()
  const [e, setE] = useState<Ereignis | null>(null)
  const gesperrt = device.operational === false
  useEffect(() => {
    // Erst leeren: in der geteilten Ansicht stünde sonst kurz der Grund des vorigen Geräts da
    setE(null)
    if (!gesperrt || !m.buch) return
    let aktuell = true
    pb.collection('mpg_ereignisse').getList<Ereignis>(1, 1, {
      filter: pb.filter('organization_id = {:o} && device_id = {:d} && (art = "gesperrt" || art = "freigegeben" || art = "wieder_in_betrieb")', { o: m.user!.organization_id, d: device.id }),
      sort: '-created', requestKey: null,
    }).then(r => { if (aktuell) setE(r.items[0]?.art === 'gesperrt' ? r.items[0] : null) }).catch(() => undefined)
    return () => { aktuell = false }
  }, [device.id, gesperrt, m.buch, m.schreibStand])
  return e
}

/** Wie weit es bis zur Fälligkeit ist — ohne das „fällig“ der Zeile darüber zu wiederholen */
function restText(f: Frist): string {
  const t = f.tage ?? 0
  if (f.lage === 'ueberfaellig' || f.lage === 'offen') return lageText(f)
  if (f.lage === 'heute') return 'heute'
  return t === 1 ? 'morgen' : `in ${t} Tagen`
}

/** Tag einer Kontrolle laut Gerätebuch (eingetragen kann sie später sein) */
const kontrollTag = (e: Ereignis) => kalendertag(typeof e.angaben?.datum === 'string' ? e.angaben.datum : null) ?? kalendertag(e.created) ?? ''

/** Die neueste STK und MTK (Gerätebuch) nach dem Tag der Kontrolle — wer, wann, mit welchem Ergebnis. */
function useLetzteKontrollen(device: Device): Partial<Record<KontrollArt, Ereignis>> {
  const m = useMpg()
  const [k, setK] = useState<Partial<Record<KontrollArt, Ereignis>>>({})
  useEffect(() => {
    setK({})
    if (!m.buch || (!device.has_stk && !device.has_mtk)) return
    let aktuell = true
    pb.collection('mpg_ereignisse').getList<Ereignis>(1, 20, {
      filter: pb.filter('organization_id = {:o} && device_id = {:d} && (art = "stk" || art = "mtk")', { o: m.user!.organization_id, d: device.id }),
      sort: '-created', requestKey: null,
    }).then(r => {
      if (!aktuell) return
      // Nach dem Tag der Kontrolle, nicht nach dem Eintragen — eine nachgetragene ältere ist nicht „die letzte“
      const neueste = (art: KontrollArt) => r.items.filter(e => e.art === art)
        .sort((a, b) => kontrollTag(b).localeCompare(kontrollTag(a)) || b.created.localeCompare(a.created))[0]
      setK({ stk: neueste('stk'), mtk: neueste('mtk') })
    }).catch(() => undefined)
    return () => { aktuell = false }
  }, [device.id, device.has_stk, device.has_mtk, m.buch, m.schreibStand])
  return k
}

function Ueberblick({ device }: { device: Device }) {
  const m = useMpg()
  const z = m.zustand(device)
  const letzteKontrolle = useLetzteKontrollen(device)
  const defekte = m.offeneDefekteVon(device.id)
  const meldungen = m.offeneMeldungenVon(device.id)
  const sperre = useLetzteSperre(device)
  const ausser = istAusserBetrieb(device)
  return (
    <>
      {ausser ? <AusserBetriebKarte device={device} /> : <>
      <Abschnitt titel="Zustand">
        <Karte rand={STUFE_FARBE[z.stufe]} style={{ padding: '12px 14px' }}>
          {z.gruende.length === 0
            ? <div style={{ fontSize: 14, fontStyle: 'italic' }}>Einsatzbereit — keine offenen Punkte.</div>
            : z.gruende.map((g, i) => <div key={i} style={{ fontSize: 14, fontStyle: 'italic', marginTop: i ? 3 : 0, color: g.stufe === 'gesperrt' ? 'var(--lbf-fehler-text)' : 'var(--lbf-text)' }}>{g.text}</div>)}
          {sperre && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--lbf-border-light)' }}>
              <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{sperre.text || 'Ohne Grund gesperrt'}</div>
              <div style={{ ...kursivGrau, marginTop: 2 }}>gesperrt {fmtDateTime(sperre.created)} · {sperre.user_name}</div>
            </div>
          )}
          {device.operational === false && !m.darfVerwalten && <div style={{ ...kursivGrau, marginTop: 8 }}>Freigeben kann, wer „MPG verwalten“ hat.</div>}
          {!m.darfVerwalten && z.gruende.some(g => /^(Letzte )?(STK|MTK)/.test(g.text)) && (
            <div style={{ ...kursivGrau, marginTop: 8 }}>{z.stufe === 'gesperrt' ? 'Nicht einsetzen. ' : ''}STK und MTK veranlasst und trägt ein, wer „MPG verwalten“ hat.</div>
          )}
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Fristen">
        <Karte>
          {z.fristen.map((f, i) => {
            const k = f.art === 'pruefung' ? null : letzteKontrolle[f.art]
            return (
              <div key={f.art} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: i ? '0.5px solid var(--lbf-border-light)' : undefined, alignItems: 'baseline' }}>
                <div style={{ width: 70, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>{f.bezeichnung}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: f.art !== 'pruefung' && f.lage === 'ueberfaellig' ? 'var(--lbf-fehler-text)' : f.lage === 'ueberfaellig' || f.lage === 'offen' || f.lage === 'heute' ? 'var(--lbf-akzent)' : 'var(--lbf-text)' }}>
                    {f.naechste ? `fällig ${f.art === 'pruefung' ? '' : 'bis '}${tagText(f.naechste)}` : f.art === 'pruefung' ? 'noch nicht durchgeführt'
                      : f.zukunft ? 'Datum liegt in der Zukunft — bitte prüfen'
                      : `Datum fehlt — letzte ${f.bezeichnung}${m.inbetriebnahmeMoeglich ? ' oder Inbetriebnahme' : ''} eintragen`}
                  </div>
                  <div style={kursivGrau}>
                    {f.letzte ? `zuletzt ${tagText(f.letzte)}` : f.abInbetriebnahme ? 'erste Kontrolle — Frist ab Inbetriebnahme' : f.art === 'pruefung' ? 'noch nie geprüft' : 'noch keine eingetragen'}
                    {f.art !== 'pruefung' ? ` · ${taktText(f.art, f.art === 'stk' ? device.stk_interval_months : device.mtk_interval_months)}` : ''}
                    {f.naechste ? ` · ${restText(f)}` : ''}
                  </div>
                  {/* Die neueste Kontrolle aus dem Gerätebuch — eine nachgetragene ältere als „zuletzt“ hier nicht */}
                  {k && !(f.letzte && kontrollTag(k) < f.letzte) && <div style={{ ...kursivGrau, marginTop: 2, overflowWrap: 'anywhere', ...(k.angaben?.ergebnis === 'nicht_bestanden' ? { color: 'var(--lbf-fehler-text)' } : {}) }}>{k.text.split('\n')[0]}</div>}
                </div>
                {f.art !== 'pruefung' && m.darfVerwalten && m.buch && (
                  <button onClick={() => m.setBlatt({ art: 'kontrolle', device, kontrolle: f.art as KontrollArt })} style={{ ...knopfLeise, flexShrink: 0 }}>Eintragen</button>
                )}
              </div>
            )
          })}
          {m.darfVerwalten && !m.buch && z.fristen.some(f => f.art !== 'pruefung') && (
            <div style={{ ...kursivGrau, padding: '0 14px 11px' }}>
              STK und MTK mit Prüfer und Protokoll eintragen geht, sobald das Gerätebuch in PocketBase eingerichtet ist. Bis dahin das Datum der letzten Kontrolle unter „Bearbeiten“ eintragen.
            </div>
          )}
        </Karte>
      </Abschnitt>
      </>}

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
                {m.darfVerwalten && (
                  <Aktionen>
                    <button onClick={() => m.setBlatt({ art: 'bestaetigen', meldung: r })} style={{ ...knopfLeise, background: 'var(--lbf-akzent-grund)', color: '#fff' }}>Bestätigen</button>
                    <button onClick={() => m.setBlatt({ art: 'ablehnen', meldung: r })} style={knopfLeise}>Ablehnen</button>
                  </Aktionen>
                )}
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
                  {darfBeheben(m.user, d.severity) && (
                    <Aktionen>
                      <button onClick={() => m.setBlatt({ art: 'beheben', defekt: d })} style={{ ...knopfLeise, background: '#16a34a', color: '#fff' }}>Beheben</button>
                    </Aktionen>
                  )}
                </Karte>
              ))}
            </div>}
      </Abschnitt>
    </>
  )
}

interface Seite<T> { items: T[]; page: number; totalPages: number }

/** Eine Liste seitenweise laden; nur die Antwort der neuesten Anfrage zählt. */
function useSeitenweise<T>(laden: (seite: number) => Promise<Seite<T>>, abh: unknown[]) {
  const [liste, setListe] = useState<T[]>([])
  const [seite, setSeite] = useState(1)
  const [mehr, setMehr] = useState(false)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const gen = useRef(0)
  async function lade(s: number) {
    const g = ++gen.current
    setLaedt(true)
    try {
      const r = await laden(s)
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
  useEffect(() => { lade(1) }, abh)
  return { liste, mehr, laedt, fehler, neu: () => lade(1), weiter: () => lade(seite + 1) }
}

function Seitenliste<T>({ l, leer, children }: { l: ReturnType<typeof useSeitenweise<T>>; leer: string; children: (x: T) => ReactNode }) {
  return (
    <>
      {l.fehler && <div style={{ ...kursivGrau, color: 'var(--lbf-fehler-text)', marginBottom: 8 }}>{l.fehler} <button onClick={l.neu} style={knopfLeise}>Erneut</button></div>}
      {!l.laedt && !l.fehler && l.liste.length === 0 && <div style={{ ...kursivGrau, fontSize: 13 }}>{leer}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{l.liste.map(children)}</div>
      {l.laedt && <div style={{ ...kursivGrau, marginTop: 8 }}>Lädt …</div>}
      {l.mehr && !l.laedt && <button onClick={l.weiter} style={{ ...knopfRand, marginTop: 10, width: '100%' }}>Ältere laden</button>}
    </>
  )
}

const pruefungText = (p: Inspection) => `Prüfung vom ${fmtDateTime(p.inspection_date)} · ${p.user_name}`

function Verlauf({ device }: { device: Device }) {
  const m = useMpg()
  const org = m.user!.organization_id
  const filter = pb.filter('organization_id = {:o} && device_id = {:d}', { o: org, d: device.id })
  // Neu laden, wenn sich der Prüfstand ändert oder etwas gespeichert wurde
  const pruefungen = useSeitenweise<Inspection>(s => pb.collection('mpg_inspections').getList<Inspection>(s, SEITE, { filter, sort: '-inspection_date', requestKey: null }),
    [device.id, device.last_inspection, m.schreibStand])
  const eintraege = useSeitenweise<Ereignis>(s => m.buch
    ? pb.collection('mpg_ereignisse').getList<Ereignis>(s, SEITE, { filter, sort: '-created', requestKey: null })
    : Promise.resolve({ items: [], page: 1, totalPages: 1 }), [device.id, m.buch, m.schreibStand])
  // Vermerke zu Prüfungen (Korrekturen) stehen beim Protokoll — alle, nicht nur die der ersten Seite
  const [vermerke, setVermerke] = useState<Ereignis[]>([])
  useEffect(() => {
    if (!m.buch) { setVermerke([]); return }
    let aktuell = true
    pb.collection('mpg_ereignisse').getFullList<Ereignis>({ filter: pb.filter('organization_id = {:o} && device_id = {:d} && bezug != ""', { o: org, d: device.id }), sort: 'created', requestKey: null })
      .then(r => { if (aktuell) setVermerke(r.filter(e => e.art === 'vermerk')) }).catch(() => undefined)
    return () => { aktuell = false }
  }, [device.id, m.buch, m.schreibStand])

  const defekte = m.defects.filter(d => d.device_id === device.id)
  const pruefungVon = (id: string) => pruefungen.liste.find(p => p.id === id)
  return (
    <>
      {m.buch && (
        <Abschnitt titel="Gerätebuch">
          <Seitenliste l={eintraege} leer="Noch keine Einträge.">
            {e => {
              const p = e.bezug ? pruefungVon(e.bezug) : undefined
              return <GeraetebuchEintrag key={e.id} e={e} bezugText={e.art === 'vermerk' && e.bezug ? (p ? `zur ${pruefungText(p)}` : 'zu einem Prüfprotokoll') : undefined} />
            }}
          </Seitenliste>
        </Abschnitt>
      )}
      <Abschnitt titel="Prüfungen">
        <Seitenliste l={pruefungen} leer="Noch keine Prüfungen.">
          {p => <PruefungEintrag key={p.id} p={p} vermerke={vermerke.filter(v => v.bezug === p.id)}
            onVermerk={m.buch ? () => m.setBlatt({ art: 'vermerk', device, bezug: { id: p.id, text: pruefungText(p) } }) : undefined} />}
        </Seitenliste>
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
  const m = useMpg()
  // Ohne das Feld in PocketBase gibt es keine Inbetriebnahme — dann auch keine leere Zeile dafür
  const zeilen: [string, string][] = [...stammdatenText(device).filter(f => f.feld !== 'inbetriebnahme' || m.inbetriebnahmeMoeglich).map(f => [f.name, f.wert] as [string, string]), ['Angelegt', fmtDate(device.created)]]
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
