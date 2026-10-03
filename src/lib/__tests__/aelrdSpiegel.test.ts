import { describe, it, expect } from 'vitest'
import {
  AELRD_SPIEGELUNGEN,
  istSpiegelFeld,
  istSpiegelOption,
  spiegelAnwenden,
} from '../../katalog/aelrdSpiegel'
import { AELRD_FELDER, aelrdFeld } from '../../katalog/aelrd'
import { aelrdHtml } from '../aelrdProtokoll'

describe('Doppelte Kästchen des Bogens', () => {
  it('nennt für jede Spiegelung eine Quelle und ein Ziel, die es gibt', () => {
    const fehler: string[] = []
    for (const s of AELRD_SPIEGELUNGEN) {
      const quelle = aelrdFeld(s.quelle)
      const spiegel = aelrdFeld(s.spiegel)
      if (!quelle) fehler.push(`${s.quelle} gibt es nicht`)
      if (!spiegel) fehler.push(`${s.spiegel} gibt es nicht`)
      if (s.option) {
        const hat = (f: typeof quelle) => f?.optionen?.some((o) => o.wert === s.option)
        if (!hat(quelle)) fehler.push(`${s.quelle} hat keine Option ${s.option}`)
        if (!hat(spiegel)) fehler.push(`${s.spiegel} hat keine Option ${s.option}`)
      }
      if (s.quelle === s.spiegel) fehler.push(`${s.quelle} spiegelt sich selbst`)
    }
    expect(fehler).toEqual([])
  })

  it('spiegelt nichts, was selbst schon ein Spiegel ist', () => {
    // Sonst zeigte ein Kästchen auf ein Kästchen, das auf ein Kästchen zeigt.
    const spiegel = new Set(AELRD_SPIEGELUNGEN.map((s) => s.spiegel))
    expect(AELRD_SPIEGELUNGEN.filter((s) => spiegel.has(s.quelle))).toEqual([])
  })

  it('erkennt gespiegelte Felder und Optionen', () => {
    expect(istSpiegelFeld('rosc_1')?.quelle).toBe('rosc_zeit')
    expect(istSpiegelFeld('rosc_zeit')).toBeUndefined()
    expect(istSpiegelOption('medizintechnik', 'mechanische_thoraxkompression')?.quelle)
      .toBe('rea_massnahme')
    expect(istSpiegelOption('rea_massnahme', 'mechanische_thoraxkompression')).toBeUndefined()
  })
})

describe('Spiegeln für den Ausdruck', () => {
  it('füllt das zweite Kästchen aus der einen Erfassung', () => {
    const aus = spiegelAnwenden({ rosc_zeit: '13:05' })
    expect(aus.rosc_1).toBe('13:05')
    expect(aus.rosc_zeit).toBe('13:05')
  })

  it('ergänzt eine gespiegelte Option in der zweiten Liste', () => {
    const aus = spiegelAnwenden({ rea_massnahme: ['herzdruckmassage', 'mechanische_thoraxkompression'] })
    expect(aus.medizintechnik).toEqual(['mechanische_thoraxkompression'])
  })

  it('hängt die Option an eine Liste, die schon etwas enthält', () => {
    const aus = spiegelAnwenden({
      rea_massnahme: ['mechanische_thoraxkompression'],
      medizintechnik: ['spritzenpumpe_n'],
    })
    expect(aus.medizintechnik).toEqual(['spritzenpumpe_n', 'mechanische_thoraxkompression'])
  })

  it('setzt nichts, wenn die Quelle leer ist', () => {
    const aus = spiegelAnwenden({ rosc_zeit: '', rea_massnahme: [] })
    expect(aus.rosc_1).toBeUndefined()
    expect(aus.medizintechnik).toBeUndefined()
  })

  it('lässt alte Protokolle in Ruhe, die beide Felder getrennt führen', () => {
    // Vor der Umstellung konnte jemand "1. ROSC" anders eintragen als
    // "Zeitpunkt ROSC". Was erfasst wurde, wird gedruckt — nicht überschrieben.
    const aus = spiegelAnwenden({ rosc_zeit: '13:05', rosc_1: '13:02' })
    expect(aus.rosc_1).toBe('13:02')
  })

  it('verändert die übergebenen Daten nicht', () => {
    const vorher = { rosc_zeit: '13:05' }
    spiegelAnwenden(vorher)
    expect(vorher).toEqual({ rosc_zeit: '13:05' })
  })
})

describe('Der Ausdruck zeigt beide Kästchen', () => {
  it('druckt den ROSC-Zeitpunkt an beiden Stellen des Bogens', () => {
    // Der amtliche Vordruck hat beide Kästchen; erfasst wird nur eines.
    const html = aelrdHtml({ rosc_zeit: '13:05' })
    expect(html).toContain('1. ROSC')
    // Einmal im Reanimationsblock, einmal bei den Defibrillationszeiten.
    expect(html.split('13:05').length - 1).toBe(2)
    // Ohne Erfassung steht an beiden Stellen nichts.
    expect(aelrdHtml({}).split('13:05').length - 1).toBe(0)
  })

  it('kreuzt die mechanische Thoraxkompression in beiden Blöcken an', () => {
    const gesetzt = (html: string) =>
      html.split('<span class="kreis an"></span>mechanische Thoraxkompression').length - 1

    // Einmal erfasst, zweimal angekreuzt — unter Reanimation und unter
    // Medizintechnik, so wie es auf dem Papier steht.
    expect(gesetzt(aelrdHtml({ rea_massnahme: ['mechanische_thoraxkompression'] }))).toBe(2)

    // Ohne Erfassung bleibt auch kein Kästchen gesetzt; beide Beschriftungen
    // stehen trotzdem auf dem Bogen.
    const leer = aelrdHtml({})
    expect(gesetzt(leer)).toBe(0)
    expect(leer.split('mechanische Thoraxkompression').length - 1).toBe(2)
  })

  it('kreuzt die Entlastungspunktion in beiden Blöcken an', () => {
    const gesetzt = (html: string) =>
      html.split('<span class="kreis an"></span>Entlastungspunktion').length - 1
    expect(gesetzt(aelrdHtml({ sonstige_massnahme: ['entlastungspunktion'] }))).toBe(2)
    expect(gesetzt(aelrdHtml({}))).toBe(0)
  })
})

describe('Die Maske fragt nur einmal', () => {
  it('führt jedes gespiegelte Feld weiterhin im Katalog des Bogens', () => {
    // Entfernen wäre falsch: das Kästchen steht auf dem amtlichen Vordruck.
    const ids = new Set(AELRD_FELDER.map((f) => f.id))
    for (const s of AELRD_SPIEGELUNGEN) expect(ids.has(s.spiegel)).toBe(true)
  })
})
