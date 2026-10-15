import { describe, it, expect, vi } from 'vitest'
vi.mock('../pocketbase', () => ({ pb: {} }))
import { willkommenErgebnis } from '../willkommen'

describe('Willkommens-E-Mail senden: was die Antwort bedeutet', () => {
  it('gesendet: nennt Adresse und Absender', () => {
    const r = willkommenErgebnis(200, { gesendet: true, an: 'nora@example.com', absender: 'noreply@responda.systems', smtp: true })
    expect(r.ok).toBe(true)
    expect(r.text).toContain('nora@example.com')
    expect(r.text).toContain('Spam-Ordner')
    expect(r.text).toContain('noreply@responda.systems')
  })

  it('Erweiterung fehlt auf dem Server (404 von PocketBase selbst)', () => {
    const r = willkommenErgebnis(404, { message: "The requested resource wasn't found." })
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/Server-Erweiterung fehlt/)
    expect(r.text).toMatch(/pb_hooks/)
  })

  it('Benutzer nicht gefunden ist etwas anderes als eine fehlende Erweiterung', () => {
    expect(willkommenErgebnis(404, { fehler: 'Benutzer nicht gefunden.' }).text).toBe('Benutzer nicht gefunden.')
  })

  it('Mailserver lehnt ab: Fehlertext und wo man nachsieht', () => {
    const ohne = willkommenErgebnis(502, { fehler: 'exec: "sendmail": executable file not found', smtp: false })
    expect(ohne.text).toMatch(/sendmail/)
    expect(ohne.text).toMatch(/kein SMTP-Server eingetragen/)
    const mit = willkommenErgebnis(502, { fehler: 'dial tcp: connection refused', smtp: true })
    expect(mit.text).toMatch(/connection refused/)
    expect(mit.text).toMatch(/Send test email/)
  })

  it('keine Berechtigung, Platzhalter, keine Verbindung', () => {
    expect(willkommenErgebnis(403, { fehler: 'Keine Berechtigung für diesen Benutzer.' }).text).toMatch(/Keine Berechtigung/)
    expect(willkommenErgebnis(400, { fehler: 'Für diese Adresse gibt es keine Willkommens-E-Mail (Platzhalter oder temporärer Zugang).' }).text).toMatch(/Platzhalter/)
    expect(willkommenErgebnis(0, null).text).toMatch(/Keine Verbindung/)
    expect(willkommenErgebnis(undefined, undefined).text).toMatch(/Keine Verbindung/)
  })
})
