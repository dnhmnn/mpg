// Roter Kopf des MPG (src/pages/mpg/kopf.tsx, Owner 22.11.2026): Welche Ansicht bestimmt Titel und Zurück?
import { describe, expect, it } from 'vitest'
import { gleicherKopf, siegerVon, type KopfEintrag } from '../../pages/mpg/kopf'

const e = (x: Partial<KopfEintrag>): KopfEintrag => ({ id: 1, tiefe: 0, titel: 'Medizinprodukte', zurueck: '/hub', ...x })

describe('Welcher Kopf gilt', () => {
  it('die tiefste Ansicht: auf dem Telefon das Gerät über der Liste', () => {
    const liste = e({ id: 5, tiefe: 1, titel: 'Geräte', zurueck: '/mpg' })
    const geraet = e({ id: 4, tiefe: 2, titel: 'Absaugpumpe HLF 20/1', zurueck: '/mpg/geraete' })
    expect(siegerVon([liste, geraet])?.titel).toBe('Absaugpumpe HLF 20/1')
  })
  it('bei gleicher Tiefe die zuletzt gemeldete', () => {
    expect(siegerVon([e({ id: 2, tiefe: 1, titel: 'A' }), e({ id: 3, tiefe: 1, titel: 'B' })])?.titel).toBe('B')
  })
  it('ohne Meldung: keiner (der Rahmen zeigt dann „Medizinprodukte“)', () => {
    expect(siegerVon([])).toBeNull()
  })
  it('unveränderter Kopf zeichnet nicht neu', () => {
    const a = e({ id: 7, titel: 'Fristen', unter: 'STK', tiefe: 1, zurueck: '/mpg' })
    expect(gleicherKopf(a, { ...a })).toBe(true)
    expect(gleicherKopf(a, { ...a, unter: 'MTK' })).toBe(false)
    expect(gleicherKopf(undefined, a)).toBe(false)
  })
})

describe('Rollposition innerhalb des MPG (src/pages/mpg/rollen.ts)', async () => {
  const { bereichVon, rollZiel } = await import('../../pages/mpg/rollen')
  it('Bereich eines Pfads', () => {
    expect(bereichVon('/mpg')).toBe('')
    expect(bereichVon('/mpg/geraete/abc/pruefen')).toBe('geraete')
    expect(bereichVon('/mpg/runde/hlf')).toBe('runde')
  })
  it('neue Seite beginnt oben, auch vom Start in die Prüfrunde', () => {
    expect(rollZiel({ alt: '/mpg', neu: '/mpg/runde/hlf', zurueck: false, breit: false })).toBe(0)
    expect(rollZiel({ alt: '/mpg/geraete', neu: '/mpg/geraete/abc', zurueck: false, breit: false })).toBe(0)
  })
  it('zurück an die gemerkte Stelle der Liste', () => {
    expect(rollZiel({ alt: '/mpg/geraete/abc', neu: '/mpg/geraete', zurueck: true, breit: false, gemerkt: 840 })).toBe(840)
    expect(rollZiel({ alt: '/mpg/geraete/abc', neu: '/mpg/geraete', zurueck: true, breit: false })).toBe(0)
  })
  it('am Rechner bleibt die Liste stehen, wenn nur das Gerät daneben wechselt', () => {
    expect(rollZiel({ alt: '/mpg/geraete/a', neu: '/mpg/geraete/b', zurueck: false, breit: true })).toBeNull()
    expect(rollZiel({ alt: '/mpg/geraete', neu: '/mpg/meldungen', zurueck: false, breit: true })).toBe(0)
    expect(rollZiel({ alt: '/mpg/geraete', neu: '/mpg/geraete', zurueck: false, breit: false })).toBeNull()
  })
})
