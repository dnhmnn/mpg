// IndexedDB-Schicht des EKS. Während eines Einsatzes ist DIESE Datenbank die
// Wahrheit — der Server ist nur Replikat und Verteiler. Deshalb überlebt der
// Einsatz auch einen kompletten Netzausfall.

import { openDB, type IDBPDatabase } from 'idb'
import type { EksEvent } from './types'

const DB_NAME = 'responda-eks'
const DB_VERSION = 1

export interface OutboxItem {
  id: string
  collection: string
  op: 'create' | 'update'
  data: any
  tries: number
  last_error?: string
  created_at: number
}

export interface IncidentCache {
  id: string
  organization_id?: string
  header: any
  last_pull_iso?: string
  gepinnt?: boolean
}

let dbp: Promise<IDBPDatabase> | null = null

export function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        const ev = d.createObjectStore('events', { keyPath: 'id' })
        ev.createIndex('by_einsatz_seq', ['einsatz_id', 'seq'])
        // IndexedDB kann keine Booleans indizieren -> synced als 0/1
        ev.createIndex('by_unsynced', ['einsatz_id', 'synced'])

        const ob = d.createObjectStore('outbox', { keyPath: 'id' })
        ob.createIndex('by_created', 'created_at')

        const inc = d.createObjectStore('incidents', { keyPath: 'id' })
        inc.createIndex('by_org', 'organization_id')

        d.createObjectStore('meta', { keyPath: 'k' })

        const ti = d.createObjectStore('tiles', { keyPath: 'k' })
        ti.createIndex('by_ts', 'ts')
      },
    })
  }
  return dbp
}

// ── meta ─────────────────────────────────────────────────────────────────────
export async function metaGet<T = any>(k: string): Promise<T | undefined> {
  const rec = await (await db()).get('meta', k)
  return rec?.v
}
export async function metaSet(k: string, v: any): Promise<void> {
  await (await db()).put('meta', { k, v })
}

/** Geräte-ID: einmalig erzeugt, danach stabil — identifiziert das Gerät im Log. */
export async function deviceId(): Promise<string> {
  let id = await metaGet<string>('device_id')
  if (!id) {
    const { newId } = await import('./ids')
    id = newId()
    await metaSet('device_id', id)
  }
  return id
}
export async function deviceName(): Promise<string> {
  return (await metaGet<string>('device_name')) || 'Unbenanntes Gerät'
}

// ── events ───────────────────────────────────────────────────────────────────
export async function putEvent(e: EksEvent & { synced?: number }): Promise<void> {
  const d = await db()
  const vorhanden = await d.get('events', e.id)
  if (vorhanden) return                       // Idempotenz: gleiche ID = gleiches Ereignis
  await d.put('events', { ...e, synced: e.synced ?? 0 })
}

export async function markSynced(ids: string[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('events', 'readwrite')
  for (const id of ids) {
    const rec = await tx.store.get(id)
    if (rec) await tx.store.put({ ...rec, synced: 1 })
  }
  await tx.done
}

export async function eventsOf(einsatzId: string): Promise<EksEvent[]> {
  const d = await db()
  const all = await d.getAllFromIndex('events', 'by_einsatz_seq',
    IDBKeyRange.bound([einsatzId, ''], [einsatzId, '￿']))
  return all as EksEvent[]
}

export async function unsyncedEvents(einsatzId?: string): Promise<EksEvent[]> {
  const d = await db()
  const all = (await d.getAll('events')) as (EksEvent & { synced: number })[]
  return all.filter(e => e.synced !== 1 && (!einsatzId || e.einsatz_id === einsatzId))
}

export async function pendingCount(): Promise<number> {
  return (await unsyncedEvents()).length
}

// ── outbox (Nicht-Event-Schreibvorgänge, z.B. einsaetze-Kopf) ────────────────
export async function outboxAdd(item: Omit<OutboxItem, 'tries' | 'created_at'>): Promise<void> {
  await (await db()).put('outbox', { ...item, tries: 0, created_at: Date.now() })
}
export async function outboxAll(): Promise<OutboxItem[]> {
  return (await (await db()).getAllFromIndex('outbox', 'by_created')) as OutboxItem[]
}
export async function outboxRemove(id: string): Promise<void> {
  await (await db()).delete('outbox', id)
}
export async function outboxBump(id: string, err: string): Promise<void> {
  const d = await db()
  const rec = await d.get('outbox', id)
  if (rec) await d.put('outbox', { ...rec, tries: rec.tries + 1, last_error: err })
}

// ── incidents ────────────────────────────────────────────────────────────────
export async function incidentPut(i: IncidentCache): Promise<void> {
  await (await db()).put('incidents', i)
}
export async function incidentGet(id: string): Promise<IncidentCache | undefined> {
  return (await (await db()).get('incidents', id)) as IncidentCache | undefined
}
export async function incidentsAll(): Promise<IncidentCache[]> {
  return (await (await db()).getAll('incidents')) as IncidentCache[]
}

// ── Speicher ─────────────────────────────────────────────────────────────────
/** Dauerhaften Speicher anfordern, damit der Browser die Einsatzdaten nicht wegräumt. */
export async function speicherSichern(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch { /* nicht unterstützt */ }
  return false
}

export async function speicherInfo(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e) return null
    return { usage: e.usage || 0, quota: e.quota || 0 }
  } catch { return null }
}
