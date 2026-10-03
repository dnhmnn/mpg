import { describe, it, expect } from 'vitest'
import {
  NAEP_ABSCHNITTE,
  NAEP_FRAGETYPEN,
  NAEP_VERSION,
  naepAbschnitt,
  naepAbschnitteFlach,
  naepAlleEingaben,
  naepAlleOptionen,
  naepEingabe,
} from '../../katalog/naep'
import { naepDatenXml, naepDateiname } from '../naepExport'

describe('NAEP-Katalog', () => {
  it('nennt die Protokollfassung, aus der er erzeugt wurde', () => {
    expect(NAEP_VERSION).toBe('V.6.0-1.00-NoVar-01012021')
  })

  it('vergibt jeden Code genau einmal', () => {
    // Codes sind die Schluessel des Austauschformats. Zwei Eingaben mit
    // demselben Code hiessen: der Empfaenger kann sie nicht trennen.
    const codes = naepAlleEingaben().map((e) => e.code)
    expect(codes.filter((c, i) => codes.indexOf(c) !== i)).toEqual([])
  })

  it('vergibt jeden Abschnittscode genau einmal', () => {
    const codes = naepAbschnitteFlach().map((a) => a.code)
    expect(codes.filter((c, i) => codes.indexOf(c) !== i)).toEqual([])
  })

  it('gibt jeder Eingabe eine Art und einen Code', () => {
    for (const e of naepAlleEingaben()) {
      expect(e.code, JSON.stringify(e).slice(0, 80)).toBeTruthy()
      expect(e.art).toBeTruthy()
    }
  })

  it('hält die Abschnitte des Protokolls vollständig', () => {
    expect(NAEP_ABSCHNITTE).toHaveLength(13)
    expect(naepAbschnitteFlach()).toHaveLength(32)
    for (const code of ['A01', 'B01', 'C01', 'D08', 'DDU', 'E01', 'F01', 'G01',
      'H01', 'I01', 'J08', 'K01', 'L08', 'M87']) {
      expect(naepAbschnitt(code), code).toBeTruthy()
    }
  })

  it('löst die Codes bekannter Felder richtig auf', () => {
    const rrsys = naepEingabe('DEF')
    expect(rrsys).toMatchObject({ art: 'feld', term: 'RRsys', typ: 'Zahl', einheit: 'mmHg' })
    const naca = naepEingabe('G0F')
    expect(naca).toMatchObject({ art: 'auswahl', term: 'NACA SCORE' })
  })

  it('behält die Verschachtelung der Norm', () => {
    // "Dyspnoe" traegt in der Norm eine eigene Unterauswahl. Flachzuklopfen
    // hiesse, die Aussage zu verlieren.
    const atmung = naepEingabe('DLM')
    expect(atmung?.art).toBe('auswahl')
    const dyspnoe = atmung?.art === 'auswahl' ? atmung.optionen.find((o) => o.term === 'Dyspnoe') : undefined
    expect(dyspnoe?.zusatz?.kinder?.length).toBeGreaterThan(0)
  })

  it('führt leer-Angaben getrennt von den Optionen', () => {
    // "nicht untersucht" ist in der Norm keine Wahl, sondern eine eigene
    // Aussage am Abschnitt.
    const haut = naepAbschnitt('DOC')
    expect(haut?.leer?.some((l) => l.term === 'nicht US')).toBe(true)
    const auswahl = naepEingabe('DOQ')
    if (auswahl?.art === 'auswahl') {
      expect(auswahl.optionen.some((o) => o.term === 'nicht US')).toBe(false)
    }
  })

  it('behält die Punktwerte der Glasgow Coma Scale', () => {
    const augen = naepEingabe('D10')
    expect(augen?.art).toBe('auswahl')
    if (augen?.art === 'auswahl') {
      expect(augen.optionen.map((o) => o.numerisch)).toEqual([4, 3, 2, 1])
    }
  })

  it('kennt die Fragetypen und ihre erlaubten Antworten', () => {
    expect(Object.keys(NAEP_FRAGETYPEN)).toContain('j-n-ub')
    expect(NAEP_FRAGETYPEN['j-n-ub'].antworten.map((a) => a.code)).toEqual(['J', 'N', 'UB'])
    expect(NAEP_FRAGETYPEN['j_opt'].optional).toBe(true)
  })

  it('hat über fünfhundert Optionen', () => {
    expect(naepAlleOptionen().length).toBeGreaterThan(500)
  })
})

describe('NAEP-Export', () => {
  const grund = { werte: {} }

  it('nennt Protokoll- und Metamodellfassung im Kopf', () => {
    const xml = naepDatenXml(grund)
    expect(xml).toContain(`protokoll="${NAEP_VERSION}"`)
    expect(xml).toContain('metamodell="1.0"')
    expect(xml).toContain('schemaVersion="1.0"')
  })

  it('schreibt eine Zahl mit der Einheit aus dem Katalog', () => {
    // Die Einheit kommt aus der Norm, nicht aus der Eingabe — so kann die
    // Erfassung sie nicht falsch mitliefern.
    expect(naepDatenXml({ werte: { DEF: 136 } })).toContain('<dt:wrt f="DEF" n="136" e="mmHg"/>')
  })

  it('schreibt Zeit, Datum und Text je nach Feldtyp', () => {
    const xml = naepDatenXml({ werte: { BF0: '02:47', B0F: '2026-10-03', B6U: 'KH Ansbach' } })
    expect(xml).toContain('<dt:wrt f="BF0" z="02:47"/>')
    expect(xml).toContain('<dt:wrt f="B0F" d="2026-10-03"/>')
    expect(xml).toContain('<dt:wrt f="B6U" t="KH Ansbach"/>')
  })

  it('schreibt jede gewählte Option einer Mehrfachauswahl einzeln', () => {
    const xml = naepDatenXml({ werte: { BC3: ['BCV', 'BCA'] } })
    expect(xml).toContain('<dt:sel a="BC3" o="BCV"/>')
    expect(xml).toContain('<dt:sel a="BC3" o="BCA"/>')
  })

  it('schreibt eine Frage mit ihrer Antwort', () => {
    expect(naepDatenXml({ werte: { BET: 'J' } })).toContain('<dt:ant f="BET" w="J"/>')
  })

  it('schreibt Freitext zeilenweise', () => {
    const xml = naepDatenXml({ werte: { C08: ['Erste Zeile', 'Zweite Zeile'] } })
    expect(xml).toContain('<dt:txt c="C08"><dt:z>Erste Zeile</dt:z><dt:z>Zweite Zeile</dt:z></dt:txt>')
  })

  it('übergeht leere Zeilen im Freitext', () => {
    expect(naepDatenXml({ werte: { C08: ['Text', '', '  '] } }))
      .toContain('<dt:txt c="C08"><dt:z>Text</dt:z></dt:txt>')
  })

  it('schreibt den Verlauf als Reihen', () => {
    const xml = naepDatenXml({ werte: { H08: [{ H0M: '02:58', H0T: 99 }, { H0M: '03:20', H0T: 92 }] } })
    expect(xml).toContain('<dt:ver c="H08">')
    expect((xml.match(/<dt:r>/g) ?? []).length).toBe(2)
    expect(xml).toContain('<dt:wrt f="H0T" n="99" e="1/min"/>')
  })

  it('unterscheidet leer von nicht bearbeitet', () => {
    // Zwei verschiedene Aussagen: untersucht und nichts gefunden — oder gar
    // nicht erst angesehen. Sie zu verwechseln faelscht das Protokoll.
    const leer = naepDatenXml({ werte: {}, leer: { D08: 'D0M' } })
    expect(leer).toContain('<dt:abs c="D08"><dt:leer c="D0M"/></dt:abs>')
    const nb = naepDatenXml({ werte: {}, nichtBearbeitet: ['D08'] })
    expect(nb).toContain('<dt:abs c="D08"><dt:nb/></dt:abs>')
  })

  it('schreibt eine Sonstiges-Angabe mit ihrem Text', () => {
    const xml = naepDatenXml({
      werte: { B0T: 'B10' },
      sonstiges: { B0T: { code: 'B3C', text: 'Treppenhaus' } },
    })
    expect(xml).toContain('<dt:sonst a="B0T" c="B3C" t="Treppenhaus"/>')
  })

  it('schreibt Unterangaben nur, wenn ihre Option gewählt wurde', () => {
    const ohne = naepDatenXml({ werte: { DLM: 'DLT' } })       // unauffällig
    expect(ohne).not.toContain('DME')
    const mit = naepDatenXml({ werte: { DLM: 'DM0', DM7: ['DME'] } })  // Dyspnoe + Stridor
    expect(mit).toContain('<dt:sel a="DM7" o="DME"/>')
  })

  it('schreibt die Unterangaben einer Frage nur bei Ja', () => {
    const nein = naepDatenXml({ werte: { C2D: 'N', C2K: '13:00' } })
    expect(nein).not.toContain('C2K')
    const ja = naepDatenXml({ werte: { C2D: 'J', C2K: '13:00' } })
    expect(ja).toContain('<dt:wrt f="C2K" z="13:00"/>')
  })

  it('maskiert Zeichen, die XML zerbrechen würden', () => {
    const xml = naepDatenXml({ werte: { B6U: 'A & B <x> "y"' } })
    expect(xml).toContain('t="A &amp; B &lt;x&gt; &quot;y&quot;"')
  })

  it('markiert unbearbeitete Abschnitte, wenn gar nichts erfasst wurde', () => {
    const xml = naepDatenXml(grund)
    // Jeder Abschnitt muss vorkommen — das Format verlangt sie alle.
    for (const a of NAEP_ABSCHNITTE) expect(xml).toContain(`c="${a.code}"`)
  })

  it('baut einen brauchbaren Dateinamen', () => {
    expect(naepDateiname('51/6951/9')).toBe('naep-51-6951-9.xml')
    expect(naepDateiname('')).toBe('naep-protokoll.xml')
  })
})
