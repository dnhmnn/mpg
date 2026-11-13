// Laden für die Liste „Eigene Formulare“ und die Seite einer Vorlage (Bauplan Vorgänge 3.7).
//
// form_templates ist öffentlich lesbar; jede Abfrage filtert trotzdem nach der Organisation.
// form_submissions liest nur, wer das Recht Vorgänge in derselben Organisation hat: Ohne Recht
// antwortet PocketBase mit 403, fehlt das Feld `status` (vor Owner-Schritt 6) mit 400. Beides
// fangen die Zählungen still ab (keine Zahl). Abfragen auf form_submissions tragen frisch=1,
// damit der Service Worker sie nicht zwischenspeichert (NetworkOnly in vite.config.ts).

import { pb } from '../../../lib/pocketbase'

type Rec = Record<string, unknown>

/** Neu ist, was den Status `neu` hat oder (vor dem Feld) keinen. */
export const NEU_FILTER = '(status = "neu" || status = "")'

const FRISCH = { frisch: '1' }

/** Alle Vorlagen der Organisation, nach Titel (archivierte mit). */
export async function vorlagenLaden(orgId: string): Promise<Rec[]> {
  const liste = await pb.collection('form_templates').getFullList({
    filter: pb.filter('organization_id = {:o}', { o: orgId }), batch: 200, requestKey: null,
  }) as unknown as Rec[]
  return liste.slice().sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'de', { sensitivity: 'base' }))
}

/** Neue Einsendungen je Vorlage; ohne Recht, ohne Feld `status` oder ohne Netz null. */
export async function neueJeVorlage(orgId: string): Promise<Record<string, number> | null> {
  try {
    const liste = await pb.collection('form_submissions').getFullList({
      filter: `${pb.filter('organization_id = {:o}', { o: orgId })} && ${NEU_FILTER}`,
      fields: 'id,template_id', batch: 500, requestKey: null, query: FRISCH,
    }) as unknown as Rec[]
    const n: Record<string, number> = {}
    for (const r of liste) {
      const t = String(r.template_id ?? '')
      if (t) n[t] = (n[t] ?? 0) + 1
    }
    return n
  } catch {
    return null
  }
}

/** Einsendungen einer Vorlage: insgesamt und neu; was sich nicht zählen lässt, ist null. */
export async function einsendungenZaehlen(orgId: string, vorlage: string): Promise<{ gesamt: number | null; neu: number | null }> {
  const basis = pb.filter('organization_id = {:o} && template_id = {:t}', { o: orgId, t: vorlage })
  const zaehle = (filter: string) => pb.collection('form_submissions')
    .getList(1, 1, { filter, fields: 'id', requestKey: null, query: FRISCH })
    .then((r) => r.totalItems)
    .catch(() => null)
  const [gesamt, neu] = await Promise.all([zaehle(basis), zaehle(`${basis} && ${NEU_FILTER}`)])
  return { gesamt, neu }
}
