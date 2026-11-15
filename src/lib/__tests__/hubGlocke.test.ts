import { describe, it, expect } from 'vitest'
import {
  GLOCKE_GEMERKT_MAX, amHub, autoGezeigtLesen, autoGezeigtMerken, autoSchluessel, glockeAbzeichen, glockeAnzahl, glockeLabel, mitteilungAutomatisch,
} from '../hubGlocke'

const zeilen = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `z${i}` }))
const MITTEILUNG = { id: 'mitt0000000001', title: 'Dienstplan Dezember', message: 'Bitte bis Freitag eintragen.' }

describe('glockeAnzahl', () => {
  it('zählt Zeilen der Neuigkeiten', () => {
    expect(glockeAnzahl(zeilen(0), null)).toBe(0)
    expect(glockeAnzahl(zeilen(3), null)).toBe(3)
  })
  it('eine ungelesene Mitteilung zählt eins dazu', () => {
    expect(glockeAnzahl(zeilen(2), MITTEILUNG)).toBe(3)
    expect(glockeAnzahl([], MITTEILUNG)).toBe(1)
  })
  it('laden die Neuigkeiten noch (null), zählt nur die Mitteilung', () => {
    expect(glockeAnzahl(null, null)).toBe(0)
    expect(glockeAnzahl(undefined, MITTEILUNG)).toBe(1)
  })
  it('keine Mitteilung: null, undefined, leer', () => {
    for (const m of [null, undefined, false, '']) expect(glockeAnzahl(zeilen(1), m)).toBe(1)
  })
})

describe('glockeAbzeichen', () => {
  it('nichts bei 0 und bei Unsinn', () => {
    for (const n of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) expect(glockeAbzeichen(n), String(n)).toBeNull()
  })
  it('1 bis 9 als Zahl', () => {
    expect(glockeAbzeichen(1)).toBe('1')
    expect(glockeAbzeichen(9)).toBe('9')
  })
  it('über 9 steht 9+', () => {
    expect(glockeAbzeichen(10)).toBe('9+')
    expect(glockeAbzeichen(250)).toBe('9+')
  })
  it('Bruchzahlen werden abgerundet', () => {
    expect(glockeAbzeichen(2.7)).toBe('2')
    expect(glockeAbzeichen(0.4)).toBeNull()
  })
})

describe('glockeLabel', () => {
  it('nennt die genaue Zahl', () => {
    expect(glockeLabel(1)).toBe('Neuigkeiten, 1 neu')
    expect(glockeLabel(2)).toBe('Neuigkeiten, 2 neu')
    expect(glockeLabel(12)).toBe('Neuigkeiten, 12 neu')
  })
  it('ohne Neues', () => {
    expect(glockeLabel(0)).toBe('Neuigkeiten, nichts Neues')
    expect(glockeLabel(-3)).toBe('Neuigkeiten, nichts Neues')
    expect(glockeLabel(Number.NaN)).toBe('Neuigkeiten, nichts Neues')
  })
})

describe('autoGezeigtLesen und autoGezeigtMerken', () => {
  it('nichts oder Unlesbares ergibt eine leere Liste', () => {
    for (const roh of [null, undefined, '', 'kaputt{', '42', '"abc"', '{"a":1}', 'null']) expect(autoGezeigtLesen(roh), String(roh)).toEqual([])
  })
  it('liest Texte, ohne Dubletten, ohne Leeres und zu Langes', () => {
    expect(autoGezeigtLesen(JSON.stringify(['a', 'b', 'a', '', 3, null, 'x'.repeat(81), 'c']))).toEqual(['a', 'b', 'c'])
  })
  it('höchstens die neuesten GLOCKE_GEMERKT_MAX', () => {
    const viele = Array.from({ length: GLOCKE_GEMERKT_MAX + 5 }, (_, i) => `m${i}`)
    const gelesen = autoGezeigtLesen(JSON.stringify(viele))
    expect(gelesen).toHaveLength(GLOCKE_GEMERKT_MAX)
    expect(gelesen[gelesen.length - 1]).toBe(`m${GLOCKE_GEMERKT_MAX + 4}`)
  })
  it('merken hängt hinten an, ohne Dublette, und kürzt vorn', () => {
    expect(autoGezeigtMerken([], 'a')).toEqual(['a'])
    expect(autoGezeigtMerken(['a', 'b'], 'a')).toEqual(['b', 'a'])
    expect(autoGezeigtMerken(['a'], '')).toEqual(['a'])
    const voll = Array.from({ length: GLOCKE_GEMERKT_MAX }, (_, i) => `m${i}`)
    const neu = autoGezeigtMerken(voll, 'neu')
    expect(neu).toHaveLength(GLOCKE_GEMERKT_MAX)
    expect(neu[0]).toBe('m1')
    expect(neu[neu.length - 1]).toBe('neu')
  })
  it('liest zurück, was es gemerkt hat', () => {
    expect(autoGezeigtLesen(JSON.stringify(autoGezeigtMerken(['a'], 'b')))).toEqual(['a', 'b'])
  })
})

describe('autoSchluessel', () => {
  it('Benutzer und Mitteilung', () => {
    expect(autoSchluessel('nutzer000000001', 'mitt0000000001')).toBe('nutzer000000001/mitt0000000001')
    expect(autoSchluessel(null, 'mitt0000000001')).toBe('-/mitt0000000001')
  })
  it('ohne Mitteilung nichts', () => {
    expect(autoSchluessel('nutzer000000001', null)).toBe('')
    expect(autoSchluessel('nutzer000000001', '')).toBe('')
  })
  it('passt in den Speicher (PocketBase-IDs, 15 Zeichen)', () => {
    const k = autoSchluessel('a'.repeat(15), 'b'.repeat(15))
    expect(autoGezeigtLesen(JSON.stringify(autoGezeigtMerken([], k)))).toEqual([k])
  })
})

describe('mitteilungAutomatisch', () => {
  const U = 'nutzer000000001'
  it('geht einmal auf, wenn eine Mitteilung da ist und nichts im Weg', () => {
    expect(mitteilungAutomatisch({ nutzerId: U, mitteilungId: 'm1', bereit: true, schonGezeigt: [] })).toBe(true)
  })
  it('nicht ohne Mitteilung (Neuigkeiten allein öffnen nie)', () => {
    for (const id of [null, undefined, '']) expect(mitteilungAutomatisch({ nutzerId: U, mitteilungId: id, bereit: true, schonGezeigt: [] })).toBe(false)
  })
  it('nicht, solange etwas im Weg ist', () => {
    expect(mitteilungAutomatisch({ nutzerId: U, mitteilungId: 'm1', bereit: false, schonGezeigt: [] })).toBe(false)
  })
  it('nicht ein zweites Mal für dieselbe Mitteilung, wohl aber für eine neue', () => {
    const gezeigt = autoGezeigtMerken([], autoSchluessel(U, 'm1'))
    expect(mitteilungAutomatisch({ nutzerId: U, mitteilungId: 'm1', bereit: true, schonGezeigt: gezeigt })).toBe(false)
    expect(mitteilungAutomatisch({ nutzerId: U, mitteilungId: 'm2', bereit: true, schonGezeigt: gezeigt })).toBe(true)
  })
  it('ein anderer Benutzer im selben Fenster bekommt sie trotzdem', () => {
    const gezeigt = autoGezeigtMerken([], autoSchluessel(U, 'm1'))
    expect(mitteilungAutomatisch({ nutzerId: 'nutzer000000002', mitteilungId: 'm1', bereit: true, schonGezeigt: gezeigt })).toBe(true)
  })
})

describe('amHub', () => {
  it('der Hub selbst', () => {
    expect(amHub('/hub', '')).toBe(true)
    expect(amHub('/hub/', '')).toBe(true)
    expect(amHub('/hub', '?x=1')).toBe(true)
  })
  it('nicht in „Apps anpassen“', () => {
    expect(amHub('/hub', '?seite=apps')).toBe(false)
    expect(amHub('/hub', 'seite=apps')).toBe(false)
    expect(amHub('/hub', '?a=1&seite=apps')).toBe(false)
  })
  it('nicht, wenn schon eine andere Seite lädt (der Hub nur verdeckt)', () => {
    for (const p of ['/patienten', '/unitarii', '/settings', '/', '/hubx', '/hub/apps', '', null, undefined]) expect(amHub(p, ''), String(p)).toBe(false)
  })
})
