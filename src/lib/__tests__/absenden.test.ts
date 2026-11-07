import { describe, it, expect } from 'vitest'
import {
  FRIST_MS, aenderbar, datensatz, fristEnde, fristLaeuft, fristRestText, fristText, inWarteschlange, protokollnummer,
  pruefen, titel, warteschlange, warteschlangeLeeren, warteschlangeSchluessel,
  type Speicher,
} from '../../pages/public/doku/absenden'
import { istDivi } from '../protokoll'

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

describe('Frist älterer Protokolle', () => {
  const EIN_TAG = 86_400_000

  it('gilt vom Absenden an, wenn sie in der Nutzlast steht', () => {
    const payload = { frist: '2026-03-05T10:00:00.000Z' }
    expect(fristEnde(payload, '2026-03-01T00:00:00.000Z')).toBe(Date.parse('2026-03-05T10:00:00.000Z'))
  })

  it('fällt sonst auf einen Tag ab dem Anlegen zurück', () => {
    const angelegt = '2026-03-04T08:00:00.000Z'
    expect(fristEnde({}, angelegt)).toBe(Date.parse(angelegt) + EIN_TAG)
    expect(fristRestText({}, angelegt, new Date('2026-03-04T20:00:00.000Z'))).toBe('noch 12 Stunden')
    expect(fristRestText({}, angelegt, new Date('2026-03-06T00:00:00.000Z'))).toBe('abgelaufen')
  })

  it('ist abgelaufen, wenn nicht einmal das Anlegen lesbar ist', () => {
    expect(fristEnde({}, 'kein Datum')).toBe(0)
  })

  it('liest das Datumsformat von PocketBase (Leerzeichen statt T)', () => {
    expect(fristEnde({}, '2026-10-31 13:20:05.120Z')).toBe(Date.parse('2026-10-31T13:20:05.120Z') + FRIST_MS)
  })
})

describe('Ein abgesendetes Protokoll ändern (Bauplan v2, 1.11, 1.14)', () => {
  const jetzt = Date.parse('2026-11-01T12:00:00.000Z')
  const absender = (status: string) => ({ id: 'u1', name: 'Anna Berg', status, weg: '', modus: 'passwort', am: '' })

  it('geht, solange die Frist läuft', () => {
    expect(aenderbar({ frist: '2026-11-02T00:00:00.000Z', absender: absender('bestaetigt') }, '', jetzt)).toBe('ja')
    expect(aenderbar({ frist: '2026-11-01T11:00:00.000Z', absender: absender('bestaetigt') }, '', jetzt)).toBe('abgelaufen')
  })

  it('geht nicht, solange es auf die Unterschrift wartet, obwohl die Frist leer ist', () => {
    // Früher hieß eine leere Frist „läuft noch“: ausstehende Protokolle wären für immer änderbar gewesen
    expect(aenderbar({ frist: '', absender: absender('ausstehend') }, '2026-11-01T11:59:00.000Z', jetzt)).toBe('ausstehend')
    expect(aenderbar({ frist: '', absender: JSON.stringify(absender('ausstehend')) }, '2026-11-01T11:59:00.000Z', jetzt)).toBe('ausstehend')
  })

  it('geht nicht mehr, wenn es ohne Unterschrift abgeschlossen ist', () => {
    expect(aenderbar({ frist: '', absender: absender('ohne_unterschrift') }, '2026-11-01T11:59:00.000Z', jetzt)).toBe('abgelaufen')
  })

  it('rechnet ältere Protokolle ohne Frist ab dem Anlegen', () => {
    expect(aenderbar({}, '2026-11-01 10:00:00.000Z', jetzt)).toBe('ja')
    expect(aenderbar({}, '2026-10-30 10:00:00.000Z', jetzt)).toBe('abgelaufen')
  })
})

describe('Die Fassung im Datensatz', () => {
  it('steht in jeder abgesendeten Nutzlast', () => {
    const d = datensatz({ name: 'Mustermann' }, 'org1', new Date('2026-03-04T09:12:00.000Z'))
    expect(d.payload.protokoll_version).toBe(2)
    expect(istDivi(d.payload)).toBe(true)
  })

  it('ändert an den eingetragenen Werten nichts', () => {
    const d = datensatz({ name: 'Mustermann', hf: '120' }, 'org1')
    expect(d.payload.name).toBe('Mustermann')
    expect(d.payload.hf).toBe('120')
  })
})
