// Versand: Warteschlange im Speicher, Arbeiter, web-push, Wiederholung, Rückmeldungen, Zähler.
// Bauplan 1.1 („Versand im Dienst“, „Rückmeldungen“, „Schutz im Dienst“) und 5.
//
// Der Dienst entscheidet nichts Inhaltliches. Er prüft Form und Größe (pruefen.mjs), erkennt
// Doppelte am Nachrichtenschlüssel, füllt auf, verschlüsselt (RFC 8291), signiert (VAPID, RFC 8292),
// sendet und merkt sich, welche Abos weg sind. Warteschlange und Schlüsselspeicher liegen nur im
// Speicher: Ein Neustart verliert, was noch nicht gesendet ist (Push ist keine Alarmierung).

import crypto from 'node:crypto'
import webpush from 'web-push'
import { GRENZEN, nachrichtPruefen } from './pruefen.mjs'
import { protokollStumm } from './protokoll.mjs'

export const WIEDERHOLUNG_MS = Object.freeze([30000, 120000, 600000]) // 5xx, Netz, Zeitüberschreitung
export const RETRY_AFTER_MAX_MS = 30 * 60 * 1000
export const SENDE_ZEIT_MS = 10000
export const FENSTER_MS = 10 * 60 * 1000 // Schutz vor Massenlöschung
export const AUTH_ANTEIL = 0.2
export const AUTH_MIN_ANTWORTEN = 10
export const AUTH_MIN_HOST = 5
export const ZURUECK_MAX_MS = 24 * 3600 * 1000
export const WARN_PROTOKOLL_MS = 3600 * 1000
export const LISTE_MAX = 10000
export const ANTWORTEN_MAX = 100000
export const AUFRAEUMEN_MS = 60000

/**
 * Schlüsselspeicher: merkt angenommene Nachrichtenschlüssel 24 h, höchstens 200000
 * (die ältesten fallen weg). Die Einfügereihenfolge ist die Zeitreihenfolge.
 */
export class Gedaechtnis {
  #karte = new Map()
  #dauerMs
  #max

  constructor({ dauerMs = GRENZEN.gedaechtnisMs, max = GRENZEN.gedaechtnisMax } = {}) {
    this.#dauerMs = dauerMs
    this.#max = max
  }

  kennt(schluessel, jetztMs) {
    const t = this.#karte.get(schluessel)
    if (t === undefined) return false
    if (jetztMs - t < this.#dauerMs) return true
    this.#karte.delete(schluessel)
    return false
  }

  merken(schluessel, jetztMs) {
    this.#karte.delete(schluessel)
    this.#karte.set(schluessel, jetztMs)
    this.aufraeumen(jetztMs)
    while (this.#karte.size > this.#max) {
      this.#karte.delete(this.#karte.keys().next().value)
    }
  }

  aufraeumen(jetztMs) {
    for (const [k, t] of this.#karte) {
      if (jetztMs - t >= this.#dauerMs) this.#karte.delete(k)
      else break
    }
  }

  get groesse() {
    return this.#karte.size
  }
}

/** Antwort des Push-Dienstes einstufen. status 0 = Netzfehler oder Zeitüberschreitung. */
export function einstufen(status) {
  if (status >= 200 && status <= 299) return 'gesendet'
  if (status === 404 || status === 410) return 'weg'
  if (status === 401 || status === 403) return 'fehler'
  if (status === 0 || status === 429 || (status >= 500 && status <= 599)) return 'wiederholen'
  return 'fehler' // 400, 413 und alles Übrige: sofort Fehler, kein neuer Versuch
}

/** Retry-After (Sekunden oder HTTP-Datum) in Millisekunden, höchstens maxMs; unlesbar → null. */
export function retryAfterMs(wert, jetztMs, maxMs = RETRY_AFTER_MAX_MS) {
  if (Array.isArray(wert)) wert = wert[0]
  if (typeof wert !== 'string') return null
  const s = wert.trim()
  if (s === '') return null
  if (/^[0-9]{1,10}$/.test(s)) return Math.min(Number(s) * 1000, maxMs)
  // HTTP-Datum („Sun, 15 Nov 2026 10:00:30 GMT“): nur mit Monatsnamen, sonst liest Date.parse
  // auch Unsinn wie „-1“ als Jahreszahl.
  if (!/[A-Za-z]{3}/.test(s)) return null
  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  return Math.min(Math.max(0, t - jetztMs), maxMs)
}

/** Liegt der öffentliche Schlüssel des Abos auf der Kurve P-256? (sonst scheitert die Verschlüsselung) */
export function aboSchluesselGueltig(keys) {
  try {
    crypto.ECDH.convertKey(keys.p256dh, 'prime256v1', 'base64url', 'buffer', 'compressed')
    return Buffer.from(keys.auth, 'base64url').length === 16
  } catch {
    return false
  }
}

function fehlerCode(err) {
  if (err && typeof err.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(err.code)) return err.code
  if (err && err.message === 'Socket timeout') return 'ZEITUEBERSCHREITUNG'
  return 'NETZ'
}

export class Versand {
  #vapid
  #gleichzeitig
  #max
  #testHosts
  #agent
  #jetzt
  #protokoll
  #wiederholungMs
  #retryAfterMaxMs
  #sendeZeitMs

  #gedaechtnis
  #bereit = []
  #laufend = 0
  #geplant = new Set() // Zeitgeber für Wiederholungen
  #angehalten = false
  #leerWarter = []
  #aufraeumTimer = null

  #weg = new Map() // id → Zeitpunkt (ms)
  #fehlerListe = new Map() // id → Status
  #antworten = [] // { t, host, auth } der letzten 10 Minuten, ab #antwortenKopf
  #antwortenKopf = 0
  #fenster = { n: 0, a: 0, jeHost: new Map() } // Zähler über das Fenster
  #letzteWarnungMs = null
  #seit
  #z = { angenommen: 0, doppelt: 0, gesendet: 0, weg: 0, fehler: 0 }
  #bilanzZuletzt = ''

  constructor({
    vapid,
    gleichzeitig = 8,
    warteschlangeMax = 10000,
    testHosts = [],
    agent = undefined,
    jetzt = Date.now,
    protokoll = protokollStumm,
    wiederholungMs = WIEDERHOLUNG_MS,
    retryAfterMaxMs = RETRY_AFTER_MAX_MS,
    sendeZeitMs = SENDE_ZEIT_MS,
    gedaechtnis = undefined,
    aufraeumenMs = AUFRAEUMEN_MS,
  }) {
    this.#vapid = { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }
    this.#gleichzeitig = gleichzeitig
    this.#max = warteschlangeMax
    this.#testHosts = [...testHosts]
    this.#agent = agent
    this.#jetzt = jetzt
    this.#protokoll = protokoll
    this.#wiederholungMs = [...wiederholungMs]
    this.#retryAfterMaxMs = retryAfterMaxMs
    this.#sendeZeitMs = sendeZeitMs
    this.#gedaechtnis = gedaechtnis ?? new Gedaechtnis()
    this.#seit = new Date(jetzt()).toISOString()
    if (aufraeumenMs > 0) {
      this.#aufraeumTimer = setInterval(() => this.aufraeumen(), aufraeumenMs)
      this.#aufraeumTimer.unref?.()
    }
  }

  get wartend() {
    return this.#bereit.length + this.#laufend + this.#geplant.size
  }

  get laufend() {
    return this.#laufend
  }

  /**
   * Auftrag aus /v1/senden annehmen (Form des Auftrags schon geprüft).
   * → { status: 202, body: { angenommen, doppelt, abgelehnt } } | { status: 503, body: { fehler: 'voll' } }
   */
  annehmen(auftrag, nachrichten) {
    const jetzt = this.#jetzt()
    if (this.#angehalten) {
      this.#protokoll('voll', { auftrag, grund: 'beenden', wartend: this.wartend })
      return { status: 503, body: { fehler: 'voll' } }
    }
    const abgelehnt = []
    const neu = []
    const imAuftrag = new Set()
    let doppelt = 0
    for (const n of nachrichten) {
      const r = nachrichtPruefen(n, this.#testHosts)
      if (!r.ok) {
        abgelehnt.push({ id: r.id, grund: r.grund })
        continue
      }
      const m = r.nachricht
      if (imAuftrag.has(m.schluessel) || this.#gedaechtnis.kennt(m.schluessel, jetzt)) {
        doppelt++
        continue
      }
      imAuftrag.add(m.schluessel)
      neu.push(m)
    }

    if (neu.length > 0 && this.wartend + neu.length > this.#max) {
      this.#protokoll('voll', { auftrag, anzahl: nachrichten.length, wartend: this.wartend, warteschlange_max: this.#max })
      return { status: 503, body: { fehler: 'voll' } }
    }

    for (const m of neu) {
      this.#gedaechtnis.merken(m.schluessel, jetzt)
      const job = { ...m, annahmeMs: jetzt, versuche: 0 }
      if (!aboSchluesselGueltig(m.abo.keys)) {
        // Form stimmt, aber der Schlüssel liegt nicht auf der Kurve: Verschlüsseln ginge nie.
        this.#fehlerMerken(job, 0, 'schluessel', null)
        continue
      }
      this.#bereit.push(job)
    }
    this.#z.angenommen += neu.length
    this.#z.doppelt += doppelt

    const gruende = {}
    for (const a of abgelehnt) gruende[a.grund] = (gruende[a.grund] || 0) + 1
    this.#protokoll('auftrag', {
      auftrag,
      anzahl: nachrichten.length,
      angenommen: neu.length,
      doppelt,
      abgelehnt: abgelehnt.length,
      gruende: Object.entries(gruende).map(([g, n]) => `${g}=${n}`).join(','),
      wartend: this.wartend,
    })
    this.#pumpe()
    this.#leerPruefen()
    return { status: 202, body: { angenommen: neu.length, doppelt, abgelehnt } }
  }

  /** POST /v1/rueckmeldungen: holt und leert. Bei Warnung "auth" bleibt `weg` zurückgehalten. */
  rueckmeldungenAbholen() {
    const jetzt = this.#jetzt()
    this.aufraeumen()
    const warnung = this.#authWarnung(jetzt) ? 'auth' : null
    let weg = []
    if (warnung === null) {
      weg = [...this.#weg.keys()]
      this.#weg.clear()
    }
    const fehler = [...this.#fehlerListe].map(([id, status]) => ({ id, status }))
    this.#fehlerListe.clear()
    return { weg, fehler, warnung }
  }

  /** GET /v1/stand: nur Zahlen. */
  stand() {
    const jetzt = this.#jetzt()
    this.aufraeumen()
    const warnung = this.#authWarnung(jetzt) ? 'auth' : null
    return {
      seit: this.#seit,
      angenommen: this.#z.angenommen,
      doppelt: this.#z.doppelt,
      gesendet: this.#z.gesendet,
      weg: this.#z.weg,
      zurueckgehalten: warnung === null ? 0 : this.#weg.size,
      fehler: this.#z.fehler,
      wartend: this.wartend,
      warnung,
    }
  }

  /** Abgelaufenes wegräumen: Schlüssel älter als 24 h, Antworten älter als 10 min, `weg` älter als 24 h. */
  aufraeumen() {
    const jetzt = this.#jetzt()
    this.#gedaechtnis.aufraeumen(jetzt)
    this.#fensterKuerzen(jetzt)
    for (const [id, t] of this.#weg) {
      if (jetzt - t >= ZURUECK_MAX_MS) this.#weg.delete(id)
      else break
    }
    const bilanz = `${this.#z.angenommen}:${this.#z.gesendet}:${this.#z.weg}:${this.#z.fehler}:${this.wartend}`
    if (bilanz !== this.#bilanzZuletzt) {
      this.#bilanzZuletzt = bilanz
      this.#protokoll('bilanz', {
        angenommen: this.#z.angenommen,
        doppelt: this.#z.doppelt,
        gesendet: this.#z.gesendet,
        weg: this.#z.weg,
        fehler: this.#z.fehler,
        wartend: this.wartend,
      })
    }
  }

  /** Wartet, bis nichts mehr wartet (für Prüfungen und das Beenden). */
  fertig() {
    if (this.wartend === 0) return Promise.resolve()
    return new Promise((resolve) => this.#leerWarter.push(resolve))
  }

  /**
   * Beenden: keine neuen Sendungen mehr; was noch nicht läuft, entfällt; laufende Sendungen
   * höchstens `maxMs` abwarten. → { abgewartet, verloren }
   */
  async anhalten(maxMs = 10000) {
    this.#angehalten = true
    if (this.#aufraeumTimer) clearInterval(this.#aufraeumTimer)
    let verloren = this.#bereit.length + this.#geplant.size
    this.#bereit = []
    for (const t of this.#geplant) clearTimeout(t)
    this.#geplant.clear()
    let zeitgeber
    const abgewartet = await Promise.race([
      new Promise((resolve) => {
        if (this.#laufend === 0) resolve(true)
        else this.#leerWarter.push(() => resolve(true))
      }),
      new Promise((resolve) => {
        zeitgeber = setTimeout(() => resolve(false), maxMs)
      }),
    ])
    clearTimeout(zeitgeber)
    if (!abgewartet) verloren += this.#laufend
    return { abgewartet, verloren }
  }

  // ── intern ────────────────────────────────────────────────────────────────

  #pumpe() {
    while (!this.#angehalten && this.#laufend < this.#gleichzeitig && this.#bereit.length > 0) {
      const job = this.#bereit.shift()
      this.#laufend++
      this.#versuch(job)
        .catch(() => {})
        .finally(() => {
          this.#laufend--
          this.#pumpe()
          this.#leerPruefen()
        })
    }
  }

  #leerPruefen() {
    if (this.wartend !== 0 || this.#leerWarter.length === 0) return
    const w = this.#leerWarter
    this.#leerWarter = []
    for (const f of w) f()
  }

  #optionen(job) {
    const o = {
      TTL: job.ttl,
      urgency: job.urgency,
      vapidDetails: this.#vapid,
      contentEncoding: 'aes128gcm',
      timeout: this.#sendeZeitMs,
    }
    if (job.topic) o.topic = job.topic
    if (this.#agent) o.agent = this.#agent
    return o
  }

  async #versuch(job) {
    job.versuche++
    let status = 0
    let kopf = null
    let code = null
    try {
      const r = await webpush.sendNotification(job.abo, job.payloadText, this.#optionen(job))
      status = r && typeof r.statusCode === 'number' ? r.statusCode : 201
    } catch (err) {
      if (err && typeof err.statusCode === 'number') {
        status = err.statusCode
        kopf = err.headers || null
      } else {
        status = 0
        code = fehlerCode(err)
      }
    }
    const jetzt = this.#jetzt()
    if (status > 0) this.#antwortMerken(job.host, status, jetzt)

    const folge = einstufen(status)
    if (folge === 'gesendet') {
      this.#z.gesendet++
      return
    }
    if (folge === 'weg') {
      this.#wegMerken(job.id, jetzt)
      this.#z.weg++
      this.#protokoll('sendung', { id: job.id, host: job.host, status, versuch: job.versuche, folge: 'weg' })
      return
    }
    if (folge === 'fehler') {
      this.#fehlerMerken(job, status, null, null)
      return
    }

    // wiederholen: 429 nach Retry-After, sonst 30 s, 2 min, 10 min; danach Fehler.
    if (this.#angehalten) {
      this.#protokoll('sendung', { id: job.id, host: job.host, status, code, versuch: job.versuche, folge: 'verloren' })
      return
    }
    let wartezeit = this.#wiederholungMs[job.versuche - 1]
    if (wartezeit === undefined) {
      this.#fehlerMerken(job, status, 'versuche', code)
      return
    }
    if (status === 429) {
      const ra = retryAfterMs(kopf ? kopf['retry-after'] : null, jetzt, this.#retryAfterMaxMs)
      if (ra !== null) wartezeit = ra
    }
    if (jetzt + wartezeit > job.annahmeMs + job.ttl * 1000) {
      // Ein Versuch nach Ablauf der TTL entfällt.
      this.#fehlerMerken(job, status, 'ttl', code)
      return
    }
    this.#protokoll('sendung', {
      id: job.id,
      host: job.host,
      status,
      code,
      versuch: job.versuche,
      folge: 'wiederholen',
      wartezeit_s: Math.round(wartezeit / 1000),
    })
    const t = setTimeout(() => {
      this.#geplant.delete(t)
      if (this.#angehalten) return
      this.#bereit.push(job)
      this.#pumpe()
      this.#leerPruefen()
    }, wartezeit)
    this.#geplant.add(t)
  }

  #fehlerMerken(job, status, grund, code) {
    this.#z.fehler++
    this.#fehlerListe.delete(job.id)
    this.#fehlerListe.set(job.id, status)
    while (this.#fehlerListe.size > LISTE_MAX) this.#fehlerListe.delete(this.#fehlerListe.keys().next().value)
    this.#protokoll('sendung', { id: job.id, host: job.host, status, code, grund, versuch: job.versuche, folge: 'fehler' })
  }

  #wegMerken(id, jetzt) {
    this.#weg.delete(id)
    this.#weg.set(id, jetzt)
    while (this.#weg.size > LISTE_MAX) this.#weg.delete(this.#weg.keys().next().value)
  }

  // Fenster der Antworten (10 min) als Schlange mit Kopfzeiger und laufenden Zählern: Jede
  // Antwort kostet O(1), auch wenn ein Konfigurationsfehler tausende 403 auf einmal bringt.
  #fensterRaus() {
    const x = this.#antworten[this.#antwortenKopf]
    this.#antwortenKopf++
    this.#fenster.n--
    if (x.auth) this.#fenster.a--
    const h = this.#fenster.jeHost.get(x.host)
    h.n--
    if (x.auth) h.a--
    if (h.n === 0) this.#fenster.jeHost.delete(x.host)
  }

  #fensterKuerzen(jetzt) {
    const grenze = jetzt - FENSTER_MS
    while (this.#antwortenKopf < this.#antworten.length && this.#antworten[this.#antwortenKopf].t <= grenze) this.#fensterRaus()
    while (this.#fenster.n > ANTWORTEN_MAX) this.#fensterRaus()
    if (this.#antwortenKopf > 1024 && this.#antwortenKopf * 2 > this.#antworten.length) {
      this.#antworten = this.#antworten.slice(this.#antwortenKopf)
      this.#antwortenKopf = 0
    }
  }

  #antwortMerken(host, status, jetzt) {
    const auth = status === 401 || status === 403
    this.#antworten.push({ t: jetzt, host, auth })
    this.#fenster.n++
    if (auth) this.#fenster.a++
    const h = this.#fenster.jeHost.get(host) || { n: 0, a: 0 }
    h.n++
    if (auth) h.a++
    this.#fenster.jeHost.set(host, h)
    this.#fensterKuerzen(jetzt)
    if (auth && this.#authWarnung(jetzt)) {
      if (this.#letzteWarnungMs === null || jetzt - this.#letzteWarnungMs >= WARN_PROTOKOLL_MS) {
        this.#letzteWarnungMs = jetzt
        this.#protokoll('warnung', { warnung: 'auth', antworten: this.#fenster.n, auth: this.#fenster.a, zurueckgehalten: this.#weg.size })
      }
    }
  }

  /**
   * Schutz vor Massenlöschung: In den letzten 10 min mehr als 20 % 401/403 (bei mindestens 10
   * Antworten) oder alle Antworten eines Hosts (mindestens 5) → Warnung "auth".
   */
  #authWarnung(jetzt) {
    this.#fensterKuerzen(jetzt)
    const { n, a } = this.#fenster
    if (n === 0) return false
    if (n >= AUTH_MIN_ANTWORTEN && a / n > AUTH_ANTEIL) return true
    for (const h of this.#fenster.jeHost.values()) {
      if (h.n >= AUTH_MIN_HOST && h.a === h.n) return true
    }
    return false
  }
}
