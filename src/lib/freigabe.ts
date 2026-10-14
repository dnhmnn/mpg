// Welche Module eine Organisation nutzen darf.
//
// Der Supervisor schaltet je Organisation einzelne Module frei. Gespeichert
// wird die Liste im JSON-Feld "freigeschaltet" der Organisation (in
// PocketBase anzulegen). Steht dort nichts — bestehende Organisationen, oder
// das Feld fehlt noch —, ist alles frei: niemand verliert etwas, bis der
// Supervisor bewusst abwählt.
//
// Ein Modul umfasst die Kacheln im Hub, die Rechte, die man dafür vergeben
// kann, und die öffentlichen Formulare auf der Seite der Organisation.
// Benutzerverwaltung und Einstellungen gehören zu keinem Modul — die braucht
// jede Organisation.
//
// Das ist eine Freischaltung der Oberfläche: gesperrte Module erscheinen
// nicht und lassen sich nicht vergeben. Die Rechte einzelner Benutzer bleiben
// unangetastet und gelten wieder, sobald das Modul freigeschaltet wird.

export interface Modul {
  id: string
  name: string
  beschreibung: string
  /** Kacheln im Hub (ids aus ALL_APPS). */
  apps: string[]
  /** Rechte, die dafür vergeben werden (Schlüssel aus PERM_LABELS). */
  rechte: string[]
  /** Öffentliche Formulare auf der Seite der Organisation. */
  formulare: string[]
}

export const MODULE: Modul[] = [
  { id: 'einsaetze', name: 'Einsätze', beschreibung: 'Einsätze anlegen, Personal zuordnen, Alarmierung', apps: ['einsaetze'], rechte: ['einsaetze'], formulare: [] },
  { id: 'eks', name: 'EKS Einsatzführung', beschreibung: 'Atemschutzüberwachung, Einsatztagebuch, Kräfte', apps: ['eks'], rechte: ['eks'], formulare: [] },
  { id: 'patienten', name: 'Patientendokumentation', beschreibung: 'Protokolle erfassen, prüfen, gegenzeichnen', apps: ['patienten'], rechte: ['patienten'], formulare: ['patienten'] },
  { id: 'dokumente', name: 'Vorgänge und CIRS', beschreibung: 'Formulare der Seite, eigene Vorlagen, CIRS-Meldungen', apps: ['dokumente'], rechte: ['dokumente'], formulare: ['cirs'] },
  { id: 'lager', name: 'Lager', beschreibung: 'Bestände, Ablaufdaten, Bestellungen, Produktausgabe', apps: ['lager'], rechte: ['lager', 'produktausgabe'], formulare: ['produktausgabe'] },
  { id: 'mpg', name: 'MPG', beschreibung: 'Medizinprodukte prüfen, Defektmeldungen', apps: ['mpg'], rechte: [], formulare: ['defektmeldung'] },
  { id: 'dateien', name: 'Dateien und Schreibstube', beschreibung: 'Gemeinsame Ablage, Office-Dokumente', apps: ['dateien', 'office'], rechte: ['dateien'], formulare: [] },
  { id: 'lernbar', name: 'Unitas und Lernbar', beschreibung: 'Persönliche Seite der Einsatzkräfte, Lernen, Termine', apps: ['lernbar'], rechte: ['lernbar'], formulare: [] },
  { id: 'ausbildungen', name: 'Ausbildungen', beschreibung: 'Termine, Teilnehmer, Lernmodule', apps: ['ausbildungen'], rechte: ['ausbildungen_manage'], formulare: [] },
  { id: 'chat', name: 'Chat', beschreibung: 'Direktnachrichten in der Organisation', apps: ['chat'], rechte: ['chat'], formulare: [] },
  { id: 'notizen', name: 'Notizen', beschreibung: 'Persönliche und geteilte Notizen', apps: ['notizen'], rechte: ['notizen'], formulare: [] },
]

export const ALLE_MODULE = MODULE.map((m) => m.id)

/**
 * Die freigeschalteten Module einer Organisation — oder null für "alles frei"
 * (nichts eingetragen, Feld fehlt, unlesbar).
 */
export function freigeschaltet(org: unknown): string[] | null {
  if (!org || typeof org !== 'object') return null
  let wert = (org as { freigeschaltet?: unknown }).freigeschaltet
  if (typeof wert === 'string') {
    try { wert = JSON.parse(wert) } catch { return null }
  }
  if (!Array.isArray(wert)) return null
  return wert.filter((x): x is string => typeof x === 'string' && ALLE_MODULE.includes(x))
}

export function modulFrei(org: unknown, modulId: string): boolean {
  const frei = freigeschaltet(org)
  return frei === null || frei.includes(modulId)
}

function modulMit(feld: 'apps' | 'rechte' | 'formulare', wert: string): Modul | undefined {
  return MODULE.find((m) => m[feld].includes(wert))
}

/** Darf diese Kachel erscheinen? Kacheln ohne Modul (Benutzer, Einstellungen) immer. */
export function appFrei(org: unknown, appId: string): boolean {
  const m = modulMit('apps', appId)
  return !m || modulFrei(org, m.id)
}

/** Darf dieses Recht vergeben werden? Rechte ohne Modul (Benutzerverwaltung, Dashboard) immer. */
export function rechtFrei(org: unknown, recht: string): boolean {
  const m = modulMit('rechte', recht)
  return !m || modulFrei(org, m.id)
}

/** Darf dieses öffentliche Formular erscheinen? */
export function formularFrei(org: unknown, formular: string): boolean {
  const m = modulMit('formulare', formular)
  return !m || modulFrei(org, m.id)
}

/** "7 von 11 Modulen" — oder "alle Module". */
export function freigabeText(org: unknown): string {
  const frei = freigeschaltet(org)
  if (frei === null || frei.length === MODULE.length) return 'alle Module'
  if (frei.length === 0) return 'keine Module'
  return `${frei.length} von ${MODULE.length} Modulen`
}
