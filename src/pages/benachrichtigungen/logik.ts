// Seite „Benachrichtigungen“: reine Hilfen (Zustand des Geräts, Gruppen, Schalter, Ruhezeit,
// Mitteilung an die Organisation). Prüffälle in logik.test.ts.

import { GRUPPEN, berlinTeile, inRuhe, ruheEnde, zeitText, type AnlassKey, type GruppeKey, type Ruhe, ANLAESSE } from '../../lib/push/regeln'
import type { OrgAnlass, StandAnlass } from '../../lib/push/api'
import type { PushMerker, Unterstuetzung } from '../../lib/push/geraet'
import { PUSH_TEXTE as T } from '../../lib/push/texte'

export type GeraetZustand = 'laedt' | 'nicht_eingerichtet' | Exclude<Unterstuetzung, 'ok'> | 'abgelehnt' | 'abgemeldet' | 'neu_einschalten' | 'an' | 'aus'

/**
 * Zustand von „Push auf diesem Gerät“. An heißt: Das Gerät hat ein Abo, und der Server kennt es
 * (seine Kennung steht in der Geräteliste). Erst der Server, dann was das Gerät kann, dann die
 * Erlaubnis, dann die Hinweise des Abgleichs.
 */
export function geraetZustand(l: {
  eingerichtet: boolean | null
  unterstuetzung: Unterstuetzung
  erlaubnis: string
  aboKennung: string | null
  kennungen: string[]
  merker: PushMerker | null
  personId: string
}): GeraetZustand {
  if (l.eingerichtet === null) return 'laedt'
  if (!l.eingerichtet) return 'nicht_eingerichtet'
  if (l.unterstuetzung !== 'ok') return l.unterstuetzung
  if (l.erlaubnis === 'denied') return 'abgelehnt'
  if (l.aboKennung && l.kennungen.includes(l.aboKennung)) return 'an'
  if (l.merker?.neu_einschalten && l.merker.person === l.personId) return 'neu_einschalten'
  if (l.merker?.abgemeldet) return 'abgemeldet'
  return 'aus'
}

/** Erklärung zum Zustand, wo statt des Schalters ein Hinweis steht; sonst null. */
export function zustandText(z: GeraetZustand): string | null {
  switch (z) {
    case 'nicht_eingerichtet': return T.nicht_eingerichtet
    case 'unsicher': return T.unsicher
    case 'capacitor': return T.capacitor
    case 'ios_homebildschirm': return T.ios_homebildschirm
    case 'ios_alt': return T.ios_alt
    case 'browser': return T.browser
    case 'abgelehnt': return T.abgelehnt
    default: return null
  }
}

/** Überschrift des Hinweises zum Zustand. */
export function zustandTitel(z: GeraetZustand): string {
  switch (z) {
    case 'nicht_eingerichtet': return 'Noch nicht eingerichtet'
    case 'unsicher': return 'Keine sichere Verbindung'
    case 'capacitor': return 'In dieser App-Fassung nicht möglich'
    case 'ios_homebildschirm': return 'Nur in der App vom Homebildschirm'
    case 'ios_alt': return 'iOS zu alt'
    case 'browser': return 'In diesem Browser nicht möglich'
    case 'abgelehnt': return 'Benachrichtigungen abgelehnt'
    case 'neu_einschalten': return 'Neu einschalten'
    case 'abgemeldet': return 'Abgemeldet'
    case 'an': return 'An'
    case 'aus': return 'Aus'
    default: return ''
  }
}

/** Zustände, in denen statt des Schalters nur ein Hinweis steht. */
export function nurHinweis(z: GeraetZustand): boolean {
  return zustandText(z) !== null
}

export interface Gruppe<A> { key: GruppeKey; titel: string; anlaesse: A[] }

/** Anlässe nach Gruppen, in der Reihenfolge von GRUPPEN; leere Gruppen fallen weg. */
export function gruppieren<A extends { gruppe: GruppeKey }>(anlaesse: A[]): Gruppe<A>[] {
  return GRUPPEN.map((g) => ({ key: g.key, titel: g.titel, anlaesse: anlaesse.filter((a) => a.gruppe === g.key) }))
    .filter((g) => g.anlaesse.length > 0)
}

export interface SchalterStand { an: boolean; gesperrt: boolean; unter: string }

function artZusatz(art: string): string {
  if (art === 'woche') return T.wocheUnter
  if (art === 'morgens') return T.morgensUnter
  return ''
}

function saetze(...teile: string[]): string {
  return teile.filter(Boolean).map((t) => (/[.!?]$/.test(t) ? t : t + '.')).join(' ')
}

/** Schalter eines Anlasses für die Person: Pflicht an und gesperrt; von der Organisation aus: aus und gesperrt. */
export function anlassSchalter(a: StandAnlass): SchalterStand {
  if (a.pflicht) return { an: true, gesperrt: true, unter: saetze(a.beschreibung, T.pflichtUnter) }
  if (!a.org_an) return { an: false, gesperrt: true, unter: T.orgAusUnter }
  return { an: a.person_an, gesperrt: false, unter: saetze(a.beschreibung, artZusatz(a.art)) }
}

/** Schalter eines Anlasses für die Organisation: Pflicht an und gesperrt; Modul nicht frei: gesperrt. */
export function orgAnlassSchalter(a: OrgAnlass, aus: AnlassKey[]): SchalterStand {
  if (a.pflicht) return { an: true, gesperrt: true, unter: saetze(a.beschreibung, T.pflichtUnter) }
  if (!a.modul_frei) return { an: false, gesperrt: true, unter: T.modulGesperrt }
  return { an: !aus.includes(a.key), gesperrt: false, unter: saetze(a.beschreibung, artZusatz(a.art)) }
}

/** Liste der abgeschalteten Anlässe nach einem Schalter: ohne Doppelte, nie Pflicht, Katalog-Reihenfolge. */
export function ausUmschalten(aus: AnlassKey[], key: AnlassKey, an: boolean): AnlassKey[] {
  const neu = new Set(aus)
  if (an) neu.delete(key)
  else neu.add(key)
  return ANLAESSE.filter((a) => !a.pflicht && neu.has(a.key)).map((a) => a.key)
}

/** „Gerade Ruhezeit bis 06:00“, außerhalb der Ruhezeit null (Zwilling: inRuhe, ruheEnde). */
export function ruheJetztText(r: Ruhe, jetztMs: number): string | null {
  if (!inRuhe(r, jetztMs)) return null
  const ende = ruheEnde(r, jetztMs)
  if (ende === null) return null
  return 'Gerade Ruhezeit bis ' + zeitText(berlinTeile(ende).minutenImTag)
}

/** Zeitpunkt aus PocketBase („2026-11-15 10:00:00.000Z“) als „15.11.2026“ (deutsche Zeit); unlesbar → "". */
export function datumText(pbZeit: string): string {
  const ms = new Date(String(pbZeit || '').replace(' ', 'T')).getTime()
  if (!Number.isFinite(ms)) return ''
  const t = berlinTeile(ms)
  return String(t.tagImMonat).padStart(2, '0') + '.' + String(t.monat).padStart(2, '0') + '.' + t.jahr
}

/** „15.11.2026, 14:20“ (deutsche Zeit); unlesbar → "". */
export function zeitpunktText(pbZeit: string): string {
  const ms = new Date(String(pbZeit || '').replace(' ', 'T')).getTime()
  if (!Number.isFinite(ms)) return ''
  return datumText(pbZeit) + ', ' + zeitText(berlinTeile(ms).minutenImTag)
}

// ── Mitteilung an die Organisation (Owner 12.3) ───────────────────────────

/** Wie in pb_hooks/push-regeln.js (kein \s, ausdrückliche Zeichenklassen). */
const LEERRAUM = /[ \t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g
const LEERRAUM_OHNE_ZEILE = /[ \t\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g
const STEUER = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g
const HTML_RE = /<[A-Za-z!\/?]|&#?[A-Za-z0-9]{1,10};/

export const MITTEILUNG_TITEL_MAX = 120
export const MITTEILUNG_TEXT_MAX = 1000

/** Zeichen wie PocketBase (ein Emoji ist ein Zeichen, nicht zwei UTF-16-Einheiten). */
export function zeichenZahl(s: string): number {
  let n = 0
  const t = String(s)
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < t.length) {
      const d = t.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) i++
    }
    n++
  }
  return n
}

/** Dieselbe Prüfung wie der Server (mitteilungPruefen in push-regeln.js), vor dem Senden. */
export function mitteilungPruefen(titel: string, text: string): { ok: boolean; feld?: 'title' | 'message'; text: string } {
  const t = String(titel ?? '')
  const m = String(text ?? '')
  if (!t.replace(LEERRAUM, '')) return { ok: false, feld: 'title', text: T.mitteilungTitelLeer }
  if (zeichenZahl(t) > MITTEILUNG_TITEL_MAX) return { ok: false, feld: 'title', text: T.mitteilungTitelLang }
  if (zeichenZahl(m) > MITTEILUNG_TEXT_MAX) return { ok: false, feld: 'message', text: T.mitteilungTextLang }
  if (HTML_RE.test(t)) return { ok: false, feld: 'title', text: T.mitteilungHtml }
  if (HTML_RE.test(m)) return { ok: false, feld: 'message', text: T.mitteilungHtml }
  return { ok: true, text: '' }
}

function ersatzpaareHeilen(s: string): string {
  let aus = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0
      if (d >= 0xdc00 && d <= 0xdfff) { aus += s.charAt(i) + s.charAt(i + 1); i++ } else aus += '�'
    } else if (c >= 0xdc00 && c <= 0xdfff) aus += '�'
    else aus += s.charAt(i)
  }
  return aus
}

/** Wie kuerzen in push-regeln.js: Leerraum zusammenziehen, nie ein Ersatzpaar trennen, „…“ am Ende. */
export function kuerzen(text: unknown, max: number, o?: { zeilen?: number }): string {
  const zeilen = o && Number(o.zeilen) > 1 ? Math.floor(Number(o.zeilen)) : 1
  let s = ersatzpaareHeilen(String(text === undefined || text === null ? '' : text)).replace(STEUER, '')
  if (zeilen > 1) {
    s = s.replace(/\r\n?/g, '\n').split('\n').map((z) => z.replace(LEERRAUM_OHNE_ZEILE, ' ').replace(/^ +| +$/g, '')).filter((z) => z !== '').slice(0, zeilen).join('\n')
  } else {
    s = s.replace(LEERRAUM, ' ').replace(/^ +| +$/g, '')
  }
  const g = Math.max(1, Math.floor(Number(max) || 1))
  if (s.length <= g) return s
  let n = g - 1
  const c = s.charCodeAt(n - 1)
  if (c >= 0xd800 && c <= 0xdbff) n--
  return s.slice(0, n).replace(/[ \n]+$/, '') + '…'
}

/**
 * So erscheint die Mitteilung auf dem Sperrbildschirm (Zwilling von textMitteilung in
 * push-regeln.js): Titel „Organisation: Titel“ (Organisation gekürzt auf 30), höchstens 80 Zeichen;
 * Text höchstens 300 Zeichen in bis zu 5 Zeilen.
 */
export function vorschauMitteilung(o: { orgName: string; titel: string; text: string }): { titel: string; text: string } {
  const org = kuerzen(o.orgName, 30)
  const titel = kuerzen(o.titel, 80) || 'Mitteilung'
  return { titel: kuerzen(org ? org + ': ' + titel : titel, 80), text: kuerzen(o.text, 300, { zeilen: 5 }) }
}

/** Darf diese Person Mitteilungen an die eigene Organisation schicken (Owner 12.3)? Der Server prüft genauso. */
export function darfMitteilung(u: { role?: string; supervisor?: boolean; organization_id?: string; disabled?: boolean } | null | undefined): boolean {
  if (!u || u.disabled || !u.organization_id) return false
  return u.supervisor === true || u.role === 'admin'
}
