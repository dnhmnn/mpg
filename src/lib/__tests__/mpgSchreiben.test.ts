import { describe, it, expect, beforeEach } from 'vitest'
import { schreibeZusammen, SchreibFehler, _zuruecksetzen, type Anfrage, type Server } from '../mpg/schreiben'

// Nachbau eines PocketBase-Servers: Datensätze je Collection, Batch atomar,
// doppelte IDs abgelehnt wie bei PocketBase (validation_not_unique).
function nachbau(o: { batchAus?: boolean } = {}) {
  const daten = new Map<string, Record<string, unknown>>()
  const stoerung: { netzNachBatch?: boolean; netzVorBatch?: boolean; netzBeiEinzel?: number; ablehnenBeiEinzel?: number } = {}
  let einzelZaehler = 0
  const schluessel = (a: Anfrage) => `${a.collection}/${a.id}`
  const doppelt = () => Object.assign(new Error('Failed to create record.'), {
    status: 400, response: { message: 'Failed to create record.', data: { id: { code: 'validation_not_unique', message: 'Value must be unique.' } } },
  })
  const anwenden = (a: Anfrage, ziel: Map<string, Record<string, unknown>>) => {
    const k = schluessel(a)
    if (a.aktion === 'create') {
      if (ziel.has(k)) throw doppelt()
      ziel.set(k, { ...a.body })
    } else {
      if (!ziel.has(k)) throw Object.assign(new Error('not found'), { status: 404, response: { message: 'The requested resource wasn\'t found.', data: {} } })
      ziel.set(k, { ...ziel.get(k), ...a.body })
    }
  }
  const server: Server = {
    async sendeBatch(anfragen) {
      if (o.batchAus) throw Object.assign(new Error('Batch requests are not allowed.'), { status: 403, response: { message: 'Batch requests are not allowed.', data: {} } })
      if (stoerung.netzVorBatch) { stoerung.netzVorBatch = false; throw Object.assign(new Error('net'), { status: 0 }) }
      const kopie = new Map(daten)
      try {
        for (const a of anfragen) anwenden(a, kopie)
      } catch (e) {
        const f = e as { status: number; response: unknown }
        throw Object.assign(new Error('Batch transaction failed.'), { status: 400, response: { message: 'Batch transaction failed.', data: { requests: { 0: { code: 'batch_request_failed', response: { status: f.status, ...(f.response as object) } } } } } })
      }
      for (const [k, v] of kopie) daten.set(k, v)
      if (stoerung.netzNachBatch) { stoerung.netzNachBatch = false; throw Object.assign(new Error('net'), { status: 0 }) }
      return []
    },
    async sende(a) {
      einzelZaehler++
      if (stoerung.netzBeiEinzel === einzelZaehler) throw Object.assign(new Error('net'), { status: 0 })
      if (stoerung.ablehnenBeiEinzel === einzelZaehler) throw Object.assign(new Error('bad'), { status: 400, response: { message: 'Failed', data: { severity: { code: 'validation_invalid_value', message: 'Invalid value.' } } } })
      anwenden(a, daten)
      return {}
    },
  }
  return { server, daten, stoerung }
}

const anfragen: Anfrage[] = [
  { collection: 'mpg_inspections', aktion: 'create', id: 'p1', body: { passed: false } },
  { collection: 'mpg_devices', aktion: 'update', id: 'g1', body: { operational: false } },
  { collection: 'mpg_defects', aktion: 'create', id: 'd1', body: { severity: 'high' } },
]

function mitGeraet(n: ReturnType<typeof nachbau>) {
  n.daten.set('mpg_devices/g1', { operational: true })
  return n
}

describe('schreibeZusammen', () => {
  beforeEach(() => _zuruecksetzen())

  it('schreibt alles in einem Batch', async () => {
    const n = mitGeraet(nachbau())
    expect(await schreibeZusammen(n.server, anfragen)).toBe('ok')
    expect(n.daten.get('mpg_devices/g1')).toEqual({ operational: false })
    expect(n.daten.has('mpg_defects/d1')).toBe(true)
  })

  it('schreibt bei Ablehnung gar nichts (alles oder nichts)', async () => {
    const n = nachbau() // Gerät fehlt → Update scheitert
    await expect(schreibeZusammen(n.server, anfragen)).rejects.toMatchObject({ art: 'abgelehnt', teilweise: false })
    expect(n.daten.size).toBe(0)
  })

  it('Antwort verloren: erneuter Versuch legt nichts doppelt an', async () => {
    const n = mitGeraet(nachbau())
    n.stoerung.netzNachBatch = true
    const fehler = await schreibeZusammen(n.server, anfragen).catch(e => e)
    expect(fehler).toBeInstanceOf(SchreibFehler)
    expect(fehler.art).toBe('netz')
    expect(await schreibeZusammen(n.server, anfragen)).toBe('schon')
    expect([...n.daten.keys()].filter(k => k.startsWith('mpg_defects/'))).toEqual(['mpg_defects/d1'])
  })

  it('Netz weg vor dem Senden: erneuter Versuch schreibt', async () => {
    const n = mitGeraet(nachbau())
    n.stoerung.netzVorBatch = true
    await expect(schreibeZusammen(n.server, anfragen)).rejects.toMatchObject({ art: 'netz' })
    expect(n.daten.has('mpg_inspections/p1')).toBe(false)
    expect(await schreibeZusammen(n.server, anfragen)).toBe('ok')
    expect(n.daten.has('mpg_inspections/p1')).toBe(true)
  })

  it('Batch in PocketBase aus: schreibt einzeln', async () => {
    const n = mitGeraet(nachbau({ batchAus: true }))
    expect(await schreibeZusammen(n.server, anfragen)).toBe('ok')
    expect(n.daten.size).toBe(3)
  })

  it('einzeln, Netz bricht mittendrin ab: teilweise, erneuter Versuch vervollständigt ohne Doppel', async () => {
    const n = mitGeraet(nachbau({ batchAus: true }))
    n.stoerung.netzBeiEinzel = 2
    await expect(schreibeZusammen(n.server, anfragen)).rejects.toMatchObject({ art: 'netz', teilweise: true })
    expect(n.daten.has('mpg_inspections/p1')).toBe(true)
    expect(n.daten.get('mpg_devices/g1')).toEqual({ operational: true })
    expect(await schreibeZusammen(n.server, anfragen)).toBe('ok')
    expect(n.daten.get('mpg_devices/g1')).toEqual({ operational: false })
    expect(n.daten.has('mpg_defects/d1')).toBe(true)
  })

  it('einzeln abgelehnt mittendrin: sagt, dass nur teilweise gespeichert ist', async () => {
    const n = mitGeraet(nachbau({ batchAus: true }))
    n.stoerung.ablehnenBeiEinzel = 3
    const fehler = await schreibeZusammen(n.server, anfragen).catch(e => e)
    expect(fehler).toMatchObject({ art: 'abgelehnt', teilweise: true })
    expect(fehler.message).toMatch(/^Nur teilweise gespeichert: Schweregrad/)
  })

  it('Ablehnung im Batch nennt den Grund der Teilanfrage', async () => {
    const n = nachbau()
    const fehler = await schreibeZusammen(n.server, anfragen).catch(e => e)
    expect(fehler.message).toMatch(/Nicht gefunden/)
  })
})
