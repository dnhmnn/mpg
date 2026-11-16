// „Angemeldete Geräte“: alle Geräte der Person, „Dieses Gerät“ markiert, je ein Knopf „Abmelden“.
// Ein anderes Gerät abmelden setzt beim Server einen Grabstein (30 Tage), damit es sich nicht still
// wieder anmeldet; dieses Gerät abmelden heißt Push hier ausschalten.

import { Abschnitt } from '../benutzer/bausteine'
import type { StandGeraet } from '../../lib/push/api'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import { datumText } from './logik'

export default function GeraeteListe({ geraete, dieseKennung, laeuft, onAbmelden }: {
  geraete: StandGeraet[]
  dieseKennung: string | null
  /** id des Geräts, das gerade abgemeldet wird */
  laeuft: string | null
  onAbmelden: (g: StandGeraet, dieses: boolean) => void
}) {
  return (
    <>
      <Abschnitt titel={T.abschnittGeraete} rechts={geraete.length ? String(geraete.length) : undefined} />
      <div className="bv-flaeche" data-probe="push-geraete">
        {!geraete.length && <div className="pu-zustand"><p>{T.geraeteLeer}</p></div>}
        {geraete.map((g) => {
          const dieses = !!dieseKennung && g.kennung === dieseKennung
          const datum = datumText(g.angemeldet)
          return (
            <div key={g.id} className="bv-z pu-geraet" data-probe={`push-geraet-${g.id}`} data-dieses={dieses ? '1' : undefined}>
              <span className="bv-tx">
                <b>{g.geraet}{dieses && <span className="pu-dieses" data-probe="push-geraet-dieses">{T.diesesGeraet}</span>}</b>
                {datum && <small className="pu-datum">angemeldet am {datum}</small>}
              </span>
              <button type="button" className="bv-knopf" disabled={!!laeuft} data-probe={`push-geraet-abmelden-${g.id}`}
                aria-label={`${g.geraet}${dieses ? ' (dieses Gerät)' : ''} abmelden`} onClick={() => onAbmelden(g, dieses)}>
                {laeuft === g.id ? '…' : T.geraetAbmelden}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
