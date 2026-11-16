// Push-Benachrichtigungen: was das Gerät kann, Abo und Merker (Bauplan Push, 6.1 und 6.2).
//
// Reine Teile (unterstuetzung, geraetName, schluesselBytes, urlSicher, merkerNormal) haben Prüffälle
// in src/lib/__tests__/pushGeraet.test.ts. Die Browser-Teile kapseln Service Worker, PushManager,
// Notification und IndexedDB; jeder Fehler endet ruhig (Push ist keine Alarmierung, die App läuft
// ohne weiter).
//
// Merker: IndexedDB `responda-push`, Speicher `meta`, Schlüssel `stand`. Der Service Worker
// (public/sw-push.js) liest ihn bei jeder Push-Nachricht: Einzelheiten zeigt er nur, wenn `person`
// die Person der Nachricht ist und die Anmeldung auf dem Gerät noch gilt (`ablauf`, Owner 12.4).

/** Was das Gerät für Push mitbringt (6.2). */
export type Unterstuetzung = 'ok' | 'unsicher' | 'capacitor' | 'ios_homebildschirm' | 'ios_alt' | 'browser'

export interface Umgebung {
  /** isSecureContext */
  sicher: boolean
  /** im Capacitor-Rahmen (ios/) */
  capacitor: boolean
  ua: string
  /** navigator.maxTouchPoints (iPadOS meldet sich mit dem UA eines Mac) */
  touchPunkte: number
  /** als App vom Homebildschirm (navigator.standalone oder display-mode: standalone) */
  standalone: boolean
  serviceWorker: boolean
  pushManager: boolean
  notification: boolean
}

function iosVersion(ua: string, ipadMitMacUa: boolean): number | null {
  const m = ipadMitMacUa ? /Version\/(\d+)(?:\.(\d+))?/.exec(ua) : /OS (\d+)[_.](\d+)/.exec(ua)
  if (!m) return null
  return Number(m[1]) + Number(m[2] || 0) / 100
}

/** iPhone, iPod oder iPad (auch iPadOS mit dem UA eines Mac und Touch). */
export function istIos(ua: string, touchPunkte: number): boolean {
  return /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && touchPunkte > 1)
}

/**
 * Kann dieses Gerät Push? Reihenfolge wie im Bauplan 6.2: unsichere Verbindung, Capacitor,
 * iPhone/iPad außerhalb des Homebildschirms, iOS zu alt, fehlende Schnittstellen, sonst ok.
 */
export function unterstuetzung(u: Umgebung): Unterstuetzung {
  if (!u.sicher) return 'unsicher'
  if (u.capacitor) return 'capacitor'
  const ua = String(u.ua || '')
  if (istIos(ua, u.touchPunkte)) {
    if (!u.standalone) return 'ios_homebildschirm'
    const v = iosVersion(ua, !/iPhone|iPod|iPad/.test(ua))
    if (!u.pushManager || (v !== null && v < 16.04)) return 'ios_alt'
  }
  if (!u.serviceWorker || !u.pushManager || !u.notification) return 'browser'
  return 'ok'
}

/** Liest die Umgebung aus dem Browser (ohne Fenster: nichts unterstützt). */
export function umgebungLesen(): Umgebung {
  const w = (typeof window !== 'undefined' ? window : undefined) as (Window & { Capacitor?: { isNativePlatform?: () => boolean } }) | undefined
  const n = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & { standalone?: boolean }) | undefined
  let standalone = false
  try { standalone = n?.standalone === true || !!w?.matchMedia?.('(display-mode: standalone)').matches } catch { standalone = false }
  let capacitor = false
  try {
    const c = w?.Capacitor
    capacitor = !!c && (typeof c.isNativePlatform === 'function' ? c.isNativePlatform() === true : true)
  } catch { capacitor = false }
  return {
    sicher: !!w?.isSecureContext,
    capacitor,
    ua: String(n?.userAgent || ''),
    touchPunkte: Number(n?.maxTouchPoints) || 0,
    standalone,
    serviceWorker: !!n && 'serviceWorker' in n,
    pushManager: !!w && 'PushManager' in w,
    notification: !!w && 'Notification' in w,
  }
}

/**
 * Kurze Bezeichnung des Geräts für die Geräteliste, etwa „iPhone, Homebildschirm“ oder
 * „Windows, Edge“. Nur Zeichen, die der Server zulässt (geraetBezeichnung: Buchstaben, Ziffern,
 * Leerzeichen, Komma), nie mehr als der UA hergibt.
 */
export function geraetName(ua: string, standalone: boolean, ipad = false): string {
  const s = String(ua || '')
  let system = 'Gerät'
  if (/iPhone|iPod/.test(s)) system = 'iPhone'
  else if (/iPad/.test(s) || (ipad && /Macintosh/.test(s))) system = 'iPad'
  else if (/Android/.test(s)) system = 'Android'
  else if (/CrOS/.test(s)) system = 'Chromebook'
  else if (/Windows/.test(s)) system = 'Windows'
  else if (/Macintosh|Mac OS X/.test(s)) system = 'Mac'
  else if (/Linux/.test(s)) system = 'Linux'
  if (standalone) return system + ', ' + (system === 'iPhone' || system === 'iPad' || system === 'Android' ? 'Homebildschirm' : 'App')
  let browser = 'Browser'
  if (/Edg(?:e|A|iOS)?\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet'
  else if (/Firefox\/|FxiOS/.test(s)) browser = 'Firefox'
  else if (/CriOS|Chrome\/|Chromium/.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s)) browser = 'Safari'
  return system + ', ' + browser
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** base64url ohne „=“ aus Bytes. */
export function base64url(bytes: Uint8Array): string {
  let aus = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    aus += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    if (i + 1 < bytes.length) aus += B64[(n >> 6) & 63]
    if (i + 2 < bytes.length) aus += B64[n & 63]
  }
  return aus
}

/**
 * Öffentlicher VAPID-Schlüssel (base64url, 87 Zeichen) als Bytes für pushManager.subscribe.
 * Nur ein unkomprimierter Punkt auf P-256 (65 Byte, erstes Byte 4); sonst ein Fehler.
 */
export function schluesselBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = String(b64 ?? '').replace(/=+$/, '')
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) throw new Error('Schlüssel ungültig')
  const laenge = Math.floor((s.length * 3) / 4)
  const aus = new Uint8Array(laenge)
  let bits = 0, puffer = 0, j = 0
  for (let i = 0; i < s.length; i++) {
    puffer = (puffer << 6) | B64.indexOf(s[i])
    bits += 6
    if (bits >= 8) {
      bits -= 8
      aus[j++] = (puffer >> bits) & 255
    }
  }
  if (aus.length !== 65 || aus[0] !== 4) throw new Error('Schlüssel ungültig')
  return aus
}

/**
 * Nur Pfade der App: "/" + [A-Za-z0-9/_-?=&.%:]*, nicht "//", kein "\"; sonst "/hub".
 * Gleiche Fassung in pb_hooks/push-regeln.js und public/sw-push.js (Dreiwege-Prüfung).
 */
export function urlSicher(url: unknown): string {
  if (typeof url !== 'string') return '/hub'
  if (!/^\/[A-Za-z0-9\/_\-?=&.%:]*$/.test(url)) return '/hub'
  if (url.indexOf('//') === 0 || url.indexOf('\\') >= 0) return '/hub'
  return url
}

/** Erste 16 Hex-Zeichen von sha256(endpoint), wie `kennung` in /api/responda/push/stand. */
export async function endpointKennung(endpoint: string): Promise<string> {
  try {
    const c = globalThis.crypto?.subtle
    if (!c) return ''
    const h = new Uint8Array(await c.digest('SHA-256', new TextEncoder().encode(String(endpoint))))
    let hex = ''
    for (let i = 0; i < 8; i++) hex += h[i].toString(16).padStart(2, '0')
    return hex
  } catch {
    return ''
  }
}

// ── Merker (IndexedDB responda-push) ──────────────────────────────────────

/** Was das Gerät über sein Abo weiß. Hinweis-Merker: nur { abgemeldet } oder { neu_einschalten, person, schluessel }. */
export interface PushMerker {
  /** users.id der Person, der das Abo gehört */
  person?: string
  /** Adresse der API (wie sw-formulare.js) */
  api?: string
  /** applicationServerKey, mit dem abonniert wurde (base64url) */
  schluessel?: string
  endpoint?: string
  /** zuletzt beim Server gemeldet (ms) */
  gemeldet?: number
  /** Ablauf der Anmeldung auf dem Gerät (ms, aus dem Token); danach nur neutraler Text (Owner 12.4) */
  ablauf?: number | null
  /** der Service Worker hat ein neues Abo bekommen (pushsubscriptionchange) */
  abo_geaendert?: boolean
  /** Schlüssel gewechselt und still nicht heilbar: „Push neu einschalten“ */
  neu_einschalten?: boolean
  /** in der Geräteliste eines anderen Geräts abgemeldet (Grabstein) */
  abgemeldet?: boolean
}

/** Nur bekannte Felder mit passendem Typ; sonst null. */
export function merkerNormal(roh: unknown): PushMerker | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null
  const r = roh as Record<string, unknown>
  const m: PushMerker = {}
  for (const k of ['person', 'api', 'schluessel', 'endpoint'] as const) if (typeof r[k] === 'string' && r[k]) m[k] = r[k] as string
  if (typeof r.gemeldet === 'number' && Number.isFinite(r.gemeldet)) m.gemeldet = r.gemeldet
  if (typeof r.ablauf === 'number' && Number.isFinite(r.ablauf)) m.ablauf = r.ablauf
  else if (r.ablauf === null) m.ablauf = null
  for (const k of ['abo_geaendert', 'neu_einschalten', 'abgemeldet'] as const) if (r[k] === true) m[k] = true
  return Object.keys(m).length ? m : null
}

const DB = 'responda-push'
const SPEICHER = 'meta'
const SCHLUESSEL = 'stand'
/** IndexedDB kann bei einem Versionswechsel hängen: nie länger warten (wie MERKER_ZEIT_MS im Service Worker) */
const DB_ZEIT_MS = 1500

function warte(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms))
}

/** Promise mit Höchstdauer: danach `sonst`. Fehler werden zu `sonst`. */
export function mitZeit<T>(p: Promise<T>, ms: number, sonst: T): Promise<T> {
  return Promise.race([p.catch(() => sonst), warte(ms).then(() => sonst)])
}

function dbOeffnen(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  const p = new Promise<IDBDatabase | null>((ok) => {
    let r: IDBOpenDBRequest
    try { r = indexedDB.open(DB, 1) } catch { ok(null); return }
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains(SPEICHER)) d.createObjectStore(SPEICHER)
    }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ok(null)
    r.onblocked = () => ok(null)
  })
  return mitZeit(p, DB_ZEIT_MS, null)
}

function anfrage<T>(art: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  return dbOeffnen().then((db) => {
    if (!db) return undefined
    const p = new Promise<T | undefined>((ok) => {
      try {
        const tx = db.transaction(SPEICHER, art)
        let ergebnis: T | undefined
        const req = f(tx.objectStore(SPEICHER))
        if (req) req.onsuccess = () => { ergebnis = req.result as T }
        tx.oncomplete = () => ok(ergebnis)
        tx.onerror = () => ok(undefined)
        tx.onabort = () => ok(undefined)
      } catch {
        ok(undefined)
      }
    })
    return mitZeit(p, DB_ZEIT_MS, undefined).finally(() => { try { db.close() } catch { /* zu */ } })
  })
}

export async function merkerLesen(): Promise<PushMerker | null> {
  try { return merkerNormal(await anfrage<unknown>('readonly', (s) => s.get(SCHLUESSEL))) } catch { return null }
}

export async function merkerSchreiben(m: PushMerker): Promise<void> {
  const n = merkerNormal(m)
  if (!n) return merkerLoeschen()
  try { await anfrage('readwrite', (s) => s.put(n, SCHLUESSEL)) } catch { /* ohne Merker: der Abgleich meldet beim nächsten Start lokal ab */ }
}

export async function merkerLoeschen(): Promise<void> {
  try { await anfrage('readwrite', (s) => s.delete(SCHLUESSEL)) } catch { /* egal */ }
}

// ── Service Worker, Abo, Benachrichtigungen ───────────────────────────────

function swContainer(): ServiceWorkerContainer | null {
  try { return typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null } catch { return null }
}

/** Registrierung des Service Workers, falls es eine gibt (wartet nicht auf eine neue). */
export async function registrierung(): Promise<ServiceWorkerRegistration | null> {
  const c = swContainer()
  if (!c) return null
  try { return (await mitZeit(c.getRegistration(), 3000, undefined)) ?? null } catch { return null }
}

/** Das Abo dieses Geräts, sonst null. */
export async function aktuellesAbo(): Promise<PushSubscription | null> {
  const reg = await registrierung()
  if (!reg || !reg.pushManager) return null
  try { return await mitZeit(reg.pushManager.getSubscription(), 3000, null) } catch { return null }
}

/** applicationServerKey eines Abos als base64url, sonst null. */
export function aboSchluessel(abo: PushSubscription | null | undefined): string | null {
  try {
    const k = abo?.options?.applicationServerKey
    return k ? base64url(new Uint8Array(k)) : null
  } catch {
    return null
  }
}

/**
 * Abonnieren mit dem öffentlichen Schlüssel des Servers. Ein vorhandenes Abo mit demselben
 * Schlüssel bleibt; eines mit anderem Schlüssel (gewechselt) wird erst abgemeldet.
 */
export async function abonnieren(schluessel: string): Promise<PushSubscription> {
  const bytes = schluesselBytes(schluessel)
  const c = swContainer()
  if (!c) throw new Error('kein Service Worker')
  const reg = await Promise.race([c.ready, warte(10000).then(() => { throw new Error('Service Worker nicht bereit') })])
  const alt = await reg.pushManager.getSubscription()
  if (alt) {
    if (aboSchluessel(alt) === base64url(bytes)) return alt
    try { await alt.unsubscribe() } catch { /* weiter mit neuem Abo */ }
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
}

/** App-Abzeichen löschen, nur wo der Browser es kennt. */
export async function abzeichenLoeschen(): Promise<void> {
  try {
    const n = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
    if (typeof n.clearAppBadge === 'function') await n.clearAppBadge()
  } catch { /* egal */ }
}

/** Alle angezeigten Benachrichtigungen von Responda schließen, dann das Abzeichen löschen. */
export async function benachrichtigungenSchliessen(): Promise<void> {
  try {
    const reg = await registrierung()
    if (reg && typeof reg.getNotifications === 'function') {
      const liste = await mitZeit(reg.getNotifications(), 3000, [] as Notification[])
      for (const b of liste) { try { b.close() } catch { /* weiter */ } }
    }
  } catch { /* egal */ }
  await abzeichenLoeschen()
}

/** Abo dieses Geräts beenden, Merker löschen, Benachrichtigungen schließen (ohne Server). */
export async function abmeldenLokal(): Promise<void> {
  const abo = await aktuellesAbo()
  if (abo) { try { await abo.unsubscribe() } catch { /* weiter */ } }
  await merkerLoeschen()
  await benachrichtigungenSchliessen()
}

/** Erlaubnis für Benachrichtigungen: 'granted' | 'denied' | 'default' (ohne Schnittstelle 'default'). */
export function erlaubnisLesen(): NotificationPermission {
  try { return typeof Notification !== 'undefined' ? Notification.permission : 'default' } catch { return 'default' }
}
