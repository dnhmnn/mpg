// Welche Blöcke des Bogens auf einem Zettel zusammenstehen.
//
// Der Katalog in aelrd.ts bildet das Papier ab und bleibt, wie er ist — er
// treibt den Ausdruck. Wie die Maske diese Blöcke bündelt, ist eine Frage der
// Bedienung und steht deshalb hier: so lässt sich die Gliederung ändern, ohne
// den Bogen anzufassen.
//
// Die Reihenfolge ist die des Papiers. Wo mehrere Blöcke zusammengehen,
// steht der Zettel an der Stelle des ersten von ihnen.

import { AELRD_ABSCHNITTE, aelrdFeld, type AelrdFeld } from '../../../katalog/aelrd'
import { istSpiegelFeld } from '../../../katalog/aelrdSpiegel'

export type Zettel = {
  id: string
  /** Kurzzeichen am Rand — höchstens fünf Zeichen. */
  kurz: string
  titel: string
  /** Die Blöcke des Bogens, die hier zusammenstehen. */
  abschnitte: string[]
}

export const ZETTEL: Zettel[] = [
  { id: 'patient', kurz: 'PAT', titel: 'Patient und Einsatznummer', abschnitte: ['stammdaten', 'kennung'] },
  { id: 'einsatz', kurz: 'EINS', titel: 'Einsatz und Besatzung', abschnitte: ['einsatzdaten', 'besatzung'] },
  { id: 'zeiten', kurz: 'ZEIT', titel: 'Zeiten', abschnitte: ['zeiten'] },
  { id: 'anamnese', kurz: 'ANAM', titel: 'Notfallgeschehen und Anamnese', abschnitte: ['notfallgeschehen'] },
  {
    id: 'befund',
    kurz: 'BEF',
    titel: 'Erstbefund, Neurologie, Psyche und Verletzungen',
    abschnitte: ['erstbefund', 'neurologie', 'untersuchung', 'verletzungen'],
  },
  { id: 'messwerte', kurz: 'VITAL', titel: 'Messwerte initial', abschnitte: ['messwerte'] },
  { id: 'diagnosen', kurz: 'DIAG', titel: 'Erkrankungen und Score', abschnitte: ['diagnosen'] },
  {
    id: 'massnahmen',
    kurz: 'MASS',
    titel: 'Maßnahmen, Medikation, Beatmung',
    abschnitte: ['medikation', 'reanimation', 'zugaenge', 'beatmung', 'massnahmen'],
  },
  {
    id: 'uebergabe',
    kurz: 'ÜBER',
    titel: 'Übergabe und Abschluss',
    abschnitte: ['uebergabe_befund', 'uebergabe_neuro', 'abschluss'],
  },
]

/** Ein Abschnitt des Bogens mit seinen Feldern, für die Zwischenüberschrift. */
export type ZettelTeil = { id: string; titel: string; felder: AelrdFeld[] }

function felderVon(abschnittId: string): AelrdFeld[] {
  const a = AELRD_ABSCHNITTE.find((x) => x.id === abschnittId)
  if (!a) return []
  return a.felder
    .filter((id) => !istSpiegelFeld(id))
    .map(aelrdFeld)
    .filter(Boolean) as AelrdFeld[]
}

/**
 * Die Zettel mit ihren Teilen und Feldern.
 *
 * Ein Zettel ohne Felder bekommt keinen Reiter — die Verlaufsbeschreibung
 * etwa ist auf dem Papier das Kurvenblatt und führt keine.
 */
export function zettelMitFeldern(): (Zettel & { teile: ZettelTeil[]; felder: AelrdFeld[] })[] {
  return ZETTEL.map((z) => {
    const teile = z.abschnitte
      .map((id) => ({
        id,
        titel: AELRD_ABSCHNITTE.find((a) => a.id === id)?.titel ?? id,
        felder: felderVon(id),
      }))
      .filter((t) => t.felder.length > 0)
    return { ...z, teile, felder: teile.flatMap((t) => t.felder) }
  }).filter((z) => z.felder.length > 0)
}
