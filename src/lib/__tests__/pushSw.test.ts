// Prüffälle des Service-Worker-Teils für Push (public/sw-push.js, Bauplan Push 6.4 und 6.6;
// Owner 12.4).
//
// Der Service Worker ist reines JavaScript; hier läuft dieselbe Datei in einem eigenen Kontext mit
// einem falschen `self` (wie hintergrund.test.ts). Geprüft wird vor allem: Jede Push-Nachricht zeigt
// eine Benachrichtigung (auch bei Fehlern und wenn IndexedDB hängt), Einzelheiten nur für die
// gemerkte Person mit gültiger Anmeldung, nur Pfade der App, Abzeichen aus der Zahl der
// angezeigten Benachrichtigungen, und dass vite.config.ts die Datei lädt (Rücknahme-Schutz).
//
// Nicht hier prüfbar (Browserprobe): IndexedDB, echte Push-Zustellung, clients.openWindow im Browser.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createECDH } from 'node:crypto'
import { urlSicher as urlSicherApp } from '../push/geraet'

type Merker = Record<string, unknown> | null
interface Sw {
  NEUTRAL: { titel: string; text: string; url: string; tag: string }
  MERKER_ZEIT_MS: number
  payloadLesen: (t: string) => Record<string, unknown> | null
  urlSicher: (u: unknown) => string
  anzeige: (p: unknown, m: unknown, jetzt?: number) => { titel: string; optionen: Record<string, unknown> }
  oeffnen: (url: string) => Promise<unknown>
  merkerLesen: () => Promise<Merker>
  merkerSchreiben: (m: unknown) => Promise<unknown>
}
interface Fenster { url: string; visibilityState?: string; focus: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> }

const CODE = readFileSync(new URL('../../../public/sw-push.js', import.meta.url), 'utf8')

function laden(o: { merker?: Merker | (() => Promise<Merker>); wirft?: number; abzeichen?: boolean; fenster?: Fenster[] } = {}) {
  const handler: Record<string, (ev: unknown) => void> = {}
  const gezeigt: { titel: string; optionen: Record<string, unknown> }[] = []
  let wirft = o.wirft ?? 0
  const registration = {
    showNotification: vi.fn(async (titel: string, optionen: Record<string, unknown>) => {
      if (wirft > 0) { wirft--; throw new Error('kaputt') }
      gezeigt.push({ titel, optionen })
    }),
    getNotifications: vi.fn(async () => gezeigt.map(() => ({}))),
    pushManager: { subscribe: vi.fn(async (_o: unknown) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/neu' })) },
  }
  const nav = o.abzeichen ? { setAppBadge: vi.fn(async (_n?: number) => {}), clearAppBadge: vi.fn(async () => {}) } : {}
  const clients = { matchAll: vi.fn(async (_o: unknown) => o.fenster ?? []), openWindow: vi.fn(async (_u: string) => null) }
  const self: Record<string, unknown> = {
    addEventListener: (t: string, f: (ev: unknown) => void) => { handler[t] = f },
    registration, clients, navigator: nav,
    location: { origin: 'https://app.responda.systems' },
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
  }
  // setTimeout zur Laufzeit nachschlagen, damit die falsche Uhr von vitest greift
  runInNewContext(CODE, { self, setTimeout: (f: () => void, ms: number) => setTimeout(f, ms) })
  const R = self.RespondaPush as Sw
  const m = o.merker
  R.merkerLesen = typeof m === 'function' ? m : async () => (m === undefined ? null : m)
  return { R, handler, gezeigt, registration, clients, nav }
}

type Geladen = ReturnType<typeof laden>

/** Push-Ereignis zustellen; wartet auf waitUntil. */
async function push(sw: Geladen, daten: unknown, o: { waitUntilWirft?: boolean } = {}) {
  let warten: Promise<unknown> | undefined
  const ev = {
    data: daten === undefined ? null : { text: () => (typeof daten === 'string' ? daten : JSON.stringify(daten)) },
    waitUntil: (p: Promise<unknown>) => { if (o.waitUntilWirft) throw new Error('waitUntil'); warten = p },
  }
  sw.handler.push(ev)
  return warten
}

const PERSON = 'personabc123456'
const jetzt = () => Date.now()
const gueltig = (x: Partial<Record<string, unknown>> = {}) => ({ person: PERSON, endpoint: 'https://fcm.googleapis.com/fcm/send/a', schluessel: 'B', ablauf: jetzt() + 3600_000, ...x })
const payload = (x: Partial<Record<string, unknown>> = {}) => ({
  v: 1, titel: 'MPG: Defibrillator 2 gesperrt', text: 'Grund: STK nicht bestanden.', url: '/mpg/geraete/abc',
  tag: 'mpg_gesperrt:abc', anlass: 'mpg_gesperrt', fuer: PERSON, zeit: '2026-11-15T06:00:00.000Z', ...x,
})

afterEach(() => { vi.useRealTimers() })

describe('sw-push: anzeigen', () => {
  it('gültige Payload und gemerkte Person mit gültiger Anmeldung: Einzelheiten', async () => {
    const sw = laden({ merker: gueltig() })
    await push(sw, payload())
    expect(sw.gezeigt).toHaveLength(1)
    const g = sw.gezeigt[0]
    expect(g.titel).toBe('MPG: Defibrillator 2 gesperrt')
    expect(g.optionen).toMatchObject({ body: 'Grund: STK nicht bestanden.', tag: 'mpg_gesperrt:abc', renotify: true, data: { url: '/mpg/geraete/abc' }, lang: 'de' })
    expect(g.optionen.icon).toBe('/push-symbol-192.png')
    expect(g.optionen.badge).toBe('/push-abzeichen-96.png')
    expect(g.optionen.timestamp).toBe(Date.parse('2026-11-15T06:00:00.000Z'))
  })

  it('neutral, aber angezeigt: andere Person, kein Merker, kaputtes JSON, v 2, kein data', async () => {
    for (const [merker, daten] of [
      [gueltig({ person: 'anderepersonxyz' }), payload()],
      [null, payload()],
      [gueltig(), '{kaputt'],
      [gueltig(), payload({ v: 2 })],
      [gueltig(), undefined],
      [gueltig(), payload({ fuer: '' })],
      [{ abgemeldet: true }, payload()],
    ] as [Merker, unknown][]) {
      const sw = laden({ merker })
      await push(sw, daten)
      expect(sw.gezeigt).toHaveLength(1)
      expect(sw.gezeigt[0].titel).toBe('Responda')
      expect(sw.gezeigt[0].optionen).toMatchObject({ body: 'Es gibt Neues in Responda.', tag: 'responda', renotify: true, data: { url: '/hub' } })
    }
  })

  it('Owner 12.4: abgelaufene Anmeldung (ablauf vorbei oder fehlt) zeigt nur den neutralen Text', async () => {
    for (const merker of [gueltig({ ablauf: jetzt() - 1000 }), gueltig({ ablauf: undefined }), gueltig({ ablauf: null }), gueltig({ ablauf: 'morgen' })]) {
      const sw = laden({ merker })
      await push(sw, payload())
      expect(sw.gezeigt[0].titel).toBe('Responda')
      expect(sw.gezeigt[0].optionen.body).toBe('Es gibt Neues in Responda.')
      expect(JSON.stringify(sw.gezeigt[0])).not.toContain('Defibrillator')
    }
  })

  it('das Füllfeld f wird übergangen', async () => {
    const sw = laden({ merker: gueltig() })
    await push(sw, payload({ f: '0'.repeat(1500) }))
    expect(sw.gezeigt[0].titel).toBe('MPG: Defibrillator 2 gesperrt')
    expect(JSON.stringify(sw.gezeigt[0])).not.toContain('000000')
  })

  it('merkerLesen hängt: nach 1,5 s neutral angezeigt (falsche Uhr)', async () => {
    vi.useFakeTimers()
    const sw = laden({ merker: () => new Promise<Merker>(() => { /* hängt */ }) })
    const w = push(sw, payload())
    await vi.advanceTimersByTimeAsync(1499)
    expect(sw.gezeigt).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2)
    await w
    expect(sw.gezeigt).toHaveLength(1)
    expect(sw.gezeigt[0].titel).toBe('Responda')
  })

  it('merkerLesen wirft: neutral angezeigt', async () => {
    const sw = laden({ merker: async () => { throw new Error('IndexedDB') } })
    await push(sw, payload())
    expect(sw.gezeigt).toHaveLength(1)
    expect(sw.gezeigt[0].titel).toBe('Responda')
  })

  it('showNotification wirft beim ersten Mal: neutral angezeigt', async () => {
    const sw = laden({ merker: gueltig(), wirft: 1 })
    await push(sw, payload())
    expect(sw.registration.showNotification).toHaveBeenCalledTimes(2)
    expect(sw.gezeigt).toHaveLength(1)
    expect(sw.gezeigt[0].titel).toBe('Responda')
  })

  it('showNotification wirft zweimal: zuletzt ganz schlicht', async () => {
    const sw = laden({ merker: gueltig(), wirft: 2 })
    await push(sw, payload())
    expect(sw.gezeigt).toHaveLength(1)
    expect(sw.gezeigt[0]).toEqual({ titel: 'Responda', optionen: { body: 'Es gibt Neues in Responda.', tag: 'responda' } })
  })

  it('fremde Ziele werden /hub', async () => {
    for (const url of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', '/a\\b', 'mpg', '', 42]) {
      const sw = laden({ merker: gueltig() })
      await push(sw, payload({ url }))
      expect((sw.gezeigt[0].optionen.data as { url: string }).url).toBe('/hub')
    }
    const sw = laden({ merker: gueltig() })
    await push(sw, payload({ url: '/vorgaenge?tab=cirs&meldung=abc' }))
    expect((sw.gezeigt[0].optionen.data as { url: string }).url).toBe('/vorgaenge?tab=cirs&meldung=abc')
  })

  it('zu lange Felder werden gekürzt (Titel 80, Text 300 in 5 Zeilen, Tag 64), ohne Ersatzpaar zu trennen', async () => {
    const sw = laden({ merker: gueltig() })
    await push(sw, payload({ titel: 'T'.repeat(78) + '😀😀', text: Array.from({ length: 8 }, (_, i) => 'Zeile ' + i).join('\n') + 'x'.repeat(400), tag: 'e'.repeat(100) }))
    const g = sw.gezeigt[0]
    expect(g.titel.length).toBeLessThanOrEqual(80)
    expect(g.titel.endsWith('…')).toBe(true)
    expect(/[\uD800-\uDBFF]$/.test(g.titel.slice(0, -1))).toBe(false)
    const body = String(g.optionen.body)
    expect(body.length).toBeLessThanOrEqual(300)
    expect(body.split('\n')).toHaveLength(5)
    expect(String(g.optionen.tag).length).toBe(64)
  })

  it('waitUntil wirft: kein Absturz, trotzdem angezeigt', async () => {
    const sw = laden({ merker: gueltig() })
    expect(() => sw.handler.push({ data: { text: () => JSON.stringify(payload()) }, waitUntil: () => { throw new Error('x') } })).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
    expect(sw.gezeigt).toHaveLength(1)
  })

  it('payloadLesen: nur v 1 mit Titel und fuer', () => {
    const sw = laden()
    expect(sw.R.payloadLesen(JSON.stringify(payload()))).toMatchObject({ titel: 'MPG: Defibrillator 2 gesperrt', fuer: PERSON, url: '/mpg/geraete/abc' })
    expect(sw.R.payloadLesen('null')).toBeNull()
    expect(sw.R.payloadLesen('[]')).toBeNull()
    expect(sw.R.payloadLesen(JSON.stringify(payload({ titel: 3 })))).toBeNull()
    expect(sw.R.payloadLesen(JSON.stringify(payload({ fuer: undefined })))).toBeNull()
  })
})

describe('sw-push: Abzeichen (eine Bedeutung)', () => {
  it('setAppBadge mit der Zahl der angezeigten Benachrichtigungen', async () => {
    const sw = laden({ merker: gueltig(), abzeichen: true })
    await push(sw, payload())
    await push(sw, payload({ tag: 'einsendung:x' }))
    const nav = sw.nav as { setAppBadge: ReturnType<typeof vi.fn> }
    expect(nav.setAppBadge).toHaveBeenLastCalledWith(2)
  })

  it('ohne setAppBadge: kein Fehler, trotzdem angezeigt', async () => {
    const sw = laden({ merker: gueltig(), abzeichen: false })
    await push(sw, payload())
    expect(sw.gezeigt).toHaveLength(1)
  })
})

describe('sw-push: Tippen auf die Benachrichtigung', () => {
  function fenster(url = 'https://app.responda.systems/hub'): Fenster {
    const f: Fenster = { url, visibilityState: 'visible', focus: vi.fn(async () => f), postMessage: vi.fn(), navigate: vi.fn(async () => f) }
    return f
  }
  async function klick(sw: Geladen, url: unknown) {
    let warten: Promise<unknown> | undefined
    const close = vi.fn()
    sw.handler.notificationclick({ notification: { close, data: { url } }, waitUntil: (p: Promise<unknown>) => { warten = p } })
    await warten
    return close
  }

  it('offenes Fenster: nach vorn und postMessage push-oeffnen', async () => {
    const f = fenster()
    const sw = laden({ fenster: [f] })
    const close = await klick(sw, '/mpg/geraete/x')
    expect(close).toHaveBeenCalled()
    expect(f.postMessage).toHaveBeenCalledWith({ art: 'push-oeffnen', url: '/mpg/geraete/x' })
    expect(f.focus).toHaveBeenCalled()
    expect(sw.clients.openWindow).not.toHaveBeenCalled()
    expect(sw.clients.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true })
  })

  it('postMessage klappt nicht: navigate', async () => {
    const f = fenster()
    f.postMessage.mockImplementation(() => { throw new Error('zu') })
    const sw = laden({ fenster: [f] })
    await klick(sw, '/lager')
    expect(f.navigate).toHaveBeenCalledWith('/lager')
  })

  it('ohne Fenster (auch nur fremdes Origin): openWindow mit sicherem Pfad', async () => {
    const sw = laden({ fenster: [fenster('https://andere.example/x')] })
    await klick(sw, 'https://evil.example')
    expect(sw.clients.openWindow).toHaveBeenCalledWith('/hub')
    const sw2 = laden({ fenster: [] })
    await klick(sw2, '/vorgaenge?tab=eingang&seite=einsendung&id=abc')
    expect(sw2.clients.openWindow).toHaveBeenCalledWith('/vorgaenge?tab=eingang&seite=einsendung&id=abc')
  })

  it('waitUntil wirft: kein Absturz', () => {
    const sw = laden({ fenster: [] })
    expect(() => sw.handler.notificationclick({ notification: { close: () => {}, data: {} }, waitUntil: () => { throw new Error('x') } })).not.toThrow()
  })
})

describe('sw-push: Abo gewechselt (pushsubscriptionchange)', () => {
  it('abonniert mit dem gemerkten Schlüssel neu und setzt abo_geaendert', async () => {
    const k = createECDH('prime256v1')
    k.generateKeys()
    const schluessel = k.getPublicKey().toString('base64url')
    const sw = laden({ merker: gueltig({ schluessel }) })
    const geschrieben: unknown[] = []
    sw.R.merkerSchreiben = async (m: unknown) => { geschrieben.push(m) }
    let warten: Promise<unknown> | undefined
    sw.handler.pushsubscriptionchange({ waitUntil: (p: Promise<unknown>) => { warten = p } })
    await warten
    expect(sw.registration.pushManager.subscribe).toHaveBeenCalledTimes(1)
    const arg = sw.registration.pushManager.subscribe.mock.calls[0][0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array }
    expect(arg.userVisibleOnly).toBe(true)
    expect(Buffer.from(arg.applicationServerKey).toString('base64url')).toBe(schluessel)
    expect(geschrieben).toHaveLength(1)
    expect(geschrieben[0]).toMatchObject({ person: PERSON, abo_geaendert: true })
  })

  it('mit newSubscription: nicht neu abonnieren, nur merken', async () => {
    const sw = laden({ merker: gueltig() })
    const geschrieben: unknown[] = []
    sw.R.merkerSchreiben = async (m: unknown) => { geschrieben.push(m) }
    let warten: Promise<unknown> | undefined
    sw.handler.pushsubscriptionchange({ newSubscription: { endpoint: 'x' }, waitUntil: (p: Promise<unknown>) => { warten = p } })
    await warten
    expect(sw.registration.pushManager.subscribe).not.toHaveBeenCalled()
    expect(geschrieben[0]).toMatchObject({ abo_geaendert: true })
  })

  it('ohne Abo-Merker: nichts', async () => {
    const sw = laden({ merker: { abgemeldet: true } })
    const geschrieben: unknown[] = []
    sw.R.merkerSchreiben = async (m: unknown) => { geschrieben.push(m) }
    let warten: Promise<unknown> | undefined
    sw.handler.pushsubscriptionchange({ waitUntil: (p: Promise<unknown>) => { warten = p } })
    await warten
    expect(geschrieben).toHaveLength(0)
  })
})

describe('sw-push: Gleichlauf und Rücknahme-Schutz', () => {
  it('urlSicher wie src/lib/push/geraet.ts', () => {
    const sw = laden()
    const faelle: unknown[] = ['/hub', '/', '//x', '/a//b', '/a\\b', 'hub', 'https://x', 'javascript:x', '/vorgaenge?tab=cirs&meldung=a',
      '/mpg/geraete/abc', '/x y', '/ä', '/a#b', '/a%20b', '/a:b', null, undefined, 3, {}, '/' + 'a'.repeat(300)]
    for (let i = 0; i < 300; i++) {
      let s = '/'
      for (let j = 0; j < (i % 12); j++) s += '/a?=&.%:_-#\\ äZ9'[(i * 7 + j * 13) % 18]
      faelle.push(s)
    }
    for (const f of faelle) expect(sw.R.urlSicher(f)).toBe(urlSicherApp(f))
  })

  it('vite.config.ts lädt sw-push.js im Service Worker (nie herausnehmen, solange der Server sendet)', () => {
    const cfg = readFileSync(new URL('../../../vite.config.ts', import.meta.url), 'utf8')
    const m = /importScripts:\s*\[([^\]]*)\]/.exec(cfg)
    expect(m).not.toBeNull()
    expect(m![1]).toContain("'sw-push.js'")
    expect(m![1]).toContain("'sw-formulare.js'")
  })
})
