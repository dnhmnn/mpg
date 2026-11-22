// Einsätze aus der Dokumentation (pb_hooks/einsatz-regeln.js, Owner 22.11.2026): Nummer lesen, vergleichen,
// nie Namen oder Adressen übernehmen. Dazu der Gleichlauf mit src/lib/einsatzNummer.ts (App).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { nummerSchluessel as appSchluessel } from '../einsatzNummer'

const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/einsatz-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any

describe('ausDatensatz', () => {
  it('Protokoll: Nummer, Datum, Art; nie Name oder Adresse', () => {
    const d = R.ausDatensatz('patients', { einsatz_nr: ' 2026-0417 ', einsatz_datum: '2026-11-19', einsatz_art: 'Notfall', name: 'Mustermann', strasse: 'Musterweg 1' }, '2026-11-19 09:41:00.000Z')
    expect(d).toEqual({ nummer: '2026-0417', datum: '2026-11-19T12:00:00.000Z', art: 'Notfall' })
    expect(JSON.stringify(d)).not.toMatch(/Mustermann|Musterweg/)
  })
  it('Produktausgabe: Nummer aus einsatz, Datum aus datum, keine Art', () => {
    expect(R.ausDatensatz('product_outputs', { einsatz: 'E-1', datum: '2026-11-20' }, '')).toEqual({ nummer: 'E-1', datum: '2026-11-20T12:00:00.000Z', art: '' })
  })
  it('payload als Text oder doppelt kodiert', () => {
    expect(R.ausDatensatz('product_outputs', '{"einsatz":"E-2"}', '2026-11-20 10:00:00.000Z').nummer).toBe('E-2')
    expect(R.ausDatensatz('product_outputs', JSON.stringify(JSON.stringify({ einsatz: 'E-3' })), '').nummer).toBe('E-3')
  })
  it('ohne Nummer oder fremde Sammlung: nichts', () => {
    expect(R.ausDatensatz('patients', { name: 'x' }, '')).toBeNull()
    expect(R.ausDatensatz('patients', { einsatz_nr: '   ' }, '')).toBeNull()
    expect(R.ausDatensatz('cirs_reports', { einsatz_nr: '1' }, '')).toBeNull()
    expect(R.ausDatensatz('patients', 'kaputt{', '')).toBeNull()
  })
  it('ohne gültiges Datum: Zeitpunkt des Anlegens', () => {
    expect(R.ausDatensatz('patients', { einsatz_nr: '1', einsatz_datum: 'gestern' }, '2026-11-19 09:41:00.000Z').datum).toBe('2026-11-19T09:41:00.000Z')
  })
  it('lange Nummer und Art werden gekürzt', () => {
    const d = R.ausDatensatz('patients', { einsatz_nr: '9'.repeat(100), einsatz_art: 'x'.repeat(200) }, '')
    expect(d.nummer.length).toBe(60)
    expect(d.art.length).toBe(120)
  })
})

describe('vorhanden', () => {
  it('gleiche Nummer ohne Rücksicht auf Leerzeichen und Groß/Klein', () => {
    const k = [{ id: 'a', unit: '2026 - 0417' }, { id: 'b', unit: 'E-1' }]
    expect(R.vorhanden(k, '2026-0417')?.id).toBe('a')
    expect(R.vorhanden(k, 'e-1')?.id).toBe('b')
    expect(R.vorhanden(k, '2026-0418')).toBeNull()
    expect(R.vorhanden(k, '')).toBeNull()
  })
})

describe('Gleichlauf App und Server', () => {
  it('nummerSchluessel ist gleich', () => {
    for (const x of ['2026-0417', ' 2026 - 0417 ', 'E-1', 'Übung  Nord', '9'.repeat(80), '', null, undefined, 42]) {
      expect(appSchluessel(x), String(x)).toBe(R.nummerSchluessel(x))
    }
  })
})
