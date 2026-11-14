// Farbe der Statusleiste (Uhr, WLAN, Akku) für Seiten mit dunkelrotem Kopf.
//
// Drei Wege, je nach Browser — alle beim Verlassen der Seite zurückgesetzt:
// - Android und Safari bis iOS 18 nehmen <meta name="theme-color">.
// - Safari ab iOS 26 kennt theme-color nicht mehr und färbt oben und unten weich nach dem
//   Hintergrund von body. Deshalb bekommen html und body das Dunkelrot, solange der rote Kopf
//   (kopf, ein CSS-Selektor) zu sehen ist. Ist er weggescrollt, gilt der helle Hintergrund
//   (blatt), und der Inhalt scheint durch die Leisten wie auf jeder anderen Seite. Ohne kopf
//   bleibt es rot.
//   Dieselbe Farbe stünde auch unten, wo die Seite den Bildschirm nicht bedeckt (Ende der Seite,
//   Nachfedern). Ist dort der Kopf noch zu sehen (kurze Seiten), setzt der Hook data-bv-unten:
//   Dann zeigt die Seite den hellen Streifen .bv-bodenkante am unteren Rand, und Safari färbt
//   den unteren Rand hell (benutzer/stil.ts, dort stehen die Regeln von WebKit mit Fundstellen).
//   Am iPhone ausprobiert und verworfen: ein festes oder klebendes Element oben als Farbgeber
//   (roter Streifen, klebender Kopf): Safari macht daraus einen festen Balken, der Titel und
//   Knöpfe abschneidet und die Farbe behält; html/body immer hell ohne Farbgeber (Statusleiste
//   hell); ein höheres Blatt als Ausgleich (Leerraum); auf hell wechseln, solange der Kopf noch
//   zu sehen ist; ein fester heller Streifen unten, der immer da ist (Safari-Leiste deckend über
//   Inhalt); eine helle Fläche hinter dem Inhalt (Safari findet sie nicht); Nachfedern
//   abschalten; nur html hell (Safari nimmt body).
// - Als App vom Homebildschirm (black-translucent) liegt die Seite unter der Leiste; dort hält
//   ein fester roter Streifen (.bv-statusleiste) die Farbe auch beim Scrollen.
// Die Werte kommen aus CSS-Tokens und folgen der Darstellung (hell, dunkel, Retro).
import { useEffect } from 'react'

/**
 * Ist das Ende der Seite in Reichweite des unteren Rands? Unter der Safari-Leiste (iOS 26) liegt
 * bis rund 70 px unter dem Fenster noch Bildschirm; reicht die Seite nicht so weit, sieht man dort
 * den Hintergrund von body. 90 px Spielraum; gilt auch beim Nachfedern (Rest negativ).
 */
export const ENDE_NAH_PX = 90
export function endeNah(scrollY: number, fenster: number, hoehe: number): boolean {
  return hoehe - (scrollY + fenster) < ENDE_NAH_PX
}

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
    let unten = false
    const setzen = () => {
      const t = oben ? token : blatt
      const farbe = getComputedStyle(document.documentElement).getPropertyValue(t).trim()
      if (farbe) m.content = farbe
      // Als CSS-Variable, folgt also der Darstellung
      document.documentElement.style.backgroundColor = `var(${t})`
      document.body.style.backgroundColor = `var(${t})`
      document.documentElement.toggleAttribute('data-bv-unten', !!kopf && unten)
    }
    // Ist der rote Kopf noch zu sehen? Höchstens einmal je Bild prüfen, nur bei einem Wechsel neu setzen
    let geplant = 0
    const pruefen = () => {
      if (!kopf || geplant) return
      geplant = requestAnimationFrame(() => {
        geplant = 0
        const el = document.querySelector(kopf)
        const jetzt = el ? el.getBoundingClientRect().bottom > 0 : window.scrollY < 1
        // Ende der Seite in Reichweite des unteren Rands, während der rote Kopf noch zu sehen ist?
        const hoehe = (document.scrollingElement ?? document.documentElement).scrollHeight
        const amEnde = jetzt && endeNah(window.scrollY, window.innerHeight, hoehe)
        if (jetzt !== oben || amEnde !== unten) { oben = jetzt; unten = amEnde; setzen() }
      })
    }
    setzen()
    pruefen()
    // Darstellung gewechselt: System hell/dunkel oder data-theme am <html>
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    mq?.addEventListener?.('change', setzen)
    const mo = new MutationObserver(setzen)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    // Ändert sich die Länge der Seite (Liste geladen, Reiter gewechselt), Ende neu prüfen
    const ro = kopf && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pruefen) : null
    if (kopf) {
      window.addEventListener('scroll', pruefen, { passive: true })
      window.addEventListener('resize', pruefen)
      ro?.observe(document.body)
    }
    return () => {
      mq?.removeEventListener?.('change', setzen)
      mo.disconnect()
      cancelAnimationFrame(geplant)
      window.removeEventListener('scroll', pruefen)
      window.removeEventListener('resize', pruefen)
      ro?.disconnect()
      document.documentElement.removeAttribute('data-bv-unten')
      if (angelegt) m.remove()
      else m.content = vorher
      document.documentElement.style.backgroundColor = html
      document.body.style.backgroundColor = body
    }
  }, [token, kopf, blatt])
}
