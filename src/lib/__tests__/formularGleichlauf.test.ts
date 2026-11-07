import { beforeAll, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import {
  FORMULARE, FRIST_MS, absenderModus, darfFormulareEinstellen, darfOhneUnterschrift, kannAngemeldetSenden, minutenText, wartetAufUnterschrift,
} from '../formular/absender'
import { HOOK_TEXTE, TEXTE, type Grund } from '../formular/api'
import type { User } from '../../types'

// Die App spiegelt Regeln des Servers (pb_hooks/formular-regeln.js, Teil A) für
// die Anzeige. Hier läuft derselbe Code wie dort, in einem eigenen Kontext mit
// module.exports (wie willkommen.test.ts), und beide müssen gleich rechnen.
type Regeln = {
  FRIST_MS: number
  absenderModus: (cfg: unknown, formular: string) => string
  darfOhneUnterschrift: (u: unknown, orgId: string, jetzt: number) => boolean
  darfFormulareEinstellen: (u: unknown, jetzt: number) => boolean
  istVerknuepfbar?: (u: unknown, orgId: string, jetzt: number) => boolean
  wartetAufUnterschrift?: (payload: unknown) => boolean
  minutenText?: (sekunden: number) => string
  TEXTE?: Record<string, unknown>
  HOOK_TEXTE?: Record<string, unknown> | unknown[]
  DATEN_TEXTE?: Record<string, unknown>
}

const DATEI = new URL('../../../pb_hooks/formular-regeln.js', import.meta.url)
let R: Regeln
let quellen = ''

beforeAll(() => {
  if (!existsSync(DATEI)) throw new Error('pb_hooks/formular-regeln.js fehlt noch (Teil A liefert die Datei); dieser Gleichlauf ist erst danach grün.')
  const modul = { exports: {} as unknown }
  const text = readFileSync(DATEI, 'utf8')
  runInNewContext(text, { module: modul, exports: modul.exports })
  R = modul.exports as Regeln
  quellen = ['formular-regeln.js', 'formular.pb.js', 'mitglieder-namen.pb.js']
    .map((f) => new URL(`../../../pb_hooks/${f}`, import.meta.url))
    .filter((u) => existsSync(u))
    .map((u) => readFileSync(u, 'utf8'))
    .join('\n')
})

const JETZT = Date.parse('2026-10-31T12:00:00.000Z')
const bis = (ms: number) => new Date(JETZT + ms).toISOString().replace('T', ' ')

describe('Gleichlauf App und Server: Modus des Absenders', () => {
  const werte: unknown[] = ['passwort', 'frei', 'Passwort', 'anonym', '', null, 1, true, {}, []]
  const cfgs: unknown[] = [undefined, null, '', '{kaputt', 7, [], {}, { absender: null }, { absender: 'passwort' }, { absender: [] }, { hidden_forms: ['patienten'] }]
  for (const f of FORMULARE) {
    for (const w of werte) {
      cfgs.push({ absender: { [f]: w } })
      cfgs.push(JSON.stringify({ absender: { [f]: w }, hidden_forms: [] }))
      cfgs.push(JSON.stringify(JSON.stringify({ absender: { [f]: w } })))
    }
  }
  cfgs.push({ absender: { patienten: 'frei', produktausgabe: 'passwort', defektmeldung: 'passwort' } })

  it('für alle Eingaben und jedes Formular gleich', () => {
    for (const cfg of cfgs) {
      for (const f of FORMULARE) {
        expect([JSON.stringify(cfg), f, absenderModus(cfg, f)]).toEqual([JSON.stringify(cfg), f, R.absenderModus(cfg, f)])
      }
    }
  })

  it('FRIST_MS gleich', () => {
    expect(FRIST_MS).toBe(R.FRIST_MS)
  })
})

describe('Gleichlauf App und Server: Rechte', () => {
  const u = (x: Partial<User>): User => ({ id: 'u1', email: 'u1@example.com', name: 'Anna Berg', role: 'benutzer', organization_id: 'o1', permissions: {}, ...x })
  const tabelle: [string, User][] = [
    ['Leitung', u({ role: 'admin' })],
    ['patienten dauerhaft', u({ permissions: { patienten: true } })],
    ['patienten befristet gültig', u({ temp_permissions: { patienten: { until: bis(60_000) } } })],
    ['patienten befristet ISO', u({ temp_permissions: { patienten: { until: new Date(JETZT + 60_000).toISOString() } } })],
    ['patienten befristet abgelaufen', u({ temp_permissions: { patienten: { until: bis(-60_000) } } })],
    ['ohne Recht', u({})],
    ['unitarii', u({ permissions: { unitarii: true } })],
    ['dokumente befristet', u({ temp_permissions: { dokumente: { until: bis(60_000) } } })],
    ['dokumente abgelaufen', u({ temp_permissions: { dokumente: { until: bis(-60_000) } } })],
    ['Supervisor', u({ supervisor: true })],
    ['Supervisor ohne Org', u({ supervisor: true, organization_id: '' })],
    ['Teilnehmer mit patienten', u({ role: 'teilnehmer', permissions: { patienten: true } })],
    ['Teilnehmer mit unitarii', u({ role: 'teilnehmer', permissions: { unitarii: true } })],
    ['Leitung gesperrt', u({ role: 'admin', disabled: true })],
    ['Leitung abgelaufen', u({ role: 'admin', expires_at: bis(-1000) })],
    ['Leitung, Ablauf später', u({ role: 'admin', expires_at: bis(3600_000) })],
    ['Leitung anderer Org', u({ role: 'admin', organization_id: 'o2' })],
    ['patienten anderer Org', u({ organization_id: 'o2', permissions: { patienten: true } })],
  ]

  for (const [name, user] of tabelle) {
    it(name, () => {
      // Organisation mit allen Modulen: die App prüft zusätzlich das Modul, der Server in der Route
      expect(darfOhneUnterschrift(user, { id: 'o1' }, JETZT)).toBe(R.darfOhneUnterschrift(user, 'o1', JETZT))
      expect(darfFormulareEinstellen(user, JETZT)).toBe(R.darfFormulareEinstellen(user, JETZT))
      if (R.istVerknuepfbar && user.organization_id) {
        expect(kannAngemeldetSenden(user, JETZT)).toBe(R.istVerknuepfbar(user, user.organization_id, JETZT))
      }
    })
  }
})

describe('Gleichlauf App und Server: Lesen und Texte', () => {
  it('wartetAufUnterschrift gleich (Objekt, Text, doppelt kodiert, kaputt)', () => {
    if (!R.wartetAufUnterschrift) return
    const aus = { absender: { status: 'ausstehend', id: 'u1' } }
    for (const p of [aus, JSON.stringify(aus), JSON.stringify(JSON.stringify(aus)), '{kaputt', null, {}, { absender: { status: 'bestaetigt' } }]) {
      expect(wartetAufUnterschrift(p)).toBe(R.wartetAufUnterschrift(p))
    }
  })

  it('minutenText gleich', () => {
    if (!R.minutenText) return
    for (const s of [1, 59, 60, 61, 119, 120, 900, 3600]) expect(minutenText(s)).toBe(R.minutenText(s))
  })

  it('Rückfalltexte der App gleich den Texten des Servers', () => {
    const fest: Grund[] = ['organisation', 'formular_aus', 'kennung', 'aenderung_alt', 'name', 'name_unbekannt', 'passwort_noetig', 'nicht_angemeldet', 'nicht_berechtigt', 'nicht_gefunden', 'fremd', 'schon_bestaetigt', 'server']
    for (const g of fest) {
      const t = R.TEXTE?.[g]
      if (typeof t === 'string') expect([g, TEXTE[g]]).toEqual([g, t])
    }
  })

  it('jeder Hook-Text, den die App zeigt, steht so in den Hooks', () => {
    for (const t of HOOK_TEXTE) expect(quellen.includes(t) ? t : `fehlt: ${t}`).toBe(t)
  })

  it('umgekehrt: jeden Text der Hooks bei direkten Aufrufen kennt die App (sonst zeigte sie nur den Rückfall)', () => {
    const werte = (x: unknown) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []).filter((t): t is string => typeof t === 'string')
    const server = [...werte(R.HOOK_TEXTE), ...werte(R.DATEN_TEXTE)]
    expect(server.length).toBeGreaterThan(0)
    for (const t of server) expect(HOOK_TEXTE.includes(t) ? t : `unbekannt: ${t}`).toBe(t)
  })
})
