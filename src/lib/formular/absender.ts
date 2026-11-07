// Absender der öffentlichen Formulare: Begriffe, Lesen und Rechte für die Anzeige.
//
// Wer ein Formular abgibt, entscheidet allein der Server
// (pb_hooks/formular-regeln.js, Bauplan v2, 1.5 und 2.4). Diese Datei liest
// nur, was er gespeichert hat, und spiegelt seine Rechte, damit die App
// Knöpfe zeigt oder verbirgt. Ein Knopf, den sie zu Unrecht zeigt, scheitert
// am Server; deshalb ist hier nichts sicherheitskritisch, aber alles muss
// zum Server passen (Prüffälle in src/lib/__tests__/formularGleichlauf.test.ts).
//
// Keine Imports aus React oder PocketBase: die Prüffälle laufen ohne DOM.

import type { User } from '../../types'
import { modulFrei } from '../freigabe'

export type FormularId = 'patienten' | 'produktausgabe' | 'defektmeldung'
export type AbsenderModus = 'passwort' | 'frei'
export type AbsenderStatus = 'bestaetigt' | 'nicht_bestaetigt' | 'ohne_konto' | 'ausstehend' | 'ohne_unterschrift'
export type AbsenderWeg = 'passwort' | 'anmeldung' | 'nachgereicht' | ''
export type AbsenderAbschluss = { id: string; name: string; am: string; grund: string }
export type AbsenderEintrag = {
  id: string
  name: string
  status: AbsenderStatus
  weg: AbsenderWeg
  modus: AbsenderModus
  am: string
  /** Nur patients: das Druckfeld des Namens (`unterschrift` oder `ausfueller_name`). */
  feld?: string
  /** Nur bei `ohne_unterschrift`: wer ohne Unterschrift abgeschlossen hat und warum. */
  abschluss?: AbsenderAbschluss
  /**
   * Die genannte Person hat angegeben, das Formular nicht abgegeben zu haben („Das war ich
   * nicht“, Route /zurueckweisen). Patientendoku: wartet weiter, die Leitung schließt es ohne
   * Unterschrift ab. Produktausgabe: danach ohne Konto.
   */
  zurueckgewiesen?: { id: string; name: string; am: string }
}
export type Sammlung = 'patients' | 'product_outputs' | 'mpg_defect_reports'

/** Die drei Formulare mit Absender (CIRS bleibt anonym). */
export const FORMULARE: FormularId[] = ['patienten', 'produktausgabe', 'defektmeldung']
/** Alle Zustände des Absenders (1.14). */
export const ABSENDER_STATUS: AbsenderStatus[] = ['bestaetigt', 'nicht_bestaetigt', 'ohne_konto', 'ausstehend', 'ohne_unterschrift']
const WEGE: AbsenderWeg[] = ['passwort', 'anmeldung', 'nachgereicht', '']

/** Sammlung je Formular. */
export const SAMMLUNG: Record<FormularId, Sammlung> = {
  patienten: 'patients',
  produktausgabe: 'product_outputs',
  defektmeldung: 'mpg_defect_reports',
}

/** Voreinstellung je Formular (PO-Entscheidung 2): Patientendoku mit Passwort, sonst Name frei. */
export const ABSENDER_VOREINSTELLUNG: Record<FormularId, AbsenderModus> = {
  patienten: 'passwort',
  produktausgabe: 'frei',
  defektmeldung: 'frei',
}

/** Änderungsfrist nach dem Bestätigen, 24 Stunden. Zwilling von FRIST_MS in den Regeln und in doku/absenden.ts. */
export const FRIST_MS = 24 * 60 * 60 * 1000

/** JSON-Feld lesen: Objekt, Text oder doppelt kodierter Text; alles andere ist null. */
export function jsonLesen(roh: unknown): unknown {
  let wert = roh
  for (let i = 0; i < 2 && typeof wert === 'string'; i++) {
    try { wert = JSON.parse(wert) } catch { return null }
  }
  return wert
}

function objekt(roh: unknown): Record<string, unknown> | null {
  const w = jsonLesen(roh)
  return w && typeof w === 'object' && !Array.isArray(w) ? w as Record<string, unknown> : null
}

function text(x: unknown): string {
  return typeof x === 'string' ? x : ''
}

/**
 * Wie ein Formular den Absender verlangt, aus `organizations.form_config`
 * (Objekt, Text oder doppelt kodiert). Fehlt der Eintrag oder ist er unbekannt,
 * gilt die Voreinstellung. Zwilling von `absenderModus` in den Regeln.
 */
export function absenderModus(cfg: unknown, formular: FormularId): AbsenderModus {
  const c = objekt(cfg)
  const a = c ? objekt(c.absender) : null
  const wert = a ? a[formular] : undefined
  if (wert === 'passwort' || wert === 'frei') return wert
  return ABSENDER_VOREINSTELLUNG[formular] ?? 'frei'
}

function istStatus(x: unknown): x is AbsenderStatus {
  return typeof x === 'string' && (ABSENDER_STATUS as string[]).includes(x)
}

/** Modus, wenn der Satz ihn nicht nennt (Meldungen führen keinen): nur zur Anzeige. */
function modusAusStatus(status: AbsenderStatus): AbsenderModus {
  return status === 'nicht_bestaetigt' || status === 'ohne_konto' ? 'frei' : 'passwort'
}

/** `payload.absender` als Eintrag, oder null, wenn er fehlt oder unlesbar ist. */
export function absenderAusObjekt(roh: unknown): AbsenderEintrag | null {
  const a = objekt(roh)
  if (!a || !istStatus(a.status)) return null
  const eintrag: AbsenderEintrag = {
    id: text(a.id),
    name: text(a.name),
    status: a.status,
    weg: (WEGE as unknown[]).includes(a.weg) ? a.weg as AbsenderWeg : '',
    modus: a.modus === 'passwort' || a.modus === 'frei' ? a.modus : modusAusStatus(a.status),
    am: text(a.am),
  }
  if (typeof a.feld === 'string' && a.feld) eintrag.feld = a.feld
  const ab = objekt(a.abschluss)
  if (ab) eintrag.abschluss = { id: text(ab.id), name: text(ab.name), am: text(ab.am), grund: text(ab.grund) }
  const zw = objekt(a.zurueckgewiesen)
  if (zw) eintrag.zurueckgewiesen = { id: text(zw.id), name: text(zw.name), am: text(zw.am) }
  return eintrag
}

/**
 * Den Absender eines Datensatzes lesen. `patients` und `product_outputs` führen
 * ihn in `payload.absender` (payload als Objekt, Text oder doppelt kodiert),
 * Meldungen in `reporter_status`, `reporter_name` und `reporter_user_id`.
 * null heißt: ein alter Satz ohne Angabe; dann zeigt die App nichts Neues an.
 *
 * Geglaubt wird `payload.absender` nur, wenn das Statusfeld des Satzes
 * (`absender_status`) denselben Status trägt. Das Feld setzt nur der Server
 * (Route, Hooks); den payload konnte vor den Hooks und nach einer Rücknahme
 * jeder ohne Anmeldung schreiben. Ohne das Feld zeigt die App nichts an.
 */
export function absenderLesen(satz: Record<string, unknown>, sammlung: Sammlung): AbsenderEintrag | null {
  if (!satz || typeof satz !== 'object') return null
  if (sammlung === 'mpg_defect_reports') {
    const status = satz.reporter_status
    if (!istStatus(status)) return null
    return { id: text(satz.reporter_user_id), name: text(satz.reporter_name), status, weg: '', modus: modusAusStatus(status), am: '' }
  }
  const payload = objekt(satz.payload)
  const a = payload ? absenderAusObjekt(payload.absender) : null
  return a && satz.absender_status === a.status ? a : null
}

/**
 * Der payload eines Satzes, wie die App ihn für Absender, Frist und Rechte liest:
 * `absender` nur, wenn `absenderLesen` ihn glaubt, sonst ohne (wie ein alter Satz).
 * Für istMeinProtokoll, darfBearbeiten, wartetAufUnterschrift und Co., die nur
 * den payload sehen.
 */
export function gepruefterPayload(satz: Record<string, unknown> | null | undefined, sammlung: Sammlung = 'patients'): Record<string, unknown> | null {
  if (!satz || typeof satz !== 'object') return null
  const p = objekt(satz.payload)
  if (!p) return null
  if (p.absender === undefined || absenderLesen(satz, sammlung)) return p
  const ohne = { ...p }
  delete ohne.absender
  return ohne
}

/** Wartet dieses Protokoll noch auf die Unterschrift des Absenders? payload als Objekt, Text oder doppelt kodiert. */
export function wartetAufUnterschrift(payload: unknown): boolean {
  const p = objekt(payload)
  const a = p ? objekt(p.absender) : null
  return !!a && a.status === 'ausstehend'
}

/**
 * Vergleichsform eines Namens für Hinweise und die Selbstverknüpfung beim alten Server, wie
 * normName auf dem Server im Groben: Groß und klein, Leerraum, „Berg, Anna“, Umlaute und
 * Akzente, unsichtbare Zeichen und Schreibvarianten (NFKC) zählen gleich. Wer Absender ist,
 * entscheidet sonst der Server.
 */
export function nameVergleichsform(x: string): string {
  let s = String(x ?? '').normalize('NFKC')
    .replace(/[\u00AD\u034F\u115F\u1160\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g, '')
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/\s+/g, ' ').trim()
  const teile = s.split(',')
  if (teile.length === 2 && teile[0].trim() && teile[1].trim()) s = `${teile[1].trim()} ${teile[0].trim()}`
  s = s.replace(/,/g, ' ').replace(/ +/g, ' ').trim().replace(/ ?- ?/g, '-').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Zusatz hinter dem Namen (kursiv, warm-grau), Bauplan 1.14. */
export const ABSENDER_ZUSATZ: Record<AbsenderStatus, string> = {
  bestaetigt: '',
  nicht_bestaetigt: 'nicht bestätigt',
  ohne_konto: 'ohne Konto',
  ausstehend: 'Unterschrift ausstehend',
  ohne_unterschrift: 'ohne Unterschrift abgeschlossen',
}

/** Abzeichen (10px Versalien) je Status, oder null; `farbe` als CSS-Wert. */
export const ABSENDER_ABZEICHEN: Record<AbsenderStatus, { text: string; farbe: string } | null> = {
  bestaetigt: null,
  nicht_bestaetigt: null,
  ohne_konto: null,
  ausstehend: { text: 'UNTERSCHRIFT AUSSTEHEND', farbe: 'var(--lbf-warn-text-2)' },
  ohne_unterschrift: { text: 'OHNE UNTERSCHRIFT', farbe: 'var(--warm-gray)' },
}

/** „Anna Berg · nicht bestätigt“; ohne Angabe (alter Satz) der Rückfall, ohne Namen der Rückfall mit Zusatz. */
export function absenderZeile(e: AbsenderEintrag | null, rueckfall: string): string {
  if (!e) return rueckfall
  const name = e.name.trim() || rueckfall
  return [name, ABSENDER_ZUSATZ[e.status]].filter(Boolean).join(' · ')
}

const POSTEN = ['tf', 'm1', 'm2', 'm3'] as const

function besatzungsKennung(p: Record<string, unknown>, pos: string): string {
  const m = objekt(p.mannschaft)
  const e = m ? objekt(m[pos]) : null
  return e ? text(e.id) : ''
}

/**
 * Gehört das Protokoll in die Liste dieser Person? Wenn sie mit Kennung in der
 * Besatzung steht oder bestätigter bzw. nicht bestätigter Absender ist.
 * Solange es auf die Unterschrift wartet, zählt nichts davon: dann steht es nur
 * unter „Wartet auf deine Unterschrift“ (PO-Entscheidung 1).
 */
export function istMeinProtokoll(payload: unknown, userId: string): boolean {
  if (!userId) return false
  const p = objekt(payload)
  if (!p || wartetAufUnterschrift(p)) return false
  if (POSTEN.some((pos) => besatzungsKennung(p, pos) === userId)) return true
  const a = absenderAusObjekt(p.absender)
  return !!a && a.id === userId && (a.status === 'bestaetigt' || a.status === 'nicht_bestaetigt')
}

/** Ende der Änderungsfrist: `payload.frist`, sonst wie bisher ein Tag ab dem Anlegen (Zwilling von fristEnde in doku/absenden.ts). */
export function fristEndeVon(payload: unknown, angelegt: string): number {
  const p = objekt(payload) ?? {}
  const frist = typeof p.frist === 'string' ? Date.parse(p.frist) : NaN
  if (Number.isFinite(frist)) return frist
  const an = Date.parse(String(angelegt ?? '').replace(' ', 'T'))
  return Number.isFinite(an) ? an + FRIST_MS : 0
}

/**
 * Darf diese Person das Protokoll in Unitas bearbeiten und freigeben?
 * Teamführer (Kennung) oder bestätigter Absender, solange die Frist läuft.
 * Ausstehend oder ohne Unterschrift abgeschlossen: niemand.
 */
export function darfBearbeiten(payload: unknown, angelegt: string, userId: string, jetzt = Date.now()): boolean {
  if (!userId) return false
  const p = objekt(payload)
  if (!p) return false
  const a = absenderAusObjekt(p.absender)
  if (a && (a.status === 'ausstehend' || a.status === 'ohne_unterschrift')) return false
  const tf = besatzungsKennung(p, 'tf') === userId
  const absender = !!a && a.status === 'bestaetigt' && a.id === userId
  if (!tf && !absender) return false
  return fristEndeVon(p, angelegt) > jetzt
}

// ── Rechte, Spiegel von 2.4 der Regeln ───────────────────────────────────────

type Konto = Partial<Pick<User, 'id' | 'role' | 'supervisor' | 'disabled' | 'expires_at' | 'organization_id' | 'permissions' | 'temp_permissions'>>

/** Nicht gesperrt und nicht abgelaufen (wie `aktiv` in den Regeln). */
export function kontoAktiv(u: Konto | null | undefined, jetzt = Date.now()): boolean {
  if (!u || u.disabled) return false
  if (!u.expires_at) return true
  return Date.parse(String(u.expires_at).replace(' ', 'T')) > jetzt
}

/** Recht dauerhaft gesetzt oder befristet noch gültig (wie `rechtAktiv` in den Regeln). */
export function rechtAktiv(u: Konto | null | undefined, recht: string, jetzt = Date.now()): boolean {
  if (!u) return false
  if (u.permissions?.[recht] === true) return true
  const bis = u.temp_permissions?.[recht]?.until
  if (typeof bis !== 'string' || !bis) return false
  const t = Date.parse(bis.replace(' ', 'T'))
  return Number.isFinite(t) && t > jetzt
}

function orgId(org: unknown): string {
  return org && typeof org === 'object' ? text((org as { id?: unknown }).id) : ''
}

/**
 * Darf diese Person ein ausstehendes Patientenprotokoll ohne Unterschrift
 * abschließen? Aktiv, keine Teilnehmerin und Supervisor, Leitung oder Recht
 * `patienten` in dieser Organisation; das Modul Patienten muss frei sein.
 */
export function darfOhneUnterschrift(user: User | null, org: unknown, jetzt = Date.now()): boolean {
  if (!user || !kontoAktiv(user, jetzt) || user.role === 'teilnehmer') return false
  if (!modulFrei(org, 'patienten')) return false
  if (user.supervisor === true) return true
  const id = orgId(org)
  if (!id || user.organization_id !== id) return false
  return user.role === 'admin' || rechtAktiv(user, 'patienten', jetzt)
}

/** Darf diese Person den Absender der Formulare einstellen (Update-Regel von organizations)? */
export function darfFormulareEinstellen(user: User | null, jetzt = Date.now()): boolean {
  if (!user || !kontoAktiv(user, jetzt)) return false
  return user.supervisor === true || user.role === 'admin'
    || rechtAktiv(user, 'unitarii', jetzt) || rechtAktiv(user, 'dokumente', jetzt)
}

/**
 * Kann diese Person angemeldet absenden (ihr Token zählt als Mitglieds-Token)?
 * Aktiv, mit Organisation, keine Teilnehmerin, kein Supervisor-Konto.
 */
export function kannAngemeldetSenden(user: User | null, jetzt = Date.now()): boolean {
  if (!user || !kontoAktiv(user, jetzt)) return false
  return !!user.organization_id && user.role !== 'teilnehmer' && user.supervisor !== true
}

/**
 * Öffnet ein öffentlich ausgeschaltetes Formular (`hidden_forms`) trotzdem, weil
 * ein angemeldetes Mitglied derselben Organisation es benutzt? `hidden_forms`
 * heißt „öffentlicher Link aus“, nicht „Formular aus“ (PO-Entscheidung 3,
 * Befund 10): der Server nimmt mit Mitglieds-Token an, solange das Modul frei
 * ist. CIRS bleibt anonym und hat keinen angemeldeten Weg.
 */
export function angemeldetTrotzAusgeschaltet(user: User | null, orgId: string, formular: string, jetzt = Date.now()): boolean {
  if (formular !== 'patienten' && formular !== 'produktausgabe' && formular !== 'defektmeldung') return false
  return !!orgId && kannAngemeldetSenden(user, jetzt) && user?.organization_id === orgId
}

/** Link „Formular einstellen“ aus MPG und Lager: wer einstellen darf, wenn das Modul Vorgänge fehlt. */
export function einstellungsLinkZeigen(user: User | null, org: unknown): boolean {
  return darfFormulareEinstellen(user) && !modulFrei(org, 'dokumente')
}

/** „{m} Minuten“, bei einer Minute „einer Minute“; m aufgerundet, mindestens 1 (wie `minutenText` in den Regeln). */
export function minutenText(sekunden: number): string {
  const s = Number.isFinite(sekunden) ? sekunden : 60
  const m = Math.max(1, Math.ceil(s / 60))
  return m === 1 ? 'einer Minute' : `${m} Minuten`
}
