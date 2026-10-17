import { describe, it, expect } from 'vitest'
import { ablaufStatus, entnahmeReihenfolge, fefo, fehltAmStandort, gefuehrteArtikel, inventurBasis, inventurDifferenz, journalSummen, summe, tageBisMhd, unterSoll, wirklichAusgegeben, type JournalZeile } from '../lagerRechnung'

const z = (id: string, expiry_date: string | null, quantity = 1, created = '2026-01-01 00:00:00.000Z') => ({ id, expiry_date, quantity, created })

describe('Lager: Entnahme-Reihenfolge (zuerst ablaufend zuerst)', () => {
  it('früheste MHD zuerst, Ware ohne MHD zuletzt — PocketBase liefert leere Daten vorn', () => {
    // So kommt es von PocketBase (sort: expiry_date): leere zuerst
    const vonPocketBase = [z('ohne', ''), z('null', null), z('maerz', '2027-03-31'), z('jan', '2027-01-31')]
    expect(fefo(vonPocketBase).map(x => x.id)).toEqual(['jan', 'maerz', 'ohne', 'null'])
  })

  it('bei gleichem MHD die ältere Bestandszeile zuerst; unlesbares Datum wie ohne MHD', () => {
    const zeilen = [z('neu', '2027-01-31', 1, '2026-05-01'), z('kaputt', 'irgendwann'), z('alt', '2027-01-31', 1, '2026-02-01')]
    expect(fefo(zeilen).map(x => x.id)).toEqual(['alt', 'neu', 'kaputt'])
  })

  it('ändert die übergebene Liste nicht', () => {
    const zeilen = [z('b', '2027-02-01'), z('a', '2027-01-01')]
    fefo(zeilen)
    expect(zeilen.map(x => x.id)).toEqual(['b', 'a'])
  })

  it('eine gescannte Charge geht vor, der Rest nach Ablauf', () => {
    const zeilen = [z('ohne', null), z('spaet', '2028-01-01'), z('frueh', '2027-01-01')]
    expect(entnahmeReihenfolge(zeilen, 'spaet').map(x => x.id)).toEqual(['spaet', 'frueh', 'ohne'])
    expect(entnahmeReihenfolge(zeilen).map(x => x.id)).toEqual(['frueh', 'spaet', 'ohne'])
    expect(entnahmeReihenfolge(zeilen, 'gibtsnicht').map(x => x.id)).toEqual(['frueh', 'spaet', 'ohne'])
  })
})

describe('Lager: Ablauf und Soll getrennt', () => {
  const jetzt = new Date('2026-10-15T12:00:00Z')

  it('abgelaufen, läuft bald ab (unter 30 Tagen), in Ordnung, ohne MHD', () => {
    expect(ablaufStatus('2026-10-14', jetzt)).toBe('exp')
    expect(ablaufStatus('2026-10-20', jetzt)).toBe('warn')
    expect(ablaufStatus('2026-11-13', jetzt)).toBe('warn')
    expect(ablaufStatus('2026-11-20', jetzt)).toBe('ok')
    expect(ablaufStatus('', jetzt)).toBe('ok')
    expect(ablaufStatus(null, jetzt)).toBe('ok')
  })

  it('MHD heute ist noch verwendbar — auch abends; gestern ist abgelaufen', () => {
    const abends = new Date(2026, 9, 15, 22, 30)
    expect(tageBisMhd('2026-10-15 00:00:00.000Z', abends)).toBe(0)
    expect(ablaufStatus('2026-10-15 00:00:00.000Z', abends)).toBe('warn')
    expect(ablaufStatus('2026-10-14 00:00:00.000Z', abends)).toBe('exp')
    expect(tageBisMhd('2026-11-14', abends)).toBe(30)
    expect(ablaufStatus('2026-11-14', abends)).toBe('ok')
    expect(tageBisMhd(null, abends)).toBeNull()
  })

  it('unter Soll — auch das leere Fach; ohne Soll nie', () => {
    expect(unterSoll(0, 5)).toBe(true)
    expect(unterSoll(4, 5)).toBe(true)
    expect(unterSoll(5, 5)).toBe(false)
    expect(unterSoll(0, 0)).toBe(false)
    expect(unterSoll(0, undefined)).toBe(false)
  })

  it('summiert Bestandszeilen, fehlende Mengen als 0', () => {
    expect(summe([z('a', null, 3), z('b', null, 2), { id: 'c' }])).toBe(5)
  })
})

describe('Lager: Inventur, auch wenn währenddessen gebucht wird', () => {
  it('seit dem Start nichts gebucht: eindeutig', () => {
    expect(inventurDifferenz(7, 10, 10)).toBe(-3)
    expect(inventurDifferenz(12, 10, 10)).toBe(2)
    expect(inventurDifferenz(10, 10, 10)).toBe(0)
  })

  it('seitdem gebucht und nicht bekannt, wann gezählt wurde: nachfragen statt raten', () => {
    expect(inventurDifferenz(9, 10, 8)).toBeNull()
    expect(inventurDifferenz(10, 10, 8)).toBeNull()
  })

  it('vor den Buchungen gezählt: 9 statt 10 gezählt, danach 2 entnommen → im Regal 7', () => {
    const diff = inventurDifferenz(9, 10, 8, 'vorher')!
    expect(diff).toBe(-1)
    expect(8 + diff).toBe(7)
    expect(inventurBasis(10, 8, 'vorher')).toBe(10)
    expect(9 - inventurBasis(10, 8, 'vorher')).toBe(diff)
  })

  it('nach den Buchungen gezählt: 2 entnommen (jetzt 8), dann 7 gezählt → 1 fehlt, nicht 3', () => {
    const diff = inventurDifferenz(7, 10, 8, 'nachher')!
    expect(diff).toBe(-1)
    expect(8 + diff).toBe(7)
    expect(7 - inventurBasis(10, 8, 'nachher')).toBe(diff)
  })
})

describe('Lager: Datum wie von PocketBase, unabhängig vom Datums-Parser', () => {
  it('Leerzeichen-Form wird gelesen', () => {
    const jetzt = new Date(2026, 9, 15, 9, 0)
    expect(tageBisMhd('2026-10-20 00:00:00.000Z', jetzt)).toBe(5)
    expect(fefo([z('b', '2027-02-01 00:00:00.000Z'), z('a', '2027-01-01 00:00:00.000Z'), z('o', null)]).map(x => x.id)).toEqual(['a', 'b', 'o'])
  })
})

describe('Lager: fehlt am Standort', () => {
  it('leeres Fach zählt nur, wo der Artikel geführt wird', () => {
    expect(fehltAmStandort(0, 5, true)).toBe(true)
    expect(fehltAmStandort(0, 5, false)).toBe(false)   // Lagerartikel, der auf diesem RTW nie mitfährt
    expect(fehltAmStandort(2, 5, false)).toBe(true)    // Bestand da → wird hier geführt
    expect(fehltAmStandort(5, 5, true)).toBe(false)
    expect(fehltAmStandort(0, 0, true)).toBe(false)
  })
})

describe('Lager: Journal mit Gegenbuchungen auswerten', () => {
  const t = (type: string, quantity: number, note = '', extra: Partial<JournalZeile> = {}): JournalZeile =>
    ({ item_id: 'hand', type, quantity, note, created: '2026-10-05 10:00:00.000Z', ...extra })

  it('„Rückgängig“ gleicht Verbrauch und Zugang aus, Umlagerungen zählen nicht', () => {
    const s = journalSummen([
      t('ausbuchung', -3, 'Charge A'),
      t('ausbuchung', 3, 'Rückgängig · Charge A'),
      t('ausbuchung', -2),
      t('einbuchung', 10),
      t('einbuchung', -10, 'Rückgängig'),
      t('einbuchung', 4),
      t('ausbuchung', -5, 'Umlagerung → Lager'),
      t('einbuchung', 5, 'Umlagerung ← RTW'),
      t('ausbuchung', 5, 'Rückgängig · Umlagerung → Lager'),
      t('korrektur', -7, 'Inventur-Korrektur'),
    ])
    expect([s.ein, s.aus, s.ausJeArtikel.hand]).toEqual([4, 2, 2])
    expect(s.jeMonat['2026-10']).toEqual({ ein: 4, aus: 2 })
  })

  it('Rückruf-Suche: zurückgenommene Ausgaben fallen heraus, andere bleiben', () => {
    const zeilen = [
      t('ausbuchung', -2, 'Charge L1 · Einsatz 1', { id: 'a', stock_id: 's1', batch: 'L1', created: '2026-10-01' }),
      t('ausbuchung', -2, 'Charge L1 · Einsatz 2', { id: 'b', stock_id: 's1', batch: 'L1', created: '2026-10-02' }),
      t('ausbuchung', 2, 'Rückgängig · Charge L1 · Einsatz 2', { id: 'c', stock_id: 's1', batch: 'L1', created: '2026-10-02 00:00:05' }),
      t('ausbuchung', -1, 'Charge L1', { id: 'd', stock_id: 's2', batch: 'L1', created: '2026-10-03' }),
    ]
    expect(wirklichAusgegeben(zeilen).map(x => x.id)).toEqual(['a', 'd'])
  })
})

describe('Lager: Rückruf-Suche ordnet Rücknahmen der richtigen Person zu', () => {
  const t = (id: string, created: string, quantity: number, user: string, note: string, extra: Partial<JournalZeile> = {}): JournalZeile =>
    ({ id, item_id: 'hand', type: 'ausbuchung', quantity, note, created, stock_id: 's1', batch: 'B7', user, ...extra })

  it('ohne storno_von: die Rücknahme von A hebt A auf, nicht B mit gleicher Notiz', () => {
    const zeilen = [
      t('a', '2026-10-16 10:00:00', -1, 'anna@x.de', 'Charge B7'),
      t('b', '2026-10-16 10:00:04', -1, 'ben@x.de', 'Charge B7'),
      t('r', '2026-10-16 10:00:08', 1, 'anna@x.de', 'Rückgängig · Charge B7'),
    ]
    expect(wirklichAusgegeben(zeilen).map(x => x.id)).toEqual(['b'])
  })

  it('mit storno_von gilt das Feld, nicht die Zeitnähe', () => {
    const zeilen = [
      t('a', '2026-10-16 10:00:00', -1, 'anna@x.de', 'Charge B7'),
      t('b', '2026-10-16 10:00:04', -1, 'anna@x.de', 'Charge B7'),
      t('r', '2026-10-16 10:00:08', 1, 'anna@x.de', 'Rückgängig · Charge B7', { storno_von: 'a' }),
    ]
    expect(wirklichAusgegeben(zeilen).map(x => x.id)).toEqual(['b'])
  })

  it('Rücknahme einer anderen Person hebt nichts auf', () => {
    const zeilen = [
      t('a', '2026-10-16 10:00:00', -1, 'anna@x.de', 'Charge B7'),
      t('r', '2026-10-16 10:00:08', 1, 'ben@x.de', 'Rückgängig · Charge B7'),
    ]
    expect(wirklichAusgegeben(zeilen).map(x => x.id)).toEqual(['a'])
  })
})

describe('Lager: geführt nur mit Buchung, die nicht zurückgenommen wurde', () => {
  it('Fehlbuchung + Rückgängig → nicht geführt; echte Entnahme → geführt', () => {
    const g = gefuehrteArtikel([
      { item_id: 'larynx', note: '' },
      { item_id: 'larynx', note: 'Rückgängig' },
      { item_id: 'beutel', note: 'Charge B1' },
      { item_id: 'filter', note: 'Charge F' },
      { item_id: 'filter', note: 'Charge F', storno_von: 'x' },
      { item_id: 'filter', note: 'Charge F' },
    ])
    expect([...g].sort()).toEqual(['beutel', 'filter'])
  })
})

describe('Lager: Abschreibung beim Archivieren ist kein Verbrauch', () => {
  it('„Archiviert“ und seine Rücknahme zählen nicht', () => {
    const s = journalSummen([
      { item_id: 'a', type: 'ausbuchung', quantity: -800, note: 'Archiviert · Charge X', created: '2026-10-05' },
      { item_id: 'a', type: 'ausbuchung', quantity: 800, note: 'Rückgängig · Archiviert · Charge X', created: '2026-10-05' },
      { item_id: 'a', type: 'ausbuchung', quantity: -2, note: 'Charge X', created: '2026-10-05' },
    ])
    expect([s.aus, s.ausJeArtikel.a]).toEqual([2, 2])
  })
})
