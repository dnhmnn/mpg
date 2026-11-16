// Push-Benachrichtigungen: Routen des Servers (Bauplan Push, 1.2) und die Mitteilungen der
// Organisation (hub_notifications, Owner 12.3).
//
// Jede Antwort ist typisiert: { ok: true, daten } oder { ok: false, fehler, text, … }. Fehlt die
// Route ganz (404 ohne `grund`: push.pb.js ist auf dem Server nicht eingespielt), heißt das
// „nicht eingerichtet“. Texte des Servers (`message`) zeigt die App unverändert; fehlen sie, nimmt
// sie ihre eigenen (texte.ts).

import { pb } from '../pocketbase'
import { personEinstellungenLesen, type AnlassKey, type GruppeKey, type PersonEinstellungen } from './regeln'
import { PUSH_TEXTE as T, drosselText } from './texte'

export type PushGrund = 'nicht_angemeldet' | 'nicht_berechtigt' | 'nicht_eingerichtet' | 'dienst_fehlt' | 'daten' | 'drossel'
  | 'nicht_gefunden' | 'abgemeldet' | 'schluessel_neu' | 'server' | 'netz'

export interface PushFehler {
  ok: false
  fehler: PushGrund
  status: number
  text: string
  feld?: string
  sekunden?: number
  fehlt?: string[]
  /** bei schluessel_neu: der aktuelle öffentliche Schlüssel */
  schluessel?: string
}
export type PushErgebnis<D> = { ok: true; daten: D } | PushFehler

/** Fehler? (Typwächter: das Projekt prüft ohne strict, Wahrheitswerte allein unterscheiden dort nicht.) */
export function istFehler<D>(r: PushErgebnis<D>): r is PushFehler {
  return r.ok === false
}
/** Daten einer erfolgreichen Antwort, sonst null. */
export function datenVon<D>(r: PushErgebnis<D>): D | null {
  return r.ok === true ? (r as { ok: true; daten: D }).daten : null
}

export interface StandGeraet { id: string; kennung: string; geraet: string; angemeldet: string }
export interface StandAnlass {
  key: AnlassKey; gruppe: GruppeKey; titel: string; beschreibung: string
  art: 'sofort' | 'morgens' | 'woche'; pflicht: boolean; org_an: boolean; person_an: boolean
}
export interface PushStand {
  v: 1
  eingerichtet: boolean
  fehlt: string[]
  /** nur Anzeige: Dienst zuletzt erreichbar */
  dienst: boolean
  /** öffentlicher VAPID-Schlüssel (base64url) */
  schluessel: string
  geraete: StandGeraet[]
  anlaesse: StandAnlass[]
  person: PersonEinstellungen
  ruhe_jetzt: boolean
  darf_organisation: boolean
}
export interface OrgAnlass {
  key: AnlassKey; gruppe: GruppeKey; titel: string; beschreibung: string
  art: 'sofort' | 'morgens' | 'woche'; pflicht: boolean; modul_frei: boolean
}
export interface OrgStand { aus: AnlassKey[]; anlaesse: OrgAnlass[] }
export interface Mitteilung { id: string; title: string; message: string; created: string; active: boolean; organization_id: string }

const GRUENDE: PushGrund[] = ['nicht_angemeldet', 'nicht_berechtigt', 'nicht_eingerichtet', 'dienst_fehlt', 'daten', 'drossel',
  'nicht_gefunden', 'abgemeldet', 'schluessel_neu', 'server']

const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown): string => (typeof x === 'string' ? x : '')

/** Eigener Text je Grund, wenn der Server keinen schickt. */
function grundText(g: PushGrund, sekunden?: number): string {
  const texte: Record<PushGrund, string> = {
    nicht_angemeldet: T.nicht_angemeldet, nicht_berechtigt: T.nicht_berechtigt, nicht_eingerichtet: T.nicht_eingerichtet,
    dienst_fehlt: T.dienst_fehlt, daten: T.daten, drossel: drosselText(sekunden ?? 60), nicht_gefunden: T.nicht_gefunden,
    abgemeldet: 'Dieses Gerät wurde in der Geräteliste abgemeldet.', schluessel_neu: T.neu_einschalten, server: T.server, netz: T.netz,
  }
  return texte[g]
}

/**
 * Fehlerantwort lesen (Status und Body). 404 ohne `grund` = Route fehlt (nicht eingerichtet);
 * Status 0 = keine Verbindung.
 */
export function fehlerLesen(status: number, body: unknown): PushFehler {
  const b = istObjekt(body) ? body : {}
  // PocketBase legt Zusatzangaben eines ApiError in `data`
  const zusatz = istObjekt(b.data) ? b.data : {}
  const roh = str(b.grund) || str(zusatz.grund)
  const sek = Number(b.sekunden ?? zusatz.sekunden)
  const sekunden = Number.isFinite(sek) && sek > 0 ? sek : undefined
  let fehler: PushGrund
  if (!status) fehler = 'netz'
  else if ((GRUENDE as string[]).includes(roh)) fehler = roh as PushGrund
  else if (status === 404) fehler = 'nicht_eingerichtet'
  else if (status === 401) fehler = 'nicht_angemeldet'
  else if (status === 403) fehler = 'nicht_berechtigt'
  else if (status === 429) fehler = 'drossel'
  else if (status === 400) fehler = 'daten'
  else fehler = 'server'
  const message = str(b.message)
  // Eigene Texte des Servers tragen einen Grund; PocketBase-Standardtexte (englisch) nicht
  const text = roh && message ? message : grundText(fehler, sekunden)
  const f: PushFehler = { ok: false, fehler, status: status || 0, text }
  if (str(b.feld) || str(zusatz.feld)) f.feld = str(b.feld) || str(zusatz.feld)
  if (sekunden !== undefined) f.sekunden = sekunden
  if (Array.isArray(b.fehlt)) f.fehlt = b.fehlt.filter((x): x is string => typeof x === 'string')
  if (str(b.schluessel)) f.schluessel = str(b.schluessel)
  return f
}

/** Fehler aus pb.send (ClientResponseError) oder fetch. */
export function ausnahmeLesen(e: unknown): PushFehler {
  const x = (istObjekt(e) ? e : {}) as Record<string, unknown>
  if (x.isAbort === true) return fehlerLesen(0, null)
  const status = Number(x.status) || 0
  return fehlerLesen(status, x.response ?? x.data ?? null)
}

async function senden<D>(pfad: string, methode: 'GET' | 'POST', body: unknown, lesen: (b: unknown) => D | null, signal?: AbortSignal): Promise<PushErgebnis<D>> {
  try {
    const opt: Record<string, unknown> = { method: methode, requestKey: null }
    if (body !== undefined) {
      opt.body = JSON.stringify(body)
      opt.headers = { 'Content-Type': 'application/json' }
    }
    if (signal) opt.signal = signal
    const roh: unknown = await pb.send(pfad, opt)
    const daten = lesen(roh)
    if (daten === null) return { ok: false, fehler: 'server', status: 200, text: T.server }
    return { ok: true, daten }
  } catch (e) {
    return ausnahmeLesen(e)
  }
}

const ANLASS_ARTEN = ['sofort', 'morgens', 'woche']

function standGeraetLesen(x: unknown): StandGeraet | null {
  if (!istObjekt(x) || !str(x.id)) return null
  return { id: str(x.id), kennung: str(x.kennung), geraet: str(x.geraet) || 'Gerät', angemeldet: str(x.angemeldet) }
}

function anlassLesen<A extends { key: AnlassKey }>(x: unknown, zusatz: (o: Record<string, unknown>) => Omit<A, 'key' | 'gruppe' | 'titel' | 'beschreibung' | 'art' | 'pflicht'>): A | null {
  if (!istObjekt(x) || !str(x.key)) return null
  return {
    key: str(x.key) as AnlassKey,
    gruppe: str(x.gruppe) as GruppeKey,
    titel: str(x.titel) || str(x.key),
    beschreibung: str(x.beschreibung),
    art: (ANLASS_ARTEN.includes(str(x.art)) ? str(x.art) : 'sofort') as 'sofort' | 'morgens' | 'woche',
    pflicht: x.pflicht === true,
    ...zusatz(x),
  } as unknown as A
}

/** Antwort von /stand lesen; unlesbar → null. */
export function standLesen(b: unknown): PushStand | null {
  if (!istObjekt(b)) return null
  return {
    v: 1,
    eingerichtet: b.eingerichtet === true,
    fehlt: Array.isArray(b.fehlt) ? b.fehlt.filter((x): x is string => typeof x === 'string') : [],
    dienst: b.dienst === true,
    schluessel: str(b.schluessel),
    geraete: Array.isArray(b.geraete) ? b.geraete.map(standGeraetLesen).filter((g): g is StandGeraet => !!g) : [],
    anlaesse: Array.isArray(b.anlaesse)
      ? b.anlaesse.map((a) => anlassLesen<StandAnlass>(a, (o) => ({ org_an: o.org_an !== false, person_an: o.person_an !== false }))).filter((a): a is StandAnlass => !!a)
      : [],
    person: personEinstellungenLesen(b.person),
    ruhe_jetzt: b.ruhe_jetzt === true,
    darf_organisation: b.darf_organisation === true,
  }
}

function orgLesen(b: unknown): OrgStand | null {
  if (!istObjekt(b) || !Array.isArray(b.aus)) return null
  return {
    aus: b.aus.filter((x): x is AnlassKey => typeof x === 'string'),
    anlaesse: Array.isArray(b.anlaesse)
      ? b.anlaesse.map((a) => anlassLesen<OrgAnlass>(a, (o) => ({ modul_frei: o.modul_frei !== false }))).filter((a): a is OrgAnlass => !!a)
      : [],
  }
}

export function pushStand(): Promise<PushErgebnis<PushStand>> {
  return senden('/api/responda/push/stand', 'GET', undefined, standLesen)
}

/** Gerät beim Server anmelden (Abo aus abo.toJSON()). */
export function geraetAnmelden(abo: PushSubscriptionJSON, geraet: string, o: { ausdruecklich: boolean; schluessel: string }, signal?: AbortSignal): Promise<PushErgebnis<{ id: string; kennung: string }>> {
  return senden('/api/responda/push/geraet', 'POST', {
    endpoint: abo.endpoint, keys: { p256dh: abo.keys?.p256dh ?? '', auth: abo.keys?.auth ?? '' },
    geraet, ausdruecklich: o.ausdruecklich === true, schluessel: o.schluessel,
  }, (b) => (istObjekt(b) && b.ok === true ? { id: str(b.id), kennung: str(b.kennung) } : null), signal)
}

/** Dieses Gerät ({ endpoint }) oder ein anderes aus der Liste ({ id }, mit Grabstein) abmelden. */
export function geraetAbmelden(was: { endpoint: string } | { id: string }, signal?: AbortSignal): Promise<PushErgebnis<{ geloescht: number }>> {
  return senden('/api/responda/push/geraet/abmelden', 'POST', was, (b) => (istObjekt(b) && b.ok === true ? { geloescht: Number(b.geloescht) || 0 } : null), signal)
}

/** Einstellungen der Person, auch teilweise (fehlende Teile bleiben). */
export function einstellungenSpeichern(teil: Partial<PersonEinstellungen> | { ruhe: Partial<PersonEinstellungen['ruhe']> }): Promise<PushErgebnis<PersonEinstellungen>> {
  return senden('/api/responda/push/einstellungen', 'POST', teil, (b) => (istObjekt(b) && istObjekt(b.person) ? personEinstellungenLesen(b.person) : null))
}

export function organisationLaden(): Promise<PushErgebnis<OrgStand>> {
  return senden('/api/responda/push/organisation', 'GET', undefined, orgLesen)
}

export function organisationSpeichern(aus: AnlassKey[]): Promise<PushErgebnis<AnlassKey[]>> {
  return senden('/api/responda/push/organisation', 'POST', { aus }, (b) => (istObjekt(b) && Array.isArray(b.aus) ? b.aus.filter((x): x is AnlassKey => typeof x === 'string') : null))
}

export function probeSenden(): Promise<PushErgebnis<{ geraete: number; angenommen: number }>> {
  return senden('/api/responda/push/probe', 'POST', {}, (b) => (istObjekt(b) && b.ok === true ? { geraete: Number(b.geraete) || 0, angenommen: Number(b.angenommen) || 0 } : null))
}

// ── Mitteilungen der Organisation (hub_notifications, Owner 12.3) ─────────

/** Fehler beim Anlegen oder Zurückziehen einer Mitteilung als klarer Text (429, 403, 400). */
export function mitteilungFehlerText(e: unknown): string {
  const x = (istObjekt(e) ? e : {}) as Record<string, unknown>
  const status = Number(x.status) || 0
  const body = istObjekt(x.response) ? x.response : istObjekt(x.data) ? x.data : {}
  const message = str(body.message)
  // Die Texte des Hooks (push.pb.js) sind deutsch und genau; PocketBase-Standardtexte sind englisch
  const deutsch = /[äöüÄÖÜß]|Bitte|Mitteilung|Organisation|Titel|Text/.test(message)
  if (!status) return T.netz
  if (status === 429) return deutsch ? message : T.mitteilungDrossel
  if (status === 403) return deutsch ? message : T.mitteilungVerboten
  if (status === 400) {
    if (deutsch) return message
    const daten = istObjekt(body.data) ? body.data : {}
    if (istObjekt(daten.title)) return T.mitteilungTitelLang
    if (istObjekt(daten.message)) return T.mitteilungTextLang
    return T.daten
  }
  if (status === 401) return T.nicht_angemeldet
  return T.mitteilungFehler
}

function mitteilungLesen(x: unknown): Mitteilung | null {
  if (!istObjekt(x) || !str(x.id)) return null
  return { id: str(x.id), title: str(x.title), message: str(x.message), created: str(x.created), active: x.active === true, organization_id: str(x.organization_id) }
}

/** Aktive Mitteilungen der eigenen Organisation, neueste zuerst. */
export async function mitteilungenLaden(orgId: string): Promise<{ liste: Mitteilung[] | null; text: string }> {
  try {
    const l = await pb.collection('hub_notifications').getFullList({
      filter: pb.filter('organization_id = {:o} && active = true', { o: orgId }),
      sort: '-created',
      requestKey: null,
    })
    return { liste: l.map(mitteilungLesen).filter((m): m is Mitteilung => !!m), text: '' }
  } catch {
    return { liste: null, text: T.mitteilungListeFehler }
  }
}

/** Neue Mitteilung an die eigene Organisation (created_by setzt der Server). */
export async function mitteilungSenden(orgId: string, titel: string, text: string): Promise<{ ok: boolean; text: string }> {
  try {
    await pb.collection('hub_notifications').create({ organization_id: orgId, title: titel, message: text, type: 'info', active: true }, { requestKey: null })
    return { ok: true, text: '' }
  } catch (e) {
    return { ok: false, text: mitteilungFehlerText(e) }
  }
}

/** Mitteilung zurückziehen: nicht mehr aktiv (verschwindet aus dem Hub, wartende Push entfallen). */
export async function mitteilungZurueckziehen(id: string): Promise<{ ok: boolean; text: string }> {
  try {
    await pb.collection('hub_notifications').update(id, { active: false }, { requestKey: null })
    return { ok: true, text: '' }
  } catch (e) {
    return { ok: false, text: mitteilungFehlerText(e) }
  }
}
