// Umgebung lesen und prüfen (Bauplan 5, Härtung). Rein bis auf das Lesen der Prüf-CA.
// Fehler → { ok: false, fehler: [deutsche Sätze] }; dienst.mjs meldet sie und endet mit Code 1.
// Kein Satz enthält ein Geheimnis oder einen Schlüssel.

import crypto from 'node:crypto'
import fs from 'node:fs'
import { TEST_HOST_RE } from './pruefen.mjs'

export const NODE_MINDESTENS = 22

export const VORGABEN = Object.freeze({
  host: '127.0.0.1',
  port: 8095,
  gleichzeitig: 8,
  warteschlangeMax: 10000,
})

const B64URL_RE = /^[A-Za-z0-9_-]+$/

export function nodeVersionReicht(version) {
  const m = /^v?([0-9]+)\./.exec(String(version || ''))
  return !!m && Number(m[1]) >= NODE_MINDESTENS
}

function ganzzahl(text, min, max) {
  if (typeof text !== 'string' || !/^[0-9]{1,9}$/.test(text)) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

function leer(wert) {
  return wert === undefined || wert === null || String(wert).trim() === ''
}

/** Prüft, ob öffentlicher und privater VAPID-Schlüssel ein Paar auf P-256 sind. */
export function vapidPaarPruefen(publicKey, privateKey) {
  if (typeof publicKey !== 'string' || !B64URL_RE.test(publicKey)) return 'VAPID_PUBLIC_KEY ist kein base64url-Text.'
  if (typeof privateKey !== 'string' || !B64URL_RE.test(privateKey)) return 'VAPID_PRIVATE_KEY ist kein base64url-Text.'
  const pub = Buffer.from(publicKey, 'base64url')
  const priv = Buffer.from(privateKey, 'base64url')
  if (pub.length !== 65 || pub[0] !== 0x04) return 'VAPID_PUBLIC_KEY hat nicht die Form eines öffentlichen P-256-Schlüssels (65 Bytes).'
  if (priv.length !== 32) return 'VAPID_PRIVATE_KEY hat nicht die Länge eines privaten P-256-Schlüssels (32 Bytes).'
  try {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(priv)
    if (!crypto.timingSafeEqual(ecdh.getPublicKey(), pub)) {
      return 'VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY passen nicht zueinander.'
    }
  } catch {
    return 'VAPID_PRIVATE_KEY ist kein gültiger privater P-256-Schlüssel.'
  }
  return null
}

/** Subject muss mit mailto: oder https:// beginnen (Apple verlangt das); localhost lehnt Apple ab. */
export function subjectPruefen(subject) {
  if (typeof subject !== 'string' || subject.trim() === '') return 'VAPID_SUBJECT fehlt (Vorgabe: https://responda.systems).'
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    return 'VAPID_SUBJECT muss mit mailto: oder https:// beginnen.'
  }
  let u
  try {
    u = new URL(subject)
  } catch {
    return 'VAPID_SUBJECT ist keine gültige Adresse.'
  }
  if (u.protocol === 'https:' && (u.hostname === 'localhost' || u.hostname === '' || u.hostname.endsWith('.localhost'))) {
    return 'VAPID_SUBJECT darf nicht auf localhost zeigen (Apple lehnt das ab).'
  }
  return null
}

/**
 * Konfiguration aus der Umgebung.
 * @param env  process.env oder ein Objekt mit denselben Namen
 * @param opt.nodeVersion  Version, gegen die geprüft wird (Vorgabe: die laufende)
 * @returns { ok: true, konfig } | { ok: false, fehler: string[] }
 */
export function konfigurationLesen(env = process.env, { nodeVersion = process.versions.node } = {}) {
  const fehler = []

  if (!nodeVersionReicht(nodeVersion)) {
    fehler.push(`Node ${nodeVersion} ist zu alt: Der Push-Dienst braucht Node ${NODE_MINDESTENS} oder neuer (Ziel: Node 24 LTS).`)
  }

  const host = leer(env.PUSH_HOST) ? VORGABEN.host : String(env.PUSH_HOST).trim()
  if (host !== '127.0.0.1' && host !== '::1') {
    fehler.push('PUSH_HOST muss 127.0.0.1 oder ::1 sein: Der Dienst ist nur lokal erreichbar.')
  }

  let port = VORGABEN.port
  if (!leer(env.PUSH_PORT)) {
    port = ganzzahl(String(env.PUSH_PORT).trim(), 1, 65535)
    if (port === null) fehler.push('PUSH_PORT ist keine Portnummer zwischen 1 und 65535.')
  }

  const geheimnis = typeof env.PUSH_GEHEIMNIS === 'string' ? env.PUSH_GEHEIMNIS : ''
  if (geheimnis.length < 32) {
    fehler.push('PUSH_GEHEIMNIS fehlt oder ist kürzer als 32 Zeichen.')
  } else if (!/^[\x21-\x7e]+$/.test(geheimnis)) {
    fehler.push('PUSH_GEHEIMNIS darf nur sichtbare ASCII-Zeichen enthalten (kein Leerzeichen).')
  }

  const publicKey = typeof env.VAPID_PUBLIC_KEY === 'string' ? env.VAPID_PUBLIC_KEY.trim() : ''
  const privateKey = typeof env.VAPID_PRIVATE_KEY === 'string' ? env.VAPID_PRIVATE_KEY.trim() : ''
  if (publicKey === '' || privateKey === '') {
    fehler.push('VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY müssen gesetzt sein (schluessel-erzeugen.mjs).')
  } else {
    const f = vapidPaarPruefen(publicKey, privateKey)
    if (f) fehler.push(f)
  }

  const subject = typeof env.VAPID_SUBJECT === 'string' ? env.VAPID_SUBJECT.trim() : ''
  const fs1 = subjectPruefen(subject)
  if (fs1) fehler.push(fs1)

  let gleichzeitig = VORGABEN.gleichzeitig
  if (!leer(env.PUSH_GLEICHZEITIG)) {
    gleichzeitig = ganzzahl(String(env.PUSH_GLEICHZEITIG).trim(), 1, 256)
    if (gleichzeitig === null) fehler.push('PUSH_GLEICHZEITIG ist keine Zahl zwischen 1 und 256.')
  }

  let warteschlangeMax = VORGABEN.warteschlangeMax
  if (!leer(env.PUSH_WARTESCHLANGE_MAX)) {
    warteschlangeMax = ganzzahl(String(env.PUSH_WARTESCHLANGE_MAX).trim(), 1, 1000000)
    if (warteschlangeMax === null) fehler.push('PUSH_WARTESCHLANGE_MAX ist keine Zahl zwischen 1 und 1000000.')
  }

  const betrieb = String(env.PUSH_BETRIEB ?? '').trim() === '1'
  const testHostsRoh = leer(env.PUSH_TEST_HOSTS) ? '' : String(env.PUSH_TEST_HOSTS).trim()
  const testCaPfad = leer(env.PUSH_TEST_CA) ? '' : String(env.PUSH_TEST_CA).trim()

  if (betrieb && (testHostsRoh !== '' || testCaPfad !== '')) {
    fehler.push('PUSH_BETRIEB=1 zusammen mit PUSH_TEST_HOSTS oder PUSH_TEST_CA: Prüf-Einstellungen sind im Betrieb verboten.')
  }

  const testHosts = []
  if (testHostsRoh !== '') {
    for (const teil of testHostsRoh.split(',')) {
      const h = teil.trim()
      if (!TEST_HOST_RE.test(h) || ganzzahl(h.split(':')[1], 1, 65535) === null) {
        fehler.push('PUSH_TEST_HOSTS darf nur Einträge der Form 127.0.0.1:<port> enthalten.')
        break
      }
      if (!testHosts.includes(h)) testHosts.push(h)
    }
  }

  let testCa = null
  if (testCaPfad !== '') {
    try {
      testCa = fs.readFileSync(testCaPfad)
      if (!testCa.toString('utf8').includes('BEGIN CERTIFICATE')) {
        fehler.push('PUSH_TEST_CA ist keine PEM-Datei mit Zertifikat.')
        testCa = null
      }
    } catch {
      fehler.push('PUSH_TEST_CA lässt sich nicht lesen.')
    }
  }

  if (fehler.length > 0) return { ok: false, fehler }
  return {
    ok: true,
    konfig: Object.freeze({
      host,
      port,
      geheimnis,
      vapid: Object.freeze({ subject, publicKey, privateKey }),
      gleichzeitig,
      warteschlangeMax,
      betrieb,
      testHosts: Object.freeze(testHosts),
      testCa,
    }),
  }
}
