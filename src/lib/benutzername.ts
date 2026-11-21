// Benutzername zum Anmelden statt der E-Mail-Adresse (Owner, 21.11.2026: „jeder Benutzer kann einen
// Benutzernamen festlegen“). Festlegen im Hub (Profil → Benutzername, /hub?seite=benutzername), anmelden
// unter /login mit „E-Mail oder Benutzername“. Auf dem Server: Feld users.username (Text, eindeutig,
// Muster wie MUSTER) und users als Anmeldefeld (passwordAuth.identityFields), siehe docs/pocketbase-regeln.md,
// „users: Benutzername“.

/** Erlaubt: 3 bis 32 Zeichen, Kleinbuchstaben a–z, Ziffern, Punkt, Unterstrich, Bindestrich. Zwilling des Musters auf dem Server. */
export const MUSTER = /^[a-z0-9_.-]{3,32}$/
export const MIN = 3
export const MAX = 32

/** Wie die Person tippt, wird der Name gespeichert: klein, ohne Leerzeichen. */
export function normalisieren(roh: string): string {
  return roh.normalize('NFC').trim().toLowerCase().replace(/\s+/g, '')
}

export type Pruefung = { wert: string; fehler: string }

/** Prüft einen Benutzernamen vor dem Speichern. Leer heißt: keinen Benutzernamen (entfernen). */
export function pruefen(roh: string): Pruefung {
  const wert = normalisieren(roh)
  if (!wert) return { wert: '', fehler: '' }
  if (wert.includes('@')) return { wert, fehler: 'Ein Benutzername enthält kein @. Die E-Mail-Adresse brauchst du dafür nicht.' }
  if (wert.length < MIN) return { wert, fehler: `Mindestens ${MIN} Zeichen.` }
  if (wert.length > MAX) return { wert, fehler: `Höchstens ${MAX} Zeichen.` }
  if (!MUSTER.test(wert)) return { wert, fehler: 'Nur Kleinbuchstaben a bis z, Ziffern und die Zeichen . _ - (keine Umlaute, kein ß).' }
  return { wert, fehler: '' }
}

/**
 * Zweiter Versuch der Anmeldung: eine E-Mail-Adresse unverändert (nur ohne Leerzeichen am Rand), einen
 * Benutzernamen klein, denn Responda speichert ihn klein („Lena.Berger“ findet „lena.berger“). Der erste
 * Versuch geht wie getippt: Server aus PocketBase 0.22 können Namen mit Großbuchstaben kennen, und
 * PocketBase sucht den Namen genau (Login.tsx).
 */
export function anmeldeKennung(eingabe: string): string {
  const s = eingabe.trim()
  return s.includes('@') ? s : s.toLowerCase()
}

/**
 * Vom System vergeben: Wer schon unter PocketBase 0.22 ein Konto hatte, bekam einen zufälligen Namen
 * wie „users482913“. Er gilt nicht als selbst gewählt (im Profil steht dann „Zum Anmelden statt der E-Mail“).
 */
export function automatisch(name: string | null | undefined): boolean {
  return typeof name === 'string' && /^users[0-9]{5,}$/.test(name)
}

/** Antwort des Servers beim Speichern in Worte fassen. */
export function speicherFehler(err: unknown): string {
  const e = err as { status?: number; response?: { data?: Record<string, { code?: string }> }; data?: { data?: Record<string, { code?: string }> } } | null
  const feld = e?.response?.data?.username ?? e?.data?.data?.username
  if (feld?.code === 'validation_not_unique') return 'Diesen Benutzernamen hat schon jemand. Bitte einen anderen wählen.'
  if (feld?.code === 'validation_required') return 'Auf dem Server ist ein Benutzername Pflicht. Entfernen geht deshalb nicht, nur ändern.'
  if (feld) return 'Diesen Benutzernamen nimmt der Server nicht an. Erlaubt sind a bis z, Ziffern und . _ -'
  if (e?.status === 403 || e?.status === 404) return 'Den Benutzernamen kannst du gerade nicht ändern. Bitte die Leitung deiner Organisation fragen.'
  if (!e?.status) return 'Keine Verbindung zum Server. Bitte gleich noch einmal versuchen.'
  return 'Speichern hat nicht geklappt. Bitte gleich noch einmal versuchen.'
}

/**
 * Hat der Server den Benutzernamen übernommen? Kennt er das Feld nicht, verwirft PocketBase den Wert
 * still und die Antwort hat kein `username`; dann sind Benutzernamen auf dem Server nicht eingerichtet.
 */
export function uebernommen(antwort: Record<string, unknown> | null | undefined, wert: string): 'ja' | 'nicht_eingerichtet' | 'anders' {
  if (!antwort || !('username' in antwort)) return 'nicht_eingerichtet'
  return (typeof antwort.username === 'string' ? antwort.username : '') === wert ? 'ja' : 'anders'
}
