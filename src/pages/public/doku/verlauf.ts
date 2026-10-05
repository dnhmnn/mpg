// Der Verlauf: Messwerte mit Uhrzeit, so oft wie gemessen wird.
//
// Auf dem Papier ist der Verlauf das Kurvenblatt — ein Gitter, in das die
// Werte als Punkte eingetragen werden. Erfasst wird deshalb spaltenweise:
// eine Uhrzeit, dazu die Werte, die zu diesem Zeitpunkt gemessen wurden. Eine
// Spalte je Messung, wie auf dem Papier.
//
// Leere Felder bleiben leer. Wer nur SpO₂ und HF misst, trägt zwei Zahlen ein
// und nicht neun — eine Spalte mit zwei Punkten ist eine richtige Spalte.

import {
  VERLAUFSWERTE, eingetrageneSpalten, fehlendeZeitpunkte, kurvenspalten,
  type Herkunft, type Verlaufsspalte,
} from '../../../katalog/verlaufswerte'
import type { Werte } from './DokuFeld'

export type { Herkunft, Verlaufsspalte }

/** Die Spalten, die im Verlauf eingetragen wurden — ohne Erstbefund und Übergabe. */
export function verlaufLesen(werte: Werte): Verlaufsspalte[] {
  return eingetrageneSpalten(werte)
}

/**
 * Alles, was auf der Kurve steht — Verlauf, Erstbefund und Übergabe, nach der
 * Uhr geordnet.
 */
export function verlaufSortiert(werte: Werte): Verlaufsspalte[] {
  return kurvenspalten(werte)
}

function kennung(vorhanden: Verlaufsspalte[]): string {
  let n = vorhanden.length + 1
  const belegt = new Set(vorhanden.map((e) => e.id))
  while (belegt.has(`v${n}`)) n += 1
  return `v${n}`
}

/** Die Zahl so lesen, wie sie eingegeben wurde — mit Komma oder Punkt. */
export function zahl(text: unknown): number | null {
  const t = String(text ?? '').replace(',', '.').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Nur die Werte behalten, die wirklich eine Zahl sind. */
function geputzt(werte: Record<string, string>): Record<string, string> {
  const aus: Record<string, string> = {}
  for (const v of VERLAUFSWERTE) {
    const t = String(werte[v.id] ?? '').trim()
    if (t !== '' && zahl(t) !== null) aus[v.id] = t
  }
  return aus
}

/** Eine Spalte eintragen. Ohne einen einzigen Messwert entsteht keine. */
export function verlaufEintragen(
  werte: Werte,
  eingabe: { zeit: string; werte: Record<string, string> },
): Werte {
  const sauber = geputzt(eingabe.werte)
  if (Object.keys(sauber).length === 0) return werte
  const vorhanden = verlaufLesen(werte)
  const neu: Verlaufsspalte = { id: kennung(vorhanden), zeit: eingabe.zeit, werte: sauber }
  return { ...werte, verlauf: [...vorhanden, neu] }
}

export function verlaufStreichen(werte: Werte, id: string): Werte {
  const vorhanden = verlaufLesen(werte)
  if (!vorhanden.some((e) => e.id === id)) return werte
  return { ...werte, verlauf: vorhanden.filter((e) => e.id !== id) }
}

/** Was in einer Spalte steht, kurz — für die Liste in der Maske. */
export function spaltentext(spalte: Verlaufsspalte): string {
  return VERLAUFSWERTE
    .filter((v) => spalte.werte[v.id] !== undefined)
    .map((v) => `${v.label} ${spalte.werte[v.id]}`)
    .join(' · ')
}

/** Erstbefund oder Übergabe mit Messwerten, aber ohne Zeitpunkt. */
export { fehlendeZeitpunkte }
