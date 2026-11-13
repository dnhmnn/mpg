import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import {
  FELD_GRENZEN, FELD_TEXTE, FELD_TYPEN, STANDARD_FELDER, STANDARD_FORMULARE, VORLAGE_MODI, EINSENDUNG_STATUS,
  abschnitteLesen, angabenLesen, feldLesen, kennungOk, pflichtFehlt, schemaFehler, schemaLesen, standardKonfig,
  vorlageModus, wertFehler, wertLeer, wertPruefen, werteBereinigen, type FeldDef,
} from '../formular/felder'

// Gleichlauf App und Server für die Felder (Plan Vorgänge 2.9): src/lib/formular/felder.ts ist
// der Zwilling von pb_hooks/formular-regeln.js. Beide rechnen über dieselbe Tabelle gleich; der
// Server entscheidet, die App zeigt vorher dasselbe an.
const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/formular-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = (x: unknown): any => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
type M = Record<string, unknown>

const feld = (x: M): M => ({ id: 'f_a', typ: 'text', label: 'A', ...x })

// Felder in vielen Formen: neu, alt, kaputt
const FELDER: unknown[] = [
  feld({}), feld({ hilfe: ' Hilfe ', pflicht: true }), feld({ aus: true, pflicht: true }), feld({ label: '  ' }), feld({ label: 'x'.repeat(130) }),
  feld({ typ: 'langtext' }), feld({ typ: 'zahl', einheit: ' km ', min: 0, max: 10 }), feld({ typ: 'zahl', min: 5, max: 1 }), feld({ typ: 'zahl', min: 2e9 }),
  feld({ typ: 'zahl', max: '3' }), feld({ typ: 'datum' }), feld({ typ: 'uhrzeit' }), feld({ typ: 'auswahl', optionen: ['a', 'B', ' b ', ''] }),
  feld({ typ: 'auswahl', optionen: ['nur'] }), feld({ typ: 'mehrfach', optionen: ['x', 'y', 'z'] }), feld({ typ: 'janein', pflicht: 'ja' }),
  feld({ typ: 'foto' }), feld({ id: '' }), feld({ id: '__proto__' }), feld({ id: 'toString' }), feld({ id: 'a'.repeat(41) }), feld({ id: 'f-b_c' }),
  feld({ abschnitt: 'a_1' }), feld({ abschnitt: 'a_fehlt' }), feld({ abschnitt: 7 }),
  { id: 'f_1730000000001', label: 'Alt', fieldType: 'select', required: true, hint: 'H', options: ['a', 'b'] },
  { id: 'f_1730000000002', label: 'Alt', fieldType: 'checkbox', required: false },
  { id: 'f_1730000000003', label: 'Alt', fieldType: 'textarea' },
  { id: 'f_1730000000004', label: 'Alt', fieldType: 'signature' },
  null, 'text', 7, [],
]

const ABSCHNITTE: unknown[] = [
  undefined, null, [], 'x', '[{"id":"a_1","titel":"Eins"}]',
  [{ id: 'a_1', titel: 'Eins' }], [{ id: 'a_1', titel: ' Eins ', hilfe: ' H ' }, { id: 'a_2', titel: 'Zwei' }],
  [{ id: 'a_1', titel: '' }], [{ id: 'a_1', titel: 'Eins' }, { id: 'a_1', titel: 'doppelt' }], [{ id: '', titel: 'x' }], [7],
  [{ id: 'a_1', titel: 'x'.repeat(121) }], Array.from({ length: 21 }, (_, i) => ({ id: `a_${i}`, titel: `A${i}` })),
]

const SCHEMAS: unknown[] = [
  ...FELDER.map((f) => [f]),
  [feld({}), feld({})],
  [feld({ abschnitt: 'a_2' }), feld({ id: 'f_b', abschnitt: 'a_1' }), feld({ id: 'f_c' })],
  Array.from({ length: 81 }, (_, i) => feld({ id: `f_${i}` })),
  [], 'x', '[{"id":"f_t","typ":"text","label":"T"}]', JSON.stringify(JSON.stringify([feld({})])), null, undefined, { a: 1 },
]

describe('Gleichlauf Felder: Konstanten', () => {
  it('FELD_TYPEN, FELD_GRENZEN, STANDARD_FELDER, Modi, Status gleich', () => {
    expect(j(FELD_TYPEN)).toEqual(j(R.FELD_TYPEN))
    expect(j(FELD_GRENZEN)).toEqual(j(R.FELD_GRENZEN))
    expect(j(STANDARD_FELDER)).toEqual(j(R.STANDARD_FELDER))
    expect(j(STANDARD_FORMULARE)).toEqual(j(R.STANDARD_FORMULARE))
    expect(j(VORLAGE_MODI)).toEqual(j(R.VORLAGE_MODI))
    expect(j(EINSENDUNG_STATUS)).toEqual(j(R.EINSENDUNG_STATUS))
  })
  it('Texte zu Pflicht und Wert gleich', () => {
    expect([FELD_TEXTE.pflicht, FELD_TEXTE.wert]).toEqual([R.EIGENE_TEXTE.pflicht, R.EIGENE_TEXTE.wert])
  })
})

describe('Gleichlauf Felder: lesen', () => {
  it('kennungOk und feldLesen (mit und ohne Abschnitt)', () => {
    for (const id of ['f_a', 'e_k3j9x0a1', 'a', '1', '_a', '-a', 'a b', 'ä', '', 'constructor', 'hasOwnProperty', 'a'.repeat(40), 'a'.repeat(41), 7, null]) {
      expect([id, kennungOk(id)]).toEqual([id, R.kennungOk(id)])
    }
    for (const f of FELDER) {
      expect([f, j(feldLesen(f, true))]).toEqual([f, j(R.feldLesen(f, true))])
      expect([f, j(feldLesen(f, false))]).toEqual([f, j(R.feldLesen(f, false))])
    }
  })

  it('abschnitteLesen', () => {
    for (const a of ABSCHNITTE) expect([a, j(abschnitteLesen(a))]).toEqual([a, j(R.abschnitteLesen(a))])
  })

  it('schemaLesen über Schemata und Abschnitte', () => {
    for (const schema of SCHEMAS) {
      for (const abschnitte of ABSCHNITTE.slice(0, 8)) {
        const v = { schema, abschnitte }
        expect([v, j(schemaLesen(v))]).toEqual([v, j(R.schemaLesen(v))])
      }
    }
    for (const v of [undefined, null, 'x', [], {}]) expect(j(schemaLesen(v))).toEqual(j(R.schemaLesen(v)))
  })

  it('schemaFehler über Schemata und Abschnitte', () => {
    for (const felder of SCHEMAS) {
      for (const abschnitte of ABSCHNITTE) {
        // Wie der Server beim Speichern: Text und alte Schlüssel vorher über schemaRoh
        const roh = R.schemaRoh(felder, abschnitte)
        expect([felder, abschnitte, j(schemaFehler(j(roh)))]).toEqual([felder, abschnitte, j(R.schemaFehler(roh))])
      }
    }
  })

  it('standardKonfig für jedes Standardformular', () => {
    const cfgs: unknown[] = [undefined, null, '', '{kaputt', {}, { formulare: null }]
    for (const f of STANDARD_FORMULARE) {
      const roh = {
        v: 1, version: 3,
        felder: Object.fromEntries(STANDARD_FELDER[f].map((k, i) => [k.id, { label: i % 2 ? ` Neu ${i} ` : '', hilfe: 'H', aus: i % 3 === 0, pflicht: i % 2 === 0 }])),
        reihenfolge: ['e_zwei', ...STANDARD_FELDER[f].map((k) => k.id).reverse(), 'gibtsnicht', 'e_zwei'],
        eigene: [...FELDER, { id: STANDARD_FELDER[f][0].id, typ: 'text', label: 'Kern' }, feld({ id: 'e_zwei' })],
      }
      cfgs.push({ formulare: { [f]: roh } }, JSON.stringify({ formulare: { [f]: roh } }), JSON.stringify(JSON.stringify({ formulare: { [f]: roh } })))
      cfgs.push({ formulare: { [f]: { ...roh, version: -1, reihenfolge: 'x', eigene: 'x', felder: [] } } })
    }
    for (const cfg of cfgs) {
      for (const f of STANDARD_FORMULARE) expect([cfg, f, j(standardKonfig(cfg, f))]).toEqual([cfg, f, j(R.standardKonfig(cfg, f))])
    }
  })

  it('vorlageModus', () => {
    for (const a of ['passwort', 'frei', 'anonym', 'Anonym', '', null, 1]) expect(vorlageModus({ absender: a })).toBe(R.vorlageModus({ absender: a }))
    expect(vorlageModus(null)).toBe(R.vorlageModus(null))
  })
})

describe('Gleichlauf Felder: Werte', () => {
  const defs: M[] = [
    feld({ id: 'f_t' }), feld({ id: 'f_l', typ: 'langtext' }), feld({ id: 'f_z', typ: 'zahl', min: -5, max: 100, einheit: 'km' }), feld({ id: 'f_z2', typ: 'zahl' }),
    feld({ id: 'f_d', typ: 'datum' }), feld({ id: 'f_u', typ: 'uhrzeit' }), feld({ id: 'f_a', typ: 'auswahl', optionen: ['Rot', 'Grün'] }),
    feld({ id: 'f_m', typ: 'mehrfach', optionen: ['A', 'B', 'C'] }), feld({ id: 'f_j', typ: 'janein' }), feld({ id: 'f_aus', aus: true }), feld({ id: 'f_x', typ: 'foto' }),
  ]
  const WERTE: unknown[] = [
    undefined, null, '', '  ', 'Hallo', ' Hallo ', 'x'.repeat(501), 'a\r\nb', 'x'.repeat(4001), 0, -0, 3.5, '3,5', ' -2 ', '1e3', 101, -6, 1e9, 1e9 + 1, Infinity, NaN,
    '2026-11-07', '2026-02-30', ' 2024-02-29 ', '07.11.2026', '00:00', '23:59', '24:00', '9:30', 'Rot', ' Grün ', 'grün', ['A'], ['C', 'A'], ['A', 'A'], ['D'], [], [1],
    true, false, 'true', {}, Array.from({ length: 31 }, () => 'A'),
  ]

  it('wertLeer, wertPruefen und wertFehler (App) gleich wertPruefen (Server)', () => {
    for (const w of WERTE) {
      expect([w, wertLeer(w)]).toEqual([w, R.wertLeer(w)])
      for (const d of defs) {
        const s = j(R.wertPruefen(d, w))
        expect([d.id, w, j(wertPruefen(d as FeldDef, w))]).toEqual([d.id, w, s])
        const leer = R.wertLeer(w)
        expect([d.id, w, wertFehler(d as FeldDef, w) === '']).toEqual([d.id, w, leer || s.ok])
      }
    }
  })

  it('werteBereinigen gleich, auch mit fremden Kennungen und kaputten Eingaben', () => {
    const satz: M[] = [{}, { f_t: ' a ', f_z: '4,0', f_j: false, f_aus: 'weg', f_a: 'Lila', fremd: 'x' }, Object.fromEntries(defs.map((d, i) => [d.id, WERTE[i * 3]]))]
    for (let i = 0; i < WERTE.length; i++) satz.push(Object.fromEntries(defs.map((d) => [d.id, WERTE[i]])))
    for (const w of satz) expect(j(werteBereinigen(defs as FeldDef[], w))).toEqual(j(R.werteBereinigen(defs, w)))
    expect(j(werteBereinigen(defs as FeldDef[], null as unknown as M))).toEqual(j(R.werteBereinigen(defs, null)))
  })

  it('pflichtFehlt passt zu den Pflicht-Fehlern von angabenBauen (aktuelle Fassung)', () => {
    const p = [feld({ id: 'f_1', pflicht: true }), feld({ id: 'f_2', typ: 'janein', pflicht: true }), feld({ id: 'f_3', pflicht: true, aus: true }), feld({ id: 'f_4' })]
    for (const w of [{}, { f_1: 'x' }, { f_1: 'x', f_2: false }, { f_2: true }, { f_1: ' ', f_2: null }]) {
      const fehlt = pflichtFehlt(p as FeldDef[], w)
      const s = j(R.angabenBauen(p, { version: 1, werte: w }, { versionAktuell: 1 }))
      expect([w, fehlt.length ? fehlt[0].id : null]).toEqual([w, s.ok ? null : s.feld])
    }
  })

  it('angabenLesen liest, was der Server baut (auch als Text)', () => {
    const a = j(R.angabenBauen(defs, { version: 1, werte: { f_t: 'a', f_z: 3, f_m: ['B'], fremd: 'alt' } }, { versionAktuell: 2 })).angaben
    const sicht = defs.filter((d) => !d.aus && d.typ !== 'foto')
    expect(j(angabenLesen(a))).toEqual({ ...a, felder: sicht })
    expect(j(angabenLesen(JSON.stringify(a)))).toEqual({ ...a, felder: sicht })
    expect(angabenLesen(null)).toBeNull()
    expect(angabenLesen({ v: 1, felder: [], werte: {} })).toBeNull()
    // CIRS-Rückfall ohne Regeldatei: nur version und werte
    expect(j(angabenLesen({ version: 2, werte: { e_x: 'y', 'kaputt key': 1, e_o: { a: 1 } } }))).toEqual({ v: 1, version: 2, felder: [], werte: { e_x: 'y' } })
  })
})
