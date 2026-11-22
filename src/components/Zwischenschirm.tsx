// Roter Zwischenbildschirm (Owner, 22.11.2026: „Kann man einen roten Zwischenbildschirm stattdessen?“).
//
// Steht überall, wo sonst eine leere oder helle Fläche zu sehen wäre: beim Start der App (schon in
// index.html, bevor das Programm läuft), beim ersten Laden einer Seite, solange die Anmeldung geprüft
// wird, und wenn ein Seitenwechsel länger braucht (WechselWarten in App.tsx). Ganz in Dunkelrot wie die
// Begrüßung und die Zugangsseiten. Das Responda-Zeichen kommt erst nach einer Viertelsekunde sanft dazu,
// damit ein kurzer Wechsel nicht aufblinkt (CSS .zs in globals.css).
//
// html und body färbt eine Klasse am <html> („zwischen“, mit !important in globals.css), nicht
// useStatusleiste: Die Seite darunter setzt ihre Farben mit useStatusleiste selbst und merkt sich, was
// vorher galt. Ein zweiter Aufruf hier würde beim Verschwinden deren Werte überschreiben (der Hub verlöre
// als App sein Rot). Die Klasse überdeckt nur, solange ein Schirm steht, und die Werte der Seite gelten
// danach unverändert weiter. Ausnahme von „Unten nie Rot“ wie bei den Zugangsseiten: Der ganze Bildschirm
// ist rot, also auch Safaris Leisten.
import { useLayoutEffect, useState } from 'react'

/** Nach so vielen Millisekunden roter Zeit blendet das Zeichen ein (CSS .zs-zeichen, 0,3 s). */
export const ZEICHEN_NACH_MS = 250
/** Folgt ein Schirm so schnell auf den vorigen, gilt es als dieselbe rote Zeit (ein Wechsel im selben Bild). */
const NAHTLOS_MS = 100

const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

let stehend = 0
// Beim Start der App steht schon der rote Schirm aus index.html (Klasse „startet“); seine Zeit beginnt mit der Seite (0)
let start = typeof document !== 'undefined' && !!document.documentElement?.classList?.contains('startet')
let beginn = 0
let ende = -Infinity
const rot = () => stehend > 0 || start

/**
 * Verzögerung der Einblendung für einen neuen Schirm. Folgt er auf einen anderen (Start → Ersatzfläche →
 * Ladezweig der Seite), läuft die Zeit weiter statt neu zu beginnen (auch negativ: schon eingeblendet),
 * sonst blinkte das Zeichen bei jedem Übergang auf und ab.
 */
export function zeichenVerzug(t = jetzt()): number {
  return rot() || t - ende < NAHTLOS_MS ? ZEICHEN_NACH_MS - (t - beginn) : ZEICHEN_NACH_MS
}

type Klassen = { classList: { add(c: string): void; remove(c: string): void } }

// Android und Safari bis iOS 18 färben die Leiste nach theme-color, nicht nach html/body. Solange ein
// Schirm steht, liegt deshalb ein eigenes theme-color vorn im head (das erste gilt); beim Start steht es
// schon in index.html. useStatusleiste fasst es nie an (meta …:not([data-zwischen])).
function leisteRot(an: boolean): void {
  if (typeof document === 'undefined' || !document.head) return
  let m = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-zwischen]')
  if (!an) { m?.remove(); return }
  if (!m) {
    m = document.createElement('meta')
    m.name = 'theme-color'
    m.setAttribute('data-zwischen', '')
    document.head.prepend(m)
  }
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--lbf-kopf').trim() || '#3d0408'
}

/** Ein Schirm erscheint: html und body rot. Gibt die Funktion zum Verschwinden zurück (genau einmal wirksam). */
export function zwischenAn(el: Klassen = document.documentElement, t = jetzt()): (t?: number) => void {
  if (!rot() && t - ende >= NAHTLOS_MS) beginn = t
  stehend++
  el.classList.add('zwischen')
  if (el === (typeof document !== 'undefined' ? document.documentElement : null)) leisteRot(true)
  let weg = false
  return (t2 = jetzt()) => {
    if (weg) return
    weg = true
    stehend = Math.max(0, stehend - 1)
    // Erscheint im selben Wechsel der nächste Schirm (Ersatzfläche → Ladezweig der Seite), bleibt es rot
    if (!stehend) {
      el.classList.remove('zwischen')
      if (!start) {
        ende = t2
        if (el === (typeof document !== 'undefined' ? document.documentElement : null)) leisteRot(false)
      }
    }
  }
}

/** Der Start in index.html ist vorbei (erstes Bild der App oder Fehlerseite): seine Klasse weg. */
export function startVorbei(el: Klassen | null = typeof document !== 'undefined' ? document.documentElement : null, t = jetzt()): void {
  try { el?.classList.remove('startet') } catch { /* ohne DOM */ }
  if (start) {
    start = false
    if (!stehend) {
      ende = t
      if (el === (typeof document !== 'undefined' ? document.documentElement : null)) leisteRot(false)
    }
  }
}

export default function Zwischenschirm({ text }: { text?: string }) {
  const [verzug] = useState(() => zeichenVerzug())
  useLayoutEffect(() => zwischenAn(), [])
  const einblenden = { animationDelay: `${Math.round(verzug)}ms` }
  return (
    <div className="zs" role="status" aria-label={text || 'Wird geladen'}>
      <span className="zs-zeichen" aria-hidden="true" style={einblenden}><img src="/logo.svg" alt="" /></span>
      {text && <span className="zs-text" style={einblenden}>{text}</span>}
    </div>
  )
}
