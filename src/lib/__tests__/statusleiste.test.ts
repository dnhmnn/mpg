// Prüffälle: Ende der Seite in Reichweite des unteren Rands (src/hooks/useStatusleiste.ts).
import { describe, expect, it } from 'vitest'
import { ENDE_NAH_PX, endeNah } from '../../hooks/useStatusleiste'

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
