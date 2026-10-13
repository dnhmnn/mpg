// CIRS unter Vorgänge: die Meldungen der Organisation, ihre Bearbeitung und
// die Auswertung.
//
// Gespeichert wird immer auf dem frisch gelesenen Datensatz: erst holen, dann
// den Bearbeitungsschritt darauf anwenden, dann schreiben. So überschreibt
// niemand, was ein anderer inzwischen eingetragen hat, und die Angaben des
// Melders bleiben unberührt (siehe speicherDaten in lib/cirs).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { pb } from '../../lib/pocketbase'
import type { User } from '../../types'
import { hatRecht } from '../../lib/apps'
import {
  ANSICHTEN, KATEGORIEN, SCHWEREGRADE,
  auswerten, bearbeitungAus, CirsFehler, csv, fallAus, fallPrioritaet, filtern, geltendeKategorie, geltendeSchwere,
  imZeitraum, istAbgeschlossen, istUeberfaellig, kalendertag, kategorieName, offeneMassnahmen, schwereName, sortieren,
  speicherDaten, tagText, zaehlen,
  type Ansicht, type Bearbeitung, type CirsDatensatz, type CirsFall, type Person, type Schritt,
} from '../../lib/cirs'
import { auswertungSeite, cirsSeite, druckFensterOeffnen } from '../../lib/cirsDruck'
import CirsDetail from './CirsDetail'
import {
  PhaseMarke, PrioMarke, abschnittKopf, eingabe, karte, knopfLeise, knopfRand, pik, randFarbe, wieLange,
} from './cirsTeile'

interface Props {
  user: User | null
  orgId: string | null
  orgName?: string
  /** Eine Meldung, die gleich offen sein soll (Verweis aus dem Hub). */
  startMeldung?: string | null
  /** Meldet die Zahlen nach oben — für das Abzeichen am Reiter. */
  onZahlen?: (z: { neu: number; ueberfaellig: number }) => void
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

function herunterladen(name: string, inhalt: string, typ: string) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function CirsVerwaltung({ user, orgId, orgName, startMeldung, onZahlen }: Props) {
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
  // Ein Fehler gehört zu der Meldung, bei der er entstand — schließt man sie vorher, zeigt ihn die Liste
  const [fehler, setFehlerRoh] = useState<{ id: string; text: string } | null>(null)
  const [hinweis, setHinweis] = useState<{ text: string; fehler?: boolean } | null>(null)
  const hinweisZeigen = useCallback((text: string, istFehler = false) => {
    setHinweis({ text, fehler: istFehler })
    if (!istFehler) setTimeout(() => setHinweis((h) => (h?.text === text ? null : h)), 3500)
  }, [])

  // Der heutige Tag — bleibt die Seite über Mitternacht offen, zählt er weiter,
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
      setLadefehler(e?.status === 0 ? 'Keine Verbindung — die Meldungen konnten nicht geladen werden.' : 'Die Meldungen konnten nicht geladen werden.')
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

  // Der Stand, den die Ansicht zeigt — auch zwischen zwei Darstellungen aktuell,
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
        setFehler('Die Meldung wurde inzwischen von jemand anderem geändert. Hier steht jetzt der neue Stand — bitte prüfen und den Schritt bei Bedarf wiederholen.')
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
        : e?.status === 0 ? 'Keine Verbindung — nichts gespeichert. Bitte erneut versuchen.'
          : e?.status === 403 || e?.status === 404 ? 'Keine Berechtigung, diese Meldung zu bearbeiten.'
            : 'Speichern fehlgeschlagen. Bitte erneut versuchen.')
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

  // Solange eine Meldung offen ist, ist die Liste dahinter nicht erreichbar —
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

  /** Eine Meldung öffnen — und dabei frisch holen, damit niemand auf altem Stand arbeitet. */
  function oeffnen(id: string) {
    zuletztFokus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setFehlerRoh((f) => (f?.id === id ? f : null))
    setOffenId(id)
    pb.collection('cirs_reports').getOne<CirsDatensatz>(id, { requestKey: null })
      .then((rec) => { if (!laufend.current) uebernehmen(rec) })
      .catch(() => { /* bleibt beim geladenen Stand; Speichern prüft ohnehin frisch */ })
  }

  function meldungDrucken(f: CirsFall, mitMelder: boolean) {
    if (!druckFensterOeffnen(cirsSeite(f, { mitMelder, gedruckt: { von: ich?.name, am: new Date() } }))) {
      setFehlerRoh({ id: f.id, text: 'Das Druckfenster wurde blockiert. Bitte Pop-ups für Responda erlauben.' })
    }
  }

  const grenzen = zeitraumGrenzen(zeitraum, heute)
  const imBereich = useMemo(() => imZeitraum(faelle, grenzen.von, grenzen.bis), [faelle, zeitraum, heute]) // eslint-disable-line react-hooks/exhaustive-deps
  const auswertung = useMemo(() => auswerten(imBereich, heute, grenzen), [imBereich, heute]) // eslint-disable-line react-hooks/exhaustive-deps

  function csvLaden() {
    const tag = tagText(new Date().toISOString().slice(0, 10)).replace(/\./g, '-')
    herunterladen(`CIRS-${tag}.csv`, csv(sichtbar, heute), 'text/csv;charset=utf-8')
    hinweisZeigen(`${sichtbar.length} Meldung${sichtbar.length === 1 ? '' : 'en'} exportiert — ohne Melderangaben`)
  }

  function auswertungDrucken() {
    const html = auswertungSeite(auswertung, sortieren(imBereich, heute), { zeitraum: grenzen.name, organisation: orgName, gedruckt: { von: ich?.name, am: new Date() } })
    if (!druckFensterOeffnen(html)) hinweisZeigen('Das Druckfenster wurde blockiert. Bitte Pop-ups für Responda erlauben.', true)
  }

  // ── Darstellung ───────────────────────────────────────────────────────────

  const reiter = (
    <div style={{ display: 'flex', gap: 22, marginBottom: 16, borderBottom: '0.5px solid var(--lbf-border-light)' }}>
      {([['liste', 'Meldungen'], ['auswertung', 'Auswertung']] as [Bereich, string][]).map(([b, name]) => (
        <button key={b} onClick={() => setBereich(b)} aria-pressed={bereich === b}
          style={{
            padding: '4px 0 9px', marginBottom: -0.5, fontSize: 15, fontWeight: 700, fontStyle: 'italic', fontFamily: 'inherit', cursor: 'pointer',
            border: 'none', borderBottom: bereich === b ? '2px solid var(--lbf-akzent)' : '2px solid transparent', background: 'none',
            color: bereich === b ? 'var(--lbf-text)' : 'var(--warm-gray)',
          }}>{name}</button>
      ))}
    </div>
  )

  if (user && !darf) {
    return <div style={{ padding: '24px 16px', background: 'var(--lbf-card)', borderRadius: 12, textAlign: 'center', fontSize: 14, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
      CIRS-Meldungen sind vertraulich. Sie sind nur mit dem Recht für Vorgänge zu sehen.
    </div>
  }
  if (!orgId) {
    return <div style={{ padding: '24px 16px', background: 'var(--lbf-card)', borderRadius: 12, textAlign: 'center', fontSize: 14, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
      {user ? 'Die Organisation konnte nicht geladen werden. Bitte die Verbindung prüfen.' : 'Laden…'}
    </div>
  }

  return (
    <div>
      <div ref={liste}>
      {reiter}

      {ladefehler && (
        <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', color: 'var(--lbf-fehler-text)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>{ladefehler}</span>
          <button onClick={laden} style={{ ...knopfLeise, background: 'none', color: 'var(--lbf-fehler-text)' }}>Erneut laden</button>
        </div>
      )}
      {hinweis && (
        <div role={hinweis.fehler ? 'alert' : 'status'} style={{ background: hinweis.fehler ? 'var(--lbf-fehler-grund)' : 'var(--lbf-ok-grund)', color: hinweis.fehler ? 'var(--lbf-fehler-text)' : 'var(--lbf-ok-text)', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>{hinweis.text}</span>
          {hinweis.fehler && <button onClick={() => setHinweis(null)} style={{ ...knopfLeise, background: 'none', color: 'var(--lbf-fehler-text)' }}>Schließen</button>}
        </div>
      )}
      {fehler && fehler.id !== offenId && (
        <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', color: 'var(--lbf-fehler-text)', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>{faelle.find((f) => f.id === fehler.id)?.nummer ?? 'Meldung'}: {fehler.text}</span>
          <button onClick={() => oeffnen(fehler.id)} style={{ ...knopfLeise, background: 'none', color: 'var(--lbf-fehler-text)' }}>Öffnen</button>
          <button onClick={() => setFehlerRoh(null)} style={{ ...knopfLeise, background: 'none', color: 'var(--lbf-fehler-text)' }}>Schließen</button>
        </div>
      )}

      {bereich === 'liste' && (
        <>
          {/* Ansichten */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {ANSICHTEN.map((a) => {
              const aktiv = a.wert === ansicht
              const n = zahlen[a.wert]
              const warn = a.wert === 'ueberfaellig' && n > 0
              return (
                <button key={a.wert} onClick={() => setAnsicht(a.wert)} aria-pressed={aktiv}
                  style={{
                    flexShrink: 0, padding: '7px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                    border: aktiv ? '1px solid var(--lbf-akzent)' : '1px solid var(--lbf-border)', background: aktiv ? 'rgba(var(--lbf-rot-rgb),0.08)' : 'var(--lbf-card)',
                    color: aktiv ? 'var(--lbf-akzent)' : 'var(--lbf-text)', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  {a.name}
                  <span style={{ fontSize: 11, fontWeight: 800, minWidth: 18, padding: '0 5px', borderRadius: 99, textAlign: 'center',
                    background: warn ? 'var(--lbf-fehler-grund)' : 'rgba(var(--lbf-rot-rgb),0.07)', color: warn ? 'var(--lbf-fehler-text)' : 'var(--lbf-text)' }}>{n}</span>
                </button>
              )
            })}
          </div>

          {/* Suche und Filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen: Ort, Text, Nummer, Maßnahme …"
              aria-label="Meldungen durchsuchen" style={{ ...eingabe, flex: '3 1 220px', width: 'auto' }} />
            <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} aria-label="Kategorie" style={{ ...eingabe, flex: '1 1 140px', width: 'auto' }}>
              <option value="">Alle Kategorien</option>
              {KATEGORIEN.map((k) => <option key={k.wert} value={k.wert}>{k.name}</option>)}
            </select>
            <select value={schwere} onChange={(e) => setSchwere(e.target.value)} aria-label="Schweregrad" style={{ ...eingabe, flex: '1 1 120px', width: 'auto' }}>
              <option value="">Alle Schweregrade</option>
              {SCHWEREGRADE.map((s) => <option key={s.wert} value={s.wert}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px', gap: 10 }}>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
              {laedt ? 'Laden…' : `${sichtbar.length} Meldung${sichtbar.length === 1 ? '' : 'en'}`}
              {(suche || kategorie || schwere) && !laedt && (
                <button onClick={() => { setSuche(''); setKategorie(''); setSchwere('') }} style={{ ...knopfLeise, marginLeft: 8, background: 'none', padding: '2px 4px' }}>Filter zurücksetzen</button>
              )}
            </div>
            <button onClick={csvLaden} disabled={!sichtbar.length} style={{ ...knopfRand, padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: sichtbar.length ? 1 : 0.45 }}>
              {pik(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>, 14)}
              CSV
            </button>
          </div>

          {/* Liste */}
          {!laedt && sichtbar.length === 0 && (
            <div style={{ padding: '24px 16px', background: 'var(--lbf-card)', borderRadius: 12, border: '0.5px dashed rgba(var(--lbf-rot-rgb),0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                {faelle.length === 0 ? 'Noch keine CIRS-Meldungen eingegangen.'
                  : suche || kategorie || schwere ? 'Keine Meldung passt zu Suche und Filter.'
                    : ansicht === 'ueberfaellig' ? 'Nichts überfällig.'
                      : ansicht === 'neu' ? 'Keine neuen Meldungen.'
                        : ansicht === 'meine' ? 'Dir ist keine offene Meldung zugewiesen.'
                          : 'Keine Meldungen in dieser Ansicht.'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sichtbar.map((f) => <Zeile key={f.id} fall={f} heute={heute} onOeffnen={() => oeffnen(f.id)} />)}
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
        />
      )}
    </div>
  )
}

function Zeile({ fall: f, heute, onOeffnen }: { fall: CirsFall; heute: Date; onOeffnen: () => void }) {
  const b = f.bearbeitung
  const ueber = istUeberfaellig(f, heute)
  const zu = istAbgeschlossen(b.phase)
  const offene = offeneMassnahmen(b).length
  const ort = f.meldung.ort
  const datum = tagText(f.meldung.datum)
  return (
    <button onClick={onOeffnen} style={{
      ...karte, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: `3px solid ${randFarbe(b.phase, ueber)}`,
      padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%', overflow: 'hidden', display: 'block', color: 'inherit',
    }}>
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: zu ? 'var(--warm-gray)' : 'var(--lbf-text)', lineHeight: 1.25 }}>
              {kategorieName(geltendeKategorie(f))}
            </div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
              {[datum && `Ereignis ${datum}`, ort, `eingegangen ${wieLange(f.eingang, heute)}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <PhaseMarke phase={b.phase} />
            {!zu && <PrioMarke prio={fallPrioritaet(f)} />}
          </div>
        </div>
        {f.meldung.was && (
          <div style={{ fontSize: 13, color: 'var(--lbf-text)', marginTop: 8, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' } as React.CSSProperties}>
            {f.meldung.was}
          </div>
        )}
      </div>
      <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '7px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--warm-gray)' }}>
        <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>{f.nummer}</span>
        <span>{b.zustaendig ? b.zustaendig.name : zu ? '' : 'niemand zuständig'}</span>
        {b.frist && !zu && <span style={{ color: ueber ? 'var(--lbf-fehler-text-2)' : 'inherit', fontWeight: ueber ? 700 : 400 }}>Frist {tagText(b.frist)}</span>}
        {b.massnahmen.length > 0 && <span>Maßnahmen {b.massnahmen.length - offene}/{b.massnahmen.length}</span>}
        {schwereName(geltendeSchwere(f)) !== '—' && <span>{schwereName(geltendeSchwere(f))}</span>}
      </div>
    </button>
  )
}

function Kachel({ name, wert, text }: { name: string; wert: string | number; text: string }) {
  return (
    <div style={{ ...karte, padding: '14px 16px' }}>
      <div style={abschnittKopf}>{name}</div>
      <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--lbf-akzent)', lineHeight: 1 }}>{wert}</div>
      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6 }}>{text}</div>
    </div>
  )
}

/** Waagerechte Balken, Wert am Balkenende — eine Reihe, eine Farbe. */
function Balken({ titel, reihe }: { titel: string; reihe: { name: string; anzahl: number }[] }) {
  const max = Math.max(1, ...reihe.map((r) => r.anzahl))
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={abschnittKopf}>{titel}</div>
      <div style={{ ...karte, padding: '12px 16px' }} role="table" aria-label={titel}>
        {reihe.map((r) => (
          <div key={r.name} role="row" title={`${r.name}: ${r.anzahl}`}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 42%) 1fr', alignItems: 'center', gap: 10, padding: '5px 0' }}>
            <div role="rowheader" style={{ fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{r.name}</div>
            <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 10, width: `${(r.anzahl / max) * 85}%`, minWidth: r.anzahl ? 3 : 0, background: 'var(--lbf-akzent)', borderRadius: '0 4px 4px 0' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: r.anzahl ? 'var(--lbf-text)' : 'var(--warm-gray)' }}>{r.anzahl}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AuswertungAnsicht({ a, zeitraum, setZeitraum, name, onDrucken, laedt }: {
  a: ReturnType<typeof auswerten>; zeitraum: Zeitraum; setZeitraum: (z: Zeitraum) => void; name: string; onDrucken: () => void; laedt: boolean
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={zeitraum} onChange={(e) => setZeitraum(e.target.value as Zeitraum)} aria-label="Zeitraum" style={{ ...eingabe, width: 'auto', flex: '1 1 180px' }}>
          <option value="12m">Letzte 12 Monate</option>
          <option value="jahr">Dieses Jahr</option>
          <option value="vorjahr">Vorjahr</option>
          <option value="alle">Gesamter Zeitraum</option>
        </select>
        <button onClick={onDrucken} disabled={laedt} style={{ ...knopfRand, display: 'flex', alignItems: 'center', gap: 6 }}>
          {pik(<><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>, 15)}
          Bericht drucken
        </button>
      </div>
      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 12 }}>{name} · nach Eingang der Meldung</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Kachel name="Meldungen" wert={a.gesamt} text="im Zeitraum eingegangen" />
        <Kachel name="In Bearbeitung" wert={a.offen} text={a.ueberfaellig ? `davon ${a.ueberfaellig} überfällig` : 'nichts überfällig'} />
        <Kachel name="Abgeschlossen" wert={a.abgeschlossen + a.keinHandlungsbedarf} text={a.keinHandlungsbedarf ? `davon ${a.keinHandlungsbedarf} ohne Handlungsbedarf` : 'Bearbeitung beendet'} />
        <Kachel name="Dauer" wert={a.mittlereDauerTage ?? '—'} text="Tage bis zum Abschluss im Mittel" />
      </div>
      <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 18 }}>
        Maßnahmen: <strong style={{ color: 'var(--lbf-text)' }}>{a.massnahmen.erledigt}</strong> von <strong style={{ color: 'var(--lbf-text)' }}>{a.massnahmen.gesamt}</strong> erledigt
      </div>
      {a.gesamt === 0 ? (
        <div style={{ padding: '24px 16px', background: 'var(--lbf-card)', borderRadius: 12, border: '0.5px dashed rgba(var(--lbf-rot-rgb),0.2)', textAlign: 'center', fontSize: 14, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Im Zeitraum ist keine Meldung eingegangen.
        </div>
      ) : (
        <>
          <Balken titel="Nach Kategorie" reihe={a.nachKategorie} />
          <Balken titel="Nach Schweregrad" reihe={a.nachSchwere} />
          {a.nachMonat.length > 1 && <Balken titel="Eingang nach Monat" reihe={a.nachMonat} />}
        </>
      )}
    </div>
  )
}
