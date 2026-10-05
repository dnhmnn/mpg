import { describe, it, expect } from 'vitest'
import {
  ENTWURF_FRIST_MS, entwurfLesen, entwurfSchluessel, entwurfSchreiben,
  entwurfVerwerfen, lohntSichzuBehalten, standText, type Speicher,
} from '../../pages/public/doku/entwurf'

/** Ein Speicher wie der des Browsers — und einer, der sich weigert. */
function speicher(): Speicher & { inhalt: Map<string, string> } {
  const inhalt = new Map<string, string>()
  return {
    inhalt,
    getItem: (k) => inhalt.get(k) ?? null,
    setItem: (k, v) => { inhalt.set(k, v) },
    removeItem: (k) => { inhalt.delete(k) },
  }
}

const bockig: Speicher = {
  getItem: () => { throw new Error('nein') },
  setItem: () => { throw new Error('voll') },
  removeItem: () => { throw new Error('nein') },
}

describe('Der Entwurf im Gerät', () => {
  it('schreibt und liest, was eingegeben wurde', () => {
    const s = speicher()
    expect(entwurfSchreiben(s, 'test', { name: 'Mustermann', hf: '80' })).toBe(true)
    expect(entwurfLesen(s, 'test')?.werte).toEqual({ name: 'Mustermann', hf: '80' })
  })

  it('hält die Entwürfe zweier Organisationen auseinander', () => {
    const s = speicher()
    entwurfSchreiben(s, 'wache-a', { name: 'A' })
    entwurfSchreiben(s, 'wache-b', { name: 'B' })
    expect(entwurfLesen(s, 'wache-a')?.werte).toEqual({ name: 'A' })
    expect(entwurfLesen(s, 'wache-b')?.werte).toEqual({ name: 'B' })
    expect(entwurfSchluessel('wache-a')).not.toBe(entwurfSchluessel('wache-b'))
  })

  it('hebt nichts auf, worin nichts steht', () => {
    // Ein leerer Entwurf wäre beim nächsten Öffnen eine Meldung ohne Inhalt.
    const s = speicher()
    entwurfSchreiben(s, 'test', { name: 'Mustermann' })
    entwurfSchreiben(s, 'test', { name: '', haut: [], check: false })
    expect(entwurfLesen(s, 'test')).toBeNull()
    expect(s.inhalt.size).toBe(0)
  })

  it('erkennt, was sich zu behalten lohnt', () => {
    expect(lohntSichzuBehalten({})).toBe(false)
    expect(lohntSichzuBehalten({ a: '', b: null, c: [], d: false })).toBe(false)
    expect(lohntSichzuBehalten({ a: '0' })).toBe(true)
    expect(lohntSichzuBehalten({ haut: ['unauffaellig'] })).toBe(true)
    expect(lohntSichzuBehalten({ mannschaft: { tf: { id: 'u1', name: 'A' } } })).toBe(true)
    expect(lohntSichzuBehalten({ mannschaft: {} })).toBe(false)
  })

  it('vergisst einen Entwurf nach einem Tag', () => {
    // Auf einem geteilten Tablet sollen Patientendaten nicht ewig liegen.
    const s = speicher()
    const gestern = new Date('2026-10-04T08:00:00Z')
    entwurfSchreiben(s, 'test', { name: 'Mustermann' }, gestern)
    const knappDrin = new Date(gestern.getTime() + ENTWURF_FRIST_MS - 1000)
    const knappDraussen = new Date(gestern.getTime() + ENTWURF_FRIST_MS + 1000)
    expect(entwurfLesen(s, 'test', knappDrin)).not.toBeNull()
    expect(entwurfLesen(s, 'test', knappDraussen)).toBeNull()
  })

  it('verwirft auf Zuruf', () => {
    const s = speicher()
    entwurfSchreiben(s, 'test', { name: 'Mustermann' })
    entwurfVerwerfen(s, 'test')
    expect(entwurfLesen(s, 'test')).toBeNull()
  })

  it('verschluckt sich nicht an kaputtem Inhalt', () => {
    const s = speicher()
    s.inhalt.set(entwurfSchluessel('test'), 'kein JSON')
    expect(entwurfLesen(s, 'test')).toBeNull()
    s.inhalt.set(entwurfSchluessel('test'), '{"werte":{"a":1}}')
    expect(entwurfLesen(s, 'test')).toBeNull()
    s.inhalt.set(entwurfSchluessel('test'), '{"stand":"keine Zeit","werte":{"a":1}}')
    expect(entwurfLesen(s, 'test')).toBeNull()
  })

  it('sagt es, wenn das Gerät nichts behalten will', () => {
    // Privates Fenster, voller Speicher, abgeschaltete Website-Daten: dann
    // darf die Maske nicht so tun, als sei gesichert.
    expect(entwurfSchreiben(bockig, 'test', { name: 'Mustermann' })).toBe(false)
    expect(entwurfLesen(bockig, 'test')).toBeNull()
    expect(() => entwurfVerwerfen(bockig, 'test')).not.toThrow()
  })

  it('sagt den Stand in Worten', () => {
    const jetzt = new Date('2026-10-05T12:00:00Z')
    const vor = (ms: number) => new Date(jetzt.getTime() - ms).toISOString()
    expect(standText(vor(10_000), jetzt)).toBe('gerade eben')
    expect(standText(vor(60_000), jetzt)).toBe('vor 1 Minute')
    expect(standText(vor(25 * 60_000), jetzt)).toBe('vor 25 Minuten')
    expect(standText(vor(3 * 3_600_000), jetzt)).toBe('vor 3 Stunden')
  })
})
