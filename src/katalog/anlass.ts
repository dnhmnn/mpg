// Einsatzanlässe und welche Blöcke des Bogens sie brauchen.
//
// Der Bogen fragt alles, was ein Rettungseinsatz je ergeben kann — 21 Blöcke,
// 205 Felder. Ein einzelner Einsatz braucht davon selten mehr als ein Drittel:
// bei einem Krankentransport ist der Reanimationsblock leer, bei einem
// Herzinfarkt der Verletzungsblock.
//
// Die Besatzung wählt deshalb am Anfang den Anlass; der Hauptweg zeigt dann
// nur die Blöcke, die dazu gehören. NICHTS WIRD UNERREICHBAR: alle übrigen
// Blöcke stehen darunter und sind einen Tipp entfernt. Ein Einsatz kann auch
// mehrere Anlässe haben — Sturz mit Schlaganfall ist beides.
//
// Die Reihenfolge der Blöcke bleibt immer die des Papierbogens. Wer ihn
// kennt, findet alles an derselben Stelle; der Anlass lässt nur weg, er
// sortiert nicht um.

import { AELRD_ABSCHNITTE } from './aelrd'

export type Anlass = {
  id: string
  titel: string
  /** Was den Anlass ausmacht — steht als Hinweis unter dem Knopf. */
  beispiel: string
  /** Blöcke zusätzlich zum Kern. */
  abschnitte: string[]
}

/**
 * Blöcke, die jeder Einsatz braucht — unabhängig vom Anlass.
 *
 * Wer, wann, wo, was gefunden, was übergeben. Ohne diese Angaben ist das
 * Protokoll kein Protokoll.
 */
export const DOKU_KERN = [
  'stammdaten',
  'kennung',
  'einsatzdaten',
  'besatzung',
  'zeiten',
  'notfallgeschehen',
  'erstbefund',
  'messwerte',
  'diagnosen',
  'verlauf',
  'uebergabe_befund',
  'uebergabe_neuro',
  'abschluss',
]

export const ANLAESSE: Anlass[] = [
  {
    id: 'internistisch',
    titel: 'Internistisch',
    beispiel: 'Thoraxschmerz, Atemnot, Abdomen, Stoffwechsel',
    abschnitte: ['untersuchung', 'medikation', 'zugaenge', 'massnahmen'],
  },
  {
    id: 'trauma',
    titel: 'Trauma',
    beispiel: 'Sturz, Verkehrsunfall, Gewalt, Verbrennung',
    abschnitte: ['verletzungen', 'neurologie', 'medikation', 'zugaenge', 'massnahmen'],
  },
  {
    id: 'neurologisch',
    titel: 'Neurologisch',
    beispiel: 'Schlaganfall, Krampfanfall, Synkope',
    abschnitte: ['neurologie', 'untersuchung', 'medikation', 'zugaenge', 'massnahmen'],
  },
  {
    id: 'psychisch',
    titel: 'Psyche / Intox',
    beispiel: 'Erregungszustand, Suizidalität, Intoxikation',
    abschnitte: ['untersuchung', 'neurologie', 'medikation'],
  },
  {
    id: 'reanimation',
    titel: 'Reanimation',
    beispiel: 'Kreislaufstillstand, Tod, Todesfeststellung',
    abschnitte: ['reanimation', 'neurologie', 'medikation', 'zugaenge', 'beatmung', 'massnahmen'],
  },
  {
    id: 'transport',
    titel: 'Transport',
    beispiel: 'Verlegung, Krankentransport ohne Akutversorgung',
    abschnitte: [],
  },
]

const reihenfolge = AELRD_ABSCHNITTE.map((a) => a.id)

/**
 * Die Blöcke des Hauptwegs für die gewählten Anlässe, in der Reihenfolge des
 * Bogens. Ohne Anlass ist es der Kern.
 */
export function abschnitteFuer(anlassIds: string[]): string[] {
  const gewaehlt = new Set(DOKU_KERN)
  for (const a of ANLAESSE) {
    if (!anlassIds.includes(a.id)) continue
    for (const id of a.abschnitte) gewaehlt.add(id)
  }
  return reihenfolge.filter((id) => gewaehlt.has(id))
}

/** Die übrigen Blöcke — erreichbar, aber nicht im Weg. */
export function weitereAbschnitte(anlassIds: string[]): string[] {
  const imWeg = new Set(abschnitteFuer(anlassIds))
  return reihenfolge.filter((id) => !imWeg.has(id))
}

export function anlass(id: string): Anlass | undefined {
  return ANLAESSE.find((a) => a.id === id)
}
