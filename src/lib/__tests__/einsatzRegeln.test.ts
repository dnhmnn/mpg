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

describe('Besatzung aus dem Protokoll (Owner 22.11.2026)', () => {
  const A = 'aaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbb', C = 'ccccccccccccccc'
  it('Konten mit Funktion, Teamführer zuerst; Namen ohne Konto fallen weg', () => {
    const p = {
      mannschaft_tf: 'Lena Berger', mannschaft_1: 'Jonas Weber', mannschaft_2: 'Gast ohne Konto',
      mannschaft: { tf: { id: A, name: 'Lena Berger' }, m1: { id: B, name: 'Jonas Weber' }, m2: null },
    }
    expect(R.besatzung(p)).toEqual([{ id: A, rolle: 'Teamführer' }, { id: B, rolle: '' }])
  })
  it('Kennung nur, wenn der flache Name derselbe ist (wie in der App)', () => {
    expect(R.besatzung({ mannschaft_tf: 'Andere Person', mannschaft: { tf: { id: A, name: 'Lena Berger' } } })).toEqual([])
    expect(R.besatzung({ mannschaft: { m3: { id: C, name: 'Mia Schneider' } } })).toEqual([{ id: C, rolle: '' }])
  })
  it('kaputte Kennungen, Doppelte und Text-payload', () => {
    expect(R.besatzung({ mannschaft: { tf: { id: 'kurz', name: 'X' } } })).toEqual([])
    expect(R.besatzung({ mannschaft: { tf: { id: A, name: 'X' }, m1: { id: A, name: 'X' } } })).toEqual([{ id: A, rolle: 'Teamführer' }])
    expect(R.besatzung(JSON.stringify({ mannschaft: { m1: { id: B, name: 'Y' } } }))).toEqual([{ id: B, rolle: '' }])
  })
  it('gleich wie besatzungLesen in der App', async () => {
    const { besatzungLesen, POSTEN } = await import('../../pages/public/doku/besatzung')
    const faelle = [
      { mannschaft_tf: 'Lena Berger', mannschaft: { tf: { id: A, name: 'Lena Berger' }, m1: { id: B, name: 'Jonas Weber' } } },
      { mannschaft_tf: 'Andere', mannschaft: { tf: { id: A, name: 'Lena Berger' } } },
      { mannschaft_1: 'Jonas Weber', mannschaft: { m1: { id: B, name: 'Jonas Weber' }, m2: { id: C, name: 'Mia' } } },
      {},
    ]
    for (const f of faelle) {
      const b = besatzungLesen(f as never)
      const app = POSTEN.map((p) => b[p.pos]).filter((x): x is { id: string; name: string } => !!x && /^[a-z0-9]{15}$/.test(x.id)).map((x) => x.id)
      expect(R.besatzung(f).map((x: { id: string }) => x.id)).toEqual([...new Set(app)])
    }
  })
})
