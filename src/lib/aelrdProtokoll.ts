// Das fertige Protokoll im ÄLRD-Layout: zwei A4-Seiten, Blatt für Blatt.

import { STIL, type Payload } from './aelrdDruck'
import { STIL_SEITE1, seite1, type Kopfdaten } from './aelrdSeite1'
import { STIL_SEITE2, seite2 } from './aelrdSeite2'
import { spiegelAnwenden } from '../katalog/aelrdSpiegel'

export type { Kopfdaten, Payload }

export function aelrdHtml(roh: Payload, kopf: Kopfdaten = {}): string {
  // Der amtliche Bogen hat für drei Angaben zwei Kästchen. Erfasst werden sie
  // einmal; hier bekommen beide Kästchen denselben Wert, damit das Papier
  // aussieht wie immer.
  const payload = spiegelAnwenden(roh)
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Einsatzprotokoll</title>
<style>${STIL}${STIL_SEITE1}${STIL_SEITE2}</style></head><body>
${seite1(payload, kopf)}
${seite2(payload, kopf)}
<button class="knopf" onclick="window.print()">Drucken / PDF</button>
</body></html>`
}

/** Oeffnet den Ausdruck in einem neuen Fenster. false, wenn der Browser blockt. */
export function aelrdDrucken(payload: Payload, kopf: Kopfdaten = {}): boolean {
  const fenster = window.open('', '_blank', 'width=1000,height=750')
  if (!fenster) return false
  fenster.document.write(aelrdHtml(payload, kopf))
  fenster.document.close()
  return true
}

/**
 * Der leere Vordruck: derselbe Bogen ohne Einsatzdaten, zum Ausdrucken und
 * handschriftlichen Ausfuellen. Die Organisation bleibt stehen, damit der
 * Stapel im Fahrzeug schon beschriftet ist.
 */
export function aelrdVordruck(organisation = ''): string {
  return aelrdHtml({}, { organisation, protokollNr: '', erstellt: '' })
}

/** Oeffnet den leeren Vordruck in einem neuen Fenster. false, wenn geblockt. */
export function aelrdVordruckDrucken(organisation = ''): boolean {
  const fenster = window.open('', '_blank', 'width=1000,height=750')
  if (!fenster) return false
  fenster.document.write(aelrdVordruck(organisation))
  fenster.document.close()
  return true
}
