// CIRS unter Vorgänge: die Meldungen der Organisation, ihre Bearbeitung und
// die Auswertung, im Stil der Benutzerverwaltung (Bauplan Vorgänge, 3.9):
// Flächen mit ruhigen Zeilen, Status als Wort, Abschnitte ohne Versalien.
//
// Gespeichert wird immer auf dem frisch gelesenen Datensatz: erst holen, dann
// den Bearbeitungsschritt darauf anwenden, dann schreiben. So überschreibt
// niemand, was ein anderer inzwischen eingetragen hat, und die Angaben des
// Melders bleiben unberührt (siehe speicherDaten in lib/cirs).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pb } from '../../lib/pocketbase'
import type { User } from '../../types'
import { hatRecht } from '../../lib/apps'
import {
  ANSICHTEN, KATEGORIEN, SCHWEREGRADE,
  auswerten, bearbeitungAus, CirsFehler, csv, fallAus, fallPrioritaet, filtern, geltendeKategorie,
  imZeitraum, istAbgeschlossen, istUeberfaellig, kalendertag, kategorieText, offeneMassnahmen, sortieren,
  speicherDaten, tagText, zaehlen,
  type Ansicht, type Bearbeitung, type CirsDatensatz, type CirsFall, type Person, type Schritt,
} from '../../lib/cirs'
import { auswertungSeite, cirsSeite, druckFensterOeffnen } from '../../lib/cirsDruck'
import { herunterladen } from '../../lib/csv'
import CirsDetail from './CirsDetail'
import { Abschnitt, Auswahl, Feld, Hinweis, Leer, Notiz, VgIcon, Zeile } from './bausteine'
import {
  CIRS_TEXTE as T, PhaseWort, cirsAnzeige, exportiertText, meldungenText, prioText, ueberfaelligText, useCirsKonfig, wieLange,
} from './cirsTeile'
import { EIN_CSS } from './eingang/stil'

interface Props {
  user: User | null
  orgId: string | null
  orgName?: string
  /** Eine Meldung, die gleich offen sein soll (Verweis aus dem Hub). */
  startMeldung?: string | null
  /** Meldet die Zahlen nach oben, für die Zahl am Reiter. */
  onZahlen?: (z: { neu: number; ueberfaellig: number }) => void
  /**
   * form_config der Organisation (Bezeichnungen der Felder, eigene Felder ohne Schnappschuss).
   * Fehlt sie, liest die Verwaltung sie einmal selbst.
   */
  formConfig?: unknown
}

type Bereich = 'liste' | 'auswertung'
type Zeitraum = '12m' | 'jahr' | 'vorjahr' | 'alle'

function zeitraumGrenzen(z: Zeitraum, heute: Date): { von: Date | null; bis: Date | null; name: string } {
  const j = heute.getFullYear()
  switch (z) {
    case '12m': return { von: new Date(j - 1, heute.getMonth(), heute.getDate() + 1), bis: null, name: 'Letzte 12 Monate' }
    case 'jahr': return { von: new Date(j, 0, 1), bis: new Date(j + 1, 0, 1), name: `Jahr ${j}` }
    case 'vorjahr': return { von: new Date(j - 1, 0, 1), bis: new Date(j, 0, 1), name: `Jahr ${j - 1}` }
    case 'alle': return { von: null, bis: null, name: 'Gesamter Zeitraum' }
  }
}

export default function CirsVerwaltung({ user, orgId, orgName, startMeldung, onZahlen, formConfig }: Props) {
  const [datensaetze, setDatensaetze] = useState<CirsDatensatz[]>([])
  const [laedt, setLaedt] = useState(true)
  const [ladefehler, setLadefehler] = useState('')
  const [personen, setPersonen] = useState<Person[]>([])

  const [bereich, setBereich] = useState<Bereich>('liste')
  const [ansicht, setAnsicht] = useState<Ansicht>('offen')
  const [suche, setSuche] = useState('')
  const [kategorie, setKategorie] = useState('')
  const [schwere, setSchwere] = useState('')
  const [zeitraum, setZeitraum] = useState<Zeitraum>('12m')

  const [offenId, setOffenId] = useState<string | null>(startMeldung ?? null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  // Ein Fehler gehört zu der Meldung, bei der er entstand; schließt man sie vorher, zeigt ihn die Liste
  const [fehler, setFehlerRoh] = useState<{ id: string; text: string } | null>(null)
  const [hinweis, setHinweis] = useState<{ text: string; fehler?: boolean } | null>(null)
  const hinweisZeigen = useCallback((text: string, istFehler = false) => {
    setHinweis({ text, fehler: istFehler })
    if (!istFehler) setTimeout(() => setHinweis((h) => (h?.text === text ? null : h)), 3500)
  }, [])

  // Bezeichnungen der Felder nach der Einstellung der Organisation
  const konfig = useCirsKonfig(orgId, formConfig)
  const anzeige = useMemo(() => cirsAnzeige(konfig), [konfig])

  // Der heutige Tag: bleibt die Seite über Mitternacht offen, zählt er weiter,
  // sonst stünde eine Frist von gestern noch als "heute fällig" da
  const [heute, setHeute] = useState(() => new Date())
  useEffect(() => {
    const pruefen = () => setHeute((h) => (kalendertag(h) === kalendertag(new Date()) ? h : new Date()))
    const uhr = window.setInterval(pruefen, 60_000)
    document.addEventListener('visibilitychange', pruefen)
    window.addEventListener('focus', pruefen)
    return () => { window.clearInterval(uhr); document.removeEventListener('visibilitychange', pruefen); window.removeEventListener('focus', pruefen) }
  }, [])
  const ich: Person | null = user ? { id: user.id, name: user.name || user.email?.split('@')[0] || 'Unbekannt' } : null

  // CIRS-Meldungen sind vertraulich: nur wer Vorgänge bearbeiten darf, lädt sie überhaupt
  const darf = hatRecht(user, 'dokumente')

  const laden = useCallback(async () => {
    if (!orgId || !darf) return
    setLaedt(true)
    setLadefehler('')
    try {
      const liste = await pb.collection('cirs_reports').getFullList<CirsDatensatz>({
        filter: pb.filter('organization_id = {:org}', { org: orgId }),
        sort: '-created',
        requestKey: null,
      })
      setDatensaetze(liste)
    } catch (e: any) {
      setLadefehler(e?.status === 0 ? T.keinNetzLaden : T.ladefehler)
    } finally {
      setLaedt(false)
    }
  }, [orgId, darf])

  useEffect(() => { laden() }, [laden])

  useEffect(() => {
    if (!orgId || !darf) return
    pb.collection('users').getFullList({ filter: pb.filter('organization_id = {:org}', { org: orgId }), fields: 'id,name,email,disabled', sort: 'name', requestKey: null })
      .then((us) => setPersonen(us
        .filter((u: any) => !u.disabled)
        .map((u: any) => ({ id: u.id, name: u.name || (u.email ? String(u.email).split('@')[0] : 'Unbekannt') }))))
      .catch(() => setPersonen([]))
  }, [orgId, darf])

  const faelle = useMemo(() => datensaetze.map(fallAus), [datensaetze])
  const zahlen = useMemo(() => zaehlen(faelle, ich?.id, heute), [faelle, ich?.id, heute])
  const sichtbar = useMemo(
    () => sortieren(filtern(faelle, { ansicht, suche, kategorie, schwere }, ich?.id, heute), heute),
    [faelle, ansicht, suche, kategorie, schwere, ich?.id, heute],
  )
  const offen = offenId ? faelle.find((f) => f.id === offenId) ?? null : null

  useEffect(() => { onZahlen?.({ neu: zahlen.neu, ueberfaellig: zahlen.ueberfaellig }) }, [zahlen.neu, zahlen.ueberfaellig]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ein Verweis auf eine Meldung, die es nicht (mehr) gibt, soll nicht leer öffnen
  useEffect(() => {
    if (!laedt && !ladefehler && offenId && !faelle.some((f) => f.id === offenId)) setOffenId(null)
  }, [laedt, ladefehler, offenId, faelle])

  // Der Stand, den die Ansicht zeigt, auch zwischen zwei Darstellungen aktuell,
  // damit ein zweiter Schritt in der Warteschlange den ersten schon sieht
  const angezeigt = useRef<CirsDatensatz[]>([])
  angezeigt.current = datensaetze
  const uebernehmen = useCallback((rec: CirsDatensatz) => {
    angezeigt.current = angezeigt.current.map((d) => (d.id === rec.id ? rec : d))
    setDatensaetze(angezeigt.current)
  }, [])

  const ausfuehren = useCallback(async (id: string, schritt: (b: Bearbeitung, s: Schritt) => Bearbeitung): Promise<boolean> => {
    if (!ich) return false
    const setFehler = (text: string) => setFehlerRoh(text ? { id, text } : null)
    setFehlerRoh((f) => (f?.id === id ? null : f))
    try {
      const frisch = await pb.collection('cirs_reports').getOne<CirsDatensatz>(id, { requestKey: null })
      // Hat jemand anderes die Meldung geändert, seit sie hier angezeigt wird, nichts
      // darüber schreiben: erst den neuen Stand zeigen, dann entscheidet der Bearbeiter
      const vorhin = angezeigt.current.find((d) => d.id === id)
      if (vorhin?.updated && frisch.updated && vorhin.updated !== frisch.updated) {
        uebernehmen(frisch)
        setFehler(T.fremdGeaendert)
        return false
      }
      const vorher = bearbeitungAus(frisch)
      const nachher = schritt(vorher, { wer: ich.name, am: new Date() })
      if (nachher === vorher) { uebernehmen(frisch); return true }
      const gespeichert = await pb.collection('cirs_reports').update<CirsDatensatz>(id, speicherDaten(frisch.payload, nachher), { requestKey: null })
      uebernehmen(gespeichert)
      return true
    } catch (e: any) {
      setFehler(e instanceof CirsFehler ? e.message
        : e?.status === 0 ? T.keinNetzSpeichern
          : e?.status === 403 || e?.status === 404 ? T.keinRecht
            : T.nichtGespeichert)
      return false
    }
  }, [ich?.id, ich?.name, uebernehmen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ein Schritt nach dem anderen: zwei gleichzeitige Lese-Schreib-Runden auf
  // derselben Meldung würden sich gegenseitig überschreiben
  const kette = useRef<Promise<unknown>>(Promise.resolve())
  const laufend = useRef(0)
  const speichern = useCallback((id: string, schritt: (b: Bearbeitung, s: Schritt) => Bearbeitung): Promise<boolean> => {
    laufend.current++
    setBeschaeftigt(true)
    const lauf = kette.current.then(() => ausfuehren(id, schritt)).finally(() => {
      laufend.current--
      if (laufend.current === 0) setBeschaeftigt(false)
    })
    kette.current = lauf.catch(() => undefined)
    return lauf
  }, [ausfuehren])

  // Solange eine Meldung offen ist, ist die Liste dahinter nicht erreichbar,
  // weder für die Tastatur noch für den Screenreader (React 18 kennt inert nicht als Prop)
  const liste = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = liste.current
    if (!el) return
    if (offen) el.setAttribute('inert', '')
    else el.removeAttribute('inert')
  }, [!!offen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nach dem Schließen den Fokus dorthin zurück, woher man kam
  const zuletztFokus = useRef<HTMLElement | null>(null)
  function schliessen() {
    const zurueck = zuletztFokus.current
    setOffenId(null)
    if (zurueck) setTimeout(() => zurueck.focus(), 0)
  }

  /** Eine Meldung öffnen und dabei frisch holen, damit niemand auf altem Stand arbeitet. */
  function oeffnen(id: string) {
    zuletztFokus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setFehlerRoh((f) => (f?.id === id ? f : null))
    setOffenId(id)
    pb.collection('cirs_reports').getOne<CirsDatensatz>(id, { requestKey: null })
      .then((rec) => { if (!laufend.current) uebernehmen(rec) })
      .catch(() => { /* bleibt beim geladenen Stand; Speichern prüft ohnehin frisch */ })
  }

  function meldungDrucken(f: CirsFall, mitMelder: boolean) {
    if (!druckFensterOeffnen(cirsSeite(f, { mitMelder, gedruckt: { von: ich?.name, am: new Date() }, bezeichnung: anzeige.eigene }))) {
      setFehlerRoh({ id: f.id, text: T.druckBlockiert })
    }
  }

  const grenzen = zeitraumGrenzen(zeitraum, heute)
  const imBereich = useMemo(() => imZeitraum(faelle, grenzen.von, grenzen.bis), [faelle, zeitraum, heute]) // eslint-disable-line react-hooks/exhaustive-deps
  const auswertung = useMemo(() => auswerten(imBereich, heute, grenzen), [imBereich, heute]) // eslint-disable-line react-hooks/exhaustive-deps

  function csvLaden() {
    const tag = tagText(new Date().toISOString().slice(0, 10)).replace(/\./g, '-')
    herunterladen(`CIRS-${tag}.csv`, csv(sichtbar, heute, { bezeichnung: anzeige.eigene }), 'text/csv;charset=utf-8')
    hinweisZeigen(exportiertText(sichtbar.length))
  }

  function auswertungDrucken() {
    const html = auswertungSeite(auswertung, sortieren(imBereich, heute), { zeitraum: grenzen.name, organisation: orgName, gedruckt: { von: ich?.name, am: new Date() } })
    if (!druckFensterOeffnen(html)) hinweisZeigen(T.druckBlockiert, true)
  }

  // ── Darstellung ───────────────────────────────────────────────────────────

  if (user && !darf) return <Notiz>{T.vertraulich}</Notiz>
  if (!orgId) return <Notiz>{user ? T.orgFehlt : T.laedt}</Notiz>

  const gefiltert = !!(suche || kategorie || schwere)
  const leerText = faelle.length === 0 ? T.keineMeldungen
    : gefiltert ? T.keinTreffer
      : ansicht === 'ueberfaellig' ? T.nichtsUeberfaellig
        : ansicht === 'neu' ? T.keineNeuen
          : ansicht === 'meine' ? T.keineMeinen
            : T.keineInAnsicht

  return (
    <div>
      <style>{EIN_CSS}</style>
      <div ref={liste}>
        <div className="bv-segmente" role="group" aria-label={T.bereiche}>
          {([['liste', T.meldungen], ['auswertung', T.auswertung]] as [Bereich, string][]).map(([b, name]) => (
            <button key={b} type="button" className="bv-seg" aria-pressed={bereich === b} onClick={() => setBereich(b)}>{name}</button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          {ladefehler ? (
            <div role="alert" className="ein-meldung fehler">
              <span>{ladefehler}</span>
              <button type="button" onClick={laden}>{T.erneutLaden}</button>
            </div>
          ) : null}
          {hinweis ? (
            <div role={hinweis.fehler ? 'alert' : 'status'} className={`ein-meldung ${hinweis.fehler ? 'fehler' : 'ok'}`}>
              <span>{hinweis.text}</span>
              {hinweis.fehler ? <button type="button" onClick={() => setHinweis(null)}>{T.schliessen}</button> : null}
            </div>
          ) : null}
          {fehler && fehler.id !== offenId ? (
            <div role="alert" className="ein-meldung fehler">
              <span>{faelle.find((f) => f.id === fehler.id)?.nummer ?? 'Meldung'}: {fehler.text}</span>
              <button type="button" onClick={() => oeffnen(fehler.id)}>{T.oeffnen}</button>
              <button type="button" onClick={() => setFehlerRoh(null)}>{T.schliessen}</button>
            </div>
          ) : null}
        </div>

        {bereich === 'liste' && (
          <>
            <Feld label={T.ansicht} erst>
              <Auswahl value={ansicht} onChange={(v) => setAnsicht(v as Ansicht)}>
                {ANSICHTEN.map((a) => <option key={a.wert} value={a.wert}>{`${a.name} (${zahlen[a.wert]})`}</option>)}
              </Auswahl>
            </Feld>
            {zahlen.ueberfaellig > 0 && ansicht !== 'ueberfaellig' ? (
              <div className="bv-flaeche vg-abstand">
                <Zeile titel={ueberfaelligText(zahlen.ueberfaellig)} unter="Frist der Meldung oder einer Maßnahme verstrichen" art="akzent" pfeil onClick={() => setAnsicht('ueberfaellig')} />
              </div>
            ) : null}

            <div className="bv-suche" style={{ marginTop: 14 }}>
              <VgIcon n="suche" className="bv-klein" />
              <input
                type="text" enterKeyHint="search" value={suche} onChange={(e) => setSuche(e.target.value)}
                placeholder={T.suchePlatzhalter} aria-label={T.sucheAria} autoComplete="off"
              />
              {suche ? <button type="button" aria-label={T.sucheLeeren} onClick={() => setSuche('')}><VgIcon n="kreuz" className="bv-klein" /></button> : null}
            </div>
            <div className="ein-raster">
              <Feld label={anzeige.kern.kategorie?.label ?? T.kategorie}>
                <Auswahl value={kategorie} onChange={setKategorie}>
                  <option value="">{T.alleKategorien}</option>
                  {KATEGORIEN.map((k) => <option key={k.wert} value={k.wert}>{k.name}</option>)}
                </Auswahl>
              </Feld>
              <Feld label={anzeige.kern.schwere?.label ?? T.schweregrad}>
                <Auswahl value={schwere} onChange={setSchwere}>
                  <option value="">{T.alleSchweregrade}</option>
                  {SCHWEREGRADE.map((s) => <option key={s.wert} value={s.wert}>{s.name}</option>)}
                </Auswahl>
              </Feld>
            </div>

            <Abschnitt
              titel={laedt ? T.laedt : meldungenText(sichtbar.length)}
              rechts={(
                <>
                  {gefiltert && !laedt ? (
                    <button type="button" className="vg-textknopf" onClick={() => { setSuche(''); setKategorie(''); setSchwere('') }}>{T.filterZurueck}</button>
                  ) : null}
                  <button type="button" className="vg-textknopf" onClick={csvLaden} disabled={!sichtbar.length}>{T.csv}</button>
                </>
              )}
            />
            <div className="bv-flaeche">
              {!laedt && sichtbar.length === 0 ? <Leer>{leerText}</Leer> : null}
              {sichtbar.map((f) => <MeldungZeile key={f.id} fall={f} heute={heute} onOeffnen={() => oeffnen(f.id)} />)}
            </div>
          </>
        )}

        {bereich === 'auswertung' && (
          <AuswertungAnsicht a={auswertung} zeitraum={zeitraum} setZeitraum={setZeitraum} name={grenzen.name} onDrucken={auswertungDrucken} laedt={laedt} />
        )}
      </div>

      {offen && (
        <CirsDetail
          fall={offen}
          personen={personen}
          ich={ich}
          heute={heute}
          speichern={(schritt) => speichern(offen.id, schritt)}
          beschaeftigt={beschaeftigt}
          fehler={fehler?.id === offen.id ? fehler.text : ''}
          onSchliessen={schliessen}
          onDrucken={(mitMelder) => meldungDrucken(offen, mitMelder)}
          anzeige={anzeige}
        />
      )}
    </div>
  )
}

function MeldungZeile({ fall: f, heute, onOeffnen }: { fall: CirsFall; heute: Date; onOeffnen: () => void }) {
  const b = f.bearbeitung
  const ueber = istUeberfaellig(f, heute)
  const zu = istAbgeschlossen(b.phase)
  const offene = offeneMassnahmen(b).length
  const datum = tagText(f.meldung.datum)
  const prio = zu ? '' : prioText(fallPrioritaet(f))
  const zeile1 = [datum && `Ereignis ${datum}`, f.meldung.ort, `eingegangen ${wieLange(f.eingang, heute)}`].filter(Boolean).join(' · ')
  const zeile3 = [
    f.nummer,
    b.zustaendig ? b.zustaendig.name : zu ? '' : T.niemandZustaendig,
    b.frist && !zu ? `Frist ${tagText(b.frist)}` : '',
    b.massnahmen.length ? `Maßnahmen ${b.massnahmen.length - offene} von ${b.massnahmen.length}` : '',
    prio,
  ].filter(Boolean).join(' · ')
  return (
    <Zeile
      titel={kategorieText(geltendeKategorie(f))} onClick={onOeffnen} pfeil
      label={`${f.nummer}, ${kategorieText(geltendeKategorie(f))}`}
      unter={(
        <>
          <span className="ein-block">{zeile1}</span>
          {f.meldung.was ? <span className="ein-block ein-zwei">{f.meldung.was}</span> : null}
          <span className="ein-block" style={{ marginTop: 3 }}>{zeile3}</span>
        </>
      )}
      rechts={<PhaseWort phase={b.phase} ueberfaellig={ueber} />}
    />
  )
}

function ZahlZeile({ titel, unter, wert }: { titel: string; unter: string; wert: string | number }) {
  return <Zeile titel={titel} unter={unter} rechts={wert === '' ? undefined : <span className="ein-zahl">{wert}</span>} />
}

/** Waagerechte Balken, Wert am Balkenende: eine Reihe, eine Farbe. */
function Balken({ titel, reihe }: { titel: string; reihe: { name: string; anzahl: number }[] }) {
  const max = Math.max(1, ...reihe.map((r) => r.anzahl))
  return (
    <section>
      <h3 className="bv-gruppe">{titel}</h3>
      <div className="bv-flaeche">
        <div className="ein-balken" role="table" aria-label={titel}>
          {reihe.map((r) => (
            <div key={r.name} role="row" style={{ display: 'contents' }}>
              <span role="rowheader">{r.name}</span>
              <div role="cell">
                <i style={{ width: `${(r.anzahl / max) * 85}%`, minWidth: r.anzahl ? 3 : 0 }} />
                <b className={r.anzahl ? undefined : 'null'}>{r.anzahl}</b>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AuswertungAnsicht({ a, zeitraum, setZeitraum, name, onDrucken, laedt }: {
  a: ReturnType<typeof auswerten>; zeitraum: Zeitraum; setZeitraum: (z: Zeitraum) => void; name: string; onDrucken: () => void; laedt: boolean
}) {
  return (
    <>
      <div className="ein-raster">
        <Feld label={T.zeitraum} erst>
          <Auswahl value={zeitraum} onChange={(v) => setZeitraum(v as Zeitraum)}>
            <option value="12m">Letzte 12 Monate</option>
            <option value="jahr">Dieses Jahr</option>
            <option value="vorjahr">Vorjahr</option>
            <option value="alle">Gesamter Zeitraum</option>
          </Auswahl>
        </Feld>
      </div>
      <Hinweis>{name} · {T.nachEingang}</Hinweis>

      <Abschnitt titel="Zahlen" rechts={<button type="button" className="vg-textknopf" onClick={onDrucken} disabled={laedt}>{T.berichtDrucken}</button>} />
      <div className="bv-flaeche">
        <ZahlZeile titel="Meldungen" unter="im Zeitraum eingegangen" wert={a.gesamt} />
        <ZahlZeile titel="In Bearbeitung" unter={a.ueberfaellig ? `davon ${a.ueberfaellig} überfällig` : 'nichts überfällig'} wert={a.offen} />
        <ZahlZeile titel="Abgeschlossen" unter={a.keinHandlungsbedarf ? `davon ${a.keinHandlungsbedarf} ohne Handlungsbedarf` : 'Bearbeitung beendet'} wert={a.abgeschlossen + a.keinHandlungsbedarf} />
        <ZahlZeile titel="Dauer" unter={a.mittlereDauerTage === null ? 'noch nichts abgeschlossen' : 'Tage bis zum Abschluss im Mittel'} wert={a.mittlereDauerTage === null ? '' : String(a.mittlereDauerTage).replace('.', ',')} />
        <ZahlZeile titel="Maßnahmen" unter={`${a.massnahmen.erledigt} von ${a.massnahmen.gesamt} erledigt`} wert={a.massnahmen.erledigt} />
      </div>

      {a.gesamt === 0 ? (
        <div className="bv-flaeche vg-abstand"><Leer>{T.imZeitraumNichts}</Leer></div>
      ) : (
        <>
          <Balken titel="Nach Kategorie" reihe={a.nachKategorie} />
          <Balken titel="Nach Schweregrad" reihe={a.nachSchwere} />
          {a.nachMonat.length > 1 ? <Balken titel="Eingang nach Monat" reihe={a.nachMonat} /> : null}
        </>
      )}
    </>
  )
}
