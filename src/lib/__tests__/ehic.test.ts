import { describe, it, expect } from 'vitest'
import { ehicGenug, ehicLeer, ehicLesen, ehicSammeln, istRueckseite } from '../ehic'

// Was die Texterkennung an einer nachgebauten Rückseite wirklich ausgegeben
// hat — abgeschrieben aus dem Lauf, mitsamt dem Lesefehler in Zeile 6.
const AUS_DER_KAMERA = `| Europäische Krankenversicherungskarte
3 Name Mustermann
4 Vornamen Heinz Peter
5 Geburtsdatum 09/03/1958
6 Persönlkıche Kennnummer K987654329
7 Kennnummer des Trägers 108310400 AOK Bayern
8 Kennnummer der Karte 80276001011234567890
9  Ablaufdatum 31/12/2029`

describe('Die Rückseite erkennen', () => {
  it('erkennt sie an den nummerierten Feldern', () => {
    expect(istRueckseite('3 Name X\n4 Vornamen Y\n5 Geburtsdatum 01.01.1970')).toBe(true)
  })

  it('erkennt sie am Titel der Karte', () => {
    expect(istRueckseite('Europäische Krankenversicherungskarte')).toBe(true)
  })

  it('hält die Vorderseite nicht für die Rückseite', () => {
    // So liest die Kamera eine Vorderseite: Kasse, Name, Zahlenzeile.
    expect(istRueckseite('AOK Bayern Gesund\nHeinz Mustermann\n108310400 K987654329')).toBe(false)
  })
})

describe('Eine wirklich gelesene Rückseite', () => {
  const d = ehicLesen(AUS_DER_KAMERA)

  it('nimmt Familienname und Vornamen aus getrennten Feldern', () => {
    // Das ist der Gewinn gegenüber der Vorderseite: nichts muss zerlegt werden.
    expect(d.name).toBe('Mustermann')
    expect(d.vorname).toBe('Heinz Peter')
  })

  it('liest das Geburtsdatum, das die Vorderseite nicht führen muss', () => {
    expect(d.gebdatum).toBe('1958-03-09')
  })

  it('liest die Versichertennummer trotz verlesener Beschriftung', () => {
    // Die Kamera hat "Persönliche" zu "Persönlkıche" verlesen. Die Nummer am
    // Zeilenanfang ist der Anker, nicht das Wort.
    expect(d.versnr).toBe('K987654329')
  })

  it('liest Kassennummer und Kassennamen aus demselben Feld', () => {
    expect(d.kassennr).toBe('108310400')
    expect(d.kasse).toBe('AOK Bayern')
  })

  it('liest das Ablaufdatum', () => {
    expect(d.ablauf).toBe('2029-12-31')
  })

  it('nennt, welche Felder gelesen wurden', () => {
    expect(d.felder).toEqual(expect.arrayContaining([3, 4, 5, 6, 7, 8, 9]))
  })
})

describe('Was nicht durchrutschen darf', () => {
  it('hält eine Zahl nicht für einen Namen', () => {
    const d = ehicLesen('3 Name 123456\n4 Vornamen 987')
    expect(d.name).toBeUndefined()
    expect(d.vorname).toBeUndefined()
  })

  it('nimmt kein unmögliches Datum', () => {
    expect(ehicLesen('5 Geburtsdatum 31/02/1970').gebdatum).toBeUndefined()
  })

  it('verwechselt die Kartennummer nicht mit der Versichertennummer', () => {
    const d = ehicLesen('8 Kennnummer der Karte 80276001011234567890')
    expect(d.versnr).toBeUndefined()
  })

  it('übergeht Zeilen ohne Feldnummer', () => {
    expect(ehicLesen('Mustermann\nHeinz\n09/03/1958').felder).toEqual([])
  })

  it('lässt sich von einem mitgelesenen Rand nicht stören', () => {
    expect(ehicLesen('| 3 Name Mustermann').name).toBe('Mustermann')
  })

  it('schneidet auch eine verlesene mehrteilige Beschriftung ab', () => {
    expect(ehicLesen('7 Kennnurnmer des Traegers 108310400 BARMER').kasse).toBe('BARMER')
  })
})

describe('Aufhören und Sammeln', () => {
  it('hört auf, wenn Prüfziffer, Name und Vorname stehen', () => {
    expect(ehicGenug({ felder: [] })).toBe(false)
    expect(ehicGenug({ versnr: 'K987654329', felder: [] })).toBe(false)
    expect(ehicGenug({ versnr: 'K987654329', name: 'A', vorname: 'B', felder: [] })).toBe(true)
  })

  it('wartet nicht, wenn die Prüfziffer nicht aufgeht', () => {
    expect(ehicGenug({ versnr: 'K987654320', name: 'A', vorname: 'B', felder: [] })).toBe(false)
  })

  it('nimmt aus jedem Bild das, was dort stand', () => {
    let d = ehicLeer()
    d = ehicSammeln(d, ehicLesen('3 Name Mustermann'))
    d = ehicSammeln(d, ehicLesen('4 Vornamen Heinz'))
    d = ehicSammeln(d, ehicLesen('5 Geburtsdatum 09/03/1958'))
    expect(d.name).toBe('Mustermann')
    expect(d.vorname).toBe('Heinz')
    expect(d.gebdatum).toBe('1958-03-09')
    expect(d.felder).toEqual([3, 4, 5])
  })

  it('ersetzt eine verlesene Nummer durch eine mit stimmiger Prüfziffer', () => {
    let d = ehicSammeln(ehicLeer(), { versnr: 'K987654320', felder: [6] })
    d = ehicSammeln(d, { versnr: 'K987654329', felder: [6] })
    expect(d.versnr).toBe('K987654329')
  })
})
