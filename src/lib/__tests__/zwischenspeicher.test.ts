// Prüffälle: Zwischenspeicher der API beim Wechsel der Person leeren (src/lib/zwischenspeicher.ts).
import { describe, expect, it } from 'vitest'
import { API_CACHE, apiZwischenspeicherLeeren, bleibtBeimWechsel, ohneAnmeldungLeeren, veralteteLoeschen, wechselBeobachten } from '../zwischenspeicher'
import { OHNE_ZWISCHENSPEICHER } from '../zwischenspeicherRegel'

const API = 'https://api.responda.systems'

function cacheStorage(urls: string[], o: { fehlt?: boolean; haengt?: boolean } = {}) {
  const da = new Set(urls)
  const cache = {
    async keys() { return [...da].map((url) => ({ url }) as Request) },
    async delete(r: Request) { if (o.haengt) await new Promise(() => {}); return da.delete(r.url) },
  }
  return {
    da,
    cs: {
      async has(n: string) { return n === API_CACHE && !o.fehlt },
      async open(n: string) { if (n !== API_CACHE) throw new Error('falscher Cache'); return cache as unknown as Cache },
    },
  }
}

describe('Zwischenspeicher der API', () => {
  it('nur die Organisation bleibt', () => {
    expect(bleibtBeimWechsel(`${API}/api/collections/organizations/records?page=1&perPage=1&filter=org_code%3D%27w1%27`)).toBe(true)
    expect(bleibtBeimWechsel(`${API}/api/collections/organizations/records/abc123`)).toBe(true)
    for (const u of [
      `${API}/api/collections/patients/records?filter=x`,
      `${API}/api/collections/users/records`,
      `${API}/api/collections/mpg_devices/records`,
      `${API}/api/collections/organizations/records/abc/x`,
      `${API}/api/collections/organizations_x/records`,
      `${API}/api/files/pbc_1/abc/logo.png`,
      'kaputt',
    ]) expect(bleibtBeimWechsel(u), u).toBe(false)
  })

  it('löscht alles außer der Organisation', async () => {
    const { cs, da } = cacheStorage([
      `${API}/api/collections/organizations/records?filter=a`,
      `${API}/api/collections/patients/records?filter=b`,
      `${API}/api/collections/mpg_defects/records`,
      `${API}/api/collections/lernbar_beitraege/records`,
    ])
    expect(await apiZwischenspeicherLeeren({ caches: cs })).toBe(3)
    expect([...da]).toEqual([`${API}/api/collections/organizations/records?filter=a`])
  })

  it('ohne Cache Storage oder ohne Cache: nichts, kein Fehler; hängt es, nach der Zeitgrenze weiter', async () => {
    expect(await apiZwischenspeicherLeeren({ caches: null })).toBe(0)
    expect(await apiZwischenspeicherLeeren({ caches: cacheStorage([`${API}/x`], { fehlt: true }).cs })).toBe(0)
    const kaputt = { has: async () => { throw new Error('gesperrt') }, open: async () => { throw new Error('gesperrt') } }
    expect(await apiZwischenspeicherLeeren({ caches: kaputt as unknown as CacheStorage })).toBe(0)
    const start = Date.now()
    expect(await apiZwischenspeicherLeeren({ caches: cacheStorage([`${API}/api/collections/users/records`], { haengt: true }).cs, zeitMs: 50 })).toBe(0)
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it('leert nur, wenn sich die Person ändert', () => {
    let rueckruf: (id: string) => void = () => {}
    let n = 0
    wechselBeobachten('u1', (f) => { rueckruf = f }, () => { n++ }, { uhr: () => {} })
    rueckruf('u1')            // Token erneuert
    expect(n).toBe(0)
    rueckruf('')              // abgemeldet
    expect(n).toBe(1)
    rueckruf('')
    expect(n).toBe(1)
    rueckruf('u2')            // andere Person
    expect(n).toBe(2)
  })
})

describe('Zwischenspeicher: Start ohne Anmeldung, zweites Leeren, Alter, Regel (Nachprüfung)', () => {
  it('leert beim Start ohne Anmeldung sofort und nach der Wartezeit noch einmal', () => {
    let n = 0
    const uhren: Array<() => void> = []
    ohneAnmeldungLeeren(() => false, () => { n++ }, { uhr: (f) => { uhren.push(f) } })
    expect(n).toBe(1)
    expect(uhren).toHaveLength(1)
    uhren[0]()
    expect(n).toBe(2)
  })

  it('leert beim Start mit gültiger Anmeldung nicht', () => {
    let n = 0
    ohneAnmeldungLeeren(() => true, () => { n++ }, { uhr: () => { throw new Error('keine Uhr erwartet') } })
    expect(n).toBe(0)
  })

  it('leert später nicht mehr, wenn sich inzwischen jemand angemeldet hat', () => {
    let n = 0
    let angemeldet = false
    const uhren: Array<() => void> = []
    ohneAnmeldungLeeren(() => angemeldet, () => { n++ }, { uhr: (f) => { uhren.push(f) } })
    angemeldet = true
    uhren[0]()
    expect(n).toBe(1)
  })

  it('leert nach einem Wechsel kurz darauf noch einmal, aber nicht nach einem weiteren Wechsel', () => {
    let rueckruf: (id: string) => void = () => {}
    let n = 0
    const uhren: Array<() => void> = []
    wechselBeobachten('u1', (f) => { rueckruf = f }, () => { n++ }, { uhr: (f) => { uhren.push(f) } })
    rueckruf('')
    expect(n).toBe(1)
    uhren[0]()
    expect(n).toBe(2)
    rueckruf('u2')
    expect(n).toBe(3)
    rueckruf('')
    expect(n).toBe(4)
    uhren[1]()                // gehört zu 'u2', inzwischen abgemeldet: nichts
    expect(n).toBe(4)
  })

  it('löscht Antworten älter als 24 Stunden und solche ohne Datum, behält frische', async () => {
    const jetzt = Date.parse('2026-11-13T12:00:00Z')
    const antworten = new Map<string, string | null>([
      [`${API}/api/collections/mpg_devices/records`, new Date(jetzt - 2 * 3600_000).toUTCString()],
      [`${API}/api/collections/lernbar_beitraege/records`, new Date(jetzt - 30 * 3600_000).toUTCString()],
      [`${API}/api/collections/ausbildungen_termine/records`, null],
    ])
    const cache = {
      async keys() { return [...antworten.keys()].map((url) => ({ url }) as Request) },
      async match(r: Request) { const d = antworten.get(r.url); return { headers: { get: () => d ?? null } } as unknown as Response },
      async delete(r: Request) { return antworten.delete(r.url) },
    }
    const cs = { async has() { return true }, async open() { return cache as unknown as Cache } }
    expect(await veralteteLoeschen({ caches: cs, jetzt })).toBe(2)
    expect([...antworten.keys()]).toEqual([`${API}/api/collections/mpg_devices/records`])
  })

  it('nimmt Sammlungen mit Patientendaten in jeder Form der Adresse aus, andere nicht', () => {
    const trifft = [
      '/api/collections/patients/records?page=1&perPage=500&filter=x',
      '/api/collections/patients/records/abc123def456ghi',
      '/api/collections/patient_docs_nacherfassung/records?sort=-created',
      '/api/collections/access_logs/records',
      '/api/collections/audit_logs/records?filter=(organization_id%3D%22x%22)',
      '/api/collections/users/records/abc?expand=x',
      '/api/collections/einsaetze/records',
      '/api/collections/einsatz_personen/records?expand=user_id',
      '/api/collections/chat_messages/records?expand=sender',
      '/api/collections/user_keys/records',
      '/api/collections/notizen/records',
    ]
    for (const p of trifft) expect(OHNE_ZWISCHENSPEICHER.test(API + p), p).toBe(true)
    const nicht = [
      '/api/collections/organizations/records/abc',
      '/api/collections/mpg_devices/records',
      '/api/collections/lernbar_beitraege/records',
      '/api/collections/patients_archiv/records',
    ]
    for (const p of nicht) expect(OHNE_ZWISCHENSPEICHER.test(API + p), p).toBe(false)
  })
})

describe('Zwischenspeicher: Gleichlauf mit vite.config.ts', () => {
  it('vite.config.ts nimmt genau dieselben Sammlungen aus', async () => {
    const { readFileSync } = await import('node:fs')
    const { OHNE_ZWISCHENSPEICHER_SAMMLUNGEN } = await import('../zwischenspeicherRegel')
    const text = readFileSync(new URL('../../../vite.config.ts', import.meta.url), 'utf8')
    const m = text.match(/const OHNE_ZWISCHENSPEICHER_SAMMLUNGEN = \[([^\]]*)\]/)
    expect(m).not.toBeNull()
    const dort = [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect(dort).toEqual([...OHNE_ZWISCHENSPEICHER_SAMMLUNGEN])
    expect(text).toMatch(/urlPattern: OHNE_ZWISCHENSPEICHER,\s*\n\s*handler: 'NetworkOnly'/)
  })
})
