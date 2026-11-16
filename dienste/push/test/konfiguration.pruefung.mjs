// Prüffälle für lib/konfiguration.mjs und den Start von dienst.mjs: alle Ablehnungsgründe,
// gültig mit Prüfschlüsseln, PUSH_BETRIEB=1 mit Prüf-Einstellungen, Node zu alt (gespielt).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import webpush from 'web-push'
import { konfigurationLesen, nodeVersionReicht, vapidPaarPruefen, subjectPruefen } from '../lib/konfiguration.mjs'
import { anfrage, dienstProzess, tempVerzeichnis, testUmgebung, testVapid } from './hilfe.mjs'

function abgelehnt(env, opt) {
  const r = konfigurationLesen(env, opt)
  assert.equal(r.ok, false, JSON.stringify(Object.keys(env)))
  assert.ok(r.fehler.length > 0)
  return r.fehler.join(' ')
}

test('gültig mit Prüfschlüsseln und Vorgaben', () => {
  const r = konfigurationLesen(testUmgebung(), { nodeVersion: '22.22.0' })
  assert.equal(r.ok, true, r.fehler?.join(' '))
  assert.equal(r.konfig.host, '127.0.0.1')
  assert.equal(r.konfig.port, 8095)
  assert.equal(r.konfig.gleichzeitig, 8)
  assert.equal(r.konfig.warteschlangeMax, 10000)
  assert.equal(r.konfig.betrieb, false)
  assert.deepEqual([...r.konfig.testHosts], [])
  assert.equal(r.konfig.vapid.subject, 'https://responda.systems')

  const ohne = testUmgebung()
  delete ohne.PUSH_HOST
  delete ohne.PUSH_PORT
  delete ohne.PUSH_GLEICHZEITIG
  delete ohne.PUSH_WARTESCHLANGE_MAX
  const r2 = konfigurationLesen(ohne, { nodeVersion: '24.11.0' })
  assert.equal(r2.ok, true)
  assert.equal(r2.konfig.host, '127.0.0.1')
  assert.equal(r2.konfig.port, 8095)

  assert.equal(konfigurationLesen(testUmgebung({ PUSH_HOST: '::1' }), { nodeVersion: '22.0.0' }).ok, true)
  assert.equal(konfigurationLesen(testUmgebung({ VAPID_SUBJECT: 'mailto:betrieb@beispiel.invalid' }), { nodeVersion: '22.0.0' }).ok, true)
  assert.equal(konfigurationLesen(testUmgebung({ PUSH_BETRIEB: '1' }), { nodeVersion: '24.0.0' }).konfig.betrieb, true)
})

test('PUSH_HOST nur 127.0.0.1 oder ::1', () => {
  for (const h of ['0.0.0.0', '::', 'localhost', '192.168.1.10', '127.0.0.2']) {
    assert.match(abgelehnt(testUmgebung({ PUSH_HOST: h })), /PUSH_HOST/)
  }
})

test('PUSH_PORT, PUSH_GLEICHZEITIG, PUSH_WARTESCHLANGE_MAX', () => {
  for (const p of ['abc', '0', '70000', '-1', '80.5']) assert.match(abgelehnt(testUmgebung({ PUSH_PORT: p })), /PUSH_PORT/)
  for (const g of ['0', 'x', '257']) assert.match(abgelehnt(testUmgebung({ PUSH_GLEICHZEITIG: g })), /PUSH_GLEICHZEITIG/)
  for (const w of ['0', 'viel', '1000001']) assert.match(abgelehnt(testUmgebung({ PUSH_WARTESCHLANGE_MAX: w })), /PUSH_WARTESCHLANGE_MAX/)
})

test('PUSH_GEHEIMNIS: fehlt oder kürzer als 32 Zeichen', () => {
  const ohne = testUmgebung()
  delete ohne.PUSH_GEHEIMNIS
  assert.match(abgelehnt(ohne), /PUSH_GEHEIMNIS/)
  assert.match(abgelehnt(testUmgebung({ PUSH_GEHEIMNIS: 'a'.repeat(31) })), /PUSH_GEHEIMNIS/)
  assert.match(abgelehnt(testUmgebung({ PUSH_GEHEIMNIS: 'a'.repeat(20) + ' ' + 'b'.repeat(20) })), /PUSH_GEHEIMNIS/)
  assert.equal(konfigurationLesen(testUmgebung({ PUSH_GEHEIMNIS: 'a'.repeat(32) }), { nodeVersion: '22.0.0' }).ok, true)
})

test('VAPID-Schlüssel: fehlen, ungültig, passen nicht zueinander', () => {
  const v = testVapid()
  const anderes = webpush.generateVAPIDKeys()
  const ohne = testUmgebung()
  delete ohne.VAPID_PUBLIC_KEY
  assert.match(abgelehnt(ohne), /VAPID/)
  const ohne2 = testUmgebung()
  delete ohne2.VAPID_PRIVATE_KEY
  assert.match(abgelehnt(ohne2), /VAPID/)
  assert.match(abgelehnt(testUmgebung({ VAPID_PUBLIC_KEY: anderes.publicKey })), /passen nicht zueinander/)
  assert.match(abgelehnt(testUmgebung({ VAPID_PRIVATE_KEY: anderes.privateKey })), /passen nicht zueinander/)
  assert.match(abgelehnt(testUmgebung({ VAPID_PUBLIC_KEY: v.publicKey.slice(0, 80) })), /VAPID_PUBLIC_KEY/)
  assert.match(abgelehnt(testUmgebung({ VAPID_PUBLIC_KEY: v.publicKey + '=' })), /VAPID_PUBLIC_KEY/)
  assert.match(abgelehnt(testUmgebung({ VAPID_PRIVATE_KEY: 'unsinn!' })), /VAPID_PRIVATE_KEY/)
  assert.match(abgelehnt(testUmgebung({ VAPID_PRIVATE_KEY: Buffer.alloc(32).toString('base64url') })), /VAPID_PRIVATE_KEY/)
  assert.equal(vapidPaarPruefen(v.publicKey, v.privateKey), null)
  // Fehlertexte nennen nie den Schlüssel selbst
  const t = abgelehnt(testUmgebung({ VAPID_PUBLIC_KEY: anderes.publicKey }))
  assert.ok(!t.includes(anderes.publicKey) && !t.includes(v.privateKey))
})

test('VAPID_SUBJECT: nur mailto: oder https://', () => {
  const ohne = testUmgebung()
  delete ohne.VAPID_SUBJECT
  assert.match(abgelehnt(ohne), /VAPID_SUBJECT/)
  for (const s of ['http://responda.systems', 'responda.systems', 'ftp://x', 'https://localhost', 'https://', 'mailto']) {
    assert.match(abgelehnt(testUmgebung({ VAPID_SUBJECT: s })), /VAPID_SUBJECT/, s)
  }
  assert.equal(subjectPruefen('https://responda.systems'), null)
})

test('Node-Version: mindestens 22', () => {
  assert.equal(nodeVersionReicht('22.0.0'), true)
  assert.equal(nodeVersionReicht('v24.11.1'), true)
  assert.equal(nodeVersionReicht('20.18.0'), false)
  assert.equal(nodeVersionReicht('18.20.4'), false)
  assert.equal(nodeVersionReicht(''), false)
  assert.match(abgelehnt(testUmgebung(), { nodeVersion: '20.18.0' }), /Node 20\.18\.0 ist zu alt/)
})

test('PUSH_BETRIEB=1 mit PUSH_TEST_HOSTS oder PUSH_TEST_CA wird abgelehnt', () => {
  const dir = tempVerzeichnis('ca')
  const ca = path.join(dir, 'ca.pem')
  fs.writeFileSync(ca, '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n')
  assert.match(abgelehnt(testUmgebung({ PUSH_BETRIEB: '1', PUSH_TEST_HOSTS: '127.0.0.1:8631' })), /PUSH_BETRIEB=1/)
  assert.match(abgelehnt(testUmgebung({ PUSH_BETRIEB: '1', PUSH_TEST_CA: ca })), /PUSH_BETRIEB=1/)
  // ohne Betrieb erlaubt
  const r = konfigurationLesen(testUmgebung({ PUSH_TEST_HOSTS: '127.0.0.1:8631, 127.0.0.1:8632', PUSH_TEST_CA: ca }), { nodeVersion: '22.0.0' })
  assert.equal(r.ok, true)
  assert.deepEqual([...r.konfig.testHosts], ['127.0.0.1:8631', '127.0.0.1:8632'])
  assert.ok(Buffer.isBuffer(r.konfig.testCa))
})

test('PUSH_TEST_HOSTS nur 127.0.0.1:<port>, PUSH_TEST_CA muss lesbar sein', () => {
  for (const h of ['10.0.0.1:443', 'push.example.com:443', '127.0.0.1', '127.0.0.1:0', '127.0.0.1:99999', 'localhost:8631']) {
    assert.match(abgelehnt(testUmgebung({ PUSH_TEST_HOSTS: h })), /PUSH_TEST_HOSTS/, h)
  }
  assert.match(abgelehnt(testUmgebung({ PUSH_TEST_CA: '/gibt/es/nicht.pem' })), /PUSH_TEST_CA/)
  const dir = tempVerzeichnis('ca')
  fs.writeFileSync(path.join(dir, 'leer.pem'), 'kein Zertifikat')
  assert.match(abgelehnt(testUmgebung({ PUSH_TEST_CA: path.join(dir, 'leer.pem') })), /PUSH_TEST_CA/)
})

test('Start: dienst.mjs endet mit Code 1 bei PUSH_BETRIEB=1 und PUSH_TEST_HOSTS', async () => {
  const d = await dienstProzess({ env: { PUSH_BETRIEB: '1', PUSH_TEST_HOSTS: '127.0.0.1:8631' }, erwarteStart: false })
  const e = await d.ende
  assert.equal(e.code, 1)
  assert.match(d.stderr(), /startet nicht: PUSH_BETRIEB=1/)
  assert.ok(!d.stdout().includes('"ereignis":"start"'))
})

test('Start: dienst.mjs endet mit Code 1 bei PUSH_BETRIEB=1 und PUSH_TEST_CA', async () => {
  const dir = tempVerzeichnis('ca')
  const ca = path.join(dir, 'ca.pem')
  fs.writeFileSync(ca, '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n')
  const d = await dienstProzess({ env: { PUSH_BETRIEB: '1', PUSH_TEST_CA: ca }, erwarteStart: false })
  assert.equal((await d.ende).code, 1)
  assert.match(d.stderr(), /PUSH_BETRIEB=1/)
})

test('Start: dienst.mjs endet mit Code 1 ohne Geheimnis, ohne Meldung des Werts', async () => {
  const d = await dienstProzess({ env: { PUSH_GEHEIMNIS: 'kurz', PUSH_HOST: '0.0.0.0' }, erwarteStart: false })
  assert.equal((await d.ende).code, 1)
  assert.match(d.stderr(), /PUSH_GEHEIMNIS/)
  assert.match(d.stderr(), /PUSH_HOST/)
  assert.ok(!d.stderr().includes(testVapid().privateKey))
})

test('Start: dienst.mjs endet mit Code 1, wenn Node zu alt ist (gespielt)', async () => {
  const vorab = 'data:text/javascript,' + encodeURIComponent("Object.defineProperty(process.versions, 'node', { value: '20.18.0' })")
  const d = await dienstProzess({ nodeArgs: ['--import', vorab], erwarteStart: false })
  assert.equal((await d.ende).code, 1)
  assert.match(d.stderr(), /Node 20\.18\.0 ist zu alt/)
})

test('Start: gültige Prüfumgebung, /v1/gesund antwortet, SIGTERM beendet mit Code 0', async () => {
  const d = await dienstProzess()
  const r = await anfrage(d.basis, '/v1/gesund', { ohneGeheimnis: true })
  assert.deepEqual([r.status, r.json], [200, { ok: true }])
  d.proc.kill('SIGTERM')
  assert.equal((await d.ende).code, 0)
  assert.match(d.stdout(), /"ereignis":"ende"/)
})
