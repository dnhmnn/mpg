// Farbe der Statusleiste (Uhr, WLAN, Akku) für Seiten mit dunkelrotem Kopf.
//
// Drei Wege, je nach Browser — alle beim Verlassen der Seite zurückgesetzt:
// - Android und Safari bis iOS 18 nehmen <meta name="theme-color">.
// - Safari ab iOS 26 kennt theme-color nicht mehr und nimmt die Hintergrundfarbe
//   von html/body (oder ein deckendes, am Rand festes Element). Deshalb bekommen
//   html und body hier das Dunkelrot; die Seite selbst bleibt darüber Elfenbein.
//   Damit unten nicht auch die Leiste rot wird, hält die Seite dort einen festen
//   Streifen in Elfenbein (.bv-bodenkante), oben einen roten (.bv-statusleiste).
// - Als App vom Homebildschirm (black-translucent) liegt die Seite unter der
//   Leiste; der feste rote Streifen hält die Farbe auch beim Scrollen.
// Der Wert kommt aus dem CSS-Token und folgt der Darstellung (hell, dunkel, Retro).
import { useEffect } from 'react'

export function useStatusleiste(token = '--lbf-kopf'): void {
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
    const setzen = () => {
      const farbe = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
      if (farbe) m.content = farbe
    }
    setzen()
    // Darstellung gewechselt: System hell/dunkel oder data-theme am <html>
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    mq?.addEventListener?.('change', setzen)
    const mo = new MutationObserver(setzen)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    // Safari 26: Hintergrund von html und body (als CSS-Variable, folgt also der Darstellung)
    const html = document.documentElement.style.backgroundColor
    const body = document.body.style.backgroundColor
    document.documentElement.style.backgroundColor = `var(${token})`
    document.body.style.backgroundColor = `var(${token})`
    return () => {
      mq?.removeEventListener?.('change', setzen)
      mo.disconnect()
      if (angelegt) m.remove()
      else m.content = vorher
      document.documentElement.style.backgroundColor = html
      document.body.style.backgroundColor = body
    }
  }, [token])
}
