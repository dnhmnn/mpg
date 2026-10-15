import { describe, it, expect } from 'vitest'
import { ALLE_MODULE, BUCHBARE_MODULE, MODULE, appFrei, enthaltenIn, formularFrei, freigabeText, freigeschaltet, gebucht, mitEnthaltenen, modulFrei, rechtFrei } from '../freigabe'
import { ALL_APPS, PERM_LABELS } from '../apps'

describe('Freischaltung: was gilt', () => {
  it('ohne Eintrag ist alles frei — bestehende Organisationen verlieren nichts', () => {
    expect(freigeschaltet({})).toBeNull()
    expect(freigeschaltet({ freigeschaltet: null })).toBeNull()
    expect(freigeschaltet(null)).toBeNull()
    expect(modulFrei({}, 'eks')).toBe(true)
    expect(freigabeText({})).toBe('alle Module')
  })

  it('liest die Liste auch als JSON-Text und verwirft Unbekanntes', () => {
    expect(freigeschaltet({ freigeschaltet: '["eks","patienten","quatsch"]' })).toEqual(['benutzer', 'eks', 'patienten'])
    expect(gebucht({ freigeschaltet: '["eks","patienten","quatsch"]' })).toEqual(['eks', 'patienten'])
    expect(freigeschaltet({ freigeschaltet: 'kaputt' })).toBeNull()
  })

  it('eine leere Liste sperrt alle Module — außer der Benutzerverwaltung', () => {
    expect(modulFrei({ freigeschaltet: [] }, 'patienten')).toBe(false)
    expect(modulFrei({ freigeschaltet: [] }, 'benutzer')).toBe(true)
    expect(appFrei({ freigeschaltet: [] }, 'unitarii')).toBe(true)
    expect(appFrei({ freigeschaltet: [] }, 'settings')).toBe(true)
    expect(freigabeText({ freigeschaltet: [] })).toBe('nur Benutzerverwaltung')
  })

  it('die Benutzerverwaltung ist immer an und nicht buchbar', () => {
    const b = MODULE.find((m) => m.id === 'benutzer')!
    expect(b.immer).toBe(true)
    expect(BUCHBARE_MODULE).not.toContain('benutzer')
    expect(BUCHBARE_MODULE.length).toBe(MODULE.length - 1)
    expect(freigabeText({ freigeschaltet: BUCHBARE_MODULE })).toBe('alle Module')
  })
})

describe('Freischaltung: Kacheln, Rechte, Formulare', () => {
  const org = { freigeschaltet: ['patienten', 'lernbar'] }

  it('Kacheln folgen ihrem Modul; Benutzer und Einstellungen sind immer da', () => {
    expect(appFrei(org, 'patienten')).toBe(true)
    expect(appFrei(org, 'eks')).toBe(false)
    expect(appFrei(org, 'office')).toBe(false)
    expect(appFrei(org, 'unitarii')).toBe(true)
    expect(appFrei(org, 'settings')).toBe(true)
  })

  it('Dateien und Schreibstube hängen zusammen', () => {
    const mitDateien = { freigeschaltet: ['dateien'] }
    expect(appFrei(mitDateien, 'dateien')).toBe(true)
    expect(appFrei(mitDateien, 'office')).toBe(true)
  })

  it('vergeben lassen sich nur Rechte freigeschalteter Module — Benutzerverwaltung und Dashboard immer', () => {
    expect(rechtFrei(org, 'patienten')).toBe(true)
    expect(rechtFrei(org, 'eks')).toBe(false)
    expect(rechtFrei(org, 'produktausgabe')).toBe(false)
    expect(rechtFrei(org, 'unitarii')).toBe(true)
    // "dashboard" schaltet auch die Einstellungen frei — darf nie wegfallen
    expect(rechtFrei(org, 'dashboard')).toBe(true)
  })

  it('öffentliche Formulare folgen ihrem Modul', () => {
    expect(formularFrei(org, 'patienten')).toBe(true)
    expect(formularFrei(org, 'cirs')).toBe(false)
    expect(formularFrei(org, 'produktausgabe')).toBe(false)
    expect(formularFrei(org, 'defektmeldung')).toBe(false)
    expect(freigabeText(org)).toBe(`3 von ${MODULE.length} Modulen`)
  })
})

describe('Freischaltung: Lager schließt Dateien, MPG und Vorgänge fest ein', () => {
  const nurLager = { freigeschaltet: ['lager'] }

  it('wer Lager bucht, hat Dateien & Schreibstube, MPG und Vorgänge mit', () => {
    for (const m of ['lager', 'dateien', 'mpg', 'dokumente']) expect(modulFrei(nurLager, m), m).toBe(true)
    for (const a of ['lager', 'dateien', 'office', 'mpg', 'dokumente', 'unitarii', 'settings']) expect(appFrei(nurLager, a), a).toBe(true)
    expect(modulFrei(nurLager, 'patienten')).toBe(false)
    expect(appFrei(nurLager, 'eks')).toBe(false)
    expect(rechtFrei(nurLager, 'dateien')).toBe(true)
    expect(rechtFrei(nurLager, 'dokumente')).toBe(true)
    expect(formularFrei(nurLager, 'cirs')).toBe(true)
    expect(formularFrei(nurLager, 'defektmeldung')).toBe(true)
    expect(freigabeText(nurLager)).toBe(`5 von ${MODULE.length} Modulen`)
  })

  it('gespeichert bleibt nur, was gebucht ist; nutzbar ist es samt Enthaltenem', () => {
    expect(gebucht(nurLager)).toEqual(['lager'])
    expect(freigeschaltet(nurLager)).toEqual(['benutzer', 'lager', 'mpg', 'dokumente', 'dateien'].sort((a, b) => ALLE_MODULE.indexOf(a) - ALLE_MODULE.indexOf(b)))
    expect(gebucht({})).toBeNull()
    expect(freigeschaltet({})).toBeNull()
  })

  it('ohne Lager fällt das Enthaltene wieder weg — ausdrücklich Gebuchtes bleibt', () => {
    expect(modulFrei({ freigeschaltet: ['patienten'] }, 'dateien')).toBe(false)
    expect(mitEnthaltenen(['dateien'])).toEqual(['benutzer', 'dateien'])
    expect(modulFrei({ freigeschaltet: ['dateien'] }, 'dokumente')).toBe(false)
  })

  it('sagt, worin ein Modul enthalten ist', () => {
    expect(enthaltenIn('dateien', ['lager'])?.id).toBe('lager')
    expect(enthaltenIn('dokumente', ['lager', 'dokumente'])?.id).toBe('lager')
    expect(enthaltenIn('lager', ['lager'])).toBeUndefined()
    expect(enthaltenIn('dateien', ['patienten'])).toBeUndefined()
    expect(enthaltenIn('patienten', ['lager'])).toBeUndefined()
    // Die Benutzerverwaltung ist immer an — nicht "in Lager enthalten"
    expect(enthaltenIn('benutzer', ['lager'])).toBeUndefined()
  })

  it('der Katalog schließt nur bekannte Module ein und keines sich selbst', () => {
    for (const m of MODULE) for (const e of m.enthaelt ?? []) {
      expect(ALLE_MODULE.includes(e), `${m.id}: ${e}`).toBe(true)
      expect(e).not.toBe(m.id)
    }
  })
})

describe('Freischaltung: Katalog passt zur App', () => {
  it('jede Kachel gehört zu genau einem Modul — Benutzer und Einstellungen zur Benutzerverwaltung', () => {
    for (const id of Object.keys(ALL_APPS)) {
      expect(MODULE.filter((m) => m.apps.includes(id)).length, id).toBe(1)
    }
    expect(MODULE.find((m) => m.apps.includes('unitarii'))?.id).toBe('benutzer')
    expect(MODULE.find((m) => m.apps.includes('settings'))?.id).toBe('benutzer')
  })

  it('jedes Modul nennt nur bekannte Kacheln und Rechte', () => {
    const rechte = new Set([...PERM_LABELS.map((p) => p.key), 'produktausgabe'])
    for (const m of MODULE) {
      for (const a of m.apps) expect(ALL_APPS[a], `${m.id}: ${a}`).toBeDefined()
      for (const r of m.rechte) expect(rechte.has(r), `${m.id}: ${r}`).toBe(true)
    }
    expect(new Set(ALLE_MODULE).size).toBe(MODULE.length)
  })
})
