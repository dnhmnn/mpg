import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// pb_hooks/lager-regeln.js (CommonJS, läuft in PocketBase): Lager-Warnungen als Daten für Push
// (lagerWarnungenDaten) und als Textzeilen für die Warn-Mail (lagerWarnungen, unverändert).
// Hier mit einem kleinen falschen `app`: findRecordsByFilter aus Listen, Datensätze mit
// get/getString/getBool wie in der JSVM (Bauplan Push, 4.4 und 4.7).

function laden() {
  const modul = { exports: {} as Record<string, unknown> }
  runInNewContext(readFileSync(new URL('../../../pb_hooks/lager-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modul.exports as any
}
const L = laden()

type Werte = Record<string, unknown>
interface Rec { id: string; get(f: string): unknown; getString(f: string): string; getBool(f: string): boolean }

/** Datensatz wie in der JSVM; JSON-Felder liefert getString als Text, fehlende Felder werfen bei getString nicht. */
function rec(id: string, w: Werte): Rec {
  return {
    id,
    get: (f) => (f in w ? w[f] : null),
    getString: (f) => {
      const v = w[f]
      if (v === undefined || v === null) return ''
      return typeof v === 'object' ? JSON.stringify(v) : String(v)
    },
    getBool: (f) => w[f] === true,
  }
}

interface Daten { items: Rec[]; locations: Rec[]; stock: Rec[]; transactions: Rec[] }

/** Falsches app: Filter nach organization_id = {:o} und (Buchungen) created >= {:s}, Sortierung nach name/created. */
function app(d: Daten) {
  const quelle: Record<string, Rec[]> = {
    inventory_items: d.items, inventory_locations: d.locations, inventory_stock: d.stock, inventory_transactions: d.transactions,
  }
  return {
    findRecordsByFilter(sammlung: string, filter: string, sort: string, _limit: number, _offset: number, p: Record<string, string>) {
      let l = (quelle[sammlung] || []).filter((r) => r.getString('organization_id') === p.o)
      if (filter.includes('created >=')) l = l.filter((r) => r.getString('created') >= p.s)
      if (sort === 'name') l = [...l].sort((a, b) => a.getString('name').localeCompare(b.getString('name')))
      if (sort === 'created') l = [...l].sort((a, b) => a.getString('created').localeCompare(b.getString('created')))
      return l
    },
  }
}

const ORG = 'orga00000000001'
// Montag, 16.11.2026, 10:00 deutscher Zeit
const JETZT = Date.parse('2026-11-16T09:00:00.000Z')
const VOR_EINEM_MONAT = '2026-10-16 08:00:00.000Z'
const VOR_ZWEI_JAHREN = '2024-10-16 08:00:00.000Z'

const item = (id: string, name: string, x: Werte = {}) => rec(id, { name, organization_id: ORG, min_stock: 0, ...x })
const ort = (id: string, name: string, x: Werte = {}) => rec(id, { name, organization_id: ORG, created: '2026-01-0' + id.slice(-1) + ' 00:00:00.000Z', ...x })
const bestand = (id: string, item_id: string, location_id: string, quantity: number, x: Werte = {}) => rec(id, { item_id, location_id, quantity, organization_id: ORG, ...x })
const buchung = (id: string, item_id: string, location_id: string, x: Werte = {}) => rec(id, { item_id, location_id, organization_id: ORG, created: VOR_EINEM_MONAT, note: '', ...x })
const flach = <T>(x: T): T => JSON.parse(JSON.stringify(x))

describe('lagerWarnungenDaten: ein Standort', () => {
  const d: Daten = {
    items: [item('i1', 'Mullbinde', { min_stock: 10 }), item('i2', 'Handschuhe', { min_stock: 4 }), item('i3', 'Pflaster')],
    locations: [ort('l1', 'RTW 1')],
    stock: [bestand('s1', 'i1', 'l1', 4), bestand('s2', 'i2', 'l1', 4), bestand('s3', 'i3', 'l1', 1)],
    transactions: [],
  }
  it('unter Soll mit Zahlen, ohne Ort; genau Soll ist nicht darunter; ohne Soll nie', () => {
    const w = L.lagerWarnungenDaten(app(d), ORG, 30, JETZT)
    expect(flach(w.low)).toEqual([{ item_id: 'i1', item: 'Mullbinde', location_id: 'l1', ort: '', ist: 4, soll: 10 }])
    expect(flach(w.expired)).toEqual([])
    expect(flach(w.expiring)).toEqual([])
  })
  it('ein leeres Fach zählt bei nur einem Standort immer', () => {
    const w = L.lagerWarnungenDaten(app({ ...d, stock: [] }), ORG, 30, JETZT)
    expect(w.low.map((x: Werte) => [x.item, x.ist, x.soll])).toEqual([['Handschuhe', 0, 4], ['Mullbinde', 0, 10]])
  })
  it('Mail-Texte wie bisher', () => {
    expect(flach(L.lagerWarnungen(app(d), ORG, 30, JETZT))).toEqual({ low: ['Mullbinde (4/10)'], expired: [], expiring: [] })
  })
})

describe('lagerWarnungenDaten: mehrere Standorte', () => {
  const basis: Daten = {
    items: [item('i1', 'Mullbinde', { min_stock: 5 })],
    locations: [ort('l1', 'RTW 1'), ort('l2', 'RTW 2')],
    stock: [bestand('s1', 'i1', 'l1', 2)],
    transactions: [],
  }
  it('nicht geführt: leeres Fach ohne eigenes Soll und ohne Buchung warnt nicht', () => {
    const w = L.lagerWarnungenDaten(app(basis), ORG, 30, JETZT)
    expect(flach(w.low)).toEqual([{ item_id: 'i1', item: 'Mullbinde', location_id: 'l1', ort: 'RTW 1', ist: 2, soll: 5 }])
    expect(flach(L.lagerWarnungen(app(basis), ORG, 30, JETZT).low)).toEqual(['Mullbinde — RTW 1 (2/5)'])
  })
  it('geführt durch eine Buchung im letzten Jahr', () => {
    const w = L.lagerWarnungenDaten(app({ ...basis, transactions: [buchung('t1', 'i1', 'l2')] }), ORG, 30, JETZT)
    expect(w.low.map((x: Werte) => [x.ort, x.ist, x.soll])).toEqual([['RTW 1', 2, 5], ['RTW 2', 0, 5]])
    expect(flach(L.lagerWarnungen(app({ ...basis, transactions: [buchung('t1', 'i1', 'l2')] }), ORG, 30, JETZT).low))
      .toEqual(['Mullbinde — RTW 1 (2/5)', 'Mullbinde — RTW 2 (0/5)'])
  })
  it('Buchung älter als ein Jahr zählt nicht', () => {
    const w = L.lagerWarnungenDaten(app({ ...basis, transactions: [buchung('t1', 'i1', 'l2', { created: VOR_ZWEI_JAHREN })] }), ORG, 30, JETZT)
    expect(w.low.map((x: Werte) => x.location_id)).toEqual(['l1'])
  })
  it('Storno und Rückgängig heben eine Buchung auf', () => {
    const storno = [buchung('t1', 'i1', 'l2'), buchung('t2', 'i1', 'l2', { storno_von: 't1' })]
    expect(L.lagerWarnungenDaten(app({ ...basis, transactions: storno }), ORG, 30, JETZT).low.map((x: Werte) => x.location_id)).toEqual(['l1'])
    const rueck = [buchung('t1', 'i1', 'l2'), buchung('t2', 'i1', 'l2', { note: 'Rückgängig: Entnahme' })]
    expect(L.lagerWarnungenDaten(app({ ...basis, transactions: rueck }), ORG, 30, JETZT).low.map((x: Werte) => x.location_id)).toEqual(['l1'])
    const zweiEinsStorno = [buchung('t1', 'i1', 'l2'), buchung('t2', 'i1', 'l2'), buchung('t3', 'i1', 'l2', { storno_von: 't1' })]
    expect(L.lagerWarnungenDaten(app({ ...basis, transactions: zweiEinsStorno }), ORG, 30, JETZT).low.map((x: Werte) => x.location_id)).toEqual(['l1', 'l2'])
  })
  it('eigenes Standort-Soll führt den Artikel dort, auch mit 0 im Fach; Soll 0 nie', () => {
    const eigen = { ...basis, items: [item('i1', 'Mullbinde', { min_stock: 5, location_min_stocks: { l2: 3, l1: 0 } })] }
    const w = L.lagerWarnungenDaten(app(eigen), ORG, 30, JETZT)
    expect(flach(w.low)).toEqual([{ item_id: 'i1', item: 'Mullbinde', location_id: 'l2', ort: 'RTW 2', ist: 0, soll: 3 }])
  })
  it('archivierte Artikel und Standorte warnen nicht; mit nur einem übrigen Standort ohne Ort', () => {
    const arch = {
      items: [item('i1', 'Mullbinde', { min_stock: 5 }), item('i2', 'Alt', { min_stock: 5, archiviert: true })],
      locations: [ort('l1', 'RTW 1'), ort('l2', 'Alt', { archiviert: true })],
      stock: [bestand('s1', 'i1', 'l1', 1), bestand('s2', 'i2', 'l1', 1), bestand('s3', 'i1', 'l2', 1)],
      transactions: [],
    }
    const w = L.lagerWarnungenDaten(app(arch), ORG, 30, JETZT)
    expect(flach(w.low)).toEqual([{ item_id: 'i1', item: 'Mullbinde', location_id: 'l1', ort: '', ist: 1, soll: 5 }])
  })
  it('Bestand mehrerer Chargen am selben Standort wird zusammengezählt', () => {
    const w = L.lagerWarnungenDaten(app({ ...basis, stock: [bestand('s1', 'i1', 'l1', 2), bestand('s2', 'i1', 'l1', 2)] }), ORG, 30, JETZT)
    expect(w.low.map((x: Werte) => x.ist)).toEqual([4])
  })
  it('andere Organisationen zählen nicht', () => {
    const fremd = { ...basis, stock: [bestand('s1', 'i1', 'l1', 9, { organization_id: 'orgb00000000001' })], transactions: [buchung('t1', 'i1', 'l1'), buchung('t2', 'i1', 'l2', { organization_id: 'orgb00000000001' })] }
    expect(L.lagerWarnungenDaten(app(fremd), ORG, 30, JETZT).low.map((x: Werte) => x.ist)).toEqual([0])
  })
})

describe('lagerWarnungenDaten: MHD in Kalendertagen (deutsche Zeit)', () => {
  const mhd = (tag: string) => tag + ' 00:00:00.000Z'
  const d: Daten = {
    items: [
      item('i1', 'Ringer 500 ml'), item('i2', 'Mullbinde'), item('i3', 'Kompresse'), item('i4', 'Pflaster'), item('i5', 'Leer'), item('i6', 'Zwei Chargen'),
    ],
    locations: [ort('l1', 'RTW 1')],
    stock: [
      bestand('s1', 'i1', 'l1', 2, { expiry_date: mhd('2026-11-15') }), // gestern: abgelaufen
      bestand('s2', 'i2', 'l1', 1, { expiry_date: mhd('2026-11-16') }), // heute: noch verwendbar, läuft bald ab
      bestand('s3', 'i3', 'l1', 1, { expiry_date: mhd('2026-12-15') }), // in 29 Tagen: läuft bald ab
      bestand('s4', 'i4', 'l1', 1, { expiry_date: mhd('2026-12-16') }), // in 30 Tagen: noch nicht
      bestand('s5', 'i5', 'l1', 0, { expiry_date: mhd('2026-01-01') }), // Bestand 0: zählt nicht
      bestand('s6', 'i6', 'l1', 1, { expiry_date: mhd('2027-05-01') }), bestand('s7', 'i6', 'l1', 1, { expiry_date: '2026-11-10' }), // früheste Charge zählt
    ],
    transactions: [],
  }
  it('gestern abgelaufen, heute und in 29 Tagen bald, in 30 Tagen nicht; Bestand 0 nie; früheste Charge', () => {
    const w = L.lagerWarnungenDaten(app(d), ORG, 30, JETZT)
    expect(flach(w.expired)).toEqual([
      { item_id: 'i1', item: 'Ringer 500 ml', datum: '2026-11-15', tage: -1 },
      { item_id: 'i6', item: 'Zwei Chargen', datum: '2026-11-10', tage: -6 },
    ])
    expect(flach(w.expiring)).toEqual([
      { item_id: 'i3', item: 'Kompresse', datum: '2026-12-15', tage: 29 },
      { item_id: 'i2', item: 'Mullbinde', datum: '2026-11-16', tage: 0 },
    ])
  })
  it('um 00:30 deutscher Zeit (23:30 UTC am Vortag) ist schon der neue Tag', () => {
    const kurzNachMitternacht = Date.parse('2026-11-16T23:30:00.000Z') // 17.11., 00:30 in Berlin
    const w = L.lagerWarnungenDaten(app(d), ORG, 30, kurzNachMitternacht)
    expect(w.expired.map((x: Werte) => x.item_id)).toEqual(['i2', 'i1', 'i6'])
  })
  it('Mail-Texte wie bisher', () => {
    expect(flach(L.lagerWarnungen(app(d), ORG, 30, JETZT))).toEqual({
      low: [],
      expired: ['Ringer 500 ml (2026-11-15)', 'Zwei Chargen (2026-11-10)'],
      expiring: ['Kompresse (2026-12-15)', 'Mullbinde (2026-11-16)'],
    })
  })
  it('Vorlauf 7 Tage (Einstellung der Mail)', () => {
    expect(flach(L.lagerWarnungen(app(d), ORG, 7, JETZT).expiring)).toEqual(['Mullbinde (2026-11-16)'])
  })
})
