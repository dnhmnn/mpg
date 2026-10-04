import { describe, it, expect } from 'vitest'
import { ZETTEL, zettelMitFeldern } from '../../pages/public/doku/zettel'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { istSpiegelFeld } from '../../katalog/aelrdSpiegel'

/** Abschnitte des Bogens, die überhaupt Felder führen. */
const mitFeldern = AELRD_ABSCHNITTE.filter((a) =>
  a.felder.filter((id) => !istSpiegelFeld(id)).some((id) => aelrdFeld(id)),
)

describe('Die Gliederung der Zettel', () => {
  it('lässt keinen Abschnitt des Bogens liegen', () => {
    // Ein Abschnitt, der auf keinem Zettel steht, waere im Formular nicht
    // erreichbar — und es fiele erst am leeren Protokoll auf.
    const vergeben = new Set(ZETTEL.flatMap((z) => z.abschnitte))
    expect(mitFeldern.filter((a) => !vergeben.has(a.id)).map((a) => a.id)).toEqual([])
  })

  it('führt keinen Abschnitt auf zwei Zetteln', () => {
    const alle = ZETTEL.flatMap((z) => z.abschnitte)
    const doppelt = alle.filter((id, i) => alle.indexOf(id) !== i)
    expect(doppelt).toEqual([])
  })

  it('nennt nur Abschnitte, die es im Bogen gibt', () => {
    const bekannt = new Set(AELRD_ABSCHNITTE.map((a) => a.id))
    expect(ZETTEL.flatMap((z) => z.abschnitte).filter((id) => !bekannt.has(id))).toEqual([])
  })

  it('behält die Reihenfolge des Papiers', () => {
    // Der Zettel steht an der Stelle seines ersten Abschnitts; die Folge der
    // Zettel darf die Folge des Bogens nicht umkehren.
    const stelle = (id: string) => AELRD_ABSCHNITTE.findIndex((a) => a.id === id)
    const ersten = ZETTEL.map((z) => stelle(z.abschnitte[0]))
    expect(ersten).toEqual([...ersten].sort((a, b) => a - b))
  })

  it('hat eindeutige Kennungen und kurze Kurzzeichen', () => {
    expect(ZETTEL.map((z) => z.id).length).toBe(new Set(ZETTEL.map((z) => z.id)).size)
    expect(ZETTEL.map((z) => z.kurz).length).toBe(new Set(ZETTEL.map((z) => z.kurz)).size)
    expect(ZETTEL.filter((z) => z.kurz.length > 5)).toEqual([])
  })
})

describe('Was die Zettel tragen', () => {
  const zettel = zettelMitFeldern()

  it('verliert kein Feld gegenüber dem Bogen', () => {
    const imBogen = mitFeldern
      .flatMap((a) => a.felder)
      .filter((id) => !istSpiegelFeld(id))
      .filter((id) => aelrdFeld(id))
    const aufZetteln = zettel.flatMap((z) => z.felder).map((f) => f.id)
    expect(aufZetteln.length).toBe(imBogen.length)
    expect(new Set(aufZetteln).size).toBe(new Set(imBogen).size)
  })

  it('legt die verlangten Abschnitte zusammen', () => {
    const teile = (id: string) => zettel.find((z) => z.id === id)?.abschnitte
    expect(teile('patient')).toEqual(['stammdaten', 'kennung'])
    expect(teile('einsatz')).toEqual(['einsatzdaten', 'besatzung'])
    expect(teile('befund')).toEqual(['erstbefund', 'neurologie', 'untersuchung'])
  })

  it('gibt zusammengelegten Zetteln ihre Teile zum Beschriften', () => {
    const befund = zettel.find((z) => z.id === 'befund')!
    expect(befund.teile.map((t) => t.titel)).toEqual([
      'Erstbefund', 'Neurologie', 'Untersuchung und Psyche',
    ])
  })

  it('lässt Zettel ohne Felder weg', () => {
    // Die Verlaufsbeschreibung ist auf dem Papier das Kurvenblatt.
    expect(zettel.map((z) => z.id)).not.toContain('verlauf')
  })
})
