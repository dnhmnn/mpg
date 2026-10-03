// Hilfen für die Erfassung der ÄLRD-Felder im öffentlichen Formular.

import { AELRD_FELDER } from '../katalog/aelrd'

/** Felder, deren Optionen mehrfach gewählt werden dürfen. */
const MEHRFACH = new Set(AELRD_FELDER.filter((f) => f.typ === 'mehrfach').map((f) => f.id))

/**
 * Mehrfachauswahl aus dem DOM zusammenfassen.
 *
 * Checkboxen können sich keinen name teilen — sie würden einander
 * überschreiben. Im Formular heißen sie deshalb `feld__option` und tragen
 * einen Boolean. Hier wird daraus wieder `feld: [option, …]`, so wie der
 * Ausdruck und der Katalog es erwarten. Die Einzelschlüssel verschwinden,
 * sonst stünde dieselbe Angabe zweimal in der Payload.
 */
export function mehrfachZusammenfassen(daten: Record<string, unknown>): Record<string, unknown> {
  const aus: Record<string, unknown> = {}
  const gesammelt: Record<string, string[]> = {}

  for (const [schluessel, wert] of Object.entries(daten)) {
    const trenner = schluessel.indexOf('__')
    if (trenner > 0) {
      const feld = schluessel.slice(0, trenner)
      const option = schluessel.slice(trenner + 2)
      if (MEHRFACH.has(feld)) {
        if (!gesammelt[feld]) gesammelt[feld] = []
        if (wert) gesammelt[feld].push(option)
        continue
      }
    }
    aus[schluessel] = wert
  }

  for (const [feld, optionen] of Object.entries(gesammelt)) {
    // Auch die leere Auswahl festhalten: "nichts angekreuzt" ist eine
    // Aussage, "Feld nie gezeigt" eine andere.
    aus[feld] = optionen
  }

  return aus
}
