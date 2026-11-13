// Angaben zu eigenen Feldern anzeigen (Bauplan Vorgänge, 1.3, 3.8.3): Einsendungen
// eigener Formulare im Eingang, eigene Felder an CIRS-Meldungen, Produktausgaben
// (Lager) und Defektmeldungen (MPG).
//
// Bezeichnungen kommen aus dem Schnappschuss, den der Server beim Senden ablegt;
// nichts davon wird als HTML gesetzt. Zwei Darstellungen:
// - `flaeche` (Vorgänge, im Stil der Benutzerverwaltung): je Abschnitt eine Gruppe
//   mit weißer Fläche, Bezeichnung über dem Wert (Klassen bv- und vg-).
// - `liste` (Lager, MPG): eine kurze Liste mit Bezeichnung und Wert, nur Tokens.

import type React from 'react'
import { EINGANG_TEXTE, angabenGruppen, type AngabenEingabe, type AngabeZeile } from '../lib/formular/eingang'

export default function AngabenAnsicht({ angaben, bezeichnung, art = 'flaeche', nurAusgefuellt = false, titel, aelterTitel = EINGANG_TEXTE.aelterGruppe, rahmen }: {
  angaben: AngabenEingabe | null | undefined
  /** Bezeichnungen, wenn der Schnappschuss fehlt (CIRS-Rückfall) oder für Werte älterer Fassungen. */
  bezeichnung?: Record<string, string>
  art?: 'flaeche' | 'liste'
  /** Leere Felder weglassen (Lager, MPG, CIRS); sonst „Nicht ausgefüllt“. */
  nurAusgefuellt?: boolean
  /** Überschrift der Liste (nur `liste`), etwa „Weitere Angaben“. */
  titel?: string
  aelterTitel?: string
  /** Nur `liste`: Stil eines Rahmens darum; ohne Angaben erscheint auch der Rahmen nicht. */
  rahmen?: React.CSSProperties
}) {
  const g = angabenGruppen(angaben, { bezeichnung, nurAusgefuellt })
  if (!g.gruppen.length && !g.aelter.length) return null

  if (art === 'liste') {
    const zeilen = [...g.gruppen.flatMap((x) => x.felder), ...g.aelter]
    return (
      <div style={rahmen}>
        {titel ? <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)', marginBottom: 4 }}>{titel}</div> : null}
        <dl style={{ margin: 0 }}>
          {zeilen.map((z) => <ListenZeile key={`${z.id}:${z.label}`} z={z} />)}
        </dl>
      </div>
    )
  }

  return (
    <>
      {g.gruppen.map((x) => (
        <section key={x.id || 'ohne'}>
          {x.titel ? <h3 className="bv-gruppe">{x.titel}</h3> : null}
          <div className="bv-flaeche">
            {x.felder.map((z) => <FlaechenZeile key={z.id} z={z} />)}
          </div>
        </section>
      ))}
      {g.aelter.length ? (
        <section>
          <h3 className="bv-gruppe">{aelterTitel}</h3>
          <div className="bv-flaeche">
            {g.aelter.map((z, i) => <FlaechenZeile key={`${z.id}:${i}`} z={z} />)}
          </div>
        </section>
      ) : null}
    </>
  )
}

function FlaechenZeile({ z }: { z: AngabeZeile }) {
  return (
    <div className="vg-angabe">
      <span>{z.label}</span>
      <p className={z.leer ? 'leer' : undefined}>{z.leer ? EINGANG_TEXTE.nichtAusgefuellt : z.text}</p>
    </div>
  )
}

const LISTE_NAME: React.CSSProperties = { fontSize: 12, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.3 }
const LISTE_WERT: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }

function ListenZeile({ z }: { z: AngabeZeile }) {
  return (
    <>
      <dt style={LISTE_NAME}>{z.label}</dt>
      <dd style={{ ...LISTE_WERT, color: z.leer ? 'var(--warm-gray)' : LISTE_WERT.color }}>{z.leer ? EINGANG_TEXTE.nichtAusgefuellt : z.text}</dd>
    </>
  )
}
