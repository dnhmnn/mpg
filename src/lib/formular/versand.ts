// Versand der Formulare: alle Schreibwege an einer Stelle (Bauplan v2, 1.18, 4.1, 4.2).
//
// Masken (B, C) und Warteschlange (B) legen nie selbst an. Sie rufen
// `formularSenden` (oder `sendenOderAblegen`, das auch die Ablage ohne Netz
// erledigt), die Warteschlange `abarbeiten` bzw. `eintragAusfuehren`.
// Darunter liegen genau drei Wege:
// - die Route /absenden (neuer Server),
// - der alte Weg: direkt anlegen mit derselben Kennung (Server ohne Routen,
//   bis ALTER_SERVER_BIS; „id muss eindeutig sein“ gilt als gesendet),
// - Ändern eines schon abgesendeten Protokolls (übernommene Änderung nach
//   409 `aenderung_alt`).
// Neues und Altes laufen über dieselbe Kennung, deshalb entsteht kein Doppel.

import { FRIST_MS, SAMMLUNG, minutenText, nameVergleichsform, type AbsenderEintrag, type AbsenderModus, type Sammlung } from './absender'
import {
  absenden, aktuelleTokenId, direktAendern, direktAnlegen, geraeteSpeicher, istFehler, neueKennung, SERVER_NIMMT_NICHTS_AN,
  type AbsenderAngabe, type Antwort, type Erfolg, type Fehler, type Gesendet, type Grund, type NamensErgebnis, type Speicher, type Stand,
} from './api'
import { ablegen, aktualisieren, eintrag, eintraege, entfernen, ohnePasswort, OHNE_PASSWORT_NACH_MS, type NeuerEintrag, type Warteeintrag } from './warteschlange'

/** Was die Warteschlange mit einem Eintrag tut (1.18). */
export type Schritt =
  | { art: 'warten'; bis?: string }
  | { art: 'fragen' }
  | { art: 'senden'; absender: AbsenderAngabe; mitAnmeldung: boolean }
  | { art: 'alt' }
  | { art: 'aendern'; ziel: string }
  /** Der Name passt nicht (Modus frei): erst nach einer Korrektur in der Karte wieder senden. */
  | { art: 'korrigieren' }

/** Lage des Geräts für `naechsterSchritt`; `tokenId` ist die Kennung des gültigen Tokens oder ''. */
export type Kontext = { online: boolean; stand: Stand | null; serverAlt: boolean; tokenId: string; jetzt: Date }

/** Nach einem Fehler, der sich nicht von selbst gibt (Formular aus, Daten, abgewiesene Änderung): so lange Pause. */
export const FEHLER_PAUSE_MS = 5 * 60 * 1000
/** Ohne Angabe des Servers: so lange ist die Passwortbestätigung nach zu vielen Fehlversuchen gesperrt. */
export const SPERRE_MS = 15 * 60 * 1000
/**
 * Fehler, die sich ohne Zutun nicht geben. Die Karte zeigt sie mit einem Ausweg (erneut senden,
 * verwerfen nach Rückfrage); die App versucht es nach FEHLER_PAUSE_MS trotzdem erneut, denn ein
 * ausgeschaltetes Formular kann wieder angehen.
 */
export const BLEIBENDE_GRUENDE: Grund[] = ['formular_aus', 'organisation', 'daten', 'nicht_berechtigt', 'nicht_gefunden', 'fremd', 'schon_bestaetigt', 'nicht_angemeldet']
const PAUSE_GRUENDE: Grund[] = BLEIBENDE_GRUENDE

/** Passt der Absendername nicht (unvollständig, unbekannt, leer)? Dann ist er in der Karte zu korrigieren. */
export function nameFalsch(e: Pick<Warteeintrag, 'letzterFehler'>): boolean {
  const f = e.letzterFehler
  return !!f && (f.grund === 'name' || f.grund === 'name_unbekannt' || (f.grund === 'daten' && f.feld === 'absender'))
}

function zeitpunkt(iso: string | undefined): number {
  const t = Date.parse(iso ?? '')
  return Number.isFinite(t) ? t : NaN
}

/**
 * Was mit einem Eintrag als Nächstes geschieht (1.18, Tabelle „Versandregeln“).
 * Reine Funktion. Ein fremdes Token zählt nie: angemeldet gesendet wird nur,
 * wenn das gültige Token derselben Person gehört, die abgelegt hat.
 */
export function naechsterSchritt(e: Warteeintrag, k: Kontext): Schritt {
  if (!k.online) return { art: 'warten' }
  const spaeter = zeitpunkt(e.naechsterVersuchAb)
  if (Number.isFinite(spaeter) && spaeter > k.jetzt.getTime()) return { art: 'warten', bis: e.naechsterVersuchAb }
  if (e.ziel) return { art: 'aendern', ziel: e.ziel }
  if (k.serverAlt) return { art: 'alt' }
  if (e.angemeldetId && e.angemeldetId === k.tokenId) return { art: 'senden', absender: null, mitAnmeldung: true }
  const f = k.stand?.formulare[e.formular]
  // Ohne Stand ist der Modus unbekannt: warten, bis er da ist (nie raten)
  if (!f) return { art: 'warten' }
  if (f.modus === 'frei') return nameFalsch(e) ? { art: 'korrigieren' } : { art: 'senden', absender: { name: e.absenderName }, mitAnmeldung: false }
  const gefragt = zeitpunkt(e.gefragtAb)
  if (Number.isFinite(gefragt) && k.jetzt.getTime() - gefragt >= OHNE_PASSWORT_NACH_MS && e.nameEindeutig === true && f.ausstehend) {
    return { art: 'senden', absender: { name: e.absenderName, ausstehend: true }, mitAnmeldung: false }
  }
  return { art: 'fragen' }
}

/** Geht dieser Eintrag ohne Passwort raus („Ohne Passwort senden“)? Nur bei eindeutigem Namen und wenn der Server „ausstehend“ kennt. */
export function ohnePasswortMoeglich(e: Warteeintrag, stand: Stand | null): boolean {
  return e.nameEindeutig === true && !!stand?.formulare[e.formular]?.ausstehend && !!e.absenderName.trim()
}

/** Schritt für „Ohne Passwort senden“: geht als „Unterschrift ausstehend“ raus. */
export function schrittOhnePasswort(e: Warteeintrag): Schritt {
  return { art: 'senden', absender: { name: e.absenderName, ausstehend: true }, mitAnmeldung: false }
}

// ── Alter Weg ────────────────────────────────────────────────────────────────

function istObjekt(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}
function str(x: unknown): string {
  return typeof x === 'string' ? x : ''
}
function kopie<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** Schlüssel, die nur der Server setzt; im alten Weg nie vom Client übernommen. */
const SERVER_SCHLUESSEL = ['absender', 'eingang_sha256', 'aenderungen']

/** Druckfeld des Absendernamens je Maske: doku → unterschrift, alt und schnell → ausfueller_name. */
export function druckfeld(maske: Warteeintrag['maske']): 'unterschrift' | 'ausfueller_name' {
  return maske === 'alt' || maske === 'schnell' ? 'ausfueller_name' : 'unterschrift'
}

/** Flache Felder der Besatzung je Posten (wie POSTEN in doku/besatzung.ts und in den Regeln). */
const BESATZUNG_FELDER: [string, string][] = [['tf', 'mannschaft_tf'], ['m1', 'mannschaft_1'], ['m2', 'mannschaft_2'], ['m3', 'mannschaft_3']]

/**
 * Alter Server, angemeldet gesendet: die sendende Person selbst dort in der Besatzung
 * verknüpfen, wo ihr Name steht (nur sie, mit ihrem eigenen Token; andere Namen bleiben
 * Namen, die Leitung trägt sie in der Patientenverwaltung nach). So findet sie das Protokoll
 * in Unitas, auch solange der Server noch keine Namen auflöst.
 */
function selbstVerknuepfen(payload: Record<string, unknown>, selbst: { id: string; name: string }): void {
  const ziel = nameVergleichsform(selbst.name)
  if (!selbst.id || !ziel) return
  const m: Record<string, unknown> = istObjekt(payload.mannschaft) ? { ...payload.mannschaft } : {}
  let geaendert = false
  for (const [pos, feld] of BESATZUNG_FELDER) {
    const flach = str(payload[feld]).trim()
    const nest = istObjekt(m[pos]) ? str((m[pos] as Record<string, unknown>).name).trim() : ''
    const name = flach || nest
    if (name && nameVergleichsform(name) === ziel) { m[pos] = { id: selbst.id, name }; geaendert = true }
  }
  if (geaendert) payload.mannschaft = m
}

/**
 * Der Satz für den alten Weg (direkt anlegen, Server ohne Routen).
 * patients wie `datensatz()` aus doku/absenden.ts: Frist und Absendezeit aus
 * `angelegt`, Status offen, leeres Druckfeld mit dem Absendernamen gefüllt.
 * Produktausgabe und Meldung: `e.alt` (von der Maske), Name aus `absenderName`;
 * fehlt `alt`, ein Rückfall aus `daten`.
 * `selbst`: angemeldet gesendet (mit Token). Dann verknüpft der Satz diese Person mit sich
 * selbst (Besatzung, `user_id`, `reporter_user_id`); ohne `selbst` trägt er nie eine Kennung.
 */
export function altSatz(e: Warteeintrag, selbst: { id: string; name: string } | null = null): { sammlung: Sammlung; satz: Record<string, unknown> & { id: string } } {
  const sammlung = SAMMLUNG[e.formular]
  const name = e.absenderName.trim()
  const d = e.daten
  if (e.formular === 'patienten') {
    const payload: Record<string, unknown> = istObjekt(d.payload) ? kopie(d.payload) : {}
    for (const k of SERVER_SCHLUESSEL) delete payload[k]
    if (selbst) selbstVerknuepfen(payload, selbst)
    const feld = druckfeld(e.maske)
    if (!str(payload[feld]).trim() && name) payload[feld] = name
    const an = zeitpunkt(e.angelegt)
    const t = Number.isFinite(an) ? an : Date.now()
    payload.frist = new Date(t + FRIST_MS).toISOString()
    payload.abgesendet = new Date(t).toISOString()
    const title = str(d.title).trim().slice(0, 200) || (e.maske === 'schnell' ? 'Schnelldoku' : 'Patientendoku')
    return { sammlung, satz: ohnePasswort({ id: e.id, title, payload, status: 'offen', organization_id: e.orgId }) }
  }
  if (e.formular === 'produktausgabe') {
    const datum = str(d.datum)
    const basis: Record<string, unknown> = istObjekt(e.alt) ? kopie(e.alt) : {
      title: `Produktausgabe ${str(d.einsatz)} (${datum.split('-').reverse().join('.')})`,
      payload: { einsatz: str(d.einsatz), datum, user_id: '', user_name: name, lager_id: str(d.lager_id), lager_name: '', positionen: Array.isArray(d.positionen) ? kopie(d.positionen) : [] },
      status: 'offen',
    }
    const payload = istObjekt(basis.payload) ? basis.payload : {}
    if (name) payload.user_name = name
    // Eine Kennung nur mit dem eigenen Token: sonst nie (auch nicht aus einer alten Ablage)
    payload.user_id = selbst ? selbst.id : ''
    for (const k of SERVER_SCHLUESSEL) delete payload[k]
    return { sammlung, satz: ohnePasswort({ status: 'offen', ...basis, payload, id: e.id, organization_id: e.orgId }) }
  }
  const basis: Record<string, unknown> = istObjekt(e.alt) ? kopie(e.alt) : {
    device_id: str(d.device_id), device_name: '', description: str(d.description).trim(),
    severity: str(d.severity) || 'medium', status: 'pending', reporter_user_id: '', reporter_name: name,
  }
  if (name) basis.reporter_name = name
  basis.reporter_user_id = selbst ? selbst.id : ''
  delete basis.reporter_status
  return { sammlung, satz: ohnePasswort({ status: 'pending', ...basis, id: e.id, organization_id: e.orgId }) }
}

// ── Senden ───────────────────────────────────────────────────────────────────

export type AltGesendet = { id: string; bereits: boolean; alterWeg: true }
export type SendeAntwort = Antwort<Gesendet> | Erfolg<AltGesendet>
/** Wer sendet: Absenderangabe für die Route und ob das Token mitgeht. */
export type SendeAngabe = { absender: AbsenderAngabe; mitAnmeldung: boolean }

function alsEintrag(e: NeuerEintrag | Warteeintrag, jetzt: Date): Warteeintrag {
  const w = e as Partial<Warteeintrag>
  return { ...e, v: 2, versuche: w.versuche ?? 0, angelegt: w.angelegt ?? jetzt.toISOString() } as Warteeintrag
}

async function altSenden(e: Warteeintrag, mitAnmeldung: boolean): Promise<SendeAntwort> {
  // Angemeldet: die Person mit dem gültigen Token, unter dem Namen, mit dem sie sendet
  const tokenId = mitAnmeldung ? aktuelleTokenId() : ''
  const selbst = tokenId ? { id: tokenId, name: e.absenderName } : null
  const { sammlung, satz } = altSatz(e, selbst)
  const r = await direktAnlegen(sammlung, satz, { mitAnmeldung, orgCode: e.orgCode })
  if (istFehler(r)) return r
  return { ok: true, wert: { id: r.wert.id, bereits: r.wert.bereits, alterWeg: true } }
}

/** Senden mit Kennungswechsel nach 409; gibt die zuletzt benutzte Kennung mit zurück. */
async function sendenIntern(e: Warteeintrag, angabe: SendeAngabe): Promise<{ antwort: SendeAntwort; id: string }> {
  let id = e.id
  for (let versuch = 0; ; versuch++) {
    const r = await absenden(e.orgCode, { formular: e.formular, maske: e.maske, id, absender: angabe.absender, daten: e.daten, uebernommen: e.uebernommen }, { mitAnmeldung: angabe.mitAnmeldung })
    if (!istFehler(r)) return { antwort: r, id: r.wert.id }
    if (r.grund === 'alter_server') return { antwort: await altSenden({ ...e, id }, angabe.mitAnmeldung), id }
    // Kennung schon mit anderem Inhalt vergeben: neue Kennung, sofort ein zweiter Versuch
    if (r.grund === 'kennung' && versuch === 0) { id = neueKennung(); continue }
    return { antwort: r, id }
  }
}

/**
 * Ein Formular senden: über die Route, bei altem Server über den alten Weg
 * (gleiche Kennung). Bei 409 `kennung` vergibt es selbst eine neue Kennung und
 * versucht es sofort noch einmal; die endgültige Kennung steht in `wert.id`
 * (für die Protokollnummer immer diese nehmen). Legt nichts ab.
 */
export async function formularSenden(e: NeuerEintrag, angabe: SendeAngabe): Promise<SendeAntwort> {
  return (await sendenIntern(alsEintrag(e, new Date()), angabe)).antwort
}

// ── Meldungen ────────────────────────────────────────────────────────────────

function uhrzeit(iso: string): string {
  const t = zeitpunkt(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function tagUndZeit(iso: string): string {
  const t = zeitpunkt(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${uhrzeit(iso)}`
}

/** Meldungen der Warteschlange und der Masken (4.2, 4.3), ohne Gedankenstriche. */
export const MELDUNGEN = {
  gesendet: 'Gesendet.',
  gesendetAusstehend: (name: string) => name ? `Gesendet. Wartet auf die Unterschrift von ${name}.` : 'Gesendet. Wartet auf die Unterschrift des Absenders.',
  wartetBis: (iso: string) => `Wartet bis ${uhrzeit(iso)}, dann neuer Versuch.`,
  gesperrtBis: (iso: string, name: string) => `Passwort für ${name || 'den Absender'} gesperrt bis ${uhrzeit(iso)}. Danach fragt diese Karte erneut.`,
  nichtGesendet: (text: string) => `Konnte nicht gesendet werden: ${text}`,
  aenderungAbgewiesen: (text: string) => `Diese Änderung gehört zu einem schon abgesendeten Protokoll und ließ sich dort nicht eintragen: ${text}`,
  verwerfenFrage: 'Die Änderung wird von diesem Gerät gelöscht. Das abgesendete Protokoll bleibt, wie es ist.',
  ohneNetzWartet: 'Ohne Netz. Geht raus, sobald wieder Netz da ist.',
  ohneNetzPasswort: (name: string) => name
    ? `Ohne Netz gespeichert. Sobald wieder Netz da ist, fragt die App nach dem Passwort von ${name}.`
    : 'Ohne Netz gespeichert. Sobald wieder Netz da ist, fragt die App nach dem Passwort.',
  ohneNetzFrei: 'Ohne Netz gespeichert. Geht raus, sobald wieder Netz da ist.',
  ohneNetzOhneSpeicher: 'Ohne Netz und ohne Speicher. Das lässt sich gerade nicht ablegen.',
  gesperrtAbgelegt: (name: string, bisIso: string) => {
    const bis = uhrzeit(bisIso)
    const wer = name ? `für ${name} ` : ''
    return `Auf dem Gerät gespeichert. Die Passwortbestätigung ${wer}ist${bis ? ` bis ${bis}` : ''} gesperrt. Danach fragt die Karte „Wartet auf dem Gerät“ oben erneut.`
  },
  ohnePasswortAbgelegt: (name: string) => `Auf dem Gerät gespeichert. Oben in „Wartet auf dem Gerät“ geht es weiter: mit dem Passwort von ${name || 'dem Absender'} oder, wenn der Name genau zu einem Mitglied passt, ohne Passwort. Dann wartet es auf die Unterschrift in Unitas.`,
  drosselAbgelegt: (sekunden: number) => `Gerade kommen sehr viele Anfragen. Es ist auf dem Gerät gespeichert und geht in ${minutenText(sekunden)} raus.`,
  serverAbgelegt: 'Der Server hat es gerade nicht angenommen. Es ist auf dem Gerät gespeichert und geht später raus.',
  nichtAbgelegt: (text: string) => `${text} Auf dem Gerät ließ es sich nicht speichern.`,
} as const

/** Was die Karte zu einem bleibenden Fehler als nächsten Schritt sagt. */
export function bleibendHinweis(e: Pick<Warteeintrag, 'formular' | 'letzterFehler'>): string {
  const g = e.letzterFehler?.grund
  if (g === 'formular_aus' || g === 'organisation') {
    return 'Das Formular nimmt gerade nichts an. Die App versucht es alle fünf Minuten erneut. Bitte bei der Leitung nachfragen, ob es wieder eingeschaltet wird.'
  }
  if (e.formular === 'patienten') {
    return 'In dieser Karte lässt sich das nicht ändern. Bitte die Leitung fragen, bevor du das Protokoll verwirfst.'
  }
  return 'In dieser Karte lässt sich das nicht ändern. Bitte neu erfassen und diesen Eintrag danach verwerfen.'
}

/** Rückfrage vor dem Verwerfen eines Eintrags mit bleibendem Fehler, je Formular. */
export function verwerfenFrageText(e: Pick<Warteeintrag, 'formular' | 'daten'>): string {
  if (e.formular === 'patienten') {
    const b = eintragBezug(e)
    return `Das Protokoll${b ? ` ${b}` : ''} wird von diesem Gerät gelöscht. Es ist danach nirgends mehr gespeichert, das lässt sich nicht rückgängig machen.`
  }
  if (e.formular === 'produktausgabe') return 'Die Produktausgabe wird von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.'
  return 'Die Defektmeldung wird von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen. Besteht der Defekt noch, bitte neu melden.'
}

/**
 * Woran der Mensch einen Eintrag erkennt: Patientendoku der Patient aus dem Titel
 * („Patientendoku: Max Muster“ → „Max Muster“), Produktausgabe der Einsatz,
 * Defektmeldung das Gerät. Leer, wenn nichts Brauchbares da ist.
 */
export function eintragBezug(e: Pick<Warteeintrag, 'formular' | 'daten'> & { alt?: Record<string, unknown> }): string {
  const d = e.daten ?? {}
  const kurz = (t: string) => (t.length > 60 ? `${t.slice(0, 59)}…` : t)
  if (e.formular === 'patienten') {
    const t = str(d.title).trim().replace(/^(Patientendoku|Schnelldoku)\s*:\s*/i, '').trim()
    return /^(Patientendoku|Schnelldoku)$/i.test(t) ? '' : kurz(t)
  }
  if (e.formular === 'produktausgabe') {
    const einsatz = str(d.einsatz).trim()
    return einsatz ? kurz(`Einsatz ${einsatz}`) : ''
  }
  const geraet = istObjekt(e.alt) ? str(e.alt.device_name).trim() : ''
  return kurz(geraet)
}

function artVon(e: Pick<Warteeintrag, 'formular'>): string {
  return e.formular === 'produktausgabe' ? 'Produktausgabe' : e.formular === 'defektmeldung' ? 'Defektmeldung' : 'Protokoll'
}

/** Kopf der Karte: „Protokoll Max Muster vom 31.10., 14:20 wartet auf das Senden“ (Produktausgabe, Defektmeldung entsprechend). */
export function eintragKopf(e: Warteeintrag): string {
  const b = eintragBezug(e)
  const wer = b ? `${artVon(e)} ${b}` : artVon(e)
  const wann = tagUndZeit(e.angelegt)
  return wann ? `${wer} vom ${wann} wartet auf das Senden` : `${wer} wartet auf das Senden`
}

/** Meldung nach dem Senden mit Bezug: „Protokoll Max Muster gesendet.“ und ggf. die Unterschrift. */
export function gesendetText(e: Warteeintrag, ausstehendName: string | null): string {
  const b = eintragBezug(e)
  const wer = b ? `${artVon(e)} ${b}` : artVon(e)
  if (ausstehendName === null) return `${wer} gesendet.`
  return ausstehendName ? `${wer} gesendet. Wartet auf die Unterschrift von ${ausstehendName}.` : `${wer} gesendet. Wartet auf die Unterschrift des Absenders.`
}

/** Wurde die Änderung (Eintrag mit `ziel`) vom Server abgewiesen? Dann darf sie verworfen werden. */
export function aenderungAbgewiesen(e: Warteeintrag): boolean {
  return !!e.ziel && !!e.letzterFehler && !['netz', 'drossel', 'server'].includes(e.letzterFehler.grund)
}

/** Ein Fehler, der sich ohne Zutun nicht gibt (BLEIBENDE_GRUENDE); nur für neue Einträge (ohne `ziel`). */
export function bleibenderFehler(e: Pick<Warteeintrag, 'ziel' | 'letzterFehler'>): boolean {
  return !e.ziel && !!e.letzterFehler && BLEIBENDE_GRUENDE.includes(e.letzterFehler.grund) && !nameFalsch(e)
}

/**
 * „Verwerfen“ nach Rückfrage: abgewiesene Änderungen (MELDUNGEN.verwerfenFrage) und Einträge mit
 * bleibendem Fehler (verwerfenFrageText). Alles andere nie. Gibt zurück, ob entfernt wurde.
 */
export function verwerfen(s: Speicher, e: Warteeintrag): boolean {
  if (!aenderungAbgewiesen(e) && !bleibenderFehler(e)) return false
  return entfernen(s, e.orgCode, e.id)
}

/** Den Absendernamen in der Karte ändern; mit dem Ergebnis der Namensprüfung (null: unbekannt). */
export function absenderNameSetzen(s: Speicher, orgCode: string, id: string, name: string, ergebnis?: NamensErgebnis | null): boolean {
  return aktualisieren(s, orgCode, id, (e) => {
    const neu: Warteeintrag = { ...e, absenderName: name }
    if (ergebnis) neu.nameEindeutig = ergebnis.vollstaendig && ergebnis.eindeutig
    else delete neu.nameEindeutig
    if (nameFalsch(neu)) delete neu.letzterFehler
    return neu
  })
}

// ── Einen Eintrag der Warteschlange ausführen ───────────────────────────────

export type Ausfuehrung = {
  ergebnis: 'gesendet' | 'liegt' | 'fragen'
  meldung: string
  grund?: Grund
  /** Nach Erfolg über die Route: der gespeicherte Absender. */
  absender?: AbsenderEintrag
  /** Nach Erfolg: die endgültige Kennung. */
  id?: string
}

function mitAnmeldungFuer(e: Warteeintrag): boolean {
  return !!e.angemeldetId && e.angemeldetId === aktuelleTokenId()
}

/**
 * Einen Schritt für einen Eintrag ausführen und das Ergebnis in der
 * Warteschlange festhalten (1.18, „Ergebnisse“). Gelöscht wird nur nach Erfolg.
 * - `warten`, `korrigieren`: nichts, nur die Meldung.
 * - `fragen` ohne Passwort: merkt `gefragtAb`, aber nur mit `o.frageSichtbar`
 *   (Vorgabe true): die Stunde bis „ohne Passwort“ zählt erst ab einer Frage,
 *   die jemand online sehen konnte (eingeklappte Karte: false). Mit
 *   `o.passwort`: sendet mit diesem Passwort.
 * - `senden`, `alt`, `aendern`: senden; Erfolg entfernt, 429 setzt
 *   `naechsterVersuchAb`, 409 `kennung` vergibt eine neue Kennung, 409
 *   `aenderung_alt` setzt `ziel` und trägt die Änderung sofort dort ein.
 *   429 `gesperrt` wartet bis zum Ende der Sperre (`naechsterVersuchAb`).
 * Das Passwort wird nie gespeichert.
 */
export async function eintragAusfuehren(s: Speicher, e: Warteeintrag, schritt: Schritt, o: { passwort?: string; jetzt?: Date; frageSichtbar?: boolean } = {}): Promise<Ausfuehrung> {
  const jetzt = o.jetzt ?? new Date()
  if (schritt.art === 'warten') {
    return { ergebnis: 'liegt', meldung: schritt.bis ? MELDUNGEN.wartetBis(schritt.bis) : '' }
  }
  if (schritt.art === 'korrigieren') return { ergebnis: 'liegt', meldung: '' }
  if (schritt.art === 'fragen') {
    if (!o.passwort) {
      if (!e.gefragtAb && o.frageSichtbar !== false) aktualisieren(s, e.orgCode, e.id, (x) => ({ ...x, gefragtAb: x.gefragtAb || jetzt.toISOString() }))
      return { ergebnis: 'fragen', meldung: '' }
    }
    return eintragAusfuehren(s, e, { art: 'senden', absender: { name: e.absenderName, passwort: o.passwort }, mitAnmeldung: false }, { jetzt })
  }

  let antwort: SendeAntwort | Antwort<{ id: string }>
  let id = e.id
  if (schritt.art === 'aendern') {
    const d = e.daten
    const aenderung: Record<string, unknown> = {}
    if (typeof d.title === 'string') aenderung.title = d.title
    if (istObjekt(d.payload)) aenderung.payload = d.payload
    antwort = await direktAendern(SAMMLUNG[e.formular], schritt.ziel, ohnePasswort(aenderung), { mitAnmeldung: mitAnmeldungFuer(e) })
  } else if (schritt.art === 'alt') {
    antwort = await altSenden(e, mitAnmeldungFuer(e))
  } else {
    const r = await sendenIntern(e, { absender: schritt.absender, mitAnmeldung: schritt.mitAnmeldung })
    antwort = r.antwort
    id = r.id
  }

  if (antwort.ok) {
    entfernen(s, e.orgCode, e.id)
    const w = antwort.wert as Partial<Gesendet>
    const absender = w.absender && typeof w.absender === 'object' ? w.absender : undefined
    const meldung = gesendetText(e, absender?.status === 'ausstehend' ? (absender.name || e.absenderName.trim()) : null)
    return { ergebnis: 'gesendet', meldung, absender, id: typeof w.id === 'string' ? w.id : id }
  }

  const f = antwort as Fehler
  const am = jetzt.toISOString()
  const pause = new Date(jetzt.getTime() + FEHLER_PAUSE_MS).toISOString()

  // 409 aenderung_alt: die Angaben gehören zu einem abgesendeten Protokoll; dort eintragen
  if (f.grund === 'aenderung_alt' && f.ziel && schritt.art !== 'aendern') {
    const ziel = f.ziel
    aktualisieren(s, e.orgCode, e.id, (x) => { const n = { ...x, ziel, versuche: x.versuche + 1 }; delete n.letzterFehler; return n })
    return eintragAusfuehren(s, { ...e, ziel }, { art: 'aendern', ziel }, { jetzt })
  }

  let meldung = schritt.art === 'aendern' ? MELDUNGEN.aenderungAbgewiesen(f.text) : MELDUNGEN.nichtGesendet(f.text)
  aktualisieren(s, e.orgCode, e.id, (x) => {
    const n: Warteeintrag = { ...x, versuche: x.versuche + 1 }
    if (id !== e.id) n.id = id
    if (f.grund === 'netz') return n
    if (f.grund === 'drossel') {
      n.naechsterVersuchAb = new Date(jetzt.getTime() + Math.max(1, f.sekunden ?? 60) * 1000).toISOString()
      return n
    }
    if (f.grund === 'kennung') n.id = neueKennung()
    if (f.grund === 'name' || f.grund === 'name_unbekannt') n.nameEindeutig = false
    n.letzterFehler = { grund: f.grund, text: f.text, am }
    if (f.feld) n.letzterFehler.feld = f.feld
    if (schritt.art === 'aendern' || PAUSE_GRUENDE.includes(f.grund)) n.naechsterVersuchAb = pause
    // Zu viele falsche Passwörter: bis zum Ende der Sperre nicht erneut fragen
    if (f.grund === 'gesperrt') n.naechsterVersuchAb = sperreEnde(jetzt, f.sekunden)
    return n
  })
  if (f.grund === 'netz') meldung = MELDUNGEN.ohneNetzWartet
  if (f.grund === 'drossel') meldung = MELDUNGEN.wartetBis(new Date(jetzt.getTime() + Math.max(1, f.sekunden ?? 60) * 1000).toISOString())
  return { ergebnis: 'liegt', meldung, grund: f.grund }
}

// ── Die ganze Warteschlange abarbeiten ──────────────────────────────────────

export type Lauf = Record<string, Ausfuehrung & { schritt: Schritt['art'] }>
const laufend = new Map<string, Promise<Lauf>>()

/**
 * Alle Einträge einer Organisation nacheinander abarbeiten, eine Sendung zur
 * Zeit, in der Reihenfolge der Ablage (beim Einhängen, bei `online`, alle 60
 * Sekunden aufrufen). Läuft schon ein Durchgang, kommt dessen Ergebnis. Nach
 * `netz` oder `drossel` endet der Durchgang (der Rest wartet). Ergebnis je
 * Kennung, wie sie vor dem Durchgang war. `frageSichtbar: false` (Karte
 * eingeklappt): die Passwortfrage zählt nicht als gesehen (`gefragtAb` bleibt leer).
 */
export function abarbeiten(s: Speicher, orgCode: string, k: { online: boolean; stand: Stand | null; serverAlt: boolean; tokenId?: string; frageSichtbar?: boolean }): Promise<Lauf> {
  const schon = laufend.get(orgCode)
  if (schon) return schon
  const lauf = (async () => {
    const aus: Lauf = {}
    for (const { id } of eintraege(s, orgCode)) {
      const e = eintrag(s, orgCode, id)
      if (!e) continue
      const jetzt = new Date()
      const schritt = naechsterSchritt(e, { online: k.online, stand: k.stand, serverAlt: k.serverAlt, tokenId: k.tokenId ?? aktuelleTokenId(), jetzt })
      const r = await eintragAusfuehren(s, e, schritt, { jetzt, frageSichtbar: k.frageSichtbar })
      aus[id] = { ...r, schritt: schritt.art }
      if (r.grund === 'netz' || r.grund === 'drossel') break
    }
    return aus
  })().finally(() => laufend.delete(orgCode))
  laufend.set(orgCode, lauf)
  return lauf
}

// ── Für die Masken: senden oder ablegen (4.2) ───────────────────────────────

export type MaskenErgebnis =
  | { art: 'gesendet'; id: string; bereits: boolean; absender: AbsenderEintrag | null; frist: string; alterWeg: boolean }
  | { art: 'abgelegt'; meldung: string }
  | { art: 'nicht_abgelegt'; meldung: string }
  | { art: 'fehler'; grund: Grund; meldung: string; feld?: string; versucheUebrig?: number; ablegenAnbieten: boolean; sekunden?: number }

/**
 * Anlass der Ablage: ohne Netz, Sperre nach zu vielen falschen Passwörtern, Drossel, Störung,
 * oder `ohne_passwort`: im Modus Passwort ausdrücklich „Kein Passwort zur Hand? Auf dem Gerät
 * ablegen“ (dann fragt die Karte der Warteschlange weiter, und bei eindeutigem Namen geht es dort
 * auch ohne Passwort, PO-Entscheidung 1).
 */
export type AblageAnlass = 'netz' | 'gesperrt' | 'drossel' | 'server' | 'ohne_passwort'
type Ablage = { modus: AbsenderModus; mitAnmeldung: boolean; s?: Speicher | null; anlass?: AblageAnlass; sekunden?: number; text?: string }

/** Ende einer Passwortsperre: jetzt + `sekunden` vom Server, ohne Angabe SPERRE_MS. */
function sperreEnde(jetzt: Date, sekunden?: number): string {
  const ms = typeof sekunden === 'number' && Number.isFinite(sekunden) && sekunden > 0 ? sekunden * 1000 : SPERRE_MS
  return new Date(jetzt.getTime() + ms).toISOString()
}

/**
 * Ablegen mit der passenden Meldung (4.2). `angemeldetId` nur mit
 * `mitAnmeldung`. Nach `gesperrt` („Auf dem Gerät ablegen“) wartet der Eintrag
 * bis zum Ende der Sperre (`o.sekunden`, sonst 15 Minuten); erst dann fragt die
 * Karte wieder, und ab dieser sichtbaren Frage zählt die Stunde bis „ohne Passwort“.
 */
export function ablegenMitMeldung(e: NeuerEintrag, o: Ablage): { gespeichert: boolean; meldung: string } {
  const s = o.s === undefined ? geraeteSpeicher() : o.s
  const jetzt = new Date()
  const neu: NeuerEintrag = { ...e, angemeldetId: o.mitAnmeldung ? (e.angemeldetId || aktuelleTokenId()) : '' }
  if (o.anlass === 'drossel') neu.naechsterVersuchAb = new Date(jetzt.getTime() + Math.max(1, o.sekunden ?? 60) * 1000).toISOString()
  let sperreBis = ''
  if (o.anlass === 'gesperrt') {
    sperreBis = sperreEnde(jetzt, o.sekunden)
    neu.naechsterVersuchAb = sperreBis
    neu.letzterFehler = { grund: 'gesperrt', text: o.text || 'Zu viele falsche Passwörter.', am: jetzt.toISOString() }
  }
  const gespeichert = !!s && ablegen(s, neu, jetzt)
  const anlass = o.anlass ?? 'netz'
  if (!gespeichert) {
    return { gespeichert, meldung: anlass === 'netz' ? MELDUNGEN.ohneNetzOhneSpeicher : MELDUNGEN.nichtAbgelegt(o.text || 'Das hat gerade nicht geklappt.') }
  }
  const name = e.absenderName.trim()
  const passwortWeg = o.modus === 'passwort' && !neu.angemeldetId
  if (anlass === 'drossel') return { gespeichert, meldung: MELDUNGEN.drosselAbgelegt(o.sekunden ?? 60) }
  if (anlass === 'server') return { gespeichert, meldung: o.text === SERVER_NIMMT_NICHTS_AN ? SERVER_NIMMT_NICHTS_AN : MELDUNGEN.serverAbgelegt }
  if (anlass === 'gesperrt') return { gespeichert, meldung: MELDUNGEN.gesperrtAbgelegt(name, sperreBis) }
  if (anlass === 'ohne_passwort') return { gespeichert, meldung: MELDUNGEN.ohnePasswortAbgelegt(name) }
  return { gespeichert, meldung: passwortWeg ? MELDUNGEN.ohneNetzPasswort(name) : MELDUNGEN.ohneNetzFrei }
}

/**
 * Senden aus einer Maske, mit Ablage nach 4.2: ohne Netz, bei `netz`,
 * `server` und `drossel` auf das Gerät; `gesperrt` als Fehler mit
 * `ablegenAnbieten` (Knopf „Auf dem Gerät ablegen“ → `ablegenMitMeldung` mit
 * `anlass: 'gesperrt'`); alle anderen als Fehler für die Warnfläche.
 * `o.modus` ist der Modus aus dem Stand (für die Meldung ohne Netz).
 */
export async function sendenOderAblegen(e: NeuerEintrag, angabe: SendeAngabe, o: { modus: AbsenderModus; s?: Speicher | null; online?: boolean }): Promise<MaskenErgebnis> {
  const online = o.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const basis: NeuerEintrag = { ...e, absenderName: e.absenderName || angabe.absender?.name || '' }
  const ablage = (anlass: Ablage['anlass'], id: string, f?: Fehler): MaskenErgebnis => {
    const r = ablegenMitMeldung({ ...basis, id }, { modus: o.modus, mitAnmeldung: angabe.mitAnmeldung, s: o.s, anlass, sekunden: f?.sekunden, text: f?.text })
    return r.gespeichert ? { art: 'abgelegt', meldung: r.meldung } : { art: 'nicht_abgelegt', meldung: r.meldung }
  }
  if (!online) return ablage('netz', basis.id)
  const { antwort, id } = await sendenIntern(alsEintrag(basis, new Date()), angabe)
  if (antwort.ok) {
    const w = antwort.wert as Partial<Gesendet> & Partial<AltGesendet>
    return {
      art: 'gesendet',
      id: typeof w.id === 'string' ? w.id : id,
      bereits: w.bereits === true,
      absender: w.absender ?? null,
      frist: typeof w.frist === 'string' ? w.frist : '',
      alterWeg: w.alterWeg === true,
    }
  }
  const f = antwort as Fehler
  if (f.grund === 'netz') return ablage('netz', id, f)
  if (f.grund === 'server') return ablage('server', id, f)
  if (f.grund === 'drossel') return ablage('drossel', id, f)
  return { art: 'fehler', grund: f.grund, meldung: f.text, feld: f.feld, versucheUebrig: f.versucheUebrig, ablegenAnbieten: f.grund === 'gesperrt', sekunden: f.sekunden }
}
