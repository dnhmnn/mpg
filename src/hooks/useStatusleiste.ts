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
//   Versuch: Mit kopf bleibt html immer hell, und nur body wechselt die Farbe. Hinter dem
//   Seitenende (schnelles Wischen, Nachfedern) liegt dann die helle Farbe von html. Ob Safari
//   die Statusleiste nach body färbt, ist am iPhone zu prüfen; sonst zurück auf beide.
// - Als App vom Homebildschirm (black-translucent) liegt die Seite unter der
//   Leiste; ein fester roter Streifen der Seite hält die Farbe auch beim Scrollen.
// Die Werte kommen aus CSS-Tokens und folgen der Darstellung (hell, dunkel, Retro).
import { useEffect } from 'react'

export function useStatusleiste(token = '--lbf-kopf', opt: { kopf?: string; blatt?: string } = {}): void {
  const { kopf, blatt = '--warm-bg' } = opt
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
    let oben = true
    const setzen = () => {
      const t = oben ? token : blatt
      const farbe = getComputedStyle(document.documentElement).getPropertyValue(t).trim()
      if (farbe) m.content = farbe
      // Als CSS-Variable, folgt also der Darstellung. Mit kopf (Versuch, Variante 3 des Owners):
      // html bleibt immer hell, nur body trägt das Rot. Was hinter dem Seitenende liegt (auch beim
      // Nachfedern), zeigt die Farbe von html; so kann dort kein Rot aufzucken.
      document.documentElement.style.backgroundColor = `var(${kopf ? blatt : t})`
      document.body.style.backgroundColor = `var(${t})`
    }
    // Ist der rote Kopf noch zu sehen? Höchstens einmal je Bild prüfen, nur bei einem Wechsel neu setzen
    let geplant = 0
    const pruefen = () => {
      if (!kopf || geplant) return
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
    if (kopf) {
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
    }
  }, [token, kopf, blatt])
}
