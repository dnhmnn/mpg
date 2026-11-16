// Prüffälle für lib/versand.mjs gegen den falschen HTTPS-Endpunkt (Bauplan 5): Kopfzeilen,
// VAPID, Verschlüsselung und Auffüllen, Rückmeldungen (404/410 weg, 401/403 nur Fehler), Schutz vor
// Massenlöschung, Wiederholungen, Gleichzeitigkeit, Beenden, Protokoll ohne Inhalte.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync as fsLesen } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { Gedaechtnis, einstufen, retryAfterMs, FENSTER_MS } from '../lib/versand.mjs'
import { protokollErzeugen } from '../lib/protokoll.mjs'
import {
  DIENST_VERZ,
  OHNE_OPENSSL,
  TEST_GEHEIMNIS,
  TEST_SUBJECT,
  aboErzeugen,
  anfrage,
  bisWahr,
  dienstImProzess,
  dienstProzess,
  entschluesseln,
  entschluesselnEce,
  fakeEndpunktStarten,
  freierPort,
  nachricht,
  senden,
  tempVerzeichnis,
  testVapid,
  tlsVorbereiten,
  vapidPruefen,
  warten,
  zeilenLesen,
} from './hilfe.mjs'

const KURZ = { wiederholungMs: [20, 40, 60], sendeZeitMs: 400 }

/** Endpunkt und Dienst im Prozess; `fn` bekommt beide. */
async function mitDienst(t, { env = {}, versandOptionen = KURZ, jetzt, mitProtokoll = false } = {}, fn) {
  const tls = tlsVorbereiten()
  if (!tls) {
    t.skip(OHNE_OPENSSL)
    return
  }
  const ep = await fakeEndpunktStarten({ tls })
  const dd = await dienstImProzess({
    env: { PUSH_TEST_HOSTS: ep.host, PUSH_TEST_CA: tls.caPfad, ...env },
    versandOptionen,
    jetzt,
    mitProtokoll,
  })
  try {
    await fn({ ep, dd, tls })
  } finally {
    await dd.stoppen()
    await ep.schliessen()
  }
}

async function rueckmeldungen(dd) {
  const r = await anfrage(dd.basis, '/v1/rueckmeldungen', { methode: 'POST', body: {} })
  assert.equal(r.status, 200)
  return r.json
}

async function stand(dd) {
  return (await anfrage(dd.basis, '/v1/stand')).json
}

describe('reine Teile', () => {
  test('einstufen: 2xx gesendet, 404/410 weg, 401/403 Fehler, 429/5xx/Netz wiederholen, Rest Fehler', () => {
    for (const s of [200, 201, 202, 204]) assert.equal(einstufen(s), 'gesendet')
    for (const s of [404, 410]) assert.equal(einstufen(s), 'weg')
    for (const s of [401, 403, 400, 413, 406, 301, 302]) assert.equal(einstufen(s), 'fehler', String(s))
    for (const s of [0, 429, 500, 502, 503, 504]) assert.equal(einstufen(s), 'wiederholen', String(s))
  })

  test('retryAfterMs: Sekunden, HTTP-Datum, höchstens 30 min', () => {
    const jetzt = Date.parse('2026-11-15T10:00:00Z')
    assert.equal(retryAfterMs('1', jetzt), 1000)
    assert.equal(retryAfterMs(' 0 ', jetzt), 0)
    assert.equal(retryAfterMs('7200', jetzt), 30 * 60 * 1000)
    assert.equal(retryAfterMs('Sun, 15 Nov 2026 10:00:30 GMT', jetzt), 30000)
    assert.equal(retryAfterMs('Sun, 15 Nov 2026 09:00:00 GMT', jetzt), 0)
    assert.equal(retryAfterMs(['5'], jetzt), 5000)
    for (const w of [undefined, null, '', 'bald', '-1']) assert.equal(retryAfterMs(w, jetzt), null, String(w))
  })

  test('Gedaechtnis: 24 h, die ältesten fallen bei Überlauf weg', () => {
    const g = new Gedaechtnis({ dauerMs: 1000, max: 3 })
    g.merken('a', 0)
    g.merken('b', 10)
    assert.equal(g.kennt('a', 999), true)
    assert.equal(g.kennt('a', 1000), false)
    assert.equal(g.kennt('b', 1009), true)
    g.merken('c', 20)
    g.merken('d', 30)
    g.merken('e', 40)
    assert.equal(g.groesse, 3)
    assert.equal(g.kennt('c', 41), true)
    g.merken('f', 50)
    assert.equal(g.kennt('c', 51), false, 'ältester fällt weg')
    g.aufraeumen(5000)
    assert.equal(g.groesse, 0)
  })

  test('Protokoll: nur erlaubte Felder, keine Sätze, Pfade, Adressen oder langen Schlüssel', () => {
    const zeilen = []
    const p = protokollErzeugen({ schreiben: (z) => zeilen.push(z), jetzt: () => 0 })
    p('sendung', {
      id: 'abcdefghijk1234',
      host: 'fcm.googleapis.com',
      status: 410,
      payload: 'GEHEIMTEXT',
      endpoint: 'https://fcm.googleapis.com/fcm/send/geheim',
      grund: 'ein Satz mit Leerzeichen',
      code: '/fcm/send/geheim',
      auftrag: 'betrieb@beispiel.invalid',
      warnung: TEST_GEHEIMNIS,
      folge: testVapid().publicKey,
    })
    const z = JSON.parse(zeilen[0])
    assert.deepEqual(z, {
      zeit: '1970-01-01T00:00:00.000Z',
      ereignis: 'sendung',
      id: 'abcdefghijk1234',
      host: 'fcm.googleapis.com',
      status: 410,
      grund: '?',
      code: '?',
      auftrag: '?',
      warnung: '?',
      folge: '?',
    })
  })
})

test('Versand: Kopfzeilen, VAPID, Verschlüsselung, aufgefüllt auf genau 2048 Bytes', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    const a = aboErzeugen(ep.url('/abo/kopf'))
    const payload = {
      v: 1,
      titel: 'Wache Eins: Fahrzeughalle gesperrt',
      text: 'Am Samstag wird der Boden versiegelt. Bitte Fahrzeuge bis Freitag 18 Uhr umsetzen. Ärger vermeiden: ✓',
      url: '/hub',
      tag: 'mitteilung:abc',
      anlass: 'mitteilung',
      fuer: 'pruefperson00001',
      zeit: '2026-11-15T06:00:00.000Z',
    }
    const topic = '3f2a9c1b0d4e5f6a7b8c9d0e1f2a3b4c'
    const r = await senden(dd.basis, [nachricht({ abo: a.abo, payload, topic })])
    assert.equal(r.status, 202)
    assert.deepEqual(r.json, { angenommen: 1, doppelt: 0, abgelehnt: [] })
    await dd.versand.fertig()

    const [q] = ep.anfragenAn('/abo/kopf')
    assert.ok(q, 'keine Anfrage am Endpunkt')
    assert.equal(q.methode, 'POST')
    assert.equal(q.kopf.ttl, '86400')
    assert.equal(q.kopf.urgency, 'high')
    assert.equal(q.kopf.topic, topic)
    assert.equal(q.kopf['content-encoding'], 'aes128gcm')
    assert.equal(q.kopf['content-type'], 'application/octet-stream')
    assert.ok(q.body.length <= 4096, `Body ${q.body.length} Bytes`)

    const v = vapidPruefen(q.kopf.authorization, { publicKey: testVapid().publicKey, subject: TEST_SUBJECT, origin: `https://${ep.host}` })
    assert.equal(v.ok, true, v.fehler)
    assert.ok(v.daten.exp - Math.floor(Date.now() / 1000) <= 24 * 3600)

    const eigen = entschluesseln(q.body, a)
    assert.equal(eigen.idlen, 65)
    assert.equal(eigen.klar.length, 2048)
    const ece = entschluesselnEce(q.body, a)
    assert.deepEqual(ece, eigen.klar)
    const json = JSON.parse(eigen.klar.toString('utf8'))
    assert.match(json.f, /^0+$/)
    const { f, ...ohneF } = json
    assert.deepEqual(ohneF, payload)
    assert.ok(f.length > 0)
  })
})

test('Versand: große Payload genau 3800 Bytes, ohne Topic kein Topic-Kopf, TTL und urgency durchgereicht', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    const a = aboErzeugen(ep.url('/abo/gross'))
    const payload = { v: 1, titel: 'Prüfung', text: 'ä'.repeat(1200), url: '/hub', tag: 'woche', anlass: 'woche', fuer: 'x', zeit: 'z' }
    // angehängtes "=" am Schlüssel wird entfernt und stört nicht
    const abo = { endpoint: a.abo.endpoint, keys: { p256dh: a.abo.keys.p256dh + '=', auth: a.abo.keys.auth + '==' } }
    await senden(dd.basis, [nachricht({ abo, payload, ttl: 0, urgency: 'low' })])
    await dd.versand.fertig()
    const [q] = ep.anfragenAn('/abo/gross')
    assert.equal(q.kopf.ttl, '0')
    assert.equal(q.kopf.urgency, 'low')
    assert.equal(q.kopf.topic, undefined)
    const klar = entschluesseln(q.body, a).klar
    assert.equal(klar.length, 3800)
    assert.equal(JSON.parse(klar.toString('utf8')).text, 'ä'.repeat(1200))
  })
})

test('Rückmeldungen: 404 und 410 → weg; 401 und 403 → nur fehler, nie weg; abholen leert', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    const faelle = { 404: null, 410: null, 401: null, 403: null, 201: null }
    const nachrichten = []
    for (const s of Object.keys(faelle)) {
      ep.antwortSetzen(`/abo/s${s}`, { status: Number(s) })
      const n = nachricht({ abo: aboErzeugen(ep.url(`/abo/s${s}`)).abo })
      faelle[s] = n.id
      nachrichten.push(n)
    }
    await senden(dd.basis, nachrichten)
    await dd.versand.fertig()
    const r = await rueckmeldungen(dd)
    assert.deepEqual(r.weg.sort(), [faelle[404], faelle[410]].sort())
    assert.deepEqual(
      r.fehler.sort((x, y) => x.status - y.status),
      [
        { id: faelle[401], status: 401 },
        { id: faelle[403], status: 403 },
      ],
    )
    assert.equal(r.warnung, null)
    // jede Antwort genau einmal versucht (kein neuer Versuch bei 4xx)
    for (const s of Object.keys(faelle)) assert.equal(ep.anfragenAn(`/abo/s${s}`).length, 1, s)
    const s = await stand(dd)
    assert.equal(s.gesendet, 1)
    assert.equal(s.weg, 2)
    assert.equal(s.fehler, 2)
    assert.equal(s.wartend, 0)
    assert.deepEqual(await rueckmeldungen(dd), { weg: [], fehler: [], warnung: null })
  })
})

test('Schutz: 12 Antworten, davon 3 × 403 → Warnung "auth", gleichzeitiges 410 zurückgehalten, kommt nach dem Fenster', async (t) => {
  const uhr = { ms: Date.now() }
  await mitDienst(t, { jetzt: () => uhr.ms }, async ({ ep, dd }) => {
    const status = [201, 201, 201, 201, 201, 201, 201, 201, 403, 403, 403, 410]
    const ids = []
    const nachrichten = status.map((s, i) => {
      ep.antwortSetzen(`/abo/w${i}`, { status: s })
      const n = nachricht({ abo: aboErzeugen(ep.url(`/abo/w${i}`)).abo })
      ids.push(n.id)
      return n
    })
    await senden(dd.basis, nachrichten)
    await dd.versand.fertig()
    const s1 = await stand(dd)
    assert.equal(s1.warnung, 'auth')
    assert.equal(s1.zurueckgehalten, 1)
    const r1 = await rueckmeldungen(dd)
    assert.equal(r1.warnung, 'auth')
    assert.deepEqual(r1.weg, [])
    assert.deepEqual(r1.fehler.map((f) => f.status), [403, 403, 403])
    // weiter zurückgehalten, solange das Fenster die 403 enthält
    uhr.ms += FENSTER_MS - 1000
    assert.deepEqual((await rueckmeldungen(dd)).weg, [])
    // nach dem Fenster ohne 403: das zurückgehaltene weg kommt wieder
    uhr.ms += 2000
    const r2 = await rueckmeldungen(dd)
    assert.equal(r2.warnung, null)
    assert.deepEqual(r2.weg, [ids[11]])
    const s2 = await stand(dd)
    assert.equal(s2.warnung, null)
    assert.equal(s2.zurueckgehalten, 0)
  })
})

test('Schutz: alle 5 Antworten eines Hosts 403 → Warnung "auth", auch wenn insgesamt unter 20 %', async (t) => {
  const tls = tlsVorbereiten()
  if (!tls) return t.skip(OHNE_OPENSSL)
  const a = await fakeEndpunktStarten({ tls })
  const b = await fakeEndpunktStarten({ tls })
  const uhr = { ms: Date.now() }
  const dd = await dienstImProzess({
    env: { PUSH_TEST_HOSTS: `${a.host},${b.host}`, PUSH_TEST_CA: tls.caPfad },
    versandOptionen: KURZ,
    jetzt: () => uhr.ms,
  })
  try {
    b.standardSetzen({ status: 403 })
    a.antwortSetzen('/abo/weg', { status: 410 })
    const nachrichten = []
    for (let i = 0; i < 25; i++) nachrichten.push(nachricht({ abo: aboErzeugen(a.url(`/abo/a${i}`)).abo }))
    const weg = nachricht({ abo: aboErzeugen(a.url('/abo/weg')).abo })
    nachrichten.push(weg)
    for (let i = 0; i < 4; i++) nachrichten.push(nachricht({ abo: aboErzeugen(b.url(`/abo/b${i}`)).abo }))
    await senden(dd.basis, nachrichten)
    await dd.versand.fertig()
    // 4 von 4 Antworten des Hosts: noch keine Warnung (mindestens 5)
    assert.equal((await stand(dd)).warnung, null)
    await senden(dd.basis, [nachricht({ abo: aboErzeugen(b.url('/abo/b4')).abo })])
    await dd.versand.fertig()
    const s = await stand(dd)
    assert.equal(s.warnung, 'auth')
    assert.equal(s.zurueckgehalten, 1)
    const r = await rueckmeldungen(dd)
    assert.deepEqual(r.weg, [])
    assert.equal(r.fehler.length, 5)
    uhr.ms += FENSTER_MS + 1
    assert.deepEqual((await rueckmeldungen(dd)).weg, [weg.id])
  } finally {
    await dd.stoppen()
    await a.schliessen()
    await b.schliessen()
  }
})

test('Wiederholung: 429 mit Retry-After: 1 → zweiter Versuch nach etwa 1 s', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    ep.antwortSetzen('/abo/429', [{ status: 429, kopf: { 'Retry-After': '1' } }, { status: 201 }])
    await senden(dd.basis, [nachricht({ abo: aboErzeugen(ep.url('/abo/429')).abo })])
    await dd.versand.fertig()
    const q = ep.anfragenAn('/abo/429')
    assert.equal(q.length, 2)
    assert.ok(q[1].zeit - q[0].zeit >= 900, `Abstand ${q[1].zeit - q[0].zeit} ms`)
    assert.equal((await stand(dd)).gesendet, 1)
  })
})

test('Wiederholung: 500 bleibt → erster Versuch und drei Wiederholungen, dann fehler; 500, 500, 201 → gesendet', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    ep.antwortSetzen('/abo/500', { status: 500 })
    ep.antwortSetzen('/abo/500ok', [{ status: 500 }, { status: 503 }, { status: 201 }])
    const n1 = nachricht({ abo: aboErzeugen(ep.url('/abo/500')).abo })
    const n2 = nachricht({ abo: aboErzeugen(ep.url('/abo/500ok')).abo })
    await senden(dd.basis, [n1, n2])
    await dd.versand.fertig()
    assert.equal(ep.anfragenAn('/abo/500').length, 4)
    assert.equal(ep.anfragenAn('/abo/500ok').length, 3)
    const r = await rueckmeldungen(dd)
    assert.deepEqual(r.fehler, [{ id: n1.id, status: 500 }])
    assert.deepEqual(r.weg, [])
    const s = await stand(dd)
    assert.equal(s.gesendet, 1)
    assert.equal(s.fehler, 1)
  })
})

test('Wiederholung: Zeitüberschreitung → neuer Versuch', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    ep.antwortSetzen('/abo/haengt', [{ status: 201, verzoegerungMs: 3000 }, { status: 201 }])
    await senden(dd.basis, [nachricht({ abo: aboErzeugen(ep.url('/abo/haengt')).abo })])
    await dd.versand.fertig()
    assert.equal(ep.anfragenAn('/abo/haengt').length, 2)
    const s = await stand(dd)
    assert.equal(s.gesendet, 1)
    assert.equal(s.fehler, 0)
  })
})

test('Wiederholung: Netzfehler (niemand hört zu) → Wiederholungen, dann fehler mit Status 0', async (t) => {
  const tls = tlsVorbereiten()
  if (!tls) return t.skip(OHNE_OPENSSL)
  const port = await freierPort()
  const dd = await dienstImProzess({ env: { PUSH_TEST_HOSTS: `127.0.0.1:${port}`, PUSH_TEST_CA: tls.caPfad }, versandOptionen: KURZ })
  try {
    const n = nachricht({ abo: aboErzeugen(`https://127.0.0.1:${port}/abo/netz`).abo })
    await senden(dd.basis, [n])
    await dd.versand.fertig()
    const r = await rueckmeldungen(dd)
    assert.deepEqual(r.fehler, [{ id: n.id, status: 0 }])
    assert.deepEqual(r.weg, [])
  } finally {
    await dd.stoppen()
  }
})

test('Wiederholung: kein Versuch nach Ablauf der TTL; 400 und 413 sofort fehler', async (t) => {
  await mitDienst(t, { versandOptionen: { wiederholungMs: [1500, 1500, 1500], sendeZeitMs: 400 } }, async ({ ep, dd }) => {
    ep.antwortSetzen('/abo/ttl0', { status: 500 })
    ep.antwortSetzen('/abo/ttl1', { status: 503 })
    ep.antwortSetzen('/abo/400', { status: 400 })
    ep.antwortSetzen('/abo/413', { status: 413 })
    const n = [
      nachricht({ abo: aboErzeugen(ep.url('/abo/ttl0')).abo, ttl: 0 }),
      nachricht({ abo: aboErzeugen(ep.url('/abo/ttl1')).abo, ttl: 1 }),
      nachricht({ abo: aboErzeugen(ep.url('/abo/400')).abo }),
      nachricht({ abo: aboErzeugen(ep.url('/abo/413')).abo }),
    ]
    const t0 = Date.now()
    await senden(dd.basis, n)
    await dd.versand.fertig()
    assert.ok(Date.now() - t0 < 1400, 'keine Wartezeit für Wiederholungen nach Ablauf der TTL')
    for (const p of ['/abo/ttl0', '/abo/ttl1', '/abo/400', '/abo/413']) assert.equal(ep.anfragenAn(p).length, 1, p)
    const r = await rueckmeldungen(dd)
    assert.deepEqual(r.fehler.map((f) => f.status).sort(), [400, 413, 500, 503])
  })
})

test('Gleichzeitigkeit: höchstens PUSH_GLEICHZEITIG Sendungen zugleich', async (t) => {
  await mitDienst(t, { env: { PUSH_GLEICHZEITIG: '2' } }, async ({ ep, dd }) => {
    ep.standardSetzen({ status: 201, verzoegerungMs: 150 })
    const n = []
    for (let i = 0; i < 8; i++) n.push(nachricht({ abo: aboErzeugen(ep.url(`/abo/g${i}`)).abo }))
    await senden(dd.basis, n)
    assert.ok(await bisWahr(() => ep.anfragen.length >= 1))
    const w = await stand(dd)
    assert.ok(w.wartend > 0)
    await dd.versand.fertig()
    assert.equal(ep.anfragen.length, 8)
    assert.equal(ep.maxGleichzeitig, 2)
    assert.equal((await stand(dd)).gesendet, 8)
  })
})

test('Abo-Schlüssel nicht auf der Kurve: angenommen (Form stimmt), nicht gesendet, fehler', async (t) => {
  await mitDienst(t, {}, async ({ ep, dd }) => {
    const n = nachricht({ abo: { endpoint: ep.url('/abo/kurve'), keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) } } })
    const r = await senden(dd.basis, [n])
    assert.deepEqual(r.json, { angenommen: 1, doppelt: 0, abgelehnt: [] })
    await dd.versand.fertig()
    assert.equal(ep.anfragenAn('/abo/kurve').length, 0)
    assert.deepEqual((await rueckmeldungen(dd)).fehler, [{ id: n.id, status: 0 }])
  })
})

test('Protokoll im Prozess: jede Zeile JSON, nie Payload, Pfad, Schlüssel oder Geheimnis', async (t) => {
  await mitDienst(t, { mitProtokoll: true }, async ({ ep, dd }) => {
    ep.antwortSetzen('/abo/geheimpfad-410', { status: 410 })
    ep.antwortSetzen('/abo/geheimpfad-403', { status: 403 })
    ep.antwortSetzen('/abo/geheimpfad-500', [{ status: 500 }, { status: 201 }])
    const abos = ['/abo/geheimpfad-201', '/abo/geheimpfad-410', '/abo/geheimpfad-403', '/abo/geheimpfad-500'].map((p) => aboErzeugen(ep.url(p)))
    const payload = { v: 1, titel: 'GEHEIMTITEL Erika Musterfrau', text: 'GEHEIMTEXT betrieb@beispiel.invalid', url: '/hub', tag: 't', anlass: 'mitteilung', fuer: 'x', zeit: 'z' }
    await senden(dd.basis, abos.map((a) => nachricht({ abo: a.abo, payload })))
    await senden(dd.basis, [nachricht({ abo: { endpoint: 'https://push.example.com/geheimpfad', keys: abos[0].abo.keys }, payload })])
    await dd.versand.fertig()
    await rueckmeldungen(dd)
    await stand(dd)
    const text = dd.zeilen.join('')
    for (const z of dd.zeilen) JSON.parse(z)
    const verboten = ['GEHEIM', 'Musterfrau', '@', 'geheimpfad', '/abo', TEST_GEHEIMNIS, testVapid().privateKey, testVapid().publicKey]
    for (const a of abos) verboten.push(a.abo.keys.p256dh, a.abo.keys.auth)
    for (const v of verboten) assert.ok(!text.includes(v), `Protokoll enthält ${v.slice(0, 12)}`)
    assert.match(text, /"ereignis":"auftrag"/)
    assert.match(text, /"folge":"weg"/)
    assert.match(text, /"folge":"wiederholen"/)
  })
})

test('Prozess: SIGTERM nimmt nichts Neues an und wartet die laufende Sendung ab; stdout ohne Inhalte', async (t) => {
  const tls = tlsVorbereiten()
  if (!tls) return t.skip(OHNE_OPENSSL)
  const ep = await fakeEndpunktStarten({ tls })
  const netzPort = await freierPort()
  const d = await dienstProzess({ env: { PUSH_TEST_HOSTS: `${ep.host},127.0.0.1:${netzPort}`, PUSH_TEST_CA: tls.caPfad } })
  try {
    ep.antwortSetzen('/abo/geheimpfad-langsam', { status: 201, verzoegerungMs: 1500 })
    ep.antwortSetzen('/abo/geheimpfad-410', { status: 410 })
    ep.antwortSetzen('/abo/geheimpfad-403', { status: 403 })
    const langsam = aboErzeugen(ep.url('/abo/geheimpfad-langsam'))
    const andere = [ep.url('/abo/geheimpfad-410'), ep.url('/abo/geheimpfad-403'), `https://127.0.0.1:${netzPort}/abo/geheimpfad-netz`].map((e) => aboErzeugen(e))
    const payload = { v: 1, titel: 'GEHEIMTITEL', text: 'GEHEIMTEXT Erika Musterfrau', url: '/hub', tag: 't', anlass: 'mitteilung', fuer: 'x', zeit: 'z' }
    const r = await senden(d.basis, [langsam, ...andere].map((a) => nachricht({ abo: a.abo, payload })))
    assert.equal(r.json.angenommen, 4)
    assert.ok(await bisWahr(() => ep.anfragenAn('/abo/geheimpfad-langsam').length === 1, 5000))
    assert.ok(await bisWahr(() => ep.anfragenAn('/abo/geheimpfad-403').length === 1, 5000))
    await warten(100)
    const t0 = Date.now()
    d.proc.kill('SIGTERM')
    await warten(150)
    // keine neuen Anfragen mehr
    await assert.rejects(anfrage(d.basis, '/v1/gesund', { ohneGeheimnis: true }))
    const e = await d.ende
    const dauer = Date.now() - t0
    assert.equal(e.code, 0)
    assert.ok(dauer >= 1100, `beendet nach ${dauer} ms, also vor der Antwort des Endpunkts`)
    assert.ok(dauer < 10000)
    const zeilen = zeilenLesen(d.stdout())
    const ende = zeilen.find((z) => z.ereignis === 'ende')
    assert.ok(ende, d.stdout())
    assert.equal(ende.gesendet, 1, 'laufende Sendung abgewartet')
    assert.equal(ende.weg, 1)
    assert.equal(ende.verloren, 1, 'die Wiederholung (Netzfehler) entfällt beim Beenden')
    const alles = d.stdout() + d.stderr()
    const verboten = ['GEHEIM', 'Musterfrau', 'geheimpfad', '/abo', '@', TEST_GEHEIMNIS, testVapid().privateKey, testVapid().publicKey]
    for (const a of [langsam, ...andere]) verboten.push(a.abo.keys.p256dh, a.abo.keys.auth)
    for (const v of verboten) assert.ok(!alles.includes(v), `Ausgabe enthält ${v.slice(0, 12)}`)
    for (const z of zeilen) assert.ok(!('roh' in z), `keine JSON-Zeile: ${z.roh}`)
  } finally {
    if (d.proc.exitCode === null) d.proc.kill('SIGKILL')
    await ep.schliessen()
  }
})

test('fake-endpunkt.mjs als eigenes Programm: CA ablegen, annehmen, /_protokoll, /_antwort', async (t) => {
  if (!tlsVorbereiten()) return t.skip(OHNE_OPENSSL)
  const port = await freierPort()
  const caZiel = tempVerzeichnis('fake')
  const proc = spawn(process.execPath, [path.join(DIENST_VERZ, 'test', 'fake-endpunkt.mjs'), '--port', String(port), '--ca-ziel', caZiel], {
    env: { PATH: process.env.PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  proc.stdout.on('data', (c) => (out += c))
  const ende = new Promise((r) => proc.on('exit', (code) => r(code)))
  try {
    assert.ok(await bisWahr(() => out.includes('"bereit":true'), 10000), 'Endpunkt meldet sich nicht')
    const { ca } = JSON.parse(out.split('\n')[0])
    assert.equal(ca, path.join(caZiel, 'ca.pem'))
    const holen = (methode, pfad, body) =>
      new Promise((resolve, reject) => {
        const req = https.request({ hostname: '127.0.0.1', port, path: pfad, method: methode, ca: fsLesen(ca), agent: false }, (res) => {
          let t2 = ''
          res.on('data', (c) => (t2 += c))
          res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(t2) }))
        })
        req.on('error', reject)
        if (body) req.write(JSON.stringify(body))
        req.end()
      })
    const dd = await dienstImProzess({ env: { PUSH_TEST_HOSTS: `127.0.0.1:${port}`, PUSH_TEST_CA: ca }, versandOptionen: KURZ })
    try {
      assert.equal((await holen('POST', '/_antwort', { pfad: '/abo/2', folge: [{ status: 410 }] })).status, 200)
      const n1 = nachricht({ abo: aboErzeugen(`https://127.0.0.1:${port}/abo/1`).abo })
      const n2 = nachricht({ abo: aboErzeugen(`https://127.0.0.1:${port}/abo/2`).abo })
      await senden(dd.basis, [n1, n2])
      await dd.versand.fertig()
      const p = await holen('GET', '/_protokoll')
      assert.deepEqual(p.json.anfragen.map((a) => a.pfad).sort(), ['/abo/1', '/abo/2'])
      assert.ok(p.json.anfragen.every((a) => a.kopf['content-encoding'] === 'aes128gcm' && Buffer.from(a.body, 'base64').length > 0))
      assert.deepEqual((await rueckmeldungen(dd)).weg, [n2.id])
      assert.equal((await holen('POST', '/_leeren')).status, 200)
      assert.deepEqual((await holen('GET', '/_protokoll')).json.anfragen, [])
    } finally {
      await dd.stoppen()
    }
  } finally {
    proc.kill('SIGTERM')
    assert.equal(await ende, 0)
  }
})
