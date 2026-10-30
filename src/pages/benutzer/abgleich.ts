// Abgleich: users.permissions ist die gespeicherte Kopie dessen, was die Rollen einer
// Person geben (lib/rollen.ts, rechteAusRollen). Ändert sich eine Rolle oder hat jemand
// aus früherer Zeit Einzelrechte, weicht die Kopie ab. Hier wird geplant, was sich je
// Person ändert, und erst nach Bestätigung geschrieben.

import { pb } from '../../lib/pocketbase'
import { PERM_LABELS } from '../../lib/apps'
import { rolleBekannt, rollenVon, sollRechte, type Vorlagen } from '../../lib/rollen'
import type { Verknuepfungen } from '../../lib/verknuepfung'
import type { UUser } from './logik'

export interface Aenderung { u: UUser; neu: Record<string, boolean>; dazu: string[]; weg: string[] }

/**
 * Wer bekommt was dazu, wer verliert was, wenn die gespeicherten Rechte wieder den
 * Rollen entsprechen? Außen vor bleiben: der Supervisor, die bedienende Person selbst
 * (selbst; sie soll sich nicht nebenbei aussperren, ihre eigene Seite fragt nach) und
 * Personen mit einer hier unbekannten Rolle (die gäbe nichts; erst Rollen wählen).
 * nur: zum Beispiel nur Personen mit einer bestimmten Rolle.
 */
export function abgleichPlan(users: UUser[], rp: Vorlagen | null | undefined, v: Verknuepfungen, org: unknown,
  nur?: (u: UUser) => boolean, selbst?: string): Aenderung[] {
  const aus: Aenderung[] = []
  for (const u of users) {
    if (u.supervisor || u.id === selbst || (nur && !nur(u))) continue
    if (org && rollenVon(u).some(id => !rolleBekannt(id, org))) continue
    const neu = sollRechte(u, rp, v, org)
    const ist = u.permissions || {}
    const dazu = Object.keys(neu).filter(k => neu[k] && ist[k] !== true)
    const weg = Object.keys(neu).filter(k => !neu[k] && ist[k] === true)
    if (dazu.length || weg.length) aus.push({ u, neu, dazu, weg })
  }
  return aus
}

/** Personen mit gleicher Änderung zusammenfassen (gleiche Rollen, gleiches dazu und weg) */
export function gruppieren(liste: Aenderung[]): Aenderung[][] {
  const gruppen = new Map<string, Aenderung[]>()
  for (const a of liste) {
    const key = JSON.stringify([rollenVon(a.u).slice().sort(), a.dazu, a.weg])
    gruppen.set(key, [...(gruppen.get(key) ?? []), a])
  }
  return [...gruppen.values()]
}

/** Die Personen der Organisation frisch lesen — vor dem Schreiben nie mit altem Stand rechnen */
export async function frischeBenutzer(orgId: string): Promise<UUser[]> {
  return pb.collection('users').getFullList<UUser>({
    filter: pb.filter('organization_id = {:o}', { o: orgId }), requestKey: null,
  })
}

/** Schreibt die neuen Rechte, eine Person nach der anderen. Bricht bei Fehlern nicht ab. */
export async function abgleichSchreiben(liste: Aenderung[]): Promise<{ ok: number; fehler: number }> {
  let ok = 0, fehler = 0
  for (const a of liste) {
    try { await pb.collection('users').update(a.u.id, { permissions: a.neu }, { requestKey: null }); ok++ }
    catch { fehler++ }
  }
  return { ok, fehler }
}

/** Rechte ohne eigenen Schalter, die trotzdem gespeichert sind */
const OHNE_SCHALTER: Record<string, string> = { produktausgabe: 'Produktausgabe' }

/** Name eines Rechts, so wie es in der Organisation heißt */
export function rechtName(key: string, rechte: { key: string; label: string }[]): string {
  return rechte.find(r => r.key === key)?.label ?? PERM_LABELS.find(p => p.key === key)?.label ?? OHNE_SCHALTER[key] ?? key
}

/** Namen der Rechte für Rückfragen */
export function rechtNamen(keys: string[], rechte: { key: string; label: string }[]): string {
  return keys.map(key => rechtName(key, rechte)).join(', ')
}

/**
 * Nach dem Ändern einer Rolle: Personen mit dieser Rolle bekommen die neuen Rechte —
 * nach Rückfrage mit der Liste, wer was dazubekommt oder verliert. Gibt einen Satz
 * für die Rückmeldung zurück (leer, wenn niemand betroffen war) und ob etwas schiefging.
 * Die Rolle selbst ist dann schon gespeichert; Fehler hier betreffen nur das Nachziehen.
 */
export async function nachRollenAenderung(o: {
  orgId: string; rolleId: string; rolleName: string; rp: Vorlagen; v: Verknuepfungen; org: unknown
  rechte: { key: string; label: string }[]; hatRolle: (u: UUser) => boolean; selbst?: string
}): Promise<{ text: string; fehler: boolean }> {
  let plan: Aenderung[]
  try { plan = abgleichPlan(await frischeBenutzer(o.orgId), o.rp, o.v, o.org, o.hatRolle, o.selbst) }
  catch { return { text: ' Die Personen konnten nicht nachgezogen werden (keine Verbindung); der Abgleich zeigt sie.', fehler: true } }
  if (!plan.length) return { text: '', fehler: false }
  const zeilen = plan.slice(0, 10).map(a => {
    const teile = [a.dazu.length ? `bekommt ${rechtNamen(a.dazu, o.rechte)}` : '', a.weg.length ? `verliert ${rechtNamen(a.weg, o.rechte)}` : ''].filter(Boolean)
    return `${a.u.name || 'Ohne Namen'}: ${teile.join(', ')}`
  })
  const mehr = plan.length > 10 ? `\nund ${plan.length - 10} weitere` : ''
  const wer = o.rolleName ? ` mit der Rolle „${o.rolleName}“` : ''
  const frage = `Die Änderung gilt für ${plan.length === 1 ? '1 Person' : `${plan.length} Personen`}${wer}:\n\n${zeilen.join('\n')}${mehr}\n\nJetzt übernehmen?`
  if (!confirm(frage)) return { text: ' Die Betroffenen behalten vorerst ihre bisherigen Rechte; angleichen geht später im Abgleich.', fehler: false }
  const e = await abgleichSchreiben(plan)
  if (e.fehler) return { text: ` ${e.ok} von ${plan.length} Personen haben die neuen Rechte, bei ${e.fehler} ging es nicht (Abgleich zeigt sie).`, fehler: true }
  return { text: ` ${plan.length === 1 ? '1 Person hat' : `${plan.length} Personen haben`} die neuen Rechte.`, fehler: false }
}
