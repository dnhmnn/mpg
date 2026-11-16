// /benachrichtigungen?seite=organisation: für die Leitung (Rolle admin, Recht Benutzerverwaltung,
// Supervisor der eigenen Organisation). Welche Anlässe in der Organisation überhaupt kommen; für
// Leitung und Supervisor zusätzlich die Mitteilung an die Organisation (Owner 12.3).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Abschnitt, Hinweis, Seite } from '../benutzer/bausteine'
import { istFehler, organisationLaden, organisationSpeichern, type OrgAnlass, type OrgStand, type PushFehler } from '../../lib/push/api'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import type { User } from '../../types'
import { ausUmschalten, darfMitteilung, gruppieren, orgAnlassSchalter } from './logik'
import MitteilungAbschnitt from './MitteilungAbschnitt'
import { Schalter } from './Schalter'

export default function OrganisationSeite({ user, orgName, zurueck, zeigen }: {
  user: User
  orgName: string
  zurueck: () => void
  zeigen: (text: string, fehler?: boolean) => void
}) {
  const [org, setOrg] = useState<OrgStand | null>(null)
  const [fehler, setFehler] = useState<PushFehler | null>(null)
  const reihe = useRef<Promise<void>>(Promise.resolve())
  const aktuell = useRef<OrgStand | null>(null)
  aktuell.current = org

  const laden = useCallback(async () => {
    const r = await organisationLaden()
    if (istFehler(r)) setFehler(r)
    else { setOrg(r.daten); setFehler(null) }
  }, [])
  useEffect(() => { void laden() }, [laden])

  function umschalten(a: OrgAnlass, an: boolean) {
    const o = aktuell.current
    if (!o) return
    const neu = { ...o, aus: ausUmschalten(o.aus, a.key, an) }
    aktuell.current = neu
    setOrg(neu)
    // Nacheinander speichern, immer den neuesten Stand
    reihe.current = reihe.current.then(async () => {
      const stand = aktuell.current
      if (!stand) return
      const r = await organisationSpeichern(stand.aus)
      if (istFehler(r)) { zeigen(r.text || T.speichernFehler, true); await laden() }
    })
  }

  const mitteilung = darfMitteilung(user) && !!user.organization_id
  const gruppen = org ? gruppieren(org.anlaesse) : []

  return (
    <Seite titel={T.orgTitel} unter={orgName} zurueck={zurueck} zurueckLabel="Zurück zu Benachrichtigungen">
      <div data-probe="push-org-seite">
        {mitteilung && <MitteilungAbschnitt orgId={user.organization_id as string} orgName={orgName} zeigen={zeigen} />}

        <Abschnitt titel="Anlässe in der Organisation" erst={!mitteilung} />
        <Hinweis oben>{T.orgHinweis}</Hinweis>
        {!org && !fehler && <div className="bv-leer" role="status">{T.laedt}</div>}
        {fehler && (
          <div className="bv-notiz" data-probe="push-org-fehler">
            <p>{fehler.text}</p>
            {fehler.fehler !== 'nicht_berechtigt' && fehler.fehler !== 'nicht_eingerichtet' && (
              <button type="button" className="bv-knopf" onClick={() => void laden()}>Erneut laden</button>
            )}
          </div>
        )}
        {org && gruppen.map((g) => (
          <section key={g.key} aria-labelledby={`pu-org-${g.key}`}>
            <h3 className="bv-gruppe" id={`pu-org-${g.key}`}>{g.titel}</h3>
            <div className="bv-flaeche">
              {g.anlaesse.map((a) => {
                const s = orgAnlassSchalter(a, org.aus)
                return <Schalter key={a.key} probe={`push-org-anlass-${a.key}`} titel={a.titel} unter={s.unter} an={s.an} disabled={s.gesperrt} onChange={(an) => umschalten(a, an)} />
              })}
            </div>
          </section>
        ))}
      </div>
    </Seite>
  )
}
