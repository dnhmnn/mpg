import { describe, it, expect } from 'vitest'
import {
  PUPILLEN_FELDER, PUPILLEN_FRAGEN, pupillenLeer, pupillenText, seitengleich,
} from '../../katalog/pupillen'
import { normOptionen } from '../../katalog/aelrdOptionen'
import { aelrdFeld } from '../../katalog/aelrd'

const beide = (weite: string, licht: string) => ({
  pupillen_weite_re: weite, pupillen_weite_li: weite,
  pupillen_licht_re: licht, pupillen_licht_li: licht,
})

describe('Der Pupillenstatus', () => {
  it('nimmt seine Antworten aus der Norm', () => {
    expect(PUPILLEN_FRAGEN[0].antworten.map((a) => a.text))
      .toEqual((normOptionen('pupillen_weite_re') ?? []).map((o) => o.text))
    expect(PUPILLEN_FRAGEN[1].antworten.map((a) => a.text))
      .toEqual((normOptionen('pupillen_licht_re') ?? []).map((o) => o.text))
  })

  it('führt die vier Felder des Bogens, rechts und links je Frage', () => {
    expect(PUPILLEN_FELDER).toEqual([
      'pupillen_weite_re', 'pupillen_weite_li', 'pupillen_licht_re', 'pupillen_licht_li',
    ])
    for (const f of PUPILLEN_FELDER) expect(aelrdFeld(f), `${f} fehlt im Katalog`).toBeTruthy()
  })

  it('erkennt den Seitenvergleich', () => {
    expect(seitengleich(beide('mittel', 'prompt'))).toBe(true)
    expect(seitengleich({ ...beide('mittel', 'prompt'), pupillen_weite_li: 'weit' })).toBe(false)
    // Leer ist nicht seitengleich — sonst behauptete die Maske einen Befund.
    expect(seitengleich({})).toBe(false)
    // Eine Frage, die auf beiden Seiten offen ist, sagt nichts über die
    // Seitengleichheit; die beantwortete sagt es.
    expect(seitengleich({ pupillen_weite_re: 'mittel', pupillen_weite_li: 'mittel' })).toBe(true)
    expect(seitengleich({ pupillen_weite_re: 'mittel', pupillen_weite_li: 'weit' })).toBe(false)
    // Halb beantwortet ist nicht gleich: eine Seite steht, die andere nicht.
    expect(seitengleich({ pupillen_weite_re: 'mittel' })).toBe(false)
  })

  it('sagt den Befund in einer Zeile', () => {
    expect(pupillenText(beide('mittel', 'prompt'))).toBe('mittel, prompt — seitengleich')
    expect(pupillenText({
      pupillen_weite_re: 'weit', pupillen_weite_li: 'mittel',
      pupillen_licht_re: 'keine', pupillen_licht_li: 'prompt',
    })).toBe('rechts weit, keine · links mittel, prompt')
  })

  it('schweigt, solange nichts erhoben ist', () => {
    expect(pupillenLeer({})).toBe(true)
    expect(pupillenText({})).toBe('')
    expect(pupillenLeer({ pupillen_weite_re: 'eng' })).toBe(false)
  })

  it('nennt auch den halben Befund, statt ihn zu verschweigen', () => {
    // Nur die Weite erhoben, die Lichtreaktion noch nicht.
    expect(pupillenText({ pupillen_weite_re: 'eng', pupillen_weite_li: 'eng' }))
      .toBe('eng — seitengleich')
    expect(pupillenText({ pupillen_weite_re: 'eng' })).toBe('rechts eng · links –')
  })
})
