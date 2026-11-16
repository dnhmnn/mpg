// Prüffälle für src/lib/push/geraet.ts (Bauplan Push 6.2 und 6.6): Was das Gerät für Push kann,
// Bezeichnung des Geräts, Schlüssel als Bytes, sichere Pfade, Merker, Kennung des Endpoints.

import { describe, expect, it } from 'vitest'
import { createECDH, createHash } from 'node:crypto'
import { base64url, endpointKennung, geraetName, merkerNormal, mitZeit, schluesselBytes, unterstuetzung, urlSicher, type Umgebung } from '../push/geraet'

const UA = {
  iphone17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  iphone164: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
  iphone163: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
  ipadMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  ipadMac163: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  mac16: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
  mac17: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
}

const voll = (x: Partial<Umgebung>): Umgebung => ({
  sicher: true, capacitor: false, ua: UA.android, touchPunkte: 5, standalone: false, serviceWorker: true, pushManager: true, notification: true, ...x,
})

describe('unterstuetzung (6.2)', () => {
  it('iPhone und iPad in Safari, nicht vom Homebildschirm: Erklärung', () => {
    expect(unterstuetzung(voll({ ua: UA.iphone17, pushManager: false, notification: false }))).toBe('ios_homebildschirm')
    expect(unterstuetzung(voll({ ua: UA.iphone17 }))).toBe('ios_homebildschirm')
    expect(unterstuetzung(voll({ ua: UA.ipad, pushManager: false }))).toBe('ios_homebildschirm')
    // iPadOS meldet sich als Mac, hat aber Touch
    expect(unterstuetzung(voll({ ua: UA.ipadMac, touchPunkte: 5, pushManager: false }))).toBe('ios_homebildschirm')
    // Chrome auf dem iPhone ebenso
    expect(unterstuetzung(voll({ ua: UA.chromeIos }))).toBe('ios_homebildschirm')
  })

  it('vom Homebildschirm: iOS 16.3 zu alt, 16.4 und 17 gehen', () => {
    expect(unterstuetzung(voll({ ua: UA.iphone163, standalone: true, pushManager: false }))).toBe('ios_alt')
    expect(unterstuetzung(voll({ ua: UA.iphone163, standalone: true, pushManager: true }))).toBe('ios_alt')
    expect(unterstuetzung(voll({ ua: UA.iphone164, standalone: true }))).toBe('ok')
    expect(unterstuetzung(voll({ ua: UA.iphone17, standalone: true }))).toBe('ok')
    expect(unterstuetzung(voll({ ua: UA.iphone17, standalone: true, pushManager: false }))).toBe('ios_alt')
    expect(unterstuetzung(voll({ ua: UA.ipadMac, touchPunkte: 5, standalone: true }))).toBe('ok')
    expect(unterstuetzung(voll({ ua: UA.ipadMac163, touchPunkte: 5, standalone: true }))).toBe('ios_alt')
  })

  it('Android, Firefox, Edge, Desktop-Safari', () => {
    expect(unterstuetzung(voll({ ua: UA.android }))).toBe('ok')
    expect(unterstuetzung(voll({ ua: UA.firefox, touchPunkte: 0 }))).toBe('ok')
    expect(unterstuetzung(voll({ ua: UA.edge, touchPunkte: 0 }))).toBe('ok')
    // Safari 16 auf dem Mac ohne PushManager, Safari 17 mit (ohne Touch: kein iPad)
    expect(unterstuetzung(voll({ ua: UA.mac16, touchPunkte: 0, pushManager: false }))).toBe('browser')
    expect(unterstuetzung(voll({ ua: UA.mac17, touchPunkte: 0 }))).toBe('ok')
  })

  it('ohne Schnittstellen: browser; Capacitor; http', () => {
    expect(unterstuetzung(voll({ serviceWorker: false }))).toBe('browser')
    expect(unterstuetzung(voll({ notification: false }))).toBe('browser')
    expect(unterstuetzung(voll({ pushManager: false }))).toBe('browser')
    expect(unterstuetzung(voll({ capacitor: true }))).toBe('capacitor')
    expect(unterstuetzung(voll({ capacitor: true, ua: UA.iphone17 }))).toBe('capacitor')
    expect(unterstuetzung(voll({ sicher: false }))).toBe('unsicher')
    expect(unterstuetzung(voll({ sicher: false, capacitor: true }))).toBe('unsicher')
  })
})

describe('geraetName', () => {
  it('Beispiele', () => {
    expect(geraetName(UA.iphone17, true)).toBe('iPhone, Homebildschirm')
    expect(geraetName(UA.iphone17, false)).toBe('iPhone, Safari')
    expect(geraetName(UA.chromeIos, false)).toBe('iPhone, Chrome')
    expect(geraetName(UA.ipad, true)).toBe('iPad, Homebildschirm')
    expect(geraetName(UA.ipadMac, true, true)).toBe('iPad, Homebildschirm')
    expect(geraetName(UA.ipadMac, true)).toBe('Mac, App')
    expect(geraetName(UA.android, false)).toBe('Android, Chrome')
    expect(geraetName(UA.android, true)).toBe('Android, Homebildschirm')
    expect(geraetName(UA.samsung, false)).toBe('Android, Samsung Internet')
    expect(geraetName(UA.firefox, false)).toBe('Windows, Firefox')
    expect(geraetName(UA.edge, false)).toBe('Windows, Edge')
    expect(geraetName(UA.edge, true)).toBe('Windows, App')
    expect(geraetName(UA.mac17, false)).toBe('Mac, Safari')
    expect(geraetName(UA.linux, false)).toBe('Linux, Chrome')
    expect(geraetName('', false)).toBe('Gerät, Browser')
  })

  it('nur Zeichen, die der Server zulässt, höchstens 80', () => {
    for (const ua of [...Object.values(UA), '<script>', 'ÄÖÜ 😀']) {
      for (const s of [true, false]) {
        const n = geraetName(ua, s)
        expect(n).toMatch(/^[A-Za-z0-9ÄÖÜäöüß ,.()/-]{1,80}$/)
      }
    }
  })
})

describe('schluesselBytes und base64url', () => {
  it('87 Zeichen → 65 Byte, Rundweg', () => {
    for (let i = 0; i < 20; i++) {
      const k = createECDH('prime256v1')
      k.generateKeys()
      const roh = k.getPublicKey()
      const s = roh.toString('base64url')
      expect(s).toHaveLength(87)
      const b = schluesselBytes(s)
      expect(b).toHaveLength(65)
      expect(Buffer.from(b).equals(roh)).toBe(true)
      expect(base64url(b)).toBe(s)
      // angehängte = sind erlaubt
      expect(Buffer.from(schluesselBytes(s + '=')).equals(roh)).toBe(true)
    }
  })

  it('Unsinn wirft', () => {
    const k = createECDH('prime256v1')
    k.generateKeys()
    const s = k.getPublicKey().toString('base64url')
    for (const x of ['', 'abc', s.slice(0, 86), s + 'AA', '!' + s.slice(1), s.replace(/^B/, 'A'), 'B'.repeat(87).replace(/^B/, 'C'), s.replace('A', '+')]) {
      if (x === s) continue
      expect(() => schluesselBytes(x)).toThrow()
    }
    expect(() => schluesselBytes(undefined as unknown as string)).toThrow()
  })

  it('base64url für alle Restlängen', () => {
    for (let n = 0; n < 40; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + n) & 255)
      expect(base64url(b)).toBe(Buffer.from(b).toString('base64url'))
    }
  })
})

describe('urlSicher', () => {
  it('nur Pfade der App', () => {
    expect(urlSicher('/hub')).toBe('/hub')
    expect(urlSicher('/vorgaenge?tab=cirs&meldung=a')).toBe('/vorgaenge?tab=cirs&meldung=a')
    expect(urlSicher('/mpg/geraete/abc')).toBe('/mpg/geraete/abc')
    for (const x of ['https://x', '//x', 'javascript:alert(1)', '/a\\b', 'hub', '', '/a b', '/ä', '/a#b', null, 3]) expect(urlSicher(x)).toBe('/hub')
  })
})

describe('merkerNormal', () => {
  it('nur bekannte Felder mit passendem Typ', () => {
    expect(merkerNormal(null)).toBeNull()
    expect(merkerNormal('x')).toBeNull()
    expect(merkerNormal([])).toBeNull()
    expect(merkerNormal({})).toBeNull()
    expect(merkerNormal({ person: 'p', endpoint: 'e', gemeldet: 5, ablauf: 9, fremd: 'x', abo_geaendert: true, abgemeldet: 'ja' }))
      .toEqual({ person: 'p', endpoint: 'e', gemeldet: 5, ablauf: 9, abo_geaendert: true })
    expect(merkerNormal({ abgemeldet: true })).toEqual({ abgemeldet: true })
    expect(merkerNormal({ person: 'p', ablauf: null })).toEqual({ person: 'p', ablauf: null })
    expect(merkerNormal({ person: 'p', ablauf: Number.NaN, gemeldet: 'gestern' })).toEqual({ person: 'p' })
  })
})

describe('endpointKennung und mitZeit', () => {
  it('erste 16 Hex-Zeichen von sha256(endpoint), wie der Server', async () => {
    const e = 'https://fcm.googleapis.com/fcm/send/abc:def'
    expect(await endpointKennung(e)).toBe(createHash('sha256').update(e).digest('hex').slice(0, 16))
    expect(await endpointKennung('https://web.push.apple.com/QAbc')).toHaveLength(16)
  })

  it('mitZeit: hängendes Versprechen → Ersatz, Fehler → Ersatz', async () => {
    expect(await mitZeit(new Promise<number>(() => {}), 5, 7)).toBe(7)
    expect(await mitZeit(Promise.reject(new Error('x')), 50, 8)).toBe(8)
    expect(await mitZeit(Promise.resolve(3), 50, 8)).toBe(3)
  })
})
