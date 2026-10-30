// Abgleich: Wer hat gespeicherte Rechte, die nicht zu seinen Rollen passen? Etwa
// Einzelrechte aus der Zeit, als Rechte je Person vergeben wurden, oder eine Rolle,
// deren Änderung nicht übernommen wurde. Je Gruppe gleicher Abweichung: an die Rollen
// angleichen, oder die Sonderrechte als eigene Rolle behalten.

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { abweichung, eigeneRollen, rechteAusRollen, rolleAnlegen, rolleBekannt, rollenOrdnen, rollenText, rollenVon, type Vorlagen } from '../../lib/rollen'
import { abgleichPlan, abgleichSchreiben, frischeBenutzer, gruppieren, rechtName, rechtNamen, type Aenderung } from './abgleich'
import { Abschnitt, Hinweis, Icon, Leiste, Seite } from './bausteine'
import { FELD_FEHLT, eigeneFeldDa, orgLesen } from './RolleSeite'
import { ZUSATZ_FEHLT, anzahl, aufzaehlung, orgFehler } from './logik'
import type { BvKontext } from './kontext'
import type { Unterseite } from './Listen'

export default function AbgleichSeite({ k, oeffne }: { k: BvKontext; oeffne: (s: Unterseite, id?: string) => void }) {
  const { org, orgRolePerms, orgVerkn, rechte, showMsg } = k
  const [laeuft, setLaeuft] = useState('')
  const plan = abgleichPlan(k.users, orgRolePerms, orgVerkn, org, undefined, k.user.id)
  const gruppen = gruppieren(plan)
  // Die eigenen Rechte gleicht man auf der eigenen Seite an (dort fragt die App, bevor man sich aussperrt)
  const ich = k.users.find(u => u.id === k.user.id)
  const selbstAbweichend = !!ich && !!abweichung(ich, orgRolePerms, orgVerkn, org)
  const unbekannt = org ? k.users.filter(u => !u.supervisor && rollenVon(u).some(id => !rolleBekannt(id, org))) : []
  const feldDa = eigeneFeldDa(k.orgFrisch)

  async function angleichen(liste: Aenderung[], key: string) {
    const orgId = k.user.organization_id
    if (!orgId) return
    setLaeuft(key)
    try {
      // Frisch lesen und neu rechnen: Hat inzwischen jemand Rollen geändert, gilt der neue Stand
      const ids = new Set(liste.map(a => a.u.id))
      const frisch = abgleichPlan(await frischeBenutzer(orgId), orgRolePerms, orgVerkn, org, u => ids.has(u.id), k.user.id)
      const e = await abgleichSchreiben(frisch)
      await k.loadUsers()
      showMsg(e.fehler ? `${e.ok} angeglichen, bei ${e.fehler} ging es nicht.` : `${anzahl(e.ok, 'Person', 'Personen')} angeglichen.`, e.fehler ? 'error' : 'success')
    } finally { setLaeuft('') }
  }

  // Die Rechte, die keine Rolle der Gruppe gibt, werden eine eigene Rolle, die alle in der Gruppe dazubekommen
  async function alsRolleBehalten(g: Aenderung[], key: string) {
    const orgId = k.user.organization_id
    const extra = g[0].weg
    if (!orgId || !extra.length) return
    // Eine Rolle bringt verknüpfte Rechte mit: vorher sagen, was die Rolle insgesamt gibt
    const gibt = Object.entries(rechteAusRollen(['neu'], { neu: Object.fromEntries(extra.map(x => [x, true])) }, orgVerkn, org)).filter(([, w]) => w).map(([x]) => x)
    const name = window.prompt(`Neue eigene Rolle mit ${rechtNamen(gibt, rechte)}. Name:`, 'Sonderrechte')
    if (!name?.trim()) return
    setLaeuft(key)
    try {
      const frisch = await orgLesen(orgId)
      if (!('eigene_rollen' in frisch)) { k.setOrgFrisch(frisch); showMsg(FELD_FEHLT, 'error'); return }
      const erg = rolleAnlegen(eigeneRollen(frisch), { name, hinweis: `Übernommen aus Einzelrechten: ${rechtNamen(extra, rechte)}` })
      if ('fehler' in erg) { showMsg('Nicht angelegt: ' + erg.fehler, 'error'); return }
      const rp: Vorlagen = { ...((frisch.role_permissions as Vorlagen | undefined) ?? {}), [erg.id]: Object.fromEntries(extra.map(x => [x, true])) }
      const o = await pb.collection('organizations').update(orgId, { eigene_rollen: erg.rollen, role_permissions: rp }, { requestKey: null })
      k.setOrgFrisch(o)
      if (!('eigene_rollen' in o)) { showMsg(FELD_FEHLT, 'error'); return }
      k.setOrgRolePerms((o.role_permissions as Vorlagen | undefined) ?? rp)
      let fehler = 0, feldFehlt = false
      // Frisch lesen: die aktuellen Rollen der Personen, nicht die vom Öffnen der Seite
      const aktuell = new Map((await frischeBenutzer(orgId)).map(u => [u.id, u]))
      for (const a0 of g) {
        const a = { ...a0, u: aktuell.get(a0.u.id) ?? a0.u }
        const rollen = rollenOrdnen([...rollenVon(a.u), erg.id])
        try {
          const neu = await pb.collection('users').update(a.u.id, {
            ...rollen, permissions: rechteAusRollen([rollen.role, ...rollen.zusatzrollen], rp, orgVerkn, o),
          }, { requestKey: null })
          if (rollen.zusatzrollen.length && !('zusatzrollen' in neu)) feldFehlt = true
        } catch { fehler++ }
      }
      await k.loadUsers()
      if (feldFehlt) showMsg(ZUSATZ_FEHLT, 'error')
      else showMsg(fehler ? `Rolle angelegt, bei ${fehler} Personen ging das Zuweisen nicht.` : `Rolle „${name.trim()}“ angelegt und ${anzahl(g.length, 'Person', 'Personen')} zugewiesen.`, fehler ? 'error' : 'success')
    } catch (e) { showMsg(orgFehler(e), 'error') }
    finally { setLaeuft('') }
  }

  const name = (keys: string[]) => aufzaehlung(keys.map(key => rechtName(key, rechte)))

  // Rückfrage vor „Alle angleichen“: was wie vielen wegfällt, die heiklen Rechte zuerst
  function alleFrage(liste: Aenderung[]): string {
    const zaehle = (art: 'dazu' | 'weg') => {
      const n = new Map<string, number>()
      for (const a of liste) for (const key of a[art]) n.set(key, (n.get(key) ?? 0) + 1)
      const zuerst = ['unitarii', 'patienten']
      return [...n.entries()].sort((x, y) => (zuerst.indexOf(y[0]) - zuerst.indexOf(x[0])) || y[1] - x[1])
        .map(([key, z]) => `${rechtNamen([key], rechte)} (${z})`)
    }
    const weg = zaehle('weg'), dazu = zaehle('dazu')
    return [`Bei ${liste.length} Personen die Rechte an ihre Rollen angleichen?`,
      weg.length ? `\nFällt weg: ${weg.join(', ')}` : '', dazu.length ? `\nKommt dazu: ${dazu.join(', ')}` : ''].filter(Boolean).join('\n')
  }

  return (
    <Seite titel="Abgleich" unter={k.orgName} zurueck={k.schliessen}
      leiste={plan.length > 1 ? <Leiste titel={anzahl(plan.length, 'Person', 'Personen')} unter="weichen von ihren Rollen ab" knopf="Alle angleichen" icon="haken"
        onClick={() => { if (confirm(alleFrage(plan))) angleichen(plan, 'alle') }} laeuft={laeuft === 'alle'} /> : undefined}>
      <Hinweis oben>Was jemand darf, kommt jetzt aus seinen Rollen. Diese Personen haben gespeicherte Rechte, die nicht zu ihren Rollen passen.</Hinweis>

      {selbstAbweichend && (
        <div className="bv-notiz" style={{ marginBottom: 12 }}>
          <b>Deine eigenen Rechte</b>
          <p>Weichen auch ab. Die gleichst du auf deiner eigenen Seite an; dort fragt die App, bevor du dir die Benutzerverwaltung nimmst.</p>
          <button type="button" className="bv-knopf" onClick={() => oeffne('person', k.user.id)}>Meine Seite</button>
        </div>
      )}

      {gruppen.length === 0 && unbekannt.length === 0 && !selbstAbweichend && (
        <div className="bv-notiz" role="status"><b>Alle sind auf Stand</b><p>Jede Person hat genau die Rechte ihrer Rollen.</p></div>
      )}

      {gruppen.map((g, i) => {
        const key = `g${i}`
        const erste = g[0]
        return (
          <section key={key}>
            <Abschnitt titel={rollenText(erste.u, org)} rechts={anzahl(g.length, 'Person', 'Personen')} erst={i === 0} />
            <div className="bv-flaeche">
              {g.map(a => (
                <button key={a.u.id} type="button" className="bv-z" onClick={() => oeffne('person', a.u.id)}>
                  <span className="bv-tx"><b>{a.u.name || 'Ohne Namen'}</b></span><Icon n="weiter" className="bv-pfeil" />
                </button>
              ))}
            </div>
            {erste.dazu.length > 0 && <Hinweis>Angleichen gibt dazu: {name(erste.dazu)}.</Hinweis>}
            {erste.weg.length > 0 && <Hinweis>Angleichen nimmt weg: {name(erste.weg)}. Wird das weiter gebraucht, behalte es als eigene Rolle.</Hinweis>}
            <div className="bv-reihe" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" className="bv-knopf" disabled={!!laeuft} onClick={() => angleichen(g, key)}>{laeuft === key ? 'Läuft…' : 'Angleichen'}</button>
              {erste.weg.length > 0 && (
                <button type="button" className="bv-knopf" disabled={!!laeuft || !feldDa} onClick={() => alsRolleBehalten(g, key + 'r')}>
                  {laeuft === key + 'r' ? 'Läuft…' : 'Als eigene Rolle behalten'}
                </button>
              )}
            </div>
          </section>
        )
      })}

      {unbekannt.length > 0 && (
        <>
          <Abschnitt titel="Unbekannte Rollen" rechts={anzahl(unbekannt.length, 'Person', 'Personen')} />
          <Hinweis oben>Diese Personen haben eine Rolle, die es hier nicht gibt (alter Wert oder gelöschte Rolle). Sie gibt keine Rechte. Bitte bei der Person die Rollen neu wählen.</Hinweis>
          <div className="bv-flaeche">
            {unbekannt.map(u => (
              <button key={u.id} type="button" className="bv-z" onClick={() => oeffne('person', u.id)}>
                <span className="bv-tx"><b>{u.name || 'Ohne Namen'}</b><small>{rollenVon(u).filter(id => !rolleBekannt(id, org)).join(', ')}</small></span>
                <Icon n="weiter" className="bv-pfeil" />
              </button>
            ))}
          </div>
        </>
      )}
    </Seite>
  )
}
