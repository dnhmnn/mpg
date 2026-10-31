// Mitgliedersuche der öffentlichen Formulare (ohne Anmeldung, über den Org-Code).
// Fragt nur Kennung und Name ab, nie E-Mail, Rolle oder Rechte, und bindet die
// Eingabe über pb.filter ein: Anführungszeichen oder Filter-Syntax im Suchfeld
// können die Suche nicht auf andere Organisationen ausweiten.
import { pb } from '../../lib/pocketbase'

export type Mitglied = { id: string; name: string }

export const MIN_ZEICHEN = 2

/** Suchtext ohne % und _ — die wirken in PocketBase als Platzhalter („%%“ fände alle). */
export function suchtext(frage: string): string {
  return frage.replace(/[%_]/g, '').trim()
}

/** Höchstens 8 Treffer der eigenen Organisation; [] unter MIN_ZEICHEN. */
export async function mitgliederSuchen(orgId: string, frage: string): Promise<Mitglied[]> {
  const q = suchtext(frage)
  if (!orgId || q.length < MIN_ZEICHEN) return []
  const res = await pb.collection('users').getList(1, 8, {
    filter: pb.filter('organization_id = {:org} && name ~ {:q}', { org: orgId, q }),
    fields: 'id,name',
    sort: 'name',
  })
  return res.items.map(u => ({ id: u.id, name: String(u.name ?? '') }))
}

/**
 * Eine Suche je Eingabefeld. Das SDK bricht ältere Anfragen nicht ab (die
 * automatische Abbrechung ist in lib/pocketbase.ts aus), also zählt sie mit:
 * Nur die Antwort der neuesten Suche kommt an. Ist inzwischen neu gesucht oder
 * abgebrochen worden (Feld geleert, Seite verlassen), liefert suchen null —
 * auch statt eines Fehlers. Dann nichts tun.
 */
export function neueSuche() {
  let nr = 0
  return {
    async suchen(orgId: string, frage: string): Promise<Mitglied[] | null> {
      const meine = ++nr
      try {
        const treffer = await mitgliederSuchen(orgId, frage)
        return meine === nr ? treffer : null
      } catch (e) {
        if (meine !== nr) return null
        throw e
      }
    },
    abbrechen() { nr++ },
  }
}
