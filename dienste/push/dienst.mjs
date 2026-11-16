#!/usr/bin/env node
// Responda Push-Dienst: Einstieg.
//
// Nimmt von PocketBase fertige Nachrichten an (nur auf 127.0.0.1, mit Geheimnis), füllt sie auf eine
// einheitliche Größe auf, verschlüsselt sie Ende zu Ende (Web Push, RFC 8291), signiert mit VAPID
// (RFC 8292) und stellt sie den Push-Diensten von Apple, Google, Mozilla und Microsoft zu.
// Vertrag und Härtung: Bauplan Abschnitt 1.1 und 5; Einrichtung: README.md.
//
// SIGTERM/SIGINT: keine neuen Anfragen mehr, laufende Sendungen höchstens 10 s abwarten, Ende.

const NODE_MINDESTENS = 22
const nodeHaupt = Number(String(process.versions.node).split('.')[0])
if (!(nodeHaupt >= NODE_MINDESTENS)) {
  process.stderr.write(
    `Responda Push-Dienst startet nicht: Node ${process.versions.node} ist zu alt, nötig ist Node ${NODE_MINDESTENS} oder neuer (Ziel: Node 24 LTS).\n`,
  )
  process.exit(1)
}

const { konfigurationLesen } = await import('./lib/konfiguration.mjs')
const { protokollErzeugen } = await import('./lib/protokoll.mjs')
const { dienstAufbauen } = await import('./lib/server.mjs')

const BEENDEN_MAX_MS = 10000

const k = konfigurationLesen(process.env)
if (!k.ok) {
  for (const f of k.fehler) process.stderr.write(`Responda Push-Dienst startet nicht: ${f}\n`)
  process.exit(1)
}
const konfig = k.konfig
const protokoll = protokollErzeugen()

/** Fehler knapp melden: Name, Code und Aufrufstelle, nie die Meldung selbst (sie könnte Daten tragen). */
function fehlerMelden(art, err) {
  const name = err && typeof err.name === 'string' ? err.name : 'Fehler'
  const code = err && typeof err.code === 'string' ? ` ${err.code}` : ''
  const stellen = err && typeof err.stack === 'string' ? err.stack.split('\n').filter((z) => /^\s+at /.test(z)).slice(0, 8).join('\n') : ''
  process.stderr.write(`Responda Push-Dienst: ${art}: ${name}${code}\n${stellen}\n`)
}

process.on('uncaughtException', (err) => {
  protokoll('absturz', { code: err && err.code ? String(err.code) : null })
  fehlerMelden('unerwarteter Fehler', err)
  process.exit(1)
})
process.on('unhandledRejection', (err) => {
  protokoll('absturz', { code: err && err.code ? String(err.code) : null })
  fehlerMelden('unerwarteter Fehler', err)
  process.exit(1)
})

const { server, versand, agent } = dienstAufbauen({ konfig, protokoll })

server.on('error', (err) => {
  protokoll('start_fehler', { code: err && err.code ? String(err.code) : null, port: konfig.port })
  process.stderr.write(`Responda Push-Dienst startet nicht: Port ${konfig.port} auf ${konfig.host} ist nicht frei oder nicht erlaubt.\n`)
  process.exit(1)
})

server.listen(konfig.port, konfig.host, () => {
  const a = server.address()
  protokoll('start', {
    adresse: a && typeof a === 'object' ? a.address : konfig.host,
    port: a && typeof a === 'object' ? a.port : konfig.port,
    gleichzeitig: konfig.gleichzeitig,
    warteschlange_max: konfig.warteschlangeMax,
    betrieb: konfig.betrieb,
    testhosts: konfig.testHosts.length,
    node: process.versions.node,
  })
})

let beendet = false
async function beenden(signal) {
  if (beendet) return
  beendet = true
  protokoll('beenden', { signal, wartend: versand.wartend, laufend: versand.laufend })
  server.close()
  server.closeIdleConnections?.()
  const r = await versand.anhalten(BEENDEN_MAX_MS)
  const s = versand.stand()
  protokoll('ende', {
    signal,
    angenommen: s.angenommen,
    gesendet: s.gesendet,
    weg: s.weg,
    fehler: s.fehler,
    verloren: r.verloren,
  })
  server.closeAllConnections?.()
  agent.destroy()
  process.exit(0)
}

process.on('SIGTERM', () => {
  beenden('SIGTERM')
})
process.on('SIGINT', () => {
  beenden('SIGINT')
})
