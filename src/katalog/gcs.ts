// Die Glasgow Coma Scale, wie die Norm sie führt.
//
// Der Bogen hat an der Stelle drei Zahlenfelder und eine Summe. Die Zahlen
// allein sagen aber nichts: eine 4 bei "Verbal" heißt "konversationsfähig,
// verwirrt", und wer das im Kopf haben muss, trägt sie nicht ein oder falsch.
//
// Die drei Skalen stehen deshalb hier — nicht abgeschrieben, sondern aus dem
// Katalog der Norm gelesen (DIVI 6.0, D10 / D1Z / D35). Dort trägt jede
// Option ihren Punktwert, und genau der wird eingetragen.

import { naepEingabe } from './naep'

export type GcsStufe = { punkte: number; text: string }

export type GcsSkala = {
  /** Das Feld des Bogens. */
  feld: string
  titel: string
  /** Von der besten zur schlechtesten Antwort, wie man sie abfragt. */
  stufen: GcsStufe[]
}

function skala(code: string, feld: string, titel: string): GcsSkala {
  const e = naepEingabe(code)
  const optionen = e && 'optionen' in e ? e.optionen : []
  const stufen = optionen
    .map((o) => ({ punkte: Number(o.numerisch), text: o.term }))
    .filter((s) => Number.isFinite(s.punkte))
    .sort((a, b) => b.punkte - a.punkte)
  return { feld, titel, stufen }
}

export const GCS_SKALEN: GcsSkala[] = [
  skala('D10', 'gcs_augen', 'Augen öffnen'),
  skala('D1Z', 'gcs_verbal', 'Beste verbale Reaktion'),
  skala('D35', 'gcs_motorik', 'Beste motorische Reaktion'),
]

/** Das Feld, in dem die Summe steht. */
export const GCS_SUMME = 'gcs_summe'

/** Alle Felder, die das Schema führt. */
export const GCS_FELDER = [...GCS_SKALEN.map((s) => s.feld), GCS_SUMME]

/**
 * Die Summe aus den drei Teilen.
 *
 * Null, solange ein Teil fehlt: eine halbe Summe wäre keine, und eine
 * gerechnete 7 aus zwei Werten stünde im Protokoll wie eine erhobene.
 */
export function gcsSumme(teile: (number | null)[]): number | null {
  if (teile.length !== GCS_SKALEN.length) return null
  if (teile.some((t) => t === null || !Number.isFinite(t))) return null
  return (teile as number[]).reduce((n, t) => n + t, 0)
}

/** Was eine Summe bedeutet — die übliche Einteilung. */
export function gcsSchwere(summe: number | null): string {
  if (summe === null) return ''
  if (summe >= 13) return 'leicht'
  if (summe >= 9) return 'mittel'
  return 'schwer'
}
