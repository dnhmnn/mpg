// Ein Hub-Symbol („Farbkachel“): die runde Kachel selbst, hell und dunkel.
// Beide Bilder liegen im DOM; welches zu sehen ist, entscheidet globals.css (.hub-icon)
// nach data-theme und prefers-color-scheme. Retro zeigt die hellen Kacheln.
// <img> mit data:-Adresse statt eingebettetem SVG: keine ID-Kollisionen, kein innerHTML.

import { HUB_ICONS } from '../lib/hubIcons'
import { ALL_APPS, kachelFarbe } from '../lib/apps'
import AppIcon from './AppIcon'

export default function HubIcon({ id, groesse = 60 }: { id: string; groesse?: number }) {
  const s = HUB_ICONS[id]
  if (!s) {
    // Unbekannte App (neuer als die Symbole): ruhige Kachel in der Modulfarbe
    const app = ALL_APPS[id]
    return (
      <span className="hub-icon" aria-hidden="true"
        style={{ width: groesse, height: groesse, borderRadius: groesse * 0.2237, background: kachelFarbe(app?.color || '#600812'), color: '#fff', display: 'inline-grid', placeItems: 'center' }}>
        <span style={{ width: groesse * 0.46, height: groesse * 0.46, display: 'block' }}>{app && <AppIcon icon={app.icon} />}</span>
      </span>
    )
  }
  return (
    <span className="hub-icon" aria-hidden="true" style={{ width: groesse, height: groesse }}>
      <img className="hell" src={s.hell} alt="" draggable={false} width={groesse} height={groesse} />
      <img className="dunkel" src={s.dunkel} alt="" draggable={false} width={groesse} height={groesse} />
    </span>
  )
}
