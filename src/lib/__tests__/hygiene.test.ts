// Bindet den Selbsttest des Hygiene-Rechenkerns an vitest an.
// Die Prüffälle bleiben in src/l../hygiene/selbsttest.ts, damit sie auch in der App
// aufrufbar sind — hier werden sie zusätzlich in der CI geprüft.
// Die Fälle rechnen nach Ortszeit: einmal in Deutschland (Sommer-/Winterzeit, Mitternacht
// vor UTC) und einmal in UTC, wie die CI läuft — sonst fiele ein Fehler nur in einer auf.
import { describe, it, expect } from 'vitest'
import { laufeHygieneSelbsttest } from '../hygiene/selbsttest'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

for (const zone of ['Europe/Berlin', 'UTC']) {
  describe(`Hygiene: Fälligkeit, Checklisten, Vorschläge, Pläne (${zone})`, () => {
    const vorher = env.TZ
    env.TZ = zone
    const versatz = new Date(2026, 6, 1).getTimezoneOffset()
    const ergebnisse = laufeHygieneSelbsttest()
    if (vorher === undefined) delete env.TZ
    else env.TZ = vorher

    it('rechnet in der verlangten Zeitzone', () => {
      expect(versatz).toBe(zone === 'UTC' ? 0 : -120)
    })

    it('hat Prüffälle', () => {
      expect(ergebnisse.length).toBeGreaterThan(40)
    })

    it('Namen sind eindeutig', () => {
      expect(new Set(ergebnisse.map(e => e.name)).size).toBe(ergebnisse.length)
    })

    for (const e of ergebnisse) {
      it(e.name, () => {
        expect(e.ok, `erwartet ${e.erwartet}, erhalten ${e.erhalten}`).toBe(true)
      })
    }
  })
}
