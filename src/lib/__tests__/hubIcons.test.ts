import { describe, it, expect } from 'vitest'
import { HUB_ICONS } from '../hubIcons'
import { ALL_APPS } from '../apps'

const PREFIX = 'data:image/svg+xml,'
const lesen = (wert: string) => decodeURIComponent(wert.slice(PREFIX.length))

describe('Hub-Symbole (erzeugt mit npm run hub-icons)', () => {
  it('zu jeder App gibt es hell und dunkel', () => {
    for (const id of Object.keys(ALL_APPS)) {
      expect(HUB_ICONS[id]?.hell, `${id} hell`).toBeTruthy()
      expect(HUB_ICONS[id]?.dunkel, `${id} dunkel`).toBeTruthy()
    }
  })

  for (const [id, s] of Object.entries(HUB_ICONS)) {
    for (const art of ['hell', 'dunkel'] as const) {
      it(`${id} ${art}: rundes SVG, sicher, eigene IDs`, () => {
        const wert = s[art]
        expect(wert.startsWith(PREFIX)).toBe(true)
        const svg = lesen(wert)
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">')).toBe(true)
        expect(svg).toContain('viewBox="0 0 100 100"')
        // Die Kachel ist selbst rund
        expect(svg).toMatch(/<clipPath id="[^"]+"><rect width="100" height="100" rx="22.37"\/><\/clipPath>/)
        expect(svg).not.toMatch(/<script/i)
        expect(svg).not.toMatch(/\son\w+\s*=/i)
        expect(svg).not.toMatch(/href="http/i)
        expect(svg).not.toMatch(/<foreignObject/i)
        const p = `${id}-${art === 'hell' ? 'h' : 'd'}-`
        const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
        expect(ids.length).toBeGreaterThan(0)
        for (const x of ids) expect(x.startsWith(p), x).toBe(true)
        expect(new Set(ids).size).toBe(ids.length)
        for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(m[1])
        expect(svg).not.toContain('id="bg"')
      })
    }
    it(`${id}: hell und dunkel unterscheiden sich`, () => {
      expect(s.hell).not.toBe(s.dunkel)
    })
  }
})
