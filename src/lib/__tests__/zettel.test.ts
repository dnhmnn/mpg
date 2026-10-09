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
    // Wer bewusst woanders steht, nennt seinen Grund — und wird hier nicht
    // mitgezählt. Alle übrigen halten die Reihenfolge des Bogens.
    const ersten = ZETTEL.filter((z) => !z.ausserDerReihe).map((z) => stelle(z.abschnitte[0]))
    expect(ersten).toEqual([...ersten].sort((a, b) => a - b))
    for (const z of ZETTEL.filter((x) => x.ausserDerReihe)) {
      expect(z.ausserDerReihe!.length, `${z.id} steht ohne Grund außer der Reihe`).toBeGreaterThan(20)
    }
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
    expect(teile('massnahmen')).toEqual(['medikation', 'reanimation', 'zugaenge', 'beatmung', 'massnahmen', 'evm'])
    // Übergabe-Befund und Abschluss stehen wieder getrennt: der eine ist ein
    // Befund nach xABCDE, der andere Unterschrift und Papierkram.
    expect(teile('uebergabe')).toEqual(['uebergabe_befund', 'uebergabe_neuro'])
    expect(teile('abschluss')).toEqual(['abschluss'])
  })

  it('gibt zusammengelegten Zetteln ihre Teile zum Beschriften', () => {
    const befund = zettel.find((z) => z.id === 'befund')!
    // Der Erstbefund ist nach xABCDE gegliedert, nicht nach den Abschnitten.
    expect(befund.teile.map((t) => t.titel)).toEqual([
      'Zeitpunkt', 'Kritische Blutung', 'Atemwege', 'Atmung', 'Kreislauf',
      'Neurologie und Psyche', 'Entkleiden, Schmerz, Verletzungen',
    ])
  })

  it('lässt Zettel ohne Felder und ohne eigene Maske weg', () => {
    // Die Verlaufsbeschreibung führt keine Felder des Bogens — sie ist das
    // Kurvenblatt. Sie hat dafür eine eigene Maske und bleibt deshalb.
    const verlauf = zettel.find((z) => z.id === 'verlauf')
    expect(verlauf?.maske).toBe(true)
    expect(verlauf?.felder).toEqual([])
    expect(zettel.filter((z) => z.felder.length === 0 && !z.maske)).toEqual([])
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
    // Der Schmerz steht bei E, nicht bei D — er wird beim Entkleiden erhoben.
    expect(feld('E')).toContain('schmerz')
    expect(feld('D')).not.toContain('schmerz')
    expect(feld('E')).toContain('schmerz_nicht_beurteilbar')
    expect(feld('E')).toContain('schmerz_tolerabel')
  })
})

describe('Der Symptom-Beginn gehört zur Anamnese', () => {
  const zettel = zettelMitFeldern()
  const felder = (id: string) => zettel.find((z) => z.id === id)?.felder.map((f) => f.id) ?? []

  it('steht bei der Anamnese, nicht bei den Einsatzzeiten', () => {
    // Er beschreibt den Patienten, nicht den Einsatz, und wird im selben
    // Gespräch erfragt wie der Allgemeinzustand vor dem Ereignis.
    for (const f of ['symptombeginn', 'symptombeginn_geschaetzt', 'kollaps_beobachtet', 'symptombeginn_ueber24h']) {
      expect(felder('anamnese'), `${f} fehlt bei der Anamnese`).toContain(f)
      expect(felder('zeiten'), `${f} steht noch bei den Zeiten`).not.toContain(f)
    }
  })

  it('steht hinter dem Allgemeinzustand vor dem Ereignis', () => {
    const a = felder('anamnese')
    expect(a.indexOf('symptombeginn')).toBe(a.indexOf('az_vor_ereignis') + 1)
  })

  it('lässt beim Zeiten-Zettel nur die Einsatzzeiten', () => {
    expect(felder('zeiten').every((f) => f.startsWith('zeit_'))).toBe(true)
  })

  it('verliert dabei kein Feld des Abschnitts', () => {
    // Die Umgliederung ordnet um, sie nimmt nichts weg.
    const ausZettel = [...felder('zeiten'), ...felder('anamnese')].sort()
    const ausBogen = [...felderAusAbschnitten(ZETTEL.find((z) => z.id === 'zeiten')!),
      ...felderAusAbschnitten(ZETTEL.find((z) => z.id === 'anamnese')!)].sort()
    expect(ausZettel).toEqual(ausBogen)
  })
})

describe('Der Übergabe-Befund nach xABCDE', () => {
  const ueber = ZETTEL.find((z) => z.id === 'uebergabe')!
  const befund = ZETTEL.find((z) => z.id === 'befund')!

  it('geht dieselben Schritte wie der Erstbefund', () => {
    // Wer denselben Befund zweimal am Tag erhebt, soll ihn nicht zweimal
    // anders suchen. Die Messwerte stehen beim Erstbefund auf einem eigenen
    // Zettel und hier am Ende desselben.
    expect(ueber.gruppen!.map((g) => g.kennung || g.kurz))
      .toEqual([...befund.gruppen!.map((g) => g.kennung || g.kurz), 'M'])
  })

  it('stellt in jedem Schritt die Entsprechung des Erstbefunds', () => {
    const paare: [string, string][] = [['x', 'ub_kreislauf'], ['A', 'ub_atemwege'], ['B', 'ub_atmung']]
    for (const [kennung, feld] of paare) {
      expect(ueber.gruppen!.find((g) => g.kennung === kennung)?.felder).toEqual([feld])
    }
    // Was der Erstbefund bei C und D führt, führt die Übergabe auch — soweit
    // der Bogen es dort erhebt.
    const c = ueber.gruppen!.find((g) => g.kennung === 'C')!.felder
    expect(c).toContain('ub_radialispuls')
    expect(c).toContain('ub_ekg')
    const d = ueber.gruppen!.find((g) => g.kennung === 'D')!.felder
    expect(d).toContain('ub_gcs_summe')
    expect(d).toContain('ub_psyche')
  })

  it('verliert kein Feld und führt keines doppelt', () => {
    const ausSchema = ueber.gruppen!.flatMap((g) => g.felder)
    expect([...ausSchema].sort()).toEqual([...felderAusAbschnitten(ueber)].sort())
    expect(ausSchema.length).toBe(new Set(ausSchema).size)
  })

  it('nennt nur Felder, die es im Bogen gibt', () => {
    expect(ueber.gruppen!.flatMap((g) => g.felder).filter((id) => !aelrdFeld(id))).toEqual([])
  })
})
