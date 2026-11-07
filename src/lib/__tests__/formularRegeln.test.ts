import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { BUCHBARE_MODULE, formularFrei } from '../freigabe'
import { FRIST_MS as FRIST_DOKU } from '../../pages/public/doku/absenden'

// Die Regeln der öffentlichen Formulare laufen in PocketBase (pb_hooks, CommonJS). Hier
// derselbe Code, wie dort in einem eigenen Kontext mit module.exports ausgeführt.
const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/formular-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any

// Zeichen, die man im Quelltext nicht sieht
const ch = (n: number) => String.fromCharCode(n)
const NBSP = ch(0xa0), NNBSP = ch(0x202f), ZW = ch(0x200b), SHY = ch(0xad), BOM = ch(0xfeff)
const TRENN = ch(0x308) // kombinierendes Trema (NFD)
const GSTRICH = ch(0x2013), MINUS = ch(0x2212), APO = ch(0x2019)
const GEDANKENSTRICHE = /[–—]/

const JETZT = Date.parse('2026-10-31T12:00:00.000Z')
const ORG = 'org1'
const pbZeit = (ms: number) => new Date(ms).toISOString().replace('T', ' ')
type M = Record<string, unknown>
const m = (id: string, name: string, x: M = {}): M => ({ id, name, organization_id: ORG, role: 'benutzer', supervisor: false, disabled: false, expires_at: '', permissions: {}, temp_permissions: {}, ...x })

describe('Namen: normName, nameVollstaendig, anzeigeName (2.2, 2.3)', () => {
  const TAB: [string, string, boolean][] = [
    ['Anna Berg', 'Anna Berg', true],
    ['  anna   BERG ', 'Anna Berg', true],
    [`Anna${NBSP}Berg`, 'Anna Berg', true],
    [`Anna${NNBSP}Berg`, 'Anna Berg', true],
    ['Berg, Anna', 'Anna Berg', true],
    ['Berg,Anna', 'Anna Berg', true],
    ['Anna Berg', 'Berg, Anna', true],
    ['Berg Anna', 'Anna Berg', false],
    ['Berg, Anna, Maria', 'Anna Maria Berg', false],
    ['JÖRG MÜLLER', 'Jörg Müller', true],
    [`Jo${TRENN}rg Mu${TRENN}ller`, 'Jörg Müller', true],
    ['Joerg Mueller', 'Jörg Müller', true],
    ['Jorg Muller', 'Jörg Müller', false],
    ['Hans Strauß', 'Hans Strauss', true],
    ['HANS STRAUẞ', 'Hans Strauß', true],
    ['José García', 'Jose Garcia', true],
    [`Anne ${GSTRICH} Marie Roth`, 'Anne-Marie Roth', true],
    [`Anne${MINUS}Marie Roth`, 'Anne-Marie Roth', true],
    ['Anne Marie Roth', 'Anne-Marie Roth', false],
    [`Sean O${APO}Brien`, "Sean O'Brien", true],
    [`An${ZW}na Berg`, 'Anna Berg', true],
    [`${BOM}Anna${SHY} Berg`, 'Anna Berg', true],
    ['Dr. Anna Berg', 'Anna Berg', false],
    ['Anna Maria Berg', 'Anna Berg', false],
    ['Anna', 'Anna', false],
    ['A B', 'A B', false],
  ]
  for (const [eingabe, inResponda, soll] of TAB) {
    it(`${JSON.stringify(eingabe)} gegen ${JSON.stringify(inResponda)} → ${soll ? 'Treffer' : 'kein Treffer'}`, () => {
      expect(R.treffer([m('u1', inResponda)], eingabe, ORG, JETZT).length).toBe(soll ? 1 : 0)
    })
  }

  it('Filter-Einschleusung wirkungslos', () => {
    expect(R.treffer([m('u1', 'Anna Berg')], 'x" || organization_id != "', ORG, JETZT)).toEqual([])
  })

  it('unsichtbare Zeichen, NFKC und Verwechsler (Befund: Homoglyphen)', () => {
    const LRM = ch(0x200e), RLO = ch(0x202e), VS16 = ch(0xfe0f), CGJ = ch(0x34f), HF = ch(0x3164), INV = ch(0x2062), MVS = ch(0x180e)
    // Kyrillisches А, Vollbreite Ａ, angehängtes LRM, Richtungs-Override, Variantenwähler, Füller
    for (const x of [`${ch(0x410)}nna Berg`, `${ch(0xff21)}nna Berg`, `Anna Berg${LRM}`, `${RLO}Anna Berg`, `Anna${VS16} Berg`, `An${CGJ}na Berg`,
      `Anna ${HF}Berg`, `An${INV}na Berg`, `Anna${MVS} Berg`, `${ch(0x410)}nn${ch(0x430)} B${ch(0x435)}rg`, `Anna ${ch(0x392)}erg`, `${ch(0xa4ee)}NNA BERG`]) {
      expect([JSON.stringify(x), R.normName(x)]).toEqual([JSON.stringify(x), 'anna berg'])
      expect(R.treffer([m('u1', 'Anna Berg')], x, ORG, JETZT).length).toBe(1)
    }
    // Kyrillisches ӧ (zerlegt о + Trema) wird zu ö, dann oe
    expect(R.normName(`J${ch(0x4e7)}rg M${ch(0xfc)}ller`)).toBe('joerg mueller')
    // Tags und Variantenwähler der Ebene 14 (Ersatzpaare)
    expect(R.normName(`Anna Berg${ch(0xdb40)}${ch(0xdc41)}`)).toBe('anna berg')
    // Mathematische Buchstaben (NFKC)
    expect(R.normName(`${ch(0xd835)}${ch(0xdc00)}nna Berg`)).toBe('anna berg')
    // Der gespeicherte Name trägt keine unsichtbaren Zeichen mehr
    expect(R.anzeigeName(`Anna Berg${LRM}`)).toBe('Anna Berg')
    expect(R.anzeigeName(`${ch(0xff21)}nna`)).toBe('Anna')
    // Echte Namen anderer Schriften bleiben unterscheidbar
    expect(R.normName('Ελένη Παπαδοπούλου')).not.toBe(R.normName('Ελένη Παπαδάκη'))
    expect(R.normName('Ольга Иванова')).not.toBe(R.normName('Olga Ivanova'))
  })

  it('schriftGemischt: ein Name, eine Schrift', () => {
    for (const x of ['Anna Berg', 'Zoë Ørsted', 'Łukasz Żółć', 'İlkay Gündoğan', "Sean O'Brien", 'Anne-Marie Roth', 'Ελένη Παπαδοπούλου', 'Ольга Иванова',
      '山田 はなこ', '김민수 박', 'محمد علي', 'Anna Berg 2', `Anna${ch(0x200e)} Berg`, `${ch(0xff21)}nna Berg`, 'José García']) {
      expect([x, R.schriftGemischt(x)]).toEqual([x, false])
    }
    for (const x of [`${ch(0x410)}nna Berg`, `Anna ${ch(0x392)}erg`, `Olga ${ch(0x41e)}ffen`, 'Ольга Ivanova', `Anna B${ch(0x585)}rg`]) {
      expect([x, R.schriftGemischt(x)]).toEqual([x, true])
    }
  })

  it('normName: Schritte und Reihenfolge', () => {
    expect(R.normName('Berg, Anna')).toBe('anna berg')
    expect(R.normName(' Berg , Anna ')).toBe('anna berg')
    expect(R.normName(',Anna')).toBe('anna')
    expect(R.normName('Jörg')).toBe('joerg')
    expect(R.normName('Čapek')).toBe('capek')
    expect(R.normName('Ü')).toBe('ue')
    expect(R.normName(null)).toBe('')
    expect(R.normName(undefined)).toBe('')
    expect(R.normName(42)).toBe('42')
    expect(R.normName('Anne - Marie')).toBe('anne-marie')
  })

  it('nameVollstaendig: zwei Teile, mindestens 4 Buchstaben oder Ziffern', () => {
    expect(R.nameVollstaendig('Anna Berg')).toBe(true)
    expect(R.nameVollstaendig('Al Bo')).toBe(true)
    expect(R.nameVollstaendig('A B')).toBe(false)
    expect(R.nameVollstaendig('Anna')).toBe(false)
    expect(R.nameVollstaendig('Berg, Anna')).toBe(true)
    expect(R.nameVollstaendig('- -')).toBe(false)
    expect(R.nameVollstaendig('')).toBe(false)
    expect(R.nameVollstaendig('Ελένη Π')).toBe(true)
  })

  it('anzeigeName: bereinigt, Schreibweise bleibt, höchstens 120 Zeichen', () => {
    expect(R.anzeigeName('  anna   BERG ')).toBe('anna BERG')
    expect(R.anzeigeName(`Anna${NBSP}${ZW}Berg`)).toBe('Anna Berg')
    expect(R.anzeigeName(`Anne ${GSTRICH} Marie`)).toBe('Anne - Marie')
    expect(R.anzeigeName('Berg, Anna')).toBe('Berg, Anna')
    expect(R.anzeigeName('x'.repeat(300)).length).toBe(120)
    expect(R.anzeigeName(null)).toBe('')
  })
})

describe('Rechte (2.4)', () => {
  const bald = pbZeit(JETZT + 3600_000)
  const vorbei = pbZeit(JETZT - 60_000)
  it('aktiv: gesperrt, abgelaufen, beide Datumsformate, unlesbar', () => {
    expect(R.aktiv(m('a', 'A B'), JETZT)).toBe(true)
    expect(R.aktiv(m('a', 'A B', { disabled: true }), JETZT)).toBe(false)
    expect(R.aktiv(m('a', 'A B', { expires_at: bald }), JETZT)).toBe(true)
    expect(R.aktiv(m('a', 'A B', { expires_at: vorbei }), JETZT)).toBe(false)
    expect(R.aktiv(m('a', 'A B', { expires_at: new Date(JETZT + 1000).toISOString() }), JETZT)).toBe(true)
    expect(R.aktiv(m('a', 'A B', { expires_at: 'kaputt' }), JETZT)).toBe(false)
    expect(R.aktiv(null, JETZT)).toBe(false)
    expect(R.aktiv({ id: 'x' }, JETZT)).toBe(true)
    expect(R.aktiv(m('a', 'A B', { expires_at: bald }), new Date(JETZT))).toBe(true)
  })

  it('rechtAktiv: dauerhaft, befristet gültig und abgelaufen, beide Formate', () => {
    expect(R.rechtAktiv(m('a', 'A B', { permissions: { patienten: true } }), 'patienten', JETZT)).toBe(true)
    expect(R.rechtAktiv(m('a', 'A B', { permissions: { patienten: 'ja' } }), 'patienten', JETZT)).toBe(false)
    expect(R.rechtAktiv(m('a', 'A B', { temp_permissions: { patienten: { until: bald } } }), 'patienten', JETZT)).toBe(true)
    expect(R.rechtAktiv(m('a', 'A B', { temp_permissions: { patienten: { until: new Date(JETZT + 1000).toISOString() } } }), 'patienten', JETZT)).toBe(true)
    expect(R.rechtAktiv(m('a', 'A B', { temp_permissions: { patienten: { until: vorbei } } }), 'patienten', JETZT)).toBe(false)
    expect(R.rechtAktiv(m('a', 'A B', { temp_permissions: { patienten: {} } }), 'patienten', JETZT)).toBe(false)
    expect(R.rechtAktiv(m('a', 'A B', { permissions: null, temp_permissions: null }), 'patienten', JETZT)).toBe(false)
  })

  it('istVerknuepfbar: Org, aktiv, keine Teilnehmenden, kein Supervisor, fehlende Felder', () => {
    expect(R.istVerknuepfbar(m('a', 'A B'), ORG, JETZT)).toBe(true)
    expect(R.istVerknuepfbar(m('a', 'A B', { disabled: true }), ORG, JETZT)).toBe(false)
    expect(R.istVerknuepfbar(m('a', 'A B', { expires_at: vorbei }), ORG, JETZT)).toBe(false)
    expect(R.istVerknuepfbar(m('a', 'A B', { role: 'teilnehmer' }), ORG, JETZT)).toBe(false)
    expect(R.istVerknuepfbar(m('a', 'A B', { supervisor: true }), ORG, JETZT)).toBe(false)
    expect(R.istVerknuepfbar(m('a', 'A B'), 'org2', JETZT)).toBe(false)
    expect(R.istVerknuepfbar(m('a', 'A B', { organization_id: '' }), '', JETZT)).toBe(false)
    expect(R.istVerknuepfbar({ id: 'a', organization_id: ORG }, ORG, JETZT)).toBe(true)
    expect(R.istVerknuepfbar(m('a', 'A B', { sammlung: '_superusers' }), ORG, JETZT)).toBe(false)
  })

  it('mitgliedAusToken: nur ein users-Konto, das verknüpfbar ist', () => {
    expect(R.mitgliedAusToken(m('a', 'A B', { sammlung: 'users' }), ORG, JETZT)?.id).toBe('a')
    expect(R.mitgliedAusToken(m('a', 'A B'), ORG, JETZT)).toBeNull()
    expect(R.mitgliedAusToken(m('a', 'A B', { sammlung: 'users', role: 'teilnehmer' }), ORG, JETZT)).toBeNull()
    expect(R.mitgliedAusToken(m('a', 'A B', { sammlung: 'users', supervisor: true }), ORG, JETZT)).toBeNull()
    expect(R.mitgliedAusToken(m('a', 'A B', { sammlung: 'users', disabled: true }), ORG, JETZT)).toBeNull()
    expect(R.mitgliedAusToken(m('a', 'A B', { sammlung: 'users' }), 'org2', JETZT)).toBeNull()
    expect(R.mitgliedAusToken(null, ORG, JETZT)).toBeNull()
  })

  it('darfAendern: aktiv, kein Teilnehmer, Supervisor oder eigene Org', () => {
    expect(R.darfAendern(m('a', 'A B'), ORG, JETZT)).toBe(true)
    expect(R.darfAendern(m('a', 'A B', { supervisor: true, organization_id: 'org9' }), ORG, JETZT)).toBe(true)
    expect(R.darfAendern(m('a', 'A B', { role: 'teilnehmer' }), ORG, JETZT)).toBe(false)
    expect(R.darfAendern(m('a', 'A B', { disabled: true }), ORG, JETZT)).toBe(false)
    expect(R.darfAendern(m('a', 'A B'), 'org2', JETZT)).toBe(false)
    expect(R.darfAendern(null, ORG, JETZT)).toBe(false)
  })

  it('darfUnterschreiben: nur das Ziel selbst, nur ausstehend, verknüpfbar', () => {
    const abs = { id: 'a', status: 'ausstehend' }
    expect(R.darfUnterschreiben(abs, m('a', 'A B'), ORG, JETZT)).toBe(true)
    expect(R.darfUnterschreiben(abs, m('b', 'A B'), ORG, JETZT)).toBe(false)
    expect(R.darfUnterschreiben({ id: 'a', status: 'bestaetigt' }, m('a', 'A B'), ORG, JETZT)).toBe(false)
    expect(R.darfUnterschreiben({ id: '', status: 'ausstehend' }, m('', 'A B'), ORG, JETZT)).toBe(false)
    // „Das war ich nicht“: danach unterschreibt die Person nicht mehr
    expect(R.darfUnterschreiben({ ...abs, zurueckgewiesen: { id: 'a', name: 'A B', am: 'x' } }, m('a', 'A B'), ORG, JETZT)).toBe(false)
    expect(R.darfUnterschreiben(abs, m('a', 'A B', { disabled: true }), ORG, JETZT)).toBe(false)
    expect(R.darfUnterschreiben(abs, m('a', 'A B'), 'org2', JETZT)).toBe(false)
    expect(R.darfUnterschreiben(null, m('a', 'A B'), ORG, JETZT)).toBe(false)
  })

  it('darfOhneUnterschrift: Leitung, Recht patienten (auch befristet), Supervisor', () => {
    const TAB: [M, string, boolean][] = [
      [m('a', 'A B', { role: 'admin' }), ORG, true],
      [m('a', 'A B', { permissions: { patienten: true } }), ORG, true],
      [m('a', 'A B', { temp_permissions: { patienten: { until: bald } } }), ORG, true],
      [m('a', 'A B', { temp_permissions: { patienten: { until: vorbei } } }), ORG, false],
      [m('a', 'A B'), ORG, false],
      [m('a', 'A B', { supervisor: true, organization_id: '' }), ORG, true],
      [m('a', 'A B', { role: 'teilnehmer', permissions: { patienten: true } }), ORG, false],
      [m('a', 'A B', { role: 'admin', disabled: true }), ORG, false],
      [m('a', 'A B', { role: 'admin' }), 'org2', false],
      [m('a', 'A B', { role: 'admin', expires_at: vorbei }), ORG, false],
    ]
    for (const [u, org, soll] of TAB) expect([JSON.stringify(u), R.darfOhneUnterschrift(u, org, JETZT)]).toEqual([JSON.stringify(u), soll])
  })

  it('darfFormulareEinstellen: Supervisor, Leitung, Benutzerverwaltung, Vorgänge (auch befristet)', () => {
    expect(R.darfFormulareEinstellen(m('a', 'A B', { supervisor: true }), JETZT)).toBe(true)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { role: 'admin' }), JETZT)).toBe(true)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { permissions: { unitarii: true } }), JETZT)).toBe(true)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { permissions: { dokumente: true } }), JETZT)).toBe(true)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { temp_permissions: { dokumente: { until: bald } } }), JETZT)).toBe(true)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { temp_permissions: { unitarii: { until: vorbei } } }), JETZT)).toBe(false)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { permissions: { patienten: true } }), JETZT)).toBe(false)
    expect(R.darfFormulareEinstellen(m('a', 'A B', { role: 'admin', disabled: true }), JETZT)).toBe(false)
  })

  it('treffer: Doppelte, sortiert nach Kennung, nur verknüpfbare', () => {
    const liste = [m('z9', 'Max Mayer'), m('a1', 'Max Mayer'), m('t1', 'Max Mayer', { role: 'teilnehmer' }), m('f1', 'Max Mayer', { organization_id: 'org2' })]
    expect(R.treffer(liste, 'max mayer', ORG, JETZT).map((x: M) => x.id)).toEqual(['a1', 'z9'])
    expect(R.treffer(undefined, 'Max Mayer', ORG, JETZT)).toEqual([])
  })
})

describe('Einstellung (3.1) und Module', () => {
  it('absenderModus: Voreinstellung, Text, doppelt kodiert, kaputt, unbekannter Wert', () => {
    for (const cfg of [undefined, null, {}, 'kaputt', '{"absender":"x"}', { absender: { patienten: 'irgendwas' } }, { absender: null }, 42]) {
      expect(R.absenderModus(cfg, 'patienten')).toBe('passwort')
      expect(R.absenderModus(cfg, 'produktausgabe')).toBe('frei')
      expect(R.absenderModus(cfg, 'defektmeldung')).toBe('frei')
    }
    const um = { absender: { patienten: 'frei', produktausgabe: 'passwort', defektmeldung: 'passwort' } }
    for (const cfg of [um, JSON.stringify(um), JSON.stringify(JSON.stringify(um))]) {
      expect(R.absenderModus(cfg, 'patienten')).toBe('frei')
      expect(R.absenderModus(cfg, 'produktausgabe')).toBe('passwort')
      expect(R.absenderModus(cfg, 'defektmeldung')).toBe('passwort')
    }
    expect(R.absenderModus({}, 'cirs')).toBe('frei')
  })

  it('formConfigLesen: Objekt, Text, doppelt kodiert, kaputt', () => {
    expect(R.formConfigLesen({ a: 1 })).toEqual({ a: 1 })
    expect(R.formConfigLesen('{"a":1}')).toEqual({ a: 1 })
    expect(R.formConfigLesen(JSON.stringify('{"a":1}'))).toEqual({ a: 1 })
    expect(R.formConfigLesen('[1]')).toEqual({})
    expect(R.formConfigLesen('{kaputt')).toEqual({})
    expect(R.formConfigLesen(null)).toEqual({})
  })

  it('formularAn rechnet erschöpfend wie formularFrei (src/lib/freigabe.ts)', () => {
    const formulare = ['patienten', 'produktausgabe', 'defektmeldung', 'cirs']
    let faelle = 0
    for (let maske = 0; maske < 1 << BUCHBARE_MODULE.length; maske++) {
      const liste = BUCHBARE_MODULE.filter((_, i) => maske & (1 << i))
      for (const wert of [liste, JSON.stringify(liste), [...liste, 'quatsch']]) {
        const org = { freigeschaltet: wert }
        for (const f of formulare) { expect(R.formularAn(org, f)).toBe(formularFrei(org, f)); faelle++ }
      }
    }
    for (const org of [{}, { freigeschaltet: null }, { freigeschaltet: 'kaputt' }, { freigeschaltet: '{}' }, null, { freigeschaltet: [] }]) {
      for (const f of formulare) expect(R.formularAn(org, f)).toBe(formularFrei(org, f))
    }
    expect(faelle).toBeGreaterThan(10000)
  })

  it('formularOeffentlich: an und nicht in hidden_forms (auch als Text)', () => {
    expect(R.formularOeffentlich({ form_config: { hidden_forms: ['patienten'] } }, 'patienten')).toBe(false)
    expect(R.formularOeffentlich({ form_config: '{"hidden_forms":["patienten"]}' }, 'patienten')).toBe(false)
    expect(R.formularOeffentlich({ form_config: { hidden_forms: ['patienten'] } }, 'produktausgabe')).toBe(true)
    expect(R.formularOeffentlich({ freigeschaltet: ['mpg'] }, 'produktausgabe')).toBe(false)
    expect(R.formularOeffentlich({ freigeschaltet: ['lager'] }, 'defektmeldung')).toBe(true)
    expect(R.formularOeffentlich({}, 'patienten')).toBe(true)
  })
})

describe('Absender entscheiden (1.5, alle 12 Fälle)', () => {
  const anna = m('anna', 'Anna Berg')
  const max1 = m('max1', 'Max Mayer'), max2 = m('max2', 'Max Mayer')
  const k = (x: M) => ({ modus: 'passwort', mitglied: null, name: 'Anna Berg', passwort: false, ausstehend: false, treffer: [anna], feldVorhanden: true, ...x })
  it('1: Mitglieds-Token ist immer Absender, in jedem Modus', () => {
    for (const modus of ['passwort', 'frei']) {
      const e = R.absenderEntscheiden(k({ modus, mitglied: anna, name: 'Jemand Anderes', treffer: [] }))
      expect([e.art, e.status, e.person.id, e.weg, e.name]).toEqual(['anlegen', 'bestaetigt', 'anna', 'anmeldung', 'Anna Berg'])
    }
  })
  it('2/3: Passwort prüfen lassen, Treffer oder Fehler', () => {
    const p = R.absenderEntscheiden(k({ passwort: true }))
    expect(p.art).toBe('passwort_pruefen')
    expect(p.kandidaten.map((x: M) => x.id)).toEqual(['anna'])
    const ok = R.absenderEntscheiden(k({ passwort: true, passwortTreffer: anna }))
    expect([ok.art, ok.status, ok.person.id, ok.weg]).toEqual(['anlegen', 'bestaetigt', 'anna', 'passwort'])
    const f = R.absenderEntscheiden(k({ passwort: true, passwortTreffer: null }))
    expect([f.art, f.status, f.grund]).toEqual(['fehler', 401, 'passwort_falsch'])
  })
  it('4: Name unvollständig → 400 name (vor allem anderen außer Token)', () => {
    for (const x of [{ name: 'Anna' }, { name: 'Anna', passwort: true }, { name: '', ausstehend: true }]) {
      const e = R.absenderEntscheiden(k({ ...x, treffer: [] }))
      expect([e.status, e.grund]).toEqual([400, 'name'])
    }
  })
  it('5: kein Treffer → 400 name_unbekannt, bei ausstehend mit eigenem Text', () => {
    expect(R.absenderEntscheiden(k({ treffer: [], passwort: true })).grund).toBe('name_unbekannt')
    expect(R.absenderEntscheiden(k({ treffer: [], passwort: true })).text).toBeUndefined()
    const a = R.absenderEntscheiden(k({ treffer: [], ausstehend: true }))
    expect([a.status, a.grund, a.text]).toEqual([400, 'name_unbekannt', R.TEXTE.name_unbekannt_ausstehend])
    expect(R.absenderEntscheiden(k({ treffer: [] })).grund).toBe('name_unbekannt')
  })
  it('6: ausstehend, genau ein Treffer, Feld da → anlegen ausstehend', () => {
    const e = R.absenderEntscheiden(k({ ausstehend: true }))
    expect([e.art, e.status, e.person.id, e.weg]).toEqual(['anlegen', 'ausstehend', 'anna', ''])
  })
  it('7: ausstehend, mehrere Treffer → 400 name_unbekannt (Ausstehend-Text)', () => {
    const e = R.absenderEntscheiden(k({ name: 'Max Mayer', treffer: [max1, max2], ausstehend: true }))
    expect([e.status, e.grund, e.text]).toEqual([400, 'name_unbekannt', R.TEXTE.name_unbekannt_ausstehend])
  })
  it('8: weder Passwort noch ausstehend → 403 passwort_noetig', () => {
    expect([R.absenderEntscheiden(k({})).status, R.absenderEntscheiden(k({})).grund]).toEqual([403, 'passwort_noetig'])
  })
  it('9/10/11: Modus frei', () => {
    const f = (x: M) => R.absenderEntscheiden(k({ modus: 'frei', ...x }))
    expect([f({}).status, f({}).person.id, f({}).name]).toEqual(['nicht_bestaetigt', 'anna', 'Anna Berg'])
    expect([f({ name: '  anna  berg ' }).name]).toEqual(['Anna Berg'])
    expect([f({ treffer: [] }).status, f({ treffer: [] }).person, f({ treffer: [], name: ' Unbekannt  Person ' }).name]).toEqual(['ohne_konto', null, 'Unbekannt Person'])
    expect(f({ name: 'Max Mayer', treffer: [max1, max2] }).status).toBe('ohne_konto')
    expect(f({ name: 'X', treffer: [] })).toMatchObject({ art: 'fehler', status: 400, grund: 'daten', feld: 'absender' })
    // Passwort und ausstehend zählen im Modus frei nicht
    expect(f({ passwort: true, passwortTreffer: null }).status).toBe('nicht_bestaetigt')
    expect(f({ ausstehend: true }).status).toBe('nicht_bestaetigt')
    expect(f({ name: 'Unvollstaendig', treffer: [] }).status).toBe('ohne_konto')
  })
  it('12: ausstehend ohne Statusfeld → 403 passwort_noetig', () => {
    const e = R.absenderEntscheiden(k({ ausstehend: true, feldVorhanden: false }))
    expect([e.status, e.grund]).toEqual([403, 'passwort_noetig'])
    // mit Passwort geht es ohne Feld
    expect(R.absenderEntscheiden(k({ ausstehend: true, feldVorhanden: false, passwort: true })).art).toBe('passwort_pruefen')
  })
  it('Reihenfolge: Passwort und ausstehend zusammen → Passwort-Weg; 5 vor 12', () => {
    expect(R.absenderEntscheiden(k({ ausstehend: true, passwort: true })).art).toBe('passwort_pruefen')
    expect(R.absenderEntscheiden(k({ ausstehend: true, passwort: true, passwortTreffer: null })).grund).toBe('passwort_falsch')
    expect(R.absenderEntscheiden(k({ ausstehend: true, feldVorhanden: false, treffer: [] })).grund).toBe('name_unbekannt')
    expect(R.absenderEntscheiden(k({ name: 'Anna', ausstehend: true, feldVorhanden: false, treffer: [] })).grund).toBe('name')
  })
  it('absenderEintrag und verknuepft', () => {
    const e = R.absenderEntscheiden(k({ passwort: true, passwortTreffer: anna }))
    expect(R.absenderEintrag(e, 'passwort', 'ISO')).toEqual({ id: 'anna', name: 'Anna Berg', status: 'bestaetigt', weg: 'passwort', modus: 'passwort', am: 'ISO' })
    expect(R.absenderEintrag(R.absenderEntscheiden(k({ ausstehend: true })), 'passwort', 'ISO').am).toBe('')
    expect(R.verknuepft({ id: 'a', status: 'nicht_bestaetigt' })).toBe(true)
    expect(R.verknuepft({ id: 'a', status: 'ohne_unterschrift' })).toBe(false)
    expect(R.verknuepft({ id: '', status: 'bestaetigt' })).toBe(false)
  })
})

describe('Besatzung auflösen (2.5)', () => {
  const tom = m('tom', 'Tom Fuehrer'), max1 = m('max1', 'Max Mayer'), max2 = m('max2', 'Max Mayer')
  const fremd = m('lea', 'Lea Leitung', { organization_id: 'org2' })
  const alle = [tom, max1, max2, fremd, m('anna', 'Anna Berg')]
  const o = (x: M = {}) => ({ orgId: ORG, mitglied: false, ausstehend: false, jetzt: JETZT, ...x })

  it('leer bleibt leer, flach und verschachtelt', () => {
    const p = R.besatzungAufloesen({ mannschaft_tf: '  ' }, null, alle, o())
    expect([p.mannschaft_tf, p.mannschaft_1, p.mannschaft.tf, p.mannschaft.m3]).toEqual(['', '', null, null])
  })
  it('eindeutiger Name wird verknüpft, Kontoname geschrieben', () => {
    const p = R.besatzungAufloesen({ mannschaft_tf: 'tom  fuehrer' }, null, alle, o())
    expect([p.mannschaft_tf, p.mannschaft.tf]).toEqual(['Tom Fuehrer', { id: 'tom', name: 'Tom Fuehrer' }])
  })
  it('ausstehend: nur Namen', () => {
    const p = R.besatzungAufloesen({ mannschaft_tf: 'Tom Fuehrer', mannschaft: { tf: { id: 'tom', name: 'Tom Fuehrer' } } }, null, alle, o({ ausstehend: true, mitglied: true }))
    expect([p.mannschaft_tf, p.mannschaft.tf]).toEqual(['Tom Fuehrer', null])
  })
  it('Mitglieds-Kennung passend übernommen, unpassend, fremde Org und anonym verworfen', () => {
    const neu = { mannschaft_tf: 'Max Mayer', mannschaft: { tf: { id: 'max2', name: 'Max Mayer' } } }
    expect(R.besatzungAufloesen(neu, null, alle, o({ mitglied: true })).mannschaft.tf).toEqual({ id: 'max2', name: 'Max Mayer' })
    expect(R.besatzungAufloesen(neu, null, alle, o({ mitglied: false })).mannschaft.tf).toBeNull()
    const falscherName = { mannschaft_tf: 'Max Mayer', mannschaft: { tf: { id: 'tom', name: 'Tom Fuehrer' } } }
    expect(R.besatzungAufloesen(falscherName, null, alle, o({ mitglied: true })).mannschaft.tf).toBeNull()
    const fremdeOrg = { mannschaft_tf: 'Lea Leitung', mannschaft: { tf: { id: 'lea', name: 'Lea Leitung' } } }
    expect(R.besatzungAufloesen(fremdeOrg, null, alle, o({ mitglied: true })).mannschaft.tf).toBeNull()
    const unbekannt = { mannschaft_tf: 'Max Mayer', mannschaft: { tf: { id: 'gibtsnicht', name: 'Max Mayer' } } }
    expect(R.besatzungAufloesen(unbekannt, null, alle, o({ mitglied: true })).mannschaft.tf).toBeNull()
  })
  it('unveränderter Name behält die Kennung, trotz Doppelter und umbenannter Mitglieder', () => {
    const alt = { mannschaft_tf: 'Max Mayer', mannschaft: { tf: { id: 'max1', name: 'Max Mayer' } } }
    expect(R.besatzungAufloesen({ mannschaft_tf: 'max mayer' }, alt, alle, o()).mannschaft.tf).toEqual({ id: 'max1', name: 'Max Mayer' })
    const umbenannt = { mannschaft_tf: 'Thomas Alt', mannschaft: { tf: { id: 'tom', name: 'Thomas Alt' } } }
    const p = R.besatzungAufloesen({ mannschaft_tf: 'Thomas Alt' }, umbenannt, alle, o())
    expect([p.mannschaft_tf, p.mannschaft.tf]).toEqual(['Thomas Alt', { id: 'tom', name: 'Thomas Alt' }])
  })
  it('geänderter Name wird neu aufgelöst', () => {
    const alt = { mannschaft_tf: 'Tom Fuehrer', mannschaft: { tf: { id: 'tom', name: 'Tom Fuehrer' } } }
    expect(R.besatzungAufloesen({ mannschaft_tf: 'Anna Berg' }, alt, alle, o()).mannschaft.tf).toEqual({ id: 'anna', name: 'Anna Berg' })
    expect(R.besatzungAufloesen({ mannschaft_tf: 'Max Mayer' }, alt, alle, o()).mannschaft.tf).toBeNull()
  })
  it('leeres flaches Feld nimmt den verschachtelten Namen (Befund: EMPTY_PAYLOAD der Patientenverwaltung)', () => {
    // Altes Protokoll nur verschachtelt; die Verwaltung schickt es mit leeren flachen Feldern zurück
    const alt = { mannschaft: { tf: { id: 'anna', name: 'Anna Berg' }, m1: { id: 'max1', name: 'Max Mayer' } } }
    const neu = { mannschaft_tf: '', mannschaft_1: '', mannschaft_2: '', mannschaft_3: '', zugangscode: 'X', ...alt }
    const p = R.besatzungAufloesen(neu, alt, alle, o())
    expect([p.mannschaft_tf, p.mannschaft_1, p.mannschaft_2]).toEqual(['Anna Berg', 'Max Mayer', ''])
    expect(p.mannschaft.tf).toEqual({ id: 'anna', name: 'Anna Berg' })
    // Max Mayer ist doppelt: die Kennung bleibt trotzdem, weil der Name unverändert ist
    expect(p.mannschaft.m1).toEqual({ id: 'max1', name: 'Max Mayer' })
    // Geräumt ist ein Posten erst, wenn beide Formen leer sind (besatzungSetzen räumt beide)
    const geraeumt = R.besatzungAufloesen({ ...neu, mannschaft: { tf: null, m1: alt.mannschaft.m1 } }, alt, alle, o())
    expect([geraeumt.mannschaft_tf, geraeumt.mannschaft.tf, geraeumt.mannschaft.m1?.id]).toEqual(['', null, 'max1'])
  })
  it('alte Maske: nur verschachtelt', () => {
    const p = R.besatzungAufloesen({ mannschaft: { m1: { id: 'x', name: 'Tom Fuehrer' } } }, null, alle, o())
    expect([p.mannschaft_1, p.mannschaft.m1]).toEqual(['Tom Fuehrer', { id: 'tom', name: 'Tom Fuehrer' }])
    const alt = { mannschaft: { m2: { id: 'max2', name: 'Max Mayer' } } }
    expect(R.besatzungAufloesen({ mannschaft: { m2: { name: 'Max Mayer' } } }, alt, alle, o()).mannschaft.m2).toEqual({ id: 'max2', name: 'Max Mayer' })
  })
  it('dieselbe Person auf zwei Posten bleibt auf beiden', () => {
    const p = R.besatzungAufloesen({ mannschaft_tf: 'Tom Fuehrer', mannschaft_1: 'Tom Fuehrer' }, null, alle, o())
    expect([p.mannschaft.tf?.id, p.mannschaft.m1?.id]).toEqual(['tom', 'tom'])
  })
  it('andere Schlüssel bleiben, Eingabe wird nicht verändert', () => {
    const neu = { vorname: 'Max', mannschaft_tf: 'Tom Fuehrer', mannschaft: { tf: null, extra: 1 } }
    const kopie = JSON.stringify(neu)
    const p = R.besatzungAufloesen(neu, null, alle, o())
    expect(p.vorname).toBe('Max')
    expect(Object.keys(p.mannschaft).sort()).toEqual(['m1', 'm2', 'm3', 'tf'])
    expect(JSON.stringify(neu)).toBe(kopie)
  })
})

describe('payload, Frist, Prüfsumme', () => {
  it('wartetAufUnterschrift: Objekt, Text, doppelt kodiert, kaputt', () => {
    const p = { absender: { status: 'ausstehend' } }
    expect(R.wartetAufUnterschrift(p)).toBe(true)
    expect(R.wartetAufUnterschrift(JSON.stringify(p))).toBe(true)
    expect(R.wartetAufUnterschrift(JSON.stringify(JSON.stringify(p)))).toBe(true)
    expect(R.wartetAufUnterschrift({ absender: { status: 'bestaetigt' } })).toBe(false)
    expect(R.wartetAufUnterschrift('{kaputt')).toBe(false)
    expect(R.wartetAufUnterschrift(null)).toBe(false)
    expect(R.wartetAufUnterschrift({ absender: 'ausstehend' })).toBe(false)
  })
  it('kanonisch: Schlüsselreihenfolge egal, Listen nicht, undefined fehlt, Umlaute bleiben', () => {
    expect(R.kanonisch({ b: 1, a: { d: 2, c: 3 } })).toBe(R.kanonisch({ a: { c: 3, d: 2 }, b: 1 }))
    expect(R.kanonisch({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}')
    expect(R.kanonisch([1, 2])).not.toBe(R.kanonisch([2, 1]))
    expect(R.kanonisch({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(R.kanonisch([undefined, 1])).toBe('[null,1]')
    expect(R.kanonisch({ n: 'Jörg' })).toBe('{"n":"Jörg"}')
    expect(R.kanonisch(null)).toBe('null')
    expect(R.kanonisch(undefined)).toBeUndefined()
  })
  it('FRIST_MS gleich der Frist der Doku', () => {
    expect(R.FRIST_MS).toBe(FRIST_DOKU)
    expect(R.FRIST_MS).toBe(24 * 60 * 60 * 1000)
  })
  it('fristFuer: ausstehend und ohne Unterschrift ohne Frist, sonst Eingang + 24 h', () => {
    expect(R.fristFuer('ausstehend', JETZT)).toBe('')
    expect(R.fristFuer('ohne_unterschrift', JETZT)).toBe('')
    for (const s of ['bestaetigt', 'nicht_bestaetigt', 'ohne_konto']) expect(R.fristFuer(s, JETZT)).toBe(new Date(JETZT + R.FRIST_MS).toISOString())
  })
  it('maskeAusPayload', () => {
    expect(R.maskeAusPayload({ schnelldoku: true })).toBe('schnell')
    expect(R.maskeAusPayload({ protokoll_version: 2 })).toBe('doku')
    expect(R.maskeAusPayload({})).toBe('alt')
    // Die alte Maske setzt auch Fassung 2, schreibt den Namen aber in ausfueller_name (auch leer)
    expect(R.maskeAusPayload({ protokoll_version: 2, ausfueller_name: 'Anna Berg' })).toBe('alt')
    expect(R.maskeAusPayload({ protokoll_version: 2, ausfueller_name: '' })).toBe('alt')
    expect(R.maskeAusPayload({ protokoll_version: 2, unterschrift: 'Anna Berg', ausfueller_name: 'X Y' })).toBe('doku')
    expect(R.maskeAusPayload({ protokoll_version: 2, unterschrift: '' })).toBe('doku')
  })
  it('druckfeldIn: das gespeicherte Feld, außer es ist leer und das andere gefüllt', () => {
    expect(R.druckfeldIn({ unterschrift: '', ausfueller_name: 'Anna Berg' }, 'unterschrift')).toBe('ausfueller_name')
    expect(R.druckfeldIn({ unterschrift: 'Max Mayer', ausfueller_name: 'Anna Berg' }, 'unterschrift')).toBe('unterschrift')
    expect(R.druckfeldIn({ ausfueller_name: '', unterschrift: 'Anna Berg' }, 'ausfueller_name')).toBe('unterschrift')
    expect(R.druckfeldIn({}, 'unterschrift')).toBe('unterschrift')
    expect(R.druckfeldIn({ x: 'y' }, '')).toBe('')
  })
  it('patientenPayload: Server-Schlüssel, Druckfeld, Besatzung, Frist', () => {
    const abs = { id: 'anna', name: 'Anna Berg', status: 'bestaetigt', weg: 'passwort', modus: 'passwort', am: 'X' }
    const roh = { unterschrift: 'anna', frist: 'alt', abgesendet: 'alt', aenderungen: [1], eingang_sha256: 'x', absender: { status: 'bestaetigt' }, mannschaft_tf: 'Tom Fuehrer' }
    const p = R.patientenPayload(roh, { maske: 'doku', absender: abs, eingangMs: JETZT, pruefsumme: 'abc', mitglieder: [m('tom', 'Tom Fuehrer')], orgId: ORG, mitglied: false, jetzt: JETZT })
    expect(p.absender).toEqual({ ...abs, feld: 'unterschrift' })
    expect([p.unterschrift, p.frist, p.abgesendet, p.eingang_sha256, p.aenderungen]).toEqual(['Anna Berg', new Date(JETZT + R.FRIST_MS).toISOString(), new Date(JETZT).toISOString(), 'abc', []])
    expect(p.mannschaft.tf).toEqual({ id: 'tom', name: 'Tom Fuehrer' })
    const ohne = R.patientenPayload({ ausfueller_name: 'Hans' }, { maske: 'alt', absender: { id: '', name: 'Hans', status: 'ohne_konto', weg: '', modus: 'frei', am: '' }, eingangMs: JETZT, mitglieder: [], orgId: ORG, jetzt: JETZT })
    expect([ohne.ausfueller_name, ohne.absender.feld, ohne.eingang_sha256]).toEqual(['Hans', 'ausfueller_name', ''])
    const aus = R.patientenPayload({ mannschaft_tf: 'Tom Fuehrer' }, { maske: 'schnell', absender: { ...abs, status: 'ausstehend', am: '' }, eingangMs: JETZT, mitglieder: [m('tom', 'Tom Fuehrer')], orgId: ORG, jetzt: JETZT })
    expect([aus.frist, aus.mannschaft.tf, aus.ausfueller_name]).toEqual(['', null, 'Anna Berg'])
  })
  it('ausgabePayload und meldungReporterId', () => {
    const d = { einsatz: 'E1', datum: '2026-10-31', lager_id: 'l1', lager_name: 'RTW', positionen: [{ item_id: 'i', name: 'Binde', qty: 1, unit: 'Stk' }] }
    const p = R.ausgabePayload(d, { id: 'a', name: 'Anna Berg', status: 'ausstehend', weg: '', modus: 'passwort', am: '', feld: 'x' }, 'h')
    expect([p.user_id, p.user_name, p.absender.feld, p.eingang_sha256, p.positionen.length]).toEqual(['', 'Anna Berg', undefined, 'h', 1])
    expect(R.ausgabePayload(d, { id: 'a', name: 'A', status: 'nicht_bestaetigt' }, '').user_id).toBe('a')
    expect(R.ausgabeTitel(d)).toBe('Produktausgabe E1 (31.10.2026)')
    expect(R.meldungReporterId({ id: 'a', status: 'ausstehend' }, true)).toBe('a')
    expect(R.meldungReporterId({ id: 'a', status: 'nicht_bestaetigt' }, true)).toBe('a')
    expect(R.meldungReporterId({ id: 'a', status: 'nicht_bestaetigt' }, false)).toBe('')
    expect(R.meldungReporterId({ id: 'a', status: 'bestaetigt' }, false)).toBe('a')
    expect(R.meldungReporterId({ id: '', status: 'ohne_konto' }, true)).toBe('')
  })
  it('patientenTitel: gekürzt, Rückfall je Maske', () => {
    expect(R.patientenTitel('  ', 'doku')).toBe('Patientendoku')
    expect(R.patientenTitel(undefined, 'schnell')).toBe('Schnelldoku')
    expect(R.patientenTitel('x'.repeat(300), 'doku').length).toBe(200)
  })
})

describe('Datenprüfung (1.5)', () => {
  const bestand = {
    orte: { l1: { organization_id: ORG, name: 'RTW 1' }, lf: { organization_id: 'org2', name: 'F' }, la: { organization_id: ORG, name: 'A', archiviert: true } },
    artikel: { i1: { organization_id: ORG, name: 'Mullbinde', unit: 'Stk' }, if: { organization_id: 'org2', name: 'F', unit: 'x' }, ia: { organization_id: ORG, name: 'A', unit: 'x', archiviert: true } },
    geraete: { g1: { organization_id: ORG, name: 'Corpuls' }, gf: { organization_id: 'org2', name: 'F' }, ga: { organization_id: ORG, name: 'Alt', ausser_betrieb: '2026-01-01 00:00:00.000Z' } },
  }
  const o = { orgId: ORG, maske: 'doku' }
  const po = (x: M = {}) => R.datenPruefen('produktausgabe', { einsatz: ' E-1 ', datum: '2026-10-31', lager_id: 'l1', positionen: [{ item_id: 'i1', qty: 2, name: 'falsch' }, { item_id: 'i1', qty: 0 }, { qty: 3 }], extra: 'weg', ...x }, bestand, o)

  it('Patienten: payload Objekt, Server-Schlüssel nie übernommen, Titel', () => {
    const r = R.datenPruefen('patienten', { title: ' T ', payload: { a: 1, frist: 'x', absender: {}, aenderungen: [], abgesendet: 'x', eingang_sha256: 'x' }, extra: 1 }, bestand, o)
    expect(r).toEqual({ ok: true, daten: { title: 'T', payload: { a: 1 } } })
    expect(R.datenPruefen('patienten', { title: 'T', payload: 'text' }, bestand, o)).toMatchObject({ ok: false, feld: 'payload' })
    expect(R.datenPruefen('patienten', { title: 'T', payload: [1] }, bestand, o)).toMatchObject({ ok: false, feld: 'payload' })
    expect(R.datenPruefen('patienten', null, bestand, o)).toMatchObject({ ok: false, feld: 'payload' })
  })
  it('Produktausgabe: nur Bekanntes, Name und Einheit aus dem Bestand, leere Positionen raus', () => {
    expect(po()).toEqual({ ok: true, daten: { einsatz: 'E-1', datum: '2026-10-31', lager_id: 'l1', lager_name: 'RTW 1', positionen: [{ item_id: 'i1', name: 'Mullbinde', qty: 2, unit: 'Stk' }] } })
  })
  it('Produktausgabe: Grenzen und fremder Bestand', () => {
    const f = (x: M) => po(x).feld
    expect(f({ einsatz: '' })).toBe('einsatz')
    expect(f({ einsatz: 'x'.repeat(81) })).toBe('einsatz')
    expect(f({ datum: '2026-02-30' })).toBe('datum')
    expect(f({ datum: '31.10.2026' })).toBe('datum')
    expect(f({ lager_id: 'lf' })).toBe('lager_id')
    expect(f({ lager_id: 'la' })).toBe('lager_id')
    expect(f({ lager_id: 'gibtsnicht' })).toBe('lager_id')
    expect(f({ positionen: [] })).toBe('positionen')
    expect(f({ positionen: [{ item_id: 'i1', qty: 0 }] })).toBe('positionen')
    expect(f({ positionen: [{ item_id: 'i1', qty: 10001 }] })).toBe('positionen')
    expect(f({ positionen: [{ item_id: 'i1', qty: -1 }] })).toBe('positionen')
    expect(f({ positionen: [{ item_id: 'i1', qty: '2' }] })).toBe('positionen')
    expect(f({ positionen: Array.from({ length: 51 }, () => ({ item_id: 'i1', qty: 1 })) })).toBe('positionen')
    expect(po({ positionen: [{ item_id: 'if', qty: 1 }] })).toMatchObject({ feld: 'positionen', text: R.DATEN_TEXTE.positionen_fremd })
    expect(po({ positionen: [{ item_id: 'ia', qty: 1 }] })).toMatchObject({ feld: 'positionen', text: R.DATEN_TEXTE.positionen_fremd })
    expect(po({ positionen: Array.from({ length: 50 }, () => ({ item_id: 'i1', qty: 1 })) }).ok).toBe(true)
  })
  it('Defektmeldung: Gerät der Org, nicht außer Betrieb, Beschreibung, Schwere', () => {
    const d = (x: M) => R.datenPruefen('defektmeldung', { device_id: 'g1', description: ' kaputt ', severity: 'high', reporter_user_id: 'weg', ...x }, bestand, o)
    expect(d({})).toEqual({ ok: true, daten: { device_id: 'g1', device_name: 'Corpuls', description: 'kaputt', severity: 'high' } })
    expect(d({ severity: 'quatsch' }).daten.severity).toBe('medium')
    expect(d({ device_id: 'gf' })).toMatchObject({ feld: 'device_id', text: R.DATEN_TEXTE.device_id })
    expect(d({ device_id: 'ga' })).toMatchObject({ feld: 'device_id', text: R.DATEN_TEXTE.device_id_ausser_betrieb })
    expect(d({ description: '   ' }).feld).toBe('description')
    expect(d({ description: 'x'.repeat(4001) }).feld).toBe('description')
  })
  it('unbekanntes Formular', () => {
    expect(R.datenPruefen('cirs', {}, bestand, o)).toMatchObject({ ok: false, feld: 'formular' })
  })
})

describe('Drossel und Sperre (1.12)', () => {
  it('fensterZaehlen: festes Fenster, Rest in Sekunden, neues Fenster nach Ablauf', () => {
    let s = null
    for (let i = 0; i < 3; i++) { const r = R.fensterZaehlen(s, JETZT + i, 60_000, 3); expect(r.erlaubt).toBe(true); s = r.neu }
    const voll = R.fensterZaehlen(s, JETZT + 10_000, 60_000, 3)
    expect([voll.erlaubt, voll.sekunden]).toEqual([false, 50])
    expect(R.fensterZaehlen(s, JETZT + 59_999, 60_000, 3).sekunden).toBe(1)
    const neu = R.fensterZaehlen(s, JETZT + 60_000, 60_000, 3)
    expect([neu.erlaubt, neu.neu.n, neu.neu.ab, neu.neu.ende]).toEqual([true, 1, JETZT + 60_000, JETZT + 120_000])
  })
  const cfg = { max: 5, sperreMs: 900_000, verfallMs: 900_000 }
  it('pwReservieren: die 5. Reservierung sperrt, die 6. wird abgewiesen', () => {
    let s = null
    const uebrig: number[] = []
    for (let i = 0; i < 5; i++) { const r = R.pwReservieren(s, JETZT + i, cfg); expect(r.erlaubt).toBe(true); uebrig.push(r.uebrig); s = r.neu }
    expect(uebrig).toEqual([4, 3, 2, 1, 0])
    const sechs = R.pwReservieren(s, JETZT + 10, cfg)
    expect([sechs.erlaubt, sechs.sekunden, sechs.uebrig]).toEqual([false, 900, 0])
    // Neuanfang nach Sperrende
    const danach = R.pwReservieren(s, JETZT + 4 + 900_000, cfg)
    expect([danach.erlaubt, danach.neu.n, danach.uebrig]).toEqual([true, 1, 4])
  })
  it('pwReservieren: Verfall 15 Minuten nach dem letzten; richtiges Passwort löscht (neuer Zähler)', () => {
    const a = R.pwReservieren(null, JETZT, cfg).neu
    const b = R.pwReservieren(a, JETZT + 60_000, cfg).neu
    expect(b.n).toBe(2)
    expect(R.pwReservieren(b, JETZT + 60_000 + 899_999, cfg).neu.n).toBe(3)
    expect(R.pwReservieren(b, JETZT + 60_000 + 900_000, cfg).neu.n).toBe(1)
    // Die Route entfernt den Schlüssel nach einem Treffer: danach beginnt es bei 1
    expect(R.pwReservieren(undefined, JETZT, cfg).neu.n).toBe(1)
    expect(b.ende).toBe(JETZT + 60_000 + 900_000)
  })
  it('pwIpReservieren: 30 Prüfungen je Fenster reserviert, die 31. sperrt; Freigeben gibt einen Platz zurück', () => {
    const c = { fensterMs: 900_000, max: 30, sperreMs: 900_000 }
    let s = null
    for (let i = 0; i < 30; i++) { const r = R.pwIpReservieren(s, JETZT + i, c); expect(r.erlaubt).toBe(true); s = r.neu }
    expect(R.sperreRest(s, JETZT + 30)).toBe(0)
    // Ein richtiges Passwort gibt seine Reservierung zurück: dann geht noch eine
    const frei = R.pwFreigeben(s)
    expect(frei.n).toBe(29)
    expect(R.pwIpReservieren(frei, JETZT + 31, c).erlaubt).toBe(true)
    const voll = R.pwIpReservieren(s, JETZT + 31, c)
    expect([voll.erlaubt, voll.sekunden]).toEqual([false, 900])
    expect(R.sperreRest(voll.neu, JETZT + 31)).toBe(900)
    expect(R.pwIpReservieren(voll.neu, JETZT + 100, c).erlaubt).toBe(false)
    expect(R.pwIpReservieren(voll.neu, JETZT + 31 + 900_000, c).neu.n).toBe(1)
    expect(R.sperreRest(null, JETZT)).toBe(0)
    expect(R.pwFreigeben(null)).toBeNull()
  })
  it('pwReservieren: frisch nur ohne Versuche in der Zählung', () => {
    const a = R.pwReservieren(null, JETZT, cfg)
    expect(a.frisch).toBe(true)
    expect(R.pwReservieren(a.neu, JETZT + 1, cfg).frisch).toBe(false)
    expect(R.pwReservieren(a.neu, JETZT + 900_000, cfg).frisch).toBe(true)
    expect(R.pwReservieren({ n: 0, letzter: JETZT, bis: 0 }, JETZT + 1, cfg).frisch).toBe(true)
  })
  it('pwKontoReservieren: die Sperre je Konto hält nur Töpfe mit eigenen Versuchen auf (Befund: Sperre aus der Ferne)', () => {
    const c = { max: 30, sperreMs: 900_000, verfallMs: 900_000 }
    let s = null
    for (let i = 0; i < 30; i++) { const r = R.pwKontoReservieren(s, JETZT + i, c, false); expect(r.erlaubt).toBe(true); s = r.neu }
    expect(R.sperreRest(s, JETZT + 30)).toBe(900)
    const schmutzig = R.pwKontoReservieren(s, JETZT + 40, c, false)
    expect([schmutzig.erlaubt, schmutzig.uebrig]).toEqual([false, 0])
    const sauber = R.pwKontoReservieren(s, JETZT + 40, c, true)
    expect([sauber.erlaubt, sauber.uebrig, sauber.neu.bis]).toEqual([true, 0, s.bis])
    expect(sauber.sperreSekunden).toBe(900)
  })
  it('abgelaufen: für den Aufräum-Lauf', () => {
    expect(R.abgelaufen({ ende: JETZT }, JETZT)).toBe(true)
    expect(R.abgelaufen({ ende: JETZT + 1 }, JETZT)).toBe(false)
    expect(R.abgelaufen({ n: 1 }, JETZT)).toBe(true)
    expect(R.abgelaufen(null, JETZT)).toBe(true)
  })
  it('grenzenMit: nur die zwei Schalter der Prüfumgebung', () => {
    const g = R.grenzenMit({ sperreSekunden: '3', speicherMax: '200' })
    expect([g.pw_kt.sperreMs, g.pw_u.sperreMs, g.pw_ip.sperreMs, g.speicher_max, g.pw_u.verfallMs]).toEqual([3000, 3000, 3000, 200, 900_000])
    // Ein /48 darf höchstens 1 % des Speichers je Fenster belegen
    expect([g.name_blk.max, g.send_blk.max, g.pw_blk.max, g.pw_blk.sperreMs]).toEqual([2, 2, 2, 3000])
    const n = R.grenzenMit({})
    expect([n.pw_u.sperreMs, n.speicher_max, n.send_ip.max, n.name_ip.max, n.aus_ip.max, n.aus_z.max, n.aus_offen, n.sign_u.max, n.ulist_u.max]).toEqual([900_000, 50000, 60, 120, 20, 10, 20, 30, 120])
    expect([n.pw_kt.max, n.pw_u.max, n.pw_ip.max, n.name_blk.max, n.send_blk.max, n.pw_blk.max]).toEqual([5, 30, 30, 500, 240, 100])
    expect(R.grenzenMit({ sperreSekunden: 'x', speicherMax: '-5' }).pw_u.sperreMs).toBe(900_000)
    expect(R.GRENZEN.pw_u.sperreMs).toBe(900_000)
  })
  it('ipTopf: IPv4, ::ffff:, IPv6 je /64, :: an jeder Stelle, Groß/klein, führende Nullen, Unlesbares', () => {
    const TAB: [string, string][] = [
      ['1.2.3.4', '1.2.3.4'], [' 1.2.3.4 ', '1.2.3.4'], ['::ffff:1.2.3.4', '1.2.3.4'], ['::FFFF:1.2.3.4', '1.2.3.4'], ['0:0:0:0:0:ffff:102:304', '1.2.3.4'],
      ['2001:db8:1:2::1', '2001:db8:1:2::/64'], ['2001:0DB8:0001:0002:AAAA:bbbb:cccc:dddd', '2001:db8:1:2::/64'], ['2001:db8::', '2001:db8:0:0::/64'],
      ['::2001:db8', '0:0:0:0::/64'], ['2001::1:2:3:4', '2001:0:0:0::/64'], ['1:2:3:4:5:6:7::', '1:2:3:4::/64'], ['::1', '0:0:0:0::/64'],
      ['fe80::1%eth0', 'fe80:0:0:0::/64'], ['[2001:db8::1]', '2001:db8:0:0::/64'], ['64:ff9b::1.2.3.4', '64:ff9b:0:0::/64'],
      ['1::2::3', 'unbekannt'], ['x', 'unbekannt'], ['', 'unbekannt'], ['256.1.1.1', 'unbekannt'], ['1:2:3:4:5:6:7:8:9', 'unbekannt'], ['12345::1', 'unbekannt'],
    ]
    for (const [ip, soll] of TAB) expect([ip, R.ipTopf(ip)]).toEqual([ip, soll])
    expect(R.ipTopf('2001:db8:1:2:aaaa::1')).toBe(R.ipTopf('2001:db8:1:2:ffff:ffff:ffff:ffff'))
    expect(R.ipTopf('2001:db8:1:2::1')).not.toBe(R.ipTopf('2001:db8:1:3::1'))
    expect(R.ipTopf(null)).toBe('unbekannt')
  })
  it('ipBlock: IPv6 je /48, IPv4 und Unlesbares ohne Block', () => {
    expect(R.ipBlock('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48')
    expect(R.ipBlock('2001:db8:abcd:ffff:1::')).toBe(R.ipBlock('2001:db8:abcd:0::1'))
    expect(R.ipBlock('2001:db8:abce::1')).not.toBe(R.ipBlock('2001:db8:abcd::1'))
    for (const ip of ['1.2.3.4', '::ffff:1.2.3.4', 'x', '']) expect([ip, R.ipBlock(ip)]).toEqual([ip, ''])
  })
  it('ipPrivat: Loopback und private Netze', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.0.1', '169.254.1.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect([ip, R.ipPrivat(ip)]).toEqual([ip, true])
    for (const ip of ['203.0.113.7', '172.32.0.1', '100.64.0.1', '2001:db8::1', 'x', '']) expect([ip, R.ipPrivat(ip)]).toEqual([ip, false])
  })
  it('kennungGueltig: 15 × [a-z0-9]', () => {
    expect(R.kennungGueltig('k3j9x0a1b2c3d4e')).toBe(true)
    for (const id of ['K3J9X0A1B2C3D4E', 'k3j9x0a1b2c3d4', 'k3j9x0a1b2c3d4ef', 'k3j9x0a1b2c3d4_', '', null, 123]) expect(R.kennungGueltig(id)).toBe(false)
  })
})

describe('Mitglieder-Prüfung (1.9)', () => {
  it('Name unvollständig, doppelt, ohne E-Mail; nur verknüpfbare zählen; keine E-Mail', () => {
    const liste = [
      m('a', 'Anna Berg', { email: 'a@x.de' }), m('l', 'Lena', { email: 'l@x.de' }), m('m1', 'Max Mayer'), m('m2', 'max  mayer'),
      m('p', 'Paul Wagner', { email: 'ohne-email-ab12cd34ef56@kein-email.intern' }), m('g', 'Lena', { disabled: true }), m('t', 'Max Mayer', { role: 'teilnehmer' }),
      m('s', 'Sven Super', { supervisor: true }), m('f', 'Max Mayer', { organization_id: 'org2' }),
    ]
    const r = R.mitgliederPruefen(liste, ORG, JETZT)
    expect(r.gesamt).toBe(5)
    // Doppelte Namen bestätigen mit Passwort (jeder Kandidat wird geprüft): nicht unter koennen_nicht
    expect(r.koennen_nicht).toBe(2)
    expect(r.doppelt).toBe(2)
    expect(r.eintraege.length).toBe(4)
    const g = (id: string) => r.eintraege.find((e: M) => e.id === id)?.gruende
    expect(g('l')).toEqual(['name_unvollstaendig'])
    expect(g('m1')).toEqual(['name_doppelt'])
    expect(g('m2')).toEqual(['name_doppelt'])
    expect(g('p')).toEqual(['ohne_email'])
    expect(g('a')).toBeUndefined()
    expect(JSON.stringify(r)).not.toContain('@')
  })
})

describe('Texte', () => {
  it('kein Gedankenstrich in TEXTE, DATEN_TEXTE, HOOK_TEXTE', () => {
    for (const quelle of [R.TEXTE, R.DATEN_TEXTE, R.HOOK_TEXTE]) {
      for (const [k, v] of Object.entries(quelle as Record<string, string>)) expect([k, GEDANKENSTRICHE.test(v)]).toEqual([k, false])
    }
  })
  it('minutenText und meldung', () => {
    expect(R.minutenText(1)).toBe('einer Minute')
    expect(R.minutenText(60)).toBe('einer Minute')
    expect(R.minutenText(61)).toBe('2 Minuten')
    expect(R.minutenText(900)).toBe('15 Minuten')
    expect(R.minutenText(0)).toBe('einer Minute')
    expect(R.meldung('gesperrt', { sekunden: 900 })).toBe('Zu viele falsche Passwörter. Bitte in 15 Minuten erneut versuchen.')
    expect(R.meldung('drossel', { sekunden: 30 })).toBe('Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.')
    expect(R.meldung('passwort_falsch', { versuche_uebrig: 4 })).toBe('Das Passwort stimmt nicht. Noch 4 Versuche, dann ist die Bestätigung 15 Minuten gesperrt.')
    expect(R.meldung('passwort_falsch', { versuche_uebrig: 1 })).toBe('Das Passwort stimmt nicht. Noch ein Versuch, dann ist die Bestätigung 15 Minuten gesperrt.')
    expect(R.meldung('daten', { feld: 'grund' })).toBe('Bitte einen Grund angeben, mindestens 10 Zeichen.')
    expect(R.meldung('daten', { feld: 'unbekannt' })).toBe(R.TEXTE.daten)
    expect(R.meldung('gibtsnicht')).toBe(R.TEXTE.server)
    for (const g of ['organisation', 'formular_aus', 'kennung', 'aenderung_alt', 'name', 'name_unbekannt', 'passwort_noetig', 'nicht_angemeldet', 'nicht_berechtigt', 'nicht_gefunden', 'fremd', 'schon_bestaetigt', 'server']) {
      expect(typeof R.meldung(g)).toBe('string')
    }
  })
})

describe('Helfer mit PocketBase-Objekten (nachgebildet)', () => {
  const rec = (felder: Record<string, unknown>, sammlung = 'users') => ({
    id: String(felder.id || 'r1'),
    collection: () => ({ name: sammlung }),
    getString: (f: string) => (felder[f] === undefined ? '' : typeof felder[f] === 'string' ? felder[f] : JSON.stringify(felder[f])),
    getBool: (f: string) => felder[f] === true,
  })
  it('personAusRecord: JSON-Felder auch doppelt kodiert, fehlende leer', () => {
    const p = R.personAusRecord(rec({ id: 'u1', name: 'Anna Berg', permissions: JSON.stringify({ patienten: true }), temp_permissions: 'kaputt', supervisor: true }))
    expect([p.id, p.sammlung, p.name, p.permissions.patienten, p.temp_permissions, p.supervisor, p.role, p.disabled]).toEqual(['u1', 'users', 'Anna Berg', true, {}, true, '', false])
  })
  it('gesicherterAbsender: mit Feld nur bei gleichem Status, ohne Feld der payload (Befund: Fälschung vor den Hooks)', () => {
    const a = { id: 'anna', status: 'bestaetigt' }
    expect(R.gesicherterAbsender('bestaetigt', a, true)).toBe(a)
    expect(R.gesicherterAbsender('', a, true)).toBeNull()
    expect(R.gesicherterAbsender('ausstehend', a, true)).toBeNull()
    expect(R.gesicherterAbsender('', a, false)).toBe(a)
    expect(R.gesicherterAbsender('bestaetigt', null, true)).toBeNull()
    expect(R.gesicherterAbsender('bestaetigt', [a], true)).toBeNull()
  })
  it('felderZuruecksetzen: alles außer den genannten, id und Zeitstempeln aus dem Original', () => {
    const werte: Record<string, unknown> = { id: 'p1', title: 'GEFAELSCHT', admin_name: 'Lisa', payload: { x: 2 }, status: 'archiviert', created: 'neu' }
    const orig: Record<string, unknown> = { id: 'p1', title: 'Echt', admin_name: '', payload: { x: 1 }, status: 'offen', created: 'alt' }
    const feld = (name: string, typ = 'text') => ({ getName: () => name, type: () => typ })
    const satz = {
      collection: () => ({ fields: [feld('id'), feld('title'), feld('admin_name'), feld('payload', 'json'), feld('status'), feld('created', 'autodate')] }),
      set: (k: string, v: unknown) => { werte[k] = v },
    }
    R.felderZuruecksetzen(satz, { get: (k: string) => orig[k] }, ['payload'])
    expect(werte).toEqual({ id: 'p1', title: 'Echt', admin_name: '', payload: { x: 2 }, status: 'offen', created: 'neu' })
    werte.status = 'freigegeben'
    R.felderZuruecksetzen(satz, { get: (k: string) => orig[k] }, ['payload', 'status'])
    expect(werte.status).toBe('freigegeben')
  })
  it('passwortPruefen: Sperre je Konto und Topf, je Konto mit sauberem Topf, je IP-Topf atomar (nachgebildeter Speicher)', () => {
    const daten: Record<string, unknown> = {}
    const store = {
      setFunc: (k: string, f: (alt: unknown) => unknown) => { daten[k] = f(daten[k]) },
      remove: (k: string) => { delete daten[k] },
    }
    const pw: Record<string, string> = { joerg: 'richtig', anna: 'auch-richtig' }
    const app = { store: () => store, findRecordById: (_c: string, id: string) => ({ validatePassword: (x: string) => pw[id] === x }) }
    const g = R.grenzenMit({})
    const joerg = [{ id: 'joerg' }]
    // 5 falsche aus fünf verschiedenen Töpfen sperren Jörg nicht
    for (let i = 0; i < 5; i++) expect(R.passwortPruefen(app, joerg, 'falsch', `198.51.100.${i}`, g, JETZT).grund).toBe('passwort_falsch')
    expect(R.passwortPruefen(app, joerg, 'richtig', '198.51.100.99', g, JETZT).person?.id).toBe('joerg')
    // 5 falsche aus einem Topf sperren diesen Topf für Jörg, nicht andere Töpfe
    const r5 = [1, 2, 3, 4, 5].map(() => R.passwortPruefen(app, joerg, 'falsch', '203.0.113.1', g, JETZT + 1))
    expect(r5.map((r: M) => r.grund)).toEqual(['passwort_falsch', 'passwort_falsch', 'passwort_falsch', 'passwort_falsch', 'gesperrt'])
    expect(r5[0].uebrig).toBe(4)
    expect(R.passwortPruefen(app, joerg, 'richtig', '203.0.113.1', g, JETZT + 2).grund).toBe('gesperrt')
    expect(R.passwortPruefen(app, joerg, 'richtig', '203.0.113.2', g, JETZT + 2).person?.id).toBe('joerg')
    // 30 falsche über viele Töpfe sperren das Konto; ein sauberer Topf darf trotzdem
    for (let i = 0; i < 30; i++) R.passwortPruefen(app, joerg, 'falsch', `192.0.2.${i}`, g, JETZT + 3)
    expect(R.passwortPruefen(app, joerg, 'falsch', '192.0.2.0', g, JETZT + 4).grund).toBe('gesperrt')
    expect(R.passwortPruefen(app, joerg, 'richtig', '192.0.2.200', g, JETZT + 4).person?.id).toBe('joerg')
    const sauberFalsch = R.passwortPruefen(app, joerg, 'falsch', '192.0.2.201', g, JETZT + 4)
    expect(sauberFalsch.grund).toBe('gesperrt')
    // Je IP-Topf: höchstens 30 Prüfungen über alle Konten, dann gesperrt, auch für richtige Passwörter
    const viele = Array.from({ length: 40 }, (_x, i) => ({ id: `u${i}` }))
    let geprueft = 0
    for (const k of viele) { const r = R.passwortPruefen(app, [k], 'falsch', '233.252.0.1', g, JETZT + 5); if (r.grund === 'passwort_falsch') geprueft++ }
    expect(geprueft).toBe(30)
    expect(R.passwortPruefen(app, [{ id: 'anna' }], 'auch-richtig', '233.252.0.1', g, JETZT + 6).grund).toBe('gesperrt')
    // Ein richtiges Passwort gibt seinen Platz im IP-Topf zurück
    for (let i = 0; i < 29; i++) R.passwortPruefen(app, [{ id: `v${i}` }], 'falsch', '233.252.0.2', g, JETZT + 7)
    expect(R.passwortPruefen(app, [{ id: 'anna' }], 'auch-richtig', '233.252.0.2', g, JETZT + 7).person?.id).toBe('anna')
    expect(R.passwortPruefen(app, [{ id: 'v99' }], 'falsch', '233.252.0.2', g, JETZT + 7).grund).toBe('passwort_falsch')
    // IPv6: höchstens 100 Prüfungen je /48, auch über viele /64 (sonst legte jedes /64 eigene Schlüssel an)
    let v6 = 0
    for (let i = 0; i < 120; i++) { const r = R.passwortPruefen(app, [{ id: `w${i}` }], 'falsch', `2001:db8:77:${i.toString(16)}::1`, g, JETZT + 8); if (r.grund === 'passwort_falsch') v6++ }
    expect(v6).toBe(100)
    expect(R.passwortPruefen(app, [{ id: 'anna' }], 'auch-richtig', '2001:db8:78::1', g, JETZT + 8).person?.id).toBe('anna')
    const vorher = Object.keys(daten).length
    R.passwortPruefen(app, [{ id: 'x1' }], 'falsch', '2001:db8:77:ffff::1', g, JETZT + 9)
    expect(Object.keys(daten).length).toBe(vorher)
  })
  it('absenderAusSatz: payload.absender bzw. reporter_*, alte Sätze null', () => {
    expect(R.absenderAusSatz(rec({ payload: { absender: { id: 'a', status: 'ausstehend' } } }, 'patients'), 'patients')).toEqual({ id: 'a', status: 'ausstehend' })
    expect(R.absenderAusSatz(rec({ payload: { x: 1 } }, 'patients'), 'patients')).toBeNull()
    expect(R.absenderAusSatz(rec({ reporter_status: 'ausstehend', reporter_user_id: 'a', reporter_name: 'A' }, 'mpg_defect_reports'), 'mpg_defect_reports')).toMatchObject({ id: 'a', status: 'ausstehend', name: 'A' })
    expect(R.absenderAusSatz(rec({}, 'mpg_defect_reports'), 'mpg_defect_reports')).toBeNull()
  })
  it('felderBehalten: Gegenzeichnung aus dem Original, beim Anlegen leer, nur vorhandene Felder', () => {
    const werte: Record<string, unknown> = { admin_name: 'Fremd', admin_datum: 'x', admin_unterschrift: 'y', title: 'T' }
    const satz = {
      collection: () => ({ fields: { getByName: (f: string) => (f === 'admin_datum' ? null : { name: f }) } }),
      set: (k: string, v: unknown) => { werte[k] = v },
    }
    const original = { get: (k: string) => ({ admin_name: 'Lisa Leitung', admin_unterschrift: 'data:image/png;base64,AA' } as Record<string, unknown>)[k] ?? '' }
    R.felderBehalten(satz, original, R.GEGENZEICHNUNG)
    expect(werte).toEqual({ admin_name: 'Lisa Leitung', admin_datum: 'x', admin_unterschrift: 'data:image/png;base64,AA', title: 'T' })
    R.felderBehalten(satz, null, R.GEGENZEICHNUNG)
    expect(werte).toEqual({ admin_name: '', admin_datum: 'x', admin_unterschrift: '', title: 'T' })
  })
  it('statusfelderLeeren: erster Start leert gesetzte Statusfelder, nur wo das Feld da ist (Befund: Fenster vor den Hooks)', () => {
    const sql: string[] = []
    const gesetzt: Record<string, number> = { patients: 2, product_outputs: 0, mpg_defect_reports: 1 }
    const app = {
      findCollectionByNameOrId: (s: string) => ({ fields: { getByName: (f: string) => (s === 'product_outputs' && f === 'absender_status') || s === 'patients' || s === 'mpg_defect_reports' ? { name: f } : null } }),
      findRecordsByFilter: (s: string, filter: string) => {
        expect(filter).toBe(`${s === 'mpg_defect_reports' ? 'reporter_status' : 'absender_status'} != ''`)
        return new Array(gesetzt[s]).fill({})
      },
      db: () => ({ newQuery: (q: string) => ({ execute: () => { sql.push(q) } }) }),
    }
    expect(R.statusfelderLeeren(app)).toEqual({ patients: 2, product_outputs: 0, mpg_defect_reports: 1 })
    expect(sql).toEqual([
      "UPDATE `patients` SET `absender_status` = '' WHERE `absender_status` != ''",
      "UPDATE `mpg_defect_reports` SET `reporter_status` = '' WHERE `reporter_status` != ''",
    ])
    // Ohne Felder: nichts zu tun
    const ohne = { ...app, findCollectionByNameOrId: () => ({ fields: { getByName: () => null } }) }
    sql.length = 0
    expect(R.statusfelderLeeren(ohne)).toEqual({})
    expect(sql).toEqual([])
    expect(R.START_MERKER).toMatch(/^[a-z_]+\.txt$/)
  })
})
