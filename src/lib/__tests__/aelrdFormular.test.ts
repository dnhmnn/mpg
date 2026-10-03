import { describe, it, expect } from 'vitest'
import { mehrfachZusammenfassen } from '../aelrdFormular'
import { AELRD_FELDER } from '../../katalog/aelrd'
import { aelrdHtml } from '../aelrdProtokoll'
import { mitFassung, NEUE_FASSUNG, fassungLesen } from '../protokoll'

describe('Sammeln aus dem Formular', () => {
  it('lässt gewöhnliche Felder unangetastet', () => {
    const aus = mehrfachZusammenfassen({ name: 'Mustermann', atemwege: 'frei', voranmeldung: true })
    expect(aus).toEqual({ name: 'Mustermann', atemwege: 'frei', voranmeldung: true })
  })

  it('fasst Mehrfachauswahl zu einer Liste zusammen', () => {
    // Checkboxen können sich keinen name teilen; im DOM heißen sie
    // feld__option. Ohne das Zusammenfassen stünde in der Payload nicht die
    // Auswahl, sondern ein Dutzend Einzelschalter.
    const feld = AELRD_FELDER.find((f) => f.typ === 'mehrfach')
    if (!feld) return // derzeit hat der Bogen nur Einfachauswahl
    const a = feld.optionen![0].wert
    const b = feld.optionen![1].wert
    const aus = mehrfachZusammenfassen({ [`${feld.id}__${a}`]: true, [`${feld.id}__${b}`]: false })
    expect(aus[feld.id]).toEqual([a])
    expect(aus[`${feld.id}__${a}`]).toBeUndefined()
  })

  it('lässt Doppel-Unterstriche in Namen fremder Felder in Ruhe', () => {
    const aus = mehrfachZusammenfassen({ irgendwas__sonst: 'X' })
    expect(aus.irgendwas__sonst).toBe('X')
  })

  it('schreibt die Fassung mit, statt sie später zu erraten', () => {
    const daten = mitFassung(mehrfachZusammenfassen({ name: 'X' }), NEUE_FASSUNG)
    expect(daten.protokoll_version).toBe(2)
    expect(fassungLesen(daten)).toBe(2)
  })

  it('druckt die gesammelten Daten ohne Umweg', () => {
    // Das Formular schreibt die Feldnamen des Bogens — was es sammelt, kann
    // der Ausdruck direkt lesen, ohne Übersetzung.
    const gesammelt = mehrfachZusammenfassen({
      name: 'Mustermann', einsatz_datum: '2026-10-03', atemwege: 'frei',
      ub_hf: '90', tracerdiagnose: 'Abdomen unklar',
    })
    const html = aelrdHtml(gesammelt)
    for (const wert of ['Mustermann', '2026-10-03', '90', 'Abdomen unklar']) {
      expect(html).toContain(wert)
    }
    expect(html).toContain('<span class="kreis an"></span>frei')
  })
})
