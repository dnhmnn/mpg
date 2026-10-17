import type { App, User } from '../types'
import { appFrei, rechtFrei } from './freigabe'

export const ALL_APPS: Record<string, App> = {
  einsaetze:    { id: 'einsaetze',    name: 'Einsätze',      icon: 'siren',      url: '/einsaetze',                permission: 'einsaetze',           color: '#600812' },
  eks:          { id: 'eks',          name: 'EKS',           icon: 'eks',        url: '/eks',                       permission: 'eks',                 color: '#3d0408', isInternal: true },
  patienten:    { id: 'patienten',    name: 'Patienten',     icon: 'clipboard',  url: '/patienten',                 permission: 'patienten',           color: '#600812', isInternal: true },
  dokumente:    { id: 'dokumente',    name: 'Vorgänge',      icon: 'file',       url: '/dokumente-bearbeiten.html', permission: 'dokumente',           color: '#7a1020' },
  lager:        { id: 'lager',        name: 'Lager',         icon: 'package',    url: '/lager',                     permission: 'lager',               color: '#5c3800', isInternal: true },
  dateien:      { id: 'dateien',      name: 'Dateien',       icon: 'folder',     url: '/files',                     permission: 'dateien',             color: '#8a7a68', isInternal: true },
  office:       { id: 'office',       name: 'Schreibstube',  icon: 'file-text',  url: '/office',                    permission: 'dateien',             color: '#1e3a8a', isInternal: true },
  lernbar:      { id: 'lernbar',      name: 'Unitas',        icon: 'graduation', url: '/unitas',                    permission: 'lernbar',             color: '#600812', isInternal: true },
  ausbildungen: { id: 'ausbildungen', name: 'Ausbildungen',  icon: 'book',       url: '/ausbildungen',              permission: 'ausbildungen_manage', color: '#7a1020', isInternal: true },
  unitarii:     { id: 'unitarii',     name: 'Benutzer',      icon: 'users',      url: '/unitarii',                  permission: 'unitarii',            color: '#3d0408', isInternal: true },
  mpg:          { id: 'mpg',          name: 'MPG',           icon: 'mpg',        url: '/mpg',                       permission: 'dashboard',           color: '#600812', isInternal: true },
  chat:         { id: 'chat',         name: 'Chat',          icon: 'chat',       url: '/chat',                      permission: 'chat',                color: '#3d5c6e', isInternal: true },
  notizen:      { id: 'notizen',      name: 'Notizen',       icon: 'note',       url: '/notizen',                   permission: 'notizen',             color: '#5c3800', isInternal: true },
  settings:     { id: 'settings',     name: 'Einstellungen', icon: 'settings',   url: '#settings',                  permission: 'dashboard',           color: '#8a7a68', isInternal: true },
}

// Icon-Fläche eines Moduls: die tiefen Rot- und Brauntöne laufen über Tokens,
// damit sie im Dunkelmodus heller werden (globals.css, --lbf-kachel-*).
const KACHEL_TOKEN: Record<string, string> = {
  '#600812': 'var(--lbf-kachel-rot)',
  '#3d0408': 'var(--lbf-kachel-tief)',
  '#7a1020': 'var(--lbf-kachel-wein)',
  '#5c3800': 'var(--lbf-kachel-braun)',
}
export function kachelFarbe(farbe: string): string {
  return KACHEL_TOKEN[farbe.toLowerCase()] ?? farbe
}

/**
 * Darf der Nutzer ein Modul nutzen? Supervisor immer; sonst das Recht selbst
 * oder ein befristetes, das noch läuft. Dieselbe Regel wie die Kacheln im Hub.
 */
export function hatRecht(user: User | null | undefined, recht: string, jetzt = Date.now()): boolean {
  if (!user) return false
  if (user.supervisor) return true
  if (user.permissions?.[recht]) return true
  const bis = user.temp_permissions?.[recht]?.until
  return !!bis && new Date(bis).getTime() > jetzt
}

// Vorlagen zur Vorbefüllung der individuellen Rechte beim Anlegen/Ändern eines Benutzers.
// Werden NICHT mehr für Laufzeit-Zugriffsprüfungen verwendet — einzig user.permissions
// (+ supervisor + temp_permissions) entscheidet über den Zugriff (siehe hasPermission in Hub.tsx).
export const ROLES: Record<string, { permissions: Record<string, boolean> }> = {
  // Verwalter: alle Rechte samt Benutzerverwaltung. Rechte gesperrter Module wirken erst, wenn das Modul frei ist.
  admin:     { permissions: { dashboard: true, einsaetze: true, eks: true, lager: true, lager_verwalten: true, produktausgabe: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, qr: true, chat: true, unitarii: true, notizen: true } },
  // Normale Benutzer: Unitas, Chat, Notizen, Einstellungen
  benutzer:  { permissions: { dashboard: true, lernbar: true, chat: true, notizen: true } },
  mpg:       { permissions: { dashboard: true, einsaetze: true, lager: true, lager_verwalten: true, produktausgabe: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, chat: true, unitarii: true, notizen: true } },
  lager:     { permissions: { dashboard: true, lager: true, lager_verwalten: true, produktausgabe: true, dateien: true, chat: true } },
  ausbildung:{ permissions: { dashboard: true, einsaetze: true, lernbar: true, ausbildungen_manage: true, patienten: true, dateien: true, chat: true } },
  qm:        { permissions: { dashboard: true, dokumente: true, dateien: true, chat: true } },
}

/**
 * Die Rollen beim Anlegen: Admin und Benutzer für den üblichen Fall, die
 * Fachrollen als Vorlage für Spezialfälle, Teilnehmer für die Ausbildungen.
 */
export const ROLLEN: { id: string; name: string; hinweis: string }[] = [
  { id: 'admin',      name: 'Admin',                     hinweis: 'Verwalter: alle Rechte der freigeschalteten Module, dazu die Benutzerverwaltung.' },
  { id: 'benutzer',   name: 'Benutzer',                  hinweis: 'Normale Rechte: Unitas, Chat, Notizen und Einstellungen.' },
  { id: 'mpg',        name: 'MPG-Beauftragter',          hinweis: 'Fachrolle: MPG, Lager, Patienten, Vorgänge, Ausbildungen und Benutzerverwaltung.' },
  { id: 'lager',      name: 'Lagerwart',                 hinweis: 'Fachrolle: Lager mit Produktausgabe, Dateien, Chat.' },
  { id: 'ausbildung', name: 'Ausbilder',                 hinweis: 'Fachrolle: Ausbildungen, Unitas, Einsätze, Patienten.' },
  { id: 'qm',         name: 'Qualitätsmanagement',       hinweis: 'Fachrolle: Vorgänge und CIRS, Dateien.' },
  { id: 'teilnehmer', name: 'Teilnehmer (Ausbildungen)', hinweis: 'Für die Ausbildungen, ohne eigene Rechte.' },
]

export function rollenName(id: string | undefined): string {
  return ROLLEN.find(r => r.id === id)?.name ?? (id || 'Benutzer')
}

export const DEFAULT_DOCK_PINS = ['einsaetze', 'patienten', 'ausbildungen', 'mpg']
export const MAX_DOCK_PINS = 6
export const MAX_DOCK_RECENT = 5

export const PERM_LABELS: { key: string; label: string }[] = [
  { key: 'lernbar',            label: 'Unitas' },
  { key: 'patienten',          label: 'Patienten' },
  { key: 'einsaetze',          label: 'Einsätze' },
  { key: 'eks',                label: 'Einsatzführung (EKS)' },
  { key: 'dokumente',          label: 'Vorgänge' },
  { key: 'lager',              label: 'Lager' },
  { key: 'lager_verwalten',    label: 'Lager verwalten' },
  { key: 'dateien',            label: 'Dateien' },
  { key: 'qr',                 label: 'QR-Codes' },
  { key: 'ausbildungen_manage',label: 'Ausbildungen' },
  { key: 'unitarii',           label: 'Benutzerverwaltung' },
  { key: 'dashboard',          label: 'MPG-Dashboard' },
  { key: 'chat',               label: 'Chat' },
  { key: 'notizen',            label: 'Notizen' },
]

/**
 * Die Rechte, die in dieser Organisation vergeben werden können — nur die
 * freigeschalteter Module, mit Namen, die sagen, was sie öffnen.
 * Schon vergebene Rechte gesperrter Module bleiben am Benutzer stehen.
 */
export function vergebbareRechte(org: unknown): { key: string; label: string }[] {
  return PERM_LABELS
    .filter(p => rechtFrei(org, p.key))
    .map(p => {
      // "dashboard" öffnet MPG und die Einstellungen — der Name sagt, was davon freigeschaltet ist
      if (p.key === 'dashboard') return { ...p, label: appFrei(org, 'mpg') ? 'MPG & Einstellungen' : 'Einstellungen' }
      // "dateien" öffnet auch die Schreibstube
      if (p.key === 'dateien') return { ...p, label: 'Dateien & Schreibstube' }
      return p
    })
}

export const EMPTY_PERMS = Object.fromEntries(PERM_LABELS.map(p => [p.key, false])) as Record<string, boolean>

// Erkennt automatisch generierte Platzhalter-E-Mails (z.B. für Teilnehmer ohne eigenen Account),
// die nicht als "echte" Kontakt-E-Mail angezeigt werden sollen.
export function isPlaceholderEmail(email?: string): boolean {
  return !!email && email.endsWith('@kein-email.intern')
}

// Liefert die Rechte-Vorlage für eine Rolle: organisationsspezifische Anpassung
// (organizations.role_permissions) falls vorhanden, sonst die globale ROLES-Vorlage.
export function getRoleTemplate(role: string, org?: { role_permissions?: Record<string, Record<string, boolean>> } | null): Record<string, boolean> {
  return org?.role_permissions?.[role] ?? ROLES[role]?.permissions ?? {}
}

export function getDockPins(userId: string): string[] {
  try {
    const saved = localStorage.getItem(`dock_pins_${userId}`)
    if (saved) return JSON.parse(saved)
  } catch {}
  return [...DEFAULT_DOCK_PINS]
}

export function setDockPins(userId: string, pins: string[]) {
  localStorage.setItem(`dock_pins_${userId}`, JSON.stringify(pins))
}
