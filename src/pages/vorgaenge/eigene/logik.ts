// Reine Teile des Feld-Editors (Standardformulare) und des Baukastens (eigene Formulare),
// Bauplan Vorgänge 3.6, 3.7. Keine Imports aus React oder PocketBase: die Prüffälle laufen
// ohne DOM (src/lib/__tests__/vorlagenEditor.test.ts).
//
// Die Regeln für ein Feld sind dieselben wie in schemaFehler (felder.ts, Zwilling des
// Servers); hier nur mit Texten, die auf der Seite eines einzelnen Felds verständlich sind.
// Ein Prüffall hält beide gleich.

import {
  FELD_GRENZEN, FELD_TYP_NAME, STANDARD_FELDER, bausteine, kennungOk, vorlageModus,
  type Baustein, type FeldDef, type FeldTyp, type KernFeld, type StandardFormular, type StandardKonfig,
} from '../../../lib/formular/felder'
import { MODUS_KURZ } from '../texte'
import { E_TEXTE as T } from './texte'

// ── Adressen der Seiten (3.3) ───────────────────────────────────────────────

/** `feld&id=<formular>:<kennung>` lesen; `neu` für ein neues eigenes Feld. */
export function feldAdresse(id: string | undefined): { formular: StandardFormular; kennung: string } | null {
  const [f, kennung = '', ...rest] = String(id ?? '').split(':')
  if (rest.length || !istStandardFormular(f) || !(kennung === 'neu' || kennungOk(kennung))) return null
  return { formular: f, kennung }
}

export function istStandardFormular(x: unknown): x is StandardFormular {
  return x === 'produktausgabe' || x === 'defektmeldung' || x === 'cirs'
}

/** Schlüssel einer Vorlage in Adressen und im Entwurf: ihre Kennung oder `neu`. */
export function vorlageSchluessel(id: string | undefined | null): string {
  return id && kennungOk(id) ? id : 'neu'
}

/**
 * `vorlage-feld&id=<vorlage>:<feld>` bzw. `vorlage-abschnitt&id=<vorlage>:<abschnitt>` lesen.
 * Neu: `<vorlage>:neu`, ein neues Feld in einem Abschnitt `<vorlage>:neu.<abschnitt>`.
 */
export function teilAdresse(id: string | undefined): { vorlage: string; teil: string; abschnitt: string } | null {
  const [v, t = '', ...rest] = String(id ?? '').split(':')
  if (rest.length || !(v === 'neu' || kennungOk(v))) return null
  if (t === 'neu') return { vorlage: v, teil: 'neu', abschnitt: '' }
  const m = /^neu\.(.+)$/.exec(t)
  if (m) return kennungOk(m[1]) ? { vorlage: v, teil: 'neu', abschnitt: m[1] } : null
  return kennungOk(t) ? { vorlage: v, teil: t, abschnitt: '' } : null
}

/** `vorschau&id=<formular>` (Standardformular) oder `vorschau&id=vorlage:<vorlage>`. */
export function vorschauAdresse(id: string | undefined): { art: 'standard'; formular: StandardFormular } | { art: 'vorlage'; vorlage: string } | null {
  const s = String(id ?? '')
  if (istStandardFormular(s)) return { art: 'standard', formular: s }
  const m = /^vorlage:(.+)$/.exec(s)
  if (m && (m[1] === 'neu' || kennungOk(m[1]))) return { art: 'vorlage', vorlage: m[1] }
  return null
}

// ── Standardformulare: Einstellung ändern ───────────────────────────────────

export function kernFeld(f: StandardFormular, id: string): KernFeld | null {
  return (STANDARD_FELDER[f] ?? []).find((k) => k.id === id) ?? null
}

/**
 * Bezeichnung, Hilfetext, aus und Pflicht eines Kernfelds setzen. Gespeichert wird nur,
 * was von der Vorgabe abweicht und erlaubt ist (aus nur bei abschaltbaren, Pflicht nur bei
 * wählbaren Feldern). Bleibt nichts übrig, fällt der Eintrag weg.
 */
export function kernSetzen(k: StandardKonfig, kern: KernFeld, a: { label?: string; hilfe?: string; aus?: boolean; pflicht?: boolean }): StandardKonfig {
  const e: StandardKonfig['felder'][string] = {}
  const label = String(a.label ?? '').trim().slice(0, FELD_GRENZEN.label)
  if (label && label !== kern.label) e.label = label
  const hilfe = String(a.hilfe ?? '').trim().slice(0, FELD_GRENZEN.hilfe)
  if (hilfe) e.hilfe = hilfe
  if (kern.ausErlaubt && a.aus === true) e.aus = true
  if (kern.pflichtWaehlbar && typeof a.pflicht === 'boolean' && a.pflicht !== kern.pflichtVor) e.pflicht = a.pflicht
  const felder = { ...k.felder }
  if (Object.keys(e).length) felder[kern.id] = e
  else delete felder[kern.id]
  return { ...k, felder }
}

/** Ein Kernfeld auf die Vorgabe von Responda zurücksetzen. */
export function kernZuruecksetzen(k: StandardKonfig, id: string): StandardKonfig {
  const felder = { ...k.felder }
  delete felder[id]
  return { ...k, felder }
}

/** Ein eigenes Feld ändern (gleiche Kennung) oder anlegen (ans Ende der Reihenfolge). */
export function eigenesSetzen(k: StandardKonfig, feld: FeldDef): StandardKonfig {
  const d = { ...feld }
  delete d.abschnitt
  const da = k.eigene.some((x) => x.id === d.id)
  const eigene = da ? k.eigene.map((x) => (x.id === d.id ? d : x)) : [...k.eigene, d]
  const reihenfolge = k.reihenfolge.includes(d.id) ? k.reihenfolge.slice() : [...k.reihenfolge, d.id]
  return { ...k, eigene, reihenfolge }
}

/** Ein eigenes Feld entfernen (aus den Feldern und aus der Reihenfolge). */
export function eigenesEntfernen(k: StandardKonfig, id: string): StandardKonfig {
  return { ...k, eigene: k.eigene.filter((x) => x.id !== id), reihenfolge: k.reihenfolge.filter((x) => x !== id) }
}

/** Ein Element einer Liste um eine Stelle verschieben; am Rand bleibt alles, wie es ist. */
export function verschieben<T>(liste: T[], i: number, richtung: -1 | 1): T[] {
  const j = i + richtung
  if (i < 0 || i >= liste.length || j < 0 || j >= liste.length) return liste.slice()
  const neu = liste.slice()
  ;[neu[i], neu[j]] = [neu[j], neu[i]]
  return neu
}

/** Die Reihenfolge so, wie sie die Seite „Felder“ zeigt: alle Bausteine, auch ausgeblendete. */
export function reihenfolgeAus(k: StandardKonfig, f: StandardFormular): string[] {
  return bausteine(k, f, { mitAusgeblendeten: true }).map((b) => (b.art === 'kern' ? b.id : b.feld.id))
}

/** Zeile eines Bausteins in der Liste „Felder“: Bezeichnung und „Fest“, „Pflicht“, „Text · Pflicht“ … */
export function bausteinZeile(b: Baustein): { titel: string; unter: string; kennung: string } {
  if (b.art === 'kern') {
    const teile: string[] = []
    if (b.kern.fest) teile.push(T.fest)
    if (b.aus) teile.push(T.ausgeblendet)
    else if (!b.kern.fest) teile.push(b.pflicht ? T.pflicht : T.optional)
    if (b.hilfe) teile.push(T.hilfetext)
    return { titel: b.label, unter: teile.join(' · '), kennung: b.id }
  }
  return { titel: b.feld.label || b.feld.id, unter: feldUnter(b.feld), kennung: b.feld.id }
}

/** „Auswahl · 3 Optionen · Pflicht“ für ein eigenes Feld. */
export function feldUnter(d: FeldDef): string {
  const teile: string[] = [FELD_TYP_NAME[d.typ] ?? d.typ]
  if (d.typ === 'auswahl' || d.typ === 'mehrfach') teile.push(T.optionen(d.optionen?.length ?? 0))
  if (d.typ === 'zahl' && d.einheit) teile.push(d.einheit)
  if (d.aus) teile.push(T.ausgeblendet)
  else teile.push(d.pflicht ? T.pflicht : T.optional)
  return teile.join(' · ')
}

/** Kurzfassung für die Seite eines Standardformulars: „4 feste Felder · 2 eigene · 1 ausgeblendet“. */
export function felderZusammenfassung(k: StandardKonfig, f: StandardFormular): string {
  const alle = bausteine(k, f, { mitAusgeblendeten: true })
  const fest = alle.filter((b) => b.art === 'kern' && b.kern.fest).length
  const kern = alle.filter((b) => b.art === 'kern').length
  const eigene = alle.filter((b) => b.art === 'eigen').length
  const aus = alle.filter((b) => (b.art === 'kern' ? b.aus : b.feld.aus === true)).length
  const teile = [
    fest === kern ? (kern === 1 ? '1 festes Feld' : `${kern} feste Felder`) : `${kern} Standardfelder`,
  ]
  if (eigene) teile.push(eigene === 1 ? '1 eigenes' : `${eigene} eigene`)
  if (aus) teile.push(`${aus} ausgeblendet`)
  return teile.join(' · ')
}

// ── Liste „Eigene Formulare“ ────────────────────────────────────────────────

/** Die Zeile unter dem Titel: „Aktiv · Name frei eintragen · 3 neu“, „Inaktiv“, „Archiviert“. */
export function vorlageZeile(v: Record<string, unknown>, neu: number | null): string {
  const teile: string[] = []
  if (v.archiviert === true) teile.push(T.archiviertWort)
  else teile.push(v.is_active === true ? T.aktiv : T.inaktiv)
  teile.push(MODUS_KURZ[vorlageModus(v)])
  if (neu && neu > 0) teile.push(T.neuZahl(neu))
  return teile.join(' · ')
}

// ── Ein Feld bearbeiten ─────────────────────────────────────────────────────

/** Was die Seite eines Felds im Zustand hält: Optionen als Texte (auch leere), Grenzen als Zahl oder NaN. */
export type FeldEntwurf = {
  id: string
  typ: FeldTyp
  label: string
  hilfe: string
  pflicht: boolean
  aus: boolean
  optionen: string[]
  einheit: string
  min: number | null
  max: number | null
  abschnitt: string
}

export function feldEntwurf(d: FeldDef | null, id: string, abschnitt = ''): FeldEntwurf {
  return {
    id: d?.id ?? id,
    typ: d?.typ ?? 'text',
    label: d?.label ?? '',
    hilfe: d?.hilfe ?? '',
    pflicht: d?.pflicht === true,
    aus: d?.aus === true,
    optionen: d?.optionen?.length ? d.optionen.slice() : ['', ''],
    einheit: d?.einheit ?? '',
    min: typeof d?.min === 'number' ? d.min : null,
    max: typeof d?.max === 'number' ? d.max : null,
    abschnitt: d?.abschnitt ?? abschnitt,
  }
}

export type FeldFehler = { feld: 'label' | 'hilfe' | 'optionen' | 'einheit' | 'min' | 'max'; text: string }

/**
 * Ein Feld prüfen wie schemaFehler (Bezeichnung 1 bis 120, Hilfetext bis 300, Auswahl mit
 * 2 bis 30 eindeutigen Optionen bis 80 Zeichen, Einheit bis 12, Grenzen endlich und
 * kleinster ≤ größter). Leere Optionen zählen nicht (sie fallen beim Speichern weg).
 */
export function feldPruefen(e: FeldEntwurf): FeldFehler | null {
  const G = FELD_GRENZEN
  const label = e.label.trim()
  if (!label) return { feld: 'label', text: T.labelFehlt }
  if (label.length > G.label) return { feld: 'label', text: T.labelLang }
  if (e.hilfe.trim().length > G.hilfe) return { feld: 'hilfe', text: T.hilfeLang }
  if (e.typ === 'auswahl' || e.typ === 'mehrfach') {
    const opt = e.optionen.map((o) => o.trim()).filter(Boolean)
    if (opt.length < G.optionen_min) return { feld: 'optionen', text: T.optionenZuWenig }
    if (opt.length > G.optionen) return { feld: 'optionen', text: T.optionenZuViel }
    if (opt.some((o) => o.length > G.option)) return { feld: 'optionen', text: T.optionLang }
    const gesehen = new Set<string>()
    for (const o of opt) {
      const k = o.toLowerCase()
      if (gesehen.has(k)) return { feld: 'optionen', text: T.optionDoppelt(o) }
      gesehen.add(k)
    }
  }
  if (e.typ === 'zahl') {
    if (e.einheit.trim().length > G.einheit) return { feld: 'einheit', text: T.einheitLang }
    for (const k of ['min', 'max'] as const) {
      const n = e[k]
      if (n === null) continue
      if (!Number.isFinite(n)) return { feld: k, text: T.zahlUnlesbar }
      if (Math.abs(n) > G.zahl) return { feld: k, text: T.grenzenGross }
    }
    if (e.min !== null && e.max !== null && e.min > e.max) return { feld: 'max', text: T.grenzenFalsch }
  }
  return null
}

/** Aus dem Entwurf das gespeicherte Feld: getrimmt, nur die Schlüssel seiner Art. */
export function feldAusEntwurf(e: FeldEntwurf, o: { mitAbschnitt?: boolean } = {}): FeldDef {
  // Nicht kürzen: feldPruefen sagt vorher, was zu lang ist
  const d: FeldDef = { id: e.id, typ: e.typ, label: e.label.trim() }
  const hilfe = e.hilfe.trim()
  if (hilfe) d.hilfe = hilfe
  if (e.pflicht) d.pflicht = true
  if (e.aus) d.aus = true
  if (e.typ === 'auswahl' || e.typ === 'mehrfach') d.optionen = e.optionen.map((x) => x.trim()).filter(Boolean)
  if (e.typ === 'zahl') {
    const einheit = e.einheit.trim()
    if (einheit) d.einheit = einheit
    if (e.min !== null && Number.isFinite(e.min)) d.min = e.min
    if (e.max !== null && Number.isFinite(e.max)) d.max = e.max
  }
  if (o.mitAbschnitt && e.abschnitt) d.abschnitt = e.abschnitt
  return d
}

// ── Fehler des Servers ──────────────────────────────────────────────────────

type PbFehler = { status?: number; message?: string; response?: { message?: string; data?: Record<string, unknown> } }

/** Englische Sammeltexte von PocketBase, die nichts sagen; dann zählt der Grund je Feld. */
const PB_SAMMEL = /^(Failed to|Something went wrong|The request|Missing or invalid|Only superusers|The requested resource)/i

/**
 * Eine Ablehnung beim Speichern einer Vorlage, für Menschen lesbar: die deutsche Meldung des
 * Hooks (400, 403, 409), sonst `sonst(e)` (etwa pbFehlerText). 0: ohne Netz.
 */
export function vorlageFehlerText(e: unknown, sonst: (e: unknown) => string): string {
  const f = (e ?? {}) as PbFehler
  if (f.status === 0) return 'Keine Verbindung zum Server. Bitte mit Netz erneut versuchen.'
  const m = String(f.response?.message || f.message || '').trim()
  const daten = f.response?.data && typeof f.response.data === 'object' ? Object.keys(f.response.data) : []
  if (m && !PB_SAMMEL.test(m) && daten.length === 0) return m
  return sonst(e)
}

/** Konflikt beim Speichern (basis_version stimmt nicht mehr, Plan 2.7.3)? */
export function istKonflikt(e: unknown): boolean {
  return ((e ?? {}) as PbFehler).status === 409
}
