import type { App } from '../types'

export const ALL_APPS: Record<string, App> = {
  einsaetze:    { id: 'einsaetze',    name: 'Einsätze',      icon: 'siren',      url: '/einsaetze.html',           permission: 'einsaetze',           color: 'linear-gradient(135deg, #ff3b30, #c03026)' },
  patienten:    { id: 'patienten',    name: 'Patienten',     icon: 'clipboard',  url: '/patienten',                 permission: 'patienten',           color: 'linear-gradient(135deg, #007aff, #0062cc)', isInternal: true },
  dokumente:    { id: 'dokumente',    name: 'Vorgänge',      icon: 'file',       url: '/dokumente-bearbeiten.html', permission: 'dokumente',           color: 'linear-gradient(135deg, #af52de, #8e40b8)' },
  lager:        { id: 'lager',        name: 'Lager',         icon: 'package',    url: '/lager',                     permission: 'lager',               color: 'linear-gradient(135deg, #ff9500, #cc7800)', isInternal: true },
  dateien:      { id: 'dateien',      name: 'Dateien',       icon: 'folder',     url: '/files',                     permission: 'dateien',             color: 'linear-gradient(135deg, #ff9f0a, #cc8000)', isInternal: true },
  qr:           { id: 'qr',           name: 'QR-Codes',      icon: 'qrcode',     url: '/qr-code-generator.html',    permission: 'qr',                  color: 'linear-gradient(135deg, #32ade6, #2591c4)' },
  lernbar:      { id: 'lernbar',      name: 'Unitas',        icon: 'graduation', url: '/unitas',                    permission: 'lernbar',             color: 'linear-gradient(135deg, #5856d6, #4240b0)', isInternal: true },
  ausbildungen: { id: 'ausbildungen', name: 'Ausbildungen',  icon: 'book',       url: '/ausbildungen',              permission: 'ausbildungen_manage', color: 'linear-gradient(135deg, #1c7cd6, #1560a8)', isInternal: true },
  unitarii:     { id: 'unitarii',     name: 'Unitarii',      icon: 'users',      url: '/unitarii',                  permission: 'unitarii',            color: 'linear-gradient(135deg, #636e8a, #4a5370)', isInternal: true },
  mpg:          { id: 'mpg',          name: 'MPG',           icon: 'mpg',        url: '/mpg',                       permission: 'dashboard',           color: 'linear-gradient(135deg, #c0392b, #962d22)', isInternal: true },
  chat:         { id: 'chat',         name: 'Chat',          icon: 'chat',       url: '/chat',                      permission: 'chat',                color: 'linear-gradient(135deg, #34c759, #27a447)', isInternal: true },
  settings:     { id: 'settings',     name: 'Einstellungen', icon: 'settings',   url: '#settings',                  permission: 'dashboard',           color: 'linear-gradient(135deg, #8e8e93, #6c6c72)', isInternal: true },
}

export const ROLES: Record<string, { permissions: Record<string, boolean> }> = {
  mpg:       { permissions: { dashboard: true, einsaetze: true, lager: true, produktausgabe: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, qr: true, chat: true, unitarii: true } },
  lager:     { permissions: { dashboard: true, lager: true, produktausgabe: true, dateien: true, qr: true, chat: true } },
  ausbildung:{ permissions: { dashboard: true, einsaetze: true, lernbar: true, ausbildungen_manage: true, patienten: true, dateien: true, qr: true, chat: true } },
  qm:        { permissions: { dashboard: true, dokumente: true, dateien: true, qr: true, chat: true } },
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
