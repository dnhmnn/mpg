// Erzeugen und Aufnehmen von Ereignissen. EIN Trichter für alles: lokale
// Eingaben, Sync-Ergebnisse und Realtime laufen durch `ingest()` — dadurch gibt
// es nur eine Fehlerklasse statt drei.

import { canonicalJSON, correctedISO, getClockOffset, hlcNext, hlcToSeq, newId, sha256Hex, type Hlc } from './ids'
import { deviceId, metaGet, metaSet, putEvent } from './db'
import type { EksEvent, EksEventType } from './types'

let hlcLast: Hlc | null = null

async function nextSeq(dev: string, remoteWall?: number): Promise<string> {
  if (!hlcLast) hlcLast = (await metaGet<Hlc>('hlc_last')) || null
  hlcLast = hlcNext(hlcLast, Date.now() + (getClockOffset() ?? 0), dev, remoteWall)
  await metaSet('hlc_last', hlcLast)
  return hlcToSeq(hlcLast)
}

export interface MakeEventArgs {
  einsatz_id: string
  organization_id: string
  type: EksEventType
  payload: any
  actor_user?: string
  actor_name: string
}

/** Erzeugt ein Ereignis, hängt es in die geräteeigene Hash-Kette und legt es lokal ab. */
export async function appendEvent(a: MakeEventArgs): Promise<EksEvent> {
  const dev = await deviceId()
  const seq = await nextSeq(dev)
  const prev_hash = (await metaGet<string>(`chain_${a.einsatz_id}`)) || ''

  const e: EksEvent = {
    id: newId(),
    einsatz_id: a.einsatz_id,
    organization_id: a.organization_id,
    seq,
    device_id: dev,
    actor_user: a.actor_user,
    actor_name: a.actor_name,
    type: a.type,
    payload: a.payload,
    client_ts: correctedISO(),
    client_offset_ms: getClockOffset(),
    prev_hash,
    schema_v: 1,
  }
  e.hash = await sha256Hex(canonicalJSON({
    id: e.id, einsatz_id: e.einsatz_id, type: e.type, payload: e.payload,
    client_ts: e.client_ts, device_id: e.device_id, actor_user: e.actor_user ?? null, prev_hash,
  }))
  await metaSet(`chain_${a.einsatz_id}`, e.hash)
  await putEvent({ ...e, synced: 0 })
  return e
}

/** Aufnahme eines fremden Ereignisses (Sync-Pull oder Realtime). Idempotent. */
export async function ingest(raw: any): Promise<void> {
  if (!raw?.id || !raw?.einsatz_id) return
  const dev = await deviceId()
  // Eigene Uhr an fremden Ereignissen vorbeiziehen, damit die Ordnung stabil bleibt
  const wall = Number(String(raw.seq || '').split('-')[0] ? parseInt(String(raw.seq).split('-')[0], 16) : 0)
  if (wall) { hlcLast = hlcNext(hlcLast, Date.now() + (getClockOffset() ?? 0), dev, wall); await metaSet('hlc_last', hlcLast) }

  await putEvent({
    id: raw.id, einsatz_id: raw.einsatz_id, organization_id: raw.organization_id,
    seq: raw.seq, device_id: raw.device_id, actor_user: raw.actor_user,
    actor_name: raw.actor_name || 'Unbekannt', type: raw.type,
    payload: typeof raw.payload === 'string' ? safeParse(raw.payload) : raw.payload,
    client_ts: raw.client_ts, client_offset_ms: raw.client_offset_ms ?? null,
    prev_hash: raw.prev_hash, hash: raw.hash, schema_v: raw.schema_v ?? 1,
    synced: 1,
  })
}

function safeParse(s: string): any { try { return JSON.parse(s) } catch { return {} } }

/** Prüft die Hash-Kette je Gerät. Ein Bruch bedeutet Manipulation ODER Datenverlust. */
export async function pruefeKette(events: EksEvent[]): Promise<{ device_id: string; ok: boolean; anzahl: number }[]> {
  const proGeraet = new Map<string, EksEvent[]>()
  for (const e of events) {
    if (!proGeraet.has(e.device_id)) proGeraet.set(e.device_id, [])
    proGeraet.get(e.device_id)!.push(e)
  }
  const out: { device_id: string; ok: boolean; anzahl: number }[] = []
  for (const [dev, liste] of proGeraet) {
    liste.sort((a, b) => (a.seq < b.seq ? -1 : 1))
    let ok = true
    let prev = ''
    for (const e of liste) {
      const erwartet = await sha256Hex(canonicalJSON({
        id: e.id, einsatz_id: e.einsatz_id, type: e.type, payload: e.payload,
        client_ts: e.client_ts, device_id: e.device_id, actor_user: e.actor_user ?? null, prev_hash: prev,
      }))
      if (e.hash && e.hash !== erwartet) { ok = false; break }
      prev = e.hash || ''
    }
    out.push({ device_id: dev, ok, anzahl: liste.length })
  }
  return out
}
