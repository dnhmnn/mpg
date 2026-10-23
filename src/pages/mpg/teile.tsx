// Bausteine des MPG-Moduls nach „La Bella Figura“ (CLAUDE.md).
// Alle Farben über die Tokens aus globals.css, damit hell und dunkel stimmen.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Stufe } from '../../lib/mpg/zustand'
import { STUFE_TEXT } from '../../lib/mpg/zustand'
import type { PruefErgebnis } from '../../lib/mpg/pruefung'
import { ERGEBNIS_TEXT } from '../../lib/mpg/pruefung'
import { SCHWERE_NAME, type Severity } from './typen'

export const SCHRIFT = "'Atkinson Hyperlegible', -apple-system, sans-serif"

/** Ab dieser Breite: Seitenleiste statt Tab-Leiste, Liste und Detail nebeneinander. */
export const BREIT_AB = 960

export function useBreit(): boolean {
  const abfrage = `(min-width: ${BREIT_AB}px)`
  const [breit, setBreit] = useState(() => typeof window !== 'undefined' && window.matchMedia(abfrage).matches)
  useEffect(() => {
    const m = window.matchMedia(abfrage)
    const f = () => setBreit(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [abfrage])
  return breit
}

// ── Farben ────────────────────────────────────────────────────────────────

/** Linke Kartenlinie je Zustand (CLAUDE.md: offen #600812, erledigt grün, rot = gesperrt) */
export const STUFE_FARBE: Record<Stufe, string> = {
  gesperrt: '#dc2626', handlung: 'var(--lbf-akzent)', bald: 'var(--lbf-akzent)', ok: '#16a34a',
}

export const ERGEBNIS_FARBE: Record<PruefErgebnis, string> = {
  bestanden: '#16a34a', mangel: 'var(--lbf-akzent)', nicht_bestanden: '#dc2626',
}

/** Schweregrade nur in der Palette — ohne Orange und Amber */
const SCHWERE_TON: Record<Severity, { grund: string; schrift: string }> = {
  low: { grund: 'rgba(var(--lbf-grau-rgb),0.14)', schrift: 'var(--lbf-text)' },
  medium: { grund: 'rgba(var(--lbf-rot-rgb),0.08)', schrift: 'var(--lbf-akzent)' },
  high: { grund: 'var(--lbf-fehler-grund)', schrift: 'var(--lbf-fehler-text)' },
  critical: { grund: '#dc2626', schrift: '#fff' },
}
export const SCHWERE_RAND: Record<Severity, string> = {
  low: 'rgba(var(--lbf-grau-rgb),0.5)', medium: 'var(--lbf-akzent)', high: '#dc2626', critical: '#dc2626',
}

// ── Stile ─────────────────────────────────────────────────────────────────

export const abschnittKopf: CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase',
  letterSpacing: '0.14em', marginBottom: 10,
}

export const feldName: CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)',
}

export const eingabe: CSSProperties = {
  padding: '11px 12px', borderRadius: 10, border: '1.5px solid var(--lbf-input-border)',
  background: 'var(--lbf-input-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

export const knopfVoll: CSSProperties = {
  padding: '11px 16px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
}

/** Gesperrt: gedämpfte Fläche statt Durchsichtigkeit — bleibt in hell und dunkel lesbar. */
export function knopfVollWenn(frei: boolean, grund = 'var(--lbf-akzent-grund)'): CSSProperties {
  return frei ? { ...knopfVoll, background: grund } : { ...knopfVoll, background: 'rgba(var(--lbf-rot-rgb),0.1)', color: 'var(--warm-gray)', cursor: 'not-allowed' }
}

export const knopfRand: CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.2)', background: 'none',
  color: 'var(--lbf-akzent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
}

export const knopfLeise: CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.06)',
  color: 'var(--lbf-akzent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

export const knopfGefahr: CSSProperties = {
  ...knopfRand, border: '1px solid rgba(220,38,38,0.3)', color: 'var(--lbf-fehler-text)',
}

export const kursivGrau: CSSProperties = { fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }

export const pik = (ch: ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">{ch}</svg>
)

export const ICON = {
  zurueck: <polyline points="15 18 9 12 15 6" />,
  weiter: <polyline points="9 18 15 12 9 6" />,
  heute: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  geraete: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></>,
  meldungen: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  mehr: <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
  vorlagen: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  fristen: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
  logbuch: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  haken: <polyline points="20 6 9 17 4 12" />,
  kreuz: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
}

// ── Zeit ──────────────────────────────────────────────────────────────────

export function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

export function fmtDate(s?: string | null): string {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('de-DE') : '—'
}

export function fmtDateTime(s?: string | null): string {
  const d = parseDate(s)
  if (!d) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** „heute“, „gestern“, „vor 3 Tagen“ — in Kalendertagen nach Ortszeit */
export function relativeDate(s?: string | null): string {
  const d = parseDate(s)
  if (!d) return ''
  const h = new Date()
  const tage = Math.round((Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000)
  if (tage <= 0) return 'heute'   // auch bei leicht vorgehender Uhr eines anderen Geräts
  if (tage === 1) return 'gestern'
  if (tage < 7) return `vor ${tage} Tagen`
  return fmtDate(s)
}

// ── Bausteine ─────────────────────────────────────────────────────────────

export function Abschnitt({ titel, rechts, children, style }: { titel: ReactNode; rechts?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ marginBottom: 24, ...style }}>
      <div style={{ ...abschnittKopf, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span>{titel}</span>{rechts}
      </div>
      {children}
    </section>
  )
}

/** Karte mit linker Statuslinie (CLAUDE.md „Karten“) */
export function Karte({ rand, children, style, onClick }: { rand?: string; children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', overflow: 'hidden',
      ...(rand ? { borderLeft: `3px solid ${rand}` } : {}), ...(onClick ? { cursor: 'pointer' } : {}), ...style,
    }}>{children}</div>
  )
}

/** Unterer Aktionsstreifen einer Karte */
export function Aktionen({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {children}
    </div>
  )
}

export function Marke({ grund, schrift, children, titel }: { grund: string; schrift: string; children: ReactNode; titel?: string }) {
  return (
    <span title={titel} style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 6, background: grund, color: schrift, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export function ZustandMarke({ stufe }: { stufe: Stufe }) {
  const ton: Record<Stufe, { grund: string; schrift: string }> = {
    gesperrt: { grund: 'var(--lbf-fehler-grund)', schrift: 'var(--lbf-fehler-text)' },
    handlung: { grund: 'rgba(var(--lbf-rot-rgb),0.08)', schrift: 'var(--lbf-akzent)' },
    bald: { grund: 'rgba(var(--lbf-rot-rgb),0.05)', schrift: 'var(--lbf-akzent)' },
    ok: { grund: 'var(--lbf-ok-grund)', schrift: 'var(--lbf-ok-text)' },
  }
  return <Marke {...ton[stufe]}>{STUFE_TEXT[stufe]}</Marke>
}

export function SchwereMarke({ severity }: { severity: Severity }) {
  const t = SCHWERE_TON[severity] ?? SCHWERE_TON.medium
  return <Marke grund={t.grund} schrift={t.schrift}>{SCHWERE_NAME[severity] ?? severity}</Marke>
}

export function ErgebnisMarke({ ergebnis }: { ergebnis: PruefErgebnis }) {
  const ton: Record<PruefErgebnis, { grund: string; schrift: string }> = {
    bestanden: { grund: 'var(--lbf-ok-grund)', schrift: 'var(--lbf-ok-text)' },
    mangel: { grund: 'rgba(var(--lbf-rot-rgb),0.08)', schrift: 'var(--lbf-akzent)' },
    nicht_bestanden: { grund: 'var(--lbf-fehler-grund)', schrift: 'var(--lbf-fehler-text)' },
  }
  return <Marke {...ton[ergebnis]}>{ERGEBNIS_TEXT[ergebnis]}</Marke>
}

/** Stat-Card (CLAUDE.md): Label rot, Zahl 48 px, Beschreibung kursiv — kein farbiger Rand */
export function StatKarte({ label, zahl, text, aktiv, onClick }: { label: string; zahl: number; text: string; aktiv?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '14px 14px 12px',
      border: aktiv ? '1.5px solid var(--lbf-akzent)' : '1.5px solid transparent', textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', minWidth: 0,
    }}>
      <div style={{ ...abschnittKopf, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--lbf-akzent)', lineHeight: 1 }}>{zahl}</div>
      <div style={{ ...kursivGrau, marginTop: 6 }}>{text}</div>
    </button>
  )
}

export function Leer({ children }: { children: ReactNode }) {
  return <div style={{ padding: '40px 16px', textAlign: 'center', fontStyle: 'italic', color: 'var(--warm-gray)' }}>{children}</div>
}

export function Feld({ label, children, hinweis }: { label: string; children: ReactNode; hinweis?: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={feldName}>{label}</span>
      {children}
      {hinweis && <span style={{ ...kursivGrau, fontSize: 11 }}>{hinweis}</span>}
    </label>
  )
}

/**
 * Gibt es in diesem Fenster einen Eintrag vor dem aktuellen? Der Index des Routers bleibt bei
 * „replace“ (Filter, Reiter) erhalten und steigt nur bei „push“ — anders als der key.
 */
export function hatVerlauf(): boolean {
  try { return (window.history.state?.idx ?? 0) > 0 } catch { return false }
}

/**
 * Zurück dorthin, woher man kam (Prüfrunde, gefilterte Liste …). Wurde die Seite direkt
 * geöffnet (Lesezeichen, geteilter Link), ersetzt die feste Elternseite den Eintrag — ein
 * Hin und Her zwischen Kind und Eltern kann so nicht entstehen.
 */
export function useZurueck(ziel: string): () => void {
  const navigate = useNavigate()
  return () => { if (hatVerlauf()) navigate(-1); else navigate(ziel, { replace: true }) }
}

/** Kopf einer Unterseite: zurück und Titel */
export function SeitenKopf({ zurueck, titel, unter, rechts }: { zurueck?: string; titel: ReactNode; unter?: ReactNode; rechts?: ReactNode }) {
  const geheZurueck = useZurueck(zurueck ?? '/mpg')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      {zurueck && (
        <button onClick={geheZurueck} aria-label="Zurück" style={{ color: 'var(--lbf-akzent)', display: 'flex', padding: 10, margin: -10, background: 'none', border: 'none', cursor: 'pointer' }}>{pik(ICON.zurueck, 22)}</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titel}</div>
        {unter && <div style={{ ...kursivGrau, marginTop: 2 }}>{unter}</div>}
      </div>
      {rechts}
    </div>
  )
}

/** Reiter innerhalb einer Seite (10 px, Großbuchstaben, aktiver Reiter unterstrichen) */
export function Reiter<T extends string>({ wert, optionen, onWahl }: { wert: T; optionen: [T, string][]; onWahl: (t: T) => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 18, borderBottom: '0.5px solid var(--lbf-border-light)', marginBottom: 16, overflowX: 'auto' }}>
      {optionen.map(([t, name]) => (
        <button key={t} role="tab" aria-selected={wert === t} onClick={() => onWahl(t)} style={{
          border: 'none', background: 'none', padding: '10px 0 8px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
          color: wert === t ? 'var(--lbf-akzent)' : 'var(--warm-gray)',
          borderBottom: wert === t ? '2px solid var(--lbf-akzent)' : '2px solid transparent',
        }}>{name}</button>
      ))}
    </div>
  )
}

/**
 * Das eine Blatt für kurze Dialoge (Telefon: von unten, breit: mittig).
 * Während gespeichert wird, schließt es nicht.
 */
export function Blatt({ titel, ueber, onClose, gesperrt, children }: { titel: ReactNode; ueber?: ReactNode; onClose: () => void; gesperrt?: boolean; children: ReactNode }) {
  const breit = useBreit()
  return (
    <>
      <div onClick={() => !gesperrt && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 600 }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', zIndex: 601, background: 'var(--lbf-card)', boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        maxHeight: '88vh', overflowY: 'auto', fontFamily: SCHRIFT, boxSizing: 'border-box',
        ...(breit
          ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 520, borderRadius: 16, padding: 24 }
          : { left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))' }),
      }}>
        {!breit && <div style={{ width: 36, height: 3, borderRadius: 2, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 18px' }} />}
        {ueber && <div style={{ ...abschnittKopf, marginBottom: 4 }}>{ueber}</div>}
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 19, color: 'var(--lbf-text)', marginBottom: 16 }}>{titel}</div>
        {children}
      </div>
    </>
  )
}

/** Ankreuzfeld mit Titel und Erklärung (Sperren, wieder einsatzbereit …) */
export function Haken({ an, setAn, titel, text, gesperrt }: { an: boolean; setAn: (b: boolean) => void; titel: string; text?: ReactNode; gesperrt?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: gesperrt ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={an} disabled={gesperrt} onChange={e => setAn(e.target.checked)}
        style={{ width: 20, height: 20, accentColor: 'var(--lbf-akzent)', cursor: gesperrt ? 'default' : 'pointer', flexShrink: 0, marginTop: 1 }} />
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)' }}>{titel}</span>
        {text && <span style={{ display: 'block', ...kursivGrau, fontSize: 11, marginTop: 2 }}>{text}</span>}
      </span>
    </label>
  )
}

export function Hinweis({ ton = 'info', children }: { ton?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div style={{
      fontSize: 12, fontStyle: 'italic', lineHeight: 1.45, borderRadius: 10, padding: '10px 12px',
      background: ton === 'warn' ? 'var(--lbf-fehler-grund)' : 'rgba(var(--lbf-rot-rgb),0.05)',
      color: ton === 'warn' ? 'var(--lbf-fehler-text)' : 'var(--lbf-text)',
    }}>{children}</div>
  )
}
