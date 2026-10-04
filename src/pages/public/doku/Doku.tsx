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

import { Suspense, lazy, useMemo, useState } from 'react'
import { useOrg } from '../OrgPublicLayout'
import { AELRD_ABSCHNITTE, aelrdFeld, type AelrdFeld } from '../../../katalog/aelrd'
import { istSpiegelFeld } from '../../../katalog/aelrdSpiegel'
import { normalbefund, uebergabeUebernehmen, uebernahmeUmfang } from '../../../katalog/uebernahme'
import DokuFeld, { Rasterzelle, istRasterfeld, type Werte } from './DokuFeld'
import Reiter, { type ReiterStand } from './Reiter'
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

function Block({ id, titel, felder, werte, setzen, aktion }: {
  id: string
  titel: string
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
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'hidden', marginBottom: 10, scrollMarginTop: 108 }}
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
          {inBloecke(felder).map((gruppe, i) =>
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
                    <DokuFeld feld={f} werte={werte} setzen={setzen} />
                    {/* Die Fläche zum Unterschreiben gehört an das Feld, das
                        sie trägt — nicht ans Ende des Blocks. */}
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
  const [aktiverBlock, setAktiverBlock] = useState('stammdaten')
  const [pdfOffen, setPdfOffen] = useState(false)

  const setzen = (id: string, w: unknown) => setWerte((v) => ({ ...v, [id]: w }))
  // Alle Blöcke des Bogens, in seiner Reihenfolge. Was keine Felder hat,
  // bekommt auch keinen Reiter.
  const bloecke = useMemo(
    () =>
      AELRD_ABSCHNITTE
        .map((a) => ({ id: a.id, titel: a.titel, felder: felderVon(a.id) }))
        .filter((b) => b.felder.length > 0),
    [],
  )

  // Was die Reiter am Rand zeigen: je Block, wie viele Pflichtfelder noch
  // offen sind und wie viel überhaupt eingetragen wurde.
  const staende: ReiterStand[] = bloecke.map((b) => {
    const pflicht = b.felder.filter((f) => f.pflicht)
    return {
      id: b.id,
      kurz: AELRD_ABSCHNITTE.find((a) => a.id === b.id)?.kurz ?? b.id.slice(0, 4).toUpperCase(),
      titel: b.titel,
      pflichtGesamt: pflicht.length,
      pflichtOffen: pflicht.filter((f) => !gefuellt(werte[f.id])).length,
      gefuellt: b.felder.filter((f) => gefuellt(werte[f.id])).length,
    }
  })

  /** Den Reiter wechseln. */
  function zumBlock(id: string) {
    setAktiverBlock(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reihenfolge = staende.map((r) => r.id)
  const stelle = reihenfolge.indexOf(aktiverBlock)
  const voriger = stelle > 0 ? reihenfolge[stelle - 1] : undefined
  const naechster = stelle >= 0 && stelle < reihenfolge.length - 1 ? reihenfolge[stelle + 1] : undefined
  const aktuell = bloecke.find((b) => b.id === aktiverBlock)

  // Fortschritt über alle Felder, die der Bogen führt.
  const imWeg = bloecke.flatMap((b) => b.felder)
  const fertig = imWeg.filter((f) => gefuellt(werte[f.id])).length
  const pflichtOffen = imWeg.filter((f) => f.pflicht && !gefuellt(werte[f.id]))

  // Die beiden Abkürzungen, die den größten Teil des Tippens sparen.
  const offeneUebernahme = uebernahmeUmfang(werte)
  const aktionFuer = (id: string): { text: string; onClick: () => void } | null => {
    if (id === 'stammdaten') {
      return { text: 'Gesundheitskarte einlesen (Rückseite)', onClick: () => setKartenScan(true) }
    }
    if (id === 'erstbefund') {
      return {
        text: 'Normalbefund — alles unauffällig',
        onClick: () => setWerte((v) => ({ ...normalbefund(), ...v })),
      }
    }
    if ((id === 'uebergabe_befund' || id === 'uebergabe_neuro') && offeneUebernahme > 0) {
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

      <main style={{ padding: '12px 14px 12px 0', maxWidth: 830, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Reiter staende={staende} aktiv={aktiverBlock} onWaehlen={zumBlock} />
        <div style={{ flex: 1, minWidth: 0 }}>
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

            {aktuell ? (
          <>
            <Block
              id={aktuell.id} titel={aktuell.titel} felder={aktuell.felder}
              werte={werte} setzen={setzen} aktion={aktionFuer(aktuell.id)}
            />

            {/* Weiter von Zettel zu Zettel, ohne an den Rand greifen zu müssen. */}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button
                type="button" disabled={!voriger}
                onClick={() => voriger && zumBlock(voriger)}
                style={{ flex: 1, padding: '11px 12px', background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 12, color: voriger ? GRAU : 'transparent', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: voriger ? 'pointer' : 'default' }}
              >
                ‹ Zurück
              </button>
              <button
                type="button" disabled={!naechster}
                onClick={() => naechster && zumBlock(naechster)}
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
