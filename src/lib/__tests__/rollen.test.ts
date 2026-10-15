import { describe, it, expect } from 'vitest'
import { PERM_LABELS, ROLES, ROLLEN, getRoleTemplate, rollenName } from '../apps'

describe('Rollen beim Anlegen', () => {
  it('Admin und Benutzer stehen vorn, die Fachrollen bleiben, Teilnehmer zuletzt', () => {
    expect(ROLLEN.map((r) => r.id)).toEqual(['admin', 'benutzer', 'mpg', 'lager', 'ausbildung', 'qm', 'teilnehmer'])
    expect(rollenName('admin')).toBe('Admin')
    expect(rollenName('lager')).toBe('Lagerwart')
    expect(rollenName('unbekannt')).toBe('unbekannt')
    expect(rollenName(undefined)).toBe('Benutzer')
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

  it('eine Organisation kann die Admin-Vorlage anpassen', () => {
    const org = { role_permissions: { admin: { unitarii: true, lager: true } } }
    expect(getRoleTemplate('admin', org)).toEqual({ unitarii: true, lager: true })
    expect(getRoleTemplate('admin', {})).toEqual(ROLES.admin.permissions)
  })
})
