import { describe, it, expect } from 'vitest'
import { fassungLesen, istDivi, mitFassung, NEUE_FASSUNG, FASSUNG_NAME } from '../protokoll'

// Die Fassung entscheidet, welche Maske und welches Druckbild ein Protokoll
// bekommt. Rät man sie falsch, wird ein Dokument falsch dargestellt — bei
// einem Notfallprotokoll ist das kein Schönheitsfehler.

describe('Fassung eines Protokolls', () => {
  it('nimmt ohne Angabe 1.0 an — so sind alle Altbestände', () => {
    expect(fassungLesen({ name: 'Mustermann' })).toBe(1)
  })

  it('erkennt 2.0', () => {
    expect(fassungLesen({ protokoll_version: 2 })).toBe(2)
  })

  it('erkennt 2.0 auch als Zeichenkette', () => {
    // PocketBase gibt JSON-Felder gelegentlich als Text zurück.
    expect(fassungLesen({ protokoll_version: '2' })).toBe(2)
  })

  it.each([null, undefined, '', 0, 'kaputt', []])('fällt bei %p auf 1.0 zurück', (x) => {
    expect(fassungLesen(x)).toBe(1)
  })

  it('hält eine unbekannte Fassung NICHT für DIVI', () => {
    // Lieber die alte, vollständig vorhandene Maske als eine neue, die
    // Felder erwartet, die es nicht gibt.
    expect(fassungLesen({ protokoll_version: 7 })).toBe(1)
    expect(istDivi({ protokoll_version: 7 })).toBe(false)
  })
})

describe('Fassung schreiben', () => {
  it('schreibt die neue Fassung mit', () => {
    expect(mitFassung({ name: 'X' }).protokoll_version).toBe(NEUE_FASSUNG)
  })

  it('lässt die übrigen Felder unberührt', () => {
    const p = mitFassung({ name: 'X', hf: '80' })
    expect(p.name).toBe('X')
    expect(p.hf).toBe('80')
  })

  it('verändert das übergebene Objekt nicht', () => {
    const urspruenglich = { name: 'X' }
    mitFassung(urspruenglich)
    expect('protokoll_version' in urspruenglich).toBe(false)
  })

  it('kann ausdrücklich auf 1.0 gesetzt werden', () => {
    expect(mitFassung({ name: 'X' }, 1).protokoll_version).toBe(1)
  })

  it('hat für jede Fassung einen Namen', () => {
    expect(FASSUNG_NAME[1]).toBe('1.0')
    expect(FASSUNG_NAME[2]).toContain('DIVI')
  })
})

/**
 * Die neue Maske schrieb die Fassung eine Zeit lang nicht mit. Ihre
 * Protokolle sind daran zu erkennen, dass `datensatz()` beim Absenden einen
 * Zeitstempel setzt, den sonst niemand schreibt.
 */
describe('Protokolle aus der neuen Maske ohne Fassungsangabe', () => {
  it('gelten als 2.0, wenn sie den Absendestempel tragen', () => {
    expect(fassungLesen({ abgesendet: '2026-03-04T09:12:00.000Z', hf: '80' })).toBe(2)
    expect(istDivi({ abgesendet: '2026-03-04T09:12:00.000Z' })).toBe(true)
  })

  it('bleiben 1.0 ohne ihn', () => {
    expect(fassungLesen({ hf: '80', frist: '2026-03-05T09:12:00.000Z' })).toBe(1)
    expect(fassungLesen({ abgesendet: '' })).toBe(1)
    expect(fassungLesen({ abgesendet: 12345 })).toBe(1)
  })

  it('lassen sich von einer ausdrücklichen Angabe nicht überstimmen', () => {
    // Ein altes Protokoll, das später einmal durch die neue Maske lief, trägt
    // beides. Die ausdrückliche Angabe gilt.
    expect(fassungLesen({ protokoll_version: 1, abgesendet: '2026-03-04T09:12:00.000Z' })).toBe(1)
    expect(fassungLesen({ protokoll_version: '1', abgesendet: '2026-03-04T09:12:00.000Z' })).toBe(1)
  })

  it('leitet die Fassung aus keinem Feld des Bogens ab', () => {
    // Sonst sähe ein halb leeres Protokoll aus wie die andere Fassung.
    expect(fassungLesen({ hf: '80', nibp_sys: '120', gcs_summe: '15', notfallgeschehen: 'x' })).toBe(1)
  })
})

describe('Nutzlast als Zeichenkette', () => {
  it('wird gelesen wie ein Objekt', () => {
    expect(fassungLesen(JSON.stringify({ protokoll_version: 2 }))).toBe(2)
    expect(fassungLesen(JSON.stringify({ abgesendet: '2026-03-04T09:12:00.000Z' }))).toBe(2)
    expect(fassungLesen(JSON.stringify({ name: 'Huber', rr_sys: '140' }))).toBe(1)
    expect(istDivi(JSON.stringify({ protokoll_version: 2 }))).toBe(true)
  })

  it('gilt als alte Fassung, wenn sie kein JSON ist', () => {
    expect(fassungLesen('kaputt')).toBe(1)
    expect(fassungLesen('')).toBe(1)
    expect(fassungLesen('null')).toBe(1)
    expect(fassungLesen('42')).toBe(1)
  })
})
