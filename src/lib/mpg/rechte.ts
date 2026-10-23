// Wer im MPG was darf — wie im Lager: nur Gefährliches schützen.
//
// Prüfen, Mängel melden, Geräte sperren, geringe Mängel beheben, Vermerke ins
// Gerätebuch schreiben und alles lesen darf jede Person mit Zugang zum MPG.
// Das Recht „MPG verwalten“ braucht es für alles, was ein Gerät freigibt oder den
// Bestand ändert: Geräte anlegen, ändern, außer Betrieb nehmen oder löschen,
// Prüfvorlagen, Freigeben (auch das Beheben eines sperrenden Defekts — es hebt die
// Sperre auf) und Meldungen von außen bestätigen oder ablehnen.
// Admin, MPG-Beauftragte und Supervisor haben es automatisch.
//
// Die App blendet nur aus — durchgesetzt wird es in den API-Regeln von PocketBase
// (docs/pocketbase-regeln.md, Abschnitt „MPG: API-Regeln“).
//
// Prüffälle: src/lib/__tests__/mpgRechte.test.ts

import type { User } from '../../types'
import { hatRecht } from '../apps'
import { sperrtDefekt } from './zustand'

/** Rollen, die „MPG verwalten“ ohne eigenes Häkchen haben */
export const MPG_VERWALTER_ROLLEN = ['admin', 'mpg'] as const

export function darfMpgVerwalten(user: User | null | undefined, jetzt = Date.now()): boolean {
  if (!user) return false
  if (user.supervisor) return true
  if ((MPG_VERWALTER_ROLLEN as readonly string[]).includes(user.role || '')) return true
  return hatRecht(user, 'mpg_verwalten', jetzt)
}

/** Einen Defekt schließen: geringe und mittlere jeder, sperrende nur mit „MPG verwalten“. */
export function darfBeheben(user: User | null | undefined, schwere: string | null | undefined, jetzt = Date.now()): boolean {
  return !!user && (!sperrtDefekt(schwere) || darfMpgVerwalten(user, jetzt))
}
