// Rollen: die vorgegebenen (ROLLEN in apps.ts) und die eigenen einer Organisation.
//
// Was jemand darf, ergibt sich aus seinen Rollen; hat jemand mehrere, zählen sie
// zusammen (rechteAusRollen). Gespeichert wird das Ergebnis als Kopie in
// users.permissions, denn danach fragen App und Server-Regeln. Je Person weicht
// nur noch temp_permissions (befristet) ab. Eigene Rollen haben Kennungen, die nie
// mit den Rollen kollidieren, die auf dem Server etwas bedeuten (admin, lager, mpg,
// teilnehmer, benutzer): immer "eigen_" und 8 Zeichen.
//
// Gespeichert an der Person:
//   users.role         = erste Rolle (zählt in den Server-Regeln, z. B. "admin")
//   users.zusatzrollen = weitere Rollen ["fuehrung", "eigen_…"]  (JSON)
// Gespeichert in der Organisation:
//   organizations.eigene_rollen    = [{ id, name, hinweis?, farbe?, archiviert? }]
//   organizations.role_permissions = { [id]: { recht: true|false } }  (wie bei den vorgegebenen)

import { FESTE_ROLLEN, PERM_LABELS, ROLLEN, getRoleTemplate } from './apps'
import { mitgebracht, type Verknuepfungen } from './verknuepfung'
import { MODULE } from './freigabe'

export const EIGENE_ID = /^eigen_[a-z0-9]{8}$/
export const MAX_EIGENE_ROLLEN = 30
export const MAX_NAME = 40
export const MAX_HINWEIS = 160
/** Rollen, die in den Server-Regeln etwas bedeuten (docs/pocketbase-regeln.md) */
export const SERVER_ROLLEN = ['admin', 'lager', 'mpg', 'teilnehmer', 'benutzer', ''] as const

/** Erkennungsfarben: gedeckt und warm, passend zum Dunkelrot; nichts nahe am Signalrot */
export const ROLLEN_FARBEN = [
  { id: 'bordeaux', name: 'Bordeaux' },
  { id: 'cognac', name: 'Cognac' },
  { id: 'oliva', name: 'Oliva' },
  { id: 'petrolio', name: 'Petrolio' },
  { id: 'prugna', name: 'Prugna' },
  { id: 'senape', name: 'Senape' },
  { id: 'salvia', name: 'Salvia' },
  { id: 'ardesia', name: 'Ardesia' },
] as const
export type RollenFarbe = typeof ROLLEN_FARBEN[number]['id']
const FARB_IDS = ROLLEN_FARBEN.map(f => f.id) as readonly string[]

/** Feste Farben der vorgegebenen Rollen. Die häufigste (Benutzer) bleibt ruhig. */
const VORGABE_FARBE: Record<string, RollenFarbe> = {
  admin: 'bordeaux', benutzer: 'ardesia', fuehrung: 'senape', medizin: 'salvia', mpg: 'petrolio', lager: 'cognac', ausbildung: 'oliva', qm: 'prugna', teilnehmer: 'ardesia',
}
const VORGABE_KUERZEL: Record<string, string> = {
  admin: 'AD', benutzer: 'EK', fuehrung: 'FÜ', medizin: 'ML', mpg: 'MP', lager: 'LA', ausbildung: 'AU', qm: 'QM', teilnehmer: 'TN',
}

export interface EigeneRolle { id: string; name: string; hinweis?: string; farbe?: RollenFarbe; archiviert?: boolean }
export interface RollenEintrag { id: string; name: string; hinweis: string; eigen: boolean; archiviert: boolean; farbe: RollenFarbe }

export function istEigeneRolleId(id: unknown): id is string {
  return typeof id === 'string' && EIGENE_ID.test(id)
}

const sauber = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/**
 * Die eigenen Rollen einer Organisation, bereinigt. Verworfen werden Einträge ohne
 * gültige Kennung (auch "admin" — sonst ließe sich unter einem harmlosen Namen die
 * Admin-Rolle vergeben), ohne Namen und doppelte (der erste gewinnt).
 */
export function eigeneRollen(org: unknown): EigeneRolle[] {
  let wert = org && typeof org === 'object' ? (org as { eigene_rollen?: unknown }).eigene_rollen : undefined
  if (typeof wert === 'string') {
    try { wert = JSON.parse(wert) } catch { wert = undefined }
  }
  if (!Array.isArray(wert)) return []
  const gesehen = new Set<string>()
  const aus: EigeneRolle[] = []
  for (const e of wert) {
    if (!e || typeof e !== 'object') continue
    const { id, name, hinweis, farbe, archiviert } = e as Record<string, unknown>
    if (!istEigeneRolleId(id) || gesehen.has(id)) continue
    const n = sauber(name, MAX_NAME)
    if (!n) continue
    gesehen.add(id)
    const r: EigeneRolle = { id, name: n }
    const h = sauber(hinweis, MAX_HINWEIS)
    if (h) r.hinweis = h
    if (typeof farbe === 'string' && FARB_IDS.includes(farbe)) r.farbe = farbe as RollenFarbe
    if (archiviert === true) r.archiviert = true
    aus.push(r)
  }
  return aus
}

const EIGEN_HINWEIS = 'Eigene Rolle der Organisation.'

function eintragEigen(r: EigeneRolle): RollenEintrag {
  return { id: r.id, name: r.name, hinweis: r.hinweis || EIGEN_HINWEIS, eigen: true, archiviert: !!r.archiviert, farbe: r.farbe ?? 'senape' }
}

/**
 * Alle Rollen zur Auswahl: zuerst die vorgegebenen in ihrer Reihenfolge, dann die
 * aktiven eigenen nach Namen. Archivierte nur mit mitArchivierten oder wenn sie die
 * aktuelle Rolle sind (sonst änderte Speichern die Rolle stillschweigend). Ist die
 * aktuelle eine unbekannte eigene Kennung, steht sie als „Gelöschte Rolle“ da.
 */
export function rollenFuer(org: unknown, opt: { aktuelle?: string; mitArchivierten?: boolean } = {}): RollenEintrag[] {
  const vorgegeben: RollenEintrag[] = ROLLEN.map(r => ({ id: r.id, name: r.name, hinweis: r.hinweis, eigen: false, archiviert: false, farbe: VORGABE_FARBE[r.id] ?? 'ardesia' }))
  const eigene = eigeneRollen(org)
    .filter(r => !r.archiviert || opt.mitArchivierten || r.id === opt.aktuelle)
    .map(eintragEigen)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const alle = [...vorgegeben, ...eigene]
  if (istEigeneRolleId(opt.aktuelle) && !alle.some(r => r.id === opt.aktuelle)) {
    // Gelöscht oder nur noch nicht bekannt (gespeicherte Organisation offline älter als die Rolle):
    // beides lässt sich hier nicht sicher unterscheiden, deshalb neutral
    alle.push({ id: opt.aktuelle, name: 'Unbekannte Rolle', hinweis: 'Diese Rolle ist hier nicht (mehr) bekannt und gibt keine Rechte.', eigen: true, archiviert: true, farbe: 'ardesia' })
  }
  return alle
}

export function rolleInfo(id: string | undefined, org: unknown): RollenEintrag | undefined {
  return rollenFuer(org, { aktuelle: id, mitArchivierten: true }).find(r => r.id === (id || 'benutzer'))
}

/** Der Name einer Rolle, wie Menschen ihn lesen. Alte, unbekannte Werte erscheinen, wie sie sind. */
export function rollenBezeichnung(id: string | undefined, org: unknown): string {
  if (!id) return 'Einsatzkraft'
  return rolleInfo(id, org)?.name ?? id
}

/** Erkennungsfarbe als CSS-Wert (Tokens in globals.css, je Darstellung angepasst) */
export function rollenFarbe(id: string | undefined, org: unknown): string {
  return `var(--rolle-${rolleInfo(id, org)?.farbe ?? 'ardesia'})`
}

/** Zwei Buchstaben für das Farbfeld: vorgegebene fest, eigene aus dem Namen */
export function rollenKuerzel(id: string | undefined, org: unknown): string {
  if (!id || VORGABE_KUERZEL[id]) return VORGABE_KUERZEL[id || 'benutzer']
  const name = rolleInfo(id, org)?.name ?? id
  const woerter = name.split(/[\s-]+/).filter(Boolean)
  const k = woerter.length > 1 ? woerter[0][0] + woerter[1][0] : name.slice(0, 2)
  return k.toLocaleUpperCase('de-DE')
}

// --- Mehrere Rollen je Person -------------------------------------------------

/** Reihenfolge: Die erste Rolle einer Person steht in users.role und zählt in den Server-Regeln */
const REIHENFOLGE = ['admin', 'teilnehmer', 'fuehrung', 'medizin', 'mpg', 'lager', 'ausbildung', 'qm']
/** Rollen, die allein stehen: Leitung hat ohnehin alles, Teilnehmende sind keine Mitglieder mit Rechten */
export const EINZELN = FESTE_ROLLEN

type MitRollen = { role?: string; zusatzrollen?: unknown }

/**
 * Die Zusatzrollen, wie PocketBase sie liefert (Array, JSON-Text oder nichts).
 * Leitung und Teilnehmende stehen nie dort (rollenOrdnen): Was so aussieht, ist
 * eingeschleust (etwa selbst eingetragen, bevor die Server-Regel galt) und zählt nicht.
 */
function zusatzListe(z: unknown): string[] {
  let w = z
  if (typeof w === 'string') { try { w = JSON.parse(w) } catch { w = [] } }
  return Array.isArray(w)
    ? w.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()).filter(x => !EINZELN.includes(x))
    : []
}

/** Alle Rollen einer Person, ohne Doppelte; ohne Rolle gilt Einsatzkraft. Teilnehmende haben nur diese eine. */
export function rollenVon(u: MitRollen | null | undefined): string[] {
  const haupt = (u?.role || '').trim() || 'benutzer'
  if (haupt === 'teilnehmer') return ['teilnehmer']
  return [...new Set([haupt, ...zusatzListe(u?.zusatzrollen)])]
}

/** Hat die Person diese Rolle, als erste oder als weitere? */
export function hatRolle(u: MitRollen, id: string): boolean {
  return rollenVon(u).includes(id)
}

/**
 * Gewählte Rollen in die gespeicherte Form bringen: ohne Doppelte, Leitung bzw.
 * Teilnehmende allein, sonst in fester Reihenfolge (vorgegebene, dann eigene, Einsatzkraft zuletzt).
 * Die erste wird users.role, die übrigen users.zusatzrollen.
 */
export function rollenOrdnen(ids: string[]): { role: string; zusatzrollen: string[] } {
  const rein = [...new Set(ids.map(i => (i || '').trim()).filter(Boolean))]
  for (const e of EINZELN) if (rein.includes(e)) return { role: e, zusatzrollen: [] }
  const rang = (id: string) => {
    const i = REIHENFOLGE.indexOf(id)
    if (i >= 0) return i
    return id === 'benutzer' ? 1000 : 500
  }
  const sortiert = rein.map((id, i) => ({ id, i })).sort((a, b) => rang(a.id) - rang(b.id) || a.i - b.i).map(x => x.id)
  if (!sortiert.length) return { role: 'benutzer', zusatzrollen: [] }
  return { role: sortiert[0], zusatzrollen: sortiert.slice(1) }
}

export type Vorlagen = Record<string, Record<string, boolean>>

/**
 * Was die Rollen zusammen geben: jedes bekannte Recht ausdrücklich mit Ja oder Nein.
 * Je Rolle die Vorlage (Leitung und Teilnehmende fest, sonst die der Organisation oder
 * von Responda) samt verknüpften Rechten. Unbekannte Rollen geben nichts.
 */
export function rechteAusRollen(ids: string[], rp: Vorlagen | null | undefined, v: Verknuepfungen, org?: unknown): Record<string, boolean> {
  const aus: Record<string, boolean> = Object.fromEntries([...BEKANNTE_RECHTE].map(k => [k, false]))
  for (const id of ids) {
    const t = vorlageBereinigen(getRoleTemplate(id, { role_permissions: rp ?? {} }))
    for (const [k, w] of Object.entries(t)) if (w === true && k in aus) aus[k] = true
  }
  // Gibt eine Rolle ein Recht, bringt es die verknüpften mit — auch wenn eine angepasste
  // Rolle sie ausdrücklich abgewählt gespeichert hat (sonst wirkten spätere Verknüpfungen nie)
  for (const k of Object.keys(aus)) if (aus[k]) for (const z of mitgebracht(k, v, org)) if (z in aus) aus[z] = true
  return aus
}

/** Teilnehmende: nur Unitas, und nur wenn die Ausbildungen es freigegeben haben */
export function rechteTeilnehmende(ist: Record<string, boolean> | null | undefined): Record<string, boolean> {
  const aus: Record<string, boolean> = Object.fromEntries([...BEKANNTE_RECHTE].map(k => [k, false]))
  aus.lernbar = ist?.lernbar === true
  return aus
}

/** Was eine Person nach ihren Rollen darf (Teilnehmende: nur Unitas aus den Ausbildungen) */
export function sollRechte(u: MitRollen & { permissions?: Record<string, boolean> | null }, rp: Vorlagen | null | undefined, v: Verknuepfungen, org?: unknown): Record<string, boolean> {
  const rollen = rollenVon(u)
  return rollen[0] === 'teilnehmer' ? rechteTeilnehmende(u.permissions) : rechteAusRollen(rollen, rp, v, org)
}

/** Ist die Rolle hier bekannt (vorgegeben oder eigene, auch archiviert)? */
export function rolleBekannt(id: string, org: unknown): boolean {
  return ROLLEN.some(r => r.id === id) || eigeneRollen(org).some(r => r.id === id)
}

export interface Abweichung { dazu: string[]; weg: string[]; unbekannt: string[] }

/**
 * Hat die Person andere Rechte gespeichert, als ihre Rollen geben? (Aus der Zeit, als
 * Rechte einzeln vergeben wurden, oder weil eine Rolle geändert wurde.) dazu: gibt die
 * Rolle, fehlt aber; weg: hat die Person, gibt aber keine Rolle. Der Supervisor ist
 * ausgenommen; Teilnehmende dürfen nur Unitas (aus den Ausbildungen).
 */
export function abweichung(u: MitRollen & { supervisor?: boolean; permissions?: Record<string, boolean> | null },
  rp: Vorlagen | null | undefined, v: Verknuepfungen, org?: unknown): Abweichung | null {
  if (u.supervisor) return null
  const rollen = rollenVon(u)
  const soll = sollRechte(u, rp, v, org)
  const ist = u.permissions || {}
  const dazu = Object.keys(soll).filter(k => soll[k] && ist[k] !== true)
  const weg = Object.keys(soll).filter(k => !soll[k] && ist[k] === true)
  const unbekannt = org ? rollen.filter(id => !rolleBekannt(id, org)) : []
  return dazu.length || weg.length || unbekannt.length ? { dazu, weg, unbekannt } : null
}

/** Rollen als Text in fester Reihenfolge: „Führung, Ausbildung“. Einsatzkraft nur, wenn sonst nichts da ist. */
export function rollenNamen(ids: string[], org: unknown): string {
  const { role, zusatzrollen } = rollenOrdnen(ids)
  const alle = [role, ...zusatzrollen]
  const ohneGrund = alle.length > 1 ? alle.filter(id => id !== 'benutzer') : alle
  return ohneGrund.map(id => rollenBezeichnung(id, org)).join(', ')
}

/** Die Rollen einer Person als Text: „Führung, Ausbildung“ */
export function rollenText(u: MitRollen, org: unknown): string {
  return rollenNamen(rollenVon(u), org)
}

const ZEICHEN = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Neue Kennung "eigen_" + 8 Zeichen; zufall ist für Tests austauschbar */
export function neueRollenId(vorhanden: Iterable<string>, zufall: () => number = Math.random): string {
  const belegt = new Set(vorhanden)
  for (let i = 0; i < 20; i++) {
    let id = 'eigen_'
    for (let j = 0; j < 8; j++) id += ZEICHEN[Math.floor(zufall() * ZEICHEN.length) % ZEICHEN.length]
    if (!belegt.has(id)) return id
  }
  throw new Error('Keine freie Rollen-Kennung gefunden')
}

export type NamensPruefung = { ok: true; name: string } | { ok: false; grund: 'leer' | 'zu_lang' | 'reserviert' | 'vergeben'; text: string }

/** Name einer eigenen Rolle prüfen. ausserId nimmt die Rolle selbst beim Umbenennen aus. */
export function pruefeRollenName(name: string, rollen: EigeneRolle[], ausserId?: string): NamensPruefung {
  const roh = (name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!roh) return { ok: false, grund: 'leer', text: 'Bitte einen Namen eingeben.' }
  if (roh.length > MAX_NAME) return { ok: false, grund: 'zu_lang', text: `Höchstens ${MAX_NAME} Zeichen.` }
  const klein = roh.toLocaleLowerCase('de-DE')
  // Behält eine bestehende eigene Rolle ihren Namen, bleibt er erlaubt — auch wenn es inzwischen
  // eine vorgegebene Rolle gleichen Namens gibt (sonst ließe sie sich nicht mehr speichern)
  if (ausserId && rollen.some(r => r.id === ausserId && r.name.toLocaleLowerCase('de-DE') === klein)) return { ok: true, name: roh }
  const reserviert = [...ROLLEN.flatMap(r => [r.id, r.name]), 'Supervisor', 'Teilnehmer'].map(s => s.toLocaleLowerCase('de-DE'))
  if (reserviert.includes(klein)) return { ok: false, grund: 'reserviert', text: 'So heißt schon eine vorgegebene Rolle.' }
  if (rollen.some(r => r.id !== ausserId && r.name.toLocaleLowerCase('de-DE') === klein)) {
    return { ok: false, grund: 'vergeben', text: 'Eine eigene Rolle heißt schon so.' }
  }
  return { ok: true, name: roh }
}

/** Eine freie Farbe vorschlagen: die erste, die noch keine eigene Rolle trägt */
export function freieFarbe(rollen: EigeneRolle[]): RollenFarbe {
  const belegt = new Set(rollen.filter(r => !r.archiviert).map(r => r.farbe))
  return (ROLLEN_FARBEN.find(f => f.id !== 'bordeaux' && f.id !== 'ardesia' && !belegt.has(f.id))?.id ?? 'senape') as RollenFarbe
}

export function rolleAnlegen(
  rollen: EigeneRolle[], neu: { name: string; hinweis?: string; farbe?: RollenFarbe }, zufall?: () => number,
): { rollen: EigeneRolle[]; id: string } | { fehler: string } {
  if (rollen.filter(r => !r.archiviert).length >= MAX_EIGENE_ROLLEN) return { fehler: `Höchstens ${MAX_EIGENE_ROLLEN} eigene Rollen.` }
  const p = pruefeRollenName(neu.name, rollen)
  if ('text' in p) return { fehler: p.text }
  const id = neueRollenId(rollen.map(r => r.id), zufall)
  const r: EigeneRolle = { id, name: p.name, farbe: neu.farbe && FARB_IDS.includes(neu.farbe) ? neu.farbe : freieFarbe(rollen) }
  const h = sauber(neu.hinweis, MAX_HINWEIS)
  if (h) r.hinweis = h
  return { rollen: [...rollen, r], id }
}

/** Umbenennen, Hinweis und Farbe ändern. Die Kennung bleibt — kein Schreiben an den Benutzern nötig. */
export function rolleAendern(
  rollen: EigeneRolle[], id: string, a: { name?: string; hinweis?: string; farbe?: RollenFarbe },
): { rollen: EigeneRolle[] } | { fehler: string } {
  const alt = rollen.find(r => r.id === id)
  if (!alt) return { fehler: 'Diese Rolle gibt es nicht mehr.' }
  let name = alt.name
  if (a.name !== undefined) {
    const p = pruefeRollenName(a.name, rollen, id)
    if ('text' in p) return { fehler: p.text }
    name = p.name
  }
  const neu: EigeneRolle = { ...alt, name }
  if (a.hinweis !== undefined) {
    const h = sauber(a.hinweis, MAX_HINWEIS)
    if (h) neu.hinweis = h
    else delete neu.hinweis
  }
  if (a.farbe && FARB_IDS.includes(a.farbe)) neu.farbe = a.farbe
  return { rollen: rollen.map(r => (r.id === id ? neu : r)) }
}

/**
 * Rolle entfernen. Hat sie niemand, verschwindet sie samt Vorlage. Haben sie noch
 * Personen, wird sie nur archiviert: nicht mehr wählbar, Name und Vorlage bleiben,
 * an den Personen ändert sich nichts. Vorgegebene Rollen bleiben unberührt.
 */
export function rolleEntfernen(
  rollen: EigeneRolle[], rp: Record<string, Record<string, boolean>>, id: string, anzahlBenutzer: number,
): { rollen: EigeneRolle[]; rolePermissions: Record<string, Record<string, boolean>>; art: 'geloescht' | 'archiviert' | 'nichts' } {
  if (!istEigeneRolleId(id) || !rollen.some(r => r.id === id)) return { rollen, rolePermissions: rp, art: 'nichts' }
  if (anzahlBenutzer > 0) {
    return { rollen: rollen.map(r => (r.id === id ? { ...r, archiviert: true } : r)), rolePermissions: rp, art: 'archiviert' }
  }
  const { [id]: _weg, ...rest } = rp
  return { rollen: rollen.filter(r => r.id !== id), rolePermissions: rest, art: 'geloescht' }
}

export function rolleWiederherstellen(rollen: EigeneRolle[], id: string): EigeneRolle[] {
  return rollen.map(r => {
    if (r.id !== id) return r
    const { archiviert: _a, ...rest } = r
    return rest
  })
}

const BEKANNTE_RECHTE = new Set([...PERM_LABELS.map(p => p.key), ...MODULE.flatMap(m => m.rechte)])

/** Nur bekannte Rechte mit Ja/Nein-Wert — eine Vorlage kann nichts Fremdes einschleusen */
export function vorlageBereinigen(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, w]) => BEKANNTE_RECHTE.has(k) && typeof w === 'boolean')) as Record<string, boolean>
}

/** Nur die angehakten Einträge — zum Ergänzen, ohne Bestehendes mit „nein“ zu überschreiben */
export function nurAngehakt(v: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(v).filter(([, w]) => w === true))
}
