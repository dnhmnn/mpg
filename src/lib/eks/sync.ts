// Synchronisierung: lokale Ereignisse hochschieben, fremde herunterholen.
// Weil die Client-ID zugleich die Server-ID ist, ist erneutes Senden nach
// verlorener Bestätigung gefahrlos — ein Unique-Konflikt bedeutet "liegt schon".

import { pb } from '../pocketbase'
import { ingest } from './events'
import { incidentGet, incidentPut, markSynced, pendingCount, unsyncedEvents } from './db'
import { setClockOffset } from './ids'
import type { EksEvent } from './types'

const CHUNK = 40   // PocketBase-Batch erlaubt standardmäßig 50 Anfragen

export type SyncStatus = 'offline' | 'synchron' | 'laeuft' | 'fehler'

let laeuft = false
let letzterFehler = ''

export function fehlerText(): string { return letzterFehler }

/** Serverzeit aus dem Date-Header übernehmen — Grundlage der Uhrzeit-Korrektur. */
async function eichenUhr(): Promise<number | null> {
  try {
    const t0 = Date.now()
    const res = await fetch(`${(pb as any).baseURL}/api/health`, { cache: 'no-store' })
    const t1 = Date.now()
    const d = res.headers.get('date')
    if (!d) return null
    const offset = new Date(d).getTime() - (t0 + t1) / 2
    setClockOffset(offset)
    return offset
  } catch { return null }
}

function toRecord(e: EksEvent) {
  return {
    id: e.id, einsatz_id: e.einsatz_id, organization_id: e.organization_id,
    seq: e.seq, device_id: e.device_id, actor_user: e.actor_user || '',
    actor_name: e.actor_name, type: e.type, payload: e.payload,
    client_ts: e.client_ts, client_offset_ms: e.client_offset_ms,
    prev_hash: e.prev_hash || '', hash: e.hash || '', schema_v: e.schema_v ?? 1,
  }
}

/** Lokale Ereignisse zum Server schieben. */
export async function flush(): Promise<{ gesendet: number; fehler: number }> {
  if (laeuft || !navigator.onLine) return { gesendet: 0, fehler: 0 }
  laeuft = true
  let gesendet = 0, fehler = 0
  try {
    const offen = (await unsyncedEvents()).sort((a, b) => (a.seq < b.seq ? -1 : 1))
    for (let i = 0; i < offen.length; i += CHUNK) {
      const teil = offen.slice(i, i + CHUNK)
      try {
        const batch = (pb as any).createBatch()
        for (const e of teil) batch.collection('eks_events').create(toRecord(e))
        await batch.send()
        await markSynced(teil.map(e => e.id))
        gesendet += teil.length
      } catch {
        // Batch ist transaktional — bei Fehlschlag einzeln erneut versuchen
        for (const e of teil) {
          try {
            await pb.collection('eks_events').create(toRecord(e))
            await markSynced([e.id]); gesendet++
          } catch (err: any) {
            // Schon vorhanden? Dann war nur die Bestätigung verloren gegangen.
            try {
              await pb.collection('eks_events').getOne(e.id)
              await markSynced([e.id]); gesendet++
            } catch {
              fehler++
              letzterFehler = err?.message || 'Unbekannter Fehler'
            }
          }
        }
      }
    }
  } finally {
    laeuft = false
    try { localStorage.setItem('eks_pending_count', String(await pendingCount())) } catch { /* egal */ }
  }
  return { gesendet, fehler }
}

/** Fremde Ereignisse holen — mit 5 s Überlappung, Dubletten fängt die stabile ID ab. */
export async function pull(einsatzId: string): Promise<number> {
  if (!navigator.onLine) return 0
  const inc = await incidentGet(einsatzId)
  const seit = inc?.last_pull_iso ? new Date(new Date(inc.last_pull_iso).getTime() - 5000).toISOString() : null
  const filter = seit
    ? `einsatz_id="${einsatzId}" && created > "${seit.replace('T', ' ').slice(0, 19)}"`
    : `einsatz_id="${einsatzId}"`
  try {
    const list = await pb.collection('eks_events').getFullList({
      filter, sort: 'created', requestKey: `eks-pull-${Date.now()}`,
    })
    for (const r of list) await ingest(r)
    await incidentPut({ ...(inc || { id: einsatzId, header: {} }), id: einsatzId, last_pull_iso: new Date().toISOString() })
    return list.length
  } catch (e: any) {
    letzterFehler = e?.message || 'Pull fehlgeschlagen'
    return 0
  }
}

export async function syncNow(einsatzId: string): Promise<void> {
  if (!navigator.onLine) return
  await eichenUhr()
  await flush()
  await pull(einsatzId)
}

/** Realtime: jedes eintreffende Ereignis geht durch denselben Trichter. */
export function subscribe(einsatzId: string, onChange: () => void): () => void {
  let aktiv = true
  pb.collection('eks_events').subscribe('*', async (ev: any) => {
    if (!aktiv || ev.record?.einsatz_id !== einsatzId) return
    await ingest(ev.record)
    onChange()
  }, { filter: `einsatz_id="${einsatzId}"` } as any).catch(() => { /* offline */ })

  return () => {
    aktiv = false
    try { pb.collection('eks_events').unsubscribe('*') } catch { /* egal */ }
  }
}
