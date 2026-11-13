// Farbe der Statusleiste (Uhr, WLAN, Akku) für Seiten mit dunkelrotem Kopf.
//
// Drei Wege, je nach Browser — alle beim Verlassen der Seite zurückgesetzt:
// - Android und Safari bis iOS 18 nehmen <meta name="theme-color">.
// - Safari ab iOS 26 kennt theme-color nicht mehr. Es färbt oben und unten nach dem Hintergrund
//   von body, außer es findet am Rand ein festes oder klebendes Element; dessen Farbe behält es,
//   solange das Element dargestellt wird (Regeln mit Fundstellen: benutzer/stil.ts).
//   Ohne kopf (Startseite): html und body tragen das Dunkelrot.
//   Mit kopf (Seiten mit Rahmen der Benutzerverwaltung): html und body bleiben immer hell, damit
//   unten nie Rot erscheint (kurze Seiten, schnelles Wischen). Oben färbt der rote Streifen
//   .bv-statusleiste. Der Hook setzt data-bv-kopf an <html>, solange der rote Kopf zu sehen ist;
//   nur dann wird der Streifen dargestellt. Ist der Kopf weggescrollt, fällt der Streifen weg,
//   Safari vergisst die Farbe, und die Statusleiste wird hell wie die Seite.
//   Am iPhone ausprobiert und verworfen: html/body rot, solange der Kopf zu sehen ist (unten
//   roter Balken auf kurzen Seiten, oder viel Leerraum als Ausgleich); der Streifen immer da
//   oder der Kopf selbst sticky (Statusleiste bleibt beim Scrollen rot); der Streifen mit z-index
//   über dem Inhalt (verdeckt Titel und Knöpfe, roter Strich); auf hell wechseln, solange der
//   Kopf noch zu sehen ist; ein fester Streifen unten (Safari-Leiste deckend); Nachfedern
//   abschalten; nur html hell (Safari nimmt body).
// - Als App vom Homebildschirm (black-translucent) liegt die Seite unter der Leiste; dort ist
//   der rote Streifen immer da und hält die Farbe auch beim Scrollen.
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
      // Als CSS-Variable, folgt also der Darstellung. Mit kopf bleiben html/body hell; oben färbt
      // der rote Streifen (.bv-statusleiste). theme-color folgt dem Kopf (Android, älteres Safari)
      const hg = kopf ? blatt : t
      document.documentElement.style.backgroundColor = `var(${hg})`
      document.body.style.backgroundColor = `var(${hg})`
      // Roter Streifen oben nur, solange der Kopf zu sehen ist (sonst behielte Safari das Rot)
      document.documentElement.toggleAttribute('data-bv-kopf', !!kopf && oben)
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
      document.documentElement.removeAttribute('data-bv-kopf')
    }
  }, [token, kopf, blatt])
}
