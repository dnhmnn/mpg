// Willkommens-E-Mail gezielt senden (pb_hooks/willkommen.pb.js, Route
// /willkommen/senden) — und verständlich sagen, woran es hakt, wenn sie
// nicht ankommt.

import { pb } from './pocketbase'

export interface WillkommenErgebnis {
  ok: boolean
  text: string
}

interface Antwort { fehler?: string; gesendet?: boolean; an?: string; smtp?: boolean; absender?: string; message?: string }

/** Was die Antwort des Servers bedeutet. */
export function willkommenErgebnis(status: number | undefined, a: Antwort | null | undefined): WillkommenErgebnis {
  const d = a || {}
  if (status === 200 && d.gesendet) {
    return { ok: true, text: `Willkommens-E-Mail an ${d.an} gesendet. Kommt sie nicht an, liegt sie vielleicht im Spam-Ordner${d.absender ? ` (Absender ${d.absender})` : ''}.` }
  }
  // Die Route fehlt: PocketBase antwortet mit seinem eigenen 404 ohne "fehler"
  if (status === 404 && !d.fehler) {
    return { ok: false, text: 'Die Server-Erweiterung fehlt: willkommen.pb.js, willkommen-mail.js und willkommen-schrift.js liegen nicht im Ordner pb_hooks von PocketBase — oder PocketBase wurde danach nicht neu gestartet. Solange gehen keine Willkommens-E-Mails raus.' }
  }
  if (status === 502) {
    const smtp = d.smtp === false
      ? ' In PocketBase ist kein SMTP-Server eingetragen (Settings → Mail settings) — ohne ihn geht keine E-Mail raus, auch keine Codes für die Anmeldung.'
      : ' Prüfe in PocketBase unter Settings → Mail settings den SMTP-Server (dort gibt es auch „Send test email“).'
    return { ok: false, text: `Der Mailversand ist fehlgeschlagen: ${d.fehler || 'unbekannter Fehler'}.${smtp}` }
  }
  if (status === 401) return { ok: false, text: 'Bitte melde dich neu an.' }
  if (!status) return { ok: false, text: 'Keine Verbindung zum Server.' }
  return { ok: false, text: d.fehler || d.message || `Nicht gesendet (Fehler ${status}).` }
}

/** Sendet die Willkommens-E-Mail an einen Benutzer — ohne userId an sich selbst (Probe). */
export async function willkommenSenden(userId?: string): Promise<WillkommenErgebnis> {
  try {
    const a = await pb.send('/willkommen/senden', { method: 'POST', body: userId ? { userId } : {}, requestKey: null }) as Antwort
    return willkommenErgebnis(200, a)
  } catch (e: any) {
    return willkommenErgebnis(e?.status, e?.response)
  }
}
