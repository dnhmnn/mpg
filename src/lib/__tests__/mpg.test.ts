// Bindet den Selbsttest des MPG-Rechenkerns an vitest an.
// Die Prüffälle bleiben in src/lib/mpg/selbsttest.ts, damit sie auch in der App
// aufrufbar sind — hier werden sie zusätzlich in der CI geprüft.
import { describe, it, expect } from 'vitest'
import { laufeMpgSelbsttest } from '../mpg/selbsttest'

describe('MPG: Fristen, Gerätezustand, Prüfergebnis', () => {
  const ergebnisse = laufeMpgSelbsttest()

  it('hat Prüffälle', () => {
    expect(ergebnisse.length).toBeGreaterThan(50)
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
