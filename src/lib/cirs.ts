// CIRS — gemeldete kritische Ereignisse und was die Organisation daraus macht.
//
// Eine Meldung kommt anonym über die öffentliche Seite der Organisation
// (Collection cirs_reports: title, payload, status, organization_id). Was der
// Melder geschrieben hat, bleibt unangetastet. Die Bearbeitung — Phase,
// Zuständigkeit, Frist, Bewertung, Maßnahmen, Verlauf, Abschluss — steht
// daneben im selben Datensatz unter payload.bearbeitung.
//
// Warum dort und nicht in einem eigenen Feld: so braucht es keine Änderung an
// der Datenbank, und das alte Statusfeld bleibt bei "offen"/"erledigt" — den
// beiden Werten, die Meldeseite und alte Übersicht kennen. Die feinere Phase
// lebt in der Bearbeitung; das Statusfeld wird aus ihr abgeleitet.
//
// Alles hier ist reine Rechnung ohne Netz: Ein Bearbeitungsschritt nimmt die
// Bearbeitung, wie sie gerade in der Datenbank steht, und gibt die neue zurück.
// Gespeichert wird woanders — immer auf dem frisch gelesenen Stand, damit zwei
// Bearbeiter sich nicht gegenseitig überschreiben.

// ── Kataloge ────────────────────────────────────────────────────────────────

/** Die Kategorien der Meldeseite, mit den Namen, unter denen sie dort stehen. */
export const KATEGORIEN = [
  { wert: 'personal', name: 'Personal / Besetzung' },
  { wert: 'kommunikation', name: 'Kommunikation' },
  { wert: 'material', name: 'Material / Ausrüstung' },
  { wert: 'fahrzeug', name: 'Fahrzeug' },
  { wert: 'einsatz', name: 'Einsatztaktik' },
  { wert: 'organisation', name: 'Organisation' },
  { wert: 'sonstiges', name: 'Sonstiges' },
] as const

export type Schwere = 'gering' | 'mittel' | 'hoch'
export const SCHWEREGRADE: { wert: Schwere; name: string; lang: string }[] = [
  { wert: 'gering', name: 'Gering', lang: 'keine Gefährdung' },
  { wert: 'mittel', name: 'Mittel', lang: 'potenzielle Gefährdung' },
  { wert: 'hoch', name: 'Hoch', lang: 'ernste Gefährdung' },
]

export type Haeufigkeit = 'einmalig' | 'gelegentlich' | 'haeufig'
export const HAEUFIGKEITEN: { wert: Haeufigkeit; name: string }[] = [
  { wert: 'einmalig', name: 'Einmalig' },
  { wert: 'gelegentlich', name: 'Gelegentlich' },
  { wert: 'haeufig', name: 'Häufig' },
]

export type Phase = 'neu' | 'bewertung' | 'massnahmen' | 'abgeschlossen' | 'kein_handlungsbedarf'
export const PHASEN: { wert: Phase; name: string }[] = [
  { wert: 'neu', name: 'Neu' },
  { wert: 'bewertung', name: 'In Bewertung' },
  { wert: 'massnahmen', name: 'Maßnahmen laufen' },
  { wert: 'abgeschlossen', name: 'Abgeschlossen' },
  { wert: 'kein_handlungsbedarf', name: 'Kein Handlungsbedarf' },
]

export type Prioritaet = 'niedrig' | 'mittel' | 'hoch'

export function kategorieName(wert?: string): string {
  if (!wert) return '—'
  return KATEGORIEN.find((k) => k.wert === wert)?.name ?? wert
}
export function schwereName(wert?: string): string {
  if (!wert) return '—'
  return SCHWEREGRADE.find((s) => s.wert === wert)?.name ?? wert
}
export function haeufigkeitName(wert?: string): string {
  if (!wert) return '—'
  return HAEUFIGKEITEN.find((h) => h.wert === wert)?.name ?? wert
}
export function phaseName(phase: Phase): string {
  return PHASEN.find((p) => p.wert === phase)?.name ?? phase
}

// ── Datenformen ─────────────────────────────────────────────────────────────

/** Was der Melder ausgefüllt hat — so, wie die Meldeseite es schickt. */
export interface CirsMeldung {
  datum?: string
  ort?: string
  kategorie?: string
  schwere?: string
  was?: string
  warum?: string
  folgen?: string
  vorschlag?: string
  melder_name?: string
  melder_kontakt?: string
}

export interface Person {
  id: string
  name: string
}

export interface Massnahme {
  id: string
  text: string
  verantwortlich?: string
  /** Fälligkeit als Kalendertag, JJJJ-MM-TT. */
  frist?: string
  erledigtAm?: string
  erledigtVon?: string
  angelegtAm: string
  angelegtVon: string
}

export type VerlaufArt = 'phase' | 'zustaendig' | 'frist' | 'bewertung' | 'massnahme' | 'notiz' | 'abschluss'

export interface VerlaufEintrag {
  id: string
  am: string
  von: string
  art: VerlaufArt
  text: string
}

/** Die Einschätzung der Organisation. Leere Angaben heißen: wie gemeldet. */
export interface Bewertung {
  kategorie?: string
  schwere?: Schwere
  haeufigkeit?: Haeufigkeit
}

export interface Bearbeitung {
  v: 1
  phase: Phase
  zustaendig: Person | null
  /** Bis wann die Meldung bearbeitet sein soll, JJJJ-MM-TT. */
  frist: string | null
  bewertung: Bewertung
  massnahmen: Massnahme[]
  verlauf: VerlaufEintrag[]
  /** Ergebnis beim Schließen — was gelernt oder geändert wurde, oder warum nichts. */
  abschluss: { am: string; von: string; text: string } | null
}

/** Ein Datensatz aus cirs_reports, so wie PocketBase ihn liefert. */
export interface CirsDatensatz {
  id: string
  title?: string
  created: string
  updated?: string
  status?: string
  organization_id?: string
  payload?: unknown
}

/** Eine Meldung mit ihrer Bearbeitung, fertig zum Anzeigen. */
export interface CirsFall {
  id: string
  nummer: string
  /** Wann die Meldung eingegangen ist (ISO). */
  eingang: string
  meldung: CirsMeldung
  bearbeitung: Bearbeitung
  status: string
}

/** Wer etwas tut und wann — jeder Bearbeitungsschritt trägt beides. */
export interface Schritt {
  wer: string
  am: Date
  /** Für neue Maßnahmen und Verlaufseinträge; im Test vorgegeben. */
  neueId?: () => string
}

// ── Lesen ───────────────────────────────────────────────────────────────────

/** Das payload eines Datensatzes als Objekt — manche kommen als JSON-Text. */
export function payloadLesen(roh: unknown): Record<string, unknown> {
  if (roh && typeof roh === 'object' && !Array.isArray(roh)) return roh as Record<string, unknown>
  if (typeof roh === 'string' && roh.trim()) {
    try {
      const p = JSON.parse(roh)
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
    } catch { /* kein JSON: wie leer behandeln */ }
  }
  return {}
}

const PHASE_WERTE = new Set<string>(PHASEN.map((p) => p.wert))
const SCHWERE_WERTE = new Set<string>(SCHWEREGRADE.map((s) => s.wert))
const HAEUFIGKEIT_WERTE = new Set<string>(HAEUFIGKEITEN.map((h) => h.wert))

function text(wert: unknown): string | undefined {
  return typeof wert === 'string' ? wert : undefined
}

const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/
const VERLAUF_ARTEN = new Set<string>(['phase', 'zustaendig', 'frist', 'bewertung', 'massnahme', 'notiz', 'abschluss'])

/** Ein Kalendertag JJJJ-MM-TT in einem Jahr, das man meinen kann — kein Zwischenstand beim Tippen wie 0002. */
export function gueltigerTag(wert: unknown): wert is string {
  if (typeof wert !== 'string' || !TAG_MUSTER.test(wert)) return false
  const [j, m, t] = wert.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t))
  return j >= 2000 && j <= 2099 && d.getUTCMonth() === m - 1 && d.getUTCDate() === t
}

function massnahmeLesen(x: any): Massnahme | null {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || typeof x.text !== 'string') return null
  return {
    id: x.id,
    text: x.text,
    verantwortlich: text(x.verantwortlich) || undefined,
    frist: gueltigerTag(x.frist) ? x.frist : undefined,
    erledigtAm: text(x.erledigtAm) || undefined,
    erledigtVon: text(x.erledigtAm) ? text(x.erledigtVon) || undefined : undefined,
    angelegtAm: text(x.angelegtAm) ?? '',
    angelegtVon: text(x.angelegtVon) ?? '',
  }
}

function eintragLesen(x: any): VerlaufEintrag | null {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || typeof x.text !== 'string') return null
  return { id: x.id, text: x.text, am: text(x.am) ?? '', von: text(x.von) ?? '', art: VERLAUF_ARTEN.has(x.art) ? x.art : 'notiz' }
}

/**
 * Die Bearbeitung aus dem payload — oder die Grundform, wenn noch niemand die
 * Meldung angefasst hat. Eine alte Meldung, die schon "erledigt" ist, gilt als
 * abgeschlossen; eine ohne Bearbeitung sonst als neu.
 *
 * Jedes Feld wird auf seinen Typ geprüft und sonst verworfen: was nicht passt,
 * soll die Ansicht nicht zum Absturz bringen.
 */
export function bearbeitungLesen(payload: Record<string, unknown>, status?: string): Bearbeitung {
  const b = payload.bearbeitung as Record<string, any> | undefined
  const grund: Bearbeitung = {
    v: 1,
    phase: status === 'erledigt' ? 'abgeschlossen' : 'neu',
    zustaendig: null,
    frist: null,
    bewertung: {},
    massnahmen: [],
    verlauf: [],
    abschluss: null,
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return grund
  let phase = PHASE_WERTE.has(b.phase) ? (b.phase as Phase) : grund.phase
  // Die alte Übersicht (dokumente-bearbeiten.html) schließt mit status "erledigt",
  // ohne die Bearbeitung zu kennen. Dann gilt der Status: geschlossen ist geschlossen.
  if (status === 'erledigt' && !istAbgeschlossen(phase)) phase = 'abgeschlossen'
  const z = b.zustaendig
  const bew = b.bewertung && typeof b.bewertung === 'object' ? b.bewertung : {}
  const ab = b.abschluss
  const abschluss = ab && typeof ab === 'object' && typeof ab.text === 'string'
    ? { am: text(ab.am) ?? '', von: text(ab.von) ?? '', text: ab.text }
    : null
  return {
    v: 1,
    phase,
    zustaendig: z && typeof z === 'object' && typeof z.id === 'string' ? { id: z.id, name: text(z.name) ?? '' } : null,
    frist: gueltigerTag(b.frist) ? b.frist : null,
    bewertung: {
      kategorie: text(bew.kategorie) || undefined,
      schwere: SCHWERE_WERTE.has(bew.schwere) ? bew.schwere : undefined,
      haeufigkeit: HAEUFIGKEIT_WERTE.has(bew.haeufigkeit) ? bew.haeufigkeit : undefined,
    },
    massnahmen: Array.isArray(b.massnahmen) ? b.massnahmen.map(massnahmeLesen).filter((x): x is Massnahme => !!x) : [],
    verlauf: Array.isArray(b.verlauf) ? b.verlauf.map(eintragLesen).filter((x): x is VerlaufEintrag => !!x) : [],
    // Ein Ergebnis gehört nur zu einer geschlossenen Meldung
    abschluss: istAbgeschlossen(phase) ? abschluss : null,
  }
}

/**
 * Die Bearbeitung eines Datensatzes.
 *
 * Die Meldeseite ist offen — wer will, kann beim Anlegen ein payload mit einer
 * erfundenen "bearbeitung" schicken (geschlossen, mit Verlauf auf fremden
 * Namen). Eine echte Bearbeitung entsteht aber nur durch ein späteres Update:
 * steht sie schon im Datensatz, wie er angelegt wurde (updated = created),
 * zählt sie nicht. Der Server-Hook pb_hooks/cirs.pb.js entfernt sie zusätzlich
 * gleich beim Anlegen.
 */
export function bearbeitungAus(rec: Pick<CirsDatensatz, 'payload' | 'status' | 'created' | 'updated'>): Bearbeitung {
  const payload = payloadLesen(rec.payload)
  const angelegt = zeitpunkt(rec.created)?.getTime()
  const geaendert = zeitpunkt(rec.updated)?.getTime()
  const unveraendert = angelegt !== undefined && geaendert !== undefined && Math.abs(geaendert - angelegt) < 2000
  if (unveraendert && payload.bearbeitung !== undefined) {
    const { bearbeitung: _verworfen, ...rest } = payload
    return bearbeitungLesen(rest, rec.status === 'erledigt' ? 'offen' : rec.status)
  }
  return bearbeitungLesen(payload, rec.status)
}

/** Die Meldung ohne die Bearbeitung — nur, was der Melder geschrieben hat. */
export function meldungLesen(payload: Record<string, unknown>): CirsMeldung {
  const m: CirsMeldung = {}
  for (const k of ['datum', 'ort', 'kategorie', 'schwere', 'was', 'warum', 'folgen', 'vorschlag', 'melder_name', 'melder_kontakt'] as const) {
    const w = payload[k]
    if (typeof w === 'string' && w.trim()) m[k] = w
  }
  return m
}

/** PocketBase schreibt "2026-10-09 21:38:00.123Z" — das Datum dazu. */
export function zeitpunkt(wert?: string | null): Date | null {
  if (!wert) return null
  const d = new Date(wert.includes(' ') && !wert.includes('T') ? wert.replace(' ', 'T') : wert)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Die Nummer, unter der die Meldung bekannt ist. Die Meldeseite zeigt sie dem
 * Melder nach dem Absenden — dieselbe Form, damit er sie wiederfindet.
 */
export function meldungsNummer(id: string, eingang: string): string {
  const jahr = zeitpunkt(eingang)?.getFullYear() ?? new Date().getFullYear()
  return `CIRS-${jahr}-${id.slice(0, 8)}`
}

export function fallAus(rec: CirsDatensatz): CirsFall {
  const payload = payloadLesen(rec.payload)
  return {
    id: rec.id,
    nummer: meldungsNummer(rec.id, rec.created),
    eingang: rec.created,
    meldung: meldungLesen(payload),
    bearbeitung: bearbeitungAus(rec),
    status: rec.status || 'offen',
  }
}

// ── Ableitungen ─────────────────────────────────────────────────────────────

export function istAbgeschlossen(phase: Phase): boolean {
  return phase === 'abgeschlossen' || phase === 'kein_handlungsbedarf'
}

/** Was ins alte Statusfeld gehört. */
export function statusFuer(phase: Phase): 'offen' | 'erledigt' {
  return istAbgeschlossen(phase) ? 'erledigt' : 'offen'
}

/** Kategorie und Schweregrad, wie sie gelten: die Bewertung vor der Meldung. */
export function geltendeKategorie(f: CirsFall): string | undefined {
  return f.bearbeitung.bewertung.kategorie || f.meldung.kategorie
}
export function geltendeSchwere(f: CirsFall): Schwere | undefined {
  const s = f.bearbeitung.bewertung.schwere || f.meldung.schwere
  return SCHWERE_WERTE.has(s ?? '') ? (s as Schwere) : undefined
}

const SCHWERE_PUNKTE: Record<Schwere, number> = { gering: 1, mittel: 2, hoch: 3 }
const HAEUFIGKEIT_PUNKTE: Record<Haeufigkeit, number> = { einmalig: 1, gelegentlich: 2, haeufig: 3 }

/**
 * Wie dringend die Meldung zu bearbeiten ist: Schweregrad mal Häufigkeit.
 *
 *              einmalig   gelegentlich   häufig
 *   gering     niedrig    niedrig        mittel
 *   mittel     niedrig    mittel         hoch
 *   hoch       mittel     hoch           hoch
 *
 * Ohne Angabe zur Häufigkeit zählt die Meldung als einmalig — sie wird nicht
 * dringlicher gemacht, als jemand sie eingeschätzt hat. Ohne Schweregrad gibt
 * es keine Priorität.
 */
export function prioritaet(schwere?: Schwere, haeufigkeit?: Haeufigkeit): Prioritaet | null {
  if (!schwere || !(schwere in SCHWERE_PUNKTE)) return null
  const punkte = SCHWERE_PUNKTE[schwere] * HAEUFIGKEIT_PUNKTE[haeufigkeit ?? 'einmalig']
  return punkte >= 6 ? 'hoch' : punkte >= 3 ? 'mittel' : 'niedrig'
}

export function fallPrioritaet(f: CirsFall): Prioritaet | null {
  return prioritaet(geltendeSchwere(f), f.bearbeitung.bewertung.haeufigkeit)
}

/** Der Kalendertag eines Zeitpunkts in Ortszeit, JJJJ-MM-TT. */
export function kalendertag(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

/** Liegt die Frist vor dem heutigen Tag? Am Fristtag selbst ist sie noch nicht überschritten. */
export function fristUeberschritten(frist: string | null | undefined, heute: Date): boolean {
  if (!frist || !/^\d{4}-\d{2}-\d{2}$/.test(frist)) return false
  return frist < kalendertag(heute)
}

/** Tage bis zur Frist — negativ, wenn sie überschritten ist. */
export function tageBisFrist(frist: string, heute: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frist)) return null
  const [j, m, t] = frist.split('-').map(Number)
  const ziel = Date.UTC(j, m - 1, t)
  const h = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate())
  return Math.round((ziel - h) / 86_400_000)
}

/** Ein Kalendertag einige Tage nach heute — für die schnellen Fristen. */
export function inTagen(heute: Date, tage: number): string {
  const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + tage)
  return kalendertag(d)
}

export function offeneMassnahmen(b: Bearbeitung): Massnahme[] {
  return b.massnahmen.filter((m) => !m.erledigtAm)
}

/**
 * Ist an der Meldung etwas überfällig? Ihre eigene Frist oder die einer noch
 * offenen Maßnahme. Abgeschlossenes ist nie überfällig.
 */
export function istUeberfaellig(f: CirsFall, heute: Date): boolean {
  const b = f.bearbeitung
  if (istAbgeschlossen(b.phase)) return false
  if (fristUeberschritten(b.frist, heute)) return true
  return offeneMassnahmen(b).some((m) => fristUeberschritten(m.frist, heute))
}

// ── Bearbeitungsschritte ────────────────────────────────────────────────────

let zaehler = 0
function id(s: Schritt): string {
  if (s.neueId) return s.neueId()
  zaehler = (zaehler + 1) % 1_000_000
  return `${s.am.getTime().toString(36)}${zaehler.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function eintrag(b: Bearbeitung, s: Schritt, art: VerlaufArt, text: string): Bearbeitung {
  return { ...b, verlauf: [...b.verlauf, { id: id(s), am: s.am.toISOString(), von: s.wer, art, text }] }
}

/**
 * Wer an einer neuen Meldung etwas tut, hat sie in Bewertung genommen. Das
 * spart einen Knopfdruck und lässt keine Meldung als "neu" stehen, an der
 * schon gearbeitet wird.
 */
function inBewertungNehmen(b: Bearbeitung, s: Schritt): Bearbeitung {
  if (b.phase !== 'neu') return b
  return eintrag({ ...b, phase: 'bewertung' }, s, 'phase', `Phase: ${phaseName('bewertung')}`)
}

export class CirsFehler extends Error {}

/**
 * Die Phase wechseln. Wer schließt — abgeschlossen oder kein
 * Handlungsbedarf —, muss sagen, mit welchem Ergebnis: ohne diesen Vermerk
 * lernt aus der Meldung niemand etwas.
 */
export function phaseSetzen(b: Bearbeitung, phase: Phase, s: Schritt, vermerk?: string): Bearbeitung {
  if (!PHASE_WERTE.has(phase)) throw new CirsFehler(`Unbekannte Phase: ${phase}`)
  if (b.phase === phase) return b
  const schliessen = istAbgeschlossen(phase)
  const v = vermerk?.trim() ?? ''
  if (schliessen && !v) throw new CirsFehler('Zum Abschließen gehört ein kurzer Vermerk zum Ergebnis.')
  let neu: Bearbeitung = { ...b, phase }
  if (schliessen) neu.abschluss = { am: s.am.toISOString(), von: s.wer, text: v }
  // Wieder geöffnet: das alte Ergebnis gilt nicht mehr — im Verlauf steht es weiter
  else neu.abschluss = null
  neu = eintrag(neu, s, 'phase', `Phase: ${phaseName(phase)}`)
  if (schliessen) neu = eintrag(neu, s, 'abschluss', v)
  else if (istAbgeschlossen(b.phase)) neu = eintrag(neu, s, 'notiz', v ? `Wieder geöffnet: ${v}` : 'Wieder geöffnet')
  return neu
}

export function zustaendigSetzen(b: Bearbeitung, person: Person | null, s: Schritt): Bearbeitung {
  if ((b.zustaendig?.id ?? null) === (person?.id ?? null)) return b
  const neu = inBewertungNehmen({ ...b, zustaendig: person }, s)
  return eintrag(neu, s, 'zustaendig', person ? `Zuständig: ${person.name}` : 'Zuständigkeit aufgehoben')
}

export function fristSetzen(b: Bearbeitung, frist: string | null, s: Schritt): Bearbeitung {
  const f = frist && gueltigerTag(frist) ? frist : null
  if (frist && !f) throw new CirsFehler('Die Frist ist kein gültiger Tag.')
  if (b.frist === f) return b
  const neu = inBewertungNehmen({ ...b, frist: f }, s)
  return eintrag(neu, s, 'frist', f ? `Frist: ${tagText(f)}` : 'Frist aufgehoben')
}

export function bewertungSetzen(b: Bearbeitung, bewertung: Bewertung, s: Schritt): Bearbeitung {
  const sauber: Bewertung = {
    kategorie: bewertung.kategorie || undefined,
    schwere: bewertung.schwere && SCHWERE_WERTE.has(bewertung.schwere) ? bewertung.schwere : undefined,
    haeufigkeit: bewertung.haeufigkeit && HAEUFIGKEIT_WERTE.has(bewertung.haeufigkeit) ? bewertung.haeufigkeit : undefined,
  }
  const alt = b.bewertung
  if (alt.kategorie === sauber.kategorie && alt.schwere === sauber.schwere && alt.haeufigkeit === sauber.haeufigkeit) return b
  const teile: string[] = []
  if (sauber.kategorie) teile.push(`Kategorie ${kategorieName(sauber.kategorie)}`)
  if (sauber.schwere) teile.push(`Schweregrad ${schwereName(sauber.schwere)}`)
  if (sauber.haeufigkeit) teile.push(`Häufigkeit ${haeufigkeitName(sauber.haeufigkeit)}`)
  const neu = inBewertungNehmen({ ...b, bewertung: sauber }, s)
  return eintrag(neu, s, 'bewertung', teile.length ? `Bewertet: ${teile.join(', ')}` : 'Bewertung zurückgesetzt')
}

/**
 * Eine Maßnahme anlegen. Eine Meldung, die noch neu oder in Bewertung ist,
 * hat damit Maßnahmen, die laufen.
 */
export function massnahmeHinzufuegen(
  b: Bearbeitung,
  m: { text: string; verantwortlich?: string; frist?: string },
  s: Schritt,
): Bearbeitung {
  const t = m.text.trim()
  if (!t) throw new CirsFehler('Die Maßnahme braucht einen Text.')
  if (m.frist && !gueltigerTag(m.frist)) throw new CirsFehler('Die Frist der Maßnahme ist kein gültiger Tag.')
  const massnahme: Massnahme = {
    id: id(s),
    text: t,
    verantwortlich: m.verantwortlich?.trim() || undefined,
    frist: m.frist || undefined,
    angelegtAm: s.am.toISOString(),
    angelegtVon: s.wer,
  }
  let neu: Bearbeitung = { ...b, massnahmen: [...b.massnahmen, massnahme] }
  neu = eintrag(neu, s, 'massnahme', `Maßnahme angelegt: ${t}`)
  if (neu.phase === 'neu' || neu.phase === 'bewertung') {
    neu = eintrag({ ...neu, phase: 'massnahmen' }, s, 'phase', `Phase: ${phaseName('massnahmen')}`)
  }
  return neu
}

export function massnahmeAbhaken(b: Bearbeitung, massnahmeId: string, erledigt: boolean, s: Schritt): Bearbeitung {
  const m = b.massnahmen.find((x) => x.id === massnahmeId)
  if (!m) throw new CirsFehler('Diese Maßnahme gibt es nicht mehr.')
  if (!!m.erledigtAm === erledigt) return b
  const geaendert: Massnahme = erledigt
    ? { ...m, erledigtAm: s.am.toISOString(), erledigtVon: s.wer }
    : { ...m, erledigtAm: undefined, erledigtVon: undefined }
  const neu = { ...b, massnahmen: b.massnahmen.map((x) => (x.id === massnahmeId ? geaendert : x)) }
  return eintrag(neu, s, 'massnahme', `${erledigt ? 'Maßnahme erledigt' : 'Maßnahme wieder offen'}: ${m.text}`)
}

/** Eine Maßnahme streichen — nur, solange sie nicht erledigt ist. Der Verlauf behält sie. */
export function massnahmeStreichen(b: Bearbeitung, massnahmeId: string, s: Schritt): Bearbeitung {
  const m = b.massnahmen.find((x) => x.id === massnahmeId)
  if (!m) return b
  if (m.erledigtAm) throw new CirsFehler('Eine erledigte Maßnahme bleibt stehen.')
  const neu = { ...b, massnahmen: b.massnahmen.filter((x) => x.id !== massnahmeId) }
  return eintrag(neu, s, 'massnahme', `Maßnahme gestrichen: ${m.text}`)
}

export function notizHinzufuegen(b: Bearbeitung, notiz: string, s: Schritt): Bearbeitung {
  const t = notiz.trim()
  if (!t) throw new CirsFehler('Die Notiz ist leer.')
  return eintrag(inBewertungNehmen(b, s), s, 'notiz', t)
}

/**
 * Was gespeichert wird: das payload, wie es gerade in der Datenbank steht, mit
 * der neuen Bearbeitung — die Angaben des Melders bleiben, wie sie sind.
 */
export function speicherDaten(frischesPayload: unknown, b: Bearbeitung): { payload: Record<string, unknown>; status: 'offen' | 'erledigt' } {
  const leer = frischesPayload === null || frischesPayload === undefined || (typeof frischesPayload === 'string' && !frischesPayload.trim())
  const gelesen = payloadLesen(frischesPayload)
  // Ein payload, das sich nicht lesen lässt, enthält trotzdem die Meldung — überschrieben wäre sie verloren
  if (!leer && Object.keys(gelesen).length === 0 && !(typeof frischesPayload === 'object' && !Array.isArray(frischesPayload))) {
    throw new CirsFehler('Diese Meldung liegt in einem unbekannten Format vor und wird nicht verändert.')
  }
  return { payload: { ...gelesen, bearbeitung: b }, status: statusFuer(b.phase) }
}

// ── Liste: Ansichten, Filter, Reihenfolge ───────────────────────────────────

export type Ansicht = 'offen' | 'neu' | 'meine' | 'ueberfaellig' | 'abgeschlossen' | 'alle'
export const ANSICHTEN: { wert: Ansicht; name: string }[] = [
  { wert: 'offen', name: 'Offen' },
  { wert: 'neu', name: 'Neu' },
  { wert: 'meine', name: 'Meine' },
  { wert: 'ueberfaellig', name: 'Überfällig' },
  { wert: 'abgeschlossen', name: 'Abgeschlossen' },
  { wert: 'alle', name: 'Alle' },
]

export interface Filter {
  ansicht: Ansicht
  suche?: string
  kategorie?: string
  schwere?: string
}

function passtZurAnsicht(f: CirsFall, ansicht: Ansicht, ich: string | undefined, heute: Date): boolean {
  const p = f.bearbeitung.phase
  switch (ansicht) {
    case 'offen': return !istAbgeschlossen(p)
    case 'neu': return p === 'neu'
    case 'meine': return !istAbgeschlossen(p) && !!ich && f.bearbeitung.zustaendig?.id === ich
    case 'ueberfaellig': return istUeberfaellig(f, heute)
    case 'abgeschlossen': return istAbgeschlossen(p)
    case 'alle': return true
  }
}

/** Kleinbuchstaben ohne Akzente — "Übergabe" findet "ubergabe" und "übergabe". */
function grob(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function passtZurSuche(f: CirsFall, suche: string): boolean {
  const woerter = grob(suche).split(/\s+/).filter(Boolean)
  if (!woerter.length) return true
  const m = f.meldung
  const heu = grob([
    f.nummer, m.ort, m.was, m.warum, m.folgen, m.vorschlag,
    kategorieName(geltendeKategorie(f)), f.bearbeitung.zustaendig?.name,
    ...f.bearbeitung.massnahmen.map((x) => x.text),
  ].filter(Boolean).join(' '))
  return woerter.every((w) => heu.includes(w))
}

export function filtern(faelle: CirsFall[], filter: Filter, ich: string | undefined, heute: Date): CirsFall[] {
  return faelle.filter((f) =>
    passtZurAnsicht(f, filter.ansicht, ich, heute)
    && (!filter.kategorie || geltendeKategorie(f) === filter.kategorie)
    && (!filter.schwere || geltendeSchwere(f) === filter.schwere)
    && (!filter.suche || passtZurSuche(f, filter.suche)))
}

export function zaehlen(faelle: CirsFall[], ich: string | undefined, heute: Date): Record<Ansicht, number> {
  const z = { offen: 0, neu: 0, meine: 0, ueberfaellig: 0, abgeschlossen: 0, alle: 0 } as Record<Ansicht, number>
  for (const f of faelle) for (const a of ANSICHTEN) if (passtZurAnsicht(f, a.wert, ich, heute)) z[a.wert]++
  return z
}

const PRIO_RANG: Record<Prioritaet, number> = { hoch: 0, mittel: 1, niedrig: 2 }

function eingangZeit(f: CirsFall): number {
  return zeitpunkt(f.eingang)?.getTime() ?? 0
}

/**
 * Reihenfolge der Liste. Offenes zuerst; darin Überfälliges, dann Neues,
 * dann nach Priorität, zuletzt das jüngste vorn. Abgeschlossenes danach,
 * das zuletzt geschlossene vorn.
 */
export function sortieren(faelle: CirsFall[], heute: Date): CirsFall[] {
  const schluessel = (f: CirsFall) => {
    const zu = istAbgeschlossen(f.bearbeitung.phase)
    const prio = fallPrioritaet(f)
    return {
      zu: zu ? 1 : 0,
      ueber: !zu && istUeberfaellig(f, heute) ? 0 : 1,
      neu: !zu && f.bearbeitung.phase === 'neu' ? 0 : 1,
      prio: prio ? PRIO_RANG[prio] : 3,
      zeit: zu ? (zeitpunkt(f.bearbeitung.abschluss?.am)?.getTime() ?? eingangZeit(f)) : eingangZeit(f),
    }
  }
  return faelle
    .map((f) => ({ f, k: schluessel(f) }))
    .sort((a, b) => a.k.zu - b.k.zu
      || (a.k.zu ? 0 : a.k.ueber - b.k.ueber || a.k.neu - b.k.neu || a.k.prio - b.k.prio)
      || b.k.zeit - a.k.zeit)
    .map((x) => x.f)
}

// ── Auswertung ──────────────────────────────────────────────────────────────

export interface Auswertung {
  gesamt: number
  offen: number
  abgeschlossen: number
  keinHandlungsbedarf: number
  ueberfaellig: number
  /** Mittlere Tage von Eingang bis Abschluss, über die Meldungen mit Abschlussvermerk. */
  mittlereDauerTage: number | null
  nachKategorie: { wert: string; name: string; anzahl: number }[]
  nachSchwere: { wert: string; name: string; anzahl: number }[]
  nachMonat: { monat: string; name: string; anzahl: number }[]
  massnahmen: { gesamt: number; erledigt: number }
}

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Die Meldungen, die im Zeitraum eingegangen sind (von einschließlich, bis ausschließlich). */
export function imZeitraum(faelle: CirsFall[], von: Date | null, bis: Date | null): CirsFall[] {
  return faelle.filter((f) => {
    const t = eingangZeit(f)
    return (!von || t >= von.getTime()) && (!bis || t < bis.getTime())
  })
}

/**
 * Zahlen über die Meldungen, die man ihr gibt. Den Zeitraum wählt vorher
 * imZeitraum und gibt ihn hier mit: die Monatsreihe reicht dann über den
 * ganzen Zeitraum (bis höchstens heute), auch über Monate ohne Meldung — eine
 * Pause am Anfang oder Ende soll so sichtbar sein wie eine in der Mitte. Ohne
 * Zeitraum reicht sie vom ersten Monat mit einer Meldung bis heute.
 */
export function auswerten(faelle: CirsFall[], heute: Date, zeitraum?: { von: Date | null; bis: Date | null }): Auswertung {
  const kat = new Map<string, number>()
  const sch = new Map<string, number>()
  const mon = new Map<string, number>()
  let offen = 0, abgeschlossen = 0, keinHB = 0, ueber = 0, mGesamt = 0, mErledigt = 0
  const dauern: number[] = []
  for (const f of faelle) {
    const p = f.bearbeitung.phase
    if (p === 'abgeschlossen') abgeschlossen++
    else if (p === 'kein_handlungsbedarf') keinHB++
    else offen++
    if (istUeberfaellig(f, heute)) ueber++
    const k = geltendeKategorie(f) || 'ohne'
    kat.set(k, (kat.get(k) ?? 0) + 1)
    const s = geltendeSchwere(f) || 'ohne'
    sch.set(s, (sch.get(s) ?? 0) + 1)
    const e = zeitpunkt(f.eingang)
    if (e) {
      const schl = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}`
      mon.set(schl, (mon.get(schl) ?? 0) + 1)
    }
    const ab = zeitpunkt(f.bearbeitung.abschluss?.am)
    if (istAbgeschlossen(p) && ab && e) dauern.push(Math.max(0, (ab.getTime() - e.getTime()) / 86_400_000))
    mGesamt += f.bearbeitung.massnahmen.length
    mErledigt += f.bearbeitung.massnahmen.filter((m) => m.erledigtAm).length
  }
  const nachKategorie = [...KATEGORIEN.map((k) => ({ wert: k.wert as string, name: k.name })), { wert: 'ohne', name: 'Ohne Angabe' }]
    .map((k) => ({ ...k, anzahl: kat.get(k.wert) ?? 0 }))
  // Kategorien, die der Katalog nicht kennt (alte Meldungen), nicht verschlucken
  for (const [wert, anzahl] of kat) if (!nachKategorie.some((k) => k.wert === wert)) nachKategorie.push({ wert, name: wert, anzahl })
  const nachSchwere = [...SCHWEREGRADE.map((s) => ({ wert: s.wert as string, name: s.name })), { wert: 'ohne', name: 'Ohne Angabe' }]
    .map((s) => ({ ...s, anzahl: sch.get(s.wert) ?? 0 }))
  const schluessel = [...mon.keys()].sort()
  const nachMonat: Auswertung['nachMonat'] = []
  if (schluessel.length) {
    const ende = zeitraum?.bis && zeitraum.bis.getTime() - 1 < heute.getTime() ? new Date(zeitraum.bis.getTime() - 1) : heute
    const erster = schluessel[0].split('-').map(Number)
    let [j, m] = zeitraum?.von ? [zeitraum.von.getFullYear(), zeitraum.von.getMonth() + 1] : erster
    if (j > erster[0] || (j === erster[0] && m > erster[1])) [j, m] = erster
    let [ej, em] = [ende.getFullYear(), ende.getMonth() + 1]
    const letzter = schluessel[schluessel.length - 1].split('-').map(Number)
    if (ej < letzter[0] || (ej === letzter[0] && em < letzter[1])) [ej, em] = letzter
    while (j < ej || (j === ej && m <= em)) {
      const s = `${j}-${String(m).padStart(2, '0')}`
      nachMonat.push({ monat: s, name: `${MONATE[m - 1]} ${String(j).slice(2)}`, anzahl: mon.get(s) ?? 0 })
      m++; if (m > 12) { m = 1; j++ }
    }
  }
  return {
    gesamt: faelle.length,
    offen,
    abgeschlossen,
    keinHandlungsbedarf: keinHB,
    ueberfaellig: ueber,
    mittlereDauerTage: dauern.length ? Math.round((dauern.reduce((a, b) => a + b, 0) / dauern.length) * 10) / 10 : null,
    nachKategorie: nachKategorie.filter((k) => k.anzahl > 0 || k.wert !== 'ohne'),
    nachSchwere: nachSchwere.filter((s) => s.anzahl > 0 || s.wert !== 'ohne'),
    nachMonat,
    massnahmen: { gesamt: mGesamt, erledigt: mErledigt },
  }
}

// ── Ausgabe ─────────────────────────────────────────────────────────────────

/** "2026-10-13" → "13.10.2026". */
export function tagText(tag?: string | null): string {
  if (!tag) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tag)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : tag
}

export function zeitText(wert?: string | null): string {
  const d = zeitpunkt(wert)
  return d ? d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

function csvFeld(wert: unknown): string {
  const s = String(wert ?? '').replace(/\r\n?/g, '\n')
  // Formeln nicht ausführen lassen: Excel liest "=…", "+…", "-…", "@…" sonst als Rechnung
  const sicher = /^[=+\-@\t]/.test(s) ? `'${s}` : s
  return /[;"\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher
}

/**
 * Die Liste als CSV für Excel (Semikolon, mit BOM für die Umlaute).
 *
 * Name und Kontakt des Melders stehen nicht darin: die Datei wandert weiter,
 * als die Meldung es sollte.
 */
export function csv(faelle: CirsFall[], heute: Date): string {
  const kopf = ['Nummer', 'Eingang', 'Ereignis am', 'Ort', 'Kategorie', 'Schweregrad', 'Häufigkeit', 'Priorität', 'Phase',
    'Zuständig', 'Frist', 'Überfällig', 'Maßnahmen offen', 'Maßnahmen gesamt', 'Abgeschlossen am', 'Ergebnis', 'Was ist passiert']
  const zeilen = faelle.map((f) => {
    const b = f.bearbeitung
    return [
      f.nummer, zeitText(f.eingang), tagText(f.meldung.datum), f.meldung.ort ?? '',
      kategorieName(geltendeKategorie(f)), schwereName(geltendeSchwere(f)), b.bewertung.haeufigkeit ? haeufigkeitName(b.bewertung.haeufigkeit) : '',
      fallPrioritaet(f) ?? '', phaseName(b.phase), b.zustaendig?.name ?? '', tagText(b.frist), istUeberfaellig(f, heute) ? 'ja' : 'nein',
      offeneMassnahmen(b).length, b.massnahmen.length,
      istAbgeschlossen(b.phase) && b.abschluss ? zeitText(b.abschluss.am) : '', istAbgeschlossen(b.phase) ? b.abschluss?.text ?? '' : '', f.meldung.was ?? '',
    ]
  })
  return '﻿' + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(';')).join('\r\n')
}
