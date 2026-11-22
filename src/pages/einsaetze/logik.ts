// Einsätze (Owner, 22.11.2026): entstehen aus Protokoll und Produktausgabe (pb_hooks/einsaetze.pb.js), dazu
// von Hand verknüpfte Protokolle, Produktausgaben und CIRS-Meldungen, beteiligte Personen und Organisationen.
// Hier die reine Rechnung ohne PocketBase (Prüffälle: src/lib/__tests__/einsaetzeLogik.test.ts).
import { hatRecht } from '../../lib/apps'
import { nummerSchluessel } from '../../lib/einsatzNummer'
import type { User } from '../../types'

export type EinsatzStatus = 'aktiv' | 'abgeschlossen' | 'abgebrochen'
export type VerknuepfungArt = 'protokoll' | 'produktausgabe'
export type Verknuepfung = { art: VerknuepfungArt; id: string }

export interface Einsatz {
  id: string
  unit: string
  keyword?: string
  adresse?: string
  datum: string
  status: EinsatzStatus
  interne_vermerke?: string
  karte_geojson?: string
  organisationen?: unknown
  verknuepfungen?: unknown
  organization_id: string
  created: string
}

export const STATUS_TEXT: Record<EinsatzStatus, string> = { aktiv: 'Läuft', abgeschlossen: 'Abgeschlossen', abgebrochen: 'Abgebrochen' }

export const ROLLEN_IM_EINSATZ = [
  'Teamführer', 'Notfallsanitäter', 'Rettungssanitäter', 'Rettungsassistent',
  'Fahrzeugführer', 'Maschinist', 'Fahrer', 'Atemschutz', 'Melder', 'Sonstiges',
]

const ORG_MAX = 20
const ORG_LAENGE = 80

function jsonLesen(x: unknown): unknown {
  let v = x
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { return null }
  }
  return v
}

/** Beteiligte Organisationen: Liste von Namen, ohne Doppelte (Groß/Klein egal), höchstens 20. */
export function organisationenLesen(x: unknown): string[] {
  const v = jsonLesen(x)
  if (!Array.isArray(v)) return []
  const aus: string[] = []
  for (const e of v) {
    const n = typeof e === 'string' ? e.replace(/\s+/g, ' ').trim().slice(0, ORG_LAENGE) : ''
    if (n && !aus.some((a) => a.toLowerCase() === n.toLowerCase())) aus.push(n)
    if (aus.length >= ORG_MAX) break
  }
  return aus
}

export function organisationDazu(liste: string[], name: string): string[] {
  return organisationenLesen([...liste, name])
}

export function organisationWeg(liste: string[], name: string): string[] {
  return liste.filter((n) => n.toLowerCase() !== name.toLowerCase())
}

/** Vorschläge: Organisationen aus anderen Einsätzen, die hier noch fehlen, die häufigsten zuerst. */
export function organisationVorschlaege(einsaetze: Pick<Einsatz, 'organisationen'>[], schon: string[], max = 8): string[] {
  const zahl = new Map<string, { name: string; n: number }>()
  for (const e of einsaetze) for (const n of organisationenLesen(e.organisationen)) {
    const k = n.toLowerCase()
    const z = zahl.get(k)
    if (z) z.n++
    else zahl.set(k, { name: n, n: 1 })
  }
  const vorhanden = new Set(schon.map((s) => s.toLowerCase()))
  return [...zahl.entries()].filter(([k]) => !vorhanden.has(k)).sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name, 'de')).slice(0, max).map(([, z]) => z.name)
}

/** Von Hand verknüpfte Dokumente (nur Protokoll und Produktausgabe; CIRS steht an der Meldung selbst). */
export function verknuepfungenLesen(x: unknown): Verknuepfung[] {
  const v = jsonLesen(x)
  if (!Array.isArray(v)) return []
  const aus: Verknuepfung[] = []
  for (const e of v) {
    if (!e || typeof e !== 'object') continue
    const art = (e as { art?: unknown }).art
    const id = (e as { id?: unknown }).id
    if ((art === 'protokoll' || art === 'produktausgabe') && typeof id === 'string' && /^[a-z0-9]{15}$/.test(id) && !aus.some((a) => a.art === art && a.id === id)) {
      aus.push({ art, id })
    }
  }
  return aus.slice(0, 200)
}

export function verknuepfen(liste: Verknuepfung[], art: VerknuepfungArt, id: string): Verknuepfung[] {
  return verknuepfungenLesen([...liste, { art, id }])
}

export function loesen(liste: Verknuepfung[], art: VerknuepfungArt, id: string): Verknuepfung[] {
  return liste.filter((v) => !(v.art === art && v.id === id))
}

function payloadVon(x: unknown): Record<string, unknown> {
  const v = jsonLesen(x)
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** Einsatznummer eines Protokolls (neue Maske: einsatz_nr, alte Protokolle: unit). */
export function nummerProtokoll(payload: unknown): string {
  const p = payloadVon(payload)
  return String(p.einsatz_nr ?? p.unit ?? '')
}

/** Einsatznummer einer Produktausgabe. */
export function nummerAusgabe(payload: unknown): string {
  return String(payloadVon(payload).einsatz ?? '')
}

export type Zuordnung = 'nummer' | 'hand'

/** Über die Nummer gehört ein Dokument nur dazu, wenn es höchstens so weit vom Einsatz entfernt ist (wie GLEICH_TAGE im Hook). */
export const NUMMER_TAGE = 60

/**
 * Welche Dokumente gehören zum Einsatz: über die gleiche Einsatznummer (automatisch) oder von Hand
 * verknüpft. Gibt je Dokument an, woher die Zuordnung kommt; ein Dokument steht nur einmal da.
 */
export function zugeordnet<T extends { id: string; payload?: unknown; created?: string }>(
  einsatz: Pick<Einsatz, 'unit' | 'verknuepfungen'> & { datum?: string; created?: string }, art: VerknuepfungArt, dokumente: T[],
): { dok: T; wie: Zuordnung }[] {
  const nr = nummerSchluessel(einsatz.unit)
  // Nummern wiederholen sich (jedes Jahr, oder 17 im März und 17 im November): nur in der Nähe des Einsatzes
  const bezug = zeit(einsatz.datum) || zeit(einsatz.created)
  const nah = (d: T) => { const t = zeit(d.created); return isNaN(bezug) || isNaN(t) || Math.abs(t - bezug) <= NUMMER_TAGE * 864e5 }
  const hand = new Set(verknuepfungenLesen(einsatz.verknuepfungen).filter((v) => v.art === art).map((v) => v.id))
  const nummer = art === 'protokoll' ? nummerProtokoll : nummerAusgabe
  const aus: { dok: T; wie: Zuordnung }[] = []
  for (const d of dokumente) {
    if (nr && nummerSchluessel(nummer(d.payload)) === nr && nah(d)) aus.push({ dok: d, wie: 'nummer' })
    else if (hand.has(d.id)) aus.push({ dok: d, wie: 'hand' })
  }
  return aus
}

/** CIRS-Meldungen sehen und verknüpfen nur, wer CIRS lesen darf (Regel der Sammlung cirs_reports). */
export function darfCirs(user: User | null): boolean {
  return !!user && (user.supervisor === true || user.permissions?.dokumente === true)
}

/** Patientennamen nur, wer Protokolle ohnehin verwalten darf; sonst Datum und Besatzung. */
export function darfPatientennamen(user: User | null): boolean {
  return !!user && (user.supervisor === true || user.role === 'admin' || hatRecht(user, 'patienten'))
}

/** Einsätze verwalten und löschen: Leitung, Recht Einsätze (auch befristet), Supervisor. */
export function darfVerwalten(user: User | null): boolean {
  return !!user && (user.supervisor === true || user.role === 'admin' || hatRecht(user, 'einsaetze'))
}

function zeit(s: string | undefined | null): number {
  if (!s) return NaN
  let t = s.trim().replace(' ', 'T')
  if (!/Z$|[+-]\d{2}:\d{2}$/.test(t)) t += 'Z'
  return new Date(t).getTime()
}

/** Anzeige-Titel: Stichwort, sonst „Einsatz <Nummer>“. */
export function titel(e: Pick<Einsatz, 'keyword' | 'unit'>): string {
  const k = (e.keyword || '').trim()
  if (k) return k
  const n = (e.unit || '').trim()
  return n ? `Einsatz ${n}` : 'Einsatz'
}

/** Suchen über Nummer, Stichwort, Adresse und Organisationen. */
export function passt(e: Einsatz, suche: string): boolean {
  const q = suche.trim().toLowerCase()
  if (!q) return true
  const text = [e.unit, e.keyword, e.adresse, ...organisationenLesen(e.organisationen)].join(' ').toLowerCase()
  return q.split(/\s+/).every((w) => text.includes(w))
}

/** Liste in Gruppen: laufende oben, dann je Monat, neueste zuerst. */
export function gruppieren(einsaetze: Einsatz[]): { titel: string; einsaetze: Einsatz[] }[] {
  const sortiert = [...einsaetze].sort((a, b) => (zeit(b.datum) || zeit(b.created) || 0) - (zeit(a.datum) || zeit(a.created) || 0))
  const laufend = sortiert.filter((e) => e.status === 'aktiv')
  const gruppen: { titel: string; einsaetze: Einsatz[] }[] = laufend.length ? [{ titel: 'Laufend', einsaetze: laufend }] : []
  for (const e of sortiert.filter((x) => x.status !== 'aktiv')) {
    const t = zeit(e.datum) || zeit(e.created)
    const monat = isNaN(t) ? 'Ohne Datum' : new Date(t).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    const g = gruppen.find((x) => x.titel === monat)
    if (g) g.einsaetze.push(e)
    else gruppen.push({ titel: monat, einsaetze: [e] })
  }
  return gruppen
}

export function datumText(s: string | undefined | null): string {
  const t = zeit(s)
  if (isNaN(t)) return ''
  const d = new Date(t)
  const tag = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
  // Aus der Dokumentation kommt nur ein Tag (der Hook setzt 12:00 UTC): keine Uhrzeit erfinden
  if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) return tag
  return `${tag}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}

/** Gibt es diese Nummer schon (ohne Rücksicht auf Leerzeichen und Groß/Klein)? ausser: der Einsatz, der gerade bearbeitet wird. */
export function nummerVergeben(einsaetze: Pick<Einsatz, 'id' | 'unit'>[], nummer: string, ausser = ''): boolean {
  const s = nummerSchluessel(nummer)
  return !!s && einsaetze.some((e) => e.id !== ausser && nummerSchluessel(e.unit) === s)
}

/** Neue Einsatznummer, wenn beim Anlegen keine eingetragen ist. */
export function neueNummer(jetzt: Date, zufall: () => number, einsaetze: Pick<Einsatz, 'id' | 'unit'>[] = []): string {
  for (let i = 0; i < 50; i++) {
    const n = `E-${jetzt.getFullYear()}-${String(Math.floor(zufall() * 90000) + 10000)}`
    if (!nummerVergeben(einsaetze, n)) return n
  }
  return `E-${jetzt.getFullYear()}-${jetzt.getTime()}`
}
