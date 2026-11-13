// Entwurf einer Vorlage (eigenes Formular) im Baukasten, Bauplan Vorgänge 3.7.
//
// Die Seite `vorlage` und ihre Unterseiten (`vorlage-feld`, `vorlage-abschnitt`, `vorschau`)
// arbeiten auf einem Entwurf in sessionStorage (`vorlage_entwurf_<id|neu>`), damit der
// Wechsel auf eine Unterseite nichts verliert. Im Entwurf stehen nur Titel, Beschreibung,
// Absender und die Felder, keine Einsendungen, also keine Patientendaten.
//
// Gespeichert wird erst mit „Speichern“ (create/update mit `basis_version`). „Aktiv“ und
// „Archivieren“ speichert die Seite sofort für sich; im Entwurf stehen sie nur zum Anzeigen.
//
// Reine Teile, ohne React und PocketBase (Prüffälle: vorlagenEditor.test.ts).

import {
  FELD_GRENZEN, abschnitteLesen, kennungOk, schemaFehler, schemaLesen, vorlageModus,
  type Abschnitt, type FeldDef, type VorlageModus,
} from '../../../lib/formular/felder'
import { ALT_FELDART } from '../../public/formSchema'
import { E_TEXTE as T } from './texte'

export const ENTWURF_PREFIX = 'vorlage_entwurf_'

export type VorlageEntwurf = {
  v: 1
  /** Kennung der gespeicherten Vorlage, '' solange neu. */
  id: string
  titel: string
  beschreibung: string
  absender: VorlageModus
  /** Stand des Servers (sofort gespeichert, nicht Teil von „geändert“). */
  aktiv: boolean
  archiviert: boolean
  abschnitte: Abschnitt[]
  /** In Formularfolge, nach Abschnitten geordnet (`abschnitt` gesetzt, sobald es Abschnitte gibt). */
  felder: FeldDef[]
  /** `version` der geladenen Vorlage; null, wenn neu oder das Feld in PocketBase fehlt. */
  basisVersion: number | null
  /** Der gespeicherte Stand, kanonisch (für „Nicht gespeichert“). */
  gespeichert: string
  /** Nur die Felder und Abschnitte des gespeicherten Stands (Bestandsschutz alter Vorlagen). */
  gespeichertSchema: string
}

type Inhalt = Pick<VorlageEntwurf, 'titel' | 'beschreibung' | 'absender' | 'abschnitte' | 'felder'>

function inhaltKanon(e: Inhalt): string {
  return JSON.stringify({ titel: e.titel.trim(), beschreibung: e.beschreibung.trim(), absender: e.absender, abschnitte: e.abschnitte, felder: e.felder })
}

function schemaKanon(e: Pick<VorlageEntwurf, 'abschnitte' | 'felder'>): string {
  return JSON.stringify({ abschnitte: e.abschnitte, felder: e.felder })
}

function mitStand(e: Omit<VorlageEntwurf, 'gespeichert' | 'gespeichertSchema'>): VorlageEntwurf {
  return { ...e, gespeichert: inhaltKanon(e), gespeichertSchema: schemaKanon(e) }
}

/** Ein neues Formular: inaktiv, Absender „Name frei eintragen“ (PO 8), ohne Felder. */
export function neuerEntwurf(): VorlageEntwurf {
  return mitStand({ v: 1, id: '', titel: '', beschreibung: '', absender: 'frei', aktiv: false, archiviert: false, abschnitte: [], felder: [], basisVersion: null })
}

/** Den Entwurf aus einer gespeicherten Vorlage (form_templates), neue und alte Form. */
export function entwurfAusVorlage(rec: Record<string, unknown>): VorlageEntwurf {
  const s = schemaLesen(rec)
  return mitStand({
    v: 1,
    id: String(rec.id ?? ''),
    titel: typeof rec.title === 'string' ? rec.title : '',
    beschreibung: typeof rec.description === 'string' ? rec.description : '',
    absender: vorlageModus(rec),
    aktiv: rec.is_active === true,
    archiviert: rec.archiviert === true,
    abschnitte: s.abschnitte,
    felder: s.felder,
    basisVersion: typeof rec.version === 'number' && Number.isFinite(rec.version) ? rec.version : null,
  })
}

/** Gibt es Änderungen, die noch nicht gespeichert sind? */
export function entwurfGeaendert(e: VorlageEntwurf): boolean {
  return inhaltKanon(e) !== e.gespeichert
}

/** Haben sich Felder oder Abschnitte gegenüber dem gespeicherten Stand geändert? */
export function schemaGeaendert(e: VorlageEntwurf): boolean {
  return schemaKanon(e) !== e.gespeichertSchema
}

/**
 * Was vor dem Speichern nicht passt (wie der Hook): Titel 1 bis 120, Beschreibung bis 500,
 * Felder und Abschnitte nach schemaFehler. Die Felder prüft es nur, wenn sie sich geändert
 * haben: ältere Vorlagen dürfen ihr unverändertes Schema behalten (Bestandsschutz im Hook).
 */
export function entwurfPruefen(e: VorlageEntwurf): { feld: 'titel' | 'beschreibung' | 'schema'; text: string } | null {
  const titel = e.titel.trim()
  if (!titel) return { feld: 'titel', text: T.titelFehlt }
  if (titel.length > FELD_GRENZEN.titel) return { feld: 'titel', text: T.titelLang }
  if (e.beschreibung.trim().length > FELD_GRENZEN.beschreibung) return { feld: 'beschreibung', text: T.beschreibungLang }
  if (!schemaGeaendert(e)) return null
  if (e.felder.length > FELD_GRENZEN.felder) return { feld: 'schema', text: T.zuVieleFelder(FELD_GRENZEN.felder) }
  if (e.abschnitte.length > FELD_GRENZEN.abschnitte) return { feld: 'schema', text: T.zuVieleAbschnitte(FELD_GRENZEN.abschnitte) }
  const f = schemaFehler({ abschnitte: e.abschnitte, felder: e.felder })
  return f ? { feld: 'schema', text: T.schemaFehler(f.text) } : null
}

/**
 * Die Felder mit den alten Schlüsseln (fieldType, required, hint, options), wie der Hook sie
 * spiegelt: Alte Seiten (ältere App-Stände) rendern damit weiter, auch solange der Hook fehlt.
 */
export function mitAltSchluesseln(felder: FeldDef[]): Record<string, unknown>[] {
  return felder.map((d) => {
    const x: Record<string, unknown> = { ...d, fieldType: ALT_FELDART[d.typ] ?? 'text', required: d.pflicht === true }
    if (d.hilfe) x.hint = d.hilfe
    if (d.optionen) x.options = d.optionen.slice()
    return x
  })
}

/**
 * Body für create bzw. update. Neu: inaktiv, nicht archiviert, mit Organisation. Ändern:
 * mit `basis_version` (der Hook antwortet 409, wenn inzwischen jemand anderes gespeichert
 * hat); Felder und Abschnitte nur, wenn sie sich geändert haben (ein unverändertes altes
 * Schema bleibt so genau, wie es gespeichert ist). Aktiv und Archiviert speichert die Seite
 * getrennt, sie gehen hier nicht mit.
 */
export function speicherBody(e: VorlageEntwurf, o: { orgId: string }): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: e.titel.trim(),
    description: e.beschreibung.trim(),
    absender: e.absender,
  }
  if (!e.id || schemaGeaendert(e)) {
    body.abschnitte = e.abschnitte.map((a) => ({ ...a }))
    body.schema = mitAltSchluesseln(e.felder)
  }
  if (!e.id) {
    body.organization_id = o.orgId
    body.is_active = false
    body.archiviert = false
  } else if (e.basisVersion !== null) {
    body.basis_version = e.basisVersion
  }
  return body
}

/** Felder, die nach dem Speichern im Datensatz fehlen (PocketBase verwirft Unbekanntes still). */
export function fehlendeFelder(rec: Record<string, unknown>): string[] {
  return ['absender', 'archiviert', 'abschnitte'].filter((f) => !(f in rec))
}

// ── Felder und Abschnitte ───────────────────────────────────────────────────

/** Felder nach Abschnitten ordnen (stabil); ohne gültigen Abschnitt in den ersten. Ohne Abschnitte ohne Zuordnung. */
export function ordnen(abschnitte: Abschnitt[], felder: FeldDef[]): FeldDef[] {
  if (!abschnitte.length) return felder.map((f) => { const g = { ...f }; delete g.abschnitt; return g })
  const pos = new Map(abschnitte.map((a, i) => [a.id, i]))
  return felder
    .map((f, i) => ({ f: pos.has(String(f.abschnitt)) ? f : { ...f, abschnitt: abschnitte[0].id }, i }))
    .sort((a, b) => (pos.get(a.f.abschnitt as string)! - pos.get(b.f.abschnitt as string)!) || (a.i - b.i))
    .map((x) => x.f)
}

/** Gruppen zum Anzeigen: je Abschnitt seine Felder; ohne Abschnitte eine Gruppe ohne Titel. */
export function gruppen(e: Pick<VorlageEntwurf, 'abschnitte' | 'felder'>): { abschnitt: Abschnitt | null; felder: FeldDef[] }[] {
  if (!e.abschnitte.length) return [{ abschnitt: null, felder: e.felder.slice() }]
  return e.abschnitte.map((a) => ({ abschnitt: a, felder: e.felder.filter((f) => f.abschnitt === a.id) }))
}

/** Ein Feld ändern (gleiche Kennung, Platz bleibt, außer der Abschnitt ändert sich) oder neu ans Ende seines Abschnitts. */
export function feldSetzen(e: VorlageEntwurf, feld: FeldDef): VorlageEntwurf {
  const d: FeldDef = { ...feld }
  if (e.abschnitte.length) {
    if (!e.abschnitte.some((a) => a.id === d.abschnitt)) d.abschnitt = e.abschnitte[e.abschnitte.length - 1].id
  } else delete d.abschnitt
  const i = e.felder.findIndex((f) => f.id === d.id)
  let felder: FeldDef[]
  if (i >= 0 && e.felder[i].abschnitt === d.abschnitt) felder = e.felder.map((f, j) => (j === i ? d : f))
  else felder = [...e.felder.filter((f) => f.id !== d.id), d]
  return { ...e, felder: ordnen(e.abschnitte, felder) }
}

export function feldEntfernen(e: VorlageEntwurf, id: string): VorlageEntwurf {
  return { ...e, felder: e.felder.filter((f) => f.id !== id) }
}

/**
 * Ein Feld um eine Stelle verschieben. Am Rand seines Abschnitts wandert es in den
 * Nachbarabschnitt (ans Ende des vorigen bzw. an den Anfang des nächsten).
 */
export function feldVerschieben(e: VorlageEntwurf, id: string, richtung: -1 | 1): VorlageEntwurf {
  const i = e.felder.findIndex((f) => f.id === id)
  if (i < 0) return e
  const f = e.felder[i]
  const nachbar = e.felder[i + richtung]
  if (!e.abschnitte.length || (nachbar && nachbar.abschnitt === f.abschnitt)) {
    if (!nachbar) return e
    const felder = e.felder.slice()
    ;[felder[i], felder[i + richtung]] = [felder[i + richtung], felder[i]]
    return { ...e, felder }
  }
  // Rand des Abschnitts: in den Nachbarabschnitt
  const ai = e.abschnitte.findIndex((a) => a.id === f.abschnitt)
  const ziel = e.abschnitte[ai + richtung]
  if (!ziel) return e
  const ohne = e.felder.filter((x) => x.id !== id)
  const neu = { ...f, abschnitt: ziel.id }
  if (richtung === -1) {
    // ans Ende des vorigen Abschnitts: vor das erste Feld des eigenen (alten) Abschnitts
    let k = ohne.findIndex((x) => x.abschnitt === f.abschnitt)
    if (k < 0) k = ohne.findIndex((x) => e.abschnitte.findIndex((a) => a.id === x.abschnitt) > ai)
    if (k < 0) k = ohne.length
    ohne.splice(k, 0, neu)
  } else {
    // an den Anfang des nächsten Abschnitts
    let k = ohne.findIndex((x) => x.abschnitt === ziel.id)
    if (k < 0) k = ohne.findIndex((x) => e.abschnitte.findIndex((a) => a.id === x.abschnitt) > ai + 1)
    if (k < 0) k = ohne.length
    ohne.splice(k, 0, neu)
  }
  return { ...e, felder: ordnen(e.abschnitte, ohne) }
}

/**
 * Einen Abschnitt ändern oder anlegen (ans Ende). Der erste Abschnitt nimmt alle Felder auf,
 * die schon da sind.
 */
export function abschnittSetzen(e: VorlageEntwurf, a: Abschnitt): VorlageEntwurf {
  const sauber: Abschnitt = { id: a.id, titel: a.titel.trim().slice(0, FELD_GRENZEN.titel) }
  const h = (a.hilfe ?? '').trim()
  if (h) sauber.hilfe = h.slice(0, FELD_GRENZEN.hilfe)
  const da = e.abschnitte.some((x) => x.id === a.id)
  const abschnitte = da ? e.abschnitte.map((x) => (x.id === a.id ? sauber : x)) : [...e.abschnitte, sauber]
  const felder = !e.abschnitte.length ? e.felder.map((f) => ({ ...f, abschnitt: sauber.id })) : e.felder
  return { ...e, abschnitte, felder: ordnen(abschnitte, felder) }
}

/** Einen Abschnitt entfernen: seine Felder kommen in den Abschnitt davor (beim ersten in den nächsten). */
export function abschnittEntfernen(e: VorlageEntwurf, id: string): VorlageEntwurf {
  const i = e.abschnitte.findIndex((a) => a.id === id)
  if (i < 0) return e
  const abschnitte = e.abschnitte.filter((a) => a.id !== id)
  if (!abschnitte.length) return { ...e, abschnitte, felder: ordnen([], e.felder) }
  const ziel = (i > 0 ? e.abschnitte[i - 1] : e.abschnitte[1]).id
  // Ans Ende des vorigen Abschnitts bzw. an den Anfang des nächsten: die Folge bleibt
  const felder = e.felder.map((f) => (f.abschnitt === id ? { ...f, abschnitt: ziel } : f))
  return { ...e, abschnitte, felder: ordnen(abschnitte, felder) }
}

export function abschnittVerschieben(e: VorlageEntwurf, id: string, richtung: -1 | 1): VorlageEntwurf {
  const i = e.abschnitte.findIndex((a) => a.id === id)
  const j = i + richtung
  if (i < 0 || j < 0 || j >= e.abschnitte.length) return e
  const abschnitte = e.abschnitte.slice()
  ;[abschnitte[i], abschnitte[j]] = [abschnitte[j], abschnitte[i]]
  return { ...e, abschnitte, felder: ordnen(abschnitte, e.felder) }
}

/** Prüfung eines Abschnitts (wie schemaFehler): Titel 1 bis 120, Hilfetext bis 300. */
export function abschnittPruefen(a: { titel: string; hilfe?: string }): { feld: 'titel' | 'hilfe'; text: string } | null {
  const t = a.titel.trim()
  if (!t) return { feld: 'titel', text: T.abschnittTitelFehlt }
  if (t.length > FELD_GRENZEN.titel) return { feld: 'titel', text: T.abschnittTitelLang }
  if ((a.hilfe ?? '').trim().length > FELD_GRENZEN.hilfe) return { feld: 'hilfe', text: T.abschnittHilfeLang }
  return null
}

// ── Ablage in sessionStorage ────────────────────────────────────────────────

type Ablage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function ablage(): Ablage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}

/** Den Entwurf lesen; unlesbar oder in falscher Form: null. */
export function entwurfLesen(schluessel: string, s: Ablage | null = ablage()): VorlageEntwurf | null {
  if (!s) return null
  try {
    const roh = JSON.parse(s.getItem(ENTWURF_PREFIX + schluessel) || 'null') as Record<string, unknown> | null
    if (!roh || roh.v !== 1 || typeof roh.gespeichert !== 'string' || typeof roh.gespeichertSchema !== 'string') return null
    const abschnitte = abschnitteLesen(roh.abschnitte)
    const felder = schemaLesen({ schema: roh.felder, abschnitte }).felder
    return {
      v: 1,
      id: typeof roh.id === 'string' && kennungOk(roh.id) ? roh.id : '',
      titel: typeof roh.titel === 'string' ? roh.titel : '',
      beschreibung: typeof roh.beschreibung === 'string' ? roh.beschreibung : '',
      absender: vorlageModus({ absender: roh.absender }),
      aktiv: roh.aktiv === true,
      archiviert: roh.archiviert === true,
      abschnitte,
      felder,
      basisVersion: typeof roh.basisVersion === 'number' ? roh.basisVersion : null,
      gespeichert: roh.gespeichert,
      gespeichertSchema: roh.gespeichertSchema,
    }
  } catch {
    return null
  }
}

/** Den Entwurf merken; voller oder gesperrter Speicher: false (die Seite arbeitet dann nur im Zustand). */
export function entwurfMerken(schluessel: string, e: VorlageEntwurf, s: Ablage | null = ablage()): boolean {
  if (!s) return false
  try { s.setItem(ENTWURF_PREFIX + schluessel, JSON.stringify(e)); return true } catch { return false }
}

export function entwurfVergessen(schluessel: string, s: Ablage | null = ablage()): void {
  try { s?.removeItem(ENTWURF_PREFIX + schluessel) } catch { /* nichts zu tun */ }
}
