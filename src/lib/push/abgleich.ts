// Push-Benachrichtigungen: Einschalten, Ausschalten, Abmelden und der stille Abgleich beim Start
// (Bauplan Push, 6.2; Owner 12.4).
//
// - Einschalten nur auf Tippen; Notification.requestPermission() als Erstes, ohne await davor
//   (Safari verlangt die direkte Geste).
// - Abgleich (beim Start, bei jedem Wechsel der Anmeldung, beim Zurückkehren nach einer Stunde):
//   reine Entscheidung abgleichSchritt (Tabelle 6.2). Niemand angemeldet heißt nicht abgemeldet:
//   Push bleibt an, aber der Merker vermerkt, dass die Anmeldung auf dem Gerät vorbei ist; der
//   Service Worker zeigt dann nur „Es gibt Neues in Responda.“ (Owner 12.4). Meldet sich dieselbe
//   Person wieder an, meldet der Abgleich das Gerät gleich neu (ein neues Passwort meldet beim Server
//   alle Geräte der Person ab), und es kommen wieder Einzelheiten. Eine andere Person: lokal abmelden.
// - Abmelden (useAuth.logout): Gerät beim Server abmelden (höchstens timeoutMs), dann immer Abo
//   beenden, Merker löschen und angezeigte Benachrichtigungen schließen.
//
// Alle Teile mit Browser oder Server sind über `teile` austauschbar (Prüffälle in
// src/lib/__tests__/pushAbgleich.test.ts).

import { getTokenPayload } from 'pocketbase'
import { pb } from '../pocketbase'
import { zielMitSitzung } from '../anmeldung'
import { geraetAbmelden, geraetAnmelden, istFehler, type PushErgebnis } from './api'
import {
  aboSchluessel, abonnieren, abzeichenLoeschen, aktuellesAbo, benachrichtigungenSchliessen, erlaubnisLesen, geraetName,
  merkerLesen, merkerLoeschen, merkerSchreiben, mitZeit, umgebungLesen, istIos, type PushMerker,
} from './geraet'
import { PUSH_TEXTE as T } from './texte'

export type AbgleichSchritt = 'nichts' | 'abmelden_lokal' | 'neu_melden' | 'abmelden'

/** Nach so langer Zeit meldet sich das Gerät beim Öffnen neu (gemeldet_am, Höchstalter 2.1). */
export const NEU_MELDEN_NACH_MS = 24 * 3600 * 1000

/** Angemeldete Person auf diesem Gerät und bis wann die Anmeldung gilt (ms). */
export interface SitzungsPerson { id: string; ablauf: number | null }

/**
 * Entscheidung des stillen Abgleichs (Tabelle 6.2):
 * - kein Abo: nichts
 * - Abo, niemand angemeldet (Sitzung abgelaufen oder vom Server abgelehnt): nichts
 * - Abo, eine andere Person als im Merker (oder kein Merker): lokal abmelden
 * - dieselbe Person, Erlaubnis entzogen: beim Server abmelden
 * - dieselbe Person, erlaubt, und Endpoint anders, Meldung älter als 24 h, Abo geändert, eben neu
 *   angemeldet (`anmeldungNeu`) oder die Anmeldung auf dem Gerät war vorbei (Ablauf im Merker
 *   vergangen): neu melden. Nach einem neuen Passwort hat der Server die Geräte der Person
 *   abgemeldet (push.pb.js); so ist das Gerät gleich nach der nächsten Anmeldung wieder da.
 */
export function abgleichSchritt(l: { abo: { endpoint: string } | null; merker: PushMerker | null; person: string | null; erlaubnis: NotificationPermission | string; jetzt: number; anmeldungNeu?: boolean }): AbgleichSchritt {
  if (!l.abo) return 'nichts'
  if (!l.person) return 'nichts'
  const m = l.merker
  if (!m || !m.person || m.person !== l.person) return 'abmelden_lokal'
  if (l.erlaubnis === 'denied') return 'abmelden'
  if (l.erlaubnis !== 'granted') return 'nichts'
  const g = m.gemeldet
  const alt = typeof g !== 'number' || l.jetzt - g > NEU_MELDEN_NACH_MS || g - l.jetzt > 3600 * 1000
  if (m.endpoint !== l.abo.endpoint || alt || m.abo_geaendert === true || l.anmeldungNeu === true || sitzungWarVorbei(m, l.jetzt)) return 'neu_melden'
  return 'nichts'
}

/** Der Merker sagt, dass die Anmeldung auf dem Gerät vorbei war (Ablauf erreicht). */
export function sitzungWarVorbei(m: PushMerker | null, jetzt: number): boolean {
  return !!m && typeof m.ablauf === 'number' && m.ablauf <= jetzt
}

/**
 * Merker nach der Anmeldung auf dem Gerät nachführen (Owner 12.4); null = unverändert.
 * Gilt die Anmeldung der Person im Merker, steht dort ihr Ablauf; ist niemand (gültig) angemeldet,
 * gilt sie ab jetzt als abgelaufen. Hinweis-Merker ohne Abo bleiben, wie sie sind.
 */
export function merkerNachSitzung(m: PushMerker | null, person: SitzungsPerson | null, jetzt: number): PushMerker | null {
  if (!m || !m.endpoint || !m.person) return null
  if (person && person.id === m.person) {
    return m.ablauf === person.ablauf ? null : { ...m, ablauf: person.ablauf }
  }
  if (!person) {
    if (typeof m.ablauf === 'number' && m.ablauf <= jetzt) return null
    return { ...m, ablauf: jetzt }
  }
  return null
}

/** Ablauf aus Token (exp) und Zugang (expires_at), der frühere; unbekannt → null. */
export function sitzungsAblauf(token: string, expiresAt?: unknown): number | null {
  let ab: number | null = null
  try {
    const exp = Number(getTokenPayload(token)?.exp)
    if (Number.isFinite(exp) && exp > 0) ab = exp * 1000
  } catch { ab = null }
  if (typeof expiresAt === 'string' && expiresAt) {
    const z = new Date(expiresAt.replace(' ', 'T')).getTime()
    if (Number.isFinite(z) && (ab === null || z < ab)) ab = z
  }
  return ab
}

/** Die gültig angemeldete Person (wie zielMitSitzung, ohne Route), sonst null. */
export function sitzungsPerson(): SitzungsPerson | null {
  try {
    const konto = (pb.authStore.record ?? pb.authStore.model) as { id?: unknown; disabled?: boolean; expires_at?: string; permissions?: Record<string, unknown> } | null
    if (!konto || typeof konto.id !== 'string' || !konto.id) return null
    if (zielMitSitzung(pb.authStore.isValid, konto, Date.now()) === null) return null
    return { id: konto.id, ablauf: sitzungsAblauf(pb.authStore.token, konto.expires_at) }
  } catch {
    return null
  }
}

/** Die Erlaubnis anfragen, synchron aus der Geste (auch die alte Form mit Rückruf in Safari). */
function erlaubnisAnfragen(): Promise<NotificationPermission> {
  try {
    if (typeof Notification === 'undefined') return Promise.resolve('default')
    return new Promise<NotificationPermission>((ok) => {
      const r = Notification.requestPermission((p) => ok(p))
      if (r && typeof r.then === 'function') r.then(ok, () => ok('default'))
    })
  } catch {
    return Promise.resolve('default')
  }
}

export interface AbgleichTeile {
  aktuellesAbo: () => Promise<PushSubscription | null>
  abonnieren: (schluessel: string) => Promise<PushSubscription>
  aboSchluessel: (abo: PushSubscription) => string | null
  merkerLesen: () => Promise<PushMerker | null>
  merkerSchreiben: (m: PushMerker) => Promise<void>
  merkerLoeschen: () => Promise<void>
  benachrichtigungenSchliessen: () => Promise<void>
  geraetAnmelden: (abo: PushSubscriptionJSON, geraet: string, o: { ausdruecklich: boolean; schluessel: string }, signal?: AbortSignal) => Promise<PushErgebnis<{ id: string; kennung: string }>>
  geraetAbmelden: (was: { endpoint: string } | { id: string }, signal?: AbortSignal) => Promise<PushErgebnis<{ geloescht: number }>>
  erlaubnis: () => NotificationPermission | string
  erlaubnisAnfragen: () => Promise<NotificationPermission | string>
  person: () => SitzungsPerson | null
  geraetName: () => string
  api: () => string
  jetzt: () => number
}

function geraetNameHier(): string {
  const u = umgebungLesen()
  return geraetName(u.ua, u.standalone, istIos(u.ua, u.touchPunkte))
}

const STANDARD: AbgleichTeile = {
  aktuellesAbo, abonnieren, aboSchluessel, merkerLesen, merkerSchreiben, merkerLoeschen, benachrichtigungenSchliessen,
  geraetAnmelden, geraetAbmelden,
  erlaubnis: erlaubnisLesen,
  erlaubnisAnfragen,
  person: sitzungsPerson,
  geraetName: geraetNameHier,
  api: () => { try { return String(pb.baseURL || '') } catch { return '' } },
  jetzt: () => Date.now(),
}

function teileMit(t?: Partial<AbgleichTeile>): AbgleichTeile {
  return { ...STANDARD, ...(t || {}) }
}

async function aboEnde(abo: PushSubscription | null | undefined): Promise<void> {
  if (!abo) return
  try { await mitZeit(abo.unsubscribe(), 3000, false) } catch { /* weiter */ }
}

/**
 * Ein Durchgang des stillen Abgleichs; gibt den Schritt zurück. `anmeldungNeu`: in dieser Seite
 * war eben niemand gültig angemeldet, jetzt schon (Anmeldung, auch nach einem neuen Passwort).
 */
export async function abgleichLaufen(teile?: Partial<AbgleichTeile>, o?: { anmeldungNeu?: boolean }): Promise<AbgleichSchritt> {
  const t = teileMit(teile)
  const abo = await t.aktuellesAbo()
  const merker = await t.merkerLesen()
  const person = t.person()
  const jetzt = t.jetzt()
  const anmeldungNeu = o?.anmeldungNeu === true
  const schritt = abgleichSchritt({ abo, merker, person: person?.id ?? null, erlaubnis: t.erlaubnis(), jetzt, anmeldungNeu })

  if (schritt === 'nichts') {
    // Ohne Abo gibt es nichts zu merken (Hinweis-Merker ohne Endpoint bleiben für die Seite)
    if (!abo && merker?.endpoint) { await t.merkerLoeschen(); return schritt }
    // Hinweis „neu einschalten“ einer anderen Person gehört nicht auf dieses Konto
    if (!abo && merker?.neu_einschalten && person && merker.person !== person.id) { await t.merkerLoeschen(); return schritt }
    const neu = abo ? merkerNachSitzung(merker, person, jetzt) : null
    if (neu) await t.merkerSchreiben(neu)
    return schritt
  }

  if (schritt === 'abmelden_lokal') {
    // Das Abo gehört einer anderen Person (oder ist niemandem zuzuordnen): weg, samt angezeigter Benachrichtigungen
    await aboEnde(abo)
    await t.merkerLoeschen()
    await t.benachrichtigungenSchliessen()
    return schritt
  }

  if (schritt === 'abmelden') {
    // Erlaubnis entzogen: beim Server abmelden, wenn möglich; das Abo ist ohne Erlaubnis nutzlos
    if (abo) await mitZeit(t.geraetAbmelden({ endpoint: abo.endpoint }), 5000, null)
    await aboEnde(abo)
    await t.merkerLoeschen()
    return schritt
  }

  // neu_melden
  if (!abo || !person) return schritt
  const schluessel = t.aboSchluessel(abo) || merker?.schluessel || ''
  const r = await t.geraetAnmelden(abo.toJSON(), t.geraetName(), { ausdruecklich: false, schluessel })
  if (!istFehler(r)) {
    await t.merkerSchreiben({ person: person.id, api: t.api(), schluessel, endpoint: abo.endpoint, gemeldet: jetzt, ablauf: person.ablauf })
    return schritt
  }
  if (r.fehler === 'abgemeldet') {
    // In der Geräteliste abgemeldet (Grabstein): still nicht wieder anmelden; die Seite sagt es
    await aboEnde(abo)
    await t.merkerSchreiben({ abgemeldet: true })
    return schritt
  }
  if (r.fehler === 'schluessel_neu' && r.schluessel) {
    // Schlüssel gewechselt: still neu abonnieren, wo der Browser das ohne Geste erlaubt
    await aboEnde(abo)
    try {
      const neu = await t.abonnieren(r.schluessel)
      const r2 = await t.geraetAnmelden(neu.toJSON(), t.geraetName(), { ausdruecklich: false, schluessel: r.schluessel })
      if (!istFehler(r2)) {
        await t.merkerSchreiben({ person: person.id, api: t.api(), schluessel: r.schluessel, endpoint: neu.endpoint, gemeldet: jetzt, ablauf: person.ablauf })
        return schritt
      }
      await aboEnde(neu)
    } catch { /* ohne Geste verweigert (Safari) */ }
    await t.merkerSchreiben({ neu_einschalten: true, person: person.id, schluessel: r.schluessel })
    return schritt
  }
  // Netz, Server, nicht eingerichtet: beim nächsten Mal; den Ablauf der Anmeldung trotzdem nachführen.
  // Nach einer neuen Anmeldung gilt das Gerät als nicht gemeldet (ohne gemeldet): Der Server kann es
  // nach einem neuen Passwort abgemeldet haben, also meldet der nächste Abgleich erneut.
  const neu = merkerNachSitzung(merker, person, jetzt)
  if (merker && (anmeldungNeu || sitzungWarVorbei(merker, jetzt))) {
    const { gemeldet: _ungewiss, ...ohneGemeldet } = neu ?? merker
    await t.merkerSchreiben(ohneGemeldet)
  } else if (neu) await t.merkerSchreiben(neu)
  return schritt
}

/** ok, sonst zustand und Text (flach: das Projekt prüft ohne strict). */
export interface EinschaltenErgebnis { ok: boolean; zustand?: 'abgelehnt' | 'nicht_erlaubt' | 'fehler'; text: string }

/**
 * Push auf diesem Gerät einschalten (nur aus einem Tippen). Fragt als Erstes und ohne await davor
 * nach der Erlaubnis, abonniert mit dem Schlüssel aus /stand und meldet das Gerät ausdrücklich an
 * (überwindet einen Grabstein). Ist der Schlüssel inzwischen gewechselt, einmal mit dem neuen.
 */
export function pushEinschalten(user: { id: string }, stand: { schluessel: string }, teile?: Partial<AbgleichTeile>): Promise<EinschaltenErgebnis> {
  const t = teileMit(teile)
  // Safari verlangt die direkte Geste: dieser Aufruf muss vor jedem await stehen
  const erlaubnis = t.erlaubnisAnfragen()
  return einschaltenWeiter(erlaubnis, user, stand, t)
}

async function einschaltenWeiter(erlaubnisP: Promise<NotificationPermission | string>, user: { id: string }, stand: { schluessel: string }, t: AbgleichTeile): Promise<EinschaltenErgebnis> {
  let erlaubnis: string
  try { erlaubnis = await erlaubnisP } catch { erlaubnis = 'default' }
  if (erlaubnis === 'denied') return { ok: false, zustand: 'abgelehnt', text: T.abgelehnt }
  if (erlaubnis !== 'granted') return { ok: false, zustand: 'nicht_erlaubt', text: T.nicht_erlaubt }
  let schluessel = stand.schluessel
  for (let versuch = 0; versuch < 2; versuch++) {
    let abo: PushSubscription
    try { abo = await t.abonnieren(schluessel) } catch { return { ok: false, zustand: 'fehler', text: T.einschaltenFehler } }
    const r = await t.geraetAnmelden(abo.toJSON(), t.geraetName(), { ausdruecklich: true, schluessel })
    if (!istFehler(r)) {
      const p = t.person()
      await t.merkerSchreiben({ person: user.id, api: t.api(), schluessel, endpoint: abo.endpoint, gemeldet: t.jetzt(), ablauf: p && p.id === user.id ? p.ablauf : null })
      return { ok: true, text: '' }
    }
    await aboEnde(abo)
    if (r.fehler === 'schluessel_neu' && r.schluessel && r.schluessel !== schluessel && versuch === 0) { schluessel = r.schluessel; continue }
    return { ok: false, zustand: 'fehler', text: r.text || T.einschaltenFehler }
  }
  return { ok: false, zustand: 'fehler', text: T.einschaltenFehler }
}

/** Push auf diesem Gerät ausschalten; `server: false`, wenn der Server es (noch) nicht erfahren hat. */
export async function pushAusschalten(teile?: Partial<AbgleichTeile>): Promise<{ ok: true; server: boolean }> {
  const t = teileMit(teile)
  const abo = await t.aktuellesAbo()
  let server = true
  if (abo) {
    const r = await mitZeit(t.geraetAbmelden({ endpoint: abo.endpoint }), 8000, null)
    server = !!r && (!istFehler(r) || r.fehler === 'nicht_gefunden' || r.fehler === 'nicht_eingerichtet')
  }
  await aboEnde(abo)
  await t.merkerLoeschen()
  await t.benachrichtigungenSchliessen()
  return { ok: true, server }
}

/**
 * Beim ausdrücklichen Abmelden (useAuth.logout, vor pb.authStore.clear()): mit noch gültiger
 * Anmeldung das Gerät beim Server abmelden (höchstens timeoutMs, Fehler egal), dann immer das Abo
 * beenden, den Merker löschen und angezeigte Benachrichtigungen schließen: Im Mitteilungszentrum
 * sollen keine Einzelheiten der vorigen Person stehen bleiben.
 */
export async function pushBeimAbmelden(o: { timeoutMs: number }, teile?: Partial<AbgleichTeile>): Promise<void> {
  const t = teileMit(teile)
  let abo: PushSubscription | null = null
  try { abo = await t.aktuellesAbo() } catch { abo = null }
  if (abo && t.person()) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
    try { await mitZeit(t.geraetAbmelden({ endpoint: abo.endpoint }, ctl?.signal), o.timeoutMs, null) } catch { /* egal */ }
    try { ctl?.abort() } catch { /* schon fertig */ }
  }
  await aboEnde(abo)
  try { await t.merkerLoeschen() } catch { /* egal */ }
  try { await t.benachrichtigungenSchliessen() } catch { /* egal */ }
}

/** Hinweis für das Profil-Blatt: Push muss für diese Person neu eingeschaltet werden. */
export async function pushNeuEinschaltenNoetig(personId: string | undefined): Promise<{ schluessel: string } | null> {
  if (!personId) return null
  const m = await merkerLesen()
  return m?.neu_einschalten && m.person === personId && m.schluessel ? { schluessel: m.schluessel } : null
}

// ── Beim Start einrichten (main.tsx) ──────────────────────────────────────

let eingerichtet = false
/** Zuletzt gesehene gültige Anmeldung in dieser Seite: id, null = niemand, undefined = unbekannt. */
let zuletztPerson: string | null | undefined
let laeuft = false
let nochmal = false
let zuletzt = 0
let uhr: ReturnType<typeof setTimeout> | undefined

async function durchlauf(): Promise<void> {
  if (laeuft) { nochmal = true; return }
  laeuft = true
  try {
    do {
      nochmal = false
      zuletzt = Date.now()
      // Eben niemand, jetzt jemand gültig angemeldet: gleich neu melden (neues Passwort, 12.4)
      let anmeldungNeu = false
      try {
        const id = sitzungsPerson()?.id ?? null
        anmeldungNeu = zuletztPerson === null && id !== null
        zuletztPerson = id
      } catch { /* wie bisher */ }
      try { await abgleichLaufen(undefined, { anmeldungNeu }) } catch { /* nächstes Mal */ }
    } while (nochmal)
  } finally {
    laeuft = false
  }
}

function planen(ms = 400): void {
  if (uhr !== undefined) clearTimeout(uhr)
  uhr = setTimeout(() => { uhr = undefined; void durchlauf() }, ms)
}

/**
 * Abgleich beim Start und bei jedem Wechsel der Anmeldung; beim Zurückkehren in die App das
 * Abzeichen löschen (es zählt nur, was seit dem letzten Öffnen gekommen ist) und nach einer Stunde
 * erneut abgleichen.
 */
export function pushAbgleichEinrichten(): void {
  if (eingerichtet || typeof window === 'undefined') return
  eingerichtet = true
  try { zuletztPerson = sitzungsPerson()?.id ?? null } catch { zuletztPerson = undefined }
  void abzeichenLoeschen()
  const u = umgebungLesen()
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      void abzeichenLoeschen()
      if (u.serviceWorker && u.pushManager && Date.now() - zuletzt > 3600 * 1000) planen()
    })
  } catch { /* ohne */ }
  if (!u.serviceWorker || !u.pushManager) return
  planen(1500)
  try { pb.authStore.onChange(() => planen(), false) } catch { /* ohne */ }
}
