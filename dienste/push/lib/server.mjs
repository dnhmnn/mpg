// HTTP-Schnittstelle des Push-Dienstes (Vertrag 1.1 im Bauplan), nur node:http.
//
//   GET  /v1/gesund         ohne Geheimnis → 200 {"ok":true}
//   GET  /v1/schluessel     → 200 {"publicKey":"B…"}
//   POST /v1/senden         → 202 {angenommen, doppelt, abgelehnt} | 400 | 401 | 413 | 503
//   POST /v1/rueckmeldungen → 200 {weg, fehler, warnung}
//   GET  /v1/stand          → 200 {seit, angenommen, doppelt, gesendet, weg, zurueckgehalten, fehler, wartend, warnung}
//
// Alles außer /v1/gesund verlangt `Authorization: Bearer <PUSH_GEHEIMNIS>`; der Vergleich läuft über
// SHA-256 und timingSafeEqual, also in gleicher Zeit für jede Länge.

import http from 'node:http'
import https from 'node:https'
import crypto from 'node:crypto'
import { GRENZEN, auftragPruefen } from './pruefen.mjs'
import { Versand } from './versand.mjs'
import { protokollStumm } from './protokoll.mjs'

export const KOPF_ZEIT_MS = 10000
export const ANFRAGE_ZEIT_MS = 15000

const KOPFZEILEN = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest()
}

/** Bearer-Geheimnis prüfen, in gleicher Zeit unabhängig von Länge und Inhalt. */
export function geheimnisPasst(kopf, erwartet) {
  if (typeof kopf !== 'string' || typeof erwartet !== 'string' || erwartet.length === 0) return false
  const m = /^Bearer ([\x21-\x7e]+)$/i.exec(kopf)
  const gegeben = m ? m[1] : ''
  const gleich = crypto.timingSafeEqual(sha256(gegeben), sha256(erwartet))
  return gleich && m !== null
}

function antworten(res, status, daten, extra = {}) {
  const body = JSON.stringify(daten)
  res.writeHead(status, { ...KOPFZEILEN, 'Content-Length': Buffer.byteLength(body), ...extra })
  res.end(body)
}

function istJson(contentType) {
  if (typeof contentType !== 'string') return false
  return contentType.split(';')[0].trim().toLowerCase() === 'application/json'
}

/**
 * Body lesen, beim Lesen gezählt. Über `max` wird nichts mehr gesammelt, aber noch bis `hart`
 * weitergelesen, damit der Absender die Antwort 413 sicher bekommt; darüber wird abgebrochen.
 */
function bodyLesen(req, max) {
  const hart = 2 * max + 65536
  return new Promise((resolve) => {
    let fertig = false
    const ende = (wert) => {
      if (fertig) return
      fertig = true
      resolve(wert)
    }
    const angesagt = Number(req.headers['content-length'])
    if (Number.isFinite(angesagt) && angesagt > hart) {
      ende({ zuGross: true, abbrechen: true })
      return
    }
    const teile = []
    let laenge = 0
    req.on('data', (stueck) => {
      if (fertig) return
      laenge += stueck.length
      if (laenge > max) {
        teile.length = 0
        if (laenge > hart) ende({ zuGross: true, abbrechen: true })
        return
      }
      teile.push(stueck)
    })
    req.on('end', () => ende(laenge > max ? { zuGross: true } : { buf: Buffer.concat(teile, laenge) }))
    req.on('error', () => ende({ abgerissen: true }))
    req.on('close', () => ende({ abgerissen: true }))
  })
}

const UTF8 = new TextDecoder('utf-8', { fatal: true })

function jsonLesen(buf) {
  try {
    return { ok: true, wert: JSON.parse(UTF8.decode(buf)) }
  } catch {
    return { ok: false }
  }
}

function pfadVon(url) {
  const s = typeof url === 'string' ? url : ''
  const i = s.indexOf('?')
  return i < 0 ? s : s.slice(0, i)
}

const ROUTEN = {
  '/v1/schluessel': 'GET',
  '/v1/senden': 'POST',
  '/v1/rueckmeldungen': 'POST',
  '/v1/stand': 'GET',
}

/**
 * Baut den HTTP-Server (noch ohne listen).
 * @param konfig    aus konfigurationLesen
 * @param versand   Versand
 * @param protokoll protokollErzeugen(...)
 * @param jetzt     Uhr (für die Drossel des Protokolls)
 */
export function serverErzeugen({ konfig, versand, protokoll = protokollStumm, jetzt = Date.now }) {
  let letztes401 = 0
  let abgewiesen = 0

  async function behandeln(req, res) {
    const pfad = pfadVon(req.url)

    if (pfad === '/v1/gesund') {
      if (req.method !== 'GET') return antworten(res, 405, { fehler: 'methode' }, { Allow: 'GET' })
      return antworten(res, 200, { ok: true })
    }

    if (!geheimnisPasst(req.headers.authorization, konfig.geheimnis)) {
      abgewiesen++
      const t = jetzt()
      if (t - letztes401 >= 60000) {
        letztes401 = t
        protokoll('abgewiesen', { status: 401, anzahl: abgewiesen })
        abgewiesen = 0
      }
      return antworten(res, 401, { fehler: 'geheimnis' })
    }

    const methode = ROUTEN[pfad]
    if (!methode) return antworten(res, 404, { fehler: 'unbekannt' })
    if (req.method !== methode) return antworten(res, 405, { fehler: 'methode' }, { Allow: methode })

    if (methode === 'GET') {
      if (pfad === '/v1/schluessel') return antworten(res, 200, { publicKey: konfig.vapid.publicKey })
      return antworten(res, 200, versand.stand())
    }

    if (!istJson(req.headers['content-type'])) return antworten(res, 400, { fehler: 'body' })
    const b = await bodyLesen(req, GRENZEN.bodyBytes)
    if (b.abgerissen) {
      if (!res.headersSent) res.destroy()
      return
    }
    if (b.zuGross) {
      if (b.abbrechen) res.on('finish', () => req.socket?.destroy())
      return antworten(res, 413, { fehler: 'zu_gross' }, { Connection: 'close' })
    }

    if (pfad === '/v1/rueckmeldungen') {
      // Body ist {} und wird nicht weiter gebraucht; leer ist auch recht.
      if (b.buf.length > 0 && !jsonLesen(b.buf).ok) return antworten(res, 400, { fehler: 'body' })
      return antworten(res, 200, versand.rueckmeldungenAbholen())
    }

    // /v1/senden
    const j = jsonLesen(b.buf)
    if (!j.ok) return antworten(res, 400, { fehler: 'body' })
    const a = auftragPruefen(j.wert)
    if (!a.ok) return antworten(res, 400, { fehler: 'body' })
    const r = versand.annehmen(a.auftrag, a.nachrichten)
    return antworten(res, r.status, r.body)
  }

  const server = http.createServer((req, res) => {
    behandeln(req, res).catch(() => {
      protokoll('interner_fehler', { status: 500 })
      if (!res.headersSent) antworten(res, 500, { fehler: 'intern' })
      else res.destroy()
    })
  })
  server.headersTimeout = KOPF_ZEIT_MS
  server.requestTimeout = ANFRAGE_ZEIT_MS
  server.keepAliveTimeout = 5000
  return server
}

/**
 * Baut Agent, Versand und Server aus der Konfiguration (dienst.mjs und Prüfungen).
 * `versandOptionen` nur für Prüfungen (kurze Wartezeiten, gespielte Uhr).
 */
export function dienstAufbauen({ konfig, protokoll = protokollStumm, jetzt = Date.now, versandOptionen = {} }) {
  const agentOptionen = { keepAlive: true, maxSockets: Math.max(konfig.gleichzeitig, 1) }
  if (konfig.testCa) agentOptionen.ca = konfig.testCa
  const agent = new https.Agent(agentOptionen)
  const versand = new Versand({
    vapid: konfig.vapid,
    gleichzeitig: konfig.gleichzeitig,
    warteschlangeMax: konfig.warteschlangeMax,
    testHosts: konfig.testHosts,
    agent,
    jetzt,
    protokoll,
    ...versandOptionen,
  })
  const server = serverErzeugen({ konfig, versand, protokoll, jetzt })
  return { server, versand, agent }
}
