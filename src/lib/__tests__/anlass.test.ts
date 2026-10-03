import { describe, it, expect } from 'vitest'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { ANLAESSE, DOKU_KERN, abschnitteFuer, weitereAbschnitte } from '../../katalog/anlass'
import { istSpiegelFeld } from '../../katalog/aelrdSpiegel'

const alle = AELRD_ABSCHNITTE.map((a) => a.id)

describe('Anlass und Hauptweg', () => {
  it('kennt nur Blöcke, die es im Bogen gibt', () => {
    const fremd = [...DOKU_KERN, ...ANLAESSE.flatMap((a) => a.abschnitte)].filter((id) => !alle.includes(id))
    expect(fremd).toEqual([])
  })

  it('macht keinen Block unerreichbar', () => {
    // Ein Block, den kein Anlass zeigt, wäre ein Teil des Protokolls, den
    // niemand ausfüllt — und es fiele erst am leeren Bogen auf.
    const erreichbar = new Set([...DOKU_KERN, ...ANLAESSE.flatMap((a) => a.abschnitte)])
    expect(alle.filter((id) => !erreichbar.has(id))).toEqual([])
  })

  it('zeigt bei jedem Anlass den Kern', () => {
    for (const a of ANLAESSE) {
      const weg = abschnitteFuer([a.id])
      expect(DOKU_KERN.filter((id) => !weg.includes(id))).toEqual([])
    }
  })

  it('behält die Reihenfolge des Bogens', () => {
    // Der Anlass lässt weg, er sortiert nicht um: wer den Bogen kennt, findet
    // alles an derselben Stelle.
    for (const a of [...ANLAESSE.map((x) => [x.id]), [], ANLAESSE.map((x) => x.id)]) {
      const weg = abschnitteFuer(a)
      expect(weg).toEqual(alle.filter((id) => weg.includes(id)))
    }
  })

  it('teilt jeden Block in Hauptweg oder weitere, nie in beide', () => {
    for (const a of ANLAESSE) {
      const weg = abschnitteFuer([a.id])
      const rest = weitereAbschnitte([a.id])
      expect(weg.filter((id) => rest.includes(id))).toEqual([])
      expect([...weg, ...rest].sort()).toEqual([...alle].sort())
    }
  })

  it('macht den Transport am kürzesten und die Reanimation am längsten', () => {
    const laenge = (id: string) => abschnitteFuer([id]).length
    expect(laenge('transport')).toBe(DOKU_KERN.length)
    expect(laenge('reanimation')).toBeGreaterThan(laenge('transport'))
  })

  it('spart gegenüber dem ganzen Bogen spürbar', () => {
    const felderIn = (ids: string[]) =>
      ids.flatMap((id) => AELRD_ABSCHNITTE.find((a) => a.id === id)?.felder ?? [])
        .filter((f) => !istSpiegelFeld(f)).length
    const ganz = felderIn(alle)
    expect(felderIn(abschnitteFuer(['transport']))).toBeLessThan(ganz * 0.75)
    expect(felderIn(abschnitteFuer(['internistisch']))).toBeLessThan(ganz * 0.85)
  })

  it('führt in jedem Block nur Felder, die es gibt', () => {
    const kaputt = AELRD_ABSCHNITTE.flatMap((a) =>
      a.felder.filter((f) => !aelrdFeld(f)).map((f) => `${a.id}.${f}`))
    expect(kaputt).toEqual([])
  })
})
