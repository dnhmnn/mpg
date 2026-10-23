import { describe, it, expect } from 'vitest'
import { darfBeheben, darfMpgVerwalten } from '../mpg/rechte'
import { PERM_LABELS, ROLES, vergebbareRechte } from '../apps'
import { rechtFrei } from '../freigabe'
import type { User } from '../../types'

const u = (teil: Partial<User>): User => ({ id: 'u1', email: 'anna@x.de', ...teil })
const jetzt = new Date('2026-10-17T12:00:00Z').getTime()

describe('MPG-Rechte: nur Gefährliches geschützt', () => {
  it('MPG verwalten: Admin, MPG-Beauftragte, Supervisor automatisch; sonst nur mit Häkchen', () => {
    expect(darfMpgVerwalten(u({ role: 'admin' }))).toBe(true)
    expect(darfMpgVerwalten(u({ role: 'mpg' }))).toBe(true)
    expect(darfMpgVerwalten(u({ supervisor: true }))).toBe(true)
    expect(darfMpgVerwalten(u({ role: 'lager', permissions: { lager_verwalten: true, dashboard: true } }))).toBe(false)
    expect(darfMpgVerwalten(u({ role: 'benutzer', permissions: { dashboard: true } }))).toBe(false)
    expect(darfMpgVerwalten(u({ role: 'benutzer', permissions: { dashboard: true, mpg_verwalten: true } }))).toBe(true)
    expect(darfMpgVerwalten(null)).toBe(false)
  })

  it('befristet bis zum Ablauf', () => {
    const helfer = u({ permissions: {}, temp_permissions: { mpg_verwalten: { until: '2026-10-17 12:30:00.000Z' } } })
    expect(darfMpgVerwalten(helfer, jetzt)).toBe(true)
    expect(darfMpgVerwalten(helfer, jetzt + 31 * 60_000)).toBe(false)
  })

  it('Beheben: geringe und mittlere Mängel jeder, sperrende Defekte nur mit „MPG verwalten“', () => {
    const helfer = u({ role: 'benutzer', permissions: { dashboard: true } })
    expect(darfBeheben(helfer, 'low')).toBe(true)
    expect(darfBeheben(helfer, 'medium')).toBe(true)
    expect(darfBeheben(helfer, 'high')).toBe(false)
    expect(darfBeheben(helfer, 'critical')).toBe(false)
    expect(darfBeheben(u({ role: 'mpg' }), 'critical')).toBe(true)
    expect(darfBeheben(null, 'low')).toBe(false)
  })

  it('ist vergebbar, gehört zum Modul MPG und steckt in den Rollen Admin und MPG-Beauftragter', () => {
    expect(PERM_LABELS.some(p => p.key === 'mpg_verwalten')).toBe(true)
    expect(ROLES.admin.permissions.mpg_verwalten).toBe(true)
    expect(ROLES.mpg.permissions.mpg_verwalten).toBe(true)
    expect(ROLES.benutzer.permissions.mpg_verwalten).toBeFalsy()
    // MPG abgewählt → nicht vergebbar
    const ohneMpg = { freigeschaltet: ['einsaetze'] }
    expect(rechtFrei(ohneMpg, 'mpg_verwalten')).toBe(false)
    expect(vergebbareRechte(ohneMpg).some(r => r.key === 'mpg_verwalten')).toBe(false)
    expect(vergebbareRechte(null).some(r => r.key === 'mpg_verwalten')).toBe(true)
  })
})
