import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Der Baustein läuft in PocketBase (pb_hooks, CommonJS) — hier derselbe Code,
// wie dort in einem eigenen Kontext mit module.exports ausgeführt
const modul = { exports: {} as unknown }
runInNewContext(readFileSync(new URL('../../../pb_hooks/willkommen-mail.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
const { willkommenMail, echteAdresse, nurUnitas } = modul.exports as {
  willkommenMail: (n: Record<string, unknown>) => { an: string; betreff: string; html: string; text: string } | null
  echteAdresse: (e: string) => boolean
  nurUnitas: (n: Record<string, unknown>) => boolean
}

const ORG = { name: 'Testwache', code: 'testwache' }

describe('Willkommens-E-Mail: wer sie bekommt', () => {
  it('echte Adressen ja — Platzhalter, temporäre Zugänge und Unsinn nein', () => {
    expect(echteAdresse('max@example.com')).toBe(true)
    expect(echteAdresse(' Max@Example.COM ')).toBe(true)
    expect(echteAdresse('teilnehmer-123@kein-email.intern')).toBe(false)
    expect(echteAdresse('temp-1700000000@org1.local')).toBe(false)
    expect(echteAdresse('')).toBe(false)
    expect(echteAdresse('kein-at-zeichen')).toBe(false)
    expect(willkommenMail({ email: 'temp-1@org1.local', org: ORG })).toBeNull()
    expect(willkommenMail({ email: 'x@kein-email.intern', org: ORG })).toBeNull()
  })
})

describe('Willkommens-E-Mail: Inhalt', () => {
  const mail = willkommenMail({ name: 'Max Mustermann', email: 'max@example.com', role: 'benutzer', org: ORG })!

  it('nennt Organisation, Org-Code und Anmelde-Adresse', () => {
    expect(mail.an).toBe('max@example.com')
    expect(mail.betreff).toBe('Willkommen bei Responda — Testwache')
    for (const t of [mail.html, mail.text]) {
      expect(t).toContain('Testwache')
      expect(t).toContain('testwache')
      expect(t).toContain('max@example.com')
      expect(t).toContain('Servus Max Mustermann,')
    }
  })

  it('führt zur App und zu "Passwort festlegen" mit vorbelegter Adresse', () => {
    expect(mail.html).toContain('href="https://app.responda.systems/login?email=max%40example.com"')
    expect(mail.html).toContain('href="https://app.responda.systems/login?email=max%40example.com&amp;passwort=neu"')
    expect(mail.text).toContain('https://app.responda.systems/login?email=max%40example.com&passwort=neu')
  })

  it('zeigt die Seite der Organisation', () => {
    expect(mail.html).toContain('href="https://app.responda.systems/testwache"')
    expect(mail.text).toContain('https://app.responda.systems/testwache')
  })

  it('enthält nie ein Passwort und keine Emojis', () => {
    const m = willkommenMail({ name: 'Max', email: 'max@example.com', password: 'geheim123', org: ORG })!
    expect(m.html + m.text).not.toContain('geheim123')
    expect(/\p{Extended_Pictographic}/u.test(m.html + m.text)).toBe(false)
  })
})

describe('Willkommens-E-Mail: Sonderfälle', () => {
  it('Namen und Org-Angaben werden maskiert — kein HTML aus Eingaben', () => {
    const m = willkommenMail({ name: '<img src=x onerror=alert(1)>', email: 'a@example.com', org: { name: 'A & B "Wache"', code: 'a<b' } })!
    expect(m.html).not.toContain('<img')
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(m.html).toContain('A &amp; B &quot;Wache&quot;')
    expect(m.html).toContain('href="https://app.responda.systems/a%3Cb"')
  })

  it('Unitas-Nutzer: Hinweis auf Unitas, ohne Seite der Organisation', () => {
    expect(nurUnitas({ permissions: { lernbar: true, chat: false } })).toBe(true)
    expect(nurUnitas({ role: 'teilnehmer' })).toBe(true)
    expect(nurUnitas({ permissions: { lernbar: true, lager: true } })).toBe(false)
    expect(nurUnitas({ role: 'teilnehmer', supervisor: true })).toBe(false)
    const m = willkommenMail({ name: 'Lea', email: 'lea@example.com', permissions: { lernbar: true }, org: ORG })!
    expect(m.text).toContain('Unitas')
    expect(m.text).not.toContain('https://app.responda.systems/testwache')
    expect(m.text).toContain('Org-Code: testwache')
  })

  it('ohne Organisation und ohne Namen bleibt sie vollständig', () => {
    const m = willkommenMail({ email: 'neu@example.com' })!
    expect(m.betreff).toBe('Willkommen bei Responda')
    expect(m.text.startsWith('Servus,')).toBe(true)
    expect(m.text).not.toContain('Org-Code')
    expect(m.text).not.toContain('\n\n\n')
  })
})
