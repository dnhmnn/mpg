import { describe, it, expect } from 'vitest'
import { TRACER_GRUPPEN, tracerCode, tracerGruppeVon } from '../../katalog/tracerdiagnosen'
import { naepAbschnitt } from '../../katalog/naep'
import { aelrdFeld } from '../../katalog/aelrd'
import { AELRD_NAEP } from '../../katalog/aelrdNaep'
import { aelrdHtml } from '../aelrdProtokoll'

describe('Die Diagnosen zur Auswahl', () => {
  it('kommt aus dem Abschnitt Erkrankungen der Norm, nicht aus einer zweiten Liste', () => {
    const abschnitt = naepAbschnitt('E01')
    const ausNorm = (abschnitt?.formular ?? []).filter((e) => e.art === 'auswahl' && e.term)
    expect(TRACER_GRUPPEN.map((g) => g.code)).toEqual(ausNorm.map((e) => e.code))
    expect(TRACER_GRUPPEN.map((g) => g.titel)).toEqual(ausNorm.map((e) => ('term' in e ? e.term : '')))
  })

  it('führt die neun Organgruppen des Bogens', () => {
    expect(TRACER_GRUPPEN.map((g) => g.titel)).toEqual([
      'ZNS', 'Herz-Kreislauf', 'Atmung', 'Abdomen', 'Psychiatrie',
      'Stoffwechsel', 'Pädiatrie', 'Gynäkologie', 'Sonstige',
    ])
  })

  it('gibt jeder Gruppe Diagnosen mit dem Code der Norm', () => {
    for (const g of TRACER_GRUPPEN) {
      expect(g.diagnosen.length, `${g.titel} ist leer`).toBeGreaterThan(0)
      for (const d of g.diagnosen) {
        expect(d.text.trim(), `${g.titel} führt eine Diagnose ohne Text`).not.toBe('')
        // Meist drei Zeichen, nicht immer: CoViD-19 trägt in der Norm den
        // Code EHCOV.
        expect(d.code).toMatch(/^[0-9A-Z]{3,6}$/)
      }
    }
  })

  it('nennt keine Diagnose zweimal — sonst wäre die Rückrichtung mehrdeutig', () => {
    const alle = TRACER_GRUPPEN.flatMap((g) => g.diagnosen.map((d) => d.text))
    expect(alle.filter((t, i) => alle.indexOf(t) !== i)).toEqual([])
  })

  it('findet zu einer gewählten Diagnose ihre Gruppe und ihren Code', () => {
    expect(tracerGruppeVon('STEMI')?.titel).toBe('Herz-Kreislauf')
    expect(tracerCode('STEMI')).toBe('E2D')
    expect(tracerGruppeVon('Hypoglykämie')?.titel).toBe('Stoffwechsel')
    // Mit Leerzeichen am Rand, wie es aus einem Eingabefeld kommt.
    expect(tracerGruppeVon('  Krampfanfall  ')?.titel).toBe('ZNS')
  })

  it('behandelt eigenen Text als eigenen Text, nicht als Diagnose der Norm', () => {
    expect(tracerGruppeVon('Abdomen unklar')).toBeUndefined()
    expect(tracerCode('Abdomen unklar')).toBe('')
    expect(tracerGruppeVon('')).toBeUndefined()
    expect(tracerCode('   ')).toBe('')
  })

  it('schreibt in das Feld, das der Bogen führt, und druckt es als Zeile', () => {
    // Das Feld bleibt ein Textfeld des Bogens — die Auswahl ändert nur die
    // Bedienung, nicht den Ausdruck.
    expect(aelrdFeld('tracerdiagnose')?.typ).toBe('text')
    expect(aelrdHtml({ tracerdiagnose: 'STEMI' })).toContain('STEMI')
  })

  it('bleibt beim Export im Anhang — die Norm führt keine Tracerdiagnose', () => {
    // Die Auswahl stammt aus E01, das Feld des Bogens ist aber etwas anderes.
    // Würde das hier stillschweigend zu einem Normfeld, stünde im Datensatz
    // eine Erstdiagnose, die niemand so gestellt hat.
    expect(AELRD_NAEP.tracerdiagnose.feld.art).toBe('anhang')
  })
})
