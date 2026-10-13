import { describe, it, expect } from 'vitest'
import {
  STICHTAG, abhaken, automatisch, checklistenStand, cookieLesen, cookieText, schritte, standLesen, standVereinen, vermerken,
  type Punkt,
} from '../einfuehrung'
import type { User } from '../../types'

const JETZT = new Date('2026-10-20T09:00:00.000Z')

function nutzer(teil: Partial<User> & { created?: string; orgCreated?: string } = {}): User & { created?: string } {
  const { orgCreated, ...rest } = teil
  return {
    id: 'u1abcdefghijklm', email: 'a@x.de', name: 'Anna Berger', organization_id: 'org1',
    permissions: { dashboard: true, lernbar: true }, created: '2026-10-15 08:00:00.000Z',
    organization: { id: 'org1', org_name: 'Testwache', created: orgCreated ?? '2024-01-01 00:00:00.000Z' } as any,
    ...rest,
  } as User & { created?: string }
}

describe('Einführung: wer sie automatisch bekommt', () => {
  it('ein neuer Benutzer bekommt die Grundlagen — einmal', () => {
    expect(automatisch(nutzer(), { v: 1 })).toEqual(['basis'])
    expect(automatisch(nutzer(), { v: 1, basis: JETZT.toISOString() })).toEqual([])
  })

  it('wer vor dem Stichtag angelegt wurde, wird nicht unterbrochen', () => {
    expect(automatisch(nutzer({ created: '2025-03-01 10:00:00.000Z' }), { v: 1 })).toEqual([])
    expect(automatisch(nutzer({ created: `${STICHTAG} 00:00:01.000Z` }), { v: 1 })).toEqual(['basis'])
  })

  it('ohne bekanntes Anlagedatum kommt nichts automatisch', () => {
    expect(automatisch(nutzer({ created: undefined }), { v: 1 })).toEqual([])
    expect(automatisch(null, { v: 1 })).toEqual([])
  })

  it('Verantwortliche einer neuen Organisation bekommen zusätzlich "Organisation einrichten"', () => {
    const admin = nutzer({ permissions: { dashboard: true, unitarii: true }, orgCreated: '2026-10-14 12:00:00.000Z' })
    expect(automatisch(admin, { v: 1 })).toEqual(['basis', 'organisation'])
    expect(automatisch(admin, { v: 1, basis: JETZT.toISOString() })).toEqual(['organisation'])
    expect(automatisch(admin, { v: 1, basis: JETZT.toISOString(), organisation: JETZT.toISOString() })).toEqual([])
  })

  it('nicht in einer bestehenden Organisation und nicht ohne das Recht, Benutzer zu verwalten', () => {
    expect(automatisch(nutzer({ permissions: { unitarii: true } }), { v: 1 })).toEqual(['basis'])
    expect(automatisch(nutzer({ orgCreated: '2026-10-14 12:00:00.000Z' }), { v: 1 })).toEqual(['basis'])
  })

  it('der Supervisor (Responda selbst) bekommt keine Einrichtung fremder Organisationen', () => {
    const sv = nutzer({ supervisor: true, created: '2024-01-01 00:00:00.000Z', orgCreated: '2026-10-14 12:00:00.000Z' })
    expect(automatisch(sv, { v: 1 })).toEqual([])
  })

  it('ein befristetes Recht zählt, solange es läuft', () => {
    const bis = new Date(Date.now() + 864e5).toISOString()
    const admin = nutzer({ permissions: {}, temp_permissions: { unitarii: { until: bis } }, orgCreated: '2026-10-14 12:00:00.000Z' })
    expect(automatisch(admin, { v: 1 })).toEqual(['basis', 'organisation'])
  })
})

describe('Einführung: der Stand', () => {
  it('liest das Benutzerfeld auch als JSON-Text und verwirft Unsinn', () => {
    expect(standLesen('{"v":1,"basis":"2026-10-15T08:00:00Z"}')).toEqual({ v: 1, basis: '2026-10-15T08:00:00Z' })
    expect(standLesen('kaputt')).toEqual({ v: 1 })
    expect(standLesen(null)).toEqual({ v: 1 })
    expect(standLesen({ basis: 7, abgehakt: { a: 'x', b: 3 } })).toEqual({ v: 1, abgehakt: { a: 'x' } })
  })

  it('gesehen ist gesehen — egal ob im Benutzerfeld oder im Cookie', () => {
    const feld = { v: 1 as const, basis: 'A' }
    const keks = { v: 1 as const, organisation: 'B', abgehakt: { qr: 'C' } }
    expect(standVereinen(feld, keks)).toEqual({ v: 1, basis: 'A', organisation: 'B', abgehakt: { qr: 'C' } })
  })

  it('vermerkt Teile nur einmal, mit dem ersten Zeitpunkt', () => {
    const s = vermerken({ v: 1, basis: 'früher' }, ['basis', 'organisation'], JETZT)
    expect(s).toEqual({ v: 1, basis: 'früher', organisation: JETZT.toISOString() })
  })

  it('abhaken und wieder lösen', () => {
    const an = abhaken({ v: 1 }, 'qr', true, JETZT)
    expect(an.abgehakt).toEqual({ qr: JETZT.toISOString() })
    expect(abhaken(an, 'qr', false, JETZT)).toEqual({ v: 1 })
  })

  it('der Cookie übersteht Hin und Zurück und gehört genau einem Benutzer', () => {
    const stand = { v: 1 as const, basis: JETZT.toISOString(), abgehakt: { cirs: 'x' } }
    const text = cookieText('u1abcdefghijklm', stand)
    const kopf = text.split(';')[0]
    expect(cookieLesen('u1abcdefghijklm', `andere=1; ${kopf}; noch=2`)).toEqual(stand)
    expect(cookieLesen('u2zzzzzzzzzzzzz', kopf)).toEqual({ v: 1 })
    expect(text).toContain('path=/')
    expect(text).toMatch(/max-age=\d+/)
  })
})

describe('Einführung: Checkliste', () => {
  const punkte: Punkt[] = [
    { id: 'benutzer', titel: 'Benutzer', text: '', befund: 'benutzer' },
    { id: 'cirs', titel: 'CIRS', text: '' },
    { id: 'eks', titel: 'EKS', text: '', befund: 'eks' },
  ]

  it('erkannt geht vor abgehakt, Offenes bleibt offen', () => {
    const st = checklistenStand(punkte, { benutzer: true, eks: false }, { v: 1, abgehakt: { cirs: 'x', eks: 'y' } })
    expect(st.map((p) => [p.id, p.erledigt, p.quelle])).toEqual([
      ['benutzer', true, 'erkannt'],
      ['cirs', true, 'abgehakt'],
      ['eks', true, 'abgehakt'],
    ])
    expect(checklistenStand(punkte, {}, { v: 1 }).every((p) => !p.erledigt)).toBe(true)
  })
})

describe('Einführung: welche Schritte jemand sieht', () => {
  it('nur, was zu den eigenen Rechten passt — wer nur die Lernbar hat, bekommt kein Hub erklärt', () => {
    const ids = schritte(nutzer({ permissions: { lernbar: true } }), ['basis']).map((s) => s.id)
    expect(ids).toContain('unitas')
    expect(ids).not.toContain('hub')
    expect(ids).not.toContain('control')
    expect(ids).not.toContain('einstellungen')
    expect(ids[0]).toBe('willkommen')
    expect(ids[ids.length - 1]).toBe('fertig')
  })

  it('der Modulüberblick nennt nur die eigenen Module', () => {
    const modul = schritte(nutzer({ permissions: { dashboard: true, patienten: true } }), ['basis']).find((s) => s.id === 'module')
    // MPG hängt am Recht "dashboard" — wer das hat, sieht es auch
    expect(modul?.module).toEqual(['patienten', 'mpg'])
    expect(modul?.punkte?.[0]).toMatch(/^Patienten: /)
    expect(schritte(nutzer({ permissions: { patienten: true } }), ['basis']).find((s) => s.id === 'module')?.module).toEqual(['patienten'])
  })

  it('ohne eigene Module entfällt der Überblick', () => {
    expect(schritte(nutzer({ permissions: {} }), ['basis']).some((s) => s.id === 'module')).toBe(false)
  })

  it('Grundlagen vor der Einrichtung, der Abschluss zuletzt und dem letzten Teil zugeordnet', () => {
    const admin = nutzer({ permissions: { dashboard: true, unitarii: true } })
    const liste = schritte(admin, ['organisation', 'basis'])
    const ersterOrg = liste.findIndex((s) => s.teil === 'organisation')
    expect(liste.slice(0, ersterOrg).every((s) => s.teil === 'basis')).toBe(true)
    expect(liste[liste.length - 1]).toMatchObject({ id: 'fertig', teil: 'organisation' })
    const nurOrg = schritte(admin, ['organisation'])
    expect(nurOrg.every((s) => s.teil === 'organisation')).toBe(true)
  })

  it('sagt, wo man die Einführung wiederfindet — je nachdem, was man erreichen kann', () => {
    const mitHub = schritte(nutzer({ permissions: { dashboard: true } }), ['basis']).slice(-1)[0]
    const nurLernbar = schritte(nutzer({ permissions: { lernbar: true } }), ['basis']).slice(-1)[0]
    expect(mitHub.hinweis).toContain('Einstellungen')
    expect(nurLernbar.hinweis).toContain('Unitas')
  })

  it('nennt die Adresse der Organisationsseite, wenn der Code bekannt ist', () => {
    const admin = nutzer({ permissions: { dashboard: true, unitarii: true, dokumente: true } })
    ;(admin.organization as any).org_code = 'wache1'
    expect(schritte(admin, ['organisation']).find((s) => s.id === 'org-seite')?.hinweis).toBe('Die Adresse deiner Seite: app.responda.systems/wache1')
  })

  it('ohne Teile keine Schritte', () => {
    expect(schritte(nutzer(), [])).toEqual([])
  })
})
