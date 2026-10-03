// Patientendokumentation, neu aufgebaut.
//
// Das alte Formular führt durch 20 Schritte mit zusammen 579 Feldern und
// knapp 30.000 Pixeln Scrollhöhe — gemessen auf einem Telefon. Ein Einsatz
// braucht davon selten ein Drittel, aber jeder muss an allem vorbei.
//
// Hier entscheidet der Anlass, was im Weg steht. Alles andere bleibt einen
// Tipp entfernt, und die Reihenfolge bleibt die des Papierbogens: wer ihn
// kennt, findet alles an derselben Stelle.
//
// VORSCHAU: Diese Seite speichert nichts. Sie zeigt den Aufbau, damit er
// beurteilt werden kann, bevor er die Dokumentation ersetzt.

import { Suspense, lazy, useMemo, useState } from 'react'
import { useOrg } from '../OrgPublicLayout'
import { AELRD_ABSCHNITTE, aelrdFeld, type AelrdFeld } from '../../../katalog/aelrd'
import { istSpiegelFeld } from '../../../katalog/aelrdSpiegel'
import { ANLAESSE, abschnitteFuer, weitereAbschnitte } from '../../../katalog/anlass'
import { normalbefund, uebergabeUebernehmen, uebernahmeUmfang } from '../../../katalog/uebernahme'
import DokuFeld, { Rasterzelle, istRasterfeld, type Werte } from './DokuFeld'
import Reiter, { type ReiterStand } from './Reiter'

// Kamera und Texterkennung werden erst geladen, wenn jemand die Karte
// fotografieren will — sie gehören nicht in den Weg der übrigen Erfassung.
const KartenScan = lazy(() => import('./KartenScan'))

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

function Block({ id, titel, felder, werte, setzen, offen, umschalten, aktion }: {
  id: string
  titel: string
  felder: AelrdFeld[]
  werte: Werte
  setzen: (id: string, w: unknown) => void
  offen: boolean
  umschalten: () => void
  /** Eine Abkürzung, die diesen Block auf einmal füllt. */
  aktion?: { text: string; onClick: () => void } | null
}) {
  const ausgefuellt = felder.filter((f) => gefuellt(werte[f.id])).length
  return (
    <section
      id={`doku-${id}`}
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'hidden', marginBottom: 10, scrollMarginTop: 108 }}
    >
      <button
        type="button" onClick={umschalten}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', background: 'transparent', border: 'none', borderBottom: offen ? `0.5px solid ${LINIE}` : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
          {titel}
        </span>
        <span style={{ fontSize: 11, fontStyle: 'italic', color: ausgefuellt > 0 ? ROT : GRAU }}>
          {ausgefuellt > 0 ? `${ausgefuellt}/${felder.length}` : `${felder.length}`}
        </span>
        <span aria-hidden style={{ color: GRAU, fontSize: 12, transform: offen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>

      {offen ? (
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
                  <DokuFeld key={f.id} feld={f} werte={werte} setzen={setzen} />
                ))}
              </div>
            ),
          )}
        </div>
      ) : null}
    </section>
  )
}

export default function Doku() {
  const { org } = useOrg()
  const [anlaesse, setAnlaesse] = useState<string[]>([])
  const [werte, setWerte] = useState<Werte>({})
  const [zu, setZu] = useState<string[]>([])
  const [alleZeigen, setAlleZeigen] = useState(false)
  const [suche, setSuche] = useState('')
  const [kartenScan, setKartenScan] = useState(false)
  const [aktiverBlock, setAktiverBlock] = useState('')

  const setzen = (id: string, w: unknown) => setWerte((v) => ({ ...v, [id]: w }))
  const anlassUmschalten = (id: string) =>
    setAnlaesse((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  const hauptweg = useMemo(() => abschnitteFuer(anlaesse), [anlaesse])
  const weitere = useMemo(() => weitereAbschnitte(anlaesse), [anlaesse])

  const zuZeigen = alleZeigen ? AELRD_ABSCHNITTE.map((a) => a.id) : hauptweg
  const bloecke = zuZeigen
    .map((id) => ({ id, titel: AELRD_ABSCHNITTE.find((a) => a.id === id)?.titel ?? id, felder: felderVon(id) }))
    .filter((b) => b.felder.length > 0)

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

  /** Einen Block aufklappen und hinspringen. */
  function zumBlock(id: string) {
    setZu((v) => v.filter((x) => x !== id))
    setAktiverBlock(id)
    // Erst nach dem Aufklappen springen, sonst steht die Höhe noch nicht fest.
    window.requestAnimationFrame(() => {
      document.getElementById(`doku-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Fortschritt über den Hauptweg, nicht über den ganzen Bogen: was der
  // Anlass nicht verlangt, fehlt auch nicht.
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
        </div>
        <div style={{ height: 3, background: 'rgba(96,8,18,0.08)', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${imWeg.length ? (fertig / imWeg.length) * 100 : 0}%`, background: ROT, transition: 'width .2s' }} />
        </div>
      </header>

      <main style={{ padding: '12px 14px 12px 0', maxWidth: 830, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Reiter staende={staende} aktiv={aktiverBlock} onWaehlen={zumBlock} />
        <div style={{ flex: 1, minWidth: 0 }}>
        {/* Anlass ─ was der Einsatz ist, entscheidet, was gefragt wird. */}
        <section style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, padding: '11px 12px 8px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT, marginBottom: 2 }}>
            Anlass
          </div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginBottom: 8 }}>
            Mehrfachauswahl. Er blendet nur aus — alles bleibt erreichbar.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 7 }}>
            {ANLAESSE.map((a) => {
              const an = anlaesse.includes(a.id)
              return (
                <button
                  key={a.id} type="button" onClick={() => anlassUmschalten(a.id)}
                  style={{
                    textAlign: 'left', padding: '9px 11px', borderRadius: 10,
                    background: an ? ROT : '#fff', color: an ? '#fff' : TEXT,
                    border: `0.5px solid ${an ? ROT : LINIE}`, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{a.titel}</div>
                  <div style={{ fontSize: 10.5, fontStyle: 'italic', color: an ? 'rgba(255,255,255,0.75)' : GRAU, marginTop: 1, lineHeight: 1.3 }}>
                    {a.beispiel}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Suche ─ der Ausweg, wenn ein Feld nicht im Hauptweg steht. */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="search" value={suche} onChange={(e) => setSuche(e.target.value)}
            placeholder="Feld suchen, z. B. Pupillen"
            style={{ width: '100%', padding: '9px 11px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 999, fontFamily: 'inherit', fontSize: 14, color: TEXT, boxSizing: 'border-box' }}
          />
          {treffer.length > 0 ? (
            <div style={{ background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
              {treffer.map(({ feld, abschnitt }) => (
                <a
                  key={feld.id} href={`#doku-${abschnitt.id}`}
                  onClick={() => { setAlleZeigen(true); setZu((v) => v.filter((x) => x !== abschnitt.id)); setSuche('') }}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 11px', borderBottom: '0.5px solid rgba(96,8,18,0.06)', color: TEXT, textDecoration: 'none', fontSize: 13 }}
                >
                  <span>{feld.label}</span>
                  <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'right' }}>{abschnitt.titel}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {bloecke.map((b) => (
          <Block
            key={b.id} id={b.id} titel={b.titel} felder={b.felder} werte={werte} setzen={setzen}
            aktion={aktionFuer(b.id)}
            offen={!zu.includes(b.id)}
            umschalten={() => setZu((v) => (v.includes(b.id) ? v.filter((x) => x !== b.id) : [...v, b.id]))}
          />
        ))}

        {!alleZeigen && weitere.length > 0 ? (
          <button
            type="button" onClick={() => setAlleZeigen(true)}
            style={{ width: '100%', padding: '11px 12px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 12, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            {weitere.length} weitere Blöcke zeigen
          </button>
        ) : null}

        {alleZeigen ? (
          <button
            type="button" onClick={() => setAlleZeigen(false)}
            style={{ width: '100%', padding: '11px 12px', background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 12, color: GRAU, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            Nur die Blöcke zum Anlass
          </button>
        ) : null}
        </div>
      </main>

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
