// „Apps anpassen“ (/hub?seite=apps): welche der erlaubten Apps im Hub stehen und in welcher
// Reihenfolge. Je App ein Schalter und Hoch/Runter. Einstellungen und befristet freigegebene
// Apps bleiben immer im Hub (Schalter gesperrt), lassen sich aber verschieben.

import { useEffect, useLayoutEffect, useRef } from 'react'
import HubIcon from '../../components/HubIcon'
import { ALL_APPS } from '../../lib/apps'
import { istFest, reihenfolgeAlle, umschalten, verschieben, wahlStandard, befristetBis } from '../../lib/hubApps'
import { Seite } from '../benutzer/bausteine'
import type { User } from '../../types'
import type { HubApps } from './useHubApps'

const zeitText = (ms: number) => {
  const d = new Date(ms)
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
}

const Pfeil = ({ hoch }: { hoch?: boolean }) => (
  <svg className="bv-i" viewBox="0 0 24 24" aria-hidden="true"><path d={hoch ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
)

export default function AppsSeite({ user, orgName, apps, schliessen }: { user: User | null; orgName: string; apps: HubApps; schliessen: () => void }) {
  const { wahl, erlaubt, befristet, kacheln, feldDa, stand, fehlerText, aendern, jetztSpeichern } = apps
  const liste = useRef<HTMLDivElement>(null)
  const fokus = useRef<{ id: string; richtung: -1 | 1 } | null>(null)
  const alle = reihenfolgeAlle(wahl, erlaubt)

  // Beim Verlassen sofort ins Konto
  useEffect(() => () => { void jetztSpeichern() }, [jetztSpeichern])

  // Nach dem Verschieben bleibt der Fokus auf dem gedrückten Knopf (am Rand: auf dem anderen)
  useLayoutEffect(() => {
    const f = fokus.current
    if (!f || !liste.current) return
    fokus.current = null
    const zeile = liste.current.querySelector<HTMLElement>(`[data-app="${f.id}"]`)
    const knopf = zeile?.querySelector<HTMLButtonElement>(f.richtung < 0 ? '.hoch' : '.runter')
    const anders = zeile?.querySelector<HTMLButtonElement>(f.richtung < 0 ? '.runter' : '.hoch')
    const ziel = knopf && !knopf.disabled ? knopf : anders
    if (ziel && document.activeElement !== ziel) ziel.focus()
  })

  function schieben(id: string, richtung: -1 | 1) {
    fokus.current = { id, richtung }
    aendern(verschieben(wahl, erlaubt, id, richtung))
  }

  function zuruecksetzen() {
    if (!confirm('Alle deine Apps wieder im Hub zeigen, in der ursprünglichen Reihenfolge?')) return
    aendern(wahlStandard(), true)
  }

  const standText = stand === 'fehler' ? fehlerText
    : stand === 'konto' ? 'Gespeichert in deinem Konto, gilt auf allen Geräten.'
    : stand === 'geraet' ? 'Nur auf diesem Gerät gespeichert.'
    : feldDa ? 'Änderungen gelten sofort und werden in deinem Konto gespeichert.'
    : 'Änderungen gelten sofort und werden auf diesem Gerät gespeichert.'

  return (
    <Seite titel="Apps anpassen" unter={orgName} zurueck={schliessen} zurueckLabel="Zurück zum Hub">
      <div data-probe="hub-apps-anpassen">
        <p className="bv-hinweis oben">Wähle, welche deiner Apps im Hub stehen und in welcher Reihenfolge. Apps, die du neu bekommst, erscheinen von selbst.</p>
        {!feldDa && user && (
          <div className="bv-notiz" data-probe="hub-apps-geraet">
            <b>Nur auf diesem Gerät gespeichert</b>
            <p>Dein Konto kann die Auswahl noch nicht speichern. Sie gilt deshalb nur hier; sobald das Konto es kann, übernimmt Responda sie beim nächsten Öffnen.</p>
          </div>
        )}
        <div className="bv-ab" style={{ marginTop: 22 }}>
          <h2>Deine Apps</h2>
          <span>{kacheln.length} von {alle.length} im Hub</span>
        </div>
        {alle.length ? (
          <div className="bv-flaeche" ref={liste}>
            {alle.map((id, i) => {
              const app = ALL_APPS[id]
              const fest = istFest(id, befristet)
              const an = fest || !(wahl?.ausgeblendet ?? []).includes(id)
              const bis = befristet.includes(id) ? befristetBis(user, id) : 0
              const unter = id === 'settings' ? 'Bleibt immer im Hub'
                : bis ? `Befristet bis ${zeitText(bis)}, bis dahin immer im Hub`
                : !an ? 'Ausgeblendet' : ''
              return (
                <div key={id} className={`bv-z hub-app-zeile${an ? '' : ' aus'}`} data-probe="hub-app-zeile" data-app={id}>
                  <HubIcon id={id} groesse={34} />
                  <span className="bv-tx"><b>{app.name}</b>{unter && <small>{unter}</small>}</span>
                  <span className="hub-steuer">
                    <button type="button" className="hub-pfeil hoch" aria-label={`${app.name} nach oben`} disabled={i === 0} onClick={() => schieben(id, -1)}><Pfeil hoch /></button>
                    <button type="button" className="hub-pfeil runter" aria-label={`${app.name} nach unten`} disabled={i === alle.length - 1} onClick={() => schieben(id, 1)}><Pfeil /></button>
                    <button type="button" className="hub-schalter" role="switch" aria-checked={an} aria-label={`${app.name} im Hub zeigen`} disabled={fest}
                      onClick={() => aendern(umschalten(wahl, id, !an, befristet))}>
                      <span className="bv-schalter" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bv-notiz"><p>Du hast noch keine Apps. Die Verantwortlichen deiner Organisation vergeben die Rechte.</p></div>
        )}
        <p className="bv-hinweis" role="status" data-probe="hub-apps-stand">{standText}</p>
        <div className="bv-flaeche" style={{ marginTop: 24 }}>
          <button type="button" className="bv-z akzent" onClick={zuruecksetzen} data-probe="hub-apps-zuruecksetzen">Zurücksetzen</button>
        </div>
      </div>
    </Seite>
  )
}
