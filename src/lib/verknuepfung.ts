// Verknüpfte Rechte: Wer ein Recht bekommt, bekommt andere gleich mit.
//
// Voreinstellung: Lager bringt Dateien (mit Schreibstube), MPG und Vorgänge
// mit. Jede Organisation stellt das in der Benutzerverwaltung selbst ein;
// gespeichert wird es im JSON-Feld "verknuepfungen" der Organisation (in
// PocketBase anzulegen). Steht dort nichts — oder fehlt das Feld —, gilt die
// Voreinstellung. Ein leeres Objekt heißt: keine Verknüpfungen.
//
// Die Verknüpfung hakt beim Vergeben mit an. Die Rechte stehen danach
// wirklich am Benutzer — der Server prüft sie wie jedes andere Recht — und
// lassen sich einzeln wieder abwählen. Abwählen nimmt nichts mit weg.
//
// Die Benutzerverwaltung wird nie mitgebracht: Wer sie hat, kann jedes Recht
// vergeben, auch das für Patientendaten. Sie bleibt eine bewusste
// Einzelentscheidung.

import { PERM_LABELS } from './apps'
import { rechtFrei } from './freigabe'

/** Recht → Rechte, die es mitbringt. */
export type Verknuepfungen = Record<string, string[]>

export const STANDARD_VERKNUEPFUNGEN: Verknuepfungen = { lager: ['dateien', 'dashboard', 'dokumente'] }

/** Rechte, die nie mitgebracht werden. */
export const NIE_MITGEBRACHT = ['unitarii']

const BEKANNT = new Set(PERM_LABELS.map((p) => p.key))

function bereinigen(roh: Record<string, unknown>): Verknuepfungen {
  const v: Verknuepfungen = {}
  for (const [von, ziele] of Object.entries(roh)) {
    if (!BEKANNT.has(von) || !Array.isArray(ziele)) continue
    const liste = [...new Set(ziele.filter((z): z is string =>
      typeof z === 'string' && BEKANNT.has(z) && z !== von && !NIE_MITGEBRACHT.includes(z)))]
    if (liste.length) v[von] = liste
  }
  return v
}

/** Die Verknüpfungen einer Organisation — ohne Eintrag die Voreinstellung. */
export function verknuepfungen(org: unknown): Verknuepfungen {
  let wert = org && typeof org === 'object' ? (org as { verknuepfungen?: unknown }).verknuepfungen : undefined
  if (typeof wert === 'string') {
    try { wert = JSON.parse(wert) } catch { wert = undefined }
  }
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) return bereinigen(STANDARD_VERKNUEPFUNGEN)
  return bereinigen(wert as Record<string, unknown>)
}

/**
 * Was ein Recht mitbringt — auch über Ketten (A → B → C), ohne das Recht
 * selbst. Nur Rechte freigeschalteter Module; ein gesperrtes Modul bringt
 * nichts mit und reicht nichts weiter.
 */
export function mitgebracht(recht: string, v: Verknuepfungen, org?: unknown): string[] {
  if (!rechtFrei(org, recht)) return []
  const ergebnis: string[] = []
  const gesehen = new Set([recht])
  const offen = [recht]
  while (offen.length) {
    const r = offen.shift()!
    for (const z of v[r] ?? []) {
      if (gesehen.has(z)) continue
      gesehen.add(z)
      if (NIE_MITGEBRACHT.includes(z) || !rechtFrei(org, z)) continue
      ergebnis.push(z)
      offen.push(z)
    }
  }
  return ergebnis
}

/** Ein Häkchen setzen oder nehmen. Setzen hakt die verknüpften mit an, Nehmen nimmt nichts mit. */
export function haken(rechte: Record<string, boolean>, recht: string, an: boolean, v: Verknuepfungen, org?: unknown): Record<string, boolean> {
  const neu = { ...rechte, [recht]: an }
  if (an) for (const z of mitgebracht(recht, v, org)) neu[z] = true
  return neu
}

/**
 * Fehlende verknüpfte Rechte ergänzen — für Rollen-Vorlagen und zum
 * Nachziehen bestehender Benutzer. Weggenommen wird nichts.
 */
export function ergaenzen(rechte: Record<string, boolean> | null | undefined, v: Verknuepfungen, org?: unknown): { rechte: Record<string, boolean>; dazu: string[] } {
  const neu = { ...(rechte ?? {}) }
  const dazu: string[] = []
  for (const r of Object.keys(neu)) {
    if (neu[r] !== true) continue
    for (const z of mitgebracht(r, v, org)) {
      if (neu[z] === true) continue
      neu[z] = true
      dazu.push(z)
    }
  }
  return { rechte: neu, dazu }
}

/** Sind zwei Einstellungen gleich (Reihenfolge egal)? */
export function gleicheVerknuepfungen(a: Verknuepfungen, b: Verknuepfungen): boolean {
  const schluessel = (v: Verknuepfungen) => Object.keys(v).filter((k) => v[k].length).sort()
  const ka = schluessel(a)
  const kb = schluessel(b)
  if (ka.join() !== kb.join()) return false
  return ka.every((k) => [...a[k]].sort().join() === [...b[k]].sort().join())
}
