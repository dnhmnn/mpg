// Prüffälle für lib/server.mjs (Vertrag 1.1): Geheimnis, Grenzen, Form, Doppelte am
// Nachrichtenschlüssel (auch über zwei Aufträge, gespielte Uhr), Warteschlange voll.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { geheimnisPasst } from '../lib/server.mjs'
import {
  OHNE_OPENSSL,
  TEST_GEHEIMNIS,
  aboErzeugen,
  anfrage,
  bisWahr,
  dienstImProzess,
  fakeEndpunktStarten,
  nachricht,
  senden,
  testVapid,
  tlsVorbereiten,
  warten,
} from './hilfe.mjs'

let d
before(async () => {
  d = await dienstImProzess()
})
after(async () => {
  await d.stoppen()
})

test('geheimnisPasst: nur genau "Bearer <Geheimnis>"', () => {
  const g = 'a'.repeat(64)
  assert.equal(geheimnisPasst(`Bearer ${g}`, g), true)
  assert.equal(geheimnisPasst(`bearer ${g}`, g), true)
  assert.equal(geheimnisPasst(`Bearer ${'b'.repeat(64)}`, g), false)
  assert.equal(geheimnisPasst(`Bearer ${g.slice(0, 63)}`, g), false)
  assert.equal(geheimnisPasst(`Bearer ${g}x`, g), false)
  assert.equal(geheimnisPasst(`Bearer  ${g}`, g), false)
  assert.equal(geheimnisPasst(`Basic ${g}`, g), false)
  assert.equal(geheimnisPasst(g, g), false)
  assert.equal(geheimnisPasst('Bearer ', g), false)
  assert.equal(geheimnisPasst(undefined, g), false)
  assert.equal(geheimnisPasst('Bearer x', ''), false)
})

test('ohne, mit falschem und mit zu kurzem Geheimnis: 401 auf allen Routen', async () => {
  const falschGleichLang = crypto.randomBytes(32).toString('hex')
  assert.equal(falschGleichLang.length, TEST_GEHEIMNIS.length)
  const varianten = [
    { ohneGeheimnis: true },
    { geheimnis: falschGleichLang },
    { geheimnis: TEST_GEHEIMNIS.slice(0, 40) },
    { kopf: { Authorization: `Basic ${TEST_GEHEIMNIS}` } },
  ]
  const routen = [
    ['GET', '/v1/schluessel'],
    ['GET', '/v1/stand'],
    ['POST', '/v1/senden'],
    ['POST', '/v1/rueckmeldungen'],
    ['GET', '/v1/gibtsnicht'],
  ]
  for (const v of varianten) {
    for (const [methode, pfad] of routen) {
      const r = await anfrage(d.basis, pfad, { methode, ...v, ...(methode === 'POST' ? { body: { auftrag: 'a', nachrichten: [] } } : {}) })
      assert.equal(r.status, 401, `${methode} ${pfad} ${JSON.stringify(Object.keys(v))}`)
      assert.deepEqual(r.json, { fehler: 'geheimnis' })
    }
  }
})

test('/v1/gesund ohne Geheimnis: 200 {"ok":true}, verrät nichts weiter', async () => {
  const r = await anfrage(d.basis, '/v1/gesund', { ohneGeheimnis: true })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { ok: true })
  assert.equal(r.kopf['cache-control'], 'no-store')
  assert.equal((await anfrage(d.basis, '/v1/gesund', { methode: 'POST', ohneGeheimnis: true })).status, 405)
})

test('/v1/schluessel liefert den öffentlichen VAPID-Schlüssel', async () => {
  const r = await anfrage(d.basis, '/v1/schluessel')
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { publicKey: testVapid().publicKey })
  assert.equal(r.json.publicKey.length, 87)
})

test('unbekannte Route 404, falsche Methode 405', async () => {
  assert.equal((await anfrage(d.basis, '/v1/gibtsnicht')).status, 404)
  assert.equal((await anfrage(d.basis, '/v1/senden')).status, 405)
  assert.equal((await anfrage(d.basis, '/v1/stand', { methode: 'POST', body: {} })).status, 405)
})

test('Body: kein JSON, falsche Form, 501 Nachrichten, text/plain → 400', async () => {
  const faelle = [
    { body: '{kaputt' },
    { body: Buffer.from([0x7b, 0xff, 0xfe, 0x7d]) },
    { body: '[]' },
    { body: { nachrichten: [] } },
    { body: { auftrag: 'A-B', nachrichten: [] } },
    { body: { auftrag: 'a', nachrichten: 'x' } },
    { body: { auftrag: 'a', nachrichten: new Array(501).fill(null) } },
    { body: JSON.stringify({ auftrag: 'a', nachrichten: [] }), kopf: { 'Content-Type': 'text/plain' } },
    { body: JSON.stringify({ auftrag: 'a', nachrichten: [] }), kopf: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  ]
  for (const f of faelle) {
    const r = await anfrage(d.basis, '/v1/senden', { methode: 'POST', ...f })
    assert.equal(r.status, 400, JSON.stringify(f).slice(0, 80))
    assert.deepEqual(r.json, { fehler: 'body' })
  }
  const r = await anfrage(d.basis, '/v1/senden', { methode: 'POST', body: { auftrag: 'a', nachrichten: new Array(500).fill(null) } })
  assert.equal(r.status, 202)
  assert.equal(r.json.abgelehnt.length, 500)
})

test('Body: genau 1 MB geht, 1 MB + 1 Byte → 413', async () => {
  const MB = 1048576
  const huelle = (n) => {
    const basis = JSON.stringify({ auftrag: 'gross', nachrichten: [], x: '' })
    return JSON.stringify({ auftrag: 'gross', nachrichten: [], x: 'y'.repeat(n - Buffer.byteLength(basis)) })
  }
  const genau = huelle(MB)
  assert.equal(Buffer.byteLength(genau), MB)
  const r1 = await anfrage(d.basis, '/v1/senden', { methode: 'POST', body: genau })
  assert.equal(r1.status, 202)
  const r2 = await anfrage(d.basis, '/v1/senden', { methode: 'POST', body: huelle(MB + 1) })
  assert.equal(r2.status, 413)
  assert.deepEqual(r2.json, { fehler: 'zu_gross' })
  // Auch weit darüber kommt die Antwort an (Verbindung wird danach geschlossen)
  const r3 = await anfrage(d.basis, '/v1/senden', { methode: 'POST', body: huelle(5 * MB) })
  assert.equal(r3.status, 413)
})

test('fehlender Nachrichtenschlüssel → abgelehnt "kennung"; abgelehnte Nachrichten senden nichts', async () => {
  const { abo } = aboErzeugen('https://fcm.googleapis.com/fcm/send/erfunden')
  const n = nachricht({ abo })
  delete n.schluessel
  const falscherHost = nachricht({ abo: { ...abo, endpoint: 'https://push.example.com/x' } })
  const r = await senden(d.basis, [n, falscherHost])
  assert.equal(r.status, 202)
  assert.deepEqual(r.json, {
    angenommen: 0,
    doppelt: 0,
    abgelehnt: [
      { id: n.id, grund: 'kennung' },
      { id: falscherHost.id, grund: 'endpoint' },
    ],
  })
})

test('/v1/rueckmeldungen und /v1/stand: Form', async () => {
  const r = await anfrage(d.basis, '/v1/rueckmeldungen', { methode: 'POST', body: {} })
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.json).sort(), ['fehler', 'warnung', 'weg'])
  const leer = await anfrage(d.basis, '/v1/rueckmeldungen', { methode: 'POST', body: '' })
  assert.equal(leer.status, 200)
  const s = await anfrage(d.basis, '/v1/stand')
  assert.equal(s.status, 200)
  assert.deepEqual(Object.keys(s.json).sort(), ['angenommen', 'doppelt', 'fehler', 'gesendet', 'seit', 'warnung', 'wartend', 'weg', 'zurueckgehalten'])
  for (const k of ['angenommen', 'doppelt', 'fehler', 'gesendet', 'wartend', 'weg', 'zurueckgehalten']) assert.equal(typeof s.json[k], 'number')
  assert.match(s.json.seit, /^\d{4}-\d{2}-\d{2}T/)
})

test('gleicher Nachrichtenschlüssel zweimal (zwei Aufträge): doppelt, nur eine Anfrage; nach 24 h wieder', async (t) => {
  const tls = tlsVorbereiten()
  if (!tls) return t.skip(OHNE_OPENSSL)
  const ep = await fakeEndpunktStarten({ tls })
  const uhr = { ms: Date.now() }
  const dd = await dienstImProzess({ env: { PUSH_TEST_HOSTS: ep.host, PUSH_TEST_CA: tls.caPfad }, jetzt: () => uhr.ms })
  try {
    const { abo } = aboErzeugen(ep.url('/abo/doppelt'))
    const n = nachricht({ abo })
    const r1 = await senden(dd.basis, [n], { auftrag: 'eins' })
    assert.deepEqual(r1.json, { angenommen: 1, doppelt: 0, abgelehnt: [] })
    await dd.versand.fertig()
    const r2 = await senden(dd.basis, [n], { auftrag: 'zwei' })
    assert.deepEqual(r2.json, { angenommen: 0, doppelt: 1, abgelehnt: [] })
    // im selben Auftrag zweimal: einmal angenommen, einmal doppelt
    const m = nachricht({ abo })
    const r3 = await senden(dd.basis, [m, { ...m }], { auftrag: 'drei' })
    assert.deepEqual(r3.json, { angenommen: 1, doppelt: 1, abgelehnt: [] })
    await dd.versand.fertig()
    assert.equal(ep.anfragenAn('/abo/doppelt').length, 2)

    uhr.ms += 23 * 3600 * 1000
    assert.equal((await senden(dd.basis, [n], { auftrag: 'vier' })).json.doppelt, 1)
    uhr.ms += 3600 * 1000 + 1
    const r5 = await senden(dd.basis, [n], { auftrag: 'fuenf' })
    assert.deepEqual(r5.json, { angenommen: 1, doppelt: 0, abgelehnt: [] })
    await dd.versand.fertig()
    assert.equal(ep.anfragenAn('/abo/doppelt').length, 3)
    const s = await anfrage(dd.basis, '/v1/stand')
    assert.equal(s.json.doppelt, 3)
    assert.equal(s.json.angenommen, 3)
  } finally {
    await dd.stoppen()
    await ep.schliessen()
  }
})

test('Warteschlange voll → 503 {"fehler":"voll"}, nichts angenommen, Schlüssel nicht gemerkt', async (t) => {
  const tls = tlsVorbereiten()
  if (!tls) return t.skip(OHNE_OPENSSL)
  const ep = await fakeEndpunktStarten({ tls })
  ep.standardSetzen({ status: 201, verzoegerungMs: 300 })
  const dd = await dienstImProzess({
    env: { PUSH_TEST_HOSTS: ep.host, PUSH_TEST_CA: tls.caPfad, PUSH_WARTESCHLANGE_MAX: '3', PUSH_GLEICHZEITIG: '1' },
  })
  try {
    const { abo } = aboErzeugen(ep.url('/abo/voll'))
    const r1 = await senden(dd.basis, [nachricht({ abo }), nachricht({ abo })])
    assert.equal(r1.json.angenommen, 2)
    const spaeter = [nachricht({ abo }), nachricht({ abo })]
    const r2 = await senden(dd.basis, spaeter)
    assert.equal(r2.status, 503)
    assert.deepEqual(r2.json, { fehler: 'voll' })
    // Nur Abgelehnte und Doppelte belasten die Warteschlange nicht
    const r3 = await senden(dd.basis, [{ ...spaeter[0], ttl: -1 }])
    assert.equal(r3.status, 202)
    await dd.versand.fertig()
    const r4 = await senden(dd.basis, spaeter)
    assert.deepEqual(r4.json, { angenommen: 2, doppelt: 0, abgelehnt: [] })
    await dd.versand.fertig()
    assert.equal(ep.anfragenAn('/abo/voll').length, 4)
  } finally {
    await dd.stoppen()
    await ep.schliessen()
  }
})

test('Kopfzeilen-Zeitlimit 10 s und Anfrage-Zeitlimit 15 s sind gesetzt', () => {
  assert.equal(d.server.headersTimeout, 10000)
  assert.equal(d.server.requestTimeout, 15000)
})

test('Anfrage, die mitten im Body abreißt, stört den Dienst nicht', async () => {
  const net = await import('node:net')
  const port = new URL(d.basis).port
  await new Promise((resolve) => {
    const s = net.connect(Number(port), '127.0.0.1', () => {
      s.write(
        `POST /v1/senden HTTP/1.1\r\nHost: x\r\nAuthorization: Bearer ${TEST_GEHEIMNIS}\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{"auftrag":`,
      )
      setTimeout(() => {
        s.destroy()
        resolve()
      }, 50)
    })
  })
  await warten(50)
  assert.ok(await bisWahr(async () => (await anfrage(d.basis, '/v1/gesund', { ohneGeheimnis: true })).status === 200))
})
