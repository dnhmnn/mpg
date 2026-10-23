// Prüfung eines Geräts — alle Punkte auf einer Seite. „Alles in Ordnung“ mit einem Tipp,
// je Punkt „i.O.“ oder „Mangel“ (Mangel mit Notiz). Das Ergebnis folgt aus den Punkten.
//
// Die begonnene Prüfung liegt laufend auf dem Gerät (je Person) und übersteht Neuladen und
// Beenden der App. Gespeichert wird genau einmal: Der Versuch wird vor dem Senden
// festgeschrieben; ging er unklar aus, wird nur noch genau dieser Stand erneut gesendet.

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { planePruefung, restNachAnker } from '../../lib/mpg/aktionen'
import { ERGEBNIS_TEXT, moeglicheErgebnisse, restInOrdnung, setzePunkt, unentschiedenePunkte, type PruefErgebnis, type Pruefpunkt } from '../../lib/mpg/pruefung'
import { neueId, pbOptionen } from '../../lib/mpg/schreiben'
import { istAusserBetrieb } from '../../lib/mpg/zustand'
import { altenVersuchSenden, useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { Hinweis, Karte, Leer, SeitenKopf, eingabe, feldName, knopfRand, knopfVollWenn, kursivGrau, useZurueck } from './teile'
import type { Device, PruefStand } from './typen'

const ERGEBNIS_KNOPF: Record<PruefErgebnis, { text: string; grund: string }> = {
  bestanden: { text: 'Bestanden', grund: '#16a34a' },
  mangel: { text: 'Mangel – bleibt einsatzbereit', grund: 'var(--lbf-akzent-grund)' },
  nicht_bestanden: { text: 'Nicht bestanden – sperren', grund: '#dc2626' },
}

/** Entwürfe aus Paket 1 kennen nur „abgehakt“ — offen gilt dort als noch nicht entschieden */
function mitStatus(results: Pruefpunkt[]): Pruefpunkt[] {
  return results.map(r => r.status ? r : setzePunkt(r, r.checked ? 'ok' : 'offen'))
}

export default function Pruefung() {
  const { id = '' } = useParams()
  const m = useMpg()
  const { blocker } = useLadestand()
  if (blocker) return blocker
  const device = m.devices.find(d => d.id === id)
  if (!device) return <><SeitenKopf zurueck="/mpg/geraete" titel="Gerät nicht gefunden" /><Leer>Dieses Gerät gibt es nicht (mehr).</Leer></>
  // Ein Versuch mit unklarem Ausgang wird auch nach der Außerbetriebnahme noch erneut gesendet
  // (genau dieser Stand) — sonst hinge er fest
  const versuchHier = m.leseEntwurf()
  if (istAusserBetrieb(device) && !(versuchHier?.device_id === device.id && versuchHier.versucht)) return <AusserBetriebGeprueft device={device} />
  return <PruefSeite key={device.id} device={device} />
}

/** Ein außer Betrieb genommenes Gerät wird nicht mehr geprüft — ein liegengebliebener Entwurf lässt sich verwerfen. */
function AusserBetriebGeprueft({ device }: { device: Device }) {
  const m = useMpg()
  const entwurf = m.leseEntwurf()
  const eigenerEntwurf = entwurf?.device_id === device.id && !entwurf.versucht
  return (
    <>
      <SeitenKopf zurueck={`/mpg/geraete/${device.id}`} titel="Prüfung" unter={device.name} />
      <Leer>
        Dieses Gerät ist außer Betrieb genommen und wird nicht mehr geprüft.
        {eigenerEntwurf && <div style={{ marginTop: 14 }}><button onClick={() => m.schreibeEntwurf(null)} style={knopfRand}>Begonnene Prüfung verwerfen</button></div>}
      </Leer>
    </>
  )
}

function PruefSeite({ device }: { device: Device }) {
  const m = useMpg()
  const ort = useLocation()
  const zurueck = (ort.state as { zurueck?: string } | null)?.zurueck || `/mpg/geraete/${device.id}`

  const [stand, setStand] = useState<PruefStand | null>(null)
  const [fremd, setFremd] = useState<PruefStand | null>(null)
  // Steht die Seite noch? Ein Speichern kann nach dem Verlassen enden — dann nicht mehr navigieren.
  const steht = useRef(false)
  useEffect(() => { steht.current = true; return () => { steht.current = false } }, [])
  // Sendet DIESE Seite gerade? (Eine zweite, während des Speicherns geöffnete Seite derselben
  // Prüfung wartet nur ab.)  erledigt: nur einmal weiter — auch wenn zwei Wege es auslösen.
  const sendetHier = useRef(false)
  const erledigt = useRef(false)
  // Liegt diese Prüfung schon als Entwurf auf dem Gerät? Eine frisch geöffnete, noch
  // unberührte Prüfung wird erst mit der ersten Eingabe gemerkt.
  const imEntwurf = useRef(false)
  const geheZurueck = useZurueck(zurueck)

  // Beginnen: eigener Entwurf → fortsetzen; Entwurf eines anderen Geräts → nachfragen; sonst neu
  // (erst wenn die Vorlagen der Organisation geladen sind)
  useEffect(() => {
    if (stand || fremd) return
    const e = m.leseEntwurf()
    if (e && e.device_id === device.id) { imEntwurf.current = true; setStand(e.versucht ? e : { ...e, results: mitStatus(e.results) }) }
    else if (e) setFremd(e)
    else if (m.vorlagenGeladen) setStand(neuerStand())
  }, [device.id, m.vorlagenGeladen, fremd])

  // Ist der fremde Entwurf inzwischen erledigt (gespeichert oder verworfen), hier beginnen
  useEffect(() => {
    if (fremd && m.leseEntwurf()?.ids.pruefung !== fremd.ids.pruefung) setFremd(null)
  }, [m.entwurfStand])

  /**
   * Fertig oder verworfen: dorthin zurück, woher man kam. Der Eintrag der Prüfseite bleibt nicht
   * im Verlauf stehen — „Zurück“ führte sonst in eine leere neue Prüfung desselben Geräts.
   */
  function weiter() {
    if (!steht.current || erledigt.current) return
    erledigt.current = true
    geheZurueck()
  }

  // Wurde diese Prüfung anderswo fertig (eine früher geöffnete Seite hat sie gespeichert oder
  // verworfen), ist hier nichts mehr zu tun
  useEffect(() => {
    if (!stand || !imEntwurf.current || sendetHier.current || m.laufendePruefung === stand.ids.pruefung) return
    if (m.leseEntwurf()?.ids.pruefung !== stand.ids.pruefung) weiter()
  }, [m.entwurfStand, m.laufendePruefung])

  function neuerStand(): PruefStand {
    const items = m.vorlageFuer(device)
    return {
      device_id: device.id, items, notes: '', ids: { pruefung: neueId(), defekt: neueId() },
      results: items.map(item => ({ item, checked: false, note: '', status: 'offen' as const })),
    }
  }

  // Jede Änderung sofort auf das Gerät
  function aendere(neu: PruefStand) {
    setStand(neu)
    imEntwurf.current = true
    m.schreibeEntwurf(neu)
  }

  if (fremd) {
    const anderes = m.devices.find(d => d.id === fremd.device_id)
    const speichertGerade = m.laufendePruefung === fremd.ids.pruefung
    return (
      <>
        <SeitenKopf zurueck={zurueck} titel="Prüfung" unter={device.name} />
        <Karte rand={fremd.versucht ? '#dc2626' : 'var(--lbf-akzent)'} style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {speichertGerade ? 'Eine andere Prüfung wird gerade gespeichert' : fremd.versucht ? 'Eine andere Prüfung ist nicht sicher gespeichert' : 'Es gibt eine begonnene Prüfung'}
          </div>
          <div style={{ ...kursivGrau, marginBottom: 14 }}>
            {anderes ? anderes.name : 'Gerät nicht mehr vorhanden'}
            {speichertGerade ? ' — bitte einen Moment warten.' : fremd.versucht ? ` — „${ERGEBNIS_TEXT[fremd.versucht.ergebnis]}“ bitte zuerst erneut senden.` : ' — es kann nur eine Prüfung zugleich offen sein.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {anderes && <Link to={`/mpg/geraete/${anderes.id}/pruefen`} style={{ ...knopfVollWenn(true), textDecoration: 'none' }}>Dort fortsetzen</Link>}
            <button disabled={speichertGerade || m.busy} style={{ ...knopfRand, color: 'var(--lbf-fehler-text)', borderColor: 'rgba(220,38,38,0.3)', opacity: speichertGerade ? 0.5 : 1 }} onClick={() => {
              const text = fremd.versucht
                ? 'Ob die andere Prüfung gespeichert wurde, ist unklar. Trotzdem verwerfen?\n\nTeile können schon angekommen sein (Sperre, Defekt, Protokoll im Logbuch) — bitte danach den Stand jenes Geräts prüfen.'
                : 'Die begonnene Prüfung verwerfen und hier neu beginnen?'
              if (!confirm(text)) return
              m.entwurfWenn(fremd.ids.pruefung, null)
              // Der neue Stand entsteht erst mit geladenen Vorlagen (Wirkung oben)
              setFremd(null)
            }}>Verwerfen und hier beginnen</button>
          </div>
        </Karte>
      </>
    )
  }

  if (!stand) {
    return (
      <>
        <SeitenKopf zurueck={zurueck} titel="Prüfung" unter={device.name} />
        {m.ladefehler && !m.loading
          ? <Karte rand="#dc2626" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Prüfvorlage konnte nicht geladen werden</div>
              <div style={{ ...kursivGrau, marginBottom: 12 }}>{m.ladefehler}</div>
              <button onClick={m.loadAll} style={knopfVollWenn(true)}>Erneut laden</button>
            </Karte>
          : <Leer>Lade Prüfvorlage …</Leer>}
      </>
    )
  }

  const versucht = stand.versucht
  // Speichert eine andere Seite gerade genau diese Prüfung, wird hier nur gewartet
  const anderswo = m.laufendePruefung === stand.ids.pruefung && !sendetHier.current
  const fest = !!versucht || m.busy || anderswo
  const wahl = moeglicheErgebnisse(stand.results, stand.notes)
  const offen = unentschiedenePunkte(stand.results).length
  const maengel = stand.results.filter(r => r.status === 'mangel' || (!r.status && !r.checked)).length

  const setzeAlle = () => aendere({ ...stand, results: restInOrdnung(stand.results) })
  const setze = (i: number, p: Pruefpunkt) => aendere({ ...stand, results: stand.results.map((r, j) => j === i ? p : r) })

  function verwerfen() {
    if (m.busy || !stand) return
    if (stand.versucht) {
      if (!confirm('Ob diese Prüfung gespeichert wurde, ist unklar. Trotzdem verwerfen?\n\nTeile können schon angekommen sein (Sperre, Defekt, Protokoll im Logbuch) — bitte danach den Stand des Geräts prüfen.')) return
    } else {
      const angefangen = stand.notes.trim() || stand.results.some(r => r.status === 'ok' || r.status === 'mangel' || r.note.trim())
      if (angefangen && !confirm('Prüfung abbrechen? Die Eingaben gehen verloren.')) return
    }
    m.entwurfWenn(stand.ids.pruefung, null)
    weiter()
  }

  async function speichern(gewaehlt: PruefErgebnis) {
    if (!stand || m.busy) return
    // Nach unklarem Ausgang nur genau den gesendeten Stand wiederholen — sonst meldete der
    // Server „schon da“ und ein geändertes Ergebnis ginge still verloren
    const vorher = stand.versucht
    const ergebnis = vorher?.ergebnis ?? gewaehlt
    const w = moeglicheErgebnisse(stand.results, stand.notes)
    if (!w[ergebnis]) { m.showMsg(w.hinweis || 'Bitte den Mangel beschreiben', 'error'); return }
    const zeit = vorher?.zeit ?? new Date().toISOString()

    // Wiederholung: Gerätestand lesen (ein älterer Versuch darf eine inzwischen neuere Prüfung
    // nicht überschreiben) und nachsehen, ob der Anker — das Protokoll — schon da ist.
    // Dann fehlt höchstens der Prüfstand am Gerät danach.
    // Schon beim ersten Versuch: Liegt am Gerät eine neuere Prüfung (anderes Gerät, dessen Uhr
    // vorgeht), bleibt deren Stand stehen — dieses Protokoll wird nachgetragen
    let serverLetzte: string | null = device.last_inspection || null
    let serverBestanden: boolean | null = device.last_inspection ? !!device.last_inspection_passed : null
    let ankerDa = false
    if (vorher) {
      if (!altenVersuchSenden(vorher.zeit)) return
      const r = await m.mitSperre(async () => {
        const da = await m.gibtEs('mpg_inspections', stand.ids.pruefung)
        const g = await pb.collection('mpg_devices').getOne<Device>(device.id, { fields: 'id,last_inspection,last_inspection_passed', ...pbOptionen() })
        return { da, letzte: g.last_inspection || null, bestanden: g.last_inspection ? !!g.last_inspection_passed : null }
      })
      if (!r.ok) return
      ankerDa = r.wert.da
      serverLetzte = r.wert.letzte
      serverBestanden = r.wert.bestanden
    }

    const plan = planePruefung({
      geraet: device, punkte: stand.results, bemerkung: stand.notes,
      ergebnis, wer: m.wer(), jetzt: new Date(zeit), ids: stand.ids, serverLetzte, serverBestanden, sendezeit: new Date(), buch: m.buch,
    })
    const schonEingetragen = !!serverLetzte && new Date(serverLetzte.replace(' ', 'T')).getTime() === new Date(zeit).getTime()
    const anfragen = ankerDa ? (schonEingetragen ? [] : restNachAnker(plan)) : plan
    if (!anfragen.length) {
      m.showMsg('War bereits gespeichert')
      m.entwurfWenn(stand.ids.pruefung, null)
      m.loadAll()
      weiter()
      return
    }
    const nachtrag = !plan.some(a => a.collection === 'mpg_devices' && 'last_inspection' in a.body)
    const text = nachtrag ? 'Prüfung nachgetragen — es gibt eine neuere Prüfung, deren Stand gilt weiter'
      : ergebnis === 'bestanden' ? 'Prüfung bestanden'
      : ergebnis === 'mangel' ? 'Mangel festgehalten — Gerät bleibt einsatzbereit'
      : 'Prüfung nicht bestanden — Gerät gesperrt, Defekt angelegt'
    // Den Versuch VOR dem Senden festschreiben — auch im Entwurf, falls die App währenddessen
    // beendet wird: nach dem Neuladen gibt es dann nur „erneut senden“, nichts Geändertes
    const festgeschrieben = { ...stand, versucht: { ergebnis, zeit } }
    aendere(festgeschrieben)
    sendetHier.current = true
    m.setLaufendePruefung(stand.ids.pruefung)
    const r = await m.ausfuehren(anfragen, text).finally(() => m.setLaufendePruefung(null))
    // Die Seite kann inzwischen verlassen und eine andere Prüfung begonnen sein: nur den
    // eigenen Entwurf anfassen, nur von hier aus weiterleiten
    if (r === 'ok') {
      weiter()
      m.entwurfWenn(stand.ids.pruefung, null)
      m.loadAll()
    } else if (r !== 'unklar' && !vorher) {
      // Sicher abgelehnt, nichts geschrieben: wieder änderbar
      const offen = { ...stand, versucht: undefined }
      m.entwurfWenn(stand.ids.pruefung, offen)
      if (steht.current) setStand(offen)
    }
    sendetHier.current = false
  }

  const knopf = (e: PruefErgebnis, text = ERGEBNIS_KNOPF[e].text) => (
    <button key={e} onClick={() => speichern(e)} disabled={m.busy || !wahl[e]} style={{ ...knopfVollWenn(!m.busy && wahl[e], ERGEBNIS_KNOPF[e].grund), flex: e === 'bestanden' ? 2 : 1, minWidth: 140 }}>
      {m.busy ? 'Speichert…' : text}
    </button>
  )

  return (
    <>
      <SeitenKopf zurueck={zurueck} titel="Prüfung" unter={`${device.name} · ${device.type}`} />

      {anderswo && (
        <div style={{ marginBottom: 14 }}><Hinweis>Diese Prüfung wird gerade gespeichert — bitte einen Moment warten.</Hinweis></div>
      )}
      {versucht && !m.busy && !anderswo && (
        <div style={{ marginBottom: 14 }}>
          <Hinweis ton="warn">Ob „{ERGEBNIS_TEXT[versucht.ergebnis]}“ gespeichert wurde, ist unklar. Erneut senden legt nichts doppelt an. Zum Ändern die Prüfung verwerfen und neu beginnen.</Hinweis>
        </div>
      )}

      {!fest && offen > 0 && (
        <button onClick={setzeAlle} style={{ ...knopfVollWenn(true, '#16a34a'), width: '100%', marginBottom: 14 }}>
          {offen === stand.results.length ? 'Alles in Ordnung' : `Übrige ${offen} in Ordnung`}
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {stand.results.map((r, i) => {
          const status = r.status ?? (r.checked ? 'ok' : 'mangel')
          return (
            <Karte key={i} rand={status === 'ok' ? '#16a34a' : status === 'mangel' ? '#dc2626' : 'rgba(var(--lbf-grau-rgb),0.4)'} style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>{r.item}</div>
                <div role="radiogroup" aria-label={r.item} style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {(['ok', 'mangel'] as const).map(s => {
                    const an = status === s
                    const farbe = s === 'ok' ? '#16a34a' : '#dc2626'
                    return (
                      <button key={s} role="radio" aria-checked={an} disabled={fest} onClick={() => setze(i, setzePunkt(r, s))} style={{
                        minWidth: 64, minHeight: 40, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: fest ? 'default' : 'pointer',
                        border: `1.5px solid ${an ? farbe : 'var(--lbf-border)'}`, background: an ? farbe : 'transparent', color: an ? '#fff' : (s === 'ok' ? 'var(--lbf-ok-text)' : 'var(--lbf-fehler-text)'),
                      }}>{s === 'ok' ? 'i.O.' : 'Mangel'}</button>
                    )
                  })}
                </div>
              </div>
              {status === 'mangel' && (
                <textarea value={r.note} readOnly={fest} rows={2} aria-label={`Mangel: ${r.item}`}
                  onChange={e => setze(i, { ...r, note: e.target.value })} placeholder="Was ist nicht in Ordnung? (Pflicht)"
                  style={{ ...eingabe, marginTop: 8, fontSize: 14, resize: 'vertical', borderColor: r.note.trim() ? undefined : 'rgba(220,38,38,0.45)' }} />
              )}
            </Karte>
          )
        })}
      </div>

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ ...feldName, display: 'block', marginBottom: 6 }}>Bemerkung</span>
        <textarea value={stand.notes} readOnly={fest} rows={3} onChange={e => aendere({ ...stand, notes: e.target.value })}
          placeholder="Besondere Vorkommnisse, was wurde veranlasst …" style={{ ...eingabe, resize: 'vertical' }} />
      </label>

      {wahl.hinweis && !versucht && <div style={{ ...kursivGrau, color: offen || (maengel && !wahl.mangel) ? 'var(--lbf-fehler-text)' : 'var(--warm-gray)', marginBottom: 10 }}>{wahl.hinweis}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {versucht
          ? knopf(versucht.ergebnis, `Erneut senden: ${ERGEBNIS_TEXT[versucht.ergebnis]}`)
          : <>{maengel === 0 && knopf('bestanden')}{knopf('mangel')}{knopf('nicht_bestanden')}</>}
      </div>
      <button onClick={verwerfen} disabled={m.busy} style={{ ...knopfRand, marginTop: 12, width: '100%', color: 'var(--warm-gray)' }}>
        {versucht ? 'Verwerfen' : 'Prüfung abbrechen'}
      </button>
      {offen === 0 && maengel === 0 && !versucht && (
        <div style={{ ...kursivGrau, marginTop: 10 }}>Mangel oder „nicht bestanden“ trotz aller Punkte in Ordnung? Dann bitte in der Bemerkung beschreiben.</div>
      )}
    </>
  )
}
