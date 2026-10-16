import { describe, it, expect, beforeEach } from 'vitest'
import {
  BuchungsFehler, _zuruecksetzen, buche, macheRueckgaengig, planeBuchung,
  type Anfrage, type Bestandszeile, type Server,
} from '../lagerBuchung'

const WER = { organization_id: 'org1', user: 'anna@example.com' }
let zaehler = 0
const id = () => `id${String(++zaehler).padStart(13, '0')}`

const zeile = (zid: string, quantity: number, expiry_date: string | null, batch: string | null = null, item_id = 'hand', location_id = 'rtw1'): Bestandszeile =>
  ({ id: zid, item_id, location_id, quantity, expiry_date, batch, created: '2026-01-01' })

/**
 * Nachbau des Verhaltens von PocketBase, soweit der Buchungsweg es braucht:
 * Batch alles-oder-nichts, quantity mit min 0, eindeutige IDs, Modifikatoren.
 */
class FakeServer implements Server {
  stock = new Map<string, Bestandszeile>()
  tx = new Map<string, Record<string, any>>()
  batchAus = false
  /** Netz bricht ab, NACHDEM der Server gebucht hat (Antwort geht verloren). */
  antwortVerloren = 0
  /** Netz bricht ab, bevor etwas ankommt. */
  netzWeg = false
  /** Vor dem nächsten Senden: anderes Gerät ändert den Bestand. */
  vorDemSenden: (() => void) | null = null
  /** Einzelanfrage Nummer n (ohne Batch) wird abgelehnt. */
  ablehnenBeiEinzel = -1
  /** Einzelanfrage Nummer n wird ausgeführt, die Antwort geht aber verloren. */
  antwortVerlorenBeiEinzel = -1
  einzelGesendet = 0
  batches = 0

  constructor(zeilen: Bestandszeile[]) { for (const z of zeilen) this.stock.set(z.id, { ...z }) }

  private netz() { if (this.netzWeg) throw { status: 0, message: 'Failed to fetch' } }

  private anwenden(a: Anfrage): any {
    const tab: Map<string, any> = a.collection === 'inventory_stock' ? this.stock : this.tx
    if (a.aktion === 'create') {
      if (tab.has(a.id)) throw { status: 400, response: { status: 400, message: 'Failed to create record.', data: { id: { code: 'validation_not_unique' } } } }
      const rec = { ...a.body }
      tab.set(a.id, rec)
      return { ...rec }
    }
    const rec = tab.get(a.id)
    if (!rec) throw { status: 404, response: { status: 404, message: 'Not found', data: {} } }
    const neu = { ...rec }
    for (const [k, v] of Object.entries(a.body)) {
      if (k.endsWith('-')) neu[k.slice(0, -1)] -= v as number
      else if (k.endsWith('+')) neu[k.slice(0, -1)] += v as number
      else neu[k] = v
    }
    if (a.collection === 'inventory_stock' && neu.quantity < 0) {
      throw { status: 400, response: { status: 400, message: 'Failed to update record.', data: { quantity: { code: 'validation_min_number_constraint' } } } }
    }
    tab.set(a.id, neu)
    return { ...neu }
  }

  async ladeBestand(paare: { item_id: string; location_id: string }[]) {
    this.netz()
    return [...this.stock.values()].filter(z => paare.some(p => p.item_id === z.item_id && p.location_id === z.location_id)).map(z => ({ ...z }))
  }
  async gibtEs(collection: string, gid: string) {
    this.netz()
    return (collection === 'inventory_stock' ? this.stock : this.tx).has(gid)
  }
  async sendeBatch(anfragen: Anfrage[]) {
    this.netz()
    if (this.batchAus) throw { status: 403, message: 'Batch requests are not allowed.', response: { message: 'Batch requests are not allowed.', data: {} } }
    this.vorDemSenden?.(); this.vorDemSenden = null
    const sicherung = { stock: new Map([...this.stock].map(([k, v]) => [k, { ...v }])), tx: new Map([...this.tx].map(([k, v]) => [k, { ...v }])) }
    const antworten: any[] = []
    for (let i = 0; i < anfragen.length; i++) {
      try { antworten.push(this.anwenden(anfragen[i])) } catch (e: any) {
        this.stock = sicherung.stock; this.tx = sicherung.tx
        throw { status: 400, response: { status: 400, message: 'Batch transaction failed.', data: { requests: { [i]: { code: 'batch_request_failed', response: e.response } } } } }
      }
    }
    this.batches++
    if (this.antwortVerloren > 0) { this.antwortVerloren--; throw { status: 0, message: 'Failed to fetch' } }
    return antworten
  }
  async sende(a: Anfrage) {
    this.netz()
    this.vorDemSenden?.(); this.vorDemSenden = null
    const nr = this.einzelGesendet++
    if (nr === this.ablehnenBeiEinzel) throw { status: 400, response: { status: 400, message: 'Failed', data: { quantity: { code: 'validation_invalid_value' } } } }
    const antwort = this.anwenden(a)
    if (nr === this.antwortVerlorenBeiEinzel) throw { status: 0, message: 'Failed to fetch' }
    return antwort
  }
  async loesche(collection: string, gid: string) {
    this.netz()
    ;(collection === 'inventory_stock' ? this.stock : this.tx).delete(gid)
  }

  menge(item = 'hand', loc = 'rtw1') { return [...this.stock.values()].filter(z => z.item_id === item && z.location_id === loc).reduce((s, z) => s + z.quantity, 0) }
  journal(item = 'hand', loc = 'rtw1') { return [...this.tx.values()].filter(t => t.item_id === item && t.location_id === loc).reduce((s, t) => s + t.quantity, 0) }
}

const bestand = () => [
  zeile('ohne', 3, null, 'OHNE'),            // PocketBase liefert sie zuerst
  zeile('bald', 2, '2026-11-01', 'BALD'),
  zeile('spaet', 4, '2027-06-01', 'SPAET'),
]

beforeEach(() => { _zuruecksetzen(); zaehler = 0 })

describe('Lager-Buchung planen', () => {
  it('Entnahme: zuerst ablaufend zuerst, je Charge eine Journalzeile, Client-ID-Zeile zuletzt', () => {
    const plan = planeBuchung([{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3, einsatz: 'E-12' }], bestand(), WER, 'client000000001', { neueId: id })
    expect(plan.anfragen.filter(a => a.collection === 'inventory_stock').map(a => [a.id, a.body])).toEqual([
      ['bald', { 'quantity-': 2 }],
      ['spaet', { 'quantity-': 1 }],
    ])
    expect(plan.posten.map(p => [p.stock_id, p.menge, p.notiz])).toEqual([
      ['bald', -2, 'Charge BALD · Einsatz E-12'],
      ['spaet', -1, 'Charge SPAET · Einsatz E-12'],
    ])
    expect(plan.posten[0].tx_id).toBe('client000000001')
    expect(plan.anfragen[plan.anfragen.length - 1].id).toBe('client000000001')
    expect(plan.anfragen.every(a => a.collection !== 'inventory_stock' || !('quantity' in a.body))).toBe(true)
  })

  it('mehr als vorhanden: abgelehnt — oder, wenn es physisch schon weg ist, ehrlich ohne Charge protokolliert', () => {
    expect(() => planeBuchung([{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 10 }], bestand(), WER, 'c', { neueId: id }))
      .toThrow(/vorhanden 9/)
    const plan = planeBuchung([{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 10, notiz: 'offline erfasst' }], bestand(), WER, 'c', { neueId: id, ueberzug: 'protokollieren' })
    expect(plan.ohneBestand).toBe(1)
    expect(plan.posten.map(p => p.menge)).toEqual([-2, -4, -3, -1])
    expect(plan.posten[3].stock_id).toBeUndefined()
    expect(plan.posten[3].notiz).toBe('offline erfasst · ohne Chargenzuordnung')
  })

  it('Zugang legt eine Bestandszeile mit eigener ID an, das Journal verweist darauf', () => {
    const plan = planeBuchung([{ art: 'zugang', item_id: 'hand', location_id: 'rtw1', menge: 5, batch: ' L42 ', expiry: '2027-01-31' }], [], WER, 'c', { neueId: id })
    const neu = plan.anfragen.find(a => a.collection === 'inventory_stock')!
    expect(neu).toMatchObject({ aktion: 'create', body: { quantity: 5, batch: 'L42', expiry_date: '2027-01-31', organization_id: 'org1' } })
    expect(neu.body.id).toBe(neu.id)
    expect(plan.posten[0]).toMatchObject({ stock_id: neu.id, menge: 5, typ: 'einbuchung', notiz: 'Charge L42' })
  })

  it('derselbe Artikel zweimal in einer Buchung: der Bestand wird nicht doppelt verplant', () => {
    expect(() => planeBuchung([
      { art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 6 },
      { art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 4 },
    ], bestand(), WER, 'c', { neueId: id })).toThrow(/vorhanden 0|Kein Bestand|vorhanden 3/)
  })

  it('Inventur-Korrektur als eine Sammelzeile, gewählte Charge benannt', () => {
    const plan = planeBuchung([{ art: 'abgang', typ: 'korrektur', sammel: true, item_id: 'hand', location_id: 'rtw1', menge: 3, bevorzugt: 'bald', notiz: 'Inventur-Korrektur: 9 → 6' }], bestand(), WER, 'c', { neueId: id })
    expect(plan.posten).toHaveLength(1)
    expect(plan.posten[0]).toMatchObject({ typ: 'korrektur', menge: -3, notiz: 'Inventur-Korrektur: 9 → 6 · 2 aus Charge BALD, Rest aus weiteren' })
    expect(plan.rueckgaengigMoeglich).toBe(false)
  })

  it('Umlagerung: Charge und MHD wandern mit, beide Seiten im Journal, Notiz beginnt mit „Umlagerung“', () => {
    const plan = planeBuchung([{ art: 'umlagerung', item_id: 'hand', von: 'rtw1', nach: 'lager', menge: 3, vonName: 'RTW 1', nachName: 'Hauptlager' }], bestand(), WER, 'c', { neueId: id })
    expect(plan.posten.map(p => [p.location_id, p.menge, p.batch, p.notiz])).toEqual([
      ['rtw1', -2, 'BALD', 'Umlagerung → Hauptlager · Charge BALD'],
      ['lager', 2, 'BALD', 'Umlagerung ← RTW 1 · Charge BALD'],
      ['rtw1', -1, 'SPAET', 'Umlagerung → Hauptlager · Charge SPAET'],
      ['lager', 1, 'SPAET', 'Umlagerung ← RTW 1 · Charge SPAET'],
    ])
    expect(plan.anfragen.filter(a => a.aktion === 'create' && a.collection === 'inventory_stock').map(a => a.body.expiry_date)).toEqual(['2026-11-01', '2027-06-01'])
    expect(() => planeBuchung([{ art: 'umlagerung', item_id: 'hand', von: 'rtw1', nach: 'lager', menge: 20, vonName: 'a', nachName: 'b' }], bestand(), WER, 'c', { neueId: id, ueberzug: 'protokollieren' }))
      .toThrow(BuchungsFehler)
  })
})

describe('Lager-Buchung ausführen', () => {
  it('bucht Bestand und Journal gemeinsam; leere Zeilen werden entfernt', async () => {
    const s = new FakeServer(bestand())
    const e = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3 }], { wer: WER })
    expect(s.menge()).toBe(6)
    expect(s.journal()).toBe(-3)
    expect(s.stock.has('bald')).toBe(false)     // auf 0 → entfernt
    expect(s.stock.get('spaet')!.quantity).toBe(3)
    expect(e.posten).toHaveLength(2)
  })

  it('genau einmal: Antwort verloren → Warteschlange → beim Nachholen erkannt, nicht doppelt', async () => {
    const s = new FakeServer(bestand())
    s.antwortVerloren = 1
    const fehler = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 2 }], { wer: WER, clientId: 'client000000001' }).catch(e => e)
    expect(fehler).toBeInstanceOf(BuchungsFehler)
    expect(fehler).toMatchObject({ art: 'netz', vielleichtGebucht: true })
    expect(s.menge()).toBe(7)                     // der Server HAT gebucht
    const nochmal = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 2 }], { wer: WER, clientId: 'client000000001', pruefeVorher: true })
    expect(nochmal.schonGebucht).toBe(true)
    expect(s.menge()).toBe(7)
    expect(s.journal()).toBe(-2)
  })

  it('genau einmal auch ohne Vorab-Prüfung: die doppelte Client-ID lässt die ganze Wiederholung abprallen', async () => {
    const s = new FakeServer(bestand())
    await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 2 }], { wer: WER, clientId: 'client000000001' })
    const zweit = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 2 }], { wer: WER, clientId: 'client000000001' })
    expect(zweit.schonGebucht).toBe(true)
    expect(s.menge()).toBe(7)
    expect(s.journal()).toBe(-2)
  })

  it('ohne Netz: klarer Fehler, nichts gebucht, nicht „vielleicht“', async () => {
    const s = new FakeServer(bestand())
    s.netzWeg = true
    const f = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1 }], { wer: WER }).catch(e => e)
    expect(f).toMatchObject({ art: 'netz', vielleichtGebucht: false })
  })

  it('zwei schnelle Tipps laufen nacheinander und überschreiben sich nicht', async () => {
    const s = new FakeServer([zeile('a', 2, '2027-01-01')])
    const [x, y, z] = await Promise.allSettled([
      buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1 }], { wer: WER }),
      buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1 }], { wer: WER }),
      buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1 }], { wer: WER }),
    ])
    expect([x.status, y.status, z.status]).toEqual(['fulfilled', 'fulfilled', 'rejected'])
    expect((z as PromiseRejectedResult).reason).toMatchObject({ art: 'bestand' })
    expect(s.menge()).toBe(0)
    expect(s.journal()).toBe(-2)
  })

  it('anderes Gerät entnimmt zwischen Lesen und Buchen: neu geplant statt ins Minus', async () => {
    const s = new FakeServer(bestand())
    s.vorDemSenden = () => { s.stock.get('bald')!.quantity = 0 }
    await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 2 }], { wer: WER })
    expect(s.stock.get('spaet')!.quantity).toBe(2)
    expect([...s.tx.values()].map(t => t.batch)).toEqual(['SPAET'])
  })

  it('Batch in PocketBase ausgeschaltet: einzeln gebucht, Client-ID-Zeile zuletzt', async () => {
    const s = new FakeServer(bestand())
    s.batchAus = true
    const e = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3 }], { wer: WER })
    expect(s.menge()).toBe(6)
    expect(s.journal()).toBe(-3)
    expect(s.einzelGesendet).toBe(4)
    expect(e.schonGebucht).toBeUndefined()
  })

  it('einzeln und mittendrin abgelehnt: der schon geänderte Bestand wird zurückgenommen', async () => {
    const s = new FakeServer(bestand())
    s.batchAus = true
    s.ablehnenBeiEinzel = 2             // nach zwei Bestands-Abzügen
    const f = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3 }], { wer: WER }).catch(e => e)
    expect(f).toMatchObject({ art: 'abgelehnt' })
    expect(s.menge()).toBe(9)
    expect(s.journal()).toBe(0)
  })

  it('Produktausgabe: Status der Ausgabe steht oder fällt mit der Buchung', async () => {
    const s = new FakeServer(bestand())
    const zusatz: Anfrage[] = [{ collection: 'inventory_transactions', aktion: 'update', id: 'gibtsnicht00000', body: { status: 'erledigt' } }]
    const f = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1 }], { wer: WER, zusatz }).catch(e => e)
    expect(f).toBeInstanceOf(BuchungsFehler)
    expect(s.menge()).toBe(9)
  })
})

describe('Lager: Rückgängig als Gegenbuchung', () => {
  it('Entnahme zurück: in dieselben Zeilen, auch eine schon entfernte wird mit gleicher ID neu angelegt', async () => {
    const s = new FakeServer(bestand())
    const e = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3 }], { wer: WER })
    expect(s.stock.has('bald')).toBe(false)
    const r = await macheRueckgaengig(s, e, WER)
    expect(s.menge()).toBe(9)
    expect(s.stock.get('bald')).toMatchObject({ quantity: 2, batch: 'BALD', expiry_date: '2026-11-01' })
    expect(s.stock.get('spaet')!.quantity).toBe(4)
    // Journal gleicht sich aus: gleiche Art, umgekehrtes Vorzeichen, Verweis auf das Original
    const aus = [...s.tx.values()].filter(t => t.type === 'ausbuchung')
    expect(aus.reduce((x, t) => x + t.quantity, 0)).toBe(0)
    expect(aus.filter(t => t.quantity > 0).every(t => t.note.startsWith('Rückgängig') && t.storno_von)).toBe(true)
    expect(r.rueckgaengigMoeglich).toBe(false)
  })

  it('Einbuchung zurück, solange die Ware noch da ist — danach nicht mehr', async () => {
    const s = new FakeServer([])
    const e = await buche(s, [{ art: 'zugang', item_id: 'hand', location_id: 'rtw1', menge: 5, batch: 'L1' }], { wer: WER })
    const e2 = await buche(s, [{ art: 'zugang', item_id: 'hand', location_id: 'rtw1', menge: 2 }], { wer: WER })
    await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1, bevorzugt: e2.posten[0].stock_id }], { wer: WER })
    await expect(macheRueckgaengig(s, e2, WER)).rejects.toMatchObject({ art: 'bestand' })
    await macheRueckgaengig(s, e, WER)
    expect(s.menge()).toBe(1)
    expect(s.journal()).toBe(1)
  })

  it('Umlagerung zurück: Ziel geleert, Quelle wieder voll', async () => {
    const s = new FakeServer(bestand())
    const e = await buche(s, [{ art: 'umlagerung', item_id: 'hand', von: 'rtw1', nach: 'lager', menge: 3, vonName: 'RTW 1', nachName: 'Lager' }], { wer: WER })
    expect([s.menge(), s.menge('hand', 'lager')]).toEqual([6, 3])
    await macheRueckgaengig(s, e, WER)
    expect([s.menge(), s.menge('hand', 'lager')]).toEqual([9, 0])
  })
})

describe('Lager: Vorgangs-Nummer für das Logbuch', () => {
  it('alle Journalzeilen einer Buchung tragen dieselbe Vorgangs-Nummer (= Client-ID)', () => {
    const plan = planeBuchung([
      { art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3, einsatz: 'E-7' },
      { art: 'umlagerung', item_id: 'hand', von: 'rtw1', nach: 'lager', menge: 2, vonName: 'RTW 1', nachName: 'Lager' },
    ], bestand(), WER, 'vorgang00000001', { neueId: id })
    const journal = plan.anfragen.filter(a => a.collection === 'inventory_transactions')
    expect(journal.length).toBeGreaterThan(3)
    expect(journal.every(a => a.body.vorgang === 'vorgang00000001')).toBe(true)
  })

  it('die Rücknahme hat ihre eigene Vorgangs-Nummer, verweist aufs Original und behält den Einsatz', async () => {
    const s = new FakeServer(bestand())
    const e = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 2, einsatz: 'E-7' }], { wer: WER, clientId: 'original0000001' })
    await macheRueckgaengig(s, e, WER, 'ruecknahme00001')
    const gegen = [...s.tx.values()].filter(t => t.quantity > 0)
    expect(gegen).toHaveLength(1)
    expect(gegen[0]).toMatchObject({ vorgang: 'ruecknahme00001', storno_von: 'original0000001', einsatz: 'E-7', note: 'Rückgängig · Charge BALD · Einsatz E-7' })
  })
})

describe('Lager: gescannte Charge geht zuerst', () => {
  it('die Zeile mit der gescannten Chargen-Nr. wird zuerst entnommen, nicht die früher ablaufende', () => {
    const plan = planeBuchung([{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1, charge: { batch: 'spaet' } }], bestand(), WER, 'c', { neueId: id })
    expect(plan.posten.map(p => p.batch)).toEqual(['SPAET'])
  })

  it('bei gleicher Chargen-Nr. mit verschiedenem MHD entscheidet das MHD; unbekannte Charge → zuerst ablaufend', () => {
    const zeilen = [...bestand(), zeile('spaet2', 1, '2028-01-01', 'SPAET')]
    const a = planeBuchung([{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1, charge: { batch: 'SPAET', mhd: '2028-01-01' } }], zeilen, WER, 'c', { neueId: id })
    expect(a.posten[0].stock_id).toBe('spaet2')
    const b = planeBuchung([{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1, charge: { batch: 'GIBTSNICHT' } }], zeilen, WER, 'c', { neueId: id })
    expect(b.posten[0].stock_id).toBe('bald')
  })
})

describe('Lager: ohne Sammelbuchung (Batch aus) und Netzabbruch mittendrin', () => {
  it('meldet „teilweise“ — eine solche Buchung darf nicht automatisch wiederholt werden', async () => {
    const s = new FakeServer(bestand())
    s.batchAus = true
    s.antwortVerlorenBeiEinzel = 0          // erster Abzug kommt an, Antwort verloren
    const f = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3 }], { wer: WER, clientId: 'teilweise000001' }).catch(e => e)
    expect(f).toBeInstanceOf(BuchungsFehler)
    expect(f).toMatchObject({ art: 'netz', vielleichtGebucht: true, teilweise: true })
    expect(s.menge()).toBe(7)               // 2 von „bald“ sind schon weg …
    expect(s.journal()).toBe(0)             // … das Journal weiß davon nichts: Fall fürs Logbuch, nicht für eine Wiederholung
  })

  it('mit Sammelbuchung bleibt ein Abbruch „ganz oder gar nicht“ — Wiederholung ist sicher', async () => {
    const s = new FakeServer(bestand())
    s.antwortVerloren = 1
    const f = await buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 3 }], { wer: WER, clientId: 'ganz00000000001' }).catch(e => e)
    expect(f).toMatchObject({ art: 'netz', vielleichtGebucht: true, teilweise: false })
  })

  it('ohne Organisation oder Benutzer wird nichts gebucht', async () => {
    const s = new FakeServer(bestand())
    await expect(buche(s, [{ art: 'abgang', item_id: 'hand', location_id: 'rtw1', menge: 1 }], { wer: { organization_id: '', user: '' } })).rejects.toMatchObject({ art: 'abgelehnt' })
    expect(s.menge()).toBe(9)
  })
})
