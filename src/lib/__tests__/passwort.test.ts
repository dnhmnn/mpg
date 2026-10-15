import { describe, it, expect } from 'vitest'
import { zufallsPasswort } from '../passwort'

describe('Passwort, das niemand kennt', () => {
  it('ist lang genug für PocketBase (8 bis 71 Zeichen) und jedes Mal anders', () => {
    const a = zufallsPasswort()
    expect(a).toHaveLength(32)
    expect(a).toMatch(/^[A-Za-z2-9]+$/)
    expect(new Set(Array.from({ length: 50 }, () => zufallsPasswort())).size).toBe(50)
  })
})
