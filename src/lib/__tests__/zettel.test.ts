import { describe, it, expect } from 'vitest'
import { ZETTEL, felderAusAbschnitten, zettelMitFeldern } from '../../pages/public/doku/zettel'
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
    expect(teile('befund')).toEqual(['erstbefund', 'neurologie', 'untersuchung', 'verletzungen'])
    expect(teile('massnahmen')).toEqual(['medikation', 'reanimation', 'zugaenge', 'beatmung', 'massnahmen'])
    expect(teile('uebergabe')).toEqual(['uebergabe_befund', 'uebergabe_neuro', 'abschluss'])
  })

  it('gibt zusammengelegten Zetteln ihre Teile zum Beschriften', () => {
    const befund = zettel.find((z) => z.id === 'befund')!
    // Der Erstbefund ist nach xABCDE gegliedert, nicht nach den Abschnitten.
    expect(befund.teile.map((t) => t.titel)).toEqual([
      'Zeitpunkt', 'Kritische Blutung', 'Atemwege', 'Atmung', 'Kreislauf',
      'Neurologie und Psyche', 'Entkleiden, Verletzungen, Umgebung',
    ])
  })

  it('lässt Zettel ohne Felder weg', () => {
    // Die Verlaufsbeschreibung ist auf dem Papier das Kurvenblatt.
    expect(zettel.map((z) => z.id)).not.toContain('verlauf')
  })
})

describe('Der Erstbefund nach xABCDE', () => {
  const befund = ZETTEL.find((z) => z.id === 'befund')!
  const gruppen = befund.gruppen!

  it('geht die Schritte in der Reihenfolge des Schemas', () => {
    expect(gruppen.map((g) => g.kennung)).toEqual(['', 'x', 'A', 'B', 'C', 'D', 'E'])
  })

  it('beginnt mit der kritischen Blutung, vor dem Atemweg', () => {
    const x = gruppen.findIndex((g) => g.kennung === 'x')
    const a = gruppen.findIndex((g) => g.kennung === 'A')
    expect(x).toBeLessThan(a)
    // Der Bogen führt keine eigene Angabe dafür — die Option "Blutung" steckt
    // im Kreislauf-Feld, und genau das steht hier als x-Schritt.
    expect(gruppen[x].felder).toEqual(['kreislauf'])
    expect(aelrdFeld('kreislauf')?.optionen?.some((o) => o.text === 'Blutung')).toBe(true)
  })

  it('verliert kein Feld und führt keines doppelt', () => {
    // Die Umgliederung ordnet nur um. Ein Feld, das dabei herausfällt, wäre
    // im Formular nicht mehr erreichbar.
    const ausSchema = gruppen.flatMap((g) => g.felder)
    const ausBogen = felderAusAbschnitten(befund)
    expect([...ausSchema].sort()).toEqual([...ausBogen].sort())
    expect(ausSchema.length).toBe(new Set(ausSchema).size)
  })

  it('nennt nur Felder, die es im Bogen gibt', () => {
    const unbekannt = gruppen.flatMap((g) => g.felder).filter((id) => !aelrdFeld(id))
    expect(unbekannt).toEqual([])
  })

  it('ordnet die Organsysteme ihren Buchstaben zu', () => {
    const feld = (k: string) => gruppen.find((g) => g.kennung === k)!.felder
    expect(feld('A')).toContain('atemwege')
    expect(feld('B')).toContain('atmung')
    expect(feld('C')).toContain('ekg')
    expect(feld('C')).toContain('rekap_zeit')
    expect(feld('D')).toContain('gcs_summe')
    expect(feld('D')).toContain('psyche')
    expect(feld('E')).toContain('verl_thorax')
    expect(feld('E')).toContain('sturz')
  })
})
