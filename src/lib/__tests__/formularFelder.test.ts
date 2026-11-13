import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Felder der anpassbaren Standardformulare und der eigenen Formulare (Plan Vorgänge 1, 2) in
// pb_hooks/formular-regeln.js. Derselbe Code wie in PocketBase, in einem eigenen Kontext mit
// module.exports ausgeführt. Ergebnisse gehen über JSON (Objekte aus einem anderen Kontext).
const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/formular-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = (x: unknown): any => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
const GEDANKENSTRICHE = /[–—]/
type M = Record<string, unknown>

const JETZT = Date.parse('2026-11-07T12:00:00.000Z')
const pbZeit = (ms: number) => new Date(ms).toISOString().replace('T', ' ')

describe('Katalog und Grenzen (1.1, 1.2)', () => {
  it('Feldtypen, ohne Foto', () => {
    expect(j(R.FELD_TYPEN)).toEqual(['text', 'langtext', 'zahl', 'datum', 'uhrzeit', 'auswahl', 'mehrfach', 'janein'])
  })

  it('Grenzen wie im Plan', () => {
    const G = R.FELD_GRENZEN
    expect([G.eigene_standard, G.felder, G.abschnitte, G.label, G.hilfe, G.titel, G.beschreibung, G.notiz, G.werte_vorlage, G.werte_standard])
      .toEqual([30, 80, 20, 120, 300, 120, 500, 4000, 200000, 60000])
    expect([G.optionen_min, G.optionen, G.option, G.einheit, G.text, G.langtext, G.zahl, G.mehrfach, G.aelter, G.aelter_text, G.fassungen, G.verlauf])
      .toEqual([2, 30, 80, 12, 500, 4000, 1e9, 30, 30, 4000, 10, 500])
  })

  it('Kernfelder: Tabelle 1.2 vollständig', () => {
    const z = (f: string) => j(R.STANDARD_FELDER[f]).map((k: M) => [k.id, k.label, k.fest, k.ausErlaubt, k.pflichtWaehlbar, k.pflichtVor])
    expect(z('produktausgabe')).toEqual([
      ['einsatz', 'Einsatznummer', true, false, false, true],
      ['datum', 'Datum', true, false, false, true],
      ['positionen', 'Positionen', true, false, false, true],
      ['lager_id', 'Verbrauchsort', true, false, false, true],
    ])
    expect(z('defektmeldung')).toEqual([
      ['device_id', 'Gerät', true, false, false, true],
      ['description', 'Beschreibung', true, false, false, true],
      ['severity', 'Schweregrad', true, false, false, true],
    ])
    expect(z('cirs')).toEqual([
      ['datum', 'Datum des Ereignisses', false, true, true, true],
      ['ort', 'Ort', false, true, true, true],
      ['kategorie', 'Kategorie', false, true, true, true],
      ['schwere', 'Schweregrad', false, true, true, true],
      ['was', 'Was ist passiert?', true, false, false, true],
      ['warum', 'Warum ist es passiert?', false, true, true, false],
      ['folgen', 'Folgen', false, true, true, false],
      ['vorschlag', 'Wie lässt es sich verhindern?', false, true, true, false],
      ['melder_name', 'Name (freiwillig)', false, true, false, false],
      ['melder_kontakt', 'Kontakt (freiwillig)', false, true, false, false],
    ])
    expect(R.STANDARD_FELDER.patienten).toBeUndefined()
  })

  it('EIGEN, Sammlung und Statusfeld', () => {
    expect(j(R.EIGEN)).toEqual({ formular: 'eigen', sammlung: 'form_submissions', statusfeld: 'absender_status', modul: 'dokumente' })
    expect(R.sammlungFuer('eigen')).toBe('form_submissions')
    expect(R.sammlungFuer('produktausgabe')).toBe('product_outputs')
    expect(R.sammlungFuer('cirs')).toBe('')
    expect(R.sammlungFuer('__proto__')).toBe('')
    expect(R.statusfeldVon('form_submissions')).toBe('absender_status')
    expect(R.statusfeldVon('mpg_defect_reports')).toBe('reporter_status')
  })

  it('Diagnose nennt alle neuen Felder (2.6)', () => {
    const f = j(R.FELDER_DIAGNOSE).map((x: string[]) => x.join('.'))
    for (const n of ['form_templates.absender', 'form_templates.archiviert', 'form_templates.abschnitte', 'form_templates.version', 'form_templates.fassungen',
      'form_submissions.status', 'form_submissions.notiz', 'form_submissions.bearbeitung', 'form_submissions.absender_status', 'mpg_defect_reports.eigene',
      'patients.absender_status', 'product_outputs.absender_status', 'mpg_defect_reports.reporter_status']) expect(f).toContain(n)
  })
})

describe('standardKonfig (1.2)', () => {
  const ohne = { v: 1, version: 0, felder: {}, reihenfolge: ['einsatz', 'datum', 'positionen', 'lager_id'], eigene: [] }

  it('Vorgabe ohne Einstellung, auch aus Kaputtem', () => {
    for (const cfg of [undefined, null, '', '{kaputt', 7, [], {}, { formulare: null }, { formulare: [] }, { formulare: { produktausgabe: 'x' } }, { formulare: { produktausgabe: [] } }]) {
      expect([JSON.stringify(cfg), j(R.standardKonfig(cfg, 'produktausgabe'))]).toEqual([JSON.stringify(cfg), ohne])
    }
  })

  it('Objekt, Text und doppelt kodiert gleich', () => {
    const cfg = { formulare: { produktausgabe: { v: 1, version: 3, felder: { einsatz: { label: ' Auftragsnummer ', hilfe: 'Steht auf dem Zettel.' } }, reihenfolge: ['datum'], eigene: [{ id: 'e_k3j9x0a1', typ: 'text', label: 'Fahrzeug', pflicht: true }] } } }
    const a = j(R.standardKonfig(cfg, 'produktausgabe'))
    expect(j(R.standardKonfig(JSON.stringify(cfg), 'produktausgabe'))).toEqual(a)
    expect(j(R.standardKonfig(JSON.stringify(JSON.stringify(cfg)), 'produktausgabe'))).toEqual(a)
    expect(a).toEqual({
      v: 1, version: 3,
      felder: { einsatz: { label: 'Auftragsnummer', hilfe: 'Steht auf dem Zettel.' } },
      reihenfolge: ['datum', 'einsatz', 'positionen', 'lager_id', 'e_k3j9x0a1'],
      eigene: [{ id: 'e_k3j9x0a1', typ: 'text', label: 'Fahrzeug', pflicht: true }],
    })
  })

  it('aus nur bei abschaltbaren, Pflicht nur bei wählbaren Kernfeldern', () => {
    const cfg = { formulare: {
      produktausgabe: { felder: { einsatz: { aus: true, pflicht: false }, datum: { label: '' } } },
      cirs: { felder: { warum: { aus: true }, ort: { pflicht: false }, melder_name: { pflicht: true, aus: true }, was: { aus: true, pflicht: false, label: 'Ereignis' }, unbekannt: { label: 'x' } } },
    } }
    expect(j(R.standardKonfig(cfg, 'produktausgabe')).felder).toEqual({})
    expect(j(R.standardKonfig(cfg, 'cirs')).felder).toEqual({ warum: { aus: true }, ort: { pflicht: false }, melder_name: { aus: true }, was: { label: 'Ereignis' } })
  })

  it('Reihenfolge: unbekannte und doppelte fallen weg, fehlende in Katalogfolge, eigene danach in Anlegefolge', () => {
    const cfg = { formulare: { cirs: { reihenfolge: ['e_zwei', 'gibtsnicht', 'was', 'was', 7, 'e_drei'], eigene: [
      { id: 'e_eins', typ: 'zahl', label: 'Eins' }, { id: 'e_zwei', typ: 'janein', label: 'Zwei' }, { id: 'e_drei', typ: 'datum', label: 'Drei' },
    ] } } }
    expect(j(R.standardKonfig(cfg, 'cirs')).reihenfolge).toEqual(['e_zwei', 'was', 'e_drei', 'datum', 'ort', 'kategorie', 'schwere', 'warum', 'folgen', 'vorschlag', 'melder_name', 'melder_kontakt', 'e_eins'])
  })

  it('eigene: Unlesbares, falsche Art, Kennung eines Kernfelds und Doppelte fallen weg, höchstens 30', () => {
    const eigene: unknown[] = [
      { id: 'e_ok', typ: 'auswahl', label: 'A', optionen: [' x ', 'X', 'y', ''] },
      { id: 'e_ok', typ: 'text', label: 'doppelt' },
      { id: 'einsatz', typ: 'text', label: 'Kern' },
      { id: 'e_foto', typ: 'foto', label: 'Foto' },
      { id: '', typ: 'text', label: 'ohne' },
      { id: '__proto__', typ: 'text', label: 'böse' },
      'text', null,
    ]
    for (let i = 0; i < 40; i++) eigene.push({ id: `e_n${i}`, typ: 'text', label: `N${i}` })
    const k = j(R.standardKonfig({ formulare: { produktausgabe: { eigene } } }, 'produktausgabe'))
    expect(k.eigene.length).toBe(30)
    expect(k.eigene[0]).toEqual({ id: 'e_ok', typ: 'auswahl', label: 'A', optionen: ['x', 'y'] })
    expect(k.eigene.map((d: M) => d.id)).not.toContain('einsatz')
  })

  it('Version: nur ganze Zahlen ab 0', () => {
    for (const [v, soll] of [[3, 3], [0, 0], [-1, 0], [1.5, 0], ['4', 0], [null, 0]] as [unknown, number][]) {
      expect(R.standardKonfig({ formulare: { cirs: { version: v } } }, 'cirs').version).toBe(soll)
    }
  })

  it('Patientendoku hat keinen Katalog', () => {
    expect(j(R.standardKonfig({ formulare: { patienten: { eigene: [{ id: 'e_x', typ: 'text', label: 'X' }] } } }, 'patienten')))
      .toEqual({ v: 1, version: 0, felder: {}, reihenfolge: ['e_x'], eigene: [{ id: 'e_x', typ: 'text', label: 'X' }] })
  })
})

describe('Schema der Vorlagen: lesen und normalisieren (1.4)', () => {
  const alt = [
    { id: 'f_1730000000001', label: 'Kennzeichen', fieldType: 'text', required: true, hint: 'wie am Fahrzeug' },
    { id: 'f_1730000000002', label: 'Bemerkung', fieldType: 'textarea', required: false },
    { id: 'f_1730000000003', label: 'Kilometer', fieldType: 'number', required: false },
    { id: 'f_1730000000004', label: 'Tag', fieldType: 'date', required: false },
    { id: 'f_1730000000005', label: 'Uhr', fieldType: 'time', required: false },
    { id: 'f_1730000000006', label: 'Wache', fieldType: 'select', required: true, options: ['Nord', 'Süd'] },
    { id: 'f_1730000000007', label: 'Sauber', fieldType: 'checkbox', required: false },
    { id: 'f_1730000000008', label: 'Unbekannt', fieldType: 'signature', required: false },
  ]

  it('alte Vorlage (fieldType, required, hint, options) als neue Felder, ein Abschnitt ohne Titel', () => {
    const s = j(R.schemaLesen({ schema: alt }))
    expect(s.abschnitte).toEqual([])
    expect(s.felder).toEqual([
      { id: 'f_1730000000001', typ: 'text', label: 'Kennzeichen', hilfe: 'wie am Fahrzeug', pflicht: true },
      { id: 'f_1730000000002', typ: 'langtext', label: 'Bemerkung' },
      { id: 'f_1730000000003', typ: 'zahl', label: 'Kilometer' },
      { id: 'f_1730000000004', typ: 'datum', label: 'Tag' },
      { id: 'f_1730000000005', typ: 'uhrzeit', label: 'Uhr' },
      { id: 'f_1730000000006', typ: 'auswahl', label: 'Wache', pflicht: true, optionen: ['Nord', 'Süd'] },
      { id: 'f_1730000000007', typ: 'janein', label: 'Sauber' },
    ])
    expect(j(R.schemaLesen({ schema: JSON.stringify(alt) }))).toEqual(s)
    expect(j(R.schemaLesen({ schema: JSON.stringify(JSON.stringify(alt)) }))).toEqual(s)
  })

  it('neue Vorlage nach Abschnitten geordnet, unbekannter Abschnitt in den ersten', () => {
    const s = j(R.schemaLesen({
      abschnitte: [{ id: 'a_eins', titel: ' Fahrzeug ' }, { id: 'a_zwei', titel: 'Besatzung', hilfe: 'Wer fuhr?' }, { id: 'a_eins', titel: 'doppelt' }],
      schema: [
        { id: 'f_b', typ: 'text', label: 'B', abschnitt: 'a_zwei' },
        { id: 'f_a', typ: 'text', label: 'A', abschnitt: 'a_eins' },
        { id: 'f_c', typ: 'text', label: 'C', abschnitt: 'gibtsnicht' },
        { id: 'f_d', typ: 'janein', label: 'D' },
        { id: 'f_a', typ: 'text', label: 'doppelt' },
      ],
    }))
    expect(s.abschnitte).toEqual([{ id: 'a_eins', titel: 'Fahrzeug' }, { id: 'a_zwei', titel: 'Besatzung', hilfe: 'Wer fuhr?' }])
    expect(s.felder.map((f: M) => `${f.id}:${f.abschnitt}`)).toEqual(['f_a:a_eins', 'f_c:a_eins', 'f_d:a_eins', 'f_b:a_zwei'])
  })

  it('ohne Abschnitte fällt abschnitt weg; Unlesbares ergibt ein leeres Schema', () => {
    expect(j(R.schemaLesen({ schema: [{ id: 'f_x', typ: 'text', label: 'X', abschnitt: 'a_weg' }] })).felder).toEqual([{ id: 'f_x', typ: 'text', label: 'X' }])
    for (const v of [undefined, null, 'x', [], { schema: '{kaputt' }, { schema: { a: 1 } }]) expect(j(R.schemaLesen(v))).toEqual({ abschnitte: [], felder: [] })
  })

  it('Zahl: Einheit, min und max nur stimmig', () => {
    const f = (x: M) => j(R.schemaLesen({ schema: [{ id: 'f_z', typ: 'zahl', label: 'Z', ...x }] })).felder[0]
    expect(f({ einheit: ' km ', min: 0, max: 10 })).toEqual({ id: 'f_z', typ: 'zahl', label: 'Z', einheit: 'km', min: 0, max: 10 })
    expect(f({ min: 5, max: 1 })).toEqual({ id: 'f_z', typ: 'zahl', label: 'Z' })
    expect(f({ min: 2e9 })).toEqual({ id: 'f_z', typ: 'zahl', label: 'Z' })
    expect(f({ max: 3, optionen: ['a', 'b'] })).toEqual({ id: 'f_z', typ: 'zahl', label: 'Z', max: 3 })
  })

  it('schemaNormalisieren spiegelt die Altschlüssel für alte Seiten (B11)', () => {
    const n = j(R.schemaNormalisieren([
      { id: 'f_t', typ: 'text', label: 'T', hilfe: 'H', pflicht: true },
      { id: 'f_l', typ: 'langtext', label: 'L' },
      { id: 'f_z', typ: 'zahl', label: 'Z' },
      { id: 'f_d', typ: 'datum', label: 'D' },
      { id: 'f_u', typ: 'uhrzeit', label: 'U' },
      { id: 'f_a', typ: 'auswahl', label: 'A', optionen: ['x', 'y'] },
      { id: 'f_m', typ: 'mehrfach', label: 'M', optionen: ['x', 'y'] },
      { id: 'f_j', typ: 'janein', label: 'J', pflicht: true, aus: true },
    ], []))
    expect(n.schema.map((f: M) => [f.id, f.fieldType, f.required])).toEqual([
      ['f_t', 'text', true], ['f_l', 'textarea', false], ['f_z', 'number', false], ['f_d', 'date', false],
      ['f_u', 'time', false], ['f_a', 'select', false], ['f_m', 'text', false], ['f_j', 'checkbox', false],
    ])
    expect(n.schema[0].hint).toBe('H')
    expect(n.schema[5].options).toEqual(['x', 'y'])
    expect(n.felder[0]).toEqual({ id: 'f_t', typ: 'text', label: 'T', hilfe: 'H', pflicht: true })
    expect(n.felder.some((f: M) => 'fieldType' in f)).toBe(false)
    // gespiegelt und wieder gelesen: dieselben Felder
    expect(j(R.schemaLesen({ schema: n.schema })).felder).toEqual(n.felder)
  })
})

describe('schemaFehler (2.7.3): je Regel ein Fall', () => {
  const F = (x: M = {}) => ({ id: 'f_a', typ: 'text', label: 'A', ...x })
  const A = (x: M = {}) => ({ id: 'a_1', titel: 'Eins', ...x })
  const fall = (abschnitte: unknown, felder: unknown) => R.schemaFehler({ abschnitte, felder })
  const lang = (n: number) => 'x'.repeat(n)

  const TAB: [string, unknown, unknown, string, string][] = [
    ['Abschnitte unlesbar', 'x', [], 'abschnitte', 'Die Abschnitte sind unlesbar'],
    ['zu viele Abschnitte', Array.from({ length: 21 }, (_, i) => A({ id: `a_${i}` })), [], 'abschnitte', 'Höchstens 20 Abschnitte'],
    ['Abschnitt unlesbar', [7], [], 'abschnitte', 'Abschnitt 1 ist unlesbar'],
    ['Abschnitt ohne Kennung', [A({ id: '' })], [], 'abschnitte', 'Abschnitt 1 hat keine gültige Kennung'],
    ['Abschnitt Kennung doppelt', [A(), A()], [], 'a_1', 'Abschnitt 2: Kennung doppelt'],
    ['Abschnitt ohne Titel', [A({ titel: '  ' })], [], 'a_1', 'Abschnitt 1 hat keinen Titel'],
    ['Abschnitt Titel zu lang', [A({ titel: lang(121) })], [], 'a_1', 'Titel von Abschnitt 1 ist zu lang, höchstens 120 Zeichen'],
    ['Abschnitt Hilfe zu lang', [A({ hilfe: lang(301) })], [], 'a_1', 'Hilfetext von Abschnitt 1 ist zu lang, höchstens 300 Zeichen'],
    ['Felder unlesbar', [], 'x', 'schema', 'Die Felder sind unlesbar'],
    ['zu viele Felder', [], Array.from({ length: 81 }, (_, i) => F({ id: `f_${i}` })), 'schema', 'Höchstens 80 Felder'],
    ['Feld unlesbar', [], [null], 'schema', 'Feld 1 ist unlesbar'],
    ['Feld ohne Kennung', [], [F({ id: 'a b' })], 'schema', 'Feld 1 hat keine gültige Kennung'],
    ['Feld Kennung aus Object.prototype', [], [F({ id: 'constructor' })], 'schema', 'Feld 1 hat keine gültige Kennung'],
    ['Feld Kennung doppelt', [], [F(), F()], 'f_a', 'Feld 2: Kennung doppelt'],
    ['unbekannte Art', [], [F({ typ: 'foto' })], 'f_a', 'Feld 1 hat eine unbekannte Art'],
    ['ohne Bezeichnung', [], [F({ label: ' ' })], 'f_a', 'Feld 1 hat keine Bezeichnung'],
    ['Bezeichnung zu lang', [], [F({ label: lang(121) })], 'f_a', 'Bezeichnung von Feld 1 ist zu lang, höchstens 120 Zeichen'],
    ['Hilfetext zu lang', [], [F({ hilfe: lang(301) })], 'f_a', 'Hilfetext von Feld 1 ist zu lang, höchstens 300 Zeichen'],
    ['Auswahl ohne Optionen', [], [F({ typ: 'auswahl', optionen: ['nur eine'] })], 'f_a', 'Feld 1: Auswahl ohne Optionen, mindestens zwei'],
    ['Mehrfach ohne Optionen', [], [F({ typ: 'mehrfach' })], 'f_a', 'Feld 1: Auswahl ohne Optionen, mindestens zwei'],
    ['zu viele Optionen', [], [F({ typ: 'auswahl', optionen: Array.from({ length: 31 }, (_, i) => `o${i}`) })], 'f_a', 'Feld 1: höchstens 30 Optionen'],
    ['leere Option', [], [F({ typ: 'auswahl', optionen: ['a', ' '] })], 'f_a', 'Feld 1: Option 2 ist leer oder länger als 80 Zeichen'],
    ['Option zu lang', [], [F({ typ: 'auswahl', optionen: ['a', lang(81)] })], 'f_a', 'Feld 1: Option 2 ist leer oder länger als 80 Zeichen'],
    ['Option doppelt (groß/klein)', [], [F({ typ: 'mehrfach', optionen: ['Ja', ' ja '] })], 'f_a', 'Feld 1: Option doppelt'],
    ['Einheit zu lang', [], [F({ typ: 'zahl', einheit: lang(13) })], 'f_a', 'Einheit von Feld 1 ist zu lang, höchstens 12 Zeichen'],
    ['min größer max', [], [F({ typ: 'zahl', min: 5, max: 1 })], 'f_a', 'Feld 1: kleinster und größter Wert passen nicht'],
    ['min zu groß', [], [F({ typ: 'zahl', min: 2e9 })], 'f_a', 'Feld 1: kleinster und größter Wert passen nicht'],
    ['max keine Zahl', [], [F({ typ: 'zahl', max: '3' })], 'f_a', 'Feld 1: kleinster und größter Wert passen nicht'],
    ['Abschnitt fehlt', [A()], [F({ abschnitt: 'a_2' })], 'f_a', 'Feld 1 gehört zu keinem Abschnitt'],
    ['Abschnitt ohne Abschnitte', [], [F({ abschnitt: 'a_1' })], 'f_a', 'Feld 1 gehört zu keinem Abschnitt'],
  ]
  for (const [name, abschnitte, felder, feld, text] of TAB) {
    it(name, () => {
      expect(j(fall(abschnitte, felder))).toEqual({ feld, text })
      expect(GEDANKENSTRICHE.test(text)).toBe(false)
    })
  }

  it('gültig: neu, alt, leer, mit Zahlgrenzen und Mehrfachauswahl', () => {
    expect(fall([], [])).toBeNull()
    expect(fall(undefined, undefined)).toBeNull()
    expect(R.schemaFehler(null)).toBeNull()
    expect(fall([A()], [F({ abschnitt: 'a_1' }), F({ id: 'f_z', typ: 'zahl', min: 0, max: 0, einheit: 'km' }), F({ id: 'f_m', typ: 'mehrfach', optionen: ['a', 'b'] }), F({ id: 'f_j', typ: 'janein', abschnitt: 'a_1' })].map((f) => ({ ...f, abschnitt: 'a_1' })))).toBeNull()
    expect(R.schemaFehler(R.schemaRoh([{ id: 'f_1', label: 'Alt', fieldType: 'select', options: ['a', 'b'], required: true }], null))).toBeNull()
  })

  it('Text der Vorlage: „Die Felder des Formulars sind nicht gültig: {grund}.“', () => {
    const r = j(R.vorlagePruefen({ title: 'T', schema: [F({ label: '' })] }))
    expect(r).toEqual({ ok: false, feld: 'f_a', text: 'Die Felder des Formulars sind nicht gültig: Feld 1 hat keine Bezeichnung.' })
  })
})

describe('Werte je Feldtyp (1.1)', () => {
  const d = (typ: string, x: M = {}) => ({ id: 'f_x', typ, label: 'X', ...x })
  const opt = ['Rot', 'Grün', 'Blau']
  // [Feld, Wert, ok, normalisiert]
  const TAB: [M, unknown, boolean, unknown?][] = [
    [d('text'), '  Hallo  ', true, 'Hallo'],
    [d('text'), 'x'.repeat(500), true, 'x'.repeat(500)],
    [d('text'), 'x'.repeat(501), false],
    [d('text'), 5, false],
    [d('text'), ['a'], false],
    [d('langtext'), 'Zeile 1\r\nZeile 2\rZeile 3 ', true, 'Zeile 1\nZeile 2\nZeile 3'],
    [d('langtext'), 'x'.repeat(4000), true, 'x'.repeat(4000)],
    [d('langtext'), 'x'.repeat(4001), false],
    [d('zahl'), 3.5, true, 3.5],
    [d('zahl'), '3,5', true, 3.5],
    [d('zahl'), ' -2 ', true, -2],
    [d('zahl'), -0, true, 0],
    [d('zahl'), 1e9, true, 1e9],
    [d('zahl'), 1e9 + 1, false],
    [d('zahl'), Infinity, false],
    [d('zahl'), NaN, false],
    [d('zahl'), '1e3', false],
    [d('zahl'), '3.5.1', false],
    [d('zahl'), true, false],
    [d('zahl', { min: 0, max: 10 }), 10, true, 10],
    [d('zahl', { min: 0, max: 10 }), 11, false],
    [d('zahl', { min: 0, max: 10 }), -1, false],
    [d('datum'), '2026-11-07', true, '2026-11-07'],
    [d('datum'), ' 2024-02-29 ', true, '2024-02-29'],
    [d('datum'), '2026-02-30', false],
    [d('datum'), '07.11.2026', false],
    [d('datum'), 20261107, false],
    [d('uhrzeit'), '00:00', true, '00:00'],
    [d('uhrzeit'), '23:59', true, '23:59'],
    [d('uhrzeit'), '24:00', false],
    [d('uhrzeit'), '9:30', false],
    [d('uhrzeit'), '09:60', false],
    [d('auswahl', { optionen: opt }), ' Grün ', true, 'Grün'],
    [d('auswahl', { optionen: opt }), 'grün', false],
    [d('auswahl', { optionen: opt }), 'Gelb', false],
    [d('auswahl', { optionen: opt }), ['Rot'], false],
    [d('mehrfach', { optionen: opt }), ['Blau', 'Rot'], true, ['Rot', 'Blau']],
    [d('mehrfach', { optionen: opt }), ['Rot', 'Rot'], false],
    [d('mehrfach', { optionen: opt }), ['Gelb'], false],
    [d('mehrfach', { optionen: opt }), 'Rot', false],
    [d('mehrfach', { optionen: opt }), [1], false],
    [d('janein'), true, true, true],
    [d('janein'), false, true, false],
    [d('janein'), 'true', false],
    [d('janein'), 1, false],
    [d('foto'), 'x', false],
  ]
  for (const [def, wert, ok, norm] of TAB) {
    it(`${def.typ} ${JSON.stringify(wert)?.slice(0, 30)} → ${ok ? 'gültig' : 'ungültig'}`, () => {
      const r = j(R.wertPruefen(def, wert))
      expect(r.ok).toBe(ok)
      if (ok) expect(r.wert).toEqual(norm)
    })
  }

  it('wertLeer: fehlt, null, Leerzeichen, leere Liste; Nein und 0 sind Werte', () => {
    for (const w of [undefined, null, '', '   ', []]) expect(R.wertLeer(w)).toBe(true)
    for (const w of [false, 0, 'x', ['a'], {}]) expect(R.wertLeer(w)).toBe(false)
  })

  it('werteBereinigen: nur gültige, nicht leere Werte sichtbarer Felder', () => {
    const defs = [d('text', { id: 'f_t' }), d('zahl', { id: 'f_z' }), d('janein', { id: 'f_j' }), d('text', { id: 'f_aus', aus: true }), d('auswahl', { id: 'f_a', optionen: opt })]
    expect(j(R.werteBereinigen(defs, { f_t: ' a ', f_z: '4,0', f_j: false, f_aus: 'weg', f_a: 'Lila', fremd: 'x', __proto__: { f_t: 'böse' } })))
      .toEqual({ f_t: 'a', f_z: 4, f_j: false })
    expect(j(R.werteBereinigen(defs, null))).toEqual({})
    expect(j(R.werteBereinigen(null, { f_t: 'a' }))).toEqual({})
  })
})

describe('angabenBauen (2.4, Tabelle vollständig)', () => {
  const defs = [
    { id: 'e_text', typ: 'text', label: 'Fahrzeug', pflicht: true },
    { id: 'e_zahl', typ: 'zahl', label: 'Kilometer', einheit: 'km' },
    { id: 'e_aus', typ: 'text', label: 'Ausgeblendet', pflicht: true, aus: true },
    { id: 'e_wahl', typ: 'mehrfach', label: 'Material', optionen: ['A', 'B', 'C'] },
  ]
  const bau = (eingabe: unknown, o: M = {}) => j(R.angabenBauen(defs, eingabe, { versionAktuell: 4, ...o }))
  const SCHNAPP = defs.filter((x) => !x.aus)

  it('eingabe kein Objekt: keine ältere Fassung genannt, also streng (Pflicht greift)', () => {
    for (const e of [undefined, null, 'x', 4, []]) expect(bau(e)).toEqual({ ok: false, feld: 'e_text', text: 'Bitte „Fahrzeug“ ausfüllen.' })
    expect(j(R.angabenBauen([defs[1]], null, { versionAktuell: 4 }))).toEqual({ ok: true, angaben: { v: 1, version: 4, felder: [defs[1]], werte: {} } })
  })

  it('werte kein Objekt: werte {} (aktuelle Fassung: Pflicht greift)', () => {
    expect(bau({ version: 4, werte: 'x' })).toEqual({ ok: false, feld: 'e_text', text: 'Bitte „Fahrzeug“ ausfüllen.' })
    expect(j(R.angabenBauen([defs[1]], { version: 4, werte: [1] }, { versionAktuell: 4 }))).toEqual({ ok: true, angaben: { v: 1, version: 4, felder: [defs[1]], werte: {} } })
  })

  it('Feld leer, Pflicht, nicht aus, aktuelle Fassung: Fehler mit Bezeichnung', () => {
    for (const w of [undefined, '', '  ', null]) expect(bau({ version: 4, werte: { e_text: w } })).toEqual({ ok: false, feld: 'e_text', text: 'Bitte „Fahrzeug“ ausfüllen.' })
  })

  it('Feld leer sonst: übersprungen (ausgeblendet, ältere Fassung, nicht Pflicht)', () => {
    expect(bau({ version: 4, werte: { e_text: 'RTW 1' } })).toEqual({ ok: true, angaben: { v: 1, version: 4, felder: SCHNAPP, werte: { e_text: 'RTW 1' } } })
    expect(bau({ version: 3, werte: {} })).toEqual({ ok: true, angaben: { v: 1, version: 3, felder: SCHNAPP, werte: {} } })
    expect(bau({ version: 0, werte: {} }).ok).toBe(true)
  })

  it('falsche Fassungsnummer (fehlt, Text, Bruch, negativ, gleich, größer): streng wie die aktuelle (Review F4)', () => {
    for (const v of [undefined, null, '3', '4', 3.5, -1, 4, 5, 99, 1e10, true, [3], { v: 3 }]) {
      const e: M = { werte: { e_alt: '=HYPERLINK("x")' } }
      if (v !== undefined) e.version = v
      expect(bau(e)).toEqual({ ok: false, feld: 'e_text', text: 'Bitte „Fahrzeug“ ausfüllen.' })
      expect(bau({ ...e, werte: { e_text: 'x', e_zahl: 'viel' } })).toEqual({ ok: false, feld: 'e_zahl', text: 'Bitte „Kilometer“ prüfen.' })
      // gültig: als aktuelle Fassung festgehalten, Unbekanntes verworfen, nichts unter aelter
      expect(bau({ ...e, werte: { e_text: 'RTW 1', e_alt: '=HYPERLINK("x")' } }).angaben).toEqual({ v: 1, version: 4, felder: SCHNAPP, werte: { e_text: 'RTW 1' } })
    }
  })

  it('ohne aktuelle Fassung (0) ist nichts älter: immer streng', () => {
    expect(j(R.angabenBauen(defs, { version: 0, werte: {} }, { versionAktuell: 0 })).ok).toBe(false)
    expect(j(R.angabenBauen(defs, { version: 0, werte: {} }, {})).ok).toBe(false)
  })

  it('Wert ungültig, aktuelle Fassung: Fehler „prüfen“', () => {
    expect(bau({ version: 4, werte: { e_text: 'x', e_zahl: 'viel' } })).toEqual({ ok: false, feld: 'e_zahl', text: 'Bitte „Kilometer“ prüfen.' })
    expect(bau({ version: 4, werte: { e_text: 'x', e_wahl: ['D'] } })).toEqual({ ok: false, feld: 'e_wahl', text: 'Bitte „Material“ prüfen.' })
  })

  it('Wert ungültig, ältere Fassung: als Text nach aelter', () => {
    const a = bau({ version: 2, werte: { e_text: 'x', e_zahl: 'viel', e_wahl: ['D', 'A'] } })
    expect(a.ok).toBe(true)
    expect(a.angaben.werte).toEqual({ e_text: 'x' })
    expect(a.angaben.aelter).toEqual([{ id: 'e_zahl', wert: 'viel' }, { id: 'e_wahl', wert: '["D","A"]' }])
  })

  it('Kennung unbekannt: aktuell verworfen, älter nach aelter (auch ausgeblendete Felder)', () => {
    expect(bau({ version: 4, werte: { e_text: 'x', e_alt: 'weg', e_aus: 'auch weg' } }).angaben).toEqual({ v: 1, version: 4, felder: SCHNAPP, werte: { e_text: 'x' } })
    expect(bau({ version: 1, werte: { e_alt: 'Wert', e_leer: '', e_aus: 'versteckt' } }).angaben.aelter).toEqual([{ id: 'e_alt', wert: 'Wert' }, { id: 'e_aus', wert: 'versteckt' }])
  })

  it('unbekannte Kennungen in aelter: feste Folge, egal in welcher Folge sie kommen (Go-Map im Hook)', () => {
    const vor = bau({ version: 1, werte: { e_z: '1', e_b: '2', e_m: '3' } }).angaben.aelter
    const rueck = bau({ version: 1, werte: { e_m: '3', e_b: '2', e_z: '1' } }).angaben.aelter
    expect(vor.map((x: M) => x.id)).toEqual(['e_b', 'e_m', 'e_z'])
    expect(rueck).toEqual(vor)
    // ungültige Werte bekannter Felder stehen davor, in der Folge der Felder
    expect(bau({ version: 2, werte: { e_y: 'a', e_zahl: 'viel' } }).angaben.aelter.map((x: M) => x.id)).toEqual(['e_zahl', 'e_y'])
    // die Grenze von 30 trifft immer dieselben Kennungen
    const viele: M = {}
    for (let i = 39; i >= 0; i--) viele[`e_u${String(i).padStart(2, '0')}`] = 'y'
    expect(bau({ version: 1, werte: viele }).angaben.aelter.map((x: M) => x.id).slice(-1)).toEqual(['e_u29'])
  })

  it('gültig: getrimmt und normalisiert', () => {
    expect(bau({ version: 4, werte: { e_text: ' RTW 1 ', e_zahl: '12,5', e_wahl: ['C', 'A'] } }).angaben.werte).toEqual({ e_text: 'RTW 1', e_zahl: 12.5, e_wahl: ['A', 'C'] })
  })

  it('aelter höchstens 30 Einträge, je 4000 Zeichen', () => {
    const werte: M = {}
    for (let i = 0; i < 40; i++) werte[`e_u${i}`] = 'y'.repeat(4100)
    const a = bau({ version: 1, werte })
    expect(a.angaben.aelter.length).toBe(30)
    expect(a.angaben.aelter.every((x: M) => String(x.wert).length === 4000)).toBe(true)
  })

  it('zu groß: Fehler auf „werte“, unabhängig von der Fassung', () => {
    const r = j(R.angabenBauen(defs, { version: 1, werte: { e_text: 'x'.repeat(70000) } }, { versionAktuell: 4, grenze: R.FELD_GRENZEN.werte_standard }))
    expect(r).toEqual({ ok: false, feld: 'werte', text: 'Das sind zu viele Angaben für ein Formular. Bitte kürzen.' })
    expect(bau({ version: 4, werte: { e_text: 'x'.repeat(400) } }).ok).toBe(true)
  })

  it('Version im Ergebnis: die genannte ältere Fassung, sonst die aktuelle', () => {
    expect(bau({ version: 2, werte: {} }).angaben.version).toBe(2)
    expect(bau({ version: 0, werte: {} }).angaben.version).toBe(0)
    expect(bau({ version: 4, werte: { e_text: 'x' } }).angaben.version).toBe(4)
    expect(bau({ version: 9, werte: { e_text: 'x' } }).angaben.version).toBe(4)
    expect(j(R.angabenBauen([], {}, {})).angaben.version).toBe(0)
  })

  it('Bezeichnung mit $ wird wörtlich eingesetzt', () => {
    expect(j(R.angabenBauen([{ id: 'e_p', typ: 'text', label: 'Preis $& netto', pflicht: true }], { version: 1, werte: {} }, { versionAktuell: 1 })).text)
      .toBe('Bitte „Preis $& netto“ ausfüllen.')
  })

  it('Ja/Nein als Pflicht: Nein zählt als beantwortet', () => {
    expect(j(R.angabenBauen([{ id: 'e_j', typ: 'janein', label: 'Sauber', pflicht: true }], { version: 1, werte: { e_j: false } }, { versionAktuell: 1 })).angaben.werte).toEqual({ e_j: false })
  })
})

describe('Fassungen (F4, F5)', () => {
  it('fassungenNeu: die letzten 10, nach Nummer', () => {
    let f: unknown = null
    for (let v = 1; v <= 12; v++) f = R.fassungenNeu(f, v, [{ id: 'f_a', typ: 'text', label: `L${v}` }], [], `am${v}`)
    expect(Object.keys(j(f))).toEqual(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
    expect(j(f)['12']).toEqual({ schema: [{ id: 'f_a', typ: 'text', label: 'L12' }], abschnitte: [], am: 'am12' })
    expect(Object.keys(j(R.fassungenNeu('{kaputt', 1, [], [], '')))).toEqual(['1'])
    expect(Object.keys(j(R.fassungenNeu({ x: {}, 2: 'kein Objekt', 3: {} }, 4, [], [], '')))).toEqual(['3', '4'])
  })

  it('fassungenNeu: über FASSUNGEN_MAX_ZEICHEN fällt die älteste zuerst weg, die neue bleibt immer', () => {
    expect(R.FASSUNGEN_MAX_ZEICHEN).toBe(2000000)
    // Eine große Fassung (80 Felder mit langen Hilfetexten und 30 Optionen) hat gut 200 000 Zeichen
    const gross = (v: number) => Array.from({ length: 80 }, (_, i) => ({ id: `f_${i}`, typ: 'auswahl', label: `Feld ${v} ${i}`.padEnd(120, 'x'), hilfe: 'h'.repeat(300), optionen: Array.from({ length: 30 }, (_, k) => `Option ${k}`.padEnd(80, 'o')) }))
    const groesse = (R.kanonisch({ schema: gross(1), abschnitte: [], am: '' }) as string).length
    expect(groesse).toBeGreaterThan(200000)
    let f: unknown = null
    for (let v = 1; v <= 10; v++) f = R.fassungenNeu(f, v, gross(v), [], '')
    const k = Object.keys(j(f))
    expect(k.length).toBeLessThan(10)
    expect(k[k.length - 1]).toBe('10')
    expect(k).toEqual(Array.from({ length: k.length }, (_, i) => String(11 - k.length + i)))
    expect((R.kanonisch(j(f)) as string).length).toBeLessThanOrEqual(R.FASSUNGEN_MAX_ZEICHEN)
    // Eine einzige übergroße Fassung bleibt trotzdem (die aktuelle fällt nie weg)
    const riesig = Array.from({ length: 8 }, (_, i) => ({ id: `f_${i}`, typ: 'text', label: 'x'.repeat(120), hilfe: 'y'.repeat(300_000) }))
    expect(Object.keys(j(R.fassungenNeu({ 1: { schema: [], abschnitte: [] } }, 2, riesig, [], '')))).toEqual(['2'])
    // Kleine Fassungen: wie bisher die letzten 10
    let g: unknown = null
    for (let v = 1; v <= 12; v++) g = R.fassungenNeu(g, v, [{ id: 'f_a', typ: 'text', label: `L${v}` }], [], '')
    expect(Object.keys(j(g)).length).toBe(10)
  })

  const vorlage = {
    version: 3,
    schema: [{ id: 'f_neu', typ: 'zahl', label: 'Neu', pflicht: true }],
    abschnitte: [],
    fassungen: { 2: { schema: [{ id: 'f_alt', typ: 'text', label: 'Alt' }], abschnitte: [{ id: 'a_1', titel: 'Eins' }] } },
  }

  it('fassungFuer: gespeicherte ältere Fassung, sonst die aktuelle (auch wenn unter einer größeren Nummer etwas läge)', () => {
    expect(j(R.fassungFuer({ ...vorlage, fassungen: { ...vorlage.fassungen, 7: { schema: [{ id: 'f_x', typ: 'text', label: 'X' }] } } }, 7)).version).toBe(3)
    expect(j(R.fassungFuer(vorlage, 2))).toEqual({ version: 2, abschnitte: [{ id: 'a_1', titel: 'Eins' }], felder: [{ id: 'f_alt', typ: 'text', label: 'Alt', abschnitt: 'a_1' }], aktuell: false })
    for (const v of [3, 1, 99, undefined, 'x', -1]) {
      expect(j(R.fassungFuer(vorlage, v))).toEqual({ version: 3, abschnitte: [], felder: [{ id: 'f_neu', typ: 'zahl', label: 'Neu', pflicht: true }], aktuell: true })
    }
    expect(j(R.fassungFuer({ ...vorlage, fassungen: JSON.stringify(vorlage.fassungen) }, 2)).version).toBe(2)
    expect(j(R.fassungFuer({ schema: [] }, 0))).toEqual({ version: 0, abschnitte: [], felder: [], aktuell: true })
  })

  it('vorlageFassung: anlegen 1, Felder geändert +1, sonst gleich; fehlende bisherige Fassung wird ergänzt', () => {
    const felder = [{ id: 'f_a', typ: 'text', label: 'A' }]
    const neu = j(R.vorlageFassung({ neu: true, felder, abschnitte: [], am: 'T1' }))
    expect(neu).toEqual({ version: 1, fassungen: { 1: { schema: felder, abschnitte: [], am: 'T1' } }, geaendert: true })
    const gleich = j(R.vorlageFassung({ neu: false, altVersion: 1, altFelder: felder, altAbschnitte: [], altFassungen: neu.fassungen, felder: j(felder), abschnitte: [], am: 'T2' }))
    expect(gleich).toEqual({ version: 1, fassungen: neu.fassungen, geaendert: false })
    const anders = j(R.vorlageFassung({ neu: false, altVersion: 1, altFelder: felder, altAbschnitte: [], altFassungen: neu.fassungen, felder: [{ ...felder[0], pflicht: true }], abschnitte: [], am: 'T3' }))
    expect([anders.version, Object.keys(anders.fassungen), anders.geaendert]).toEqual([2, ['1', '2'], true])
    const ohneFassungen = j(R.vorlageFassung({ neu: false, altVersion: 0, altFelder: felder, altAbschnitte: [], altFassungen: null, felder: [], abschnitte: [], am: 'T4' }))
    expect([ohneFassungen.version, Object.keys(ohneFassungen.fassungen)]).toEqual([1, ['0', '1']])
    expect(ohneFassungen.fassungen['0'].schema).toEqual(felder)
  })

  it('basisKonflikt: nur wenn basis_version da ist und abweicht', () => {
    for (const [b, g, soll] of [[undefined, 3, false], [null, 3, false], ['', 3, false], [3, 3, false], ['3', 3, false], [2, 3, true], ['2', 3, true], ['x', 3, true], [0, 0, false], [0, undefined, false], [1, undefined, true]] as [unknown, unknown, boolean][]) {
      expect([b, g, R.basisKonflikt(b, g)]).toEqual([b, g, soll])
    }
  })
})

describe('Vorlage prüfen (2.7.3)', () => {
  const v = (x: M = {}) => j(R.vorlagePruefen({ title: 'Fahrzeugcheck', description: '', schema: [], abschnitte: [], ...x }))
  it('Titel 1 bis 120, Beschreibung bis 500', () => {
    expect(v({ title: '  ' })).toEqual({ ok: false, feld: 'title', text: 'Bitte einen Titel eintragen, höchstens 120 Zeichen.' })
    expect(v({ title: 'x'.repeat(121) }).feld).toBe('title')
    expect(v({ title: 7 }).feld).toBe('title')
    expect(v({ description: 'x'.repeat(501) })).toEqual({ ok: false, feld: 'description', text: 'Die Beschreibung ist zu lang. Höchstens 500 Zeichen.' })
    expect(v({ title: ' T ', description: ' D ' }).werte).toMatchObject({ title: 'T', description: 'D' })
  })
  it('Absender passwort, frei, anonym, sonst frei; archiviert heißt inaktiv', () => {
    expect(v({ absender: 'anonym' }).werte.absender).toBe('anonym')
    expect(v({ absender: 'passwort' }).werte.absender).toBe('passwort')
    for (const a of ['', 'Anonym', null, undefined, 1]) expect(v({ absender: a }).werte.absender).toBe('frei')
    expect(v({ archiviert: true, is_active: true }).werte).toMatchObject({ archiviert: true, is_active: false })
    expect(v({ archiviert: false, is_active: true }).werte).toMatchObject({ archiviert: false, is_active: true })
    expect(v({ is_active: 'true' }).werte.is_active).toBe(false)
  })
  it('alte Liste wird normalisiert, Altschlüssel gespiegelt', () => {
    const r = v({ schema: [{ id: 'f_1', label: 'Alt', fieldType: 'checkbox', required: true }] })
    expect(r.werte.felder).toEqual([{ id: 'f_1', typ: 'janein', label: 'Alt', pflicht: true }])
    expect(r.werte.schema).toEqual([{ id: 'f_1', typ: 'janein', label: 'Alt', pflicht: true, fieldType: 'checkbox', required: true }])
    expect(r.werte.bestand).toBe(false)
  })
  it('Bestandsschutz: altes ungültiges Schema, unverändert gelassen, bleibt (aktivieren, archivieren); jede Änderung streng', () => {
    // Alter Baukasten: Auswahl mit einer Option, doppelte Optionen, langer Hinweis
    const altSchema = [
      { id: 'f_1730000000001', label: 'Art', fieldType: 'select', options: ['Nur eine'] },
      { id: 'f_1730000000002', label: 'Wahl', fieldType: 'select', options: ['Ja', 'ja'], hint: 'h'.repeat(400) },
    ]
    const alt = { title: 'x'.repeat(130), description: 'd'.repeat(600), schema: altSchema, abschnitte: [] }
    const p = (x: M, a: unknown = alt) => j(R.vorlagePruefen({ title: alt.title, description: alt.description, schema: altSchema, abschnitte: [], is_active: true, ...x }, a))
    // Ohne gespeicherten Satz (Anlegen) oder ohne alt: streng
    expect(p({}, null).ok).toBe(false)
    expect(j(R.vorlagePruefen({ title: 'T', schema: altSchema })).text).toMatch(/Auswahl ohne Optionen/)
    // Unverändert (auch als JSON-Text oder in der neuen Schreibweise): Bestand, nur Schalter ändern sich
    const r = p({ archiviert: true })
    expect(r.ok).toBe(true)
    expect(r.werte).toMatchObject({ bestand: true, archiviert: true, is_active: false, title: alt.title, description: alt.description })
    expect(p({ schema: JSON.stringify(altSchema) }).werte.bestand).toBe(true)
    expect(p({ schema: j(R.schemaNormalisieren(altSchema, []).schema) }).werte.bestand).toBe(true)
    // Titel oder Beschreibung geändert und zu lang: abgewiesen; gekürzt: angenommen
    expect(p({ title: 'y'.repeat(130) }).feld).toBe('title')
    expect(p({ description: 'e'.repeat(600) }).feld).toBe('description')
    expect(p({ title: 'Kurz' }).werte).toMatchObject({ bestand: true, title: 'Kurz' })
    // Leerer Titel nie, auch wenn er vorher leer war
    expect(j(R.vorlagePruefen({ title: '', schema: [] }, { title: '', schema: [] })).feld).toBe('title')
    // Schema inhaltlich geändert: streng geprüft
    expect(p({ schema: [...altSchema, { id: 'f_neu', typ: 'text', label: 'Neu' }] }).text).toMatch(/Auswahl ohne Optionen/)
    expect(p({ schema: [{ ...altSchema[0], label: 'Art neu' }, altSchema[1]] }).ok).toBe(false)
    // Repariert: gültig, normalisiert, kein Bestand mehr
    const gut = p({ schema: [{ id: 'f_1730000000001', typ: 'auswahl', label: 'Art', optionen: ['A', 'B'] }] })
    expect(gut.werte).toMatchObject({ bestand: false })
    expect(gut.werte.schema[0]).toMatchObject({ typ: 'auswahl', fieldType: 'select', options: ['A', 'B'] })
  })
})

describe('Absender-Art und Annahme einer Vorlage (2.1)', () => {
  const org = { id: 'o1', freigeschaltet: null }
  const vl = (x: M = {}) => ({ organization_id: 'o1', is_active: true, archiviert: false, ...x })
  it('vorlageModus', () => {
    for (const [a, soll] of [['passwort', 'passwort'], ['frei', 'frei'], ['anonym', 'anonym'], ['', 'frei'], [undefined, 'frei'], ['ANONYM', 'frei']] as [unknown, string][]) {
      expect(R.vorlageModus({ absender: a })).toBe(soll)
    }
    expect(R.vorlageModus(null)).toBe('frei')
  })
  it('vorlageAn: eigene Org, aktiv, nicht archiviert, Modul Vorgänge frei', () => {
    expect(R.vorlageAn(org, vl())).toBe(true)
    expect(R.vorlageAn(org, vl({ is_active: false }))).toBe(false)
    expect(R.vorlageAn(org, vl({ archiviert: true }))).toBe(false)
    expect(R.vorlageAn(org, vl({ organization_id: 'o2' }))).toBe(false)
    expect(R.vorlageAn({ id: 'o1', freigeschaltet: ['patienten'] }, vl())).toBe(false)
    expect(R.vorlageAn({ id: 'o1', freigeschaltet: ['lager'] }, vl())).toBe(true)
    expect(R.vorlageAn(null, vl())).toBe(false)
    expect(R.vorlageAn(org, null)).toBe(false)
    expect(R.vorlageAn(org, vl({ is_active: 'true' }))).toBe(false)
  })
})

describe('Einsendung: payload und Zusammenfassung (1.5, 2.5)', () => {
  const angaben = { v: 1, version: 4, felder: [{ id: 'f_d', typ: 'datum', label: 'Tag' }, { id: 'f_j', typ: 'janein', label: 'Sauber' }], werte: { f_d: '2026-11-07', f_j: true } }
  const absender = { id: 'u1', name: 'Ida Imker', status: 'nicht_bestaetigt', weg: '', modus: 'frei', am: '', feld: 'x' }
  const T = Date.parse('2026-11-07T10:20:05.120Z')

  it('frei: mit Absender (ohne feld), Titel, Fassung, Abschnitte', () => {
    const p = j(R.einsendungPayload({ vorlage: { title: ' Fahrzeugcheck ' }, fassung: { abschnitte: [{ id: 'a_1', titel: 'Eins' }] }, angaben, absender, modus: 'frei', eingangMs: T, pruefsumme: 'abc' }))
    expect(p).toEqual({
      v: 2, titel: 'Fahrzeugcheck', version: 4, abschnitte: [{ id: 'a_1', titel: 'Eins' }], felder: angaben.felder, werte: angaben.werte, aelter: [],
      absender_modus: 'frei', abgesendet: '2026-11-07T10:20:05.120Z', eingang_sha256: 'abc',
      absender: { id: 'u1', name: 'Ida Imker', status: 'nicht_bestaetigt', weg: '', modus: 'frei', am: '' },
    })
  })

  it('anonym: kein Absender, auch wenn einer mitkäme', () => {
    const p = j(R.einsendungPayload({ vorlage: { title: '' }, fassung: null, angaben: { ...angaben, aelter: [{ id: 'x', wert: 'y' }] }, absender, modus: 'anonym', eingangMs: T, pruefsumme: '' }))
    expect('absender' in p).toBe(false)
    expect([p.titel, p.absender_modus, p.abschnitte, p.aelter]).toEqual(['Formular', 'anonym', [], [{ id: 'x', wert: 'y' }]])
  })

  it('Zusammenfassung: „Titel: erster Wert“, höchstens 120 Zeichen', () => {
    expect(R.einsendungZusammenfassung({ titel: 'Fahrzeugcheck', felder: angaben.felder, werte: angaben.werte })).toBe('Fahrzeugcheck: 07.11.2026')
    expect(R.einsendungZusammenfassung({ titel: 'T', felder: angaben.felder, werte: { f_j: false } })).toBe('T: Nein')
    expect(R.einsendungZusammenfassung({ titel: 'T', felder: [{ id: 'f_z', typ: 'zahl', label: 'Z', einheit: 'km' }], werte: { f_z: 2.5 } })).toBe('T: 2,5 km')
    expect(R.einsendungZusammenfassung({ titel: 'T', felder: [{ id: 'f_m', typ: 'mehrfach', label: 'M' }], werte: { f_m: ['a', 'b'] } })).toBe('T: a, b')
    expect(R.einsendungZusammenfassung(JSON.stringify({ titel: 'T', felder: [{ id: 'f_t', typ: 'langtext', label: 'L' }], werte: { f_t: 'a\nb' } }))).toBe('T: a b')
    expect(R.einsendungZusammenfassung({ titel: 'x'.repeat(200) }).length).toBe(120)
    expect(R.einsendungZusammenfassung(null)).toBe('')
  })
})

describe('Einsendung bearbeiten (2.7.2)', () => {
  const basis = { status: 'neu', notiz: '', bearbeitung: { verlauf: [] }, von: { id: 'u1', name: 'Ina Inbox' }, am: 'T1', id: 'v1', mitVerlauf: true }
  const aendern = (x: M) => j(R.einsendungAendern({ ...basis, ...x }))

  it('Status gültig: Verlauf mit vorher und nachher', () => {
    const r = aendern({ body: { status: 'in_bearbeitung' } })
    expect(r).toEqual({ ok: true, status: 'in_bearbeitung', notiz: '', geaendert: true, bearbeitung: { verlauf: [{ id: 'v1', am: 'T1', von: { id: 'u1', name: 'Ina Inbox' }, status_vorher: 'neu', status: 'in_bearbeitung', notiz: false }] } })
  })

  it('ungültiger Status, zu lange oder unlesbare Notiz: Fehler', () => {
    for (const s of ['', 'archiviert', null, 1]) expect(aendern({ body: { status: s } })).toEqual({ ok: false, text: 'Diesen Status gibt es nicht.' })
    expect(aendern({ body: { notiz: 'x'.repeat(4001) } })).toEqual({ ok: false, text: 'Die Notiz ist zu lang. Höchstens 4000 Zeichen.' })
    expect(aendern({ body: { notiz: 7 } }).ok).toBe(false)
  })

  it('Notiz: getrimmt, Zeilenumbrüche vereinheitlicht, Verlauf ohne Inhalt der Notiz', () => {
    const r = aendern({ body: { notiz: ' Rückruf\r\nerledigt ' } })
    expect([r.notiz, r.bearbeitung.verlauf[0].notiz, JSON.stringify(r.bearbeitung).includes('Rückruf')]).toEqual(['Rückruf\nerledigt', true, false])
    expect(aendern({ body: { notiz: null } }).notiz).toBe('')
  })

  it('ohne Änderung kein Verlauf; ohne Feld bearbeitung kein Verlauf', () => {
    expect(aendern({ body: { status: 'neu' } })).toMatchObject({ ok: true, geaendert: false, bearbeitung: { verlauf: [] } })
    expect(aendern({ body: {} }).geaendert).toBe(false)
    expect(aendern({ body: { status: 'erledigt' }, mitVerlauf: false }).bearbeitung).toEqual({ verlauf: [] })
  })

  it('Verlauf höchstens 500, Unlesbares im alten Verlauf fällt weg', () => {
    const alt = Array.from({ length: 500 }, (_, i) => ({ id: `x${i}` }))
    const r = aendern({ bearbeitung: JSON.stringify({ verlauf: [...alt, 'kaputt'] }), body: { status: 'erledigt' } })
    expect(r.bearbeitung.verlauf.length).toBe(500)
    expect(r.bearbeitung.verlauf[499].status).toBe('erledigt')
    expect(r.bearbeitung.verlauf[0].id).toBe('x1')
  })
})

describe('Eigene Felder in Produktausgabe, Defektmeldung und CIRS (2.4, 2.7.5)', () => {
  const cfg = { formulare: {
    produktausgabe: { version: 3, felder: { einsatz: { label: 'Auftragsnummer' } }, eigene: [{ id: 'e_fz', typ: 'text', label: 'Fahrzeug', pflicht: true }, { id: 'e_art', typ: 'auswahl', label: 'Art', optionen: ['Notfall', 'Fahrt'] }] },
    defektmeldung: { version: 1, eigene: [{ id: 'e_ort', typ: 'text', label: 'Standort' }] },
    cirs: { version: 2, felder: { warum: { aus: true } }, eigene: [{ id: 'e_schicht', typ: 'auswahl', label: 'Schicht', optionen: ['Tag', 'Nacht'], pflicht: true }] },
  } }
  const orgId = 'o1'
  const bestand = { orte: { l1: { organization_id: orgId, name: 'RTW 1' } }, artikel: { i1: { organization_id: orgId, name: 'Binde', unit: 'Stk' } }, geraete: { g1: { organization_id: orgId, name: 'Corpuls' } } }
  const ausgabe = { einsatz: 'E-117', datum: '2026-11-07', lager_id: 'l1', positionen: [{ item_id: 'i1', qty: 2 }] }

  it('ohne daten.eigene wie datenPruefen', () => {
    expect(j(R.datenPruefenMitEigenen('produktausgabe', ausgabe, bestand, { orgId, formConfig: cfg }))).toEqual(j(R.datenPruefen('produktausgabe', ausgabe, bestand, { orgId })))
  })

  it('Produktausgabe: Pflicht fehlt bei aktueller Fassung 400 mit feld eigene.<Kennung>', () => {
    expect(j(R.datenPruefenMitEigenen('produktausgabe', { ...ausgabe, eigene: { version: 3, werte: {} } }, bestand, { orgId, formConfig: cfg })))
      .toEqual({ ok: false, feld: 'eigene.e_fz', text: 'Bitte „Fahrzeug“ ausfüllen.' })
  })

  it('Produktausgabe: Schnappschuss mit Bezeichnungen vom Server, nicht vom Client', () => {
    const r = j(R.datenPruefenMitEigenen('produktausgabe', { ...ausgabe, eigene: { version: 3, werte: { e_fz: ' RTW 1 ', e_art: 'Fahrt' }, felder: [{ id: 'e_fz', label: 'gefälscht' }] } }, bestand, { orgId, formConfig: JSON.stringify(cfg) }))
    expect(r.ok).toBe(true)
    expect(r.daten.eigene).toEqual({ v: 1, version: 3, felder: cfg.formulare.produktausgabe.eigene, werte: { e_fz: 'RTW 1', e_art: 'Fahrt' } })
  })

  it('Produktausgabe: ältere Fassung angenommen, Unpassendes in aelter', () => {
    const r = j(R.datenPruefenMitEigenen('produktausgabe', { ...ausgabe, eigene: { version: 1, werte: { e_art: 'Lila', e_weg: 'x' } } }, bestand, { orgId, formConfig: cfg }))
    expect(r.daten.eigene).toEqual({ v: 1, version: 1, felder: cfg.formulare.produktausgabe.eigene, werte: {}, aelter: [{ id: 'e_art', wert: 'Lila' }, { id: 'e_weg', wert: 'x' }] })
  })

  it('Produktausgabe: falsche Fassungsnummer prüft streng (Review F4)', () => {
    for (const version of [99, '1', undefined, 3.5]) {
      expect(j(R.datenPruefenMitEigenen('produktausgabe', { ...ausgabe, eigene: { version, werte: { e_art: 'Lila' } } }, bestand, { orgId, formConfig: cfg })))
        .toEqual({ ok: false, feld: 'eigene.e_fz', text: 'Bitte „Fahrzeug“ ausfüllen.' })
    }
  })

  it('Fehler der Kernfelder gehen vor', () => {
    expect(j(R.datenPruefenMitEigenen('produktausgabe', { ...ausgabe, einsatz: '', eigene: { version: 3, werte: {} } }, bestand, { orgId, formConfig: cfg })).feld).toBe('einsatz')
  })

  it('zu groß: feld „eigene“', () => {
    expect(j(R.datenPruefenMitEigenen('defektmeldung', { device_id: 'g1', description: 'kaputt', eigene: { version: 1, werte: { e_ort: 'x'.repeat(70000) } } }, bestand, { orgId, formConfig: cfg })).feld).toBe('eigene')
  })

  it('Defektmeldung: eigene Angaben', () => {
    const r = j(R.datenPruefenMitEigenen('defektmeldung', { device_id: 'g1', description: 'kaputt', eigene: { version: 1, werte: { e_ort: 'Halle' } } }, bestand, { orgId, formConfig: cfg }))
    expect(r.daten.eigene).toEqual({ v: 1, version: 1, felder: [{ id: 'e_ort', typ: 'text', label: 'Standort' }], werte: { e_ort: 'Halle' } })
  })

  it('Patientendoku nimmt keine eigenen Felder', () => {
    const r = j(R.datenPruefenMitEigenen('patienten', { payload: { a: 1 }, eigene: { version: 0, werte: { x: 1 } } }, bestand, { orgId, maske: 'doku', formConfig: cfg }))
    expect(r.ok).toBe(true)
    expect('eigene' in r.daten).toBe(false)
  })

  it('CIRS: gebaut aus { version, werte }, ungültig mit Text, nichts mitgeschickt null', () => {
    expect(j(R.cirsEigene(cfg, { version: 2, werte: { e_schicht: 'Nacht' } }))).toEqual({ ok: true, eigene: { v: 1, version: 2, felder: cfg.formulare.cirs.eigene, werte: { e_schicht: 'Nacht' } } })
    expect(j(R.cirsEigene(cfg, { version: 2, werte: { e_schicht: 'Mittag' } }))).toEqual({ ok: false, text: 'Bitte „Schicht“ prüfen.' })
    expect(j(R.cirsEigene(cfg, { version: 2, werte: {} }))).toEqual({ ok: false, text: 'Bitte „Schicht“ ausfüllen.' })
    expect(j(R.cirsEigene(cfg, { version: 1, werte: { e_schicht: 'Mittag' } })).eigene).toMatchObject({ version: 1, aelter: [{ id: 'e_schicht', wert: 'Mittag' }] })
    for (const version of [7, '1', null]) expect(j(R.cirsEigene(cfg, { version, werte: {} }))).toEqual({ ok: false, text: 'Bitte „Schicht“ ausfüllen.' })
    for (const x of [undefined, null, 'x', []]) expect(j(R.cirsEigene(cfg, x))).toEqual({ ok: true, eigene: null })
  })
})

describe('Recht Vorgänge (2.10, wie die Regel VORGAENGE)', () => {
  const u = (x: M = {}) => ({ id: 'u1', sammlung: 'users', name: 'Ina Inbox', organization_id: 'o1', role: 'benutzer', supervisor: false, disabled: false, expires_at: '', permissions: {}, temp_permissions: {}, ...x })
  const TAB: [string, M, boolean][] = [
    ['dokumente dauerhaft', u({ permissions: { dokumente: true } }), true],
    ['dokumente befristet gültig', u({ temp_permissions: { dokumente: { until: pbZeit(JETZT + 60_000) } } }), true],
    ['dokumente befristet abgelaufen', u({ temp_permissions: { dokumente: { until: pbZeit(JETZT - 60_000) } } }), false],
    ['Leitung', u({ role: 'admin' }), true],
    ['Supervisor eigene Org', u({ supervisor: true }), true],
    ['ohne Recht', u({ permissions: { lager: true } }), false],
    ['fremde Org', u({ organization_id: 'o2', permissions: { dokumente: true } }), false],
    ['Supervisor fremde Org', u({ organization_id: 'o2', supervisor: true }), false],
    ['Teilnehmer mit Recht', u({ role: 'teilnehmer', permissions: { dokumente: true } }), false],
    ['gesperrt', u({ disabled: true, permissions: { dokumente: true } }), false],
    ['abgelaufen', u({ expires_at: pbZeit(JETZT - 1000), permissions: { dokumente: true } }), false],
    ['Superuser-Konto', u({ sammlung: '_superusers', permissions: { dokumente: true } }), false],
  ]
  for (const [name, person, soll] of TAB) it(name, () => expect(R.darfVorgaenge(person, 'o1', JETZT)).toBe(soll))
  it('ohne Person oder ohne Org nein', () => {
    expect(R.darfVorgaenge(null, 'o1', JETZT)).toBe(false)
    expect(R.darfVorgaenge(u({ permissions: { dokumente: true } }), '', JETZT)).toBe(false)
  })
})

describe('Texte dieses Pakets (2.8)', () => {
  it('wörtlich wie im Plan', () => {
    const T = R.EIGENE_TEXTE
    expect([T.vorlage_aus, T.pflicht, T.wert, T.zu_gross, T.eigen_alt, T.einsendung_loeschen, T.vorlage_loeschen, T.vorlage_geaendert, T.vorlage_schema, T.status, T.notiz, T.cirs_was]).toEqual([
      'Dieses Formular ist nicht aktiv.',
      'Bitte „{label}“ ausfüllen.',
      'Bitte „{label}“ prüfen.',
      'Das sind zu viele Angaben für ein Formular. Bitte kürzen.',
      'Diese Fassung der App kann dieses Formular nicht mehr senden. Bitte die Seite neu laden.',
      'Einsendungen werden nicht gelöscht. Erledigte stehen im Archiv.',
      'Dieses Formular hat Einsendungen. Bitte archivieren statt löschen.',
      'Das Formular wurde inzwischen an anderer Stelle geändert. Bitte neu laden.',
      'Die Felder des Formulars sind nicht gültig: {grund}.',
      'Diesen Status gibt es nicht.',
      'Die Notiz ist zu lang. Höchstens 4000 Zeichen.',
      'Bitte beschreiben, was passiert ist.',
    ])
  })
  it('kein Gedankenstrich in EIGENE_TEXTE', () => {
    for (const [k, v] of Object.entries(R.EIGENE_TEXTE as Record<string, string>)) expect([k, GEDANKENSTRICHE.test(v)]).toEqual([k, false])
  })
  it('die Fehlertexte der Rückfälle in den Hooks stehen so in EIGENE_TEXTE', () => {
    const hooks = readFileSync(new URL('../../../pb_hooks/eigene-formulare.pb.js', import.meta.url), 'utf8')
    for (const t of [R.EIGENE_TEXTE.status, R.EIGENE_TEXTE.notiz, R.EIGENE_TEXTE.einsendung_loeschen]) expect(hooks.includes(t) ? t : `fehlt: ${t}`).toBe(t)
    expect(GEDANKENSTRICHE.test(hooks.split('\n').filter((z) => /Error\(/.test(z)).join('\n'))).toBe(false)
  })
})
