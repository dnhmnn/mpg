import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createHash, createHmac } from 'node:crypto'
import { planeBestaetigung, planeDefekt, planeSchwere } from '../mpg/aktionen'

// Die Regeln der Push-Benachrichtigungen laufen in PocketBase (pb_hooks, CommonJS). Hier
// derselbe Code, wie dort in einem eigenen Kontext mit module.exports ausgeführt
// (Bauplan Push, 4.7).
function laden(datei: string) {
  const modul = { exports: {} as Record<string, unknown> }
  runInNewContext(readFileSync(new URL(`../../../pb_hooks/${datei}`, import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modul.exports as any
}
const R = laden('push-regeln.js')
const V = laden('push-versand.js')

const GEDANKENSTRICHE = /[–—]/
const EMOJI = /\p{Extended_Pictographic}/u
const sha256 = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const hs256 = (d: string, g: string) => createHmac('sha256', g).update(d, 'utf8').digest('hex')
const pbZeit = (ms: number) => new Date(ms).toISOString().replace('T', ' ')
const flach = <T>(x: T): T => JSON.parse(JSON.stringify(x))

const JETZT = Date.parse('2026-11-15T12:00:00.000Z')
const ORG = { id: 'orga00000000001', org_name: 'Wache Eins', is_active: true }
type P = Record<string, unknown>
const RECHTE = ['dashboard', 'mpg_verwalten', 'lager', 'patienten', 'dokumente', 'ausbildungen_manage']
const alle = (wert: unknown) => Object.fromEntries(RECHTE.map((r) => [r, wert]))
const person = (id: string, x: P = {}): P => ({ id, sammlung: 'users', organization_id: ORG.id, role: 'benutzer', supervisor: false, disabled: false, expires_at: '', permissions: {}, temp_permissions: {}, ...x })

const PERSONEN: Record<string, P> = {
  admin: person('admin0000000001', { role: 'admin' }),
  mpgBeauftragt: person('mpgbea000000001', { role: 'mpg', permissions: { dashboard: true } }),
  helferHaken: person('helfer000000001', { permissions: alle(true) }),
  befristetGueltig: person('befgue000000001', { temp_permissions: alle({ until: pbZeit(JETZT + 3600_000) }) }),
  befristetAbgelaufen: person('befabg000000001', { temp_permissions: alle({ until: pbZeit(JETZT - 60_000) }) }),
  befristetAltesFormat: person('befalt000000001', { temp_permissions: alle({ until: new Date(JETZT + 86_400_000).toISOString() }) }),
  ohneRecht: person('ohne00000000001'),
  teilnehmer: person('teil00000000001', { role: 'teilnehmer', permissions: alle(true) }),
  gesperrt: person('gesp00000000001', { permissions: alle(true), disabled: true }),
  abgelaufen: person('abgl00000000001', { permissions: alle(true), expires_at: pbZeit(JETZT - 1000) }),
  andereOrg: person('ander0000000001', { permissions: alle(true), organization_id: 'orgb00000000001' }),
  supervisorInOrg: person('supin0000000001', { supervisor: true }),
  supervisorOhneOrg: person('supoh0000000001', { supervisor: true, organization_id: '' }),
}

// Erwartet bei freien Modulen und aktiver Organisation: [mitteilung, protokoll_neu, mpg, lager, einsendung, cirs, ausbildung]
const ERWARTET: Record<string, boolean[]> = {
  admin: [true, true, false, false, true, false, false],
  mpgBeauftragt: [true, false, true, false, false, false, false],
  helferHaken: [true, true, true, true, true, true, true],
  befristetGueltig: [true, true, true, true, true, false, false],
  befristetAbgelaufen: [true, false, false, false, false, false, false],
  befristetAltesFormat: [true, false, false, false, false, false, false],
  ohneRecht: [true, false, false, false, false, false, false],
  teilnehmer: [true, false, false, false, false, true, false],
  gesperrt: [false, false, false, false, false, false, false],
  abgelaufen: [false, false, false, false, false, false, false],
  andereOrg: [false, false, false, false, false, false, false],
  supervisorInOrg: [true, true, true, true, true, true, true],
  supervisorOhneOrg: [false, false, false, false, false, false, false],
}
const SPALTEN: string[][] = [
  ['mitteilung'], ['protokoll_neu'], ['mpg_gesperrt', 'mpg_defekt', 'mpg_bald'],
  ['lager_mindestbestand', 'lager_abgelaufen', 'lager_ablauf', 'produktausgabe'], ['einsendung'], ['cirs_neu', 'cirs_ueberfaellig'], ['ausbildung'],
]

describe('Katalog (3)', () => {
  it('14 Anlässe, eindeutig, jede Gruppe vorhanden, nur die Mitteilung ist Pflicht', () => {
    const keys = R.ANLAESSE.map((a: P) => a.key)
    expect(keys.length).toBe(14)
    expect(new Set(keys).size).toBe(14)
    const gruppen = R.GRUPPEN.map((g: P) => g.key)
    for (const a of R.ANLAESSE) expect(gruppen).toContain(a.gruppe)
    for (const g of gruppen) expect(R.ANLAESSE.some((a: P) => a.gruppe === g)).toBe(true)
    expect(R.ANLAESSE.filter((a: P) => a.pflicht).map((a: P) => a.key)).toEqual(['mitteilung'])
  })
  it('Titel und Beschreibungen ohne Gedankenstriche und Emojis', () => {
    for (const a of R.ANLAESSE) {
      for (const t of [a.titel, a.beschreibung]) { expect(t).not.toMatch(GEDANKENSTRICHE); expect(t).not.toMatch(EMOJI) }
    }
    for (const g of R.GRUPPEN) expect(g.titel).not.toMatch(GEDANKENSTRICHE)
    for (const t of Object.values(R.MITTEILUNG_TEXTE) as string[]) expect(t).not.toMatch(GEDANKENSTRICHE)
    for (const t of Object.values(V.ROUTEN_TEXTE) as string[]) expect(t).not.toMatch(GEDANKENSTRICHE)
  })
})

describe('darfAnlass (3.1): genau die API-Regel', () => {
  for (const [name, p] of Object.entries(PERSONEN)) {
    it(`${name}`, () => {
      SPALTEN.forEach((keys, i) => {
        for (const k of keys) expect([k, R.darfAnlass(p, ORG, k, {}, JETZT)]).toEqual([k, ERWARTET[name][i]])
      })
    })
  }
  it('CIRS: Leitung ohne dokumente nein; Einsendung: Leitung ohne dokumente ja', () => {
    expect(R.darfAnlass(PERSONEN.admin, ORG, 'cirs_neu', {}, JETZT)).toBe(false)
    expect(R.darfAnlass(PERSONEN.admin, ORG, 'einsendung', {}, JETZT)).toBe(true)
  })
  it('Organisation inaktiv oder fehlt: niemand', () => {
    for (const p of Object.values(PERSONEN)) {
      for (const a of R.ANLAESSE) {
        expect(R.darfAnlass(p, { ...ORG, is_active: false }, a.key, { ziel: p.id, formular: 'patienten' }, JETZT)).toBe(false)
        expect(R.darfAnlass(p, null, a.key, {}, JETZT)).toBe(false)
      }
    }
  })
  it('Auslösende Person bekommt die Nachricht nicht', () => {
    const p = PERSONEN.helferHaken
    expect(R.darfAnlass(p, ORG, 'einsendung', { ausloeser: p.id }, JETZT)).toBe(false)
    expect(R.darfAnlass(p, ORG, 'einsendung', { ausloeser: 'jemandanders001' }, JETZT)).toBe(true)
  })
  it('Unbekannter Anlass: nein', () => {
    expect(R.darfAnlass(PERSONEN.supervisorInOrg, ORG, 'gibtsnicht', {}, JETZT)).toBe(false)
  })
  const MODULE: [string, unknown, Record<string, boolean>][] = [
    ['freigeschaltet fehlt', undefined, { patienten: true, mpg: true, lager: true, dokumente: true, ausbildungen: true }],
    ['leere Liste', [], { patienten: false, mpg: false, lager: false, dokumente: false, ausbildungen: false }],
    ['nur Lager (schließt MPG und Vorgänge ein)', ['lager'], { patienten: false, mpg: true, lager: true, dokumente: true, ausbildungen: false }],
    ['Text-JSON', '["lager","patienten"]', { patienten: true, mpg: true, lager: true, dokumente: true, ausbildungen: false }],
    ['Unsinn (unlesbar): alles frei', '{kaputt', { patienten: true, mpg: true, lager: true, dokumente: true, ausbildungen: true }],
    ['falsche Werte', [7, 'xyz', null], { patienten: false, mpg: false, lager: false, dokumente: false, ausbildungen: false }],
  ]
  const MODUL_VON: Record<string, string> = { protokoll_neu: 'patienten', mpg_gesperrt: 'mpg', mpg_defekt: 'mpg', mpg_bald: 'mpg', lager_mindestbestand: 'lager', lager_abgelaufen: 'lager', lager_ablauf: 'lager', produktausgabe: 'lager', einsendung: 'dokumente', cirs_neu: 'dokumente', cirs_ueberfaellig: 'dokumente', ausbildung: 'ausbildungen' }
  for (const [name, frei, soll] of MODULE) {
    it(`Modul: ${name}`, () => {
      const org = { ...ORG, freigeschaltet: frei }
      for (const p of [PERSONEN.helferHaken, PERSONEN.supervisorInOrg]) {
        expect(R.darfAnlass(p, org, 'mitteilung', {}, JETZT)).toBe(true)
        for (const [k, m] of Object.entries(MODUL_VON)) expect([k, R.darfAnlass(p, org, k, {}, JETZT)]).toEqual([k, soll[m]])
      }
    })
  }
})

describe('unterschrift: nur das Ziel, nie Teilnehmende oder Supervisor, Modul je Formular', () => {
  const h = PERSONEN.helferHaken
  it('nur ziel', () => {
    expect(R.darfAnlass(h, ORG, 'unterschrift', { ziel: h.id, formular: 'patienten' }, JETZT)).toBe(true)
    expect(R.darfAnlass(h, ORG, 'unterschrift', { ziel: 'jemandanders001', formular: 'patienten' }, JETZT)).toBe(false)
    expect(R.darfAnlass(h, ORG, 'unterschrift', { formular: 'patienten' }, JETZT)).toBe(false)
  })
  it('nie Teilnehmende oder Supervisor, auch nicht ohne Rechte', () => {
    for (const p of [PERSONEN.teilnehmer, PERSONEN.supervisorInOrg]) expect(R.darfAnlass(p, ORG, 'unterschrift', { ziel: p.id, formular: 'patienten' }, JETZT)).toBe(false)
    expect(R.darfAnlass(PERSONEN.ohneRecht, ORG, 'unterschrift', { ziel: PERSONEN.ohneRecht.id, formular: 'eigen' }, JETZT)).toBe(true)
  })
  it('Modul je Formular, unbekanntes Formular nein', () => {
    const org = { ...ORG, freigeschaltet: ['lager'] }
    const soll: Record<string, boolean> = { patienten: false, produktausgabe: true, defektmeldung: true, eigen: true, cirs: false, '': false }
    for (const [f, s] of Object.entries(soll)) expect([f, R.darfAnlass(h, org, 'unterschrift', { ziel: h.id, formular: f }, JETZT)]).toEqual([f, s])
  })
  it('darfAnlassGrundsaetzlich für /stand', () => {
    expect(R.darfAnlassGrundsaetzlich(h, ORG, 'unterschrift', JETZT)).toBe(true)
    expect(R.darfAnlassGrundsaetzlich(h, { ...ORG, freigeschaltet: [] }, 'unterschrift', JETZT)).toBe(false)
    expect(R.darfAnlassGrundsaetzlich(PERSONEN.teilnehmer, ORG, 'unterschrift', JETZT)).toBe(false)
    expect(R.darfAnlassGrundsaetzlich(PERSONEN.teilnehmer, ORG, 'mitteilung', JETZT)).toBe(true)
  })
})

describe('Leitung (2.4) und Mitteilungen (2.7, Owner 12.3)', () => {
  it('darfOrganisation: Leitung, Benutzerverwaltung (auch befristet neues Format), Supervisor der Org', () => {
    const fall: [P, boolean][] = [
      [PERSONEN.admin, true],
      [person('unit00000000001', { permissions: { unitarii: true } }), true],
      [person('unit00000000002', { temp_permissions: { unitarii: { until: pbZeit(JETZT + 60_000) } } }), true],
      [person('unit00000000003', { temp_permissions: { unitarii: { until: new Date(JETZT + 86_400_000).toISOString() } } }), false],
      [person('dok000000000001', { permissions: { dokumente: true } }), false],
      [PERSONEN.ohneRecht, false],
      [PERSONEN.supervisorInOrg, true],
      [{ ...PERSONEN.admin, organization_id: 'orgb00000000001' }, false],
      [{ ...PERSONEN.admin, disabled: true }, false],
    ]
    for (const [p, s] of fall) expect([p.id, R.darfOrganisation(p, ORG.id, JETZT)]).toEqual([p.id, s])
  })
  it('mitteilungRolle: Supervisor jede Organisation, Leitung nur die eigene, sonst niemand', () => {
    expect(R.mitteilungRolle(PERSONEN.supervisorOhneOrg, 'orgb00000000001', JETZT)).toBe('supervisor')
    expect(R.mitteilungRolle(PERSONEN.admin, ORG.id, JETZT)).toBe('leitung')
    expect(R.mitteilungRolle(PERSONEN.admin, 'orgb00000000001', JETZT)).toBe(null)
    expect(R.mitteilungRolle(PERSONEN.admin, '', JETZT)).toBe(null)
    expect(R.mitteilungRolle({ ...PERSONEN.admin, disabled: true }, ORG.id, JETZT)).toBe(null)
    expect(R.mitteilungRolle({ ...PERSONEN.admin, sammlung: '_superusers' }, ORG.id, JETZT)).toBe(null)
    expect(R.mitteilungRolle(PERSONEN.helferHaken, ORG.id, JETZT)).toBe(null)
    expect(R.mitteilungRolle({ ...PERSONEN.helferHaken, permissions: { unitarii: true } }, ORG.id, JETZT)).toBe(null)
    expect(R.mitteilungRolle(null, ORG.id, JETZT)).toBe(null)
  })
  it('mitteilungPruefen: Titel 1 bis 120, Text bis 1000 Zeichen, nur Text', () => {
    expect(R.mitteilungPruefen('Halle gesperrt', 'Bitte umsetzen.').ok).toBe(true)
    expect(R.mitteilungPruefen('', 'x').ok).toBe(false)
    expect(R.mitteilungPruefen('   ', 'x').ok).toBe(false)
    expect(R.mitteilungPruefen('ä'.repeat(120), 'ö'.repeat(1000)).ok).toBe(true)
    expect(R.mitteilungPruefen('x'.repeat(121), '').feld).toBe('title')
    expect(R.mitteilungPruefen('x', 'y'.repeat(1001)).feld).toBe('message')
    // Emojis zählen als ein Zeichen (wie Max length in PocketBase)
    expect(R.mitteilungPruefen('\u{1F692}'.repeat(120), '').ok).toBe(true)
    expect(R.mitteilungPruefen('Titel', '<script>alert(1)</script>').ok).toBe(false)
    expect(R.mitteilungPruefen('<b>fett</b>', '').ok).toBe(false)
    expect(R.mitteilungPruefen('A &amp; B', '').ok).toBe(false)
    expect(R.mitteilungPruefen('A & B < C', '3 > 2').ok).toBe(true)
  })
  it('mitteilungDrossel: drei je 24 Stunden, Speicher und Datenbank, die größere Zahl zählt', () => {
    const F = 24 * 3600_000
    let l: number[] = []
    for (let i = 0; i < 3; i++) {
      const d = R.mitteilungDrossel(l, [], JETZT + i * 1000, 3, F)
      expect(d.erlaubt).toBe(true)
      l = d.neu
    }
    const vierte = R.mitteilungDrossel(l, [], JETZT + 5000, 3, F)
    expect(vierte.erlaubt).toBe(false)
    expect(vierte.sekunden).toBeGreaterThan(23 * 3600)
    expect(R.mitteilungDrossel(l, [], JETZT + F + 1, 3, F).erlaubt).toBe(true)
    // nach einem Neustart (Speicher leer) zählt die Datenbank
    expect(R.mitteilungDrossel([], [JETZT - 1000, JETZT - 2000, JETZT - 3000], JETZT, 3, F).erlaubt).toBe(false)
    // gelöschte Mitteilungen fehlen in der Datenbank, der Speicher zählt sie
    expect(R.mitteilungDrossel([JETZT - 1000, JETZT - 2000, JETZT - 3000], [], JETZT, 3, F).erlaubt).toBe(false)
    expect(R.MITTEILUNG_TEXTE.drossel.replace('{m}', R.dauerText(vierte.sekunden))).toMatch(/^Höchstens drei Mitteilungen je Organisation in 24 Stunden\. Die nächste geht in 24 Stunden wieder\.$/)
  })
})

describe('Einstellungen (2.4, 4.2)', () => {
  const VORGABE = { v: 1, aus: [], ruhe: { an: true, von: '22:00', bis: '06:00' }, mitteilung_in_ruhe: true }
  for (const roh of [null, undefined, '', '{kaputt', 7, [], 'null', JSON.stringify(JSON.stringify(null))]) {
    it(`Vorgabe bei ${JSON.stringify(roh)}`, () => expect(flach(R.personEinstellungenLesen(roh))).toEqual(VORGABE))
  }
  it('doppelt kodiert, unbekannte keys, Pflicht entfernt, Doppelte, Reihenfolge', () => {
    const roh = JSON.stringify(JSON.stringify({ aus: ['cirs_neu', 'mitteilung', 'gibtsnicht', 'cirs_neu', 'unterschrift', 7], ruhe: { an: false, von: '23:30', bis: '5:15' }, mitteilung_in_ruhe: false }))
    expect(flach(R.personEinstellungenLesen(roh))).toEqual({ v: 1, aus: ['unterschrift', 'cirs_neu'], ruhe: { an: false, von: '23:30', bis: '05:15' }, mitteilung_in_ruhe: false })
  })
  const RUHE: [unknown, unknown, unknown, { an: boolean; von: string; bis: string }][] = [
    [true, '6:00', '7:05', { an: true, von: '06:00', bis: '07:05' }],
    [true, '24:00', '22:60', { an: true, von: '22:00', bis: '06:00' }],
    ['ja', 1320, '06:00', { an: true, von: '22:00', bis: '06:00' }],
    [false, ' 6:00', '06:0', { an: false, von: '22:00', bis: '06:00' }],
    [1, '00:00', '23:59', { an: true, von: '00:00', bis: '23:59' }],
  ]
  for (const [an, von, bis, soll] of RUHE) {
    it(`ruhe ${JSON.stringify({ an, von, bis })}`, () => expect(flach(R.personEinstellungenLesen({ ruhe: { an, von, bis } }).ruhe)).toEqual(soll))
  }
  it('mitteilung_in_ruhe: nur false schaltet ab', () => {
    for (const w of [true, 'false', 0, null, undefined]) expect(R.personEinstellungenLesen({ mitteilung_in_ruhe: w }).mitteilung_in_ruhe).toBe(true)
    expect(R.personEinstellungenLesen({ mitteilung_in_ruhe: false }).mitteilung_in_ruhe).toBe(false)
  })
  it('Mischen: fehlende oder unlesbare Teile bleiben', () => {
    const alt = R.personEinstellungenLesen({ aus: ['cirs_neu'], ruhe: { an: true, von: '21:00', bis: '07:00' }, mitteilung_in_ruhe: false })
    expect(flach(R.personEinstellungenMischen(alt, {}))).toEqual(flach(alt))
    expect(flach(R.personEinstellungenMischen(alt, { ruhe: { bis: '06:30' } }).ruhe)).toEqual({ an: true, von: '21:00', bis: '06:30' })
    expect(flach(R.personEinstellungenMischen(alt, { ruhe: { von: 'Unsinn', an: false } }).ruhe)).toEqual({ an: false, von: '21:00', bis: '07:00' })
    expect(R.personEinstellungenMischen(alt, { aus: [] }).aus.length).toBe(0)
    expect(R.personEinstellungenMischen(alt, { mitteilung_in_ruhe: true }).mitteilung_in_ruhe).toBe(true)
    expect(R.personEinstellungenMischen(alt, { mitteilung_in_ruhe: 'ja' }).mitteilung_in_ruhe).toBe(false)
  })
  it('Organisation', () => {
    expect(flach(R.orgEinstellungenLesen('{"v":1,"aus":["mitteilung","lager_ablauf","einsendung"]}'))).toEqual({ v: 1, aus: ['lager_ablauf', 'einsendung'] })
    expect(flach(R.orgEinstellungenLesen(null))).toEqual({ v: 1, aus: [] })
  })
  it('anlassAn: Organisation aus, Person aus, beide, Pflicht immer an', () => {
    const o = (aus: string[]) => ({ v: 1, aus })
    const p = (aus: string[]) => ({ ...R.personEinstellungenLesen(null), aus })
    expect(R.anlassAn(o([]), p([]), 'einsendung')).toBe(true)
    expect(R.anlassAn(o(['einsendung']), p([]), 'einsendung')).toBe(false)
    expect(R.anlassAn(o([]), p(['einsendung']), 'einsendung')).toBe(false)
    expect(R.anlassAn(o(['einsendung']), p(['einsendung']), 'einsendung')).toBe(false)
    expect(R.anlassAn(o(['mitteilung']), p(['mitteilung']), 'mitteilung')).toBe(true)
    expect(R.anlassAn(o([]), p([]), 'gibtsnicht')).toBe(false)
  })
  it('empfaengerFiltern: Recht und Schalter zusammen', () => {
    const ps = Object.values(PERSONEN).map((p) => ({ ...p, push: R.personEinstellungenLesen(null) }))
    ps[2] = { ...ps[2], push: R.personEinstellungenLesen({ aus: ['einsendung'] }) }
    const ids = R.empfaengerFiltern(ps, { ...ORG, push: R.orgEinstellungenLesen(null) }, 'einsendung', {}, JETZT).map((p: P) => p.id)
    expect(ids).toEqual([PERSONEN.admin.id, PERSONEN.befristetGueltig.id, PERSONEN.supervisorInOrg.id])
    expect(R.empfaengerFiltern(ps, { ...ORG, push: { v: 1, aus: ['einsendung'] } }, 'einsendung', {}, JETZT).length).toBe(0)
  })
})

// Deutsche Zeit laut Intl (in Node vorhanden, in der JSVM nicht)
const INTL = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
const WOCHENTAG: Record<string, number> = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 7 }
function intlTeile(ms: number) {
  const t: Record<string, string> = {}
  for (const p of INTL.formatToParts(new Date(ms))) t[p.type] = p.value
  return { tag: `${t.year}-${t.month}-${t.day}`, stunde: Number(t.hour), minute: Number(t.minute), wochentag: WOCHENTAG[t.weekday.replace('.', '')] }
}
const berlin = (tag: string, hhmm: string) => R.berlinZuUtc(tag, R.zeitLesen(hhmm))

describe('Zeit Europe/Berlin von Hand (gegen Intl)', () => {
  it('jede volle Stunde 2026 bis 2030', () => {
    for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2031, 0, 1); ms += 3600_000) {
      const t = R.berlinTeile(ms)
      const i = intlTeile(ms)
      if (t.tag !== i.tag || t.stunde !== i.stunde || t.minute !== i.minute || t.wochentag !== i.wochentag) throw new Error(`Abweichung bei ${new Date(ms).toISOString()}: ${JSON.stringify(flach(t))} gegen ${JSON.stringify(i)}`)
      expect(t.minutenImTag).toBe(t.stunde * 60 + t.minute)
    }
  })
  it('jede Minute um die Umstellungen 2026 und 2027', () => {
    for (const u of ['2026-03-29T01:00:00Z', '2026-10-25T01:00:00Z', '2027-03-28T01:00:00Z', '2027-10-31T01:00:00Z']) {
      const mitte = Date.parse(u)
      for (let ms = mitte - 3 * 3600_000; ms <= mitte + 3 * 3600_000; ms += 60_000) {
        const t = R.berlinTeile(ms)
        const i = intlTeile(ms)
        if (t.tag !== i.tag || t.stunde !== i.stunde || t.minute !== i.minute) throw new Error(`Abweichung bei ${new Date(ms).toISOString()}`)
      }
    }
  })
  it('berlinZuUtc: Rundweg, Lücke im Frühjahr, doppelte Stunde im Herbst', () => {
    for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2028, 0, 1); ms += 3600_000 * 7 + 60_000 * 13) {
      const t = R.berlinTeile(ms)
      const zurueck = R.berlinZuUtc(t.tag, t.minutenImTag)
      // Die zweite 02:xx im Herbst gibt es zweimal: berlinZuUtc nimmt die erste (eine Stunde früher)
      expect(zurueck === ms || zurueck === ms - 3600_000).toBe(true)
      if (zurueck !== ms) expect(R.berlinTeile(zurueck).minutenImTag).toBe(t.minutenImTag)
    }
    expect(new Date(berlin('2026-03-29', '02:30')).toISOString()).toBe('2026-03-29T01:00:00.000Z')
    expect(R.berlinTeile(berlin('2026-03-29', '02:30')).stunde).toBe(3)
    expect(new Date(berlin('2026-10-25', '02:30')).toISOString()).toBe('2026-10-25T00:30:00.000Z')
    expect(new Date(berlin('2026-10-25', '03:00')).toISOString()).toBe('2026-10-25T02:00:00.000Z')
    expect(new Date(berlin('2026-07-01', '00:00')).toISOString()).toBe('2026-06-30T22:00:00.000Z')
    expect(Number.isNaN(R.berlinZuUtc('2026-7-1', 0))).toBe(true)
  })
  it('zeitLesen und zeitText', () => {
    expect(R.zeitLesen('6:00')).toBe(360)
    expect(R.zeitLesen('06:00')).toBe(360)
    expect(R.zeitLesen('23:59')).toBe(1439)
    for (const x of ['24:00', '22:60', '6', '600', '06:00:00', ' 06:00', 360, null]) expect(R.zeitLesen(x)).toBe(null)
    expect(R.zeitText(0)).toBe('00:00')
    expect(R.zeitText(1439)).toBe('23:59')
    expect(R.zeitText(1440 + 61)).toBe('01:01')
  })
})

describe('Ruhezeit', () => {
  const N = { an: true, von: '22:00', bis: '06:00' }
  const tag = '2026-11-16'
  it('22:00 bis 06:00 um 21:59, 22:00, 05:59, 06:00', () => {
    expect(R.inRuhe(N, berlin(tag, '21:59'))).toBe(false)
    expect(R.inRuhe(N, berlin(tag, '22:00'))).toBe(true)
    expect(R.inRuhe(N, berlin(tag, '05:59'))).toBe(true)
    expect(R.inRuhe(N, berlin(tag, '06:00'))).toBe(false)
  })
  it('13:00 bis 14:00, 00:00 bis 00:00 (nie), aus', () => {
    const M = { an: true, von: '13:00', bis: '14:00' }
    expect(R.inRuhe(M, berlin(tag, '12:59'))).toBe(false)
    expect(R.inRuhe(M, berlin(tag, '13:00'))).toBe(true)
    expect(R.inRuhe(M, berlin(tag, '14:00'))).toBe(false)
    for (let h = 0; h < 24; h++) expect(R.inRuhe({ an: true, von: '00:00', bis: '00:00' }, berlin(tag, `${h}:30`))).toBe(false)
    expect(R.inRuhe({ ...N, an: false }, berlin(tag, '23:00'))).toBe(false)
    expect(R.ruheText(N)).toBe('Von 22:00 bis 06:00 Uhr')
    expect(R.ruheText({ ...N, an: false })).toBe('Aus')
    expect(R.ruheText({ an: true, von: '06:00', bis: '06:00' })).toBe('Aus')
  })
  it('ruheEnde über Mitternacht und über die Umstellung', () => {
    expect(R.ruheEnde(N, berlin(tag, '12:00'))).toBe(null)
    expect(new Date(R.ruheEnde(N, berlin('2026-11-16', '23:00'))).toISOString()).toBe('2026-11-17T05:00:00.000Z')
    expect(new Date(R.ruheEnde(N, berlin('2026-11-17', '03:00'))).toISOString()).toBe('2026-11-17T05:00:00.000Z')
    expect(new Date(R.ruheEnde(N, berlin('2026-03-28', '23:00'))).toISOString()).toBe('2026-03-29T04:00:00.000Z')
    expect(new Date(R.ruheEnde(N, berlin('2026-10-24', '23:00'))).toISOString()).toBe('2026-10-25T05:00:00.000Z')
    expect(new Date(R.ruheEnde({ an: true, von: '01:00', bis: '02:30' }, Date.parse('2026-03-29T00:30:00Z'))).toISOString()).toBe('2026-03-29T01:00:00.000Z')
    // Herbst, doppelte Stunde: im ersten 02:36 (Sommerzeit) endet 02:45 nach 9 Minuten, im zweiten (Winterzeit) ebenso
    const herbst = { an: true, von: '01:00', bis: '02:45' }
    expect(new Date(R.ruheEnde(herbst, Date.parse('2026-10-25T00:36:00Z'))).toISOString()).toBe('2026-10-25T00:45:00.000Z')
    expect(new Date(R.ruheEnde(herbst, Date.parse('2026-10-25T01:36:00Z'))).toISOString()).toBe('2026-10-25T01:45:00.000Z')
  })
  it('zustellart: Mitteilung mit und ohne mitteilung_in_ruhe; andere in der Ruhezeit später', () => {
    const nacht = berlin(tag, '23:00')
    const p = R.personEinstellungenLesen(null)
    expect(R.zustellart(p, 'mitteilung', nacht).art).toBe('sofort')
    const ohne = R.personEinstellungenLesen({ mitteilung_in_ruhe: false })
    expect(flach(R.zustellart(ohne, 'mitteilung', nacht))).toEqual({ art: 'spaeter', faellig: berlin('2026-11-17', '06:00'), grund: 'ruhe' })
    expect(flach(R.zustellart(p, 'einsendung', nacht))).toEqual({ art: 'spaeter', faellig: berlin('2026-11-17', '06:00'), grund: 'ruhe' })
    expect(R.zustellart(p, 'einsendung', berlin(tag, '12:00')).art).toBe('sofort')
  })
})

describe('Drossel, Läufe, Schutzschalter, Takt-Sperre', () => {
  it('drossel: 8 erlaubt, die 9. nicht, neues Fenster nach 10 min', () => {
    let alt: unknown = null
    for (let i = 0; i < 8; i++) {
      const d = R.drossel(alt, JETZT + i, 8, 600_000)
      expect(d.erlaubt).toBe(true)
      alt = d.neu
    }
    const neunte = R.drossel(alt, JETZT + 9, 8, 600_000)
    expect(neunte.erlaubt).toBe(false)
    expect(neunte.faellig).toBe(JETZT + 600_000)
    expect(R.drossel(alt, JETZT + 600_000, 8, 600_000).erlaubt).toBe(true)
  })
  it('laeufeFaellig', () => {
    const mo = '2026-11-16'
    expect(R.berlinTeile(berlin(mo, '12:00')).wochentag).toBe(1)
    expect(flach(R.laeufeFaellig(berlin(mo, '05:59'), {}))).toEqual({ morgen: null, woche: null })
    expect(flach(R.laeufeFaellig(berlin(mo, '06:59'), {}))).toEqual({ morgen: mo, woche: null })
    expect(flach(R.laeufeFaellig(berlin(mo, '07:00'), {}))).toEqual({ morgen: mo, woche: mo })
    expect(flach(R.laeufeFaellig(berlin('2026-11-17', '07:00'), {}))).toEqual({ morgen: '2026-11-17', woche: null })
    expect(flach(R.laeufeFaellig(berlin(mo, '07:00'), { morgen: mo, woche: mo }))).toEqual({ morgen: null, woche: null })
    // So 23:30 UTC = Mo 00:30 Berlin (Winter): nichts
    expect(flach(R.laeufeFaellig(Date.parse('2026-11-15T23:30:00Z'), {}))).toEqual({ morgen: null, woche: null })
    // Sommerzeit: Mo 06:00 Berlin = 04:00 UTC
    expect(R.laeufeFaellig(Date.parse('2026-06-15T04:00:00Z'), {}).morgen).toBe('2026-06-15')
    expect(R.laeufeFaellig(Date.parse('2026-06-15T03:59:00Z'), {}).morgen).toBe(null)
    expect(R.laeufeFaellig(Date.parse('2026-06-15T05:00:00Z'), {}).woche).toBe('2026-06-15')
  })
  it('Schutzschalter: Fehler öffnet 60 s, Erfolg schließt, Ablauf schließt', () => {
    const f = R.schutzschalterNeu(null, 'fehler', JETZT)
    expect(R.schutzschalterOffen(f, JETZT)).toBe(true)
    expect(R.schutzschalterOffen(f, JETZT + 59_999)).toBe(true)
    expect(R.schutzschalterOffen(f, JETZT + 60_000)).toBe(false)
    const ok = R.schutzschalterNeu(f, 'ok', JETZT + 1000)
    expect(R.schutzschalterOffen(ok, JETZT + 1000)).toBe(false)
    expect(ok.letzter_ok).toBe(JETZT + 1000)
    expect(R.schutzschalterNeu(R.schutzschalterNeu(f, 'fehler', JETZT), 'fehler', JETZT).fehler).toBe(3)
    expect(R.schutzschalterOffen(null, JETZT)).toBe(false)
  })
  it('taktSperreNeu', () => {
    const a = R.taktSperreNeu(null, 'a', JETZT, 'nehmen')
    expect(a.erfolg).toBe(true)
    expect(R.taktSperreNeu(a.wert, 'b', JETZT + 1000, 'nehmen').erfolg).toBe(false)
    expect(R.taktSperreNeu(a.wert, 'b', JETZT + 1000, 'erneuern').erfolg).toBe(false)
    expect(R.taktSperreNeu(a.wert, 'a', JETZT + 1000, 'erneuern').erfolg).toBe(true)
    expect(R.taktSperreNeu(a.wert, 'b', JETZT + 300_000, 'nehmen').erfolg).toBe(true)
    expect(R.taktSperreNeu(a.wert, 'b', JETZT, 'geben').erfolg).toBe(false)
    const g = R.taktSperreNeu(a.wert, 'a', JETZT, 'geben')
    expect(g.erfolg).toBe(true)
    expect(g.wert).toBe(null)
    expect(R.taktSperreNeu(g.wert, 'b', JETZT, 'nehmen').erfolg).toBe(true)
  })
  it('zaehlen (Drossel der Routen)', () => {
    let alt: unknown = null
    for (let i = 0; i < 5; i++) { const d = R.zaehlen(alt, JETZT, 600_000, 5); expect(d.erlaubt).toBe(true); alt = d.neu }
    const d = R.zaehlen(alt, JETZT + 1000, 600_000, 5)
    expect(d.erlaubt).toBe(false)
    expect(d.sekunden).toBe(599)
    expect(R.zaehlen(alt, JETZT + 600_000, 600_000, 5).erlaubt).toBe(true)
  })
})

const AM = Date.parse('2026-11-15T13:20:00Z') // 15.11., 14:20 Berlin
function pruefeText(t: { titel: string; text: string; url: string; tag: string }) {
  for (const s of [t.titel, t.text]) {
    expect(s).not.toMatch(GEDANKENSTRICHE)
    expect(s).not.toMatch(EMOJI)
    expect(s).not.toContain('@')
  }
  expect(t.titel.length).toBeLessThanOrEqual(80)
  expect(t.text.length).toBeLessThanOrEqual(300)
  expect(t.tag.length).toBeLessThanOrEqual(64)
  expect(R.urlSicher(t.url)).toBe(t.url)
}

describe('Texte (3.2)', () => {
  const FAELLE: [string, () => { titel: string; text: string; url: string; tag: string }, string, string, string, string][] = [
    ['Mitteilung', () => R.textMitteilung({ orgName: 'Wache Eins', titel: 'Fahrzeughalle gesperrt', text: 'Am Samstag wird der Boden versiegelt. Bitte Fahrzeuge bis Freitag 18 Uhr umsetzen.', id: 'mitt00000000001' }),
      'Wache Eins: Fahrzeughalle gesperrt', 'Am Samstag wird der Boden versiegelt. Bitte Fahrzeuge bis Freitag 18 Uhr umsetzen.', '/hub', 'mitteilung:mitt00000000001'],
    ['Unterschrift Protokoll', () => R.textUnterschrift({ formular: 'patienten', angelegtMs: AM, id: 'pat000000000001' }), 'Wartet auf deine Unterschrift', 'Ein Protokoll vom 15.11., 14:20 wartet auf deine Unterschrift.', '/unitas', 'unterschrift:pat000000000001'],
    ['Unterschrift Produktausgabe', () => R.textUnterschrift({ formular: 'produktausgabe', angelegtMs: AM, positionen: 3, id: 'pro000000000001' }), 'Wartet auf deine Unterschrift', 'Eine Produktausgabe vom 15.11., 14:20 (3 Positionen) wartet auf deine Unterschrift.', '/unitas', 'unterschrift:pro000000000001'],
    ['Unterschrift Einsendung', () => R.textUnterschrift({ formular: 'eigen', angelegtMs: AM, vorlageTitel: 'Fahrzeugcheck', id: 'ein000000000001' }), 'Wartet auf deine Unterschrift', 'Eine Einsendung (Fahrzeugcheck) vom 15.11., 14:20 wartet auf deine Unterschrift.', '/unitas', 'unterschrift:ein000000000001'],
    ['Unterschrift Defektmeldung', () => R.textUnterschrift({ formular: 'defektmeldung', geraetName: 'Absaugpumpe 1', id: 'mel000000000001' }), 'Wartet auf deine Unterschrift', 'Deine Defektmeldung zu Absaugpumpe 1 wartet auf deine Unterschrift.', '/unitas', 'unterschrift:mel000000000001'],
    ['Protokoll neu', () => R.textProtokollNeu({ angelegtMs: AM, id: 'pat000000000001' }), 'Neues Patientenprotokoll', 'Eingegangen am 15.11. um 14:20. Zum Gegenzeichnen unter Patienten.', '/patienten', 'protokoll_neu:pat000000000001'],
    ['Gerät gesperrt', () => R.textMpgGesperrt({ geraete: [{ id: 'dev000000000001', name: 'Defibrillator 2', grund: 'STK nicht bestanden' }] }), 'MPG: Defibrillator 2 gesperrt', 'Grund: STK nicht bestanden.', '/mpg/geraete/dev000000000001', 'mpg_gesperrt:dev000000000001'],
    ['Gerät gesperrt ohne Gerätebuch', () => R.textMpgGesperrt({ geraete: [{ id: 'dev000000000001', name: 'Defibrillator 2', grund: '' }] }), 'MPG: Defibrillator 2 gesperrt', 'Den Grund nennt das Gerätebuch.', '/mpg/geraete/dev000000000001', 'mpg_gesperrt:dev000000000001'],
    ['Frist ein Gerät', () => R.textMpgFristen({ geraete: [{ id: 'dev000000000002', name: 'Blutdruckmessgerät 1', art: 'mtk', naechste: '2026-12-31' }], tag: '2027-01-02' }), 'MPG: Blutdruckmessgerät 1 gesperrt', 'MTK war bis 31.12.2026 fällig.', '/mpg/geraete/dev000000000002', 'mpg_gesperrt:dev000000000002'],
    ['Frist drei Geräte', () => R.textMpgFristen({ geraete: [['dev000000000002', 'Blutdruckmessgerät 1'], ['dev000000000003', 'Thermometer 2'], ['dev000000000004', 'Blutdruckmessgerät 3']].map(([id, name]) => ({ id, name, art: 'mtk', naechste: '2026-12-31' })), tag: '2027-01-02' }),
      'MPG: 3 Geräte gesperrt', 'MTK überfällig: Blutdruckmessgerät 1, Thermometer 2, Blutdruckmessgerät 3.', '/mpg/fristen', 'mpg_frist:2027-01-02'],
    ['Defektmeldung', () => R.textMpgDefekt({ quelle: 'meldung', id: 'mel000000000001', deviceName: 'Absaugpumpe 1', schwere: 'high' }), 'MPG: Defektmeldung zu Absaugpumpe 1', 'Schwere: hoch. Bitte prüfen und bestätigen.', '/mpg/meldungen', 'mpg_defekt:mel000000000001'],
    ['Mangel', () => R.textMpgDefekt({ quelle: 'defekt', id: 'def000000000001', deviceName: 'Absaugpumpe 1', schwere: 'low' }), 'MPG: Mangel an Absaugpumpe 1', 'Schwere: gering.', '/mpg/meldungen/def000000000001', 'mpg_defekt:def000000000001'],
    ['Mangel ohne Gerät', () => R.textMpgDefekt({ quelle: 'defekt', id: 'def000000000001', deviceName: '', schwere: 'critical' }), 'MPG: Mangel an einem Gerät', 'Schwere: kritisch.', '/mpg/meldungen/def000000000001', 'mpg_defekt:def000000000001'],
    ['Lager unter Soll, einer', () => R.textLagerUnter([{ item: 'Mullbinden 8 cm', ort: 'RTW 1', ist: 4, soll: 10 }], 1700000000000), 'Lager: Mullbinden 8 cm unter Mindestbestand', 'RTW 1: 4 von 10.', '/lager', 'lager_unter:1700000000000'],
    ['Lager unter Soll, mehrere', () => R.textLagerUnter([{ item: 'Mullbinden 8 cm', ort: 'RTW 1', ist: 4, soll: 10 }, { item: 'Ringer 500 ml', ort: '', ist: 1, soll: 6 }, { item: 'Pflaster', ort: '', ist: 0, soll: 2 }], 1700000000000),
      'Lager: 3 Artikel unter Mindestbestand', 'Mullbinden 8 cm (RTW 1) 4 von 10, Ringer 500 ml 1 von 6, Pflaster 0 von 2.', '/lager', 'lager_unter:1700000000000'],
    ['Lager abgelaufen', () => R.textLagerAbgelaufen([{ item: 'Ringer 500 ml', datum: '2026-11-14' }, { item: 'Mullbinde', datum: '2026-11-14' }], '2026-11-15'), 'Lager: 2 Artikel abgelaufen', 'Ringer 500 ml (MHD 14.11.2026), Mullbinde (MHD 14.11.2026).', '/lager', 'lager_abgelaufen:2026-11-15'],
    ['Produktausgabe', () => R.textProduktausgabe({ id: 'pro000000000001', lagerName: 'RTW 2', positionen: 3, angelegtMs: AM }), 'Produktausgabe offen', '3 Positionen aus Lager RTW 2, eingegangen 15.11., 14:20.', '/lager', 'produktausgabe:pro000000000001'],
    ['Produktausgabe ohne Lager', () => R.textProduktausgabe({ id: 'pro000000000001', lagerName: '', positionen: 1, angelegtMs: AM }), 'Produktausgabe offen', '1 Position, eingegangen 15.11., 14:20.', '/lager', 'produktausgabe:pro000000000001'],
    ['Einsendung', () => R.textEinsendung({ id: 'ein000000000001', titel: 'Fahrzeugcheck', angelegtMs: AM }), 'Neue Einsendung: Fahrzeugcheck', 'Eingegangen am 15.11. um 14:20.', '/vorgaenge?tab=eingang&seite=einsendung&id=ein000000000001', 'einsendung:ein000000000001'],
    ['CIRS', () => R.textCirsNeu({ id: 'cir000000000001', kategorie: 'material' }), 'Neue CIRS-Meldung', 'Kategorie: Material / Ausrüstung. Zur Bewertung unter Vorgänge.', '/vorgaenge?tab=cirs&meldung=cir000000000001', 'cirs:cir000000000001'],
    ['CIRS freie Kategorie', () => R.textCirsNeu({ id: 'cir000000000001', kategorie: 'Erika Musterfrau GEHEIMTEXT' }), 'Neue CIRS-Meldung', 'Zur Bewertung unter Vorgänge.', '/vorgaenge?tab=cirs&meldung=cir000000000001', 'cirs:cir000000000001'],
    ['Ausbildung', () => R.textAusbildung({ terminId: 'ter000000000001', antwortId: 'ant000000000001', terminName: 'Erste Hilfe Auffrischung', startMs: Date.parse('2026-11-20T17:00:00Z'), name: 'Max Muster', status: 'abgesagt' }),
      'Ausbildung 20.11.: Absage', 'Max Muster hat abgesagt (Erste Hilfe Auffrischung).', '/ausbildungen', 'ausbildung:ter000000000001:ant000000000001'],
    ['Ausbildung mit E-Mail als Name', () => R.textAusbildung({ terminId: 'ter000000000001', antwortId: 'ant000000000002', terminName: 'Funk', startMs: Date.parse('2026-11-20T17:00:00Z'), name: 'max@example.invalid', status: 'zugesagt' }),
      'Ausbildung 20.11.: Zusage', 'Jemand hat zugesagt (Funk).', '/ausbildungen', 'ausbildung:ter000000000001:ant000000000002'],
    ['Probe', () => R.textProbe(), 'Responda: Probe', 'So sehen Benachrichtigungen auf diesem Gerät aus.', '/benachrichtigungen', 'probe'],
  ]
  for (const [name, f, titel, text, url, tag] of FAELLE) {
    it(name, () => {
      const t = f()
      expect(flach(t)).toEqual({ titel, text, url, tag })
      pruefeText(t)
    })
  }
  it('Wochenüberblick: nur Zeilen, die nicht null sind; keine Zeile → null', () => {
    const t = R.textWoche({ mpg: { bald: 3, ueberfaellig: 1 }, lager: { anzahl: 5 }, cirs: { ueberfaellig: 1 } })
    expect(flach(t)).toEqual({ titel: 'Responda: Wochenüberblick', text: 'MPG: 3 Geräte bald fällig, 1 Prüfung überfällig.\nLager: 5 Artikel laufen in den nächsten 30 Tagen ab.\nCIRS: 1 Vorgang überfällig.', url: '/hub', tag: 'woche' })
    expect(R.textWoche({ mpg: { bald: 1, ueberfaellig: 0 }, lager: { anzahl: 1 } }).text).toBe('MPG: 1 Gerät bald fällig.\nLager: 1 Artikel läuft in den nächsten 30 Tagen ab.')
    expect(R.textWoche({ mpg: { bald: 0, ueberfaellig: 2 }, cirs: { ueberfaellig: 2 } }).text).toBe('MPG: 2 Prüfungen überfällig.\nCIRS: 2 Vorgänge überfällig.')
    expect(R.textWoche({ mpg: { bald: 0, ueberfaellig: 0 }, lager: { anzahl: 0 }, cirs: { ueberfaellig: 0 } })).toBe(null)
    expect(R.textWoche({})).toBe(null)
  })
  it('wocheZeilen: nur Zeilen, deren Anlass erlaubt ist und die nicht null sind (auch beim Zustellen)', () => {
    const w = { mpg: { bald: 1, ueberfaellig: 2 }, lager: { anzahl: 3 }, cirs: { ueberfaellig: 4 } }
    const gefragt: string[] = []
    expect(R.wocheZeilen(w, (k: string) => { gefragt.push(k); return true })).toEqual(w)
    expect(gefragt).toEqual(['mpg_bald', 'lager_ablauf', 'cirs_ueberfaellig'])
    expect(R.wocheZeilen(w, (k: string) => k === 'lager_ablauf')).toEqual({ lager: { anzahl: 3 } })
    expect(R.wocheZeilen(w, () => false)).toEqual({})
    expect(R.textWoche(R.wocheZeilen(w, () => false))).toBe(null)
    // Nullen, Unsinn und Text fallen weg; nur ganze Zahlen
    expect(R.wocheZeilen({ mpg: { bald: 0, ueberfaellig: 0 }, lager: { anzahl: '2.7' }, cirs: 'viel' }, () => true)).toEqual({ lager: { anzahl: 2 } })
    expect(R.wocheZeilen(null, () => true)).toEqual({})
    expect(R.WOCHE_ANLASS).toEqual({ mpg: 'mpg_bald', lager: 'lager_ablauf', cirs: 'cirs_ueberfaellig' })
  })
  it('textProtokollNeu nimmt keine Namen an, auch wenn jemand sie übergibt', () => {
    const t = R.textProtokollNeu({ angelegtMs: AM, id: 'pat000000000001', title: 'Patientendoku: Erika Musterfrau', name: 'Erika Musterfrau', payload: { diagnose: 'GEHEIMTEXT' } })
    expect(JSON.stringify(t)).not.toMatch(/Musterfrau|GEHEIMTEXT/)
  })
  it('grundAusEreignis: nur feste Kategorien, nie Freitext', () => {
    expect(R.grundAusEreignis('stk', '', { ergebnis: 'nicht_bestanden' })).toBe('STK nicht bestanden')
    expect(R.grundAusEreignis('mtk', '', '{"ergebnis":"nicht_bestanden"}')).toBe('MTK nicht bestanden')
    expect(R.grundAusEreignis('stk', '', { ergebnis: 'bestanden' })).toBe('')
    expect(R.grundAusEreignis('gesperrt', 'Prüfung nicht bestanden', null)).toBe('Prüfung nicht bestanden')
    expect(R.grundAusEreignis('gesperrt', 'Defekt gemeldet: Display defekt bei Erika Musterfrau', null)).toBe('Defekt gemeldet')
    expect(R.grundAusEreignis('gesperrt', 'Meldung von außen bestätigt: GEHEIMTEXT', null)).toBe('Meldung von außen bestätigt')
    expect(R.grundAusEreignis('', '', null)).toBe('')
    expect(R.grundAusEreignis('vermerk', 'irgendwas', null)).toBe('')
    for (const frei of ['Akku leer', 'Erika Musterfrau hat es fallen lassen', '<script>', '']) {
      const g = R.grundAusEreignis('gesperrt', frei, null)
      expect(g).toBe('von Hand gesperrt')
    }
  })
  it('grundAusEreignis erkennt die Sperren aus den MPG-Plänen (auch mit eigener Schwere)', () => {
    const wer = { organization_id: 'org', name: 'Lena Berger' }
    const meldung = { id: 'm1', device_id: 'g1', device_name: 'Defi', description: 'Kabel lose', severity: 'low' as const }
    const grund = (plan: { collection: string; body: Record<string, unknown> }[]) => {
      const e = plan.find(a => a.collection === 'mpg_ereignisse')
      return R.grundAusEreignis(e?.body.art, e?.body.text, null)
    }
    expect(grund(planeBestaetigung({ meldung, anmerkung: '', sperren: false, schwere: 'critical', geraetDa: true, wer, defektId: 'm1', buch: true }))).toBe('Meldung von außen bestätigt')
    expect(grund(planeBestaetigung({ meldung: { ...meldung, severity: 'high' }, anmerkung: '', sperren: true, geraetDa: true, wer, defektId: 'm1', buch: true }))).toBe('Meldung von außen bestätigt')
    expect(grund(planeDefekt({ geraet: { id: 'g1', name: 'Defi' }, beschreibung: 'x', schwere: 'high', sperren: true, wer, id: 'd1', buch: true }))).toBe('Defekt gemeldet')
    // Hochstufen durch „MPG verwalten“: eine Entscheidung von Hand
    expect(grund(planeSchwere({ defekt: { id: 'd1', device_id: 'g1', device_name: 'Defi', description: 'x', severity: 'medium' }, schwere: 'high', begruendung: '', geraetDa: true, wer, id: 'e1', buch: true }))).toBe('von Hand gesperrt')
  })
  it('nameKurz: höchstens 60 Zeichen, mit @ → Jemand', () => {
    expect(R.nameKurz('Max Muster')).toBe('Max Muster')
    expect(R.nameKurz('a'.repeat(80)).length).toBeLessThanOrEqual(60)
    expect(R.nameKurz('max@example.invalid')).toBe('Jemand')
    expect(R.nameKurz('max\uFF20example')).toBe('Jemand')
    expect(R.nameKurz('   ')).toBe('Jemand')
  })
  it('Zustands-Tags fest, Ereignis-Tags eindeutig', () => {
    expect(R.istZustandsTag('mitteilung:abc')).toBe(true)
    expect(R.istZustandsTag('mpg_gesperrt:abc')).toBe(true)
    expect(R.istZustandsTag('woche')).toBe(true)
    expect(R.istZustandsTag('probe')).toBe(true)
    for (const t of ['mitteilung:', 'protokoll_neu:x', 'einsendung:x', 'buendel:1', 'lager_unter:1', 'mpg_frist:2026-11-15', 'ausbildung:a:b', 'wochen', 'probex']) expect([t, R.istZustandsTag(t)]).toEqual([t, false])
  })
})

describe('kuerzen, urlSicher, payloadBauen', () => {
  it('kuerzen: Leerraum, Steuerzeichen, Ersatzpaare, Umlaute, Zeilen', () => {
    expect(R.kuerzen('  Größe \t und\u00A0 Gewicht \n ', 100)).toBe('Größe und Gewicht')
    expect(R.kuerzen('a\u0000b\u0007c\u200Bd', 100)).toBe('abcd')
    const emoji = '\u{1F692}'.repeat(10)
    const k = R.kuerzen(emoji, 6)
    expect(k.endsWith('…')).toBe(true)
    expect(k.length).toBeLessThanOrEqual(6)
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(k)).toBe(false)
    expect(R.kuerzen('äöüß'.repeat(10), 9)).toBe('äöüßäöüß…')
    expect(R.kuerzen('eins\n\nzwei\r\ndrei\nvier', 100, { zeilen: 3 })).toBe('eins\nzwei\ndrei')
    expect(R.kuerzen('eins\nzwei', 100)).toBe('eins zwei')
    expect(R.kuerzen('\uD800einsam', 100)).toBe('\uFFFDeinsam')
  })
  it('urlSicher', () => {
    for (const [u, s] of [['https://x', '/hub'], ['//x', '/hub'], ['javascript:alert(1)', '/hub'], ['/hub', '/hub'], ['/vorgaenge?tab=cirs&meldung=a', '/vorgaenge?tab=cirs&meldung=a'], ['/a\\b', '/hub'], ['/a b', '/hub'], ['', '/hub'], ['/', '/'], ['/mpg/geraete/abc', '/mpg/geraete/abc'], ['/x#y', '/hub']]) {
      expect([u, R.urlSicher(u)]).toEqual([u, s])
    }
    expect(R.urlSicher(null)).toBe('/hub')
  })
  it('payloadBauen: 5000 Zeichen Mitteilung höchstens 2000 Bytes, nie Feld f', () => {
    const t = R.textMitteilung({ orgName: 'Wache Eins', titel: '\u{1F692}Ä'.repeat(100), text: 'ä\u{1F692}"\\'.repeat(1250), id: 'mitt00000000001' })
    const p = R.payloadBauen({ ...t, anlass: 'mitteilung', fuer: 'user00000000001', zeitMs: JETZT })
    expect(Buffer.byteLength(JSON.stringify(p), 'utf8')).toBeLessThanOrEqual(2000)
    expect(R.utf8Laenge(JSON.stringify(p))).toBe(Buffer.byteLength(JSON.stringify(p), 'utf8'))
    expect(p.f).toBe(undefined)
    expect(Object.keys(p).sort()).toEqual(['anlass', 'fuer', 'tag', 'text', 'titel', 'url', 'v', 'zeit'])
    expect(p.v).toBe(1)
    expect(p.zeit).toBe(new Date(JETZT).toISOString())
    expect(p.titel.length).toBeLessThanOrEqual(80)
    expect(p.text.length).toBeLessThanOrEqual(300)
  })
  it('utf8Laenge wie Buffer.byteLength', () => {
    for (const s of ['', 'abc', 'Größe', '\u{1F692}', 'a\u{1F692}ä€', 'ࠀ￿']) expect(R.utf8Laenge(s)).toBe(Buffer.byteLength(s, 'utf8'))
  })
})

const P256 = 'B' + 'A'.repeat(86)
const AUTH = 'abcdefghijklmnopqrstuv'
const abo = (endpoint: string, keys: Record<string, string> = { p256dh: P256, auth: AUTH }) => ({ endpoint, keys })

describe('Abos (1.1)', () => {
  const GUT = [
    'https://fcm.googleapis.com/fcm/send/abc:DEF-123_xyz',
    'https://web.push.apple.com/QGuQyavXutnMH7xx8lTSbLnBzMAOv0yRY0sGC3DtxLoD',
    'https://api.push.apple.com/3/device/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk',
    'https://push.services.mozilla.com/wpush/v1/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%2bAbc%3d',
    'https://db5p.notify.windows.com/w/abc',
  ]
  const SCHLECHT = [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://evil.example/fcm/send/abc',
    'https://fcm.googleapis.com.evil.de/fcm/send/abc',
    'https://evil.push.apple.com.de/x',
    'https://push.apple.com/x',
    'https://FCM.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com./fcm/send/abc',
    'https://fcm..googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
    'https://fcm.googleapis.com:443/fcm/send/abc',
    'https://x@fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com/fcm\\send/abc',
    'https://fcm.googleapis.com/fcm/send/abc#x',
    'https://fcm.googleapis.com/fcm/send/a b',
    'https://fcm.googleapis.com/fcm/send/a\tb',
    'https://fcm.googleapis.com/fcm/send/abc?token=x',
    'https://fcm.googleapis.com',
    'https://a..notify.windows.com/w/?token=abc',
    'https://notify.windows.com/w/?token=abc',
    'https://db5p.notify.windows.com/w/?token=a b',
    'https://127.0.0.1:8631/abo/1',
    'https://fcm.googleapis.com/' + 'a'.repeat(1000),
    '',
  ]
  for (const e of GUT) it(`gültig: ${e}`, () => expect(R.aboPruefen(abo(e), []).ok).toBe(true))
  for (const e of SCHLECHT) it(`ungültig: ${JSON.stringify(e.slice(0, 80))}`, () => expect(flach(R.aboPruefen(abo(e), []))).toEqual({ ok: false, feld: 'endpoint' }))
  it('1000 Zeichen gehen, 1001 nicht', () => {
    const basis = 'https://fcm.googleapis.com/'
    expect(R.aboPruefen(abo(basis + 'a'.repeat(1000 - basis.length)), []).ok).toBe(true)
    expect(R.aboPruefen(abo(basis + 'a'.repeat(1001 - basis.length)), []).ok).toBe(false)
  })
  it('Schlüssel: Länge, Zeichen, angehängtes =', () => {
    const e = GUT[0]
    expect(R.aboPruefen(abo(e, { p256dh: P256 + '=', auth: AUTH + '==' }), []).abo.keys).toEqual({ p256dh: P256, auth: AUTH })
    for (const k of [{ p256dh: P256.slice(1), auth: AUTH }, { p256dh: 'A' + P256.slice(1), auth: AUTH }, { p256dh: P256, auth: AUTH + 'x' }, { p256dh: P256, auth: AUTH.slice(1) + '+' }, { p256dh: P256 + '===', auth: AUTH }, {}]) {
      expect(R.aboPruefen(abo(e, k as Record<string, string>), []).feld).toBe('keys')
    }
    expect(R.aboPruefen(null, []).feld).toBe('endpoint')
  })
  it('Test-Host nur mit Liste (die Liste gibt es nur im Prüfbetrieb)', () => {
    expect(R.aboPruefen(abo('https://127.0.0.1:8631/abo/1'), ['127.0.0.1:8631']).ok).toBe(true)
    expect(R.aboPruefen(abo('https://127.0.0.1:8632/abo/1'), ['127.0.0.1:8631']).ok).toBe(false)
    expect(R.aboPruefen(abo('https://127.0.0.1:8631/abo/1'), []).ok).toBe(false)
    expect(R.hostErlaubt('fcm.googleapis.com', [])).toBe(true)
    expect(R.hostErlaubt('push.apple.com', [])).toBe(false)
    expect(R.hostErlaubt('a.push.apple.com', [])).toBe(true)
    expect(R.hostErlaubt('', [])).toBe(false)
  })
  it('geraetBezeichnung', () => {
    expect(R.geraetBezeichnung('iPhone, Homebildschirm')).toBe('iPhone, Homebildschirm')
    expect(R.geraetBezeichnung('Pixel \u{1F4F1} (Chrome)')).toBe('Pixel (Chrome)')
    expect(R.geraetBezeichnung('a\u0000b\u0007c<script>')).toBe('abcscript')
    expect(R.geraetBezeichnung('x'.repeat(200)).length).toBe(80)
    expect(R.geraetBezeichnung(' \t\u00A0 ')).toBe('Gerät')
    expect(R.geraetBezeichnung(null)).toBe('Gerät')
    expect(R.geraetBezeichnung('Größe / Maß.')).toBe('Größe / Maß.')
  })
})

describe('Bündel, Schlüssel, Topic', () => {
  const e = (n: number, url = '/hub') => ({ titel: `Titel ${n}`, text: `Text ${n}`, url, tag: `einsendung:${n}`, anlass: 'einsendung' })
  it('buendeln: 1, 2, 7 Einträge; gleiche und verschiedene URL; Drossel-Titel; Tag mit Zeit', () => {
    expect(flach(R.buendeln([e(1)], 'ruhe', JETZT, 0))).toEqual(e(1))
    const zwei = R.buendeln([e(1, '/lager'), e(2, '/lager')], 'ruhe', JETZT, 0)
    expect(flach(zwei)).toEqual({ titel: 'Aus der Ruhezeit: 2 Benachrichtigungen', text: 'Titel 1\nTitel 2', url: '/lager', tag: `buendel:${JETZT}`, anlass: 'buendel' })
    const sieben = R.buendeln([1, 2, 3, 4, 5, 6, 7].map((n) => e(n, n % 2 ? '/lager' : '/mpg')), 'drossel', JETZT, 0)
    expect(sieben.titel).toBe('7 Benachrichtigungen zusammengefasst')
    expect(sieben.text).toBe('Titel 1\nTitel 2\nTitel 3\nTitel 4\nund 3 weitere')
    expect(sieben.url).toBe('/hub')
    const ueber = R.buendeln([1, 2, 3, 4].map((n) => e(n)), 'ruhe', JETZT, 56)
    expect(ueber.titel).toBe('Aus der Ruhezeit: 60 Benachrichtigungen')
    expect(ueber.text.split('\n').pop()).toBe('und 56 weitere')
    expect(R.buendeln([e(1)], 'ruhe', JETZT, 3).titel).toBe('Aus der Ruhezeit: 4 Benachrichtigungen')
  })
  it('eintragSchluessel, nachrichtSchluessel, buendelSchluessel', () => {
    const a = R.eintragSchluessel(sha256, 'einsendung', 'ein000000000001', 'user00000000001')
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).toBe(R.eintragSchluessel(sha256, 'einsendung', 'ein000000000001', 'user00000000001'))
    expect(a).not.toBe(R.eintragSchluessel(sha256, 'einsendung', 'ein000000000001', 'user00000000002'))
    expect(a).not.toBe(R.eintragSchluessel(sha256, 'cirs_neu', 'ein000000000001', 'user00000000001'))
    expect(R.nachrichtSchluessel(a, 'gera00000000001')).toMatch(/^[a-z0-9:_-]{1,100}$/)
    const b1 = R.buendelSchluessel(sha256, ['b', 'a', 'c'], 'u')
    expect(b1).toBe(R.buendelSchluessel(sha256, ['c', 'b', 'a'], 'u'))
    expect(b1).not.toBe(R.buendelSchluessel(sha256, ['c', 'b'], 'u'))
    expect(b1).toMatch(/^[0-9a-f]{32}$/)
  })
  it('topicBauen: nur Zustände, je Person verschieden, 32 Zeichen', () => {
    const t1 = R.topicBauen(hs256, 'g'.repeat(64), 'user00000000001', 'mitteilung:abc')
    const t2 = R.topicBauen(hs256, 'g'.repeat(64), 'user00000000002', 'mitteilung:abc')
    expect(t1).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(t1).not.toBe(t2)
    expect(t1).toBe(hs256('user00000000001:mitteilung:abc', 'g'.repeat(64)).slice(0, 32))
    for (const t of ['einsendung:x', 'buendel:1', 'protokoll_neu:x', 'lager_unter:1']) expect(R.topicBauen(hs256, 'g', 'u', t)).toBe(null)
  })
})

describe('TTL und Dringlichkeit für alle Nachrichten gleich (1.1)', () => {
  const geheimnis = 'a'.repeat(64)
  const U = {
    os: { getenv: (k: string) => ({ RESPONDA_PUSH_GEHEIMNIS: geheimnis, RESPONDA_PUSH_SCHLUESSEL: P256 } as Record<string, string>)[k] || '' },
    security: { hs256, sha256 },
    jetztMs: JETZT,
  }
  const geraete = [{ id: 'gera00000000001', endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: P256, auth: AUTH }, { id: 'gera00000000002', endpoint: 'https://web.push.apple.com/y', p256dh: P256, auth: AUTH }]
  const inhalte: Record<string, { titel: string; text: string; url: string; tag: string }> = {
    mitteilung: R.textMitteilung({ orgName: 'O', titel: 'T', text: 'X', id: 'mitt00000000001' }),
    unterschrift: R.textUnterschrift({ formular: 'patienten', angelegtMs: AM, id: 'pat000000000001' }),
    protokoll_neu: R.textProtokollNeu({ angelegtMs: AM, id: 'pat000000000001' }),
    mpg_gesperrt: R.textMpgGesperrt({ geraete: [{ id: 'dev000000000001', name: 'D', grund: '' }] }),
    mpg_defekt: R.textMpgDefekt({ quelle: 'meldung', id: 'mel000000000001', deviceName: 'D', schwere: 'low' }),
    lager_mindestbestand: R.textLagerUnter([{ item: 'I', ort: '', ist: 1, soll: 2 }], JETZT),
    lager_abgelaufen: R.textLagerAbgelaufen([{ item: 'I', datum: '2026-11-14' }], '2026-11-15'),
    produktausgabe: R.textProduktausgabe({ id: 'pro000000000001', lagerName: '', positionen: 1, angelegtMs: AM }),
    einsendung: R.textEinsendung({ id: 'ein000000000001', titel: '', angelegtMs: AM }),
    cirs_neu: R.textCirsNeu({ id: 'cir000000000001', kategorie: '' }),
    ausbildung: R.textAusbildung({ terminId: 't', antwortId: 'a', terminName: 'T', startMs: AM, name: 'N', status: 'zugesagt' }),
    woche: R.textWoche({ mpg: { bald: 1, ueberfaellig: 0 } }),
    probe: R.textProbe(),
    buendel: R.buendeln([R.textProbe(), R.textProbe()], 'ruhe', JETZT, 0),
  }
  for (const [anlass, inhalt] of Object.entries(inhalte)) {
    it(anlass, () => {
      const n = V.nachrichtenFuer(U, R, geraete, 'e7c1d0a9b8f2c3d4e5f6a7b8c9d0e1f2', inhalt, anlass, 'user00000000001')
      expect(n.length).toBe(2)
      for (const x of n) {
        expect(x.ttl).toBe(R.TTL_EINHEIT)
        expect(x.urgency).toBe(R.DRINGLICHKEIT_EINHEIT)
        expect(x.schluessel).toMatch(/^[a-z0-9:_-]{1,100}$/)
        expect(x.payload.fuer).toBe('user00000000001')
        expect(Buffer.byteLength(JSON.stringify(x.payload), 'utf8')).toBeLessThanOrEqual(2000)
        if (R.istZustandsTag(inhalt.tag)) expect(x.topic).toMatch(/^[0-9a-f]{32}$/)
        else expect(x.topic).toBe(undefined)
      }
      expect(R.TTL_EINHEIT).toBe(86400)
      expect(R.DRINGLICHKEIT_EINHEIT).toBe('high')
    })
  }
})

describe('lagerDiff', () => {
  const w = (paare: [string, string][]) => ({ low: paare.map(([i, l]) => ({ item_id: i, item: 'I', location_id: l, ort: '', ist: 1, soll: 5 })) })
  it('neu, weiter unter Soll, wieder darüber', () => {
    const d1 = R.lagerDiff([], w([['i1', 'l1'], ['i2', 'l1']]), 'o')
    expect(d1.neu.map((x: P) => x.schluessel)).toEqual(['lager_unter:o:i1:l1', 'lager_unter:o:i2:l1'])
    expect(d1.weg).toEqual([])
    const d2 = R.lagerDiff(['lager_unter:o:i1:l1', 'lager_unter:o:i2:l1'], w([['i1', 'l1'], ['i2', 'l1']]), 'o')
    expect(d2.neu.length + d2.weg.length).toBe(0)
    const d3 = R.lagerDiff(['lager_unter:o:i1:l1', 'lager_unter:o:i2:l1'], w([['i2', 'l1'], ['i3', 'l2']]), 'o')
    expect(d3.neu.map((x: P) => x.schluessel)).toEqual(['lager_unter:o:i3:l2'])
    expect(d3.weg).toEqual(['lager_unter:o:i1:l1'])
  })
})
