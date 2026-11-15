// Wohin nach der Anmeldung, und ob jemand schon angemeldet ist.
//
// Die App vom Homebildschirm startet auf der Startseite (/). Mit einer gültigen, gespeicherten Sitzung
// geht es von dort und von /login gleich in den Hub (bzw. die Lernbar), statt erneut nach dem Passwort
// zu fragen (Owner, 15.11.2026). Gesperrte oder abgelaufene Konten müssen sich neu anmelden; ob die
// Sitzung noch gilt, prüft danach useAuth am Server (authRefresh).

export interface AnmeldeKonto {
  permissions?: Record<string, unknown> | null
  disabled?: boolean | null
  expires_at?: string | null
}

/** Nur die Lernbar freigegeben: dann in die Lernbar, sonst in den Hub (wie bisher nach dem Anmelden). */
export function zielNachAnmeldung(konto: AnmeldeKonto | null | undefined): '/hub' | '/lernbar' {
  const rechte = (konto?.permissions || {}) as Record<string, unknown>
  const nurLernbar = !!rechte.lernbar && !Object.entries(rechte).some(([k, v]) => k !== 'lernbar' && v)
  return nurLernbar ? '/lernbar' : '/hub'
}

/**
 * Ziel für eine gespeicherte Sitzung; null, wenn neu anzumelden ist: keine oder abgelaufene Sitzung,
 * kein Konto, Konto gesperrt oder Zugang abgelaufen.
 */
export function zielMitSitzung(gueltig: boolean, konto: AnmeldeKonto | null | undefined, jetzt: number): '/hub' | '/lernbar' | null {
  if (!gueltig || !konto) return null
  if (konto.disabled) return null
  if (konto.expires_at) {
    const bis = new Date(konto.expires_at).getTime()
    if (Number.isFinite(bis) && bis < jetzt) return null
  }
  return zielNachAnmeldung(konto)
}
