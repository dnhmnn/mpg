// Aufrufe der Formular-Routen des Servers (/api/responda/formular/…, Bauplan v2, 1.3 bis 1.9).
//
// Alles läuft per fetch, nicht über pb.send: so schickt die App das Token nur,
// wenn sie es ausdrücklich will (mitAnmeldung), und jede Antwort wird an einer
// Stelle in `Antwort<T>` übersetzt. Die Masken zeigen `text` unverändert.
//
// Das Passwort steht nur im Argument und im Body des einen Aufrufs. Es wird nie
// gespeichert, nie geloggt und nie in eine URL geschrieben.

import { pb } from '../pocketbase'
import { newId } from '../eks/ids'
import { tresorWeiche } from '../tresor'
import { ABSENDER_VOREINSTELLUNG, absenderAusObjekt, minutenText, type AbsenderEintrag, type AbsenderModus, type FormularArt, type FormularId, type Sammlung } from './absender'

/** Warum etwas nicht ging; `netz` und `alter_server` setzt die App, alle anderen der Server (1.2). */
export type Grund =
  | 'netz' | 'alter_server' | 'organisation' | 'formular_aus' | 'daten' | 'name' | 'name_unbekannt'
  | 'passwort_noetig' | 'passwort_falsch' | 'gesperrt' | 'drossel' | 'kennung' | 'aenderung_alt'
  | 'nicht_angemeldet' | 'nicht_berechtigt' | 'nicht_gefunden' | 'fremd' | 'schon_bestaetigt' | 'server'

type FehlerFelder = { grund: Grund; text: string; status: number; sekunden?: number; versucheUebrig?: number; feld?: string; ziel?: string }
export type Fehler = { ok: false; wert?: undefined } & FehlerFelder
/**
 * Erfolg. Die Fehlerfelder stehen als `undefined` mit drin: das Projekt prüft
 * ohne `strict`, und dort engt `if (r.ok) … else` den Fehlerzweig nicht ein.
 * So lässt sich `r.grund`, `r.text` immer lesen; sicher einengen mit `istFehler(r)`.
 */
export type Erfolg<T> = { ok: true; wert: T } & { [K in keyof FehlerFelder]?: undefined }
export type Antwort<T> = Erfolg<T> | Fehler

/** Ist die Antwort ein Fehler? (Typwächter, funktioniert auch ohne `strict`.) */
export function istFehler(r: { ok: boolean }): r is Fehler {
  return r.ok === false
}
export type FormularStand = { modus: AbsenderModus | 'anonym'; an: boolean; oeffentlich: boolean; ausstehend: boolean }
/**
 * Je Formular der Stand; `eigen` (Server ab Stand-Version 2) gilt für alle eigenen Formulare
 * der Organisation: `an`/`oeffentlich` heißt Modul Vorgänge frei, `ausstehend` heißt der Server
 * kennt „Unterschrift ausstehend“ für Einsendungen. Den Absender bestimmt dort die Vorlage.
 */
export type StandFormulare = Record<FormularId | 'cirs', FormularStand> & { eigen?: FormularStand }
/** Was der Server schon kann (Stand-Version 2); fehlt bei älteren Servern. */
export type StandFaehig = { eigene_felder: { produktausgabe: boolean; defektmeldung: boolean; cirs: boolean }; eigene_formulare: boolean; eingang: boolean }
/** Stand des Servers. `version: 0` heißt: nur auf dem Gerät erschlossen (ohne Netz), nicht vom Server. */
export type Stand = { version: number; formulare: StandFormulare; faehig?: StandFaehig; angemeldet: { id: string; name: string } | null }
export type AbsenderAngabe = { name: string; passwort?: string; ausstehend?: boolean } | null
export type Maske = 'doku' | 'alt' | 'schnell'
/** Body von /absenden (1.5); `daten` je Formular, Passwort nur in `absender`; `vorlage` nur bei `eigen`. */
export type Absendung = { formular: FormularArt; maske?: Maske; id: string; absender: AbsenderAngabe; daten: Record<string, unknown>; uebernommen?: boolean; vorlage?: string }
/**
 * Antwort von /absenden nach Erfolg; `id` ist die endgültige Kennung. `anonym`: ein eigenes
 * Formular ohne Absender (dann ist `absender` null).
 */
export type Gesendet = { id: string; bereits: boolean; absender: AbsenderEintrag | null; frist: string; anonym?: boolean }
export type Unterschrift = { formular: FormularArt; id: string; titel: string; zusammenfassung: string; angelegt: string; absender_name: string; vorlage?: string }
export type PruefGrund = 'name_unvollstaendig' | 'name_doppelt' | 'ohne_email'
/**
 * Ergebnis der Mitglieder-Prüfung. `koennen_nicht`: Name unvollständig oder ohne E-Mail, kann
 * nicht mit Passwort bestätigen. `doppelt`: Name doppelt, bestätigt mit Passwort, wird aber in
 * der Besatzung und für „Unterschrift ausstehend“ nicht erkannt.
 */
export type MitgliederPruefung = { gesamt: number; koennen_nicht: number; doppelt: number; eintraege: { id: string; name: string; gruende: PruefGrund[] }[] }
export type NamensErgebnis = { vollstaendig: boolean; gefunden: boolean; eindeutig: boolean }

/** Bis zu diesem Tag (UTC, ausschließlich) nimmt die App bei einem Server ohne Formular-Routen den alten Weg (1.18). */
export const ALTER_SERVER_BIS = '2027-01-31'
/** So lange gilt „neuen Server gesehen“: ein 404 danach ist ein Serverfehler, kein alter Server. */
export const SERVER_GESEHEN_MS = 24 * 60 * 60 * 1000

/** Alle Gründe, die die App kennt; ein anderer `grund` vom Server zählt als `server`. */
export const GRUENDE: Grund[] = [
  'netz', 'alter_server', 'organisation', 'formular_aus', 'daten', 'name', 'name_unbekannt',
  'passwort_noetig', 'passwort_falsch', 'gesperrt', 'drossel', 'kennung', 'aenderung_alt',
  'nicht_angemeldet', 'nicht_berechtigt', 'nicht_gefunden', 'fremd', 'schon_bestaetigt', 'server',
]

/**
 * Rückfalltexte, wenn der Server keinen schickt (Spiegel von TEXTE in den Regeln, 1.2).
 * `alter_server` hat keinen Text: dann nimmt die App still den alten Weg.
 */
export const TEXTE: Record<Grund, string> = {
  netz: 'Keine Verbindung zum Server.',
  alter_server: '',
  organisation: 'Diese Organisation gibt es nicht oder sie ist nicht aktiv.',
  formular_aus: 'Dieses Formular ist für eure Organisation ausgeschaltet.',
  daten: 'Die Angaben sind unvollständig. Bitte prüfen und erneut senden.',
  name: 'Bitte Vor- und Nachnamen vollständig eintragen.',
  name_unbekannt: 'Unter diesem Namen ist kein aktives Mitglied eingetragen. Bitte den Namen so eintragen, wie er in Responda steht.',
  passwort_noetig: 'Bitte bestätige mit deinem Passwort.',
  passwort_falsch: 'Das Passwort stimmt nicht.',
  gesperrt: 'Zu viele falsche Passwörter. Bitte in 15 Minuten erneut versuchen.',
  drossel: 'Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.',
  kennung: 'Diese Kennung ist schon vergeben.',
  aenderung_alt: 'Diese Angaben gehören zu einem schon abgesendeten Protokoll.',
  nicht_angemeldet: 'Bitte melde dich an.',
  nicht_berechtigt: 'Dafür fehlt dir das Recht.',
  nicht_gefunden: 'Diesen Eintrag gibt es nicht.',
  fremd: 'Dieser Eintrag wartet auf die Unterschrift einer anderen Person.',
  schon_bestaetigt: 'Dieser Eintrag wartet nicht mehr auf eine Unterschrift.',
  server: 'Das hat gerade nicht geklappt. Bitte erneut versuchen.',
}

/** Text, wenn ein Gerät den neuen Server kürzlich gesehen hat und die Route trotzdem fehlt (1.18). */
export const SERVER_NIMMT_NICHTS_AN = 'Der Server nimmt gerade keine Formulare an. Es bleibt auf dem Gerät und geht später raus.'

/**
 * Text, wenn eine Route mit Anmeldung fehlt (Unterschreiben, Ohne Unterschrift abschließen,
 * Das war ich nicht): der Server hat die Formular-Hooks gerade nicht, etwa nach einer Rücknahme.
 */
export const SERVER_BIETET_NICHT = 'Der Server bietet das gerade nicht an. Bitte später erneut versuchen oder die Leitung fragen.'

/**
 * Texte der Server-Hooks bei direkten API-Aufrufen (1.2). Kommt einer davon als
 * `message`, zeigt die App ihn; sonst den Rückfall zum Status (englische
 * Standardtexte von PocketBase zeigt sie nie).
 */
export const HOOK_TEXTE: string[] = [
  'Diese Fassung der App kann nicht mehr absenden. Bitte zuerst den Entwurf speichern, dann die App neu öffnen.',
  'Organisation fehlt.',
  'Dieses Formular ist für eure Organisation ausgeschaltet.',
  'Das Protokoll wartet noch auf die Unterschrift des Absenders. Ändern geht erst danach.',
  'Dieses Protokoll ist bestätigt. Ändern geht nur angemeldet, in Unitas über „Bearbeiten“.',
  'In eurer Organisation gibt es schon ein aktives Mitglied mit diesem Namen. Bitte den Namen unterscheidbar machen, etwa mit dem zweiten Vornamen.',
  'Bitte den Namen in einer Schrift schreiben, ohne Buchstaben aus anderen Alphabeten.',
  'Dieses Protokoll ist abgeschlossen oder seine Frist ist abgelaufen. Ändern geht nur angemeldet.',
  'Die Angaben sind unvollständig. Bitte prüfen und erneut senden.',
  'Bitte einen Namen eintragen.',
  'Bitte den Einsatz angeben.',
  'Bitte ein gültiges Datum angeben.',
  'Bitte mindestens einen Artikel mit Menge angeben.',
  'Ein Artikel gehört nicht zu eurer Organisation.',
  'Dieser Verbrauchsort gehört nicht zu eurer Organisation.',
  'Dieses Gerät gehört nicht zu eurer Organisation.',
  'Dieses Gerät ist außer Betrieb genommen.',
  'Bitte den Defekt beschreiben.',
  'Die Angaben ließen sich nicht speichern. Bitte prüfen und erneut senden.',
  'Bitte einen Grund angeben, mindestens 10 Zeichen.',
  'Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.',
]
const ALTE_FASSUNG_TEXT = HOOK_TEXTE[0]

/** Gerade kommen sehr viele Anfragen … in {m}. */
export function drosselText(sekunden: number): string {
  return `Gerade kommen sehr viele Anfragen. Bitte in ${minutenText(sekunden)} erneut versuchen.`
}

// ── Gerät ────────────────────────────────────────────────────────────────────

export type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Der Speicher des Geräts für die Formulare. Warteschlange und Entwürfe gehen in den
 * Tresor (verschlüsselt in IndexedDB, src/lib/tresor.ts), alles andere wie bisher in
 * localStorage. Ist der Tresor nicht geöffnet (Prüffälle, Browser ohne WebCrypto), ist
 * es localStorage, wenn das Gerät ihn hergibt (privates Fenster, gesperrt: null).
 */
export function geraeteSpeicher(): Speicher | null {
  return tresorWeiche()
}

/** Neue Kennung eines Satzes: 15 × [a-z0-9], vom Client vergeben (wie in EKS). */
export function neueKennung(): string {
  return newId()
}

/** Ist das eine Kennung, wie PocketBase sie annimmt? */
export function kennungGueltig(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{15}$/.test(id)
}

/** Kennung der angemeldeten Person, wenn ihr Token gültig ist; sonst ''. */
export function aktuelleTokenId(): string {
  try {
    if (!pb.authStore.isValid) return ''
    const m = (pb.authStore.record ?? pb.authStore.model) as { id?: unknown } | null
    return typeof m?.id === 'string' ? m.id : ''
  } catch {
    return ''
  }
}

function basis(): string {
  return String(pb.baseURL || '').replace(/\/+$/, '')
}

// ── Alter oder neuer Server (1.18) ───────────────────────────────────────────

const SERVER_PREFIX = 'formular_server_'

/** Merken: dieses Gerät hat den neuen Server für diese Organisation gerade gesehen. */
export function serverGesehen(orgCode: string, jetzt = new Date(), s: Speicher | null = geraeteSpeicher()): void {
  if (!orgCode || !s) return
  try { s.setItem(SERVER_PREFIX + orgCode, JSON.stringify({ gesehen: jetzt.toISOString() })) } catch { /* Speicher voll: nicht merken */ }
}

function gesehenAm(orgCode: string, s: Speicher | null): number {
  if (!orgCode || !s) return NaN
  try {
    const roh = JSON.parse(s.getItem(SERVER_PREFIX + orgCode) || 'null') as { gesehen?: unknown } | null
    return typeof roh?.gesehen === 'string' ? Date.parse(roh.gesehen) : NaN
  } catch {
    return NaN
  }
}

/** Liegt `jetzt` noch vor ALTER_SERVER_BIS? */
export function alterWegErlaubt(jetzt = new Date()): boolean {
  return jetzt.getTime() < Date.parse(`${ALTER_SERVER_BIS}T00:00:00Z`)
}

/**
 * Was eine Antwort über den Server sagt.
 * - `neu`: Erfolg oder ein `grund` der Formular-Routen; wird gemerkt.
 * - `alter_server`: 404 ohne `grund`, vor ALTER_SERVER_BIS, und das Gerät hat
 *   den neuen Server seit 24 Stunden nicht (oder nie) gesehen: alter Weg.
 * - `server`: 404 ohne `grund`, aber der neue Server war kürzlich da oder das
 *   Enddatum ist vorbei: Serverfehler, der Eintrag bleibt liegen.
 * - `unklar`: alles andere (sagt nichts über die Fassung).
 */
export function serverArt(
  orgCode: string,
  antwort: { status: number; grund?: unknown },
  jetzt = new Date(),
  s: Speicher | null = geraeteSpeicher(),
): 'neu' | 'alter_server' | 'server' | 'unklar' {
  const hatGrund = typeof antwort.grund === 'string' && (GRUENDE as string[]).includes(antwort.grund)
  if ((antwort.status >= 200 && antwort.status < 300) || hatGrund) {
    serverGesehen(orgCode, jetzt, s)
    return 'neu'
  }
  if (antwort.status !== 404) return 'unklar'
  if (!alterWegErlaubt(jetzt)) return 'server'
  const g = gesehenAm(orgCode, s)
  if (Number.isFinite(g) && jetzt.getTime() - g < SERVER_GESEHEN_MS) return 'server'
  return 'alter_server'
}

// ── Anfrage und Übersetzung der Antwort ─────────────────────────────────────

type Anfrage = {
  methode: 'GET' | 'POST' | 'PATCH'
  pfad: string
  body?: unknown
  /** Token mitschicken (nur wenn gültig). */
  token: boolean
  /** Für serverArt (Routen mit {code}); leer bei den Routen mit Anmeldung. */
  orgCode?: string
  zeitMs?: number
}

/** Rohantwort; `netz: true` heißt: keine Antwort (dann status 0). */
type Roh = { netz: boolean; status: number; body: unknown; lesbar: boolean }

async function holen(a: Anfrage): Promise<Roh> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (a.body !== undefined) headers['Content-Type'] = 'application/json'
  if (a.token && pb.authStore.isValid && pb.authStore.token) headers.Authorization = pb.authStore.token
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const uhr = ctrl ? setTimeout(() => ctrl.abort(), a.zeitMs ?? 15000) : null
  try {
    const res = await fetch(basis() + a.pfad, {
      method: a.methode,
      headers,
      body: a.body === undefined ? undefined : JSON.stringify(a.body),
      signal: ctrl?.signal,
      cache: 'no-store',
      credentials: 'omit',
    })
    let body: unknown = null
    let lesbar = false
    try {
      const t = await res.text()
      body = t ? JSON.parse(t) : null
      lesbar = body !== null && typeof body === 'object'
    } catch { /* unlesbar */ }
    return { netz: false, status: res.status, body, lesbar }
  } catch {
    // TypeError (kein Netz, CORS), Abbruch nach der Wartezeit: kein Ergebnis
    return { netz: true, status: 0, body: null, lesbar: false }
  } finally {
    if (uhr) clearTimeout(uhr)
  }
}

function zahl(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined
}

function fehler(grund: Grund, status: number, text?: string, zusatz: Partial<FehlerFelder> = {}): Fehler {
  return { ok: false, grund, text: text ?? TEXTE[grund], status, ...zusatz }
}

/** Fehlerantwort einer Formular-Route übersetzen (1.19, „Abbildung“). */
function routenFehler(r: Roh, orgCode: string | undefined, jetzt: Date): Fehler {
  if (!r.lesbar) return fehler('server', r.status)
  const b = r.body as Record<string, unknown>
  const grund = typeof b.grund === 'string' && (GRUENDE as string[]).includes(b.grund) ? b.grund as Grund : null
  if (grund) {
    serverArt(orgCode ?? '', { status: r.status, grund }, jetzt)
    const message = typeof b.message === 'string' && b.message ? b.message : undefined
    const zusatz: Partial<FehlerFelder> = {}
    const sek = zahl(b.sekunden); if (sek !== undefined) zusatz.sekunden = sek
    const rest = zahl(b.versuche_uebrig); if (rest !== undefined) zusatz.versucheUebrig = rest
    if (typeof b.feld === 'string') zusatz.feld = b.feld
    if (typeof b.ziel === 'string') zusatz.ziel = b.ziel
    let t = message ?? TEXTE[grund]
    if (!message && grund === 'drossel') t = drosselText(sek ?? 60)
    if (!message && grund === 'gesperrt' && sek !== undefined) t = `Zu viele falsche Passwörter. Bitte in ${minutenText(sek)} erneut versuchen.`
    return fehler(grund, r.status, t, zusatz)
  }
  if (r.status === 404) {
    // Routen mit Anmeldung (ohne Org-Code): kein alter Weg, aber ein Text für den Dialog
    if (!orgCode) return alterWegErlaubt(jetzt) ? fehler('alter_server', 404, SERVER_BIETET_NICHT) : fehler('server', 404, SERVER_BIETET_NICHT)
    const art = serverArt(orgCode, { status: 404 }, jetzt)
    return art === 'alter_server' ? fehler('alter_server', 404, '') : fehler('server', 404, SERVER_NIMMT_NICHTS_AN)
  }
  if (r.status === 429) return fehler('drossel', 429, drosselText(60), { sekunden: 60 })
  if (r.status === 400) return fehler('daten', 400)
  return fehler('server', r.status)
}

async function route<T>(a: Anfrage, lesen: (body: Record<string, unknown>) => T | null, jetzt = new Date()): Promise<Antwort<T>> {
  const r = await holen(a)
  if (r.netz) return fehler('netz', 0)
  if (r.status >= 200 && r.status < 300) {
    if (!r.lesbar) return fehler('server', r.status)
    if (a.orgCode) serverArt(a.orgCode, { status: r.status }, jetzt)
    const wert = lesen(r.body as Record<string, unknown>)
    return wert === null ? fehler('server', r.status) : { ok: true, wert }
  }
  return routenFehler(r, a.orgCode, jetzt)
}

const PFAD = '/api/responda/formular'
const code = (orgCode: string) => `${PFAD}/${encodeURIComponent(orgCode)}`

function ohneToken(): Fehler {
  return fehler('nicht_angemeldet', 401)
}

// ── Lesen der Antworten ──────────────────────────────────────────────────────

function standFormular(roh: unknown, f: FormularId | 'cirs' | 'eigen'): FormularStand {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {}
  const vor: AbsenderModus | 'anonym' = f === 'cirs' ? 'anonym' : f === 'eigen' ? 'frei' : ABSENDER_VOREINSTELLUNG[f]
  const modus = o.modus === 'passwort' || o.modus === 'frei' || o.modus === 'anonym' ? o.modus : vor
  return { modus, an: o.an === true, oeffentlich: o.oeffentlich === true, ausstehend: o.ausstehend === true }
}

/** Antwort von /stand lesen; auch für den gemerkten Stand. */
export function standLesen(b: unknown): Stand | null {
  if (!b || typeof b !== 'object') return null
  const o = b as Record<string, unknown>
  const f = o.formulare && typeof o.formulare === 'object' ? o.formulare as Record<string, unknown> : null
  if (!f) return null
  const a = o.angemeldet && typeof o.angemeldet === 'object' ? o.angemeldet as Record<string, unknown> : null
  const formulare: StandFormulare = {
    patienten: standFormular(f.patienten, 'patienten'),
    produktausgabe: standFormular(f.produktausgabe, 'produktausgabe'),
    defektmeldung: standFormular(f.defektmeldung, 'defektmeldung'),
    cirs: standFormular(f.cirs, 'cirs'),
  }
  // Eigene Formulare kennt erst der Server mit Stand-Version 2; ohne Eintrag kein Schlüssel
  if (f.eigen && typeof f.eigen === 'object') formulare.eigen = standFormular(f.eigen, 'eigen')
  const stand: Stand = {
    version: zahl(o.version) ?? 1,
    formulare,
    angemeldet: a && typeof a.id === 'string' && a.id ? { id: a.id, name: typeof a.name === 'string' ? a.name : '' } : null,
  }
  const faehig = faehigLesen(o.faehig)
  if (faehig) stand.faehig = faehig
  return stand
}

/** `faehig` aus /stand (Version 2); fehlt oder unlesbar: undefined (dann bietet die App das Neue nicht an). */
function faehigLesen(roh: unknown): StandFaehig | undefined {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return undefined
  const o = roh as Record<string, unknown>
  const e = o.eigene_felder && typeof o.eigene_felder === 'object' ? o.eigene_felder as Record<string, unknown> : {}
  return {
    eigene_felder: { produktausgabe: e.produktausgabe === true, defektmeldung: e.defektmeldung === true, cirs: e.cirs === true },
    eigene_formulare: o.eigene_formulare === true,
    eingang: o.eingang === true,
  }
}

function absenderOderLeer(roh: unknown): AbsenderEintrag {
  return absenderAusObjekt(roh) ?? { id: '', name: '', status: 'ohne_konto', weg: '', modus: 'frei', am: '' }
}

function istFormular(x: unknown): x is FormularArt {
  return x === 'patienten' || x === 'produktausgabe' || x === 'defektmeldung' || x === 'eigen'
}

// ── Routen (1.3 bis 1.9) ─────────────────────────────────────────────────────

/** Ohne Org-Code nie fragen: ein 404 auf „/formular//…“ sähe sonst aus wie ein alter Server. */
function ohneCode(): Promise<Fehler> {
  return Promise.resolve(fehler('organisation', 404))
}

/** GET /{code}/stand: Einstellung je Formular und ob das Token als Mitglied zählt. Token nur mit `mitAnmeldung`. */
export function formularStand(orgCode: string, o: { mitAnmeldung?: boolean } = {}): Promise<Antwort<Stand>> {
  if (!orgCode) return ohneCode()
  return route({ methode: 'GET', pfad: `${code(orgCode)}/stand`, token: !!o.mitAnmeldung, orgCode, zeitMs: 10000 }, standLesen)
}

/**
 * POST /{code}/name: passt der Name auf ein aktives Mitglied? Nur ja/nein, nie eine Liste.
 * Eigene Formulare (`eigen`) nennen ihre Vorlage (`o.vorlage`).
 */
export function nameGefunden(orgCode: string, formular: FormularArt, name: string, o: { mitAnmeldung?: boolean; vorlage?: string } = {}): Promise<Antwort<NamensErgebnis>> {
  if (!orgCode) return ohneCode()
  const body: Record<string, unknown> = { formular, name }
  if (formular === 'eigen') body.vorlage = o.vorlage ?? ''
  return route(
    { methode: 'POST', pfad: `${code(orgCode)}/name`, body, token: !!o.mitAnmeldung, orgCode, zeitMs: 10000 },
    (b) => ({ vollstaendig: b.vollstaendig === true, gefunden: b.gefunden === true, eindeutig: b.eindeutig === true }),
  )
}

/** Body für /absenden: leeres Passwort und `uebernommen: false` fallen weg, `maske` nur bei patienten. */
export function absendeBody(a: Absendung): Record<string, unknown> {
  let absender: Record<string, unknown> | null = null
  if (a.absender) {
    absender = { name: a.absender.name }
    if (typeof a.absender.passwort === 'string' && a.absender.passwort !== '') absender.passwort = a.absender.passwort
    else if (a.absender.ausstehend === true) absender.ausstehend = true
  }
  const body: Record<string, unknown> = { formular: a.formular, id: a.id, absender, daten: a.daten }
  if (a.formular === 'patienten' && a.maske) body.maske = a.maske
  if (a.formular === 'eigen') body.vorlage = a.vorlage ?? ''
  if (a.uebernommen === true) body.uebernommen = true
  return body
}

/**
 * POST /{code}/absenden: ein Formular über den Server anlegen. Mit
 * `mitAnmeldung` und gültigem Token sendet die angemeldete Person (`absender: null`).
 * Masken und Warteschlange rufen das nicht direkt, sondern `formularSenden` (versand.ts).
 */
export function absenden(orgCode: string, a: Absendung, o: { mitAnmeldung: boolean }): Promise<Antwort<Gesendet>> {
  if (!orgCode) return ohneCode()
  return route(
    { methode: 'POST', pfad: `${code(orgCode)}/absenden`, body: absendeBody(a), token: o.mitAnmeldung, orgCode, zeitMs: 30000 },
    (b) => {
      const g: Gesendet = {
        id: typeof b.id === 'string' && b.id ? b.id : a.id,
        bereits: b.bereits === true,
        // Anonym gesendet (eigenes Formular): kein Absender, auch kein leerer
        absender: b.anonym === true ? null : absenderOderLeer(b.absender),
        frist: typeof b.frist === 'string' ? b.frist : '',
      }
      if (a.formular === 'eigen') g.anonym = b.anonym === true
      return g
    },
  )
}

/** GET /unterschriften: was die angemeldete Person noch unterschreiben kann, neueste zuerst. */
export async function offeneUnterschriften(): Promise<Antwort<Unterschrift[]>> {
  if (!pb.authStore.isValid) return ohneToken()
  return route({ methode: 'GET', pfad: `${PFAD}/unterschriften`, token: true, zeitMs: 10000 }, (b) => {
    if (!Array.isArray(b.eintraege)) return null
    return (b.eintraege as unknown[]).flatMap((x) => {
      const e = x && typeof x === 'object' ? x as Record<string, unknown> : null
      if (!e || !istFormular(e.formular) || typeof e.id !== 'string') return []
      const s = (k: string) => typeof e[k] === 'string' ? e[k] as string : ''
      const u: Unterschrift = { formular: e.formular, id: e.id, titel: s('titel'), zusammenfassung: s('zusammenfassung'), angelegt: s('angelegt'), absender_name: s('absender_name') }
      if (e.formular === 'eigen') u.vorlage = s('vorlage')
      return [u]
    })
  })
}

/** POST /unterschreiben: einen ausstehenden Eintrag als die angemeldete Person bestätigen (auch eigene Formulare). */
export async function unterschreiben(formular: FormularArt, id: string): Promise<Antwort<{ absender: AbsenderEintrag; frist: string }>> {
  if (!pb.authStore.isValid) return ohneToken()
  return route(
    { methode: 'POST', pfad: `${PFAD}/unterschreiben`, body: { formular, id }, token: true },
    (b) => ({ absender: absenderOderLeer(b.absender), frist: typeof b.frist === 'string' ? b.frist : '' }),
  )
}

/**
 * POST /zurueckweisen („Das war ich nicht“): die angemeldete Person sagt, sie habe diesen
 * ausstehenden Eintrag nicht abgegeben. Patientendoku: er wartet weiter, aber nicht mehr auf
 * sie; die Leitung schließt ihn ohne Unterschrift ab. Produktausgabe und Defektmeldung: danach
 * ohne Konto unter dem eingetragenen Namen.
 */
export async function zurueckweisen(formular: FormularArt, id: string): Promise<Antwort<{ absender: AbsenderEintrag | null }>> {
  if (!pb.authStore.isValid) return ohneToken()
  return route(
    { methode: 'POST', pfad: `${PFAD}/zurueckweisen`, body: { formular, id }, token: true },
    (b) => ({ absender: absenderAusObjekt(b.absender) }),
  )
}

/** Grenzen der Begründung für „Ohne Unterschrift abschließen“ (wie der Server). */
export const GRUND_MIN = 10
export const GRUND_MAX = 500

/** POST /ohne-unterschrift: ausstehendes Patientenprotokoll ohne Unterschrift abschließen (Leitung, Recht patienten). */
export async function ohneUnterschrift(id: string, grund: string): Promise<Antwort<{ absender: AbsenderEintrag }>> {
  if (!pb.authStore.isValid) return ohneToken()
  const g = String(grund ?? '').trim()
  if (g.length < GRUND_MIN || g.length > GRUND_MAX) return fehler('daten', 400, 'Bitte einen Grund angeben, mindestens 10 Zeichen.', { feld: 'grund' })
  return route(
    { methode: 'POST', pfad: `${PFAD}/ohne-unterschrift`, body: { formular: 'patienten', id, grund: g }, token: true },
    (b) => ({ absender: absenderOderLeer(b.absender) }),
  )
}

/** GET /mitglieder-pruefung: wie viele Mitglieder nicht mit Passwort bestätigen können (Karten unter Vorgänge). */
export async function mitgliederPruefung(): Promise<Antwort<MitgliederPruefung>> {
  if (!pb.authStore.isValid) return ohneToken()
  return route({ methode: 'GET', pfad: `${PFAD}/mitglieder-pruefung`, token: true, zeitMs: 15000 }, (b) => {
    if (!Array.isArray(b.eintraege)) return null
    const gruende: PruefGrund[] = ['name_unvollstaendig', 'name_doppelt', 'ohne_email']
    const eintraege = (b.eintraege as unknown[]).flatMap((x) => {
      const e = x && typeof x === 'object' ? x as Record<string, unknown> : null
      if (!e || typeof e.id !== 'string') return []
      const g = Array.isArray(e.gruende) ? (e.gruende as unknown[]).filter((y): y is PruefGrund => (gruende as unknown[]).includes(y)) : []
      return [{ id: e.id, name: typeof e.name === 'string' ? e.name : '', gruende: g }]
    })
    const mit = (g: PruefGrund) => eintraege.filter((e) => e.gruende.includes(g)).length
    const koennenNicht = eintraege.filter((e) => e.gruende.includes('name_unvollstaendig') || e.gruende.includes('ohne_email')).length
    return { gesamt: zahl(b.gesamt) ?? 0, koennen_nicht: zahl(b.koennen_nicht) ?? koennenNicht, doppelt: zahl(b.doppelt) ?? mit('name_doppelt'), eintraege }
  })
}

// ── Direkte Schreibwege (alter Server, Änderung übernommener Einträge) ───────

/** Fehler eines direkten Sammlungs-Aufrufs: Hook-Texte zeigen, englische Standardtexte nie. */
function direktFehler(r: Roh): Fehler {
  const b = r.lesbar ? r.body as Record<string, unknown> : {}
  const message = typeof b.message === 'string' ? b.message : ''
  const hook = HOOK_TEXTE.includes(message) ? message : undefined
  if (r.status === 429) return fehler('drossel', 429, drosselText(60), { sekunden: 60 })
  if (hook === TEXTE.formular_aus) return fehler('formular_aus', r.status, hook)
  if (r.status === 400) return fehler('daten', 400, hook)
  if (r.status === 401) return fehler('nicht_angemeldet', 401)
  if (r.status === 403) return fehler('nicht_berechtigt', 403, hook)
  if (r.status === 404) return fehler('nicht_gefunden', 404)
  return fehler('server', r.status, hook)
}

/**
 * Alter Weg: Satz mit eigener Kennung direkt in der Sammlung anlegen (Server
 * ohne Formular-Routen). „id muss eindeutig sein“ heißt: ein früherer Versuch
 * kam an, also gilt er als gesendet (`bereits: true`).
 */
export async function direktAnlegen(sammlung: Sammlung, satz: Record<string, unknown> & { id: string }, o: { mitAnmeldung: boolean; orgCode?: string }): Promise<Antwort<{ id: string; bereits: boolean }>> {
  const r = await holen({ methode: 'POST', pfad: `/api/collections/${sammlung}/records`, body: satz, token: o.mitAnmeldung, zeitMs: 30000 })
  if (r.netz) return fehler('netz', 0)
  if (r.status >= 200 && r.status < 300) return { ok: true, wert: { id: satz.id, bereits: false } }
  const b = r.lesbar ? r.body as { data?: { id?: { code?: unknown } }; message?: unknown } : {}
  if (r.status === 400 && b.data?.id?.code === 'validation_not_unique') return { ok: true, wert: { id: satz.id, bereits: true } }
  // Der Hook des neuen Servers lehnt alte Fassungen ab: der neue Server ist also da
  if (b.message === ALTE_FASSUNG_TEXT && o.orgCode) serverGesehen(o.orgCode)
  return direktFehler(r)
}

/** Einen bestehenden Satz direkt ändern (übernommene Änderung, 409 `aenderung_alt`). Token nur mit `mitAnmeldung`. */
export async function direktAendern(sammlung: Sammlung, id: string, daten: Record<string, unknown>, o: { mitAnmeldung: boolean }): Promise<Antwort<{ id: string }>> {
  const r = await holen({ methode: 'PATCH', pfad: `/api/collections/${sammlung}/records/${encodeURIComponent(id)}`, body: daten, token: o.mitAnmeldung, zeitMs: 30000 })
  if (r.netz) return fehler('netz', 0)
  if (r.status >= 200 && r.status < 300) return { ok: true, wert: { id } }
  return direktFehler(r)
}
