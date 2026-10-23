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
    } else if (a.aktion === 'delete') {
      if (!ziel.delete(k)) throw Object.assign(new Error('not found'), { status: 404, response: { message: 'The requested resource wasn\'t found.', data: {} } })
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
      daten.clear()
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

describe('Löschen mit Eintrag im Gerätebuch', () => {
  beforeEach(() => _zuruecksetzen())
  const loeschen: Anfrage[] = [
    { collection: 'mpg_devices', aktion: 'delete', id: 'g1', body: {} },
    { collection: 'mpg_ereignisse', aktion: 'create', id: 'e1', body: { art: 'geloescht' } },
  ]

  it('als Sammelbuchung: Gerät weg, Eintrag da', async () => {
    const n = mitGeraet(nachbau())
    expect(await schreibeZusammen(n.server, loeschen)).toBe('ok')
    expect([n.daten.has('mpg_devices/g1'), n.daten.has('mpg_ereignisse/e1')]).toEqual([false, true])
  })

  it('einzeln, Verbindung nach dem Löschen weg: erneut gesendet zählt das schon gelöschte Gerät als erledigt', async () => {
    const n = mitGeraet(nachbau({ batchAus: true }))
    n.stoerung.netzBeiEinzel = 2
    await expect(schreibeZusammen(n.server, loeschen)).rejects.toMatchObject({ art: 'netz', teilweise: true })
    expect(await schreibeZusammen(n.server, loeschen)).toBe('ok')
    expect([n.daten.has('mpg_devices/g1'), n.daten.has('mpg_ereignisse/e1')]).toEqual([false, true])
  })
})

describe('Eintrag im Gerätebuch ist verzichtbar — Sperre, Defekt und Prüfung gehen vor', () => {
  beforeEach(() => _zuruecksetzen())
  const buch = (a: Anfrage) => a.collection === 'mpg_ereignisse'
  const plan: Anfrage[] = [
    { collection: 'mpg_devices', aktion: 'update', id: 'g1', body: { operational: false } },
    { collection: 'mpg_ereignisse', aktion: 'create', id: 'e1', body: { art: 'gesperrt' } },
    { collection: 'mpg_defects', aktion: 'create', id: 'd1', body: { severity: 'high' } },
  ]
  // Nachbau mit abgelehntem Gerätebuch (Regel fehlt)
  function ohneBuchRecht(o: { batchAus?: boolean } = {}) {
    const n = mitGeraet(nachbau(o))
    const verboten = (a: Anfrage) => a.collection === 'mpg_ereignisse'
    const ablehnen = () => Object.assign(new Error('Failed to create record.'), { status: 400, response: { message: 'Failed to create record.', data: {} } })
    const batch = n.server.sendeBatch.bind(n.server), einzel = n.server.sende.bind(n.server)
    n.server.sendeBatch = async (anfragen) => {
      if (!o.batchAus && anfragen.some(verboten)) throw Object.assign(new Error('Batch transaction failed.'), { status: 400, response: { message: 'Batch transaction failed.', data: { requests: { 1: { code: 'batch_request_failed', response: { status: 400, message: 'Failed to create record.', data: {} } } } } } })
      return batch(anfragen)
    }
    n.server.sende = async (a) => { if (verboten(a)) throw ablehnen(); return einzel(a) }
    return n
  }

  it('Sammelbuchung abgelehnt wegen des Eintrags: ohne ihn noch einmal → „ohne“', async () => {
    const n = ohneBuchRecht()
    expect(await schreibeZusammen(n.server, plan, buch)).toBe('ohne')
    expect([n.daten.get('mpg_devices/g1')?.operational, n.daten.has('mpg_defects/d1'), n.daten.has('mpg_ereignisse/e1')]).toEqual([false, true, false])
  })

  it('einzeln (Batch aus): Eintrag abgelehnt, Sperre und Defekt trotzdem geschrieben', async () => {
    const n = ohneBuchRecht({ batchAus: true })
    expect(await schreibeZusammen(n.server, plan, buch)).toBe('ohne')
    expect([n.daten.get('mpg_devices/g1')?.operational, n.daten.has('mpg_defects/d1')]).toEqual([false, true])
  })

  it('besteht der Vorgang nur aus dem Eintrag (Vermerk), ist er nicht verzichtbar', async () => {
    const n = ohneBuchRecht({ batchAus: true })
    await expect(schreibeZusammen(n.server, [plan[1]], buch)).rejects.toBeInstanceOf(SchreibFehler)
  })

  it('scheitert ein nötiger Teil, bleibt es ein Fehler — und nichts ist geschrieben', async () => {
    const n = ohneBuchRecht()
    // Sperre für ein Gerät, das es nicht gibt: abgelehnt, auch ohne den Eintrag
    const kaputt = plan.map(a => a.collection === 'mpg_devices' ? { ...a, id: 'weg' } : a)
    await expect(schreibeZusammen(n.server, kaputt, buch)).rejects.toMatchObject({ art: 'abgelehnt' })
    expect([n.daten.has('mpg_defects/d1'), n.daten.has('mpg_ereignisse/e1')]).toEqual([false, false])
  })

  it('Serverfehler (503) ist keine Ablehnung: unklar, nichts weggelassen', async () => {
    const n = mitGeraet(nachbau())
    n.server.sendeBatch = async () => { throw Object.assign(new Error('Service Unavailable'), { status: 503, response: { message: 'Service Unavailable', data: {} } }) }
    await expect(schreibeZusammen(n.server, plan, buch)).rejects.toMatchObject({ art: 'netz' })
  })

  it('abgelehnt wurde eine nötige Anfrage: kein zweiter Versuch ohne Eintrag', async () => {
    const n = mitGeraet(nachbau())
    let versuche = 0
    n.server.sendeBatch = async () => {
      versuche++
      throw Object.assign(new Error('Batch transaction failed.'), { status: 400, response: { message: 'Batch transaction failed.', data: { requests: { 0: { code: 'batch_request_failed', response: { status: 403, message: 'nicht erlaubt', data: {} } } } } } })
    }
    await expect(schreibeZusammen(n.server, plan, buch)).rejects.toMatchObject({ art: 'abgelehnt' })
    expect(versuche).toBe(1)
  })
})
