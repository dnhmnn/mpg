import { describe, it, expect } from 'vitest'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { istSpiegelFeld } from '../../katalog/aelrdSpiegel'
import { zettelMitFeldern } from '../../pages/public/doku/zettel'

/**
 * Angesehen wird in derselben Maske, in der erfasst wird — es gibt keine
 * zweite Darstellung mehr, die abweichen könnte. Was die Zettel führen, ist
 * damit zugleich das, was jeder zu sehen bekommt: ein Feld, das hier
 * herausfiele, wäre erfasst und unsichtbar.
 */
describe('Was die Maske führt — und damit jeder zu sehen bekommt', () => {
  const zettel = zettelMitFeldern()
  const gezeigt = new Set(zettel.flatMap((z) => z.felder).map((f) => f.id))

  it('zeigt jedes Feld des Bogens', () => {
    const imBogen = AELRD_ABSCHNITTE
      .flatMap((a) => a.felder)
      .filter((id) => !istSpiegelFeld(id))
      .filter((id) => aelrdFeld(id))
    const fehlt = imBogen.filter((id) => !gezeigt.has(id))
    expect(fehlt).toEqual([])
  })

  it('zeigt sie in der Reihenfolge der Maske, nicht des Papiers', () => {
    // Darum geht es: wer die Maske kennt, findet hier dasselbe an derselben
    // Stelle. Der Erstbefund steht deshalb nach xABCDE.
    const befund = zettel.find((z) => z.id === 'befund')!
    expect(befund.teile.map((t) => t.kennung || t.kurz)).toEqual(['Z', 'x', 'A', 'B', 'C', 'D', 'E'])
  })

  it('führt dieselben elf Zettel wie die Maske', () => {
    expect(zettel.map((z) => z.kurz)).toEqual([
      'PAT', 'EINS', 'ZEIT', 'ANAM', 'BEF', 'VITAL', 'DIAG', 'MASS', 'VERL', 'ÜBER', 'ENDE',
    ])
  })

  it('führt kein Feld zweimal', () => {
    // Doppelt gezeigt hieße: zweimal geändert, und beim zweiten Mal gewinnt
    // der Zufall.
    const alle = zettel.flatMap((z) => z.felder).map((f) => f.id)
    expect(alle.filter((id, i) => alle.indexOf(id) !== i)).toEqual([])
  })
})
