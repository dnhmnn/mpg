// Fristen im MPG: wann ist ein Gerät wieder zu prüfen, und wie dringend ist es?
//
// Gerechnet wird in Kalendertagen nach Ortszeit, nicht in Millisekunden: Eine Prüfung
// „morgen um 08:00“ ist morgen fällig, egal um welche Uhrzeit heute geprüft wurde.
// Tage werden als 'JJJJ-MM-TT' geführt und über UTC verrechnet, damit die Umstellung
// auf Sommer- oder Winterzeit keinen Tag verschluckt.
//
// Prüffälle: src/lib/mpg/selbsttest.ts (auch in der CI, siehe src/lib/__tests__/mpg.test.ts).

/** Kalendertag 'JJJJ-MM-TT'. */
export type Tag = string

export type Intervall = 'daily' | 'weekly' | 'monthly' | 'yearly'

export const INTERVALLE: Intervall[] = ['daily', 'weekly', 'monthly', 'yearly']

const INTERVALL_NAMEN: Record<string, Intervall> = {
  daily: 'daily', täglich: 'daily', taeglich: 'daily', tag: 'daily',
  weekly: 'weekly', wöchentlich: 'weekly', woechentlich: 'weekly', woche: 'weekly',
  monthly: 'monthly', monatlich: 'monthly', monat: 'monthly',
  yearly: 'yearly', annually: 'yearly', jährlich: 'yearly', jaehrlich: 'yearly', jahr: 'yearly',
}

/**
 * Prüfintervall aus PocketBase lesen. Ist das Feld dort eine Auswahl mit Mehrfachwahl, kommt
 * es als Liste; ältere Daten können das deutsche Wort tragen. Unbekannte oder leere
 * Intervalle zählen wie bisher als monatlich.
 */
export function intervallVon(wert: unknown): Intervall {
  const roh = Array.isArray(wert) ? wert[0] : wert
  return INTERVALL_NAMEN[String(roh ?? '').trim().toLowerCase()] ?? 'monthly'
}

/**
 * Vorwarnung in Tagen, ab der eine Frist „bald fällig“ ist. Bei täglicher Prüfung
 * gibt es keine Vorwarnung — sonst stünde jedes Gerät immer auf „bald“.
 */
export const VORWARNUNG: Record<Intervall | 'stk' | 'mtk', number> = {
  daily: 0, weekly: 1, monthly: 7, yearly: 30, stk: 30, mtk: 30,
}

function zahl2(n: number) { return String(n).padStart(2, '0') }

function tagAusUtc(ms: number): Tag {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${zahl2(d.getUTCMonth() + 1)}-${zahl2(d.getUTCDate())}`
}

function utcVon(tag: Tag): number {
  const [j, m, t] = tag.split('-').map(Number)
  return Date.UTC(j, m - 1, t)
}

/** Ortszeit-Kalendertag eines Zeitpunkts. */
export function tagVonDatum(d: Date): Tag {
  return `${d.getFullYear()}-${zahl2(d.getMonth() + 1)}-${zahl2(d.getDate())}`
}

/**
 * Kalendertag aus einem PocketBase-Wert.
 * - '2026-03-10' und '2026-03-10 00:00:00.000Z' sind reine Datumsangaben (Datumsfeld,
 *   z. B. „letzte STK“) und gelten als genau dieser Tag — ohne Zeitzonen-Verschiebung.
 * - Alles andere ist ein Zeitpunkt (z. B. Uhrzeit der Prüfung) und zählt nach Ortszeit.
 */
export function kalendertag(wert: string | null | undefined): Tag | null {
  if (!wert) return null
  const s = String(wert).trim()
  const nurDatum = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00(?::00(?:\.0+)?)?Z?)?$/.exec(s)
  if (nurDatum) {
    const [, j, m, t] = nurDatum
    const ms = Date.UTC(+j, +m - 1, +t)
    // 2026-02-31 o. Ä. ist kein Tag
    return tagAusUtc(ms) === `${j}-${m}-${t}` ? `${j}-${m}-${t}` : null
  }
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : tagVonDatum(d)
}

export function plusTage(tag: Tag, n: number): Tag {
  return tagAusUtc(utcVon(tag) + n * 86_400_000)
}

/** Monate addieren, ohne über das Monatsende zu laufen: 31.01. + 1 Monat = 28./29.02. */
export function plusMonate(tag: Tag, n: number): Tag {
  const [j, m, t] = tag.split('-').map(Number)
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1))
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate()
  return tagAusUtc(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth(), Math.min(t, letzter)))
}

export function monatsende(tag: Tag): Tag {
  const [j, m] = tag.split('-').map(Number)
  return tagAusUtc(Date.UTC(j, m, 0))
}

/** Tage von a bis b (positiv, wenn b später liegt). */
export function tageZwischen(a: Tag, b: Tag): number {
  return Math.round((utcVon(b) - utcVon(a)) / 86_400_000)
}

/** Nächste Regelprüfung nach der letzten. */
export function naechstePruefung(letzte: Tag, intervall: Intervall): Tag {
  switch (intervall) {
    case 'daily': return plusTage(letzte, 1)
    case 'weekly': return plusTage(letzte, 7)
    case 'monthly': return plusMonate(letzte, 1)
    case 'yearly': return plusMonate(letzte, 12)
  }
}

/**
 * Nächste STK: „mit Ablauf des Monats“ — eine STK vom 10.03.2024 mit 24 Monaten
 * ist bis zum 31.03.2026 durchzuführen.
 */
export function naechsteStk(letzte: Tag, monate: number): Tag {
  return monatsende(plusMonate(letzte, monate))
}

/**
 * Nächste MTK. Bewusst taggenau (die frühere Fristregel „mit Ablauf des Jahres“ ist
 * für die Neufassung der MPBetreibV nicht bestätigt) — lieber zu früh als zu spät.
 * Je Modell einstellbar wird das mit den Prüfplänen.
 */
export function naechsteMtk(letzte: Tag, monate: number): Tag {
  return plusMonate(letzte, monate)
}

/** Monate eines STK/MTK-Intervalls; leer, 0 oder Unsinn → 24 wie bisher. */
export function monateVon(wert: number | null | undefined): number {
  const n = Number(wert)
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 24
}

export type Lage = 'offen' | 'ueberfaellig' | 'heute' | 'bald' | 'ok'

export interface Frist {
  art: 'pruefung' | 'stk' | 'mtk'
  bezeichnung: string
  letzte: Tag | null
  /** null: noch nie durchgeführt bzw. kein Datum eingetragen */
  naechste: Tag | null
  lage: Lage
  /** Tage bis zur Fälligkeit; negativ = überfällig; null ohne Datum */
  tage: number | null
}

/** Lage einer Frist am Tag `heute`. */
export function lageVon(naechste: Tag | null, heute: Tag, vorwarnung: number): { lage: Lage; tage: number | null } {
  if (!naechste) return { lage: 'offen', tage: null }
  const tage = tageZwischen(heute, naechste)
  if (tage < 0) return { lage: 'ueberfaellig', tage }
  if (tage === 0) return { lage: 'heute', tage }
  if (tage <= vorwarnung) return { lage: 'bald', tage }
  return { lage: 'ok', tage }
}

/** Die Felder eines Geräts, die eine Frist bestimmen (mpg_devices). */
export interface FristFelder {
  interval?: string | string[] | null
  last_inspection?: string | null
  has_stk?: boolean | null
  last_stk?: string | null
  stk_interval_months?: number | null
  has_mtk?: boolean | null
  last_mtk?: string | null
  mtk_interval_months?: number | null
}

export const INTERVALL_TEXT: Record<Intervall, string> = {
  daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich',
}

/** Alle Fristen eines Geräts: Regelprüfung, dazu STK und MTK, wenn verlangt. */
export function fristenVon(g: FristFelder, heute: Tag): Frist[] {
  const intervall = intervallVon(g.interval)
  const letzte = kalendertag(g.last_inspection)
  const naechste = letzte ? naechstePruefung(letzte, intervall) : null
  const liste: Frist[] = [{
    art: 'pruefung', bezeichnung: 'Prüfung', letzte, naechste,
    ...lageVon(naechste, heute, VORWARNUNG[intervall]),
  }]
  if (g.has_stk) {
    const l = kalendertag(g.last_stk)
    const n = l ? naechsteStk(l, monateVon(g.stk_interval_months)) : null
    liste.push({ art: 'stk', bezeichnung: 'STK', letzte: l, naechste: n, ...lageVon(n, heute, VORWARNUNG.stk) })
  }
  if (g.has_mtk) {
    const l = kalendertag(g.last_mtk)
    const n = l ? naechsteMtk(l, monateVon(g.mtk_interval_months)) : null
    liste.push({ art: 'mtk', bezeichnung: 'MTK', letzte: l, naechste: n, ...lageVon(n, heute, VORWARNUNG.mtk) })
  }
  return liste
}

/**
 * Wert für mpg_devices.next_inspection_due. Neue Ansichten rechnen selbst aus der
 * letzten Prüfung; das Feld bleibt für ältere App-Stände richtig. Ende des Tages
 * nach Ortszeit, damit „heute fällig“ dort nicht schon morgens als überfällig gilt.
 * Ohne bisherige Prüfung ist das Gerät heute fällig (Erstprüfung).
 */
export function faelligFeld(g: FristFelder, heute: Tag): string {
  const letzte = kalendertag(g.last_inspection)
  const tag = letzte ? naechstePruefung(letzte, intervallVon(g.interval)) : heute
  const [j, m, t] = tag.split('-').map(Number)
  return new Date(j, m - 1, t, 23, 59, 59).toISOString()
}

/** '2026-03-31' → '31.03.2026' */
export function tagText(tag: Tag | null): string {
  if (!tag) return '—'
  const [j, m, t] = tag.split('-')
  return `${t}.${m}.${j}`
}

/** Kurzer Text zur Lage, z. B. „überfällig seit 3 Tagen“. */
export function lageText(f: Pick<Frist, 'lage' | 'tage'>): string {
  const t = f.tage ?? 0
  switch (f.lage) {
    case 'offen': return 'noch nie durchgeführt'
    case 'ueberfaellig': return -t === 1 ? 'überfällig seit gestern' : `überfällig seit ${-t} Tagen`
    case 'heute': return 'heute fällig'
    case 'bald': return t === 1 ? 'morgen fällig' : `fällig in ${t} Tagen`
    case 'ok': return t === 1 ? 'morgen fällig' : `fällig in ${t} Tagen`
  }
}
