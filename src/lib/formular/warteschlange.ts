// Warteschlange der Formulare auf dem Gerät (Bauplan v2, 1.18).
//
// Was ohne Netz, bei zu vielen Anfragen oder ohne Passwort nicht rausgeht,
// liegt unter `formular_warteschlange_<orgCode>` in localStorage, als Liste von
// `Warteeintrag`. NIE ein Passwort, nie ein Token: `ablegen` und `aktualisieren`
// entfernen jeden Schlüssel `passwort`/`password` in jeder Tiefe.
//
// Die alte Warteschlange `offline_queue_<orgCode>` (ältere App-Stände) wird bei
// jedem Lesen übernommen: erst neu schreiben, dann den alten Schlüssel löschen.
// Die Kennung eines übernommenen Eintrags entsteht aus seinem Inhalt; so
// erzeugt ein zweites Übernehmen (zwei Fenster, ein Löschen, das scheiterte)
// keinen zweiten Satz, sondern dieselbe Kennung, die der Server als
// `bereits: true` erkennt.
//
// Keine Imports aus React oder PocketBase (nur Typen).

import type { FormularId } from './absender'
import type { Grund, Maske, Speicher } from './api'

export type { Speicher } from './api'

/** Ein Eintrag der Warteschlange (Format 1.18, für alle Client-Teile). Nie ein Passwort, nie ein Token. */
export type Warteeintrag = {
  v: 2
  /** Kennung des neuen Satzes, 15 × [a-z0-9]; bleibt über alle Versuche, neu nur nach 409 `kennung`. */
  id: string
  formular: FormularId
  maske?: Maske
  orgCode: string
  /** organizations.id, für den alten Weg. */
  orgId: string
  /** ISO, Gerätezeit der Ablage. */
  angelegt: string
  /** In der Karte änderbar. */
  absenderName: string
  /** users.id, wenn angemeldet gesendet werden soll, sonst ''. */
  angemeldetId: string
  /** Genau der Teil `daten` der Route (1.5). */
  daten: Record<string, unknown>
  /** Nur produktausgabe und defektmeldung: der Satz für den alten Weg ohne id. */
  alt?: Record<string, unknown>
  /** Aus offline_queue_<org> übernommen. */
  uebernommen?: boolean
  versuche: number
  /** ISO: erstmals online nach dem Passwort gefragt. */
  gefragtAb?: string
  /** ISO: frühestens dann wieder senden (nach 429 oder einem bleibenden Fehler). */
  naechsterVersuchAb?: string
  /** Ergebnis der letzten Namensprüfung zu absenderName. */
  nameEindeutig?: boolean
  letzterFehler?: { grund: Grund; text: string; am: string; feld?: string }
  /** Nach 409 aenderung_alt: Kennung des Protokolls, in das die Änderung gehört. */
  ziel?: string
}

/** Was eine Maske zum Ablegen übergibt; `v`, `versuche` und `angelegt` setzt `ablegen`. */
export type NeuerEintrag = Omit<Warteeintrag, 'v' | 'versuche' | 'angelegt'>

/** Schlüssel der Warteschlange: formular_warteschlange_<orgCode>. */
export const SCHLUESSEL_PREFIX = 'formular_warteschlange_'
/** Schlange älterer App-Stände; wird beim Lesen übernommen. */
export const ALTER_PREFIX = 'offline_queue_'
/** Nach so langer sichtbarer Passwortfrage geht ein Eintrag bei eindeutigem Namen als „ausstehend“ raus. */
export const OHNE_PASSWORT_NACH_MS = 60 * 60 * 1000

const FORMULARE: FormularId[] = ['patienten', 'produktausgabe', 'defektmeldung']
const MASKEN: Maske[] = ['doku', 'alt', 'schnell']

/** Schlüssel der Warteschlange einer Organisation in localStorage. */
export function schluessel(orgCode: string): string {
  return SCHLUESSEL_PREFIX + orgCode
}

/** Kopie ohne jeden Schlüssel `passwort`/`password` (gleich welche Schreibweise), in jeder Tiefe. */
export function ohnePasswort<T>(wert: T): T {
  const weg = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(weg)
    if (x && typeof x === 'object') {
      const aus: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
        const kl = k.toLowerCase()
        if (kl === 'passwort' || kl === 'password') continue
        aus[k] = weg(v)
      }
      return aus
    }
    return x
  }
  return weg(wert) as T
}

function istObjekt(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

/** Ist das ein lesbarer Eintrag? Kaputtes wird überlesen. */
export function eintragGueltig(x: unknown): x is Warteeintrag {
  if (!istObjekt(x)) return false
  const e = x as Partial<Warteeintrag>
  return e.v === 2
    && typeof e.id === 'string' && /^[a-z0-9]{15}$/.test(e.id)
    && FORMULARE.includes(e.formular as FormularId)
    && (e.maske === undefined || MASKEN.includes(e.maske))
    && typeof e.orgCode === 'string'
    && typeof e.orgId === 'string'
    && typeof e.angelegt === 'string'
    && typeof e.absenderName === 'string'
    && typeof e.angemeldetId === 'string'
    && istObjekt(e.daten)
    && typeof e.versuche === 'number'
}

/** Rohliste lesen. `ok: false` heißt: der Speicher warf; dann nichts schreiben. `da`: der Schlüssel existiert. */
function lesenRoh(s: Speicher, key: string): { ok: boolean; da: boolean; liste: unknown[] } {
  let roh: string | null
  try { roh = s.getItem(key) } catch { return { ok: false, da: false, liste: [] } }
  if (roh === null) return { ok: true, da: false, liste: [] }
  try {
    const l: unknown = JSON.parse(roh)
    return { ok: true, da: true, liste: Array.isArray(l) ? l : [] }
  } catch {
    return { ok: true, da: true, liste: [] }
  }
}

function schreiben(s: Speicher, orgCode: string, liste: Warteeintrag[]): boolean {
  try {
    if (liste.length === 0) s.removeItem(schluessel(orgCode))
    else s.setItem(schluessel(orgCode), JSON.stringify(liste.map(ohnePasswort)))
    return true
  } catch {
    return false
  }
}

// ── Übernahme aus offline_queue_<org> ───────────────────────────────────────

/** Kanonisches JSON (sortierte Schlüssel), damit derselbe Inhalt dieselbe Kennung ergibt. */
function kanonisch(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x ?? null)
  if (Array.isArray(x)) return '[' + x.map(kanonisch).join(',') + ']'
  const o = x as Record<string, unknown>
  return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + kanonisch(o[k])).join(',') + '}'
}

function streuwert(text: string, saat: number): number {
  let h1 = 0xdeadbeef ^ saat, h2 = 0x41c6ce57 ^ saat
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** Kennung (15 × [a-z0-9]) aus dem Inhalt eines alten Eintrags: gleich bei jedem Übernehmen. */
export function kennungAusInhalt(orgCode: string, alt: unknown): string {
  const t = orgCode + '\n' + kanonisch(alt)
  const a = streuwert(t, 1).toString(36).padStart(11, '0')
  const b = streuwert(t, 2).toString(36).padStart(11, '0')
  return (a + b).slice(-15)
}

function istAlterVoll(x: unknown): x is { type: 'full'; title: string; organization_id: string; payload?: unknown; draftId?: unknown } {
  return istObjekt(x) && x.type === 'full' && typeof x.title === 'string' && typeof x.organization_id === 'string'
}

/** Flache Felder der Besatzung je Posten (wie POSTEN in doku/besatzung.ts). */
const BESATZUNG: [string, string][] = [['tf', 'mannschaft_tf'], ['m1', 'mannschaft_1'], ['m2', 'mannschaft_2'], ['m3', 'mannschaft_3']]

function nameAus(x: unknown): string {
  return istObjekt(x) && typeof x.name === 'string' ? x.name.trim() : ''
}

/** Die Namen der Besatzung aus `payload.mannschaft` (alte Maske), je Posten; leer, wenn niemand. */
function besatzungsNamen(payload: unknown): Record<string, string> {
  const p = istObjekt(payload) ? payload : {}
  const m = istObjekt(p.mannschaft) ? p.mannschaft : {}
  const aus: Record<string, string> = {}
  for (const [pos] of BESATZUNG) { const n = nameAus(m[pos]); if (n) aus[pos] = n }
  return aus
}

/** Steht im payload schon jemand in der Besatzung (flach oder verschachtelt)? */
function hatBesatzung(payload: Record<string, unknown>): boolean {
  if (Object.keys(besatzungsNamen(payload)).length > 0) return true
  return BESATZUNG.some(([, feld]) => typeof payload[feld] === 'string' && (payload[feld] as string).trim() !== '')
}

/**
 * Einen Eintrag `type: 'full'` der alten Schlange als Warteeintrag (1.18, Übernahme).
 * `besatzung`: die Namen aus einem `type: 'draft'` davor (die alte Maske speicherte die
 * Besatzung ohne Netz nur dort). Sie kommen als flache Namen in einen payload ohne Besatzung;
 * Kennungen übernimmt die App nie, verknüpfen tut der Server. Die Kennung des Eintrags
 * entsteht aus dem alten Eintrag allein und bleibt so bei jedem Übernehmen gleich.
 */
export function alterEintrag(orgCode: string, alt: unknown, jetzt = new Date(), besatzung: Record<string, string> | null = null): Warteeintrag | null {
  if (!istAlterVoll(alt)) return null
  const payload: Record<string, unknown> = istObjekt(alt.payload) ? { ...alt.payload } : {}
  if (besatzung && Object.keys(besatzung).length > 0 && !hatBesatzung(payload)) {
    for (const [pos, feld] of BESATZUNG) if (besatzung[pos]) payload[feld] = besatzung[pos]
  }
  const name = typeof payload.unterschrift === 'string' && payload.unterschrift.trim()
    ? payload.unterschrift
    : typeof payload.ausfueller_name === 'string' ? payload.ausfueller_name : ''
  const abgesendet = typeof payload.abgesendet === 'string' && Number.isFinite(Date.parse(payload.abgesendet)) ? payload.abgesendet : ''
  return ohnePasswort({
    v: 2,
    id: kennungAusInhalt(orgCode, alt),
    formular: 'patienten',
    maske: payload.schnelldoku ? 'schnell' : ('draftId' in alt ? 'alt' : 'doku'),
    orgCode,
    orgId: alt.organization_id,
    angelegt: abgesendet ? new Date(Date.parse(abgesendet)).toISOString() : jetzt.toISOString(),
    absenderName: typeof name === 'string' ? name : '',
    angemeldetId: '',
    daten: { title: alt.title, payload },
    uebernommen: true,
    versuche: 0,
  })
}

/**
 * Die alte Schlange übernehmen: jeder `full`-Eintrag wird ein Warteeintrag; die Besatzung
 * eines `draft`-Eintrags derselben Organisation geht in den nächsten `full`-Eintrag danach
 * (so legte die alte Maske ohne Netz ab: erst die Besatzung, dann das Protokoll). Ein `draft`
 * ohne folgendes Protokoll trägt nur Namen und wird verworfen.
 */
function alteUebernehmen(orgCode: string, liste: unknown[], jetzt = new Date()): Warteeintrag[] {
  const aus: Warteeintrag[] = []
  let besatzung: Record<string, string> | null = null
  for (const x of liste) {
    if (istObjekt(x) && x.type === 'draft') {
      const n = besatzungsNamen(x.payload)
      if (Object.keys(n).length > 0) besatzung = n
      continue
    }
    const e = alterEintrag(orgCode, x, jetzt, besatzung)
    if (e) { aus.push(e); besatzung = null }
  }
  return aus
}

/** Kennungen, die die alte Schlange einer Organisation beim Übernehmen bekäme (für anzahlAlle). */
function alteKennungen(orgCode: string, liste: unknown[]): string[] {
  return liste.filter(istAlterVoll).map((e) => kennungAusInhalt(orgCode, e))
}

/**
 * Alle Einträge der Organisation, in der Reihenfolge der Ablage; kaputte
 * werden überlesen. Übernimmt dabei die alte Schlange `offline_queue_<org>`
 * (die Besatzung eines `type: 'draft'` geht als Namen in das Protokoll danach,
 * siehe alteUebernehmen). Scheitert das Schreiben,
 * bleibt die alte Schlange, wie sie ist, und ihre Einträge fehlen hier.
 * Speicher wirft: [].
 */
export function eintraege(s: Speicher, orgCode: string): Warteeintrag[] {
  const neu = lesenRoh(s, schluessel(orgCode))
  if (!neu.ok) return []
  const liste = neu.liste.filter(eintragGueltig)
  const alt = lesenRoh(s, ALTER_PREFIX + orgCode)
  if (!alt.ok || !alt.da) return liste
  const vorhanden = new Set(liste.map((e) => e.id))
  const uebernommen = alteUebernehmen(orgCode, alt.liste)
    .filter((e) => !vorhanden.has(e.id) && (vorhanden.add(e.id), true))
  const gesamt = [...liste, ...uebernommen]
  if (uebernommen.length > 0 && !schreiben(s, orgCode, gesamt)) return liste
  try { s.removeItem(ALTER_PREFIX + orgCode) } catch { /* beim nächsten Lesen erneut, gleiche Kennungen */ }
  return gesamt
}

/** Einen Eintrag nach Kennung, oder null. */
export function eintrag(s: Speicher, orgCode: string, id: string): Warteeintrag | null {
  return eintraege(s, orgCode).find((e) => e.id === id) ?? null
}

/**
 * Einen Eintrag ablegen. Liegt schon einer mit derselben Kennung, wird er
 * ersetzt (dieselbe Maske hat erneut ohne Netz gesendet); Reihenfolge und
 * `angelegt` bleiben dann. Gibt false zurück, wenn der Speicher wirft.
 */
export function ablegen(s: Speicher, e: NeuerEintrag, jetzt = new Date()): boolean {
  try {
    const roh = lesenRoh(s, schluessel(e.orgCode))
    if (!roh.ok) return false
    const liste = eintraege(s, e.orgCode)
    const neu: Warteeintrag = ohnePasswort({ ...e, v: 2, angelegt: jetzt.toISOString(), versuche: 0 } as Warteeintrag)
    if (!eintragGueltig(neu)) return false
    const i = liste.findIndex((x) => x.id === neu.id)
    if (i >= 0) liste[i] = { ...neu, angelegt: liste[i].angelegt }
    else liste.push(neu)
    return schreiben(s, e.orgCode, liste)
  } catch {
    return false
  }
}

/**
 * Einen Eintrag ändern (Name, Kennung nach 409, Fehler, Wartezeit). Die
 * Funktion bekommt eine Kopie; was sie zurückgibt, wird ohne Passwort
 * gespeichert. Kein Eintrag mit dieser Kennung: nichts. Gibt zurück, ob gespeichert wurde.
 */
export function aktualisieren(s: Speicher, orgCode: string, id: string, aendern: (e: Warteeintrag) => Warteeintrag): boolean {
  try {
    const liste = eintraege(s, orgCode)
    const i = liste.findIndex((x) => x.id === id)
    if (i < 0) return false
    const neu = ohnePasswort({ ...aendern(JSON.parse(JSON.stringify(liste[i])) as Warteeintrag), v: 2 as const })
    if (!eintragGueltig(neu)) return false
    liste[i] = neu
    return schreiben(s, orgCode, liste)
  } catch {
    return false
  }
}

/** Einen Eintrag entfernen (nach Erfolg oder ausdrücklichem „Verwerfen“). Gibt zurück, ob gespeichert wurde. */
export function entfernen(s: Speicher, orgCode: string, id: string): boolean {
  try {
    if (!lesenRoh(s, schluessel(orgCode)).ok) return false
    const liste = eintraege(s, orgCode)
    const rest = liste.filter((x) => x.id !== id)
    if (rest.length === liste.length) return true
    return schreiben(s, orgCode, rest)
  } catch {
    return false
  }
}

/**
 * Wie viele Formulare auf dem Gerät warten: neue und alte Schlange, alle
 * Organisationen (Warnung beim Abmelden). Ein alter Eintrag, der schon
 * übernommen ist, zählt einmal.
 */
export function anzahlAlle(s: Pick<Storage, 'length' | 'key' | 'getItem'>): number {
  const neu = new Map<string, Set<string>>()
  const alt = new Map<string, unknown[]>()
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (!k) continue
      const istNeu = k.startsWith(SCHLUESSEL_PREFIX)
      if (!istNeu && !k.startsWith(ALTER_PREFIX)) continue
      let liste: unknown
      try { liste = JSON.parse(s.getItem(k) || '[]') } catch { continue }
      if (!Array.isArray(liste)) continue
      if (istNeu) neu.set(k.slice(SCHLUESSEL_PREFIX.length), new Set(liste.filter(eintragGueltig).map((e) => e.id)))
      else alt.set(k.slice(ALTER_PREFIX.length), liste)
    }
  } catch { /* Speicher unlesbar: zählen, was da war */ }
  let n = 0
  for (const ids of neu.values()) n += ids.size
  for (const [org, liste] of alt) {
    const da = neu.get(org) ?? new Set<string>()
    n += alteKennungen(org, liste).filter((id) => !da.has(id)).length
  }
  return n
}
