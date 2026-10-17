import { describe, it, expect } from 'vitest'
import { darfLager, darfLagerVerwalten, darfStornieren } from '../lagerRechte'
import type { User } from '../../types'

const u = (teil: Partial<User>): User => ({ id: 'u1', email: 'anna@x.de', ...teil })
const jetzt = new Date('2026-10-17T12:00:00Z').getTime()

describe('Lager-Rechte: nur Gefährliches geschützt', () => {
  it('Lager verwalten: Admin, Lagerwart, MPG, Supervisor automatisch; sonst nur mit Häkchen', () => {
    expect(darfLagerVerwalten(u({ role: 'admin' }))).toBe(true)
    expect(darfLagerVerwalten(u({ role: 'lager' }))).toBe(true)
    expect(darfLagerVerwalten(u({ role: 'mpg' }))).toBe(true)
    expect(darfLagerVerwalten(u({ supervisor: true }))).toBe(true)
    expect(darfLagerVerwalten(u({ role: 'benutzer', permissions: { lager: true } }))).toBe(false)
    expect(darfLagerVerwalten(u({ role: 'benutzer', permissions: { lager: true, lager_verwalten: true } }))).toBe(true)
    expect(darfLagerVerwalten(null)).toBe(false)
  })

  it('Lager selbst: nur mit dem Recht „Lager“ (oder befristet, oder Supervisor)', () => {
    expect(darfLager(u({ permissions: { lager: true } }))).toBe(true)
    expect(darfLager(u({ permissions: {} }))).toBe(false)
    expect(darfLager(u({ temp_permissions: { lager: { until: '2026-10-18T00:00:00Z' } } }), jetzt)).toBe(true)
  })

  it('Stornieren: fremde nur mit „Lager verwalten“, eigene noch 24 Stunden lang', () => {
    const helfer = u({ permissions: { lager: true } })
    expect(darfStornieren(helfer, { user: 'anna@x.de', zeit: '2026-10-17 08:00:00.000Z' }, jetzt)).toBe(true)
    expect(darfStornieren(helfer, { user: 'ANNA@x.de', zeit: '2026-10-17 08:00:00.000Z' }, jetzt)).toBe(true)
    expect(darfStornieren(helfer, { user: 'anna@x.de', zeit: '2026-10-16 08:00:00.000Z' }, jetzt)).toBe(false)
    expect(darfStornieren(helfer, { user: 'ben@x.de', zeit: '2026-10-17 11:00:00.000Z' }, jetzt)).toBe(false)
    expect(darfStornieren(u({ role: 'lager', permissions: { lager: true } }), { user: 'ben@x.de', zeit: '2020-01-01 00:00:00.000Z' }, jetzt)).toBe(true)
    expect(darfStornieren(u({ permissions: {} }), { user: 'anna@x.de', zeit: '2026-10-17 11:00:00.000Z' }, jetzt)).toBe(false)
  })
})
