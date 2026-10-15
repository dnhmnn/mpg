import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resetEmail, resetFehler, resetToken } from '../resetLink'

const T = 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Im5vcmFAZXhhbXBsZS5jb20iLCJ0eXBlIjoicGFzc3dvcmRSZXNldCJ9.sig_-x'
const ort = (url: string) => { const u = new URL(url); return { pathname: u.pathname, search: u.search, hash: u.hash } }

describe('Link aus der E-Mail "Passwort zurücksetzen"', () => {
  it('findet das Token in jeder Form des Links', () => {
    expect(resetToken(ort(`https://app.responda.systems/reset-password?token=${T}`))).toBe(T)
    expect(resetToken(ort(`https://app.responda.systems/reset-password/${T}`))).toBe(T)
    expect(resetToken(ort(`https://app.responda.systems/_/#/auth/confirm-password-reset/${T}`))).toBe(T)
    expect(resetToken(ort(`https://app.responda.systems/password-reset.html#token=${T}`))).toBe(T)
    expect(resetToken(ort(`https://app.responda.systems/password-reset.html#auth?token=${T}`))).toBe(T)
    expect(resetToken(ort('https://app.responda.systems/reset-password'))).toBe('')
    // die kaputte Vorlage: {ACTION_URL} blieb als Text stehen
    expect(resetToken(ort('https://app.responda.systems/%7BACTION_URL%7D'))).toBe('')
  })

  it('liest die Adresse aus dem Token zum Vorbelegen', () => {
    expect(resetEmail(T)).toBe('nora@example.com')
    expect(resetEmail('kaputt')).toBe('')
  })

  it('sagt, warum das Festlegen scheitert', () => {
    expect(resetFehler(400, { token: { code: 'validation_invalid_token' } })).toMatch(/abgelaufen oder wurde schon benutzt/)
    expect(resetFehler(400, { password: { code: 'validation_length_out_of_range' } })).toMatch(/mindestens 8/)
    expect(resetFehler(400, { passwordConfirm: { code: 'validation_values_mismatch' } })).toMatch(/stimmen nicht überein/)
    expect(resetFehler(0, undefined)).toMatch(/Keine Verbindung/)
  })
})

describe('E-Mail-Vorlagen für PocketBase (public/email-*.html)', () => {
  // Seit PocketBase 0.23 gibt es nur noch diese Platzhalter — {ACTION_URL} bliebe als Text stehen
  const bekannt = /^\{(APP_NAME|APP_URL|TOKEN|OTP|OTP_ID|ALERT_INFO|RECORD:[a-zA-Z_]+)\}$/
  const dateien = readdirSync(new URL('../../../public/', import.meta.url)).filter((f) => /^email-.*\.html$/.test(f))

  it('es gibt Vorlagen', () => expect(dateien.length).toBeGreaterThan(0))
  for (const f of dateien) {
    it(`${f}: nur Platzhalter, die PocketBase ersetzt`, () => {
      const s = readFileSync(new URL(`../../../public/${f}`, import.meta.url), 'utf8')
      for (const p of s.match(/\{[A-Z_][A-Za-z_:]*\}/g) || []) expect(p, f).toMatch(bekannt)
    })
  }

  it('der Knopf der Reset-E-Mail führt auf die Seite zum Festlegen in der App', () => {
    const s = readFileSync(new URL('../../../public/email-passwort-reset.html', import.meta.url), 'utf8')
    expect(s).toContain('href="https://app.responda.systems/reset-password?token={TOKEN}"')
  })
})
