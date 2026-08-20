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

export interface PendingBuchung {
  id: string
  item_id: string
  item_name: string
  location_id: string
  delta: number
  expiry?: string
  batch?: string
  einsatz?: string
  created_at: number
  tries: number
  last_error?: string
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

export async function queueBuchung(b: Omit<PendingBuchung, 'id' | 'created_at' | 'tries'>): Promise<void> {
  const d = await db()
  await d.put('queue', { ...b, id: newId(), created_at: Date.now(), tries: 0 })
  await meldeAnzahl()
}

export async function queueAll(): Promise<PendingBuchung[]> {
  const d = await db()
  return (await d.getAllFromIndex('queue', 'by_created')) as PendingBuchung[]
}

export async function queueCount(): Promise<number> {
  try { return (await queueAll()).length } catch { return 0 }
}

export async function queueRemove(id: string): Promise<void> {
  const d = await db()
  await d.delete('queue', id)
  await meldeAnzahl()
}

export async function queueBump(id: string, err: string): Promise<void> {
  const d = await db()
  const rec = await d.get('queue', id)
  if (rec) await d.put('queue', { ...rec, tries: (rec.tries || 0) + 1, last_error: err })
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

/**
 * Arbeitet die Warteschlange ab. `ausfuehren` führt die Absicht gegen den
 * aktuellen Serverstand aus (in Lager.tsx die vorhandene Buchungslogik).
 */
export async function flushQueue(
  ausfuehren: (b: PendingBuchung) => Promise<void>,
): Promise<{ ok: number; fehler: number }> {
  if (!navigator.onLine) return { ok: 0, fehler: 0 }
  let ok = 0, fehler = 0
  for (const b of await queueAll()) {
    try {
      await ausfuehren(b)
      await queueRemove(b.id)
      ok++
    } catch (e: any) {
      await queueBump(b.id, e?.message || 'Fehler')
      fehler++
    }
  }
  await meldeAnzahl()
  return { ok, fehler }
}
