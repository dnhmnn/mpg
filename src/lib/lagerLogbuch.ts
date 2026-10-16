// Das Lager-Logbuch lesen: Journalzeilen (inventory_transactions) einordnen,
// zu Vorgängen zusammenfassen, Rücknahmen ihren Originalen zuordnen und den
// Abfragefilter bauen. Reine Rechnung, ohne React und ohne Netz — die Anzeige
// steht in src/components/LagerLogbuch.tsx, die Prüffälle in
// src/lib/__tests__/lagerLogbuch.test.ts.
//
// Das Journal enthält zwei Generationen von Notizen:
// - NEU (src/lib/lagerBuchung.ts): Teile mit " · " verbunden, je Charge eine
//   Zeile, alle Zeilen einer Buchung mit derselben Vorgangs-Nummer (vorgang),
//   Rücknahmen mit Verweis auf das Original (storno_von).
// - ALT (vor dieser Änderung): eine Zeile je Anfrage, ohne vorgang und
//   storno_von, Produktausgabe und Rückruf in eigener Schreibweise.
// Beide müssen gelesen werden. Wo vorgang fehlt (Altbestand, oder das Feld
// gibt es in PocketBase noch nicht), fasst eine Zeitnähe-Regel zusammen —
// immer nur Zeilen derselben Person.
//
// Die Bausteine der Notizen kommen aus NOTIZ (lagerRechnung.ts), damit
// Schreiber und Leser dieselben Texte benutzen.

import { NOTIZ, istUmlagerung } from './lagerRechnung'

export interface LogZeile {
  id: string; created: string; item_id: string; location_id: string; type: string; quantity: number
  batch?: string | null; expiry_date?: string | null; stock_id?: string | null; einsatz?: string | null
  note?: string | null; user?: string | null; vorgang?: string | null; storno_von?: string | null
}

/**
 * 'gemischt' gibt es nur für Vorgänge: eine Buchung mit Zu- UND Abgängen (ohne
 * Umlagerung), etwa vom KI-Assistenten oder als Mehrfachbuchung — weder Ein- noch
 * Ausbuchung. Eine einzelne Zeile ist nie 'gemischt'.
 */
export type LogArt = 'einbuchung' | 'ausbuchung' | 'produktausgabe' | 'umlagerung' | 'rueckruf' | 'inventur' | 'korrektur' | 'import' | 'rueckgaengig' | 'gemischt'

export interface Einordnung {
  /** Rücknahme hat art 'rueckgaengig'; ihre Ursprungsart steht in urArt. */
  art: LogArt
  urArt: Exclude<LogArt, 'rueckgaengig' | 'gemischt'>
  ruecknahme: boolean
  /** "offline erfasst" */
  offline: boolean
  /** "ohne Chargenzuordnung" (Rest ohne Bestand) */
  ohneCharge: boolean
  /** batch-Feld, sonst aus der Notiz ("Charge B7") */
  charge?: string
  /**
   * Nur ein Teil aus dieser Charge: "2 aus Charge B7, Rest aus weiteren" (Inventur
   * über mehrere Chargen). Ist bewusst NICHT charge — die Zeile gehört nicht
   * insgesamt zu B7.
   */
  teilCharge?: { menge: number; charge: string }
  /** einsatz-Feld, sonst aus der Notiz (alt: Produktausgabe) */
  einsatz?: string
  /** Produktausgabe: an wen */
  empfaenger?: string
  /** Umlagerung: Name des anderen Standorts */
  gegenstelle?: string
  /** Umlagerung aus Sicht dieser Zeile */
  richtung?: 'nach' | 'von'
  inventur?: { von: number; nach: number }
  /** Was nach Abzug aller erkannten Teile übrig bleibt (für "Notiz: …"). */
  restNotiz: string
}

export interface Vorgang {
  /** 'v:'+vorgang | heuristischer Schlüssel ('m:', 'p:', 'u:', 'c:', 'r:', 'i:' + ID der ersten Zeile) | 'e:'+id */
  schluessel: string
  /** true nur bei Feld vorgang */
  sicher: boolean
  /** aufsteigend nach (created, id) */
  zeilen: LogZeile[]
  /** dominante Art (Inventur-Sammelkarte → 'inventur') */
  art: LogArt
  /** created der jüngsten Zeile */
  zeit: string
  /** tagSchluessel(zeit) */
  tag: string
  user?: string | null
}

export interface LogFilter {
  orgId: string
  locationId?: string | null
  ab?: Date | null
  itemId?: string | null
  art?: 'alle' | 'ausbuchung' | 'einbuchung' | 'umlagerung' | 'inventur' | 'rueckruf' | 'pruefen'
  nurMeine?: { email?: string; id?: string } | null
  suche?: { q: string; itemIds: string[]; userIds: string[] } | null
  /** "Einsatz zeigen": genau dieser Einsatz (Feld oder Notiz) — nicht die Volltextsuche. */
  einsatz?: string | null
  /** "Charge verfolgen": genau diese Charge (Feld oder Notiz) — nicht die Volltextsuche. */
  charge?: string | null
  /** Keyset "Ältere laden": nur Zeilen vor dieser (Sortierung '-created,-id'). */
  vor?: { created: string; id: string } | null
}

/** Höchstzahl der Artikel- bzw. Personen-Kennungen in der Suche (Länge des Filters). */
export const SUCHE_MAX = { artikel: 30, kennungen: 10 } as const

// ── Zeit ─────────────────────────────────────────────────────────────────────

/**
 * PocketBase liefert "2026-10-16 14:32:07.120Z". Ältere WebKit-Versionen (iOS)
 * lesen das nur mit "T" — deshalb jede Datumsanzeige über diese Funktion.
 */
export function pbZeit(s: string): Date {
  return new Date((s || '').replace(' ', 'T'))
}

const zwei = (n: number) => String(n).padStart(2, '0')

/** Lokaler Kalendertag (Ortszeit des Geräts) als "YYYY-MM-DD". */
export function tagSchluessel(created: string): string {
  const d = pbZeit(created)
  if (!Number.isFinite(d.getTime())) return (created || '').slice(0, 10)
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
}

function zeitMs(created: string): number {
  const t = pbZeit(created).getTime()
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY
}

/** Aufsteigend nach (created, id) — die Reihenfolge, in der gebucht wurde. */
function aufsteigend(a: LogZeile, b: LogZeile): number {
  const ta = zeitMs(a.created), tb = zeitMs(b.created)
  if (ta !== tb) return ta < tb ? -1 : 1
  if (a.created !== b.created) return (a.created || '') < (b.created || '') ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

/** Dieselbe Zeile kann doppelt kommen (Seite 1 und Seite 2 überlappen) — die erste gilt. */
function eindeutig(zeilen: LogZeile[]): LogZeile[] {
  const gesehen = new Set<string>()
  const aus: LogZeile[] = []
  for (const z of zeilen) {
    if (!z || gesehen.has(z.id)) continue
    gesehen.add(z.id)
    aus.push(z)
  }
  return aus
}

// ── Einordnen ────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ZAHL = '(-?\\d+(?:[.,]\\d+)?)'
const zahl = (s: string) => Number(s.replace(',', '.'))

const RE_CHARGE = /^Charge\s+(.+)$/
const RE_TEILCHARGE = /^(\d+(?:[.,]\d+)?)\s+aus\s+Charge\s+(.+?),\s*Rest aus weiteren$/
const RE_EINSATZ = /^Einsatz\s+(.+)$/
const RE_EMPFAENGER = /^an\s+(.+)$/
const RE_INVENTUR = new RegExp(`^${esc(NOTIZ.inventur)}:\\s*${ZAHL}\\s*→\\s*${ZAHL}\\s*(.*)$`)
// Alt: "Produktausgabe E-2026-0147 – Max Muster" (Einsatz konnte leer oder "undefined" sein)
const RE_AUSGABE_ALT = new RegExp(`^${esc(NOTIZ.produktausgabe)}\\s+(.*?)\\s+[–-](?:\\s+(.*))?$`)
// Alt: "Rückruf Charge B7"
const RE_RUECKRUF_ALT = new RegExp(`^${esc(NOTIZ.rueckruf)}\\s+Charge\\s+(.+)$`)

/** Ein Notiz-Teil, der nur Charge, Einsatz oder "ohne Chargenzuordnung" sagt. */
function istBezugsTeil(t: string): boolean {
  return RE_CHARGE.test(t) || RE_TEILCHARGE.test(t) || RE_EINSATZ.test(t) || t.startsWith(NOTIZ.ohneCharge)
}

/** "Charge ohne Charge" schreibt die Inventur, wenn die gewählte Zeile keine Charge hat. */
function echteCharge(c: string | undefined): string | undefined {
  const t = (c || '').trim()
  return t && t !== 'ohne Charge' ? t : undefined
}

function teileVon(note: string | null | undefined): string[] {
  return (note || '').split(/\s*·\s*/).map(t => t.trim()).filter(Boolean)
}

interface Zerlegt {
  e: Einordnung
  /** Notiz ohne Charge-/Einsatz-/ohne-Charge-Teile — für die Zeitnähe-Regel. */
  stamm: string
}

function zerlege(z: LogZeile): Zerlegt {
  const alle = teileVon(z.note)
  const stamm = alle.filter(t => !istBezugsTeil(t)).join(' · ')
  const teile = [...alle]

  let ruecknahme = !!(z.storno_von || '').trim()
  if (teile[0] === NOTIZ.rueckgaengig) { ruecknahme = true; teile.shift() }
  let offline = false
  if (teile[0] === NOTIZ.offline) { offline = true; teile.shift() }

  let urArt: Einordnung['urArt']
  let chargeNotiz: string | undefined
  let teilNotiz: { menge: number; charge: string } | undefined
  let einsatzNotiz: string | undefined
  let empfaenger: string | undefined
  let gegenstelle: string | undefined
  let richtung: Einordnung['richtung']
  let inventur: Einordnung['inventur']
  const rest: string[] = []

  const kopf = teile.length ? teile[0] : ''
  let m: RegExpExecArray | null
  if (kopf && istUmlagerung(kopf)) {
    urArt = 'umlagerung'
    teile.shift()
    if (kopf.startsWith(NOTIZ.umlagerungNach)) {
      richtung = 'nach'
      gegenstelle = kopf.slice(NOTIZ.umlagerungNach.length).trim() || undefined
    } else if (kopf.startsWith(NOTIZ.umlagerungVon)) {
      richtung = 'von'
      gegenstelle = kopf.slice(NOTIZ.umlagerungVon.length).trim() || undefined
    }
  } else if (kopf.startsWith(NOTIZ.produktausgabe)) {
    urArt = 'produktausgabe'
    teile.shift()
    if (kopf !== NOTIZ.produktausgabe) {
      if ((m = RE_AUSGABE_ALT.exec(kopf))) {
        const e = m[1].trim()
        if (e && e !== 'undefined' && e !== 'null') einsatzNotiz = e
        const name = (m[2] || '').trim()
        if (name) empfaenger = name
      } else {
        const uebrig = kopf.slice(NOTIZ.produktausgabe.length).trim()
        if (uebrig) rest.push(uebrig)
      }
    }
  } else if (kopf.startsWith(NOTIZ.rueckruf)) {
    urArt = 'rueckruf'
    teile.shift()
    if ((m = RE_RUECKRUF_ALT.exec(kopf))) chargeNotiz = m[1].trim()
    else if (kopf !== NOTIZ.rueckruf) rest.push(kopf.slice(NOTIZ.rueckruf.length).trim())
  } else if ((m = RE_INVENTUR.exec(kopf))) {
    urArt = 'inventur'
    teile.shift()
    inventur = { von: zahl(m[1]), nach: zahl(m[2]) }
    // "(nach den Buchungen seit Start gezählt, beim Start 9)" — ohne Klammern als Notiz
    const zusatz = m[3].trim().replace(/^\((.*)\)$/, '$1').trim()
    if (zusatz) rest.push(zusatz)
  } else if (kopf.startsWith(NOTIZ.csvImport)) {
    urArt = 'import'
    teile.shift()
    const uebrig = kopf.slice(NOTIZ.csvImport.length).trim()
    if (uebrig) rest.push(uebrig)
  } else if (z.type === 'einbuchung') {
    urArt = 'einbuchung'
  } else if (z.type === 'ausbuchung') {
    urArt = 'ausbuchung'
  } else {
    urArt = 'korrektur'
  }

  let ohneCharge = false
  for (const t of teile) {
    if (t === NOTIZ.offline) { offline = true; continue }
    if ((m = RE_CHARGE.exec(t))) { chargeNotiz = chargeNotiz ?? m[1].trim(); continue }
    if ((m = RE_TEILCHARGE.exec(t))) { teilNotiz = teilNotiz ?? { menge: zahl(m[1]), charge: m[2].trim() }; continue }
    if ((m = RE_EINSATZ.exec(t))) { einsatzNotiz = einsatzNotiz ?? m[1].trim(); continue }
    if (t.startsWith(NOTIZ.ohneCharge)) { ohneCharge = true; continue }
    if (t === NOTIZ.mehrfach || t === NOTIZ.ki) continue
    if (urArt === 'produktausgabe' && !empfaenger && (m = RE_EMPFAENGER.exec(t))) { empfaenger = m[1].trim(); continue }
    rest.push(t)
  }

  const e: Einordnung = {
    art: ruecknahme ? 'rueckgaengig' : urArt,
    urArt, ruecknahme, offline, ohneCharge,
    restNotiz: rest.filter(Boolean).join(' · '),
  }
  const charge = echteCharge(z.batch || '') ?? echteCharge(chargeNotiz)
  if (charge) e.charge = charge
  const teilCharge = echteCharge(teilNotiz?.charge)
  if (teilNotiz && teilCharge && Number.isFinite(teilNotiz.menge)) e.teilCharge = { menge: teilNotiz.menge, charge: teilCharge }
  const einsatz = (z.einsatz || '').trim() || einsatzNotiz
  if (einsatz) e.einsatz = einsatz
  if (empfaenger) e.empfaenger = empfaenger
  if (gegenstelle) e.gegenstelle = gegenstelle
  if (richtung) e.richtung = richtung
  if (inventur) e.inventur = inventur
  return { e, stamm }
}

/** Was ist diese Journalzeile? Alte und neue Notizformate. */
export function einordnen(z: LogZeile): Einordnung {
  return zerlege(z).e
}

// ── Vorgänge ─────────────────────────────────────────────────────────────────

const SEK = 1000
const MIN = 60 * SEK

/** Ketten der Zeitnähe-Regel: höchster Abstand zur letzten Zeile der Gruppe. */
const KETTE = {
  kurz: 10 * SEK,             // Mehrcharge, Umlagerungspaar, Rücknahme
  produktausgabe: 120 * SEK,
  import: 60 * SEK,
  inventur: 30 * MIN,
  /** Zeilen EINES Vorgangs (Feld vorgang) entstehen in einer Anfrage — nie weit auseinander. */
  vorgang: 2 * SEK,
} as const

interface Info { z: LogZeile; e: Einordnung; stamm: string; ms: number }

interface Gruppe {
  /** 'v' (Feld vorgang), heuristisch 'u' | 'p' | 'c' | 'r' | 'm' | 'i', oder 'e' (einzeln) */
  kuerzel: string
  sicher: boolean
  vorgang?: string
  zeilen: Info[]
}

/**
 * Zeitnähe-Regel für Zeilen ohne vorgang. Die Person steht IMMER im Schlüssel —
 * zwei Leute, die in derselben Sekunde buchen, sind zwei Vorgänge.
 * Die Kette misst den Abstand zur letzten Zeile der Gruppe.
 */
function heuristik(i: Info): { kuerzel: string; schluessel: string; fensterMs: number } | null {
  const user = i.z.user || ''
  const { e } = i
  if (e.ruecknahme) return { kuerzel: 'r', schluessel: JSON.stringify(['r', user]), fensterMs: KETTE.kurz }
  switch (e.art) {
    case 'umlagerung':
      // Nur die Zeilen mit Richtung: Quelle "→" und Ziel "←" gehören zusammen
      return e.richtung ? { kuerzel: 'u', schluessel: JSON.stringify(['u', user, i.z.item_id]), fensterMs: KETTE.kurz } : null
    case 'produktausgabe':
      // Einsatz im Schlüssel: zwei Ausgaben an dieselbe Person für verschiedene Einsätze sind zwei Vorgänge
      return { kuerzel: 'p', schluessel: JSON.stringify(['p', user, i.stamm, e.einsatz || '']), fensterMs: KETTE.produktausgabe }
    case 'import':
      return { kuerzel: 'c', schluessel: JSON.stringify(['c', user, i.z.location_id]), fensterMs: KETTE.import }
    case 'einbuchung':
    case 'ausbuchung':
    case 'korrektur':
      // Mehrere Chargen einer Buchung — die Restzeile "ohne Chargenzuordnung" hat denselben Stamm
      return {
        kuerzel: 'm',
        schluessel: JSON.stringify(['m', user, i.z.item_id, i.z.location_id, i.z.type, e.einsatz || '', i.stamm, e.offline]),
        fensterMs: KETTE.kurz,
      }
    default:
      // Rückruf ist immer eine Zeile; Inventur fasst die Sammelkarte unten zusammen
      return null
  }
}

/** Bei Gleichstand gewinnt die weiter vorn stehende Art. */
const VORRANG: LogArt[] = ['umlagerung', 'produktausgabe', 'rueckruf', 'inventur', 'import', 'rueckgaengig', 'ausbuchung', 'einbuchung', 'korrektur']

function dominanteArt(zeilen: Info[]): LogArt {
  const anzahl = new Map<LogArt, number>()
  for (const i of zeilen) anzahl.set(i.e.art, (anzahl.get(i.e.art) || 0) + 1)
  let beste: LogArt = zeilen[0].e.art
  let max = -1
  for (const a of VORRANG) {
    const n = anzahl.get(a) || 0
    if (n > max) { beste = a; max = n }
  }
  return beste
}

/**
 * Zu- UND Abgänge in einem Vorgang (ohne die Umlagerungszeilen, die naturgemäß
 * beide Seiten haben) — z. B. KI-Assistent oder Mehrfachbuchung mit +5 A, −2 C.
 */
function gemischteVorzeichen(zeilen: Info[]): boolean {
  let plus = false
  let minus = false
  for (const i of zeilen) {
    if (i.e.urArt === 'umlagerung') continue
    const q = Number(i.z.quantity) || 0
    if (q > 0) plus = true
    else if (q < 0) minus = true
  }
  return plus && minus
}

const GEMISCHT_NIE: LogArt[] = ['umlagerung', 'inventur', 'rueckgaengig', 'import']

/**
 * Sammelkarten über den Vorgängen: Jede Inventur-Position bzw. jede Zeile eines
 * CSV-Imports ist ein eigener Buchungsaufruf (eigener vorgang). Zusammen gehören
 * sie trotzdem auf eine Karte.
 */
const SAMMEL: { art: LogArt; kuerzel: 'i' | 'c'; ketteMs: number }[] = [
  { art: 'inventur', kuerzel: 'i', ketteMs: KETTE.inventur },
  { art: 'import', kuerzel: 'c', ketteMs: KETTE.import },
]

/**
 * Fasst Journalzeilen zu Vorgängen zusammen. Ausgabe absteigend nach zeit.
 *
 * 1. Zeilen mit vorgang: exakt ('v:'+vorgang, sicher).
 * 2. Sonst Zeitnähe je Person (siehe heuristik), oder einzeln ('e:'+id).
 * 3. Sammelkarten darüber, auch wenn die Zeilen vorgang tragen:
 *    - Inventur: Positionen derselben Person am selben Standort mit höchstens
 *      30 Minuten Abstand werden eine Karte (art 'inventur', nicht sicher).
 *    - CSV-Import: ebenso mit höchstens 60 s Abstand (art 'import', nicht sicher).
 * Ein Vorgang mit Zu- und Abgängen hat art 'gemischt' — außer Umlagerung,
 * Inventur, Rücknahme und CSV-Import.
 *
 * Gruppiert wird über alle übergebenen Zeilen: Seite 1 + Seite 2 ergibt dasselbe
 * wie alles auf einmal, die Reihenfolge der Eingabe spielt keine Rolle.
 */
export function bildeVorgaenge(zeilen: LogZeile[]): Vorgang[] {
  const infos: Info[] = eindeutig(zeilen)
    .sort(aufsteigend)
    .map(z => { const { e, stamm } = zerlege(z); return { z, e, stamm, ms: zeitMs(z.created) } })

  // (1) und (2) — Gruppen entstehen in der Reihenfolge ihrer ersten Zeile
  const gruppen: Gruppe[] = []
  const nachVorgang = new Map<string, Gruppe>()
  const offen = new Map<string, { g: Gruppe; letzte: number }>()
  for (const i of infos) {
    const v = (i.z.vorgang || '').trim()
    if (v) {
      let g = nachVorgang.get(v)
      if (!g) { g = { kuerzel: 'v', sicher: true, vorgang: v, zeilen: [] }; nachVorgang.set(v, g); gruppen.push(g) }
      g.zeilen.push(i)
      continue
    }
    const h = heuristik(i)
    if (!h) { gruppen.push({ kuerzel: 'e', sicher: false, zeilen: [i] }); continue }
    const o = offen.get(h.schluessel)
    if (o && Number.isFinite(i.ms) && Number.isFinite(o.letzte) && i.ms - o.letzte <= h.fensterMs) {
      o.g.zeilen.push(i)
      o.letzte = i.ms
      continue
    }
    const g: Gruppe = { kuerzel: h.kuerzel, sicher: false, zeilen: [i] }
    gruppen.push(g)
    offen.set(h.schluessel, { g, letzte: i.ms })
  }

  // (3) Sammelkarten (Inventur, CSV-Import) über den Vorgängen
  const ergebnis: Gruppe[] = []
  const karten = new Map<string, { g: Gruppe; letzte: number; zusammen: boolean }>()
  for (const g of gruppen) {
    const erste = g.zeilen[0]
    const regel = SAMMEL.find(s => g.zeilen.every(i => i.e.art === s.art
      && (i.z.user || '') === (erste.z.user || '') && i.z.location_id === erste.z.location_id))
    if (!regel) { ergebnis.push(g); continue }
    const schluessel = JSON.stringify([regel.kuerzel, erste.z.user || '', erste.z.location_id])
    const letzte = Math.max(...g.zeilen.map(i => i.ms))
    const k = karten.get(schluessel)
    if (k && Number.isFinite(erste.ms) && Number.isFinite(k.letzte) && erste.ms - k.letzte <= regel.ketteMs) {
      if (!k.zusammen) {
        // Aus dem ersten Vorgang wird die Sammelkarte
        k.g.kuerzel = regel.kuerzel; k.g.sicher = false; k.g.vorgang = undefined; k.zusammen = true
      }
      k.g.zeilen.push(...g.zeilen)
      k.letzte = Math.max(k.letzte, letzte)
      continue
    }
    const neu: Gruppe = { ...g, zeilen: [...g.zeilen] }
    ergebnis.push(neu)
    karten.set(schluessel, { g: neu, letzte, zusammen: false })
  }

  const vorgaenge = ergebnis.map((g): Vorgang & { _ms: number; _id: string } => {
    const zs = [...g.zeilen].sort((a, b) => aufsteigend(a.z, b.z))
    const erste = zs[0]
    const juengste = zs[zs.length - 1]
    const schluessel = g.kuerzel === 'v' ? `v:${g.vorgang}`
      : zs.length === 1 ? `e:${erste.z.id}`
      : `${g.kuerzel}:${erste.z.id}`
    let art: LogArt = g.kuerzel === 'i' ? 'inventur' : g.kuerzel === 'c' ? 'import' : dominanteArt(zs)
    // Umlagerung, Inventur und Rücknahme haben ihre eigenen Regeln; ein CSV-Import bleibt Import
    if (!GEMISCHT_NIE.includes(art) && gemischteVorzeichen(zs)) art = 'gemischt'
    return {
      schluessel,
      sicher: g.sicher,
      zeilen: zs.map(i => i.z),
      art,
      zeit: juengste.z.created,
      tag: tagSchluessel(juengste.z.created),
      user: erste.z.user ?? null,
      _ms: juengste.ms,
      _id: juengste.z.id,
    }
  })
  vorgaenge.sort((a, b) => {
    if (a._ms !== b._ms) return a._ms > b._ms ? -1 : 1
    if (a.zeit !== b.zeit) return a.zeit > b.zeit ? -1 : 1
    if (a._id !== b._id) return a._id > b._id ? -1 : 1
    return a.schluessel > b.schluessel ? -1 : a.schluessel < b.schluessel ? 1 : 0
  })
  return vorgaenge.map(({ _ms, _id, ...v }) => v)
}

/**
 * Vorgänge an der Seitengrenze. Solange es ältere, noch nicht geladene Zeilen gibt
 * ("Ältere laden"), kann ein Vorgang, der bis an die älteste geladene Zeile
 * heranreicht, noch weitere Zeilen haben — seine Summe ist dann nur eine
 * Mindestangabe. grenze: die älteste geladene Zeile (der Keyset-Punkt).
 *
 * Betroffen ist immer der Vorgang, der die Grenzzeile enthält; dazu jeder, dessen
 * älteste Zeile höchstens eine Kettenlänge der Zeitnähe-Regel von der Grenze
 * entfernt ist (eine Inventur-Sammelkarte z. B. sammelt über 30 Minuten, auch
 * wenn dazwischen andere gebucht haben). Ergebnis: die schluessel.
 */
export function amSeitenende(vorgaenge: Vorgang[], grenze: { created: string; id: string } | null | undefined): Set<string> {
  const aus = new Set<string>()
  if (!grenze) return aus
  const g = zeitMs(grenze.created)
  for (const v of vorgaenge) {
    if (v.zeilen.some(z => z.id === grenze.id)) { aus.add(v.schluessel); continue }
    const erste = v.zeilen[0]
    if (!erste) continue
    const kette = v.art === 'inventur' ? KETTE.inventur
      : v.art === 'import' ? KETTE.import
      : v.sicher ? KETTE.vorgang
      : v.art === 'produktausgabe' ? KETTE.produktausgabe
      : KETTE.kurz
    const t = zeitMs(erste.created)
    if (!Number.isFinite(g) || !Number.isFinite(t)) continue
    if (t - g <= kette) aus.add(v.schluessel)
  }
  return aus
}

// ── Exakte Bezüge ("Einsatz zeigen", "Charge verfolgen") ─────────────────────

export interface LogKontext { einsatz?: string | null; charge?: string | null }

/**
 * Gehört die Zeile genau zu diesem Einsatz bzw. dieser Charge? Der Server-Filter
 * (logbuchFilter mit einsatz/charge) sucht in der Notiz mit "enthält" — "Einsatz E-1"
 * trifft auch "Einsatz E-10". Diese Prüfung auf der eingeordneten Zeile ist exakt.
 * Eine Teilmenge ("2 aus Charge B7, Rest aus weiteren") zählt zur Charge.
 */
export function passtKontext(z: LogZeile, k: LogKontext | null | undefined): boolean {
  const einsatz = (k?.einsatz || '').trim()
  const charge = (k?.charge || '').trim()
  if (!einsatz && !charge) return true
  const e = einordnen(z)
  if (einsatz && e.einsatz !== einsatz) return false
  if (charge && e.charge !== charge && e.teilCharge?.charge !== charge) return false
  return true
}

// ── Rücknahmen ───────────────────────────────────────────────────────────────

/** Dieselbe Person? user ist E-Mail oder ID; Groß-/Kleinschreibung zählt nicht, leer = leer. */
function gleichePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

/**
 * Welche Zeile wurde von welcher Rücknahme aufgehoben?
 * original: Original-Zeilen-ID → ID der Rücknahmezeile.
 * vermutlich: Original-IDs, die nur über die Rückfall-Regel zugeordnet sind.
 *
 * Primär über storno_von. Fehlt das Feld (Altbestand, oder in PocketBase noch
 * nicht angelegt): dieselbe Person (zurücknehmen kann man nur die eigene
 * Buchung), gleiche Art, gleiche Bestandszeile, gleiche Charge, Menge mit
 * umgekehrtem Vorzeichen — am liebsten die gleichlautende Zeile, sonst die
 * jüngste passende VOR der Rücknahme. Ohne Kandidaten derselben Person bleibt die
 * Rücknahme ohne Zuordnung. Jede Originalzeile höchstens einmal.
 */
export function findeRuecknahmen(zeilen: LogZeile[]): { original: Map<string, string>; vermutlich: Set<string> } {
  const sortiert = eindeutig(zeilen).sort(aufsteigend)
  const einordnung = sortiert.map(z => einordnen(z))
  const original = new Map<string, string>()
  const vermutlich = new Set<string>()

  for (const z of sortiert) {
    const s = (z.storno_von || '').trim()
    if (s && !original.has(s)) original.set(s, z.id)
  }

  const rueckPraefix = new RegExp(`^${esc(NOTIZ.rueckgaengig)}(?:\\s*·\\s*)?`)
  sortiert.forEach((r, idx) => {
    if ((r.storno_von || '').trim() || !einordnung[idx].ruecknahme) return
    const urNotiz = (r.note || '').trim().replace(rueckPraefix, '')
    const charge = einordnung[idx].charge || ''
    let treffer = -1
    for (let k = idx - 1; k >= 0; k--) {
      const o = sortiert[k]
      if (original.has(o.id) || einordnung[k].ruecknahme) continue
      if (!gleichePerson(o.user, r.user)) continue
      if (o.type !== r.type || o.item_id !== r.item_id || o.location_id !== r.location_id) continue
      if ((o.stock_id || '') !== (r.stock_id || '')) continue
      if ((einordnung[k].charge || '') !== charge) continue
      if (o.quantity !== -r.quantity) continue
      if ((o.note || '').trim() === urNotiz) { treffer = k; break }
      if (treffer < 0) treffer = k
    }
    if (treffer >= 0) {
      original.set(sortiert[treffer].id, r.id)
      vermutlich.add(sortiert[treffer].id)
    }
  })
  return { original, vermutlich }
}

// ── Personen ─────────────────────────────────────────────────────────────────

const gross = (w: string) => w.split('-').map(t => t.charAt(0).toLocaleUpperCase('de-DE') + t.slice(1)).join('-')

function kurzName(name: string): string {
  const w = name.split(/\s+/).filter(Boolean)
  if (w.length < 2) return name
  return `${w[0].charAt(0).toLocaleUpperCase('de-DE')}. ${w[w.length - 1]}`
}

/**
 * Anzeigename zum user-Feld (E-Mail oder User-ID, im Altbestand gemischt).
 * Ein Name aus der Personenliste gewinnt; sonst aus der E-Mail
 * ("julia.becker@…" → "J. Becker" / "Julia Becker").
 */
export function personKurz(user: string | null | undefined, namen?: Map<string, string>): { kurz: string; voll: string } {
  const u = (user || '').trim()
  if (!u) return { kurz: 'Unbekannt', voll: 'Unbekannt' }
  const name = (namen?.get(u) ?? namen?.get(u.toLowerCase()) ?? '').trim()
  if (name) return { kurz: kurzName(name), voll: name }
  const at = u.indexOf('@')
  if (at >= 0) {
    const lokal = u.slice(0, at).split('+')[0]
    let teile = lokal.split(/[._]+/).filter(Boolean)
    if (teile.length < 2) teile = lokal.split('-').filter(Boolean)
    if (teile.length < 2) { const t = lokal || u; return { kurz: t, voll: t } }
    const voll = teile.map(gross).join(' ')
    return { kurz: kurzName(voll), voll }
  }
  return { kurz: `Benutzer ${u.slice(0, 6)}`, voll: `Benutzer ${u}` }
}

// ── Abfrage ──────────────────────────────────────────────────────────────────

// Gemeinsamer Wortstamm von "Umlagerung →" und "Umlagerung ←"
const UMLAGERUNG = NOTIZ.umlagerungNach.split(' ')[0]

const MAX_ARTIKEL = SUCHE_MAX.artikel
const MAX_PERSONEN = SUCHE_MAX.kennungen

/**
 * Filter für inventory_transactions — ausschließlich über pbFilter mit Parametern
 * (in der App pb.filter). Jeder Parameter geht in einem eigenen pbFilter-Aufruf
 * hinein: pb.filter ersetzt nacheinander, und ein Wert, der selbst wie "{:x}"
 * aussieht, würde sonst vom nächsten Parameter überschrieben.
 * Sortierung dazu: '-created,-id'.
 *
 * einsatz/charge sind exakte Bezüge ("Einsatz zeigen", "Charge verfolgen") — ohne
 * Artikelnamen und Personen. In der Notiz geht es nur mit "enthält"; die Anzeige
 * prüft die geladenen Zeilen deshalb mit passtKontext nach.
 */
export function logbuchFilter(f: LogFilter, pbFilter: (raw: string, params?: Record<string, unknown>) => string): string {
  const teile: string[] = [pbFilter('organization_id = {:o}', { o: f.orgId })]
  if (f.locationId) teile.push(pbFilter('location_id = {:l}', { l: f.locationId }))
  if (f.ab && Number.isFinite(f.ab.getTime())) teile.push(pbFilter('created >= {:ab}', { ab: f.ab }))
  if (f.itemId) teile.push(pbFilter('item_id = {:i}', { i: f.itemId }))

  if (f.nurMeine) {
    const mail = (f.nurMeine.email || '').trim()
    const uid = (f.nurMeine.id || '').trim()
    const oder = [
      mail ? pbFilter('user = {:mail}', { mail }) : '',
      uid ? pbFilter('user = {:uid}', { uid }) : '',
    ].filter(Boolean)
    // Ohne E-Mail und ID gibt es keine eigenen Buchungen — nichts anzeigen statt alles
    if (oder.length === 0) teile.push(pbFilter('id = {:keine}', { keine: '' }))
    else teile.push(oder.length === 1 ? oder[0] : `(${oder.join(' || ')})`)
  }

  switch (f.art) {
    case 'ausbuchung':
      teile.push(pbFilter('type = {:t} && note !~ {:n}', { t: 'ausbuchung', n: UMLAGERUNG }))
      break
    case 'einbuchung':
      teile.push(pbFilter('type = {:t} && note !~ {:n}', { t: 'einbuchung', n: UMLAGERUNG }))
      break
    case 'umlagerung':
      teile.push(pbFilter('note ~ {:n}', { n: UMLAGERUNG }))
      break
    case 'inventur':
      teile.push(pbFilter('type = {:t}', { t: 'korrektur' }))
      break
    case 'rueckruf':
      teile.push(pbFilter('note ~ {:n}', { n: NOTIZ.rueckruf }))
      break
    case 'pruefen':
      teile.push(`(${[
        pbFilter('type = {:t}', { t: 'korrektur' }),
        pbFilter('note ~ {:n}', { n: NOTIZ.rueckgaengig }),
        pbFilter('note ~ {:n}', { n: NOTIZ.rueckruf }),
        pbFilter('note ~ {:n}', { n: NOTIZ.ohneCharge }),
        pbFilter('note ~ {:n}', { n: NOTIZ.offline }),
      ].join(' || ')})`)
      break
    default:
      break
  }

  const q = (f.suche?.q || '').trim()
  if (f.suche && q.length >= 2) {
    const oder = [pbFilter('batch ~ {:q} || einsatz ~ {:q} || note ~ {:q} || user ~ {:q}', { q })]
    const artikel = [...new Set((f.suche.itemIds || []).filter(Boolean))].slice(0, MAX_ARTIKEL)
    artikel.forEach((id, n) => oder.push(pbFilter(`item_id = {:i${n}}`, { [`i${n}`]: id })))
    const personen = [...new Set((f.suche.userIds || []).filter(Boolean))].slice(0, MAX_PERSONEN)
    personen.forEach((id, n) => oder.push(pbFilter(`user = {:u${n}}`, { [`u${n}`]: id })))
    teile.push(`(${oder.join(' || ')})`)
  }

  const einsatz = (f.einsatz || '').trim()
  if (einsatz) {
    teile.push(`(${[
      pbFilter('einsatz = {:e}', { e: einsatz }),
      pbFilter('note ~ {:en}', { en: `Einsatz ${einsatz}` }),
      // Alte Produktausgabe: "Produktausgabe E-2026-0147 – Max Muster"
      pbFilter('note ~ {:pn}', { pn: `${NOTIZ.produktausgabe} ${einsatz}` }),
    ].join(' || ')})`)
  }
  const charge = (f.charge || '').trim()
  if (charge) {
    teile.push(`(${[
      pbFilter('batch = {:c}', { c: charge }),
      pbFilter('note ~ {:cn}', { cn: `Charge ${charge}` }),
    ].join(' || ')})`)
  }

  if (f.vor && f.vor.created && f.vor.id) {
    // created als String aus dem Datensatz, unverändert — kein Umweg über Date (Millisekunden)
    const c = f.vor.created
    teile.push(`(${pbFilter('created < {:c}', { c })} || (${pbFilter('created = {:c}', { c })} && ${pbFilter('id < {:k}', { k: f.vor.id })}))`)
  }

  return teile.join(' && ')
}
