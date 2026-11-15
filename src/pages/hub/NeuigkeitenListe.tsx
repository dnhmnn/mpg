// Zeilen der Neuigkeiten im Blatt hinter der Glocke (GlockeBlatt.tsx): offene Punkte der
// Organisation als ruhige Zeilen, eine je Modul. Was gezählt und geladen wird: useNeuigkeiten.ts.
// Farbe nur für gesperrte Medizinprodukte (--lbf-signal, Klasse hub-signal), sonst keine.

import HubIcon from '../../components/HubIcon'
import { Icon } from '../benutzer/bausteine'
import type { Neuigkeit } from './useNeuigkeiten'

export default function NeuigkeitenZeilen({ liste, onWahl }: { liste: Neuigkeit[]; onWahl: (n: Neuigkeit) => void }): JSX.Element {
  return (
    <div className="bv-flaeche" data-probe="hub-neuigkeiten">
      {liste.map((n) => (
        <button key={n.id} type="button" className="bv-z" data-probe="hub-neuigkeit" data-id={n.id} onClick={() => onWahl(n)}>
          <HubIcon id={n.app} groesse={34} />
          <span className="bv-tx">
            <b>{n.titel.map((t, i) => <span key={i} className={t.signal ? 'hub-signal' : undefined}>{t.text}</span>)}</b>
            <small>{n.satz}</small>
          </span>
          <Icon n="weiter" className="bv-pfeil" />
        </button>
      ))}
    </div>
  )
}
