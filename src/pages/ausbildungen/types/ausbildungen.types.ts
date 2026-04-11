// ============================================
// CORE INTERFACES (aus PocketBase Collections)
// ============================================

export interface Termin {
  id: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
  max_teilnehmer: number
  status: 'geplant' | 'laufend' | 'abgeschlossen' | 'abgesagt'
  organization_id: string
  created: string
  updated: string
}

export interface Teilnehmer {
  id: string
  vorname: string
  nachname: string
  email: string
  telefon: string
  whatsapp: string
  notizen: string
  lernbar_zugang_aktiv: boolean
  lernbar_email: string
  lernbar_passwort: string
  organization_id: string
  created: string
}

export interface TerminTeilnehmer {
  id: string
  termin_id: string
  teilnehmer_id: string
  status: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt'
  eingeladen_am: string
  eingeladen_via: 'email' | 'whatsapp' | 'persönlich' | 'telefon'
  anwesend: boolean
  notizen: string
  organization_id: string
  expand?: {
    teilnehmer_id?: Teilnehmer
  }
}

export interface Dokument {
  id: string
  termin_id: string
  name: string
  typ: 'dozent' | 'teilnehmer'
  datei?: string
  oder_dateien_id?: string
  beschreibung: string
  organization_id: string
  created: string
}

export interface Modul {
  id: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
  organization_id: string
  created: string
}

export interface ModulInhalt {
  typ: 'text' | 'video' | 'quiz' | 'datei'
  titel: string
  inhalt: string
  reihenfolge: number
}

export interface ModulTermin {
  id: string
  modul_id: string
  termin_id: string
  pflicht: boolean
  frist_datum: string
  organization_id: string
  expand?: {
    modul_id?: Modul
  }
}

export interface ModulProgress {
  id: string
  modul_id: string
  teilnehmer_id: string
  termin_id?: string
  fortschritt_prozent: number
  gestartet_am?: string
  abgeschlossen_am?: string
  notizen: string
  organization_id: string
}

// ============================================
// FORM INTERFACES (für UI State)
// ============================================

export interface TerminForm {
  id?: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
  max_teilnehmer: number
  status: 'geplant' | 'laufend' | 'abgeschlossen' | 'abgesagt'
}

export interface TeilnehmerForm {
  id?: string
  vorname: string
  nachname: string
  email: string
  telefon: string
  whatsapp: string
  notizen: string
  lernbar_zugang_aktiv: boolean
}

export interface ModulForm {
  id?: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
}

// ============================================
// UI STATE TYPES
// ============================================

export type ViewMode = 'termine' | 'teilnehmer' | 'module'
export type StatusFilter = 'all' | 'geplant' | 'laufend' | 'abgeschlossen'
export type TerminTab = 'uebersicht' | 'teilnehmer' | 'dokumente' | 'module'
export type MessageType = 'success' | 'error'

export interface Message {
  text: string
  type: MessageType
}

export interface Stats {
  termine_gesamt: number
  termine_geplant: number
  termine_laufend: number
  teilnehmer_gesamt: number
  teilnehmer_lernbar: number
  module_gesamt: number
}
