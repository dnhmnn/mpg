// Farbe der Statusleiste (Uhr, WLAN, Akku) für Seiten mit dunkelrotem Kopf.
//
// Drei Wege, je nach Browser — alle beim Verlassen der Seite zurückgesetzt:
// - Android und Safari bis iOS 18 nehmen <meta name="theme-color">.
// - Safari ab iOS 26 kennt theme-color nicht mehr und nimmt die Hintergrundfarbe
//   von html/body. Deshalb bekommen html und body das Dunkelrot, solange der rote
//   Kopf (kopf, ein CSS-Selektor) oben zu sehen ist. Ist er weggescrollt, gilt wieder
//   der helle Hintergrund (blatt): Dann scheint der Inhalt durch die Leisten wie auf
//   jeder anderen Seite, und die untere Leiste wird nie rot. Ohne kopf bleibt es rot.
//   Kurze Seiten verhalten sich wie lange: Das helle Blatt ist mindestens so hoch wie der
//   Bildschirm (.bv-blatt in benutzer/stil.ts), der Kopf scrollt also auch dort ganz weg,
//   bevor das Seitenende erreicht ist. Nicht tun (am iPhone ausprobiert): auf hell wechseln,
//   solange der Kopf noch zu sehen ist (die Statusleiste wird dann hell), oder einen festen
//   Streifen an den unteren Rand legen (die Safari-Leiste wird dann deckend).
// - Als App vom Homebildschirm (black-translucent) liegt die Seite unter der
//   Leiste; ein fester roter Streifen der Seite hält die Farbe auch beim Scrollen.
//
// Statische Seiten (statisch: true, der Hub; CLAUDE.md, „Statische Seiten“): Die Seite rollt
// nicht. html und body bleiben die ganze Zeit hell (blatt), oben färbt der feste rote Streifen
// .bv-statusleiste (vorn, siehe BV_CSS) Safaris Leiste, theme-color ist das Dunkelrot. Solange
// die Seite zu sehen ist, bekommen html und body height 100 %, overflow hidden und
// overscroll-behavior none (kein Scrollen, kein Nachfedern). Beim Verlassen und beim Wechsel
// auf eine rollende Seite stellt das Aufräumen genau die vorherigen Werte wieder her.
// Die Werte kommen aus CSS-Tokens und folgen der Darstellung (hell, dunkel, Retro).
import { useEffect } from 'react'

/** Was eine statische Seite an html und body festsetzt (Längsschreibweise, damit das Zurücksetzen genau ist). */
const FEST: [string, string][] = [
  ['height', '100%'],
  ['overflow-x', 'hidden'],
  ['overflow-y', 'hidden'],
  ['overscroll-behavior-x', 'none'],
  ['overscroll-behavior-y', 'none'],
]

/** html und body festsetzen; gibt zurück, was das Aufräumen wiederherstellt. */
function feststellen(): () => void {
  const elemente = [document.documentElement, document.body]
  const vorher = elemente.map((el) => FEST.map(([k]) => [el.style.getPropertyValue(k), el.style.getPropertyPriority(k)] as const))
  for (const el of elemente) for (const [k, v] of FEST) el.style.setProperty(k, v)
  // War die vorige Seite weiter unten, steht die feste Seite sonst verschoben da
  window.scrollTo(0, 0)
  document.body.scrollTop = 0
  document.documentElement.scrollTop = 0
  return () => {
    elemente.forEach((el, i) => FEST.forEach(([k], j) => {
      const [wert, prio] = vorher[i][j]
      if (wert) el.style.setProperty(k, wert, prio)
      else el.style.removeProperty(k)
    }))
  }
}

export function useStatusleiste(token = '--lbf-kopf', opt: { kopf?: string; blatt?: string; statisch?: boolean } = {}): void {
  const { kopf, blatt = '--warm-bg', statisch = false } = opt
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const angelegt = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    const m = meta
    const vorher = m.content
    const html = document.documentElement.style.backgroundColor
    const body = document.body.style.backgroundColor
    const loesen = statisch ? feststellen() : null
    let oben = true
    const setzen = () => {
      // Statisch: theme-color immer das Dunkelrot, html und body immer hell
      const leiste = statisch || oben ? token : blatt
      const grund = statisch ? blatt : leiste
      const farbe = getComputedStyle(document.documentElement).getPropertyValue(leiste).trim()
      if (farbe) m.content = farbe
      // Als CSS-Variable, folgt also der Darstellung
      document.documentElement.style.backgroundColor = `var(${grund})`
      document.body.style.backgroundColor = `var(${grund})`
    }
    // Ist der rote Kopf noch zu sehen? Höchstens einmal je Bild prüfen, nur bei einem Wechsel neu setzen
    const beobachten = !!kopf && !statisch
    let geplant = 0
    const pruefen = () => {
      if (!beobachten || !kopf || geplant) return
      geplant = requestAnimationFrame(() => {
        geplant = 0
        const el = document.querySelector(kopf)
        const jetzt = el ? el.getBoundingClientRect().bottom > 0 : window.scrollY < 1
        if (jetzt !== oben) { oben = jetzt; setzen() }
      })
    }
    setzen()
    pruefen()
    // Darstellung gewechselt: System hell/dunkel oder data-theme am <html>
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    mq?.addEventListener?.('change', setzen)
    const mo = new MutationObserver(setzen)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    if (beobachten) {
      window.addEventListener('scroll', pruefen, { passive: true })
      window.addEventListener('resize', pruefen)
    }
    return () => {
      mq?.removeEventListener?.('change', setzen)
      mo.disconnect()
      cancelAnimationFrame(geplant)
      window.removeEventListener('scroll', pruefen)
      window.removeEventListener('resize', pruefen)
      if (angelegt) m.remove()
      else m.content = vorher
      document.documentElement.style.backgroundColor = html
      document.body.style.backgroundColor = body
      loesen?.()
    }
  }, [token, kopf, blatt, statisch])
}
