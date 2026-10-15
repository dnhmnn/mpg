// Der Link aus der E-Mail "Passwort zurücksetzen" in allen Formen, die er
// annehmen kann — je nach Vorlage in PocketBase:
//   /reset-password?token=…            (Vorlage aus public/email-passwort-reset.html)
//   /reset-password/…                  (Token im Pfad)
//   /_/#/auth/confirm-password-reset/… (PocketBase-Standard, wenn APP_URL die App ist)
//   …#token=…  oder  …#…?token=…       (ältere Seiten)

export function resetToken(ort: { pathname: string; search: string; hash: string }): string {
  const q = new URLSearchParams(ort.search).get('token')
  if (q) return q
  const pfad = ort.pathname.match(/\/reset-password\/([^/?#]+)/)
  if (pfad) return decodeURIComponent(pfad[1])
  const standard = ort.hash.match(/confirm-password-reset\/([^/?#&]+)/)
  if (standard) return decodeURIComponent(standard[1])
  const h = ort.hash.replace(/^#/, '')
  const t = new URLSearchParams(h.includes('?') ? h.slice(h.indexOf('?') + 1) : h).get('token')
  return t || ''
}

/** Die Adresse aus dem Token (nur zum Vorbelegen der Anmeldung, nicht geprüft). */
export function resetEmail(token: string): string {
  try {
    const teil = token.split('.')[1]
    if (!teil) return ''
    const json = JSON.parse(atob(teil.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(teil.length / 4) * 4, '=')))
    return typeof json.email === 'string' ? json.email : ''
  } catch { return '' }
}

/** Was eine Ablehnung beim Festlegen bedeutet. */
export function resetFehler(status: number | undefined, daten: Record<string, { code?: string; message?: string }> | undefined): string {
  const d = daten || {}
  if (!status) return 'Keine Verbindung zum Server. Bitte versuche es erneut.'
  if (d.token) return 'Der Link ist abgelaufen oder wurde schon benutzt — er gilt nur kurz und nur einmal. Fordere unten einen neuen an.'
  if (d.passwordConfirm) return 'Die beiden Passwörter stimmen nicht überein.'
  if (d.password) return 'Das Passwort passt nicht: Es braucht mindestens 8 und höchstens 71 Zeichen.'
  return `Das Passwort ließ sich nicht festlegen (Fehler ${status}). Fordere einen neuen Link an.`
}
