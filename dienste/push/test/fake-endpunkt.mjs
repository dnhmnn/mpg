#!/usr/bin/env node
// Falscher Push-Endpunkt als eigenständiges Programm (für die Browserprobe der Integration).
//
//   node test/fake-endpunkt.mjs --port 8631 --ca-ziel <verzeichnis>
//
// Erzeugt eine Prüf-CA und ein Zertifikat für 127.0.0.1 (openssl), legt die CA als
// <verzeichnis>/ca.pem ab (für PUSH_TEST_CA des Dienstes) und nimmt HTTPS auf 127.0.0.1:<port> an.
// Jede Anfrage außer den Steuerpfaden wird aufgezeichnet und mit 201 beantwortet.
//
// Steuerpfade (HTTPS, dieselbe CA):
//   GET  /_protokoll   → {"anfragen":[{methode,pfad,kopf,body (base64),zeit}], "max_gleichzeitig":n}
//   POST /_leeren      → Aufzeichnung leeren
//   POST /_antwort     → Body {"pfad":"/abo/1","folge":[{"status":410}]}  ("*" = alle übrigen Pfade)
//                         Einträge: status, kopf (Objekt), verzoegerungMs; der letzte bleibt stehen.
//
// Beenden mit SIGTERM oder SIGINT. Nur für Prüfungen.

import fs from 'node:fs'
import path from 'node:path'
import { fakeEndpunktStarten, tlsVorbereiten } from './hilfe.mjs'

function argumente(argv) {
  const a = { port: 8631, caZiel: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') a.port = Number(argv[++i])
    else if (argv[i].startsWith('--port=')) a.port = Number(argv[i].slice(7))
    else if (argv[i] === '--ca-ziel') a.caZiel = argv[++i]
    else if (argv[i].startsWith('--ca-ziel=')) a.caZiel = argv[i].slice(10)
  }
  return a
}

const a = argumente(process.argv.slice(2))
if (!Number.isInteger(a.port) || a.port < 1 || a.port > 65535 || !a.caZiel) {
  process.stderr.write('Aufruf: node fake-endpunkt.mjs --port <port> --ca-ziel <verzeichnis>\n')
  process.exit(2)
}

const tls = tlsVorbereiten()
if (!tls) {
  process.stderr.write('openssl fehlt: Der falsche Endpunkt braucht openssl für sein Zertifikat.\n')
  process.exit(1)
}
fs.mkdirSync(a.caZiel, { recursive: true })
const caZiel = path.join(path.resolve(a.caZiel), 'ca.pem')
fs.writeFileSync(caZiel, tls.ca)

const ep = await fakeEndpunktStarten({ tls, port: a.port })
process.stdout.write(JSON.stringify({ bereit: true, port: ep.port, ca: caZiel }) + '\n')

function beenden() {
  ep.schliessen().then(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGTERM', beenden)
process.on('SIGINT', beenden)
