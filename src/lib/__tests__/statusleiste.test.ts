// Prüffälle: Seitenende für die Farbe unter der Safari-Leiste (src/hooks/useStatusleiste.ts).
import { describe, expect, it } from 'vitest'
import { endeErreicht } from '../../hooks/useStatusleiste'

describe('Statusleiste: Seitenende erreicht', () => {
  it('in Ruhe ganz oben nie, auch wenn die Seite kurz ist', () => {
    expect(endeErreicht({ scrollY: 0, innerHeight: 800 }, 800)).toBe(false)
    expect(endeErreicht({ scrollY: 0, innerHeight: 800 }, 500)).toBe(false)
  })
  it('nach dem Scrollen am Ende: ja (kurze Seite, roter Kopf noch zu sehen)', () => {
    expect(endeErreicht({ scrollY: 120, innerHeight: 800 }, 920)).toBe(true)
    expect(endeErreicht({ scrollY: 119.5, innerHeight: 800 }, 920)).toBe(true)
  })
  it('mitten auf einer langen Seite: nein', () => {
    expect(endeErreicht({ scrollY: 120, innerHeight: 800 }, 3000)).toBe(false)
  })
})
