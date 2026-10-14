import { describe, it, expect } from 'vitest'
import { pbFehlerText } from '../pbFehler'

describe('Ablehnungen von PocketBase verständlich machen', () => {
  it('nennt den Grund je Feld mit Anzeigenamen', () => {
    const e = { status: 400, message: 'Failed to create record.', response: { message: 'Failed to create record.', data: {
      org_code: { code: 'validation_not_unique', message: 'Value must be unique.' },
      max_users: { code: 'validation_required', message: 'Cannot be blank.' },
    } } }
    expect(pbFehlerText(e, { org_code: 'Kürzel', max_users: 'Max. Benutzer' })).toBe('Kürzel ist schon vergeben, Max. Benutzer fehlt.')
  })

  it('unbekannte Codes behalten die Meldung des Servers', () => {
    const e = { status: 400, response: { data: { org_code: { code: 'validation_seltsam', message: 'Must match regex' } } } }
    expect(pbFehlerText(e, { org_code: 'Kürzel' })).toBe('Kürzel – Must match regex.')
  })

  it('erkennt fehlende Berechtigung, Verbindung und abgelaufene Anmeldung', () => {
    expect(pbFehlerText({ status: 403, message: 'x' })).toMatch(/Keine Berechtigung/)
    expect(pbFehlerText({ status: 0 })).toMatch(/Keine Verbindung/)
    expect(pbFehlerText({ status: 401 })).toMatch(/Anmeldung ist abgelaufen/)
  })

  it('fällt auf die Meldung zurück, wenn es keine Felder gibt', () => {
    expect(pbFehlerText({ status: 400, message: 'Failed to create record.' })).toBe('Failed to create record.')
    expect(pbFehlerText(null)).toBe('Unbekannter Fehler.')
  })
})
