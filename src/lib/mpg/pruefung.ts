// Ergebnis einer Geräteprüfung — aus den Prüfpunkten, nicht frei gewählt.
//
// - BESTANDEN gibt es nur, wenn jeder Prüfpunkt abgehakt ist.
// - MANGEL: das Gerät bleibt einsatzbereit, der Mangel wird als Defekt (gering)
//   festgehalten. Bemerkung ist Pflicht.
// - NICHT BESTANDEN: Defekt (hoch) und Sperre. Bemerkung ist Pflicht.
//
// Gespeichert wird weiter in mpg_inspections (passed: ja/nein). Ein Mangel ist
// passed = true mit offenen Punkten oder dem Vermerk MANGEL_VERMERK in den Notizen.
//
// Punkte mit `status` (Prüfseite ab Paket 2) werden je Punkt entschieden: „offen“, „i.O.“
// oder „Mangel“ (mit Notiz am Punkt). Ohne `status` (ältere Entwürfe, gespeicherte
// Protokolle) gilt weiter: nicht abgehakt = nicht in Ordnung.
//
// Prüffälle: src/lib/mpg/selbsttest.ts

export type PunktStatus = 'offen' | 'ok' | 'mangel'

export interface Pruefpunkt { item: string; checked: boolean; note: string; status?: PunktStatus }

/** Punkt setzen — `checked` bleibt für ältere Leser (Logbuch, Hub, alte App-Stände) stimmig. */
export function setzePunkt(p: Pruefpunkt, status: PunktStatus): Pruefpunkt {
  return { ...p, status, checked: status === 'ok' }
}

/**
 * „Übrige in Ordnung“: setzt nur die noch offenen Punkte auf i.O. — ein schon erfasster
 * Mangel samt Notiz bleibt stehen.
 */
export function restInOrdnung(punkte: Pruefpunkt[]): Pruefpunkt[] {
  return punkte.map(p => (p.status ?? (p.checked ? 'ok' : 'offen')) === 'offen' ? setzePunkt(p, 'ok') : p)
}

/** Noch nicht entschiedene Punkte (nur bei Punkten mit Status). */
export function unentschiedenePunkte(punkte: Pruefpunkt[]): Pruefpunkt[] {
  return punkte.filter(p => p.status === 'offen')
}

export type PruefErgebnis = 'bestanden' | 'mangel' | 'nicht_bestanden'

export const ERGEBNIS_TEXT: Record<PruefErgebnis, string> = {
  bestanden: 'Bestanden', mangel: 'Mangel', nicht_bestanden: 'Nicht bestanden',
}

export const MANGEL_VERMERK = 'Mangel festgestellt: '

export function offenePunkte(punkte: Pruefpunkt[]): Pruefpunkt[] {
  return punkte.filter(p => !p.checked)
}

export interface Wahl {
  bestanden: boolean
  mangel: boolean
  nicht_bestanden: boolean
  /** Warum „Bestanden“ nicht geht bzw. was für die anderen fehlt */
  hinweis: string
}

/** Welche Ergebnisse sind mit diesen Punkten und dieser Bemerkung zulässig? */
export function moeglicheErgebnisse(punkte: Pruefpunkt[], bemerkung: string): Wahl {
  if (punkte.some(p => p.status)) return moeglicheErgebnisseJePunkt(punkte, bemerkung)
  const offen = offenePunkte(punkte).length
  const mitBemerkung = bemerkung.trim().length > 0
  const bestanden = punkte.length > 0 && offen === 0
  let hinweis = ''
  if (!punkte.length) hinweis = 'Die Prüfvorlage hat keine Prüfpunkte.'
  else if (offen && !mitBemerkung) hinweis = `${offen} Prüfpunkt${offen === 1 ? '' : 'e'} nicht in Ordnung — bitte den Mangel beschreiben.`
  else if (offen) hinweis = `${offen} Prüfpunkt${offen === 1 ? '' : 'e'} nicht in Ordnung — „Bestanden“ ist nicht möglich.`
  return { bestanden, mangel: mitBemerkung, nicht_bestanden: mitBemerkung, hinweis }
}

/**
 * Je Punkt entschieden: Alle müssen entschieden sein. „Bestanden“ nur ohne Mangel. Ein Mangel
 * braucht seine Notiz am Punkt; ein Ergebnis Mangel/„nicht bestanden“ ohne Mangelpunkt (etwas,
 * das nicht in der Liste steht) braucht die Bemerkung.
 */
function moeglicheErgebnisseJePunkt(punkte: Pruefpunkt[], bemerkung: string): Wahl {
  const offen = unentschiedenePunkte(punkte).length
  const maengel = punkte.filter(p => p.status === 'mangel')
  const ohneNotiz = maengel.filter(p => !p.note.trim()).length
  const beschrieben = maengel.length ? ohneNotiz === 0 : bemerkung.trim().length > 0
  const bestanden = punkte.length > 0 && offen === 0 && maengel.length === 0
  const mangel = punkte.length > 0 && offen === 0 && beschrieben
  let hinweis = ''
  if (!punkte.length) hinweis = 'Die Prüfvorlage hat keine Prüfpunkte.'
  else if (offen) hinweis = `Noch ${offen} Prüfpunkt${offen === 1 ? '' : 'e'} offen — je Punkt „i.O.“ oder „Mangel“ wählen.`
  else if (ohneNotiz) hinweis = `Bitte ${ohneNotiz === 1 ? 'den Mangel' : `die ${ohneNotiz} Mängel`} am Punkt beschreiben.`
  else if (maengel.length) hinweis = `${maengel.length} Mangel${maengel.length === 1 ? '' : 'punkte'} — „Bestanden“ ist nicht möglich.`
  return { bestanden, mangel, nicht_bestanden: mangel, hinweis }
}

/** Kurztext der Mängel einer Prüfung, z. B. für den Protokollvermerk. */
export function maengelText(punkte: Pruefpunkt[]): string {
  return offenePunkte(punkte).map(p => p.note.trim() ? `${p.item}: ${p.note.trim()}` : p.item).join('; ')
}

/** Ergebnis eines gespeicherten Prüfprotokolls (auch aus der Zeit vor dieser Regel). */
export function ergebnisVon(p: { passed?: boolean | null; notes?: string | null; checklist_results?: Pruefpunkt[] | null }): PruefErgebnis {
  if (p.passed === false) return 'nicht_bestanden'
  const offen = (p.checklist_results ?? []).some(r => r && !r.checked)
  if (offen || (p.notes ?? '').startsWith(MANGEL_VERMERK)) return 'mangel'
  return 'bestanden'
}

/** Beschreibung des Defekts, der aus einer Prüfung entsteht. */
export function defektText(ergebnis: Exclude<PruefErgebnis, 'bestanden'>, punkte: Pruefpunkt[], bemerkung: string): string {
  const offen = offenePunkte(punkte).map(p => p.note.trim() ? `${p.item} (${p.note.trim()})` : p.item)
  const kopf = ergebnis === 'mangel' ? 'Mangel bei Prüfung' : 'Prüfung nicht bestanden'
  return [bemerkung.trim() ? `${kopf}: ${bemerkung.trim()}` : kopf, offen.length ? `Nicht in Ordnung: ${offen.join('; ')}` : ''].filter(Boolean).join('\n')
}
