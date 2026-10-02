import { describe, it, expect } from 'vitest'
import { aelrdAusPayload, nichtUebernommen } from '../aelrdPayload'
import { aelrdHtml } from '../aelrdProtokoll'

describe('Übersetzung der alten Payload', () => {
  it('übernimmt gleichnamige Felder', () => {
    const aus = aelrdAusPayload({ name: 'Mustermann', hf: '99' })
    expect(aus.name).toBe('Mustermann')
    expect(aus.hf).toBe('99')
  })

  it('benennt die Felder um, die anders heißen', () => {
    const aus = aelrdAusPayload({
      zeit_einsatz: '02:47', zeit_eintreffen: '02:57',
      rr_sys: '136', rr_dia: '79', bz_mg: '112', naca: 'III',
    })
    expect(aus.zeit_alarm).toBe('02:47')
    expect(aus.zeit_ankunft_ort).toBe('02:57')
    expect(aus.nibp_sys).toBe('136')
    expect(aus.nibp_dia).toBe('79')
    expect(aus.bz).toBe('112')
    expect(aus.naca_initial).toBe('III')
  })

  it('rechnet die GCS-Summe aus, die es in der alten Payload nicht gibt', () => {
    // Ohne das bliebe auf dem Bogen das auffälligste Feld leer, obwohl die
    // drei Teilwerte dastehen.
    expect(aelrdAusPayload({ gcs_e: 4, gcs_v: 5, gcs_m: 6 }).gcs_summe).toBe(15)
  })

  it('lässt die GCS-Summe weg, wenn kein Teilwert erhoben wurde', () => {
    expect(aelrdAusPayload({}).gcs_summe).toBeUndefined()
  })

  it('bringt die Medikamentenliste in die Spalten des Bogens', () => {
    const aus = aelrdAusPayload({
      medications: [{ name: 'ASS', dose: '250', unit: 'mg', route: 'i.v.', time: '08:12' }],
    })
    expect(aus.medikation).toEqual([
      { zeit: '08:12', wirkstoff: 'ASS', dosis: '250 mg', applikation: 'i.v.' },
    ])
  })

  it('übersetzt gesetzte Flags in Optionen des Bogens', () => {
    expect(aelrdAusPayload({ psy_aggr: true }).psyche).toBe('aggressiv')
    expect(aelrdAusPayload({ v_trauma_penetr: true }).unfallmechanismus).toBe('penetrierend')
    expect(aelrdAusPayload({ sr: true }).ekg).toBe('sinusrhythmus')
  })

  it('erfindet keine Option, wenn kein Flag gesetzt ist', () => {
    expect(aelrdAusPayload({ psy_aggr: false }).psyche).toBeUndefined()
  })

  it('hängt heimatlose Texte beschriftet an die Anamnese statt sie zu verlieren', () => {
    const aus = aelrdAusPayload({
      notfallgeschehen: 'Meldebild: Bauchschmerzen',
      vorerkrankungen: 'Hypertonie',
      vormedikation_patient: 'ASS 100',
    })
    const text = String(aus.notfallgeschehen)
    expect(text).toContain('Meldebild: Bauchschmerzen')
    expect(text).toContain('Vorerkrankungen: Hypertonie')
    expect(text).toContain('Vormedikation: ASS 100')
  })

  it('übergeht leere Werte', () => {
    expect(Object.keys(aelrdAusPayload({ name: '', hf: null }))).toEqual([])
  })

  it('druckt ein altes Protokoll mit seinen Werten', () => {
    // Der eigentliche Zweck: ohne Übersetzung bliebe der Bogen hier leer.
    const html = aelrdHtml(aelrdAusPayload({
      name: 'Mustermann', zeit_einsatz: '02:47', rr_sys: '136', rr_dia: '79',
      gcs_e: 4, gcs_v: 5, gcs_m: 6, naca: 'III',
    }))
    for (const wert of ['Mustermann', '02:47', '136', '79', '15', 'III']) {
      expect(html).toContain(wert)
    }
  })

  it('nennt die Felder, die sie nicht abbildet', () => {
    const offen = nichtUebernommen({ name: 'X', voellig_unbekannt: 'Y' })
    expect(offen).toContain('voellig_unbekannt')
    expect(offen).not.toContain('name')
  })
})
