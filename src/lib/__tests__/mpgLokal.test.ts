import { describe, it, expect, beforeEach } from 'vitest'
import { offeneMpgDaten, entwurfSchluessel, unklarSchluessel } from '../mpg/lokal'

// vitest läuft ohne Browser — localStorage nachbauen
const speicher = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => { speicher.set(k, v) },
  removeItem: (k: string) => { speicher.delete(k) },
}

describe('MPG: lokal festgehaltene Daten (Warnung beim Abmelden)', () => {
  beforeEach(() => speicher.clear())

  it('nichts da', () => {
    expect(offeneMpgDaten('u1', 'o1')).toEqual({ unklar: 0, entwurf: false })
  })

  it('zählt unklare Defektmeldungen und Bestätigungen', () => {
    speicher.set(unklarSchluessel('u1', 'o1'), JSON.stringify({ defekte: { g1: {}, g2: {} }, bestaetigungen: { m1: {} } }))
    expect(offeneMpgDaten('u1', 'o1')).toEqual({ unklar: 3, entwurf: false })
  })

  it('begonnene Prüfung ist ein Entwurf, unklar gesendete zählt als unklar', () => {
    speicher.set(entwurfSchluessel('u1', 'o1'), JSON.stringify({ results: [] }))
    expect(offeneMpgDaten('u1', 'o1')).toEqual({ unklar: 0, entwurf: true })
    speicher.set(entwurfSchluessel('u1', 'o1'), JSON.stringify({ results: [], versucht: { ergebnis: 'mangel', zeit: 'x' } }))
    expect(offeneMpgDaten('u1', 'o1')).toEqual({ unklar: 1, entwurf: false })
  })

  it('nur die eigenen — andere Person oder Organisation zählt nicht', () => {
    speicher.set(unklarSchluessel('u2', 'o1'), JSON.stringify({ defekte: { g1: {} }, bestaetigungen: {} }))
    speicher.set(entwurfSchluessel('u1', 'o2'), JSON.stringify({ results: [] }))
    expect(offeneMpgDaten('u1', 'o1')).toEqual({ unklar: 0, entwurf: false })
  })

  it('kaputte Einträge stören nicht', () => {
    speicher.set(unklarSchluessel('u1', 'o1'), '{kaputt')
    speicher.set(entwurfSchluessel('u1', 'o1'), 'null')
    expect(offeneMpgDaten('u1', 'o1')).toEqual({ unklar: 0, entwurf: false })
    expect(offeneMpgDaten(undefined, 'o1')).toEqual({ unklar: 0, entwurf: false })
  })
})
