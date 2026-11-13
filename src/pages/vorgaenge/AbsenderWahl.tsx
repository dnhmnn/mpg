// Wer ein Formular abgibt (Bauplan Vorgänge, 3.5, 3.11): die Arten als Zeilen
// mit Punkt, je Art ein erklärender Satz. Im Modus Passwort darunter die
// Zählung, wie viele Mitglieder nicht mit Passwort bestätigen können, mit der
// Liste und dem Weg in die Benutzerverwaltung. Ohne Schreibrecht nur die
// Anzeige.
//
// Standardformulare bieten „Mitglied mit Passwort“ und „Name frei eintragen“
// (Texte aus src/lib/formular/verwaltung.ts), eigene Formulare zusätzlich
// „Anonym“ (Texte aus ./texte.ts).

import { useState } from 'react'
import type { MitgliederPruefung } from '../../lib/formular/api'
import { ABSENDER_WAHL, PRUEF_GRUND_TEXT, doppeltText, koennenNichtText, pruefEintraege, pruefungZeigen } from '../../lib/formular/verwaltung'
import { Aufklapp, Hinweis, WahlZeilen, Zeile } from './bausteine'
import type { VgModus } from './logik'
import { ANONYM_WAHL, VG_TEXTE as T } from './texte'

/** Knopf, Erklärung und Anzeige ohne Schreibrecht je Art. */
export const MODUS_WAHL: Record<VgModus, { knopf: string; erklaerung: string; anzeige: string }> = {
  passwort: ABSENDER_WAHL.passwort,
  frei: ABSENDER_WAHL.frei,
  anonym: ANONYM_WAHL,
}

export default function AbsenderWahl({ modi, modus, darf, onWahl, pruefung, benutzerLink, onBenutzer, onPerson, label = T.absenderAria }: {
  /** Welche Arten zur Wahl stehen, in dieser Reihenfolge. */
  modi: VgModus[]
  modus: VgModus
  darf: boolean
  onWahl: (m: VgModus) => void
  pruefung: MitgliederPruefung | null
  /** Darf die Person die Benutzerverwaltung öffnen (Recht „Benutzerverwaltung“)? */
  benutzerLink: boolean
  onBenutzer: () => void
  /** Eine Person in der Benutzerverwaltung öffnen (nur mit `benutzerLink`). */
  onPerson: (id: string) => void
  /** Name der Wahl für Vorleser. */
  label?: string
}) {
  const [offen, setOffen] = useState(false)
  const art = MODUS_WAHL[modus] ?? MODUS_WAHL.frei
  const n = pruefung ? pruefung.koennen_nicht : 0
  const doppelt = pruefung ? pruefung.doppelt ?? 0 : 0
  const liste = pruefEintraege(pruefung)

  return (
    <>
      {darf ? (
        <WahlZeilen<VgModus>
          label={label} wert={modus} onWahl={onWahl}
          optionen={modi.map((m) => ({ wert: m, titel: MODUS_WAHL[m].knopf, unter: MODUS_WAHL[m].erklaerung }))}
        />
      ) : (
        <div className="bv-flaeche">
          <Zeile titel={art.anzeige} unter={art.erklaerung} />
        </div>
      )}

      {/* Zählung nur im Modus Passwort und nur mit Antwort des Servers; sonst entfällt sie still */}
      {modus === 'passwort' && pruefung ? (
        !pruefungZeigen(pruefung) ? (
          <Hinweis>{koennenNichtText(0)}</Hinweis>
        ) : (
          <>
            <Hinweis>{koennenNichtText(n)}{doppelt > 0 ? ` ${doppeltText(doppelt)}` : ''}</Hinweis>
            {liste.length > 0 ? (
              <Aufklapp titel={offen ? T.zaehlungAusblenden : `${T.zaehlungAnzeigen} (${liste.length})`} offen={offen} onUmschalten={() => setOffen(!offen)} />
            ) : null}
            {offen && liste.length > 0 ? (
              <>
                <div className="bv-flaeche">
                  {liste.map((e) => (
                    // Gleich lautende Zeilen: über die Person in der Benutzerverwaltung unterscheidbar
                    <Zeile
                      key={e.id} titel={e.name.trim() || 'Ohne Namen'}
                      unter={e.gruende.map((g) => PRUEF_GRUND_TEXT[g]).filter(Boolean).join(' · ')}
                      onClick={benutzerLink ? () => onPerson(e.id) : undefined} pfeil={benutzerLink}
                    />
                  ))}
                  {benutzerLink ? <Zeile titel={T.zurBenutzerverwaltung} art="akzent" onClick={onBenutzer} /> : null}
                </div>
                <Hinweis>{T.hinweisBenutzer}</Hinweis>
              </>
            ) : null}
          </>
        )
      ) : null}
    </>
  )
}
