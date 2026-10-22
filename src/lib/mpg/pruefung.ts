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
// Prüffälle: src/lib/mpg/selbsttest.ts

export interface Pruefpunkt { item: string; checked: boolean; note: string }

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
  const offen = offenePunkte(punkte).length
  const mitBemerkung = bemerkung.trim().length > 0
  const bestanden = punkte.length > 0 && offen === 0
  let hinweis = ''
  if (!punkte.length) hinweis = 'Die Prüfvorlage hat keine Prüfpunkte.'
  else if (offen && !mitBemerkung) hinweis = `${offen} Prüfpunkt${offen === 1 ? '' : 'e'} nicht in Ordnung — bitte den Mangel beschreiben.`
  else if (offen) hinweis = `${offen} Prüfpunkt${offen === 1 ? '' : 'e'} nicht in Ordnung — „Bestanden“ ist nicht möglich.`
  return { bestanden, mangel: mitBemerkung, nicht_bestanden: mitBemerkung, hinweis }
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
  return [`${kopf}: ${bemerkung.trim()}`, offen.length ? `Nicht in Ordnung: ${offen.join('; ')}` : ''].filter(Boolean).join('\n')
}
