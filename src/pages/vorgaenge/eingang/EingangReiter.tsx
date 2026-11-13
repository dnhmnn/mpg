// Reiter „Eingang“ unter Vorgänge (Bauplan Vorgänge, 3.8.1): je eigenem Formular,
// das aktiv ist oder Einsendungen hat, eine Zeile mit den offenen Zahlen. Eine Zeile
// öffnet die Einsendungen des Formulars (?seite=eingang&id=<vorlage>).

import { useMemo } from 'react'
import { Abschnitt, Hinweis, Leer, Notiz, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'
import {
  EINGANG_TEXTE as T, verwaisteEinsendungen, vorlageArchiviert, vorlageTitel, vorlagenImEingang, zaehlenJeVorlage, zahlenZeile,
} from '../../../lib/formular/eingang'
import { EIN_CSS } from './stil'
import { useUebersicht } from './useEingang'

export default function EingangReiter({ k }: { k: VgKontext }) {
  const voll = vorgaengeVoll(k)
  const { daten, laedt, fehler, neuLaden } = useUebersicht(k)
  const zahlen = useMemo(() => zaehlenJeVorlage(daten.einsendungen), [daten.einsendungen])
  const liste = useMemo(() => vorlagenImEingang(daten.vorlagen, zahlen), [daten.vorlagen, zahlen])
  // Einsendungen zu Formularen, die es nicht mehr gibt (etwa im alten Baukasten gelöscht)
  const verwaist = useMemo(() => verwaisteEinsendungen(daten.einsendungen, daten.vorlagen), [daten.einsendungen, daten.vorlagen])

  if (!voll) return <Notiz titel={T.keinZugriffTitel}>{T.keinZugriff}</Notiz>

  return (
    <>
      <style>{EIN_CSS}</style>
      <Abschnitt titel="Eigene Formulare" erst />
      {fehler ? (
        <Notiz titel={T.ladefehler} knopf={{ text: T.erneutLaden, onClick: neuLaden }}>{fehler}</Notiz>
      ) : laedt && !liste.length ? (
        <div className="bv-flaeche"><Leer>{T.laedt}</Leer></div>
      ) : !liste.length ? (
        <>
          <div className="bv-flaeche"><Leer>{T.leerReiter}</Leer></div>
          <Hinweis>{T.leerReiterHinweis}</Hinweis>
          {verwaist > 0 && <Hinweis>{T.verwaist(verwaist)}</Hinweis>}
        </>
      ) : (
        <>
          <div className="bv-flaeche">
            {liste.map((v) => {
              const id = String(v.id ?? '')
              const z = zahlen[id]
              const zusatz = vorlageArchiviert(v) ? T.archiviert : v.is_active === true ? '' : 'Inaktiv'
              return (
                <Zeile
                  key={id} titel={vorlageTitel(v)} pfeil onClick={() => k.oeffne('eingang', id)}
                  unter={[zahlenZeile(z), zusatz].filter(Boolean).join(' · ')}
                  rechts={z && z.neu > 0 ? <span className="vg-zahl" aria-label={`${z.neu} neu`}>{z.neu}</span> : undefined}
                />
              )
            })}
          </div>
          <Hinweis>Erledigte Einsendungen stehen im Archiv des Formulars. Gelöscht wird nichts.</Hinweis>
          {verwaist > 0 && <Hinweis>{T.verwaist(verwaist)}</Hinweis>}
        </>
      )}
    </>
  )
}
