import { describe, it, expect } from 'vitest'
import { ROLES, hatRecht } from '../apps'
import { abweichung, hatRolle, pruefeRollenName, rechteAusRollen, rechteTeilnehmende, rollenOrdnen, rollenText, rollenVon } from '../rollen'
import { abgleichPlan, gruppieren } from '../../pages/benutzer/abgleich'
import type { UUser } from '../../pages/benutzer/logik'

// Rechte kommen aus den Rollen; mehrere Rollen zählen zusammen (lib/rollen.ts)

const ORG = { eigene_rollen: [{ id: 'eigen_kasse001', name: 'Kassenwart', farbe: 'cognac' }] }
const RP = { eigen_kasse001: { dateien: true, dokumente: true } }
const an = (r: Record<string, boolean>) => Object.keys(r).filter(k => r[k]).sort()

describe('Rollen einer Person', () => {
  it('erste Rolle aus role, weitere aus zusatzrollen; ohne Rolle Einsatzkraft', () => {
    expect(rollenVon({ role: 'fuehrung', zusatzrollen: ['ausbildung'] })).toEqual(['fuehrung', 'ausbildung'])
    expect(rollenVon({ role: '', zusatzrollen: null })).toEqual(['benutzer'])
    expect(rollenVon({})).toEqual(['benutzer'])
    // PocketBase liefert JSON auch als Text; Doppelte und Leeres fallen weg
    expect(rollenVon({ role: 'mpg', zusatzrollen: '["lager","mpg",""]' })).toEqual(['mpg', 'lager'])
    expect(rollenVon({ role: 'mpg', zusatzrollen: 'kaputt' })).toEqual(['mpg'])
  })

  it('Teilnehmende haben nur diese eine Rolle, auch wenn mehr gespeichert ist', () => {
    expect(rollenVon({ role: 'teilnehmer', zusatzrollen: ['admin'] })).toEqual(['teilnehmer'])
  })

  it('eingeschleuste Leitung oder Teilnehmende als weitere Rolle zählen nicht', () => {
    // So etwas schreibt die App nie (rollenOrdnen); es käme nur über die Schnittstelle, bevor die Regel gilt
    expect(rollenVon({ role: 'benutzer', zusatzrollen: ['admin', 'fuehrung', 'teilnehmer'] })).toEqual(['benutzer', 'fuehrung'])
    expect(rechteAusRollen(rollenVon({ role: 'benutzer', zusatzrollen: ['admin'] }), {}, {}).unitarii).toBe(false)
  })

  it('hatRolle zählt erste und weitere Rollen', () => {
    const u = { role: 'fuehrung', zusatzrollen: ['eigen_kasse001'] }
    expect(hatRolle(u, 'fuehrung')).toBe(true)
    expect(hatRolle(u, 'eigen_kasse001')).toBe(true)
    expect(hatRolle(u, 'mpg')).toBe(false)
  })

  it('Text: alle Rollen mit Namen, Einsatzkraft nur allein', () => {
    expect(rollenText({ role: 'fuehrung', zusatzrollen: ['eigen_kasse001'] }, ORG)).toBe('Führung, Kassenwart')
    expect(rollenText({ role: 'fuehrung', zusatzrollen: ['ausbildung', 'benutzer'] }, ORG)).toBe('Führung, Ausbildung')
    expect(rollenText({ role: 'benutzer' }, ORG)).toBe('Einsatzkraft')
  })
})

describe('Rollen speichern: erste Rolle zählt in den Server-Regeln', () => {
  it('feste Reihenfolge, Einsatzkraft zuletzt, Doppelte raus', () => {
    expect(rollenOrdnen(['benutzer', 'ausbildung', 'fuehrung', 'ausbildung'])).toEqual({ role: 'fuehrung', zusatzrollen: ['ausbildung', 'benutzer'] })
    expect(rollenOrdnen(['eigen_kasse001', 'benutzer'])).toEqual({ role: 'eigen_kasse001', zusatzrollen: ['benutzer'] })
    expect(rollenOrdnen(['eigen_kasse001', 'mpg'])).toEqual({ role: 'mpg', zusatzrollen: ['eigen_kasse001'] })
  })

  it('Leitung und Teilnehmende stehen allein', () => {
    expect(rollenOrdnen(['fuehrung', 'admin'])).toEqual({ role: 'admin', zusatzrollen: [] })
    expect(rollenOrdnen(['teilnehmer', 'benutzer'])).toEqual({ role: 'teilnehmer', zusatzrollen: [] })
  })

  it('nichts gewählt: Einsatzkraft', () => {
    expect(rollenOrdnen([])).toEqual({ role: 'benutzer', zusatzrollen: [] })
    expect(rollenOrdnen(['', ' '])).toEqual({ role: 'benutzer', zusatzrollen: [] })
  })
})

describe('Was die Rollen zusammen geben', () => {
  it('Rechte addieren sich; jedes bekannte Recht steht ausdrücklich da', () => {
    const r = rechteAusRollen(['fuehrung', 'ausbildung'], {}, {})
    expect(an(r)).toEqual(['ausbildungen_manage', 'chat', 'dashboard', 'dateien', 'einsaetze', 'eks', 'lernbar', 'notizen'])
    expect(r.patienten).toBe(false)
    expect(r.unitarii).toBe(false)
  })

  it('Leitung hat immer alles samt Benutzerverwaltung, auch wenn die Organisation etwas anderes gespeichert hat', () => {
    const r = rechteAusRollen(['admin'], { admin: { unitarii: false } }, {})
    expect(r.unitarii).toBe(true)
    expect(an(r)).toEqual(an(ROLES.admin.permissions))
  })

  it('angepasste Fachrolle und eigene Rolle der Organisation zählen', () => {
    const r = rechteAusRollen(['mpg', 'eigen_kasse001'], { ...RP, mpg: { mpg_verwalten: true } }, {}, ORG)
    expect(an(r)).toEqual(['dateien', 'dokumente', 'mpg_verwalten'])
  })

  it('verknüpfte Rechte kommen auch bei einer angepassten Rolle mit, die sie ausdrücklich abgewählt gespeichert hat', () => {
    const r = rechteAusRollen(['lager'], { lager: { lager: true, dateien: false, dokumente: false, qr: false } }, { lager: ['qr'] })
    expect(r.lager && r.qr).toBe(true)
  })

  it('verknüpfte Rechte kommen mit (Lager bringt Dateien, MPG und Vorgänge)', () => {
    const r = rechteAusRollen(['benutzer', 'eigen_kasse001'], { eigen_kasse001: { lager: true } }, { lager: ['dateien', 'dashboard', 'dokumente'] }, ORG)
    expect(r.lager && r.dateien && r.dokumente).toBe(true)
  })

  it('unbekannte oder gelöschte Rollen geben nichts, fremde Rechte werden nicht eingeschleust', () => {
    expect(an(rechteAusRollen(['eigen_weg00001'], { eigen_weg00001: { hacker: true } as Record<string, boolean> }, {}))).toEqual([])
    expect(an(rechteAusRollen(['mitglied'], {}, {}))).toEqual([])
  })
})

describe('Abweichung von den Rollen', () => {
  it('keine, wenn die gespeicherten Rechte genau den Rollen entsprechen', () => {
    const u = { role: 'fuehrung', permissions: rechteAusRollen(['fuehrung'], {}, {}) }
    expect(abweichung(u, {}, {}, ORG)).toBeNull()
  })

  it('alter Admin ohne Häkchen: Benutzerverwaltung und alles andere kommt dazu', () => {
    const a = abweichung({ role: 'admin', permissions: {} }, {}, {}, ORG)
    expect(a?.dazu).toContain('unitarii')
    expect(a?.weg).toEqual([])
  })

  it('Einzelrecht aus früherer Zeit: fällt beim Angleichen weg', () => {
    const u = { role: 'benutzer', permissions: { ...rechteAusRollen(['benutzer'], {}, {}), patienten: true } }
    expect(abweichung(u, {}, {}, ORG)).toEqual({ dazu: [], weg: ['patienten'], unbekannt: [] })
  })

  it('Supervisor ist ausgenommen; unbekannte Rollen werden gemeldet', () => {
    expect(abweichung({ role: 'benutzer', supervisor: true, permissions: {} }, {}, {}, ORG)).toBeNull()
    expect(abweichung({ role: 'mitglied', permissions: {} }, {}, {}, ORG)?.unbekannt).toEqual(['mitglied'])
  })

  it('Teilnehmende dürfen nur Unitas aus den Ausbildungen; mehr fällt beim Angleichen weg', () => {
    expect(abweichung({ role: 'teilnehmer', permissions: { lernbar: true } }, {}, {}, ORG)).toBeNull()
    expect(abweichung({ role: 'teilnehmer', permissions: {} }, {}, {}, ORG)).toBeNull()
    // Als Teilnehmende verknüpft, aber mit Rechten aus früherer Rolle
    expect(abweichung({ role: 'teilnehmer', permissions: { lernbar: true, patienten: true, eks: true } }, {}, {}, ORG)?.weg.sort()).toEqual(['eks', 'patienten'])
    const t = rechteTeilnehmende({ lernbar: true, unitarii: true })
    expect(Object.keys(t).filter(x => t[x])).toEqual(['lernbar'])
  })
})

describe('Abgleich: Plan vor dem Schreiben', () => {
  const u = (id: string, x: Partial<UUser>): UUser => ({ id, name: id, email: `${id}@x.de`, ...x })
  const users = [
    u('a', { role: 'admin', permissions: {} }),
    u('b', { role: 'benutzer', permissions: { ...rechteAusRollen(['benutzer'], {}, {}), patienten: true } }),
    u('c', { role: 'benutzer', permissions: { ...rechteAusRollen(['benutzer'], {}, {}), patienten: true } }),
    u('d', { role: 'fuehrung', permissions: rechteAusRollen(['fuehrung'], {}, {}) }),
    u('s', { role: 'benutzer', supervisor: true, permissions: {} }),
    u('t', { role: 'teilnehmer', permissions: { lernbar: true } }),
  ]

  it('nur wer abweicht, ohne Supervisor und Teilnehmende mit nur Unitas', () => {
    expect(abgleichPlan(users, {}, {}, ORG).map(a => a.u.id)).toEqual(['a', 'b', 'c'])
  })

  it('die bedienende Person nicht (sie soll sich nicht nebenbei aussperren)', () => {
    expect(abgleichPlan(users, {}, {}, ORG, undefined, 'a').map(a => a.u.id)).toEqual(['b', 'c'])
  })

  it('Personen mit unbekannter Rolle nicht: die gäbe nichts, alles fiele weg', () => {
    const mit = [...users, u('m', { role: 'mitglied', permissions: { chat: true, lernbar: true } })]
    expect(abgleichPlan(mit, {}, {}, ORG).map(a => a.u.id)).not.toContain('m')
  })

  it('nur Personen mit einer Rolle, z. B. nach dem Ändern dieser Rolle', () => {
    const p = abgleichPlan(users, { fuehrung: { eks: true } }, {}, ORG, x => hatRolle(x, 'fuehrung'))
    expect(p.map(a => a.u.id)).toEqual(['d'])
    expect(p[0].weg.slice().sort()).toEqual(['chat', 'dashboard', 'dateien', 'einsaetze', 'lernbar', 'notizen'])
    expect(p[0].dazu).toEqual([])
  })

  it('gleiche Abweichung wird eine Gruppe', () => {
    const g = gruppieren(abgleichPlan(users, {}, {}, ORG))
    expect(g.map(x => x.map(a => a.u.id))).toEqual([['a'], ['b', 'c']])
  })
})

describe('Leitung kommt immer in die Benutzerverwaltung', () => {
  it('auch ohne gespeichertes Häkchen (alte Konten), wie in den Server-Regeln', () => {
    expect(hatRecht({ id: 'x', role: 'admin', permissions: {} } as never, 'unitarii')).toBe(true)
    expect(hatRecht({ id: 'x', role: 'admin', permissions: {} } as never, 'patienten')).toBe(false)
    expect(hatRecht({ id: 'x', role: 'mpg', permissions: {} } as never, 'unitarii')).toBe(false)
  })
})

describe('Namen eigener Rollen nach der Umbenennung der vorgegebenen', () => {
  it('eine bestehende eigene Rolle „Führung“ behält ihren Namen, eine neue darf nicht so heißen', () => {
    const alt = [{ id: 'eigen_fuehr001', name: 'Führung' }]
    expect(pruefeRollenName('Führung', alt, 'eigen_fuehr001')).toEqual({ ok: true, name: 'Führung' })
    expect(pruefeRollenName('Führung', alt)).toMatchObject({ ok: false })
  })
})
