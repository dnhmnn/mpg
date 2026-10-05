import { describe, it, expect } from 'vitest'
import {
  spaltentext, verlaufEintragen, verlaufLesen, verlaufSortiert, verlaufStreichen, zahl,
} from '../../pages/public/doku/verlauf'
import { GITTER, VERLAUFSWERTE, hoeheAnteil, hoeheImGitter } from '../../katalog/verlaufswerte'
import { aelrdHtml } from '../aelrdProtokoll'

const spalte = (zeit: string, werte: Record<string, string>) => ({ zeit, werte })

describe('Die Skalen des Kurvenblatts', () => {
  it('legt die Pfeile der Vorlage auf die Linien des Gitters', () => {
    // Sechs Felder, sieben Linien: jeder Pfeil muss auf einem Sechstel
    // sitzen, sonst zeigt die Beschriftung auf nichts.
    for (const g of GITTER) {
      for (const s of g.skala) {
        const anteil = hoeheAnteil(g, s.wert)
        expect(Math.abs(anteil * 6 - Math.round(anteil * 6)), `${g.id}: ${s.text}`).toBeLessThan(0.001)
      }
      for (const s of g.skalaRechts ?? []) {
        const anteil = hoeheAnteil(g, s.wert, true)
        expect(Math.abs(anteil * 6 - Math.round(anteil * 6)), `${g.id} rechts: ${s.text}`).toBeLessThan(0.001)
      }
    }
  })

  it('rechnet einen Messwert auf seine Höhe im Gitter', () => {
    // Das Kreislauf-Gitter geht von 0 bis 300 über 132 Punkte.
    expect(hoeheImGitter('hf', 300)).toBe(0)
    expect(hoeheImGitter('hf', 0)).toBe(132)
    expect(hoeheImGitter('hf', 150)).toBe(66)
    // CO₂ liest die rechte Skala: 0 bis 60.
    expect(hoeheImGitter('etco2', 60)).toBe(0)
    expect(hoeheImGitter('etco2', 30)).toBe(66)
  })

  it('zeichnet nichts, was außerhalb der Skala liegt', () => {
    // Ein Wert an den Rand geklebt wäre eine Messung, die es nicht gab.
    expect(hoeheImGitter('spo2', 60)).toBeNull()
    expect(hoeheImGitter('hf', 400)).toBeNull()
    expect(hoeheImGitter('hf', Number.NaN)).toBeNull()
    expect(hoeheImGitter('gibtsnicht', 50)).toBeNull()
  })

  it('gibt jedem Messwert ein Gitter und ein Zeichen', () => {
    for (const v of VERLAUFSWERTE) {
      expect(GITTER.some((g) => g.id === v.gitter), `${v.id} ohne Gitter`).toBe(true)
      expect(v.zeichen.length, `${v.id} ohne Zeichen`).toBeGreaterThan(0)
    }
  })
})

describe('Der Verlauf als Spalten', () => {
  it('trägt eine Messung mit ihrer Uhrzeit ein', () => {
    const w = verlaufEintragen({}, spalte('13:30', { spo2: '94', hf: '96' }))
    expect(verlaufLesen(w)).toHaveLength(1)
    expect(verlaufLesen(w)[0].zeit).toBe('13:30')
    expect(verlaufLesen(w)[0].werte).toEqual({ spo2: '94', hf: '96' })
  })

  it('behält nur, was eine Zahl ist', () => {
    const w = verlaufEintragen({}, spalte('13:30', { spo2: '94', hf: '  ', puls: 'abc' }))
    expect(verlaufLesen(w)[0].werte).toEqual({ spo2: '94' })
  })

  it('legt ohne einen einzigen Messwert keine Spalte an', () => {
    expect(verlaufEintragen({}, spalte('13:30', {}))).toEqual({})
    expect(verlaufEintragen({}, spalte('13:30', { hf: '' }))).toEqual({})
  })

  it('liest das Komma wie den Punkt', () => {
    expect(zahl('36,8')).toBe(36.8)
    expect(zahl('36.8')).toBe(36.8)
    expect(zahl('')).toBeNull()
    expect(zahl('viel')).toBeNull()
  })

  it('stellt die Spalten nach der Uhr, nicht nach der Eingabe', () => {
    // Nachgetragen wird oft später — auf dem Kurvenblatt muss es trotzdem
    // an der richtigen Stelle stehen.
    let w = verlaufEintragen({}, spalte('14:00', { hf: '80' }))
    w = verlaufEintragen(w, spalte('13:30', { hf: '96' }))
    expect(verlaufSortiert(w).map((s) => s.zeit)).toEqual(['13:30', '14:00'])
  })

  it('streicht eine Messung', () => {
    let w = verlaufEintragen({}, spalte('13:30', { hf: '96' }))
    w = verlaufEintragen(w, spalte('13:45', { hf: '88' }))
    w = verlaufStreichen(w, verlaufLesen(w)[0].id)
    expect(verlaufLesen(w).map((s) => s.zeit)).toEqual(['13:45'])
    expect(verlaufStreichen(w, 'gibtsnicht')).toBe(w)
  })

  it('gibt jeder Spalte eine eigene Kennung', () => {
    let w = verlaufEintragen({}, spalte('13:30', { hf: '96' }))
    w = verlaufEintragen(w, spalte('13:45', { hf: '88' }))
    w = verlaufStreichen(w, 'v1')
    w = verlaufEintragen(w, spalte('14:00', { hf: '80' }))
    const ids = verlaufLesen(w).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('übergeht kaputte Einträge', () => {
    expect(verlaufLesen({ verlauf: 'nichts' })).toEqual([])
    expect(verlaufLesen({ verlauf: [null, 7, { id: 'v1' }] })).toEqual([])
  })

  it('nennt in der Liste, was gemessen wurde', () => {
    expect(spaltentext({ id: 'v1', zeit: '13:30', werte: { spo2: '94', hf: '96' } }))
      .toBe('SpO₂ 94 · HF 96')
  })
})

describe('Der Verlauf im Ausdruck', () => {
  const protokoll = () => {
    let w: Record<string, unknown> = {}
    w = verlaufEintragen(w, spalte('13:30', { spo2: '94', af: '18', hf: '96', rr_sys: '150', rr_dia: '95', etco2: '38' }))
    w = verlaufEintragen(w, spalte('13:45', { spo2: '96', hf: '88' }))
    return aelrdHtml(w)
  }

  it('zeichnet die Messwerte als Zeichen ins Gitter', () => {
    const html = protokoll()
    // Fünfeck für SpO₂, Sechseck für die AF, Kuppel für die HF, Hantel für RR.
    expect(html).toContain('<polygon')
    expect(html).toContain('<path')
    expect(html).toMatch(/stroke="#1d4ed8"/)  // SpO₂ blau
    expect(html).toMatch(/stroke="#dc2626"/)  // HF rot
  })

  it('schreibt die Uhrzeiten unter das Gitter', () => {
    const html = protokoll()
    expect(html).toContain('13:30')
    expect(html).toContain('13:45')
  })

  it('bleibt ohne Verlauf der leere Vordruck', () => {
    const leer = aelrdHtml({})
    expect(leer).toContain('Verlaufsbeschreibung')
    expect(leer).not.toContain('<polygon')
  })
})
