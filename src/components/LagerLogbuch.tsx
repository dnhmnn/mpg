// Das Lager-Logbuch als Anzeige: Kopf mit Suche und Filtern, darunter die
// Buchungen als Vorgänge, nach Tagen geordnet. Rendert nur den Inhalt —
// Lager.tsx legt ihn in sein bestehendes .lager-modal (bzw. ins Artikel-Detail,
// modus 'artikel').
//
// Die Rechnung (Notizen einordnen, Vorgänge bilden, Rücknahmen zuordnen,
// Abfragefilter) steht in src/lib/lagerLogbuch.ts und hat dort ihre Prüffälle.
// Hier wird nur geladen und dargestellt. Alles als Text (React escapt), alle
// Zeitangaben aus PocketBase über pbZeit (ältere iOS-Versionen).
//
// „Stornieren“ (Prop stornieren): Ob und was, entscheidet lagerLogbuch.ts
// (ergebnisAusJournal, pruefeStorno); gebucht wird in Lager.tsx (stornieren.los).
// Vor dem Buchen lädt diese Anzeige den Vorgang frisch und vollständig vom Server —
// die geladene Liste kann gefiltert oder an der Seitengrenze abgeschnitten sein.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { pb } from '../lib/pocketbase'
import { pbFehlerText } from '../lib/pbFehler'
import {
  STORNO_GRUND, SUCHE_MAX, amSeitenende, bildeVorgaenge, einordnen, ergebnisAusJournal, findeRuecknahmen, logbuchFilter, passtKontext,
  pbZeit, personKurz, pruefeStorno, ruecknahmenFilter, tagSchluessel, vorgangFilter,
} from '../lib/lagerLogbuch'
import type { Einordnung, LogArt, LogFilter, LogKontext, LogZeile, Vorgang } from '../lib/lagerLogbuch'

/**
 * Stand eines Eintrags der Offline-Warteschlange (lagerOffline.ts):
 * wartet — noch nicht gesendet; unklar — gesendet, Antwort verloren (wird beim
 * Übertragen über die Client-ID geprüft, nicht doppelt gebucht); teilweise — ein
 * Teil ist gebucht, der Rest wird nicht wiederholt; abgelehnt — der Server hat
 * die Buchung abgewiesen (fehler).
 */
export type WartendStatus = 'wartet' | 'unklar' | 'teilweise' | 'abgelehnt'

export interface LagerLogbuchProps {
  orgId: string
  ich: { id: string; email?: string; name?: string }
  items: { id: string; name: string; unit?: string }[]
  locations: { id: string; name: string }[]
  startLocationId: string | null
  /** voll = Logbuch-Fenster; artikel = Vorschau im Artikel-Detail (5 Vorgänge, aktueller Standort) */
  modus: 'voll' | 'artikel'
  vorgabe?: { itemId?: string; q?: string; alleStandorte?: boolean; zeitraum?: 'heute' | '24h' | '7t' | '30t' | 'alle' }
  /**
   * Offline-Warteschlange, von Lager.tsx übergeben. client_id = ID der ersten
   * Journalzeile bzw. vorgang der Buchung — ist sie im Logbuch angekommen, wird der
   * Eintrag hier nicht mehr gezeigt. Ohne status gilt 'wartet'.
   */
  wartend?: {
    id: string; item_id: string; location_id: string; delta: number; created_at: number; einsatz?: string
    client_id?: string; status?: WartendStatus; fehler?: string
    /** Nur bei fremden Einträgen: wer erfasst hat (geteiltes Tablet) */
    user_name?: string
  }[]
  /** Zähler; ändert er sich, wird neu geladen (nach eigener Buchung) */
  aktualisiert?: number
  onClose?: () => void
  /** nur modus 'artikel': "Ganzer Verlauf ›" */
  onGanzerVerlauf?: (itemId: string) => void
  /**
   * „Stornieren“ im aufgeklappten Vorgang (nur modus 'voll'). Angeboten nur für
   * Vorgänge mit Vorgangs-Nummer, die nicht selbst Gegenbuchung und nicht schon
   * zurückgenommen sind und sich genau zurücknehmen lassen (ergebnisAusJournal).
   * darf: Darf die angemeldete Person diesen Vorgang stornieren (eigene Buchung,
   * Recht „Lager verwalten“)? user/zeit wie im Vorgang (erste Zeile / jüngste Zeile).
   * los: bucht die Gegenbuchung (ergebnisAusJournal → macheRueckgaengig). Die Zeilen
   * sind frisch und vollständig vom Server geladen und mit pruefeStorno geprüft.
   * Rückgabe null = gelungen (dann aktualisiert erhöhen), sonst der Fehlertext.
   */
  stornieren?: {
    darf: (v: { zeilen: LogZeile[]; user?: string | null; zeit: string }) => boolean
    los: (zeilen: LogZeile[]) => Promise<string | null>
  }
}

type Zeitraum = 'heute' | '24h' | '7t' | '30t' | 'alle'
type ArtFilter = NonNullable<LogFilter['art']>
type Wartend = NonNullable<LagerLogbuchProps['wartend']>[number]

const SEITE_VOLL = 50
const SEITE_ARTIKEL = 20
const ARTIKEL_VORGAENGE = 5
const STANDARD_ZEITRAUM: Zeitraum = '7t'
const SPEICHER = 'lager-logbuch-wahl'

const ZEITRAEUME: { wert: Zeitraum; kurz: string; zustand: string; leer: string }[] = [
  { wert: 'heute', kurz: 'Heute', zustand: 'heute', leer: 'heute' },
  { wert: '24h', kurz: '24 Std.', zustand: 'letzte 24 Std.', leer: 'in den letzten 24 Stunden' },
  { wert: '7t', kurz: '7 Tage', zustand: 'letzte 7 Tage', leer: 'in den letzten 7 Tagen' },
  { wert: '30t', kurz: '30 Tage', zustand: 'letzte 30 Tage', leer: 'in den letzten 30 Tagen' },
  { wert: 'alle', kurz: 'Alle', zustand: 'gesamter Zeitraum', leer: 'im gesamten Zeitraum' },
]

const ARTEN: { wert: ArtFilter; text: string }[] = [
  { wert: 'alle', text: 'Alle Arten' },
  { wert: 'ausbuchung', text: 'Ausbuchungen' },
  { wert: 'einbuchung', text: 'Einbuchungen' },
  { wert: 'umlagerung', text: 'Umlagerungen' },
  { wert: 'inventur', text: 'Inventur' },
  { wert: 'rueckruf', text: 'Rückrufe' },
  { wert: 'pruefen', text: 'Zu prüfen' },
]

const ART_TEXT: Record<LogArt, string> = {
  einbuchung: 'Einbuchung',
  ausbuchung: 'Ausbuchung',
  produktausgabe: 'Produktausgabe',
  umlagerung: 'Umlagerung',
  rueckruf: 'Rückruf',
  inventur: 'Inventur',
  korrektur: 'Korrektur',
  import: 'CSV-Import',
  rueckgaengig: 'Rückgängig',
  gemischt: 'Buchung',
}

const GRAU_RAND = 'rgba(var(--lbf-grau-rgb),0.4)'
const ORANGE = '#d97706'
const FEHLERFARBE = 'var(--lbf-fehler-text-2)'

const ART_FARBE: Record<LogArt, string> = {
  ausbuchung: 'var(--lbf-akzent)',
  produktausgabe: 'var(--lbf-akzent)',
  einbuchung: '#16a34a',
  import: '#16a34a',
  inventur: ORANGE,
  korrektur: ORANGE,
  rueckruf: '#dc2626',
  umlagerung: GRAU_RAND,
  rueckgaengig: GRAU_RAND,
  gemischt: GRAU_RAND,
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONAT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// ── Zeit und Zahlen ──────────────────────────────────────────────────────────

const zwei = (n: number) => String(n).padStart(2, '0')
const gueltig = (d: Date) => Number.isFinite(d.getTime())

/** Lokaler Kalendertag eines Date als "YYYY-MM-DD" (wie tagSchluessel). */
function tagVon(d: Date): string {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
}

function hhmm(d: Date): string {
  return gueltig(d) ? `${zwei(d.getHours())}:${zwei(d.getMinutes())}` : ''
}

function uhrzeit(created: string): string {
  return hhmm(pbZeit(created))
}

function uhrzeitSek(created: string): string {
  const d = pbZeit(created)
  return gueltig(d) ? `${hhmm(d)}:${zwei(d.getSeconds())}` : ''
}

/** "16.10.2026, 14:32:07" */
function datumZeitLang(created: string): string {
  const d = pbZeit(created)
  if (!gueltig(d)) return created || ''
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}, ${uhrzeitSek(created)}`
}

/** "16.10." bzw. "16.10.2025" in einem anderen Jahr */
function datumKurz(d: Date, jetzt = new Date()): string {
  if (!gueltig(d)) return ''
  const basis = `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.`
  return d.getFullYear() === jetzt.getFullYear() ? basis : `${basis}${d.getFullYear()}`
}

/** "14:41" am selben Tag wie bezugTag, sonst "17.10. 14:41" */
function zeitBezug(created: string, bezugTag: string): string {
  const d = pbZeit(created)
  if (!gueltig(d)) return ''
  return tagVon(d) === bezugTag ? hhmm(d) : `${datumKurz(d)} ${hhmm(d)}`
}

/** "Heute · Do 16. Okt" — Großschreibung macht der Section-Header. */
function tagTitel(tag: string, jetzt: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag)
  if (!m) return tag
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const basis = `${WOCHENTAG[d.getDay()]} ${d.getDate()}. ${MONAT[d.getMonth()]}${d.getFullYear() !== jetzt.getFullYear() ? ` ${d.getFullYear()}` : ''}`
  if (tag === tagVon(jetzt)) return `Heute · ${basis}`
  if (tag === tagVon(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - 1))) return `Gestern · ${basis}`
  return basis
}

/** Kurze Zeitangabe für die Artikel-Vorschau: "Heute 14:32", "Gestern 09:10", "13.10. 08:00". */
function zeitKompakt(d: Date, jetzt: Date): string {
  if (!gueltig(d)) return ''
  const tag = tagVon(d)
  if (tag === tagVon(jetzt)) return `Heute ${hhmm(d)}`
  if (tag === tagVon(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - 1))) return `Gestern ${hhmm(d)}`
  return `${datumKurz(d, jetzt)} ${hhmm(d)}`
}

/** MHD als "08/2028". Der Datumsteil wird direkt gelesen — keine Zeitzonenverschiebung am Monatsende. */
function mhdText(expiry: string | null | undefined): string {
  if (!expiry) return ''
  const m = /^(\d{4})-(\d{2})/.exec(expiry)
  if (m) return `${m[2]}/${m[1]}`
  const d = pbZeit(expiry)
  return gueltig(d) ? `${zwei(d.getMonth() + 1)}/${d.getFullYear()}` : ''
}

function einheitKurz(unit: string | undefined): string {
  const t = (unit || '').trim()
  if (!t || /^st(ü|ue)ck$/i.test(t) || /^stk\.?$/i.test(t)) return 'Stk.'
  return t
}

const runde = (n: number) => Math.round(n * 1000) / 1000
const zahl = (n: number) => Math.abs(n).toLocaleString('de-DE', { maximumFractionDigits: 3 })

/** Menge mit echtem Minuszeichen "−2 Stk." / "+5 Stk.", ohne Vorzeichen für Umlagerungen. */
function mengeText(n: number, einheit: string, vorzeichen = true): string {
  const s = !vorzeichen || n === 0 ? '' : n < 0 ? '−' : '+'
  return `${s}${zahl(n)}${einheit ? ` ${einheit}` : ''}`
}

function eindeutig<T>(werte: (T | null | undefined | '' | false)[]): T[] {
  const aus: T[] = []
  for (const w of werte) if (w !== null && w !== undefined && w !== '' && w !== false && !aus.includes(w as T)) aus.push(w as T)
  return aus
}

function abVon(zeitraum: Zeitraum, jetzt: Date): Date | null {
  switch (zeitraum) {
    case 'heute': return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())
    case '24h': return new Date(jetzt.getTime() - 24 * 3600_000)
    case '7t': return new Date(jetzt.getTime() - 7 * 24 * 3600_000)
    case '30t': return new Date(jetzt.getTime() - 30 * 24 * 3600_000)
    default: return null
  }
}

const zeitraumInfo = (z: Zeitraum) => ZEITRAEUME.find(x => x.wert === z) ?? ZEITRAEUME[2]

// ── Fehler ───────────────────────────────────────────────────────────────────

interface FehlerInfo { text: string; grund?: string }

function fehlerVon(e: unknown, was: string): FehlerInfo {
  const status = (e && typeof e === 'object' && 'status' in e) ? (e as { status?: unknown }).status : undefined
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (status === 0 || offline) return { text: `${was} – keine Verbindung.` }
  return { text: `${was}.`, grund: pbFehlerText(e) }
}

// ── Gemerkte Wahl (nur Komfort, darf fehlen) ─────────────────────────────────

interface Wahl { zeitraum?: Zeitraum; alleStandorte?: boolean }

function leseWahl(): Wahl {
  try {
    const roh = window.localStorage.getItem(SPEICHER)
    if (!roh) return {}
    const o: unknown = JSON.parse(roh)
    if (!o || typeof o !== 'object') return {}
    const w = o as { zeitraum?: unknown; alleStandorte?: unknown }
    return {
      zeitraum: ZEITRAEUME.some(z => z.wert === w.zeitraum) ? (w.zeitraum as Zeitraum) : undefined,
      alleStandorte: w.alleStandorte === true,
    }
  } catch {
    return {}
  }
}

function merkeWahl(teil: Wahl): void {
  try {
    window.localStorage.setItem(SPEICHER, JSON.stringify({ ...leseWahl(), ...teil }))
  } catch { /* privates Fenster o. ä. — dann eben nicht gemerkt */ }
}

/** Standard nach "Aufheben" und beim Öffnen ohne Vorgabe. */
function standardWahl(startLocationId: string | null): { standort: string; zeitraum: Zeitraum } {
  const w = leseWahl()
  return { standort: w.alleStandorte ? '' : (startLocationId || ''), zeitraum: w.zeitraum ?? STANDARD_ZEITRAUM }
}

/**
 * einsatz/charge: exakter Bezug ("Einsatz zeigen", "Charge verfolgen") über
 * LogFilter.einsatz/charge und passtKontext — nicht die Volltextsuche.
 * suche: eine von Lager.tsx vorgegebene Suche (vorgabe.q).
 */
type Kontext = { typ: 'einsatz' | 'charge' | 'suche'; wert: string }

interface Anfang {
  standort: string
  zeitraum: Zeitraum
  itemId: string | null
  eingabe: string
  kontext: Kontext | null
}

function anfangsWahl(vorgabe: LagerLogbuchProps['vorgabe'], startLocationId: string | null): Anfang {
  const std = standardWahl(startLocationId)
  const itemId = vorgabe?.itemId || null
  const q = (vorgabe?.q || '').trim()
  return {
    standort: vorgabe?.alleStandorte ? '' : std.standort,
    // "Ganzer Verlauf" eines Artikels bzw. eine vorgegebene Suche: ohne Angabe der gesamte Zeitraum
    zeitraum: vorgabe?.zeitraum ?? (itemId || q ? 'alle' : std.zeitraum),
    itemId,
    eingabe: q,
    kontext: q ? { typ: 'suche', wert: q } : null,
  }
}

// ── Beschreibung eines Vorgangs ──────────────────────────────────────────────

interface Ansicht {
  vorgaenge: Vorgang[]
  /** Original-Zeilen-ID → ID der Rücknahmezeile */
  original: Map<string, string>
  vermutlich: Set<string>
  /** Rücknahmezeilen-ID → Original-Zeilen-ID */
  zuOriginal: Map<string, string>
  nachId: Map<string, LogZeile>
  einordnung: Map<string, Einordnung>
}

interface Umfeld {
  ansicht: Ansicht
  namen: Map<string, string>
  artikel: Map<string, { name: string; unit?: string }>
  orte: Map<string, string>
  alleStandorte: boolean
  /** Vorgänge an der Seitengrenze — können ältere, noch nicht geladene Zeilen haben */
  angeschnitten: Set<string>
}

interface Hinweis { text: string; farbe: string }

interface ZeileText { id: string; menge: string; text: string; notiz: string; durch: boolean }

interface Beschreibung {
  farbe: string
  labelFarbe: string
  artText: string
  menge: string
  /** Vollständig zurückgenommen: Menge durchgestrichen, Karte blass */
  durch: boolean
  /** An der Seitengrenze: Menge nur als Mindestangabe, Hinweis auf "Ältere laden" */
  angeschnitten: boolean
  name: string
  person: { kurz: string; voll: string }
  bezug: string
  zeile3: string[]
  hinweise: Hinweis[]
  zeilen: ZeileText[]
  meta: string[]
  einsatz?: string
  charge?: string
  artikelId?: string
}

/** "davon 2 aus Ch. B7" — nur ein Teil der Menge stammt aus dieser Charge. */
function teilChargeText(t: NonNullable<Einordnung['teilCharge']>): string {
  return `davon ${zahl(t.menge)} aus Ch. ${t.charge}`
}

function beschreibe(v: Vorgang, u: Umfeld): Beschreibung {
  const { ansicht, namen } = u
  const infos = v.zeilen.map(z => ({ z, e: ansicht.einordnung.get(z.id) ?? einordnen(z) }))
  const artikelName = (id: string) => u.artikel.get(id)?.name || 'Gelöschter Artikel'
  const ortName = (id: string, ersatz?: string) => u.orte.get(id) || ersatz || 'Gelöschter Standort'

  const urArt: LogArt = v.art === 'rueckgaengig' ? (infos.find(i => i.e.ruecknahme)?.e.urArt ?? 'ausbuchung') : v.art
  const artikelIds = eindeutig<string>(infos.map(i => i.z.item_id))
  const ortIds = eindeutig<string>(infos.map(i => i.z.location_id))
  const chargen = eindeutig<string>(infos.map(i => i.e.charge))
  const einsaetze = eindeutig<string>(infos.map(i => i.e.einsatz))
  const empfaenger = infos.find(i => i.e.empfaenger)?.e.empfaenger
  const einheit = artikelIds.length === 1 ? einheitKurz(u.artikel.get(artikelIds[0])?.unit) : ''
  const person = personKurz(v.user, namen)

  // Umlagerung: beide Seiten geladen (Standort "Alle")?
  const nach = infos.find(i => i.e.richtung === 'nach')
  const von = infos.find(i => i.e.richtung === 'von')
  const strecke = nach && von ? `${ortName(nach.z.location_id, von.e.gegenstelle)} → ${ortName(von.z.location_id, nach.e.gegenstelle)}` : ''

  // Rücknahmen, die diesen Vorgang aufheben
  const zurueck = infos.filter(i => ansicht.original.has(i.z.id))
  const alleZurueck = infos.length > 0 && zurueck.length === infos.length
  const zurueckVermutlich = zurueck.some(i => ansicht.vermutlich.has(i.z.id))
  const rueckZeilen = eindeutig<LogZeile>(zurueck.map(i => ansicht.nachId.get(ansicht.original.get(i.z.id) || '')))
    .sort((a, b) => pbZeit(a.created).getTime() - pbZeit(b.created).getTime())

  // Bei einer Rücknahme: die Originale
  const origIds = v.art === 'rueckgaengig' ? eindeutig<string>(infos.map(i => ansicht.zuOriginal.get(i.z.id))) : []
  const originale = eindeutig<LogZeile>(origIds.map(id => ansicht.nachId.get(id)))
  const origVermutlich = origIds.some(id => ansicht.vermutlich.has(id))
  const erstesOriginal = originale[0]

  // Menge rechts
  const summe = runde(infos.reduce((s, i) => s + (Number(i.z.quantity) || 0), 0))
  let menge: string
  if (v.art === 'inventur' && artikelIds.length > 1) menge = `${artikelIds.length} Positionen`
  else if (v.art === 'import' && infos.length > 1) menge = `${infos.length} Positionen`
  else if (v.art === 'gemischt') {
    // Zu- und Abgänge: nicht zu einer Summe verrechnen
    const ohneUmlagerung = infos.filter(i => i.e.urArt !== 'umlagerung')
    const zu = ohneUmlagerung.filter(i => (Number(i.z.quantity) || 0) > 0)
    const ab = ohneUmlagerung.filter(i => (Number(i.z.quantity) || 0) < 0)
    if (artikelIds.length > 1) {
      menge = `+${eindeutig<string>(zu.map(i => i.z.item_id)).length} / −${eindeutig<string>(ab.map(i => i.z.item_id)).length} Artikel`
    } else {
      const plus = runde(zu.reduce((s, i) => s + (Number(i.z.quantity) || 0), 0))
      const minus = runde(ab.reduce((s, i) => s + (Number(i.z.quantity) || 0), 0))
      menge = `+${zahl(plus)} / −${zahl(minus)}${einheit ? ` ${einheit}` : ''}`
    }
  } else if (artikelIds.length > 1) menge = `${artikelIds.length} Artikel`
  else if (urArt === 'umlagerung' && strecke) {
    menge = mengeText(runde(infos.reduce((s, i) => s + Math.max(0, Number(i.z.quantity) || 0), 0)), einheit, false)
  } else menge = mengeText(summe, einheit)
  const angeschnitten = u.angeschnitten.has(v.schluessel)
  if (angeschnitten) menge = `mind. ${menge}`

  // Zeile 2
  const artikelNamen = artikelIds.map(artikelName)
  const name = v.art === 'inventur' && artikelIds.length > 1
    ? `Inventur ${ortIds.map(id => ortName(id)).join(', ')}`
    : artikelNamen.length <= 2 ? artikelNamen.join(', ') : `${artikelNamen.slice(0, 2).join(', ')} … +${artikelNamen.length - 2}`

  // Zeile 3: wichtigster Bezug
  let bezug = ''
  const inv = infos.length === 1 ? infos[0].e.inventur : undefined
  if (v.art === 'rueckgaengig') {
    if (erstesOriginal) {
      const gleicherTag = tagSchluessel(erstesOriginal.created) === v.tag
      bezug = `nimmt ${origVermutlich ? 'vermutlich ' : ''}${ART_TEXT[urArt]} ${gleicherTag ? 'von' : 'vom'} ${zeitBezug(erstesOriginal.created, v.tag)} zurück`
    } else {
      bezug = `nimmt ${ART_TEXT[urArt]} zurück`
    }
  } else if (v.art === 'umlagerung') {
    if (strecke) bezug = strecke
    else if (nach) bezug = `nach ${nach.e.gegenstelle || 'unbekannt'}`
    else if (von) bezug = `von ${von.e.gegenstelle || 'unbekannt'}`
  } else if (v.art === 'produktausgabe') {
    bezug = empfaenger ? `an ${empfaenger}` : einsaetze[0] ? `Einsatz ${einsaetze[0]}` : ''
  } else if (v.art === 'inventur' || v.art === 'korrektur') {
    if (inv) bezug = `${zahl(inv.von)} → ${zahl(inv.nach)}`
  } else if (einsaetze[0]) {
    bezug = `Einsatz ${einsaetze[0]}`
  }

  const zeile3 = [person.kurz]
  if (bezug) zeile3.push(bezug)
  if (chargen.length === 1) zeile3.push(`Ch. ${chargen[0]}`)
  else if (chargen.length > 1) zeile3.push(`${chargen.length} Chargen`)
  else if (infos.length === 1 && infos[0].e.teilCharge) zeile3.push(teilChargeText(infos[0].e.teilCharge))
  if (v.art === 'einbuchung') {
    const mhds = eindeutig<string>(infos.map(i => mhdText(i.z.expiry_date)))
    if (mhds.length === 1) zeile3.push(`MHD ${mhds[0]}`)
  }
  if (u.alleStandorte && !strecke && !(v.art === 'inventur' && artikelIds.length > 1)) {
    zeile3.push(ortIds.map(id => ortName(id)).join(', '))
  }

  // Zeile 4: Hinweise
  const hinweise: Hinweis[] = []
  if (zurueck.length > 0) {
    const letzte = rueckZeilen[rueckZeilen.length - 1]
    const wann = letzte ? ` ${zeitBezug(letzte.created, v.tag)}` : ''
    hinweise.push({
      text: `${zurueckVermutlich ? 'vermutlich ' : ''}${alleZurueck ? '' : 'teilweise '}zurückgenommen${wann}`,
      farbe: 'var(--warm-gray)',
    })
  }
  if (infos.some(i => i.e.ohneCharge)) hinweise.push({ text: 'ohne Chargenzuordnung', farbe: ORANGE })
  if (infos.some(i => i.e.offline)) hinweise.push({ text: 'offline erfasst', farbe: 'var(--warm-gray)' })
  if (artikelIds.some(id => !u.artikel.has(id)) && !name.includes('Gelöschter Artikel')) {
    hinweise.push({ text: 'Gelöschter Artikel', farbe: 'var(--warm-gray)' })
  }

  // Aufgeklappt: je Journalzeile
  const mehrereArtikel = artikelIds.length > 1
  const mitOrt = urArt === 'umlagerung' || (u.alleStandorte && ortIds.length > 1)
  const inventurKarte = v.art === 'inventur' && infos.length > 1
  const zeilen: ZeileText[] = infos.map(i => {
    const teile: string[] = []
    if (mehrereArtikel) teile.push(artikelName(i.z.item_id))
    if (mitOrt) teile.push(ortName(i.z.location_id))
    if (i.e.inventur) teile.push(`${zahl(i.e.inventur.von)} → ${zahl(i.e.inventur.nach)}`)
    teile.push(i.e.charge ? `Ch. ${i.e.charge}` : i.e.teilCharge ? teilChargeText(i.e.teilCharge) : 'ohne Charge erfasst')
    const mhd = mhdText(i.z.expiry_date)
    if (mhd) teile.push(`MHD ${mhd}`)
    return {
      id: i.z.id,
      menge: mengeText(Number(i.z.quantity) || 0, einheitKurz(u.artikel.get(i.z.item_id)?.unit)),
      text: teile.join(' · '),
      notiz: inventurKarte ? (i.z.note || '').trim() : '',
      durch: ansicht.original.has(i.z.id),
    }
  })

  // Metablock
  const meta: string[] = []
  const roh = (v.user || '').trim()
  meta.push(roh && !person.voll.includes(roh) ? `${person.voll} · ${roh}` : person.voll)
  meta.push(strecke || ortIds.map(id => ortName(id)).join(', '))
  const a = infos[0]?.z.created || v.zeit
  const b = infos[infos.length - 1]?.z.created || v.zeit
  let zeit = datumZeitLang(a)
  if (uhrzeitSek(a) !== uhrzeitSek(b) || tagSchluessel(a) !== tagSchluessel(b)) {
    zeit += tagSchluessel(a) === tagSchluessel(b) ? ` – ${uhrzeitSek(b)}` : ` – ${datumZeitLang(b)}`
  }
  meta.push(zeit)
  // Offline erfasst: wann wirklich entnommen wurde (created ist die Übertragung)
  const erfasst = v.zeilen.map(z => z.erfasst_am).filter((x): x is string => !!x).sort()[0]
  if (erfasst) {
    const e = pbZeit(erfasst)
    const ue = pbZeit(a)
    if (gueltig(e) && gueltig(ue) && Math.abs(ue.getTime() - e.getTime()) > 60_000) {
      meta.push(`erfasst ${datumZeitLang(erfasst)} · übertragen ${tagSchluessel(erfasst) === tagSchluessel(a) ? uhrzeitSek(a) : datumZeitLang(a)}`)
    }
  }
  if (einsaetze.length) meta.push(`Einsatz ${einsaetze.join(', ')}`)
  if (v.art === 'inventur' || v.art === 'korrektur') {
    if (!inventurKarte) for (const n of eindeutig<string>(infos.map(i => (i.z.note || '').trim()))) meta.push(`Notiz: ${n}`)
  } else {
    for (const n of eindeutig<string>(infos.map(i => i.e.restNotiz.trim()))) meta.push(`Notiz: ${n}`)
  }
  if (!v.sicher && v.zeilen.length > 1) meta.push('nach Zeitnähe zusammengefasst')
  for (const i of zurueck) {
    const r = ansicht.nachId.get(ansicht.original.get(i.z.id) || '')
    if (!r) continue
    const t = `${ansicht.vermutlich.has(i.z.id) ? 'Vermutlich zurückgenommen' : 'Zurückgenommen'} ${zeitBezug(r.created, v.tag)} von ${personKurz(r.user, namen).kurz}`
    if (!meta.includes(t)) meta.push(t)
  }
  if (v.art === 'rueckgaengig') {
    if (originale.length) {
      for (const o of originale) {
        const d = pbZeit(o.created)
        const t = `Nimmt ${ansicht.vermutlich.has(o.id) ? 'vermutlich ' : ''}${ART_TEXT[urArt]} vom ${datumKurz(d)} ${hhmm(d)} zurück`
        if (!meta.includes(t)) meta.push(t)
      }
    } else {
      meta.push(`Nimmt ${ART_TEXT[urArt]} zurück – das Original ist nicht in der Liste`)
    }
  }

  const farbe = alleZurueck ? GRAU_RAND : ART_FARBE[v.art]
  return {
    farbe,
    labelFarbe: farbe === GRAU_RAND ? 'var(--warm-gray)' : farbe,
    artText: ART_TEXT[v.art],
    menge,
    durch: alleZurueck,
    angeschnitten,
    name,
    person,
    bezug,
    zeile3,
    hinweise,
    zeilen,
    meta,
    einsatz: einsaetze[0] && einsaetze[0].length >= 2 ? einsaetze[0] : undefined,
    charge: chargen.length === 1 && chargen[0].length >= 2 ? chargen[0] : undefined,
    artikelId: artikelIds.length === 1 ? artikelIds[0] : undefined,
  }
}

// ── Abfrage ──────────────────────────────────────────────────────────────────

function holeSeite(f: LogFilter, anzahl: number): Promise<LogZeile[]> {
  return pb.collection('inventory_transactions')
    .getList<LogZeile>(1, anzahl, {
      filter: logbuchFilter(f, (raw, params) => pb.filter(raw, params)),
      sort: '-created,-id',
      skipTotal: true,
      requestKey: null,
    })
    .then(r => r.items)
}

/**
 * Vor dem Stornieren: der ganze Vorgang frisch vom Server und die Gegenbuchungen,
 * die ihn schon aufheben könnten. Die geladene Liste reicht dafür nicht — sie kann
 * gefiltert sein (Standort, Charge, „Nur meine“) oder an der Seitengrenze enden.
 */
async function ladeZumStornieren(orgId: string, vorgang: string): Promise<{ zeilen: LogZeile[]; ruecknahmen: LogZeile[] }> {
  const pbFilter = (raw: string, params?: Record<string, unknown>) => pb.filter(raw, params)
  const zeilen = await pb.collection('inventory_transactions').getFullList<LogZeile>({
    filter: vorgangFilter(orgId, vorgang, pbFilter), sort: 'created,id', requestKey: null,
  })
  if (!zeilen.length) return { zeilen, ruecknahmen: [] }
  const ruecknahmen = await pb.collection('inventory_transactions').getFullList<LogZeile>({
    filter: ruecknahmenFilter(orgId, zeilen, pbFilter), sort: 'created,id', requestKey: null,
  })
  return { zeilen, ruecknahmen }
}

const STORNO_FRAGE = 'Diese Buchung stornieren? Es entsteht eine Gegenbuchung; das Original bleibt im Logbuch sichtbar.'

interface Person { id: string; name: string; email: string }

// ── Stile ────────────────────────────────────────────────────────────────────

const sectionHeader: CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lbf-akzent)',
}

const textKnopf: CSSProperties = {
  background: 'none', border: 'none', padding: '0 4px', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--lbf-akzent)',
  WebkitTapHighlightColor: 'transparent',
}

const kursivGrau: CSSProperties = { fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }

const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }

function feldStil(abweichend: boolean): CSSProperties {
  return {
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 36, borderRadius: 6, padding: '0 6px', boxSizing: 'border-box', minWidth: 0,
    border: `0.5px solid ${abweichend ? 'var(--lbf-akzent)' : 'rgba(var(--lbf-rot-rgb),0.2)'}`,
    color: abweichend ? 'var(--lbf-akzent)' : 'var(--lbf-text)',
    background: 'var(--lbf-card)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  }
}

const STIL_CSS = `
.lager-logbuch-feld:focus-within { box-shadow: 0 0 0 3px var(--lbf-border-light); }
.lager-logbuch-knopf:focus-visible { outline: 2px solid var(--lbf-akzent); outline-offset: 2px; }
.lager-logbuch-karte:focus-visible { outline: 2px solid var(--lbf-akzent); outline-offset: -2px; border-radius: 12px; }
`

function Pfeil() {
  return (
    <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M0.5 0.5 L4 4 L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function Auswahl<T extends string>(p: {
  label: string; wert: T; optionen: { wert: T; text: string }[]; abweichend: boolean; onWahl: (w: T) => void
}): JSX.Element {
  const aktuell = p.optionen.find(o => o.wert === p.wert)?.text ?? ''
  return (
    <label className="lager-logbuch-feld" style={feldStil(p.abweichend)}>
      <span style={ellipsis}>{aktuell}</span>
      <Pfeil />
      <select
        aria-label={p.label}
        value={p.wert}
        onChange={e => p.onWahl(e.target.value as T)}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%',
          opacity: 0, fontSize: 16, cursor: 'pointer', border: 'none', background: 'transparent',
          WebkitAppearance: 'none', appearance: 'none', margin: 0,
        }}
      >
        {p.optionen.map(o => <option key={o.wert} value={o.wert}>{o.text}</option>)}
      </select>
    </label>
  )
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function LagerLogbuch(p: LagerLogbuchProps): JSX.Element {
  const artikelModus = p.modus === 'artikel'
  const [anfang] = useState(() => anfangsWahl(p.vorgabe, p.startLocationId))

  // Filter (Modus 'voll')
  const [standort, setStandort] = useState<string>(anfang.standort)
  const [zeitraum, setZeitraum] = useState<Zeitraum>(anfang.zeitraum)
  const [art, setArt] = useState<ArtFilter>('alle')
  const [nurMeine, setNurMeine] = useState(false)
  const [itemId, setItemId] = useState<string | null>(anfang.itemId)
  const [eingabe, setEingabe] = useState(anfang.eingabe)
  const [q, setQ] = useState(anfang.eingabe)
  const [kontext, setKontext] = useState<Kontext | null>(anfang.kontext)

  // Daten
  const [zeilen, setZeilen] = useState<LogZeile[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<FehlerInfo | null>(null)
  const [stand, setStand] = useState<Date | null>(null)
  const [mehr, setMehr] = useState(false)
  const [laedtMehr, setLaedtMehr] = useState(false)
  const [mehrFehler, setMehrFehler] = useState<FehlerInfo | null>(null)
  const [versuch, setVersuch] = useState(0)
  const [offen, setOffen] = useState<string | null>(null)
  const [personen, setPersonen] = useState<Person[]>([])
  // Stornieren: höchstens eines zugleich; fehler bleibt an seiner Karte stehen
  const [storno, setStorno] = useState<{ schluessel: string; laeuft: boolean; fehler: string | null } | null>(null)
  // Gerade storniert — bis die neu geladene Liste die Gegenbuchung zeigt, nicht noch einmal anbieten
  const [storniert, setStorniert] = useState<ReadonlySet<string>>(() => new Set())
  const stornoLaeuftRef = useRef(false)

  const genRef = useRef(0)
  /** Zählt "Ältere laden"-Anfragen; eine frisch geladene Seite 1 macht laufende ungültig. */
  const mehrGenRef = useRef(0)
  const zeilenRef = useRef<LogZeile[]>([])
  const schluesselRef = useRef<string | null>(null)
  const filterRef = useRef<LogFilter | null>(null)
  const mehrLaeuftRef = useRef(false)
  const listeRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => { zeilenRef.current = zeilen }, [zeilen])

  // Eine geänderte Vorgabe (Lager.tsx öffnet z. B. "Ganzer Verlauf") übernehmen
  const vorgabeSchluessel = JSON.stringify([p.vorgabe?.itemId || '', p.vorgabe?.q || '', !!p.vorgabe?.alleStandorte, p.vorgabe?.zeitraum || ''])
  const vorgabeRef = useRef(vorgabeSchluessel)
  useEffect(() => {
    if (vorgabeRef.current === vorgabeSchluessel) return
    vorgabeRef.current = vorgabeSchluessel
    const a = anfangsWahl(p.vorgabe, p.startLocationId)
    setStandort(a.standort); setZeitraum(a.zeitraum); setItemId(a.itemId)
    setEingabe(a.eingabe); setQ(a.eingabe); setKontext(a.kontext); setOffen(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorgabeSchluessel])

  // Suche: 300 ms nach dem letzten Tastendruck
  useEffect(() => {
    const t = window.setTimeout(() => setQ(eingabe.trim()), 300)
    return () => window.clearTimeout(t)
  }, [eingabe])

  // Personen: einmal je Öffnen. Ohne Liste werden Namen aus der E-Mail gebildet.
  useEffect(() => {
    if (!p.orgId) return
    let aktiv = true
    pb.collection('users')
      .getFullList<{ id: string; name?: string; email?: string }>({
        filter: pb.filter('organization_id = {:o}', { o: p.orgId }),
        fields: 'id,name,email',
        requestKey: null,
      })
      .then(liste => {
        if (!aktiv) return
        setPersonen(liste.map(x => ({ id: x.id, name: (x.name || '').trim(), email: (x.email || '').trim() })))
      })
      .catch(() => { /* keine Liste — personKurz nimmt die E-Mail */ })
    return () => { aktiv = false }
  }, [p.orgId])

  const namen = useMemo(() => {
    const m = new Map<string, string>()
    const setze = (k: string | undefined, n: string | undefined, ueberschreiben: boolean) => {
      const key = (k || '').trim()
      const name = (n || '').trim()
      if (!key || !name) return
      for (const s of [key, key.toLowerCase()]) if (ueberschreiben || !m.has(s)) m.set(s, name)
    }
    for (const x of personen) { setze(x.id, x.name, true); setze(x.email, x.name, true) }
    setze(p.ich.id, p.ich.name, false)
    setze(p.ich.email, p.ich.name, false)
    return m
  }, [personen, p.ich.id, p.ich.email, p.ich.name])

  const artikelMap = useMemo(() => new Map(p.items.map(i => [i.id, { name: i.name, unit: i.unit }])), [p.items])
  const ortMap = useMemo(() => new Map(p.locations.map(l => [l.id, l.name])), [p.locations])
  const artikelName = (id: string) => artikelMap.get(id)?.name || 'Gelöschter Artikel'
  const ortName = (id: string) => ortMap.get(id) || 'Gelöschter Standort'

  // Wirksame Filter
  const eff = artikelModus
    ? {
      standort: p.startLocationId || '', zeitraum: 'alle' as Zeitraum, art: 'alle' as ArtFilter, nurMeine: false, q: '',
      itemId: p.vorgabe?.itemId || null, einsatz: '', charge: '',
    }
    : {
      standort, zeitraum, art, nurMeine, q: q.length >= 2 ? q : '', itemId,
      einsatz: kontext?.typ === 'einsatz' ? kontext.wert : '',
      charge: kontext?.typ === 'charge' ? kontext.wert : '',
    }

  // Suche: Artikel lokal nach Name, Personen aus der Personenliste.
  // Der Filter hat Platz für 30 Artikel und 10 Kennungen (je Person ID und E-Mail).
  const suchIds = useMemo(() => {
    const leer = { itemIds: [] as string[], userIds: [] as string[], artikelGekappt: false, personenGekappt: false, personen: 0 }
    if (!eff.q) return leer
    const n = eff.q.toLocaleLowerCase('de-DE')
    const treffer = p.items.filter(i => (i.name || '').toLocaleLowerCase('de-DE').includes(n)).map(i => i.id)
    const itemIds = treffer.slice(0, SUCHE_MAX.artikel)
    const userIds: string[] = []
    let anzahl = 0
    let personenGekappt = false
    for (const x of personen) {
      if (!x.name.toLocaleLowerCase('de-DE').includes(n)) continue
      const kennungen = eindeutig<string>([x.id, x.email])
      if (userIds.length + kennungen.length > SUCHE_MAX.kennungen) { personenGekappt = true; break }
      userIds.push(...kennungen)
      anzahl++
    }
    return { itemIds, userIds, artikelGekappt: treffer.length > itemIds.length, personenGekappt, personen: anzahl }
  }, [eff.q, p.items, personen])

  const schluessel = JSON.stringify([
    p.modus, p.orgId, p.ich.id, p.ich.email || '', eff.standort, eff.zeitraum, eff.art, eff.nurMeine, eff.q, eff.itemId,
    eff.einsatz, eff.charge, suchIds.itemIds, suchIds.userIds,
  ])
  const seite = artikelModus ? SEITE_ARTIKEL : SEITE_VOLL

  // Laden: Filterwechsel leert die Liste; "aktualisiert"/"Erneut versuchen" lädt neu und behält sie bis zur Antwort.
  // Layout-Effekt: die Liste ist leer, bevor der neue Filter zum ersten Mal gezeichnet wird.
  // Der Generationszähler verwirft jede Antwort, die nicht zur letzten Anfrage gehört.
  useLayoutEffect(() => {
    const gen = ++genRef.current
    const neu = schluesselRef.current !== schluessel
    schluesselRef.current = schluessel
    if (neu) {
      setZeilen([]); setOffen(null); setStand(null); setMehr(false)
      if (listeRef.current) listeRef.current.scrollTop = 0
    }
    setLaedt(true); setFehler(null); setMehrFehler(null); setLaedtMehr(false)
    mehrLaeuftRef.current = false

    const f: LogFilter = {
      orgId: p.orgId,
      locationId: eff.standort || null,
      ab: abVon(eff.zeitraum, new Date()),
      itemId: eff.itemId,
      art: eff.art,
      nurMeine: eff.nurMeine ? { email: p.ich.email, id: p.ich.id } : null,
      suche: eff.q ? { q: eff.q, itemIds: suchIds.itemIds, userIds: suchIds.userIds } : null,
      einsatz: eff.einsatz || null,
      charge: eff.charge || null,
    }
    filterRef.current = f
    if (!p.orgId) {
      setZeilen([]); setMehr(false); setLaedt(false); setStand(new Date())
      return
    }
    holeSeite(f, seite).then(items => {
      if (gen !== genRef.current) return
      // Die frische Seite 1 ersetzt die Liste — ein noch laufendes "Ältere laden" setzt an der alten an
      mehrGenRef.current++; mehrLaeuftRef.current = false; setLaedtMehr(false); setMehrFehler(null)
      setZeilen(items); setMehr(items.length >= seite); setStand(new Date()); setLaedt(false)
    }, (e: unknown) => {
      if (gen !== genRef.current) return
      setFehler(fehlerVon(e, 'Logbuch nicht geladen')); setLaedt(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, p.aktualisiert, versuch])

  // Späte Antworten nach dem Schließen verwerfen
  useEffect(() => () => { genRef.current++ }, [])

  // "Ältere laden" setzt an der letzten Zeile an (Keyset). Während Seite 1 neu lädt,
  // gibt es das nicht; eine Antwort wird nur angehängt, wenn die Liste noch an
  // derselben Zeile endet — sonst entstünde eine Lücke oder Doppelung.
  const aelterLaden = useCallback(() => {
    const f = filterRef.current
    const letzte = zeilen[zeilen.length - 1]
    if (!f || !letzte || mehrLaeuftRef.current || laedt) return
    mehrLaeuftRef.current = true
    const gen = genRef.current
    const mgen = ++mehrGenRef.current
    const vor = { created: letzte.created, id: letzte.id }
    const gilt = () => gen === genRef.current && mgen === mehrGenRef.current
    const setztAn = (liste: LogZeile[]) => {
      const ende = liste[liste.length - 1]
      return !!ende && ende.id === vor.id && ende.created === vor.created
    }
    setLaedtMehr(true); setMehrFehler(null)
    holeSeite({ ...f, vor }, SEITE_VOLL).then(items => {
      if (!gilt()) return
      mehrLaeuftRef.current = false
      setLaedtMehr(false)
      if (!setztAn(zeilenRef.current)) return
      setZeilen(alt => (setztAn(alt) ? [...alt, ...items] : alt))
      setMehr(items.length >= SEITE_VOLL)
    }, (e: unknown) => {
      if (!gilt()) return
      mehrLaeuftRef.current = false
      setMehrFehler(fehlerVon(e, 'Ältere Buchungen nicht geladen')); setLaedtMehr(false)
    })
  }, [zeilen, laedt])

  // "Einsatz zeigen"/"Charge verfolgen": der Server-Filter sucht in der Notiz mit
  // "enthält" — hier exakt nachprüfen. Geladen und geblättert wird über alle Zeilen.
  const exakt = useMemo((): LogKontext | null => (
    eff.einsatz || eff.charge ? { einsatz: eff.einsatz || null, charge: eff.charge || null } : null
  ), [eff.einsatz, eff.charge])
  const sichtbar = useMemo(() => (exakt ? zeilen.filter(z => passtKontext(z, exakt)) : zeilen), [zeilen, exakt])

  const ansicht = useMemo((): Ansicht => {
    const { original, vermutlich } = findeRuecknahmen(sichtbar)
    const zuOriginal = new Map<string, string>()
    original.forEach((r, o) => { if (!zuOriginal.has(r)) zuOriginal.set(r, o) })
    return {
      vorgaenge: bildeVorgaenge(sichtbar),
      original, vermutlich, zuOriginal,
      nachId: new Map(sichtbar.map(z => [z.id, z])),
      einordnung: new Map(sichtbar.map(z => [z.id, einordnen(z)])),
    }
  }, [sichtbar])

  // Solange es ältere Zeilen gibt: Vorgänge an der Seitengrenze sind vielleicht unvollständig
  const grenze = mehr && zeilen.length ? zeilen[zeilen.length - 1] : null
  const amRand = useMemo(() => amSeitenende(ansicht.vorgaenge, grenze), [ansicht, grenze])

  const alleStandorte = !eff.standort
  const karten = useMemo(() => {
    const umfeld: Umfeld = { ansicht, namen, artikel: artikelMap, orte: ortMap, alleStandorte, angeschnitten: amRand }
    const liste = artikelModus ? ansicht.vorgaenge.slice(0, ARTIKEL_VORGAENGE) : ansicht.vorgaenge
    return liste.map(v => ({ v, b: beschreibe(v, umfeld) }))
  }, [ansicht, namen, artikelMap, ortMap, alleStandorte, artikelModus, amRand])

  // Angekommen: eine geladene Journalzeile trägt die Client-ID als id oder vorgang
  const angekommen = useMemo(() => {
    const s = new Set<string>()
    for (const z of zeilen) {
      s.add(z.id)
      if (z.vorgang) s.add(z.vorgang)
    }
    return s
  }, [zeilen])

  // Noch nicht übertragen — auf Standort (und Artikel, Art, Suche, Einsatz) beschränkt
  const wartend = useMemo(() => {
    const n = eff.q.toLocaleLowerCase('de-DE')
    return (p.wartend || [])
      // Teilweise übertragen bleibt sichtbar: der Hinweis "Bestand prüfen" gilt auch, wenn ein Teil angekommen ist
      .filter(w => !(w.client_id && w.status !== 'teilweise' && angekommen.has(w.client_id)))
      .filter(w => !eff.standort || w.location_id === eff.standort)
      // Ein Offline-Eintrag kennt seine Charge noch nicht; der Einsatz muss genau stimmen
      .filter(w => !eff.charge && (!eff.einsatz || (w.einsatz || '').trim() === eff.einsatz))
      .filter(w => !eff.itemId || w.item_id === eff.itemId)
      .filter(w => {
        if (eff.art === 'alle' || eff.art === 'pruefen') return true
        if (eff.art === 'ausbuchung') return w.delta < 0
        if (eff.art === 'einbuchung') return w.delta > 0
        return false
      })
      .filter(w => !n || (artikelMap.get(w.item_id)?.name || '').toLocaleLowerCase('de-DE').includes(n)
        || (w.einsatz || '').toLocaleLowerCase('de-DE').includes(n))
      .sort((a, b) => b.created_at - a.created_at)
  }, [p.wartend, angekommen, eff.standort, eff.itemId, eff.art, eff.q, eff.einsatz, eff.charge, artikelMap])

  // ── Handlungen ──

  // Exakter Bezug statt Volltextsuche — das Suchfeld wird frei und kann weiter eingrenzen
  const zeigeEinsatz = (einsatz: string) => {
    setKontext({ typ: 'einsatz', wert: einsatz }); setEingabe(''); setQ('')
    setStandort(''); setZeitraum('alle'); setItemId(null); setOffen(null)
  }
  const verfolgeCharge = (charge: string) => {
    setKontext({ typ: 'charge', wert: charge }); setEingabe(''); setQ('')
    setStandort(''); setZeitraum('alle'); setOffen(null)
  }
  const zeigeArtikel = (id: string) => {
    setItemId(id); setKontext(null); setEingabe(''); setQ(''); setZeitraum('alle'); setOffen(null)
  }
  const aufheben = () => {
    const std = standardWahl(p.startLocationId)
    setKontext(null); setItemId(null); setEingabe(''); setQ('')
    setStandort(std.standort); setZeitraum(std.zeitraum); setOffen(null)
  }
  /** Was die Karte zum Stornieren zeigt: den Knopf, einen Hinweis (Inventur) oder nichts. */
  const stornoAnzeige = (v: Vorgang): { knopf: boolean; hinweis?: string } => {
    const s = p.stornieren
    if (!s || storniert.has(v.schluessel)) return { knopf: false }
    // Gegenbuchungen und schon (auch nur teilweise) zurückgenommene Vorgänge: nichts anbieten
    if (v.art === 'rueckgaengig') return { knopf: false }
    if (v.zeilen.some(z => ansicht.original.has(z.id) || (ansicht.einordnung.get(z.id) ?? einordnen(z)).ruecknahme)) return { knopf: false }
    let darf = false
    try { darf = s.darf({ zeilen: v.zeilen, user: v.user, zeit: v.zeit }) } catch { darf = false }
    if (!darf) return { knopf: false }
    if (v.zeilen.some(z => z.type === 'korrektur')) return { knopf: false, hinweis: STORNO_GRUND.korrektur }
    if (!v.sicher) return { knopf: false }
    const r = ergebnisAusJournal(v.zeilen)
    // Nur teilweise geladen (Filter, Seitengrenze): beim Stornieren wird der ganze Vorgang nachgeladen und geprüft
    return { knopf: !!r.ergebnis || r.grund === STORNO_GRUND.unvollstaendig }
  }

  const storniere = async (v: Vorgang) => {
    const s = p.stornieren
    const vorgang = (v.zeilen[0]?.vorgang || '').trim()
    if (!s || !vorgang || stornoLaeuftRef.current) return
    if (!window.confirm(STORNO_FRAGE)) return
    stornoLaeuftRef.current = true
    setStorno({ schluessel: v.schluessel, laeuft: true, fehler: null })
    let fehlerText: string | null = null
    try {
      const geladen = await ladeZumStornieren(p.orgId, vorgang)
      const pruefung = pruefeStorno(geladen.zeilen, geladen.ruecknahmen)
      const z = geladen.zeilen
      if (pruefung.grund) fehlerText = pruefung.grund
      else if (!s.darf({ zeilen: z, user: z[0]?.user ?? null, zeit: z[z.length - 1]?.created || v.zeit })) fehlerText = 'Diese Buchung darfst du nicht stornieren.'
      else fehlerText = await s.los(z)
    } catch (e) {
      const f = fehlerVon(e, 'Nicht storniert')
      fehlerText = f.grund ? `${f.text} ${f.grund}` : f.text
    } finally {
      stornoLaeuftRef.current = false
    }
    if (fehlerText) {
      setStorno({ schluessel: v.schluessel, laeuft: false, fehler: fehlerText })
    } else {
      setStorno(null)
      setStorniert(alt => new Set(alt).add(v.schluessel))
    }
  }

  const waehleStandort = (s: string) => { setStandort(s); merkeWahl({ alleStandorte: s === '' }) }
  const waehleZeitraum = (z: Zeitraum) => { setZeitraum(z); merkeWahl({ zeitraum: z }) }
  const erneut = () => setVersuch(n => n + 1)

  const jetzt = new Date()
  const standortText = eff.standort ? ortName(eff.standort) : 'alle Standorte'
  const zr = zeitraumInfo(eff.zeitraum)

  // ── Bausteine ──

  const fehlerBlock = (f: FehlerInfo, kompakt: boolean, nochmal: () => void = erneut) => (
    <div style={{ textAlign: kompakt ? 'left' : 'center', padding: kompakt ? '6px 0' : '28px 12px' }}>
      <div style={{ fontWeight: 700, fontSize: kompakt ? 13 : 14, color: 'var(--lbf-text)' }}>{f.text}</div>
      {f.grund && <div style={{ ...kursivGrau, marginTop: 4 }}>{f.grund}</div>}
      <button type="button" className="lager-logbuch-knopf" style={textKnopf} onClick={nochmal}>Erneut versuchen</button>
    </div>
  )

  const ladeHinweis = (kompakt: boolean) => (
    <div style={{ ...kursivGrau, textAlign: kompakt ? 'left' : 'center', padding: kompakt ? '8px 0' : '36px 12px' }}>Lade Buchungen …</div>
  )

  const wartendKarte = (w: Wartend, kompakt: boolean) => {
    const d = new Date(w.created_at)
    const erfasst = tagVon(d) === tagVon(jetzt) ? hhmm(d) : `${datumKurz(d, jetzt)} ${hhmm(d)}`
    const einheit = einheitKurz(artikelMap.get(w.item_id)?.unit)
    const status: WartendStatus = w.status === 'unklar' || w.status === 'teilweise' || w.status === 'abgelehnt' ? w.status : 'wartet'
    const unten = [`erfasst ${erfasst}`]
    if (w.user_name) unten.push(`von ${w.user_name}`)
    // Fremde Einträge (geteiltes Tablet) gehen nicht automatisch — nur auf Wunsch aus der Liste
    if (status === 'wartet') unten.push(w.user_name ? 'wartet — wird nur auf Wunsch übertragen' : 'wartet auf Netz')
    else if (status === 'unklar') unten.push('Ausgang unklar — wird beim Übertragen geprüft, nicht doppelt gebucht')
    if (w.einsatz) unten.push(`Einsatz ${w.einsatz}`)
    if (!eff.standort) unten.push(ortName(w.location_id))
    const fehlerText = (w.fehler || '').trim()
    const warnung = status === 'teilweise' ? { text: 'teilweise übertragen — Bestand prüfen, wird nicht wiederholt', farbe: ORANGE }
      : status === 'abgelehnt' ? { text: fehlerText ? `abgelehnt: ${fehlerText}` : 'abgelehnt', farbe: FEHLERFARBE }
      : null
    return (
      <div key={w.id} style={{
        background: kompakt ? 'transparent' : 'var(--lbf-card)', borderRadius: kompakt ? 0 : 12,
        boxShadow: kompakt ? 'none' : 'var(--lbf-shadow)', borderLeft: `3px dashed ${warnung ? warnung.farbe : 'var(--warm-gray)'}`,
        marginBottom: kompakt ? 4 : 6, padding: kompakt ? '6px 0 6px 10px' : '10px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gray)' }}>
            {w.delta < 0 ? 'Ausbuchung' : 'Einbuchung'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: kompakt ? 13 : 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--lbf-text)', whiteSpace: 'nowrap' }}>
            {mengeText(w.delta, einheit)}
          </span>
        </div>
        {!kompakt && <div style={{ ...ellipsis, fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginTop: 2 }}>{artikelName(w.item_id)}</div>}
        <div style={{ ...kursivGrau, marginTop: 2, overflowWrap: 'anywhere' }}>{unten.join(' · ')}</div>
        {warnung && (
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 12, marginTop: 2, color: warnung.farbe, overflowWrap: 'anywhere' }}>{warnung.text}</div>
        )}
      </div>
    )
  }

  // ── Modus 'artikel': kompakte Vorschau ──

  if (artikelModus) {
    const vorschauItem = p.vorgabe?.itemId || ''
    const ortTitel = p.startLocationId ? ortName(p.startLocationId) : 'Alle Standorte'
    let inhalt: JSX.Element
    if (karten.length === 0 && fehler) inhalt = fehlerBlock(fehler, true)
    else if (karten.length === 0 && (laedt || !stand)) inhalt = ladeHinweis(true)
    else if (karten.length === 0) {
      inhalt = <div style={{ ...kursivGrau, padding: '8px 0' }}>Keine Buchungen {p.startLocationId ? `an ${ortTitel}` : 'an allen Standorten'}.</div>
    }
    else {
      inhalt = (
        <div>
          {fehler && <div style={{ ...kursivGrau, padding: '4px 0' }}>{fehler.text}</div>}
          {karten.map(({ v, b }) => (
            <div key={v.schluessel} style={{ borderLeft: `3px solid ${b.farbe}`, padding: '6px 0 6px 10px', marginBottom: 4, opacity: b.durch ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ ...kursivGrau, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{zeitKompakt(pbZeit(v.zeit), jetzt)}</span>
                <span style={{ ...ellipsis, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: b.labelFarbe }}>{b.artText}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--lbf-text)', whiteSpace: 'nowrap', textDecoration: b.durch ? 'line-through' : 'none' }}>{b.menge}</span>
              </div>
              <div style={{ ...kursivGrau, ...ellipsis }}>
                {[b.person.kurz, b.bezug].filter(Boolean).join(' · ')}
                {b.hinweise.map(h => (
                  <span key={h.text} style={{ color: h.farbe, fontWeight: 700 }}>{' · '}{h.text}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div>
        <style>{STIL_CSS}</style>
        <div style={{ ...sectionHeader, marginBottom: 8 }}>Verlauf · {ortTitel}</div>
        {wartend.map(w => wartendKarte(w, true))}
        {inhalt}
        {p.onGanzerVerlauf && vorschauItem && (
          <button type="button" className="lager-logbuch-knopf" style={textKnopf} onClick={() => p.onGanzerVerlauf?.(vorschauItem)}>
            Ganzer Verlauf ›
          </button>
        )}
      </div>
    )
  }

  // ── Modus 'voll' ──

  // Tage; "n Vorgänge" nur, wenn der Tag vollständig geladen ist
  const tage: { tag: string; liste: typeof karten }[] = []
  for (const k of karten) {
    const letzter = tage[tage.length - 1]
    if (letzter && letzter.tag === k.v.tag) letzter.liste.push(k)
    else tage.push({ tag: k.v.tag, liste: [k] })
  }
  const aeltesteTag = grenze ? tagSchluessel(grenze.created) : null
  const ab = filterRef.current?.ab ?? null
  const abTag = ab && (ab.getHours() || ab.getMinutes() || ab.getSeconds() || ab.getMilliseconds()) ? tagVon(ab) : null
  const tagVollstaendig = (tag: string) => tag !== aeltesteTag && tag !== abTag

  const zustand = [standortText, zr.zustand]
  if (stand) zustand.push(`Stand ${hhmm(stand)}`)
  else if (laedt) zustand.push('lädt …')

  const suchHinweis = eff.q && (suchIds.artikelGekappt || suchIds.personenGekappt)
    ? `Suche sehr allgemein — nur ${[
      suchIds.artikelGekappt ? `${SUCHE_MAX.artikel} Artikel` : '',
      suchIds.personenGekappt ? `${suchIds.personen} ${suchIds.personen === 1 ? 'Person' : 'Personen'}` : '',
    ].filter(Boolean).join(' und ')} berücksichtigt`
    : ''

  const bandTeile: string[] = []
  if (itemId) bandTeile.push(artikelName(itemId))
  if (kontext) bandTeile.push(kontext.typ === 'einsatz' ? `Einsatz ${kontext.wert}` : kontext.typ === 'charge' ? `Charge ${kontext.wert}` : `Suche „${kontext.wert}“`)
  const zeigeBand = bandTeile.length > 0
  if (zeigeBand) bandTeile.push(standortText, zr.zustand)

  const standortOptionen = [{ wert: '', text: 'Alle Standorte' }, ...p.locations.map(l => ({ wert: l.id, text: l.name }))]
  if (standort && !ortMap.has(standort)) standortOptionen.push({ wert: standort, text: 'Gelöschter Standort' })

  const weitereFilter = art !== 'alle' || nurMeine || !!eff.q || !!itemId || !!kontext
  const toggle = (s: string) => setOffen(o => (o === s ? null : s))
  const tasteKarte = (e: ReactKeyboardEvent<HTMLDivElement>, s: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s) }
  }

  const liste = (
    <>
      {wartend.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ ...sectionHeader, padding: '10px 0 6px' }}>Noch nicht übertragen · auf diesem Gerät · {wartend.length}</div>
          {wartend.map(w => wartendKarte(w, false))}
        </div>
      )}

      {fehler && sichtbar.length > 0 && (
        <div style={{ borderLeft: `3px solid ${ORANGE}`, padding: '4px 0 4px 10px', margin: '6px 0' }}>{fehlerBlock(fehler, true)}</div>
      )}

      {sichtbar.length === 0 && (
        fehler ? fehlerBlock(fehler, false)
          : laedt || !stand ? ladeHinweis(false)
            : (
              <div style={{ textAlign: 'center', padding: '32px 12px' }}>
                <div style={{ ...kursivGrau, fontSize: 13 }}>
                  {mehr && zeilen.length > 0
                    ? 'Unter den bisher geladenen Buchungen keine passenden.'
                    : `Keine ${weitereFilter ? 'passenden ' : ''}Buchungen ${eff.standort ? `an ${ortName(eff.standort)}` : 'an allen Standorten'} ${zr.leer}.`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                  {(eff.zeitraum === 'heute' || eff.zeitraum === '24h' || eff.zeitraum === '7t') && (
                    <button type="button" className="lager-logbuch-knopf" style={textKnopf} onClick={() => { setZeitraum('30t'); setOffen(null) }}>30 Tage anzeigen</button>
                  )}
                  {eff.zeitraum === '30t' && (
                    <button type="button" className="lager-logbuch-knopf" style={textKnopf} onClick={() => { setZeitraum('alle'); setOffen(null) }}>Gesamten Zeitraum</button>
                  )}
                  {eff.standort && (
                    <button type="button" className="lager-logbuch-knopf" style={textKnopf} onClick={() => { setStandort(''); setOffen(null) }}>Alle Standorte</button>
                  )}
                </div>
              </div>
            )
      )}

      {tage.map(t => (
        <section key={t.tag}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 1, background: 'var(--lbf-card)',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '10px 0 6px',
          }}>
            <div style={sectionHeader}>{tagTitel(t.tag, jetzt)}</div>
            {tagVollstaendig(t.tag) && (
              <div style={{ ...kursivGrau, fontSize: 11 }}>{t.liste.length} {t.liste.length === 1 ? 'Vorgang' : 'Vorgänge'}</div>
            )}
          </div>
          {t.liste.map(({ v, b }) => {
            const istOffen = offen === v.schluessel
            const aktionen: { text: string; los: () => void }[] = []
            if (b.einsatz) { const x = b.einsatz; aktionen.push({ text: 'Einsatz zeigen', los: () => zeigeEinsatz(x) }) }
            if (b.charge) { const x = b.charge; aktionen.push({ text: 'Charge verfolgen', los: () => verfolgeCharge(x) }) }
            if (b.artikelId && b.artikelId !== itemId) { const x = b.artikelId; aktionen.push({ text: 'Artikelverlauf', los: () => zeigeArtikel(x) }) }
            const sAnzeige = istOffen ? stornoAnzeige(v) : { knopf: false }
            const sHier = storno && storno.schluessel === v.schluessel ? storno : null
            const sKnopf = sAnzeige.knopf || !!sHier?.laeuft
            const sGesperrt = !!storno?.laeuft
            const mitKnoepfen = aktionen.length > 0 || sKnopf
            const zeigeStreifen = mitKnoepfen || !!sAnzeige.hinweis || !!sHier?.fehler
            return (
              <div key={v.schluessel} style={{
                background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)',
                borderLeft: `3px solid ${b.farbe}`, marginBottom: 6, overflow: 'hidden', opacity: b.durch ? 0.6 : 1,
              }}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={istOffen}
                  className="lager-logbuch-karte"
                  onClick={() => toggle(v.schluessel)}
                  onKeyDown={e => tasteKarte(e, v.schluessel)}
                  style={{ padding: '10px 12px', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', WebkitTapHighlightColor: 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                    <span style={{ ...kursivGrau, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{uhrzeit(v.zeit)}</span>
                    <span style={{ ...ellipsis, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: b.labelFarbe }}>{b.artText}</span>
                    <span style={{
                      marginLeft: 'auto', flex: 'none', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: 'var(--lbf-text)', whiteSpace: 'nowrap', textDecoration: b.durch ? 'line-through' : 'none',
                    }}>{b.menge}</span>
                  </div>
                  <div style={{ ...ellipsis, fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginTop: 2 }}>{b.name}</div>
                  <div style={{ ...kursivGrau, marginTop: 2, overflowWrap: 'anywhere' }}>{b.zeile3.join(' · ')}</div>
                  {b.hinweise.length > 0 && (
                    <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 12, marginTop: 2 }}>
                      {b.hinweise.map((h, i) => (
                        <span key={h.text} style={{ color: h.farbe }}>{i > 0 ? ' · ' : ''}{h.text}</span>
                      ))}
                    </div>
                  )}
                  {b.angeschnitten && (
                    <div style={{ ...kursivGrau, marginTop: 2 }}>… weitere Zeilen älter — Ältere laden</div>
                  )}
                </div>
                {istOffen && (
                  <div style={{ padding: '0 12px 10px' }}>
                    {b.zeilen.map(z => (
                      <div key={z.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', borderTop: '0.5px solid rgba(var(--lbf-rot-rgb),0.08)' }}>
                        <span style={{
                          flex: 'none', minWidth: 64, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: 'var(--lbf-text)', textDecoration: z.durch ? 'line-through' : 'none',
                        }}>{z.menge}</span>
                        <span style={{ fontSize: 12, color: 'var(--lbf-text)', minWidth: 0, overflowWrap: 'anywhere' }}>
                          {z.text}
                          {z.notiz && <span style={{ ...kursivGrau, display: 'block' }}>{z.notiz}</span>}
                        </span>
                      </div>
                    ))}
                    <div style={{ ...kursivGrau, lineHeight: 1.5, marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(var(--lbf-rot-rgb),0.08)', overflowWrap: 'anywhere' }}>
                      {b.meta.map((m, i) => <div key={i}>{m}</div>)}
                    </div>
                  </div>
                )}
                {istOffen && zeigeStreifen && (
                  <div style={{
                    borderTop: '0.5px solid rgba(var(--lbf-rot-rgb),0.08)', background: 'var(--lbf-fuss)',
                    padding: '8px 12px', display: 'flex', flexWrap: 'wrap', columnGap: 16,
                  }}>
                    {aktionen.map(a => (
                      <button key={a.text} type="button" className="lager-logbuch-knopf" style={{ ...textKnopf, margin: '-8px 0' }} onClick={a.los}>
                        {a.text}
                      </button>
                    ))}
                    {sKnopf && (
                      <button
                        type="button" className="lager-logbuch-knopf"
                        style={{
                          // Rechts abgesetzt von den Sprung-Knöpfen: Stornieren bucht
                          ...textKnopf, marginTop: -8, marginBottom: -8, marginLeft: 'auto', marginRight: 0,
                          opacity: sGesperrt ? 0.5 : 1, cursor: sGesperrt ? 'default' : 'pointer',
                        }}
                        disabled={sGesperrt}
                        onClick={() => { void storniere(v) }}
                      >
                        {sHier?.laeuft ? 'Storniert …' : 'Stornieren'}
                      </button>
                    )}
                    {sAnzeige.hinweis && !sHier?.fehler && (
                      <div style={{ ...kursivGrau, flexBasis: '100%', marginTop: mitKnoepfen ? 8 : 0, overflowWrap: 'anywhere' }}>{sAnzeige.hinweis}</div>
                    )}
                    {sHier?.fehler && (
                      <div role="alert" style={{
                        flexBasis: '100%', marginTop: mitKnoepfen ? 8 : 0, fontStyle: 'italic', fontWeight: 700, fontSize: 12,
                        color: FEHLERFARBE, overflowWrap: 'anywhere',
                      }}>{sHier.fehler}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}

      {zeilen.length > 0 && (mehr || sichtbar.length > 0) && (
        <div style={{ textAlign: 'center', padding: '6px 0 8px' }}>
          {mehr ? (
            <>
              {mehrFehler && fehlerBlock(mehrFehler, true, aelterLaden)}
              {!mehrFehler && (
                <button
                  type="button" className="lager-logbuch-knopf"
                  style={{ ...textKnopf, opacity: laedtMehr || laedt ? 0.5 : 1, cursor: laedtMehr || laedt ? 'default' : 'pointer' }}
                  disabled={laedtMehr || laedt} onClick={aelterLaden}
                >
                  {laedtMehr ? 'Lade …' : 'Ältere laden'}
                </button>
              )}
            </>
          ) : (
            <div style={{ ...kursivGrau, padding: '10px 0' }}>Keine weiteren Buchungen {zr.leer}.</div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'min(85vh, 760px)',
      // Das .lager-modal hat Innenabstand und eigene Höchsthöhe — ein Scrollbereich, nicht zwei
      maxHeight: 'calc(85vh - 48px - env(safe-area-inset-bottom, 0px))',
      minHeight: 0,
    }}>
      <style>{STIL_CSS}</style>
      <div style={{ flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
          <div style={sectionHeader}>Logbuch</div>
          {p.onClose && (
            <button type="button" className="lager-logbuch-knopf" style={{ ...textKnopf, marginRight: -4 }} onClick={p.onClose}>Schließen</button>
          )}
        </div>
        <div style={{ ...kursivGrau, marginBottom: 10 }}>{zustand.join(' · ')}</div>
        <input
          className="lager-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Logbuch durchsuchen"
          placeholder="Artikel, Charge, Einsatz, Person …"
          value={eingabe}
          onChange={e => {
            const wert = e.target.value
            setEingabe(wert)
            // Eine vorgegebene Suche endet mit dem Tippen; Einsatz/Charge bleiben bis "Aufheben"
            if (kontext?.typ === 'suche' && wert.trim() !== kontext.wert) setKontext(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { setQ(eingabe.trim()); e.currentTarget.blur() }
          }}
          style={{ fontSize: 16, WebkitAppearance: 'none', appearance: 'none' }}
        />
        {suchHinweis && <div style={{ ...kursivGrau, marginTop: 4 }}>{suchHinweis}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
          <Auswahl label="Standort" wert={standort} optionen={standortOptionen}
            abweichend={standort !== (p.startLocationId || '')} onWahl={waehleStandort} />
          <Auswahl<Zeitraum> label="Zeitraum" wert={zeitraum} optionen={ZEITRAEUME.map(z => ({ wert: z.wert, text: z.kurz }))}
            abweichend={zeitraum !== STANDARD_ZEITRAUM} onWahl={waehleZeitraum} />
          <Auswahl<ArtFilter> label="Art" wert={art} optionen={ARTEN}
            abweichend={art !== 'alle'} onWahl={a => setArt(a)} />
          <button type="button" aria-pressed={nurMeine} className="lager-logbuch-feld" style={feldStil(nurMeine)} onClick={() => setNurMeine(x => !x)}>
            <span style={ellipsis}>Nur meine</span>
          </button>
        </div>
        {zeigeBand && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8,
            padding: '0 4px 0 10px', borderRadius: 6, background: 'var(--lbf-akzent-weich)', borderLeft: '2px solid var(--lbf-akzent)',
          }}>
            <span style={{ ...ellipsis, fontStyle: 'italic', fontSize: 12, color: 'var(--lbf-text)' }}>{bandTeile.join(' · ')}</span>
            <button type="button" className="lager-logbuch-knopf" style={{ ...textKnopf, flex: 'none' }} onClick={aufheben}>Aufheben</button>
          </div>
        )}
      </div>
      <div
        ref={listeRef}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
          marginTop: 6,
        }}
      >
        {liste}
      </div>
    </div>
  )
}
