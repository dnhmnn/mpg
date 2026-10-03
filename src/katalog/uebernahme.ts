// Zwei Abkürzungen, die den größten Teil des Tippens sparen.
//
// ÜBERGABEBEFUND AUS DEM ERSTBEFUND. Der Bogen erhebt denselben Befund
// zweimal: einmal beim Antreffen, einmal bei der Übergabe. In den meisten
// Einsätzen ist er bei der Übergabe derselbe oder fast derselbe — 43 Knöpfe
// und 20 Zahlen, die noch einmal von Hand gesetzt werden müssten. Ein Knopf
// übernimmt sie; was sich geändert hat, wird danach geändert.
//
// NORMALBEFUND. "Atemwege frei, Atmung unauffällig, Kreislauf unauffällig,
// Haut unauffällig, Psyche unauffällig, neurologisch ohne path. Befund" ist
// der häufigste Erstbefund überhaupt. Er kostet sechs Felder; hier kostet er
// einen Knopf.
//
// Beide Listen werden aus dem Katalog des Bogens abgeleitet, nicht
// abgeschrieben: die Übernahme über die Namensgleichheit ub_X ← X, der
// Normalbefund über den Text der Optionen. Was im Katalog umbenannt wird,
// wandert hier mit.

import { AELRD_FELDER, aelrdFeld } from './aelrd'

/** Übergabefelder, deren Quelle nicht einfach der Name ohne ub_ ist. */
const SONDERFALL: Record<string, string> = {
  ub_rekap: 'rekap_zeit',
}

/**
 * Übergabefelder, für die es im Erstbefund nichts zu übernehmen gibt.
 * Sie stehen hier ausdrücklich, damit ein neues ub_-Feld nicht stillschweigend
 * durchrutscht — ein Test besteht darauf.
 */
export const UEBERGABE_OHNE_QUELLE = ['ub_zeitpunkt']

/** Das Feld des Erstbefunds, aus dem dieses Übergabefeld gefüllt wird. */
export function uebergabeQuelle(ubId: string): string | undefined {
  if (!ubId.startsWith('ub_')) return undefined
  if (UEBERGABE_OHNE_QUELLE.includes(ubId)) return undefined
  const kandidat = SONDERFALL[ubId] ?? ubId.slice(3)
  return aelrdFeld(kandidat) ? kandidat : undefined
}

/** Alle Paare Übergabefeld → Erstbefundfeld. */
export function uebergabePaare(): [string, string][] {
  const aus: [string, string][] = []
  for (const f of AELRD_FELDER) {
    const quelle = uebergabeQuelle(f.id)
    if (quelle) aus.push([f.id, quelle])
  }
  return aus
}

/**
 * Den Erstbefund in die Übergabefelder übernehmen.
 *
 * Bereits gesetzte Übergabewerte bleiben: wer dort schon etwas eingetragen
 * hat, hat einen Unterschied dokumentiert, und der darf nicht verschwinden.
 */
export function uebergabeUebernehmen(werte: Record<string, unknown>): Record<string, unknown> {
  const aus = { ...werte }
  for (const [ziel, quelle] of uebergabePaare()) {
    const w = werte[quelle]
    const leerZiel = aus[ziel] === undefined || aus[ziel] === '' || aus[ziel] === null ||
      (Array.isArray(aus[ziel]) && (aus[ziel] as unknown[]).length === 0)
    const hatQuelle = w !== undefined && w !== '' && w !== null && w !== false &&
      !(Array.isArray(w) && w.length === 0)
    if (leerZiel && hatQuelle) aus[ziel] = Array.isArray(w) ? [...w] : w
  }
  return aus
}

/** Wie viele Angaben eine Übernahme setzen würde — für die Beschriftung. */
export function uebernahmeUmfang(werte: Record<string, unknown>): number {
  const nachher = uebergabeUebernehmen(werte)
  return uebergabePaare().filter(([ziel]) => nachher[ziel] !== werte[ziel]).length
}

// ── Normalbefund ────────────────────────────────────────────────────────────

/** Welche Option eines Feldes "unauffällig" bedeutet. */
const UNAUFFAELLIG: Record<string, string[]> = {
  atemwege: ['frei'],
  atmung: ['unauffällig'],
  kreislauf: ['unauffällig'],
  haut: ['unauffällig'],
  psyche: ['unauffällig'],
  ekg: ['Sinusrhythmus'],
}

/**
 * Der unauffällige Erstbefund, aus den Optionen des Katalogs gelesen.
 *
 * Er setzt ausdrücklich nur, was tatsächlich untersucht wurde — deshalb ist
 * das EKG dabei, aber keine Messwerte: eine Zahl zu raten wäre etwas anderes
 * als einen Befund als unauffällig zu beschreiben.
 */
export function normalbefund(): Record<string, unknown> {
  const aus: Record<string, unknown> = {}
  for (const [id, texte] of Object.entries(UNAUFFAELLIG)) {
    const feld = aelrdFeld(id)
    if (!feld?.optionen) continue
    const werte = texte
      .map((t) => feld.optionen!.find((o) => o.text === t)?.wert)
      .filter(Boolean) as string[]
    if (werte.length === 0) continue
    aus[id] = feld.typ === 'mehrfach' ? werte : werte[0]
  }
  if (aelrdFeld('neuro_ohne_befund')) aus.neuro_ohne_befund = true
  return aus
}

/** Die Felder, die der Normalbefund setzt — für die Beschriftung des Knopfes. */
export function normalbefundFelder(): string[] {
  return Object.keys(normalbefund())
}
