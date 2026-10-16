import { describe, it, expect } from 'vitest'
import PocketBase from 'pocketbase'
import { planeBuchung, planeRueckgaengig, type Bestandszeile, type Plan } from '../lagerBuchung'
import {
  amSeitenende, bildeVorgaenge, einordnen, findeRuecknahmen, logbuchFilter, passtKontext, pbZeit, personKurz, tagSchluessel,
  type Einordnung, type LogFilter, type LogZeile,
} from '../lagerLogbuch'

// ── Testdaten ────────────────────────────────────────────────────────────────

const JULIA = 'julia.becker@drk-musterstadt.de'
const TOM = 'tom.krause@drk-musterstadt.de'
const WER = { organization_id: 'org1', user: JULIA }

/** PocketBase-Zeitstempel am 16.10.2026 (UTC), z. B. T('14:32:07.120'). */
const T = (hms: string, tag = '2026-10-16') => `${tag} ${hms.includes('.') ? hms : `${hms}.000`}Z`

let lfd = 0
const naechsteId = () => `tx${String(++lfd).padStart(13, '0')}`

const zeile = (p: Partial<LogZeile>): LogZeile => ({
  id: naechsteId(), created: T('14:32:07.120'), item_id: 'handschuhe', location_id: 'rtw1',
  type: 'ausbuchung', quantity: -1, batch: null, expiry_date: null, stock_id: null, einsatz: null,
  note: '', user: JULIA, ...p,
})

type UrArt = Einordnung['urArt']

/** Erwartete Einordnung: alles aus, außer was angegeben ist. */
const erw = (art: UrArt, extra: Partial<Einordnung> = {}): Einordnung =>
  ({ art, urArt: art, ruecknahme: false, offline: false, ohneCharge: false, restNotiz: '', ...extra })
const rueck = (urArt: UrArt, extra: Partial<Einordnung> = {}): Einordnung =>
  ({ ...erw(urArt, extra), art: 'rueckgaengig', ruecknahme: true })

/**
 * Die Journalzeilen eines Plans, wie PocketBase sie zurückgäbe (created setzt der Server),
 * in Buchungsreihenfolge (posten) — in den Anfragen steht die Client-ID-Zeile zuletzt.
 */
function journalAus(plan: Plan, created: string): LogZeile[] {
  return plan.posten.map(p => {
    const a = plan.anfragen.find(x => x.collection === 'inventory_transactions' && x.id === p.tx_id)!
    return { ...a.body, created } as unknown as LogZeile
  })
}

const idFolge = (praefix: string) => { let n = 0; return () => `${praefix}${String(++n).padStart(15 - praefix.length, '0')}` }

const BESTAND: Bestandszeile[] = [
  { id: 'stockb700000001', item_id: 'handschuhe', location_id: 'rtw1', quantity: 3, expiry_date: '2027-03-31 00:00:00.000Z', batch: 'B7', created: '2026-01-05 08:00:00.000Z' },
  { id: 'stockb800000001', item_id: 'handschuhe', location_id: 'rtw1', quantity: 2, expiry_date: '2027-09-30 00:00:00.000Z', batch: 'B8', created: '2026-02-11 08:00:00.000Z' },
  { id: 'stockk100000001', item_id: 'kompressen', location_id: 'rtw1', quantity: 10, expiry_date: '2028-01-31 00:00:00.000Z', batch: 'K1', created: '2026-03-02 08:00:00.000Z' },
]

const pb = new PocketBase('http://x')
const pbFilter = (raw: string, params?: Record<string, unknown>) => pb.filter(raw, params)

// ── Notizformate ─────────────────────────────────────────────────────────────

describe('Logbuch: jedes Notizformat wird eingeordnet (neu und alt)', () => {
  const faelle: [string, Partial<LogZeile>, Einordnung][] = [
    // NEU — über lagerBuchung.ts
    ['neu: Ausbuchung je Charge', { quantity: -2, batch: 'B7', stock_id: 'stockb700000001', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' },
      erw('ausbuchung', { charge: 'B7', einsatz: 'E-1' })],
    ['neu: Ausbuchung ohne Charge, leere Notiz', { quantity: -1, note: '' }, erw('ausbuchung')],
    ['neu: Ausbuchung mit vorangestellter Notiz', { quantity: -2, batch: 'B7', note: 'Fach 3 aufgefüllt · Charge B7' },
      erw('ausbuchung', { charge: 'B7', restNotiz: 'Fach 3 aufgefüllt' })],
    ['neu: Einbuchung mit Charge', { type: 'einbuchung', quantity: 50, batch: 'L1', expiry_date: '2028-08-31 00:00:00.000Z', note: 'Charge L1' },
      erw('einbuchung', { charge: 'L1' })],
    ['neu: Einbuchung mit Notiz', { type: 'einbuchung', quantity: 20, batch: 'L1', note: 'Lieferung Meditrade · Charge L1' },
      erw('einbuchung', { charge: 'L1', restNotiz: 'Lieferung Meditrade' })],
    ['neu: Rest ohne Bestand, offline erfasst', { quantity: -3, einsatz: 'E-1', note: 'offline erfasst · ohne Chargenzuordnung · Einsatz E-1' },
      erw('ausbuchung', { offline: true, ohneCharge: true, einsatz: 'E-1' })],
    ['neu: Umlagerung, Quelle', { quantity: -5, batch: 'B7', note: 'Umlagerung → Hauptlager · Charge B7' },
      erw('umlagerung', { richtung: 'nach', gegenstelle: 'Hauptlager', charge: 'B7' })],
    ['neu: Umlagerung, Ziel', { type: 'einbuchung', quantity: 5, location_id: 'hauptlager', batch: 'B7', note: 'Umlagerung ← RTW 1 · Charge B7' },
      erw('umlagerung', { richtung: 'von', gegenstelle: 'RTW 1', charge: 'B7' })],
    ['neu: Rücknahme mit Originalnotiz', { quantity: 2, batch: 'B7', einsatz: 'E-1', storno_von: 'tx9999999999991', note: 'Rückgängig · Charge B7 · Einsatz E-1' },
      rueck('ausbuchung', { charge: 'B7', einsatz: 'E-1' })],
    ['neu: Rücknahme nur „Rückgängig“', { type: 'einbuchung', quantity: -10, note: 'Rückgängig' }, rueck('einbuchung')],
    ['neu: Rücknahme einer Umlagerung', { quantity: 5, batch: 'B7', note: 'Rückgängig · Umlagerung → Hauptlager · Charge B7' },
      rueck('umlagerung', { richtung: 'nach', gegenstelle: 'Hauptlager', charge: 'B7' })],
    ['neu: storno_von gesetzt, Notiz ohne Präfix', { quantity: 1, batch: 'B7', storno_von: 'tx9999999999992', note: 'Charge B7' },
      rueck('ausbuchung', { charge: 'B7' })],
    ['neu: Produktausgabe', { quantity: -2, batch: 'B7', einsatz: 'E-1', note: 'Produktausgabe · an Max Muster · Charge B7 · Einsatz E-1' },
      erw('produktausgabe', { empfaenger: 'Max Muster', charge: 'B7', einsatz: 'E-1' })],
    ['neu: Rückruf', { quantity: -12, batch: 'B7', note: 'Rückruf · Charge B7' }, erw('rueckruf', { charge: 'B7' })],
    ['neu: Inventur', { type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 9 → 8' }, erw('inventur', { inventur: { von: 9, nach: 8 } })],
    ['neu: Inventur nach den Buchungen gezählt, mit Charge',
      { type: 'korrektur', quantity: 1, batch: 'B7', note: 'Inventur-Korrektur: 7 → 8 (nach den Buchungen seit Start gezählt, beim Start 9) · Charge B7' },
      erw('inventur', { inventur: { von: 7, nach: 8 }, charge: 'B7', restNotiz: 'nach den Buchungen seit Start gezählt, beim Start 9' })],
    // Nur ein Teil kommt aus B7 — die Zeile gehört NICHT zu Charge B7 (kein charge, nur teilCharge)
    ['neu: Inventur aus mehreren Chargen', { type: 'korrektur', quantity: -5, note: 'Inventur-Korrektur: 12 → 7 · 2 aus Charge B7, Rest aus weiteren' },
      erw('inventur', { inventur: { von: 12, nach: 7 }, teilCharge: { menge: 2, charge: 'B7' } })],
    ['neu: Inventur 9 → 4, davon 2 aus B7', { type: 'korrektur', quantity: -5, note: 'Inventur-Korrektur: 9 → 4 · 2 aus Charge B7, Rest aus weiteren' },
      erw('inventur', { inventur: { von: 9, nach: 4 }, teilCharge: { menge: 2, charge: 'B7' } })],
    ['neu: Inventur ganz aus einer Charge behält charge', { type: 'korrektur', quantity: -5, note: 'Inventur-Korrektur: 9 → 4 · Charge B7' },
      erw('inventur', { inventur: { von: 9, nach: 4 }, charge: 'B7' })],
    ['neu: Inventur, Teil aus einer Zeile ohne Charge', { type: 'korrektur', quantity: -5, note: 'Inventur-Korrektur: 9 → 4 · 2 aus Charge ohne Charge, Rest aus weiteren' },
      erw('inventur', { inventur: { von: 9, nach: 4 } })],
    ['neu: Inventur, gewählte Zeile ohne Charge', { type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 9 → 8 · Charge ohne Charge' },
      erw('inventur', { inventur: { von: 9, nach: 8 } })],
    ['neu: offline nachgeholt', { quantity: -1, batch: 'B7', einsatz: 'E-1', note: 'offline erfasst · Charge B7 · Einsatz E-1' },
      erw('ausbuchung', { offline: true, charge: 'B7', einsatz: 'E-1' })],
    ['neu: Mehrfachbuchung', { type: 'einbuchung', quantity: 20, batch: 'L4', note: 'Mehrfachbuchung · Charge L4' }, erw('einbuchung', { charge: 'L4' })],
    ['neu: KI-Assistent', { quantity: -1, batch: 'B7', note: 'KI-Assistent · Charge B7' }, erw('ausbuchung', { charge: 'B7' })],
    ['neu: Korrektur ohne Inventur', { type: 'korrektur', quantity: -1, note: 'Bruch beim Einräumen' }, erw('korrektur', { restNotiz: 'Bruch beim Einräumen' })],
    ['alt und neu: CSV-Import', { type: 'einbuchung', quantity: 100, note: 'CSV-Import' }, erw('import')],
    // ALT — Bestand vor dieser Änderung
    ['alt: Einbuchung mit leerer Notiz', { type: 'einbuchung', quantity: 10, note: '' }, erw('einbuchung')],
    ['alt: Charge nur in der Notiz', { type: 'einbuchung', quantity: 10, batch: null, note: 'Charge L1' }, erw('einbuchung', { charge: 'L1' })],
    ['alt: Charge und Einsatz nur in der Notiz', { quantity: -2, note: 'Charge B7 · Einsatz E-1' }, erw('ausbuchung', { charge: 'B7', einsatz: 'E-1' })],
    ['alt: ohne Chargenzuordnung', { quantity: -2, einsatz: 'E-1', note: 'ohne Chargenzuordnung' }, erw('ausbuchung', { ohneCharge: true, einsatz: 'E-1' })],
    ['alt: offline, Bestand zwischenzeitlich verändert', { quantity: -2, einsatz: 'E-1', note: 'offline erfasst · ohne Chargenzuordnung (Bestand zwischenzeitlich verändert)' },
      erw('ausbuchung', { offline: true, ohneCharge: true, einsatz: 'E-1' })],
    ['alt: Umlagerung →', { quantity: -5, note: 'Umlagerung → Hauptlager' }, erw('umlagerung', { richtung: 'nach', gegenstelle: 'Hauptlager' })],
    ['alt: Umlagerung ←', { type: 'einbuchung', quantity: 5, location_id: 'hauptlager', note: 'Umlagerung ← RTW 1' },
      erw('umlagerung', { richtung: 'von', gegenstelle: 'RTW 1' })],
    ['alt: Produktausgabe', { quantity: -3, note: 'Produktausgabe E-2026-0147 – Max Muster' },
      erw('produktausgabe', { einsatz: 'E-2026-0147', empfaenger: 'Max Muster' })],
    ['alt: Produktausgabe ohne Einsatz', { quantity: -1, note: 'Produktausgabe undefined – Erika Mustermann' },
      erw('produktausgabe', { empfaenger: 'Erika Mustermann' })],
    ['alt: Produktausgabe mit leerem Einsatz', { quantity: -1, note: 'Produktausgabe  – Erika Mustermann' },
      erw('produktausgabe', { empfaenger: 'Erika Mustermann' })],
    ['alt: Rückruf Charge B7', { quantity: -12, note: 'Rückruf Charge B7' }, erw('rueckruf', { charge: 'B7' })],
    ['alt: Inventur seitdem gebucht', { type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 8 → 7 (beim Start 9, seitdem gebucht)' },
      erw('inventur', { inventur: { von: 8, nach: 7 }, restNotiz: 'beim Start 9, seitdem gebucht' })],
  ]

  it.each(faelle)('%s', (_name, p, erwartet) => {
    expect(einordnen(zeile(p))).toEqual(erwartet)
  })

  it('batch-Feld und einsatz-Feld gehen vor der Notiz', () => {
    const e = einordnen(zeile({ batch: 'B7-NEU', einsatz: 'E-2', note: 'Charge B7 · Einsatz E-1' }))
    expect(e.charge).toBe('B7-NEU')
    expect(e.einsatz).toBe('E-2')
  })
})

// ── Rundlauf mit dem echten Buchungsweg ──────────────────────────────────────

describe('Logbuch: Rundlauf — was planeBuchung schreibt, liest das Logbuch als einen sicheren Vorgang', () => {
  const einVorgang = (zeilen: LogZeile[], clientId: string) => {
    const v = bildeVorgaenge(zeilen)
    expect(v).toHaveLength(1)
    expect(v[0].sicher).toBe(true)
    expect(v[0].schluessel).toBe(`v:${clientId}`)
    expect(v[0].zeilen).toHaveLength(zeilen.length)
    return v[0]
  }

  it('Ausbuchung über zwei Chargen und Rest ohne Bestand', () => {
    const plan = planeBuchung([{ art: 'abgang', item_id: 'handschuhe', location_id: 'rtw1', menge: 6, einsatz: 'E-2026-0412' }],
      BESTAND, WER, 'ausgabe00000001', { neueId: idFolge('a'), ueberzug: 'protokollieren' })
    const zeilen = journalAus(plan, T('14:32:07.120'))
    expect(zeilen.map(z => einordnen(z))).toEqual([
      erw('ausbuchung', { charge: 'B7', einsatz: 'E-2026-0412' }),
      erw('ausbuchung', { charge: 'B8', einsatz: 'E-2026-0412' }),
      erw('ausbuchung', { ohneCharge: true, einsatz: 'E-2026-0412' }),
    ])
    expect(einVorgang(zeilen, 'ausgabe00000001').art).toBe('ausbuchung')
  })

  it('Umlagerung über zwei Chargen: vier Zeilen, beide Seiten', () => {
    const plan = planeBuchung([{ art: 'umlagerung', item_id: 'handschuhe', von: 'rtw1', nach: 'hauptlager', menge: 4, vonName: 'RTW 1', nachName: 'Hauptlager' }],
      BESTAND, WER, 'umlager00000001', { neueId: idFolge('u') })
    const zeilen = journalAus(plan, T('14:40:00.000'))
    const e = zeilen.map(z => einordnen(z))
    expect(e.map(x => [x.art, x.richtung, x.gegenstelle, x.charge])).toEqual([
      ['umlagerung', 'nach', 'Hauptlager', 'B7'], ['umlagerung', 'von', 'RTW 1', 'B7'],
      ['umlagerung', 'nach', 'Hauptlager', 'B8'], ['umlagerung', 'von', 'RTW 1', 'B8'],
    ])
    expect(einVorgang(zeilen, 'umlager00000001').art).toBe('umlagerung')
  })

  it('Produktausgabe mit zwei Positionen', () => {
    const notiz = 'Produktausgabe · an Max Muster'
    const plan = planeBuchung([
      { art: 'abgang', item_id: 'handschuhe', location_id: 'rtw1', menge: 2, notiz, einsatz: 'E-2026-0147' },
      { art: 'abgang', item_id: 'kompressen', location_id: 'rtw1', menge: 3, notiz, einsatz: 'E-2026-0147' },
    ], BESTAND, WER, 'produkt00000001', { neueId: idFolge('p'), ueberzug: 'protokollieren' })
    const zeilen = journalAus(plan, T('15:02:11.500'))
    expect(zeilen.map(z => einordnen(z))).toEqual([
      erw('produktausgabe', { empfaenger: 'Max Muster', charge: 'B7', einsatz: 'E-2026-0147' }),
      erw('produktausgabe', { empfaenger: 'Max Muster', charge: 'K1', einsatz: 'E-2026-0147' }),
    ])
    expect(einVorgang(zeilen, 'produkt00000001').art).toBe('produktausgabe')
  })

  it('Rückruf einer ganzen Charge', () => {
    const plan = planeBuchung([{ art: 'abgang', item_id: 'handschuhe', location_id: 'rtw1', menge: 1, notiz: 'Rückruf', nurZeile: 'stockb700000001', ganzeZeile: true }],
      BESTAND, WER, 'rueckru00000001', { neueId: idFolge('r') })
    const zeilen = journalAus(plan, T('15:10:00.000'))
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].quantity).toBe(-3)
    expect(einordnen(zeilen[0])).toEqual(erw('rueckruf', { charge: 'B7' }))
    expect(einVorgang(zeilen, 'rueckru00000001').art).toBe('rueckruf')
  })

  it('Inventur-Sammelzeile mit gewählter Charge', () => {
    const plan = planeBuchung([{ art: 'abgang', typ: 'korrektur', sammel: true, item_id: 'handschuhe', location_id: 'rtw1', menge: 1, notiz: 'Inventur-Korrektur: 5 → 4', bevorzugt: 'stockb800000001' }],
      BESTAND, WER, 'inventu00000001', { neueId: idFolge('i') })
    const zeilen = journalAus(plan, T('15:20:00.000'))
    expect(zeilen.map(z => einordnen(z))).toEqual([erw('inventur', { inventur: { von: 5, nach: 4 }, charge: 'B8' })])
    expect(einVorgang(zeilen, 'inventu00000001').art).toBe('inventur')
  })

  it('Inventur-Sammelzeile über mehrere Chargen: nur teilCharge, keine Charge', () => {
    // B8 hat 2 Stück, 4 fehlen — 2 aus B8, Rest aus B7
    const plan = planeBuchung([{ art: 'abgang', typ: 'korrektur', sammel: true, item_id: 'handschuhe', location_id: 'rtw1', menge: 4, notiz: 'Inventur-Korrektur: 5 → 1', bevorzugt: 'stockb800000001' }],
      BESTAND, WER, 'inventu00000002', { neueId: idFolge('j') })
    const zeilen = journalAus(plan, T('15:21:00.000'))
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].note).toBe('Inventur-Korrektur: 5 → 1 · 2 aus Charge B8, Rest aus weiteren')
    expect(einordnen(zeilen[0])).toEqual(erw('inventur', { inventur: { von: 5, nach: 1 }, teilCharge: { menge: 2, charge: 'B8' } }))
  })

  it('offline erfasste Einbuchung', () => {
    const plan = planeBuchung([{ art: 'zugang', item_id: 'handschuhe', location_id: 'rtw1', menge: 50, batch: 'L1', expiry: '2028-08-31', notiz: 'offline erfasst' }],
      BESTAND, WER, 'offline00000001', { neueId: idFolge('o') })
    const zeilen = journalAus(plan, T('15:30:00.000'))
    expect(zeilen.map(z => einordnen(z))).toEqual([erw('einbuchung', { offline: true, charge: 'L1' })])
    einVorgang(zeilen, 'offline00000001')
  })

  it('Rücknahme: eigener sicherer Vorgang, jede Zeile ihrem Original zugeordnet', () => {
    const plan = planeBuchung([{ art: 'abgang', item_id: 'handschuhe', location_id: 'rtw1', menge: 6, einsatz: 'E-2026-0412' }],
      BESTAND, WER, 'ausgabe00000002', { neueId: idFolge('b'), ueberzug: 'protokollieren' })
    const original = journalAus(plan, T('14:32:07.120'))
    const zurueck = planeRueckgaengig({ client_id: 'ausgabe00000002', posten: plan.posten, ohneBestand: plan.ohneBestand, rueckgaengigMoeglich: plan.rueckgaengigMoeglich },
      [], WER, 'storno000000001', { neueId: idFolge('s') })
    const gegen = journalAus(zurueck, T('14:33:01.004'))

    expect(gegen.map(z => einordnen(z))).toEqual([
      rueck('ausbuchung', { ohneCharge: true, einsatz: 'E-2026-0412' }),
      rueck('ausbuchung', { charge: 'B8', einsatz: 'E-2026-0412' }),
      rueck('ausbuchung', { charge: 'B7', einsatz: 'E-2026-0412' }),
    ])

    const v = bildeVorgaenge([...original, ...gegen])
    expect(v.map(x => [x.schluessel, x.art, x.sicher, x.zeilen.length])).toEqual([
      ['v:storno000000001', 'rueckgaengig', true, 3],
      ['v:ausgabe00000002', 'ausbuchung', true, 3],
    ])

    const r = findeRuecknahmen([...original, ...gegen])
    expect(r.original.size).toBe(3)
    for (const g of gegen) expect(r.original.get(g.storno_von!)).toBe(g.id)
    expect(r.vermutlich.size).toBe(0)

    // Ohne die Felder vorgang und storno_von (in PocketBase noch nicht angelegt):
    // Zeitnähe fasst zusammen, Rücknahmen werden vermutet
    const ohneFelder = [...original, ...gegen].map(z => ({ ...z, vorgang: undefined, storno_von: undefined }))
    const h = bildeVorgaenge(ohneFelder)
    expect(h.map(x => [x.art, x.sicher, x.zeilen.length])).toEqual([['rueckgaengig', false, 3], ['ausbuchung', false, 3]])
    const rh = findeRuecknahmen(ohneFelder)
    expect(rh.original.size).toBe(3)
    expect([...rh.vermutlich].sort()).toEqual(original.map(z => z.id).sort())
    for (const o of original) expect(rh.original.get(o.id)).toBe(gegen.find(g => g.storno_von === o.id)!.id)
  })
})

// ── Vorgänge bilden ──────────────────────────────────────────────────────────

describe('Logbuch: Vorgänge bilden', () => {
  const art = (zeilen: LogZeile[]) => bildeVorgaenge(zeilen).map(v => [v.art, v.zeilen.length, v.sicher])

  it('zwei Vorgänge in derselben Millisekunde bleiben zwei', () => {
    const a = zeile({ created: T('14:32:07.120'), vorgang: 'vorganga0000001', batch: 'B7', note: 'Charge B7' })
    const b = zeile({ created: T('14:32:07.120'), vorgang: 'vorgangb0000001', batch: 'B8', note: 'Charge B8' })
    const v = bildeVorgaenge([a, b])
    expect(v.map(x => x.schluessel).sort()).toEqual(['v:vorganga0000001', 'v:vorgangb0000001'])
    expect(v.every(x => x.sicher && x.zeilen.length === 1)).toBe(true)
  })

  it('alte Mehrcharge-Ausbuchung über 1,2 s ist ein Vorgang — samt Restzeile ohne Chargenzuordnung', () => {
    const zeilen = [
      zeile({ created: T('14:32:07.100'), quantity: -3, batch: 'B7', stock_id: 'stockb700000001', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' }),
      zeile({ created: T('14:32:07.700'), quantity: -2, batch: 'B8', stock_id: 'stockb800000001', einsatz: 'E-1', note: 'Charge B8 · Einsatz E-1' }),
      zeile({ created: T('14:32:08.300'), quantity: -1, einsatz: 'E-1', note: 'ohne Chargenzuordnung' }),
    ]
    const v = bildeVorgaenge(zeilen)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ art: 'ausbuchung', sicher: false, schluessel: `m:${zeilen[0].id}`, zeit: T('14:32:08.300'), user: JULIA })
    expect(v[0].zeilen.map(z => z.id)).toEqual(zeilen.map(z => z.id))
  })

  it('zwei Personen in derselben Sekunde sind zwei Vorgänge', () => {
    const zeilen = [
      zeile({ created: T('14:32:07.200'), user: JULIA, batch: 'B7', note: 'Charge B7' }),
      zeile({ created: T('14:32:07.700'), user: TOM, batch: 'B7', note: 'Charge B7' }),
    ]
    const v = bildeVorgaenge(zeilen)
    expect(v).toHaveLength(2)
    expect(v.map(x => x.user)).toEqual([TOM, JULIA])
  })

  it('Umlagerungspaar 0,4 s ist ein Vorgang, eine einzelne Seite bleibt einzeln', () => {
    const quelle = zeile({ created: T('14:50:00.000'), quantity: -5, note: 'Umlagerung → Hauptlager' })
    const ziel = zeile({ created: T('14:50:00.400'), type: 'einbuchung', quantity: 5, location_id: 'hauptlager', note: 'Umlagerung ← RTW 1' })
    const paar = bildeVorgaenge([quelle, ziel])
    expect(paar).toHaveLength(1)
    expect(paar[0]).toMatchObject({ art: 'umlagerung', sicher: false, schluessel: `u:${quelle.id}` })

    const einzeln = bildeVorgaenge([quelle])
    expect(einzeln).toHaveLength(1)
    expect(einzeln[0]).toMatchObject({ art: 'umlagerung', schluessel: `e:${quelle.id}` })
  })

  it('Produktausgabe mit 5 Positionen über 8 s ist ein Vorgang — alt und neu; anderer Empfänger getrennt', () => {
    const artikel = ['handschuhe', 'kompressen', 'mullbinden', 'rettungsdecke', 'pflaster']
    const alt = artikel.map((item_id, n) => zeile({ created: T(`14:40:0${n * 2}.000`), item_id, quantity: -1, note: 'Produktausgabe E-2026-0147 – Max Muster' }))
    expect(art(alt)).toEqual([['produktausgabe', 5, false]])

    const neu = artikel.map((item_id, n) => zeile({
      created: T(`15:40:0${n * 2}.000`), item_id, quantity: -1, batch: `C${n}`, einsatz: 'E-2026-0147',
      note: `Produktausgabe · an Max Muster · Charge C${n} · Einsatz E-2026-0147`,
    }))
    neu.push(zeile({ created: T('15:40:08.000'), item_id: 'pflaster', quantity: -1, einsatz: 'E-2026-0147', note: 'Produktausgabe · an Max Muster · ohne Chargenzuordnung · Einsatz E-2026-0147' }))
    expect(art(neu)).toEqual([['produktausgabe', 6, false]])

    const andere = zeile({ created: T('15:40:03.000'), quantity: -1, note: 'Produktausgabe · an Erika Mustermann · Charge B7' })
    expect(art([...neu, andere])).toEqual([['produktausgabe', 6, false], ['produktausgabe', 1, false]])
  })

  it('Produktausgabe: Kette bis 120 s je Position, danach neuer Vorgang', () => {
    const pos = (created: string, item_id: string) => zeile({ created: T(created), item_id, quantity: -1, note: 'Produktausgabe E-2026-0147 – Max Muster' })
    expect(art([pos('14:40:00', 'handschuhe'), pos('14:41:30', 'kompressen'), pos('14:43:20', 'pflaster')])).toEqual([['produktausgabe', 3, false]])
    expect(art([pos('14:40:00', 'handschuhe'), pos('14:43:00', 'kompressen')])).toEqual([['produktausgabe', 1, false], ['produktausgabe', 1, false]])
  })

  it('Produktausgabe an dieselbe Person für zwei Einsätze innerhalb von 120 s: zwei Vorgänge', () => {
    for (const mitFeld of [true, false]) {
      const a = zeile({ created: T('15:00:00'), item_id: 'handschuhe', quantity: -1, einsatz: mitFeld ? 'E-1' : null, note: 'Produktausgabe · an Max Muster · Einsatz E-1' })
      const b = zeile({ created: T('15:00:30'), item_id: 'kompressen', quantity: -1, einsatz: mitFeld ? 'E-2' : null, note: 'Produktausgabe · an Max Muster · Einsatz E-2' })
      const c = zeile({ created: T('15:00:40'), item_id: 'pflaster', quantity: -1, einsatz: mitFeld ? 'E-1' : null, note: 'Produktausgabe · an Max Muster · Einsatz E-1' })
      const v = bildeVorgaenge([a, b, c])
      expect(v.map(x => [x.art, x.zeilen.map(z => z.id)])).toEqual([
        ['produktausgabe', [a.id, c.id]],
        ['produktausgabe', [b.id]],
      ])
      expect(v.map(x => einordnen(x.zeilen[0]).einsatz)).toEqual(['E-1', 'E-2'])
    }
  })

  it('CSV-Import: je Person und Standort, Kette bis 60 s', () => {
    const imp = (created: string, p: Partial<LogZeile> = {}) => zeile({ created: T(created), type: 'einbuchung', quantity: 10, note: 'CSV-Import', ...p })
    expect(art([imp('13:00:00', { item_id: 'kompressen' }), imp('13:00:40', { item_id: 'pflaster' }), imp('13:01:30', { item_id: 'mullbinden' })]))
      .toEqual([['import', 3, false]])
    expect(art([imp('13:00:00', { item_id: 'kompressen' }), imp('13:02:00', { item_id: 'pflaster' })]))
      .toEqual([['import', 1, false], ['import', 1, false]])
    expect(art([imp('13:00:00', { item_id: 'kompressen' }), imp('13:00:01', { item_id: 'pflaster', location_id: 'hauptlager' })]))
      .toEqual([['import', 1, false], ['import', 1, false]])
  })

  it('Aus- und Einbuchung desselben Artikels im Abstand von 2 s sind zwei Vorgänge', () => {
    const zeilen = [
      zeile({ created: T('14:00:00.000'), quantity: -2, batch: 'B7', note: 'Charge B7' }),
      zeile({ created: T('14:00:02.000'), type: 'einbuchung', quantity: 10, batch: 'L1', note: 'Charge L1' }),
    ]
    expect(art(zeilen)).toEqual([['einbuchung', 1, false], ['ausbuchung', 1, false]])
  })

  it('Umlagerung: Gegenseite erst nach 30 s gehört nicht mehr dazu', () => {
    const zeilen = [
      zeile({ created: T('14:50:00.000'), quantity: -5, note: 'Umlagerung → Hauptlager' }),
      zeile({ created: T('14:50:30.000'), type: 'einbuchung', quantity: 5, location_id: 'hauptlager', note: 'Umlagerung ← RTW 1' }),
    ]
    expect(art(zeilen)).toEqual([['umlagerung', 1, false], ['umlagerung', 1, false]])
  })

  it('Rücknahmen ohne vorgang: 3 s Abstand ein Vorgang, 30 s Abstand zwei', () => {
    const r = (created: string, batch: string) => zeile({ created: T(created), quantity: 1, batch, note: `Rückgängig · Charge ${batch}` })
    expect(art([r('14:00:00', 'B7'), r('14:00:03', 'B8')])).toEqual([['rueckgaengig', 2, false]])
    expect(art([r('14:00:00', 'B7'), r('14:00:30', 'B8')])).toEqual([['rueckgaengig', 1, false], ['rueckgaengig', 1, false]])
  })

  it('dieselbe Ausbuchung nach 30 s ist ein neuer Vorgang', () => {
    const zeilen = [
      zeile({ created: T('14:00:00.000'), quantity: -1, batch: 'B7', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' }),
      zeile({ created: T('14:00:30.000'), quantity: -1, batch: 'B7', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' }),
    ]
    expect(art(zeilen)).toEqual([['ausbuchung', 1, false], ['ausbuchung', 1, false]])
  })

  it('Inventur: 6 Positionen über 12 min sind eine Karte — mit und ohne vorgang', () => {
    const artikel = ['handschuhe', 'kompressen', 'mullbinden', 'rettungsdecke', 'pflaster', 'kanuelen']
    const minuten = ['14:00:00', '14:02:24', '14:04:48', '14:07:12', '14:09:36', '14:12:00']
    for (const mitVorgang of [true, false]) {
      const pos = artikel.map((item_id, n) => zeile({
        created: T(minuten[n]), item_id, type: 'korrektur', quantity: -1,
        note: `Inventur-Korrektur: ${n + 5} → ${n + 4}`, vorgang: mitVorgang ? `inventurpos0000${n}` : null,
      }))
      // Dazwischen eine normale Ausbuchung — bleibt eigener Vorgang
      const zwischendurch = zeile({ created: T('14:05:00.000'), quantity: -1, batch: 'B7', note: 'Charge B7', vorgang: mitVorgang ? 'zwischen0000001' : null })
      const v = bildeVorgaenge([...pos, zwischendurch])
      expect(v.map(x => [x.art, x.zeilen.length, x.sicher])).toEqual([['inventur', 6, false], ['ausbuchung', 1, mitVorgang]])
      expect(v[0].schluessel).toBe(`i:${pos[0].id}`)
      expect(v[0].zeit).toBe(T('14:12:00'))
      expect(v[0].zeilen.map(z => z.id)).toEqual(pos.map(z => z.id))
    }
  })

  it('CSV-Import mit vorgang je Zeile: eine Sammelkarte statt einer Karte je Zeile', () => {
    const artikel = ['handschuhe', 'kompressen', 'mullbinden', 'rettungsdecke', 'pflaster']
    const pos = artikel.map((item_id, n) => zeile({
      created: T(`13:00:${String(n * 10).padStart(2, '0')}.000`), item_id, type: 'einbuchung', quantity: 10,
      note: 'CSV-Import', vorgang: `csvimp00000000${n}`,
    }))
    const v = bildeVorgaenge(pos)
    expect(v.map(x => [x.art, x.zeilen.length, x.sicher])).toEqual([['import', 5, false]])
    expect(v[0].schluessel).toBe(`c:${pos[0].id}`)
    expect(v[0].zeit).toBe(T('13:00:40'))
    expect(v[0].zeilen.map(z => z.id)).toEqual(pos.map(z => z.id))

    // Gemischt mit Altbestand ohne vorgang — weiterhin eine Karte; dazwischen bucht jemand anderes
    const alt = pos.map((z, n) => (n % 2 ? { ...z, vorgang: null } : z))
    const tom = zeile({ created: T('13:00:15.000'), user: TOM, quantity: -1, batch: 'B7', note: 'Charge B7', vorgang: 'tombucht0000001' })
    expect(bildeVorgaenge([...alt, tom]).map(x => [x.art, x.zeilen.length, x.user])).toEqual([['import', 5, JULIA], ['ausbuchung', 1, TOM]])
  })

  it('CSV-Import-Sammelkarte: andere Person, anderer Standort oder mehr als 60 s Pause ergeben eigene Karten', () => {
    const imp = (created: string, n: number, p: Partial<LogZeile> = {}) =>
      zeile({ created: T(created), type: 'einbuchung', quantity: 10, note: 'CSV-Import', vorgang: `csvimp10000000${n}`, ...p })
    const v = bildeVorgaenge([
      imp('13:00:00', 1), imp('13:00:30', 2, { item_id: 'kompressen' }),
      imp('13:00:10', 3, { user: TOM }),
      imp('13:00:20', 4, { location_id: 'hauptlager' }),
      imp('13:02:00', 5, { item_id: 'pflaster' }),
    ])
    expect(v.map(x => [x.art, x.zeilen.length, x.sicher, x.user, x.zeilen[0].location_id])).toEqual([
      ['import', 1, true, JULIA, 'rtw1'],
      ['import', 2, false, JULIA, 'rtw1'],
      ['import', 1, true, JULIA, 'hauptlager'],
      ['import', 1, true, TOM, 'rtw1'],
    ])
  })

  it('Zu- und Abgänge in einem Vorgang (KI-Assistent, Mehrfachbuchung): Art gemischt', () => {
    const ki = [
      zeile({ created: T('16:00:00.100'), vorgang: 'kiassist0000001', item_id: 'handschuhe', type: 'einbuchung', quantity: 5, batch: 'L1', note: 'KI-Assistent · Charge L1' }),
      zeile({ created: T('16:00:00.100'), vorgang: 'kiassist0000001', item_id: 'kompressen', type: 'einbuchung', quantity: 3, note: 'KI-Assistent' }),
      zeile({ created: T('16:00:00.100'), vorgang: 'kiassist0000001', item_id: 'pflaster', type: 'ausbuchung', quantity: -2, batch: 'B7', note: 'KI-Assistent · Charge B7' }),
    ]
    expect(art(ki)).toEqual([['gemischt', 3, true]])
    // Nur Zugänge bzw. nur Abgänge bleiben Ein- bzw. Ausbuchung
    expect(art(ki.slice(0, 2))).toEqual([['einbuchung', 2, true]])
    expect(art(ki.slice(2))).toEqual([['ausbuchung', 1, true]])

    const mehrfach = [
      zeile({ created: T('16:10:00.000'), vorgang: 'mehrfach0000001', item_id: 'handschuhe', type: 'einbuchung', quantity: 20, batch: 'L4', note: 'Mehrfachbuchung · Charge L4' }),
      zeile({ created: T('16:10:00.000'), vorgang: 'mehrfach0000001', item_id: 'handschuhe', type: 'ausbuchung', quantity: -1, batch: 'B7', note: 'Mehrfachbuchung · Charge B7' }),
    ]
    expect(art(mehrfach)).toEqual([['gemischt', 2, true]])

    // Rücknahme des gemischten Vorgangs bleibt "rückgängig"
    const zurueck = ki.map((z, n) => zeile({
      created: T('16:01:00.000'), vorgang: 'kistorno0000001', storno_von: z.id, item_id: z.item_id, type: z.type,
      quantity: -z.quantity, batch: z.batch, note: `Rückgängig · ${z.note}`, id: `kistornozeile0${n}`,
    }))
    expect(art(zurueck)).toEqual([['rueckgaengig', 3, true]])
  })

  it('gemischt gilt nicht für Umlagerung, Inventur und CSV-Import', () => {
    const umlagerung = [
      zeile({ created: T('17:00:00.000'), vorgang: 'umlagerg0000001', quantity: -5, batch: 'B7', note: 'Umlagerung → Hauptlager · Charge B7' }),
      zeile({ created: T('17:00:00.000'), vorgang: 'umlagerg0000001', type: 'einbuchung', quantity: 5, location_id: 'hauptlager', batch: 'B7', note: 'Umlagerung ← RTW 1 · Charge B7' }),
      zeile({ created: T('17:00:00.000'), vorgang: 'umlagerg0000001', quantity: -1, batch: 'B7', note: 'Charge B7' }),
    ]
    expect(art(umlagerung)).toEqual([['umlagerung', 3, true]])
    const inventur = [
      zeile({ created: T('17:10:00.000'), vorgang: 'inventpos000001', type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 9 → 8' }),
      zeile({ created: T('17:12:00.000'), vorgang: 'inventpos000002', item_id: 'kompressen', type: 'korrektur', quantity: 1, note: 'Inventur-Korrektur: 4 → 5' }),
    ]
    expect(art(inventur)).toEqual([['inventur', 2, false]])
    const csv = [
      zeile({ created: T('17:20:00.000'), vorgang: 'csvimp200000001', type: 'einbuchung', quantity: 10, note: 'CSV-Import' }),
      zeile({ created: T('17:20:05.000'), vorgang: 'csvimp200000002', item_id: 'kompressen', type: 'ausbuchung', quantity: -2, note: 'CSV-Import' }),
    ]
    expect(art(csv)).toEqual([['import', 2, false]])
  })

  it('Inventur: andere Person, anderer Standort oder mehr als 30 min Pause ergeben eigene Karten', () => {
    const inv = (created: string, p: Partial<LogZeile> = {}) => zeile({ created: T(created), type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 3 → 2', ...p })
    const v = bildeVorgaenge([
      inv('14:00:00'), inv('14:10:00', { item_id: 'kompressen' }),
      inv('14:05:00', { user: TOM }),
      inv('14:06:00', { location_id: 'hauptlager' }),
      inv('14:41:00', { item_id: 'pflaster' }),
    ])
    expect(v.map(x => [x.art, x.zeilen.length, x.user, x.zeilen[0].location_id])).toEqual([
      ['inventur', 1, JULIA, 'rtw1'],
      ['inventur', 2, JULIA, 'rtw1'],
      ['inventur', 1, JULIA, 'hauptlager'],
      ['inventur', 1, TOM, 'rtw1'],
    ])
  })

  // Ein gemischter Tag für die folgenden Fälle
  const tag = (): LogZeile[] => [
    zeile({ created: T('08:15:00.000'), type: 'einbuchung', quantity: 50, batch: 'L1', note: 'Charge L1', vorgang: 'morgen000000001' }),
    zeile({ created: T('09:00:01.000'), quantity: -3, batch: 'B7', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' }),
    zeile({ created: T('09:00:01.600'), quantity: -2, batch: 'B8', einsatz: 'E-1', note: 'Charge B8 · Einsatz E-1' }),
    zeile({ created: T('09:00:02.100'), quantity: -1, einsatz: 'E-1', note: 'ohne Chargenzuordnung' }),
    zeile({ created: T('10:30:00.000'), quantity: -5, note: 'Umlagerung → Hauptlager' }),
    zeile({ created: T('10:30:00.400'), type: 'einbuchung', quantity: 5, location_id: 'hauptlager', note: 'Umlagerung ← RTW 1' }),
    zeile({ created: T('11:00:00.000'), user: TOM, item_id: 'kompressen', quantity: -2, note: 'Produktausgabe E-2026-0147 – Max Muster' }),
    zeile({ created: T('11:00:04.000'), user: TOM, item_id: 'pflaster', quantity: -1, note: 'Produktausgabe E-2026-0147 – Max Muster' }),
    zeile({ created: T('12:00:00.000'), type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 9 → 8' }),
    zeile({ created: T('12:03:00.000'), type: 'korrektur', item_id: 'kompressen', quantity: 1, note: 'Inventur-Korrektur: 4 → 5' }),
    zeile({ created: T('13:00:00.000'), type: 'einbuchung', item_id: 'kompressen', quantity: 20, note: 'CSV-Import' }),
    zeile({ created: T('13:00:00.050'), type: 'einbuchung', item_id: 'pflaster', quantity: 30, note: 'CSV-Import' }),
  ]

  it('Ausgabe absteigend nach Zeit, Zeilen im Vorgang aufsteigend', () => {
    const v = bildeVorgaenge(tag())
    expect(v.map(x => [x.art, x.zeilen.length])).toEqual([
      ['import', 2], ['inventur', 2], ['produktausgabe', 2], ['umlagerung', 2], ['ausbuchung', 3], ['einbuchung', 1],
    ])
    for (const x of v) {
      const zeiten = x.zeilen.map(z => z.created)
      expect(zeiten).toEqual([...zeiten].sort())
      expect(x.zeit).toBe(zeiten[zeiten.length - 1])
      expect(x.tag).toBe(tagSchluessel(x.zeit))
    }
  })

  it('unsortierte Eingabe ergibt dasselbe', () => {
    const zeilen = tag()
    const gemischt = [zeilen[7], zeilen[2], zeilen[11], zeilen[0], zeilen[5], zeilen[9], zeilen[3], zeilen[1], zeilen[10], zeilen[4], zeilen[8], zeilen[6]]
    expect(bildeVorgaenge(gemischt)).toEqual(bildeVorgaenge(zeilen))
  })

  it('Seite 1 + Seite 2 ergibt dasselbe wie alles auf einmal — auch über die Seitengrenze und mit doppelten Zeilen', () => {
    const alle = tag()
    // So kommt es von PocketBase: '-created,-id', Seitengrenze mitten in der Mehrcharge-Ausbuchung
    const absteigend = [...alle].sort((a, b) => (a.created < b.created ? 1 : -1))
    const seite1 = absteigend.slice(0, 10)
    const seite2 = absteigend.slice(10)
    expect(bildeVorgaenge(seite1).find(v => v.art === 'ausbuchung')!.zeilen).toHaveLength(2)
    const erwartet = bildeVorgaenge(alle)
    expect(bildeVorgaenge([...seite1, ...seite2])).toEqual(erwartet)
    expect(bildeVorgaenge([...seite2, ...seite1])).toEqual(erwartet)
    expect(bildeVorgaenge([...seite1, ...seite2, seite1[0], seite2[1]])).toEqual(erwartet)
  })
})

// ── Rücknahmen ───────────────────────────────────────────────────────────────

describe('Logbuch: Rücknahmen ihren Originalen zuordnen', () => {
  const aus = (created: string, p: Partial<LogZeile> = {}) =>
    zeile({ created: T(created), quantity: -2, batch: 'B7', stock_id: 'stockb700000001', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1', ...p })
  const zur = (created: string, p: Partial<LogZeile> = {}) =>
    zeile({ created: T(created), quantity: 2, batch: 'B7', stock_id: 'stockb700000001', einsatz: 'E-1', note: 'Rückgängig · Charge B7 · Einsatz E-1', ...p })

  it('mit storno_von: sicher zugeordnet', () => {
    const o = aus('14:32:07')
    const r = zur('14:32:41', { storno_von: o.id })
    const { original, vermutlich } = findeRuecknahmen([r, o])
    expect(original.get(o.id)).toBe(r.id)
    expect(vermutlich.size).toBe(0)
  })

  it('storno_von zählt auch, wenn das Original nicht geladen ist', () => {
    const r = zur('14:32:41', { storno_von: 'tx0000000000999' })
    expect(findeRuecknahmen([r]).original.get('tx0000000000999')).toBe(r.id)
  })

  it('ohne storno_von: passende Zeile vorher, als vermutlich markiert', () => {
    const o = aus('14:32:07')
    const r = zur('14:32:41')
    const { original, vermutlich } = findeRuecknahmen([o, r])
    expect(original.get(o.id)).toBe(r.id)
    expect([...vermutlich]).toEqual([o.id])
  })

  it('zwei gleiche Ausbuchungen und eine Rücknahme: nur die jüngste ist zurückgenommen', () => {
    const o1 = aus('14:00:00')
    const o2 = aus('14:05:00')
    const r = zur('14:06:00')
    const { original, vermutlich } = findeRuecknahmen([r, o1, o2])
    expect([...original.entries()]).toEqual([[o2.id, r.id]])
    expect([...vermutlich]).toEqual([o2.id])
  })

  it('ohne gleichlautende Zeile: die jüngste passende davor', () => {
    const o1 = aus('14:00:00')
    const o2 = aus('14:05:00', { einsatz: 'E-2', note: 'Charge B7 · Einsatz E-2' })
    const r = zur('14:06:00', { einsatz: null, note: 'Rückgängig · Charge B7' })
    const { original, vermutlich } = findeRuecknahmen([o1, o2, r])
    expect([...original.entries()]).toEqual([[o2.id, r.id]])
    expect([...vermutlich]).toEqual([o2.id])
  })

  it('die gleichlautende Zeile geht vor der jüngeren', () => {
    const o1 = aus('14:00:00')
    const o2 = aus('14:05:00', { einsatz: 'E-2', note: 'Charge B7 · Einsatz E-2' })
    const r = zur('14:06:00')
    expect([...findeRuecknahmen([o1, o2, r]).original.entries()]).toEqual([[o1.id, r.id]])
  })

  it('nie eine spätere Zeile, und jede Originalzeile höchstens einmal', () => {
    const o1 = aus('14:00:00')
    const r1 = zur('14:01:00', { storno_von: o1.id })
    const r2 = zur('14:02:00') // passt nur auf o1 — das ist schon vergeben
    const o2 = aus('14:03:00') // nach r2, darf nicht r2 zugeordnet werden
    const { original, vermutlich } = findeRuecknahmen([o1, r1, r2, o2])
    expect([...original.entries()]).toEqual([[o1.id, r1.id]])
    expect(vermutlich.size).toBe(0)
  })

  it('ohne storno_von: nur eine Buchung derselben Person — Bens gleiche Buchung bleibt stehen', () => {
    const anna = aus('10:00:00', { user: 'anna.schmidt@drk-musterstadt.de' })
    const ben = aus('10:00:05', { user: 'ben.wagner@drk-musterstadt.de' })
    const r = zur('10:00:08', { user: 'anna.schmidt@drk-musterstadt.de' })
    const { original, vermutlich } = findeRuecknahmen([anna, ben, r])
    expect([...original.entries()]).toEqual([[anna.id, r.id]])
    expect([...vermutlich]).toEqual([anna.id])
    expect(original.has(ben.id)).toBe(false)
  })

  it('ohne storno_von und ohne Buchung derselben Person: Rücknahme bleibt ohne Zuordnung', () => {
    const ben = aus('10:00:05', { user: 'ben.wagner@drk-musterstadt.de' })
    const r = zur('10:00:08', { user: 'anna.schmidt@drk-musterstadt.de' })
    expect(findeRuecknahmen([ben, r]).original.size).toBe(0)
  })

  it('Person: Groß-/Kleinschreibung zählt nicht, leer passt nur zu leer', () => {
    const o = aus('10:00:00', { user: 'Anna.Schmidt@DRK-Musterstadt.de' })
    const r = zur('10:00:08', { user: 'anna.schmidt@drk-musterstadt.de' })
    expect([...findeRuecknahmen([o, r]).original.entries()]).toEqual([[o.id, r.id]])

    const ohne = aus('11:00:00', { user: null })
    const ohneR = zur('11:00:08', { user: '' })
    expect([...findeRuecknahmen([ohne, ohneR]).original.entries()]).toEqual([[ohne.id, ohneR.id]])
    expect(findeRuecknahmen([aus('12:00:00', { user: null }), zur('12:00:08')]).original.size).toBe(0)
  })

  it('storno_von bleibt vorrangig — auch über Personen hinweg', () => {
    const o = aus('10:00:00', { user: 'ben.wagner@drk-musterstadt.de' })
    const r = zur('10:00:08', { user: 'anna.schmidt@drk-musterstadt.de', storno_von: o.id })
    const { original, vermutlich } = findeRuecknahmen([o, r])
    expect([...original.entries()]).toEqual([[o.id, r.id]])
    expect(vermutlich.size).toBe(0)
  })

  it('andere Bestandszeile, andere Charge, andere Menge oder anderer Typ passen nicht', () => {
    const r = zur('14:10:00')
    const kandidaten = [
      aus('14:01:00', { stock_id: 'stockb800000001' }),
      aus('14:02:00', { batch: 'B8', note: 'Charge B8 · Einsatz E-1' }),
      aus('14:03:00', { quantity: -3 }),
      aus('14:04:00', { type: 'korrektur' }),
      aus('14:05:00', { item_id: 'kompressen' }),
    ]
    expect(findeRuecknahmen([...kandidaten, r]).original.size).toBe(0)
  })
})

// ── Seitengrenze ("Ältere laden") ────────────────────────────────────────────

describe('Logbuch: Vorgänge an der Seitengrenze', () => {
  const absteigend = (zs: LogZeile[]) => [...zs].sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : a.id < b.id ? 1 : -1))

  it('der Vorgang mit der ältesten geladenen Zeile ist angeschnitten, weit entfernte nicht', () => {
    const mehrcharge = [
      zeile({ created: T('09:00:01.000'), quantity: -3, batch: 'B7', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' }),
      zeile({ created: T('09:00:01.600'), quantity: -2, batch: 'B8', einsatz: 'E-1', note: 'Charge B8 · Einsatz E-1' }),
    ]
    const spaeter = zeile({ created: T('10:30:00.000'), quantity: -1, batch: 'B7', note: 'Charge B7' })
    const seite1 = absteigend([...mehrcharge, spaeter]).slice(0, 2)
    const grenze = seite1[seite1.length - 1]
    expect(grenze.id).toBe(mehrcharge[1].id)
    const v = bildeVorgaenge(seite1)
    const rand = amSeitenende(v, grenze)
    expect([...rand]).toEqual([v.find(x => x.zeilen.some(z => z.id === grenze.id))!.schluessel])
    expect(rand.has(v.find(x => x.zeilen[0].id === spaeter.id)!.schluessel)).toBe(false)
    // Alles geladen: derselbe Vorgang hat dann mehr Zeilen
    expect(bildeVorgaenge([...mehrcharge, spaeter]).find(x => x.art === 'ausbuchung' && x.zeilen.length === 2)).toBeTruthy()
  })

  it('Inventur-Sammelkarte reicht über die Grenze, obwohl die Grenzzeile ein anderer Vorgang ist', () => {
    const minuten = ['14:00:00', '14:02:24', '14:04:48', '14:07:12', '14:09:36', '14:12:00']
    const pos = minuten.map((m, n) => zeile({
      created: T(m), item_id: `artikel${n}`, type: 'korrektur', quantity: -1, note: 'Inventur-Korrektur: 3 → 2', vorgang: `inventurpos1000${n}`,
    }))
    const tom = zeile({ created: T('14:06:00.000'), user: TOM, quantity: -1, batch: 'B7', note: 'Charge B7', vorgang: 'tombucht0000002' })
    const fern = zeile({ created: T('15:30:00.000'), quantity: -1, batch: 'B7', note: 'Charge B7', vorgang: 'fernbuch0000001' })
    const knapp = zeile({ created: T('14:06:05.000'), quantity: -1, batch: 'B8', note: 'Charge B8', vorgang: 'knappbuc0000001' })
    const seite1 = absteigend([...pos, tom, fern, knapp]).slice(0, 6)
    const grenze = seite1[seite1.length - 1]
    expect(grenze.id).toBe(tom.id)
    const v = bildeVorgaenge(seite1)
    const inventur = v.find(x => x.art === 'inventur')!
    expect(inventur.zeilen).toHaveLength(3)
    const rand = amSeitenende(v, grenze)
    expect(rand.has(inventur.schluessel)).toBe(true)
    expect(rand.has('v:tombucht0000002')).toBe(true)
    expect(rand.has('v:fernbuch0000001')).toBe(false)
    // Ein sicherer Vorgang 5 s nach der Grenze ist vollständig (Zeilen einer Buchung entstehen zusammen)
    expect(rand.has('v:knappbuc0000001')).toBe(false)
    // Mit der nächsten Seite: die Karte hat alle 6 Positionen
    expect(bildeVorgaenge([...pos, tom, fern, knapp]).find(x => x.art === 'inventur')!.zeilen).toHaveLength(6)
  })

  it('ohne Grenze (alles geladen) ist nichts angeschnitten', () => {
    const v = bildeVorgaenge([zeile({ created: T('09:00:00') })])
    expect(amSeitenende(v, null).size).toBe(0)
  })
})

// ── Abfragefilter mit dem echten pb.filter ───────────────────────────────────

describe('Logbuch: Abfragefilter (echtes pb.filter des SDK)', () => {
  const f = (x: Partial<LogFilter>) => logbuchFilter({ orgId: 'org1', ...x }, pbFilter)
  const ORG = "organization_id = 'org1'"

  it('immer die Organisation; Standort, Zeitraum und Artikel als Parameter', () => {
    expect(f({})).toBe(ORG)
    expect(f({ art: 'alle', locationId: null, ab: null, itemId: null, nurMeine: null, suche: null, vor: null })).toBe(ORG)
    expect(f({ locationId: 'rtw1', ab: new Date('2026-10-09T22:00:00.000Z'), itemId: 'handschuhe' }))
      .toBe(`${ORG} && location_id = 'rtw1' && created >= '2026-10-09 22:00:00.000Z' && item_id = 'handschuhe'`)
  })

  it.each([
    ['ausbuchung', "type = 'ausbuchung' && note !~ 'Umlagerung'"],
    ['einbuchung', "type = 'einbuchung' && note !~ 'Umlagerung'"],
    ['umlagerung', "note ~ 'Umlagerung'"],
    ['inventur', "type = 'korrektur'"],
    ['rueckruf', "note ~ 'Rückruf'"],
    ['pruefen', "(type = 'korrektur' || note ~ 'Rückgängig' || note ~ 'Rückruf' || note ~ 'ohne Chargenzuordnung' || note ~ 'offline erfasst')"],
  ] as const)('Art %s', (a, teil) => {
    expect(f({ art: a })).toBe(`${ORG} && ${teil}`)
  })

  it('Nur meine: E-Mail oder User-ID (Altbestand gemischt)', () => {
    expect(f({ nurMeine: { email: JULIA, id: 'u8k2m4p6r1t3v5x' } })).toBe(`${ORG} && (user = '${JULIA}' || user = 'u8k2m4p6r1t3v5x')`)
    expect(f({ nurMeine: { email: JULIA } })).toBe(`${ORG} && user = '${JULIA}'`)
    expect(f({ nurMeine: { id: 'u8k2m4p6r1t3v5x' } })).toBe(`${ORG} && user = 'u8k2m4p6r1t3v5x'`)
    // Ohne Kennung: nichts statt alles
    expect(f({ nurMeine: {} })).toBe(`${ORG} && id = ''`)
  })

  it('Keyset „Ältere laden“: created-String unverändert, id als Gleichstandsbrecher', () => {
    expect(f({ vor: { created: '2026-10-16 14:32:07.120Z', id: 'tx0000000000042' } }))
      .toBe(`${ORG} && (created < '2026-10-16 14:32:07.120Z' || (created = '2026-10-16 14:32:07.120Z' && id < 'tx0000000000042'))`)
  })

  it("Suche mit ' und \" wird maskiert, Artikel- und Personen-IDs dazu", () => {
    const q = `'O\\'Brien "Spezial"'`
    expect(f({ suche: { q: `  O'Brien "Spezial" `, itemIds: ['handschuhe', 'kompressen'], userIds: ['u8k2m4p6r1t3v5x'] } }))
      .toBe(`${ORG} && (batch ~ ${q} || einsatz ~ ${q} || note ~ ${q} || user ~ ${q} || item_id = 'handschuhe' || item_id = 'kompressen' || user = 'u8k2m4p6r1t3v5x')`)
  })

  it('Suche erst ab 2 Zeichen; höchstens 30 Artikel und 10 Personen', () => {
    expect(f({ suche: { q: 'B', itemIds: ['handschuhe'], userIds: [] } })).toBe(ORG)
    const viele = f({ suche: { q: 'B7', itemIds: Array.from({ length: 40 }, (_, n) => `artikel${n}`), userIds: Array.from({ length: 15 }, (_, n) => `person${n}`) } })
    expect((viele.match(/item_id = /g) || []).length).toBe(30)
    expect((viele.match(/ user = /g) || []).length).toBe(10)
    expect(viele).toContain("item_id = 'artikel29'")
    expect(viele).not.toContain("'artikel30'")
  })

  it('ein Suchtext, der wie ein Parameter aussieht, bleibt Text', () => {
    expect(f({ suche: { q: '{:o}', itemIds: [], userIds: [] } }))
      .toBe(`${ORG} && (batch ~ '{:o}' || einsatz ~ '{:o}' || note ~ '{:o}' || user ~ '{:o}')`)
  })

  it('Einsatz zeigen: exakt über Feld und Notiz, ohne Artikel- und Personensuche', () => {
    expect(f({ einsatz: 'E-2026-0147' }))
      .toBe(`${ORG} && (einsatz = 'E-2026-0147' || note ~ 'Einsatz E-2026-0147' || note ~ 'Produktausgabe E-2026-0147')`)
    expect(f({ einsatz: "  E'1  " })).toBe(`${ORG} && (einsatz = 'E\\'1' || note ~ 'Einsatz E\\'1' || note ~ 'Produktausgabe E\\'1')`)
    expect(f({ einsatz: '   ' })).toBe(ORG)
    expect(f({ einsatz: null })).toBe(ORG)
  })

  it('Charge verfolgen: exakt über Feld und Notiz', () => {
    expect(f({ charge: 'B7' })).toBe(`${ORG} && (batch = 'B7' || note ~ 'Charge B7')`)
    expect(f({ charge: '{:o}' })).toBe(`${ORG} && (batch = '{:o}' || note ~ 'Charge {:o}')`)
    expect(f({ charge: '' })).toBe(ORG)
  })

  it('Einsatz und Charge mit Suche und Keyset in fester Reihenfolge', () => {
    expect(f({
      suche: { q: 'Hand', itemIds: ['handschuhe'], userIds: [] }, einsatz: 'E-1', charge: 'B7',
      vor: { created: '2026-10-16 09:00:01.000Z', id: 'tx0000000000007' },
    })).toBe([
      ORG,
      "(batch ~ 'Hand' || einsatz ~ 'Hand' || note ~ 'Hand' || user ~ 'Hand' || item_id = 'handschuhe')",
      "(einsatz = 'E-1' || note ~ 'Einsatz E-1' || note ~ 'Produktausgabe E-1')",
      "(batch = 'B7' || note ~ 'Charge B7')",
      "(created < '2026-10-16 09:00:01.000Z' || (created = '2026-10-16 09:00:01.000Z' && id < 'tx0000000000007'))",
    ].join(' && '))
  })

  it('alles zusammen in fester Reihenfolge', () => {
    expect(f({
      locationId: 'rtw1', ab: new Date('2026-10-15T22:00:00.000Z'), itemId: 'handschuhe', art: 'ausbuchung',
      nurMeine: { email: JULIA }, suche: { q: 'E-1', itemIds: [], userIds: [] }, vor: { created: '2026-10-16 09:00:01.000Z', id: 'tx0000000000007' },
    })).toBe([
      ORG, "location_id = 'rtw1'", "created >= '2026-10-15 22:00:00.000Z'", "item_id = 'handschuhe'", `user = '${JULIA}'`,
      "type = 'ausbuchung' && note !~ 'Umlagerung'",
      "(batch ~ 'E-1' || einsatz ~ 'E-1' || note ~ 'E-1' || user ~ 'E-1')",
      "(created < '2026-10-16 09:00:01.000Z' || (created = '2026-10-16 09:00:01.000Z' && id < 'tx0000000000007'))",
    ].join(' && '))
  })
})

// ── Exakte Bezüge auf den geladenen Zeilen ───────────────────────────────────

describe('Logbuch: passtKontext prüft Einsatz und Charge exakt nach', () => {
  it('Einsatz: Feld, Notiz und alte Produktausgabe — "E-1" ist nicht "E-10"', () => {
    const k = { einsatz: 'E-1' }
    expect(passtKontext(zeile({ einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' }), k)).toBe(true)
    expect(passtKontext(zeile({ note: 'Charge B7 · Einsatz E-1' }), k)).toBe(true)
    expect(passtKontext(zeile({ note: 'Produktausgabe E-1 – Max Muster' }), k)).toBe(true)
    expect(passtKontext(zeile({ note: 'Produktausgabe · an Max Muster · Einsatz E-1' }), k)).toBe(true)
    expect(passtKontext(zeile({ note: 'Charge B7 · Einsatz E-10' }), k)).toBe(false)
    expect(passtKontext(zeile({ einsatz: 'E-10', note: 'Einsatz E-10' }), k)).toBe(false)
    expect(passtKontext(zeile({ note: 'Produktausgabe E-10 – Max Muster' }), k)).toBe(false)
    expect(passtKontext(zeile({ note: 'Übergabe an Einsatz E-1' }), k)).toBe(false)
  })

  it('Charge: Feld, Notiz, alter Rückruf und Teilmenge der Inventur — "B7" ist nicht "B70"', () => {
    const k = { charge: 'B7' }
    expect(passtKontext(zeile({ batch: 'B7', note: 'Charge B7' }), k)).toBe(true)
    expect(passtKontext(zeile({ note: 'Charge B7' }), k)).toBe(true)
    expect(passtKontext(zeile({ note: 'Rückruf Charge B7' }), k)).toBe(true)
    expect(passtKontext(zeile({ type: 'korrektur', note: 'Inventur-Korrektur: 9 → 4 · 2 aus Charge B7, Rest aus weiteren' }), k)).toBe(true)
    expect(passtKontext(zeile({ batch: 'B70', note: 'Charge B70' }), k)).toBe(false)
    expect(passtKontext(zeile({ note: 'Charge B70' }), k)).toBe(false)
    expect(passtKontext(zeile({ note: 'Lieferung Charge B7 folgt · Charge L1', batch: 'L1' }), k)).toBe(false)
  })

  it('beides zugleich muss passen; ohne Bezug passt alles', () => {
    const z = zeile({ batch: 'B7', einsatz: 'E-1', note: 'Charge B7 · Einsatz E-1' })
    expect(passtKontext(z, { einsatz: 'E-1', charge: 'B7' })).toBe(true)
    expect(passtKontext(z, { einsatz: 'E-1', charge: 'B8' })).toBe(false)
    expect(passtKontext(z, null)).toBe(true)
    expect(passtKontext(z, { einsatz: '', charge: null })).toBe(true)
  })
})

// ── Zeit und Personen ────────────────────────────────────────────────────────

describe('Logbuch: Zeit und Personen', () => {
  it('pbZeit liest das PocketBase-Format mit Leerzeichen (iOS)', () => {
    const d = pbZeit('2026-10-16 14:32:07.120Z')
    expect(Number.isFinite(d.getTime())).toBe(true)
    expect(d.toISOString()).toBe('2026-10-16T14:32:07.120Z')
    expect(pbZeit('2026-10-16T14:32:07.120Z').toISOString()).toBe('2026-10-16T14:32:07.120Z')
  })

  it('tagSchluessel: Tagesgrenze in Ortszeit des Geräts, nicht UTC', () => {
    const alsPb = (d: Date) => d.toISOString().replace('T', ' ')
    expect(tagSchluessel(alsPb(new Date(2026, 9, 15, 23, 59, 59, 999)))).toBe('2026-10-15')
    expect(tagSchluessel(alsPb(new Date(2026, 9, 16, 0, 0, 0, 0)))).toBe('2026-10-16')
    expect(tagSchluessel(alsPb(new Date(2026, 0, 1, 0, 30)))).toBe('2026-01-01')
    expect(tagSchluessel(alsPb(new Date(2025, 11, 31, 23, 30)))).toBe('2025-12-31')
  })

  it('personKurz: Name aus der Personenliste gewinnt', () => {
    const namen = new Map([[JULIA, 'Julia Becker'], ['u8k2m4p6r1t3v5x', 'Julia Becker']])
    expect(personKurz(JULIA, namen)).toEqual({ kurz: 'J. Becker', voll: 'Julia Becker' })
    expect(personKurz('u8k2m4p6r1t3v5x', namen)).toEqual({ kurz: 'J. Becker', voll: 'Julia Becker' })
    expect(personKurz('Julia.Becker@DRK-Musterstadt.de', namen)).toEqual({ kurz: 'J. Becker', voll: 'Julia Becker' })
  })

  it('personKurz: sonst aus der E-Mail, reine ID, leer', () => {
    expect(personKurz(JULIA)).toEqual({ kurz: 'J. Becker', voll: 'Julia Becker' })
    expect(personKurz('anna-lena.mueller@drk-musterstadt.de')).toEqual({ kurz: 'A. Mueller', voll: 'Anna-Lena Mueller' })
    expect(personKurz('max_mustermann@example.org')).toEqual({ kurz: 'M. Mustermann', voll: 'Max Mustermann' })
    expect(personKurz('jbecker@drk-musterstadt.de')).toEqual({ kurz: 'jbecker', voll: 'jbecker' })
    expect(personKurz('abc123')).toEqual({ kurz: 'Benutzer abc123', voll: 'Benutzer abc123' })
    expect(personKurz('u8k2m4p6r1t3v5x')).toEqual({ kurz: 'Benutzer u8k2m4', voll: 'Benutzer u8k2m4p6r1t3v5x' })
    expect(personKurz('')).toEqual({ kurz: 'Unbekannt', voll: 'Unbekannt' })
    expect(personKurz(null)).toEqual({ kurz: 'Unbekannt', voll: 'Unbekannt' })
    expect(personKurz(undefined, new Map())).toEqual({ kurz: 'Unbekannt', voll: 'Unbekannt' })
  })
})
