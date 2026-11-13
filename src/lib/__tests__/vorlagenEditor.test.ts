import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import {
  FELD_TYPEN, schemaFehler, schemaLesen, standardKonfig, bausteine, type FeldDef, type StandardKonfig,
} from '../formular/felder'
import {
  bausteinZeile, eigenesEntfernen, eigenesSetzen, feldAdresse, feldAusEntwurf, feldEntwurf, feldPruefen, feldUnter, felderZusammenfassung,
  istKonflikt, kernFeld, kernSetzen, kernZuruecksetzen, reihenfolgeAus, teilAdresse, verschieben, vorlageFehlerText, vorlageSchluessel, vorlageZeile, vorschauAdresse,
  type FeldEntwurf,
} from '../../pages/vorgaenge/eigene/logik'
import {
  abschnittEntfernen, abschnittPruefen, abschnittSetzen, abschnittVerschieben, entwurfAusVorlage, entwurfGeaendert, entwurfLesen, entwurfMerken,
  entwurfPruefen, entwurfVergessen, fehlendeFelder, feldEntfernen, feldSetzen, feldVerschieben, gruppen, mitAltSchluesseln, neuerEntwurf,
  ordnen, schemaGeaendert, speicherBody, ENTWURF_PREFIX, type VorlageEntwurf,
} from '../../pages/vorgaenge/eigene/entwurf'
import { E_TEXTE, FELD_TYP_SATZ } from '../../pages/vorgaenge/eigene/texte'
import { eigeneAngeboten, eigeneFelder, felderPruefen, gruppieren, serverFeld, WEITERE_ANGABEN } from '../../pages/public/felder/pruefen'

// Die Regeln des Servers (pb_hooks/formular-regeln.js), wie in formularFelderGleichlauf.test.ts geladen
const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/formular-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any

const GEDANKENSTRICHE = /[–—]/

function texteAus(x: unknown, aus: string[] = []): string[] {
  if (typeof x === 'string') aus.push(x)
  else if (typeof x === 'function') {
    for (const probe of [[0], [1], [3], ['Fahrzeugcheck'], [2, 7]]) {
      try { const t = (x as (...a: unknown[]) => unknown)(...probe); if (typeof t === 'string') aus.push(t) } catch { /* andere Signatur */ }
    }
  } else if (x && typeof x === 'object') for (const v of Object.values(x)) texteAus(v, aus)
  return aus
}

describe('Texte des Feld-Editors und Baukastens', () => {
  it('ohne Gedankenstriche, nicht leer', () => {
    const alle = [...texteAus(E_TEXTE), ...texteAus(FELD_TYP_SATZ)]
    expect(alle.length).toBeGreaterThan(100)
    for (const t of alle) {
      expect(t.trim()).not.toBe('')
      expect(t).not.toMatch(GEDANKENSTRICHE)
    }
  })
  it('je Feldart ein Satz', () => {
    for (const t of FELD_TYPEN) expect(FELD_TYP_SATZ[t]).toBeTruthy()
  })
})

describe('Adressen der Seiten (3.3)', () => {
  it('feld: <formular>:<kennung> oder :neu; Patientendoku und Unsinn nicht', () => {
    expect(feldAdresse('produktausgabe:einsatz')).toEqual({ formular: 'produktausgabe', kennung: 'einsatz' })
    expect(feldAdresse('cirs:neu')).toEqual({ formular: 'cirs', kennung: 'neu' })
    expect(feldAdresse('defektmeldung:e_abc12345')).toEqual({ formular: 'defektmeldung', kennung: 'e_abc12345' })
    for (const x of ['patienten:einsatz', 'cirs', 'cirs:', 'cirs:a:b', 'cirs:__proto__', '', undefined, 'cirs:x y']) expect(feldAdresse(x as string)).toBeNull()
  })
  it('vorlage-feld und vorlage-abschnitt: <vorlage|neu>:<teil|neu|neu.<abschnitt>>', () => {
    expect(teilAdresse('k3j9x0a1b2c3d4e:f_ab12cd34')).toEqual({ vorlage: 'k3j9x0a1b2c3d4e', teil: 'f_ab12cd34', abschnitt: '' })
    expect(teilAdresse('neu:neu')).toEqual({ vorlage: 'neu', teil: 'neu', abschnitt: '' })
    expect(teilAdresse('neu:neu.a_x1y2z3w4')).toEqual({ vorlage: 'neu', teil: 'neu', abschnitt: 'a_x1y2z3w4' })
    for (const x of ['neu', 'neu:', 'a b:neu', 'neu:neu.', 'neu:neu.a b', 'x:y:z']) expect(teilAdresse(x)).toBeNull()
  })
  it('vorschau: Standardformular oder vorlage:<vorlage>', () => {
    expect(vorschauAdresse('cirs')).toEqual({ art: 'standard', formular: 'cirs' })
    expect(vorschauAdresse('vorlage:neu')).toEqual({ art: 'vorlage', vorlage: 'neu' })
    expect(vorschauAdresse('vorlage:abc')).toEqual({ art: 'vorlage', vorlage: 'abc' })
    expect(vorschauAdresse('patienten')).toBeNull()
    expect(vorschauAdresse('vorlage:')).toBeNull()
    expect(vorlageSchluessel('')).toBe('neu')
    expect(vorlageSchluessel(undefined)).toBe('neu')
    expect(vorlageSchluessel('abc')).toBe('abc')
  })
})

describe('Standardformulare: Kernfelder und eigene Felder', () => {
  const leer = standardKonfig(null, 'cirs')
  it('kernSetzen speichert nur Abweichungen von der Vorgabe, nur Erlaubtes', () => {
    const was = kernFeld('cirs', 'was')!
    let k = kernSetzen(leer, was, { label: 'Was ist passiert?', hilfe: '  ', aus: true, pflicht: false })
    // Bezeichnung wie die Vorgabe, Hilfetext leer, aus und Pflicht bei einem festen Feld nicht erlaubt
    expect(k.felder.was).toBeUndefined()
    k = kernSetzen(leer, was, { label: '  Ereignis  ', hilfe: 'Sachlich bleiben.' })
    expect(k.felder.was).toEqual({ label: 'Ereignis', hilfe: 'Sachlich bleiben.' })
    const ort = kernFeld('cirs', 'ort')!
    k = kernSetzen(k, ort, { aus: true, pflicht: true })
    // Pflicht wie die Vorgabe (ja): kein Eintrag; aus: ja
    expect(k.felder.ort).toEqual({ aus: true })
    k = kernSetzen(k, ort, { pflicht: false })
    expect(k.felder.ort).toEqual({ pflicht: false })
    const name = kernFeld('cirs', 'melder_name')!
    expect(kernSetzen(k, name, { pflicht: true }).felder.melder_name).toBeUndefined()
    expect(kernZuruecksetzen(k, 'was').felder.was).toBeUndefined()
    expect(kernZuruecksetzen(k, 'was').felder.ort).toEqual({ pflicht: false })
  })
  it('was kernSetzen schreibt, liest standardKonfig unverändert (Server und App)', () => {
    let k = kernSetzen(leer, kernFeld('cirs', 'ort')!, { aus: true, label: 'Wo genau?' })
    k = kernSetzen(k, kernFeld('cirs', 'warum')!, { pflicht: true })
    const cfg = { formulare: { cirs: k } }
    expect(standardKonfig(cfg, 'cirs').felder).toEqual(k.felder)
    expect(R.standardKonfig(cfg, 'cirs').felder).toEqual(k.felder)
  })
  it('eigenesSetzen legt am Ende an, ersetzt bei gleicher Kennung, ohne abschnitt; Entfernen räumt die Reihenfolge', () => {
    const f1: FeldDef = { id: 'e_aaaaaaaa', typ: 'text', label: 'Fahrzeug', abschnitt: 'a_xxxxxxxx' }
    let k = eigenesSetzen(standardKonfig(null, 'produktausgabe'), f1)
    expect(k.eigene).toEqual([{ id: 'e_aaaaaaaa', typ: 'text', label: 'Fahrzeug' }])
    expect(k.reihenfolge).toEqual(['einsatz', 'datum', 'positionen', 'lager_id', 'e_aaaaaaaa'])
    k = { ...k, reihenfolge: verschieben(k.reihenfolge, 4, -1) }
    k = eigenesSetzen(k, { ...f1, label: 'Fahrzeug (Funkrufname)', pflicht: true })
    expect(k.eigene).toHaveLength(1)
    expect(k.eigene[0].label).toBe('Fahrzeug (Funkrufname)')
    expect(k.reihenfolge).toEqual(['einsatz', 'datum', 'positionen', 'e_aaaaaaaa', 'lager_id'])
    k = eigenesEntfernen(k, 'e_aaaaaaaa')
    expect(k.eigene).toEqual([])
    expect(k.reihenfolge).toEqual(['einsatz', 'datum', 'positionen', 'lager_id'])
  })
  it('verschieben: am Rand unverändert, sonst getauscht, nie das Original', () => {
    const a = ['a', 'b', 'c']
    expect(verschieben(a, 0, -1)).toEqual(a)
    expect(verschieben(a, 2, 1)).toEqual(a)
    expect(verschieben(a, 1, -1)).toEqual(['b', 'a', 'c'])
    expect(verschieben(a, 1, 1)).toEqual(['a', 'c', 'b'])
    expect(a).toEqual(['a', 'b', 'c'])
  })
  it('reihenfolgeAus zeigt auch Ausgeblendetes; Zeilen und Zusammenfassung', () => {
    let k: StandardKonfig = kernSetzen(leer, kernFeld('cirs', 'warum')!, { aus: true })
    k = eigenesSetzen(k, { id: 'e_bbbbbbbb', typ: 'auswahl', label: 'Schicht', optionen: ['Tag', 'Nacht'], pflicht: true })
    expect(reihenfolgeAus(k, 'cirs')).toContain('warum')
    expect(reihenfolgeAus(k, 'cirs')).toHaveLength(11)
    const zeilen = bausteine(k, 'cirs', { mitAusgeblendeten: true }).map(bausteinZeile)
    expect(zeilen.find((z) => z.kennung === 'was')).toEqual({ titel: 'Was ist passiert?', unter: 'Fest', kennung: 'was' })
    expect(zeilen.find((z) => z.kennung === 'warum')!.unter).toBe('Ausgeblendet')
    expect(zeilen.find((z) => z.kennung === 'ort')!.unter).toBe('Pflicht')
    expect(zeilen.find((z) => z.kennung === 'folgen')!.unter).toBe('Optional')
    expect(zeilen.find((z) => z.kennung === 'e_bbbbbbbb')).toEqual({ titel: 'Schicht', unter: 'Auswahl · 2 Optionen · Pflicht', kennung: 'e_bbbbbbbb' })
    expect(felderZusammenfassung(k, 'cirs')).toBe('10 Standardfelder · 1 eigenes · 1 ausgeblendet')
    expect(felderZusammenfassung(standardKonfig(null, 'produktausgabe'), 'produktausgabe')).toBe('4 feste Felder')
    expect(feldUnter({ id: 'f', typ: 'zahl', label: 'x', einheit: 'l', aus: true })).toBe('Zahl · l · Ausgeblendet')
  })
})

describe('Ein Feld prüfen: gleiche Regeln wie schemaFehler', () => {
  const basis = (x: Partial<FeldEntwurf>): FeldEntwurf => ({ ...feldEntwurf(null, 'f_abcdefgh'), label: 'Kennzeichen', ...x })
  const FAELLE: [string, Partial<FeldEntwurf>][] = [
    ['gültig', {}],
    ['ohne Bezeichnung', { label: '   ' }],
    ['Bezeichnung 120', { label: 'x'.repeat(120) }],
    ['Bezeichnung 121', { label: 'x'.repeat(121) }],
    ['Hilfe 300', { hilfe: 'h'.repeat(300) }],
    ['Hilfe 301', { hilfe: 'h'.repeat(301) }],
    ['Auswahl mit einer Option', { typ: 'auswahl', optionen: ['A', ''] }],
    ['Auswahl mit zwei', { typ: 'auswahl', optionen: ['A', 'B'] }],
    ['Auswahl doppelt', { typ: 'mehrfach', optionen: ['A', ' a '] }],
    ['Option 80', { typ: 'auswahl', optionen: ['o'.repeat(80), 'B'] }],
    ['Option 81', { typ: 'auswahl', optionen: ['o'.repeat(81), 'B'] }],
    ['31 Optionen', { typ: 'mehrfach', optionen: Array.from({ length: 31 }, (_, i) => `O${i}`) }],
    ['30 Optionen', { typ: 'mehrfach', optionen: Array.from({ length: 30 }, (_, i) => `O${i}`) }],
    ['Zahl mit Einheit 12', { typ: 'zahl', einheit: 'e'.repeat(12) }],
    ['Zahl mit Einheit 13', { typ: 'zahl', einheit: 'e'.repeat(13) }],
    ['Zahl min > max', { typ: 'zahl', min: 5, max: 2 }],
    ['Zahl min = max', { typ: 'zahl', min: 5, max: 5 }],
    ['Zahl min allein', { typ: 'zahl', min: -3 }],
    ['Zahl zu groß', { typ: 'zahl', max: 2e9 }],
    ['Text mit leeren Optionen aus dem Zustand', { typ: 'text', optionen: ['', ''] }],
  ]
  it.each(FAELLE)('%s', (_name, x) => {
    const e = basis(x)
    const eigen = feldPruefen(e)
    const server = schemaFehler({ felder: [feldAusEntwurf(e)] })
    const roh = R.schemaFehler({ felder: [feldAusEntwurf(e)] })
    expect(eigen === null).toBe(server === null)
    expect(roh === null).toBe(server === null)
    if (eigen) expect(eigen.text).not.toMatch(GEDANKENSTRICHE)
  })
  it('min/max nicht lesbar (NaN aus dem Zahlenfeld): Fehler am Feld', () => {
    expect(feldPruefen(basis({ typ: 'zahl', min: NaN }))).toEqual({ feld: 'min', text: E_TEXTE.zahlUnlesbar })
  })
  it('feldAusEntwurf: nur die Schlüssel der Art, getrimmt, leere Optionen raus', () => {
    expect(feldAusEntwurf(basis({ typ: 'auswahl', optionen: [' A ', '', 'B'], einheit: 'kg', min: 1, hilfe: '  ', pflicht: true }))).toEqual({
      id: 'f_abcdefgh', typ: 'auswahl', label: 'Kennzeichen', pflicht: true, optionen: ['A', 'B'],
    })
    expect(feldAusEntwurf(basis({ typ: 'zahl', einheit: ' l ', min: 0, max: 50, optionen: ['x', 'y'], abschnitt: 'a_1' }), { mitAbschnitt: true })).toEqual({
      id: 'f_abcdefgh', typ: 'zahl', label: 'Kennzeichen', einheit: 'l', min: 0, max: 50, abschnitt: 'a_1',
    })
    // Zurück in den Entwurf und wieder heraus: gleich
    const d: FeldDef = { id: 'f_x', typ: 'mehrfach', label: 'L', hilfe: 'H', aus: true, optionen: ['a', 'b'] }
    expect(feldAusEntwurf(feldEntwurf(d, 'egal'))).toEqual(d)
  })
})

describe('Fehler des Servers beim Speichern', () => {
  const sonst = () => 'SONST'
  it('deutsche Meldung des Hooks, sonst der Rückfall; 0: ohne Netz; 409 erkannt', () => {
    expect(vorlageFehlerText({ status: 409, response: { message: 'Das Formular wurde inzwischen an anderer Stelle geändert. Bitte neu laden.', data: {} } }, sonst))
      .toBe('Das Formular wurde inzwischen an anderer Stelle geändert. Bitte neu laden.')
    expect(vorlageFehlerText({ status: 400, response: { message: 'Failed to create record.', data: { title: { code: 'validation_required' } } } }, sonst)).toBe('SONST')
    expect(vorlageFehlerText({ status: 0 }, sonst)).toMatch(/Keine Verbindung/)
    expect(istKonflikt({ status: 409 })).toBe(true)
    expect(istKonflikt({ status: 400 })).toBe(false)
  })
})

// ── Baukasten eigener Formulare ─────────────────────────────────────────────

const A1 = { id: 'a_aaaaaaaa', titel: 'Fahrzeug' }
const A2 = { id: 'a_bbbbbbbb', titel: 'Mängel' }
const F = (id: string, abschnitt?: string): FeldDef => ({ id, typ: 'text', label: id.toUpperCase(), ...(abschnitt ? { abschnitt } : {}) })
const ids = (e: VorlageEntwurf) => e.felder.map((f) => `${f.id}@${f.abschnitt ?? ''}`)

function mit(e: Partial<VorlageEntwurf>): VorlageEntwurf {
  return { ...neuerEntwurf(), ...e }
}

describe('Entwurf: neu, aus der Vorlage, geändert', () => {
  it('neu: inaktiv, Absender frei, nicht geändert, keine Felder (PO 8)', () => {
    const e = neuerEntwurf()
    expect(e).toMatchObject({ id: '', aktiv: false, archiviert: false, absender: 'frei', felder: [], abschnitte: [], basisVersion: null })
    expect(entwurfGeaendert(e)).toBe(false)
    expect(entwurfGeaendert({ ...e, titel: 'Fahrzeugcheck' })).toBe(true)
    // Leerzeichen am Rand zählen nicht
    expect(entwurfGeaendert({ ...e, titel: '  ' })).toBe(false)
  })
  it('aus einer alten Vorlage (fieldType …) und einer neuen; Aktiv zählt nicht als Änderung', () => {
    const alt = entwurfAusVorlage({ id: 'v1', title: 'Alt', description: '', is_active: true, schema: [{ id: 'x1', label: 'Name', fieldType: 'text', required: true }, { id: 'x2', label: 'Ok', fieldType: 'checkbox' }] })
    expect(alt.felder).toEqual([{ id: 'x1', typ: 'text', label: 'Name', pflicht: true }, { id: 'x2', typ: 'janein', label: 'Ok' }])
    expect(alt).toMatchObject({ aktiv: true, absender: 'frei', basisVersion: null, abschnitte: [] })
    expect(entwurfGeaendert({ ...alt, aktiv: false })).toBe(false)
    const neu = entwurfAusVorlage({ id: 'v2', title: 'Neu', is_active: false, archiviert: true, absender: 'anonym', version: 4, abschnitte: [A1], schema: [F('f_1', A1.id)] })
    expect(neu).toMatchObject({ absender: 'anonym', archiviert: true, basisVersion: 4 })
    expect(schemaGeaendert(neu)).toBe(false)
    expect(schemaGeaendert({ ...neu, titel: 'Anders' })).toBe(false)
    expect(schemaGeaendert(feldEntfernen(neu, 'f_1'))).toBe(true)
  })
})

describe('Entwurf: Felder und Abschnitte', () => {
  it('ohne Abschnitte: Felder ohne Zuordnung, neu ans Ende, Platz bleibt beim Ändern', () => {
    let e = mit({})
    e = feldSetzen(e, F('f_1', 'a_weg'))
    e = feldSetzen(e, F('f_2'))
    e = feldSetzen(e, { ...F('f_1'), label: 'Neu' })
    expect(ids(e)).toEqual(['f_1@', 'f_2@'])
    expect(e.felder[0].label).toBe('Neu')
    expect(gruppen(e)).toEqual([{ abschnitt: null, felder: e.felder }])
  })
  it('der erste Abschnitt nimmt die vorhandenen Felder auf; neue Felder in den gewählten Abschnitt', () => {
    let e = mit({ felder: [F('f_1'), F('f_2')] })
    e = abschnittSetzen(e, { ...A1, titel: '  Fahrzeug  ' })
    expect(e.abschnitte).toEqual([A1])
    expect(ids(e)).toEqual(['f_1@a_aaaaaaaa', 'f_2@a_aaaaaaaa'])
    e = abschnittSetzen(e, A2)
    expect(ids(e)).toEqual(['f_1@a_aaaaaaaa', 'f_2@a_aaaaaaaa'])
    e = feldSetzen(e, F('f_3', A2.id))
    e = feldSetzen(e, F('f_4', A1.id))
    expect(ids(e)).toEqual(['f_1@a_aaaaaaaa', 'f_2@a_aaaaaaaa', 'f_4@a_aaaaaaaa', 'f_3@a_bbbbbbbb'])
    // Ohne gültigen Abschnitt: in den letzten
    e = feldSetzen(e, F('f_5', 'a_unbekannt'))
    expect(ids(e)[ids(e).length - 1]).toBe('f_5@a_bbbbbbbb')
    // Abschnitt eines Felds ändern: ans Ende des neuen
    e = feldSetzen(e, F('f_1', A2.id))
    expect(ids(e)).toEqual(['f_2@a_aaaaaaaa', 'f_4@a_aaaaaaaa', 'f_3@a_bbbbbbbb', 'f_5@a_bbbbbbbb', 'f_1@a_bbbbbbbb'])
    expect(gruppen(e).map((g) => [g.abschnitt?.id, g.felder.map((f) => f.id)])).toEqual([
      ['a_aaaaaaaa', ['f_2', 'f_4']], ['a_bbbbbbbb', ['f_3', 'f_5', 'f_1']],
    ])
  })
  it('verschieben: innerhalb tauschen, am Rand in den Nachbarabschnitt, am Anfang und Ende nichts', () => {
    let e = mit({ abschnitte: [A1, A2], felder: [F('f_1', A1.id), F('f_2', A1.id), F('f_3', A2.id)] })
    e = feldVerschieben(e, 'f_2', -1)
    expect(ids(e)).toEqual(['f_2@a_aaaaaaaa', 'f_1@a_aaaaaaaa', 'f_3@a_bbbbbbbb'])
    e = feldVerschieben(e, 'f_1', 1)
    expect(ids(e)).toEqual(['f_2@a_aaaaaaaa', 'f_1@a_bbbbbbbb', 'f_3@a_bbbbbbbb'])
    e = feldVerschieben(e, 'f_1', -1)
    expect(ids(e)).toEqual(['f_2@a_aaaaaaaa', 'f_1@a_aaaaaaaa', 'f_3@a_bbbbbbbb'])
    expect(ids(feldVerschieben(e, 'f_2', -1))).toEqual(ids(e))
    // f_3 ganz unten im letzten Abschnitt: nichts
    expect(ids(feldVerschieben(e, 'f_3', 1))).toEqual(ids(e))
    // in einen leeren Abschnitt
    const A3 = { id: 'a_cccccccc', titel: 'Leer' }
    let l = mit({ abschnitte: [A1, A3, A2], felder: [F('f_1', A1.id), F('f_3', A2.id)] })
    l = feldVerschieben(l, 'f_1', 1)
    expect(ids(l)).toEqual(['f_1@a_cccccccc', 'f_3@a_bbbbbbbb'])
    l = feldVerschieben(l, 'f_3', -1)
    expect(ids(l)).toEqual(['f_1@a_cccccccc', 'f_3@a_cccccccc'])
    // ohne Abschnitte: tauschen
    const o = mit({ felder: [F('f_1'), F('f_2')] })
    expect(ids(feldVerschieben(o, 'f_2', -1))).toEqual(['f_2@', 'f_1@'])
    expect(ids(feldVerschieben(o, 'f_1', -1))).toEqual(['f_1@', 'f_2@'])
  })
  it('Abschnitte verschieben und entfernen: die Felder ziehen mit bzw. kommen in den Abschnitt davor', () => {
    let e = mit({ abschnitte: [A1, A2], felder: [F('f_1', A1.id), F('f_2', A2.id), F('f_3', A2.id)] })
    e = abschnittVerschieben(e, A2.id, -1)
    expect(e.abschnitte.map((a) => a.id)).toEqual([A2.id, A1.id])
    expect(ids(e)).toEqual(['f_2@a_bbbbbbbb', 'f_3@a_bbbbbbbb', 'f_1@a_aaaaaaaa'])
    expect(abschnittVerschieben(e, A2.id, -1)).toBe(e)
    // der erste weg: seine Felder in den nächsten
    const ohneErsten = abschnittEntfernen(e, A2.id)
    expect(ohneErsten.abschnitte).toEqual([A1])
    expect(ids(ohneErsten)).toEqual(['f_2@a_aaaaaaaa', 'f_3@a_aaaaaaaa', 'f_1@a_aaaaaaaa'])
    // der zweite weg: seine Felder ans Ende des vorigen
    const ohneZweiten = abschnittEntfernen(e, A1.id)
    expect(ids(ohneZweiten)).toEqual(['f_2@a_bbbbbbbb', 'f_3@a_bbbbbbbb', 'f_1@a_bbbbbbbb'])
    // der letzte weg: ohne Abschnitte, ohne Zuordnung
    expect(ids(abschnittEntfernen(ohneZweiten, A2.id))).toEqual(['f_2@', 'f_3@', 'f_1@'])
  })
  it('ordnen: fremde Abschnitte in den ersten, stabil', () => {
    expect(ordnen([A1, A2], [F('x', A2.id), F('y', 'a_weg'), F('z', A1.id)]).map((f) => `${f.id}@${f.abschnitt}`))
      .toEqual(['y@a_aaaaaaaa', 'z@a_aaaaaaaa', 'x@a_bbbbbbbb'])
  })
  it('abschnittPruefen wie schemaFehler', () => {
    for (const a of [{ titel: 'A' }, { titel: ' ' }, { titel: 'x'.repeat(120) }, { titel: 'x'.repeat(121) }, { titel: 'A', hilfe: 'h'.repeat(300) }, { titel: 'A', hilfe: 'h'.repeat(301) }]) {
      const eigen = abschnittPruefen(a)
      const server = schemaFehler({ abschnitte: [{ id: 'a_1', ...a }], felder: [] })
      expect(eigen === null).toBe(server === null)
    }
  })
})

describe('Entwurf prüfen und speichern', () => {
  const gueltig = mit({ titel: 'Fahrzeugcheck', abschnitte: [A1], felder: [F('f_1', A1.id)] })
  it('Titel, Beschreibung, Felder', () => {
    expect(entwurfPruefen(gueltig)).toBeNull()
    expect(entwurfPruefen({ ...gueltig, titel: ' ' })).toEqual({ feld: 'titel', text: E_TEXTE.titelFehlt })
    expect(entwurfPruefen({ ...gueltig, titel: 'x'.repeat(121) })?.feld).toBe('titel')
    expect(entwurfPruefen({ ...gueltig, beschreibung: 'b'.repeat(501) })?.feld).toBe('beschreibung')
    const kaputt = { ...gueltig, felder: [{ id: 'f_1', typ: 'auswahl' as const, label: 'Wahl', optionen: ['A'], abschnitt: A1.id }] }
    expect(entwurfPruefen(kaputt)).toEqual({ feld: 'schema', text: 'Die Felder des Formulars sind nicht gültig: Feld 1: Auswahl ohne Optionen, mindestens zwei.' })
  })
  it('Bestandsschutz: ein unverändertes altes Schema wird nicht geprüft (der Hook lässt es stehen)', () => {
    const alt = entwurfAusVorlage({ id: 'v1', title: 'Alt', is_active: true, schema: [{ id: 'x1', label: 'Wahl', fieldType: 'select', options: ['nur eine'] }] })
    expect(entwurfPruefen(alt)).toBeNull()
    expect(entwurfPruefen({ ...alt, titel: 'Alt, umbenannt' })).toBeNull()
    expect(entwurfPruefen(feldSetzen(alt, { ...alt.felder[0], label: 'Anders' }))?.feld).toBe('schema')
  })
  it('mitAltSchluesseln spiegelt wie der Hook (schemaNormalisieren)', () => {
    const felder: FeldDef[] = [
      { id: 'f_1', typ: 'langtext', label: 'Text', pflicht: true, hilfe: 'H' },
      { id: 'f_2', typ: 'mehrfach', label: 'M', optionen: ['a', 'b'] },
      { id: 'f_3', typ: 'janein', label: 'J' },
    ]
    const app = mitAltSchluesseln(felder)
    const server = R.schemaNormalisieren(felder, []).schema
    const auswahl = (x: Record<string, unknown>) => ({ fieldType: x.fieldType, required: x.required, hint: x.hint, options: x.options })
    expect(app.map(auswahl)).toEqual(server.map(auswahl))
    // und die neuen Seiten lesen dasselbe zurück
    expect(schemaLesen({ schema: app }).felder).toEqual(felder)
  })
  it('Body: neu mit Organisation, inaktiv; Ändern mit basis_version, ohne Aktiv', () => {
    const neu = speicherBody({ ...gueltig, titel: ' Fahrzeugcheck ' }, { orgId: 'org1' })
    expect(neu).toMatchObject({ title: 'Fahrzeugcheck', description: '', absender: 'frei', organization_id: 'org1', is_active: false, archiviert: false, abschnitte: [A1] })
    expect('basis_version' in neu).toBe(false)
    const gespeichert = entwurfAusVorlage({ id: 'v1', title: 'X', is_active: true, version: 3, schema: [] })
    const aendern = speicherBody(gespeichert, { orgId: 'org1' })
    expect(aendern.basis_version).toBe(3)
    for (const k of ['organization_id', 'is_active', 'archiviert']) expect(k in aendern).toBe(false)
    const ohneVersion = speicherBody(entwurfAusVorlage({ id: 'v1', title: 'X', schema: [] }), { orgId: 'org1' })
    expect('basis_version' in ohneVersion).toBe(false)
    // Unverändertes Schema geht beim Ändern nicht mit (Bestandsschutz alter Vorlagen), geändertes schon
    for (const k of ['schema', 'abschnitte']) expect(k in aendern).toBe(false)
    const alt = entwurfAusVorlage({ id: 'v2', title: 'Alt', version: 1, schema: [{ id: 'f1', label: 'Wahl', fieldType: 'select', options: ['nur eine'] }] })
    expect('schema' in speicherBody({ ...alt, titel: 'Alt neu' }, { orgId: 'org1' })).toBe(false)
    const mitFeld = feldSetzen(alt, { id: 'f_neu00001', typ: 'text', label: 'Kennzeichen' })
    const body = speicherBody(mitFeld, { orgId: 'org1' })
    expect((body.schema as { id: string }[]).map((f) => f.id)).toEqual(['f1', 'f_neu00001'])
    expect(body.abschnitte).toEqual([])
    expect('schema' in neu && 'abschnitte' in neu).toBe(true)
    expect(fehlendeFelder({ id: 'x', absender: 'frei' })).toEqual(['archiviert', 'abschnitte'])
  })
  it('sessionStorage: merken, lesen, vergessen; Unlesbares ist kein Entwurf', () => {
    const daten = new Map<string, string>()
    const s = { getItem: (k: string) => daten.get(k) ?? null, setItem: (k: string, v: string) => { daten.set(k, v) }, removeItem: (k: string) => { daten.delete(k) } }
    const e = { ...gueltig, titel: 'Fahrzeugcheck geändert' }
    expect(entwurfMerken('neu', e, s)).toBe(true)
    expect(daten.has(ENTWURF_PREFIX + 'neu')).toBe(true)
    expect(entwurfLesen('neu', s)).toEqual(e)
    expect(entwurfGeaendert(entwurfLesen('neu', s)!)).toBe(true)
    entwurfVergessen('neu', s)
    expect(entwurfLesen('neu', s)).toBeNull()
    daten.set(ENTWURF_PREFIX + 'x', '{kaputt')
    expect(entwurfLesen('x', s)).toBeNull()
    daten.set(ENTWURF_PREFIX + 'x', JSON.stringify({ v: 2 }))
    expect(entwurfLesen('x', s)).toBeNull()
    expect(entwurfLesen('x', null)).toBeNull()
    const voll = { ...s, setItem: () => { throw new Error('voll') } }
    expect(entwurfMerken('x', e, voll)).toBe(false)
  })
})

// ── Öffentliche Darstellung (4.1, 4.2) ─────────────────────────────────────

describe('Prüfen vor dem Senden', () => {
  const defs: FeldDef[] = [
    { id: 'f_a', typ: 'text', label: 'Kennzeichen', pflicht: true },
    { id: 'f_b', typ: 'zahl', label: 'Kilometer', min: 0 },
    { id: 'f_c', typ: 'janein', label: 'Sauber', pflicht: true },
    { id: 'f_d', typ: 'auswahl', label: 'Tank', optionen: ['voll', 'halb'], pflicht: true, aus: true },
  ]
  it('Pflicht zuerst, dann Werte; ausgeblendet nie; erster Fehler bekommt den Fokus', () => {
    const r = felderPruefen(defs, { f_b: '-3' })
    expect(r.fehler).toEqual({ f_a: 'Bitte „Kennzeichen“ ausfüllen.', f_b: 'Bitte „Kilometer“ prüfen.', f_c: 'Bitte „Sauber“ ausfüllen.' })
    expect(r.erster).toBe('f_a')
    // Nein ist eine Antwort
    expect(felderPruefen(defs, { f_a: 'AN-RK 1', f_b: '12,5', f_c: false })).toEqual({ fehler: {}, erster: null })
  })
  it('Server-Feld werte.<id> bzw. eigene.<id>', () => {
    expect(serverFeld('werte.f_a', 'werte')).toBe('f_a')
    expect(serverFeld('eigene.e_x', 'eigene')).toBe('e_x')
    expect(serverFeld('werte', 'werte')).toBeNull()
    expect(serverFeld(undefined, 'werte')).toBeNull()
  })
})

describe('Bausteine in Flächen', () => {
  it('Produktausgabe: Kopfdaten, Blöcke einzeln, eigene in die Gruppe davor oder „Weitere Angaben“', () => {
    let k = standardKonfig(null, 'produktausgabe')
    k = eigenesSetzen(k, { id: 'e_1', typ: 'text', label: 'Fahrzeug' })
    k = eigenesSetzen(k, { id: 'e_2', typ: 'text', label: 'Schicht' })
    k = { ...k, reihenfolge: ['einsatz', 'e_1', 'datum', 'positionen', 'lager_id', 'e_2'] }
    const g = gruppieren(bausteine(k, 'produktausgabe'), 'produktausgabe')
    const kurz = g.map((x) => [x.titel, x.block, x.teile.map((b) => (b.art === 'kern' ? b.id : b.feld.id))])
    expect(kurz).toEqual([
      ['Kopfdaten', null, ['einsatz', 'e_1', 'datum']],
      ['Positionen', 'positionen', ['positionen']],
      ['Verbrauchsort', 'lager_id', ['lager_id']],
      [WEITERE_ANGABEN, null, ['e_2']],
    ])
  })
  it('CIRS: Gruppen nach Art, Angaben zur Person nehmen keine eigenen Felder auf, Ausgeblendetes fehlt', () => {
    let k = standardKonfig({ formulare: { cirs: { felder: { warum: { aus: true }, vorschlag: { label: 'Idee' } } } } }, 'cirs')
    k = eigenesSetzen(k, { id: 'e_1', typ: 'janein', label: 'Im Einsatz?' })
    const g = gruppieren(bausteine(k, 'cirs'), 'cirs')
    expect(g.map((x) => [x.titel, x.teile.length])).toEqual([
      ['Ereignis', 4], ['Beschreibung', 2], ['Verbesserung', 1], ['Angaben zur Person', 2], [WEITERE_ANGABEN, 1],
    ])
    expect(eigeneFelder(bausteine(k, 'cirs')).map((f) => f.id)).toEqual(['e_1'])
  })
  it('Defektmeldung: jedes Kernfeld ein Block', () => {
    const g = gruppieren(bausteine(standardKonfig(null, 'defektmeldung'), 'defektmeldung'), 'defektmeldung')
    expect(g.map((x) => x.block)).toEqual(['device_id', 'description', 'severity'])
  })
  it('eigene Felder nur anbieten, wenn der Server sie nimmt', () => {
    const v2 = (x: boolean) => ({ version: 2, faehig: { eigene_felder: { produktausgabe: x, defektmeldung: x, cirs: x } } })
    expect(eigeneAngeboten('defektmeldung', { stand: v2(true), alterServer: false })).toBe(true)
    expect(eigeneAngeboten('defektmeldung', { stand: v2(false), alterServer: false })).toBe(false)
    // Server mit Routen, aber ohne eigene Felder (Version 1): gingen still verloren
    expect(eigeneAngeboten('produktausgabe', { stand: { version: 1 }, alterServer: false })).toBe(false)
    // ohne Antwort, aus der Organisation erschlossen, oder alter Server: anbieten
    expect(eigeneAngeboten('produktausgabe', { stand: { version: 0 }, alterServer: false })).toBe(true)
    expect(eigeneAngeboten('produktausgabe', { stand: null, alterServer: false })).toBe(true)
    expect(eigeneAngeboten('produktausgabe', { stand: null, alterServer: true })).toBe(true)
  })
})

describe('Liste „Eigene Formulare“ und Abschnitte entfernen', () => {
  it('Zeile unter dem Titel: Zustand, Absender, neue Einsendungen', () => {
    expect(vorlageZeile({ is_active: true, absender: 'passwort' }, 3)).toBe('Aktiv · Mitglied mit Passwort · 3 neu')
    expect(vorlageZeile({ is_active: false }, 0)).toBe('Inaktiv · Name frei eintragen')
    expect(vorlageZeile({ is_active: true, absender: 'anonym' }, null)).toBe('Aktiv · anonym')
    // archiviert schlägt aktiv; unbekannter Absender gilt als frei
    expect(vorlageZeile({ is_active: true, archiviert: true, absender: 'quatsch' }, 1)).toBe('Archiviert · Name frei eintragen · 1 neu')
  })
  it('wohin die Felder eines entfernten Abschnitts kommen, passt zu abschnittEntfernen', () => {
    expect(E_TEXTE.abschnittEntfernenText(0, 1)).toBe('Seine Felder bleiben, das Formular hat dann keine Abschnitte mehr.')
    expect(E_TEXTE.abschnittEntfernenText(0, 3)).toContain('nächsten Abschnitt')
    expect(E_TEXTE.abschnittEntfernenText(2, 3)).toContain('Abschnitt davor')
    const A = { id: 'a_eins0001', titel: 'Eins' }
    const B = { id: 'a_zwei0001', titel: 'Zwei' }
    let e = abschnittSetzen(abschnittSetzen(neuerEntwurf(), A), B)
    e = feldSetzen(e, { id: 'f_aaaa0001', typ: 'text', label: 'A', abschnitt: A.id })
    e = feldSetzen(e, { id: 'f_bbbb0001', typ: 'text', label: 'B', abschnitt: B.id })
    expect(abschnittEntfernen(e, A.id).felder.map((f) => f.abschnitt)).toEqual([B.id, B.id])
    expect(abschnittEntfernen(e, B.id).felder.map((f) => f.abschnitt)).toEqual([A.id, A.id])
    expect(abschnittEntfernen(abschnittEntfernen(e, B.id), A.id).felder.every((f) => f.abschnitt === undefined)).toBe(true)
  })
})
