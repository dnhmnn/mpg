// Die Apps im Hub auf Seiten zum Wischen.
//
// Der Hub rollt nicht (CLAUDE.md, „Statische Seiten“). Die Kacheln füllen den Platz unter der
// Überschrift „Apps“; wie viele Reihen hineinpassen, misst ein ResizeObserver. Passen nicht alle,
// stehen sie auf Seiten nebeneinander: wischen (CSS scroll-snap, so wie das Gerät es kann) oder
// die Pfeile darunter, dazwischen ein Punkt je Seite. Pfeile und Punkte gibt es nur bei mehr als
// einer Seite. Nach Drehen oder „Apps anpassen“ bleibt die Seite, auf der man war, so gut es geht.
// Die Rechnung steht in src/lib/hubSeiten.ts (mit Prüffällen), die Maße in HUB_CSS.
//
// Fokus: Verteilt ein Umbau (Zoom, Drehen, Notausgang) die Apps neu, wandern Kacheln auf eine andere
// Seite, und React hängt sie dort neu ein. Hatte eine davon den Fokus, bekommt sie ihn zurück, und
// ihre Seite ist zu sehen; sonst stünde der Fokus auf body, und Tab finge vorn an.
//
// Notausgang (sehr wenig Höhe, Seitenzoom, Zoom 400 %): Passt nicht einmal eine ganze Reihe, stehen
// alle Apps untereinander auf einer Seite, ohne Pfeile und Punkte, und die Seite meldet das
// (onRolltInnen). Der Hub lässt dann Kopf und Blatt zusammen innen rollen (Seite rolltInnen); das
// Dokument bleibt fest. Gemessen wird so, dass es in beiden Fällen dieselbe Zahl ergibt (der Platz
// von hier bis zum unteren Innenrand des Blatts, wenn es den Rest des Bildschirms füllt), sonst
// könnte es hin und her springen.
//
// Luft im Kopf: Bleibt unter den Apps Platz, meldet die Seite einen Teil davon (onLuft); der Hub legt
// ihn zwischen Datum und Gruß und unter den Gruß (.hub-luft), die Apps rücken tiefer. Gemessen wird
// die Höhe ohne diese Luft (Rahmen plus die Höhe der .hub-luft im Kopf), sonst würde die Luft die
// Rechnung verschieben; so bleibt die Zahl gleich und kostet nie eine Reihe (src/lib/hubSeiten.ts).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react'
import { aufSeiten, kachelHoehe, kopfLuft, restHoehe, seiteAusScroll, seiteBegrenzen, seiteNachUmbau, seiteVon, seitenPlan, spaltenFuerPlatz } from '../../lib/hubSeiten'
import { Icon } from '../benutzer/bausteine'
import { Kachel } from './Kacheln'

interface Mass { hoehe: number; weite: number; fenster: number }

/**
 * Freie Höhe für die Seiten: von der Oberkante des Rahmens bis zum unteren Innenrand des Blatts, so
 * wie das Blatt ohne Notausgang den Rest unter dem Kopf füllt, also bis zum unteren Rand der Seite
 * (.bv, so hoch wie der Bildschirm) ohne die Reserve unten. Hängt nicht davon ab, ob die Seite gerade
 * innen rollt (Notausgang) oder wie weit.
 */
function freieHoehe(rahmen: HTMLElement): number {
  const r = rahmen.getBoundingClientRect()
  const blatt = rahmen.closest<HTMLElement>('.bv-blatt')
  const seite = blatt?.parentElement
  if (!blatt || !seite) return r.height
  const s = seite.getBoundingClientRect()
  const unten = parseFloat(getComputedStyle(blatt).paddingBottom) || 0
  return s.top + seite.clientTop + seite.clientHeight - unten - (r.top + seite.scrollTop)
}

/** Die Luft, die gerade im Kopf steht (Höhe der .hub-luft; 0, wenn sie ausgeblendet ist, etwa quer). */
function luftImKopf(rahmen: HTMLElement): number {
  let summe = 0
  for (const l of rahmen.closest('.bv')?.querySelectorAll<HTMLElement>('.hub-luft') ?? []) summe += l.getBoundingClientRect().height
  return summe
}

/** Die Kachel einer App im Band (ohne Selektor, damit keine Kennung maskiert werden muss). */
function kachelVon(band: HTMLElement | null, app: string): HTMLElement | null {
  if (!band) return null
  for (const k of band.querySelectorAll<HTMLElement>('[data-app]')) if (k.dataset.app === app) return k
  return null
}

export default function AppSeiten({ ids, befristetBis, start = 0, onSeite, onRolltInnen, onLuft }: {
  ids: string[]
  /** Ende einer befristeten Freigabe (ms) oder 0 */
  befristetBis: (id: string) => number
  /** Seite beim Öffnen, z. B. zurück aus „Apps anpassen“ */
  start?: number
  /** Meldet die gezeigte Seite (der Hub merkt sie sich) */
  onSeite?: (seite: number) => void
  /** Meldet den Notausgang: true, wenn nicht einmal eine Reihe passt und die Seite innen rollen muss */
  onRolltInnen?: (ja: boolean) => void
  /** Meldet die Luft für den Kopf (oben: zwischen Datum und Gruß, unten: unter dem Gruß), beim Abbau 0 */
  onLuft?: (luft: { oben: number; unten: number }) => void
}) {
  const rahmen = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const zurueckRef = useRef<HTMLButtonElement>(null)
  const weiterRef = useRef<HTMLButtonElement>(null)
  const [mass, setMass] = useState<Mass | null>(null)
  const [seite, setSeite] = useState(start)

  // Freie Höhe messen: vor dem ersten Bild und danach bei jeder Größenänderung (auch des Blatts, des
  // Kopfs und der Überschrift darüber, die im Notausgang ihre Größe nicht über den Rahmen verraten)
  useLayoutEffect(() => {
    const el = rahmen.current
    if (!el) return
    const messen = () => {
      const r = el.getBoundingClientRect()
      // Ohne die Luft im Kopf gemessen: die Rechnung hängt nicht davon ab, wie viel Luft gerade dort steht
      const neu = { hoehe: Math.floor(freieHoehe(el) + luftImKopf(el)), weite: Math.round(r.width), fenster: window.innerWidth }
      setMass((m) => (m && m.hoehe === neu.hoehe && m.weite === neu.weite && m.fenster === neu.fenster ? m : neu))
    }
    messen()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(messen) : null
    const blatt = el.closest('.bv-blatt')
    const kopf = blatt?.parentElement?.querySelector(':scope > .bv-kopf')
    for (const z of [el, el.parentElement, blatt, kopf]) if (z) ro?.observe(z)
    window.addEventListener('resize', messen)
    return () => { ro?.disconnect(); window.removeEventListener('resize', messen) }
  }, [])

  // Spalten und Kachelgröße folgen der Fensterbreite wie die Media Queries in HUB_CSS; wird der Platz
  // knapp (Seitenzoom, Ränder neben der Notch), weniger Spalten, damit kein Symbol über dem nächsten liegt
  const fenster = mass?.fenster ?? window.innerWidth
  const bis = new Map(ids.map((id) => [id, befristetBis(id)] as const))
  const kachel = kachelHoehe(fenster, [...bis.values()].some((b) => b > 0))
  const plan = seitenPlan({ anzahl: ids.length, hoehe: mass?.hoehe ?? 0, spalten: spaltenFuerPlatz(fenster, mass?.weite ?? 0), kachel })
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
  const luftRef = useRef(onLuft)
  luftRef.current = onLuft

  // Luft im Kopf aus dem Rest unter den Apps (vor dem Zeichnen gemeldet, im selben Bild); beim Abbau 0
  const luft = mass ? kopfLuft(restHoehe(plan, ids.length, mass.hoehe, kachel)) : null
  useLayoutEffect(() => {
    if (luft) luftRef.current?.(luft)
  }, [luft?.oben, luft?.unten]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => () => luftRef.current?.({ oben: 0, unten: 0 }), [])

  // Notausgang melden (vor dem Zeichnen, damit der Rahmen im selben Bild umschaltet). Zurück im
  // Normalfall steht die Seite (.bv, die im Notausgang rollt) wieder oben; beim Abbau (keine Apps
  // mehr, „Apps anpassen“) gilt er nicht mehr.
  const innen = !!mass && !plan.passt
  useLayoutEffect(() => {
    if (!mass) return
    if (!innen) {
      const s = rahmen.current?.closest<HTMLElement>('.bv-blatt')?.parentElement
      if (s && s.scrollTop) s.scrollTop = 0
    }
    innenRef.current?.(innen)
  }, [innen, !!mass]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const s = rahmen.current?.closest<HTMLElement>('.bv-blatt')?.parentElement ?? null
    return () => {
      if (s && s.scrollTop) s.scrollTop = 0
      innenRef.current?.(false)
    }
  }, [])

  // Die Kachel mit dem Fokus (data-app). Ein Aushängen beim Umverteilen zählt nicht als Verlassen:
  // Die Kachel ist dann schon aus dem Dokument, und der Umbau gibt ihr den Fokus zurück.
  const fokusApp = useRef<string | null>(null)
  function fokusRein(e: FocusEvent<HTMLDivElement>) {
    fokusApp.current = (e.target as HTMLElement).closest<HTMLElement>('[data-app]')?.dataset.app ?? null
  }
  function fokusRaus(e: FocusEvent<HTMLDivElement>) {
    const weg = e.target as HTMLElement
    if (!weg.isConnected || !document.hasFocus()) return
    const neu = e.relatedTarget as Node | null
    if (!neu || !band.current?.contains(neu)) fokusApp.current = null
  }

  // Nach einem Umbau (Größe, Seitenzahl) ohne Bewegung auf die richtige Seite stellen: die Seite der
  // Kachel mit dem Fokus, sonst die, auf der die erste App der bisherigen Seite jetzt steht. Hängt nicht
  // an der Seite selbst: Beim Wischen setzt das Band die Seite, hier würde es sonst zurückspringen.
  const vorherProSeite = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = band.current
    if (!mass || !el) return
    const alt = vorherProSeite.current
    vorherProSeite.current = plan.proSeite
    const stelle = fokusApp.current ? ids.indexOf(fokusApp.current) : -1
    const soll = stelle >= 0
      ? seiteVon(stelle, plan.proSeite, anzahl)
      : alt != null && alt !== plan.proSeite
        ? seiteNachUmbau(seiteRef.current, alt, plan.proSeite, anzahl)
        : seiteBegrenzen(seiteRef.current, anzahl)
    const links = soll * el.clientWidth
    if (Math.abs(el.scrollLeft - links) > 1) el.scrollLeft = links
    if (soll !== seite) setSeite(soll)
  }, [mass, plan.proSeite, anzahl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fokus zurückgeben, wenn die Kachel beim Umverteilen neu eingehängt wurde (der Fokus steht dann auf
  // body); ohne Rollen, die Seite der Kachel stellt der Umbau oben ein. Im Notausgang gibt es nur eine
  // Seite: Dort holt jeder Umbau (und jeder Zoomschritt) die Kachel mit dem Fokus ins Bild, sobald die
  // Seite innen rollt (nächstes Bild).
  const gemessen = useRef<Mass | null>(null)
  useLayoutEffect(() => {
    const umbau = mass !== gemessen.current
    gemessen.current = mass
    const app = fokusApp.current
    if (!app) return
    const k = kachelVon(band.current, app)
    const jetzt = document.activeElement
    const verloren = !jetzt || jetzt === document.body || jetzt === document.documentElement
    if (!k) { if (verloren) fokusApp.current = null; return }
    if (verloren) k.focus({ preventScroll: true })
    else if (jetzt !== k) return
    if (innen && (verloren || umbau)) requestAnimationFrame(() => { if (document.activeElement === k) k.scrollIntoView({ block: 'nearest', inline: 'nearest' }) })
  })

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
        onScroll={beimScrollen} onPointerDown={() => { ziel.current = null }} onFocus={fokusRein} onBlur={fokusRaus}>
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
