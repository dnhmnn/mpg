#!/usr/bin/env node
// Startprobe der Server-Hooks: Startet ein echtes PocketBase mit pb_hooks auf einem leeren
// Wegwerf-Verzeichnis und prüft, dass die Hooks geladen sind.
//
// Ein Syntaxfehler in einer Datei unter pb_hooks hält PocketBase beim Start an (geprüft auf
// 0.28.4 und 0.40.5). `node --check` findet nicht alles, was die JSVM von PocketBase ablehnt;
// diese Probe findet es, bevor der Owner die Dateien nach /opt/pb_hooks kopiert.
//
// Aufruf: node scripts/hooks-rauchprobe.mjs --bin <pfad/zu/pocketbase> [--port 8090] [--hooks pb_hooks]
//
// Prüft:
//   1. /api/health liefert 200 (sonst: Log ausgeben, Ende mit 1),
//   2. GET /api/responda/formular/rauchprobe/stand liefert 404 MIT grund "organisation"
//      (Route aus formular.pb.js geladen; die Sammlung fehlt im leeren Verzeichnis),
//   3. POST /api/crons/doku_frist als Superuser liefert 204.
// Nie gegen den echten Server: das Verzeichnis ist neu und wird danach gelöscht.

import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, openSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const wert = (name, vorgabe) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : vorgabe
}
const bin = wert('--bin', '')
const port = Number(wert('--port', '8090'))
const hooks = resolve(wert('--hooks', join(dirname(fileURLToPath(import.meta.url)), '..', 'pb_hooks')))

if (!bin || !existsSync(bin)) {
  console.error('Aufruf: node scripts/hooks-rauchprobe.mjs --bin <pfad/zu/pocketbase> [--port 8090]')
  process.exit(2)
}

const dir = mkdtempSync(join(tmpdir(), 'pb-rauchprobe-'))
const logDatei = join(dir, 'server.log')
const B = `http://127.0.0.1:${port}`
let server = null
let lebt = false

function ende(code, text) {
  if (text) console[code === 0 ? 'log' : 'error'](text)
  if (code !== 0) {
    try { console.error('--- PocketBase-Log ---\n' + readFileSync(logDatei, 'utf8').slice(-6000)) } catch { /* kein Log */ }
  }
  try { if (server && lebt) server.kill() } catch { /* schon beendet */ }
  setTimeout(() => {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* egal */ }
    process.exit(code)
  }, 300)
}

try {
  execFileSync(bin, ['superuser', 'upsert', 'rauchprobe@example.invalid', 'rauchprobe-12345', '--dir', join(dir, 'data')], { stdio: 'ignore' })
} catch (e) {
  ende(1, `superuser upsert fehlgeschlagen: ${e.message}`)
}

const log = openSync(logDatei, 'w')
server = spawn(bin, ['serve', '--http', `127.0.0.1:${port}`, '--dir', join(dir, 'data'), '--hooksDir', hooks, '--hooksWatch=false'], { stdio: ['ignore', log, log] })
lebt = true
server.on('exit', () => { lebt = false })

let gesund = false
for (let i = 0; i < 200 && lebt; i++) {
  try { if ((await fetch(`${B}/api/health`)).status === 200) { gesund = true; break } } catch { /* startet noch */ }
  await new Promise((r) => setTimeout(r, 100))
}
if (!gesund) ende(1, lebt ? 'PocketBase antwortet nicht auf /api/health.' : 'PocketBase hat sich beim Start beendet (Syntaxfehler in pb_hooks?).')
else {
  const stand = await fetch(`${B}/api/responda/formular/rauchprobe/stand`)
  let body = null
  try { body = await stand.json() } catch { body = null }
  if (stand.status !== 404 || !body || body.grund !== 'organisation') {
    ende(1, `Route /api/responda/formular/{code}/stand nicht geladen: ${stand.status} ${JSON.stringify(body)}`)
  } else {
    const auth = await fetch(`${B}/api/collections/_superusers/auth-with-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'rauchprobe@example.invalid', password: 'rauchprobe-12345' }),
    })
    const token = (await auth.json().catch(() => ({}))).token
    const cron = await fetch(`${B}/api/crons/doku_frist`, { method: 'POST', headers: { Authorization: token || '' } })
    if (cron.status !== 204) ende(1, `POST /api/crons/doku_frist: ${cron.status} ${await cron.text()}`)
    else ende(0, `Rauchprobe bestanden: ${bin} startet mit ${hooks}, Formular-Routen und Frist-Lauf sind geladen.`)
  }
}
