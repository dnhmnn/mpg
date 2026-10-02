import { describe, it, expect } from 'vitest'
import { AELRD_FELDER, aelrdFeld, aelrdPflichtfelder, ohneDiviEntsprechung, schluessel } from '../../katalog/aelrd'
import { BLATT, escapeHtml, istGewaehlt } from '../aelrdDruck'
import { HOEHEN, HOEHEN2, SEITE1, SEITE2 } from '../aelrdLayout'
import { aelrdHtml } from '../aelrdProtokoll'
import { feldFinden } from '../../katalog/divi'

describe('Feldkatalog des ÄLRD-Bogens', () => {
  it('vergibt jede Feld-ID genau einmal', () => {
    const ids = AELRD_FELDER.map((f) => f.id)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  })

  it('haelt die Optionswerte innerhalb eines Feldes auseinander', () => {
    for (const f of AELRD_FELDER) {
      if (!f.optionen) continue
      const werte = f.optionen.map((o) => o.wert)
      expect({ feld: f.id, doppelt: werte.filter((w, i) => werte.indexOf(w) !== i) })
        .toEqual({ feld: f.id, doppelt: [] })
    }
  })

  it('verweist nur auf Felder, die es in DIVI 7.1 wirklich gibt', () => {
    // Ein toter Verweis waere schlimmer als gar keiner: er behauptet eine
    // Zuordnung, die beim Uebertragen der Daten ins Leere laeuft.
    for (const f of AELRD_FELDER) {
      if (!f.divi) continue
      expect({ feld: f.id, verweist_auf: f.divi, gefunden: Boolean(feldFinden(f.divi)) })
        .toEqual({ feld: f.id, verweist_auf: f.divi, gefunden: true })
    }
  })

  it('benennt die Felder, die der Bogen hat und DIVI 7.1 nicht', () => {
    const offen = ohneDiviEntsprechung().map((f) => f.id)
    // Der Bogen folgt DIVI 6.0 / MIND 4.0 und kennt Felder, die 7.1 nicht hat.
    for (const id of ['co_hb', 'ibp_sys', 'tracerdiagnose', 'zeit_einsatzbereit', 'wertsachen']) {
      expect(offen).toContain(id)
    }
  })

  it('kennt die Pflichtfelder', () => {
    const ids = aelrdPflichtfelder().map((f) => f.id)
    for (const id of ['name', 'gebdatum', 'einsatz_nr', 'zeit_alarm', 'af', 'hf']) {
      expect(ids).toContain(id)
    }
  })

  it('macht aus Umlauten stabile Speicherwerte', () => {
    expect(schluessel('unauffällig')).toBe('unauffaellig')
    expect(schluessel('(beinahe-) Ertrinken')).toBe('beinahe_ertrinken')
    expect(schluessel('> 2 Vers.')).toBe('ueber_2_vers')
  })

  it('unterscheidet Optionen, die sich nur im Vergleichszeichen unterscheiden', () => {
    // Ohne Uebersetzung wuerden "< 40" und "> 40" beide zu "40" — BMI unter
    // und ueber 40 waeren im gespeicherten Protokoll nicht mehr zu trennen.
    expect(schluessel('< 40')).not.toBe(schluessel('> 40'))
    expect(schluessel('< 3m')).not.toBe(schluessel('>= 3m'))
  })

  it('findet ein Feld anhand seiner ID', () => {
    expect(aelrdFeld('naca_initial')?.label).toBe('NACA SCORE initial')
    expect(aelrdFeld('gibtsnicht')).toBeUndefined()
  })
})

describe('Raster des Bogens', () => {
  it('bleibt mit jedem Block auf dem A4-Blatt', () => {
    for (const [name, raum] of [...Object.entries(SEITE1), ...Object.entries(SEITE2)]) {
      expect({ name, rechts: raum.x + raum.b <= BLATT.breite, unten: raum.y + raum.h <= BLATT.hoehe })
        .toEqual({ name, rechts: true, unten: true })
    }
  })

  it('summiert die Unterbloecke des Erstbefunds genau auf seine Rahmenhoehe', () => {
    const summe =
      HOEHEN.ebKopf + HOEHEN.ebAtemwege + HOEHEN.ebAtmung + HOEHEN.ebKreislauf +
      HOEHEN.ebHaut + HOEHEN.ebEkg + HOEHEN.ebMesswerte
    expect(Math.abs(summe - SEITE1.erstbefund.h)).toBeLessThan(1)
  })

  it('summiert die Unterbloecke der Neurologie genau auf ihre Rahmenhoehe', () => {
    const summe =
      HOEHEN.nrKopf + HOEHEN.nrPupillen + HOEHEN.nrAuffaelligkeiten +
      HOEHEN.nrSchmerzen + HOEHEN.nrUntersuchung + HOEHEN.nrPsyche
    expect(Math.abs(summe - SEITE1.neurologie.h)).toBeLessThan(1)
  })

  it('summiert die Unterbloecke des Uebergabe-Befundes auf seine Rahmenhoehe', () => {
    const summe =
      HOEHEN2.ubKopf + HOEHEN2.ubAtemwege + HOEHEN2.ubAtmung + HOEHEN2.ubKreislauf +
      HOEHEN2.ubEkg + HOEHEN2.ubPsyche + HOEHEN2.ubUntersuchung
    expect(Math.abs(summe - SEITE2.uebergabe.h)).toBeLessThan(1)
  })

  it('laesst die Bloecke einer Seite einander nicht ueberdecken', () => {
    const paare = (bloecke: Record<string, { x: number; y: number; b: number; h: number }>) => {
      const liste = Object.entries(bloecke).filter(([n]) => n !== 'titel')
      const treffer: string[] = []
      for (let i = 0; i < liste.length; i++) {
        for (let k = i + 1; k < liste.length; k++) {
          const [na, a] = liste[i]
          const [nb, b] = liste[k]
          const ueberlappt =
            a.x < b.x + b.b - 1 && b.x < a.x + a.b - 1 &&
            a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1
          if (ueberlappt) treffer.push(`${na} / ${nb}`)
        }
      }
      return treffer
    }
    expect(paare(SEITE1)).toEqual([])
    expect(paare(SEITE2)).toEqual([])
  })
})

describe('Ausdruck', () => {
  const beispiel = {
    name: 'Mustermann', vorname: 'Erika', geschlecht: 'weiblich',
    einsatz_nr: '6951', zeit_alarm: '02:47:00', af: 19, spo2: 97, hf: 99,
    atemwege: 'frei', naca_initial: 'III (mäßige Störung)',
  }

  it('liefert genau zwei Blaetter', () => {
    expect(aelrdHtml(beispiel).match(/class="blatt"/g)?.length).toBe(2)
  })

  it('setzt das Blatt auf A4 ohne Rand, weil der Bogen seinen eigenen mitbringt', () => {
    const html = aelrdHtml(beispiel)
    expect(html).toContain('size:A4 portrait')
    expect(html).toContain('@page{size:A4 portrait;margin:0}')
  })

  it('setzt jeden Block auf seine vermessene Punktposition', () => {
    const html = aelrdHtml(beispiel)
    expect(html).toContain(`left:${SEITE1.stammdaten.x}pt;top:${SEITE1.stammdaten.y}pt`)
    expect(html).toContain(`left:${SEITE2.massnahmen.x}pt;top:${SEITE2.massnahmen.y}pt`)
  })

  it('traegt die Werte ein', () => {
    const html = aelrdHtml(beispiel)
    expect(html).toContain('Mustermann')
    expect(html).toContain('6951')
  })

  it('kreuzt gewaehlte Optionen an und laesst die uebrigen leer', () => {
    const html = aelrdHtml(beispiel)
    expect(html).toContain('<span class="kreis an"></span>frei')
    expect(html).toContain('<span class="kreis"></span>gefährdet')
  })

  it('zeigt alle Optionen, auch die nicht gewaehlten', () => {
    // Der Bogen ist gedruckt — er zeigt immer die ganze Auswahl, sonst stuende
    // im Protokoll eine andere Auswahl als vor Ort zur Wahl stand.
    const html = aelrdHtml({})
    for (const o of aelrdFeld('atemwege')!.optionen!) {
      expect(html).toContain(escapeHtml(o.text))
    }
  })

  it('kommt mit einem leeren Protokoll zurecht', () => {
    const html = aelrdHtml({})
    expect(html.match(/class="blatt"/g)?.length).toBe(2)
  })

  it('ignoriert unbekannte Felder', () => {
    const html = aelrdHtml({ irgendwas_altes: 'Wert', name: 'Test' })
    expect(html).toContain('Test')
    expect(html).not.toContain('irgendwas_altes')
  })

  it('maskiert HTML aus den Eingaben', () => {
    const html = aelrdHtml({ name: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('nimmt Organisation und Zeitpunkt in den Kopf auf', () => {
    const html = aelrdHtml({}, { organisation: 'BRK Ansbach', erstellt: '02.10.2026 03:45' })
    expect(html).toContain('BRK Ansbach')
    expect(html).toContain('02.10.2026 03:45')
  })
})

describe('istGewaehlt', () => {
  it('erkennt einen einzelnen Wert und einen aus einer Liste', () => {
    expect(istGewaehlt('frei', 'frei')).toBe(true)
    expect(istGewaehlt(['a', 'b'], 'b')).toBe(true)
    expect(istGewaehlt(undefined, 'frei')).toBe(false)
  })
})
