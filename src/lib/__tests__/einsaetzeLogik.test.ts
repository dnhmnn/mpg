// Einsätze (src/pages/einsaetze/logik.ts, Owner 22.11.2026): Organisationen, Verknüpfungen, Zuordnung über die
// Nummer, Rechte (CIRS nur für Berechtigte, Patientennamen nur mit Recht Patienten), Gruppen der Liste.
import { describe, expect, it } from 'vitest'
import {
  darfCirs, darfPatientennamen, darfVerwalten, datumText, gruppieren, loesen, neueNummer, nummerVergeben, organisationDazu, organisationVorschlaege,
  organisationWeg, organisationenLesen, passt, titel, verknuepfen, verknuepfungenLesen, zugeordnet, type Einsatz,
} from '../../pages/einsaetze/logik'
import type { User } from '../../types'

const ID = (n: number) => String(n).padStart(15, 'a')
const nutzer = (x: Partial<User>) => ({ id: 'u', email: 'x@example.org', name: 'X', organization_id: 'o', permissions: {}, ...x }) as unknown as User
const ez = (x: Partial<Einsatz>): Einsatz => ({ id: 'e', unit: '', datum: '', status: 'abgeschlossen', organization_id: 'o', created: '2026-11-19 09:00:00.000Z', ...x })

describe('Organisationen', () => {
  it('liest Listen, auch als Text, ohne Doppelte und Leeres', () => {
    expect(organisationenLesen(['Rettungsdienst', ' rettungsdienst ', '', 'Polizei'])).toEqual(['Rettungsdienst', 'Polizei'])
    expect(organisationenLesen('["THW"]')).toEqual(['THW'])
    expect(organisationenLesen(null)).toEqual([])
    expect(organisationenLesen([1, { a: 1 }])).toEqual([])
  })
  it('dazu und weg, höchstens 20, Namen gekürzt', () => {
    expect(organisationDazu(['A'], 'B')).toEqual(['A', 'B'])
    expect(organisationDazu(['A'], 'a')).toEqual(['A'])
    expect(organisationWeg(['A', 'B'], 'a')).toEqual(['B'])
    expect(organisationenLesen(Array.from({ length: 30 }, (_, i) => `O${i}`)).length).toBe(20)
    expect(organisationenLesen(['x'.repeat(200)])[0].length).toBe(80)
  })
  it('Vorschläge: häufigste zuerst, ohne die schon eingetragenen', () => {
    const alle = [ez({ organisationen: ['Polizei', 'THW'] }), ez({ organisationen: ['Polizei'] }), ez({ organisationen: ['Rettungsdienst'] })]
    expect(organisationVorschlaege(alle, ['THW'])).toEqual(['Polizei', 'Rettungsdienst'])
  })
})

describe('Verknüpfungen', () => {
  it('nur Protokoll und Produktausgabe mit gültiger Kennung, ohne Doppelte', () => {
    expect(verknuepfungenLesen([{ art: 'protokoll', id: ID(1) }, { art: 'protokoll', id: ID(1) }, { art: 'cirs', id: ID(2) }, { art: 'produktausgabe', id: 'kurz' }])).toEqual([{ art: 'protokoll', id: ID(1) }])
    expect(verknuepfungenLesen('kaputt')).toEqual([])
  })
  it('verknüpfen und lösen', () => {
    const v = verknuepfen([], 'produktausgabe', ID(3))
    expect(v).toEqual([{ art: 'produktausgabe', id: ID(3) }])
    expect(loesen(v, 'produktausgabe', ID(3))).toEqual([])
    expect(loesen(v, 'protokoll', ID(3))).toEqual(v)
  })
  it('Zuordnung: über die Nummer (ohne Leerzeichen, Groß/Klein) oder von Hand, jedes Dokument einmal', () => {
    const e = ez({ unit: '2026-0417', verknuepfungen: [{ art: 'protokoll', id: ID(2) }, { art: 'protokoll', id: ID(1) }] })
    const doks = [
      { id: ID(1), payload: { einsatz_nr: '2026 - 0417' } },
      { id: ID(2), payload: { einsatz_nr: 'anders' } },
      { id: ID(3), payload: '{"unit":"2026-0417"}' },
      { id: ID(4), payload: { einsatz_nr: '2026-0418' } },
    ]
    expect(zugeordnet(e, 'protokoll', doks).map((x) => [x.dok.id, x.wie])).toEqual([[ID(1), 'nummer'], [ID(2), 'hand'], [ID(3), 'nummer']])
    expect(zugeordnet(ez({ unit: 'E-1' }), 'produktausgabe', [{ id: ID(5), payload: { einsatz: 'e-1' } }]).map((x) => x.wie)).toEqual(['nummer'])
  })
  it('ohne Nummer nur von Hand', () => {
    expect(zugeordnet(ez({ unit: '' }), 'protokoll', [{ id: ID(1), payload: { einsatz_nr: '' } }])).toEqual([])
  })
})

describe('Rechte', () => {
  it('CIRS nur mit Recht Vorgänge (dauerhaft) oder als Supervisor', () => {
    expect(darfCirs(nutzer({ permissions: { dokumente: true } }))).toBe(true)
    expect(darfCirs(nutzer({ supervisor: true }))).toBe(true)
    expect(darfCirs(nutzer({ role: 'admin' }))).toBe(false)
    expect(darfCirs(nutzer({ permissions: { einsaetze: true } }))).toBe(false)
    expect(darfCirs(null)).toBe(false)
  })
  it('Patientennamen nur mit Recht Patienten, Leitung oder Supervisor', () => {
    expect(darfPatientennamen(nutzer({ permissions: { patienten: true } }))).toBe(true)
    expect(darfPatientennamen(nutzer({ role: 'admin' }))).toBe(true)
    expect(darfPatientennamen(nutzer({ permissions: { einsaetze: true } }))).toBe(false)
  })
  it('Verwalten und Löschen: Leitung, Recht Einsätze, Supervisor', () => {
    expect(darfVerwalten(nutzer({ permissions: { einsaetze: true } }))).toBe(true)
    expect(darfVerwalten(nutzer({ role: 'admin' }))).toBe(true)
    expect(darfVerwalten(nutzer({ permissions: { lernbar: true } }))).toBe(false)
  })
})

describe('Liste', () => {
  it('Titel: Stichwort, sonst Einsatz mit Nummer', () => {
    expect(titel({ keyword: 'B3', unit: '1' })).toBe('B3')
    expect(titel({ keyword: '', unit: '2026-1' })).toBe('Einsatz 2026-1')
    expect(titel({ keyword: '', unit: '' })).toBe('Einsatz')
  })
  it('Suche über Nummer, Stichwort und Organisationen', () => {
    const e = ez({ unit: '2026-0417', keyword: 'B3 Wohnungsbrand', organisationen: ['Polizei'] })
    expect(passt(e, 'wohnung 0417')).toBe(true)
    expect(passt(e, 'polizei')).toBe(true)
    expect(passt(e, 'thw')).toBe(false)
  })
  it('laufende oben, dann je Monat, neueste zuerst', () => {
    const g = gruppieren([
      ez({ id: 'a', datum: '2026-10-03 10:00:00.000Z' }),
      ez({ id: 'b', datum: '2026-11-19 09:00:00.000Z' }),
      ez({ id: 'c', datum: '2026-11-01 09:00:00.000Z', status: 'aktiv' }),
      ez({ id: 'd', datum: '2026-11-20 09:00:00.000Z' }),
    ])
    expect(g.map((x) => [x.titel, x.einsaetze.map((e) => e.id)])).toEqual([['Laufend', ['c']], ['November 2026', ['d', 'b']], ['Oktober 2026', ['a']]])
  })
})

describe('Durchsicht 22.11.2026', () => {
  it('gleiche Nummer weit weg (anderes Jahr, andere Zeit) gehört nicht dazu', () => {
    const e = ez({ unit: '17', datum: '2026-03-10 10:00:00.000Z' })
    const doks = [
      { id: ID(1), created: '2026-03-10 11:00:00.000Z', payload: { einsatz_nr: '17' } },
      { id: ID(2), created: '2026-11-10 11:00:00.000Z', payload: { einsatz_nr: '17' } },
    ]
    expect(zugeordnet(e, 'protokoll', doks).map((x) => x.dok.id)).toEqual([ID(1)])
  })
  it('Tag ohne Uhrzeit aus der Dokumentation, sonst mit', () => {
    expect(datumText('2026-11-22 12:00:00.000Z')).not.toMatch(/Uhr/)
    expect(datumText('2026-11-22 08:55:00.000Z')).toMatch(/Uhr/)
    expect(datumText('')).toBe('')
  })
  it('vergebene Nummern erkennen und neue Nummern ohne Doppelte', () => {
    const alle = [ez({ id: 'a', unit: 'E-2026-10000' }), ez({ id: 'b', unit: '2026 - 0417' })]
    expect(nummerVergeben(alle, '2026-0417')).toBe(true)
    expect(nummerVergeben(alle, '2026-0417', 'b')).toBe(false)
    expect(nummerVergeben(alle, '')).toBe(false)
    let i = 0
    const folge = [0, 0, 0.5]
    expect(neueNummer(new Date('2026-11-22T10:00:00Z'), () => folge[i++] ?? 0.9, alle)).toBe('E-2026-55000')
  })
})
