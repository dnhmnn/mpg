import { describe, it, expect } from 'vitest'
import { zielMitSitzung, zielNachAnmeldung } from '../anmeldung'

const JETZT = Date.parse('2026-11-15T10:00:00Z')

describe('Anmeldung: wohin mit gespeicherter Sitzung (App vom Homebildschirm)', () => {
  it('gültige Sitzung: gleich in den Hub', () => {
    expect(zielMitSitzung(true, { permissions: { dashboard: true, patienten: true } }, JETZT)).toBe('/hub')
  })

  it('nur Lernbar freigegeben: in die Lernbar, wie nach dem Anmelden', () => {
    expect(zielMitSitzung(true, { permissions: { lernbar: true } }, JETZT)).toBe('/lernbar')
    expect(zielMitSitzung(true, { permissions: { lernbar: true, lager: false } }, JETZT)).toBe('/lernbar')
    expect(zielMitSitzung(true, { permissions: { lernbar: true, lager: true } }, JETZT)).toBe('/hub')
  })

  it('ohne Rechte in den Hub (der Hub sagt, dass es noch keine Apps gibt)', () => {
    expect(zielMitSitzung(true, { permissions: null }, JETZT)).toBe('/hub')
    expect(zielMitSitzung(true, {}, JETZT)).toBe('/hub')
  })

  it('neu anmelden: keine oder abgelaufene Sitzung, kein Konto, gesperrt, Zugang abgelaufen', () => {
    expect(zielMitSitzung(false, { permissions: { dashboard: true } }, JETZT)).toBeNull()
    expect(zielMitSitzung(true, null, JETZT)).toBeNull()
    expect(zielMitSitzung(true, { disabled: true }, JETZT)).toBeNull()
    expect(zielMitSitzung(true, { expires_at: '2026-11-14 23:59:59.000Z' }, JETZT)).toBeNull()
  })

  it('Zugang läuft erst später ab oder ist leer: weiter', () => {
    expect(zielMitSitzung(true, { expires_at: '2026-12-31 23:59:59.000Z' }, JETZT)).toBe('/hub')
    expect(zielMitSitzung(true, { expires_at: '' }, JETZT)).toBe('/hub')
    expect(zielMitSitzung(true, { expires_at: 'kein Datum' }, JETZT)).toBe('/hub')
  })

  it('nach dem Anmelden dasselbe Ziel wie bisher', () => {
    expect(zielNachAnmeldung({ permissions: { lernbar: true } })).toBe('/lernbar')
    expect(zielNachAnmeldung({ permissions: { lernbar: true, mpg: true } })).toBe('/hub')
    expect(zielNachAnmeldung(undefined)).toBe('/hub')
  })
})
