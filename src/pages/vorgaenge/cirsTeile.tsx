// Gemeinsame Teile der CIRS-Verwaltung im Stil der Benutzerverwaltung (Bauplan
// Vorgänge, 3.9): Status als Wort statt Abzeichen, Texte ohne Gedankenstriche,
// Bezeichnungen der Kernfelder nach der Einstellung der Organisation. Das Aussehen
// kommt aus BV_CSS und VG_CSS (Schale) und EIN_CSS (./eingang/stil.ts).

import { useEffect, useState, type ReactNode } from 'react'
import { pb } from '../../lib/pocketbase'
import { fristUeberschritten, phaseName, tageBisFrist, tagText, type Phase, type Prioritaet } from '../../lib/cirs'
import { STANDARD_FELDER, bausteine, standardKonfig, type StandardKonfig } from '../../lib/formular/felder'

/** Texte der CIRS-Verwaltung, ruhig und ohne Gedankenstriche. */
export const CIRS_TEXTE = {
  vertraulich: 'CIRS-Meldungen sind vertraulich. Sie sind nur mit dem Recht für Vorgänge zu sehen.',
  orgFehlt: 'Die Organisation konnte nicht geladen werden. Bitte die Verbindung prüfen.',
  laedt: 'Lädt…',
  keinNetzLaden: 'Keine Verbindung. Die Meldungen konnten nicht geladen werden.',
  ladefehler: 'Die Meldungen konnten nicht geladen werden.',
  keinNetzSpeichern: 'Keine Verbindung, nichts gespeichert. Bitte erneut versuchen.',
  keinRecht: 'Keine Berechtigung, diese Meldung zu bearbeiten.',
  nichtGespeichert: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  fremdGeaendert: 'Die Meldung wurde inzwischen von jemand anderem geändert. Hier steht jetzt der neue Stand. Bitte prüfen und den Schritt bei Bedarf wiederholen.',
  druckBlockiert: 'Das Druckfenster wurde blockiert. Bitte Pop-ups für Responda erlauben.',
  erneutLaden: 'Erneut laden',
  oeffnen: 'Öffnen',
  schliessen: 'Schließen',
  meldungen: 'Meldungen',
  auswertung: 'Auswertung',
  bereiche: 'Bereiche der CIRS-Verwaltung',
  ansicht: 'Ansicht',
  sucheAria: 'Meldungen durchsuchen',
  suchePlatzhalter: 'Ort, Text, Nummer oder Maßnahme suchen',
  sucheLeeren: 'Suche leeren',
  kategorie: 'Kategorie',
  schweregrad: 'Schweregrad',
  alleKategorien: 'Alle Kategorien',
  alleSchweregrade: 'Alle Schweregrade',
  filterZurueck: 'Filter zurücksetzen',
  csv: 'Als CSV laden',
  keineMeldungen: 'Noch keine CIRS-Meldungen eingegangen.',
  keinTreffer: 'Keine Meldung passt zu Suche und Filter.',
  nichtsUeberfaellig: 'Nichts überfällig.',
  keineNeuen: 'Keine neuen Meldungen.',
  keineMeinen: 'Dir ist keine offene Meldung zugewiesen.',
  keineInAnsicht: 'Keine Meldungen in dieser Ansicht.',
  niemandZustaendig: 'niemand zuständig',
  zeitraum: 'Zeitraum',
  berichtDrucken: 'Bericht drucken',
  imZeitraumNichts: 'Im Zeitraum ist keine Meldung eingegangen.',
  nachEingang: 'nach Eingang der Meldung',
} as const

export function meldungenText(n: number): string {
  return `${n} ${n === 1 ? 'Meldung' : 'Meldungen'}`
}

/** „2 Meldungen überfällig“ (Zeile, die die Ansicht wechselt). */
export function ueberfaelligText(n: number): string {
  return `${n} ${n === 1 ? 'Meldung' : 'Meldungen'} überfällig`
}

/** Exportiert: „3 Meldungen exportiert, ohne Angaben zum Melder“. */
export function exportiertText(n: number): string {
  return `${meldungenText(n)} exportiert, ohne Angaben zum Melder`
}

/** Klasse des Status-Worts je Phase (EIN_CSS .ein-st). */
export function phaseKlasse(phase: Phase): string {
  if (phase === 'neu') return 'ein-st neu'
  if (phase === 'abgeschlossen' || phase === 'kein_handlungsbedarf') return 'ein-st still'
  return 'ein-st'
}

export function prioText(prio: Prioritaet | null): string {
  return prio ? `Priorität ${prio}` : ''
}

/** Phase als Wort, mit „überfällig“, wenn nötig. */
export function PhaseWort({ phase, ueberfaellig }: { phase: Phase; ueberfaellig?: boolean }) {
  return (
    <span className="ein-rechts">
      <span className={phaseKlasse(phase)}>{phaseName(phase)}</span>
      {ueberfaellig ? <small className="ein-st warn">überfällig</small> : null}
    </span>
  )
}

/** Eine Frist mit „heute fällig“, „in 3 Tagen“ oder „seit 2 Tagen überfällig“. */
export function FristText({ frist, heute, zu }: { frist: string; heute: Date; zu: boolean }) {
  const tage = tageBisFrist(frist, heute)
  const ueber = !zu && fristUeberschritten(frist, heute)
  const rest = zu || tage === null ? '' : tage === 0 ? ' · heute fällig' : tage > 0 ? ` · in ${tage} Tag${tage === 1 ? '' : 'en'}` : ` · seit ${-tage} Tag${tage === -1 ? '' : 'en'} überfällig`
  return <span className={ueber ? 'ein-st warn' : undefined} style={ueber ? { fontSize: 'inherit' } : undefined}>{tagText(frist)}{rest}</span>
}

/** „heute“, „gestern“, „vor 5 Tagen“: für den Eingang in der Liste. */
export function wieLange(wert: string, heute: Date): string {
  const d = new Date(wert.includes(' ') && !wert.includes('T') ? wert.replace(' ', 'T') : wert)
  if (Number.isNaN(d.getTime())) return ''
  const tage = Math.round((Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 60) return `vor ${tage} Tagen`
  return `am ${d.toLocaleDateString('de-DE')}`
}

/** Kernfeld der CIRS-Meldung: Bezeichnung nach der Einstellung und ob es heute im Formular steht. */
export type KernAnzeige = { label: string; sichtbar: boolean }

/**
 * Bezeichnungen der Kernfelder (umbenannt oder Vorgabe) und ob sie im Formular stehen, dazu die
 * Bezeichnungen der eigenen Felder für Meldungen ohne Schnappschuss (Rückfall ohne Regeln).
 */
export function cirsAnzeige(k: StandardKonfig): { kern: Record<string, KernAnzeige>; eigene: Record<string, string> } {
  const kern: Record<string, KernAnzeige> = {}
  for (const f of STANDARD_FELDER.cirs) kern[f.id] = { label: f.label, sichtbar: true }
  for (const b of bausteine(k, 'cirs', { mitAusgeblendeten: true })) {
    if (b.art === 'kern') kern[b.id] = { label: b.label, sichtbar: !b.aus }
  }
  const eigene: Record<string, string> = {}
  for (const f of k.eigene) if (f.label) eigene[f.id] = f.label
  return { kern, eigene }
}

/**
 * Die Einstellung des CIRS-Formulars: aus `formConfig`, wenn die Schale sie mitgibt, sonst
 * einmal frisch von der Organisation gelesen (nur form_config). Ohne Netz die Vorgabe.
 */
export function useCirsKonfig(orgId: string | null, formConfig?: unknown): StandardKonfig {
  const [geladen, setGeladen] = useState<unknown>(undefined)
  useEffect(() => {
    if (formConfig !== undefined || !orgId) return
    let weg = false
    pb.collection('organizations').getOne(orgId, { fields: 'form_config', requestKey: null })
      .then((o) => { if (!weg) setGeladen((o as Record<string, unknown>).form_config ?? null) })
      .catch(() => { /* Vorgabe */ })
    return () => { weg = true }
  }, [orgId, formConfig])
  return standardKonfig(formConfig !== undefined ? formConfig : geladen, 'cirs')
}

const PFAD: Record<string, ReactNode> = {
  haken: <polyline points="20 6 9 17 4 12" />,
}

/** Haken im Kästchen (bv-kasten), ohne eigene Farbe. */
export function KastenHaken() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PFAD.haken}</svg>
}
