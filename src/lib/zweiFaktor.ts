// Anmeldung in zwei Schritten (Passwort + Code per E-Mail): was eine Antwort
// von PocketBase bedeutet und was die Anmeldung dann sagt.
//
// PocketBase lehnt nach wenigen Fehlversuchen für 3 Minuten jeden Code ab —
// auch den richtigen, auch einen neuen. Es gilt nur der Code der neuesten
// Anforderung. Und den Code gibt es nur an eine E-Mail-Adresse, nicht an
// einen Benutzernamen. Ohne diese Unterscheidung sah alles wie "Ungültiger
// Code" aus.

/** So lange sperrt PocketBase nach zu vielen Versuchen (Sekunden). */
export const SPERRE_SEKUNDEN = 180
/** Frühestens so lange nach dem letzten Code ein neuer (Sekunden). */
export const NEU_SEKUNDEN = 30

export interface CodeFehler {
  text: string
  /** Die Anmeldung selbst ist abgelaufen — zurück zu Passwort. */
  neuAnmelden?: boolean
  /** Bis wann PocketBase Codes ablehnt (ms seit 1970). */
  sperreBis?: number
}

/** Fehler beim Bestätigen des Codes (auth-with-otp). */
export function codeFehler(status: number | undefined, message: string | undefined, jetzt = Date.now()): CodeFehler {
  const m = String(message || '')
  if (status === 429) {
    return { text: 'Zu viele Versuche — der Server nimmt gerade keinen Code an, auch keinen richtigen. Warte kurz und fordere dann einen neuen Code an.', sperreBis: jetzt + SPERRE_SEKUNDEN * 1000 }
  }
  if (status === 400 && /expired MFA session/i.test(m)) {
    return { text: 'Die Anmeldung ist abgelaufen. Bitte melde dich neu an.', neuAnmelden: true }
  }
  if (status === 400 && /MFA session/i.test(m)) {
    // Code einer anderen Adresse als der des Zugangs
    return { text: 'Der Code gehört zu einer anderen E-Mail-Adresse als dein Zugang. Bitte melde dich neu an und gib die Adresse deines Zugangs an.', neuAnmelden: true }
  }
  if (status === 400 && /different authentication method/i.test(m)) {
    return { text: 'Bitte melde dich neu an.', neuAnmelden: true }
  }
  if (status === 400) {
    return { text: 'Der Code stimmt nicht oder ist abgelaufen. Es gilt nur der Code aus der neuesten E-Mail — sonst fordere einen neuen an.' }
  }
  if (status === 403) {
    return { text: 'Die Anmeldung mit Code ist auf dem Server ausgeschaltet. Bitte gib deinem Verwalter Bescheid.' }
  }
  if (!status) return { text: 'Keine Verbindung zum Server. Bitte versuche es erneut.' }
  return { text: `Anmeldung fehlgeschlagen (Fehler ${status}). Bitte versuche es erneut.` }
}

/** Fehler beim Anfordern des Codes (request-otp). */
export function anforderFehler(status: number | undefined, jetzt = Date.now()): CodeFehler {
  if (status === 429) return { text: 'Zu viele Anforderungen. Warte kurz und versuche es dann erneut.', sperreBis: jetzt + SPERRE_SEKUNDEN * 1000 }
  if (status === 400) return { text: 'Das ist keine gültige E-Mail-Adresse. Den Code gibt es nur per E-Mail.' }
  if (!status) return { text: 'Keine Verbindung zum Server. Bitte versuche es erneut.' }
  return { text: `Der Code konnte nicht gesendet werden (Fehler ${status}).` }
}

export function istEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

/** "d•••@example.com" — zeigt, wohin der Code ging, ohne die Adresse ganz zu nennen. */
export function maskiereEmail(email: string): string {
  const [name, domain] = email.trim().split('@')
  if (!name || !domain) return email
  return `${name[0]}${'•'.repeat(Math.min(Math.max(name.length - 1, 2), 6))}@${domain}`
}

/** "2:31" */
export function restZeit(bis: number, jetzt = Date.now()): string {
  const s = Math.max(0, Math.ceil((bis - jetzt) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
