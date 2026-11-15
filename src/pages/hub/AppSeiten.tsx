// Die Apps im Hub auf Seiten zum Wischen.
//
// Der Hub rollt nicht (CLAUDE.md, „Statische Seiten“). Die Kacheln füllen den Platz unter der
// Überschrift „Apps“; wie viele Reihen hineinpassen, misst ein ResizeObserver. Passen nicht alle,
// stehen sie auf Seiten nebeneinander: wischen (CSS scroll-snap, so wie das Gerät es kann) oder
// die Pfeile darunter, dazwischen ein Punkt je Seite. Pfeile und Punkte gibt es nur bei mehr als
// einer Seite. Nach Drehen oder „Apps anpassen“ bleibt die Seite, auf der man war, so gut es geht.
// Die Rechnung steht in src/lib/hubSeiten.ts (mit Prüffällen), die Maße in HUB_CSS.
//
// Notausgang (sehr wenig Höhe, Seitenzoom, Zoom 400 %): Passt nicht einmal eine ganze Reihe, stehen
// alle Apps untereinander auf einer Seite, ohne Pfeile und Punkte, und die Seite meldet das
// (onRolltInnen). Der Hub lässt dann das Blatt unter dem Kopf innen rollen (Seite rolltInnen);
// das Dokument bleibt fest. Gemessen wird so, dass es in beiden Fällen dieselbe Zahl ergibt (der
// Platz von hier bis zum unteren Innenrand des Blatts), sonst könnte es hin und her springen.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { aufSeiten, kachelHoehe, seiteAusScroll, seiteBegrenzen, seiteNachUmbau, seitenPlan, spaltenFuerBreite } from '../../lib/hubSeiten'
import { Icon } from '../benutzer/bausteine'
import { Kachel } from './Kacheln'

interface Mass { hoehe: number; weite: number; fenster: number }

/**
 * Freie Höhe für die Seiten: von der Oberkante des Rahmens bis zum unteren Innenrand des Blatts.
 * Hängt nicht davon ab, ob das Blatt gerade innen rollt (Notausgang) oder wie weit.
 */
function freieHoehe(rahmen: HTMLElement): number {
  const r = rahmen.getBoundingClientRect()
  const blatt = rahmen.closest<HTMLElement>('.bv-blatt')
  if (!blatt) return r.height
  const b = blatt.getBoundingClientRect()
  const unten = parseFloat(getComputedStyle(blatt).paddingBottom) || 0
  return b.top + blatt.clientTop + blatt.clientHeight - unten - (r.top + blatt.scrollTop)
}

export default function AppSeiten({ ids, befristetBis, start = 0, onSeite, onRolltInnen }: {
  ids: string[]
  /** Ende einer befristeten Freigabe (ms) oder 0 */
  befristetBis: (id: string) => number
  /** Seite beim Öffnen, z. B. zurück aus „Apps anpassen“ */
  start?: number
  /** Meldet die gezeigte Seite (der Hub merkt sie sich) */
  onSeite?: (seite: number) => void
  /** Meldet den Notausgang: true, wenn nicht einmal eine Reihe passt und das Blatt innen rollen muss */
  onRolltInnen?: (ja: boolean) => void
}) {
  const rahmen = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const zurueckRef = useRef<HTMLButtonElement>(null)
  const weiterRef = useRef<HTMLButtonElement>(null)
  const [mass, setMass] = useState<Mass | null>(null)
  const [seite, setSeite] = useState(start)

  // Freie Höhe messen: vor dem ersten Bild und danach bei jeder Größenänderung (auch des Blatts und
  // der Überschrift darüber, die im Notausgang ihre Größe nicht über den Rahmen verraten)
  useLayoutEffect(() => {
    const el = rahmen.current
    if (!el) return
    const messen = () => {
      const r = el.getBoundingClientRect()
      const neu = { hoehe: Math.floor(freieHoehe(el)), weite: Math.round(r.width), fenster: window.innerWidth }
      setMass((m) => (m && m.hoehe === neu.hoehe && m.weite === neu.weite && m.fenster === neu.fenster ? m : neu))
    }
    messen()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(messen) : null
    for (const z of [el, el.parentElement, el.closest('.bv-blatt')]) if (z) ro?.observe(z)
    window.addEventListener('resize', messen)
    return () => { ro?.disconnect(); window.removeEventListener('resize', messen) }
  }, [])

  // Spalten und Kachelgröße folgen der Fensterbreite wie die Media Queries in HUB_CSS
  const fenster = mass?.fenster ?? window.innerWidth
  const bis = new Map(ids.map((id) => [id, befristetBis(id)] as const))
  const kachel = kachelHoehe(fenster, [...bis.values()].some((b) => b > 0))
  const plan = seitenPlan({ anzahl: ids.length, hoehe: mass?.hoehe ?? 0, spalten: spaltenFuerBreite(fenster), kachel })
  const seiten = aufSeiten(ids, plan.proSeite)
  const anzahl = seiten.length
  const aktuell = seiteBegrenzen(seite, anzahl)

  const seiteRef = useRef(aktuell)
  seiteRef.current = aktuell
  const anzahlRef = useRef(anzahl)
  anzahlRef.current = anzahl
  const meldenRef = useRef(onSeite)
  meldenRef.current = onSeite
  const innenRef = useRef(onRolltInnen)
  innenRef.current = onRolltInnen

  // Notausgang melden (vor dem Zeichnen, damit der Rahmen im selben Bild umschaltet). Zurück im
  // Normalfall steht das Blatt wieder oben; beim Abbau (keine Apps mehr, „Apps anpassen“) gilt er nicht mehr.
  const innen = !!mass && !plan.passt
  useLayoutEffect(() => {
    if (!mass) return
    if (!innen) {
      const blatt = rahmen.current?.closest<HTMLElement>('.bv-blatt')
      if (blatt && blatt.scrollTop) blatt.scrollTop = 0
    }
    innenRef.current?.(innen)
  }, [innen, !!mass]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => () => innenRef.current?.(false), [])

  // Nach einem Umbau (Größe, Seitenzahl) ohne Bewegung auf die richtige Seite stellen. Hängt nicht an
  // der Seite selbst: Beim Wischen setzt das Band die Seite, hier würde es sonst zurückspringen.
  const vorherProSeite = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = band.current
    if (!mass || !el) return
    const alt = vorherProSeite.current
    vorherProSeite.current = plan.proSeite
    const soll = alt != null && alt !== plan.proSeite
      ? seiteNachUmbau(seiteRef.current, alt, plan.proSeite, anzahl)
      : seiteBegrenzen(seiteRef.current, anzahl)
    const links = soll * el.clientWidth
    if (Math.abs(el.scrollLeft - links) > 1) el.scrollLeft = links
    if (soll !== seite) setSeite(soll)
  }, [mass, plan.proSeite, anzahl]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { meldenRef.current?.(aktuell) }, [aktuell])

  // Die Seite aus der Lage des Bands, höchstens einmal je Bild. Während ein Pfeil blättert,
  // zählt erst das Ziel (sonst springen die Punkte unterwegs zurück).
  const geplant = useRef(0)
  const ziel = useRef<{ seite: number; bis: number } | null>(null)
  useEffect(() => () => cancelAnimationFrame(geplant.current), [])
  function beimScrollen() {
    if (geplant.current) return
    geplant.current = requestAnimationFrame(() => {
      geplant.current = 0
      const el = band.current
      if (!el) return
      const n = seiteAusScroll(el.scrollLeft, el.clientWidth, anzahlRef.current)
      const z = ziel.current
      if (z) {
        if (n !== z.seite && Date.now() < z.bis) return
        ziel.current = null
      }
      setSeite(n)
    })
  }

  function blaettern(richtung: -1 | 1) {
    const el = band.current
    if (!el) return
    const n = seiteBegrenzen(aktuell + richtung, anzahl)
    if (n === aktuell) return
    const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    ziel.current = { seite: n, bis: Date.now() + 1000 }
    el.scrollTo({ left: n * el.clientWidth, behavior: ruhig ? 'auto' : 'smooth' })
    setSeite(n)
    // Am Ende wird der gedrückte Pfeil gesperrt: Fokus auf den anderen, damit er nicht verloren geht
    // (erst nach dem Zeichnen, vorher ist der andere womöglich noch gesperrt)
    const gedrueckt = richtung < 0 ? zurueckRef.current : weiterRef.current
    if (document.activeElement === gedrueckt && (n === 0 || n === anzahl - 1)) fokusNach.current = richtung < 0 ? 'weiter' : 'zurueck'
  }
  const fokusNach = useRef<'zurueck' | 'weiter' | null>(null)
  useLayoutEffect(() => {
    const f = fokusNach.current
    if (!f) return
    fokusNach.current = null
    ;(f === 'zurueck' ? zurueckRef : weiterRef).current?.focus()
  })

  const raster: CSSProperties = { gridTemplateColumns: `repeat(${plan.spalten}, minmax(0, 1fr))`, gridAutoRows: `${kachel}px` }
  const mehrere = anzahl > 1

  return (
    <div className="hub-seiten-rahmen" ref={rahmen}>
      <div className="hub-seiten" ref={band} data-probe="hub-seiten" data-seiten={anzahl} data-seite={aktuell} data-rollt-innen={innen ? '' : undefined}
        onScroll={beimScrollen} onPointerDown={() => { ziel.current = null }}>
        {seiten.map((liste, i) => (
          <div key={i} className="hub-seite" data-probe="hub-seite" style={raster}
            role={mehrere ? 'group' : undefined} aria-label={mehrere ? `Seite ${i + 1} von ${anzahl}` : undefined}>
            {liste.map((id) => <Kachel key={id} id={id} bis={bis.get(id) ?? 0} />)}
          </div>
        ))}
      </div>
      {mehrere && (
        <div className="hub-steuerung">
          <button ref={zurueckRef} type="button" className="hub-blaettern" aria-label="Vorherige Seite" data-probe="hub-pfeil-links"
            disabled={aktuell === 0} onClick={() => blaettern(-1)}>
            <Icon n="zurueck" />
          </button>
          <div className="hub-punkte" aria-hidden="true" data-probe="hub-punkte">
            {seiten.map((_, i) => <i key={i} className={i === aktuell ? 'an' : undefined} />)}
          </div>
          <button ref={weiterRef} type="button" className="hub-blaettern" aria-label="Nächste Seite" data-probe="hub-pfeil-rechts"
            disabled={aktuell === anzahl - 1} onClick={() => blaettern(1)}>
            <Icon n="weiter" />
          </button>
          <span className="hub-sr" aria-live="polite" aria-atomic="true">Seite {aktuell + 1} von {anzahl}</span>
        </div>
      )}
    </div>
  )
}
