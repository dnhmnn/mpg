// Teil D (Bauplan v2, 3.3, 4.9, 4.10): Texte und reine Regeln für die
// Einstellung unter Vorgänge, für Unitas („Wartet auf deine Unterschrift“,
// „Neues Protokoll“) und für die Patientenverwaltung („Ohne Unterschrift
// abschließen“, Selbstfreigabe, Mannschaft nachtragen).
//
// Wer was darf, entscheidet der Server (pb_hooks/formular-regeln.js); die
// Rechte für die Anzeige stehen in ./absender.ts. Hier steht nur, was die
// Seiten zeigen und wie sie ihre Listen bilden. Keine Imports aus React oder
// PocketBase (nur Typen): die Prüffälle laufen ohne DOM
// (src/lib/__tests__/formularVerwaltung.test.ts).

import {
  absenderAusObjekt, absenderLesen, fristEndeVon, jsonLesen, wartetAufUnterschrift,
  type AbsenderAbschluss, type AbsenderModus, type FormularId,
} from './absender'
import type { MitgliederPruefung, PruefGrund, Unterschrift } from './api'
import { besatzungLesen, besatzungSetzen, POSTEN, type Posten } from '../../pages/public/doku/besatzung'

function objekt(roh: unknown): Record<string, unknown> | null {
  const w = jsonLesen(roh)
  return w && typeof w === 'object' && !Array.isArray(w) ? w as Record<string, unknown> : null
}

/** Zeitpunkt aus ISO oder dem PocketBase-Format „2026-10-31 13:20:05.120Z“ (Leerzeichen statt T); NaN, wenn unlesbar. */
export function zeitpunkt(text: unknown): number {
  if (typeof text !== 'string' || !text) return NaN
  return Date.parse(text.replace(' ', 'T'))
}

/** „31.10.2026“; leer, wenn unlesbar. */
export function datumText(text: unknown): string {
  const t = zeitpunkt(text)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** „31. Oktober“ wie die übrigen Karten in Unitas; leer, wenn unlesbar. */
export function datumLang(text: unknown): string {
  const t = zeitpunkt(text)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })
}

// ── Vorgänge → Formulare → Standardformulare (3.3, 3.4) ──────────────────────

/** Die beiden Wahlknöpfe des Absenders, ihre Erklärung und die Anzeige ohne Schreibrecht. */
export const ABSENDER_WAHL: Record<AbsenderModus, { knopf: string; erklaerung: string; anzeige: string }> = {
  passwort: {
    knopf: 'Mitglied mit Passwort',
    erklaerung: 'Der Absender tippt seinen vollen Namen und bestätigt mit seinem Passwort. Angemeldete Mitglieder brauchen kein Passwort.',
    anzeige: 'Absender: Mitglied mit Passwort',
  },
  frei: {
    knopf: 'Name frei eintragen',
    erklaerung: 'Der Absender trägt seinen Namen ein. Passt er genau auf ein Mitglied, wird er verknüpft und als nicht bestätigt markiert.',
    anzeige: 'Absender: Name frei eintragen',
  },
}

/** Reihenfolge der Wahlknöpfe. */
export const ABSENDER_MODI: AbsenderModus[] = ['passwort', 'frei']

/** Feste Sätze der Karten unter Vorgänge. */
export const VORGAENGE_TEXTE = {
  abschnitt: 'Absender',
  cirs: 'Anonym, ohne Absender.',
  ohneSchreibrecht: 'Ändern darf, wer Vorgänge oder die Benutzerverwaltung verwaltet.',
  alleKoennen: 'Alle Mitglieder können mit Passwort bestätigen.',
  anzeigen: 'Anzeigen',
  ausblenden: 'Ausblenden',
  hinweisBenutzer: 'Ändern lässt sich das in der Benutzerverwaltung.',
  zurBenutzerverwaltung: 'Zur Benutzerverwaltung',
  gespeichert: 'Gespeichert',
  /** Patientendoku mit ausgeschaltetem öffentlichem Link: angemeldet geht es weiter (PO-Entscheidung 3). */
  patientenOeffentlichAus: 'Öffentlicher Link aus. Angemeldet über „Neues Protokoll“ in Unitas weiter möglich.',
  /** Produktausgabe und Defektmeldung mit ausgeschaltetem öffentlichem Link: angemeldete Mitglieder senden weiter. */
  angemeldetOeffentlichAus: 'Öffentlicher Link aus. Angemeldete Mitglieder senden über Link oder QR-Code weiter.',
  /** CIRS und eigene Formulare mit ausgeschaltetem Link: ganz aus (kein angemeldeter Weg). */
  formularAus: 'Aus, auch über Links und QR-Codes nicht erreichbar',
} as const

/** Zeile unter einer ausgeschalteten Formular-Karte: was mit Anmeldung weiter geht (wie angemeldetTrotzAusgeschaltet). */
export function ausgeschaltetText(formId: string): string {
  if (formId === 'patienten') return VORGAENGE_TEXTE.patientenOeffentlichAus
  if (formId === 'produktausgabe' || formId === 'defektmeldung') return VORGAENGE_TEXTE.angemeldetOeffentlichAus
  return VORGAENGE_TEXTE.formularAus
}

/** Zeile der Zählung im Modus Passwort (Name unvollständig, ohne E-Mail); 0 heißt: alle können. */
export function koennenNichtText(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return VORGAENGE_TEXTE.alleKoennen
  if (n === 1) return 'Ein Mitglied kann nicht mit Passwort bestätigen.'
  return `${n} Mitglieder können nicht mit Passwort bestätigen.`
}

/**
 * Zeile zu doppelten Namen; leer bei 0. Sie bestätigen mit Passwort (der Server prüft jeden
 * Kandidaten), werden aber in der Besatzung nicht erkannt und können nicht ohne Passwort
 * („Unterschrift ausstehend“) senden.
 */
export function doppeltText(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n === 1) return 'Ein Mitglied trägt einen Namen, den es mehrfach gibt. Mit Passwort bestätigt es, in der Besatzung und ohne Passwort wird es nicht erkannt.'
  return `${n} Mitglieder tragen Namen, die es mehrfach gibt. Mit Passwort bestätigen sie, in der Besatzung und ohne Passwort werden sie nicht erkannt.`
}

/** Hat die Prüfung etwas zu zeigen (nicht bestätigen können oder doppelt)? */
export function pruefungZeigen(p: MitgliederPruefung | null): boolean {
  return !!p && (p.koennen_nicht > 0 || (p.doppelt ?? 0) > 0)
}

/** Gründe der Mitglieder-Prüfung in Worten (1.9). */
export const PRUEF_GRUND_TEXT: Record<PruefGrund, string> = {
  name_unvollstaendig: 'Name unvollständig',
  name_doppelt: 'Name doppelt',
  ohne_email: 'ohne E-Mail, kein Passwort',
}

/** „Anna · Name unvollständig“; mehrere Gründe mit „·“ getrennt, ohne Namen „Ohne Namen“. */
export function pruefEintragText(e: { name: string; gruende: PruefGrund[] }): string {
  const name = String(e.name ?? '').trim() || 'Ohne Namen'
  const gruende = (e.gruende ?? []).map((g) => PRUEF_GRUND_TEXT[g]).filter(Boolean)
  return [name, ...gruende].join(' · ')
}

/** Die Einträge der Prüfung, nach Namen sortiert (deutsch), nur die mit mindestens einem Grund. */
export function pruefEintraege(p: MitgliederPruefung | null): MitgliederPruefung['eintraege'] {
  if (!p) return []
  return p.eintraege
    .filter((e) => e.gruende.length > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'de-DE'))
}

/** Unter welchen Karten die Absender-Wahl steht (CIRS bleibt anonym). */
export function hatAbsenderWahl(formId: string): formId is FormularId {
  return formId === 'patienten' || formId === 'produktausgabe' || formId === 'defektmeldung'
}

/** Kennung der Karte aus `?karte=` (nur die Standardformulare), sonst ''. */
export function karteAusSuche(wert: string | null): string {
  const w = String(wert ?? '')
  return ['patienten', 'produktausgabe', 'defektmeldung', 'cirs'].includes(w) ? w : ''
}

/** Reiter unter Vorgänge: CIRS nur mit Modul Vorgänge, der Feld-Editor nur mit Patienten (3.4). */
export function vorgaengeReiter(o: { vorgaengeFrei: boolean; patientenFrei: boolean }): ('formulare' | 'editor' | 'cirs')[] {
  return ['formulare', ...(o.patientenFrei ? ['editor' as const] : []), ...(o.vorgaengeFrei ? ['cirs' as const] : [])]
}

// ── Unitas (4.9) ─────────────────────────────────────────────────────────────

export const UNITAS_TEXTE = {
  neuesProtokoll: 'Neues Protokoll',
  wartetTitel: 'Wartet auf deine Unterschrift',
  statLabel: 'Unterschriften',
  /** Plural; für die Zahl selbst `statText(n)`. */
  statText: 'warten auf dich',
  ansehen: 'Ansehen',
  zuklappen: 'Zuklappen',
  unterschreiben: 'Unterschreiben',
  unterschrieben: 'Unterschrieben',
  keinProtokoll: 'Mit diesem Konto lässt sich kein Protokoll absenden.',
} as const

/** Satz unter der Zahl der Stat-Karte „Unterschriften“: „wartet auf dich“ bei einer, sonst „warten auf dich“. */
export function statText(n: number): string {
  return n === 1 ? 'wartet auf dich' : 'warten auf dich'
}

/** Die offenen Unterschriften je Formular, Reihenfolge des Servers (neueste zuerst). */
export function unterschriftenNach(liste: Unterschrift[] | null | undefined): Record<FormularId, Unterschrift[]> {
  const aus: Record<FormularId, Unterschrift[]> = { patienten: [], produktausgabe: [], defektmeldung: [] }
  for (const u of liste ?? []) if (aus[u.formular]) aus[u.formular].push(u)
  return aus
}

/** Titel einer wartenden Unterschrift: der Titel des Servers, sonst je Formular ein Rückfall. */
export function unterschriftTitel(u: Unterschrift): string {
  const t = String(u.titel ?? '').trim()
  if (t) return t
  return u.formular === 'patienten' ? 'Protokoll' : u.formular === 'produktausgabe' ? 'Produktausgabe' : 'Defektmeldung'
}

/**
 * Wird angestoßen, läuft höchstens alle `ms` Millisekunden, nachlaufend: ein
 * Anstoß innerhalb der Wartezeit führt zu genau einem Lauf an ihrem Ende.
 * `sofort` läuft gleich (Einhängen, nach dem Unterschreiben) und beginnt die
 * Wartezeit neu. So holt Unitas die Liste der Unterschriften nicht bei jedem
 * Realtime-Ereignis (Befund 22).
 */
export function gedrosselt(
  lauf: () => void,
  ms: number,
  uhr: { jetzt: () => number; spaeter: (f: () => void, ms: number) => unknown; abbrechen: (h: unknown) => void } = {
    jetzt: () => Date.now(),
    spaeter: (f, n) => setTimeout(f, n),
    abbrechen: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
): { anstossen: () => void; sofort: () => void; stoppen: () => void } {
  let zuletzt = Number.NEGATIVE_INFINITY
  let wartet: unknown = null
  const laufen = () => { wartet = null; zuletzt = uhr.jetzt(); lauf() }
  return {
    anstossen() {
      if (wartet !== null) return
      const rest = zuletzt + ms - uhr.jetzt()
      if (rest <= 0) laufen()
      else wartet = uhr.spaeter(laufen, rest)
    },
    sofort() {
      if (wartet !== null) { uhr.abbrechen(wartet); wartet = null }
      laufen()
    },
    stoppen() {
      if (wartet !== null) { uhr.abbrechen(wartet); wartet = null }
    },
  }
}

// ── Dialoge (4.9, 4.10) ──────────────────────────────────────────────────────

/** Was die Person mit „Unterschreiben“ bestätigt, je Formular. */
export const UNTERSCHREIBEN_TEXT: Record<FormularId, string> = {
  patienten: 'Du bestätigst, dass du dieses Protokoll abgegeben hast. Danach hast du einen Tag Zeit für Änderungen.',
  produktausgabe: 'Du bestätigst, dass du diese Produktausgabe abgegeben hast.',
  defektmeldung: 'Du bestätigst, dass du diese Meldung abgegeben hast.',
}

/** „Das war ich nicht“: was danach mit dem Eintrag geschieht, je Formular (Rückfrage im Dialog). */
export const ZURUECKWEISEN_TEXT: Record<FormularId, string> = {
  patienten: 'Du gibst an, dieses Protokoll nicht abgegeben zu haben. Es verschwindet aus deiner Liste. Die Leitung schließt es ohne deine Unterschrift ab.',
  produktausgabe: 'Du gibst an, diese Produktausgabe nicht abgegeben zu haben. Sie verschwindet aus deiner Liste und steht danach ohne Konto unter dem eingetragenen Namen.',
  defektmeldung: 'Du gibst an, diese Meldung nicht abgegeben zu haben. Sie verschwindet aus deiner Liste und steht danach ohne Konto unter dem eingetragenen Namen. Der Defekt selbst bleibt gemeldet.',
}

/** Nach „Das war ich nicht“: was jetzt geschieht. */
export const ZURUECKGEWIESEN_TEXT: Record<FormularId, string> = {
  patienten: 'Erledigt. Die Leitung ist informiert und schließt das Protokoll ohne deine Unterschrift ab.',
  produktausgabe: 'Erledigt. Die Produktausgabe ist nicht mehr mit deinem Konto verknüpft.',
  defektmeldung: 'Erledigt. Die Meldung ist nicht mehr mit deinem Konto verknüpft.',
}

/** Zeile in der Patientenverwaltung und über der Maske: die genannte Person hat zurückgewiesen. */
export function zurueckgewiesenZeile(name: string): string {
  const n = String(name ?? '').trim() || 'Die genannte Person'
  return `${n} hat angegeben, dieses Protokoll nicht abgegeben zu haben. Bitte ohne Unterschrift abschließen.`
}

export const DIALOG_TEXTE = {
  unterschreibenTitel: 'Unterschreiben',
  warIchNicht: 'Das war ich nicht',
  warIchNichtHinweis: 'Nicht von dir abgegeben? Dann nicht unterschreiben, sondern „Das war ich nicht“ wählen.',
  zurueck: 'Zurück',
  weistZurueck: 'Wird gesendet …',
  unterschreiben: 'Unterschreiben',
  unterschreibt: 'Unterschreibt …',
  unterschrieben: 'Unterschrieben.',
  abbrechen: 'Abbrechen',
  schliessen: 'Schließen',
  ohneTitel: 'Ohne Unterschrift abschließen',
  abschliessen: 'Abschließen',
  schliesstAb: 'Schließt ab …',
  abgeschlossen: 'Ohne Unterschrift abgeschlossen.',
  grundLabel: 'Grund',
  grundPlatzhalter: 'Warum ohne Unterschrift? Etwa: Absender ist nicht mehr im Dienst.',
  grundZuKurz: 'Bitte einen Grund angeben, mindestens 10 Zeichen.',
} as const

/** Grenzen der Begründung, wie der Server sie prüft (Zwilling von GRUND_MIN/GRUND_MAX in ./api.ts). */
export const GRUND_MIN = 10
export const GRUND_MAX = 500

/** „Das Protokoll wird abgeschlossen, ohne dass {Name} bestätigt hat. …“; ohne Namen „der Absender“. */
export function ohneUnterschriftErklaerung(name: string): string {
  const n = String(name ?? '').trim() || 'der Absender'
  return `Das Protokoll wird abgeschlossen, ohne dass ${n} bestätigt hat. Es bleibt als nicht bestätigt gekennzeichnet. `
    + 'Die Besatzung steht nur als Namen darin; verknüpfen lässt sie sich danach unter „Freigegeben“ mit „Mannschaft nachtragen“.'
}

/**
 * „Mannschaft nachtragen“ anbieten? Solange es nicht auf die Unterschrift wartet und kein
 * Teamführer verknüpft ist: offen wie bisher, freigegeben nur nach „Ohne Unterschrift
 * abschließen“ (dort steht die Besatzung nur als Namen, Plan 1.8).
 */
export function mannschaftNachtragenZeigen(satz: { status?: unknown; payload?: unknown; absender_status?: unknown }): boolean {
  const p = objekt(satz.payload)
  if (!p) return false
  const m = objekt(p.mannschaft)
  const tf = m ? objekt(m.tf) : null
  if (tf && typeof tf.id === 'string' && tf.id) return false
  const a = absenderLesen(satz as Record<string, unknown>, 'patients')
  if (a?.status === 'ausstehend') return false
  if (satz.status === 'offen') return true
  return satz.status === 'freigegeben' && a?.status === 'ohne_unterschrift'
}

/** Die Begründung prüfen wie der Server (getrimmt 10 bis 500 Zeichen) und den Zähler dazu. */
export function grundPruefen(grund: string): { laenge: number; gueltig: boolean; zaehler: string } {
  const laenge = String(grund ?? '').trim().length
  const gueltig = laenge >= GRUND_MIN && laenge <= GRUND_MAX
  const zaehler = laenge < GRUND_MIN
    ? `${laenge} von mindestens ${GRUND_MIN} Zeichen`
    : `${laenge} von höchstens ${GRUND_MAX} Zeichen`
  return { laenge, gueltig, zaehler }
}

// ── Patientenverwaltung (4.10) ───────────────────────────────────────────────

/**
 * Soll die Patientenverwaltung ein offenes Protokoll selbst freigeben? Nur,
 * wenn es nicht auf eine Unterschrift wartet und seine Frist (`payload.frist`,
 * sonst Anlegen + 24 Stunden) vorbei ist. Ohne lesbare Frist nie.
 */
export function selbstFreigabeFaellig(payload: unknown, angelegt: string, jetzt = Date.now()): boolean {
  if (wartetAufUnterschrift(payload)) return false
  const ende = fristEndeVon(payload, angelegt)
  return ende > 0 && ende <= jetzt
}

/** Der Abschluss ohne Unterschrift aus dem payload, oder null. */
export function abschlussLesen(payload: unknown): AbsenderAbschluss | null {
  const p = objekt(payload)
  const a = p ? absenderAusObjekt(p.absender) : null
  return a && a.status === 'ohne_unterschrift' && a.abschluss ? a.abschluss : null
}

/** „Ohne Unterschrift abgeschlossen von {Name} am {Datum}. Grund: {grund}“ */
export function abschlussZeile(a: AbsenderAbschluss): string {
  const wer = String(a.name ?? '').trim()
  const am = datumText(a.am)
  const grund = String(a.grund ?? '').trim()
  return `Ohne Unterschrift abgeschlossen${wer ? ` von ${wer}` : ''}${am ? ` am ${am}` : ''}.${grund ? ` Grund: ${grund}` : ''}`
}

/** Hinweis an „Archivieren mit Unterschrift“, solange ein Protokoll auf die Unterschrift wartet. */
export const WARTET_HINWEIS = 'Wartet auf die Unterschrift des Absenders.'

type Person = { id?: unknown; name?: unknown } | null | undefined
type Pos = Posten['pos']

/**
 * „Mannschaft nachtragen“: die gewählten Posten setzen, verschachtelt und flach
 * zugleich (`besatzungSetzen`, Befund 9), die anderen unverändert lassen. Der
 * Server behält eine Kennung nur, wenn flacher und verschachtelter Name
 * zusammenpassen und die Anfrage von einem Mitglied kommt (2.5).
 */
export function mannschaftNachtragen<T extends Record<string, unknown>>(payload: T, gewaehlt: Partial<Record<Pos, Person>>): T {
  let aus: Record<string, unknown> = payload
  for (const p of POSTEN) {
    const g = gewaehlt[p.pos]
    const id = g && typeof g.id === 'string' ? g.id : ''
    const name = g && typeof g.name === 'string' ? g.name.trim() : ''
    if (id && name) aus = besatzungSetzen(aus, p.pos, { id, name })
  }
  return aus as T
}

/** Die Besatzung als Zeile, flache Namen zuerst (`besatzungLesen`); payload als Objekt, Text oder doppelt kodiert. */
export function besatzungZeile(payload: unknown, trenner = ' · '): string {
  const b = besatzungLesen(objekt(payload) ?? {})
  return POSTEN.map((p) => b[p.pos]?.name ?? '').filter(Boolean).join(trenner)
}
