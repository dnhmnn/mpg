import { describe, it, expect } from 'vitest'
import {
  spaltentext, verlaufEintragen, verlaufLesen, verlaufSortiert, verlaufStreichen, zahl,
} from '../../pages/public/doku/verlauf'
import {
  GITTER, SCHRITTE, SPALTEN, VERLAUFSWERTE,
  anteilImGitter, fehlendeZeitpunkte, hoeheAnteil, kurvenspalten, minuten,
  spaltenAusFeldern, stelle, uhrzeit, zeitachse,
} from '../../katalog/verlaufswerte'
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

  it('rechnet einen Messwert auf seinen Platz im Gitter', () => {
    // Ein Anteil, keine Höhe: wie hoch gedruckt wird, entscheidet der Kasten.
    expect(anteilImGitter('hf', 300)).toBe(0)
    expect(anteilImGitter('hf', 0)).toBe(1)
    expect(anteilImGitter('hf', 150)).toBe(0.5)
    // CO₂ liest die rechte Skala: 0 bis 60.
    expect(anteilImGitter('etco2', 60)).toBe(0)
    expect(anteilImGitter('etco2', 30)).toBe(0.5)
  })

  it('teilt die Höhe des Kastens unter den drei Gittern auf', () => {
    // Die Vorlage füllt den Kasten ganz aus; feste Höhen ließen ihn zu
    // vierzig Prozent leer.
    const summe = GITTER.reduce((n, g) => n + g.anteil, 0)
    expect(Math.abs(summe - 1)).toBeLessThan(0.0001)
    // Die Verhältnisse der Vorlage: das Kreislauf-Gitter ist das größte.
    expect(GITTER.find((g) => g.id === 'hf')!.anteil).toBeGreaterThan(0.6)
  })

  it('zeichnet nichts, was außerhalb der Skala liegt', () => {
    // Ein Wert an den Rand geklebt wäre eine Messung, die es nicht gab.
    expect(anteilImGitter('spo2', 60)).toBeNull()
    expect(anteilImGitter('hf', 400)).toBeNull()
    expect(anteilImGitter('hf', Number.NaN)).toBeNull()
    expect(anteilImGitter('gibtsnicht', 50)).toBeNull()
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

describe('Die Zeitachse des Kurvenblatts', () => {
  it('liest und schreibt Uhrzeiten', () => {
    expect(minuten('13:30')).toBe(810)
    expect(minuten('00:00')).toBe(0)
    expect(minuten('9:05')).toBe(545)
    expect(minuten('25:00')).toBeNull()
    expect(minuten('13:70')).toBeNull()
    expect(minuten('halb zwei')).toBeNull()
    expect(uhrzeit(810)).toBe('13:30')
    expect(uhrzeit(0)).toBe('00:00')
    // Über Mitternacht hinaus zählt es weiter — Einsätze enden nicht um 24 Uhr.
    expect(uhrzeit(1450)).toBe('00:10')
  })

  it('beginnt auf einer Viertelstunde', () => {
    expect(zeitachse(['13:37', '14:02'])?.start).toBe(13 * 60 + 30)
  })

  it('lässt der ersten Messung einen Vorlauf, wenn sie auf dem Rand säße', () => {
    // Genau auf der Viertelstunde gemessen: ohne Vorlauf wäre das Zeichen
    // halb abgeschnitten, und das Blatt begänne mitten im Einsatz.
    expect(zeitachse(['13:30', '14:15'])?.start).toBe(13 * 60 + 15)
  })

  it('wählt den kleinsten Schritt, in dem alles aufs Blatt passt', () => {
    // 36 Felder: bei 2,5 Minuten je Feld sind das 90 Minuten.
    expect(zeitachse(['13:20', '14:00'])?.schritt).toBe(2.5)
    expect(zeitachse(['13:20', '15:30'])?.schritt).toBe(5)
    expect(zeitachse(['13:20', '18:00'])?.schritt).toBe(10)
  })

  it('behält den größten Schritt, wenn auch er nicht reicht', () => {
    // Lieber die spätesten Messungen am Rand als ein Gitter, das die Zeit
    // verfälscht.
    const a = zeitachse(['08:00', '23:00'])!
    expect(a.schritt).toBe(SCHRITTE[SCHRITTE.length - 1])
  })

  it('setzt eine Messung auf ihre Uhrzeit, nicht auf ihre Nummer', () => {
    const a = zeitachse(['13:30', '13:35', '14:30'])!
    // Start 13:15, Schritt 2,5 — 36 Felder sind 90 Minuten.
    expect(stelle(a, '13:15')).toBe(0)
    expect(stelle(a, '14:00')).toBeCloseTo(50, 5)
    expect(stelle(a, '14:45')).toBe(100)
    // Zwei Messungen fünf Minuten auseinander stehen zwei Felder auseinander.
    const links = stelle(a, '13:30')!
    const rechts = stelle(a, '13:35')!
    expect(rechts - links).toBeCloseTo((5 / 90) * 100, 5)
  })

  it('zeichnet nichts außerhalb des Blattes', () => {
    const a = zeitachse(['13:30'])!
    expect(stelle(a, '12:00')).toBeNull()
    expect(stelle(a, '20:00')).toBeNull()
    expect(stelle(a, 'keine Zeit')).toBeNull()
  })

  it('hat ohne Messung keine Achse', () => {
    expect(zeitachse([])).toBeNull()
    expect(zeitachse(['', 'kaputt'])).toBeNull()
  })

  it('schreibt die Uhrzeiten alle sechs Felder unter das Gitter', () => {
    let w: Record<string, unknown> = {}
    w = verlaufEintragen(w, spalte('13:30', { hf: '96' }))
    w = verlaufEintragen(w, spalte('14:15', { hf: '80' }))
    const html = aelrdHtml(w)
    // Start 13:15, Schritt 2,5 — also alle 15 Minuten eine Beschriftung.
    for (const t of ['13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45']) {
      expect(html, `${t} fehlt auf der Achse`).toContain(t)
    }
  })

  it('zieht das feine Netz der Vorlage', () => {
    // Sechsunddreißig Felder in der Breite, und beim Kreislauf zwölf in der
    // Höhe — zwischen zwei beschrifteten Linien liegt noch eine.
    expect(SPALTEN).toBe(36)
    expect(GITTER.find((g) => g.id === 'hf')!.zeilen).toBe(12)
    expect(GITTER.find((g) => g.id === 'spo2')!.zeilen).toBe(6)
  })
})

describe('Erstbefund und Übergabe auf derselben Kurve', () => {
  const befund = {
    erstbefund_zeitpunkt: '13:20',
    spo2: '92', af: '22', hf: '110', puls: '108', nibp_sys: '160', nibp_dia: '95',
    etco2: '30', co_hb: '3', o2_gabe: '4',
  }
  const uebergabe = {
    ub_zeitpunkt: '14:30',
    ub_spo2: '98', ub_af: '14', ub_hf: '78', ub_puls: '78',
    ub_nibp_sys: '125', ub_nibp_dia: '80', ub_etco2: '36',
  }

  it('liest den Erstbefund als eigene Spalte', () => {
    const s = spaltenAusFeldern(befund)
    expect(s).toHaveLength(1)
    expect(s[0].zeit).toBe('13:20')
    expect(s[0].quelle).toBe('erstbefund')
    expect(s[0].werte).toEqual({
      spo2: '92', af: '22', o2: '4', cohb: '3', hf: '110', puls: '108',
      rr_sys: '160', rr_dia: '95', etco2: '30',
    })
  })

  it('liest die Übergabe als eigene Spalte', () => {
    const s = spaltenAusFeldern(uebergabe)
    expect(s[0].quelle).toBe('uebergabe')
    expect(s[0].werte.hf).toBe('78')
    expect(s[0].werte.rr_sys).toBe('125')
  })

  it('stellt alle drei Quellen nach der Uhr auf eine Achse', () => {
    let w: Record<string, unknown> = { ...befund, ...uebergabe }
    w = verlaufEintragen(w, spalte('13:50', { hf: '92' }))
    const alle = kurvenspalten(w)
    expect(alle.map((s) => [s.zeit, s.quelle ?? 'verlauf'])).toEqual([
      ['13:20', 'erstbefund'], ['13:50', 'verlauf'], ['14:30', 'uebergabe'],
    ])
  })

  it('lässt eine Quelle ohne Zeitpunkt weg und sagt es', () => {
    // Ein Punkt ohne Uhrzeit hätte keine Stelle; ihn an den Rand zu setzen
    // wäre erfunden.
    const ohneZeit = { ...befund, erstbefund_zeitpunkt: '' }
    expect(spaltenAusFeldern(ohneZeit)).toEqual([])
    expect(fehlendeZeitpunkte(ohneZeit)).toEqual(['Erstbefund'])
    expect(fehlendeZeitpunkte({ ...befund, ...uebergabe })).toEqual([])
  })

  it('macht aus einem Zeitpunkt ohne Messwerte keine leere Spalte', () => {
    expect(spaltenAusFeldern({ erstbefund_zeitpunkt: '13:20' })).toEqual([])
    expect(fehlendeZeitpunkte({ erstbefund_zeitpunkt: '' })).toEqual([])
  })

  it('zählt sie nicht zum eingetragenen Verlauf', () => {
    // Sie stehen in ihren eigenen Blöcken; wer sie hier streichen könnte,
    // würde den Erstbefund löschen.
    const w = { ...befund }
    expect(verlaufLesen(w)).toEqual([])
    expect(verlaufStreichen(w, 'erstbefund')).toBe(w)
  })

  it('zeichnet sie mit auf das Kurvenblatt', () => {
    const html = aelrdHtml({ ...befund, ...uebergabe })
    // Die Achse umfasst beide Zeitpunkte.
    expect(html).toContain('13:15')
    expect(html).toContain('14:30')
    expect(html).toContain('<polygon')
  })
})
