// Bausteine unter Vorgänge (Bauplan Vorgänge, 3.1, 3.11): die der
// Benutzerverwaltung (nur weitergereicht) und ein paar neue, alle im selben
// Stil (Klassen "bv-" aus src/pages/benutzer/stil.ts, "vg-" aus ./stil.ts).

import React, { useEffect, useRef, useState } from 'react'
import { zahlAusText, zahlText } from './logik'

export { Seite, Abschnitt, Hinweis, Feld, Auswahl, SchalterZeile, Leiste, Toast } from '../benutzer/bausteine'

export type VgIconName =
  | 'zurueck' | 'weiter' | 'runter' | 'hoch' | 'plus' | 'haken' | 'kreuz' | 'link' | 'qr'
  | 'drucken' | 'laden' | 'archiv' | 'suche' | 'stift' | 'auge' | 'oeffnen'

const PFADE: Record<VgIconName, React.ReactNode> = {
  zurueck: <path d="M15 18l-6-6 6-6" />,
  weiter: <path d="M9 18l6-6-6-6" />,
  runter: <path d="M6 9l6 6 6-6" />,
  hoch: <path d="M18 15l-6-6-6 6" />,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  haken: <polyline points="20 6 9 17 4 12" />,
  kreuz: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" /></>,
  drucken: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  laden: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  archiv: <><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><line x1="10" y1="12" x2="14" y2="12" /></>,
  suche: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  stift: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>,
  auge: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  oeffnen: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
}

export function VgIcon({ n, className = '' }: { n: VgIconName; className?: string }) {
  return <svg className={`bv-i ${className}`} viewBox="0 0 24 24" aria-hidden="true">{PFADE[n]}</svg>
}

/**
 * Eine Zeile in einer Fläche (.bv-flaeche): Titel fett, darunter ein Satz in
 * Zweitfarbe, rechts ein Wort, eine Zahl oder ein Zeichen, Pfeil für „öffnet
 * eine Seite“. Mit onClick ein Knopf, sonst nur Anzeige. `art`: neu (Akzent mit
 * Plus), gefahr (Entfernen, Löschen), akzent (eine Aktion).
 */
export function Zeile({ titel, unter, rechts, onClick, pfeil, art, disabled, expanded, label }: {
  titel: React.ReactNode
  unter?: React.ReactNode
  rechts?: React.ReactNode
  onClick?: () => void
  pfeil?: boolean
  art?: 'neu' | 'gefahr' | 'akzent'
  disabled?: boolean
  /** Klappt die Zeile etwas auf (aria-expanded)? */
  expanded?: boolean
  /** Name für Vorleser, wenn der Titel allein nicht reicht. */
  label?: string
}) {
  const klasse = `bv-z${art ? ` ${art}` : ''}`
  const inhalt = art === 'neu'
    ? <><VgIcon n="plus" /><span className="bv-tx">{titel}{unter ? <small>{unter}</small> : null}</span>{rechts}</>
    : (
      <>
        <span className="bv-tx"><b>{titel}</b>{unter ? <small>{unter}</small> : null}</span>
        {rechts}
        {pfeil ? <VgIcon n="weiter" className="bv-pfeil" /> : null}
      </>
    )
  if (!onClick) return <div className={klasse} aria-disabled={disabled || undefined}>{inhalt}</div>
  return (
    <button type="button" className={klasse} onClick={onClick} disabled={disabled} aria-expanded={expanded} aria-label={label}>
      {inhalt}
    </button>
  )
}

/** Eine Wahl als Zeilen mit Punkt (Radio), je Option ein Satz darunter; eigene Fläche. */
export function WahlZeilen<T extends string>({ label, optionen, wert, onWahl, disabled }: {
  label: string
  optionen: { wert: T; titel: string; unter?: string }[]
  wert: T
  onWahl: (w: T) => void
  disabled?: boolean
}) {
  return (
    <div className="bv-flaeche" role="radiogroup" aria-label={label}>
      {optionen.map((o) => {
        const an = o.wert === wert
        return (
          <button
            key={o.wert} type="button" role="radio" aria-checked={an} className="bv-z bv-wahl vg-wahl"
            disabled={disabled} onClick={() => { if (!an) onWahl(o.wert) }}
          >
            <span className="bv-radio" aria-hidden="true" />
            <span className="bv-tx"><b>{o.titel}</b>{o.unter ? <small>{o.unter}</small> : null}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Leere Liste: ein ruhiger Satz in der Mitte. */
export function Leer({ children }: { children: React.ReactNode }) {
  return <div className="bv-leer">{children}</div>
}

/** Ruhiger Hinweis in einer eigenen Fläche, optional mit Titel und einem Knopf. */
export function Notiz({ titel, children, knopf }: {
  titel?: string
  children: React.ReactNode
  knopf?: { text: string; onClick: () => void }
}) {
  return (
    <div className="bv-notiz">
      {titel ? <b>{titel}</b> : null}
      {typeof children === 'string' ? <p>{children}</p> : children}
      {knopf ? <button type="button" className="bv-knopf" onClick={knopf.onClick}>{knopf.text}</button> : null}
    </div>
  )
}

/** Auf- und zuklappen, etwa „Archiviert (3)“. */
export function Aufklapp({ titel, offen, onUmschalten }: { titel: string; offen: boolean; onUmschalten: () => void }) {
  return (
    <button type="button" className="bv-aufklapp" aria-expanded={offen} onClick={onUmschalten}>
      <VgIcon n={offen ? 'runter' : 'weiter'} className="bv-klein" />{titel}
    </button>
  )
}

/**
 * Eine Zahl eingeben: Ziffernfeld auf dem Telefon, Komma erlaubt. Der Text
 * bleibt, wie getippt; nach außen geht die Zahl (leer: null, nicht lesbar:
 * NaN, damit der Aufrufer „Bitte prüfen“ sagen kann).
 */
export function ZahlFeld({ wert, onWert, label, platzhalter, id }: {
  wert: number | null
  onWert: (n: number | null) => void
  label?: string
  platzhalter?: string
  id?: string
}) {
  const [text, setText] = useState(() => zahlText(wert))
  const zuletzt = useRef<number | null>(wert)
  // Von außen geändert (Zurücksetzen, anderer Entwurf): den Text nachziehen
  useEffect(() => {
    const gleich = wert === zuletzt.current || (Number.isNaN(wert) && Number.isNaN(zuletzt.current))
    if (!gleich) { zuletzt.current = wert; setText(zahlText(wert)) }
  }, [wert])
  const n = zahlAusText(text)
  return (
    <input
      id={id} className={`bv-eingabe${Number.isNaN(n) ? ' fehler' : ''}`} type="text" inputMode="decimal" autoComplete="off"
      aria-label={label} aria-invalid={Number.isNaN(n) || undefined} placeholder={platzhalter}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const z = zahlAusText(e.target.value)
        zuletzt.current = z
        onWert(z)
      }}
    />
  )
}
