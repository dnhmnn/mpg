import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// versand.ts liest pb nur beim Senden; für altSatz genügt eine leere Sitzung
vi.mock('../pocketbase', () => ({ pb: { baseURL: 'https://api.test', authStore: { token: '', isValid: false, record: null, model: null, onChange: () => () => {} } } }))

const {
  ausgabeDaten, ausgabeAlt, ausgabeTitel, ausgefuellt, meldungDaten, meldungAlt, schwere, datumGueltig, ausgabePruefen, meldungPruefen, absenderPruefen,
  EINSATZ_MAX, MENGE_MAX, POSITIONEN_MAX, BESCHREIBUNG_MAX,
} = await import('../../pages/public/formularDaten')
const { altSatz } = await import('../formular/versand')
type Warteeintrag = import('../formular/warteschlange').Warteeintrag

// Die Regeln des Servers (pb_hooks/formular-regeln.js), wie in formularRegeln.test.ts geladen
const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/formular-regeln.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = modul.exports as any

const GEDANKENSTRICHE = /[–—]/
const POS = [
  { qty: 2, name: 'Mullbinde', item_id: 'i1', unit: 'Stk' },
  { qty: 1 },                                      // kein Artikel gewählt
  { qty: 0, name: 'Pflaster', item_id: 'i2', unit: 'Pck' },  // Menge 0
  { qty: '3', name: 'Handschuhe', item_id: 'i3', unit: 'Paar' }, // Menge als Text aus dem Feld
  { qty: '', name: 'Schere', item_id: 'i4', unit: 'Stk' },     // Feld geleert
  { qty: -1, name: 'Tupfer', item_id: 'i5', unit: 'Stk' },
  { qty: Number.NaN, name: 'Kanüle', item_id: 'i6', unit: 'Stk' },
  { qty: 1, name: 'Leer', item_id: '  ', unit: 'Stk' },
]

describe('ausgabeDaten: daten der Produktausgabe für /absenden (1.5)', () => {
  it('nur item_id und qty, leere Positionen raus, Einsatz getrimmt', () => {
    expect(ausgabeDaten('  E-117 ', '2026-10-31', 'l1', POS)).toEqual({
      einsatz: 'E-117', datum: '2026-10-31', lager_id: 'l1',
      positionen: [{ item_id: 'i1', qty: 2 }, { item_id: 'i3', qty: 3 }],
    })
  })
  it('keine Namen, Einheiten oder Absender in daten (die setzt der Server)', () => {
    const d = ausgabeDaten('E-1', '2026-10-31', 'l1', POS)
    expect(Object.keys(d).sort()).toEqual(['datum', 'einsatz', 'lager_id', 'positionen'])
    for (const p of d.positionen) expect(Object.keys(p).sort()).toEqual(['item_id', 'qty'])
  })
  it('ohne Positionen eine leere Liste; kaputte Eingaben werfen nicht', () => {
    expect(ausgabeDaten('E-1', '2026-10-31', '', []).positionen).toEqual([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(ausgabeDaten('E-1', '2026-10-31', 'l1', null as any).positionen).toEqual([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(ausgefuellt([null, undefined, {}] as any)).toEqual([])
  })
})

describe('ausgabeAlt: der Satz für den alten Weg, wie die Maske ihn bisher anlegte', () => {
  const alt = ausgabeAlt(' E-117 ', '2026-10-31', 'l1', POS, { lagerName: 'RTW 1', absender: { id: '', name: ' Anna Berg ' }, orgId: 'org1' })
  it('wie der heutige Satz: Titel, payload mit Name und Einheit, Status offen, Organisation', () => {
    expect(alt).toEqual({
      title: 'Produktausgabe E-117 (31.10.2026)',
      payload: {
        einsatz: 'E-117', datum: '2026-10-31', user_id: '', user_name: 'Anna Berg', lager_id: 'l1', lager_name: 'RTW 1',
        positionen: [
          { qty: 2, name: 'Mullbinde', item_id: 'i1', unit: 'Stk' },
          { qty: 3, name: 'Handschuhe', item_id: 'i3', unit: 'Paar' },
        ],
      },
      status: 'offen',
      organization_id: 'org1',
    })
  })
  it('angemeldet: user_id der angemeldeten Person', () => {
    const a = ausgabeAlt('E-1', '2026-10-31', 'l1', POS, { lagerName: '', absender: { id: 'u1', name: 'Anna Berg' }, orgId: 'org1' })
    expect((a.payload as Record<string, unknown>).user_id).toBe('u1')
  })
  it('altSatz macht daraus den Satz mit Kennung, Organisation und dem Namen der Warteschlange', () => {
    const e: Warteeintrag = {
      v: 2, id: 'abcdefghij01234', formular: 'produktausgabe', orgCode: 'wache1', orgId: 'org1', angelegt: '2026-10-31T12:00:00.000Z',
      absenderName: 'Jörg Müller', angemeldetId: '', versuche: 0,
      daten: ausgabeDaten('E-117', '2026-10-31', 'l1', POS), alt,
    }
    const { sammlung, satz } = altSatz(e)
    expect(sammlung).toBe('product_outputs')
    expect(satz).toEqual({ ...alt, id: 'abcdefghij01234', organization_id: 'org1', payload: { ...(alt.payload as object), user_name: 'Jörg Müller' } })
  })
  it('Titel gleich dem des Servers', () => {
    expect(ausgabeTitel('E-117', '2026-10-31')).toBe(R.ausgabeTitel({ einsatz: 'E-117', datum: '2026-10-31' }))
  })
})

describe('meldungDaten und meldungAlt (Defektmeldung)', () => {
  it('meldungDaten: Beschreibung getrimmt, Schweregrad geprüft, nichts sonst', () => {
    expect(meldungDaten('d1', '  Akku lädt nicht \n', 'high')).toEqual({ device_id: 'd1', description: 'Akku lädt nicht', severity: 'high' })
    expect(meldungDaten('d1', 'x', 'egal').severity).toBe('medium')
    expect(meldungDaten('d1', 'x', '').severity).toBe('medium')
    for (const s of ['low', 'medium', 'high', 'critical']) expect(schwere(s)).toBe(s)
  })
  it('meldungAlt: wie der heutige Satz, ohne reporter_status', () => {
    const alt = meldungAlt('d1', ' Akku ', 'critical', { deviceName: 'Corpuls C3', absender: { id: '', name: ' Anna Berg ' }, orgId: 'org1' })
    expect(alt).toEqual({
      device_id: 'd1', device_name: 'Corpuls C3', organization_id: 'org1', reporter_name: 'Anna Berg', reporter_user_id: '',
      description: 'Akku', severity: 'critical', status: 'pending',
    })
    expect('reporter_status' in alt).toBe(false)
  })
  it('altSatz übernimmt meldungAlt mit Kennung und dem Namen der Warteschlange', () => {
    const alt = meldungAlt('d1', 'Akku', 'high', { deviceName: 'Corpuls C3', absender: { id: 'u1', name: 'Anna Berg' }, orgId: 'org1' })
    const e: Warteeintrag = {
      v: 2, id: 'abcdefghij01234', formular: 'defektmeldung', orgCode: 'wache1', orgId: 'org1', angelegt: '2026-10-31T12:00:00.000Z',
      absenderName: 'Anna Berg', angemeldetId: 'u1', versuche: 0, daten: meldungDaten('d1', 'Akku', 'high'), alt,
    }
    // Ohne Token nie eine Kennung (auch nicht aus einer alten Ablage); angemeldet die eigene
    expect(altSatz(e).satz).toEqual({ ...alt, reporter_user_id: '', id: 'abcdefghij01234', organization_id: 'org1' })
    expect(altSatz(e, { id: 'u1', name: 'Anna Berg' }).satz).toEqual({ ...alt, id: 'abcdefghij01234', organization_id: 'org1' })
  })
})

describe('absenderPruefen: was vor dem Senden zum Absender fehlt (4.2, 4.7)', () => {
  const basis = { angemeldet: false, name: 'Anna Berg', modus: 'passwort' as const, passwort: 'geheim', online: true, alterServer: false }
  it('angemeldet: nichts, auch ohne Name und Passwort', () => {
    expect(absenderPruefen({ ...basis, angemeldet: true, name: '', passwort: '' })).toBe('')
  })
  it('ohne Namen oder mit nur einem Zeichen: „Bitte einen Namen eintragen.“ (Server Fall 11)', () => {
    for (const name of ['', '   ', 'A', ' A ']) {
      expect(absenderPruefen({ ...basis, name })).toBe('Bitte einen Namen eintragen.')
      expect(absenderPruefen({ ...basis, name, modus: 'frei' })).toBe('Bitte einen Namen eintragen.')
    }
    expect(absenderPruefen({ ...basis, name: 'Al', modus: 'frei' })).toBe('')
  })
  it('Passwort-Modus mit Netz: Passwort Pflicht', () => {
    expect(absenderPruefen({ ...basis, passwort: '' })).toBe('Bitte bestätige mit deinem Passwort. Ist keins zur Hand, lässt es sich auf dem Gerät ablegen.')
    expect(absenderPruefen(basis)).toBe('')
  })
  it('ohne Netz oder beim alten Server: ohne Passwort (die Warteschlange fragt später, der alte Server prüft nicht)', () => {
    expect(absenderPruefen({ ...basis, passwort: '', online: false })).toBe('')
    expect(absenderPruefen({ ...basis, passwort: '', alterServer: true })).toBe('')
  })
  it('Modus frei: nie ein Passwort', () => {
    expect(absenderPruefen({ ...basis, modus: 'frei', passwort: '' })).toBe('')
  })
  it('Texte ohne Gedankenstriche', () => {
    expect(absenderPruefen({ ...basis, name: '' })).not.toMatch(GEDANKENSTRICHE)
    expect(absenderPruefen({ ...basis, passwort: '' })).not.toMatch(GEDANKENSTRICHE)
  })
})

describe('Vorprüfung in der Maske passt zum Server (datenPruefen)', () => {
  const orgId = 'org1'
  const bestand = {
    orte: { l1: { organization_id: orgId, archiviert: false, name: 'RTW 1' } },
    artikel: Object.fromEntries(['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].map((id) => [id, { organization_id: orgId, archiviert: false, name: id, unit: 'Stk' }])),
    geraete: { d1: { organization_id: orgId, ausser_betrieb: '', name: 'Corpuls C3' } },
  }
  const viele = (n: number, qty = 1) => Array.from({ length: n }, () => ({ item_id: 'i1', qty }))
  const AUSGABEN: [string, string, string, unknown[]][] = [
    ['E-117', '2026-10-31', 'l1', POS],
    ['', '2026-10-31', 'l1', POS],
    ['   ', '2026-10-31', 'l1', POS],
    ['x'.repeat(EINSATZ_MAX), '2026-10-31', 'l1', POS],
    ['x'.repeat(EINSATZ_MAX + 1), '2026-10-31', 'l1', POS],
    ['E-1', '2026-02-30', 'l1', POS],
    ['E-1', '2026-2-3', 'l1', POS],
    ['E-1', '', 'l1', POS],
    ['E-1', '2024-02-29', 'l1', POS],
    ['E-1', '2026-10-31', 'l1', []],
    ['E-1', '2026-10-31', 'l1', [{ qty: 0, item_id: 'i1' }]],
    ['E-1', '2026-10-31', 'l1', viele(POSITIONEN_MAX)],
    ['E-1', '2026-10-31', 'l1', viele(POSITIONEN_MAX + 1)],
    ['E-1', '2026-10-31', 'l1', [{ item_id: 'i1', qty: MENGE_MAX }]],
    ['E-1', '2026-10-31', 'l1', [{ item_id: 'i1', qty: MENGE_MAX + 1 }]],
    ['E-1', '2026-10-31', 'l1', [{ item_id: 'i1', qty: 0.5 }]],
  ]
  it.each(AUSGABEN.map((a, i) => [i, ...a] as const))('Produktausgabe %i: Maske und Server sind sich einig', (_i, einsatz, datum, lager, pos) => {
    const d = ausgabeDaten(einsatz, datum, lager, pos as never)
    const server = R.datenPruefen('produktausgabe', d, bestand, { orgId })
    expect(ausgabePruefen(d) === '').toBe(server.ok === true)
    // Lehnt die Maske ab, dann mit dem Text des Servers, wo es einen genauen gibt
    if (!server.ok && ['einsatz', 'datum'].includes(server.feld)) expect(ausgabePruefen(d)).toBe(server.text)
  })
  it('Produktausgabe ohne Verbrauchsort: Maske lehnt ab', () => {
    expect(ausgabePruefen(ausgabeDaten('E-1', '2026-10-31', '', POS))).toBe('Bitte einen Verbrauchsort auswählen.')
  })
  const MELDUNGEN: [string, string][] = [
    ['d1', 'Akku'], ['d1', ''], ['d1', ' \n '], ['d1', 'x'.repeat(BESCHREIBUNG_MAX)], ['d1', 'x'.repeat(BESCHREIBUNG_MAX + 1)],
    ['d1', ` ${'x'.repeat(BESCHREIBUNG_MAX)} `],
  ]
  it.each(MELDUNGEN.map((m, i) => [i, ...m] as const))('Defektmeldung %i: Maske und Server sind sich einig', (_i, geraet, text) => {
    const d = meldungDaten(geraet, text, 'high')
    const server = R.datenPruefen('defektmeldung', d, bestand, { orgId })
    expect(meldungPruefen(d) === '').toBe(server.ok === true)
    if (!server.ok && server.feld === 'description' && d.description === '') expect(meldungPruefen(d)).toBe(server.text)
  })
  it('Defektmeldung ohne Gerät: Maske lehnt ab', () => {
    expect(meldungPruefen(meldungDaten('', 'Akku', 'low'))).toBe('Bitte ein Gerät auswählen.')
  })
  it('datumGueltig wie der Server', () => {
    for (const d of ['2026-10-31', '2026-02-29', '2024-02-29', '2026-13-01', '2026-00-10', '2026-04-31', 'x', '', '20261031', '2026-10-31T00:00']) {
      const server = R.datenPruefen('produktausgabe', { einsatz: 'E', datum: d, lager_id: 'l1', positionen: [{ item_id: 'i1', qty: 1 }] }, bestand, { orgId })
      expect(datumGueltig(d)).toBe(server.ok === true || server.feld !== 'datum')
    }
  })
  it('Texte ohne Gedankenstriche', () => {
    const texte = [
      ausgabePruefen(ausgabeDaten('', '', '', [])), ausgabePruefen(ausgabeDaten('E', 'x', '', [])), ausgabePruefen(ausgabeDaten('E', '2026-10-31', '', [])),
      ausgabePruefen(ausgabeDaten('E', '2026-10-31', '', viele(POSITIONEN_MAX + 1))), ausgabePruefen(ausgabeDaten('E', '2026-10-31', '', [{ item_id: 'i1', qty: MENGE_MAX + 1 }])),
      ausgabePruefen(ausgabeDaten('E', '2026-10-31', '', POS)), meldungPruefen(meldungDaten('', 'x', 'low')), meldungPruefen(meldungDaten('d1', '', 'low')),
      meldungPruefen(meldungDaten('d1', 'x'.repeat(BESCHREIBUNG_MAX + 1), 'low')),
    ]
    for (const t of texte) {
      expect(t).not.toBe('')
      expect(t).not.toMatch(GEDANKENSTRICHE)
    }
  })
})
