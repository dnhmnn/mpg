// EKS: Holen der Ereignisse überschreibt nicht den Einsatzkopf, der währenddessen gespeichert wurde
// (Stichwort und Einsatznummer fehlten sonst oben und im Ausdruck des Einsatztagebuchs).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const speicher = new Map<string, Record<string, unknown>>()
let waehrendHolen: (() => void) | null = null

vi.mock('../eks/db', () => ({
  incidentGet: vi.fn(async (id: string) => speicher.get(id)),
  incidentPut: vi.fn(async (i: Record<string, unknown>) => { speicher.set(String(i.id), { ...i }) }),
  markSynced: vi.fn(async () => {}),
  pendingCount: vi.fn(async () => 0),
  unsyncedEvents: vi.fn(async () => []),
}))
vi.mock('../eks/events', () => ({ ingest: vi.fn(async () => {}) }))
vi.mock('../pocketbase', () => ({
  pb: {
    collection: () => ({
      getFullList: vi.fn(async () => { waehrendHolen?.(); return [{ id: 'ereignis1' }] }),
    }),
  },
}))

import { pull } from '../eks/sync'

describe('pull', () => {
  beforeEach(() => { speicher.clear(); waehrendHolen = null; vi.stubGlobal('navigator', { onLine: true }) })

  it('behält einen Einsatzkopf, der während des Holens gespeichert wurde', async () => {
    speicher.set('e1', { id: 'e1', header: {} })
    waehrendHolen = () => speicher.set('e1', { id: 'e1', header: { keyword: 'B3 – Wohnungsbrand', unit: 'E-2026-0417' } })
    expect(await pull('e1')).toBe(1)
    const e = speicher.get('e1') as { header: { keyword?: string; unit?: string }; last_pull_iso?: string }
    expect(e.header.keyword).toBe('B3 – Wohnungsbrand')
    expect(e.header.unit).toBe('E-2026-0417')
    expect(typeof e.last_pull_iso).toBe('string')
  })

  it('legt ohne Eintrag einen mit leerem Kopf an', async () => {
    expect(await pull('e2')).toBe(1)
    expect(speicher.get('e2')).toMatchObject({ id: 'e2', header: {} })
  })
})
