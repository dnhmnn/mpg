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
