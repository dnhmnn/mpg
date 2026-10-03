import { describe, it, expect } from 'vitest'
import { ampel, type ReiterStand } from '../../pages/public/doku/Reiter'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { istSpiegelFeld } from '../../katalog/aelrdSpiegel'

const stand = (p: Partial<ReiterStand>): ReiterStand =>
  ({ id: 'x', kurz: 'X', titel: 'X', pflichtGesamt: 0, pflichtOffen: 0, gefuellt: 0, ...p })

describe('Die Ampel der Reiter', () => {
  it('ist rot, solange ein Pflichtfeld offen ist', () => {
    expect(ampel(stand({ pflichtGesamt: 4, pflichtOffen: 1 }))).toBe('offen')
  })

  it('ist grün, wenn alle Pflichtfelder des Blocks stehen', () => {
    expect(ampel(stand({ pflichtGesamt: 4, pflichtOffen: 0 }))).toBe('fertig')
  })

  it('behauptet bei Blöcken ohne Pflichtfelder keine Vollständigkeit', () => {
    // Vierzehn der einundzwanzig Blöcke führen gar keine Pflichtfelder. Sie
    // grün zu färben hieße, eine Vollständigkeit zu behaupten, die niemand
    // geprüft hat — deshalb zeigen sie nur, ob etwas eingetragen wurde.
    expect(ampel(stand({ pflichtGesamt: 0, gefuellt: 0 }))).toBe('leer')
    expect(ampel(stand({ pflichtGesamt: 0, gefuellt: 3 }))).toBe('angefasst')
    expect(ampel(stand({ pflichtGesamt: 0, gefuellt: 3 }))).not.toBe('fertig')
  })

  it('ist rot, auch wenn im Block sonst schon viel steht', () => {
    expect(ampel(stand({ pflichtGesamt: 2, pflichtOffen: 1, gefuellt: 9 }))).toBe('offen')
  })
})

describe('Die Kurzzeichen der Reiter', () => {
  it('gibt es für jeden Block des Bogens', () => {
    const ohne = AELRD_ABSCHNITTE.filter((a) => !a.kurz?.trim()).map((a) => a.id)
    expect(ohne).toEqual([])
  })

  it('bleibt kurz genug für den Rand', () => {
    const zuLang = AELRD_ABSCHNITTE.filter((a) => a.kurz.length > 5).map((a) => `${a.id}: ${a.kurz}`)
    expect(zuLang).toEqual([])
  })

  it('ist für jeden Block ein anderes', () => {
    const kurz = AELRD_ABSCHNITTE.map((a) => a.kurz)
    expect(kurz.length).toBe(new Set(kurz).size)
  })
})

describe('Pflichtfelder im Bogen', () => {
  it('stehen in sieben Blöcken, und die Ampel zeigt nur dort rot oder grün', () => {
    // Haelt den Stand fest: wenn jemand ein Feld zum Pflichtfeld macht,
    // aendert sich hier die Zahl und es faellt auf.
    const mitPflicht = AELRD_ABSCHNITTE.filter((a) =>
      a.felder.filter((id) => !istSpiegelFeld(id)).some((id) => aelrdFeld(id)?.pflicht),
    )
    expect(mitPflicht.map((a) => a.id)).toEqual([
      'stammdaten', 'kennung', 'einsatzdaten', 'zeiten', 'notfallgeschehen', 'messwerte', 'neurologie',
    ])
  })
})
