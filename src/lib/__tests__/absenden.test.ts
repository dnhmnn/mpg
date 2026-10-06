import { describe, it, expect } from 'vitest'
import {
  FRIST_MS, datensatz, fristLaeuft, fristText, inWarteschlange, protokollnummer,
  pruefen, titel, warteschlange, warteschlangeLeeren, warteschlangeSchluessel,
  type Speicher,
} from '../../pages/public/doku/absenden'

function speicher(): Speicher & { inhalt: Map<string, string> } {
  const inhalt = new Map<string, string>()
  return {
    inhalt,
    getItem: (k) => inhalt.get(k) ?? null,
    setItem: (k, v) => { inhalt.set(k, v) },
    removeItem: (k) => { inhalt.delete(k) },
  }
}

const bockig: Speicher = {
  getItem: () => { throw new Error('nein') },
  setItem: () => { throw new Error('voll') },
  removeItem: () => { throw new Error('nein') },
}

describe('Das Protokoll absenden', () => {
  it('legt denselben Datensatz an wie das alte Formular', () => {
    // Unitas und der Ausdruck lesen ihn ohne Änderung — deshalb dieselbe
    // Form: Titel, payload, Status "offen", Organisation.
    const d = datensatz({ vorname: 'Erika', name: 'Mustermann', hf: '80' }, 'org1')
    expect(d.title).toBe('Patientendoku: Erika Mustermann')
    expect(d.status).toBe('offen')
    expect(d.organization_id).toBe('org1')
    expect(d.payload).toMatchObject({ vorname: 'Erika', name: 'Mustermann', hf: '80' })
  })

  it('findet auch ohne Namen eine Überschrift', () => {
    // Unbekannte Patienten sind Alltag; eine Liste aus lauter gleichen
    // Zeilen wäre in Unitas unbrauchbar.
    expect(titel({ einsatz_nr: '2026-0815' })).toBe('Patientendoku: Einsatz 2026-0815')
    expect(titel({})).toBe('Patientendoku: ohne Namen')
    expect(titel({ name: 'Mustermann' })).toBe('Patientendoku: Mustermann')
  })

  it('sagt, was aufhält und was nur fehlt', () => {
    const { haelt, fehlt } = pruefen({ einsatz_art: 'Fehleinsatz' })
    expect(haelt.map((s) => s.feld)).toContain('einsatz_nr')
    expect(haelt.every((s) => s.stufe === 'pflicht')).toBe(true)
    expect(fehlt.every((s) => s.stufe === 'erwartet')).toBe(true)
  })

  it('legt ohne Netz in dieselbe Warteschlange wie das alte Formular', () => {
    // Der Schlüssel und die Form sind die des alten Formulars — dann leert
    // jede der beiden Masken auch, was die andere liegen ließ.
    const s = speicher()
    expect(warteschlangeSchluessel('wache')).toBe('offline_queue_wache')
    inWarteschlange(s, 'wache', datensatz({ name: 'Mustermann' }, 'org1'))
    const liegend = warteschlange(s, 'wache')
    expect(liegend).toHaveLength(1)
    expect(liegend[0].type).toBe('full')
    expect(liegend[0].status).toBe('offen')
  })

  it('hängt an, statt zu überschreiben', () => {
    const s = speicher()
    inWarteschlange(s, 'wache', datensatz({ name: 'A' }, 'org1'))
    inWarteschlange(s, 'wache', datensatz({ name: 'B' }, 'org1'))
    expect(warteschlange(s, 'wache').map((e) => e.title))
      .toEqual(['Patientendoku: A', 'Patientendoku: B'])
  })

  it('verschluckt sich nicht an einer kaputten Warteschlange', () => {
    const s = speicher()
    s.inhalt.set(warteschlangeSchluessel('wache'), 'kein JSON')
    expect(warteschlange(s, 'wache')).toEqual([])
    // Und legt trotzdem wieder etwas an.
    expect(inWarteschlange(s, 'wache', datensatz({ name: 'A' }, 'org1'))).toBe(true)
    expect(warteschlange(s, 'wache')).toHaveLength(1)
  })

  it('sagt es, wenn das Gerät nichts behalten will', () => {
    expect(inWarteschlange(bockig, 'wache', datensatz({}, 'org1'))).toBe(false)
    expect(warteschlange(bockig, 'wache')).toEqual([])
    expect(() => warteschlangeLeeren(bockig, 'wache')).not.toThrow()
  })

  it('gibt eine Nummer, die man vorlesen kann', () => {
    expect(protokollnummer('abcdefghijkl', 2026)).toBe('PAT-2026-abcdefgh')
  })
})

describe('Die Änderungsfrist nach dem Absenden', () => {
  const jetzt = new Date('2026-10-06T13:00:00Z')

  it('legt sie mit dem Absenden fest — einen Tag', () => {
    // Bisher musste ein Beauftragter eine Nachbearbeitung freigeben. Wer
    // dokumentiert hat, merkt selbst am ehesten, dass etwas fehlt.
    const d = datensatz({ name: 'Mustermann' }, 'org1', jetzt)
    expect(d.payload.frist).toBe('2026-10-07T13:00:00.000Z')
    expect(d.payload.abgesendet).toBe('2026-10-06T13:00:00.000Z')
    expect(Date.parse(String(d.payload.frist)) - jetzt.getTime()).toBe(FRIST_MS)
  })

  it('sagt, ob sie noch läuft', () => {
    const p = datensatz({}, 'org1', jetzt).payload
    expect(fristLaeuft(p, new Date('2026-10-07T12:59:00Z'))).toBe(true)
    expect(fristLaeuft(p, new Date('2026-10-07T13:00:01Z'))).toBe(false)
  })

  it('hält ein noch nicht abgesendetes Protokoll für änderbar', () => {
    // Ohne Frist ist nichts abgesendet — und dann steht auch nichts offen.
    expect(fristLaeuft({})).toBe(true)
    expect(fristLaeuft({ frist: 'kein Datum' })).toBe(true)
  })

  it('sagt die Restzeit in Worten', () => {
    const p = datensatz({}, 'org1', jetzt).payload
    expect(fristText(p, jetzt)).toBe('noch 24 Stunden')
    expect(fristText(p, new Date('2026-10-07T12:00:00Z'))).toBe('noch 1 Stunde')
    expect(fristText(p, new Date('2026-10-07T12:45:00Z'))).toBe('noch 15 Minuten')
    expect(fristText(p, new Date('2026-10-07T14:00:00Z'))).toBe('abgelaufen')
    expect(fristText({})).toBe('')
  })
})
