// Protokolldaten aus dem Formular mit dem bestehenden Protokoll vereinen.
//
// WARUM: Die Bearbeitungsmasken lesen ihre Werte aus dem DOM. Alles, was
// eine Maske nicht zeigt, stand dadurch nicht im Ergebnis — und wurde beim
// Speichern aus dem Protokoll gelöscht. Bei einem rechtlich bedeutsamen
// Dokument ist das der schlimmste Fehler, den eine Maske machen kann: Er
// fällt niemandem auf, weil nichts fehlschlägt.
//
// Mit den Feldern des ÄLRD-Bogens wären das über hundert Angaben je
// Nachbearbeitung gewesen.

export type Payload = Record<string, unknown>

/**
 * Was im Formular stand, gewinnt. Was es nicht zeigt, bleibt stehen.
 *
 * Leere Eingaben sind eine Aussage und überschreiben deshalb: wer ein Feld
 * leert, will es geleert haben. Felder, die gar nicht im Formular waren,
 * tauchen in `ausDemFormular` nicht auf und bleiben unangetastet.
 */
export function payloadZusammenfuehren(bestehend: Payload, ausDemFormular: Payload): Payload {
  return { ...bestehend, ...ausDemFormular }
}

/**
 * Welche Felder des bestehenden Protokolls das Formular nicht abdeckt.
 * Nützlich, um eine Maske gegen ihre eigene Lückenhaftigkeit zu prüfen.
 */
export function nichtImFormular(bestehend: Payload, ausDemFormular: Payload): string[] {
  return Object.keys(bestehend).filter(
    (k) => !(k in ausDemFormular) && bestehend[k] !== undefined && bestehend[k] !== null && bestehend[k] !== '',
  )
}
