// Profil im Hub: Name, Adresse, Rolle, Ausweis, Wege zu Apps anpassen, Einstellungen,
// Supervisor, Homebildschirm, Einführung, und Abmelden.

import { useState } from 'react'
import { hatRecht, sichtbareEmail } from '../../lib/apps'
import { rollenText } from '../../lib/rollen'
import { Icon } from '../benutzer/bausteine'
import type { User } from '../../types'
import Blatt from './Blatt'

export function initialen(name?: string | null): string {
  const teile = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!teile.length) return 'R'
  return (teile.length > 1 ? teile[0][0] + teile[teile.length - 1][0] : teile[0].slice(0, 2)).toUpperCase()
}

/** Name zum Anzeigen; nie die Platzhalter-Adresse einer Person ohne E-Mail */
export function anzeigeName(user: User | null): string {
  return user?.name?.trim() || sichtbareEmail(user?.email).split('@')[0] || ''
}

export default function ProfilBlatt({ user, onClose, onApps, onEinstellungen, onSupervisor, onEinfuehrung, onInstallieren, onAbmelden }: {
  user: User
  onClose: () => void
  onApps: () => void
  onEinstellungen: () => void
  onSupervisor: () => void
  onEinfuehrung: () => void
  /** false: der Browser bietet keine Installation an (Safari), dann steht darunter, wie es geht */
  onInstallieren: () => Promise<boolean>
  onAbmelden: () => void
}) {
  const [installHilfe, setInstallHilfe] = useState(false)
  const name = anzeigeName(user)
  const mail = sichtbareEmail(user.email)
  // Vorgegebene und eigene Rollen der Organisation (src/lib/rollen.ts)
  const rolle = user.supervisor ? 'Supervisor' : rollenText(user, user.organization)

  return (
    <Blatt titel="Profil" probe="hub-profil" onClose={onClose}>
      <div className="hub-person">
        <span className="hub-person-ini" aria-hidden="true">{initialen(name)}</span>
        <div style={{ minWidth: 0 }}>
          <b data-probe="hub-profil-name">{name}</b>
          {mail && <span>{mail}</span>}
          {rolle && <span>{rolle}</span>}
        </div>
      </div>

      <div className="hub-ausweis" data-probe="hub-ausweis">
        <div className="hub-ausweis-marke"><b>Responda</b><span>Ausweis</span></div>
        {user.organization_name && <div className="hub-ausweis-rolle" style={{ marginTop: 2 }}>{user.organization_name}</div>}
        <div className="hub-ausweis-name">{name}</div>
        {rolle && <div className="hub-ausweis-rolle">{rolle}</div>}
      </div>

      <div className="bv-flaeche">
        <button type="button" className="bv-z" onClick={onApps}>
          <span className="bv-tx"><b>Apps anpassen</b><small>Welche Apps im Hub stehen und in welcher Reihenfolge</small></span>
          <Icon n="weiter" className="bv-pfeil" />
        </button>
        {hatRecht(user, 'dashboard') && (
          <button type="button" className="bv-z" onClick={onEinstellungen}>
            <span className="bv-tx"><b>Einstellungen</b><small>Darstellung, Neuigkeiten, Benachrichtigungen</small></span>
            <Icon n="weiter" className="bv-pfeil" />
          </button>
        )}
        {user.supervisor && (
          <button type="button" className="bv-z" onClick={onSupervisor} data-probe="hub-profil-supervisor">
            <span className="bv-tx"><b>Supervisor</b><small>Organisationen und Hinweise nach Updates</small></span>
            <Icon n="weiter" className="bv-pfeil" />
          </button>
        )}
        <button type="button" className="bv-z" aria-expanded={installHilfe}
          onClick={async () => { if (!(await onInstallieren())) setInstallHilfe((x) => !x) }}>
          <span className="bv-tx"><b>Zum Homebildschirm hinzufügen</b><small>Responda startet dann wie eine App</small></span>
        </button>
        {installHilfe && <p className="hub-auf" role="status">In Safari: Teilen, dann Zum Home-Bildschirm.</p>}
        <button type="button" className="bv-z" onClick={onEinfuehrung}>
          <span className="bv-tx"><b>Einführung ansehen</b></span>
          <Icon n="weiter" className="bv-pfeil" />
        </button>
      </div>

      <div className="bv-flaeche">
        <button type="button" className="bv-z gefahr" onClick={onAbmelden}>Abmelden</button>
      </div>
    </Blatt>
  )
}
