import { describe, it, expect } from 'vitest'
import {
  DIVI_ABSCHNITTE,
  DIVI_VERSION,
  MEDIKATION_SPALTEN,
  VERLAUF_SPALTEN,
  abschnitteDerSeite,
  alleFelder,
  feldFinden,
  pflichtfelder,
  wertText,
} from '../../katalog/divi'
import { diviDruckHtml, escapeHtml, istGewaehlt } from '../diviDruck'

describe('Feldkatalog DIVI 7.1', () => {
  it('nennt die Version des Vordrucks', () => {
    expect(DIVI_VERSION).toBe('7.1')
  })

  it('vergibt jede Feld-ID genau einmal', () => {
    const ids = alleFelder().map((f) => f.id)
    const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(doppelt).toEqual([])
  })

  it('vergibt jede Abschnitts-ID genau einmal', () => {
    const ids = DIVI_ABSCHNITTE.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('belegt beide Seiten', () => {
    expect(abschnitteDerSeite(1).length).toBeGreaterThan(0)
    expect(abschnitteDerSeite(2).length).toBeGreaterThan(0)
    expect(abschnitteDerSeite(1).length + abschnitteDerSeite(2).length).toBe(DIVI_ABSCHNITTE.length)
  })

  it('sortiert die Abschnitte einer Seite nach Ordnung', () => {
    for (const seite of [1, 2] as const) {
      const ordnungen = abschnitteDerSeite(seite).map((a) => a.ordnung)
      expect(ordnungen).toEqual([...ordnungen].sort((a, b) => a - b))
    }
  })

  it('gibt jedem Abschnitt eine eindeutige Ordnung je Seite', () => {
    for (const seite of [1, 2] as const) {
      const ordnungen = abschnitteDerSeite(seite).map((a) => a.ordnung)
      expect(new Set(ordnungen).size).toBe(ordnungen.length)
    }
  })

  it('haelt die Optionswerte innerhalb eines Feldes auseinander', () => {
    for (const feld of alleFelder()) {
      if (!feld.optionen) continue
      const werte = feld.optionen.map((o) => o.wert)
      expect({ feld: feld.id, doppelt: werte.filter((w, i) => werte.indexOf(w) !== i) })
        .toEqual({ feld: feld.id, doppelt: [] })
    }
  })

  it('gibt jedem Auswahlfeld mindestens zwei Optionen', () => {
    for (const feld of alleFelder()) {
      if (feld.typ !== 'radio' && feld.typ !== 'mehrfach') continue
      expect({ feld: feld.id, anzahl: feld.optionen?.length ?? 0 }.anzahl).toBeGreaterThanOrEqual(2)
    }
  })

  it('gibt jedem Feld ein Label', () => {
    for (const feld of alleFelder()) expect(feld.label.trim()).not.toBe('')
  })

  it('kennt die Pflichtfelder nach MIND', () => {
    const ids = pflichtfelder().map((f) => f.id)
    for (const pflicht of ['name', 'gebdatum', 'geschlecht', 'einsatz_nr', 'naca', 'gcs_summe']) {
      expect(ids).toContain(pflicht)
    }
  })

  it('findet ein Feld anhand seiner ID', () => {
    expect(feldFinden('naca')?.label).toBe('NACA-Score')
    expect(feldFinden('gibtsnicht')).toBeUndefined()
  })

  it('haelt die Spalten von Verlauf und Medikation eindeutig', () => {
    for (const spalten of [VERLAUF_SPALTEN, MEDIKATION_SPALTEN]) {
      const ids = spalten.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('wertText', () => {
  it('uebersetzt einen Optionswert in seinen Text', () => {
    const naca = feldFinden('naca')!
    expect(wertText(naca, 'IV')).toBe('IV')
  })

  it('verbindet mehrere gewaehlte Optionen', () => {
    const feld = feldFinden('rettungsmittel')!
    expect(wertText(feld, ['rtw', 'nef'])).toBe('RTW, NEF')
  })

  it('haengt die Einheit an einen freien Wert', () => {
    const feld = feldFinden('o2_flow')!
    expect(wertText(feld, 12)).toBe('12 l/min')
  })

  it('gibt bei leerem Wert nichts zurueck', () => {
    const feld = feldFinden('name')!
    expect(wertText(feld, '')).toBe('')
    expect(wertText(feld, undefined)).toBe('')
    expect(wertText(feld, null)).toBe('')
  })

  it('zeigt ein gesetztes Kaestchen als ja', () => {
    const feld = feldFinden('polytrauma')!
    expect(wertText(feld, true)).toBe('ja')
    expect(wertText(feld, false)).toBe('')
  })

  it('gibt einen unbekannten Optionswert unveraendert zurueck, statt ihn zu verschlucken', () => {
    const feld = feldFinden('naca')!
    expect(wertText(feld, 'VIII')).toBe('VIII')
  })
})

describe('istGewaehlt', () => {
  it('erkennt einen einzelnen Wert', () => {
    expect(istGewaehlt('rtw', 'rtw')).toBe(true)
    expect(istGewaehlt('rtw', 'nef')).toBe(false)
  })

  it('erkennt einen Wert in einer Liste', () => {
    expect(istGewaehlt(['rtw', 'nef'], 'nef')).toBe(true)
    expect(istGewaehlt(['rtw'], 'nef')).toBe(false)
  })

  it('wertet fehlende Angaben als nicht gewaehlt', () => {
    expect(istGewaehlt(undefined, 'rtw')).toBe(false)
    expect(istGewaehlt(null, 'rtw')).toBe(false)
    expect(istGewaehlt([], 'rtw')).toBe(false)
  })
})

describe('Ausdruck', () => {
  const beispiel = {
    name: 'Mustermann',
    vorname: 'Erika',
    geschlecht: 'weiblich',
    naca: 'IV',
    rettungsmittel: ['rtw', 'nef'],
    gcs_summe: 15,
    schmerz: 7,
    einsatz_nr: 'E-2026-0815',
    notfallgeschehen: 'Patientin im Hausflur\nangetroffen',
    verlauf: [{ zeit: '08:12', puls: 96, rr_sys: 120, rr_dia: 80 }],
    medikation: [{ wirkstoff: 'ASS', dosis: '250 mg', applikation: 'i.v.' }],
  }

  it('liefert genau zwei Seiten', () => {
    const html = diviDruckHtml(beispiel)
    expect(html.match(/class="seite"/g)?.length).toBe(2)
  })

  it('setzt A4 hochkant als Seitenformat', () => {
    expect(diviDruckHtml(beispiel)).toContain('size:A4 portrait')
  })

  it('bricht zwischen den beiden Seiten um', () => {
    expect(diviDruckHtml(beispiel)).toContain('.seite + .seite{page-break-before:always}')
  })

  it('zaehlt die Seiten im Kopf mit', () => {
    const html = diviDruckHtml(beispiel)
    expect(html).toContain('Seite 1 / 2')
    expect(html).toContain('Seite 2 / 2')
  })

  it('traegt die eingegebenen Werte ein', () => {
    const html = diviDruckHtml(beispiel)
    expect(html).toContain('Mustermann')
    expect(html).toContain('E-2026-0815')
  })

  it('kreuzt gewaehlte Optionen an und laesst die uebrigen leer', () => {
    const html = diviDruckHtml(beispiel)
    expect(html).toContain('<span class="kast an"><span class="box">×</span>RTW')
    expect(html).toContain('<span class="kast"><span class="box"></span>KTW')
  })

  it('zeigt alle Optionen eines Feldes, auch die nicht gewaehlten', () => {
    const html = diviDruckHtml(beispiel)
    // Der Papiervordruck zeigt immer den ganzen Katalog — das muss der
    // Ausdruck auch, sonst steht im Protokoll eine andere Auswahl als vor Ort.
    for (const option of feldFinden('naca')!.optionen!) {
      expect(html).toContain(`>${option.text}`)
    }
  })

  it('markiert den gewaehlten Punkt der Schmerzskala', () => {
    const html = diviDruckHtml(beispiel)
    expect(html).toContain('<span class="stufe an">7</span>')
    expect(html).toContain('<span class="stufe">6</span>')
  })

  it('druckt die Verlaufszeilen', () => {
    const html = diviDruckHtml(beispiel)
    expect(html).toContain('<td>08:12</td>')
    expect(html).toContain('<td>96</td>')
  })

  it('laesst leere Verlaufszeilen zum Nachtragen stehen', () => {
    const html = diviDruckHtml({ verlauf: [] })
    const zeilen = html.match(/<tr><td><\/td>/g)?.length ?? 0
    expect(zeilen).toBeGreaterThanOrEqual(10)
  })

  it('druckt die Medikationstabelle', () => {
    const html = diviDruckHtml(beispiel)
    expect(html).toContain('<td>ASS</td>')
    expect(html).toContain('<td>250 mg</td>')
  })

  it('uebernimmt auch die Medikamentenliste der Fassung 1.0', () => {
    const html = diviDruckHtml({ medications: [{ name: 'Midazolam', dosis: '2 mg', applikation: 'i.n.' }] })
    expect(html).toContain('<td>Midazolam</td>')
  })

  it('kommt mit einem leeren Protokoll zurecht', () => {
    const html = diviDruckHtml({})
    expect(html.match(/class="seite"/g)?.length).toBe(2)
    expect(html).toContain('Notfall-Einsatzprotokoll')
  })

  it('ignoriert unbekannte Felder in der Payload', () => {
    const html = diviDruckHtml({ irgendwas_altes: 'Wert', name: 'Test' })
    expect(html).toContain('Test')
    expect(html).not.toContain('irgendwas_altes')
  })

  it('maskiert HTML aus den Eingaben', () => {
    const html = diviDruckHtml({ name: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('maskiert auch Anfuehrungszeichen', () => {
    expect(escapeHtml('a"b&c<d>')).toBe('a&quot;b&amp;c&lt;d&gt;')
  })

  it('nimmt Organisation und Zeitpunkt in den Kopf auf', () => {
    const html = diviDruckHtml({}, { organisation: 'BRK Ansbach', erstellt: '02.10.2026, 12:00' })
    expect(html).toContain('BRK Ansbach')
    expect(html).toContain('02.10.2026, 12:00')
  })

  it('bringt jedes Pflichtfeld auf das Papier', () => {
    const html = diviDruckHtml({})
    for (const feld of pflichtfelder()) {
      expect({ feld: feld.id, enthalten: html.includes(escapeHtml(feld.label)) })
        .toEqual({ feld: feld.id, enthalten: true })
    }
  })

  it('bringt jeden Abschnitt auf das Papier', () => {
    const html = diviDruckHtml({})
    for (const abschnitt of DIVI_ABSCHNITTE) {
      expect({ abschnitt: abschnitt.id, enthalten: html.includes(escapeHtml(abschnitt.titel)) })
        .toEqual({ abschnitt: abschnitt.id, enthalten: true })
    }
  })

  it('wiederholt die Zwischenueberschrift nicht als Feldbeschriftung', () => {
    const html = diviDruckHtml({})
    // Im Katalog heisst die Gruppe „Rettungsmittel" und ihr Feld ebenso.
    // Auf dem Papier soll das Wort nur einmal stehen.
    const treffer = html.match(/>Rettungsmittel</g)?.length ?? 0
    expect(treffer).toBe(1)
  })

  it('stellt die Beschriftung eines Freitextfeldes ueber das Feld', () => {
    const html = diviDruckHtml({ notfallgeschehen: 'Text' })
    expect(html).toContain('class="feld lang"')
  })

  it('haelt die Ankreuzspalten des Verlaufs schmal', () => {
    const html = diviDruckHtml({ verlauf: [{ zeit: '08:00', hdm: true }] })
    expect(html).toContain('<td class="schmal">×</td>')
  })

  it('setzt die Abschnitte in Spalten, wie der Vordruck', () => {
    expect(diviDruckHtml({})).toContain('class="spalten"')
  })

  it('gibt den Tabellen die ganze Blattbreite', () => {
    const html = diviDruckHtml({})
    expect(html).toContain('class="abschnitt breit"')
    expect(html).toContain('.breit{column-span:all')
  })
})
