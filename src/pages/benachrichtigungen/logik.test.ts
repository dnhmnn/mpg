// Prüffälle der Seite „Benachrichtigungen“ (Bauplan Push 6.6; Owner 12.3): Zustand des Geräts,
// Gruppen, Schalter gesperrt/aus, Ruhezeit-Zeile, Mitteilung (Prüfung und Vorschau im Gleichlauf
// mit pb_hooks/push-regeln.js).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import type { OrgAnlass, StandAnlass } from '../../lib/push/api'
import { ANLAESSE } from '../../lib/push/regeln'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import {
  anlassSchalter, ausUmschalten, darfMitteilung, datumText, geraetZustand, gruppieren, kuerzen, mitteilungPruefen, nurHinweis,
  orgAnlassSchalter, ruheJetztText, vorschauMitteilung, zeichenZahl, zeitpunktText, zustandText,
} from './logik'

function regeln() {
  const modul = { exports: {} as Record<string, unknown> }
  runInNewContext(readFileSync(new URL('../../../pb_hooks/push-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modul.exports as any
}
const R = regeln()

const sa = (x: Partial<StandAnlass>): StandAnlass => ({ key: 'mpg_gesperrt', gruppe: 'mpg', titel: 'Gerät gesperrt', beschreibung: 'Ein Medizinprodukt wurde gesperrt.', art: 'sofort', pflicht: false, org_an: true, person_an: true, ...x })
const oa = (x: Partial<OrgAnlass>): OrgAnlass => ({ key: 'mpg_gesperrt', gruppe: 'mpg', titel: 'Gerät gesperrt', beschreibung: 'Ein Medizinprodukt wurde gesperrt.', art: 'sofort', pflicht: false, modul_frei: true, ...x })

describe('geraetZustand', () => {
  const l = (x: Partial<Parameters<typeof geraetZustand>[0]> = {}) => geraetZustand({ eingerichtet: true, unterstuetzung: 'ok', erlaubnis: 'default', aboKennung: null, kennungen: [], merker: null, personId: 'p1', ...x })

  it('Reihenfolge: lädt, Server, Gerät, Erlaubnis, an, Hinweise, aus', () => {
    expect(l({ eingerichtet: null })).toBe('laedt')
    expect(l({ eingerichtet: false, unterstuetzung: 'ios_homebildschirm' })).toBe('nicht_eingerichtet')
    expect(l({ unterstuetzung: 'ios_homebildschirm' })).toBe('ios_homebildschirm')
    expect(l({ unterstuetzung: 'browser', erlaubnis: 'denied' })).toBe('browser')
    expect(l({ erlaubnis: 'denied', aboKennung: 'k', kennungen: ['k'] })).toBe('abgelehnt')
    expect(l({ erlaubnis: 'granted', aboKennung: 'k', kennungen: ['x', 'k'] })).toBe('an')
    // Abo da, aber der Server kennt es nicht: aus (Einschalten meldet es an)
    expect(l({ erlaubnis: 'granted', aboKennung: 'k', kennungen: ['x'] })).toBe('aus')
    expect(l({ merker: { neu_einschalten: true, person: 'p1' } })).toBe('neu_einschalten')
    expect(l({ merker: { neu_einschalten: true, person: 'p2' } })).toBe('aus')
    expect(l({ merker: { abgemeldet: true } })).toBe('abgemeldet')
    expect(l()).toBe('aus')
  })

  it('Hinweistexte statt Schalter', () => {
    expect(zustandText('ios_homebildschirm')).toBe(T.ios_homebildschirm)
    expect(zustandText('nicht_eingerichtet')).toBe(T.nicht_eingerichtet)
    expect(zustandText('abgelehnt')).toBe(T.abgelehnt)
    expect(zustandText('capacitor')).toBe(T.capacitor)
    expect(zustandText('an')).toBeNull()
    expect(nurHinweis('unsicher')).toBe(true)
    expect(nurHinweis('aus')).toBe(false)
    expect(nurHinweis('abgemeldet')).toBe(false)
  })
})

describe('Anlässe', () => {
  it('gruppieren in der Reihenfolge der Gruppen, leere fallen weg', () => {
    const g = gruppieren([sa({ key: 'cirs_neu', gruppe: 'vorgaenge' }), sa({ key: 'mitteilung', gruppe: 'organisation' }), sa({}), sa({ key: 'mpg_defekt' })])
    expect(g.map((x) => x.key)).toEqual(['organisation', 'mpg', 'vorgaenge'])
    expect(g[1].anlaesse.map((a) => a.key)).toEqual(['mpg_gesperrt', 'mpg_defekt'])
    expect(g[2].titel).toBe('Vorgänge und CIRS')
  })

  it('Schalter: Pflicht an und gesperrt, von der Organisation aus, Wochenüberblick', () => {
    expect(anlassSchalter(sa({ key: 'mitteilung', pflicht: true, person_an: false }))).toMatchObject({ an: true, gesperrt: true })
    expect(anlassSchalter(sa({ key: 'mitteilung', pflicht: true })).unter).toContain(T.pflichtUnter)
    expect(anlassSchalter(sa({ org_an: false, person_an: true }))).toEqual({ an: false, gesperrt: true, unter: T.orgAusUnter })
    expect(anlassSchalter(sa({ person_an: false }))).toMatchObject({ an: false, gesperrt: false })
    expect(anlassSchalter(sa({ art: 'woche', beschreibung: 'Zahl.' })).unter).toBe('Zahl. Montags im Wochenüberblick.')
    expect(anlassSchalter(sa({ art: 'morgens', beschreibung: 'Morgens gesammelt.' })).unter).toBe('Morgens gesammelt. Morgens ab 6 Uhr.')
  })

  it('Organisation: Modul nicht frei gesperrt, Pflicht an', () => {
    expect(orgAnlassSchalter(oa({ modul_frei: false }), [])).toEqual({ an: false, gesperrt: true, unter: T.modulGesperrt })
    expect(orgAnlassSchalter(oa({}), ['mpg_gesperrt'])).toMatchObject({ an: false, gesperrt: false })
    expect(orgAnlassSchalter(oa({}), [])).toMatchObject({ an: true, gesperrt: false })
    expect(orgAnlassSchalter(oa({ key: 'mitteilung', pflicht: true }), ['mitteilung' as never])).toMatchObject({ an: true, gesperrt: true })
  })

  it('ausUmschalten: ohne Doppelte, nie Pflicht, Katalog-Reihenfolge', () => {
    expect(ausUmschalten([], 'cirs_neu', false)).toEqual(['cirs_neu'])
    expect(ausUmschalten(['cirs_neu'], 'mpg_gesperrt', false)).toEqual(['mpg_gesperrt', 'cirs_neu'])
    expect(ausUmschalten(['cirs_neu', 'mpg_gesperrt'], 'cirs_neu', true)).toEqual(['mpg_gesperrt'])
    expect(ausUmschalten(['cirs_neu'], 'cirs_neu', false)).toEqual(['cirs_neu'])
    expect(ausUmschalten([], 'mitteilung', false)).toEqual([])
    const alle = ANLAESSE.filter((a) => !a.pflicht).map((a) => a.key)
    expect([...alle].reverse().reduce((aus, k) => ausUmschalten(aus, k, false), [] as typeof alle)).toEqual(alle)
  })
})

describe('Zeit', () => {
  it('Gerade Ruhezeit bis …', () => {
    const r = { an: true, von: '22:00', bis: '06:00' }
    // 23:30 deutsche Zeit im Winter
    expect(ruheJetztText(r, Date.parse('2026-11-16T22:30:00.000Z'))).toBe('Gerade Ruhezeit bis 06:00')
    expect(ruheJetztText(r, Date.parse('2026-11-16T12:00:00.000Z'))).toBeNull()
    expect(ruheJetztText({ ...r, an: false }, Date.parse('2026-11-16T22:30:00.000Z'))).toBeNull()
    // Sommer: 05:59 deutsche Zeit = 03:59 UTC
    expect(ruheJetztText(r, Date.parse('2026-07-01T03:59:00.000Z'))).toBe('Gerade Ruhezeit bis 06:00')
    expect(ruheJetztText(r, Date.parse('2026-07-01T04:00:00.000Z'))).toBeNull()
  })

  it('Datum der Geräte und Mitteilungen nach deutscher Zeit', () => {
    expect(datumText('2026-11-15 10:00:00.000Z')).toBe('15.11.2026')
    expect(datumText('2026-12-31 23:30:00.000Z')).toBe('01.01.2027')
    expect(datumText('')).toBe('')
    expect(datumText('kaputt')).toBe('')
    expect(zeitpunktText('2026-07-01 12:05:00.000Z')).toBe('01.07.2026, 14:05')
  })
})

describe('Mitteilung an die Organisation (Owner 12.3)', () => {
  it('Prüfung wie der Server: Titel Pflicht, 120 und 1000 Zeichen, kein HTML', () => {
    expect(mitteilungPruefen('', 'x')).toMatchObject({ ok: false, feld: 'title', text: T.mitteilungTitelLeer })
    expect(mitteilungPruefen(' \u00A0\n', 'x')).toMatchObject({ ok: false, feld: 'title' })
    expect(mitteilungPruefen('a'.repeat(120), 'b'.repeat(1000)).ok).toBe(true)
    expect(mitteilungPruefen('a'.repeat(121), '')).toMatchObject({ ok: false, feld: 'title', text: T.mitteilungTitelLang })
    expect(mitteilungPruefen('a', 'b'.repeat(1001))).toMatchObject({ ok: false, feld: 'message', text: T.mitteilungTextLang })
    // Emojis zählen als ein Zeichen (wie PocketBase)
    expect(mitteilungPruefen('😀'.repeat(120), '').ok).toBe(true)
    expect(zeichenZahl('😀a')).toBe(2)
    expect(mitteilungPruefen('<b>x</b>', '')).toMatchObject({ ok: false, feld: 'title', text: T.mitteilungHtml })
    expect(mitteilungPruefen('x', 'a &amp; b')).toMatchObject({ ok: false, feld: 'message' })
    expect(mitteilungPruefen('x', 'a < b und c > d')).toMatchObject({ ok: true })
  })

  it('Prüfung im Gleichlauf mit push-regeln.js', () => {
    const faelle: [string, string][] = [['', ''], ['T', ''], [' ', 'x'], ['a'.repeat(121), ''], ['😀'.repeat(121), ''], ['x', 'y'.repeat(1001)],
      ['<p>', ''], ['x', '&#38;'], ['x', '<'], ['Halle', 'Bitte\numparken.'], ['\u2003', 'x'], ['a\u0000b', 'c']]
    for (const [t, m] of faelle) {
      const a = mitteilungPruefen(t, m)
      const b = R.mitteilungPruefen(t, m)
      expect(a.ok).toBe(b.ok)
      if (!a.ok) { expect(a.feld).toBe(b.feld); expect(a.text).toBe(b.text) }
    }
  })

  it('Vorschau auf dem Sperrbildschirm wie textMitteilung auf dem Server', () => {
    const eingaben = [
      { orgName: 'Wache Eins', titel: 'Fahrzeughalle gesperrt', text: 'Am Samstag wird der Boden versiegelt. Bitte Fahrzeuge bis Freitag 18 Uhr umsetzen.' },
      { orgName: 'Freiwillige Feuerwehr Musterstadt Ortsteil Nord', titel: 'Ü'.repeat(100), text: 'x'.repeat(400) },
      { orgName: '', titel: '', text: '' },
      { orgName: 'Org', titel: '  viel   Leerraum\t ', text: 'Zeile 1\n\n  Zeile 2  \nZeile 3\nZeile 4\nZeile 5\nZeile 6' },
      { orgName: 'Org', titel: 'A'.repeat(70) + '😀😀😀😀😀', text: '😀'.repeat(200) },
      { orgName: 'Org\u200B', titel: 'Steuer\u0007zeichen', text: 'Text\r\nmit CRLF' },
    ]
    for (const e of eingaben) {
      const v = vorschauMitteilung(e)
      const s = R.textMitteilung({ orgName: e.orgName, titel: e.titel, text: e.text, id: 'abcdefghijk1234' })
      expect(v).toEqual({ titel: s.titel, text: s.text })
    }
    expect(vorschauMitteilung({ orgName: 'Wache Eins', titel: 'Fahrzeughalle gesperrt', text: 'Bitte umsetzen.' })).toEqual({ titel: 'Wache Eins: Fahrzeughalle gesperrt', text: 'Bitte umsetzen.' })
  })

  it('kuerzen wie push-regeln.js', () => {
    const texte = ['', 'kurz', 'a'.repeat(100), 'x😀'.repeat(60), 'Ä Ö\tÜ\n\nß', '\uD800 einzeln', 'Zeile\nZeile\nZeile']
    for (const t of texte) for (const max of [1, 5, 30, 80, 300]) for (const zeilen of [1, 5]) {
      expect(kuerzen(t, max, { zeilen })).toBe(R.kuerzen(t, max, { zeilen }))
    }
  })

  it('darfMitteilung: Leitung (admin) und Supervisor, aktives Konto mit Organisation', () => {
    expect(darfMitteilung({ role: 'admin', organization_id: 'o' })).toBe(true)
    expect(darfMitteilung({ role: 'benutzer', supervisor: true, organization_id: 'o' })).toBe(true)
    expect(darfMitteilung({ role: 'benutzer', organization_id: 'o' })).toBe(false)
    expect(darfMitteilung({ role: 'teilnehmer', organization_id: 'o' })).toBe(false)
    expect(darfMitteilung({ role: 'admin' })).toBe(false)
    expect(darfMitteilung({ role: 'admin', organization_id: 'o', disabled: true })).toBe(false)
    expect(darfMitteilung(null)).toBe(false)
  })

  it('Texte der Oberfläche ohne Gedankenstriche und Emojis', () => {
    for (const t of Object.values(T)) {
      expect(t).not.toMatch(/[–—]/)
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})
