// Das Raster der Apps im Hub: je App die Farbkachel und darunter der Name.
// Befristet freigegebene Apps tragen eine zweite Zeile „bis 16.11.“.

import { useNavigate } from 'react-router-dom'
import HubIcon from '../../components/HubIcon'
import { ALL_APPS } from '../../lib/apps'

export function appOeffnen(id: string, navigate: (pfad: string) => void) {
  const app = ALL_APPS[id]
  if (!app) return
  if (id === 'settings') { navigate('/settings'); return }
  if (app.isInternal) navigate(app.url)
  else window.location.href = app.url
}

export const tagText = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

export default function Kacheln({ ids, befristetBis }: { ids: string[]; befristetBis: (id: string) => number }) {
  const navigate = useNavigate()
  return (
    <div className="hub-raster">
      {ids.map((id) => {
        const app = ALL_APPS[id]
        if (!app) return null
        const bis = befristetBis(id)
        return (
          <button key={id} type="button" className="hub-kachel" data-probe="hub-kachel" data-app={id}
            aria-label={bis ? `${app.name}, befristet bis ${tagText(bis)}` : app.name}
            onClick={() => appOeffnen(id, navigate)}>
            <HubIcon id={id} groesse={60} />
            <span className="hub-kachel-name">{app.name}</span>
            {bis > 0 && <span className="hub-kachel-bis">bis {tagText(bis)}</span>}
          </button>
        )
      })}
    </div>
  )
}
