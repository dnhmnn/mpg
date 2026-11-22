// Alamos-Eingang (pb_hooks/alamos-regeln.js): Body lesen, Felder zuordnen, Doppelte erkennen.
// Owner 21.11.2026: Test kam an, echte Alarme nicht (text/plain abgelehnt, gleiche "id" verwarf jeden weiteren Alarm).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/alamos-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any
const JETZT = Date.parse('2026-11-21T13:00:00Z')

describe('bodyLesen', () => {
  it('JSON, auch mit BOM und als Liste', () => {
    expect(R.bodyLesen('{"keyword":"B3"}')).toEqual({ body: { keyword: 'B3' }, art: 'json' })
    expect(R.bodyLesen('﻿ {"keyword":"B3"}').body.keyword).toBe('B3')
    expect(R.bodyLesen('[{"keyword":"B3"}]')).toEqual({ body: { keyword: 'B3' }, art: 'json-liste' })
  })
  it('Formular-Daten mit Umlauten und Plus', () => {
    expect(R.bodyLesen('stichwort=H1+%C3%96lspur&ort=Musterstadt').body).toEqual({ stichwort: 'H1 Ölspur', ort: 'Musterstadt' })
  })
  it('leer und unlesbar ergeben ein leeres Objekt', () => {
    expect(R.bodyLesen('')).toEqual({ body: {}, art: 'leer' })
    expect(R.bodyLesen(null)).toEqual({ body: {}, art: 'leer' })
    expect(R.bodyLesen('irgendwas').art).toBe('unbekannt')
    expect(R.bodyLesen('{kaputt').art).toBe('unbekannt')
  })
})

describe('alarmLesen', () => {
  it('einfache Felder wie im Test der App', () => {
    const a = R.alarmLesen({ unit: 'TEST-001', keyword: 'RD B3 Test' }, JETZT)
    expect(a).toMatchObject({ unit: 'TEST-001', keyword: 'RD B3 Test', adresse: '', nummer: '' })
    expect(a.datum).toBe(new Date(JETZT).toISOString())
  })
  it('verschachtelt, Einheiten als Liste, Namen ohne Rücksicht auf Groß und Klein', () => {
    const a = R.alarmLesen({ data: { Keyword: 'B2', ADDRESS: 'Am Markt 3', units: ['LF 10/2', { name: 'ELW 1' }] } }, JETZT)
    expect(a).toMatchObject({ keyword: 'B2', adresse: 'Am Markt 3', unit: 'LF 10/2, ELW 1' })
  })
  it('oben Stehendes gewinnt vor Verschachteltem', () => {
    expect(R.alarmLesen({ keyword: 'oben', data: { keyword: 'innen' } }, JETZT).keyword).toBe('oben')
  })
  it('Adresse aus Straße, Hausnummer und Ort', () => {
    expect(R.alarmLesen({ strasse: 'Hauptstraße', hausnummer: '5', ort: 'Musterstadt' }, JETZT).adresse).toBe('Hauptstraße 5, Musterstadt')
    expect(R.alarmLesen({ ort: 'Musterstadt' }, JETZT).adresse).toBe('Musterstadt')
  })
  it('Nummer aus den üblichen Feldern, id zuletzt', () => {
    expect(R.alarmLesen({ id: 'x', einsatznummer: 'E-2026-0417' }, JETZT).nummer).toBe('E-2026-0417')
    expect(R.alarmLesen({ id: 'x' }, JETZT).nummer).toBe('x')
  })
  it('kürzt lange Werte', () => {
    expect(R.alarmLesen({ keyword: 'x'.repeat(900) }, JETZT).keyword.length).toBe(500)
  })
})

describe('datumLesen', () => {
  it('ISO, mit Leerzeichen, Sekunden, Millisekunden, deutsch', () => {
    expect(R.datumLesen('2026-11-21T14:03:00Z', JETZT)).toBe('2026-11-21T14:03:00.000Z')
    expect(R.datumLesen('2026-11-21 14:03:00Z', JETZT)).toBe('2026-11-21T14:03:00.000Z')
    expect(R.datumLesen('1763731380', JETZT)).toBe(new Date(1763731380000).toISOString())
    expect(R.datumLesen('1763731380000', JETZT)).toBe(new Date(1763731380000).toISOString())
    expect(R.datumLesen('21.11.2026 14:03', JETZT).slice(0, 10)).toBe('2026-11-21')
  })
  it('unbrauchbar: jetzt', () => {
    expect(R.datumLesen('bald', JETZT)).toBe(new Date(JETZT).toISOString())
    expect(R.datumLesen('', JETZT)).toBe(new Date(JETZT).toISOString())
  })
})

describe('doppelt', () => {
  const vor = (min: number) => new Date(JETZT - min * 60000).toISOString().replace('T', ' ')
  const k = (x: Record<string, string>) => ({ id: 'e1', alamos_id: '', keyword: 'B3', adresse: 'Musterweg 1', unit: 'HLF', ...x })
  it('gleiche Nummer allein reicht nicht', () => {
    expect(R.doppelt([k({ alamos_id: 'FE2', keyword: 'RD 1', created: vor(5) })], { nummer: 'FE2', keyword: 'RD 2', adresse: 'Musterweg 1' }, JETZT)).toBeNull()
  })
  it('gleiche Nummer, Stichwort und Ort in 6 Stunden: doppelt', () => {
    const e = k({ alamos_id: 'FE2', created: vor(300) })
    expect(R.doppelt([e], { nummer: 'FE2', keyword: 'b3', adresse: 'Musterweg 1 ' }, JETZT)).toBe(e)
    expect(R.doppelt([k({ alamos_id: 'FE2', created: vor(400) })], { nummer: 'FE2', keyword: 'B3', adresse: 'Musterweg 1' }, JETZT)).toBeNull()
  })
  it('ohne Nummer: nur in 10 Minuten', () => {
    expect(R.doppelt([k({ created: vor(5) })], { nummer: '', keyword: 'B3', adresse: 'Musterweg 1' }, JETZT)).not.toBeNull()
    expect(R.doppelt([k({ created: vor(15) })], { nummer: '', keyword: 'B3', adresse: 'Musterweg 1' }, JETZT)).toBeNull()
  })
  it('ohne Nummer und ohne Ort (aPager PRO): nur in 30 Sekunden', () => {
    const ohneOrt = (x: Record<string, string>) => k({ adresse: '', ...x })
    const vorSek = (s: number) => new Date(JETZT - s * 1000).toISOString().replace('T', ' ')
    expect(R.doppelt([ohneOrt({ created: vorSek(13) })], { nummer: '', keyword: 'B3', adresse: '' }, JETZT)).not.toBeNull()
    expect(R.doppelt([ohneOrt({ created: vorSek(150) })], { nummer: '', keyword: 'B3', adresse: '' }, JETZT)).toBeNull()
  })
  it('Zeitpunkt in der Zukunft oder unlesbar zählt nicht', () => {
    expect(R.doppelt([k({ created: vor(-5) })], { nummer: '', keyword: 'B3', adresse: 'Musterweg 1' }, JETZT)).toBeNull()
    expect(R.doppelt([k({ created: 'kaputt' })], { nummer: '', keyword: 'B3', adresse: 'Musterweg 1' }, JETZT)).toBeNull()
  })
})

describe('einheitenDazu und feldNamen', () => {
  it('ergänzt Einheiten ohne Doppelte, Unbekannt fällt weg', () => {
    expect(R.einheitenDazu('HLF 20/1', 'DLK 23')).toBe('HLF 20/1, DLK 23')
    expect(R.einheitenDazu('HLF 20/1, DLK 23', 'dlk 23')).toBe('HLF 20/1, DLK 23')
    expect(R.einheitenDazu('Unbekannt', 'RTW 1')).toBe('RTW 1')
  })
  it('Log: nur Namen, keine Werte', () => {
    const n = R.feldNamen({ keyword: 'B3', data: { address: 'Musterweg 1' } })
    expect(n).toEqual(['keyword', 'address'])
    expect(JSON.stringify(n)).not.toContain('Musterweg')
  })
})

describe('GET-Aufrufe', () => {
  it('Query-Parameter als Body, Listen nehmen den ersten Wert', () => {
    expect(R.queryLesen({ unit: 'unit1', keyword: ['B3', 'x'] })).toEqual({ unit: 'unit1', keyword: 'B3' })
  })
  it('ohne Einheit und Stichwort kein Einsatz', () => {
    expect(R.getTaugt(R.alarmLesen({}, JETZT))).toBe(false)
    expect(R.getTaugt(R.alarmLesen({ keyword: 'B3' }, JETZT))).toBe(true)
  })
})

describe('eingang (mit nachgebautem PocketBase)', () => {
  function app(vorhanden: Record<string, unknown>[] = [], orgDa = true) {
    const gespeichert: Record<string, unknown>[] = []
    const log: string[] = []
    const rec = (felder: Record<string, unknown>) => ({ ...felder, set(k: string, v: unknown) { (this as Record<string, unknown>)[k] = v }, getString(k: string) { return String((this as Record<string, unknown>)[k] ?? '') } })
    return {
      gespeichert, log,
      findRecordById(c: string, id: string) {
        if (c === 'organizations') { if (!orgDa) throw new Error('nicht da'); return { id } }
        const r = vorhanden.find((x) => x.id === id); if (!r) throw new Error('nicht da'); return rec(r)
      },
      findRecordsByFilter() { return vorhanden.map(rec) },
      findCollectionByNameOrId() { return {} },
      save(r: Record<string, unknown>) { r.id = r.id || 'neu' + gespeichert.length; gespeichert.push(r) },
      logger() { const f = (m: string, ...rest: unknown[]) => log.push([m, ...rest].join(' ')); return { info: f, warn: f, error: f } },
    }
  }
  const neu = () => ({ set(k: string, v: unknown) { (this as Record<string, unknown>)[k] = v } })
  it('legt einen Einsatz an, Log ohne Werte', () => {
    const a = app()
    const r = R.eingang(a, 'org1', R.bodyLesen('{"unit":"HLF 20/1","keyword":"B3 Wohnungsbrand","address":"Musterweg 1"}'), 'text/plain', JETZT, neu, 'POST')
    expect(r.status).toBe(200)
    expect(a.gespeichert[0]).toMatchObject({ unit: 'HLF 20/1', keyword: 'B3 Wohnungsbrand', adresse: 'Musterweg 1', status: 'aktiv', organization_id: 'org1' })
    expect(a.log.join('\n')).not.toMatch(/Musterweg|Wohnungsbrand/)
  })
  it('unbekannte Organisation: 404, nichts angelegt', () => {
    const a = app([], false)
    expect(R.eingang(a, 'x', R.bodyLesen('{"keyword":"B3"}'), '', JETZT, neu, 'POST').status).toBe(404)
    expect(a.gespeichert).toEqual([])
  })
  it('GET ohne Angaben legt nichts an', () => {
    const a = app()
    const r = R.eingang(a, 'org1', { body: {}, art: 'query' }, '', JETZT, neu, 'GET')
    expect(r.json.success).toBe(false)
    expect(a.gespeichert).toEqual([])
  })
  it('zweite Einheit zum selben Alarm: doppelt, Einheit ergänzt', () => {
    const vor = new Date(JETZT - 60000).toISOString().replace('T', ' ')
    const a = app([{ id: 'e1', unit: 'HLF 20/1', keyword: 'B3', adresse: 'Musterweg 1', alamos_id: '', created: vor }])
    const r = R.eingang(a, 'org1', R.bodyLesen('{"unit":"DLK 23","keyword":"B3","address":"Musterweg 1"}'), 'application/json', JETZT, neu, 'POST')
    expect(r.json).toMatchObject({ duplicate: true, id: 'e1' })
    expect(a.gespeichert[0]).toMatchObject({ id: 'e1', unit: 'HLF 20/1, DLK 23' })
  })
})
