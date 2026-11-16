// Prüfung der Aufträge von PocketBase (Vertrag 1.1 im Bauplan), rein und ohne Seiteneffekte.
//
// PocketBase prüft dieselben Abos mit derselben Liste und denselben Regex (pb_hooks/push-regeln.js,
// `aboPruefen`). Der Dienst prüft zusätzlich mit `new URL`, weil er die einzige Stelle ist, die
// wirklich sendet: Er ist die letzte Sperre gegen Sendungen an fremde oder lokale Adressen.

// Erlaubte Hosts der Push-Dienste. Einträge mit Punkt vorn sind Endungen.
// Gleiche Liste wie HOSTS in pb_hooks/push-regeln.js; eine Prüfung der Integration liest diese
// Zeile per Regex, deshalb bleibt sie eine einzelne Zeile mit einem Feld-Literal.
export const HOSTS = ['fcm.googleapis.com', '.push.apple.com', 'push.services.mozilla.com', '.push.services.mozilla.com', '.notify.windows.com']
Object.freeze(HOSTS)

export const GRENZEN = Object.freeze({
  bodyBytes: 1048576, // 1 MB
  nachrichten: 500,
  payloadBytes: 3800, // vor dem Auffüllen, gemessen als JSON in UTF-8
  auffuellenKlein: 2048,
  auffuellenGross: 3800,
  ttlMax: 604800,
  endpointLaenge: 1000,
  gedaechtnisMs: 24 * 3600 * 1000,
  gedaechtnisMax: 200000,
})

export const DRINGLICHKEITEN = Object.freeze(['very-low', 'low', 'normal', 'high'])

// Wie ENDPOINT_RE und ENDPOINT_WNS_RE in pb_hooks/push-regeln.js (Bauplan 4.1).
// https://, Host aus Kleinbuchstaben, Ziffern, Bindestrich und Punkt (kein Punkt am Ende, kein
// leeres Label), kein Port, kein Benutzerteil, Pfad nur aus [A-Za-z0-9._~:/%+=-], keine Query,
// kein Fragment, kein Backslash, kein @, kein #, kein Leerraum.
export const ENDPOINT_RE = /^https:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(\/[A-Za-z0-9._~:\/%+=-]*)$/
// Nur für Hosts auf .notify.windows.com zusätzlich: Pfad + "?token=" + [A-Za-z0-9%._~+=-]+.
// Labels wie oben (strenger als [a-z0-9.-]+ im Bauplan, gleich wie push-regeln.js).
export const ENDPOINT_WNS_RE = /^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+notify\.windows\.com)(\/[A-Za-z0-9._~:\/%+=-]*)\?token=[A-Za-z0-9%._~+=-]+$/
// Nur in Prüfungen (PUSH_TEST_HOSTS): https://127.0.0.1:<port>/…
export const ENDPOINT_TEST_RE = /^https:\/\/127\.0\.0\.1:([0-9]{2,5})(\/[A-Za-z0-9._~:\/%+=-]*)$/

const WNS_ENDUNG = '.notify.windows.com'

export const ID_RE = /^[a-z0-9]{15}$/
export const SCHLUESSEL_RE = /^[a-z0-9:_-]{1,100}$/
export const AUFTRAG_RE = /^[a-z0-9]{1,40}$/
export const P256DH_RE = /^B[A-Za-z0-9_-]{86}$/
export const AUTH_RE = /^[A-Za-z0-9_-]{22}$/
export const TOPIC_RE = /^[A-Za-z0-9_-]{1,32}$/
export const TEST_HOST_RE = /^127\.0\.0\.1:[0-9]{2,5}$/

/**
 * Host erlaubt? `host` ist der Host der Adresse, bei Prüf-Hosts mit Port ("127.0.0.1:8631").
 * Prüf-Hosts zählen nur, wenn sie in `testHosts` stehen (PUSH_TEST_HOSTS, nie im Betrieb).
 */
export function hostErlaubt(host, testHosts = []) {
  if (typeof host !== 'string' || host === '') return false
  if (Array.isArray(testHosts) && testHosts.includes(host)) return true
  for (const eintrag of HOSTS) {
    if (eintrag.startsWith('.')) {
      if (host.length > eintrag.length && host.endsWith(eintrag)) return true
    } else if (host === eintrag) {
      return true
    }
  }
  return false
}

/**
 * Endpoint prüfen: erst die Regex wie PocketBase, dann zusätzlich `new URL`.
 * → { ok: true, host } | { ok: false }
 */
export function endpointPruefen(endpoint, testHosts = []) {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > GRENZEN.endpointLaenge) {
    return { ok: false }
  }
  let host = null
  let wns = false
  let test = false
  let m = ENDPOINT_RE.exec(endpoint)
  if (m) {
    host = m[1]
  } else if ((m = ENDPOINT_WNS_RE.exec(endpoint))) {
    host = m[1]
    wns = true
  } else if (Array.isArray(testHosts) && testHosts.length > 0 && (m = ENDPOINT_TEST_RE.exec(endpoint))) {
    host = '127.0.0.1:' + m[1]
    test = true
  } else {
    return { ok: false }
  }
  if (test ? !testHosts.includes(host) : !hostErlaubt(host, [])) return { ok: false }
  if (wns && !(host.length > WNS_ENDUNG.length && host.endsWith(WNS_ENDUNG))) return { ok: false }

  // Zusätzlich: Die Adresse muss genau so bleiben, wie WHATWG URL sie liest.
  let u
  try {
    u = new URL(endpoint)
  } catch {
    return { ok: false }
  }
  if (u.href !== endpoint) return { ok: false }
  if (u.protocol !== 'https:') return { ok: false }
  if (u.username !== '' || u.password !== '') return { ok: false }
  if (u.hash !== '') return { ok: false }
  if (u.search !== '' && !wns) return { ok: false }
  if (test) {
    if (u.host !== host || !testHosts.includes(u.host)) return { ok: false }
  } else {
    if (u.port !== '') return { ok: false }
    if (u.hostname !== host || !hostErlaubt(u.hostname, [])) return { ok: false }
  }
  return { ok: true, host: u.host }
}

/** base64url ohne "=": ein angehängtes "=" oder "==" wird entfernt (Vertrag 1.1). */
export function schluesselBereinigen(wert) {
  if (typeof wert !== 'string') return null
  return wert.replace(/={1,2}$/, '')
}

export function keysPruefen(keys) {
  if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) return { ok: false }
  const p256dh = schluesselBereinigen(keys.p256dh)
  const auth = schluesselBereinigen(keys.auth)
  if (p256dh === null || !P256DH_RE.test(p256dh)) return { ok: false }
  if (auth === null || !AUTH_RE.test(auth)) return { ok: false }
  return { ok: true, keys: { p256dh, auth } }
}

export function utf8Bytes(text) {
  return Buffer.byteLength(text, 'utf8')
}

/** Größe der Payload als JSON in UTF-8, vor dem Auffüllen. */
export function payloadBytes(payload) {
  return utf8Bytes(JSON.stringify(payload))
}

export function istObjekt(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * Füllt die Payload mit dem Feld "f" (Text aus "0") auf genau 2048 Bytes auf, größere auf genau
 * 3800. So erkennt der Hersteller an der Größe nicht, worum es geht. Liegt eine erlaubte Payload
 * so knapp unter 3800 Bytes, dass schon das leere Feld darüber führt (höchstens 7 Bytes), bleibt
 * es beim leeren Feld; das passt weiter in einen Datensatz nach RFC 8291 (3993 Bytes).
 */
export function auffuellen(payload) {
  const ohne = JSON.stringify({ ...payload, f: '' })
  const n = utf8Bytes(ohne)
  const ziel = n <= GRENZEN.auffuellenKlein ? GRENZEN.auffuellenKlein : n <= GRENZEN.auffuellenGross ? GRENZEN.auffuellenGross : n
  return JSON.stringify({ ...payload, f: '0'.repeat(ziel - n) })
}

/**
 * Eine Nachricht aus /v1/senden prüfen.
 * → { ok: true, nachricht: { id, schluessel, abo, payloadText, ttl, urgency, topic, host } }
 *   | { ok: false, id, grund }  mit grund aus endpoint|keys|payload|ttl|urgency|topic|kennung
 */
export function nachrichtPruefen(n, testHosts = []) {
  if (!istObjekt(n)) return { ok: false, id: null, grund: 'kennung' }
  const id = typeof n.id === 'string' && ID_RE.test(n.id) ? n.id : null
  if (id === null) return { ok: false, id: null, grund: 'kennung' }

  const abo = n.abo
  if (!istObjekt(abo)) return { ok: false, id, grund: 'endpoint' }
  const ep = endpointPruefen(abo.endpoint, testHosts)
  if (!ep.ok) return { ok: false, id, grund: 'endpoint' }
  const k = keysPruefen(abo.keys)
  if (!k.ok) return { ok: false, id, grund: 'keys' }

  if (typeof n.schluessel !== 'string' || !SCHLUESSEL_RE.test(n.schluessel)) return { ok: false, id, grund: 'kennung' }

  const payload = n.payload
  if (!istObjekt(payload)) return { ok: false, id, grund: 'payload' }
  if (Object.prototype.hasOwnProperty.call(payload, 'f')) return { ok: false, id, grund: 'payload' }
  if (payloadBytes(payload) > GRENZEN.payloadBytes) return { ok: false, id, grund: 'payload' }

  if (typeof n.ttl !== 'number' || !Number.isInteger(n.ttl) || n.ttl < 0 || n.ttl > GRENZEN.ttlMax) {
    return { ok: false, id, grund: 'ttl' }
  }
  if (typeof n.urgency !== 'string' || !DRINGLICHKEITEN.includes(n.urgency)) return { ok: false, id, grund: 'urgency' }

  let topic = null
  if (n.topic !== undefined && n.topic !== null) {
    if (typeof n.topic !== 'string' || !TOPIC_RE.test(n.topic)) return { ok: false, id, grund: 'topic' }
    topic = n.topic
  }

  return {
    ok: true,
    nachricht: {
      id,
      schluessel: n.schluessel,
      abo: { endpoint: abo.endpoint, keys: k.keys },
      payloadText: auffuellen(payload),
      ttl: n.ttl,
      urgency: n.urgency,
      topic,
      host: ep.host,
    },
  }
}

/**
 * Form des Auftrags prüfen (ohne die einzelnen Nachrichten).
 * → { ok: true, auftrag, nachrichten } | { ok: false }  (dann 400 {"fehler":"body"})
 */
export function auftragPruefen(body) {
  if (!istObjekt(body)) return { ok: false }
  if (typeof body.auftrag !== 'string' || !AUFTRAG_RE.test(body.auftrag)) return { ok: false }
  if (!Array.isArray(body.nachrichten) || body.nachrichten.length > GRENZEN.nachrichten) return { ok: false }
  return { ok: true, auftrag: body.auftrag, nachrichten: body.nachrichten }
}
