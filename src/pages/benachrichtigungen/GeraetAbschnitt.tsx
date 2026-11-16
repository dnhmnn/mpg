// „Auf diesem Gerät“: Schalter „Push auf diesem Gerät“ oder ein Hinweis, warum es hier nicht geht;
// ist Push an, „Probe senden“. Darunter immer „Keine Alarmierung“.

import { Abschnitt } from '../benutzer/bausteine'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import { zustandText, zustandTitel, type GeraetZustand } from './logik'
import { KeineAlarmierung, Schalter } from './Schalter'

export type Arbeit = 'ein' | 'aus' | 'probe' | null

export default function GeraetAbschnitt({ zustand, arbeit, onEin, onAus, onProbe }: {
  zustand: GeraetZustand
  arbeit: Arbeit
  /** muss direkt aus dem Tippen kommen (Erlaubnis ohne await davor) */
  onEin: () => void
  onAus: () => void
  onProbe: () => void
}) {
  const hinweis = zustandText(zustand)
  const unter = arbeit === 'ein' ? T.wirdEingeschaltet : arbeit === 'aus' ? T.wirdAusgeschaltet : T.schalterUnter
  return (
    <>
      <Abschnitt titel={T.abschnittGeraet} erst />
      <div className="bv-flaeche" data-probe="push-geraet" data-zustand={zustand} aria-busy={zustand === 'laedt' || !!arbeit}>
        {zustand === 'laedt' && <div className="pu-zustand" role="status"><p>{T.laedt}</p></div>}
        {hinweis && (
          <div className="pu-zustand" data-probe="push-geraet-hinweis">
            <b>{zustandTitel(zustand)}</b>
            <p>{hinweis}</p>
          </div>
        )}
        {zustand === 'neu_einschalten' && (
          <div className="pu-zustand" data-probe="push-geraet-hinweis">
            <b>{zustandTitel(zustand)}</b>
            <p>{T.neu_einschalten}</p>
            <button type="button" className="bv-knopf" data-probe="push-neu-einschalten" disabled={!!arbeit} onClick={onEin}>
              {arbeit === 'ein' ? T.wirdEingeschaltet : T.neuEinschaltenKnopf}
            </button>
          </div>
        )}
        {zustand === 'abgemeldet' && (
          <Schalter probe="push-geraet-schalter" titel={T.schalterTitel} an={false} disabled={!!arbeit}
            unter={arbeit === 'ein' ? T.wirdEingeschaltet : T.abgemeldet} onChange={() => onEin()} />
        )}
        {(zustand === 'an' || zustand === 'aus') && (
          <Schalter probe="push-geraet-schalter" titel={T.schalterTitel} unter={unter} an={zustand === 'an'} disabled={!!arbeit}
            onChange={(an) => (an ? onEin() : onAus())} />
        )}
        {zustand === 'an' && (
          <button type="button" className="bv-z pu-aktion" data-probe="push-probe-knopf" disabled={!!arbeit} onClick={onProbe}>
            <span className="bv-tx"><b>{arbeit === 'probe' ? T.probeLaeuft : T.probeKnopf}</b><small>An alle Geräte, die für dich angemeldet sind</small></span>
          </button>
        )}
      </div>
      <KeineAlarmierung text={T.keineAlarmierung} />
    </>
  )
}
