// Fassungen des Patientenprotokolls.
//
// 1.0  Das gewachsene eigene Protokoll. Bleibt unangetastet: bestehende
//      Datensätze werden weiter in der alten Maske angezeigt und gedruckt.
//      Ein rechtlich bedeutsames Dokument wird nicht nachträglich
//      umgerechnet — was dokumentiert wurde, bleibt, wie es dokumentiert
//      wurde.
//
// 2.0  Nach dem bayerischen ÄLRD-Einsatzprotokoll (NIDA/medDV), das sich
//      auf DIVI 6.0 und MIND 4.0 stützt. Layout und Feldlisten stammen aus
//      dem gedruckten Bogen, nicht aus der Norm selbst.
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
 * tragen sie nicht.
 *
 * EINE AUSNAHME, und zwar keine Vermutung: Die neue Maske schrieb die
 * Fassung eine Zeit lang nicht mit. Ihre Protokolle tragen aber `abgesendet`,
 * einen Zeitstempel, den genau eine Stelle setzt — `datensatz()` beim
 * Absenden (siehe pages/public/doku/absenden.ts). Das ist kein Feld des
 * Bogens, sondern eine Herkunftsangabe: steht sie da, kam das Protokoll aus
 * der neuen Maske und trägt die Feldnamen des ÄLRD-Bogens. Geraten wird
 * weiterhin nichts — aus Inhalten wird die Fassung nie abgeleitet, ein halb
 * leeres Protokoll sähe sonst aus wie die andere Fassung.
 */
export function fassungLesen(payload: unknown): Fassung {
  if (!payload || typeof payload !== 'object') return 1
  const p = payload as Record<string, unknown>
  const v = p.protokoll_version
  const n = typeof v === 'string' ? Number(v) : v
  if (n === 2) return 2
  if (n === 1) return 1
  return typeof p.abgesendet === 'string' && p.abgesendet !== '' ? 2 : 1
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
