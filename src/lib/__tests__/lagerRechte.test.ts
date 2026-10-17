import { describe, it, expect } from 'vitest'
import { darfLager, darfLagerVerwalten, darfStornieren } from '../lagerRechte'
import { befristungBis, zeitpunktBefristung } from '../apps'
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

describe('Befristete Rechte im PocketBase-Format', () => {
  it('gespeichert mit Leerzeichen, so wie PocketBase @now vergleicht', () => {
    expect(befristungBis(Date.UTC(2026, 9, 18, 7, 0, 0))).toBe('2026-10-18 07:00:00.000Z')
  })

  it('gelesen werden neues und altes Format; Unlesbares gilt als abgelaufen', () => {
    expect(zeitpunktBefristung('2026-10-18 07:00:00.000Z')).toBe(Date.UTC(2026, 9, 18, 7))
    expect(zeitpunktBefristung('2026-10-18T07:00:00.000Z')).toBe(Date.UTC(2026, 9, 18, 7))
    expect(zeitpunktBefristung('quatsch')).toBe(0)
  })

  it('befristetes Lager-Recht gilt bis zum Ablauf, auf die Minute', () => {
    const helfer = u({ permissions: {}, temp_permissions: { lager: { until: '2026-10-17 12:30:00.000Z' } } })
    expect(darfLager(helfer, jetzt)).toBe(true)
    expect(darfLager(helfer, jetzt + 31 * 60_000)).toBe(false)
    const verw = u({ permissions: { lager: true }, temp_permissions: { lager_verwalten: { until: '2026-10-17 13:00:00.000Z' } } })
    expect(darfLagerVerwalten(verw, jetzt)).toBe(true)
    expect(darfLagerVerwalten(verw, jetzt + 2 * 3600_000)).toBe(false)
  })
})
