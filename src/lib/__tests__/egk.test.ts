import { describe, it, expect } from 'vitest'
import {
  egkGenug,
  egkLeer,
  egkLesen,
  egkSammeln,
  geburtsdatumLesen,
  kassennummerLesen,
  kvnrGueltig,
  kvnrPruefziffer,
  namenszeilen,
  versichertennummerLesen,
} from '../egk'

/** Eine Nummer mit stimmiger Prüfziffer bauen, um Beispiele zu erzeugen. */
function mitPruefziffer(acht: string): string {
  const pz = kvnrPruefziffer(acht)
  if (pz === null) throw new Error(`kein gültiger Stamm: ${acht}`)
  return acht + String(pz)
}

describe('Prüfziffer der Versichertennummer', () => {
  it('rechnet nach dem Verfahren des § 290 SGB V', () => {
    // C -> 03, dann 00050002. Gewichte 1,2,1,2,…, Quersummen der Produkte:
    // 0·1=0, 3·2=6, 0·1=0, 0·2=0, 0·1=0, 5·2=10→1, 0·1=0, 0·2=0, 0·1=0, 2·2=4
    // Summe 11, letzte Stelle 1.
    expect(kvnrPruefziffer('C00050002')).toBe(1)
  })

  it('bildet die Quersumme der Produkte, nicht das Produkt selbst', () => {
    // A -> 01, dann 00000009: 0·1 + 1·2 + 0·1 + 0·2 + 0·1 + 0·2 + 0·1 + 0·2
    // + 0·1 + 9·2=18→9  ⇒ 2 + 9 = 11 ⇒ 1. Ohne Quersumme käme 20 ⇒ 0 heraus.
    expect(kvnrPruefziffer('A00000009')).toBe(1)
  })

  it('weist alles zurück, was nicht Buchstabe und acht Ziffern ist', () => {
    expect(kvnrPruefziffer('C0005000')).toBeNull()
    expect(kvnrPruefziffer('CC0050002')).toBeNull()
    expect(kvnrPruefziffer('100050002')).toBeNull()
    expect(kvnrPruefziffer('')).toBeNull()
  })

  it('erkennt eine stimmige Nummer und eine verdrehte', () => {
    const gut = mitPruefziffer('C00050002')
    expect(kvnrGueltig(gut)).toBe(true)
    const falsch = gut.slice(0, 9) + String((Number(gut[9]) + 1) % 10)
    expect(kvnrGueltig(falsch)).toBe(false)
  })

  it('nimmt Kleinschreibung und Leerzeichen hin', () => {
    const gut = mitPruefziffer('A12345678')
    expect(kvnrGueltig(`  ${gut.toLowerCase()} `)).toBe(true)
  })
})

describe('Versichertennummer aus dem erkannten Text', () => {
  const gut = mitPruefziffer('X11223344')

  it('findet die Nummer zwischen anderem Text', () => {
    expect(versichertennummerLesen(`AOK Bayern\n${gut}\n80276001011234567890`)).toBe(gut)
  })

  it('zieht bei mehreren die mit stimmiger Prüfziffer vor', () => {
    const falsch = 'Q99999999' + String((Number(gut[9]) + 5) % 10)
    expect(versichertennummerLesen(`${falsch}\n${gut}`)).toBe(gut)
  })

  it('rückt typische Lesefehler gerade, aber nur mit stimmiger Prüfziffer', () => {
    // Die Kamera liest O statt 0 und I statt 1.
    const verlesen = gut.replace(/0/g, 'O').replace(/1/g, 'I')
    expect(versichertennummerLesen(`Karte\n${verlesen}`)).toBe(gut)
  })

  it('erfindet nichts, wenn gar keine Nummer dasteht', () => {
    expect(versichertennummerLesen('Mustermann\nHeinz\n01.01.1970')).toBeUndefined()
  })

  it('verwechselt die Kartennummer nicht mit der Versichertennummer', () => {
    // Die Kartennummer ist lang und beginnt mit 80276.
    expect(versichertennummerLesen('80276001011234567890')).toBeUndefined()
  })
})

describe('Geburtsdatum', () => {
  const heute = new Date('2026-10-03T00:00:00Z')

  it('liest das Datum als ISO-Datum für das Formular', () => {
    expect(geburtsdatumLesen('geb. 09.03.1958', heute)).toBe('1958-03-09')
  })

  it('nimmt auch Schrägstriche und einstellige Tage, Tag zuerst', () => {
    // Die Karte ist deutsch beschriftet: 1/2/1970 ist der 1. Februar, nicht
    // der 2. Januar. Ein Kamerafehler macht aus Punkten gern Schrägstriche.
    expect(geburtsdatumLesen('1/2/1970', heute)).toBe('1970-02-01')
    expect(geburtsdatumLesen('09.03.1958', heute)).toBe('1958-03-09')
  })

  it('hält die Gültigkeit der Karte nicht für einen Geburtstag', () => {
    // "gültig bis 12/29" hat kein vierstelliges Jahr.
    expect(geburtsdatumLesen('gültig bis 12/29', heute)).toBeUndefined()
  })

  it('nimmt kein Datum aus der Zukunft', () => {
    expect(geburtsdatumLesen('31.12.2030', heute)).toBeUndefined()
  })

  it('weist unmögliche Daten zurück', () => {
    expect(geburtsdatumLesen('31.02.1970', heute)).toBeUndefined()
    expect(geburtsdatumLesen('45.13.1970', heute)).toBeUndefined()
  })

  it('nimmt das Geburtsdatum, auch wenn die Gültigkeit davor steht', () => {
    expect(geburtsdatumLesen('gültig bis 12/29\n09.03.1958', heute)).toBe('1958-03-09')
  })
})

describe('Kassennummer', () => {
  it('liest das neunstellige Institutionskennzeichen', () => {
    expect(kassennummerLesen('AOK Bayern 108310400')).toBe('108310400')
  })

  it('verwechselt die Kartennummer nicht damit', () => {
    expect(kassennummerLesen('80276001011234567890')).toBeUndefined()
  })
})

describe('Zeilen für Name, Vorname und Kasse', () => {
  it('bietet die Textzeilen an, statt den Namen zu raten', () => {
    // Welche Zeile der Nachname ist, hängt vom Kartenlayout jeder Kasse ab.
    const zeilen = namenszeilen('AOK Bayern\nGesundheitskarte\nMustermann\nHeinz\nX112233448')
    expect(zeilen).toContain('Mustermann')
    expect(zeilen).toContain('Heinz')
    expect(zeilen).toContain('AOK Bayern')
    expect(zeilen).not.toContain('Gesundheitskarte')
    expect(zeilen).not.toContain('X112233448')
  })

  it('lässt Ziffernzeilen und Winzigkeiten weg', () => {
    expect(namenszeilen('80276001011234567890\n.\n12/29')).toEqual([])
  })

  it('führt jede Zeile nur einmal', () => {
    expect(namenszeilen('Mustermann\nMustermann')).toEqual(['Mustermann'])
  })
})

// Was die Kamera wirklich ausgegeben hat, als eine nachgebaute Kartenvorder-
// seite durch Tesseract gelaufen ist. Erfundener Text ist zu ordentlich: er
// hat die Beschriftungen nicht in derselben Zeile wie den Kassennamen und
// keine zusammengelaufene Fußzeile.
const AUS_DER_KAMERA = `AOK Bayern Gesundheitskarte
Die Gesundheitskasse

Name

Mustermann

Vorname

Heinz

Geburtsdatum

09.03.1958

Versicherten-Nr.

K987654321
108310400 80276001011234567890 gültig bis 12/29 CAN 123456
`

describe('Eine wirklich erkannte Karte', () => {
  const d = egkLesen(AUS_DER_KAMERA, new Date('2026-10-03T00:00:00Z'))

  it('zieht Nummer, Geburtsdatum und Kasse aus der zusammengelaufenen Fußzeile', () => {
    expect(d.versnr).toBe('K987654321')
    expect(d.gebdatum).toBe('1958-03-09')
    expect(d.kassennr).toBe('108310400')
  })

  it('bietet Namen an, nicht die Beschriftungen der Karte', () => {
    expect(d.zeilen).toContain('Mustermann')
    expect(d.zeilen).toContain('Heinz')
    expect(d.zeilen).not.toContain('Name')
    expect(d.zeilen).not.toContain('Vorname')
    expect(d.zeilen).not.toContain('Versicherten-Nr.')
  })

  it('behält den Kassennamen, auch wenn die Aufschrift in derselben Zeile steht', () => {
    // Die Kamera liest "AOK Bayern Gesundheitskarte" als eine Zeile.
    expect(d.zeilen).toContain('AOK Bayern')
  })

  it('merkt an, dass die Prüfziffer dieser Nummer nicht passt', () => {
    // Eine ausgedachte Nummer hat selten eine stimmige Prüfziffer — genau
    // dafür ist der Hinweis da.
    expect(kvnrGueltig('K987654321')).toBe(false)
  })
})

describe('Alles zusammen', () => {
  it('liest eine Karte, wie die Kamera sie sieht', () => {
    const gut = mitPruefziffer('K98765432')
    const text = [
      'AOK Bayern',
      'Die Gesundheitskasse',
      'Gesundheitskarte',
      'Mustermann',
      'Heinz',
      '09.03.1958',
      gut,
      '108310400',
      '80276001011234567890',
      'gültig bis 12/29',
    ].join('\n')
    const d = egkLesen(text, new Date('2026-10-03T00:00:00Z'))
    expect(d.versnr).toBe(gut)
    expect(d.gebdatum).toBe('1958-03-09')
    expect(d.kassennr).toBe('108310400')
    expect(d.zeilen).toContain('Mustermann')
    expect(d.zeilen).toContain('Heinz')
  })

  it('gibt bei unlesbarem Bild nichts zurück, statt zu raten', () => {
    const d = egkLesen('~~~ ### ???', new Date())
    expect(d.versnr).toBeUndefined()
    expect(d.gebdatum).toBeUndefined()
    expect(d.kassennr).toBeUndefined()
  })
})

describe('Sammeln aus mehreren Bildern', () => {
  // Nicht ausgedacht, sondern gerechnet: X11223344 ergibt die Prüfziffer 0.
  const gut = mitPruefziffer('X11223344')
  const schlecht = gut.slice(0, 9) + String((Number(gut[9]) + 3) % 10)

  it('nimmt aus jedem Bild das, was dort stand', () => {
    // Im ersten Bild ist die Nummer scharf, im zweiten das Geburtsdatum.
    let d = egkLeer()
    d = egkSammeln(d, egkLesen(gut, new Date('2026-10-03')))
    d = egkSammeln(d, egkLesen('09.03.1958\nMustermann', new Date('2026-10-03')))
    expect(d.versnr).toBe(gut)
    expect(d.gebdatum).toBe('1958-03-09')
    expect(d.zeilen).toContain('Mustermann')
  })

  it('ersetzt eine verlesene Nummer durch eine mit stimmiger Prüfziffer', () => {
    expect(kvnrGueltig(schlecht)).toBe(false)
    let d = egkSammeln(egkLeer(), { versnr: schlecht, zeilen: [] })
    d = egkSammeln(d, { versnr: gut, zeilen: [] })
    expect(d.versnr).toBe(gut)
  })

  it('behält eine stimmige Nummer, auch wenn später eine schlechte kommt', () => {
    let d = egkSammeln(egkLeer(), { versnr: gut, zeilen: [] })
    d = egkSammeln(d, { versnr: schlecht, zeilen: [] })
    expect(d.versnr).toBe(gut)
  })

  it('sammelt Zeilen ohne Wiederholung und ohne Ende', () => {
    let d = egkLeer()
    for (let i = 0; i < 30; i++) d = egkSammeln(d, { zeilen: ['Mustermann', `Zeile ${i}`] })
    expect(d.zeilen.filter((z) => z === 'Mustermann')).toHaveLength(1)
    expect(d.zeilen.length).toBeLessThanOrEqual(14)
  })

  it('hört auf, wenn Nummer und Geburtsdatum stehen', () => {
    expect(egkGenug({ zeilen: [] })).toBe(false)
    expect(egkGenug({ versnr: gut, zeilen: [] })).toBe(false)
    expect(egkGenug({ versnr: gut, gebdatum: '1958-03-09', zeilen: [] })).toBe(true)
    // Ohne stimmige Prüfziffer wird weitergesucht.
    expect(egkGenug({ versnr: schlecht, gebdatum: '1958-03-09', zeilen: [] })).toBe(false)
  })
})
