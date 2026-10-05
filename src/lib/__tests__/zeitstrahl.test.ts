import { describe, it, expect } from 'vitest'
import {
  kette, offeneUebernahme, uebertragbar, zeitenUebernehmen,
} from '../../pages/public/doku/zeitstrahl'
import { dauerText, fahrminuten, streckeText } from '../osrm'
import { aelrdFeld } from '../../katalog/aelrd'

const strahl = (p: Partial<Parameters<typeof kette>[0]> = {}) =>
  ({ alarm: '13:02', ausruecken: 3, fahrt: 8, versorgung: 15, ...p })

describe('Der Einsatz-Zeitstrahl', () => {
  it('rechnet die Kette aus Alarm, Ausrücken, Fahrt und Versorgung', () => {
    const z = kette(strahl())
    expect(z.map((h) => [h.titel, h.zeit])).toEqual([
      ['Alarm', '13:02'],
      ['Status 3', '13:05'],   // + 3 Ausrücken
      ['Status 4', '13:13'],   // + 8 Fahrt
      ['Übergabe', '13:28'],   // + 15 Versorgung
      ['Status 1', '13:28'],   // wieder frei mit der Übergabe
      ['Status 2', '13:36'],   // + 8 Rückfahrt
    ])
  })

  it('lässt alles offen, solange die Fahrzeit fehlt', () => {
    const z = kette(strahl({ fahrt: null }))
    expect(z.map((h) => h.zeit)).toEqual(['13:02', '13:05', '', '', '', ''])
  })

  it('kommt ohne Alarmzeit nicht ins Rechnen', () => {
    expect(kette(strahl({ alarm: '' })).map((h) => h.zeit)).toEqual(['', '', '', '', '', ''])
  })

  it('rechnet über Mitternacht weiter', () => {
    const z = kette(strahl({ alarm: '23:50', ausruecken: 5, fahrt: 10, versorgung: 20 }))
    expect(z.find((h) => h.titel === 'Status 4')?.zeit).toBe('00:05')
    expect(z.find((h) => h.titel === 'Status 2')?.zeit).toBe('00:35')
  })

  it('trägt jeden Halt in ein Feld, das der Bogen führt', () => {
    for (const h of kette(strahl())) {
      expect(aelrdFeld(h.feld), `${h.titel} zeigt auf ${h.feld}`).toBeTruthy()
      expect(aelrdFeld(h.feld)?.typ).toBe('zeit')
    }
  })

  it('bietet alle Halte außer dem Alarm zur Übernahme an', () => {
    // Die Alarmzeit ist der Anker; sie wird nicht aus sich selbst gesetzt.
    expect(uebertragbar(strahl()).map((h) => h.id))
      .toEqual(['status3', 'status4', 'uebergabe', 'status1', 'status2'])
  })

  it('überschreibt keine eingetragene Zeit', () => {
    // Eine eingetragene Zeit ist gemessen, eine gerechnete geschätzt.
    const vorher = { zeit_alarm: '13:02', zeit_ankunft_ort: '13:11' }
    const w = zeitenUebernehmen(vorher, strahl())
    expect(w.zeit_ankunft_ort).toBe('13:11')
    expect(w.zeit_uebernahme).toBe('13:05')
    expect(w.zeit_uebergabe).toBe('13:28')
    expect(w.zeit_ende).toBe('13:36')
  })

  it('zählt, was eine Übernahme setzen würde', () => {
    expect(offeneUebernahme({ zeit_alarm: '13:02' }, strahl())).toBe(5)
    expect(offeneUebernahme({ zeit_alarm: '13:02', zeit_uebernahme: '13:06' }, strahl())).toBe(4)
    const voll = zeitenUebernehmen({ zeit_alarm: '13:02' }, strahl())
    expect(offeneUebernahme(voll, strahl())).toBe(0)
    // Ohne Fahrzeit gibt es nur den einen Halt zu übernehmen.
    expect(offeneUebernahme({}, strahl({ fahrt: null }))).toBe(1)
  })
})

describe('Fahrzeit und Strecke in Worten', () => {
  it('rundet angefangene Minuten auf', () => {
    // Eine halbe Minute Fahrt ist eine Minute, keine null.
    expect(fahrminuten(30)).toBe(1)
    expect(fahrminuten(60)).toBe(1)
    expect(fahrminuten(61)).toBe(2)
  })

  it('sagt Dauern, wie man sie sagt', () => {
    expect(dauerText(8)).toBe('8 min')
    expect(dauerText(60)).toBe('1 h')
    expect(dauerText(95)).toBe('1 h 35 min')
  })

  it('sagt Strecken, wie man sie sagt', () => {
    expect(streckeText(640)).toBe('640 m')
    expect(streckeText(8400)).toBe('8,4 km')
  })
})
