// Patientendokumentation, neu aufgebaut.
//
// Das alte Formular führt durch 20 Schritte mit zusammen 579 Feldern und
// knapp 30.000 Pixeln Scrollhöhe — gemessen auf einem Telefon. Ein Einsatz
// braucht davon selten ein Drittel, aber jeder muss an allem vorbei.
//
// Hier steht ein Block zur Zeit, gewechselt wird über die Zettel am linken
// Rand. Ihre Farbe sagt, wo noch Pflichtfelder offen sind. Die Reihenfolge
// ist die des Papierbogens: wer ihn kennt, findet alles an derselben Stelle.
//
// VORSCHAU: Diese Seite speichert nichts. Sie zeigt den Aufbau, damit er
// beurteilt werden kann, bevor er die Dokumentation ersetzt.

import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useOrg } from '../OrgPublicLayout'
import { AELRD_ABSCHNITTE, aelrdFeld, type AelrdFeld } from '../../../katalog/aelrd'
import { istSpiegelFeld } from '../../../katalog/aelrdSpiegel'
import { offeneErwartung, offenePflicht, pflichtKarte, type Stand } from '../../../katalog/pflicht'
import { normalbefund, uebergabeUebernehmen, uebernahmeUmfang } from '../../../katalog/uebernahme'
import DokuFeld, { Rasterzelle, gefuellt, istRasterfeld, type Werte } from './DokuFeld'
import {
  entwurfLesen, entwurfSchreiben, entwurfVerwerfen, standText,
} from './entwurf'
import Reiter, { ampel, type ReiterStand } from './Reiter'
import { zettelMitFeldern, type ZettelTeil } from './zettel'
import Unterschrift from './Unterschrift'
import Besatzung from './Besatzung'
import Massnahmen from './Massnahmen'
import Verlauf from './Verlauf'
import Adresse from './Adresse'
import Gcs from './Gcs'
import Pupillen from './Pupillen'
import Zeitstrahl from './Zeitstrahl'
import { adresseSetzen } from './adresse'
import Tracerdiagnose, { FuehrendeDiagnose } from './Tracerdiagnose'
import { diagnoseSetzen, gruppeSetzen, gruppeVormerken } from './diagnose'
import { MASSNAHMEN_FELDER } from '../../../katalog/massnahmenArten'
import { zeitstrahlFelder } from './zeitstrahl'
import { gcsFelder, gcsSkalen } from '../../../katalog/gcs'
import { pupillenFelder } from '../../../katalog/pupillen'
import { besatzungSetzen, type Besetzung, type Posten } from './besatzung'

// Kamera und Texterkennung werden erst geladen, wenn jemand die Karte
// fotografieren will — sie gehören nicht in den Weg der übrigen Erfassung.
const KartenScan = lazy(() => import('./KartenScan'))

// Die Druckansicht zieht beide Seitenvorlagen nach sich — erst beim Öffnen.
const PdfAnsicht = lazy(() => import('./PdfAnsicht'))

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

function felderVon(abschnittId: string): AelrdFeld[] {
  const a = AELRD_ABSCHNITTE.find((x) => x.id === abschnittId)
  if (!a) return []
  return a.felder
    .filter((id) => !istSpiegelFeld(id))
    .map(aelrdFeld)
    .filter(Boolean) as AelrdFeld[]
}

/**
 * Aufeinanderfolgende Zahlenfelder zu einem Raster zusammenfassen.
 *
 * `imRaster` entscheidet, was ins Raster darf. Ein Feld mit eigener Maske
 * gehört nicht hinein — sonst stünde dort die nackte Zahl, und die Maske
 * käme nie zum Zug.
 */
function inBloecke(
  felder: AelrdFeld[],
  imRaster: (f: AelrdFeld) => boolean = istRasterfeld,
): { raster: boolean; felder: AelrdFeld[] }[] {
  const aus: { raster: boolean; felder: AelrdFeld[] }[] = []
  for (const f of felder) {
    const r = imRaster(f)
    const letzter = aus[aus.length - 1]
    if (letzter && letzter.raster === r) letzter.felder.push(f)
    else aus.push({ raster: r, felder: [f] })
  }
  return aus
}

function Block({ id, titel, teile, zeigeSchritt, felder, werte, setzen, aktion, ersatz, ersatzFeld, vorweg, uebernommen, verlangt }: {
  id: string
  titel: string
  /** Die Abschnitte des Bogens, die auf diesem Zettel zusammenstehen. */
  teile: ZettelTeil[]
  /**
   * Die Überschrift des Schrittes zeigen.
   *
   * Gezeigt wird immer nur ein Schritt, `teile` hat also einen Eintrag — an
   * seiner Länge lässt sich nicht mehr ablesen, ob der Zettel mehrere hat.
   * Ohne die Überschrift stünde der Buchstabe nirgends.
   */
  zeigeSchritt: boolean
  felder: AelrdFeld[]
  werte: Werte
  setzen: (id: string, w: unknown) => void
  /** Eine Abkürzung, die diesen Block auf einmal füllt. */
  aktion?: { text: string; onClick: () => void } | null
  /**
   * Teile, die statt ihrer Felder eine eigene Maske zeigen.
   *
   * Die Besatzung ist mehr als vier Namen: an ihr hängt, wer das Protokoll
   * später wiederfindet. Vier Textfelder könnten das nicht leisten.
   */
  ersatz?: Record<string, React.ReactNode>
  /**
   * Einzelne Felder, die eine eigene Maske zeigen.
   *
   * Der Bogen führt die Tracerdiagnose als Schreiblinie; gewählt wird sie
   * aber aus Gruppen. Das Feld bleibt dasselbe, nur die Bedienung nicht.
   */
  ersatzFeld?: Record<string, React.ReactNode>
  /** Masken, die über den Feldern eines Teils stehen. */
  vorweg?: Record<string, React.ReactNode>
  /**
   * Felder, die eine eigene Maske über dem Block führt.
   *
   * Sie zählen weiter zum Block — die Maske schreibt sie ja —, erscheinen
   * aber nicht noch einmal einzeln.
   */
  uebernommen?: Set<string>
  /** Welche Angaben dieses Protokoll gerade verlangt. */
  verlangt?: Map<string, Stand>
}) {
  const ausgefuellt = felder.filter((f) => gefuellt(werte[f.id])).length
  return (
    <section
      id={`doku-${id}`}
      // `overflow: clip` statt `hidden`: beides schneidet an den runden Ecken
      // ab, aber `hidden` macht den Block zum Scrollbehälter und setzt damit
      // die mitlaufenden Zwischenüberschriften außer Kraft.
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'clip', marginBottom: 10, scrollMarginTop: 108 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '11px 12px', borderBottom: `0.5px solid ${LINIE}` }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
          {titel}
        </h2>
        <span style={{ fontSize: 11, fontStyle: 'italic', color: ausgefuellt > 0 ? ROT : GRAU }}>
          {ausgefuellt > 0 ? `${ausgefuellt}/${felder.length}` : `${felder.length}`}
        </span>
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
          {aktion ? (
            <button
              type="button" onClick={aktion.onClick}
              style={{ width: '100%', padding: '9px 12px', marginBottom: 12, background: 'rgba(96,8,18,0.05)', border: `0.5px solid ${LINIE}`, borderRadius: 8, color: ROT, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {aktion.text}
            </button>
          ) : null}
          {/* Gezeigt wird immer genau ein Schritt; welcher, entscheidet die
              zweite Zettelreihe am Rand. */}
          {teile
            // Ein Teil, dessen Felder alle an eine eigene Maske gegangen
            // sind, hinterließe sonst eine Überschrift ohne Inhalt.
            .filter((teil) => ersatz?.[teil.id] || vorweg?.[teil.id]
              || teil.felder.some((f) => !uebernommen?.has(f.id)))
            .map((teil) => (
            <div key={teil.id} style={{ marginBottom: 4 }}>
              {zeigeSchritt ? (
                <div style={{
                  // Bleibt beim Scrollen stehen: auf einem Zettel mit fast
                  // fünfzig Feldern verliert man sonst, wo man gerade ist.
                  position: 'sticky', top: 62, zIndex: 5,
                  background: '#fff', margin: '10px -12px 7px', padding: '7px 12px 5px',
                  display: 'flex', alignItems: 'baseline', gap: 8,
                  borderBottom: `0.5px solid ${LINIE}`,
                }}>
                  {teil.kennung ? (
                    // Der Buchstabe des Schemas, groß genug zum Abarbeiten.
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, flexShrink: 0, borderRadius: 11,
                      background: ROT, color: '#fff',
                      fontSize: 12, fontWeight: 800, lineHeight: 1,
                    }}>
                      {teil.kennung}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
                    {teil.titel}
                  </span>
                </div>
              ) : null}
              {vorweg?.[teil.id] ?? null}
              {ersatz?.[teil.id] ?? inBloecke(
                teil.felder.filter((f) => !uebernommen?.has(f.id)),
                (f) => istRasterfeld(f) && !ersatzFeld?.[f.id],
              ).map((gruppe, i) =>
                gruppe.raster ? (
                  <div key={i} style={{
                      display: 'grid',
                      // Neunzig statt sechsundneunzig: mit der zweiten Zettelreihe ist der
                      // Kasten zwanzig Pixel schmaler, und bei sechsundneunzig fiel das
                      // Raster dort von drei auf zwei Spalten. Eine dreistellige Zahl
                      // braucht bei Schriftgroesse 19 rund zweiunddreissig Pixel, dazu
                      // Innenrand und die Einheit am rechten Rand.
                      gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginBottom: 12 }}>
                    {gruppe.felder.map((f) => (
                      <Rasterzelle key={f.id} feld={f} werte={werte} setzen={setzen} stand={verlangt?.get(f.id)} />
                    ))}
                  </div>
                ) : (
                  <div key={i}>
                    {gruppe.felder.map((f) => (
                      <div key={f.id}>
                        {ersatzFeld?.[f.id] ?? (
                          <DokuFeld
                            feld={f} werte={werte} setzen={setzen} stand={verlangt?.get(f.id)}
                            /*
                             * Trägt die Überschrift den Namen schon, wird er am
                             * Feld weggelassen — aber nur, solange dort nichts
                             * aussteht. Der Stern braucht eine Zeile, auf der
                             * er sitzen kann; ohne sie war die Pflicht bei x,
                             * A und B unsichtbar.
                             */
                            ohneBeschriftung={
                              Boolean(teil.kennung) && teil.felder.length === 1
                              && !(verlangt?.get(f.id) && !verlangt.get(f.id)!.erfuellt)
                            }
                          />
                        )}
                        {/* Die Fläche zum Unterschreiben gehört an das Feld,
                            das sie trägt — nicht ans Ende des Blocks. */}
                        {f.id === 'unterschrift' ? (
                          <Unterschrift
                            wert={String(werte.signature ?? '')}
                            onChange={(d) => setzen('signature', d)}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          ))}
      </div>
    </section>
  )
}

export default function Doku() {
  const { org, orgCode } = useOrg()
  /*
   * Der Entwurf aus dem Gerät wird gleich beim Aufbau gelesen, nicht in einem
   * Effekt: sonst stünde die Maske einen Augenblick leer da, und ein Tippen
   * in dieser Lücke ginge gegen den leeren Stand.
   */
  const [werte, setWerte] = useState<Werte>(
    () => entwurfLesen(window.localStorage, orgCode)?.werte ?? {},
  )
  /** Der Stand des wiederhergestellten Entwurfs — bis er weggetippt wird. */
  const [wiederhergestellt, setWiederhergestellt] = useState(
    () => entwurfLesen(window.localStorage, orgCode)?.stand ?? '',
  )
  /** Wenn das Gerät nichts behalten will, muss die Maske es sagen. */
  const [sichertNicht, setSichertNicht] = useState(false)
  const [suche, setSuche] = useState('')
  const [kartenScan, setKartenScan] = useState(false)
  /**
   * Ein Block zur Zeit. Gewechselt wird über die Reiter am Rand, nicht durch
   * Scrollen: wer dokumentiert, soll die Stelle ansteuern, nicht suchen.
   */
  const [aktiverBlock, setAktiverBlock] = useState('patient')
  const [pdfOffen, setPdfOffen] = useState(false)
  /** Welcher Schritt des aktiven Zettels gezeigt wird. */
  const [aktiverTeil, setAktiverTeil] = useState('')

  /*
   * Nach jeder Änderung in den Speicher des Geräts — kurz verzögert, damit
   * beim Tippen nicht jeder Buchstabe schreibt.
   */
  useEffect(() => {
    const uhr = setTimeout(() => {
      const ging = entwurfSchreiben(window.localStorage, orgCode, werte)
      setSichertNicht(!ging)
    }, 400)
    return () => clearTimeout(uhr)
  }, [werte, orgCode])

  /*
   * Was dieses Protokoll verlangt, hängt an ihm selbst: ein Fehleinsatz
   * braucht keine Vitalwerte, ein Transport eine Übergabezeit. Deshalb wird
   * die Liste bei jeder Änderung neu bestimmt, nicht einmal festgeschrieben.
   */
  const verlangt = useMemo(() => pflichtKarte(werte), [werte])

  const setzen = (id: string, w: unknown) => setWerte((v) => ({ ...v, [id]: w }))
  /** Die Felder, die die Maßnahmen-Maske schreibt — sie stehen dort, nicht einzeln. */
  const uebernommeneFelder = useMemo(
    // Der Zeitstrahl führt die Zeiten selbst; darunter stünden sie ein
    // zweites Mal.
    // Das GCS-Schema führt seine vier Felder selbst; einzeln stünden dort
    // vier Zahlen ohne die Antworten, zu denen sie gehören.
    () => new Set([
      ...MASSNAHMEN_FELDER, ...zeitstrahlFelder(),
      // Erstbefund und Übergabe führen beide GCS und Pupillen; die Masken
      // stehen jeweils an der Stelle des ersten Feldes, der Rest entfällt.
      ...['', 'ub_'].flatMap((v) => [
        ...gcsFelder(v).filter((f) => f !== gcsSkalen(v)[0].feld),
        ...pupillenFelder(v).slice(1),
      ]),
    ]),
    [],
  )
  /**
   * Einen Posten der Besatzung besetzen.
   *
   * Geschrieben werden zwei Dinge auf einmal — der Name für den Bogen und die
   * Benutzerkennung für die Einsicht in Unitas. Deshalb geht das nicht über
   * `setzen`, das nur ein Feld kennt.
   */
  const besetzen = (pos: Posten['pos'], person: Besetzung | null) =>
    setWerte((v) => besatzungSetzen(v, pos, person))
  // Die Zettel, wie sie in zettel.ts gebündelt sind.
  const bloecke = useMemo(() => zettelMitFeldern(), [])

  // Was die Reiter am Rand zeigen: je Block, wie viele Pflichtfelder noch
  // offen sind und wie viel überhaupt eingetragen wurde.
  const staende: ReiterStand[] = bloecke.map((b) => {
    const pflicht = b.felder.filter((f) => verlangt.get(f.id)?.stufe === 'pflicht')
    return {
      id: b.id,
      kurz: b.kurz,
      titel: b.titel,
      pflichtGesamt: pflicht.length,
      pflichtOffen: pflicht.filter((f) => !verlangt.get(f.id)?.erfuellt).length,
      gefuellt: b.felder.filter((f) => gefuellt(werte[f.id])).length,
    }
  })

  /** Den Zettel wechseln — und beim ersten Schritt darin anfangen. */
  function zumBlock(id: string) {
    setAktiverBlock(id)
    setAktiverTeil('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Einen Schritt innerhalb des Zettels wechseln. */
  function zumSchritt(id: string) {
    setAktiverTeil(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Alle Stationen der Reihe nach: jeder Zettel mit seinen Schritten.
   *
   * "Zurück" und "Weiter" gehen damit durch die Schritte und erst am Ende
   * eines Zettels zum nächsten — durchgeklickt wird Schritt für Schritt.
   */
  const stationen = bloecke.flatMap((b) =>
    b.gruppen && b.teile.length > 1
      ? b.teile.map((t) => ({ zettel: b.id, teil: t.id }))
      : [{ zettel: b.id, teil: '' }],
  )
  const aktuell = bloecke.find((b) => b.id === aktiverBlock)

  /**
   * Die Schritte des aktiven Zettels als zweite Reihe.
   *
   * Es gibt kein "Alle": durchgeklickt wird bewusst, Schritt für Schritt.
   * Wer alles auf einmal sehen will, nimmt die Lupe.
   */
  // Die zweite Reihe gibt es nur, wo ein Zettel einem Schema folgt — derzeit
  // allein der Erstbefund mit xABCDE. Die uebrigen zeigen ihre Abschnitte
  // untereinander, wie bisher.
  const schrittweise = Boolean(aktuell?.gruppen)
  const schritte: ReiterStand[] = (schrittweise ? aktuell?.teile ?? [] : []).map((t) => {
    const pflicht = t.felder.filter((f) => verlangt.get(f.id)?.stufe === 'pflicht')
    return {
      id: t.id,
      kurz: t.kurz,
      titel: t.titel,
      pflichtGesamt: pflicht.length,
      pflichtOffen: pflicht.filter((f) => !verlangt.get(f.id)?.erfuellt).length,
      gefuellt: t.felder.filter((f) => gefuellt(werte[f.id])).length,
    }
  })
  const gezeigterTeil = schritte.some((s) => s.id === aktiverTeil) ? aktiverTeil : schritte[0]?.id ?? ''
  const hier = stationen.findIndex(
    (s) => s.zettel === aktiverBlock && (s.teil === gezeigterTeil || s.teil === ''),
  )
  const voriger = hier > 0 ? stationen[hier - 1] : undefined
  const naechster = hier >= 0 && hier < stationen.length - 1 ? stationen[hier + 1] : undefined

  function zuStation(s: { zettel: string; teil: string }) {
    setAktiverBlock(s.zettel)
    setAktiverTeil(s.teil)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const teileZumZeigen = schrittweise
    ? (aktuell?.teile ?? []).filter((t) => schritte.length <= 1 || t.id === gezeigterTeil)
    : aktuell?.teile ?? []

  // Fortschritt über alle Felder, die der Bogen führt.
  const imWeg = bloecke.flatMap((b) => b.felder)
  const fertig = imWeg.filter((f) => gefuellt(werte[f.id])).length
  const pflichtOffen = offenePflicht(werte)
  const erwartungOffen = offeneErwartung(werte)

  // Die beiden Abkürzungen, die den größten Teil des Tippens sparen.
  const offeneUebernahme = uebernahmeUmfang(werte)
  const aktionFuer = (id: string): { text: string; onClick: () => void } | null => {
    if (id === 'patient') {
      return { text: 'Gesundheitskarte einlesen (Rückseite)', onClick: () => setKartenScan(true) }
    }
    if (id === 'befund') {
      // Der Normalbefund füllt den ganzen Zettel, nicht den Schritt. Beim
      // Zeitpunkt steht er darum richtig — er geht dem Schema voraus. Über
      // "x" oder "B" sagte derselbe Knopf etwas anderes, als er tut, und
      // wiederholte sich auf jedem der sechs Schritte.
      if (teileZumZeigen.some((t) => t.kennung)) return null
      return {
        text: 'Normalbefund — alles unauffällig',
        onClick: () => setWerte((v) => ({ ...normalbefund(), ...v })),
      }
    }
    if (id === 'uebergabe' && offeneUebernahme > 0) {
      return {
        text: `Erstbefund übernehmen (${offeneUebernahme} Angaben)`,
        onClick: () => setWerte((v) => uebergabeUebernehmen(v)),
      }
    }
    return null
  }

  /**
   * Zu welchem Zettel ein Abschnitt des Bogens gehört.
   *
   * Die Suche kennt nur Abschnitte; Zettel bündeln aber mehrere davon. Ohne
   * diese Zuordnung landete ein Treffer aus dem zweiten Abschnitt eines
   * Zettels auf einem Reiter, den es nicht gibt — die Seite blieb leer.
   */
  const zettelVonAbschnitt = useMemo(() => {
    const zu: Record<string, string> = {}
    for (const z of bloecke) for (const a of z.abschnitte) zu[a] = z.id
    return zu
  }, [bloecke])

  const treffer = useMemo(() => {
    const s = suche.trim().toLowerCase()
    if (s.length < 2) return []
    return AELRD_ABSCHNITTE.flatMap((a) =>
      felderVon(a.id)
        .filter((f) => f.label.toLowerCase().includes(s))
        .map((f) => ({ feld: f, abschnitt: a })),
    ).slice(0, 12)
  }, [suche])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)', paddingBottom: 40 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: `0.5px solid ${LINIE}`, padding: '9px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Patientendokumentation</div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {org.org_name} · {fertig} von {imWeg.length} Feldern
              {pflichtOffen.length > 0 ? ` · ${pflichtOffen.length} Pflichtangaben offen` : ''}
              {pflichtOffen.length === 0 && erwartungOffen.length > 0 ? ` · ${erwartungOffen.length} erwartet` : ''}
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d97706', border: '0.5px solid #fde047', background: '#fffbeb', borderRadius: 999, padding: '3px 8px' }}>
            Vorschau
          </span>

          {/* Das Protokoll ansehen, wie es gedruckt aussieht. */}
          <button
            type="button" onClick={() => setPdfOffen(true)}
            aria-label="Protokoll als PDF ansehen" title="Protokoll als PDF ansehen"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, flexShrink: 0, borderRadius: 19,
              background: '#fff', border: `0.5px solid ${LINIE}`, color: ROT,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.3-4.3" />
            </svg>
          </button>
        </div>
        <div style={{ height: 3, background: 'rgba(96,8,18,0.08)', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${imWeg.length ? (fertig / imWeg.length) * 100 : 0}%`, background: ROT, transition: 'width .2s' }} />
        </div>
      </header>

      {/* Die Suche steht über beiden Leisten, nicht neben ihnen: sonst läge
          der oberste Schrittzettel auf ihr und verdeckte den Anfang. */}
      <div style={{ padding: '12px 14px 0', maxWidth: 830, margin: '0 auto' }}>
        {/* Die Suche bleibt immer sichtbar: sie ist der Weg zu einem Feld,
            dessen Block man nicht im Kopf hat. */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="search" value={suche} onChange={(e) => setSuche(e.target.value)}
            placeholder="Feld suchen, z. B. Pupillen"
            style={{ width: '100%', padding: '9px 11px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 999, fontFamily: 'inherit', fontSize: 14, color: TEXT, boxSizing: 'border-box' }}
          />
          {/* Was das Gerät behalten hat — sichtbar, nicht heimlich. */}
        {wiederhergestellt ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 11px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 10 }}>
            <span style={{ flex: 1, fontSize: 12, fontStyle: 'italic', color: TEXT, lineHeight: 1.4 }}>
              Entwurf von diesem Gerät wiederhergestellt — Stand {standText(wiederhergestellt)}.
            </span>
            <button
              type="button"
              onClick={() => {
                entwurfVerwerfen(window.localStorage, orgCode)
                setWerte({})
                setWiederhergestellt('')
              }}
              style={{ background: 'none', border: 'none', color: ROT, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              verwerfen
            </button>
            <button
              type="button" onClick={() => setWiederhergestellt('')} aria-label="Hinweis schließen"
              style={{ background: 'none', border: 'none', color: GRAU, fontSize: 18, lineHeight: 1, padding: '0 2px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ×
            </button>
          </div>
        ) : null}
        {sichertNicht ? (
          <div style={{ marginBottom: 10, padding: '8px 11px', background: '#fffbeb', border: '0.5px solid #fde047', borderRadius: 10, fontSize: 12, fontStyle: 'italic', color: '#854d0e', lineHeight: 1.45 }}>
            Dieses Gerät behält nichts — bei einem Neuladen wäre die Eingabe weg.
            Privates Fenster oder abgeschaltete Website-Daten?
          </div>
        ) : null}
        {treffer.length > 0 ? (
            <div style={{ background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
              {treffer.map(({ feld, abschnitt }) => (
                <button
                  key={feld.id} type="button"
                  // Die Suche wechselt den Reiter.
                  onClick={() => { setSuche(''); zumBlock(zettelVonAbschnitt[abschnitt.id] ?? abschnitt.id) }}
                  style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '9px 11px', borderBottom: '0.5px solid rgba(96,8,18,0.06)', border: 'none', background: 'transparent', color: TEXT, textAlign: 'left', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <span>{feld.label}</span>
                  <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'right' }}>{abschnitt.titel}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <main style={{ padding: '10px 14px 12px 0', maxWidth: 830, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Reiter staende={staende} aktiv={aktiverBlock} onWaehlen={zumBlock} />
        {schritte.length > 1 ? (
          <Reiter
            staende={schritte} aktiv={gezeigterTeil} onWaehlen={zumSchritt}
            beschriftung={`Schritte: ${aktuell?.titel ?? ''}`} schmal ueberlagernd
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
        {aktuell ? (
          <>
            <Block
              id={aktuell.id} titel={aktuell.titel} teile={teileZumZeigen}
              zeigeSchritt={schritte.length > 1 || teileZumZeigen.length > 1}
              felder={aktuell.felder}
              werte={werte} setzen={setzen} aktion={aktionFuer(aktuell.id)}
              ersatz={{
                besatzung: <Besatzung orgId={org.id} werte={werte} onSetzen={besetzen} />,
                // Der Verlauf ist ein eigener Schritt des Maßnahmen-Zettels,
                // nicht eine Karte darüber: sonst stünde er auf jedem Schritt.
                'massnahmen-verlauf': <Massnahmen werte={werte} setWerte={setWerte} />,
                // Das Kurvenblatt: der Zettel führt keine Felder des Bogens,
                // sondern die Spalten des Verlaufs.
                verlauf: <Verlauf werte={werte} setWerte={setWerte} />,
              }}
              uebernommen={uebernommeneFelder}
              verlangt={verlangt}
              vorweg={{
                // Der Zeitstrahl rechnet die Kette der Statuszeiten und
                // bietet sie den Feldern darunter an.
                zeiten: <Zeitstrahl werte={werte} setWerte={setWerte} setzen={setzen} />,
              }}
              ersatzFeld={{
                // Das Schema steht an der Stelle des ersten GCS-Feldes.
                [gcsSkalen()[0].feld]: <Gcs werte={werte} setWerte={setWerte} />,
                // Der Pupillenstatus steht an der Stelle des ersten seiner
                // vier Felder.
                [pupillenFelder()[0]]: <Pupillen werte={werte} setWerte={setWerte} />,
                // Dieselben Masken für die Übergabe.
                [gcsSkalen('ub_')[0].feld]: <Gcs werte={werte} setWerte={setWerte} vorsatz="ub_" />,
                [pupillenFelder('ub_')[0]]: <Pupillen werte={werte} setWerte={setWerte} vorsatz="ub_" />,
                // Der Bogen führt je eine Schreiblinie; getippt wird in drei
                // Feldern, wie im alten Formular.
                transport_von: (
                  <Adresse
                    feld="transport_von" label="Transport von — Abfahrtsadresse" werte={werte}
                    onSetzen={(teil, w) => setWerte((v) => adresseSetzen(v, 'transport_von', teil, w))}
                  />
                ),
                transport_ziel: (
                  <Adresse
                    feld="transport_ziel" label="Transportziel — Adresse" werte={werte}
                    onSetzen={(teil, w) => setWerte((v) => adresseSetzen(v, 'transport_ziel', teil, w))}
                  />
                ),
                tracerdiagnose: (
                  <Tracerdiagnose
                    wert={String(werte.tracerdiagnose ?? '')}
                    // Setzt die Gruppe in der führenden Diagnose mit, solange
                    // dort nichts Eigenes steht.
                    onChange={(w) => setWerte((v) => diagnoseSetzen(v, w))}
                    // Schon die Gruppe genügt: sie steht damit auch als
                    // führende Diagnose, noch vor der Diagnose selbst.
                    onGruppe={(t) => setWerte((v) => gruppeVormerken(v, t))}
                  />
                ),
                fuehrende_diagnose: (
                  <FuehrendeDiagnose
                    wert={String(werte.fuehrende_diagnose ?? '')}
                    onChange={(w) => setWerte((v) => gruppeSetzen(v, w))}
                  />
                ),
              }}
            />

            {/* Weiter von Zettel zu Zettel, ohne an den Rand greifen zu müssen. */}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button
                type="button" disabled={!voriger}
                onClick={() => voriger && zuStation(voriger)}
                style={{ flex: 1, padding: '11px 12px', background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 12, color: voriger ? GRAU : 'transparent', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: voriger ? 'pointer' : 'default' }}
              >
                ‹ Zurück
              </button>
              <button
                type="button" disabled={!naechster}
                onClick={() => naechster && zuStation(naechster)}
                style={{ flex: 2, padding: '11px 12px', background: naechster ? ROT : 'rgba(96,8,18,0.2)', border: 'none', borderRadius: 12, color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: naechster ? 'pointer' : 'default' }}
              >
                Weiter ›
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: GRAU }}>
            Dieser Block führt keine Felder.
          </div>
        )}
        </div>
      </main>

      {pdfOffen ? (
        <Suspense fallback={null}>
          <PdfAnsicht
            werte={werte}
            organisation={org.org_name}
            onSchliessen={() => setPdfOffen(false)}
          />
        </Suspense>
      ) : null}

      {kartenScan ? (
        <Suspense fallback={null}>
          <KartenScan
            onSchliessen={() => setKartenScan(false)}
            onUebernehmen={(ausDerKarte) => {
              // Was schon im Formular steht, bleibt stehen: die Besatzung hat
              // es eingetragen, die Kamera hat es nur gelesen.
              setWerte((v) => {
                const aus = { ...v }
                for (const [id, wert] of Object.entries(ausDerKarte)) {
                  if (!gefuellt(aus[id])) aus[id] = wert
                }
                return aus
              })
              setKartenScan(false)
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
