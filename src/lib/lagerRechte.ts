// Wer im Lager was darf.
//
// „Nur Gefährliches schützen“: Buchen, Artikel und Stammdaten pflegen und bestellen
// darf jede Person mit dem Recht „Lager“. Das Recht „Lager verwalten“ braucht es nur
// für das, was Daten verschwinden lässt oder für alle ändert: Artikel und Standorte
// archivieren oder löschen, Einstellungen, „Statistik ab Datum“ und das Stornieren
// fremder Buchungen. Admin, Lagerwart und MPG-Beauftragte haben es automatisch.
//
// Die App blendet nur aus — durchgesetzt wird es in den API-Regeln von PocketBase
// (docs/pocketbase-regeln.md, Abschnitt „Lager: API-Regeln“).

import type { User } from '../types'
import { hatRecht } from './apps'

/** Rollen, die „Lager verwalten“ ohne eigenes Häkchen haben */
export const VERWALTER_ROLLEN = ['admin', 'lager', 'mpg'] as const

export function darfLager(user: User | null | undefined, jetzt = Date.now()): boolean {
  return hatRecht(user, 'lager', jetzt)
}

export function darfLagerVerwalten(user: User | null | undefined, jetzt = Date.now()): boolean {
  if (!user) return false
  if (user.supervisor) return true
  if ((VERWALTER_ROLLEN as readonly string[]).includes(user.role || '')) return true
  return hatRecht(user, 'lager_verwalten', jetzt)
}

/** Eigene Buchungen darf man am selben Tag noch selbst stornieren; fremde nur mit „Lager verwalten“. */
export const EIGENE_STORNO_FRIST_MS = 24 * 3600_000

export function darfStornieren(
  user: User | null | undefined,
  buchung: { user?: string | null; zeit: string },
  jetzt = Date.now(),
): boolean {
  if (!user || !darfLager(user, jetzt)) return false
  if (darfLagerVerwalten(user, jetzt)) return true
  const wer = (buchung.user || '').toLowerCase()
  const eigen = !!wer && (wer === (user.email || '').toLowerCase() || wer === user.id.toLowerCase())
  if (!eigen) return false
  const t = new Date(buchung.zeit.replace(' ', 'T')).getTime()
  return Number.isFinite(t) && jetzt - t < EIGENE_STORNO_FRIST_MS
}
