// Was jede Seite der Benutzerverwaltung von der Hauptseite (Unitarii.tsx) bekommt.

import type { User } from '../../types'
import type { Verknuepfungen } from '../../lib/verknuepfung'
import type { Recht, UUser } from './logik'

export interface BvKontext {
  user: User
  /** Die Organisation frisch geladen — bis dahin die vom Login */
  org: unknown
  /** Nur die frisch geladene; null, solange sie fehlt (etwa ohne Netz) */
  orgFrisch: Record<string, unknown> | null
  orgName: string
  /** vergebbareRechte(org): nur Rechte freigeschalteter Module */
  rechte: Recht[]
  orgVerkn: Verknuepfungen
  orgRolePerms: Record<string, Record<string, boolean>>
  users: UUser[]
  showMsg: (text: string, type?: 'success' | 'error') => void
  loadUsers: () => Promise<void>
  setOrgFrisch: (o: Record<string, unknown>) => void
  setOrgRolePerms: (rp: Record<string, Record<string, boolean>>) => void
  /** Zurück zur Liste */
  schliessen: () => void
}
