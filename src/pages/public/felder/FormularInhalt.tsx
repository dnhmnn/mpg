// Ein eigenes Formular ohne Kontext (Bauplan Vorgänge 4.1): Beschreibung, Abschnitte,
// Felder, Fehler. Die öffentliche Seite (OrgFormular.tsx) und die Vorschau im Baukasten
// zeigen damit dasselbe. Ohne Abschnitte eine Fläche ohne Titel.

import type { VorlageSchema } from '../../../lib/formular/felder'
import { PubSection } from '../pubStyles'
import EigeneFelder from './EigeneFelder'

const flaeche: React.CSSProperties = {
  background: 'var(--lbf-card)', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)', borderLeft: '3px solid var(--lbf-akzent)',
  borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '1rem',
}

export default function FormularInhalt({ schema, werte, onWert, fehler, beschreibung, disabled }: {
  schema: VorlageSchema
  werte: Record<string, unknown>
  onWert: (id: string, w: unknown) => void
  fehler?: Record<string, string>
  beschreibung?: string
  disabled?: boolean
}) {
  const sichtbar = schema.felder.filter((f) => f.aus !== true)
  return (
    <>
      {beschreibung?.trim() ? (
        <p style={{ margin: '0 2px 14px', fontSize: 14, lineHeight: 1.5, color: 'var(--lbf-text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{beschreibung.trim()}</p>
      ) : null}
      {schema.abschnitte.length === 0 ? (
        <div style={flaeche}>
          <EigeneFelder felder={sichtbar} werte={werte} onWert={onWert} fehler={fehler} disabled={disabled} />
        </div>
      ) : schema.abschnitte.map((a) => {
        const felder = sichtbar.filter((f) => f.abschnitt === a.id)
        if (!felder.length) return null
        return (
          <PubSection key={a.id} title={a.titel} open>
            {a.hilfe ? <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.45, color: 'var(--warm-gray)' }}>{a.hilfe}</p> : null}
            <EigeneFelder felder={felder} werte={werte} onWert={onWert} fehler={fehler} disabled={disabled} />
          </PubSection>
        )
      })}
    </>
  )
}
