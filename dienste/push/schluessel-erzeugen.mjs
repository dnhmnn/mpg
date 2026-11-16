#!/usr/bin/env node
// Erzeugt die Schlüssel für den Responda Push-Dienst und schreibt zwei Umgebungsdateien:
//
//   <ziel>/push-dienst.env        für den Dienst (systemd EnvironmentFile der Einheit responda-push)
//   <ziel>/pocketbase-push.env    für PocketBase (systemd EnvironmentFile der PocketBase-Einheit)
//
// Beide mit Rechten 0600; als root ausgeführt gehören sie root:root. systemd liest sie als root,
// bevor es die Rechte abgibt; der Dienst selbst kann sie also weder lesen noch ändern.
//
// Aufruf:  node schluessel-erzeugen.mjs --ziel /etc/responda [--subject https://responda.systems]
//                                       [--port 8095] [--neu]
//
// Ohne --neu überschreibt das Skript nie etwas. Mit --neu entstehen neue Schlüssel: Alle Geräte
// müssen Push danach neu einschalten (die App heilt das beim nächsten Öffnen, wo der Browser es
// ohne Tippen erlaubt; sonst zeigt sie „Push neu einschalten“).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import webpush from 'web-push'
import { subjectPruefen, vapidPaarPruefen } from './lib/konfiguration.mjs'

const SUBJECT_VORGABE = 'https://responda.systems'
const PORT_VORGABE = 8095
const DATEI_DIENST = 'push-dienst.env'
const DATEI_POCKETBASE = 'pocketbase-push.env'

function argumenteLesen(argv) {
  const a = { ziel: null, neu: false, subject: SUBJECT_VORGABE, port: PORT_VORGABE, hilfe: false, fehler: null }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === '--neu') a.neu = true
    else if (x === '--hilfe' || x === '--help' || x === '-h') a.hilfe = true
    else if (x === '--ziel') a.ziel = argv[++i] ?? null
    else if (x.startsWith('--ziel=')) a.ziel = x.slice(7)
    else if (x === '--subject') a.subject = argv[++i] ?? ''
    else if (x.startsWith('--subject=')) a.subject = x.slice(10)
    else if (x === '--port') a.port = Number(argv[++i])
    else if (x.startsWith('--port=')) a.port = Number(x.slice(7))
    else a.fehler = `Unbekannte Angabe: ${x}`
  }
  return a
}

const HILFE = `Aufruf: node schluessel-erzeugen.mjs --ziel <Verzeichnis> [--subject https://responda.systems] [--port 8095] [--neu]

Schreibt ${DATEI_DIENST} und ${DATEI_POCKETBASE} (Rechte 0600) in das Verzeichnis.
Ohne --neu wird nichts überschrieben. --neu erzeugt neue Schlüssel: Alle Geräte
müssen Push danach neu einschalten.
`

function inhaltDienst({ geheimnis, publicKey, privateKey, subject, port, zeit }) {
  return [
    `# Responda Push-Dienst, erzeugt ${zeit} von schluessel-erzeugen.mjs.`,
    '# Nur für root lesbar (0600). Nie ins Repo, nie in Chats oder Tickets kopieren.',
    'PUSH_HOST=127.0.0.1',
    `PUSH_PORT=${port}`,
    `PUSH_GEHEIMNIS=${geheimnis}`,
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    '# Steht in jeder Sendung an Apple und Google: keine persönliche Mail-Adresse.',
    `VAPID_SUBJECT=${subject}`,
    'PUSH_GLEICHZEITIG=8',
    'PUSH_WARTESCHLANGE_MAX=10000',
    '',
  ].join('\n')
}

function inhaltPocketbase({ geheimnis, publicKey, port, zeit }) {
  return [
    `# Responda Push für PocketBase, erzeugt ${zeit} von schluessel-erzeugen.mjs.`,
    '# Nur für root lesbar (0600). Einbinden mit systemctl edit <PocketBase-Einheit>:',
    '#   [Service]',
    '#   EnvironmentFile=/etc/responda/pocketbase-push.env',
    `RESPONDA_PUSH_URL=http://127.0.0.1:${port}`,
    `RESPONDA_PUSH_GEHEIMNIS=${geheimnis}`,
    `RESPONDA_PUSH_SCHLUESSEL=${publicKey}`,
    '',
  ].join('\n')
}

function dateiSchreiben(ziel, name, inhalt, neu) {
  const datei = path.join(ziel, name)
  if (!neu) {
    // "wx": scheitert, wenn es die Datei schon gibt (kein Überschreiben, auch nicht im Wettlauf).
    fs.writeFileSync(datei, inhalt, { mode: 0o600, flag: 'wx' })
  } else {
    const tmp = path.join(ziel, `.${name}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`)
    fs.writeFileSync(tmp, inhalt, { mode: 0o600, flag: 'wx' })
    fs.chmodSync(tmp, 0o600)
    fs.renameSync(tmp, datei)
  }
  fs.chmodSync(datei, 0o600)
  return datei
}

function haupt() {
  const a = argumenteLesen(process.argv.slice(2))
  if (a.hilfe) {
    process.stdout.write(HILFE)
    return 0
  }
  if (a.fehler) {
    process.stderr.write(`${a.fehler}\n\n${HILFE}`)
    return 2
  }
  if (!a.ziel) {
    process.stderr.write(`Bitte das Zielverzeichnis angeben (--ziel /etc/responda).\n\n${HILFE}`)
    return 2
  }
  const fs1 = subjectPruefen(a.subject)
  if (fs1) {
    process.stderr.write(`${fs1}\n`)
    return 2
  }
  if (!Number.isInteger(a.port) || a.port < 1 || a.port > 65535) {
    process.stderr.write('--port ist keine Portnummer zwischen 1 und 65535.\n')
    return 2
  }

  const ziel = path.resolve(a.ziel)
  if (!fs.existsSync(ziel)) fs.mkdirSync(ziel, { recursive: true, mode: 0o700 })
  if (!fs.statSync(ziel).isDirectory()) {
    process.stderr.write(`${ziel} ist kein Verzeichnis.\n`)
    return 2
  }

  const vorhanden = [DATEI_DIENST, DATEI_POCKETBASE].filter((n) => fs.existsSync(path.join(ziel, n)))
  if (vorhanden.length > 0 && !a.neu) {
    process.stderr.write(
      `Es gibt schon ${vorhanden.map((n) => path.join(ziel, n)).join(' und ')}. Nichts überschrieben.\n` +
        'Neue Schlüssel nur mit --neu. Achtung: Danach müssen alle Geräte Push neu einschalten.\n',
    )
    return 1
  }

  const { publicKey, privateKey } = webpush.generateVAPIDKeys()
  const pruefung = vapidPaarPruefen(publicKey, privateKey)
  if (pruefung) {
    process.stderr.write(`Erzeugte Schlüssel sind ungültig: ${pruefung}\n`)
    return 1
  }
  const geheimnis = crypto.randomBytes(32).toString('hex')
  const zeit = new Date().toISOString()

  const alteMaske = process.umask(0o077)
  let dateien
  try {
    dateien = [
      dateiSchreiben(ziel, DATEI_DIENST, inhaltDienst({ geheimnis, publicKey, privateKey, subject: a.subject, port: a.port, zeit }), a.neu),
      dateiSchreiben(ziel, DATEI_POCKETBASE, inhaltPocketbase({ geheimnis, publicKey, port: a.port, zeit }), a.neu),
    ]
  } finally {
    process.umask(alteMaske)
  }

  const zeilen = [
    `Geschrieben (Rechte 0600): ${dateien.join(', ')}`,
    `Öffentlicher VAPID-Schlüssel: ${publicKey}`,
    `Subject: ${a.subject}`,
    'Geheimnis und privater Schlüssel stehen nur in den Dateien, nicht in dieser Ausgabe.',
  ]
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    zeilen.push('Hinweis: nicht als root ausgeführt. Danach: chown root:root ' + dateien.join(' '))
  }
  if (a.neu && vorhanden.length > 0) {
    zeilen.push(
      'ACHTUNG: Neue Schlüssel. Alle bisherigen Push-Abos sind damit ungültig; jedes Gerät muss Push neu einschalten.',
      'Danach beide Dienste neu starten: systemctl restart responda-push und die PocketBase-Einheit.',
    )
  }
  process.stdout.write(zeilen.join('\n') + '\n')
  return 0
}

try {
  process.exitCode = haupt()
} catch (err) {
  process.stderr.write(`Schlüssel nicht erzeugt: ${err && err.code ? err.code : 'Fehler'}\n`)
  process.exitCode = 1
}
