// Eingang eigener Formulare (Bauplan Vorgänge, 3.8): Einsendungen lesen, zählen,
// filtern, als CSV ausgeben und drucken.
//
// Einsendungen (form_submissions) baut nur der Server (Route /absenden, Plan 1.5);
// Mitglieder mit dem Recht Vorgänge ändern daran nur Status und Notiz (Hook
// pb_hooks/eigene-formulare.pb.js). Hier steht nur, was die Seiten unter Vorgänge
// zeigen. Keine Imports aus React oder PocketBase: die Prüffälle laufen ohne DOM
// (src/lib/__tests__/eingang.test.ts).

import {
  EINSENDUNG_STATUS, abschnitteLesen, einsendungLesen, feldLesen, schemaLesen, wertLeer, wertText,
  type Abschnitt, type Einsendung, type EinsendungStatus, type FeldDef, type Wert,
} from './felder'
import { absenderLesen, jsonLesen, type AbsenderEintrag, type AbsenderStatus } from './absender'
import { csvText } from '../csv'
import { escapeHtml } from '../aelrdDruck'

type Obj = Record<string, unknown>

function istObjekt(x: unknown): x is Obj {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

// ── Texte ────────────────────────────────────────────────────────────────────

/** Texte des Eingangs, ruhig und ohne Gedankenstriche (ein Prüffall prüft das). */
export const EINGANG_TEXTE = {
  reiter: 'Eingang',
  eingang: 'Eingang',
  leerReiter: 'Noch keine Einsendungen.',
  leerReiterHinweis: 'Hier erscheinen eure eigenen Formulare, sobald sie aktiv sind oder etwas eingegangen ist.',
  /** Einsendungen zu Formularen, die es nicht mehr gibt: nicht verloren, aber hier nicht zu öffnen. */
  verwaist: (n: number) => `${n === 1 ? 'Eine Einsendung gehört' : `${n} Einsendungen gehören`} zu einem Formular, das es nicht mehr gibt. ${n === 1 ? 'Sie bleibt' : 'Sie bleiben'} gespeichert, lässt sich hier aber nicht öffnen und zählt nicht am Reiter.`,
  leer: { neu: 'Keine neuen Einsendungen.', in_bearbeitung: 'Nichts in Bearbeitung.', archiv: 'Noch nichts im Archiv.' },
  leerSuche: 'Keine Einsendung passt zur Suche.',
  sucheAria: 'Einsendungen durchsuchen',
  suchePlatzhalter: 'Absender oder Angaben suchen',
  sucheLeeren: 'Suche leeren',
  csv: 'Als CSV laden',
  csvLeer: 'Keine Einsendungen in dieser Liste.',
  anonym: 'Anonym',
  ohneNamen: 'Ohne Namen',
  absender: 'Absender',
  angaben: 'Angaben',
  bearbeitung: 'Bearbeitung',
  statusAria: 'Status der Einsendung',
  drucken: 'Drucken',
  druckenUnter: 'Ohne interne Notiz',
  druckenNotiz: 'Drucken mit interner Notiz',
  druckenNotizUnter: 'Die Notiz steht dann mit auf dem Blatt',
  druckBlockiert: 'Das Druckfenster wurde blockiert. Bitte Pop-ups für Responda erlauben.',
  wartet: 'Wartet auf die Unterschrift des Absenders.',
  anonymHinweis: 'Dieses Formular wird ohne Namen gesendet.',
  frueher: 'Gesendet mit einer früheren Fassung des Formulars.',
  aelterGruppe: 'Aus einer früheren Fassung',
  nichtAusgefuellt: 'Nicht ausgefüllt',
  keineAngaben: 'Keine Angaben.',
  notizLabel: 'Interne Notiz',
  notizZusatz: 'freiwillig',
  notizHinweis: 'Sieht nur, wer Vorgänge bearbeitet.',
  notizSpeichern: 'Notiz speichern',
  notizGespeichert: 'Notiz gespeichert',
  notizKonflikt: 'Die Notiz wurde inzwischen geändert. Bitte neu laden.',
  notizZuLang: 'Die Notiz ist zu lang. Höchstens 4000 Zeichen.',
  neuLaden: 'Neu laden',
  statusKonflikt: 'Der Status wurde inzwischen an anderer Stelle geändert. Hier steht jetzt der neue Stand.',
  gesperrt: 'Status und Notiz lassen sich speichern, sobald der Server umgestellt ist.',
  verlauf: 'Verlauf',
  verlaufLeer: 'Noch nicht bearbeitet.',
  gespeichert: 'Gespeichert',
  keinZugriffTitel: 'Kein Zugriff',
  keinZugriff: 'Den Eingang sehen nur Mitglieder mit dem Recht „Vorgänge“, wenn das Modul Vorgänge für eure Organisation frei ist.',
  nichtGefundenTitel: 'Nicht gefunden',
  nichtGefunden: 'Diese Einsendung gibt es nicht oder sie gehört zu einer anderen Organisation.',
  vorlageNichtGefunden: 'Dieses Formular gibt es nicht oder es gehört zu einer anderen Organisation.',
  laedt: 'Lädt…',
  ladefehler: 'Die Einsendungen konnten nicht geladen werden.',
  einsendungLadefehler: 'Die Einsendung konnte nicht geladen werden.',
  keinNetz: 'Keine Verbindung. Bitte später erneut versuchen.',
  keinRecht: 'Einsendungen sehen und bearbeiten nur Mitglieder mit dem Recht für Vorgänge.',
  nichtGespeichert: 'Nicht gespeichert. Bitte erneut versuchen.',
  erneutLaden: 'Erneut laden',
  archiviert: 'Archiviert',
  formular: 'Formular',
  fassung: 'Fassung',
  eingegangen: 'Eingegangen',
  status: 'Status',
  zurueckEingang: 'Zurück zum Eingang',
} as const

export const STATUS_NAME: Record<EinsendungStatus, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

/** Kurz in der Zeile unter dem Formular: „3 neu · 2 in Bearbeitung“. */
const STATUS_KLEIN: Record<EinsendungStatus, string> = {
  neu: 'neu',
  in_bearbeitung: 'in Bearbeitung',
  erledigt: 'erledigt',
}

/** Erklärung je Status (Wahl auf der Seite einer Einsendung). */
export const STATUS_ERKLAERUNG: Record<EinsendungStatus, string> = {
  neu: 'Noch niemand hat sich darum gekümmert.',
  in_bearbeitung: 'Jemand kümmert sich darum.',
  erledigt: 'Fertig bearbeitet, steht im Archiv.',
}

/** Zustand des Absenders in Worten (CSV, Druck). */
export const ABSENDER_STATUS_TEXT: Record<AbsenderStatus, string> = {
  bestaetigt: 'bestätigt',
  nicht_bestaetigt: 'nicht bestätigt',
  ohne_konto: 'ohne Konto',
  ausstehend: 'Unterschrift ausstehend',
  ohne_unterschrift: 'ohne Unterschrift',
}

// ── Status und Ansichten ────────────────────────────────────────────────────

export type EingangAnsicht = 'neu' | 'in_bearbeitung' | 'archiv'
export const EINGANG_ANSICHTEN: { wert: EingangAnsicht; name: string }[] = [
  { wert: 'neu', name: 'Neu' },
  { wert: 'in_bearbeitung', name: 'In Bearbeitung' },
  { wert: 'archiv', name: 'Archiv' },
]

export function istAnsicht(x: unknown): x is EingangAnsicht {
  return x === 'neu' || x === 'in_bearbeitung' || x === 'archiv'
}

/** Status eines Datensatzes; fehlt das Feld oder ist es unbekannt, gilt „neu“ (Plan 1.5). */
export function statusVon(rec: Obj | null | undefined): EinsendungStatus {
  const s = rec?.status
  return EINSENDUNG_STATUS.includes(s as EinsendungStatus) ? (s as EinsendungStatus) : 'neu'
}

/** In welcher Liste eine Einsendung steht: Erledigtes im Archiv. */
export function ansichtVon(status: EinsendungStatus): EingangAnsicht {
  return status === 'erledigt' ? 'archiv' : status
}

/**
 * Hat die Sammlung die Felder für Status und Notiz (Owner-Schritt 6)? PocketBase liefert jedes
 * Feld der Sammlung mit, auch leer; fehlt der Schlüssel, fehlt das Feld.
 */
export function felderDa(rec: Obj | null | undefined): boolean {
  return !!rec && typeof rec === 'object' && 'status' in rec && 'notiz' in rec
}

/** Die Hauptaktion der Leiste je Status. */
export function leisteAktion(status: EinsendungStatus): { knopf: string; ziel: EinsendungStatus } {
  if (status === 'neu') return { knopf: 'In Bearbeitung nehmen', ziel: 'in_bearbeitung' }
  if (status === 'in_bearbeitung') return { knopf: 'Als erledigt ablegen', ziel: 'erledigt' }
  return { knopf: 'Wieder öffnen', ziel: 'in_bearbeitung' }
}

// ── Zählen ───────────────────────────────────────────────────────────────────

export type Zahlen = { neu: number; in_bearbeitung: number; erledigt: number; gesamt: number }

export function leereZahlen(): Zahlen {
  return { neu: 0, in_bearbeitung: 0, erledigt: 0, gesamt: 0 }
}

export function zaehlen(recs: Obj[] | null | undefined): Zahlen {
  const z = leereZahlen()
  for (const r of recs ?? []) {
    z[statusVon(r)]++
    z.gesamt++
  }
  return z
}

/** Zahlen je Vorlage (template_id). */
/** Zahl der Einsendungen, deren Formular es in der Organisation nicht (mehr) gibt. */
export function verwaisteEinsendungen(recs: Obj[] | null | undefined, vorlagen: Obj[] | null | undefined): number {
  const da = new Set((vorlagen ?? []).map((v) => String(v?.id ?? '')))
  let n = 0
  for (const r of recs ?? []) if (!da.has(String(r?.template_id ?? ''))) n++
  return n
}

export function zaehlenJeVorlage(recs: Obj[] | null | undefined): Record<string, Zahlen> {
  const aus: Record<string, Zahlen> = {}
  for (const r of recs ?? []) {
    const id = String(r?.template_id ?? '')
    if (!id) continue
    const z = aus[id] ?? (aus[id] = leereZahlen())
    z[statusVon(r)]++
    z.gesamt++
  }
  return aus
}

/** „3 neu · 2 in Bearbeitung“; nichts offen: „Nichts offen · 12 im Archiv“; gar nichts: „Noch keine Einsendungen“. */
export function zahlenZeile(z: Zahlen | null | undefined): string {
  const x = z ?? leereZahlen()
  const teile: string[] = []
  if (x.neu > 0) teile.push(`${x.neu} ${STATUS_KLEIN.neu}`)
  if (x.in_bearbeitung > 0) teile.push(`${x.in_bearbeitung} ${STATUS_KLEIN.in_bearbeitung}`)
  if (teile.length) return teile.join(' · ')
  if (x.erledigt > 0) return `Nichts offen · ${x.erledigt} im Archiv`
  return 'Noch keine Einsendungen'
}

/** Beschriftung eines Reiters der Liste: „Neu (3)“. */
export function ansichtLabel(a: EingangAnsicht, z: Zahlen): string {
  const n = a === 'archiv' ? z.erledigt : z[a]
  const name = EINGANG_ANSICHTEN.find((x) => x.wert === a)?.name ?? a
  return `${name} (${n})`
}

// ── Zeit ─────────────────────────────────────────────────────────────────────

/** Zeitpunkt aus ISO oder dem PocketBase-Format mit Leerzeichen; null, wenn unlesbar. */
export function zeitpunkt(wert: unknown): Date | null {
  if (typeof wert !== 'string' || !wert.trim()) return null
  const w = wert.trim()
  const d = new Date(w.includes(' ') && !w.includes('T') ? w.replace(' ', 'T') : w)
  return Number.isNaN(d.getTime()) ? null : d
}

/** „07.11.2026, 10:20“; leer, wenn unlesbar. */
export function zeitText(wert: unknown): string {
  const d = zeitpunkt(wert)
  return d ? d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

/** „07.11., 10:24“ (Verlauf); leer, wenn unlesbar. */
export function zeitKurz(wert: unknown): string {
  const d = zeitpunkt(wert)
  if (!d) return ''
  const z = (n: number) => String(n).padStart(2, '0')
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}., ${z(d.getHours())}:${z(d.getMinutes())}`
}

// ── Vorlagen ─────────────────────────────────────────────────────────────────

export function vorlageTitel(v: unknown): string {
  const t = istObjekt(v) && typeof v.title === 'string' ? v.title.trim() : ''
  return t || EINGANG_TEXTE.formular
}

/** Fassung der Vorlage (Feld `version`, setzt nur der Hook); 0, wenn sie fehlt. */
export function vorlageVersion(v: unknown): number {
  const n = istObjekt(v) ? v.version : undefined
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

export function vorlageArchiviert(v: unknown): boolean {
  return istObjekt(v) && v.archiviert === true
}

/**
 * Die letzte Bezeichnung je Feldkennung: zuerst die der aktuellen Vorlage, dann die der älteren
 * Fassungen (`fassungen`, neueste zuerst). So bekommen Werte aus früheren Fassungen ihre letzte
 * Bezeichnung statt der Kennung.
 */
export function bezeichnungen(vorlage: unknown): Record<string, string> {
  const aus: Record<string, string> = {}
  const setzen = (f: FeldDef) => {
    if (f.label && !Object.prototype.hasOwnProperty.call(aus, f.id)) aus[f.id] = f.label
  }
  for (const f of schemaLesen(vorlage).felder) setzen(f)
  const roh = istObjekt(vorlage) ? jsonLesen(vorlage.fassungen) : null
  if (istObjekt(roh)) {
    const versionen = Object.keys(roh).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(b) - Number(a))
    for (const k of versionen) {
      const fa = roh[k]
      if (!istObjekt(fa)) continue
      const liste = jsonLesen(fa.schema)
      for (const x of Array.isArray(liste) ? liste : []) {
        const f = feldLesen(x)
        if (f) setzen(f)
      }
    }
  }
  return aus
}

/** Liste der Formulare im Reiter Eingang: aktive und alle mit Einsendungen, nach Titel. */
export function vorlagenImEingang<T extends Obj>(vorlagen: T[], zahlen: Record<string, Zahlen>): T[] {
  return vorlagen
    .filter((v) => {
      const id = String(v?.id ?? '')
      const z = zahlen[id]
      return (z && z.gesamt > 0) || (v.is_active === true && v.archiviert !== true)
    })
    .slice()
    .sort((a, b) => vorlageTitel(a).localeCompare(vorlageTitel(b), 'de-DE'))
}

// ── Eine Einsendung ──────────────────────────────────────────────────────────

/** Eine Einsendung, fertig für Liste und Seite. */
export type EinsendungAnsicht = {
  id: string
  rec: Obj
  e: Einsendung
  status: EinsendungStatus
  /** Absender, wie der Server ihn festhält (nur mit passendem `absender_status`). */
  absender: AbsenderEintrag | null
  /** Name fett in der Zeile: Absender, sonst „Anonym“ oder „Ohne Namen“. */
  name: string
  anonym: boolean
  ausstehend: boolean
  /** „07.11.2026, 10:20“ */
  eingang: string
  /** Erster ausgefüllter Wert, höchstens 80 Zeichen. */
  erster: string
}

/** Der Name des Absenders für Liste und Seite. */
export function absenderName(e: Pick<Einsendung, 'absenderModus'>, absender: AbsenderEintrag | null): string {
  if (e.absenderModus === 'anonym') return EINGANG_TEXTE.anonym
  const n = absender?.name?.trim() ?? ''
  return n || EINGANG_TEXTE.ohneNamen
}

function einzeilig(t: string): string {
  return t.replace(/\s+/g, ' ').trim()
}

/** Der erste ausgefüllte Wert in Formularfolge, einzeilig, höchstens `max` Zeichen (mit „…“). */
export function ersterWert(e: Einsendung, max = 80): string {
  const werte = e.angaben.werte
  for (const f of e.angaben.felder) {
    if (!Object.prototype.hasOwnProperty.call(werte, f.id) || wertLeer(werte[f.id])) continue
    const t = einzeilig(wertText(f, werte[f.id]))
    if (!t) continue
    return t.length > max ? t.slice(0, Math.max(1, max - 1)).trimEnd() + '…' : t
  }
  return ''
}

export function einsendungAnsicht(rec: Obj, vorlage?: unknown): EinsendungAnsicht {
  const e = einsendungLesen(rec, vorlage)
  // Anonym: nie einen Absender zeigen, auch wenn ein alter Satz einen trägt
  const absender = e.absenderModus === 'anonym' ? null : absenderLesen(rec, 'form_submissions')
  return {
    id: e.id,
    rec,
    e,
    status: e.status,
    absender,
    name: absenderName(e, absender),
    anonym: e.absenderModus === 'anonym',
    ausstehend: absender?.status === 'ausstehend',
    eingang: zeitText(e.angelegt),
    erster: ersterWert(e),
  }
}

/** Kleinbuchstaben ohne Akzente: „Übergabe“ findet „ubergabe“ und „übergabe“. */
function grob(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Wonach die Suche schaut: Absender und alle Werte (auch aus früheren Fassungen). */
export function suchtext(a: EinsendungAnsicht): string {
  const teile: string[] = [a.absender?.name ?? '', a.anonym ? EINGANG_TEXTE.anonym : '']
  const defs: Record<string, FeldDef> = {}
  for (const f of a.e.angaben.felder) defs[f.id] = f
  for (const [id, w] of Object.entries(a.e.angaben.werte)) teile.push(wertText(defs[id], w))
  for (const x of a.e.angaben.aelter ?? []) teile.push(x.wert)
  return grob(teile.filter(Boolean).join(' '))
}

/** Die Liste einer Ansicht, passend zur Suche (alle Wörter müssen vorkommen). */
export function filtern(liste: EinsendungAnsicht[], ansicht: EingangAnsicht, suche = ''): EinsendungAnsicht[] {
  const woerter = grob(suche).split(/\s+/).filter(Boolean)
  return liste.filter((a) => ansichtVon(a.status) === ansicht && (!woerter.length || woerter.every((w) => suchtext(a).includes(w))))
}

/** Neueste zuerst; gleicher Zeitpunkt nach Kennung, damit die Folge fest bleibt. */
export function sortieren(liste: EinsendungAnsicht[]): EinsendungAnsicht[] {
  const t = (a: EinsendungAnsicht) => zeitpunkt(a.e.angelegt)?.getTime() ?? 0
  return liste.slice().sort((a, b) => t(b) - t(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Wurde die Einsendung mit einer früheren Fassung gesendet als der, die das Formular heute hat? */
export function frueherGesendet(e: Einsendung, vorlage: unknown): boolean {
  const jetzt = vorlageVersion(vorlage)
  if (e.alt) return jetzt > 1
  // Der Server hält die genannte ältere Fassung fest (auch 0); nur dann ist sie kleiner als die heutige
  return jetzt > 0 && e.angaben.version < jetzt
}

/**
 * Die Fassung einer Einsendung für CSV und Druck. Wurde sie mit einer früheren Fassung gesendet,
 * steht die Zahl immer da, auch „0“ (gesendet, bevor das Formular Fassungen zählte). Sonst bleibt
 * das Feld leer, wo keine Fassung festgehalten ist.
 */
export function fassungText(e: Einsendung, vorlage: unknown): string {
  if (frueherGesendet(e, vorlage)) return String(e.angaben.version)
  return e.alt || !e.angaben.version ? '' : String(e.angaben.version)
}

/** Hat jemand die Notiz geändert, seit sie hier geladen wurde? (Server trimmt, deshalb getrimmt verglichen.) */
export function notizGeaendert(basis: string, frisch: unknown): boolean {
  const f = typeof frisch === 'string' ? frisch : ''
  return f.replace(/\r\n?/g, '\n').trim() !== String(basis ?? '').replace(/\r\n?/g, '\n').trim()
}

// ── Verlauf ──────────────────────────────────────────────────────────────────

export type VerlaufZeile = { id: string; am: string; von: string; statusVorher: EinsendungStatus | ''; status: EinsendungStatus | ''; notiz: boolean }

function statusOderLeer(x: unknown): EinsendungStatus | '' {
  return EINSENDUNG_STATUS.includes(x as EinsendungStatus) ? (x as EinsendungStatus) : ''
}

/** Der Verlauf aus `bearbeitung.verlauf` (setzt nur der Hook), älteste zuerst. */
export function verlaufLesen(rec: Obj | null | undefined): VerlaufZeile[] {
  const b = jsonLesen(rec?.bearbeitung)
  const liste = istObjekt(b) && Array.isArray(b.verlauf) ? b.verlauf : []
  return liste.filter(istObjekt).map((x, i) => ({
    id: typeof x.id === 'string' && x.id ? x.id : `v${i}`,
    am: typeof x.am === 'string' ? x.am : '',
    von: istObjekt(x.von) && typeof x.von.name === 'string' ? x.von.name.trim() : '',
    statusVorher: statusOderLeer(x.status_vorher),
    status: statusOderLeer(x.status),
    notiz: x.notiz === true,
  }))
}

/** „Ina Inbox · In Bearbeitung · 07.11., 10:24“; nur die Notiz: „… · Notiz geändert · …“. */
export function verlaufText(v: VerlaufZeile): string {
  const teile: string[] = [v.von || 'Unbekannt']
  if (v.status && v.status !== v.statusVorher) teile.push(STATUS_NAME[v.status])
  if (v.notiz) teile.push('Notiz geändert')
  if (teile.length === 1 && v.status) teile.push(STATUS_NAME[v.status])
  const am = zeitKurz(v.am)
  if (am) teile.push(am)
  return teile.join(' · ')
}

// ── Angaben anzeigen ─────────────────────────────────────────────────────────

export type AngabeZeile = { id: string; label: string; text: string; leer: boolean }
export type AngabenGruppe = { id: string; titel: string; hilfe?: string; felder: AngabeZeile[] }
export type AngabenEingabe = {
  felder: FeldDef[]
  werte: Record<string, Wert>
  aelter?: { id: string; wert: string }[]
  abschnitte?: Abschnitt[]
}

/**
 * Angaben nach Abschnitten für die Anzeige (Eingang, Druck, CIRS, Lager, MPG). Felder aus dem
 * Schnappschuss in ihrer Folge; Werte ohne Schnappschuss (CIRS-Rückfall) mit der Bezeichnung aus
 * `bezeichnung`, sonst der Kennung. `aelter`: Werte aus einer früheren Fassung als Text.
 * `nurAusgefuellt` lässt leere Felder weg.
 */
export function angabenGruppen(a: AngabenEingabe | null | undefined, o: { bezeichnung?: Record<string, string>; nurAusgefuellt?: boolean } = {}): { gruppen: AngabenGruppe[]; aelter: AngabeZeile[] } {
  if (!a) return { gruppen: [], aelter: [] }
  const name = (id: string, label?: string) => (label && label.trim()) || o.bezeichnung?.[id] || id
  const werte = istObjekt(a.werte) ? a.werte : {}
  const abschnitte = Array.isArray(a.abschnitte) ? abschnitteLesen(a.abschnitte) : []
  const gruppen: AngabenGruppe[] = abschnitte.length
    ? abschnitte.map((x) => ({ id: x.id, titel: x.titel, ...(x.hilfe ? { hilfe: x.hilfe } : {}), felder: [] }))
    : [{ id: '', titel: '', felder: [] }]
  const gruppeVon = (ab?: string) => gruppen.find((g) => g.id === ab) ?? gruppen[0]
  const gesehen: Record<string, true> = {}
  for (const f of Array.isArray(a.felder) ? a.felder : []) {
    if (!f || typeof f.id !== 'string' || gesehen[f.id]) continue
    gesehen[f.id] = true
    const w = Object.prototype.hasOwnProperty.call(werte, f.id) ? werte[f.id] : undefined
    const leer = wertLeer(w)
    if (leer && o.nurAusgefuellt) continue
    gruppeVon(f.abschnitt).felder.push({ id: f.id, label: name(f.id, f.label), text: leer ? '' : wertText(f, w), leer })
  }
  // Werte ohne Feld im Schnappschuss (Rückfall ohne Regeln): nicht verschlucken
  const letzte = gruppen[gruppen.length - 1]
  for (const id of Object.keys(werte)) {
    if (gesehen[id] || wertLeer(werte[id])) continue
    gesehen[id] = true
    letzte.felder.push({ id, label: name(id), text: wertText(undefined, werte[id]), leer: false })
  }
  const aelter = (Array.isArray(a.aelter) ? a.aelter : [])
    .filter((x) => x && typeof x.wert === 'string' && x.wert.trim())
    .map((x) => ({ id: x.id, label: name(x.id), text: x.wert, leer: false }))
  return { gruppen: gruppen.filter((g) => g.felder.length > 0), aelter }
}

// ── CSV (3.8.4) ──────────────────────────────────────────────────────────────

function absenderSpalten(a: EinsendungAnsicht): [string, string] {
  if (a.anonym) return [EINGANG_TEXTE.anonym, 'anonym']
  if (!a.absender) return ['', '']
  return [a.absender.name.trim(), ABSENDER_STATUS_TEXT[a.absender.status] ?? '']
}

/**
 * Die gezeigte Liste als CSV für Excel (Semikolon, BOM, CRLF, Formelschutz). Spalten: Nummer,
 * Eingang, Status, Absender, Absender-Status, Fassung, je Feld eine Spalte (Folge der aktuellen
 * Vorlage, danach Felder nur aus älteren Fassungen mit ihrer letzten Bezeichnung), „Aus früheren
 * Fassungen“, „Interne Notiz“. Die Fassung steht bei jeder früher gesendeten Einsendung da, auch
 * „0“ (fassungText), damit sie in der Tabelle nicht wie eine der heutigen Fassung aussieht.
 */
export function eingangCsv(recs: Obj[], vorlage: unknown): string {
  const liste = sortieren(recs.map((r) => einsendungAnsicht(r, vorlage)))
  const spalten: { id: string; label: string }[] = []
  const drin: Record<string, true> = {}
  const dazu = (id: string, label: string) => {
    if (drin[id]) return
    drin[id] = true
    spalten.push({ id, label })
  }
  const letzte = bezeichnungen(vorlage)
  for (const f of schemaLesen(vorlage).felder) dazu(f.id, f.label || f.id)
  // Felder nur aus älteren Fassungen: Bezeichnung der neuesten Einsendung, die sie trägt
  for (const a of liste) {
    for (const f of a.e.angaben.felder) dazu(f.id, letzte[f.id] || f.label || f.id)
    for (const id of Object.keys(a.e.angaben.werte)) dazu(id, letzte[id] || id)
  }
  const kopf = ['Nummer', 'Eingang', 'Status', 'Absender', 'Absender-Status', 'Fassung', ...spalten.map((s) => s.label), 'Aus früheren Fassungen', 'Interne Notiz']
  const zeilen = liste.map((a) => {
    const defs: Record<string, FeldDef> = {}
    for (const f of a.e.angaben.felder) defs[f.id] = f
    const [name, st] = absenderSpalten(a)
    const aelter = (a.e.angaben.aelter ?? []).map((x) => `${letzte[x.id] || x.id}: ${x.wert}`).join(' | ')
    return [
      a.id.slice(0, 8), a.eingang, STATUS_NAME[a.status], name, st, fassungText(a.e, vorlage),
      ...spalten.map((s) => {
        const w = a.e.angaben.werte[s.id]
        return wertLeer(w) ? '' : wertText(defs[s.id], w)
      }),
      aelter, a.e.notiz,
    ]
  })
  return csvText([kopf, ...zeilen])
}

/** Titel für Dateinamen: Buchstaben, Ziffern, Umlaute, Bindestrich; höchstens 60 Zeichen. */
function dateiTitel(titel: string): string {
  const t = String(titel ?? '')
    .replace(/[^A-Za-z0-9äöüÄÖÜß-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
  return t || 'Formular'
}

/** „Fahrzeugcheck-Eingang-2026-11-07.csv“ (Tag in Ortszeit). */
export function csvDateiname(titel: string, jetzt: Date = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${dateiTitel(titel)}-Eingang-${jetzt.getFullYear()}-${z(jetzt.getMonth() + 1)}-${z(jetzt.getDate())}.csv`
}

// ── Druck (3.8.5) ────────────────────────────────────────────────────────────

const DRUCK_STIL = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Atkinson Hyperlegible','Helvetica Neue',Arial,sans-serif;color:#1a0e08;background:#fff;line-height:1.45;padding:32px;max-width:820px;margin:0 auto}
.org{font-size:13px;color:#6b5b4b;margin-bottom:2px}
h1{font-size:22px;margin-bottom:4px}
.unter{font-size:13px;color:#6b5b4b;margin-bottom:18px}
h2{font-size:16px;margin:22px 0 8px}
h3{font-size:14px;color:#6b5b4b;margin:14px 0 6px}
.raster{display:grid;grid-template-columns:150px 1fr;gap:5px 14px;font-size:13px}
.raster dt{color:#6b5b4b}
.angabe{padding:7px 0;border-top:1px solid #e8e1d8;font-size:13px}
.angabe:first-of-type{border-top:0}
.angabe span{display:block;color:#6b5b4b;font-size:12px}
.angabe p{white-space:pre-wrap;overflow-wrap:anywhere}
.leer{color:#8a7a68}
.hinweis{font-size:13px;font-style:italic;color:#6b5b4b;margin:0 0 8px}
.notiz{border:1px solid #e8e1d8;border-radius:8px;padding:10px 12px;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
.fuss{margin-top:32px;border-top:1px solid #e8e1d8;padding-top:10px;font-size:11px;color:#6b5b4b}
.knopf{position:fixed;bottom:24px;right:24px;background:#600812;color:#fff;border:0;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
.angabe,.notiz{page-break-inside:avoid}
@media print{.knopf{display:none}body{padding:0}}
`

function angabenHtml(g: { gruppen: AngabenGruppe[]; aelter: AngabeZeile[] }): string {
  const zeile = (z: AngabeZeile) => `<div class="angabe"><span>${escapeHtml(z.label)}</span><p${z.leer ? ' class="leer"' : ''}>${escapeHtml(z.leer ? EINGANG_TEXTE.nichtAusgefuellt : z.text)}</p></div>`
  const teile = g.gruppen.map((x) => `${x.titel ? `<h3>${escapeHtml(x.titel)}</h3>` : ''}${x.felder.map(zeile).join('')}`)
  if (g.aelter.length) teile.push(`<h3>${escapeHtml(EINGANG_TEXTE.aelterGruppe)}</h3>${g.aelter.map(zeile).join('')}`)
  return teile.length ? teile.join('') : `<p class="leer">${escapeHtml(EINGANG_TEXTE.keineAngaben)}</p>`
}

/**
 * Ein Druckblatt einer Einsendung: Organisation, Formular, Fassung, Eingang, Absender, Status,
 * Angaben nach Abschnitten, die interne Notiz nur auf Wunsch, „Gedruckt von … am …“. Wurde sie
 * mit einer früheren Fassung gesendet, stehen die Fassung (auch „0“) und derselbe Hinweis wie auf
 * der Seite auf dem Blatt. Jeder Text geht durch escapeHtml.
 */
export function einsendungDruck(rec: Obj, vorlage: unknown, o: { orgName?: string; mitNotiz?: boolean; gedruckt: { von?: string; am: Date } }): string {
  const a = einsendungAnsicht(rec, vorlage)
  const titel = a.e.titel || vorlageTitel(vorlage)
  const absender = a.anonym ? EINGANG_TEXTE.anonym
    : a.absender ? [a.absender.name.trim() || EINGANG_TEXTE.ohneNamen, ABSENDER_STATUS_TEXT[a.absender.status]].filter((x) => x && x !== 'bestätigt').join(' · ')
      : EINGANG_TEXTE.ohneNamen
  const zeile = (n: string, w: string) => (w ? `<dt>${escapeHtml(n)}</dt><dd>${escapeHtml(w)}</dd>` : '')
  const gruppen = angabenGruppen(a.e.angaben, { bezeichnung: bezeichnungen(vorlage) })
  // Derselbe Hinweis wie auf der Seite der Einsendung (EinsendungSeite), an derselben Stelle
  const frueher = frueherGesendet(a.e, vorlage) ? `<p class="hinweis">${escapeHtml(EINGANG_TEXTE.frueher)}</p>\n` : ''
  const notiz = o.mitNotiz && a.e.notiz.trim()
    ? `<h2>${escapeHtml(EINGANG_TEXTE.notizLabel)}</h2><div class="notiz">${escapeHtml(a.e.notiz)}</div>`
    : ''
  const am = o.gedruckt.am.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(`${titel} ${a.id.slice(0, 8)}`)}</title><style>${DRUCK_STIL}</style></head>
<body>
${o.orgName ? `<p class="org">${escapeHtml(o.orgName)}</p>` : ''}
<h1>${escapeHtml(titel)}</h1>
<p class="unter">${escapeHtml(`Einsendung ${a.id.slice(0, 8)}`)}</p>
<dl class="raster">
${zeile(EINGANG_TEXTE.eingegangen, a.eingang)}
${zeile(EINGANG_TEXTE.absender, absender)}
${zeile(EINGANG_TEXTE.status, STATUS_NAME[a.status])}
${zeile(EINGANG_TEXTE.fassung, fassungText(a.e, vorlage))}
</dl>
<h2>${escapeHtml(EINGANG_TEXTE.angaben)}</h2>
${frueher}${angabenHtml(gruppen)}
${notiz}
<div class="fuss">${escapeHtml(`Gedruckt${o.gedruckt.von ? ` von ${o.gedruckt.von}` : ''} am ${am}`)}</div>
<button class="knopf" onclick="window.print()">Drucken</button>
</body></html>`
}

// ── Fehler der Abfragen ──────────────────────────────────────────────────────

/** Text zu einem Fehler beim Laden oder Speichern (Antwort von PocketBase). */
export function eingangFehlerText(e: unknown, ersatz: string): string {
  const x = istObjekt(e) ? e : {}
  const status = typeof x.status === 'number' ? x.status : -1
  if (status === 0) return EINGANG_TEXTE.keinNetz
  const antwort = istObjekt(x.response) ? x.response : istObjekt(x.data) ? x.data : {}
  const msg = typeof antwort.message === 'string' ? antwort.message.trim() : ''
  // Texte der Hooks (403 ohne Recht, Regel noch offen, 400 Status oder Notiz) unverändert zeigen
  if ((status === 400 || status === 403) && msg && !/^(Failed|Something|The request|Only )/i.test(msg)) return msg
  if (status === 403) return EINGANG_TEXTE.keinRecht
  return ersatz
}
