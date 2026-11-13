// Zwischenspeicher der API im Service Worker (Review-Befund „api-cache“).
//
// vite.config.ts legt GET-Antworten von api.responda.systems mit NetworkFirst im Cache
// `api-cache` ab (24 Stunden, 300 Einträge), damit die App kurz ohne Netz weiterläuft. Diese
// Antworten liegen unverschlüsselt im Browser. Sammlungen mit Patienten- oder Gesundheitsdaten,
// Konten, Einsätze, Chat und Notizen nimmt vite.config.ts deshalb ganz aus (NetworkOnly, Liste in
// zwischenspeicherRegel.ts). Was sonst darin liegt (Lager, MPG, Lernbar, Termine …), löscht die
// App, sobald sich die angemeldete Person ändert (Abmelden, andere Person, Anmeldung abgelaufen),
// beim Start ohne gültige Anmeldung (auch nach einer Umleitung auf /login) und noch einmal kurz
// danach, weil eine beim Abmelden noch laufende Anfrage ihre Antwort später hineinschreiben kann.
// Antworten älter als 24 Stunden löscht sie bei jedem Start. So findet die Nächste am Gerät
// nichts von der Vorigen.
//
// Bleiben darf nur die Organisation (`organizations`): Die öffentlichen Formulare (Patientendoku
// ohne Netz) brauchen sie, und sie enthält keine Daten von Personen.
//
// Keine Imports aus React oder PocketBase: die Prüffälle laufen in Node
// (src/lib/__tests__/zwischenspeicher.test.ts).

/** Name des Caches in vite.config.ts (Regel NetworkFirst für api.responda.systems). */
export const API_CACHE = 'api-cache'

/** Darf diese Antwort beim Wechsel der Person im Zwischenspeicher bleiben? */
export function bleibtBeimWechsel(url: string): boolean {
  try {
    const u = new URL(url)
    return /^\/api\/collections\/organizations\/records(\/[^/]*)?$/.test(u.pathname)
  } catch {
    return false
  }
}

type CacheSpeicher = Pick<CacheStorage, 'has' | 'open'>

/**
 * Löscht alle Antworten aus `api-cache`, die nicht bleiben dürfen. Wartet höchstens `zeitMs`
 * (Vorgabe 2000), damit Abmelden nie hängt. Ergebnis: Zahl der gelöschten Einträge (0 ohne
 * Cache Storage, ohne Cache oder bei einem Fehler).
 */
export async function apiZwischenspeicherLeeren(o: { caches?: CacheSpeicher | null; zeitMs?: number } = {}): Promise<number> {
  let cs: CacheSpeicher | null = null
  try { cs = o.caches !== undefined ? o.caches : ((globalThis as { caches?: CacheSpeicher }).caches ?? null) } catch { cs = null }
  if (!cs) return 0
  const speicher = cs
  const arbeit = (async () => {
    if (!(await speicher.has(API_CACHE))) return 0
    const c = await speicher.open(API_CACHE)
    let n = 0
    for (const anfrage of await c.keys()) {
      if (bleibtBeimWechsel(anfrage.url)) continue
      if (await c.delete(anfrage)) n++
    }
    return n
  })().catch(() => 0)
  let uhr: ReturnType<typeof setTimeout> | undefined
  const zeit = new Promise<number>((r) => { uhr = setTimeout(() => r(0), o.zeitMs ?? 2000) })
  try {
    return await Promise.race([arbeit, zeit])
  } finally {
    if (uhr !== undefined) clearTimeout(uhr)
  }
}

/**
 * Beobachtet die angemeldete Person (main.tsx): Ändert sich die Kennung (Abmelden, andere
 * Person, Anmeldung abgelaufen), wird der Zwischenspeicher geleert. Ein bloßes Erneuern des
 * Tokens derselben Person ändert nichts.
 */
export function wechselBeobachten(
  start: string,
  anmelden: (f: (id: string) => void) => unknown,
  leeren: () => unknown = () => apiZwischenspeicherLeeren(),
  o: { nochmalMs?: number; uhr?: (f: () => void, ms: number) => unknown } = {},
): void {
  let zuletzt = start
  const uhr = o.uhr ?? ((f: () => void, ms: number) => setTimeout(f, ms))
  anmelden((id) => {
    if (id === zuletzt) return
    zuletzt = id
    try { void leeren() } catch { /* egal */ }
    // Eine Anfrage, die beim Wechsel noch lief, schreibt ihre Antwort danach in den Cache
    // (NetworkFirst wartet bis zu 5 Sekunden): kurz darauf noch einmal leeren.
    try { uhr(() => { if (zuletzt === id) { try { void leeren() } catch { /* egal */ } } }, o.nochmalMs ?? NOCHMAL_MS) } catch { /* egal */ }
  })
}

/** Abstand für das zweite Leeren nach einem Wechsel oder Start ohne Anmeldung. */
export const NOCHMAL_MS = 10_000

/**
 * Beim Start der App (main.tsx): Ohne gültige Anmeldung, etwa nach dem Abmelden oder einer
 * Umleitung auf /login, den Zwischenspeicher leeren, und nach `nochmalMs` noch einmal, falls
 * eine Anfrage der vorigen Person ihre Antwort erst danach hineinschreibt.
 */
export function ohneAnmeldungLeeren(
  angemeldet: () => boolean,
  leeren: () => unknown = () => apiZwischenspeicherLeeren(),
  o: { nochmalMs?: number; uhr?: (f: () => void, ms: number) => unknown } = {},
): void {
  const ohne = () => { try { return !angemeldet() } catch { return true } }
  if (!ohne()) return
  try { void leeren() } catch { /* egal */ }
  const uhr = o.uhr ?? ((f: () => void, ms: number) => setTimeout(f, ms))
  try { uhr(() => { if (ohne()) { try { void leeren() } catch { /* egal */ } } }, o.nochmalMs ?? NOCHMAL_MS) } catch { /* egal */ }
}

/** Höchstes Alter einer Antwort im Zwischenspeicher (wie maxAgeSeconds in vite.config.ts). */
export const HOECHSTALTER_MS = 24 * 60 * 60 * 1000

/**
 * Löscht Antworten, die älter als `hoechstalterMs` sind (nach ihrem Date-Kopf; ohne lesbares
 * Datum gilt eine Antwort als alt). Workbox selbst entfernt sie erst bei der nächsten Anfrage
 * über die Regel; das hier läuft bei jedem Start. Ergebnis: Zahl der gelöschten Einträge.
 */
export async function veralteteLoeschen(o: { caches?: CacheSpeicher | null; jetzt?: number; hoechstalterMs?: number } = {}): Promise<number> {
  let cs: CacheSpeicher | null = null
  try { cs = o.caches !== undefined ? o.caches : ((globalThis as { caches?: CacheSpeicher }).caches ?? null) } catch { cs = null }
  if (!cs) return 0
  const jetzt = o.jetzt ?? Date.now()
  const grenze = o.hoechstalterMs ?? HOECHSTALTER_MS
  try {
    if (!(await cs.has(API_CACHE))) return 0
    const c = await cs.open(API_CACHE)
    let n = 0
    for (const anfrage of await c.keys()) {
      const antwort = await c.match(anfrage)
      const datum = Date.parse(antwort?.headers.get('date') ?? '')
      if (Number.isFinite(datum) && jetzt - datum <= grenze) continue
      if (await c.delete(anfrage)) n++
    }
    return n
  } catch {
    return 0
  }
}
