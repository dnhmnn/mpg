// Ablehnungen von PocketBase verständlich machen.
//
// PocketBase meldet beim Speichern pauschal "Failed to create record." und
// legt den eigentlichen Grund je Feld daneben (response.data.<feld>.code).
// Ohne diese Angabe weiß niemand, ob das Kürzel schon vergeben ist, ein
// Pflichtfeld fehlt oder die Berechtigung nicht reicht.

const GRUENDE: Record<string, string> = {
  validation_required: 'fehlt',
  validation_not_unique: 'ist schon vergeben',
  validation_invalid_format: 'hat ein ungültiges Format',
  validation_match_invalid: 'hat ein ungültiges Format',
  validation_is_email: 'ist keine gültige E-Mail-Adresse',
  validation_invalid_email: 'ist keine gültige E-Mail-Adresse',
  validation_length_out_of_range: 'hat eine unzulässige Länge',
  validation_min_text_constraint: 'ist zu kurz',
  validation_max_text_constraint: 'ist zu lang',
  validation_min_number_constraint: 'ist zu klein',
  validation_max_number_constraint: 'ist zu groß',
  validation_invalid_value: 'hat einen ungültigen Wert',
  validation_values_mismatch: 'stimmt nicht überein',
}

interface PbFehler {
  status?: number
  message?: string
  response?: { message?: string; data?: Record<string, { code?: string; message?: string } | undefined> }
  data?: { message?: string; data?: Record<string, { code?: string; message?: string } | undefined> }
}

/**
 * Der Grund einer Ablehnung, für Menschen lesbar.
 *
 * @param feldnamen Anzeigenamen der Felder, z.B. { org_code: 'Kürzel' }
 */
export function pbFehlerText(fehler: unknown, feldnamen: Record<string, string> = {}): string {
  const e = (fehler ?? {}) as PbFehler
  if (e.status === 0) return 'Keine Verbindung zum Server. Bitte erneut versuchen.'
  if (e.status === 401) return 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.'
  if (e.status === 403) return 'Keine Berechtigung für diese Aktion — die Regeln in PocketBase lassen es nicht zu.'
  const daten = e.response?.data ?? e.data?.data ?? {}
  const teile = Object.entries(daten)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([feld, v]) => `${feldnamen[feld] ?? feld} ${GRUENDE[v!.code ?? ''] ?? (v!.message ? `– ${v!.message}` : 'ist ungültig')}`)
  if (teile.length) return teile.join(', ') + '.'
  if (e.status === 404) return 'Nicht gefunden — oder keine Berechtigung, es zu sehen.'
  return e.response?.message || e.message || 'Unbekannter Fehler.'
}
