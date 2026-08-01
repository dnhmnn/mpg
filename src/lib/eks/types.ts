// Responda EKS — Datentypen des Einsatzführungs-Moduls.
// Alles ereignisbasiert: Zustand entsteht aus dem Log (siehe reducer.ts).

export type EksEventType =
  | 'etb.entry' | 'etb.correct'
  | 'einsatz.patch'
  | 'abschnitt.set' | 'abschnitt.remove'
  | 'kraft.set' | 'kraft.status' | 'kraft.remove'
  | 'as.trupp.anmelden' | 'as.trupp.einsatzbeginn' | 'as.trupp.ziel_erreicht'
  | 'as.messung' | 'as.trupp.patch' | 'as.trupp.rueckzug_angeordnet'
  | 'as.trupp.abgemeldet' | 'as.mayday' | 'as.alarm.quittiert'
  | 'as.ueberwachung.luecke' | 'as.config'
  | 'karte.zeichen.set' | 'karte.zeichen.remove'
  | 'system.disclaimer' | 'system.zeitkorrektur' | 'system.papier'

export interface EksEvent {
  id: string                 // 15× [a-z0-9] — zugleich PocketBase-ID
  einsatz_id: string
  organization_id: string
  seq: string                // Hybrid Logical Clock, lexikographisch sortierbar
  device_id: string
  actor_user?: string
  actor_name: string
  type: EksEventType
  payload: any
  client_ts: string          // rohe Gerätezeit (ISO)
  client_offset_ms: number | null  // null = Uhr nie mit Server abgeglichen
  prev_hash?: string
  hash?: string
  schema_v?: number
}

export interface Flasche { anzahl: number; liter: number; nenndruck: number }

export interface TruppMitglied {
  person_id: string
  name: string
  flasche: Flasche
  anfangsdruck: number
}

export interface Messung { t: string; druck: number; quelle?: 'funk' | 'geschaetzt' }

export type TruppStatus = 'angemeldet' | 'unter_pa' | 'am_ziel' | 'rueckweg' | 'abgemeldet'

export interface AtemschutzTrupp {
  id: string
  name: string
  typ: 'angriff' | 'sicherheit' | 'wasser' | 'sonstiges'
  funkrufname?: string
  auftrag?: string
  abschnitt_id?: string
  mitglieder: TruppMitglied[]
  status: TruppStatus
  t_unter_pa?: string
  t_ziel?: string
  t_ende?: string
  /** Druckverlauf je Person: person_id -> Messungen (chronologisch) */
  messungen: Record<string, Messung[]>
  ziel_druecke?: Record<string, number>
  rueckzug_grund?: string
  mayday?: string
  owner_device?: string
  quittiert: Record<string, string>  // alarm_key -> ISO-Zeit
}

export const FMS: Record<number, { kurz: string; lang: string; farbe: string }> = {
  1: { kurz: '1', lang: 'Einsatzbereit über Funk', farbe: '#16a34a' },
  2: { kurz: '2', lang: 'Einsatzbereit auf Wache', farbe: '#16a34a' },
  3: { kurz: '3', lang: 'Anfahrt Einsatzort', farbe: '#d97706' },
  4: { kurz: '4', lang: 'Ankunft Einsatzstelle', farbe: '#600812' },
  5: { kurz: '5', lang: 'Sprechwunsch', farbe: '#2563eb' },
  6: { kurz: '6', lang: 'Nicht einsatzbereit', farbe: '#8a7a68' },
  7: { kurz: '7', lang: 'Patient aufgenommen', farbe: '#600812' },
  8: { kurz: '8', lang: 'Am Transportziel', farbe: '#600812' },
}

export interface Kraft {
  id: string
  funkrufname: string
  typ?: string
  fms_status: number
  besatzung?: number
  abschnitt_id?: string
  bemerkung?: string
  entfernt?: boolean
}

export interface Abschnitt {
  id: string
  name: string
  leiter?: string
  funkkanal?: string
  farbe?: string
  entfernt?: boolean
}

export interface EtbEntry {
  id: string
  seq: string
  zeit: string               // korrigierte Zeit (ISO)
  client_ts: string
  zeit_ungeprueft: boolean
  autor: string
  device_id: string
  typ: string                // 'manuell' oder abgeleiteter Ereignistyp
  text: string
  abschnitt_id?: string
  korrigiert_durch?: string  // id des korrigierenden Eintrags
  korrektur_von?: string     // id des korrigierten Eintrags
  grund?: string
}

export interface KarteZeichen {
  id: string
  art: string                // Schlüssel aus taktischeZeichen.ts
  lat: number
  lng: number
  label?: string
  abschnitt_id?: string
  geometry?: any             // GeoJSON für Linien/Flächen
}

export interface AsConfig {
  abfrage_intervall_s: number
  abfrage_vorwarnung_s: number
  abfrage_ueberfaellig_s: number
  restdruckwarner_bar: number
  hard_floor_bar: number
  sicherheitszuschlag_bar: number
  rueckzug_modell: 'doppelter_hinweg' | 'fest' | 'drittel' | 'zwei_drittel'
  rueckzug_fest_bar: number
  angenommener_verbrauch_l_min: number
  max_einsatzzeit_s: number
  default_flasche: Flasche
  warnzeit_vor_rueckzug_s: number
}

export const DEFAULT_AS_CONFIG: AsConfig = {
  abfrage_intervall_s: 600,
  abfrage_vorwarnung_s: 60,
  abfrage_ueberfaellig_s: 120,
  restdruckwarner_bar: 55,
  hard_floor_bar: 60,
  sicherheitszuschlag_bar: 10,
  rueckzug_modell: 'doppelter_hinweg',
  rueckzug_fest_bar: 100,
  angenommener_verbrauch_l_min: 40,
  max_einsatzzeit_s: 1800,
  default_flasche: { anzahl: 1, liter: 6.8, nenndruck: 300 },
  warnzeit_vor_rueckzug_s: 180,
}

export interface EinsatzHeader {
  id: string
  unit?: string
  keyword?: string
  adresse?: string
  datum?: string
  einsatzleiter?: string
  lage?: string
  status?: string
  organization_id?: string
}

export interface EksState {
  einsatz: EinsatzHeader
  abschnitte: Record<string, Abschnitt>
  kraefte: Record<string, Kraft>
  trupps: Record<string, AtemschutzTrupp>
  etb: EtbEntry[]
  zeichen: Record<string, KarteZeichen>
  config: AsConfig
  fieldSeq: Record<string, Record<string, string>>
  lastSeq: string
  disclaimerOk: boolean
}

export function emptyState(einsatzId: string): EksState {
  return {
    einsatz: { id: einsatzId },
    abschnitte: {}, kraefte: {}, trupps: {}, etb: [], zeichen: {},
    config: { ...DEFAULT_AS_CONFIG }, fieldSeq: {}, lastSeq: '', disclaimerOk: false,
  }
}
