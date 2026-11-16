// Prüffälle für lib/pruefen.mjs: Endpoints (gleiche Fälle wie PocketBase, Bauplan 4.7, dazu
// `new URL`), Schlüssel, Payload-Grenze und Auffüllen, ttl, urgency, topic, Kennungen.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  HOSTS,
  GRENZEN,
  auffuellen,
  auftragPruefen,
  endpointPruefen,
  hostErlaubt,
  keysPruefen,
  nachrichtPruefen,
  payloadBytes,
} from '../lib/pruefen.mjs'
import { DIENST_VERZ, aboErzeugen, nachricht } from './hilfe.mjs'

const GUELTIGE_KEYS = aboErzeugen('https://fcm.googleapis.com/fcm/send/x').abo.keys

const GUELTIG = [
  'https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-erfunden_Token-123',
  'https://web.push.apple.com/QGhP3tJ6erfundenAbc-_1',
  'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABerfunden',
  'https://push.services.mozilla.com/wpush/v1/erfunden',
  'https://db5p.notify.windows.com/w/?token=BQYAAABerfunden%2bXYZ%3d',
  'https://wns2-db5p.notify.windows.com/w/erfunden',
  'https://fcm.googleapis.com/fcm/send/a~b.c%2Fd+e=f',
]

const UNGUELTIG = {
  http: 'http://fcm.googleapis.com/fcm/send/x',
  'fremder Host': 'https://push.example.com/x',
  'Endung angehängt': 'https://fcm.googleapis.com.evil.de/x',
  'Apple-Endung angehängt': 'https://evil.push.apple.com.de/x',
  'Großbuchstaben im Host': 'https://FCM.googleapis.com/fcm/send/x',
  'Punkt am Ende': 'https://fcm.googleapis.com./fcm/send/x',
  'leeres Label': 'https://fcm..googleapis.com/x',
  'leeres Label vor Endung': 'https://a..push.apple.com/x',
  'Port 8443': 'https://fcm.googleapis.com:8443/fcm/send/x',
  'Port 443 ausgeschrieben': 'https://fcm.googleapis.com:443/fcm/send/x',
  Benutzerteil: 'https://x@fcm.googleapis.com/fcm/send/x',
  'Benutzer und Passwort': 'https://x:y@fcm.googleapis.com/fcm/send/x',
  Backslash: 'https://fcm.googleapis.com/fcm\\send/x',
  'Backslash nach Host': 'https://fcm.googleapis.com\\@evil.de/x',
  Fragment: 'https://fcm.googleapis.com/fcm/send/x#y',
  Leerzeichen: 'https://fcm.googleapis.com/fcm/send/x y',
  Tab: 'https://fcm.googleapis.com/fcm/send/x\ty',
  Zeilenumbruch: 'https://fcm.googleapis.com/fcm/send/x\ny',
  'Query außerhalb WNS': 'https://fcm.googleapis.com/fcm/send/x?token=abc',
  'Query bei Apple': 'https://web.push.apple.com/x?y=1',
  'WNS mit anderer Query': 'https://db5p.notify.windows.com/w/?id=1',
  'WNS leeres Label': 'https://a..notify.windows.com/w/?token=abc',
  'WNS Label mit Bindestrich vorn': 'https://-a.notify.windows.com/w/?token=abc',
  'WNS ohne Unterdomäne mit Token': 'https://notify.windows.com/w/?token=abc',
  'Endung ohne Unterdomäne (Apple)': 'https://push.apple.com/x',
  'Endung ohne Unterdomäne (WNS)': 'https://notify.windows.com/x',
  'ohne Pfad': 'https://fcm.googleapis.com',
  'Punkte im Pfad (URL normalisiert)': 'https://fcm.googleapis.com/fcm/../x',
  'IP-Adresse': 'https://127.0.0.1/x',
  IPv6: 'https://[::1]/x',
  'Umlaut im Host': 'https://fcm.googleapis.cöm/x',
  'Prüf-Host ohne Liste': 'https://127.0.0.1:8631/abo/1',
  leer: '',
}

test('Endpoint: gültige Adressen der vier Hersteller', () => {
  for (const e of GUELTIG) {
    assert.equal(endpointPruefen(e).ok, true, e)
    assert.equal(nachrichtPruefen(nachricht({ abo: { endpoint: e, keys: GUELTIGE_KEYS } })).ok, true, e)
  }
})

test('Endpoint: ungültige Adressen (Liste aus 4.7 und new URL)', () => {
  for (const [name, e] of Object.entries(UNGUELTIG)) {
    assert.equal(endpointPruefen(e).ok, false, name)
    const r = nachrichtPruefen(nachricht({ abo: { endpoint: e, keys: GUELTIGE_KEYS } }))
    assert.equal(r.ok, false, name)
    assert.equal(r.grund, 'endpoint', name)
  }
  for (const e of [undefined, null, 42, {}, ['https://fcm.googleapis.com/x']]) {
    assert.equal(endpointPruefen(e).ok, false)
  }
})

test('Endpoint: höchstens 1000 Zeichen', () => {
  const basis = 'https://fcm.googleapis.com/fcm/send/'
  const e1000 = basis + 'a'.repeat(1000 - basis.length)
  const e1001 = basis + 'a'.repeat(1001 - basis.length)
  assert.equal(e1000.length, 1000)
  assert.equal(endpointPruefen(e1000).ok, true)
  assert.equal(endpointPruefen(e1001).ok, false)
})

test('Endpoint: Prüf-Hosts nur mit Liste, nur genau dieser Port', () => {
  const e = 'https://127.0.0.1:8631/abo/1'
  assert.equal(endpointPruefen(e, []).ok, false)
  assert.deepEqual(endpointPruefen(e, ['127.0.0.1:8631']), { ok: true, host: '127.0.0.1:8631' })
  assert.equal(endpointPruefen(e, ['127.0.0.1:8632']).ok, false)
  assert.equal(endpointPruefen('https://127.0.0.1/abo/1', ['127.0.0.1:8631']).ok, false)
  assert.equal(endpointPruefen('https://127.0.0.1:8631/abo/1?x=1', ['127.0.0.1:8631']).ok, false)
  assert.equal(endpointPruefen('https://localhost:8631/abo/1', ['127.0.0.1:8631']).ok, false)
  // Ein Prüf-Host macht keinen anderen Host erlaubt
  assert.equal(endpointPruefen('https://push.example.com/x', ['127.0.0.1:8631']).ok, false)
})

test('hostErlaubt: exakte Einträge und Endungen', () => {
  assert.equal(hostErlaubt('fcm.googleapis.com'), true)
  assert.equal(hostErlaubt('web.push.apple.com'), true)
  assert.equal(hostErlaubt('push.apple.com'), false)
  assert.equal(hostErlaubt('push.services.mozilla.com'), true)
  assert.equal(hostErlaubt('updates.push.services.mozilla.com'), true)
  assert.equal(hostErlaubt('db5p.notify.windows.com'), true)
  assert.equal(hostErlaubt('xfcm.googleapis.com'), false)
  assert.equal(hostErlaubt('fcm.googleapis.com.evil.de'), false)
  assert.equal(hostErlaubt('evilpush.apple.com'), false)
  assert.equal(hostErlaubt('127.0.0.1:8631'), false)
  assert.equal(hostErlaubt('127.0.0.1:8631', ['127.0.0.1:8631']), true)
  assert.equal(hostErlaubt(''), false)
  assert.equal(hostErlaubt(null), false)
})

test('HOSTS steht als einzeilige Liste in pruefen.mjs (Gleichlauf mit PocketBase per Regex)', () => {
  const text = fs.readFileSync(path.join(DIENST_VERZ, 'lib', 'pruefen.mjs'), 'utf8')
  const m = /export const HOSTS = \[([^\]\n]*)\]/.exec(text)
  assert.ok(m, 'Zeile mit HOSTS = [...] fehlt')
  const liste = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
  assert.deepEqual(liste, [...HOSTS])
  assert.deepEqual([...HOSTS], ['fcm.googleapis.com', '.push.apple.com', 'push.services.mozilla.com', '.push.services.mozilla.com', '.notify.windows.com'])
  assert.ok(Object.isFrozen(HOSTS))
})

test('Schlüssel des Abos: Länge, Zeichen, angehängtes =', () => {
  const { p256dh, auth } = GUELTIGE_KEYS
  assert.deepEqual(keysPruefen({ p256dh, auth }), { ok: true, keys: { p256dh, auth } })
  assert.deepEqual(keysPruefen({ p256dh: p256dh + '=', auth: auth + '==' }), { ok: true, keys: { p256dh, auth } })
  const falsch = [
    { p256dh: p256dh + '===', auth },
    { p256dh: p256dh.slice(0, 86), auth },
    { p256dh: p256dh + 'A', auth },
    { p256dh: 'C' + p256dh.slice(1), auth },
    { p256dh: p256dh.slice(0, 40) + '+' + p256dh.slice(41), auth },
    { p256dh: p256dh.slice(0, 40) + '/' + p256dh.slice(41), auth },
    { p256dh, auth: auth.slice(0, 21) },
    { p256dh, auth: auth + 'A' },
    { p256dh, auth: auth + '===' },
    { p256dh },
    { auth },
    { p256dh: 5, auth },
  ]
  for (const k of falsch) {
    assert.equal(keysPruefen(k).ok, false, JSON.stringify(k))
    const r = nachrichtPruefen(nachricht({ abo: { endpoint: GUELTIG[0], keys: k } }))
    assert.equal(r.grund, 'keys')
  }
  assert.equal(nachrichtPruefen(nachricht({ abo: { endpoint: GUELTIG[0] } })).grund, 'keys')
  assert.equal(nachrichtPruefen(nachricht({ abo: { endpoint: GUELTIG[0], keys: null } })).grund, 'keys')
})

function payloadMitBytes(n) {
  // {"v":1,"titel":"…"} genau n Bytes, mit Umlauten (2 Bytes) und einem Ersatzpaar (4 Bytes)
  const kopf = { v: 1, titel: 'Prüfung ✓ 😀 ' }
  const rest = n - payloadBytes({ ...kopf, text: '' })
  const p = { ...kopf, text: 'x'.repeat(rest) }
  assert.equal(payloadBytes(p), n)
  return p
}

test('Payload: höchstens 3800 Bytes UTF-8', () => {
  const a = { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS }
  assert.equal(nachrichtPruefen(nachricht({ abo: a, payload: payloadMitBytes(3800) })).ok, true)
  const r = nachrichtPruefen(nachricht({ abo: a, payload: payloadMitBytes(3801) }))
  assert.deepEqual([r.ok, r.grund], [false, 'payload'])
})

test('Payload: vorhandenes Feld f, kein Objekt', () => {
  const a = { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS }
  assert.equal(nachrichtPruefen(nachricht({ abo: a, payload: { v: 1, f: '' } })).grund, 'payload')
  assert.equal(nachrichtPruefen(nachricht({ abo: a, payload: JSON.parse('{"v":1,"f":null}') })).grund, 'payload')
  for (const p of [null, [], 'text', 5, true]) {
    const n = nachricht({ abo: a })
    n.payload = p
    assert.equal(nachrichtPruefen(n).grund, 'payload', JSON.stringify(p))
  }
})

test('Auffüllen: genau 2048 Bytes, größere genau 3800, Inhalt unverändert', () => {
  for (const n of [2, 60, 500, 1999, 2000, 2041]) {
    const p = n === 2 ? {} : payloadMitBytes(n)
    const s = auffuellen(p)
    assert.equal(Buffer.byteLength(s, 'utf8'), 2048, `Größe ${n}`)
    const zurueck = JSON.parse(s)
    assert.match(zurueck.f, /^0*$/)
    delete zurueck.f
    assert.deepEqual(zurueck, p)
  }
  for (const n of [2042, 2048, 2500, 3793]) {
    const s = auffuellen(payloadMitBytes(n))
    assert.equal(Buffer.byteLength(s, 'utf8'), 3800, `Größe ${n}`)
  }
  assert.equal(Buffer.byteLength(auffuellen(payloadMitBytes(3794)), 'utf8'), 3801)
  // Ganz knapp unter der Grenze passt das leere Feld nicht mehr ganz hinein: höchstens 3807 Bytes
  // (weit unter 3993, einem Datensatz nach RFC 8291).
  const s = auffuellen(payloadMitBytes(3800))
  assert.equal(Buffer.byteLength(s, 'utf8'), 3807)
  assert.equal(JSON.parse(s).f, '')
})

test('Auffüllen über nachrichtPruefen', () => {
  const r = nachrichtPruefen(nachricht({ abo: { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS } }))
  assert.equal(r.ok, true)
  assert.equal(Buffer.byteLength(r.nachricht.payloadText, 'utf8'), 2048)
})

test('ttl: ganze Sekunden 0 bis 604800', () => {
  const a = { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS }
  for (const t of [0, 1, 86400, 604800]) assert.equal(nachrichtPruefen(nachricht({ abo: a, ttl: t })).ok, true, String(t))
  for (const t of [-1, 604801, 1.5, '60', NaN, Infinity, null]) {
    assert.equal(nachrichtPruefen(nachricht({ abo: a, ttl: t })).grund, 'ttl', String(t))
  }
  const n = nachricht({ abo: a })
  delete n.ttl
  assert.equal(nachrichtPruefen(n).grund, 'ttl')
})

test('urgency: nur very-low, low, normal, high', () => {
  const a = { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS }
  for (const u of ['very-low', 'low', 'normal', 'high']) assert.equal(nachrichtPruefen(nachricht({ abo: a, urgency: u })).ok, true, u)
  for (const u of ['HIGH', 'urgent', '', 1, null]) {
    assert.equal(nachrichtPruefen(nachricht({ abo: a, urgency: u })).grund, 'urgency', String(u))
  }
})

test('topic: optional, höchstens 32 Zeichen aus [A-Za-z0-9_-]', () => {
  const a = { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS }
  assert.equal(nachrichtPruefen(nachricht({ abo: a })).nachricht.topic, null)
  assert.equal(nachrichtPruefen(nachricht({ abo: a, topic: null })).nachricht.topic, null)
  assert.equal(nachrichtPruefen(nachricht({ abo: a, topic: 'a'.repeat(32) })).nachricht.topic, 'a'.repeat(32))
  assert.equal(nachrichtPruefen(nachricht({ abo: a, topic: '3f2a9c1b0d4e5f6a7b8c9d0e1f2a3b4c' })).ok, true)
  for (const t of ['a'.repeat(33), 'ab+c', 'a b', '', 'ä', 5]) {
    assert.equal(nachrichtPruefen(nachricht({ abo: a, topic: t })).grund, 'topic', String(t))
  }
})

test('Kennungen: id und Nachrichtenschlüssel', () => {
  const a = { endpoint: GUELTIG[0], keys: GUELTIGE_KEYS }
  const ohne = nachricht({ abo: a })
  delete ohne.schluessel
  assert.deepEqual(nachrichtPruefen(ohne), { ok: false, id: ohne.id, grund: 'kennung' })
  for (const s of ['', 'A:abc', 'a b', 'ä', 'a'.repeat(101), 5]) {
    assert.equal(nachrichtPruefen(nachricht({ abo: a, schluessel: s })).grund, 'kennung', String(s))
  }
  assert.equal(nachrichtPruefen(nachricht({ abo: a, schluessel: 'e7c1d0a9b8f2c3d4e5f6a7b8c9d0e1f2:abcdefghijk1234' })).ok, true)
  assert.equal(nachrichtPruefen(nachricht({ abo: a, schluessel: 'a'.repeat(100) })).ok, true)
  for (const id of ['abcdefghijk123', 'abcdefghijk12345', 'ABCDEFGHIJK1234', 'abcdefghijk-234', 5]) {
    assert.deepEqual(nachrichtPruefen(nachricht({ abo: a, id })), { ok: false, id: null, grund: 'kennung' }, String(id))
  }
  for (const n of [null, 'x', [], 5]) assert.deepEqual(nachrichtPruefen(n), { ok: false, id: null, grund: 'kennung' })
})

test('Form des Auftrags', () => {
  assert.equal(auftragPruefen({ auftrag: 'k3m9x2qa7b1c4d5', nachrichten: [] }).ok, true)
  assert.equal(auftragPruefen({ auftrag: 'a', nachrichten: new Array(GRENZEN.nachrichten).fill({}) }).ok, true)
  assert.equal(auftragPruefen({ auftrag: 'a', nachrichten: new Array(GRENZEN.nachrichten + 1).fill({}) }).ok, false)
  for (const b of [null, [], 'x', {}, { nachrichten: [] }, { auftrag: 'A', nachrichten: [] }, { auftrag: 'a'.repeat(41), nachrichten: [] }, { auftrag: 'a', nachrichten: {} }]) {
    assert.equal(auftragPruefen(b).ok, false, JSON.stringify(b))
  }
})
