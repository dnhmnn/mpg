import { describe, it, expect } from 'vitest'
import { SPERRE_MS, istLadefehler, neuLadenErlaubt } from '../neueFassung'

describe('Neue Fassung: fehlender Teil der App', () => {
  it('erkennt die Meldungen der Browser für einen fehlenden Teil', () => {
    // Safari/iOS nach einer Veröffentlichung (Netlify liefert die Startseite statt des Codes)
    expect(istLadefehler(new TypeError("'text/html' is not a valid JavaScript MIME type for module script 'https://app.responda.systems/assets/Hub-DwRBBEuE.js'."))).toBe(true)
    // Chrome
    expect(istLadefehler(new TypeError('Failed to fetch dynamically imported module: https://app.responda.systems/assets/Hub-x.js'))).toBe(true)
    // Safari ohne Netz
    expect(istLadefehler(new TypeError('Importing a module script failed.'))).toBe(true)
    // Firefox
    expect(istLadefehler(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(istLadefehler(new Error('Unable to preload CSS for /assets/Hub-x.css'))).toBe(true)
  })

  it('andere Fehler bleiben Fehler', () => {
    expect(istLadefehler(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(istLadefehler(new Error('Network request failed'))).toBe(false)
    expect(istLadefehler(null)).toBe(false)
    expect(istLadefehler(undefined)).toBe(false)
  })

  it('lädt nur einmal neu — keine Schleife, wenn der Teil auch danach fehlt', () => {
    const jetzt = 1_800_000_000_000
    expect(neuLadenErlaubt(null, jetzt)).toBe(true)
    expect(neuLadenErlaubt(jetzt - 5_000, jetzt)).toBe(false)
    expect(neuLadenErlaubt(jetzt - SPERRE_MS - 1, jetzt)).toBe(true)
  })
})
