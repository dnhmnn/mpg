// Bausteine der Benutzerverwaltung: Kopf, Blatt, Zeilen, Schalter, Leiste unten.
// Aussehen in stil.ts (Klassen "bv-").

import React from 'react'
import { mitgebracht, type Verknuepfungen } from '../../lib/verknuepfung'
import { RECHT_BESCHREIBUNG, aufzaehlung, rechteGruppiert, type Recht } from './logik'

const PFADE: Record<string, React.ReactNode> = {
  zurueck: <path d="M15 18l-6-6 6-6" />,
  weiter: <path d="M9 18l6-6-6-6" />,
  runter: <path d="M6 9l6 6 6-6" />,
  suche: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  personplus: <><circle cx="10" cy="8" r="4" /><path d="M3 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 4 1.5" /><line x1="19" y1="14" x2="19" y2="22" /><line x1="15" y1="18" x2="23" y2="18" /></>,
  haken: <polyline points="20 6 9 17 4 12" />,
  kreuz: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
}

export function Icon({ n, className = '' }: { n: keyof typeof PFADE | string; className?: string }) {
  return <svg className={`bv-i ${className}`} viewBox="0 0 24 24" aria-hidden="true">{PFADE[n]}</svg>
}

/** Ganze Seite: dunkelroter Kopf, Elfenbein-Blatt, darunter optional die Leiste */
export function Seite({ titel, unter, zurueck, zurueckLabel = 'Zurück', rechts, reiter, leiste, children }: {
  titel: string; unter?: string; zurueck: () => void; zurueckLabel?: string
  rechts?: React.ReactNode; reiter?: React.ReactNode; leiste?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bv">
      <header className="bv-kopf">
        <div className="bv-kopf-innen">
          <div className="bv-zeile1">
            <button type="button" className="bv-rund" aria-label={zurueckLabel} onClick={zurueck}><Icon n="zurueck" /></button>
            <div className="bv-titel"><b>{titel}</b>{unter && <span>{unter}</span>}</div>
            {rechts}
          </div>
          {reiter}
        </div>
      </header>
      <main className={`bv-blatt${leiste ? ' mitleiste' : ''}`}>
        <div className="bv-innen">{children}</div>
      </main>
      {leiste}
    </div>
  )
}

export function Abschnitt({ titel, rechts, erst }: { titel: string; rechts?: React.ReactNode; erst?: boolean }) {
  return <div className={`bv-ab${erst ? ' erst' : ''}`}><h2>{titel}</h2>{rechts != null && <span>{rechts}</span>}</div>
}

export function Hinweis({ children, oben }: { children: React.ReactNode; oben?: boolean }) {
  return <p className={`bv-hinweis${oben ? ' oben' : ''}`}>{children}</p>
}

/** Feld mit Beschriftung. Als label, damit ein Tipp auf den Namen ins Feld springt. */
export function Feld({ label, zusatz, hinweis, fehler, erst, gruppe, children }: {
  label: string; zusatz?: string; hinweis?: React.ReactNode; fehler?: string; erst?: boolean; gruppe?: boolean; children: React.ReactNode
}) {
  const kopf = <span className="bv-label"><span>{label}</span>{zusatz && <small>{zusatz}</small>}</span>
  return (
    <div className={`bv-feld${erst ? ' erst' : ''}`}>
      {gruppe ? <div>{kopf}{children}</div> : <label>{kopf}{children}</label>}
      {fehler && <p className="bv-fehltext" role="alert">{fehler}</p>}
      {hinweis && <p className="bv-hinweis">{hinweis}</p>}
    </div>
  )
}

export function Auswahl({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label?: string }) {
  return (
    <div className="bv-auswahl">
      <select className="bv-eingabe" value={value} onChange={e => onChange(e.target.value)} aria-label={label}>{children}</select>
      <Icon n="runter" className="bv-klein" />
    </div>
  )
}

export function SchalterZeile({ titel, unter, an, onChange, disabled }: { titel: string; unter?: React.ReactNode; an: boolean; onChange: (an: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" className="bv-z bv-recht" role="switch" aria-checked={an} disabled={disabled} onClick={() => onChange(!an)}>
      <span className="bv-tx"><b>{titel}</b>{unter && <small>{unter}</small>}</span>
      <span className="bv-schalter" aria-hidden="true" />
    </button>
  )
}

/**
 * Die Rechte als Schalter, nach Bereichen. Unter einem Recht steht, was es
 * erlaubt und welche Rechte es mitbringt (verknüpfte Rechte, lib/verknuepfung.ts).
 */
export function RechteListe({ rechte, werte, onChange, v, org }: {
  rechte: Recht[]; werte: Record<string, boolean>; onChange: (key: string, an: boolean) => void; v: Verknuepfungen; org: unknown
}) {
  const name = (k: string) => rechte.find(r => r.key === k)?.label ?? k
  return (
    <>
      {rechteGruppiert(rechte).map(g => (
        <section key={g.name}>
          <h3 className="bv-gruppe">{g.name}</h3>
          <div className="bv-flaeche">
            {g.rechte.map(r => {
              const mit = mitgebracht(r.key, v, org).map(name)
              const zeilen = [RECHT_BESCHREIBUNG[r.key], mit.length ? `bringt ${aufzaehlung(mit)} mit` : ''].filter(Boolean)
              return (
                <SchalterZeile key={r.key} titel={r.label} an={werte[r.key] === true} onChange={an => onChange(r.key, an)}
                  unter={zeilen.length ? zeilen.map(z => <span key={z} style={{ display: 'block' }}>{z}</span>) : undefined} />
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

export function Leiste({ titel, unter, knopf, icon, onClick, laeuft, laeuftText = 'Speichert…', disabled }: {
  titel: string; unter?: string; knopf: string; icon?: string; onClick: () => void; laeuft?: boolean; laeuftText?: string; disabled?: boolean
}) {
  return (
    <nav className="bv-unten" aria-label="Speichern">
      <div className="bv-stand"><b>{titel}</b>{unter && <span>{unter}</span>}</div>
      <button type="button" className="bv-vor" onClick={onClick} disabled={laeuft || disabled}>
        {icon && <Icon n={icon} />}{laeuft ? laeuftText : knopf}
      </button>
    </nav>
  )
}

export function Toast({ text, fehler, hoch, onClose }: { text: string; fehler?: boolean; hoch?: boolean; onClose: () => void }) {
  return (
    <div className={`bv-toast${fehler ? ' fehler' : ''}${hoch ? ' hoch' : ''}`} role={fehler ? 'alert' : 'status'} onClick={onClose}>{text}</div>
  )
}
