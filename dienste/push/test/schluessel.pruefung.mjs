// Prüffälle für schluessel-erzeugen.mjs: beide Dateien mit 0600, gleiches Geheimnis, passende
// Schlüssel, Subject https://responda.systems, kein Überschreiben ohne --neu, Dienst startet damit.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { konfigurationLesen } from '../lib/konfiguration.mjs'
import { SCHLUESSEL_MJS, DIENST_VERZ, anfrage, dienstProzess, tempVerzeichnis } from './hilfe.mjs'

function erzeugen(args, { umask } = {}) {
  if (umask !== undefined) {
    const befehl = `umask ${umask} && exec "${process.execPath}" "${SCHLUESSEL_MJS}" ${args.map((a) => `'${a}'`).join(' ')}`
    return spawnSync('sh', ['-c', befehl], { cwd: DIENST_VERZ, encoding: 'utf8', env: { PATH: process.env.PATH } })
  }
  return spawnSync(process.execPath, [SCHLUESSEL_MJS, ...args], { cwd: DIENST_VERZ, encoding: 'utf8', env: { PATH: process.env.PATH } })
}

/** EnvironmentFile wie systemd: KEY=VALUE, Kommentare mit # am Zeilenanfang. */
function envLesen(datei) {
  const env = {}
  for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
    if (zeile.trim() === '' || zeile.trimStart().startsWith('#')) continue
    const i = zeile.indexOf('=')
    env[zeile.slice(0, i)] = zeile.slice(i + 1)
  }
  return env
}

function modus(datei) {
  return fs.statSync(datei).mode & 0o777
}

test('schreibt beide Dateien mit 0600, gleiches Geheimnis, passende Schlüssel, Subject https://responda.systems', () => {
  const ziel = path.join(tempVerzeichnis('schluessel'), 'etc-responda')
  const r = erzeugen(['--ziel', ziel], { umask: '000' })
  assert.equal(r.status, 0, r.stderr)
  const dienst = path.join(ziel, 'push-dienst.env')
  const pb = path.join(ziel, 'pocketbase-push.env')
  assert.equal(modus(dienst), 0o600)
  assert.equal(modus(pb), 0o600)
  assert.equal(modus(ziel), 0o700, 'neues Verzeichnis nur für den Besitzer')
  if (typeof process.getuid === 'function') {
    assert.equal(fs.statSync(dienst).uid, process.getuid())
    assert.equal(fs.statSync(pb).uid, process.getuid())
  }
  const d = envLesen(dienst)
  const p = envLesen(pb)
  assert.deepEqual(Object.keys(d).sort(), ['PUSH_GEHEIMNIS', 'PUSH_GLEICHZEITIG', 'PUSH_HOST', 'PUSH_PORT', 'PUSH_WARTESCHLANGE_MAX', 'VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_SUBJECT'])
  assert.deepEqual(Object.keys(p).sort(), ['RESPONDA_PUSH_GEHEIMNIS', 'RESPONDA_PUSH_SCHLUESSEL', 'RESPONDA_PUSH_URL'])
  assert.match(d.PUSH_GEHEIMNIS, /^[0-9a-f]{64}$/)
  assert.equal(p.RESPONDA_PUSH_GEHEIMNIS, d.PUSH_GEHEIMNIS)
  assert.equal(p.RESPONDA_PUSH_SCHLUESSEL, d.VAPID_PUBLIC_KEY)
  assert.equal(d.VAPID_PUBLIC_KEY.length, 87)
  assert.equal(d.VAPID_SUBJECT, 'https://responda.systems')
  assert.equal(d.PUSH_HOST, '127.0.0.1')
  assert.equal(d.PUSH_PORT, '8095')
  assert.equal(p.RESPONDA_PUSH_URL, 'http://127.0.0.1:8095')
  assert.ok(!('PUSH_BETRIEB' in d), 'PUSH_BETRIEB steht fest in der Einheit, nicht in der Datei')
  const k = konfigurationLesen(d)
  assert.equal(k.ok, true, k.fehler?.join(' '))
  // Ausgabe nennt den öffentlichen Schlüssel, nie Geheimnis oder privaten Schlüssel
  assert.ok(r.stdout.includes(d.VAPID_PUBLIC_KEY))
  assert.ok(!r.stdout.includes(d.PUSH_GEHEIMNIS) && !r.stderr.includes(d.PUSH_GEHEIMNIS))
  assert.ok(!r.stdout.includes(d.VAPID_PRIVATE_KEY) && !r.stderr.includes(d.VAPID_PRIVATE_KEY))
  // keine Reste von Zwischendateien
  assert.deepEqual(fs.readdirSync(ziel).sort(), ['pocketbase-push.env', 'push-dienst.env'])
})

test('überschreibt nie ohne --neu; mit --neu neue Schlüssel und deutliche Warnung', () => {
  const ziel = tempVerzeichnis('schluessel')
  assert.equal(erzeugen(['--ziel', ziel]).status, 0)
  const dienst = path.join(ziel, 'push-dienst.env')
  const pb = path.join(ziel, 'pocketbase-push.env')
  const vorher = [fs.readFileSync(dienst), fs.readFileSync(pb)]

  const r = erzeugen(['--ziel', ziel])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Nichts überschrieben/)
  assert.match(r.stderr, /--neu/)
  assert.deepEqual([fs.readFileSync(dienst), fs.readFileSync(pb)], vorher)

  // auch wenn nur eine der beiden Dateien da ist
  fs.unlinkSync(pb)
  assert.equal(erzeugen(['--ziel', ziel]).status, 1)
  assert.equal(fs.existsSync(pb), false)
  assert.deepEqual(fs.readFileSync(dienst), vorher[0])

  const neu = erzeugen(['--ziel', ziel, '--neu'])
  assert.equal(neu.status, 0, neu.stderr)
  assert.match(neu.stdout, /ACHTUNG/)
  assert.match(neu.stdout, /neu einschalten/)
  const d = envLesen(dienst)
  const alt = Object.fromEntries(
    vorher[0]
      .toString('utf8')
      .split('\n')
      .filter((z) => z.includes('=') && !z.startsWith('#'))
      .map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1)]),
  )
  assert.notEqual(d.VAPID_PUBLIC_KEY, alt.VAPID_PUBLIC_KEY)
  assert.notEqual(d.PUSH_GEHEIMNIS, alt.PUSH_GEHEIMNIS)
  assert.equal(envLesen(pb).RESPONDA_PUSH_GEHEIMNIS, d.PUSH_GEHEIMNIS)
  assert.equal(modus(dienst), 0o600)
  assert.equal(modus(pb), 0o600)
  assert.deepEqual(fs.readdirSync(ziel).sort(), ['pocketbase-push.env', 'push-dienst.env'])
})

test('Angaben: ohne --ziel, falsches Subject, Port', () => {
  assert.equal(erzeugen([]).status, 2)
  const ziel = tempVerzeichnis('schluessel')
  const r = erzeugen(['--ziel', ziel, '--subject', 'http://responda.systems'])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /VAPID_SUBJECT/)
  assert.equal(fs.readdirSync(ziel).length, 0)
  assert.equal(erzeugen(['--ziel', ziel, '--port', '99999']).status, 2)
  assert.equal(erzeugen(['--ziel', ziel, '--unbekannt']).status, 2)
  const ok = erzeugen(['--ziel', ziel, '--port', '8701', '--subject', 'mailto:betrieb@beispiel.invalid'])
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal(envLesen(path.join(ziel, 'pocketbase-push.env')).RESPONDA_PUSH_URL, 'http://127.0.0.1:8701')
  assert.equal(envLesen(path.join(ziel, 'push-dienst.env')).PUSH_PORT, '8701')
})

test('der Dienst startet mit der erzeugten Datei; PocketBase-Schlüssel und Geheimnis passen zum Dienst', async () => {
  const ziel = tempVerzeichnis('schluessel')
  assert.equal(erzeugen(['--ziel', ziel]).status, 0)
  const d = envLesen(path.join(ziel, 'push-dienst.env'))
  const p = envLesen(path.join(ziel, 'pocketbase-push.env'))
  const env = { ...d }
  delete env.PUSH_PORT
  const proz = await dienstProzess({ env })
  try {
    const g = await anfrage(proz.basis, '/v1/gesund', { ohneGeheimnis: true })
    assert.equal(g.status, 200)
    const s = await anfrage(proz.basis, '/v1/schluessel', { geheimnis: p.RESPONDA_PUSH_GEHEIMNIS })
    assert.equal(s.status, 200)
    assert.equal(s.json.publicKey, p.RESPONDA_PUSH_SCHLUESSEL)
  } finally {
    proz.proc.kill('SIGTERM')
    assert.equal((await proz.ende).code, 0)
  }
})
