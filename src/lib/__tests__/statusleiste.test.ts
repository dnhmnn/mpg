// Prüffälle: Ende der Seite in Reichweite des unteren Rands (src/hooks/useStatusleiste.ts).
import { describe, expect, it } from 'vitest'
import { ENDE_NAH_HOECHSTENS_PX, ENDE_NAH_PX, endeNah, reichweiteFuer } from '../../hooks/useStatusleiste'

describe('Statusleiste: Ende der Seite nah', () => {
  it('kurze Seite in Ruhe (passt ins Fenster): ja', () => {
    expect(endeNah(0, 800, 800)).toBe(true)
  })
  it('Seite reicht knapp weiter als der Spielraum: nein', () => {
    expect(endeNah(0, 800, 800 + ENDE_NAH_PX)).toBe(false)
    expect(endeNah(0, 800, 800 + ENDE_NAH_PX - 1)).toBe(true)
  })
  it('lange Seite mittendrin: nein, ganz unten: ja, beim Nachfedern: ja', () => {
    expect(endeNah(400, 800, 3000)).toBe(false)
    expect(endeNah(2200, 800, 3000)).toBe(true)
    expect(endeNah(2260, 800, 3000)).toBe(true)
  })
})

describe('Statusleiste: Reichweite des Bereichs unter dem Fenster', () => {
  it('Safari hochkant: Bildschirm 852, Fenster 739 (Leiste aufgeklappt) -> 129; eingeklappt 790 -> 90 (Mindestwert)', () => {
    expect(reichweiteFuer(393, 739, 393, 852)).toBe(129)
    expect(reichweiteFuer(393, 790, 393, 852)).toBe(ENDE_NAH_PX)
  })
  it('quer: die kürzere Bildschirmseite zählt', () => {
    expect(reichweiteFuer(852, 300, 393, 852)).toBe(109)
  })
  it('nie mehr als der Höchstwert, ohne Bildschirmangabe der Mindestwert', () => {
    expect(reichweiteFuer(1200, 600, 1920, 1080)).toBe(ENDE_NAH_HOECHSTENS_PX)
    expect(reichweiteFuer(390, 844, 0, 0)).toBe(ENDE_NAH_PX)
  })
  it('mit größerer Reichweite kommt das Ende früher in Reichweite', () => {
    expect(endeNah(0, 739, 739 + 120)).toBe(false)
    expect(endeNah(0, 739, 739 + 120, reichweiteFuer(393, 739, 393, 852))).toBe(true)
  })
})
