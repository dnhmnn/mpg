import { describe, it, expect } from 'vitest'
import { laufeGs1Selbsttest } from '../gs1.selbsttest'

describe('GS1-Auswertung (DataMatrix auf Medizinprodukten)', () => {
  const ergebnisse = laufeGs1Selbsttest()

  it('hat Prüffälle', () => {
    expect(ergebnisse.length).toBeGreaterThan(15)
  })

  for (const e of ergebnisse) {
    it(e.name, () => {
      // Das Urteil kommt aus dem Selbsttest — der kennt die zulässige Toleranz.
      // Die Anzeigewerte sind gerundet und taugen nicht zum Vergleich.
      expect(e.ok, `erwartet ${e.erwartet}, erhalten ${e.erhalten}`).toBe(true)
    })
  }
})
