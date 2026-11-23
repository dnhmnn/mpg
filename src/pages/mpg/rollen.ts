// Rollposition beim Wechsel innerhalb des MPG (Owner, 22.11.2026: jeder Bereich eine eigene Seite).
// Reine Rechnung (Prüffälle: src/lib/__tests__/mpgKopf.test.ts); angewandt in MpgLayout.

/** Bereich eines MPG-Pfads: „/mpg/geraete/abc/pruefen“ → „geraete“, „/mpg“ → „“. */
export function bereichVon(pfad: string): string {
  return pfad.replace(/^\/mpg\/?/, '').split('/')[0] || ''
}

/**
 * Wohin rollen, wenn der Pfad wechselt? null: stehen lassen.
 * - Gleicher Pfad: stehen lassen.
 * - Zurück (Browser, Wischen, Zurück-Knopf mit Verlauf) und eine gemerkte Stelle: dorthin.
 * - Am Rechner im selben Bereich (Liste mit Gerät oder Fall daneben): stehen lassen.
 * - Sonst nach oben: Eine neue Seite beginnt mit sichtbarem rotem Kopf.
 */
export function rollZiel(o: { alt: string; neu: string; zurueck: boolean; breit: boolean; gemerkt?: number }): number | null {
  if (o.alt === o.neu) return null
  if (o.zurueck && typeof o.gemerkt === 'number') return o.gemerkt
  if (o.breit && bereichVon(o.alt) === bereichVon(o.neu) && bereichVon(o.neu) !== '') return null
  return 0
}
