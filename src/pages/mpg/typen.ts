// Datensätze des MPG-Moduls (PocketBase-Collections mpg_*) und feste Vorgaben.

import type { Aenderung, EreignisArt } from '../../lib/mpg/aktionen'
import type { Intervall } from '../../lib/mpg/fristen'
import type { Pruefpunkt } from '../../lib/mpg/pruefung'

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type DefectStatus = 'open' | 'in_progress' | 'resolved'
export type ExternalReportStatus = 'pending' | 'confirmed' | 'rejected'

export interface Device {
  id: string
  name: string
  type: string
  serial_number: string
  location: string
  interval: Intervall
  last_inspection?: string
  last_inspection_passed?: boolean
  next_inspection_due: string
  organization_id: string
  created: string
  /** Serverzeit der letzten Änderung — zeigt, ob sich ein Gerät seit einem Versuch geändert hat */
  updated?: string
  operational?: boolean
  has_stk?: boolean
  last_stk?: string
  stk_interval_months?: number
  has_mtk?: boolean
  last_mtk?: string
  mtk_interval_months?: number
  /** Außerbetriebnahme (Paket 3) — fehlen in PocketBase, solange die Felder nicht angelegt sind */
  ausser_betrieb?: string
  ausser_betrieb_grund?: string
  verbleib?: string
}

/** Ein Eintrag im Gerätebuch (mpg_ereignisse) — wird nur angefügt, nie geändert. */
export interface Ereignis {
  id: string
  device_id: string
  device_name: string
  art: EreignisArt
  text: string
  aenderungen?: Aenderung[] | null
  bezug: string
  user_name: string
  created: string
}

export interface Inspection {
  id: string
  device_id: string
  device_name: string
  device_type: string
  user_name: string
  inspection_date: string
  passed: boolean
  notes: string
  checklist_results: Pruefpunkt[]
}

export interface Checklist {
  id?: string
  device_type: string
  items: string[]
  organization_id?: string
}

export interface Defect {
  id: string
  device_id: string
  device_name: string
  reported_by: string
  description: string
  severity: Severity
  status: DefectStatus
  resolved_by?: string
  resolved_notes?: string
  organization_id: string
  created: string
  updated?: string
}

export interface ExternalReport {
  id: string
  device_id: string
  device_name: string
  organization_id: string
  reporter_name?: string
  description: string
  severity: Severity
  status: ExternalReportStatus
  rejected_reason?: string
  created: string
}

export const DEVICE_TYPES = ['AED', 'BZ-Gerät', 'Absaugpumpe', 'Beatmungsgerät', 'Sauerstoffgerät', 'Pulsoximeter', 'Blutdruckmessgerät', 'Defibrillator', 'Sonstiges']

export const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  'AED': ['Gerät auf äußere Beschädigungen prüfen', 'Status-Anzeige kontrollieren (OK-Symbol)', 'Batterie-Anzeige kontrollieren', 'Elektroden Verfallsdatum prüfen', 'Elektroden auf Beschädigungen prüfen', 'Selbsttest-Funktion überprüfen', 'Zubehör vollständig (Schere, Rasierer, Handschuhe)', 'Standort und Beschilderung kontrollieren'],
  'BZ-Gerät': ['Gerät auf äußere Beschädigungen prüfen', 'Batteriestand kontrollieren', 'Display-Funktion testen', 'Teststreifen Verfallsdatum prüfen', 'Kontrolllösung Verfallsdatum prüfen', 'Funktionstest mit Kontrolllösung durchführen', 'Stechhilfe auf Funktion prüfen', 'Ausreichend Lanzetten vorhanden'],
  'Absaugpumpe': ['Gerät auf äußere Beschädigungen prüfen', 'Stromversorgung/Akkustand kontrollieren', 'Saugschlauch auf Risse und Beschädigungen prüfen', 'Saugkraft testen (Handfläche)', 'Auffangbehälter leer und sauber', 'Auffangbehälter auf Dichtigkeit prüfen', 'Filter kontrollieren und ggf. wechseln', 'Einwegmaterial vollständig und steril'],
  'Sonstiges': ['Sichtprüfung auf Beschädigungen', 'Funktionsprüfung durchführen', 'Zubehör und Verbrauchsmaterial prüfen', 'Reinigung und Desinfektion durchgeführt'],
}

export const SCHWERE_NAME: Record<Severity, string> = {
  low: 'Gering', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch',
}

/** Eine begonnene Prüfung, wie sie auf dem Gerät liegt (localStorage, je Person). */
export interface PruefStand {
  device_id: string
  items: string[]
  results: Pruefpunkt[]
  notes: string
  ids: { pruefung: string; defekt: string }
  /** Gesendet, Ausgang unklar: nur noch genau dieser Stand wird erneut gesendet */
  versucht?: { ergebnis: 'bestanden' | 'mangel' | 'nicht_bestanden'; zeit: string }
}

/** Standort-Text als Schlüssel einer Prüfrunde (Groß-/Kleinschreibung egal); leer → OHNE_STANDORT. */
export const OHNE_STANDORT = '—'
export function standortSchluessel(location: string | null | undefined): string {
  return (location || '').trim().toLowerCase() || OHNE_STANDORT
}

/** Adresse einer Prüfrunde — der Schlüssel wird kodiert, useParams liefert ihn wieder dekodiert */
export const rundenPfad = (schluessel: string) => `/mpg/runde/${encodeURIComponent(schluessel)}`
