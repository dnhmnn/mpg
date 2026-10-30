// Eigene Rollen außerhalb der Benutzerverwaltung: Supervisor, Einstellungen, Hub, erster Login.
import { describe, it, expect } from 'vitest'
import { getRoleTemplate } from '../apps'
import { verknuepfungen, vorlageMitVerknuepfungen } from '../verknuepfung'
import { nurAngehakt, rollenBezeichnung } from '../rollen'
import { vorlageNachziehen } from '../../hooks/useAuth'

const org = {
  id: 'org1',
  eigene_rollen: [
    { id: 'eigen_kasse001', name: 'Kassenwart' },
    { id: 'eigen_alt00001', name: 'Altrolle', archiviert: true },
  ],
  // Vorlagen werden vollständig gespeichert, auch mit „nein“
  role_permissions: {
    benutzer: { dashboard: true, lernbar: true, chat: false, notizen: false },
    eigen_kasse001: { dateien: true, dokumente: true, chat: false, patienten: false },
  },
}

/** Wie Supervisor.tsx beim Rollenwechsel: Vorlage samt verknüpfter Rechte, nur die Häkchen */
function rollenwechsel(alt: Record<string, boolean>, rolle: string): Record<string, boolean> {
  return { ...alt, ...nurAngehakt(vorlageMitVerknuepfungen(getRoleTemplate(rolle, org), verknuepfungen(org), org)) }
}

describe('Rollenwechsel beim Supervisor', () => {
  it('die neue Rolle ergänzt Häkchen und nimmt keine weg, auch wenn ihre Vorlage „nein“ sagt', () => {
    const alt = { chat: true, patienten: true, lernbar: true }
    expect(rollenwechsel(alt, 'eigen_kasse001')).toEqual({ chat: true, patienten: true, lernbar: true, dateien: true, dokumente: true })
    // So war es vorher: das „nein“ der Vorlage überschrieb bestehende Rechte
    const vorher = { ...alt, ...vorlageMitVerknuepfungen(getRoleTemplate('eigen_kasse001', org), verknuepfungen(org), org) }
    expect(vorher.chat).toBe(false)
    expect(vorher.patienten).toBe(false)
  })

  it('eine eigene Rolle ohne Vorlage bringt nichts mit', () => {
    expect(rollenwechsel({ chat: true }, 'eigen_alt00001')).toEqual({ chat: true })
  })
})

describe('Rollen-Bezeichnung in Supervisor, Einstellungen und Profil', () => {
  it('vorgegebene Rollen mit ihrem Namen, auch Admin (die Einstellungen zeigten „Benutzer“)', () => {
    expect(rollenBezeichnung('admin', org)).toBe('Leitung (Admin)')
    expect(rollenBezeichnung('mpg', org)).toBe('Medizinprodukte')
    expect(rollenBezeichnung('teilnehmer', org)).toBe('Teilnehmende')
    expect(rollenBezeichnung(undefined, org)).toBe('Einsatzkraft')
    expect(rollenBezeichnung('', org)).toBe('Einsatzkraft')
  })

  it('eigene Rollen mit ihrem Namen, archivierte auch, gelöschte als „Unbekannte Rolle“', () => {
    expect(rollenBezeichnung('eigen_kasse001', org)).toBe('Kassenwart')
    expect(rollenBezeichnung('eigen_alt00001', org)).toBe('Altrolle')
    expect(rollenBezeichnung('eigen_weg00001', org)).toBe('Unbekannte Rolle')
  })

  it('alte, unbekannte Werte erscheinen, wie sie sind', () => {
    expect(rollenBezeichnung('mitglied', org)).toBe('mitglied')
  })
})

describe('Erster Login: Rollen-Vorlage nachziehen', () => {
  const alt = (role?: string) => ({ role, permissions_migrated: false })

  it('vorgegebene Rolle: mit Netz, auch ohne frisch geladene Organisation (Standardvorlage)', () => {
    expect(vorlageNachziehen(alt('benutzer'), true, false)).toBe(true)
    expect(vorlageNachziehen(alt(undefined), true, false)).toBe(true)
    expect(vorlageNachziehen(alt('admin'), true, true)).toBe(true)
  })

  it('eigene Rolle: nur mit frisch geladener Organisation, sonst käme ihre Vorlage nie mehr an', () => {
    expect(vorlageNachziehen(alt('eigen_kasse001'), true, false)).toBe(false)
    expect(vorlageNachziehen(alt('eigen_kasse001'), true, true)).toBe(true)
  })

  it('nie offline, nie zweimal, nie ohne Benutzer', () => {
    expect(vorlageNachziehen(alt('benutzer'), false, true)).toBe(false)
    expect(vorlageNachziehen({ role: 'benutzer', permissions_migrated: true }, true, true)).toBe(false)
    expect(vorlageNachziehen(null, true, true)).toBe(false)
  })
})
