// Link „Formular einstellen“ aus MPG und Lager (Bauplan v2, 3.4).
//
// Wer den Absender der Formulare einstellen darf (Update-Regel von
// organizations), stellt ihn unter Vorgänge → Formulare ein. Fehlt der
// Organisation das Modul Vorgänge, gibt es dorthin sonst keinen Weg; dann
// zeigt dieser Link die aktuelle Einstellung und führt zur Karte des Formulars
// (`/vorgaenge?karte=<formular>`). Mit Modul Vorgänge rendert er nichts.
//
// Den Benutzer gibt der Aufrufer mit, wenn er ihn schon hat (MPG, Lager): ein
// zweites useAuth() hieße eine zweite Anmeldeprüfung beim Server. Ohne `user`
// liest die Komponente ihn selbst.

import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { absenderModus, einstellungsLinkZeigen } from '../lib/formular/absender'
import type { User } from '../types'

type Formular = 'produktausgabe' | 'defektmeldung'
type Props = {
  formular: Formular
  /** Der angemeldete Benutzer (mit `organization`); fehlt er, liest die Komponente ihn über useAuth. */
  user?: User | null
  /** Schmale Zeile für die Seitenleiste (MPG breit) statt einer Karte. */
  kompakt?: boolean
}

const TITEL: Record<Formular, string> = {
  produktausgabe: 'Formular Produktausgabe',
  defektmeldung: 'Formular Defektmeldung',
}

/** „Absender: Mitglied mit Passwort“ bzw. „Absender: Name frei eintragen“ aus `form_config`. */
export function absenderEinstellungText(org: unknown, formular: Formular): string {
  const cfg = org && typeof org === 'object' ? (org as { form_config?: unknown }).form_config : undefined
  return absenderModus(cfg, formular) === 'passwort' ? 'Absender: Mitglied mit Passwort' : 'Absender: Name frei eintragen'
}

function Pfeil({ groesse }: { groesse: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function Formularzeichen({ groesse }: { groesse: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  )
}

function Inhalt({ formular, user, kompakt }: { formular: Formular; user: User | null; kompakt?: boolean }) {
  const org = user?.organization ?? null
  if (!user || !org || !einstellungsLinkZeigen(user, org)) return null
  const ziel = `/vorgaenge?karte=${formular}`
  const unter = absenderEinstellungText(org, formular)

  if (kompakt) {
    return (
      <Link to={ziel} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, textDecoration: 'none', color: 'var(--lbf-text)' }}>
        <span style={{ display: 'flex', flexShrink: 0 }}><Formularzeichen groesse={17} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14 }}>{TITEL[formular]}</span>
          <span style={{ display: 'block', fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{unter}</span>
        </span>
      </Link>
    )
  }

  return (
    <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', overflow: 'hidden' }}>
      <Link to={ziel} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
        <span style={{ display: 'flex', color: 'var(--lbf-akzent)', flexShrink: 0 }}><Formularzeichen groesse={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{TITEL[formular]}</span>
          <span style={{ display: 'block', fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{unter}</span>
        </span>
        <span style={{ display: 'flex', color: 'var(--warm-gray)', flexShrink: 0 }}><Pfeil groesse={16} /></span>
      </Link>
    </div>
  )
}

function MitAnmeldung({ formular, kompakt }: { formular: Formular; kompakt?: boolean }) {
  const { user } = useAuth()
  return <Inhalt formular={formular} user={user} kompakt={kompakt} />
}

/**
 * Zeigt, wie der Absender des Formulars eingestellt ist, und führt zur Karte
 * unter Vorgänge. Nur für Personen, die Formulare einstellen dürfen, und nur
 * ohne Modul Vorgänge (`einstellungsLinkZeigen`); sonst null.
 */
export default function FormularEinstellungLink({ formular, user, kompakt }: Props) {
  if (user === undefined) return <MitAnmeldung formular={formular} kompakt={kompakt} />
  return <Inhalt formular={formular} user={user} kompakt={kompakt} />
}
