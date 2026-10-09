import { describe, it, expect } from 'vitest'
import {
  REGELN, ZUSATZSCHLUESSEL, offeneErwartung, offenePflicht, patientVersorgt,
  pflichtKarte, transportiert,
} from '../../katalog/pflicht'
import { aelrdFeld } from '../../katalog/aelrd'
import { normOptionen } from '../../katalog/aelrdOptionen'

const offen = (p: Record<string, unknown>) => offenePflicht(p).map((s) => s.feld)

describe('Was ein Protokoll verlangt', () => {
  it('nennt nur Felder, die es im Bogen gibt', () => {
    for (const r of REGELN) {
      expect(aelrdFeld(r.feld), `${r.feld} steht nicht im Katalog`).toBeTruthy()
      for (const e of r.erfuelltDurch ?? []) {
        // Ausweichangaben sind Felder des Bogens — oder einer der wenigen
        // Schlüssel, die das Protokoll zusätzlich führt.
        expect(
          Boolean(aelrdFeld(e)) || ZUSATZSCHLUESSEL.includes(e),
          `${e} ist weder Feld noch bekannter Zusatz`,
        ).toBe(true)
      }
    }
  })

  it('gibt jeder Regel einen Grund, den die Maske zeigen kann', () => {
    for (const r of REGELN) expect(r.grund.trim().length, r.feld).toBeGreaterThan(3)
  })

  it('verlangt beim Fehleinsatz keine Vitalwerte', () => {
    // Kein Patient, keine Messwerte, keine Übergabe — alles andere wäre eine
    // Pflicht, die sich nicht erfüllen lässt.
    expect(patientVersorgt({ einsatz_art: 'Fehleinsatz' })).toBe(false)
    const o = offen({ einsatz_art: 'Fehleinsatz' })
    expect(o).not.toContain('hf')
    expect(o).not.toContain('spo2')
    expect(o).not.toContain('gcs_summe')
    expect(o).not.toContain('zeit_ankunft_ort')
    // Was bleibt, hängt nicht am Patienten — auch ein Fehleinsatz wird
    // unterschrieben.
    expect(o).toEqual([
      'einsatz_nr', 'auftrags_nr', 'einsatz_datum', 'zeit_alarm', 'mannschaft_tf', 'notfallgeschehen', 'unterschrift',
    ])
  })

  it('kennt die Einsatzarten, auf die es sich beruft', () => {
    // Stünde "Fehleinsatz" anders im Katalog, griffe die Bedingung nie.
    const arten = (normOptionen('einsatz_art') ?? []).map((o) => o.wert)
    expect(arten).toContain('Fehleinsatz')
    expect(arten).toContain('vorsorgliche Bereitstellung')
  })

  it('verlangt die Übergabe, sobald ein Patient versorgt wurde', () => {
    // Zuerst hing sie am Transportziel — und das steht erst da, wenn es
    // jemand eingetragen hat. Bis dahin war der ganze Übergabe-Zettel
    // unmarkiert: man sah erst, was verlangt wird, nachdem man es getan hatte.
    expect(transportiert({})).toBe(false)
    expect(offen({ einsatz_art: 'Primäreinsatz' })).toContain('zeit_uebergabe')
    expect(offen({ einsatz_art: 'Primäreinsatz' })).toContain('ub_atemwege')
    // Ohne Patient bleibt die Übergabe draußen.
    expect(offen({ einsatz_art: 'Fehleinsatz' })).not.toContain('zeit_uebergabe')
    expect(offen({ einsatz_art: 'Fehleinsatz' }).filter((f) => f.startsWith('ub_'))).toEqual([])
  })

  it('lässt den Schmerz durch die Angabe erfüllen, dass er nicht beurteilbar war', () => {
    // Genau dafür führt der Bogen "NRS nicht beurteilbar".
    expect(offen({ einsatz_art: 'Primäreinsatz' })).toContain('schmerz')
    expect(offen({ einsatz_art: 'Primäreinsatz', schmerz_nicht_beurteilbar: true })).not.toContain('schmerz')
    expect(offen({ einsatz_art: 'Primäreinsatz', schmerz: '0' })).not.toContain('schmerz')
  })

  it('nimmt statt der GCS auch die Bewusstseinslage', () => {
    expect(offen({ einsatz_art: 'Primäreinsatz', bewusstsein: 'wach' })).not.toContain('gcs_summe')
  })

  it('verlangt je einen Wert für Kreislauf und Atmung, nicht alle vier', () => {
    const mitPuls = { einsatz_art: 'Primäreinsatz', puls: '80', af: '16' }
    expect(offen(mitPuls)).not.toContain('hf')
    expect(offen(mitPuls)).not.toContain('spo2')
    // Auch der tastbare Radialispuls zählt — manchmal ist das alles, was geht.
    expect(offen({ einsatz_art: 'Primäreinsatz', radialispuls: 'ja', atmung: ['unauffaellig'] }))
      .not.toContain('hf')
  })

  it('erzwingt Name und Geburtsdatum nicht', () => {
    // Ein bewusstloser Patient ohne Papiere ist Alltag. Erzwungen käme
    // "unbekannt" und "01.01.1900" heraus — das sieht aus wie eine Angabe.
    expect(offen({})).not.toContain('name')
    expect(offen({})).not.toContain('gebdatum')
    expect(offeneErwartung({}).map((s) => s.feld)).toContain('name')
  })

  it('zieht die Pflicht zurück, sobald der Fall sie nicht mehr trägt', () => {
    expect(offen({ einsatz_art: 'Primäreinsatz' })).toContain('zeit_uebergabe')
    // Fehleinsatz nachgetragen: der Transport ist keiner mehr.
    expect(offen({ einsatz_art: 'Fehleinsatz' })).not.toContain('zeit_uebergabe')
  })

  it('sagt zu jeder Angabe, ob sie erfüllt ist', () => {
    const karte = pflichtKarte({ einsatz_nr: '2026-0815', einsatz_art: 'Primäreinsatz' })
    expect(karte.get('einsatz_nr')?.erfuellt).toBe(true)
    expect(karte.get('notfallgeschehen')?.erfuellt).toBe(false)
    expect(karte.get('notfallgeschehen')?.stufe).toBe('pflicht')
    expect(karte.get('name')?.stufe).toBe('erwartet')
    // Ein Primäreinsatz führt zur Übergabe — sie steht also auf der Karte,
    // nur eben noch unerfüllt.
    expect(karte.get('zeit_uebergabe')?.erfuellt).toBe(false)
    // Ohne Patient steht sie gar nicht drauf.
    expect(pflichtKarte({ einsatz_art: 'Fehleinsatz' }).has('zeit_uebergabe')).toBe(false)
  })
})

describe('Maßnahmen, Reanimation und Übergabe', () => {
  it('verlangt die Medikation — oder die Angabe, dass keine gegeben wurde', () => {
    const p = { einsatz_art: 'Primäreinsatz' }
    expect(offen(p)).toContain('medikation')
    expect(offen({ ...p, keine_medikation: true })).not.toContain('medikation')
  })

  it('fragt die Reanimationssituation erst, wenn reanimiert wurde', () => {
    // Für einen verstauchten Knöchel wäre sie eine Pflicht ohne Gegenstand.
    const p = { einsatz_art: 'Primäreinsatz' }
    expect(offen(p)).not.toContain('rea_situation')
    expect(offen({ ...p, rea_massnahme: ['herzdruckmassage'] })).toContain('rea_situation')
    expect(offen({ ...p, rosc_zeit: '08:42' })).toContain('rea_situation')
  })

  it('verlangt bei der Übergabe dasselbe wie beim Erstbefund', () => {
    const ueber = offen({ einsatz_art: 'Primäreinsatz' }).filter((f) => f.startsWith('ub_'))
    const erst = offen({ einsatz_art: 'Primäreinsatz' })
    // Jede Angabe des Erstbefunds, die es bei der Übergabe gibt, wird dort
    // auch verlangt. (Die Haut führt der Bogen bei der Übergabe nicht.)
    for (const f of erst) {
      const ub = f === 'rekap_zeit' ? 'ub_rekap' : `ub_${f}`
      if (!aelrdFeld(ub)) continue
      expect(ueber, `${ub} fehlt bei der Übergabe`).toContain(ub)
    }
  })

  it('verlangt die Unterschrift unter jedem Protokoll', () => {
    expect(offen({ einsatz_art: 'Fehleinsatz' })).toContain('unterschrift')
    // Die gezeichnete erfüllt sie.
    expect(offen({ einsatz_art: 'Fehleinsatz', signature: 'data:image/png;base64,x' }))
      .not.toContain('unterschrift')
  })
})
