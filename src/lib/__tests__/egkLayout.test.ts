import { describe, it, expect } from 'vitest'
import { kassenname, namenZerlegen, zuordnen, type ErkannteZeile } from '../egkLayout'

/** Kurzschreibweise für eine erkannte Zeile. */
const z = (text: string, x0: number, y0: number, h: number, confidence = 95): ErkannteZeile =>
  ({ text, x0, y0, x1: x0 + text.length * h * 0.55, y1: y0 + h, confidence })

// Genau das, was tesseract.js an der nachgebauten Karte ausgegeben hat —
// abgeschrieben aus dem Lauf, nicht ausgedacht.
const ECHTE_ZEILEN: ErkannteZeile[] = [
  z('AOK Bayern Gesundheitskarte', 49, 48, 46),
  z('Die Gesundheitskasse', 49, 99, 23, 96),
  z('Name', 360, 228, 15, 96),
  z('Mustermann', 362, 258, 30, 97),
  z('Vorname', 359, 348, 15, 96),
  z('Heinz', 362, 377, 31, 96),
  z('Geburtsdatum', 360, 467, 16, 96),
  z('09.03.1958', 360, 498, 30, 95),
  z('Versicherten-Nr', 360, 588, 15, 86),
  z('K987654329', 362, 618, 30, 93),
  z('108310400 80276001011234567890 gültig bis 12/29 CAN 123456', 49, 800, 28, 94),
]

describe('Zuordnung über die Beschriftung', () => {
  it('nimmt den Wert, der unter der Beschriftung steht', () => {
    const a = zuordnen(ECHTE_ZEILEN)
    expect(a.name).toBe('Mustermann')
    expect(a.vorname).toBe('Heinz')
    expect(a.quelle).toBe('beschriftung')
  })

  it('verwechselt Name und Vorname nicht', () => {
    // "Name" steckt als Wort in "Vorname" — die Reihenfolge der Muster zählt.
    const a = zuordnen([
      z('Vorname', 360, 100, 15), z('Heinz', 362, 130, 30),
      z('Name', 360, 200, 15), z('Mustermann', 362, 230, 30),
    ])
    expect(a.vorname).toBe('Heinz')
    expect(a.name).toBe('Mustermann')
  })

  it('nimmt keinen Wert aus einer anderen Spalte', () => {
    // Rechts neben "Name" steht etwas anderes — das gehört nicht dazu.
    const a = zuordnen([
      z('Name', 360, 200, 15), z('Irgendwas', 900, 230, 30), z('Mustermann', 362, 230, 30),
    ])
    expect(a.name).toBe('Mustermann')
  })

  it('bindet keinen Wert an eine Beschriftung, die weit darüber steht', () => {
    // Die Zuordnung darf hier nicht aus der Beschriftung kommen — dazwischen
    // könnte alles stehen. Dass die Stellungsregel die einzige Namenszeile
    // trotzdem nimmt, ist richtig; sie behauptet nur weniger.
    const a = zuordnen([z('Name', 360, 100, 15), z('Mustermann', 362, 400, 30)])
    expect(a.quelle).toBe('stellung')
  })

  it('hält eine Beschriftung nie für einen Wert', () => {
    const a = zuordnen([z('Name', 360, 100, 15), z('Vorname', 360, 130, 15)])
    expect(a.name).not.toBe('Vorname')
  })
})

// Was die Texterkennung an einer Karte ausgegeben hat, die der gematik-
// Spezifikation folgt: KEINE Beschriftung für den Namen, der Name als EINE
// Zeichenkette in natürlicher Reihenfolge, darunter die Zahlenzeile mit
// Institutionskennzeichen und Versichertennummer.
//
// Meine frühere Testkarte war erfunden und hatte Beschriftungen "Name" und
// "Vorname" sowie den Nachnamen über dem Vornamen. Beides gibt es auf einer
// echten eGK nicht — daran ist die Erkennung an der echten Karte gescheitert,
// und meine Tests haben den Fehler gedeckt statt ihn zu zeigen.
const ECHTE_EGK: ErkannteZeile[] = [
  z('AOK Bayern Gesund', 45, 43, 55, 60),
  z('Heinz Mustermann', 321, 690, 27, 96),
  z('108310400 K987654329', 321, 741, 41, 94),
]

describe('Eine Karte nach der Spezifikation — ohne jede Beschriftung', () => {
  const a = zuordnen(ECHTE_EGK, { versnr: 'K987654329' })

  it('zerlegt die Namenszeile in Vorname und Familienname', () => {
    expect(a.vorname).toBe('Heinz')
    expect(a.name).toBe('Mustermann')
  })

  it('nimmt den Kassennamen aus der Logozeile, ohne die Kartenaufschrift', () => {
    // Die Kamera liest "AOK Bayern Gesundheitskarte" oft nur halb.
    expect(a.kasse).toBe('AOK Bayern')
  })

  it('hält die Zahlenzeile für keinen Namen', () => {
    expect([a.name, a.vorname]).not.toContain('108310400 K987654329')
  })
})

describe('Namen in natürlicher Reihenfolge zerlegen', () => {
  it('nimmt das letzte Wort als Familiennamen', () => {
    expect(namenZerlegen('Heinz Mustermann')).toEqual({ vorname: 'Heinz', name: 'Mustermann' })
  })

  it('lässt mehrere Vornamen beisammen', () => {
    expect(namenZerlegen('Maria Anna Schmidt')).toEqual({ vorname: 'Maria Anna', name: 'Schmidt' })
  })

  it('schlägt das Vorsatzwort dem Familiennamen zu', () => {
    expect(namenZerlegen('Heinz von Mustermann')).toEqual({ vorname: 'Heinz', name: 'von Mustermann' })
    expect(namenZerlegen('Jan van der Berg').name).toBe('van der Berg')
  })

  it('lässt Titel weg', () => {
    expect(namenZerlegen('Dr. Heinz Mustermann')).toEqual({ vorname: 'Heinz', name: 'Mustermann' })
    expect(namenZerlegen('Prof. Dr. med. Anna Schmidt')).toEqual({ vorname: 'Anna', name: 'Schmidt' })
  })

  it('macht aus einem einzelnen Wort einen Familiennamen, keinen Vornamen', () => {
    expect(namenZerlegen('Mustermann')).toEqual({ name: 'Mustermann' })
  })

  it('gibt bei leerer Eingabe nichts zurück', () => {
    expect(namenZerlegen('   ')).toEqual({})
  })
})

describe('Der Name über zwei Zeilen', () => {
  it('fügt beide Namenszeilen zusammen', () => {
    // Über 28 Zeichen bricht die Karte den Namen um — nach Zeichenlänge,
    // nicht nach Namensbestandteil.
    const a = zuordnen([
      z('BARMER', 45, 43, 40),
      z('Hans-Joachim Maximilian', 321, 640, 27),
      z('von Hohenstein-Ehrenfels', 321, 690, 27),
      z('108310400 K987654329', 321, 741, 41),
    ], { versnr: 'K987654329' })
    expect(a.vorname).toBe('Hans-Joachim Maximilian')
    expect(a.name).toBe('von Hohenstein-Ehrenfels')
  })
})

describe('Was nicht zugeordnet wird', () => {
  it('ordnet aus einem leeren Ergebnis nichts zu', () => {
    expect(zuordnen([])).toEqual({ quelle: 'keine' })
  })

  it('übergeht Zeilen, denen die Erkennung selbst nicht traut', () => {
    const a = zuordnen([z('Name', 360, 100, 15), z('Mustrmnn', 362, 130, 30, 12)])
    expect(a.name).toBeUndefined()
  })

  it('hält Aufschriften der Karte nie für einen Namen', () => {
    const a = zuordnen([
      z('Gesundheitskarte', 600, 40, 25),
      z('AOK Bayern', 45, 43, 40),
      z('Heinz Mustermann', 321, 690, 27),
      z('108310400 K987654329', 321, 741, 41),
    ], { versnr: 'K987654329' })
    expect(a.name).toBe('Mustermann')
    expect(a.vorname).toBe('Heinz')
    expect([a.name, a.vorname, a.kasse]).not.toContain('Gesundheitskarte')
  })
})

describe('Die Kasse ist nie der Name', () => {
  it('bestimmt die Datenspalte über die Anker, nicht über die Anzahl', () => {
    // Der Fehler, den der Browserlauf gezeigt hat: bei Gleichstand der
    // Spaltenlängen gewann die Kassenspalte, und die Kasse bekam den Namen.
    const a = zuordnen(ECHTE_EGK, { versnr: 'K987654329' })
    expect(a.kasse).not.toBe(a.name)
    expect(a.kasse).not.toBe(a.vorname)
  })

  it('schneidet die Aufschrift der Karte aus dem Kassennamen', () => {
    expect(kassenname('AOK Bayern Gesundheitskarte')).toBe('AOK Bayern')
    expect(kassenname('AOK Bayern Gesund')).toBe('AOK Bayern')
    expect(kassenname('Gesundheitskarte')).toBeUndefined()
  })
})
