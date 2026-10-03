// Der DIVI-7.1-Katalog bleibt als Referenz erhalten: aelrd.ts verweist fuer
// jedes Feld des Bogens darauf, und ein Test haelt diese Verweise gueltig.
// Der zugehoerige Ausdruck und die Maske sind entfallen — der Bogen wird
// nach der ÄLRD-Vorlage gedruckt, nicht nach 7.1.
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
  rasterDerSeite,
  wertText,
} from '../../katalog/divi'

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

  it('sortiert die Abschnitte einer Seite wie den Vordruck: Band, Saeule, dann von oben nach unten', () => {
    for (const seite of [1, 2] as const) {
      const schluessel = abschnitteDerSeite(seite).map((a) => [a.zeile, a.spalte, a.ordnung])
      const sortiert = [...schluessel].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
      expect(schluessel).toEqual(sortiert)
    }
  })

  it('stapelt innerhalb einer Saeule ohne Gleichstand', () => {
    for (const seite of [1, 2] as const) {
      for (const band of rasterDerSeite(seite)) {
        for (const saeule of band.saeulen) {
          const ordnungen = saeule.abschnitte.map((a) => a.ordnung)
          expect({ seite, band: band.zeile, saeule: saeule.spalte, doppelt: ordnungen.filter((o, i) => ordnungen.indexOf(o) !== i) })
            .toEqual({ seite, band: band.zeile, saeule: saeule.spalte, doppelt: [] })
        }
      }
    }
  })

  it('fuellt jedes Band genau aus — zwoelf Zwoelftel, keine Luecke, kein Ueberhang', () => {
    for (const seite of [1, 2] as const) {
      for (const band of rasterDerSeite(seite)) {
        const summe = band.saeulen.reduce((s, sa) => s + sa.spanne, 0)
        expect({ seite, band: band.zeile, summe }).toEqual({ seite, band: band.zeile, summe: 12 })
      }
    }
  })

  it('gibt allen Abschnitten derselben Saeule dieselbe Breite', () => {
    for (const seite of [1, 2] as const) {
      for (const band of rasterDerSeite(seite)) {
        for (const saeule of band.saeulen) {
          for (const abschnitt of saeule.abschnitte) {
            expect({ abschnitt: abschnitt.id, spanne: abschnitt.spanne })
              .toEqual({ abschnitt: abschnitt.id, spanne: saeule.spanne })
          }
        }
      }
    }
  })

  it('ordnet die Bloecke so an wie der Vordruck', () => {
    // Vorderseite, oberstes Band: links die Stammdaten mit dem Protokollkopf,
    // in der Mitte die Einsatzdaten mit Transportziel und Besetzung,
    // rechts Symptom-Beginn, die Zeitenleiste und die Qualifikationen.
    const [band1] = rasterDerSeite(1)
    expect(band1.saeulen.map((s) => s.abschnitte.map((a) => a.id))).toEqual([
      ['stammdaten', 'protokollkennung'],
      ['einsatzdaten', 'zielklinik', 'mannschaft'],
      ['symptombeginn', 'zeiten', 'qualifikation'],
    ])
  })

  it('legt das Notfallgeschehen als durchgehendes Band unter das erste', () => {
    const band2 = rasterDerSeite(1)[1]
    expect(band2.saeulen).toHaveLength(1)
    expect(band2.saeulen[0].abschnitte.map((a) => a.id)).toEqual(['notfallgeschehen'])
  })

  it('stellt Neurologie und Messwerte nebeneinander, wie auf dem Papier', () => {
    const band3 = rasterDerSeite(1)[2]
    expect(band3.saeulen.map((s) => s.abschnitte.map((a) => a.id))).toEqual([
      ['neurologie_erst'],
      ['messwerte_erst'],
    ])
  })

  it('ordnet die Rueckseite wie den Vordruck', () => {
    const [band1, band2, band3] = rasterDerSeite(2)
    expect(band1.saeulen.map((s) => s.abschnitte.map((a) => a.id))).toEqual([
      ['verlaufsprotokoll', 'medikation', 'reanimation'],
      ['massnahmen'],
    ])
    expect(band2.saeulen[0].abschnitte.map((a) => a.id)).toEqual(['uebergabebefund'])
    expect(band3.saeulen.map((s) => s.abschnitte.map((a) => a.id))).toEqual([
      ['einsatzverlauf', 'uebergabe'],
      ['transport'],
      ['neurologie_ende', 'bemerkungen'],
    ])
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
