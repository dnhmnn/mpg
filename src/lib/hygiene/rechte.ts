// Wer in der Hygiene was darf (Owner, 23.11.2026): Eintragen jede Person mit Zugang (Grundrecht
// „dashboard“, wie Geräte prüfen im MPG), Einrichten (Objekte, Intervalle, Checklisten) nur mit
// „Hygiene verwalten“. Leitung und Supervisor immer. Teilnehmende nie.
// Die App blendet nur aus — durchgesetzt wird es in den API-Regeln (docs/pocketbase-regeln.md,
// „Hygiene: API-Regeln“).

import type { User } from '../../types'
import { hatRecht } from '../apps'

export function darfHygiene(user: User | null | undefined, jetzt = Date.now()): boolean {
  if (!user || user.role === 'teilnehmer') return false
  return hatRecht(user, 'dashboard', jetzt)
}

export function darfHygieneVerwalten(user: User | null | undefined, jetzt = Date.now()): boolean {
  if (!user || user.role === 'teilnehmer') return false
  if (user.supervisor || user.role === 'admin') return true
  return hatRecht(user, 'hygiene_verwalten', jetzt)
}
