// Nach einer neuen Veröffentlichung: alte Fassung im Gerät, neue auf dem Server.
//
// Die Teile der App (Hub, Lager, …) werden erst beim Öffnen nachgeladen und
// tragen eine Kennung im Dateinamen, die sich mit jeder Veröffentlichung
// ändert. Läuft noch die alte Fassung — oder hat der Service Worker gerade die
// neue übernommen und die alten Teile weggeräumt —, sucht sie einen Teil, den
// es nicht mehr gibt. Netlify liefert dann die Startseite statt des Codes, und
// der Browser meldet "'text/html' is not a valid JavaScript MIME type".
//
// Abhilfe: Genau dann einmal neu laden — danach läuft die neue Fassung. Eine
// Sperre verhindert eine Schleife, falls der Teil auch nach dem Neuladen fehlt.

const SCHLUESSEL = 'neue_fassung_neu_geladen'
/** Innerhalb dieser Zeit nicht noch einmal neu laden (ms). */
export const SPERRE_MS = 30_000

/** Ist das der Fehler "Teil der App fehlt" (alte Fassung nach Veröffentlichung)? */
export function istLadefehler(fehler: unknown): boolean {
  const text = fehler instanceof Error ? `${fehler.name} ${fehler.message}` : String(fehler ?? '')
  return /is not a valid JavaScript MIME type|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed/i.test(text)
}

/** Darf jetzt neu geladen werden? (nicht, wenn es gerade erst passiert ist) */
export function neuLadenErlaubt(letztes: number | null, jetzt = Date.now()): boolean {
  return !letztes || jetzt - letztes > SPERRE_MS
}

function letztesNeuladen(): number | null {
  try {
    const w = sessionStorage.getItem(SCHLUESSEL)
    return w ? Number(w) : null
  } catch { return null }
}

let laeuft = false

/** Läuft das Neuladen schon? (Dann zeigt die App "wird aktualisiert" statt eines Fehlers.) */
export function wirdNeuGeladen(): boolean {
  return laeuft
}

/** Einmal neu laden. false, wenn es gerade schon versucht wurde (dann Fehler zeigen). */
export function einmalNeuLaden(): boolean {
  if (laeuft) return true
  if (!neuLadenErlaubt(letztesNeuladen())) return false
  try { sessionStorage.setItem(SCHLUESSEL, String(Date.now())) } catch { /* ohne Speicher trotzdem neu laden */ }
  laeuft = true
  window.location.reload()
  return true
}

/** Fängt fehlgeschlagene Nachlade-Importe ab (Vite meldet sie als vite:preloadError). */
export function neueFassungAbfangen(): void {
  window.addEventListener('vite:preloadError', (e) => {
    if (einmalNeuLaden()) e.preventDefault()
  })
}
