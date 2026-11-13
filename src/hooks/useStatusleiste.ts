// Farbe der Statusleiste (Uhr, WLAN, Akku) für Seiten mit dunkelrotem Kopf.
//
// Drei Wege, je nach Browser — alle beim Verlassen der Seite zurückgesetzt:
// - Android und Safari bis iOS 18 nehmen <meta name="theme-color">.
// - Safari ab iOS 26 kennt theme-color nicht mehr. Es färbt oben und unten nach der
//   Hintergrundfarbe von body, außer ein festes Element liegt am Rand zuoberst.
//   Ohne kopf (Startseite): html und body tragen das Dunkelrot.
//   Mit kopf (Seiten mit Rahmen der Benutzerverwaltung): html und body bleiben immer hell,
//   damit unten nie Rot erscheint (kurze Seiten, schnelles Wischen). Die Statusleiste färbt
//   der feste rote Streifen .bv-statusleiste (benutzer/stil.ts): Solange der rote Kopf die
//   Uhr-Zeile ganz füllt, setzt der Hook data-bv-kopf an <html>, und der Streifen liegt vorn.
//   Danach liegt er hinter der Seite, und der Inhalt scheint durch die Leisten.
//   Am iPhone ausprobiert und verworfen: html/body rot, solange der Kopf zu sehen ist (unten
//   roter Balken auf kurzen Seiten, oder viel Leerraum als Ausgleich), auf hell wechseln,
//   solange der Kopf noch zu sehen ist (Statusleiste hell), ein fester Streifen unten
//   (Safari-Leiste deckend), Nachfedern abschalten, nur html hell (Safari nimmt body).
// - Als App vom Homebildschirm (black-translucent) liegt die Seite unter der
//   Leiste; der feste rote Streifen hält die Farbe auch beim Scrollen.
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
      // Als CSS-Variable, folgt also der Darstellung. Mit kopf bleiben html/body hell, den roten
      // Streifen oben schaltet data-bv-kopf vor oder zurück
      const hg = kopf ? blatt : t
      document.documentElement.style.backgroundColor = `var(${hg})`
      document.body.style.backgroundColor = `var(${hg})`
      document.documentElement.toggleAttribute('data-bv-kopf', !!kopf && oben)
    }
    // Ist der rote Kopf noch zu sehen? Höchstens einmal je Bild prüfen, nur bei einem Wechsel neu setzen
    let geplant = 0
    const pruefen = () => {
      if (!kopf || geplant) return
      geplant = requestAnimationFrame(() => {
        geplant = 0
        const el = document.querySelector(kopf)
        // Füllt der rote Kopf die Uhr-Zeile noch ganz? (Höhe des Streifens = Uhr-Zeile)
        const zeile = document.querySelector('.bv-statusleiste')?.getBoundingClientRect().height ?? 0
        const jetzt = el ? el.getBoundingClientRect().bottom > zeile : window.scrollY < 1
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
