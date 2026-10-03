import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  NAEP_ABSCHNITTE,
  NAEP_FRAGETYPEN,
  naepAlleEingaben,
  type NaepAbschnitt,
  type NaepEingabe,
} from '../../katalog/naep'
import { NAEP_STRUKTUREN, naepStruktur, pfadTeile } from '../../katalog/naepStrukturen'
import { naepDatenXml, naepExportHinweise, type NaepProtokoll } from '../naepExport'
import { umschalten, leererZustand, type NaepZustand } from '../../pages/patienten/NaepFormular'

// ── Ein Protokoll, in dem alles ausgefüllt ist ──────────────────────────────
//
// Die Probe, die beim ÄLRD-Bogen einen ganzen blinden Block gefunden hat:
// jedes Feld des Katalogs füllen und sehen, was hinten herauskommt. Was die
// Maske erfassen kann, muss der Export auch schreiben können.

function strukturWerte(typ: string): Record<string, unknown> {
  const def = naepStruktur(typ)
  if (!def) return {}
  const werte: Record<string, unknown> = {}
  for (const f of def.felder) werte[f.pfad] = beispielwert(f.typ, f.muster)
  if (def.liste) {
    const zeile: Record<string, unknown> = {}
    for (const f of def.liste.felder) zeile[f.pfad] = beispielwert(f.typ, f.muster)
    werte[def.liste.pfad] = [zeile]
  }
  return werte
}

function beispielwert(typ: string, muster?: string): string {
  if (muster === '[0-9]{5}') return '93047'
  if (typ === 'zahl') return '7'
  if (typ === 'datum') return '1970-10-10'
  if (typ === 'zeit') return '13:05'
  if (typ === 'jaNein') return 'ja'
  return 'TEXT'
}

function fuellen(e: NaepEingabe, werte: Record<string, unknown>): void {
  if (e.art === 'feld') {
    werte[e.code] =
      e.typ === 'Zahl' ? 3 : e.typ === 'Zeit' ? '13:05' : e.typ === 'Datum' ? '2026-01-02' : 'TEXT'
    if (e.zusatz) for (const k of e.zusatz.kinder) fuellen(k, werte)
  } else if (e.art === 'auswahl') {
    const erste = e.optionen[0]
    if (!erste) return
    werte[e.code] = e.mehrfach ? [erste.code] : erste.code
    if (erste.zusatz) for (const k of erste.zusatz.kinder) fuellen(k, werte)
    if (e.zusatz) for (const k of e.zusatz.kinder) fuellen(k, werte)
  } else if (e.art === 'auswahlgruppe') {
    for (const a of e.auswahlen) werte[a.code] = e.optionen[0]?.code
    if (e.zusatz) for (const k of e.zusatz.kinder) fuellen(k, werte)
  } else if (e.art === 'frage') {
    werte[e.code] = 'J'
    if (e.wennJa) for (const k of e.wennJa) fuellen(k, werte)
  } else if (e.art === 'freitext') {
    werte[e.code] = ['Zeile eins', 'Zeile zwei']
  } else if (e.art === 'struktur') {
    werte[e.code] = strukturWerte(e.typ)
    if (e.zusatz) for (const k of e.zusatz.kinder) fuellen(k, werte)
  } else if (e.art === 'gruppe') {
    for (const k of e.kinder) fuellen(k, werte)
  } else if (e.art === 'oder') {
    // Entweder-oder: nur der erste Arm, sonst stünde beides da.
    if (e.kinder[0]) fuellen(e.kinder[0], werte)
  }
}

function abschnittFuellen(a: NaepAbschnitt, werte: Record<string, unknown>): void {
  for (const e of a.formular ?? []) fuellen(e, werte)
  if (a.verlauf) {
    const reihe: Record<string, unknown> = {}
    for (const s of a.verlauf.spalten) fuellen(s, reihe)
    werte[a.verlauf.code] = [reihe]
  }
  for (const k of a.kinder ?? []) abschnittFuellen(k, werte)
}

function vollesProtokoll(): NaepZustand {
  const z = leererZustand()
  for (const a of NAEP_ABSCHNITTE) abschnittFuellen(a, z.werte)
  return z
}

// ── Die Maske ───────────────────────────────────────────────────────────────

describe('Maske — Umschalten einer Option', () => {
  it('setzt und löscht bei Einfachauswahl', () => {
    expect(umschalten('', 'A0T', false)).toBe('A0T')
    expect(umschalten('A0T', 'A0T', false)).toBe('')
    expect(umschalten('A0T', 'A10', false)).toBe('A10')
  })

  it('sammelt bei Mehrfachauswahl, statt zu überschreiben', () => {
    // Der Fehler, der "blass UND kaltschweißig" zu "blass" gemacht hat.
    let w: unknown = umschalten(undefined, 'DOF', true)
    w = umschalten(w, 'DOM', true)
    expect(w).toEqual(['DOF', 'DOM'])
    expect(umschalten(w, 'DOF', true)).toEqual(['DOM'])
  })

  it('behauptet für einen unberührten Abschnitt nichts', () => {
    // Der Unterschied, auf den es ankommt: "untersucht, nichts gefunden" ist
    // eine Aussage über den Patienten. Sie darf nicht daraus entstehen, dass
    // niemand den Abschnitt angesehen hat.
    const xml = naepDatenXml(leererZustand())
    expect(xml).toContain('<dt:abs c="D08"><dt:nb/></dt:abs>')
    expect(xml).not.toContain('<dt:leer')

    const gewaehlt = leererZustand()
    gewaehlt.leer['D08'] = 'D0F'
    expect(naepDatenXml(gewaehlt)).toContain('<dt:abs c="D08"><dt:leer c="D0F"/></dt:abs>')
  })

  it('schreibt einen Verlauf ohne Messung nicht als leer', () => {
    const xml = naepDatenXml(leererZustand())
    expect(xml).toContain('<dt:abs c="H01"><dt:nb/></dt:abs>')
  })

  it('beginnt mit einem Zustand, der nichts behauptet', () => {
    const z = leererZustand()
    expect(z.werte).toEqual({})
    expect(z.leer).toEqual({})
    expect(z.nichtBearbeitet).toEqual([])
    const xml = naepDatenXml(z)
    // Ohne Angaben ist jeder Abschnitt nicht bearbeitet oder ausdrücklich leer.
    expect(xml).not.toContain(':wrt')
    expect(xml).not.toContain(':sel')
  })
})

describe('Maske — Zustand und Export sprechen dieselbe Sprache', () => {
  it('schreibt die Codes der Norm als Schlüssel', () => {
    // Es gibt keine Übersetzungsschicht; was erfasst wird, ist was übermittelt
    // wird. Deshalb muss jeder Schlüssel ein Code des Katalogs sein.
    const z = vollesProtokoll()
    const bekannt = new Set<string>()
    for (const e of naepAlleEingaben()) {
      bekannt.add(e.code)
      if (e.art === 'auswahlgruppe') for (const a of e.auswahlen) bekannt.add(a.code)
    }
    for (const a of NAEP_ABSCHNITTE) sammleVerlaufCodes(a, bekannt)
    const fremd = Object.keys(z.werte).filter((k) => !bekannt.has(k))
    expect(fremd).toEqual([])
  })

  it('nimmt den Zustand der Maske direkt als Protokoll', () => {
    const z = leererZustand()
    z.werte['A26'] = 42
    const p: NaepProtokoll = z
    expect(naepDatenXml(p)).toContain('f="A26"')
  })
})

function sammleVerlaufCodes(a: NaepAbschnitt, hin: Set<string>): void {
  if (a.verlauf) hin.add(a.verlauf.code)
  for (const k of a.kinder ?? []) sammleVerlaufCodes(k, hin)
}

// ── Die strukturierten Blöcke ───────────────────────────────────────────────

describe('Strukturierte Blöcke', () => {
  it('kennt jede Struktur, die im Katalog vorkommt', () => {
    // Fehlt eine, erfasst die Maske den Block gar nicht — und der Export
    // schweigt darüber.
    const ohne = naepAlleEingaben()
      .filter((e) => e.art === 'struktur')
      .filter((e) => !naepStruktur((e as { typ: string }).typ))
    expect(ohne).toEqual([])
  })

  it('zerlegt Pfade in Elemente und Attribute', () => {
    expect(pfadTeile('Patient.Name')).toEqual({ schritte: ['Patient', 'Name'], attribut: undefined })
    expect(pfadTeile('Patient@pseudonym')).toEqual({ schritte: ['Patient'], attribut: 'pseudonym' })
    expect(pfadTeile('Versicherung.Kasse@nr')).toEqual({ schritte: ['Versicherung', 'Kasse'], attribut: 'nr' })
    expect(pfadTeile('@code')).toEqual({ schritte: [], attribut: 'code' })
    expect(pfadTeile('.')).toEqual({ schritte: [], attribut: undefined })
  })

  it('schreibt die Stammdaten als std-Elemente', () => {
    const z = leererZustand()
    z.werte['A08'] = strukturWerte('PatStammdaten')
    const xml = naepDatenXml(z)
    expect(xml).toContain('<dt:str c="A08">')
    expect(xml).toContain('<dt:e xsi:type="std:PatStammdaten">')
    expect(xml).toContain('<std:Patient pseudonym="ja">')
    expect(xml).toContain('<std:GebDat>1970-10-10</std:GebDat>')
    expect(xml).toContain('<std:PLZ>93047</std:PLZ>')
    expect(xml).toContain('<std:Kasse nr="TEXT">TEXT</std:Kasse>')
  })

  it('lässt einen halben Stammdatensatz weg, statt ungültig zu werden', () => {
    // Das Schema verlangt Patient, Adresse und Versicherung vollständig.
    // Ein Name ohne Versicherung ist keine Teilmenge der Norm, sondern eine
    // Datei, die die Zielstelle zurückweist.
    const z = leererZustand()
    z.werte['A08'] = { 'Patient.Name': 'Mustermann' }
    const xml = naepDatenXml(z)
    expect(xml).not.toContain('std:PatStammdaten')
    expect(naepExportHinweise(z)[0]).toContain('Patient — Stammdaten')
    expect(naepExportHinweise(z)[0]).toContain('Vorname')
  })

  it('verliert die Angaben unter einem weggelassenen Block nicht', () => {
    // Unter A08 hängt das Geschlecht. Fällt der Block weg, muss es trotzdem
    // mitgehen.
    const z = leererZustand()
    z.werte['A08'] = { 'Patient.Name': 'Mustermann' }
    z.werte['A0F'] = 'A0T'
    const xml = naepDatenXml(z)
    expect(xml).toContain('<dt:sel a="A0F" o="A0T"/>')
  })

  it('wiederholt Einzeldosen und überspringt die ohne Wirkstoff', () => {
    const z = leererZustand()
    z.werte['I0F'] = {
      Einzeldosis: [
        { Wirkstoff: 'Adrenalin', Menge: 1, 'Menge@einheit': 'mg', 'Zeit@start': '13:05' },
        { Medikament: 'ohne Wirkstoff' },
      ],
    }
    const xml = naepDatenXml(z)
    expect(xml).toContain('<std:Wirkstoff>Adrenalin</std:Wirkstoff>')
    expect(xml).toContain('<std:Menge einheit="mg">1</std:Menge>')
    expect(xml).toContain('<std:Zeit start="13:05"/>')
    expect(xml).not.toContain('ohne Wirkstoff')
  })

  it('schreibt die Applikation nur mit Code und Text', () => {
    // TypCodeTerm verlangt beide Attribute. Nur einer davon wäre ungültig.
    const nurText = leererZustand()
    nurText.werte['I0F'] = { Einzeldosis: [{ Wirkstoff: 'Adrenalin', 'Applikation@term': 'i.v.' }] }
    expect(naepDatenXml(nurText)).not.toContain('std:Applikation')

    const beides = leererZustand()
    beides.werte['I0F'] = {
      Einzeldosis: [{ Wirkstoff: 'Adrenalin', 'Applikation@code': 'ROA.01', 'Applikation@term': 'i.v.' }],
    }
    expect(naepDatenXml(beides)).toContain('<std:Applikation code="ROA.01" term="i.v."/>')
  })

  it('schreibt eine Diagnose als Text mit ICD-Code am Element', () => {
    const z = leererZustand()
    z.werte['G07'] = { Diagnose: [{ '@code': 'J18.9', '.': 'Pneumonie' }] }
    expect(naepDatenXml(z)).toContain('<std:Diagnose code="J18.9">Pneumonie</std:Diagnose>')
  })

  it('hält sich an die Feldreihenfolge des Schemas', () => {
    // xs:sequence: Medikament vor Wirkstoff, Strasse vor PLZ vor Ort.
    for (const def of NAEP_STRUKTUREN) {
      const pfade = [...def.felder, ...(def.liste?.felder ?? [])].map((f) => f.pfad)
      expect(pfade.length).toBe(new Set(pfade).size)
    }
    const z = leererZustand()
    z.werte['A08'] = strukturWerte('PatStammdaten')
    const xml = naepDatenXml(z)
    expect(xml.indexOf('<std:Strasse>')).toBeLessThan(xml.indexOf('<std:PLZ>'))
    expect(xml.indexOf('<std:PLZ>')).toBeLessThan(xml.indexOf('<std:Ort>'))
    expect(xml.indexOf('<std:Patient')).toBeLessThan(xml.indexOf('<std:Versicherung>'))
  })

  it('meldet nichts, solange ein Block gar nicht angefasst wurde', () => {
    expect(naepExportHinweise(leererZustand())).toEqual([])
  })
})

// ── Die Gegenprobe gegen die Norm ───────────────────────────────────────────

function xmllintDa(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe.runIf(xmllintDa())('Gegenprobe gegen das DIVI-Schema', () => {
  function pruefen(xml: string): string {
    const ordner = mkdtempSync(join(tmpdir(), 'naep-'))
    const datei = join(ordner, 'export.xml')
    writeFileSync(datei, xml)
    try {
      execFileSync('xmllint', ['--noout', '--schema', 'referenz/naep/xsd/naep-daten.xsd', datei], {
        stdio: 'pipe',
      })
      return ''
    } catch (fehler) {
      const e = fehler as { stderr?: Buffer }
      return String(e.stderr ?? '')
        .split('\n')
        .filter((z) => z && !z.includes('www.w3.org/2001/03/xml.xsd') && !z.includes('Skipping the import'))
        .join('\n')
    }
  }

  it('ein vollständig ausgefülltes Protokoll ist normgültig', () => {
    const xml = naepDatenXml(vollesProtokoll())
    // Damit die Probe nicht ins Leere greift: alles muss wirklich drinstehen.
    for (const def of NAEP_STRUKTUREN) expect(xml).toContain(`xsi:type="std:${def.typ}"`)
    expect(xml).toContain(':ver c=')
    expect(xml).toContain(':txt c=')
    expect(xml).toContain(':ant f=')
    expect(xml).not.toContain(':nb/')
    const meldung = pruefen(xml)
    expect(meldung).toBe('')
  })

  it('ein leeres Protokoll ist normgültig', () => {
    expect(pruefen(naepDatenXml(leererZustand()))).toBe('')
  })

  it('nicht bearbeitete Abschnitte sind normgültig', () => {
    const z = leererZustand()
    z.nichtBearbeitet = NAEP_ABSCHNITTE.map((a) => a.code)
    expect(pruefen(naepDatenXml(z))).toBe('')
  })
})

describe('Fragetypen', () => {
  it('kennt jeden Typ, den der Katalog verwendet', () => {
    const fehlend = naepAlleEingaben()
      .filter((e) => e.art === 'frage')
      .map((e) => (e as { typ: string }).typ)
      .filter((t) => !NAEP_FRAGETYPEN[t])
    expect(fehlend).toEqual([])
  })
})
