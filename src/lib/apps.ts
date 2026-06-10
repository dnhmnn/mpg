import type { App } from '../types'

export const ALL_APPS: Record<string, App> = {
  einsaetze:    { id: 'einsaetze',    name: 'Einsätze',      icon: 'siren',      url: '/einsaetze',                permission: 'einsaetze',           color: '#600812' },
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
  settings:     { id: 'settings',     name: 'Einstellungen', icon: 'settings',   url: '#settings',                  permission: 'dashboard',           color: '#8a7a68', isInternal: true },
}

export const ROLES: Record<string, { permissions: Record<string, boolean> }> = {
  mpg:       { permissions: { dashboard: true, einsaetze: true, lager: true, produktausgabe: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, chat: true, unitarii: true } },
  lager:     { permissions: { dashboard: true, lager: true, produktausgabe: true, dateien: true, chat: true } },
  ausbildung:{ permissions: { dashboard: true, einsaetze: true, lernbar: true, ausbildungen_manage: true, patienten: true, dateien: true, chat: true } },
  qm:        { permissions: { dashboard: true, dokumente: true, dateien: true, chat: true } },
  benutzer:  { permissions: { dashboard: true, lernbar: true, chat: true } },
}

export const DEFAULT_DOCK_PINS = ['einsaetze', 'patienten', 'ausbildungen', 'mpg']
export const MAX_DOCK_PINS = 6
export const MAX_DOCK_RECENT = 5

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
