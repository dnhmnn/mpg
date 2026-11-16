// Dreiwege-Prüfung der Push-Benachrichtigungen (Bauplan Push, 8.1; Integration).
//
// Drei Stellen müssen dieselben Regeln haben, sonst entsteht eine Lücke zwischen ihnen:
// - urlSicher (nur Pfade der App) in PocketBase (pb_hooks/push-regeln.js), in der App
//   (src/lib/push/geraet.ts, PushNavigation) und im Service Worker (public/sw-push.js): auf
//   denselben 500 Eingaben (feste Liste plus Zufall mit festem Seed) dasselbe Ergebnis.
// - Die erlaubten Hosts der Push-Dienste (HOSTS) in PocketBase und im Push-Dienst
//   (dienste/push/lib/pruefen.mjs): dieselbe Liste. Sonst meldete PocketBase Geräte an, die der
//   Dienst ablehnt (und PocketBase löschte sie), oder umgekehrt.
// - Die Endpoint-Fälle aus 4.7 gegen aboPruefen (PocketBase) und nachrichtPruefen (Dienst): gleiches
//   Ergebnis. Einzige gewollte Abweichung: Der Dienst prüft zusätzlich mit new URL und lehnt
//   Pfade mit Punkt-Segmenten ab (/./, /../), die new URL umschreiben würde.
//
// dienste/push/lib/pruefen.mjs hat keine Abhängigkeiten; der Import geht ohne npm ci im Dienst.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { urlSicher as urlSicherApp } from '../push/geraet'

type Fn = (x: unknown) => string

function pbLaden(datei: string) {
  const modul = { exports: {} as Record<string, unknown> }
  runInNewContext(readFileSync(new URL(`../../../pb_hooks/${datei}`, import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modul.exports as any
}
const R = pbLaden('push-regeln.js')

function swLaden() {
  const self: Record<string, unknown> = {}
  runInNewContext(readFileSync(new URL('../../../public/sw-push.js', import.meta.url), 'utf8'), { self, setTimeout })
  return self.RespondaPush as { urlSicher: Fn }
}
const SW = swLaden()

const DIENST_DATEI = new URL('../../../dienste/push/lib/pruefen.mjs', import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dienstLaden(): Promise<any> {
  const pfad = DIENST_DATEI.href
  return import(/* @vite-ignore */ pfad)
}

/** Zufall mit festem Seed (mulberry32), damit jeder Lauf dieselben Eingaben prüft. */
function zufall(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FEST: unknown[] = [
  '/hub', '/', '', '//evil.example', '///x', 'https://evil.example', 'http://x', 'javascript:alert(1)', 'JAVASCRIPT:alert(1)',
  '/vorgaenge?tab=cirs&meldung=abc123', '/vorgaenge?tab=eingang&seite=einsendung&id=abcdefghijk1234', '/mpg/geraete/abc',
  '/mpg/meldungen/x_y-z', '/lager', '/patienten', '/benachrichtigungen', '/unitas', '/ausbildungen', '/mpg/fristen',
  '/a\\b', '\\\\evil', '/\\evil', '/a b', '/a\tb', '/a\nb', '/a#b', '/a@b', '/ä', '/%2F%2Fevil', '/a:b', '/a..b', '/../x',
  '/./x', '/a?x=1&y=2', '/a?x=<script>', '/a"b', "/a'b", '/a(b)', '/a+b', '/a~b', '/a;b', '/a,b', '/a*b', '/a|b', '/a^b',
  '/a`b', '/a{b}', '/a[b]', '/a$b', '/a!b', ' /hub', '/hub ', 'hub', '?x', '#x', '/ ', '/😀', '/a/'.repeat(80),
  null, undefined, 0, 1, true, false, {}, [], ['/hub'], { toString: () => '/hub' },
]

function zufallsEingaben(n: number): string[] {
  const z = zufall(20261116)
  const ZEICHEN = 'abcXYZ019/_-?=&.%:\\ #@!$*+,;\'"<>()[]{}|^`~\t\näöüß€\u0000‮'
  const ANFAENGE = ['/', '//', '/\\', 'https:', 'http://', '', ' ', '\\', '/./', '/../', 'javascript:', '/%2f']
  const aus: string[] = []
  while (aus.length < n) {
    let s = ANFAENGE[Math.floor(z() * ANFAENGE.length)]
    const laenge = Math.floor(z() * 30)
    for (let i = 0; i < laenge; i++) s += ZEICHEN[Math.floor(z() * ZEICHEN.length)]
    // ein Teil nur aus erlaubten Zeichen, damit auch genug durchgehen
    if (z() < 0.35) s = '/' + s.replace(/[^A-Za-z0-9/_\-?=&.%:]/g, '')
    aus.push(s)
  }
  return aus
}

describe('Dreiwege: urlSicher (PocketBase, App, Service Worker)', () => {
  const eingaben: unknown[] = [...FEST, ...zufallsEingaben(500 - FEST.length)]

  it('500 Eingaben', () => {
    expect(eingaben.length).toBe(500)
  })

  it('alle drei Fassungen geben auf jeder Eingabe dasselbe', () => {
    const abweichungen: string[] = []
    let durch = 0
    for (const e of eingaben) {
      const pb = R.urlSicher(e)
      const app = urlSicherApp(e)
      const sw = SW.urlSicher(e)
      if (pb !== app || pb !== sw) abweichungen.push(`${JSON.stringify(e)}: pb=${pb} app=${app} sw=${sw}`)
      if (pb === e) durch++
    }
    expect(abweichungen).toEqual([])
    // Die Eingaben prüfen beide Seiten: genug gehen durch, genug werden zu /hub
    expect(durch).toBeGreaterThan(80)
    expect(eingaben.length - durch).toBeGreaterThan(80)
  })

  it('nie etwas außerhalb der App', () => {
    for (const e of eingaben) {
      const u = R.urlSicher(e)
      expect(u.startsWith('/')).toBe(true)
      expect(u.startsWith('//')).toBe(false)
      expect(u.includes('\\')).toBe(false)
      expect(/^[A-Za-z0-9/_\-?=&.%:]*$/.test(u)).toBe(true)
    }
  })
})

describe('Dreiwege: erlaubte Hosts (PocketBase und Push-Dienst)', () => {
  it('HOSTS steht im Dienst als einzeilige Liste und ist gleich der Liste in push-regeln.js', () => {
    const text = readFileSync(DIENST_DATEI, 'utf8')
    const m = /export const HOSTS = \[([^\]\n]*)\]/.exec(text)
    expect(m).not.toBeNull()
    const ausDatei = [...(m as RegExpExecArray)[1].matchAll(/'([^']*)'/g)].map((x) => x[1])
    expect(ausDatei).toEqual([...R.HOSTS])
  })

  it('HOSTS über den Import gleich, ebenso hostErlaubt auf Grenzfällen', async () => {
    const D = await dienstLaden()
    expect([...D.HOSTS]).toEqual([...R.HOSTS])
    const hosts = [
      'fcm.googleapis.com', 'fcm.googleapis.com.evil.de', 'xfcm.googleapis.com', 'a.fcm.googleapis.com', 'push.apple.com',
      'web.push.apple.com', 'api.push.apple.com', 'evil.push.apple.com.de', 'push.services.mozilla.com',
      'updates.push.services.mozilla.com', 'services.mozilla.com', 'notify.windows.com', 'db5p.notify.windows.com',
      'wns2-par02p.notify.windows.com', '127.0.0.1', '127.0.0.1:8742', '', 'FCM.googleapis.com',
    ]
    for (const h of hosts) {
      expect(D.hostErlaubt(h, []), h).toBe(R.hostErlaubt(h, []))
      expect(D.hostErlaubt(h, ['127.0.0.1:8742']), h).toBe(R.hostErlaubt(h, ['127.0.0.1:8742']))
    }
  })
})

describe('Dreiwege: Endpoint-Fälle aus 4.7 (aboPruefen und nachrichtPruefen)', () => {
  const P256 = 'B' + 'A'.repeat(86)
  const AUTH = 'a'.repeat(22)
  const GUT = [
    'https://fcm.googleapis.com/fcm/send/abc:DEF-123_xyz',
    'https://web.push.apple.com/QGuQyavXutnMH7xx8lTSbLnBzMAOv0yRY0sGC3DtxLoD',
    'https://api.push.apple.com/3/device/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk',
    'https://push.services.mozilla.com/wpush/v1/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%2bAbc%3d',
    'https://db5p.notify.windows.com/w/abc',
    'https://fcm.googleapis.com/' + 'a'.repeat(1000 - 'https://fcm.googleapis.com/'.length),
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
    'https://x:y@fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com/fcm\\send/abc',
    'https://fcm.googleapis.com/fcm/send/abc#x',
    'https://fcm.googleapis.com/fcm/send/a b',
    'https://fcm.googleapis.com/fcm/send/a\tb',
    'https://fcm.googleapis.com/fcm/send/a\nb',
    'https://fcm.googleapis.com/fcm/send/abc?token=x',
    'https://fcm.googleapis.com',
    'https://a..notify.windows.com/w/?token=abc',
    'https://notify.windows.com/w/?token=abc',
    'https://db5p.notify.windows.com/w/?token=a b',
    'https://127.0.0.1:8742/abo/1',
    'https://[::1]/abo/1',
    'https://fcm.googleapis.com/ä',
    'https://fcm.googleapis.com/' + 'a'.repeat(1001 - 'https://fcm.googleapis.com/'.length),
    '',
  ]
  // Gewollte Abweichung (Bericht Team A, Punkt 8): Punkt-Segmente nimmt PocketBase an, der Dienst nicht
  const NUR_DIENST_STRENGER = [
    'https://fcm.googleapis.com/fcm/./send/abc',
    'https://fcm.googleapis.com/fcm/../send/abc',
  ]
  const ID = 'abcdefghijk1234'
  const nachricht = (endpoint: string, keys: Record<string, string> = { p256dh: P256, auth: AUTH }) => ({
    id: ID,
    schluessel: 'e7c1d0a9b8f2c3d4e5f6a7b8c9d0e1f2:' + ID,
    abo: { endpoint, keys },
    payload: { v: 1, titel: 'Responda: Probe', text: 'So sehen Benachrichtigungen auf diesem Gerät aus.', url: '/benachrichtigungen', tag: 'probe', anlass: 'probe', fuer: 'u', zeit: '2026-11-16T10:00:00.000Z' },
    ttl: R.TTL_EINHEIT,
    urgency: R.DRINGLICHKEIT_EINHEIT,
    topic: 'abcdefghijklmnopqrstuvwxyzABCDEF',
  })
  const ergebnisPb = (endpoint: string, keys?: Record<string, string>, test: string[] = []) => {
    const r = R.aboPruefen({ endpoint, keys: keys ?? { p256dh: P256, auth: AUTH } }, test)
    return r.ok ? 'ok' : r.feld
  }
  const ergebnisDienst = (D: { nachrichtPruefen: (n: unknown, t: string[]) => { ok: boolean; grund?: string } }, endpoint: string, keys?: Record<string, string>, test: string[] = []) => {
    const r = D.nachrichtPruefen(nachricht(endpoint, keys), test)
    return r.ok ? 'ok' : r.grund
  }

  it('gültige Endpoints: beide nehmen an', async () => {
    const D = await dienstLaden()
    for (const e of GUT) {
      expect(ergebnisPb(e), e).toBe('ok')
      expect(ergebnisDienst(D, e), e).toBe('ok')
    }
  })

  it('ungültige Endpoints: beide lehnen mit „endpoint“ ab', async () => {
    const D = await dienstLaden()
    for (const e of SCHLECHT) {
      expect(ergebnisPb(e), JSON.stringify(e)).toBe('endpoint')
      expect(ergebnisDienst(D, e), JSON.stringify(e)).toBe('endpoint')
    }
  })

  it('Punkt-Segmente: nur der Dienst lehnt ab (gewollt, zusätzliche Prüfung mit new URL)', async () => {
    const D = await dienstLaden()
    for (const e of NUR_DIENST_STRENGER) {
      expect(ergebnisPb(e), e).toBe('ok')
      expect(ergebnisDienst(D, e), e).toBe('endpoint')
    }
  })

  it('Schlüssel: gleiche Entscheidung (auch mit angehängtem „=“)', async () => {
    const D = await dienstLaden()
    const e = GUT[0]
    const faelle: Record<string, string>[] = [
      { p256dh: P256 + '=', auth: AUTH + '==' },
      { p256dh: P256, auth: AUTH + '===' },
      { p256dh: P256.slice(0, 80), auth: AUTH },
      { p256dh: 'C' + P256.slice(1), auth: AUTH },
      { p256dh: P256, auth: AUTH.slice(1) },
      { p256dh: P256.slice(0, 50) + '+' + P256.slice(51), auth: AUTH },
      { p256dh: P256, auth: AUTH.slice(0, 10) + '/' + AUTH.slice(11) },
      {} as Record<string, string>,
    ]
    for (const k of faelle) expect(ergebnisDienst(D, e, k), JSON.stringify(k)).toBe(ergebnisPb(e, k))
    expect(ergebnisPb(e, faelle[0])).toBe('ok')
    expect(ergebnisPb(e, faelle[2])).toBe('keys')
  })

  it('Prüf-Host nur mit Liste und genau diesem Port, in beiden gleich', async () => {
    const D = await dienstLaden()
    const liste = ['127.0.0.1:8742']
    for (const [e, erwartet] of [
      ['https://127.0.0.1:8742/abo/1', 'ok'],
      ['https://127.0.0.1:8743/abo/1', 'endpoint'],
      ['https://127.0.0.1/abo/1', 'endpoint'],
      ['http://127.0.0.1:8742/abo/1', 'endpoint'],
      ['https://localhost:8742/abo/1', 'endpoint'],
    ] as const) {
      expect(ergebnisPb(e, undefined, liste), e).toBe(erwartet)
      expect(ergebnisDienst(D, e, undefined, liste), e).toBe(erwartet)
      expect(ergebnisPb(e, undefined, []), e).toBe('endpoint')
      expect(ergebnisDienst(D, e, undefined, []), e).toBe('endpoint')
    }
  })

  it('PocketBase sendet nur Werte, die der Dienst annimmt (TTL, Dringlichkeit, Topic, Payload)', async () => {
    const D = await dienstLaden()
    const r = D.nachrichtPruefen(nachricht(GUT[0]), [])
    expect(r.ok).toBe(true)
    // Größte Payload, die PocketBase baut (payloadBauen höchstens 2000 Bytes), nimmt der Dienst an
    const p = R.payloadBauen({ titel: 'T'.repeat(500), text: 'ä'.repeat(5000), url: '/hub', tag: 'mitteilung:abc', anlass: 'mitteilung', fuer: 'u', zeitMs: Date.parse('2026-11-16T10:00:00.000Z') })
    expect(R.utf8Laenge(JSON.stringify(p))).toBeLessThanOrEqual(2000)
    const r2 = D.nachrichtPruefen({ ...nachricht(GUT[0]), payload: JSON.parse(JSON.stringify(p)) }, [])
    expect(r2.ok).toBe(true)
    // aufgefüllt auf die einheitliche Größe
    expect(Buffer.byteLength(r2.nachricht.payloadText, 'utf8')).toBe(2048)
  })
})
