import { describe, it, expect } from 'vitest'
import { GCS_FELDER, GCS_SKALEN, GCS_SUMME, gcsSchwere, gcsSumme } from '../../katalog/gcs'
import { aelrdFeld } from '../../katalog/aelrd'
import { naepEingabe } from '../../katalog/naep'

describe('Die Glasgow Coma Scale', () => {
  it('nimmt das Schema aus der Norm, nicht aus dem Gedächtnis', () => {
    // Eine abgeschriebene Skala wäre eine, die irgendwann abweicht — und bei
    // der GCS hieße das: falsche Punkte im Protokoll.
    for (const [code, skala] of [['D10', GCS_SKALEN[0]], ['D1Z', GCS_SKALEN[1]], ['D35', GCS_SKALEN[2]]] as const) {
      const e = naepEingabe(code)!
      const ausNorm = ('optionen' in e ? e.optionen : [])
        .map((o) => ({ punkte: Number(o.numerisch), text: o.term }))
        .sort((a, b) => b.punkte - a.punkte)
      expect(skala.stufen).toEqual(ausNorm)
    }
  })

  it('führt die drei Teile in der Spanne, die der Bogen kennt', () => {
    const spanne = (s: typeof GCS_SKALEN[number]) => [
      Math.min(...s.stufen.map((x) => x.punkte)),
      Math.max(...s.stufen.map((x) => x.punkte)),
    ]
    for (const s of GCS_SKALEN) {
      const feld = aelrdFeld(s.feld)
      expect(feld, `${s.feld} fehlt im Katalog`).toBeTruthy()
      expect(spanne(s)).toEqual([feld!.min, feld!.max])
    }
  })

  it('zählt von der besten zur schlechtesten Antwort', () => {
    // So wird sie abgefragt: erst "folgt Aufforderung", zuletzt "keine".
    for (const s of GCS_SKALEN) {
      const punkte = s.stufen.map((x) => x.punkte)
      expect(punkte).toEqual([...punkte].sort((a, b) => b - a))
    }
  })

  it('rechnet die Summe erst, wenn alle drei Teile stehen', () => {
    // Eine halbe Summe wäre keine, und eine 7 aus zwei Werten stünde im
    // Protokoll wie eine erhobene.
    expect(gcsSumme([4, 5, 6])).toBe(15)
    expect(gcsSumme([1, 1, 1])).toBe(3)
    expect(gcsSumme([4, null, 6])).toBeNull()
    expect(gcsSumme([4, 5])).toBeNull()
  })

  it('bleibt in der Spanne, die der Bogen für die Summe kennt', () => {
    const feld = aelrdFeld(GCS_SUMME)!
    expect(gcsSumme([1, 1, 1])).toBe(feld.min)
    expect(gcsSumme([4, 5, 6])).toBe(feld.max)
  })

  it('benennt die übliche Einteilung', () => {
    expect(gcsSchwere(15)).toBe('leicht')
    expect(gcsSchwere(13)).toBe('leicht')
    expect(gcsSchwere(12)).toBe('mittel')
    expect(gcsSchwere(9)).toBe('mittel')
    expect(gcsSchwere(8)).toBe('schwer')
    expect(gcsSchwere(3)).toBe('schwer')
    expect(gcsSchwere(null)).toBe('')
  })

  it('führt genau die vier Felder des Bogens', () => {
    expect(GCS_FELDER).toEqual(['gcs_augen', 'gcs_verbal', 'gcs_motorik', 'gcs_summe'])
    for (const f of GCS_FELDER) expect(aelrdFeld(f)?.typ).toBe('zahl')
  })
})
