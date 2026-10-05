import { describe, it, expect } from 'vitest'
import {
  adresseLesen, adresseSetzen, adresseZeile, adresseZerlegen,
} from '../../pages/public/doku/adresse'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { aelrdHtml } from '../aelrdProtokoll'

describe('Adressen für die Zeilen des Bogens', () => {
  it('schreibt aus drei Feldern die eine Zeile', () => {
    expect(adresseZeile({ strasse: 'Musterstraße 1', plz: '80331', ort: 'München' }))
      .toBe('Musterstraße 1, 80331 München')
  })

  it('lässt weg, was leer ist, statt Kommas zu drucken', () => {
    expect(adresseZeile({ strasse: '', plz: '80331', ort: 'München' })).toBe('80331 München')
    expect(adresseZeile({ strasse: 'Klinikum Harlaching', plz: '', ort: '' })).toBe('Klinikum Harlaching')
    expect(adresseZeile({ strasse: '', plz: '', ort: 'München' })).toBe('München')
    expect(adresseZeile({ strasse: '', plz: '', ort: '' })).toBe('')
  })

  it('zerlegt wieder, was sie geschrieben hat', () => {
    const a = { strasse: 'Musterstraße 1', plz: '80331', ort: 'München' }
    expect(adresseZerlegen(adresseZeile(a))).toEqual(a)
  })

  it('zerlegt auch die übliche Schreibweise', () => {
    expect(adresseZerlegen('Sendlinger Str. 12, 80331 München'))
      .toEqual({ strasse: 'Sendlinger Str. 12', plz: '80331', ort: 'München' })
    expect(adresseZerlegen('80331 München'))
      .toEqual({ strasse: '', plz: '80331', ort: 'München' })
  })

  it('lässt stehen, was sich nicht zerlegen lässt', () => {
    // Aus älteren Protokollen: "KH Harlaching" ist keine Adresse, aber eine
    // Angabe — sie darf nicht verschwinden.
    expect(adresseZerlegen('KH Harlaching'))
      .toEqual({ strasse: 'KH Harlaching', plz: '', ort: '' })
    expect(adresseZerlegen('')).toEqual({ strasse: '', plz: '', ort: '' })
  })

  it('setzt einen Teil und schreibt die Zeile neu', () => {
    let w = adresseSetzen({}, 'transport_ziel', 'strasse', 'Sanatoriumsplatz 2')
    w = adresseSetzen(w, 'transport_ziel', 'plz', '81545')
    w = adresseSetzen(w, 'transport_ziel', 'ort', 'München')
    expect(w.transport_ziel).toBe('Sanatoriumsplatz 2, 81545 München')
    expect(w.transport_ziel_plz).toBe('81545')
    expect(adresseLesen(w, 'transport_ziel'))
      .toEqual({ strasse: 'Sanatoriumsplatz 2', plz: '81545', ort: 'München' })
  })

  it('hält die beiden Adressen auseinander', () => {
    let w = adresseSetzen({}, 'transport_von', 'ort', 'Grünwald')
    w = adresseSetzen(w, 'transport_ziel', 'ort', 'München')
    expect(w.transport_von).toBe('Grünwald')
    expect(w.transport_ziel).toBe('München')
  })

  it('übernimmt eine Zeile aus einem älteren Protokoll zum Weiterbearbeiten', () => {
    const alt = { transport_von: 'Sendlinger Str. 12, 80331 München' }
    expect(adresseLesen(alt, 'transport_von').plz).toBe('80331')
    // Wird ein Teil geändert, steht die Zeile neu — ohne Verlust.
    const w = adresseSetzen(alt, 'transport_von', 'ort', 'Pasing')
    expect(w.transport_von).toBe('Sendlinger Str. 12, 80331 Pasing')
  })

  it('schreibt in die Felder, die der Bogen druckt', () => {
    for (const feld of ['transport_von', 'transport_ziel']) {
      expect(aelrdFeld(feld), `${feld} fehlt im Katalog`).toBeTruthy()
    }
    const w = adresseSetzen({}, 'transport_ziel', 'strasse', 'Klinikum Bogenhausen')
    expect(aelrdHtml(w)).toContain('Klinikum Bogenhausen')
  })
})

describe('Die Zeiten des Bogens', () => {
  it('führt die Einsatzübernahme zwischen Alarm und Ankunft', () => {
    const zeiten = AELRD_ABSCHNITTE.find((a) => a.id === 'zeiten')!.felder
    expect(zeiten.indexOf('zeit_uebernahme')).toBe(zeiten.indexOf('zeit_alarm') + 1)
    expect(zeiten.indexOf('zeit_uebernahme')).toBeLessThan(zeiten.indexOf('zeit_ankunft_ort'))
    expect(aelrdFeld('zeit_uebernahme')?.typ).toBe('zeit')
  })
})
