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
// Die Benutzerverwaltung (mit den Einstellungen) braucht jede Organisation:
// Sie steht als Modul im Katalog, ist aber immer an.
//
// Manche Module schließen andere fest ein: Wer Lager bucht, hat auch Dateien
// und Schreibstube, MPG und Vorgänge. Gespeichert wird nur, was gebucht ist;
// was darin enthalten ist, ergibt sich daraus — und fällt mit ihm wieder weg.
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
  /** Module, die dieses fest einschließt — wer es bucht, hat sie mit. */
  enthaelt?: string[]
  /** Hat jede Organisation, lässt sich nicht abwählen. */
  immer?: boolean
}

export const MODULE: Modul[] = [
  // "dashboard" öffnet die Einstellungen (und MPG, wenn das Modul frei ist) — darf nie wegfallen
  { id: 'benutzer', name: 'Benutzerverwaltung', beschreibung: 'Benutzer anlegen, Rechte vergeben, Einstellungen', apps: ['unitarii', 'settings'], rechte: ['unitarii', 'dashboard'], formulare: [], immer: true },
  { id: 'einsaetze', name: 'Einsätze', beschreibung: 'Einsätze anlegen, Personal zuordnen, Alarmierung', apps: ['einsaetze'], rechte: ['einsaetze'], formulare: [] },
  { id: 'eks', name: 'EKS Einsatzführung', beschreibung: 'Atemschutzüberwachung, Einsatztagebuch, Kräfte', apps: ['eks'], rechte: ['eks'], formulare: [] },
  { id: 'patienten', name: 'Patientendokumentation', beschreibung: 'Protokolle erfassen, prüfen, gegenzeichnen', apps: ['patienten'], rechte: ['patienten'], formulare: ['patienten'] },
  { id: 'dokumente', name: 'Vorgänge und CIRS', beschreibung: 'Formulare der Seite, eigene Vorlagen, CIRS-Meldungen', apps: ['dokumente'], rechte: ['dokumente'], formulare: ['cirs'] },
  { id: 'lager', name: 'Lager', beschreibung: 'Bestände, Ablaufdaten, Bestellungen, Produktausgabe', apps: ['lager'], rechte: ['lager', 'lager_verwalten', 'produktausgabe'], formulare: ['produktausgabe'], enthaelt: ['dateien', 'mpg', 'dokumente'] },
  { id: 'mpg', name: 'MPG', beschreibung: 'Medizinprodukte prüfen, Defektmeldungen', apps: ['mpg'], rechte: [], formulare: ['defektmeldung'] },
  { id: 'dateien', name: 'Dateien und Schreibstube', beschreibung: 'Gemeinsame Ablage, Office-Dokumente', apps: ['dateien', 'office'], rechte: ['dateien'], formulare: [] },
  { id: 'lernbar', name: 'Unitas und Lernbar', beschreibung: 'Persönliche Seite der Einsatzkräfte, Lernen, Termine', apps: ['lernbar'], rechte: ['lernbar'], formulare: [] },
  { id: 'ausbildungen', name: 'Ausbildungen', beschreibung: 'Termine, Teilnehmer, Lernmodule', apps: ['ausbildungen'], rechte: ['ausbildungen_manage'], formulare: [] },
  { id: 'chat', name: 'Chat', beschreibung: 'Direktnachrichten in der Organisation', apps: ['chat'], rechte: ['chat'], formulare: [] },
  { id: 'notizen', name: 'Notizen', beschreibung: 'Persönliche und geteilte Notizen', apps: ['notizen'], rechte: ['notizen'], formulare: [] },
]

export const ALLE_MODULE = MODULE.map((m) => m.id)
/** Die Module, die man buchen oder abwählen kann (ohne die, die immer an sind). */
export const BUCHBARE_MODULE = MODULE.filter((m) => !m.immer).map((m) => m.id)
const IMMER = MODULE.filter((m) => m.immer).map((m) => m.id)

/**
 * Die gebuchten Module einer Organisation, so wie sie gespeichert sind — oder
 * null für "alles frei" (nichts eingetragen, Feld fehlt, unlesbar).
 */
export function gebucht(org: unknown): string[] | null {
  if (!org || typeof org !== 'object') return null
  let wert = (org as { freigeschaltet?: unknown }).freigeschaltet
  if (typeof wert === 'string') {
    try { wert = JSON.parse(wert) } catch { return null }
  }
  if (!Array.isArray(wert)) return null
  return wert.filter((x): x is string => typeof x === 'string' && ALLE_MODULE.includes(x))
}

/** Gebuchte Module samt allem, was sie fest einschließen (auch über Ketten) und was immer an ist, in Katalog-Reihenfolge. */
export function mitEnthaltenen(liste: string[]): string[] {
  const frei = new Set([...IMMER, ...liste])
  const offen = [...liste]
  while (offen.length) {
    const id = offen.shift()
    for (const e of MODULE.find((m) => m.id === id)?.enthaelt ?? []) {
      if (!frei.has(e)) { frei.add(e); offen.push(e) }
    }
  }
  return ALLE_MODULE.filter((id) => frei.has(id))
}

/** In welchem gebuchten Modul ist dieses fest enthalten? (für "in Lager enthalten") */
export function enthaltenIn(modulId: string, liste: string[]): Modul | undefined {
  // Was immer an ist, steckt in keinem anderen Modul
  if (IMMER.includes(modulId)) return undefined
  return MODULE.find((m) => m.id !== modulId && liste.includes(m.id) && mitEnthaltenen([m.id]).includes(modulId))
}

/**
 * Was eine Organisation nutzen darf: die gebuchten Module und was sie
 * einschließen — oder null für "alles frei".
 */
export function freigeschaltet(org: unknown): string[] | null {
  const liste = gebucht(org)
  return liste === null ? null : mitEnthaltenen(liste)
}

export function modulFrei(org: unknown, modulId: string): boolean {
  const frei = freigeschaltet(org)
  return frei === null || frei.includes(modulId)
}

function modulMit(feld: 'apps' | 'rechte' | 'formulare', wert: string): Modul | undefined {
  return MODULE.find((m) => m[feld].includes(wert))
}

/** Darf diese Kachel erscheinen? Benutzer und Einstellungen immer (Modul Benutzerverwaltung). */
export function appFrei(org: unknown, appId: string): boolean {
  const m = modulMit('apps', appId)
  return !m || modulFrei(org, m.id)
}

/** Darf dieses Recht vergeben werden? Benutzerverwaltung und Dashboard immer. */
export function rechtFrei(org: unknown, recht: string): boolean {
  const m = modulMit('rechte', recht)
  return !m || modulFrei(org, m.id)
}

/** Darf dieses öffentliche Formular erscheinen? */
export function formularFrei(org: unknown, formular: string): boolean {
  const m = modulMit('formulare', formular)
  return !m || modulFrei(org, m.id)
}

/** "7 von 12 Modulen" — oder "alle Module", "nur Benutzerverwaltung". */
export function freigabeText(org: unknown): string {
  const frei = freigeschaltet(org)
  if (frei === null || frei.length === MODULE.length) return 'alle Module'
  if (frei.every((id) => IMMER.includes(id))) return 'nur Benutzerverwaltung'
  return `${frei.length} von ${MODULE.length} Modulen`
}
