import { describe, it, expect } from 'vitest'
import { AELRD_FELDER, aelrdFeld } from '../../katalog/aelrd'
import {
  UEBERGABE_OHNE_QUELLE,
  normalbefund,
  uebergabePaare,
  uebergabeQuelle,
  uebergabeUebernehmen,
  uebernahmeUmfang,
} from '../../katalog/uebernahme'

describe('Übergabebefund aus dem Erstbefund', () => {
  it('kennt zu jedem Übergabefeld eine Quelle oder nennt es ausdrücklich', () => {
    // Ein neues ub_-Feld soll nicht stillschweigend aus der Übernahme fallen:
    // es würde dann bei jedem Einsatz von Hand gesetzt, ohne dass es auffällt.
    const ohne = AELRD_FELDER
      .filter((f) => f.id.startsWith('ub_'))
      .filter((f) => !uebergabeQuelle(f.id) && !UEBERGABE_OHNE_QUELLE.includes(f.id))
      .map((f) => `${f.id} (${f.label})`)
    expect(ohne).toEqual([])
  })

  it('zeigt nur auf Felder, die es gibt', () => {
    const kaputt = uebergabePaare().filter(([ziel, quelle]) => !aelrdFeld(ziel) || !aelrdFeld(quelle))
    expect(kaputt).toEqual([])
  })

  it('paart nur Felder gleicher Art', () => {
    // Sonst landete eine Optionsliste in einem Zahlenfeld.
    const falsch = uebergabePaare()
      .filter(([ziel, quelle]) => aelrdFeld(ziel)!.typ !== aelrdFeld(quelle)!.typ)
      .map(([z, q]) => `${z} (${aelrdFeld(z)!.typ}) ← ${q} (${aelrdFeld(q)!.typ})`)
    expect(falsch).toEqual([])
  })

  it('übernimmt den ganzen Befund auf einmal', () => {
    const aus = uebergabeUebernehmen({
      atmung: ['unauffaellig'], hf: '72', nibp_sys: '130', bewusstsein: 'wach', schmerz: '3',
    })
    expect(aus.ub_atmung).toEqual(['unauffaellig'])
    expect(aus.ub_hf).toBe('72')
    expect(aus.ub_nibp_sys).toBe('130')
    expect(aus.ub_bewusstsein).toBe('wach')
    expect(aus.ub_schmerz).toBe('3')
  })

  it('überschreibt nicht, was bei der Übergabe schon anders steht', () => {
    // Ein abweichender Übergabewert ist die eigentliche Aussage des Blocks.
    const aus = uebergabeUebernehmen({ hf: '72', ub_hf: '110' })
    expect(aus.ub_hf).toBe('110')
  })

  it('kopiert Listen, statt sie zu teilen', () => {
    const werte: Record<string, unknown> = { atmung: ['unauffaellig'] }
    const aus = uebergabeUebernehmen(werte)
    ;(aus.ub_atmung as string[]).push('apnoe')
    expect(werte.atmung).toEqual(['unauffaellig'])
  })

  it('lässt leere Quellen leer', () => {
    const aus = uebergabeUebernehmen({ hf: '', atmung: [] })
    expect(aus.ub_hf).toBeUndefined()
    expect(aus.ub_atmung).toBeUndefined()
  })

  it('verändert die übergebenen Werte nicht', () => {
    const vorher = { hf: '72' }
    uebergabeUebernehmen(vorher)
    expect(vorher).toEqual({ hf: '72' })
  })

  it('zählt, wie viel eine Übernahme setzen würde', () => {
    expect(uebernahmeUmfang({})).toBe(0)
    expect(uebernahmeUmfang({ hf: '72' })).toBe(1)
    expect(uebernahmeUmfang({ hf: '72', ub_hf: '110' })).toBe(0)
  })

  it('deckt den Übergabeblock weitgehend ab', () => {
    // Der Block hat 36 Felder; wenn die Übernahme nur eine Handvoll träfe,
    // wäre der Knopf eine Täuschung.
    expect(uebergabePaare().length).toBeGreaterThanOrEqual(30)
  })
})

describe('Normalbefund', () => {
  it('setzt nur Optionen, die es im Katalog gibt', () => {
    const b = normalbefund()
    for (const [id, wert] of Object.entries(b)) {
      if (typeof wert === 'boolean') continue
      const feld = aelrdFeld(id)!
      const werte = Array.isArray(wert) ? wert : [wert]
      for (const w of werte) {
        expect(feld.optionen?.some((o) => o.wert === w)).toBe(true)
      }
    }
  })

  it('beschreibt den Befund, ohne Messwerte zu erfinden', () => {
    // Einen Befund als unauffällig zu beschreiben ist eine Aussage; eine
    // Herzfrequenz zu setzen, die niemand gemessen hat, wäre eine Erfindung.
    const b = normalbefund()
    for (const id of ['hf', 'af', 'spo2', 'nibp_sys', 'nibp_dia', 'temp', 'bz', 'gcs_summe', 'schmerz']) {
      expect(b[id]).toBeUndefined()
    }
  })

  it('deckt die Befundblöcke des Bogens ab', () => {
    const b = normalbefund()
    for (const id of ['atemwege', 'atmung', 'kreislauf', 'haut', 'psyche', 'ekg']) {
      expect(b[id]).toBeDefined()
    }
    expect(b.neuro_ohne_befund).toBe(true)
  })

  it('setzt bei Mehrfachauswahl eine Liste, bei Einfachauswahl einen Wert', () => {
    const b = normalbefund()
    expect(Array.isArray(b.atmung)).toBe(true)
    expect(Array.isArray(b.kreislauf)).toBe(false)
  })
})
