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
import { normalbefund, uebergabeUebernehmen, uebernahmeUmfang } from '../../../katalog/uebernahme'
import DokuFeld, { Rasterzelle, istRasterfeld, type Werte } from './DokuFeld'
import Reiter, { ampel, type ReiterStand } from './Reiter'
import { zettelMitFeldern, type ZettelTeil } from './zettel'
import Unterschrift from './Unterschrift'

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

function gefuellt(w: unknown): boolean {
  if (w === undefined || w === null || w === '' || w === false) return false
  if (Array.isArray(w)) return w.length > 0
  return true
}

/** Aufeinanderfolgende Zahlenfelder zu einem Raster zusammenfassen. */
function inBloecke(felder: AelrdFeld[]): { raster: boolean; felder: AelrdFeld[] }[] {
  const aus: { raster: boolean; felder: AelrdFeld[] }[] = []
  for (const f of felder) {
    const r = istRasterfeld(f)
    const letzter = aus[aus.length - 1]
    if (letzter && letzter.raster === r) letzter.felder.push(f)
    else aus.push({ raster: r, felder: [f] })
  }
  return aus
}

function Block({ id, titel, teile, zeigeSchritt, felder, werte, setzen, aktion }: {
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
          {teile.map((teil) => (
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
              {inBloecke(teil.felder).map((gruppe, i) =>
                gruppe.raster ? (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8, marginBottom: 12 }}>
                    {gruppe.felder.map((f) => (
                      <Rasterzelle key={f.id} feld={f} werte={werte} setzen={setzen} />
                    ))}
                  </div>
                ) : (
                  <div key={i}>
                    {gruppe.felder.map((f) => (
                      <div key={f.id}>
                        <DokuFeld
                          feld={f} werte={werte} setzen={setzen}
                          // Trägt die Überschrift den Namen schon, wird er
                          // am Feld weggelassen.
                          ohneBeschriftung={Boolean(teil.kennung) && teil.felder.length === 1}
                        />
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
  const { org } = useOrg()
  const [werte, setWerte] = useState<Werte>({})
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

  const setzen = (id: string, w: unknown) => setWerte((v) => ({ ...v, [id]: w }))
  // Die Zettel, wie sie in zettel.ts gebündelt sind.
  const bloecke = useMemo(() => zettelMitFeldern(), [])

  // Was die Reiter am Rand zeigen: je Block, wie viele Pflichtfelder noch
  // offen sind und wie viel überhaupt eingetragen wurde.
  const staende: ReiterStand[] = bloecke.map((b) => {
    const pflicht = b.felder.filter((f) => f.pflicht)
    return {
      id: b.id,
      kurz: b.kurz,
      titel: b.titel,
      pflichtGesamt: pflicht.length,
      pflichtOffen: pflicht.filter((f) => !gefuellt(werte[f.id])).length,
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
    const pflicht = t.felder.filter((f) => f.pflicht)
    return {
      id: t.id,
      kurz: t.kurz,
      titel: t.titel,
      pflichtGesamt: pflicht.length,
      pflichtOffen: pflicht.filter((f) => !gefuellt(werte[f.id])).length,
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
  const pflichtOffen = imWeg.filter((f) => f.pflicht && !gefuellt(werte[f.id]))

  // Die beiden Abkürzungen, die den größten Teil des Tippens sparen.
  const offeneUebernahme = uebernahmeUmfang(werte)
  const aktionFuer = (id: string): { text: string; onClick: () => void } | null => {
    if (id === 'patient') {
      return { text: 'Gesundheitskarte einlesen (Rückseite)', onClick: () => setKartenScan(true) }
    }
    if (id === 'befund') {
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
              {pflichtOffen.length > 0 ? ` · ${pflichtOffen.length} Pflichtfelder offen` : ''}
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
          {treffer.length > 0 ? (
            <div style={{ background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
              {treffer.map(({ feld, abschnitt }) => (
                <button
                  key={feld.id} type="button"
                  // Die Suche wechselt den Reiter.
                  onClick={() => { setSuche(''); zumBlock(abschnitt.id) }}
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
