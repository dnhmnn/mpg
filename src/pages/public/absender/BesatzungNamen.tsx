// Die Besatzung als vier Namen (alte Patientendoku, Schnelldoku; Bauplan v2, 4.5, 4.6).
//
// Vier Namensfelder mit Prüfzeile, keine Liste. Verknüpft wird beim Absenden
// am Server: wer genau auf ein aktives Mitglied passt, findet das Protokoll
// danach in Unitas. Die Fußzeile zählt, wie viele das sind.

import { useState } from 'react'
import { POSTEN, type Namen } from '../doku/besatzung'
import type { NamensErgebnis } from '../../../lib/formular/api'
import NamensFeld from './NamensFeld'
import { besatzungFusszeile } from './texte'

const GRAU = 'var(--warm-gray)'

export default function BesatzungNamen({ orgCode, namen, onNamen, mitAnmeldung = false, spalten = false }: {
  orgCode: string
  namen: Namen
  onNamen: (n: Namen) => void
  /** Namensprüfung mit Token (angemeldet, nicht „Anderer Absender“). */
  mitAnmeldung?: boolean
  /** Zwei Spalten, wo Platz ist (breite Maske). */
  spalten?: boolean
}) {
  const [ergebnis, setErgebnis] = useState<Record<string, { r: NamensErgebnis | null; text: string }>>({})

  const erkannt = new Set(
    POSTEN.filter((p) => {
      const e = ergebnis[p.pos]
      const name = namen[p.pos].trim()
      return !!name && e?.r?.eindeutig === true && e.text.trim() === name
    }).map((p) => namen[p.pos].trim().toLowerCase()),
  ).size

  return (
    <div>
      <div style={spalten ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', columnGap: 16 } : undefined}>
        {POSTEN.map((p) => (
          <NamensFeld
            key={p.pos} orgCode={orgCode} formular="patienten"
            wert={namen[p.pos]} onWert={(t) => onNamen({ ...namen, [p.pos]: t })}
            onLeeren={() => onNamen({ ...namen, [p.pos]: '' })}
            zweck="besatzung" modus="passwort" mitAnmeldung={mitAnmeldung}
            label={p.label} platzhalter="Vor- und Nachname"
            onErgebnis={(r, text) => setErgebnis((e) => ({ ...e, [p.pos]: { r, text } }))}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, lineHeight: 1.45, marginTop: 2 }}>
        {besatzungFusszeile(erkannt)}
      </div>
    </div>
  )
}
