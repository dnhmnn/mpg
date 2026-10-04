import { describe, it, expect } from 'vitest'
import { aelrdHtml } from '../aelrdProtokoll'

// Ein gültiges, winziges PNG als Datenadresse.
const BILD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('Die gezeichnete Unterschrift auf dem Bogen', () => {
  it('steht als Bild über der Unterschriftslinie', () => {
    const html = aelrdHtml({ signature: BILD })
    expect(html).toContain(`<img src="${BILD}"`)
    // Über der Linie, nicht darunter: der Raum kommt vor dem Linien-Kasten.
    expect(html.indexOf('sig-raum')).toBeLessThan(html.indexOf('class="unterschrift"'))
  })

  it('zeigt daneben weiterhin den getippten Namen', () => {
    const html = aelrdHtml({ signature: BILD, unterschrift: 'H. Mustermann' })
    expect(html).toContain('H. Mustermann')
    expect(html).toContain('<img src="data:image/png')
  })

  it('lässt den Platz frei, wenn nicht unterschrieben wurde', () => {
    const html = aelrdHtml({})
    expect(html).toContain('<div class="sig-raum"></div>')
    expect(html).not.toContain('<img')
  })

  it('nimmt nur echte Bild-Datenadressen', () => {
    // Was aus der Payload in das Dokument geschrieben wird, muss geprüft
    // sein — sonst steht dort, was jemand hineingeschrieben hat.
    for (const boese of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      '" onerror="alert(1)',
      'https://example.invalid/bild.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    ]) {
      const html = aelrdHtml({ signature: boese })
      expect(html).not.toContain('<img')
      expect(html).not.toContain(boese)
    }
  })

  it('übersteht einen Wert, der gar keine Zeichenkette ist', () => {
    expect(() => aelrdHtml({ signature: 42 })).not.toThrow()
    expect(aelrdHtml({ signature: null })).not.toContain('<img')
  })
})
