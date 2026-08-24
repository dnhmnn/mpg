// Bindet den vorhandenen Selbsttest an vitest an.
// Die Prüffälle bleiben bewusst in atemschutz-selbsttest.ts, damit sie auch in
// der App aufrufbar sind — hier werden sie zusätzlich in der CI geprüft.
import { describe, it, expect } from 'vitest'
import { laufeSelbsttest } from '../eks/selbsttest'

describe('Atemschutz-Berechnung (FwDV 7)', () => {
  const ergebnisse = laufeSelbsttest()

  it('hat Prüffälle', () => {
    expect(ergebnisse.length).toBeGreaterThan(10)
  })

  for (const e of ergebnisse) {
    it(e.name, () => {
      // Das Urteil kommt aus dem Selbsttest — der kennt die zulässige Toleranz.
      // Die Anzeigewerte sind gerundet und taugen nicht zum Vergleich.
      expect(e.ok, `erwartet ${e.erwartet}, erhalten ${e.erhalten}`).toBe(true)
    })
  }
})
