// Offline-Betrieb für das Lager.
//
// Anders als bei EKS sind Lagerbuchungen keine anhängenden Ereignisse, sondern
// lesen-rechnen-schreiben auf absoluten Mengen. Zwei Geräte, die offline dieselbe
// Bestandszeile fortschreiben, würden sich gegenseitig überschreiben.
//
// Deshalb wird nicht der ZUSTAND gespeichert, sondern die ABSICHT: „von Artikel X
// am Standort Y die Menge Z, Charge C". Beim Wiederverbinden wird sie gegen den
// dann aktuellen Serverstand ausgeführt. Das braucht keine Konfliktauflösung —
// zwei Geräte, die offline je 2 Stück entnehmen, ergeben in Summe 4.

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'responda-lager'
const DB_VERSION = 1

export interface PendingPosition {
  item_id: string
  item_name: string
  delta: number
  expiry?: string
  batch?: string
  einsatz?: string
  /** Gescannte Charge — wird beim Übertragen zuerst entnommen. */
  charge?: { batch: string; mhd?: string | null }
}

export interface PendingBuchung extends PendingPosition {
  id: string
  location_id: string
  /**
   * Zugleich ID der ersten Journalzeile auf dem Server. Wurde schon einmal
   * gesendet und kam keine Antwort, erkennt die Übertragung daran, dass die
   * Buchung schon angekommen ist — sie wird nicht doppelt gebucht.
   */
  client_id?: string
  /** Weitere Positionen derselben Buchung (Mehrfachbuchung, mehrere Chargen). */
  weitere?: PendingPosition[]
  /** Vorangestellt vor die Bemerkung, z. B. „KI-Assistent“. */
  notiz?: string
  /**
   * Online gesendet, aber keine Antwort: Die Buchung kann schon auf dem Server sein.
   * Die Übertragung prüft das zuerst; „Rückgängig“ darf den Eintrag nicht einfach streichen.
   */
  unklar?: boolean
  /** Zeitpunkt, seit dem dieser Eintrag gerade übertragen wird (auch aus einem anderen Tab). */
  in_uebertragung?: number
  /** Teilweise übertragen (ohne Sammelbuchung) — wird nicht automatisch wiederholt. */
  gesperrt?: boolean
  /** Vom Server mehrfach abgelehnt (z. B. Artikel gelöscht) — wird nicht mehr automatisch wiederholt. */
  abgelehnt?: boolean
  created_at: number
  tries: number
  last_error?: string
}

/** Zustand eines Eintrags für die Anzeige im Logbuch. */
export function eintragStatus(b: PendingBuchung): 'wartet' | 'unklar' | 'teilweise' | 'abgelehnt' {
  if (b.gesperrt) return 'teilweise'
  if (b.abgelehnt) return 'abgelehnt'
  if (b.unklar) return 'unklar'
  return 'wartet'
}

/** Alle Positionen eines Eintrags, die erste zuerst. */
export function positionen(b: PendingBuchung): PendingPosition[] {
  const { item_id, item_name, delta, expiry, batch, einsatz, charge } = b
  return [{ item_id, item_name, delta, expiry, batch, einsatz, charge }, ...(b.weitere || [])]
}

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        const q = d.createObjectStore('queue', { keyPath: 'id' })
        q.createIndex('by_created', 'created_at')
        d.createObjectStore('snapshot', { keyPath: 'k' })
      },
    })
  }
  return dbp
}

function newId(): string {
  const b = new Uint8Array(9)
  crypto.getRandomValues(b)
  return Array.from(b).map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 14)
}

// ── Warteschlange ────────────────────────────────────────────────────────────

/** Merkt eine Buchung vor. Gibt die ID des Eintrags zurück (für „Rückgängig“, solange er noch wartet). */
export async function queueBuchung(b: Omit<PendingBuchung, 'id' | 'created_at' | 'tries'>): Promise<string> {
  const d = await db()
  const id = newId()
  await d.put('queue', { ...b, id, created_at: Date.now(), tries: 0 })
  await meldeAnzahl()
  return id
}

export async function queueAll(): Promise<PendingBuchung[]> {
  const d = await db()
  return (await d.getAllFromIndex('queue', 'by_created')) as PendingBuchung[]
}

export async function queueCount(): Promise<number> {
  try { return (await queueAll()).length } catch { return 0 }
}

const UEBERTRAGUNG_MAX_MS = 60_000

/**
 * Streicht einen Eintrag — nur, wenn er noch wartet. false, wenn er schon weg ist oder
 * gerade übertragen wird: Dann wäre „zurückgenommen“ gelogen.
 */
export async function queueRemove(id: string): Promise<boolean> {
  const d = await db()
  const tx = d.transaction('queue', 'readwrite')
  const rec = (await tx.store.get(id)) as PendingBuchung | undefined
  const laeuft = !!rec?.in_uebertragung && Date.now() - rec.in_uebertragung < UEBERTRAGUNG_MAX_MS
  // Unklare oder teilweise übertragene Einträge können schon (teils) auf dem Server sein
  const darf = !!rec && !laeuft && !rec.unklar && !rec.gesperrt
  if (darf) await tx.store.delete(id)
  await tx.done
  await meldeAnzahl()
  return darf
}

/** Nach erfolgreicher Übertragung: Eintrag entfernen, egal ob als „in Übertragung“ markiert. */
async function queueErledigt(id: string): Promise<void> {
  const d = await db()
  await d.delete('queue', id)
}

const MAX_ABLEHNUNGEN = 3

export async function queueBump(id: string, err: string, sperren = false): Promise<void> {
  const d = await db()
  const rec = await d.get('queue', id)
  if (!rec) return
  const tries = (rec.tries || 0) + 1
  await d.put('queue', {
    ...rec, tries, last_error: err, in_uebertragung: undefined,
    ...(sperren ? { gesperrt: true } : {}),
    // Nach mehreren Ablehnungen nicht bei jeder Buchung erneut versuchen
    ...(!sperren && tries >= MAX_ABLEHNUNGEN ? { abgelehnt: true } : {}),
  })
}

/** Übertragungsmarke zurücknehmen (Netz wieder weg) — der Eintrag wartet weiter. */
async function queueFreigeben(id: string, vielleichtAngekommen: boolean): Promise<void> {
  const d = await db()
  const rec = await d.get('queue', id)
  if (rec) await d.put('queue', { ...rec, in_uebertragung: undefined, ...(vielleichtAngekommen ? { unklar: true } : {}) })
}

/**
 * Nimmt einen Eintrag zur Übertragung — in EINER Schreib-Transaktion: frisch gelesen
 * (vielleicht wurde er inzwischen gestrichen), Client-ID nur vergeben, wenn noch keine
 * da ist, und als „in Übertragung“ markiert. Null, wenn er nicht (mehr) zu übertragen ist.
 */
async function nimmZurUebertragung(id: string, neueClientId: () => string): Promise<(PendingBuchung & { client_id: string }) | null> {
  const d = await db()
  const tx = d.transaction('queue', 'readwrite')
  const rec = (await tx.store.get(id)) as PendingBuchung | undefined
  let erg: (PendingBuchung & { client_id: string }) | null = null
  const laeuft = !!rec?.in_uebertragung && Date.now() - rec.in_uebertragung < UEBERTRAGUNG_MAX_MS
  if (rec && !rec.gesperrt && !rec.abgelehnt && !laeuft) {
    erg = { ...rec, client_id: rec.client_id || neueClientId(), in_uebertragung: Date.now() }
    await tx.store.put(erg)
  }
  await tx.done
  return erg
}

/** Für die Abmelde-Warnung in useAuth (dort wird nur localStorage gelesen). */
async function meldeAnzahl(): Promise<void> {
  try { localStorage.setItem('lager_pending_count', String((await queueAll()).length)) } catch { /* egal */ }
}

// ── Zwischenspeicher, damit die Liste offline etwas anzeigt ──────────────────

export async function snapshotSet(locationId: string, daten: any): Promise<void> {
  try {
    const d = await db()
    await d.put('snapshot', { k: `loc_${locationId}`, daten, ts: Date.now() })
  } catch { /* Speicher voll o.ä. — nicht kritisch */ }
}

export async function snapshotGet(locationId: string): Promise<{ daten: any; ts: number } | null> {
  try {
    const d = await db()
    const rec = await d.get('snapshot', `loc_${locationId}`)
    return rec ? { daten: rec.daten, ts: rec.ts } : null
  } catch { return null }
}

export async function speicherSichern(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch { /* nicht unterstützt */ }
  return false
}

let uebertraegt = false

/**
 * Arbeitet die Warteschlange ab. `ausfuehren` führt die Absicht gegen den
 * aktuellen Serverstand aus (in Lager.tsx über den Buchungsweg lagerBuchung.ts).
 *
 * Genau einmal: Jeder Eintrag bekommt VOR dem ersten Senden eine feste Client-ID
 * (gespeichert); `ausfuehren` prüft damit, ob er schon angekommen ist. Es läuft
 * immer nur eine Übertragung, auch über mehrere Tabs (Web Locks, sonst je Tab).
 * Jeder Eintrag wird direkt vor dem Senden frisch gelesen und als „in Übertragung“
 * markiert — „Rückgängig“ kann ihn dann nicht mehr still streichen.
 * Ohne Netz wird abgebrochen, nicht als Fehlversuch gezählt. Teilweise übertragene
 * Einträge (ohne Sammelbuchung) werden gesperrt statt wiederholt.
 */
/** Gibt es Einträge, die eine Übertragung versuchen würde? (Nicht: teilweise/abgelehnte) */
export async function queueHatOffene(): Promise<boolean> {
  try { return (await queueAll()).some(b => !b.gesperrt && !b.abgelehnt) } catch { return false }
}

export async function flushQueue(
  ausfuehren: (b: PendingBuchung & { client_id: string }) => Promise<void>,
  neueClientId: () => string,
  /** Ist die Buchung mit dieser Client-ID vollständig auf dem Server? (für teilweise übertragene) */
  istAngekommen?: (clientId: string) => Promise<boolean>,
): Promise<{ ok: number; fehler: number }> {
  if (!navigator.onLine || uebertraegt) return { ok: 0, fehler: 0 }
  const locks = (navigator as Navigator & { locks?: { request: (name: string, opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<{ ok: number; fehler: number }>) => Promise<{ ok: number; fehler: number }> } }).locks
  if (locks?.request) {
    // Ein anderer Tab überträgt gerade: nichts tun, der erledigt es
    return locks.request('responda-lager-uebertragung', { ifAvailable: true }, async (lock) => lock ? uebertrage(ausfuehren, neueClientId, istAngekommen) : { ok: 0, fehler: 0 })
  }
  return uebertrage(ausfuehren, neueClientId, istAngekommen)
}

async function uebertrage(
  ausfuehren: (b: PendingBuchung & { client_id: string }) => Promise<void>,
  neueClientId: () => string,
  istAngekommen?: (clientId: string) => Promise<boolean>,
): Promise<{ ok: number; fehler: number }> {
  if (uebertraegt) return { ok: 0, fehler: 0 }
  uebertraegt = true
  let ok = 0, fehler = 0
  try {
    for (const eintrag of await queueAll()) {
      // Teilweise übertragen: Ist die Journalzeile mit der Client-ID da (sie wird zuletzt
      // gesendet), kam doch alles an — dann still austragen. Sonst nicht anfassen.
      if (eintrag.gesperrt) {
        if (eintrag.client_id && istAngekommen) {
          try { if (await istAngekommen(eintrag.client_id)) { await queueErledigt(eintrag.id); ok++ } } catch { /* später */ }
        }
        continue
      }
      const b = await nimmZurUebertragung(eintrag.id, neueClientId)
      if (!b) continue
      try {
        await ausfuehren(b)
        await queueErledigt(b.id)
        ok++
      } catch (e: any) {
        if (e?.teilweise) {
          await queueBump(b.id, 'Teilweise übertragen — Bestand prüfen, wird nicht wiederholt', true)
          fehler++
          continue
        }
        if (e?.art === 'netz' || e?.status === 0) { await queueFreigeben(b.id, !!e?.vielleichtGebucht); break }   // wieder weg — später weiter
        await queueBump(b.id, e?.message || 'Fehler')
        fehler++
      }
    }
  } finally {
    uebertraegt = false
    await meldeAnzahl()
  }
  return { ok, fehler }
}
