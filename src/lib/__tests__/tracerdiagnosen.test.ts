import { describe, it, expect } from 'vitest'
import { TRACER_GRUPPEN, tracerCode, tracerGruppeVon } from '../../katalog/tracerdiagnosen'
import { naepAbschnitt } from '../../katalog/naep'
import { aelrdFeld } from '../../katalog/aelrd'
import { AELRD_NAEP } from '../../katalog/aelrdNaep'
import { aelrdHtml } from '../aelrdProtokoll'
import { diagnoseSetzen, gruppeSetzen, istGruppenname } from '../../pages/public/doku/diagnose'

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

describe('Tracerdiagnose und führende Diagnose zusammen', () => {
  it('trägt die Gruppe als führende Diagnose ein', () => {
    const w = diagnoseSetzen({}, 'STEMI')
    expect(w.tracerdiagnose).toBe('STEMI')
    expect(w.fuehrende_diagnose).toBe('Herz-Kreislauf')
  })

  it('zieht die Gruppe nach, wenn die Diagnose wechselt', () => {
    let w = diagnoseSetzen({}, 'STEMI')
    w = diagnoseSetzen(w, 'Asthma (Anfall)')
    expect(w.fuehrende_diagnose).toBe('Atmung')
    expect(w.tracerdiagnose).toBe('Asthma (Anfall)')
  })

  it('überschreibt keine von Hand geschriebene führende Diagnose', () => {
    // Wer dort etwas Eigenes stehen hat, hat es gemeint.
    const w = diagnoseSetzen({ fuehrende_diagnose: 'Vorderwandinfarkt, Killip II' }, 'STEMI')
    expect(w.fuehrende_diagnose).toBe('Vorderwandinfarkt, Killip II')
    expect(w.tracerdiagnose).toBe('STEMI')
  })

  it('räumt die Gruppe mit der Diagnose, aber nur die eigene', () => {
    let w = diagnoseSetzen({}, 'STEMI')
    w = diagnoseSetzen(w, '')
    expect(w.tracerdiagnose).toBe('')
    expect(w.fuehrende_diagnose).toBe('')

    // Von Hand geschrieben: bleibt stehen, auch wenn die Diagnose geht.
    let eigen = diagnoseSetzen({ fuehrende_diagnose: 'eigene Angabe' }, 'STEMI')
    eigen = diagnoseSetzen(eigen, '')
    expect(eigen.fuehrende_diagnose).toBe('eigene Angabe')
  })

  it('lässt die Gruppe zu einer Diagnose außerhalb der Liste von Hand setzen', () => {
    let w = diagnoseSetzen({}, 'Abdomen unklar')
    expect(w.fuehrende_diagnose).toBeUndefined()
    w = gruppeSetzen(w, 'Abdomen')
    expect(w.fuehrende_diagnose).toBe('Abdomen')
    expect(istGruppenname('Abdomen')).toBe(true)
    expect(istGruppenname('Abdomen unklar')).toBe(false)
  })

  it('tauscht eine Gruppe gegen die neue aus, statt sie zu behalten', () => {
    // Gruppe von Hand gesetzt, dann eine Diagnose gewählt: die Gruppe der
    // Diagnose gilt, sonst stünde ein Paar da, das nicht zusammengehört.
    let w = gruppeSetzen({}, 'Abdomen')
    w = diagnoseSetzen(w, 'Hypoglykämie')
    expect(w.fuehrende_diagnose).toBe('Stoffwechsel')
  })

  it('druckt beide Zeilen des Bogens', () => {
    const html = aelrdHtml(diagnoseSetzen({}, 'Lungenembolie'))
    expect(html).toContain('Lungenembolie')
    expect(html).toContain('Herz-Kreislauf')
  })
})
