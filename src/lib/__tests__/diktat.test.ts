import { describe, it, expect } from 'vitest'
import { diktatAuswerten } from '../diktat'

// Diese Prüffälle bewachen eine Stelle, an der ein Fehler in einem rechtlich
// bedeutsamen Dokument landet. Ein falsch verstandener Puls ist kein
// Schönheitsfehler — er steht später im Protokoll, als hätte ihn jemand
// gemessen.

const w = (r: ReturnType<typeof diktatAuswerten>, feld: string) =>
  r.werte.find(x => x.feld === feld)?.wert

describe('Das Übliche, wie es gesprochen wird', () => {
  it('nimmt einen vollständigen Satz auseinander', () => {
    const r = diktatAuswerten('RR 120 zu 80, Puls 88, Sättigung 96 Prozent, Blutzucker 110, GCS 15')
    expect(w(r, 'rr_sys')).toBe('120')
    expect(w(r, 'rr_dia')).toBe('80')
    expect(w(r, 'hf')).toBe('88')
    expect(w(r, 'spo2')).toBe('96')
    expect(w(r, 'bz')).toBe('110')
    expect(w(r, 'gcs')).toBe('15')
  })

  it.each([
    ['Blutdruck 140/90', 'rr_sys', '140'],
    ['RR 100 auf 60', 'rr_dia', '60'],
    ['Herzfrequenz 72', 'hf', '72'],
    ['Sauerstoffsättigung 94', 'spo2', '94'],
    ['SpO2 91', 'spo2', '91'],
    ['Atemfrequenz 18', 'af', '18'],
    ['AF 22', 'af', '22'],
    ['Temperatur 38,4', 'temp', '38,4'],
    ['Schmerz 7', 'schmerz', '7'],
    ['NRS 3', 'schmerz', '3'],
    ['Zucker 65', 'bz', '65'],
  ])('%s → %s', (satz, feld, erwartet) => {
    expect(w(diktatAuswerten(satz), feld)).toBe(erwartet)
  })

  it('kommt mit Spracherkennungs-Eigenheiten zurecht', () => {
    // Diktate schreiben „SpO 2" getrennt und verwechseln O mit Null.
    expect(w(diktatAuswerten('SpO 2 95'), 'spo2')).toBe('95')
    expect(w(diktatAuswerten('Sp0 2 95'), 'spo2')).toBe('95')
  })
})

describe('Unplausibles wird NICHT übernommen', () => {
  // Ein Puls von 880 ist ein Hörfehler, kein Messwert. Er darf nicht als
  // Zahl im Protokoll landen — aber er darf auch nicht spurlos verschwinden.
  it.each([
    ['Puls 880', 'hf'],
    ['Sättigung 960', 'spo2'],
    ['GCS 20', 'gcs'],
    ['Atemfrequenz 99', 'af'],
    ['Temperatur 98', 'temp'],
    ['Schmerz 70', 'schmerz'],
  ])('%s wird verworfen', (satz, feld) => {
    const r = diktatAuswerten(satz)
    expect(w(r, feld), 'darf nicht übernommen werden').toBeUndefined()
    expect(r.verworfen.some(v => v.feld === feld), 'muss aber gemeldet werden').toBe(true)
  })

  it('nennt bei jedem verworfenen Wert den Grund und den Wortlaut', () => {
    const v = diktatAuswerten('Puls 880').verworfen[0]
    expect(v.grund).toMatch(/außerhalb des Plausiblen/)
    expect(v.quelle).toContain('880')
  })
})

describe('Was schon dasteht, bleibt stehen', () => {
  it('überschreibt keinen eingetragenen Wert', () => {
    const r = diktatAuswerten('Puls 88', { hf: '72' })
    expect(w(r, 'hf'), 'der eingetippte Wert gilt').toBeUndefined()
    expect(r.verworfen[0].grund).toMatch(/schon eingetragen/)
  })

  it('füllt leere Felder trotzdem', () => {
    const r = diktatAuswerten('Puls 88, Sättigung 96', { hf: '72' })
    expect(w(r, 'spo2')).toBe('96')
  })

  it('behandelt leere Zeichenketten als unbelegt', () => {
    expect(w(diktatAuswerten('Puls 88', { hf: '' }), 'hf')).toBe('88')
  })
})

describe('Der Wortlaut bleibt immer erhalten', () => {
  it('führt den gesprochenen Satz unverändert mit', () => {
    const satz = 'Patient klagt über Druck auf der Brust, RR 120 zu 80'
    expect(diktatAuswerten(satz).wortlaut).toBe(satz)
  })

  it('auch wenn gar nichts erkannt wurde', () => {
    const satz = 'Patient ist ansprechbar und orientiert'
    const r = diktatAuswerten(satz)
    expect(r.werte).toEqual([])
    expect(r.wortlaut).toBe(satz)
  })
})

describe('Der halbe Blutdruck', () => {
  // „RR 120" ohne zweiten Wert ist mehrdeutig — systolisch oder diastolisch?
  // Ein halber Blutdruck ist keiner.
  it('wird nicht als Wert übernommen', () => {
    const r = diktatAuswerten('RR 120')
    expect(w(r, 'rr_sys')).toBeUndefined()
    expect(w(r, 'rr_dia')).toBeUndefined()
  })

  it('wird aber gemeldet, damit es nicht untergeht', () => {
    const r = diktatAuswerten('RR 120')
    expect(r.verworfen.some(v => /halber Blutdruck/.test(v.grund))).toBe(true)
  })
})

describe('Nichts erfinden', () => {
  it('liest keine Zahl als Messwert, die keine ist', () => {
    const r = diktatAuswerten('Patient ist 68 Jahre alt und wiegt 80 Kilo')
    expect(r.werte).toEqual([])
  })

  it('verwechselt das Alter nicht mit einem Blutdruck', () => {
    expect(diktatAuswerten('68 Jahre').werte).toEqual([])
  })

  it('bleibt bei leerer Eingabe leer', () => {
    const r = diktatAuswerten('')
    expect(r.werte).toEqual([])
    expect(r.verworfen).toEqual([])
  })
})
