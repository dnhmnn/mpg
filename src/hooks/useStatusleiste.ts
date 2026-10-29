// Farbe der Statusleiste (Uhr, WLAN, Akku) für Seiten mit dunkelrotem Kopf.
//
// Im Browser färben Safari und Android die Leiste nach <meta name="theme-color">,
// sonst stünde dort das Elfenbein der übrigen Seiten über dem roten Kopf. Der Wert
// kommt aus dem CSS-Token und folgt der Darstellung (hell, dunkel, Retro, System);
// beim Verlassen der Seite gilt wieder der vorige. Als App vom Homebildschirm
// (black-translucent) liegt die Seite selbst unter der Leiste — dafür sorgt ein
// fester Streifen in der Seite (.bv-statusleiste).
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
    return () => {
      mq?.removeEventListener?.('change', setzen)
      mo.disconnect()
      if (angelegt) m.remove()
      else m.content = vorher
    }
  }, [token])
}
