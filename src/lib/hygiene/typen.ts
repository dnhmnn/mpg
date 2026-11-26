// Hygiene (Owner, 23.11.2026): Objekte wie Fahrzeuge, Räume, Rucksäcke, Geräte oder Material
// (z. B. Blutdruckmanschette) werden in einem Intervall nach Checkliste gereinigt und desinfiziert.
// Jede Durchführung ist ein unveränderlicher Nachweis (Hook pb_hooks/hygiene.pb.js). Überfällig wird
// nur angezeigt, nichts wird gesperrt, auch nicht im MPG oder Lager (Owner, 23.11.2026).
//
// Sammlungen (scripts/hygiene-einrichten.py, Regeln in docs/pocketbase-regeln.md, „Hygiene: API-Regeln“):
//   hygiene_objekte           was gereinigt wird, mit Intervall und Checkliste
//   hygiene_durchfuehrungen   Nachweise (nur anlegen, nie ändern oder löschen)
// Verweise auf MPG und Lager stehen als Text-Kennung mit einer Kopie des Namens am Objekt, nie als
// Relation: Das Löschen eines Geräts oder Artikels darf keinen Nachweis still ändern.

export type HyArt = 'fahrzeug' | 'raum' | 'rucksack' | 'geraet' | 'material' | 'sonstiges'
export const ARTEN: HyArt[] = ['fahrzeug', 'raum', 'rucksack', 'geraet', 'material', 'sonstiges']
export const ART_NAME: Record<HyArt, string> = {
  fahrzeug: 'Fahrzeug', raum: 'Raum', rucksack: 'Rucksack oder Koffer', geraet: 'Gerät', material: 'Material', sonstiges: 'Sonstiges',
}
/** Mehrzahl für Überschriften */
export const ART_GRUPPE: Record<HyArt, string> = {
  fahrzeug: 'Fahrzeuge', raum: 'Räume', rucksack: 'Rucksäcke und Koffer', geraet: 'Geräte', material: 'Material', sonstiges: 'Sonstiges',
}

/** taeglich, woechentlich, alle N Tage, monatlich oder nur nach jeder Benutzung (ohne Kalenderfrist) */
export type HyIntervall = 'taeglich' | 'woechentlich' | 'tage' | 'monatlich' | 'benutzung'
export const INTERVALLE: HyIntervall[] = ['taeglich', 'woechentlich', 'tage', 'monatlich', 'benutzung']

/** Woher ein Objekt stammt (Vorschlag übernommen); leer = von Hand angelegt */
export type HyQuelle = '' | 'mpg_geraet' | 'lager_ort' | 'lager_satz' | 'lager_artikel'
export const QUELLE_NAME: Record<Exclude<HyQuelle, ''>, string> = {
  mpg_geraet: 'MPG', lager_ort: 'Lager-Ort', lager_satz: 'Sollausstattung im Lager', lager_artikel: 'Lager-Artikel',
}

export interface HyObjekt {
  id: string
  organization_id: string
  name: string
  art: HyArt
  /** Fahrzeug oder Raum, wo es steht (bei Rucksäcken, Geräten, Material) */
  standort: string
  intervall: HyIntervall
  /** Nur bei intervall 'tage' */
  intervall_tage: number
  /** Die Punkte der Checkliste, in Reihenfolge */
  punkte: string[]
  quelle: HyQuelle
  quelle_id: string
  quelle_name: string
  /** Leer = in Gebrauch; sonst seit wann archiviert */
  archiviert: string
  created?: string
  updated?: string
}

export type HyDfArt = 'plan' | 'anlass'
/** Feste Anlässe — kein freier Grund, damit dort keine Patientendaten landen */
export type HyAnlass = '' | 'infektion' | 'verschmutzung' | 'sonstiges'
export const ANLAESSE: Exclude<HyAnlass, ''>[] = ['infektion', 'verschmutzung', 'sonstiges']
export const ANLASS_NAME: Record<Exclude<HyAnlass, ''>, string> = {
  infektion: 'Nach Infektionstransport', verschmutzung: 'Sichtbare Verschmutzung', sonstiges: 'Sonstiger Anlass',
}

export interface HyPunktErgebnis { text: string; erledigt: boolean }

export interface HyDurchfuehrung {
  id: string
  organization_id: string
  objekt_id: string
  /** Kopie des Namens zum Zeitpunkt der Durchführung */
  objekt_name: string
  art: HyDfArt
  anlass: HyAnlass
  einsatz_nummer: string
  punkte: HyPunktErgebnis[]
  /** Zahl der nicht erledigten Punkte (Mängel) */
  offen: number
  bemerkung: string
  /** Wann durchgeführt (nachtragen geht bis NACHTRAG_TAGE zurück) */
  zeitpunkt: string
  /** Setzt der Server aus der Anmeldung */
  user_id?: string
  user_name?: string
  created?: string
}

/** So weit zurück darf eine Durchführung nachgetragen werden (der Hook prüft dasselbe). */
export const NACHTRAG_TAGE = 7
/** Grenzen, die auch der Hook prüft */
export const MAX_PUNKTE = 40
export const MAX_PUNKT_LAENGE = 200
export const MAX_BEMERKUNG = 1000
export const MAX_NAME = 120
