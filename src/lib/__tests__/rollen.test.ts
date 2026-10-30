import { describe, it, expect } from 'vitest'
import { PERM_LABELS, ROLES, ROLLEN, getRoleTemplate, rollenName } from '../apps'

describe('Rollen beim Anlegen', () => {
  it('Leitung und Einsatzkraft vorn, dann die Fachrollen, Teilnehmende zuletzt; nach Aufgabe benannt', () => {
    expect(ROLLEN.map((r) => r.id)).toEqual(['admin', 'benutzer', 'fuehrung', 'medizin', 'mpg', 'lager', 'ausbildung', 'qm', 'teilnehmer'])
    expect(rollenName('admin')).toBe('Leitung (Admin)')
    expect(rollenName('lager')).toBe('Material & Lager')
    expect(rollenName('unbekannt')).toBe('unbekannt')
    expect(rollenName(undefined)).toBe('Einsatzkraft')
  })

  it('jede Rolle außer Teilnehmer hat eine Rechte-Vorlage', () => {
    for (const r of ROLLEN) {
      if (r.id === 'teilnehmer') expect(ROLES[r.id]).toBeUndefined()
      else expect(ROLES[r.id], r.id).toBeDefined()
    }
  })

  it('Admin hat alle Rechte samt Benutzerverwaltung', () => {
    for (const p of PERM_LABELS) expect(ROLES.admin.permissions[p.key], p.key).toBe(true)
    expect(ROLES.admin.permissions.produktausgabe).toBe(true)
  })

  it('Benutzer hat die normalen Rechte, keine Verwaltung', () => {
    expect(ROLES.benutzer.permissions).toEqual({ dashboard: true, lernbar: true, chat: true, notizen: true })
  })

  it('Leitung und Teilnehmende sind fest, Fachrollen kann eine Organisation anpassen', () => {
    const org = { role_permissions: { admin: { unitarii: false, lager: true }, teilnehmer: { patienten: true }, mpg: { lager: true } } }
    expect(getRoleTemplate('admin', org)).toEqual(ROLES.admin.permissions)
    expect(getRoleTemplate('teilnehmer', org)).toEqual({})
    expect(getRoleTemplate('mpg', org)).toEqual({ lager: true })
    expect(getRoleTemplate('mpg', {})).toEqual(ROLES.mpg.permissions)
  })
})

describe('Konten ohne Rechte erkennen', () => {
  const jetzt = Date.parse('2026-10-29T12:00:00Z')
  const pb = (ms: number) => new Date(ms).toISOString().replace('T', ' ')

  it('neu angelegt mit lauter Nein-Häkchen sieht nichts', async () => {
    const { ohneRechte, EMPTY_PERMS } = await import('../apps')
    expect(ohneRechte({ role: 'benutzer', permissions: { ...EMPTY_PERMS } }, jetzt)).toBe(true)
    expect(ohneRechte({ role: 'benutzer' }, jetzt)).toBe(true)
  })

  it('ein einziges Recht, Supervisor oder ein laufendes befristetes Recht reicht', async () => {
    const { ohneRechte } = await import('../apps')
    expect(ohneRechte({ role: 'benutzer', permissions: { chat: true } }, jetzt)).toBe(false)
    expect(ohneRechte({ role: 'admin', supervisor: true, permissions: {} }, jetzt)).toBe(false)
    expect(ohneRechte({ role: 'benutzer', permissions: {}, temp_permissions: { lager: { until: pb(jetzt + 3600_000) } } }, jetzt)).toBe(false)
  })

  it('ein abgelaufenes befristetes Recht zählt nicht', async () => {
    const { ohneRechte } = await import('../apps')
    expect(ohneRechte({ role: 'benutzer', permissions: {}, temp_permissions: { lager: { until: pb(jetzt - 60_000) } } }, jetzt)).toBe(true)
  })

  it('Teilnehmer haben absichtlich keine Rechte und zählen nicht', async () => {
    const { ohneRechte } = await import('../apps')
    expect(ohneRechte({ role: 'teilnehmer', permissions: {} }, jetzt)).toBe(false)
  })
})
