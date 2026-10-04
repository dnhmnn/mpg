import { describe, it, expect } from 'vitest'
import {
  jetztZeit, massnahmeEintragen, massnahmeStreichen, massnahmenLesen,
  massnahmenAbsteigend, zeile,
} from '../../pages/public/doku/massnahmen'
import {
  MASSNAHMEN_FELDER, MASSNAHMEN_KATEGORIEN, massnahmeKategorie,
} from '../../katalog/massnahmenArten'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { istSpiegelOption } from '../../katalog/aelrdSpiegel'
import { aelrdHtml } from '../aelrdProtokoll'

const ein = (w: Record<string, unknown>, kategorie: string, art: string, zeit = '08:42') =>
  massnahmeEintragen(w, { zeit, kategorie, art })

describe('Die Arten der Maßnahmen', () => {
  it('nimmt ihre Listen aus dem Katalog des Bogens, nicht aus einer zweiten', () => {
    for (const k of MASSNAHMEN_KATEGORIEN) {
      const feld = aelrdFeld(k.id)
      expect(feld, `${k.id} steht nicht im Katalog`).toBeTruthy()
      expect(k.arten.length, `${k.titel} führt keine Arten`).toBeGreaterThan(0)
      // Kreuz-Kategorien: die Optionen des Feldes, ohne die gespiegelten —
      // "mechanische Thoraxkompression" wird bei der Reanimation erhoben und
      // steht auf dem Bogen nur noch ein zweites Mal.
      if (!k.frei) {
        expect(k.arten.map((a) => a.wert)).toEqual(
          feld!.optionen!.map((o) => o.wert).filter((wert) => !istSpiegelOption(k.id, wert)),
        )
      }
    }
  })

  it('lässt die Reanimation außen vor — sie hat ihren eigenen Abschnitt', () => {
    expect(MASSNAHMEN_FELDER).not.toContain('rea_massnahme')
    const abschnitt = AELRD_ABSCHNITTE.find((a) => a.id === 'massnahmen')
    expect(abschnitt?.felder).toContain('rea_massnahme')
  })

  it('deckt die Felder ab, die der Bogen unter Maßnahmen führt', () => {
    const abschnitt = AELRD_ABSCHNITTE.find((a) => a.id === 'massnahmen')!
    const offen = abschnitt.felder.filter((f) => f !== 'rea_massnahme' && !MASSNAHMEN_FELDER.includes(f))
    expect(offen).toEqual([])
  })

  it('führt die Zeit nur in der Erfassung, nicht als neue Spalte im Vordruck', () => {
    // Zwei Kategorien: eine mit Schreiblinie, eine mit Kreuzen.
    expect(massnahmeKategorie('zugaenge')?.frei).toBe(true)
    expect(massnahmeKategorie('medizintechnik')?.frei).toBe(false)
  })
})

describe('Maßnahmen im Verlauf', () => {
  it('schreibt die Uhrzeit zweistellig, auch vor zehn', () => {
    expect(jetztZeit(new Date(2026, 0, 1, 8, 5))).toBe('08:05')
    expect(jetztZeit(new Date(2026, 0, 1, 23, 59))).toBe('23:59')
  })

  it('setzt mit dem Eintrag das Kreuz auf dem Bogen', () => {
    const w = ein({}, 'medizintechnik', 'spritzenpumpe_n')
    expect(w.medizintechnik).toEqual(['spritzenpumpe_n'])
    expect(massnahmenLesen(w)).toHaveLength(1)
    expect(massnahmenLesen(w)[0]).toMatchObject({ zeit: '08:42', kategorie: 'medizintechnik', art: 'spritzenpumpe_n' })
  })

  it('schreibt auf die Linie des Bogens mit Uhrzeit — dort hat sie Platz', () => {
    let w = ein({}, 'zugaenge', 'peripherer Zugang', '08:42')
    w = ein(w, 'zugaenge', 'intraossäre Punktion', '08:55')
    expect(w.zugaenge).toBe('08:42 peripherer Zugang · 08:55 intraossäre Punktion')
  })

  it('hängt an einen vorhandenen Text an, statt ihn zu überschreiben', () => {
    // Aus dem alten Formular kann auf der Linie schon etwas stehen.
    const w = ein({ zugaenge: 'Handrücken links' }, 'zugaenge', 'peripherer Zugang')
    expect(w.zugaenge).toBe('Handrücken links · 08:42 peripherer Zugang')
  })

  it('zählt mehrere Einträge und zeigt den neuesten oben', () => {
    let w = ein({}, 'medizintechnik', 'ecmo', '09:01')
    w = ein(w, 'blutentnahme', 'venoes', '09:05')
    expect(massnahmenAbsteigend(w).map((m) => m.zeit)).toEqual(['09:05', '09:01'])
  })

  it('streicht einen Eintrag mitsamt seinem Kreuz', () => {
    const w = ein({}, 'medizintechnik', 'ecmo')
    const leer = massnahmeStreichen(w, massnahmenLesen(w)[0].id)
    expect(leer.medizintechnik).toEqual([])
    expect(massnahmenLesen(leer)).toEqual([])
  })

  it('lässt das Kreuz stehen, solange ein zweiter Eintrag es trägt', () => {
    // Zweimal abgesaugt, einmal gestrichen: das Kreuz gilt weiter.
    let w = ein({}, 'medizintechnik', 'ecmo', '09:01')
    w = ein(w, 'medizintechnik', 'ecmo', '09:30')
    w = massnahmeStreichen(w, massnahmenLesen(w)[0].id)
    expect(w.medizintechnik).toEqual(['ecmo'])
    expect(massnahmenLesen(w)).toHaveLength(1)
  })

  it('rührt Kreuze nicht an, zu denen es keinen Eintrag gibt', () => {
    // Älteres Protokoll: das Kreuz steht, der Verlauf ist leer.
    let w: Record<string, unknown> = { medizintechnik: ['ultraschall_sono_echo'] }
    w = ein(w, 'medizintechnik', 'ecmo')
    expect(w.medizintechnik).toEqual(['ultraschall_sono_echo', 'ecmo'])
    w = massnahmeStreichen(w, massnahmenLesen(w)[0].id)
    expect(w.medizintechnik).toEqual(['ultraschall_sono_echo'])
  })

  it('hält bei der Einfachauswahl nur eine Angabe — die letzte', () => {
    let w = ein({}, 'blutentnahme', 'venoes', '09:01')
    w = ein(w, 'blutentnahme', 'arteriell', '09:10')
    expect(w.blutentnahme).toBe('arteriell')
    // Die arterielle gestrichen: es gilt wieder die venöse.
    const spaeter = massnahmenAbsteigend(w)[0]
    w = massnahmeStreichen(w, spaeter.id)
    expect(w.blutentnahme).toBe('venoes')
  })

  it('nimmt die Linie beim Streichen zeilenweise zurück', () => {
    let w = ein({}, 'lagerung', 'Vakuummatratze', '08:42')
    w = ein(w, 'lagerung', 'Schaufeltrage', '08:50')
    const erste = massnahmenLesen(w)[0]
    w = massnahmeStreichen(w, erste.id)
    expect(w.lagerung).toBe('08:50 Schaufeltrage')
  })

  it('trägt nichts ein ohne Art und nichts in eine unbekannte Kategorie', () => {
    expect(massnahmenLesen(ein({}, 'medizintechnik', '   '))).toEqual([])
    expect(massnahmenLesen(ein({}, 'gibtsnicht', 'irgendwas'))).toEqual([])
    expect(massnahmeStreichen({}, 'm1')).toEqual({})
  })

  it('gibt jedem Eintrag eine eigene Kennung, auch nach dem Streichen', () => {
    let w = ein({}, 'medizintechnik', 'ecmo', '09:01')
    w = ein(w, 'medizintechnik', 'notfallpacer', '09:02')
    w = massnahmeStreichen(w, 'm1')
    w = ein(w, 'medizintechnik', 'spritzenpumpe_n', '09:03')
    const ids = massnahmenLesen(w).map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('übergeht kaputte Einträge statt daran zu scheitern', () => {
    expect(massnahmenLesen({ massnahmen: 'nichts' })).toEqual([])
    expect(massnahmenLesen({ massnahmen: [null, 7, { id: 'm1' }] })).toEqual([])
  })

  it('steht so im Ausdruck, wie der Vordruck es führt', () => {
    let w = ein({}, 'zugaenge', 'peripherer Zugang', '08:42')
    w = ein(w, 'medizintechnik', 'ecmo', '08:50')
    const html = aelrdHtml(w)
    // Die Linie trägt die Uhrzeit, das Kreuz steht beim richtigen Wort.
    expect(html).toContain('08:42 peripherer Zugang')
    expect(html).toMatch(/ECMO/)
  })

  it('beschreibt einen Eintrag mit Uhrzeit und Klartext', () => {
    expect(zeile({ id: 'm1', zeit: '08:42', kategorie: 'medizintechnik', art: 'ecmo' })).toBe('08:42 ECMO')
    expect(zeile({ id: 'm2', zeit: '', kategorie: 'zugaenge', art: 'peripherer Zugang' })).toBe('peripherer Zugang')
  })
})
