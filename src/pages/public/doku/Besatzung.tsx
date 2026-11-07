// Die Besatzung eintragen, einmal, für das ganze Protokoll.
//
// Vier Posten, jeder ein Name. Ob der Name zu einem Mitglied gehört, sagt die
// Prüfzeile darunter: der Server antwortet nur ja, mehrfach oder nein, nie mit
// einer Liste. Verknüpft wird beim Absenden am Server (Bauplan v2, 2.5); nur
// ein erkannter Name öffnet das Protokoll später in Unitas. Die Fußzeile zählt,
// wie viele das sind, damit sich niemand auf eine Einsicht verlässt, die es
// nicht gibt.

import { useEffect, useState } from 'react'
import type { Werte } from './DokuFeld'
import { POSTEN, besatzungLesen, type Besetzung, type Posten } from './besatzung'
import NamensFeld from '../absender/NamensFeld'
import { besatzungFusszeile } from '../absender/texte'
import type { NamensErgebnis } from '../../../lib/formular/api'

const GRAU = 'var(--warm-gray)'

/** Ein Posten: ein Namensfeld mit Prüfzeile. */
function Platz({ posten, person, orgCode, mitAnmeldung, onSetzen, onErgebnis }: {
  posten: Posten
  person: Besetzung | null
  orgCode: string
  mitAnmeldung: boolean
  onSetzen: (person: Besetzung | null) => void
  onErgebnis: (r: NamensErgebnis | null, text: string) => void
}) {
  /*
   * Der getippte Text bleibt hier, der gespeicherte Name ist getrimmt: sonst
   * verschwände beim Tippen das Leerzeichen zwischen Vor- und Nachnamen.
   * Von außen (Räumen, geladenes Protokoll, Entwurf) wird nur übernommen,
   * was sich wirklich unterscheidet.
   */
  const aussen = person?.name ?? ''
  const [text, setText] = useState(aussen)
  useEffect(() => {
    setText((t) => (t.trim() === aussen.trim() ? t : aussen))
  }, [aussen])

  return (
    <NamensFeld
      orgCode={orgCode} formular="patienten" wert={text}
      onWert={(t) => { setText(t); onSetzen(t.trim() ? { id: '', name: t } : null) }}
      onLeeren={() => { setText(''); onSetzen(null) }}
      zweck="besatzung" modus="passwort" mitAnmeldung={mitAnmeldung}
      label={posten.label} platzhalter="Vor- und Nachname"
      verknuepft={!!person?.id} onErgebnis={onErgebnis}
    />
  )
}

export default function Besatzung({ orgCode, werte, onSetzen, mitAnmeldung = false }: {
  orgCode: string
  werte: Werte
  onSetzen: (pos: Posten['pos'], person: Besetzung | null) => void
  /** Namensprüfung mit Token (angemeldet in der App, wenn das öffentliche Formular aus ist). */
  mitAnmeldung?: boolean
}) {
  const besetzt = besatzungLesen(werte)
  const [ergebnis, setErgebnis] = useState<Record<string, { r: NamensErgebnis | null; text: string }>>({})

  // Erkannt: schon verknüpft (geladenes Protokoll) oder für genau diesen Namen
  // eindeutig geprüft; dieselbe Person auf zwei Posten zählt einmal
  const erkannt = new Set(
    POSTEN.filter((p) => {
      const b = besetzt[p.pos]
      if (!b) return false
      const e = ergebnis[p.pos]
      return b.id !== '' || (e?.r?.eindeutig === true && e.text.trim() === b.name.trim())
    }).map((p) => besetzt[p.pos]!.name.trim().toLowerCase()),
  ).size

  return (
    <div style={{ marginBottom: 6 }}>
      {POSTEN.map((p) => (
        <Platz
          key={p.pos} posten={p} person={besetzt[p.pos]} orgCode={orgCode} mitAnmeldung={mitAnmeldung}
          onSetzen={(person) => onSetzen(p.pos, person)}
          onErgebnis={(r, text) => setErgebnis((e) => ({ ...e, [p.pos]: { r, text } }))}
        />
      ))}
      <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, lineHeight: 1.45, marginTop: 2 }}>
        {besatzungFusszeile(erkannt)}
      </div>
    </div>
  )
}
