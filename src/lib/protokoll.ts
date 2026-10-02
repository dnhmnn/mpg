// Fassungen des Patientenprotokolls.
//
// 1.0  Das gewachsene eigene Protokoll. Bleibt unangetastet: bestehende
//      Datensätze werden weiter in der alten Maske angezeigt und gedruckt.
//      Ein rechtlich bedeutsames Dokument wird nicht nachträglich
//      umgerechnet — was dokumentiert wurde, bleibt, wie es dokumentiert
//      wurde.
//
// 2.0  Nach DIVI-Notfallprotokoll 6.0 und dem Datensatz MIND 3.1.
//
// WARUM EIN FELD STATT EINER VERMUTUNG: Die Fassung wird im payload
// mitgeschrieben, nicht aus dem Vorhandensein einzelner Felder erraten. Ein
// Protokoll, bei dem die Hälfte leer blieb, sähe sonst aus wie die andere
// Fassung — und würde falsch dargestellt.

export type Fassung = 1 | 2

/** Die Fassung, in der neue Protokolle angelegt werden. */
export const NEUE_FASSUNG: Fassung = 2

export const FASSUNG_NAME: Record<Fassung, string> = {
  1: '1.0',
  2: '2.0 (DIVI 6.0)',
}

/**
 * Die Fassung eines Protokolls.
 *
 * Fehlt die Angabe, ist es 1.0 — alle Datensätze von vor der Einführung
 * tragen sie nicht. Das ist der einzige richtige Rückfall: neuere Protokolle
 * schreiben sie immer mit.
 */
export function fassungLesen(payload: unknown): Fassung {
  if (!payload || typeof payload !== 'object') return 1
  const v = (payload as Record<string, unknown>).protokoll_version
  const n = typeof v === 'string' ? Number(v) : v
  return n === 2 ? 2 : 1
}

/** Ist das ein Protokoll nach DIVI? */
export function istDivi(payload: unknown): boolean {
  return fassungLesen(payload) === 2
}

/**
 * Die Fassung in einen neuen Datensatz schreiben.
 *
 * Immer über diese Funktion, damit es keine Stelle gibt, die sie vergisst.
 */
export function mitFassung<T extends Record<string, unknown>>(
  payload: T, fassung: Fassung = NEUE_FASSUNG,
): T & { protokoll_version: Fassung } {
  return { ...payload, protokoll_version: fassung }
}
