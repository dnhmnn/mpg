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

/**
 * Die drei Skalen für einen Erhebungszeitpunkt.
 *
 * Der Bogen erhebt die GCS zweimal: beim Erstbefund und bei der Übergabe.
 * Dieselbe Skala, andere Felder — `vorsatz` ist 'ub_' für die Übergabe.
 */
export function gcsSkalen(vorsatz = ''): GcsSkala[] {
  return [
    skala('D10', `${vorsatz}gcs_augen`, 'Augen öffnen'),
    skala('D1Z', `${vorsatz}gcs_verbal`, 'Beste verbale Reaktion'),
    skala('D35', `${vorsatz}gcs_motorik`, 'Beste motorische Reaktion'),
  ]
}

export const GCS_SKALEN: GcsSkala[] = gcsSkalen()

/** Das Feld, in dem die Summe steht. */
export const GCS_SUMME = 'gcs_summe'

export function gcsSummeFeld(vorsatz = ''): string {
  return `${vorsatz}gcs_summe`
}

/** Alle Felder, die das Schema führt. */
export function gcsFelder(vorsatz = ''): string[] {
  return [...gcsSkalen(vorsatz).map((s) => s.feld), gcsSummeFeld(vorsatz)]
}

export const GCS_FELDER = gcsFelder()

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
