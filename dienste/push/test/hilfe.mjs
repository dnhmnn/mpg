// Hilfen für die Prüfungen des Push-Dienstes (node:test).
//
// - Prüf-CA und Server-Zertifikat für 127.0.0.1 per openssl in ein Temp-Verzeichnis
//   (fehlt openssl: `tlsVorbereiten()` gibt null zurück, TLS-Fälle werden mit Meldung übersprungen)
// - falscher Push-Endpunkt (HTTPS, zeichnet Anfragen auf, Antwort je Pfad steuerbar)
// - Abo-Erzeugung (ECDH P-256, 16 Byte auth) und Entschlüsseln nach RFC 8291, einmal eigenständig
//   mit node:crypto und einmal mit http_ece (aus web-push), damit kein Fehler sich selbst bestätigt
// - VAPID-JWT prüfen (ES256, aud, sub, exp)
// - Dienst im Prozess oder als eigener Prozess starten
//
// Nur erfundene Prüfdaten. Ports: frei vom Betriebssystem vergeben (127.0.0.1:0).

import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import webpush from 'web-push'

export const DIENST_VERZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DIENST_MJS = path.join(DIENST_VERZ, 'dienst.mjs')
export const SCHLUESSEL_MJS = path.join(DIENST_VERZ, 'schluessel-erzeugen.mjs')

const require = createRequire(import.meta.url)
const ece = createRequire(require.resolve('web-push'))('http_ece')

export function warten(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function bisWahr(pruefen, maxMs = 5000, schrittMs = 10) {
  const ende = Date.now() + maxMs
  for (;;) {
    if (await pruefen()) return true
    if (Date.now() > ende) return false
    await warten(schrittMs)
  }
}

const tempListe = []
process.on('exit', () => {
  for (const d of tempListe) {
    try {
      fs.rmSync(d, { recursive: true, force: true })
    } catch {
      // egal
    }
  }
})

/** Temp-Verzeichnis, das am Ende des Prüflaufs wieder gelöscht wird. */
export function tempVerzeichnis(name = 'push') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `responda-${name}-`))
  tempListe.push(d)
  return d
}

// ── TLS ─────────────────────────────────────────────────────────────────────

let tlsZwischenspeicher
/** → { verzeichnis, caPfad, ca, key, cert } | null (ohne openssl) */
export function tlsVorbereiten() {
  if (tlsZwischenspeicher !== undefined) return tlsZwischenspeicher
  const v = spawnSync('openssl', ['version'], { encoding: 'utf8' })
  if (v.error || v.status !== 0) {
    tlsZwischenspeicher = null
    return null
  }
  const dir = tempVerzeichnis('tls')
  const p = (n) => path.join(dir, n)
  fs.writeFileSync(
    p('ca.cnf'),
    [
      '[req]',
      'distinguished_name = dn',
      'prompt = no',
      '[dn]',
      'CN = Responda Pruef-CA',
      '[v3_ca]',
      'basicConstraints = critical,CA:TRUE',
      'keyUsage = critical,keyCertSign,cRLSign',
      'subjectKeyIdentifier = hash',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    p('srv.cnf'),
    [
      '[req]',
      'distinguished_name = dn',
      'prompt = no',
      '[dn]',
      'CN = 127.0.0.1',
      '[srv]',
      'basicConstraints = CA:FALSE',
      'keyUsage = critical,digitalSignature',
      'extendedKeyUsage = serverAuth',
      'subjectAltName = IP:127.0.0.1',
      'authorityKeyIdentifier = keyid',
      '',
    ].join('\n'),
  )
  const laufen = (args) => {
    const r = spawnSync('openssl', args, { cwd: dir, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`openssl ${args[0]} gescheitert: ${r.stderr}`)
  }
  const ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes']
  laufen(['req', '-x509', '-config', 'ca.cnf', '-extensions', 'v3_ca', ...ec, '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2'])
  laufen(['req', '-new', '-config', 'srv.cnf', ...ec, '-keyout', 'srv.key', '-out', 'srv.csr'])
  laufen([
    'x509', '-req', '-in', 'srv.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key',
    '-set_serial', '0x' + crypto.randomBytes(8).toString('hex'),
    '-out', 'srv.pem', '-days', '2', '-extfile', 'srv.cnf', '-extensions', 'srv',
  ])
  tlsZwischenspeicher = {
    verzeichnis: dir,
    caPfad: p('ca.pem'),
    ca: fs.readFileSync(p('ca.pem')),
    key: fs.readFileSync(p('srv.key')),
    cert: fs.readFileSync(p('srv.pem')),
  }
  return tlsZwischenspeicher
}

export const OHNE_OPENSSL = 'openssl fehlt: Prüfungen mit HTTPS-Endpunkt übersprungen'

// ── falscher Push-Endpunkt ──────────────────────────────────────────────────

/**
 * Startet einen falschen Push-Endpunkt (HTTPS). Antworten je Pfad steuerbar:
 *   antwortSetzen('/abo/1', [{ status: 500 }, { status: 201 }])   // nacheinander, die letzte bleibt
 *   antwortSetzen('/abo/2', { status: 429, kopf: { 'Retry-After': '1' } })
 *   antwortSetzen('/abo/3', { status: 201, verzoegerungMs: 2000 })
 * Steuerpfade (für das eigenständige Programm): GET /_protokoll, POST /_antwort, POST /_leeren.
 */
export async function fakeEndpunktStarten({ tls, port = 0, host = '127.0.0.1' } = {}) {
  const anfragen = []
  const folgen = new Map()
  let standard = [{ status: 201 }]
  let gleichzeitig = 0
  let maxGleichzeitig = 0

  function naechsteAntwort(pfad) {
    const f = folgen.get(pfad) || standard
    if (f.length > 1) return folgen.has(pfad) ? f.shift() : f[0]
    return f[0]
  }

  function steuern(req, res, body) {
    const json = (status, daten) => {
      const b = JSON.stringify(daten)
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) })
      res.end(b)
    }
    if (req.method === 'GET' && req.url === '/_protokoll') {
      return json(200, {
        anfragen: anfragen.map((a) => ({ methode: a.methode, pfad: a.pfad, kopf: a.kopf, body: a.body.toString('base64'), zeit: a.zeit })),
        max_gleichzeitig: maxGleichzeitig,
      })
    }
    if (req.method === 'POST' && req.url === '/_leeren') {
      anfragen.length = 0
      maxGleichzeitig = 0
      return json(200, { ok: true })
    }
    if (req.method === 'POST' && req.url === '/_antwort') {
      try {
        const d = JSON.parse(body.toString('utf8'))
        if (d.pfad === '*') standard = [].concat(d.folge)
        else folgen.set(d.pfad, [].concat(d.folge))
        return json(200, { ok: true })
      } catch {
        return json(400, { ok: false })
      }
    }
    return json(404, { ok: false })
  }

  const server = https.createServer({ key: tls.key, cert: tls.cert }, (req, res) => {
    const teile = []
    req.on('data', (c) => teile.push(c))
    req.on('end', () => {
      const body = Buffer.concat(teile)
      if (req.url.startsWith('/_')) return steuern(req, res, body)
      gleichzeitig++
      maxGleichzeitig = Math.max(maxGleichzeitig, gleichzeitig)
      let fertig = false
      const abschluss = () => {
        if (fertig) return
        fertig = true
        gleichzeitig--
      }
      res.on('close', abschluss)
      res.on('finish', abschluss)
      anfragen.push({ methode: req.method, pfad: req.url, kopf: { ...req.headers }, body, zeit: Date.now() })
      const a = naechsteAntwort(req.url)
      const senden = () => {
        if (res.destroyed || res.writableEnded) return
        try {
          res.writeHead(a.status ?? 201, a.kopf || {})
          res.end(a.body ?? '')
        } catch {
          // Gegenseite hat schon aufgelegt.
        }
      }
      if (a.verzoegerungMs) {
        const t = setTimeout(senden, a.verzoegerungMs)
        res.on('close', () => clearTimeout(t))
      } else {
        senden()
      }
    })
  })
  server.keepAliveTimeout = 1000
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolve)
  })
  const p = server.address().port
  return {
    port: p,
    host: `127.0.0.1:${p}`,
    url: (pfad) => `https://127.0.0.1:${p}${pfad}`,
    anfragen,
    antwortSetzen(pfad, folge) {
      folgen.set(pfad, [].concat(folge))
    },
    standardSetzen(folge) {
      standard = [].concat(folge)
    },
    get maxGleichzeitig() {
      return maxGleichzeitig
    },
    anfragenAn(pfad) {
      return anfragen.filter((a) => a.pfad === pfad)
    },
    schliessen() {
      server.closeAllConnections?.()
      return new Promise((r) => server.close(() => r()))
    },
    server,
  }
}

// ── Abos, Entschlüsseln, VAPID ──────────────────────────────────────────────

/** Abo wie ein Browser: ECDH P-256 und 16 Byte auth. */
export function aboErzeugen(endpoint) {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const authSecret = crypto.randomBytes(16)
  return {
    ecdh,
    authSecret,
    abo: { endpoint, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: authSecret.toString('base64url') } },
  }
}

function hmac(schluessel, daten) {
  return crypto.createHmac('sha256', schluessel).update(daten).digest()
}

/**
 * Entschlüsseln nach RFC 8291/8188 (aes128gcm), eigenständig mit node:crypto.
 * → { klar: Buffer, rs, idlen, datensaetze }
 */
export function entschluesseln(body, { ecdh, authSecret }) {
  const salt = body.subarray(0, 16)
  const rs = body.readUInt32BE(16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  const daten = body.subarray(21 + idlen)
  if (daten.length > rs) throw new Error('mehr als ein Datensatz')
  const uaPublic = ecdh.getPublicKey()
  const ecdhSecret = ecdh.computeSecret(asPublic)
  const prkKey = hmac(authSecret, ecdhSecret)
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0', 'latin1'), uaPublic, asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0', 'latin1'), Buffer.from([1])])).subarray(0, 16)
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0', 'latin1'), Buffer.from([1])])).subarray(0, 12)
  const tag = daten.subarray(daten.length - 16)
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(tag)
  const roh = Buffer.concat([d.update(daten.subarray(0, daten.length - 16)), d.final()])
  let i = roh.length - 1
  while (i >= 0 && roh[i] === 0) i--
  if (i < 0 || roh[i] !== 2) throw new Error('Trennzeichen des letzten Datensatzes fehlt')
  return { klar: roh.subarray(0, i), rs, idlen, datensaetze: 1 }
}

/** Dasselbe mit http_ece (der Bibliothek, die web-push benutzt). */
export function entschluesselnEce(body, { ecdh, authSecret }) {
  return ece.decrypt(body, { version: 'aes128gcm', privateKey: ecdh, authSecret: authSecret.toString('base64url') })
}

/**
 * Kopfzeile `Authorization: vapid t=<jwt>, k=<key>` prüfen: ES256-Signatur mit dem öffentlichen
 * Schlüssel, aud = Origin des Endpoints, sub = Subject, exp in der Zukunft und höchstens 24 h.
 */
export function vapidPruefen(kopf, { publicKey, subject, origin, jetztS = Math.floor(Date.now() / 1000) }) {
  const m = /^vapid t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+), k=([A-Za-z0-9_-]+)$/.exec(kopf || '')
  if (!m) return { ok: false, fehler: 'Form' }
  const [teilKopf, teilDaten, teilSig] = m[1].split('.')
  if (m[2] !== publicKey) return { ok: false, fehler: 'k' }
  const jkopf = JSON.parse(Buffer.from(teilKopf, 'base64url').toString('utf8'))
  const daten = JSON.parse(Buffer.from(teilDaten, 'base64url').toString('utf8'))
  if (jkopf.alg !== 'ES256') return { ok: false, fehler: 'alg' }
  const pub = Buffer.from(publicKey, 'base64url')
  const key = crypto.createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url') },
    format: 'jwk',
  })
  const gut = crypto.verify('sha256', Buffer.from(`${teilKopf}.${teilDaten}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(teilSig, 'base64url'))
  if (!gut) return { ok: false, fehler: 'Signatur' }
  if (daten.aud !== origin) return { ok: false, fehler: 'aud', daten }
  if (daten.sub !== subject) return { ok: false, fehler: 'sub', daten }
  if (!(daten.exp > jetztS && daten.exp <= jetztS + 24 * 3600)) return { ok: false, fehler: 'exp', daten }
  return { ok: true, daten }
}

// ── Konfiguration, Nachrichten ──────────────────────────────────────────────

let vapidZwischenspeicher
export function testVapid() {
  if (!vapidZwischenspeicher) vapidZwischenspeicher = webpush.generateVAPIDKeys()
  return vapidZwischenspeicher
}

export const TEST_GEHEIMNIS = crypto.randomBytes(32).toString('hex')
export const TEST_SUBJECT = 'https://responda.systems'

/** Umgebung für einen Prüf-Dienst (nie mit PUSH_BETRIEB). */
export function testUmgebung(extra = {}) {
  const v = testVapid()
  return {
    PUSH_HOST: '127.0.0.1',
    PUSH_PORT: '8095',
    PUSH_GEHEIMNIS: TEST_GEHEIMNIS,
    VAPID_PUBLIC_KEY: v.publicKey,
    VAPID_PRIVATE_KEY: v.privateKey,
    VAPID_SUBJECT: TEST_SUBJECT,
    PUSH_GLEICHZEITIG: '8',
    PUSH_WARTESCHLANGE_MAX: '10000',
    ...extra,
  }
}

let idZaehler = 0
/** Kennung wie in push_geraete: 15 Zeichen aus [a-z0-9]. */
export function neueId() {
  idZaehler++
  return ('t' + idZaehler.toString(36) + crypto.randomBytes(8).toString('hex')).slice(0, 15)
}

export function neuerSchluessel(id) {
  return crypto.randomBytes(16).toString('hex') + ':' + id
}

/** Nachricht für /v1/senden; Payload wie 1.3, nur erfundene Inhalte. */
export function nachricht({ id = neueId(), schluessel, abo, payload, ttl = 86400, urgency = 'high', topic } = {}) {
  const n = {
    id,
    schluessel: schluessel ?? neuerSchluessel(id),
    abo,
    payload: payload ?? {
      v: 1,
      titel: 'MPG: Pruefgeraet 1 gesperrt',
      text: 'Grund: Prüfung nicht bestanden.',
      url: '/mpg/geraete/x',
      tag: 'mpg_gesperrt:x',
      anlass: 'mpg_gesperrt',
      fuer: 'pruefperson00001',
      zeit: '2026-11-15T06:00:00.000Z',
    },
    ttl,
    urgency,
  }
  if (topic !== undefined) n.topic = topic
  return n
}

// ── HTTP ────────────────────────────────────────────────────────────────────

/**
 * Anfrage an den Dienst (http, ohne Proxy). body: Objekt (→ JSON), Text oder Buffer.
 * → { status, kopf, text, json }
 */
export function anfrage(basis, pfad, { methode = 'GET', kopf = {}, body, geheimnis = TEST_GEHEIMNIS, ohneGeheimnis = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(pfad, basis)
    const k = { ...kopf }
    if (!ohneGeheimnis && geheimnis !== null && k.Authorization === undefined) k.Authorization = `Bearer ${geheimnis}`
    let daten = null
    if (body !== undefined) {
      daten = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
      if (k['Content-Type'] === undefined) k['Content-Type'] = 'application/json'
      k['Content-Length'] = daten.length
    }
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: methode, headers: k, agent: false }, (res) => {
      const teile = []
      res.on('data', (c) => teile.push(c))
      res.on('end', () => {
        const text = Buffer.concat(teile).toString('utf8')
        let json = null
        try {
          json = JSON.parse(text)
        } catch {
          json = null
        }
        resolve({ status: res.statusCode, kopf: res.headers, text, json })
      })
    })
    req.on('error', reject)
    if (daten) req.write(daten)
    req.end()
  })
}

export function senden(basis, nachrichten, { auftrag = 'pruef' + crypto.randomBytes(3).toString('hex'), geheimnis } = {}) {
  return anfrage(basis, '/v1/senden', { methode: 'POST', body: { auftrag, nachrichten }, ...(geheimnis !== undefined ? { geheimnis } : {}) })
}

// ── Dienst starten ──────────────────────────────────────────────────────────

/**
 * Dienst im selben Prozess (lib/server.mjs). `uhr` erlaubt eine gespielte Uhr.
 * → { basis, server, versand, konfig, zeilen, stoppen() }
 */
export async function dienstImProzess({ env = {}, jetzt, versandOptionen = {}, mitProtokoll = false } = {}) {
  const { konfigurationLesen } = await import('../lib/konfiguration.mjs')
  const { dienstAufbauen } = await import('../lib/server.mjs')
  const { protokollErzeugen } = await import('../lib/protokoll.mjs')
  const k = konfigurationLesen(testUmgebung(env))
  if (!k.ok) throw new Error('Prüf-Konfiguration ungültig: ' + k.fehler.join(' '))
  const zeilen = []
  const protokoll = mitProtokoll ? protokollErzeugen({ schreiben: (z) => zeilen.push(z), jetzt: jetzt || Date.now }) : undefined
  const d = dienstAufbauen({
    konfig: k.konfig,
    ...(protokoll ? { protokoll } : {}),
    ...(jetzt ? { jetzt } : {}),
    versandOptionen: { aufraeumenMs: 0, ...versandOptionen },
  })
  await new Promise((r) => d.server.listen(0, '127.0.0.1', r))
  const basis = `http://127.0.0.1:${d.server.address().port}`
  return {
    basis,
    ...d,
    konfig: k.konfig,
    zeilen,
    async stoppen() {
      await d.versand.anhalten(2000)
      d.server.closeAllConnections?.()
      await new Promise((r) => d.server.close(() => r()))
      d.agent.destroy()
    },
  }
}

export function freierPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => resolve(p))
    })
  })
}

/**
 * Dienst als eigener Prozess (`node dienst.mjs`) mit sauberer Umgebung.
 * → { proc, port, basis, stdout(), stderr(), ende: Promise<{code, signal}> }
 * Mit `erwarteStart: false` wird nicht auf die Startzeile gewartet (Start soll scheitern).
 */
export async function dienstProzess({ env = {}, nodeArgs = [], erwarteStart = true, port } = {}) {
  const p = port ?? (await freierPort())
  const umgebung = { PATH: process.env.PATH, ...testUmgebung({ PUSH_PORT: String(p), ...env }) }
  for (const [k, v] of Object.entries(umgebung)) if (v === undefined || v === null) delete umgebung[k]
  const proc = spawn(process.execPath, [...nodeArgs, DIENST_MJS], { cwd: DIENST_VERZ, env: umgebung, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  let err = ''
  proc.stdout.on('data', (c) => (out += c))
  proc.stderr.on('data', (c) => (err += c))
  const ende = new Promise((resolve) => proc.on('exit', (code, signal) => resolve({ code, signal })))
  const ergebnis = { proc, port: p, basis: `http://127.0.0.1:${p}`, stdout: () => out, stderr: () => err, ende }
  if (erwarteStart) {
    const ok = await bisWahr(() => out.includes('"ereignis":"start"') || proc.exitCode !== null, 10000)
    if (!ok || proc.exitCode !== null) {
      proc.kill('SIGKILL')
      throw new Error(`Dienst startet nicht: ${err || out}`)
    }
  }
  return ergebnis
}

/** Protokollzeilen (JSON) aus einer Ausgabe. */
export function zeilenLesen(text) {
  return text
    .split('\n')
    .filter((z) => z.trim() !== '')
    .map((z) => {
      try {
        return JSON.parse(z)
      } catch {
        return { roh: z }
      }
    })
}
