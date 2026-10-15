import { describe, it, expect } from 'vitest'
import { SPERRE_SEKUNDEN, anforderFehler, codeFehler, istEmail, maskiereEmail, restZeit } from '../zweiFaktor'

const JETZT = 1_800_000_000_000

describe('Zwei-Faktor: Antworten beim Bestätigen des Codes', () => {
  it('zu viele Versuche: sagt, dass auch der richtige Code gerade nicht geht, und sperrt 3 Minuten', () => {
    const f = codeFehler(429, 'Too many attempts, please try again later with a new OTP.', JETZT)
    expect(f.text).toMatch(/Zu viele Versuche/)
    expect(f.text).toMatch(/auch keinen richtigen/)
    expect(f.sperreBis).toBe(JETZT + SPERRE_SEKUNDEN * 1000)
    expect(f.neuAnmelden).toBeUndefined()
  })

  it('falscher oder alter Code: Hinweis auf die neueste E-Mail', () => {
    const f = codeFehler(400, 'Invalid or expired OTP.')
    expect(f.text).toMatch(/neuesten E-Mail/)
    expect(f.neuAnmelden).toBeUndefined()
    expect(f.sperreBis).toBeUndefined()
  })

  it('abgelaufene Anmeldung: zurück zum Passwort', () => {
    expect(codeFehler(400, 'Invalid or expired MFA session.')).toEqual({ text: 'Die Anmeldung ist abgelaufen. Bitte melde dich neu an.', neuAnmelden: true })
    expect(codeFehler(400, 'A different authentication method is required.').neuAnmelden).toBe(true)
  })

  it('Code einer fremden Adresse: sagt das, statt "abgelaufen"', () => {
    const f = codeFehler(400, 'Invalid MFA session.')
    expect(f.neuAnmelden).toBe(true)
    expect(f.text).toMatch(/anderen E-Mail-Adresse/)
  })

  it('ausgeschaltet, keine Verbindung, Unbekanntes', () => {
    expect(codeFehler(403, 'The collection is not configured to allow OTP authentication.').text).toMatch(/ausgeschaltet/)
    expect(codeFehler(undefined, '').text).toMatch(/Keine Verbindung/)
    expect(codeFehler(0, '').text).toMatch(/Keine Verbindung/)
    expect(codeFehler(500, 'x').text).toMatch(/Fehler 500/)
  })
})

describe('Zwei-Faktor: Antworten beim Anfordern des Codes', () => {
  it('keine E-Mail-Adresse, zu viele Anforderungen, keine Verbindung', () => {
    expect(anforderFehler(400).text).toMatch(/keine gültige E-Mail-Adresse/)
    expect(anforderFehler(429, JETZT).sperreBis).toBe(JETZT + SPERRE_SEKUNDEN * 1000)
    expect(anforderFehler(undefined).text).toMatch(/Keine Verbindung/)
  })
})

describe('Zwei-Faktor: Hilfen', () => {
  it('erkennt E-Mail-Adressen und Benutzernamen', () => {
    expect(istEmail('dani@example.com')).toBe(true)
    expect(istEmail(' dani@example.com ')).toBe(true)
    expect(istEmail('dani')).toBe(false)
    expect(istEmail('dani@local')).toBe(false)
  })

  it('zeigt die Adresse nur angedeutet', () => {
    expect(maskiereEmail('dani@example.com')).toBe('d•••@example.com')
    expect(maskiereEmail('a@example.com')).toBe('a••@example.com')
    expect(maskiereEmail('sehr.langer.name@example.com')).toBe('s••••••@example.com')
    expect(maskiereEmail('kaputt')).toBe('kaputt')
  })

  it('Restzeit als m:ss, nie negativ', () => {
    expect(restZeit(JETZT + 151_000, JETZT)).toBe('2:31')
    expect(restZeit(JETZT + 400, JETZT)).toBe('0:01')
    expect(restZeit(JETZT - 5000, JETZT)).toBe('0:00')
  })
})
