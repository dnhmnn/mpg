import { describe, it, expect } from 'vitest'
import {
  zeitpunkt, pbZeit, neuesterVeroeffentlicht, hinweisZuZeigen, gesehenStand, textBloecke, hinweisPruefen,
  veroeffentlichenAenderung, zurueckziehenAenderung, hinweisStand, datumText, kurzDatum, kurzDatumZeit, standText,
  hinweisSchluessel, uhrVersatz, uhrWarnung, UHR_SPIELRAUM_MS, HINWEIS_TITEL_MAX, HINWEIS_TEXT_MAX, type Hinweis,
} from '../hinweise'

const H = (id: string, am: string | undefined, veroeffentlicht = true, titel = `Titel ${id}`): Hinweis =>
  ({ id, titel, veroeffentlicht, veroeffentlicht_am: am })

const NOV14 = '2026-11-14 08:00:00.000Z'
const NOV10 = '2026-11-10 08:00:00.000Z'
const NOV20 = '2026-11-20 08:00:00.000Z'

describe('Hinweise: Zeitpunkte', () => {
  it('PocketBase- und ISO-Format, sonst 0', () => {
    const ms = Date.UTC(2026, 10, 14, 8, 0, 0)
    expect(zeitpunkt(NOV14)).toBe(ms)
    expect(zeitpunkt('2026-11-14T08:00:00.000Z')).toBe(ms)
    expect(zeitpunkt('2026-11-14T09:00:00+01:00')).toBe(ms)
    expect(zeitpunkt('2026-11-14 08:00:00')).toBe(ms) // ohne Zone: UTC wie in PocketBase
    expect(zeitpunkt('2026-11-14')).toBe(Date.UTC(2026, 10, 14))
    expect(zeitpunkt('')).toBe(0)
    expect(zeitpunkt('   ')).toBe(0)
    expect(zeitpunkt('gestern')).toBe(0)
    expect(zeitpunkt('2026-13-45 99:99:99')).toBe(0)
    expect(zeitpunkt(ms)).toBe(0)
    expect(zeitpunkt(null)).toBe(0)
    expect(zeitpunkt(undefined)).toBe(0)
    expect(zeitpunkt({})).toBe(0)
  })
  it('pbZeit schreibt das PocketBase-Format, Rundreise gleich', () => {
    const ms = Date.UTC(2026, 10, 14, 8, 12, 0)
    expect(pbZeit(ms)).toBe('2026-11-14 08:12:00.000Z')
    expect(zeitpunkt(pbZeit(ms))).toBe(ms)
  })
  it('Schlüssel auf dem Gerät', () => {
    expect(hinweisSchluessel('abc123')).toBe('hinweis_gesehen_abc123')
  })
})

describe('Hinweise: welcher erscheint', () => {
  it('leer, nur Entwürfe, zurückgezogene, veröffentlicht ohne Datum → keiner', () => {
    expect(neuesterVeroeffentlicht([])).toBeNull()
    expect(hinweisZuZeigen([], {})).toBeNull()
    expect(hinweisZuZeigen([H('a', undefined, false)], {})).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14, false)], {})).toBeNull()
    expect(hinweisZuZeigen([H('a', undefined, true), H('b', '', true), H('c', 'unsinn', true)], {})).toBeNull()
    expect(neuesterVeroeffentlicht(null as unknown as Hinweis[])).toBeNull()
  })
  it('der neueste gewinnt, auch wenn ein älterer zuerst in der Liste steht', () => {
    expect(hinweisZuZeigen([H('a', NOV10), H('b', NOV20), H('c', NOV14)], {})?.id).toBe('b')
    // zurückgezogener neuerer zählt nicht
    expect(hinweisZuZeigen([H('a', NOV10), H('b', NOV20, false)], {})?.id).toBe('a')
  })
  it('Gleichstand: die größere id, unabhängig von der Reihenfolge', () => {
    expect(neuesterVeroeffentlicht([H('aaa', NOV14), H('bbb', NOV14)])?.id).toBe('bbb')
    expect(neuesterVeroeffentlicht([H('bbb', NOV14), H('aaa', NOV14)])?.id).toBe('bbb')
  })
  it('gesehen = Datum → keiner; gesehen früher → Hinweis; gesehen leer → Hinweis', () => {
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: NOV14 })).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: '2026-11-14T08:00:00Z' })).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: NOV10 })?.id).toBe('a')
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: '' })?.id).toBe('a')
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: null })?.id).toBe('a')
  })
  it('Gerät oder Konto: es gilt das spätere', () => {
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: '', lokal: NOV14 })).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: NOV20, lokal: NOV10 })).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14)], { gesehenAm: NOV10, lokal: 'kaputt' })?.id).toBe('a')
  })
  it('Konto nach dem Hinweis angelegt → keiner; davor → Hinweis; unbekannt → Hinweis', () => {
    expect(hinweisZuZeigen([H('a', NOV14)], { kontoAngelegt: '2026-11-15 10:00:00.000Z' })).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14)], { kontoAngelegt: NOV14 })).toBeNull()
    expect(hinweisZuZeigen([H('a', NOV14)], { kontoAngelegt: '2025-01-01 10:00:00.000Z' })?.id).toBe('a')
    expect(hinweisZuZeigen([H('a', NOV14)], { kontoAngelegt: undefined })?.id).toBe('a')
    expect(hinweisZuZeigen([H('a', NOV14)], { kontoAngelegt: '' })?.id).toBe('a')
  })
  it('ein älterer ungesehener und ein neuerer gesehener → keiner (nur der neueste zählt)', () => {
    expect(hinweisZuZeigen([H('alt', NOV10), H('neu', NOV20)], { gesehenAm: NOV20 })).toBeNull()
  })
  it('nach dem Bestätigen eines älteren erscheint der neuere', () => {
    expect(hinweisZuZeigen([H('alt', NOV10), H('neu', NOV20)], { gesehenAm: NOV10 })?.id).toBe('neu')
  })
  it('gesehenStand: Maximum aus Konto und Gerät, Ungültiges zählt nicht', () => {
    expect(gesehenStand(NOV10, NOV20)).toBe(NOV20)
    expect(gesehenStand(NOV20, NOV10)).toBe(NOV20)
    expect(gesehenStand('', NOV14, 'unsinn', 5, null)).toBe(NOV14)
    expect(gesehenStand('2026-11-14T08:00:00Z')).toBe(NOV14)
    expect(gesehenStand()).toBe('')
    expect(gesehenStand('', undefined, 'x')).toBe('')
  })
})

describe('Hinweise: Text in Absätze und Aufzählungen', () => {
  it('ein Absatz, leerer Text', () => {
    expect(textBloecke('Hallo zusammen')).toEqual([{ art: 'absatz', zeilen: ['Hallo zusammen'] }])
    expect(textBloecke('')).toEqual([])
    expect(textBloecke('   \n \n')).toEqual([])
    expect(textBloecke(undefined)).toEqual([])
    expect(textBloecke(42)).toEqual([])
  })
  it('zwei Absätze, auch mit Leerzeile aus Leerzeichen, mehrfache Leerzeilen, CRLF', () => {
    const zwei = [{ art: 'absatz', zeilen: ['Eins'] }, { art: 'absatz', zeilen: ['Zwei'] }]
    expect(textBloecke('Eins\n\nZwei')).toEqual(zwei)
    expect(textBloecke('Eins\n   \nZwei')).toEqual(zwei)
    expect(textBloecke('Eins\n\n\n\nZwei\n\n')).toEqual(zwei)
    expect(textBloecke('Eins\r\n\r\nZwei')).toEqual(zwei)
    expect(textBloecke('Eins\r\rZwei')).toEqual(zwei)
  })
  it('einzelne Zeilenumbrüche im Absatz bleiben Zeilen', () => {
    expect(textBloecke('Zeile eins\nZeile zwei')).toEqual([{ art: 'absatz', zeilen: ['Zeile eins', 'Zeile zwei'] }])
  })
  it('„- “, „• “ und „* “ sind Aufzählungspunkte', () => {
    expect(textBloecke('- a\n- b')).toEqual([{ art: 'liste', punkte: ['a', 'b'] }])
    expect(textBloecke('• a\n* b\n  - c')).toEqual([{ art: 'liste', punkte: ['a', 'b', 'c'] }])
  })
  it('Absatz direkt gefolgt von Liste → zwei Blöcke; Liste gefolgt von Text → neuer Absatz', () => {
    expect(textBloecke('Neu:\n- a\n- b\nDanke')).toEqual([
      { art: 'absatz', zeilen: ['Neu:'] },
      { art: 'liste', punkte: ['a', 'b'] },
      { art: 'absatz', zeilen: ['Danke'] },
    ])
  })
  it('„-ohne Leerzeichen“ bleibt Text, leerer Punkt entfällt', () => {
    expect(textBloecke('-ohne Leerzeichen')).toEqual([{ art: 'absatz', zeilen: ['-ohne Leerzeichen'] }])
    expect(textBloecke('- a\n- \n- b')).toEqual([{ art: 'liste', punkte: ['a', 'b'] }])
    expect(textBloecke('- ')).toEqual([])
    expect(textBloecke('-')).toEqual([])
  })
  it('HTML bleibt wörtlicher Text', () => {
    expect(textBloecke('<script>alert(1)</script>')).toEqual([{ art: 'absatz', zeilen: ['<script>alert(1)</script>'] }])
    expect(textBloecke('- <b>x</b>')).toEqual([{ art: 'liste', punkte: ['<b>x</b>'] }])
    expect(textBloecke('<img src=x onerror=alert(1)>')).toEqual([{ art: 'absatz', zeilen: ['<img src=x onerror=alert(1)>'] }])
  })
})

describe('Hinweise: Eingaben prüfen', () => {
  it('Titel leer, nur Leerzeichen, zu lang', () => {
    expect(hinweisPruefen({ titel: '', text: '' }).titel).toBeTruthy()
    expect(hinweisPruefen({ titel: '   ', text: 'x' }).titel).toBeTruthy()
    expect(hinweisPruefen({ titel: 'x'.repeat(HINWEIS_TITEL_MAX), text: '' })).toEqual({})
    expect(hinweisPruefen({ titel: 'x'.repeat(HINWEIS_TITEL_MAX + 1), text: '' }).titel).toBeTruthy()
    // Gezählt wird wie in PocketBase: Zeichen, nicht UTF-16-Einheiten
    expect(hinweisPruefen({ titel: 'ä'.repeat(HINWEIS_TITEL_MAX), text: '' })).toEqual({})
  })
  it('Text zu lang; gültig → leer', () => {
    expect(hinweisPruefen({ titel: 'Neu', text: 'x'.repeat(HINWEIS_TEXT_MAX + 1) }).text).toBeTruthy()
    expect(hinweisPruefen({ titel: 'Neu', text: 'x'.repeat(HINWEIS_TEXT_MAX) })).toEqual({})
    expect(hinweisPruefen({ titel: 'Der Hub im neuen Gewand', text: 'Absatz\n\n- Punkt' })).toEqual({})
  })
})

describe('Hinweise: Veröffentlichen und Zurückziehen', () => {
  const jetzt = Date.UTC(2026, 10, 14, 8, 12, 0)
  it('erstes Veröffentlichen setzt das Datum im PocketBase-Format', () => {
    expect(veroeffentlichenAenderung({}, jetzt)).toEqual({ veroeffentlicht: true, veroeffentlicht_am: '2026-11-14 08:12:00.000Z' })
    expect(veroeffentlichenAenderung({ veroeffentlicht_am: '' }, jetzt).veroeffentlicht_am).toBe('2026-11-14 08:12:00.000Z')
  })
  it('erneut veröffentlichen behält das erste Datum', () => {
    expect(veroeffentlichenAenderung({ veroeffentlicht_am: NOV10 }, jetzt)).toEqual({ veroeffentlicht: true, veroeffentlicht_am: NOV10 })
  })
  it('Zurückziehen lässt das Datum stehen', () => {
    expect(zurueckziehenAenderung()).toEqual({ veroeffentlicht: false })
    expect('veroeffentlicht_am' in zurueckziehenAenderung()).toBe(false)
  })
  it('Uhrabweichung aus `updated` der Antwort: positiv, wenn das Gerät nachgeht', () => {
    const server = '2026-11-14 08:12:00.000Z'
    expect(uhrVersatz(server, jetzt)).toBe(0)
    expect(uhrVersatz(server, jetzt + 7 * 86_400_000)).toBe(-7 * 86_400_000)
    expect(uhrVersatz(server, jetzt - 3_600_000)).toBe(3_600_000)
    for (const kaputt of [undefined, null, '', 'gestern', 42]) expect(uhrVersatz(kaputt, jetzt), String(kaputt)).toBeNull()
    expect(uhrVersatz(server, Number.NaN)).toBeNull()
  })
  it('Uhr geht 7 Tage vor: veröffentlicht wird mit Serverzeit, nicht mit der Geräte-Uhr', () => {
    const geraet = jetzt + 7 * 86_400_000
    const versatz = uhrVersatz('2026-11-14 08:12:00.000Z', geraet)!
    expect(veroeffentlichenAenderung({}, geraet + versatz).veroeffentlicht_am).toBe('2026-11-14 08:12:00.000Z')
    // Ein später so veröffentlichter Hinweis ist der neueste und erscheint bei allen, die den älteren bestätigt haben
    const a = H('a', '2026-11-14 08:12:00.000Z')
    const b = H('b', veroeffentlichenAenderung({}, Date.UTC(2026, 10, 16, 8, 0, 0)).veroeffentlicht_am)
    expect(neuesterVeroeffentlicht([a, b])?.id).toBe('b')
    expect(hinweisZuZeigen([a, b], { gesehenAm: a.veroeffentlicht_am })?.id).toBe('b')
  })
  it('Warnung erst ab mehr als 2 Minuten, mit Richtung und Dauer', () => {
    expect(uhrWarnung(null)).toBe('')
    expect(uhrWarnung(undefined)).toBe('')
    expect(uhrWarnung(0)).toBe('')
    expect(uhrWarnung(UHR_SPIELRAUM_MS)).toBe('')
    expect(uhrWarnung(-UHR_SPIELRAUM_MS)).toBe('')
    expect(uhrWarnung(-7 * 86_400_000)).toBe('Die Uhr dieses Geräts geht etwa 7 Tage vor. Das Datum des Hinweises richtet sich nach der Serverzeit.')
    expect(uhrWarnung(86_400_000)).toBe('Die Uhr dieses Geräts geht etwa 1 Tag nach. Das Datum des Hinweises richtet sich nach der Serverzeit.')
    expect(uhrWarnung(-14 * 3_600_000)).toContain('etwa 14 Stunden vor')
    expect(uhrWarnung(3_600_000)).toContain('etwa 1 Stunde nach')
    expect(uhrWarnung(-5 * 60_000)).toContain('etwa 5 Minuten vor')
    expect(uhrWarnung(Number.NaN)).toBe('')
  })
  it('Stand: Entwurf, veröffentlicht, zurückgezogen', () => {
    expect(hinweisStand(H('a', undefined, false))).toBe('entwurf')
    expect(hinweisStand(H('a', '', false))).toBe('entwurf')
    expect(hinweisStand(H('a', NOV14, true))).toBe('veroeffentlicht')
    expect(hinweisStand(H('a', NOV14, false))).toBe('zurueckgezogen')
  })
})

describe('Hinweise: Datum und Stand als Text (Europe/Berlin)', () => {
  it('datumText', () => {
    expect(datumText(NOV14)).toBe('14. November 2026')
    // 23:30 UTC ist in Berlin schon der nächste Tag
    expect(datumText('2026-11-14 23:30:00.000Z')).toBe('15. November 2026')
    expect(datumText('')).toBe('')
    expect(datumText('x')).toBe('')
  })
  it('kurzDatum und kurzDatumZeit', () => {
    expect(kurzDatum('2026-11-14 08:12:00.000Z')).toBe('14.11.2026')
    expect(kurzDatumZeit('2026-11-14 08:12:00.000Z')).toBe('14.11.2026, 09:12')
    expect(kurzDatumZeit('2026-07-01 08:12:00.000Z')).toBe('01.07.2026, 10:12')
    expect(kurzDatumZeit('')).toBe('')
  })
  it('standText für die Verwaltung', () => {
    const entwurf: Hinweis = { ...H('e', undefined, false), created: '2026-11-14 08:00:00.000Z' }
    expect(standText(entwurf, null)).toBe('Entwurf, angelegt 14.11.2026')
    expect(standText(H('e', undefined, false), null)).toBe('Entwurf')
    expect(standText(H('a', '2026-11-14 08:12:00.000Z'), 'a')).toBe('Veröffentlicht seit 14.11.2026, 09:12, wird gezeigt')
    expect(standText(H('a', '2026-11-14 08:12:00.000Z'), 'b')).toBe('Veröffentlicht seit 14.11.2026, 09:12, nicht mehr gezeigt (ein neuerer gilt)')
    expect(standText(H('a', NOV14, false), 'b')).toBe('Zurückgezogen')
    expect(standText(H('a', undefined, true), null)).toMatch(/ohne Datum/)
  })
  it('keine Gedankenstriche in den Texten', () => {
    const texte = [standText(H('a', NOV14), 'a'), standText(H('a', NOV14), 'b'), standText(H('a', undefined, true), null),
      hinweisPruefen({ titel: '', text: 'x'.repeat(HINWEIS_TEXT_MAX + 1) }).titel, hinweisPruefen({ titel: '', text: 'x'.repeat(HINWEIS_TEXT_MAX + 1) }).text]
    for (const t of texte) expect(t).not.toMatch(/[–—]/)
  })
})
