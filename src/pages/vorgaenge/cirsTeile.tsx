// Gemeinsame Bausteine der CIRS-Verwaltung: Abzeichen, Karten, Felder.
// Alle Farben über die Tokens aus globals.css, damit hell und dunkel stimmen.

import type React from 'react'
import { phaseName, type Phase, type Prioritaet } from '../../lib/cirs'

export const SCHRIFT = "'Atkinson Hyperlegible', -apple-system, sans-serif"

export const abschnittKopf: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase',
  letterSpacing: '0.14em', marginBottom: 10,
}

export const karte: React.CSSProperties = {
  background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)',
}

export const feldName: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gray)',
}

export const eingabe: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--lbf-input-border)',
  background: 'var(--lbf-input-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

export const knopfVoll: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

/** Der volle Knopf, gesperrt: gedämpfte Fläche statt Durchsichtigkeit — bleibt in hell und dunkel lesbar. */
export function knopfVollWenn(frei: boolean): React.CSSProperties {
  return frei ? knopfVoll : { ...knopfVoll, background: 'rgba(var(--lbf-rot-rgb),0.1)', color: 'var(--warm-gray)', cursor: 'not-allowed' }
}

export const knopfRand: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.2)', background: 'none',
  color: 'var(--lbf-akzent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

export const knopfLeise: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 99, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.06)',
  color: 'var(--lbf-akzent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

export function Marke({ grund, schrift, children, titel }: { grund: string; schrift: string; children: React.ReactNode; titel?: string }) {
  return (
    <span title={titel} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 99, background: grund, color: schrift, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

const PHASE_TON: Record<Phase, { grund: string; schrift: string }> = {
  neu: { grund: 'var(--lbf-akzent-grund)', schrift: '#fde8d8' },
  bewertung: { grund: 'rgba(var(--lbf-rot-rgb),0.08)', schrift: 'var(--lbf-akzent)' },
  massnahmen: { grund: 'var(--lbf-warn-grund)', schrift: 'var(--lbf-warn-text)' },
  abgeschlossen: { grund: 'var(--lbf-ok-grund)', schrift: 'var(--lbf-ok-text)' },
  kein_handlungsbedarf: { grund: 'rgba(var(--lbf-grau-rgb),0.12)', schrift: 'var(--lbf-text)' },
}

export function PhaseMarke({ phase }: { phase: Phase }) {
  const t = PHASE_TON[phase]
  return <Marke grund={t.grund} schrift={t.schrift}>{phaseName(phase)}</Marke>
}

const PRIO_TON: Record<Prioritaet, { grund: string; schrift: string; name: string }> = {
  hoch: { grund: 'var(--lbf-fehler-grund)', schrift: 'var(--lbf-fehler-text)', name: 'Priorität hoch' },
  mittel: { grund: 'var(--lbf-warn-grund-2)', schrift: 'var(--lbf-warn-text)', name: 'Priorität mittel' },
  niedrig: { grund: 'rgba(var(--lbf-grau-rgb),0.12)', schrift: 'var(--lbf-text)', name: 'Priorität niedrig' },
}

export function PrioMarke({ prio }: { prio: Prioritaet | null }) {
  if (!prio) return null
  const t = PRIO_TON[prio]
  return <Marke grund={t.grund} schrift={t.schrift}>{t.name}</Marke>
}

/** Die Farbe des linken Kartenrands: offen im Akzent, überfällig rot, geschlossen grün oder grau. */
export function randFarbe(phase: Phase, ueberfaellig: boolean): string {
  if (phase === 'abgeschlossen') return '#16a34a'
  if (phase === 'kein_handlungsbedarf') return 'rgba(var(--lbf-grau-rgb),0.4)'
  return ueberfaellig ? '#dc2626' : 'var(--lbf-akzent)'
}

export const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

/** "heute", "gestern", "vor 5 Tagen" — für den Eingang in der Liste. */
export function wieLange(wert: string, heute: Date): string {
  const d = new Date(wert.includes(' ') && !wert.includes('T') ? wert.replace(' ', 'T') : wert)
  if (Number.isNaN(d.getTime())) return ''
  const tage = Math.round((Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 60) return `vor ${tage} Tagen`
  return `am ${d.toLocaleDateString('de-DE')}`
}
