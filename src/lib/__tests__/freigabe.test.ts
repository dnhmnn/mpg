import { describe, it, expect } from 'vitest'
import { ALLE_MODULE, MODULE, appFrei, formularFrei, freigabeText, freigeschaltet, modulFrei, rechtFrei } from '../freigabe'
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
    expect(freigeschaltet({ freigeschaltet: '["eks","patienten","quatsch"]' })).toEqual(['eks', 'patienten'])
    expect(freigeschaltet({ freigeschaltet: 'kaputt' })).toBeNull()
  })

  it('eine leere Liste sperrt alle Module', () => {
    expect(modulFrei({ freigeschaltet: [] }, 'patienten')).toBe(false)
    expect(freigabeText({ freigeschaltet: [] })).toBe('keine Module')
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
    expect(freigabeText(org)).toBe(`2 von ${MODULE.length} Modulen`)
  })
})

describe('Freischaltung: Katalog passt zur App', () => {
  it('jede Kachel außer Benutzer und Einstellungen gehört zu genau einem Modul', () => {
    const ohne = ['unitarii', 'settings']
    for (const id of Object.keys(ALL_APPS)) {
      const zahl = MODULE.filter((m) => m.apps.includes(id)).length
      expect(zahl, id).toBe(ohne.includes(id) ? 0 : 1)
    }
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
