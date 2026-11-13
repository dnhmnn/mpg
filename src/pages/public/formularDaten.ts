// Daten der Formulare Produktausgabe und Defektmeldung (Bauplan v2, 1.5 und 4.7).
//
// Reine Bauteile ohne React und PocketBase, damit die Prüffälle ohne DOM laufen
// (src/lib/__tests__/formularDaten.test.ts).
//
// - `ausgabeDaten` und `meldungDaten` bauen den Teil `daten` für die Route
//   /absenden. Der Server nimmt daraus nur, was er prüft; Name und Einheit der
//   Artikel, den Namen des Verbrauchsorts und des Geräts schlägt er selbst nach.
// - `ausgabeAlt` und `meldungAlt` bauen den Satz für den alten Weg (Server ohne
//   Formular-Routen, bis ALTER_SERVER_BIS), so wie die Masken ihn bisher direkt
//   angelegt haben, ohne Kennung. `altSatz` in src/lib/formular/versand.ts setzt
//   Kennung, Organisation und den Absendernamen der Warteschlange.
// - Eigene Felder der Organisation (Plan Vorgänge 1.3, 4.2): für die Route nur
//   `daten.eigene = { version, werte }` (Bezeichnungen setzt der Server aus der
//   Einstellung); im alten Weg dieselben Angaben mit Schnappschuss der Felder
//   (`payload.eigene` bzw. Feld `eigene`), damit eine Rücknahme nichts verliert.
// - CIRS legt weiter direkt an (`cirsSatz`); `payload.eigene = { version, werte }`
//   baut der Hook cirs.pb.js zu Angaben aus.

import { PASSWORT_FEHLT } from './absender/texte'
import { pflichtText, wertLeer, type Angaben, type Baustein, type FeldDef, type Wert } from '../../lib/formular/felder'

/** Eine Position, wie die Maske sie führt (Artikel gewählt oder nicht, Menge getippt). */
export type AusgabePosition = { item_id?: string; name?: string; qty?: number | string; unit?: string }
/** Eine Position für die Route: nur Kennung und Menge. */
export type AusgabeZeile = { item_id: string; qty: number }
/** Eigene Felder für die Route: Fassung der Einstellung und die bereinigten Werte (werteBereinigen). */
export type EigeneEingabe = { version: number; werte: Record<string, Wert> }
/** `daten` der Produktausgabe für /absenden; `eigene` nur, wenn die Organisation eigene Felder hat. */
export type AusgabeDaten = { einsatz: string; datum: string; lager_id: string; positionen: AusgabeZeile[]; eigene?: EigeneEingabe }
/** `daten` der Defektmeldung für /absenden. */
export type Schwere = 'low' | 'medium' | 'high' | 'critical'
export type MeldungDaten = { device_id: string; description: string; severity: Schwere; eigene?: EigeneEingabe }
/** Wer im alten Weg als Absender eingetragen wird; `id` nur bei Anmeldung, sonst ''. */
export type AltAbsender = { id: string; name: string }

/** Grenzen wie auf dem Server (pb_hooks/formular-regeln.js, datenPruefen). */
export const EINSATZ_MAX = 80
export const POSITIONEN_MAX = 50
export const MENGE_MAX = 10000
export const BESCHREIBUNG_MAX = 4000
const SCHWEREN: Schwere[] = ['low', 'medium', 'high', 'critical']

function text(x: unknown): string {
  return typeof x === 'string' ? x : ''
}

function menge(x: unknown): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN
  return Number.isFinite(n) ? n : 0
}

function eigeneKopie(e: EigeneEingabe | undefined): EigeneEingabe | undefined {
  if (!e || typeof e !== 'object') return undefined
  const version = typeof e.version === 'number' && Number.isInteger(e.version) && e.version >= 0 ? e.version : 0
  const werte = e.werte && typeof e.werte === 'object' && !Array.isArray(e.werte) ? JSON.parse(JSON.stringify(e.werte)) as Record<string, Wert> : {}
  return { version, werte }
}

/**
 * Die eigenen Angaben für den alten Weg (Plan 1.3): Schnappschuss der sichtbaren Felder
 * dieser Fassung und nur die ausgefüllten Werte, wie der Server sie bauen würde.
 */
export function eigeneAngaben(felder: FeldDef[], e: EigeneEingabe): Angaben {
  const k = eigeneKopie(e) ?? { version: 0, werte: {} }
  const sichtbar = (Array.isArray(felder) ? felder : []).filter((d) => d && d.aus !== true).map((d) => {
    const x = { ...d }
    delete x.abschnitt
    return x
  })
  const werte: Record<string, Wert> = {}
  for (const d of sichtbar) if (Object.prototype.hasOwnProperty.call(k.werte, d.id) && !wertLeer(k.werte[d.id])) werte[d.id] = k.werte[d.id]
  return { v: 1, version: k.version, felder: sichtbar, werte }
}

/** Ausgefüllte Positionen: Artikel gewählt und Menge größer 0; alles andere fällt weg. */
export function ausgefuellt(positionen: AusgabePosition[]): (AusgabePosition & AusgabeZeile)[] {
  return (Array.isArray(positionen) ? positionen : []).flatMap((p) => {
    const item_id = text(p?.item_id).trim()
    const qty = menge(p?.qty)
    return item_id && qty > 0 ? [{ ...p, item_id, qty }] : []
  })
}

/** Titel wie bisher: „Produktausgabe E-117 (31.10.2026)“. */
export function ausgabeTitel(einsatz: string, datum: string): string {
  const de = text(datum).split('-').reverse().join('.')
  return `Produktausgabe ${text(einsatz).trim()} (${de})`
}

/** `daten` der Produktausgabe nach 1.5: nur `item_id` und `qty`, leere Positionen raus, Einsatz getrimmt. */
export function ausgabeDaten(einsatz: string, datum: string, lagerId: string, positionen: AusgabePosition[], eigene?: EigeneEingabe): AusgabeDaten {
  const d: AusgabeDaten = {
    einsatz: text(einsatz).trim(),
    datum: text(datum),
    lager_id: text(lagerId),
    positionen: ausgefuellt(positionen).map((p) => ({ item_id: p.item_id, qty: p.qty })),
  }
  const e = eigeneKopie(eigene)
  if (e) d.eigene = e
  return d
}

/**
 * Der Satz der Produktausgabe für den alten Weg, wie die Maske ihn bisher
 * angelegt hat (ohne Kennung): Titel, payload mit Namen und Einheiten der
 * Positionen, Status offen.
 */
export function ausgabeAlt(einsatz: string, datum: string, lagerId: string, positionen: AusgabePosition[], o: { lagerName: string; absender: AltAbsender; orgId: string; eigene?: Angaben }): Record<string, unknown> {
  const satz: Record<string, unknown> = {
    title: ausgabeTitel(einsatz, datum),
    payload: {
      einsatz: text(einsatz).trim(),
      datum: text(datum),
      user_id: text(o.absender?.id),
      user_name: text(o.absender?.name).trim(),
      lager_id: text(lagerId),
      lager_name: text(o.lagerName),
      positionen: ausgefuellt(positionen).map((p) => ({ qty: p.qty, name: text(p.name), item_id: p.item_id, unit: text(p.unit) })),
    },
    status: 'offen',
    organization_id: text(o.orgId),
  }
  if (o.eigene) (satz.payload as Record<string, unknown>).eigene = JSON.parse(JSON.stringify(o.eigene))
  return satz
}

/** Schweregrad, den der Server annimmt; alles andere wird „medium“ (wie der Server). */
export function schwere(x: unknown): Schwere {
  return (SCHWEREN as unknown[]).includes(x) ? x as Schwere : 'medium'
}

/** `daten` der Defektmeldung nach 1.5: Beschreibung getrimmt, Schweregrad geprüft. */
export function meldungDaten(deviceId: string, beschreibung: string, schwereGrad: string, eigene?: EigeneEingabe): MeldungDaten {
  const d: MeldungDaten = { device_id: text(deviceId), description: text(beschreibung).trim(), severity: schwere(schwereGrad) }
  const e = eigeneKopie(eigene)
  if (e) d.eigene = e
  return d
}

/** Der Satz der Defektmeldung für den alten Weg, wie die Maske ihn bisher angelegt hat (ohne Kennung). */
export function meldungAlt(deviceId: string, beschreibung: string, schwereGrad: string, o: { deviceName: string; absender: AltAbsender; orgId: string; eigene?: Angaben }): Record<string, unknown> {
  const satz: Record<string, unknown> = {
    device_id: text(deviceId),
    device_name: text(o.deviceName),
    organization_id: text(o.orgId),
    reporter_name: text(o.absender?.name).trim(),
    reporter_user_id: text(o.absender?.id),
    description: text(beschreibung).trim(),
    severity: schwere(schwereGrad),
    status: 'pending',
  }
  if (o.eigene) satz.eigene = JSON.parse(JSON.stringify(o.eigene))
  return satz
}

/** Ist das ein gültiges Datum JJJJ-MM-TT (wie der Server prüft)? */
export function datumGueltig(datum: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(datum))
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/**
 * Was vor dem Senden einer Produktausgabe fehlt (Texte wie der Server, 1.2),
 * oder '' wenn alles da ist. Den Absender prüft die Maske selbst.
 */
export function ausgabePruefen(d: AusgabeDaten): string {
  if (!d.einsatz || d.einsatz.length > EINSATZ_MAX) return 'Bitte den Einsatz angeben.'
  if (!datumGueltig(d.datum)) return 'Bitte ein gültiges Datum angeben.'
  if (d.positionen.length === 0) return 'Bitte mindestens einen Artikel mit Menge angeben.'
  if (d.positionen.length > POSITIONEN_MAX) return `Höchstens ${POSITIONEN_MAX} Positionen je Ausgabe.`
  if (d.positionen.some((p) => p.qty > MENGE_MAX)) return `Eine Menge ist zu groß. Höchstens ${MENGE_MAX} je Artikel.`
  if (!d.lager_id) return 'Bitte einen Verbrauchsort auswählen.'
  return ''
}

/**
 * Was vor dem Senden zum Absender fehlt, oder ''. Angemeldet (Token der
 * angemeldeten Person) fehlt nichts. Sonst ein Name; im Modus Passwort mit
 * Netz auch das Passwort (ohne Netz geht es ohne Passwort in die
 * Warteschlange, die später danach fragt; beim alten Server gibt es keins).
 */
export function absenderPruefen(p: { angemeldet: boolean; name: string; modus: 'passwort' | 'frei'; passwort: string; online: boolean; alterServer: boolean }): string {
  if (p.angemeldet) return ''
  if (text(p.name).trim().length < 2) return 'Bitte einen Namen eintragen.'
  if (p.modus === 'passwort' && p.online && !p.alterServer && !p.passwort) return PASSWORT_FEHLT
  return ''
}

/** Was vor dem Senden einer Defektmeldung fehlt, oder ''. Gerät und Absender prüft die Maske selbst. */
export function meldungPruefen(d: MeldungDaten): string {
  if (!d.device_id) return 'Bitte ein Gerät auswählen.'
  if (!d.description) return 'Bitte den Defekt beschreiben.'
  if (d.description.length > BESCHREIBUNG_MAX) return `Die Beschreibung ist zu lang. Höchstens ${BESCHREIBUNG_MAX} Zeichen.`
  return ''
}

// ── CIRS (Plan Vorgänge 4.2) ─────────────────────────────────────────────────

/** Die Kernfelder der CIRS-Meldung, wie sie im payload stehen. */
export const CIRS_KERN = ['datum', 'ort', 'kategorie', 'schwere', 'was', 'warum', 'folgen', 'vorschlag', 'melder_name', 'melder_kontakt'] as const
export type CirsKern = Record<(typeof CIRS_KERN)[number], string>

/** Leere Meldung; das Datum heute (Ortszeit, von außen). */
export function cirsLeer(heute: string): CirsKern {
  const k = Object.fromEntries(CIRS_KERN.map((id) => [id, ''])) as CirsKern
  k.datum = heute
  return k
}

/** Grenzen der Freitexte der CIRS-Meldung (die Maske kürzt nichts, sie sagt es). */
export const CIRS_TEXT_MAX = 4000
export const CIRS_KURZ_MAX = 200

/**
 * Was vor dem Senden einer CIRS-Meldung fehlt (Kernfelder nach Einstellung), je Feld in
 * Formularfolge: sichtbare Pflichtfelder ohne Wert, ein ungültiges Datum, zu lange Texte.
 * „Was ist passiert?“ ist immer Pflicht (der Server prüft es auch).
 */
export function cirsFehler(kern: CirsKern, bs: Baustein[]): Record<string, string> {
  const aus: Record<string, string> = {}
  for (const b of bs) {
    if (b.art !== 'kern' || b.aus) continue
    const w = text(kern[b.id as keyof CirsKern]).trim()
    const def: FeldDef = { id: b.id, typ: 'text', label: b.label }
    if (!w) {
      if (b.pflicht || b.id === 'was') aus[b.id] = pflichtText(def)
      continue
    }
    if (b.id === 'datum' && !datumGueltig(w)) { aus[b.id] = `Bitte „${b.label}“ prüfen.`; continue }
    const max = ['was', 'warum', 'folgen', 'vorschlag'].includes(b.id) ? CIRS_TEXT_MAX : CIRS_KURZ_MAX
    if (w.length > max) aus[b.id] = `„${b.label}“ ist zu lang. Höchstens ${max} Zeichen.`
  }
  return aus
}

/** Der erste Fehler aus cirsFehler (Formularfolge); sonst null. */
export function cirsPruefen(kern: CirsKern, bs: Baustein[]): { feld: string; text: string } | null {
  const f = cirsFehler(kern, bs)
  const feld = Object.keys(f)[0]
  return feld ? { feld, text: f[feld] } : null
}

/**
 * Der Satz einer CIRS-Meldung für `cirs_reports.create` (Status offen, wie bisher).
 * Ausgeblendete Kernfelder bleiben leer (die Auswertung zeigt sie als ohne Angabe),
 * Texte getrimmt. `eigene` nur, wenn die Organisation eigene Felder hat; der Hook baut
 * daraus die Angaben mit Schnappschuss. Ohne Datum gilt für den Titel `heute`.
 */
export function cirsSatz(kern: CirsKern, bs: Baustein[], o: { orgId: string; heute: string; eigene?: EigeneEingabe }): Record<string, unknown> {
  const sichtbar = new Set(bs.filter((b) => b.art === 'kern' && !b.aus).map((b) => (b as { id: string }).id))
  const payload: Record<string, unknown> = {}
  for (const id of CIRS_KERN) payload[id] = sichtbar.has(id) || id === 'was' ? text(kern[id]).trim() : ''
  const e = eigeneKopie(o.eigene)
  if (e) payload.eigene = e
  const datum = text(payload.datum) || text(o.heute)
  const de = datum.split('-').reverse().join('.')
  const kat = text(payload.kategorie)
  return {
    title: kat ? `CIRS: ${kat} (${de})` : `CIRS-Meldung (${de})`,
    payload,
    status: 'offen',
    organization_id: text(o.orgId),
  }
}
