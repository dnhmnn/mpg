// Push-Benachrichtigungen: Katalog der Anlässe, Einstellungen und Ruhezeit (Zwilling).
//
// Der Server rechnet mit pb_hooks/push-regeln.js (CommonJS, in der JSVM von PocketBase). Diese
// Datei ist der Zwilling für die App: dieselben Namen, dieselben Ergebnisse. Die Prüffälle in
// src/lib/__tests__/pushGleichlauf.test.ts vergleichen beide auf je 2000 zufälligen Eingaben.
// Ändert sich hier etwas, dort genauso (und umgekehrt).
//
// Zeit immer nach deutscher Zeit (Europe/Berlin), von Hand gerechnet wie auf dem Server
// (dort fehlt Intl): Sommerzeit vom letzten Sonntag im März 01:00 UTC bis zum letzten Sonntag
// im Oktober 01:00 UTC.
//
// Vertrag: Bauplan Push, Abschnitte 3 und 4.2. Texte ohne Gedankenstriche.

export type AnlassKey = 'mitteilung' | 'unterschrift' | 'protokoll_neu' | 'mpg_gesperrt' | 'mpg_defekt' | 'mpg_bald'
  | 'lager_mindestbestand' | 'lager_abgelaufen' | 'lager_ablauf' | 'produktausgabe' | 'einsendung' | 'cirs_neu'
  | 'cirs_ueberfaellig' | 'ausbildung'

export type GruppeKey = 'organisation' | 'protokolle' | 'mpg' | 'lager' | 'vorgaenge' | 'ausbildung'

export interface Anlass {
  key: AnlassKey
  gruppe: GruppeKey
  titel: string
  beschreibung: string
  /** sofort beim Ereignis, morgens (Morgenlauf ab 06:00) oder im Wochenüberblick (Montag ab 07:00) */
  art: 'sofort' | 'morgens' | 'woche'
  /** Pflicht: kommt immer, solange Push an ist (nur die Mitteilung der Organisation) */
  pflicht: boolean
  /** Modul, das frei sein muss (src/lib/freigabe.ts); null: keins bzw. je Formular */
  modul: string | null
}

/** Reihenfolge = Anzeige. Zwilling: ANLAESSE in pb_hooks/push-regeln.js. */
export const ANLAESSE: readonly Anlass[] = [
  { key: 'mitteilung', gruppe: 'organisation', titel: 'Mitteilung der Organisation', beschreibung: 'Was die Leitung oder der Supervisor an alle in der Organisation schickt.', art: 'sofort', pflicht: true, modul: null },
  { key: 'unterschrift', gruppe: 'protokolle', titel: 'Wartet auf deine Unterschrift', beschreibung: 'Ein Protokoll, eine Produktausgabe, eine Einsendung oder eine Defektmeldung mit deinem Namen braucht deine Bestätigung.', art: 'sofort', pflicht: false, modul: null },
  { key: 'protokoll_neu', gruppe: 'protokolle', titel: 'Neues Patientenprotokoll', beschreibung: 'Ein Patientenprotokoll ist eingegangen. Die Nachricht nennt keinen Namen und keinen Inhalt.', art: 'sofort', pflicht: false, modul: 'patienten' },
  { key: 'mpg_gesperrt', gruppe: 'mpg', titel: 'Gerät gesperrt', beschreibung: 'Ein Medizinprodukt wurde gesperrt, auch wenn seine STK oder MTK überfällig ist.', art: 'sofort', pflicht: false, modul: 'mpg' },
  { key: 'mpg_defekt', gruppe: 'mpg', titel: 'Defekt oder Meldung von außen', beschreibung: 'Ein Mangel wurde eingetragen oder eine Defektmeldung von außen ist eingegangen.', art: 'sofort', pflicht: false, modul: 'mpg' },
  { key: 'mpg_bald', gruppe: 'mpg', titel: 'Prüfungen bald fällig', beschreibung: 'Wie viele Prüfungen, STK und MTK bald fällig oder überfällig sind.', art: 'woche', pflicht: false, modul: 'mpg' },
  { key: 'lager_mindestbestand', gruppe: 'lager', titel: 'Unter Mindestbestand', beschreibung: 'Ein Artikel liegt an einem Standort unter dem Soll.', art: 'sofort', pflicht: false, modul: 'lager' },
  { key: 'lager_abgelaufen', gruppe: 'lager', titel: 'Abgelaufen', beschreibung: 'Artikel mit abgelaufenem Haltbarkeitsdatum, morgens gesammelt.', art: 'morgens', pflicht: false, modul: 'lager' },
  { key: 'lager_ablauf', gruppe: 'lager', titel: 'Läuft bald ab', beschreibung: 'Wie viele Artikel in den nächsten 30 Tagen ablaufen.', art: 'woche', pflicht: false, modul: 'lager' },
  { key: 'produktausgabe', gruppe: 'lager', titel: 'Offene Produktausgabe', beschreibung: 'Eine Produktausgabe ist eingegangen und wartet auf Bearbeitung.', art: 'sofort', pflicht: false, modul: 'lager' },
  { key: 'einsendung', gruppe: 'vorgaenge', titel: 'Neue Einsendung', beschreibung: 'Ein Formular der Organisation wurde eingesendet.', art: 'sofort', pflicht: false, modul: 'dokumente' },
  { key: 'cirs_neu', gruppe: 'vorgaenge', titel: 'Neue CIRS-Meldung', beschreibung: 'Eine CIRS-Meldung ist eingegangen. Die Nachricht nennt nicht ihren Text.', art: 'sofort', pflicht: false, modul: 'dokumente' },
  { key: 'cirs_ueberfaellig', gruppe: 'vorgaenge', titel: 'CIRS überfällig', beschreibung: 'Wie viele CIRS-Vorgänge ihre Frist überschritten haben.', art: 'woche', pflicht: false, modul: 'dokumente' },
  { key: 'ausbildung', gruppe: 'ausbildung', titel: 'Zu- und Absagen', beschreibung: 'Jemand sagt zu einem Ausbildungstermin zu oder ab.', art: 'sofort', pflicht: false, modul: 'ausbildungen' },
]

export const GRUPPEN: readonly { key: GruppeKey; titel: string }[] = [
  { key: 'organisation', titel: 'Organisation' },
  { key: 'protokolle', titel: 'Protokolle' },
  { key: 'mpg', titel: 'MPG' },
  { key: 'lager', titel: 'Lager' },
  { key: 'vorgaenge', titel: 'Vorgänge und CIRS' },
  { key: 'ausbildung', titel: 'Ausbildung' },
]

export interface Ruhe { an: boolean; von: string; bis: string }
export interface PersonEinstellungen { v: 1; aus: AnlassKey[]; ruhe: Ruhe; mitteilung_in_ruhe: boolean }
export interface OrgEinstellungen { v: 1; aus: AnlassKey[] }

export const RUHE_VORGABE: Ruhe = { an: true, von: '22:00', bis: '06:00' }

// ── Einstellungen ───────────────────────────────────────────────────────────

function istObjekt(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

/** Objekt aus einem Wert, auch aus Text oder doppelt kodiertem Text; Kaputtes → {} (wie formConfigLesen). */
function objektLesen(roh: unknown): Record<string, unknown> {
  let x = roh
  for (let i = 0; i < 2 && typeof x === 'string'; i++) {
    try { x = JSON.parse(x) } catch { return {} }
  }
  return istObjekt(x) ? x : {}
}

/** Abgeschaltete Anlässe: nur bekannte, nie Pflicht, ohne Doppelte, in Katalog-Reihenfolge. */
function ausLesen(roh: unknown): AnlassKey[] {
  if (!Array.isArray(roh)) return []
  const drin: Record<string, true> = {}
  for (const k of roh) if (typeof k === 'string') drin[k] = true
  return ANLAESSE.filter((a) => !a.pflicht && drin[a.key] === true).map((a) => a.key)
}

function ruheZeit(wert: unknown, sonst: string): string {
  const m = zeitLesen(wert)
  return m === null ? sonst : zeitText(m)
}

function ruheLesen(roh: unknown): Ruhe {
  if (!istObjekt(roh)) return { an: RUHE_VORGABE.an, von: RUHE_VORGABE.von, bis: RUHE_VORGABE.bis }
  return {
    an: roh.an === true ? true : roh.an === false ? false : RUHE_VORGABE.an,
    von: ruheZeit(roh.von, RUHE_VORGABE.von),
    bis: ruheZeit(roh.bis, RUHE_VORGABE.bis),
  }
}

/** Einstellungen einer Person; fehlt etwas oder ist es unlesbar, gilt die Voreinstellung. */
export function personEinstellungenLesen(roh: unknown): PersonEinstellungen {
  const x = objektLesen(roh)
  return { v: 1, aus: ausLesen(x.aus), ruhe: ruheLesen(x.ruhe), mitteilung_in_ruhe: x.mitteilung_in_ruhe !== false }
}

/** Teilweise Änderung (Route einstellungen): Was in `teil` fehlt oder unlesbar ist, bleibt wie in `alt`. */
export function personEinstellungenMischen(alt: PersonEinstellungen, teil: unknown): PersonEinstellungen {
  const a = personEinstellungenLesen(alt)
  const t = objektLesen(teil)
  let ruhe = a.ruhe
  if (istObjekt(t.ruhe)) {
    const r = t.ruhe
    ruhe = {
      an: r.an === true ? true : r.an === false ? false : a.ruhe.an,
      von: r.von === undefined ? a.ruhe.von : ruheZeit(r.von, a.ruhe.von),
      bis: r.bis === undefined ? a.ruhe.bis : ruheZeit(r.bis, a.ruhe.bis),
    }
  }
  return {
    v: 1,
    aus: t.aus === undefined ? a.aus : ausLesen(t.aus),
    ruhe,
    mitteilung_in_ruhe: t.mitteilung_in_ruhe === false ? false : t.mitteilung_in_ruhe === true ? true : a.mitteilung_in_ruhe,
  }
}

/** Einstellungen der Organisation (abgeschaltete Anlässe). */
export function orgEinstellungenLesen(roh: unknown): OrgEinstellungen {
  return { v: 1, aus: ausLesen(objektLesen(roh).aus) }
}

/** Ist der Anlass für diese Person an? Pflicht immer; sonst weder die Organisation noch die Person hat ihn abgeschaltet. */
export function anlassAn(org: OrgEinstellungen, person: PersonEinstellungen, key: AnlassKey): boolean {
  const a = ANLAESSE.find((x) => x.key === key)
  if (!a) return false
  if (a.pflicht) return true
  const orgAus = org && Array.isArray(org.aus) ? org.aus : []
  const personAus = person && Array.isArray(person.aus) ? person.aus : []
  return orgAus.indexOf(key) < 0 && personAus.indexOf(key) < 0
}

// ── Zeit (Europe/Berlin von Hand) ───────────────────────────────────────────

/** "H:MM" oder "HH:MM", 0:00 bis 23:59 → Minuten seit Mitternacht; sonst null. */
export function zeitLesen(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function zwei(n: number): string {
  return (n < 10 ? '0' : '') + n
}

/** Minuten seit Mitternacht → "HH:MM" (außerhalb eines Tages auf den Tag gefaltet). */
export function zeitText(min: number): string {
  const n = Math.floor(Number(min) || 0)
  const t = ((n % 1440) + 1440) % 1440
  return zwei(Math.floor(t / 60)) + ':' + zwei(t % 60)
}

/** Letzter Sonntag eines Monats (0 = Januar) um 01:00 UTC. */
function letzterSonntag(jahr: number, monat: number): number {
  const ende = new Date(Date.UTC(jahr, monat + 1, 0))
  return Date.UTC(jahr, monat, ende.getUTCDate() - ende.getUTCDay(), 1)
}

function berlinOffsetMinuten(ms: number): number {
  const jahr = new Date(ms).getUTCFullYear()
  return ms >= letzterSonntag(jahr, 2) && ms < letzterSonntag(jahr, 9) ? 120 : 60
}

/** Kalenderteile eines Zeitpunkts nach deutscher Zeit; wochentag 1 = Montag bis 7 = Sonntag. */
export function berlinTeile(ms: number): { tag: string; jahr: number; monat: number; tagImMonat: number; stunde: number; minute: number; wochentag: number; minutenImTag: number } {
  const d = new Date(ms + berlinOffsetMinuten(ms) * 60000)
  const jahr = d.getUTCFullYear()
  const monat = d.getUTCMonth() + 1
  const tagImMonat = d.getUTCDate()
  const stunde = d.getUTCHours()
  const minute = d.getUTCMinutes()
  const wt = d.getUTCDay()
  return {
    tag: jahr + '-' + zwei(monat) + '-' + zwei(tagImMonat),
    jahr, monat, tagImMonat, stunde, minute,
    wochentag: wt === 0 ? 7 : wt,
    minutenImTag: stunde * 60 + minute,
  }
}

/**
 * Zeitpunkt (UTC-Millisekunden) zu einer deutschen Uhrzeit an einem Kalendertag "JJJJ-MM-TT".
 * Gibt es die Uhrzeit nicht (Frühjahr, 02:00 bis 02:59), gilt die nächste gültige (03:00);
 * gibt es sie zweimal (Herbst), die erste. Unlesbarer Tag → NaN.
 */
export function berlinZuUtc(tag: string, minuten: number): number {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(tag))
  if (!m) return NaN
  const wand = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + Math.floor(Number(minuten) || 0) * 60000
  const sommer = wand - 120 * 60000
  if (berlinOffsetMinuten(sommer) === 120) return sommer
  const winter = wand - 60 * 60000
  if (berlinOffsetMinuten(winter) === 60) return winter
  // Lücke der Umstellung im Frühjahr: der Beginn der Sommerzeit (03:00)
  return letzterSonntag(new Date(winter).getUTCFullYear(), 2)
}

function ruheGrenzen(r: Ruhe): { von: number; bis: number } | null {
  if (!r || r.an !== true) return null
  const von = zeitLesen(r.von)
  const bis = zeitLesen(r.bis)
  if (von === null || bis === null || von === bis) return null
  return { von, bis }
}

/** Liegt der Zeitpunkt in der Ruhezeit? von == bis oder aus: nie; über Mitternacht: ab von oder vor bis. */
export function inRuhe(r: Ruhe, jetztMs: number): boolean {
  const g = ruheGrenzen(r)
  if (!g) return false
  const m = berlinTeile(jetztMs).minutenImTag
  return g.von < g.bis ? m >= g.von && m < g.bis : m >= g.von || m < g.bis
}

/** Ende der laufenden Ruhezeit (UTC-Millisekunden), null außerhalb der Ruhezeit. */
export function ruheEnde(r: Ruhe, jetztMs: number): number | null {
  if (!inRuhe(r, jetztMs)) return null
  const g = ruheGrenzen(r) as { von: number; bis: number }
  const t = berlinTeile(jetztMs)
  let ende: number
  if (g.von > g.bis && t.minutenImTag >= g.von) {
    const morgen = new Date(Date.UTC(t.jahr, t.monat - 1, t.tagImMonat + 1))
    const tag = morgen.getUTCFullYear() + '-' + zwei(morgen.getUTCMonth() + 1) + '-' + zwei(morgen.getUTCDate())
    ende = berlinZuUtc(tag, g.bis)
  } else {
    ende = berlinZuUtc(t.tag, g.bis)
  }
  // In der doppelten Stunde im Herbst (zweites 02:xx) ist das Ende das zweite Vorkommen
  return ende > jetztMs ? ende : ende + 3600000
}

/** "Von 22:00 bis 06:00 Uhr" oder "Aus". */
export function ruheText(r: Ruhe): string {
  const g = ruheGrenzen(r)
  if (!g) return 'Aus'
  return 'Von ' + zeitText(g.von) + ' bis ' + zeitText(g.bis) + ' Uhr'
}

// ── Mitteilung der Organisation (Owner 12.3) ────────────────────────────────
// Der Server (pb_hooks/push.pb.js, mitteilungPruefen in push-regeln.js) prüft dasselbe vor dem
// Speichern; hier für die Oberfläche (Zähler, Fehlertext vor dem Senden). Gleichlauf in
// pushGleichlauf.test.ts.

/** Grenzen einer Mitteilung: Titel und Text in Zeichen; die Leitung höchstens 3 neue je Organisation in 24 Stunden. */
export const MITTEILUNG_GRENZEN = { titel: 120, text: 1000, leitungJeTag: 3 } as const

export const MITTEILUNG_TEXTE = {
  verboten: 'Mitteilungen der Organisation schicken nur der Supervisor und die Leitung der eigenen Organisation.',
  titel_leer: 'Bitte einen Titel eingeben.',
  titel_lang: 'Der Titel ist zu lang (höchstens 120 Zeichen).',
  text_lang: 'Der Text ist zu lang (höchstens 1000 Zeichen).',
  html: 'Bitte nur Text eingeben, ohne HTML.',
  organisation: 'Diese Organisation gibt es nicht.',
  drossel: 'Höchstens drei Mitteilungen je Organisation in 24 Stunden. Die nächste geht in {m} wieder.',
} as const

const LEERRAUM = /[ \t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g
const HTML_RE = /<[A-Za-z!\/?]|&#?[A-Za-z0-9]{1,10};/

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

export type MitteilungPruefung = { ok: true } | { ok: false; feld: 'title' | 'message'; text: string }

/** Titel 1 bis 120 Zeichen (nicht nur Leerraum), Text bis 1000, nur Text (kein HTML). */
export function mitteilungPruefen(titel: unknown, text: unknown): MitteilungPruefung {
  const t = typeof titel === 'string' ? titel : titel === undefined || titel === null ? '' : String(titel)
  const m = typeof text === 'string' ? text : text === undefined || text === null ? '' : String(text)
  if (!t.replace(LEERRAUM, '')) return { ok: false, feld: 'title', text: MITTEILUNG_TEXTE.titel_leer }
  if (zeichenZahl(t) > MITTEILUNG_GRENZEN.titel) return { ok: false, feld: 'title', text: MITTEILUNG_TEXTE.titel_lang }
  if (zeichenZahl(m) > MITTEILUNG_GRENZEN.text) return { ok: false, feld: 'message', text: MITTEILUNG_TEXTE.text_lang }
  if (HTML_RE.test(t)) return { ok: false, feld: 'title', text: MITTEILUNG_TEXTE.html }
  if (HTML_RE.test(m)) return { ok: false, feld: 'message', text: MITTEILUNG_TEXTE.html }
  return { ok: true }
}
