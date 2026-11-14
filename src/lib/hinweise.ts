/**
 * „Neu in Responda“: kurze Info des Supervisors nach einem Update (Sammlung responda_hinweise).
 *
 * Jeder Benutzer sieht den neuesten veröffentlichten Hinweis genau einmal: beim Öffnen des Hubs
 * (oder der Lernbar), bis er „Verstanden“ drückt. Gemerkt wird das am Konto
 * (users.hinweis_gesehen_am = veroeffentlicht_am des bestätigten Hinweises), als Rückhalt auf dem
 * Gerät (localStorage hinweis_gesehen_<userId>); es gilt immer das spätere von beiden.
 * Wer nach der Veröffentlichung angelegt wird, bekommt ältere Hinweise nicht.
 *
 * Der Text ist reiner Text: Absätze mit einer Leerzeile, Aufzählungen mit „- “ am Zeilenanfang.
 * Er wird nur über textBloecke() und React-Textknoten gezeigt, nie als HTML.
 * Regeln und Felder: docs/pocketbase-regeln.md, „Hub und Hinweise“.
 */

export interface Hinweis {
  id: string
  titel: string
  text?: string
  veroeffentlicht?: boolean
  veroeffentlicht_am?: string
  erstellt_von?: string
  created?: string
  updated?: string
}

export const HINWEIS_TITEL_MAX = 120
export const HINWEIS_TEXT_MAX = 5000
export const HINWEISE_SAMMLUNG = 'responda_hinweise'

/** Rückhalt auf dem Gerät für users.hinweis_gesehen_am. */
export const hinweisSchluessel = (userId: string) => `hinweis_gesehen_${userId}`

const ZEIT_MUSTER = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?))?\s*(Z|[+-]\d{2}:?\d{2})?$/i

/**
 * Zeitpunkt in Millisekunden aus einem PocketBase-Datum („2026-11-14 08:12:00.000Z“) oder ISO-Text.
 * Ohne Zeitzone gilt UTC (so speichert PocketBase). Alles andere (leer, Unsinn, Zahl) ergibt 0.
 */
export function zeitpunkt(wert: unknown): number {
  if (typeof wert !== 'string') return 0
  const m = ZEIT_MUSTER.exec(wert.trim())
  if (!m) return 0
  const [, tag, uhr, zone] = m
  let z = zone ? zone.toUpperCase() : 'Z'
  if (/^[+-]\d{4}$/.test(z)) z = `${z.slice(0, 3)}:${z.slice(3)}`
  const ms = Date.parse(`${tag}T${uhr ?? '00:00'}${z}`)
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

/** Millisekunden als PocketBase-Datum: „2026-11-14 08:12:00.000Z“. */
export function pbZeit(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ')
}

/** Der neueste veröffentlichte Hinweis (nach veroeffentlicht_am; bei Gleichstand die größere id). */
export function neuesterVeroeffentlicht(liste: Hinweis[]): Hinweis | null {
  let best: Hinweis | null = null
  let bestZeit = 0
  for (const h of Array.isArray(liste) ? liste : []) {
    if (!h || h.veroeffentlicht !== true || typeof h.id !== 'string') continue
    const t = zeitpunkt(h.veroeffentlicht_am)
    if (!t) continue
    if (!best || t > bestZeit || (t === bestZeit && h.id > best.id)) { best = h; bestZeit = t }
  }
  return best
}

/** Der späteste gültige Zeitpunkt der Werte als PocketBase-Datum, sonst ''. */
export function gesehenStand(...werte: unknown[]): string {
  let max = 0
  for (const w of werte) { const t = zeitpunkt(w); if (t > max) max = t }
  return max ? pbZeit(max) : ''
}

/**
 * Welcher Hinweis jetzt erscheint: nur der neueste veröffentlichte, und nur wenn er später
 * veröffentlicht wurde als zuletzt bestätigt (Konto oder Gerät) und als das Konto angelegt wurde.
 * Ohne Anlagedatum zählt nur „gesehen“.
 */
export function hinweisZuZeigen(
  liste: Hinweis[],
  stand: { gesehenAm?: unknown; lokal?: unknown; kontoAngelegt?: unknown },
): Hinweis | null {
  const h = neuesterVeroeffentlicht(liste)
  if (!h) return null
  const t = zeitpunkt(h.veroeffentlicht_am)
  if (t <= zeitpunkt(gesehenStand(stand.gesehenAm, stand.lokal))) return null
  const angelegt = zeitpunkt(stand.kontoAngelegt)
  if (angelegt && t <= angelegt) return null
  return h
}

export type Block = { art: 'absatz'; zeilen: string[] } | { art: 'liste'; punkte: string[] }

const PUNKT = /^\s*[-•*](?:\s+(.*))?$/

/**
 * Der Text in Absätze und Aufzählungen zerlegt. Leerzeile trennt Absätze; „- “, „• “ oder „* “ am
 * Zeilenanfang ist ein Punkt. Einzelne Zeilenumbrüche im Absatz bleiben Zeilen. HTML bleibt
 * wörtlicher Text (die Anzeige setzt nur Textknoten).
 */
export function textBloecke(text: unknown): Block[] {
  if (typeof text !== 'string') return []
  const bloecke: Block[] = []
  let akt: Block | null = null
  const abschliessen = () => { if (akt) bloecke.push(akt); akt = null }
  for (const roh of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!roh.trim()) { abschliessen(); continue }
    const punkt = PUNKT.exec(roh)
    if (punkt) {
      const inhalt = (punkt[1] ?? '').trim()
      if (!akt || akt.art !== 'liste') { abschliessen(); akt = { art: 'liste', punkte: [] } }
      if (inhalt) akt.punkte.push(inhalt)
      continue
    }
    if (!akt || akt.art !== 'absatz') { abschliessen(); akt = { art: 'absatz', zeilen: [] } }
    akt.zeilen.push(roh.trim())
  }
  abschliessen()
  return bloecke.filter((b) => (b.art === 'liste' ? b.punkte.length > 0 : b.zeilen.length > 0))
}

/** Zeichen zählen wie PocketBase (Unicode-Zeichen, nicht UTF-16-Einheiten). */
export const zeichen = (s: string) => [...s].length

/** Eingaben prüfen; leeres Ergebnis = in Ordnung. Gezählt wird ohne Leerraum am Anfang und Ende. */
export function hinweisPruefen(e: { titel: string; text: string }): { titel?: string; text?: string } {
  const f: { titel?: string; text?: string } = {}
  const titel = (e.titel ?? '').trim()
  const text = (e.text ?? '').trim()
  if (!titel) f.titel = 'Bitte einen Titel eingeben.'
  else if (zeichen(titel) > HINWEIS_TITEL_MAX) f.titel = `Der Titel ist zu lang (höchstens ${HINWEIS_TITEL_MAX} Zeichen).`
  if (zeichen(text) > HINWEIS_TEXT_MAX) f.text = `Der Text ist zu lang (höchstens ${HINWEIS_TEXT_MAX} Zeichen).`
  return f
}

/**
 * Wie weit die Uhr dieses Geräts von der Serverzeit abweicht (ms; positiv: der Server ist weiter,
 * das Gerät geht nach). Gemessen an `updated` eines Datensatzes, den der Server gerade gespeichert
 * hat (PocketBase setzt `updated` bei jedem Speichern, auch ohne Änderung), gegen die Geräte-Uhr
 * beim Empfang der Antwort. Ohne gültiges `updated`: null.
 */
export function uhrVersatz(serverZeit: unknown, empfangenMs: number): number | null {
  const t = zeitpunkt(serverZeit)
  return t && Number.isFinite(empfangenMs) ? t - empfangenMs : null
}

/** Ab dieser Abweichung sagt die Verwaltung, dass die Uhr des Geräts falsch geht. */
export const UHR_SPIELRAUM_MS = 2 * 60 * 1000

/** Ein Satz für den Supervisor, wenn die Geräte-Uhr mehr als 2 Minuten falsch geht; sonst ''. */
export function uhrWarnung(versatz: number | null | undefined): string {
  if (typeof versatz !== 'number' || !Number.isFinite(versatz) || Math.abs(versatz) <= UHR_SPIELRAUM_MS) return ''
  const ms = Math.abs(versatz)
  const TAG = 86_400_000
  const STUNDE = 3_600_000
  const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`
  const dauer = ms >= TAG ? anzahl(Math.round(ms / TAG), 'Tag', 'Tage')
    : ms >= STUNDE ? anzahl(Math.round(ms / STUNDE), 'Stunde', 'Stunden')
      : anzahl(Math.round(ms / 60_000), 'Minute', 'Minuten')
  return `Die Uhr dieses Geräts geht etwa ${dauer} ${versatz < 0 ? 'vor' : 'nach'}. Das Datum des Hinweises richtet sich nach der Serverzeit.`
}

/**
 * Änderung zum Veröffentlichen. Das erste Veröffentlichungsdatum bleibt: Wer zurückzieht und wieder
 * veröffentlicht (etwa wegen eines Tippfehlers), zeigt den Hinweis niemandem ein zweites Mal.
 * `jetzt` ist die Serverzeit (Geräte-Uhr plus uhrVersatz), nicht die Uhr des Geräts allein: Nur
 * dieses Datum entscheidet, welcher Hinweis der neueste ist und wer ihn schon gesehen hat. Ginge
 * die Uhr eines Supervisor-Geräts vor, verdeckte ein zu spät datierter Hinweis alle späteren.
 */
export function veroeffentlichenAenderung(h: { veroeffentlicht_am?: string }, jetzt: number): { veroeffentlicht: true; veroeffentlicht_am: string } {
  const alt = zeitpunkt(h.veroeffentlicht_am)
  return { veroeffentlicht: true, veroeffentlicht_am: alt ? (h.veroeffentlicht_am as string) : pbZeit(jetzt) }
}

/** Änderung zum Zurückziehen (das Datum bleibt stehen). */
export function zurueckziehenAenderung(): { veroeffentlicht: false } {
  return { veroeffentlicht: false }
}

export function hinweisStand(h: Hinweis): 'entwurf' | 'veroeffentlicht' | 'zurueckgezogen' {
  if (h.veroeffentlicht === true) return 'veroeffentlicht'
  return zeitpunkt(h.veroeffentlicht_am) ? 'zurueckgezogen' : 'entwurf'
}

const BERLIN = 'Europe/Berlin'

/** „14. November 2026“ (Zeitzone Europe/Berlin), sonst ''. */
export function datumText(wert: unknown): string {
  const t = zeitpunkt(wert)
  if (!t) return ''
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: BERLIN }).format(t)
}

/** „14.11.2026“ (Europe/Berlin), sonst ''. */
export function kurzDatum(wert: unknown): string {
  const t = zeitpunkt(wert)
  if (!t) return ''
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: BERLIN }).format(t)
}

/** „14.11.2026, 09:12“ (Europe/Berlin), sonst ''. */
export function kurzDatumZeit(wert: unknown): string {
  const t = zeitpunkt(wert)
  if (!t) return ''
  const uhr = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: BERLIN }).format(t)
  return `${kurzDatum(wert)}, ${uhr}`
}

/**
 * Der Stand in der Verwaltung des Supervisors, ein Satz.
 * @param gezeigtId id des Hinweises, der gerade gezeigt wird (neuesterVeroeffentlicht der Liste)
 */
export function standText(h: Hinweis, gezeigtId: string | null | undefined): string {
  const st = hinweisStand(h)
  if (st === 'entwurf') return h.created && kurzDatum(h.created) ? `Entwurf, angelegt ${kurzDatum(h.created)}` : 'Entwurf'
  if (st === 'zurueckgezogen') return 'Zurückgezogen'
  const seit = kurzDatumZeit(h.veroeffentlicht_am)
  if (!seit) return 'Veröffentlicht, aber ohne Datum: wird nicht gezeigt (zurückziehen und neu veröffentlichen)'
  return h.id === gezeigtId
    ? `Veröffentlicht seit ${seit}, wird gezeigt`
    : `Veröffentlicht seit ${seit}, nicht mehr gezeigt (ein neuerer gilt)`
}
