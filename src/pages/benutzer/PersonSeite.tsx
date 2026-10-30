// Eine Person anlegen oder bearbeiten — als ganze Seite.
// Die Speicherlogik stammt aus Unitarii.tsx (saveUser). Ein Passwort setzt hier niemand:
// Die Person legt es selbst fest (Willkommens-E-Mail, Passwort-Link). Ohne E-Mail bekommt
// sie eine Platzhalter-Adresse und kann sich nicht anmelden, bis eine E-Mail nachgetragen ist.

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { befristungBis, getRoleTemplate, isPlaceholderEmail, neuePlatzhalterEmail, ohneRechte, zeitpunktBefristung } from '../../lib/apps'
import {
  EINZELN, eigeneRollen, rechteAusRollen, rechteTeilnehmende, rollenFarbe, rollenFuer, rollenNamen, rollenOrdnen, rollenVon, type RollenEintrag,
} from '../../lib/rollen'
import { mitgebracht } from '../../lib/verknuepfung'
import { zufallsPasswort } from '../../lib/passwort'
import { willkommenSenden } from '../../lib/willkommen'
import WillkommenKnopf from '../../components/WillkommenKnopf'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, RechteAnzeige, SchalterZeile, Seite } from './bausteine'
import { anlegeFehler, einrichtungsFehler, anmeldeAdresse, autodateFehler, anzahl, anzahlRechte, aufzaehlung, fmtDateTimeLocal, inDauer, initialen, type UUser } from './logik'
import type { BvKontext } from './kontext'
import { rechtName as rechtNameBei } from './abgleich'

type TempRechte = Record<string, { until: string; granted_by?: string }>

const DAUERN = [{ h: 1, l: '1 Std.' }, { h: 4, l: '4 Std.' }, { h: 12, l: '12 Std.' }, { h: 24, l: '24 Std.' }, { h: 24 * 7, l: '7 Tage' }]

/** Hinweis unter einer Rolle: vorgegebene mit ihrem Text, eigene mit Beschreibung oder den Rechten, die sie gibt */
export function rollenHinweis(r: RollenEintrag, k: Pick<BvKontext, 'org' | 'orgRolePerms' | 'rechte'>): string {
  if (!r.eigen) return r.hinweis
  const eigen = eigeneRollen(k.org).find(e => e.id === r.id)
  if (!eigen) return r.hinweis // gelöschte Rolle
  const vorne = eigen.archiviert ? 'Archiviert. ' : ''
  if (eigen.hinweis) return vorne + eigen.hinweis
  const t = getRoleTemplate(r.id, { role_permissions: k.orgRolePerms })
  const namen = k.rechte.filter(x => t[x.key] === true).map(x => x.label)
  return vorne + (namen.length ? namen.join(', ') : 'Gibt keine Rechte')
}

/**
 * Rollen zum Ankreuzen: vorgegebene, dann die eigenen der Organisation. Mehrere gehen
 * zusammen und ihre Rechte zählen zusammen; Leitung und Teilnehmende stehen allein.
 */
export function RollenAuswahl({ k, werte, onChange }: { k: BvKontext; werte: string[]; onChange: (ids: string[]) => void }) {
  // Archivierte nur, wenn die Person sie schon hat; Unbekannte (gelöschte) erscheinen, damit man sie abwählen kann
  const bekannt = rollenFuer(k.org, { mitArchivierten: true }).filter(r => !r.archiviert || werte.includes(r.id))
  const unbekannt = werte.filter(id => !bekannt.some(r => r.id === id)).map(id => rollenFuer(k.org, { aktuelle: id }).find(r => r.id === id)
    ?? { id, name: id, hinweis: 'Diese Rolle ist hier nicht bekannt und gibt keine Rechte.', eigen: true, archiviert: true, farbe: 'ardesia' as const })
  const rollen = [...bekannt, ...unbekannt]
  function umschalten(id: string) {
    if (werte.includes(id)) {
      const rest = werte.filter(w => w !== id)
      onChange(rest.length ? rest : ['benutzer'])
    } else if (EINZELN.includes(id)) onChange([id])
    else onChange([...werte.filter(w => !EINZELN.includes(w)), id])
  }
  const zeile = (r: RollenEintrag) => (
    <button key={r.id} type="button" role="checkbox" aria-checked={werte.includes(r.id)} className="bv-z bv-wahl" onClick={() => umschalten(r.id)}>
      <span className="bv-kasten" aria-hidden="true"><Icon n="haken" /></span>
      <span className="bv-tx">
        <b><i className="bv-punkt" style={{ background: `var(--rolle-${r.farbe})` }} aria-hidden="true" />{r.name}</b>
        <small>{rollenHinweis(r, k)}</small>
      </span>
    </button>
  )
  const eigene = rollen.filter(r => r.eigen)
  return (
    <>
      <div className="bv-flaeche" role="group" aria-label="Rollen">{rollen.filter(r => !r.eigen).map(zeile)}</div>
      {eigene.length > 0 && (
        <>
          <h3 className="bv-gruppe">Eigene Rollen der {k.orgName}</h3>
          <div className="bv-flaeche" role="group" aria-label="Eigene Rollen">{eigene.map(zeile)}</div>
        </>
      )}
    </>
  )
}

export default function PersonSeite({ k, editingUser }: { k: BvKontext; editingUser: UUser | null }) {
  const { user, org, orgVerkn, orgRolePerms, rechte, showMsg } = k
  const platzhalter = !!editingUser && isPlaceholderEmail(editingUser.email)
  const istSelbst = editingUser?.id === user.id

  const [userForm, setUserForm] = useState(() => {
    const u = editingUser
    // Abgelaufene Befristungen fallen beim Öffnen weg
    const cleanTemp: TempRechte = {}
    if (u?.temp_permissions) {
      const now = Date.now()
      for (const [key, v] of Object.entries(u.temp_permissions)) {
        // Noch gültige Befristungen ins PocketBase-Format bringen — erst dann prüfen
        // die Server-Regeln sie (altes ISO-Format zählt dort nicht)
        const t = v?.until ? zeitpunktBefristung(v.until) : 0
        if (t > now) cleanTemp[key] = { ...v, until: befristungBis(t) }
      }
    }
    return u ? {
      // Ohne eigene Adresse bleibt das Feld leer: Die erzeugte Platzhalter-Adresse zeigen wir nicht
      name: u.name || '', email: isPlaceholderEmail(u.email) ? '' : u.email || '', contact_email: u.contact_email || '', phone: u.phone || '',
      rollen: rollenVon(u),
      disabled: !!u.disabled,
      expires_at: fmtDateTimeLocal(u.expires_at),
      temp_permissions: cleanTemp,
    } : {
      name: '', email: '', contact_email: '', phone: '',
      rollen: ['benutzer'],
      disabled: false, expires_at: '',
      temp_permissions: {} as TempRechte,
    }
  })
  const [savingUser, setSavingUser] = useState(false)
  const [linkLaeuft, setLinkLaeuft] = useState(false)
  const [tempPermKey, setTempPermKey] = useState('')

  const rechtName = (key: string) => rechtNameBei(key, rechte)
  const setze = <K extends keyof typeof userForm>(feld: K, wert: (typeof userForm)[K]) => setUserForm(p => ({ ...p, [feld]: wert }))

  // Was die Person darf, kommt aus ihren Rollen. Teilnehmende dürfen nur Unitas, und das
  // schalten die Ausbildungen frei: Bei ihnen bleibt nur dieses eine gespeicherte Recht.
  const teilnehmend = userForm.rollen[0] === 'teilnehmer' && userForm.rollen.length === 1
  const soll: Record<string, boolean> = teilnehmend
    ? rechteTeilnehmende(editingUser?.role === 'teilnehmer' ? editingUser.permissions : null)
    : rechteAusRollen(userForm.rollen, orgRolePerms, orgVerkn, org)

  function addTempPerm(key: string, hours: number) {
    if (!key) return
    const until = befristungBis(Date.now() + hours * 3600 * 1000)
    const von = user?.name || user?.email || ''
    setUserForm(p => {
      const temp = { ...p.temp_permissions, [key]: { until, granted_by: von } }
      // Verknüpfte Rechte gelten genauso lange — außer sie sind schon dauerhaft oder länger da
      for (const z of mitgebracht(key, orgVerkn, org)) {
        if (soll[z]) continue
        const bisher = temp[z]?.until
        if (bisher && zeitpunktBefristung(bisher) >= zeitpunktBefristung(until)) continue
        temp[z] = { until, granted_by: von }
      }
      return { ...p, temp_permissions: temp }
    })
    setTempPermKey('')
  }

  function removeTempPerm(key: string) {
    setUserForm(p => {
      const next = { ...p.temp_permissions }
      delete next[key]
      return { ...p, temp_permissions: next }
    })
  }

  async function saveUser() {
    if (!userForm.name.trim()) { showMsg('Der Name fehlt', 'error'); return }
    const adresse = anmeldeAdresse(userForm.email, editingUser ? editingUser.email : undefined, neuePlatzhalterEmail)
    if ('fehler' in adresse) { showMsg(adresse.fehler, 'error'); return }
    // Sich selbst die Benutzerverwaltung nehmen sperrt einen hier aus — nur nach ausdrücklicher Rückfrage
    const befristetVerwalter = !!userForm.temp_permissions.unitarii && zeitpunktBefristung(userForm.temp_permissions.unitarii.until) > Date.now()
    if (istSelbst && !user.supervisor && editingUser?.permissions?.unitarii === true && !soll.unitarii && !befristetVerwalter
      && !confirm('Mit diesen Rollen nimmst du dir selbst die Benutzerverwaltung. Danach kommst du hier nicht mehr hinein. Trotzdem speichern?')) return
    if (ohneRechte({ ...userForm, role: userForm.rollen[0], permissions: soll, supervisor: !!editingUser?.supervisor })
      && !confirm(`${userForm.name.trim()} hat kein einziges Recht und sieht nach dem Anmelden nichts. Trotzdem speichern?`)) return
    setSavingUser(true)
    try {
      const expIso = userForm.expires_at ? new Date(userForm.expires_at).toISOString() : null
      // Erste Rolle in users.role (zählt in den Server-Regeln), weitere in users.zusatzrollen
      const geordnet = rollenOrdnen(userForm.rollen)
      const base: Record<string, unknown> = {
        name: userForm.name.trim(),
        ...(adresse.email ? { email: adresse.email } : {}),
        contact_email: userForm.contact_email.trim(),
        phone: userForm.phone.trim(), ...geordnet,
        permissions: soll, disabled: userForm.disabled,
        expires_at: expIso,
        temp_permissions: userForm.temp_permissions,
      }

      if (editingUser) {
        // Kein Passwort von hier: Das legt die Person selbst fest (Willkommens-E-Mail, Passwort-Link)
        const neu = await pb.collection('users').update(editingUser.id, base)
        const probleme = einrichtungsFehler(geordnet.zusatzrollen.length > 0 && !('zusatzrollen' in neu), autodateFehler(expIso, neu.expires_at))
        if (probleme) showMsg('Gespeichert, aber: ' + probleme, 'error')
        else if (adresse.nachgetragen) {
          // Bisher ohne E-Mail: Jetzt kommt die Willkommens-E-Mail mit dem Link zum eigenen Passwort
          const w = await willkommenSenden(editingUser.id)
          showMsg(w.ok ? `Gespeichert. ${w.text}` : `Gespeichert, aber die Willkommens-E-Mail ging nicht raus: ${w.text}`, w.ok ? 'success' : 'error')
        } else showMsg('Benutzer gespeichert')
      } else {
        // Kein Passwort vom Verwalter: Der Benutzer legt es über die Willkommens-E-Mail fest
        const unbekannt = zufallsPasswort()
        const neu = await pb.collection('users').create({
          ...base,
          password: unbekannt,
          passwordConfirm: unbekannt,
          organization_id: user!.organization_id,
          emailVisibility: true,
          // Die Rechte stehen schon fest — die Übernahme beim ersten Login (useAuth) entfällt
          permissions_migrated: true,
        })
        const probleme = einrichtungsFehler(geordnet.zusatzrollen.length > 0 && !('zusatzrollen' in neu), autodateFehler(expIso, neu.expires_at))
        if (probleme) showMsg('Angelegt, aber: ' + probleme, 'error')
        else showMsg(isPlaceholderEmail(adresse.email)
          ? 'Benutzer angelegt. Ohne E-Mail kann sich die Person nicht anmelden.'
          : 'Benutzer angelegt. Das Passwort legt die Person über die Willkommens-E-Mail fest.')
      }
      k.schliessen()
      await k.loadUsers()
    } catch (e) { showMsg(anlegeFehler(e, !editingUser), 'error') }
    finally { setSavingUser(false) }
  }

  // Link zum Passwort-Festlegen an die gespeicherte Adresse (z. B. Willkommens-E-Mail nicht angekommen)
  async function passwortLinkSenden() {
    if (!editingUser?.email) return
    setLinkLaeuft(true)
    try {
      await pb.collection('users').requestPasswordReset(editingUser.email)
      showMsg(`Link an ${editingUser.email} gesendet`)
    } catch (e: any) { showMsg('Nicht gesendet: ' + (e?.message || e), 'error') }
    finally { setLinkLaeuft(false) }
  }

  async function deleteUser(id: string) {
    if (!confirm('Benutzer endgültig löschen? Empfohlen: stattdessen sperren.')) return
    try {
      await pb.collection('users').delete(id)
      k.schliessen()
      await k.loadUsers()
      showMsg('Gelöscht')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
  }

  const n = anzahlRechte(soll, rechte)
  const tempListe = Object.entries(userForm.temp_permissions)
  const rollenName = rollenNamen(userForm.rollen, org)
  const tempWahl = rechte.filter(p => !soll[p.key] && !userForm.temp_permissions[p.key])
  // Was sich beim Speichern an den Rechten ändert, wenn die Person bisher andere hatte als ihre Rollen
  // Auch Rechte gesperrter Module und solche ohne Schalter (etwa Produktausgabe) zählen: Speichern schreibt alle
  const neuDazu = editingUser ? Object.keys(soll).filter(key => soll[key] && editingUser.permissions?.[key] !== true).map(rechtName) : []
  const neuWeg = editingUser ? Object.keys(soll).filter(key => !soll[key] && editingUser.permissions?.[key] === true).map(rechtName) : []

  return (
    <Seite titel={editingUser ? (editingUser.name || 'Benutzer bearbeiten') : 'Neuer Benutzer'} unter={k.orgName} zurueck={k.schliessen}
      rechts={editingUser ? <span className="bv-ava" aria-hidden="true" style={{ background: userForm.disabled ? 'rgba(var(--lbf-grau-rgb),0.45)' : rollenFarbe(rollenOrdnen(userForm.rollen).role, org) }}>{initialen(userForm.name, userForm.email)}</span> : undefined}
      leiste={<Leiste titel={rollenName} unter={anzahl(n, 'Recht', 'Rechte') + (tempListe.length ? `, ${tempListe.length} befristet` : '')}
        knopf={editingUser ? 'Speichern' : 'Benutzer anlegen'} icon={editingUser ? 'haken' : 'personplus'} onClick={saveUser} laeuft={savingUser} />}>

      <Abschnitt titel="Person" erst />
      <Feld label="Name" erst>
        <input className="bv-eingabe" value={userForm.name} onChange={e => setze('name', e.target.value)} placeholder="Vor- und Nachname" autoComplete="off" />
      </Feld>
      <Feld label="E-Mail" zusatz={editingUser && !platzhalter ? undefined : 'optional'}
        hinweis={!editingUser
          ? 'Mit E-Mail kommt eine Willkommens-E-Mail mit dem Link zum eigenen Passwort. Ohne kann sich die Person nicht anmelden.'
          : platzhalter
            ? 'Noch keine. Ohne E-Mail kann sich die Person nicht anmelden. Trägst du eine ein, bekommt sie die Willkommens-E-Mail und legt ihr Passwort selbst fest.'
            : undefined}>
        <input className="bv-eingabe" type="email" inputMode="email" value={userForm.email} onChange={e => setze('email', e.target.value)} placeholder="name@beispiel.de" autoComplete="off" />
      </Feld>
      <Feld label="Kontakt-E-Mail" zusatz={userForm.email.trim() ? 'optional, falls abweichend' : 'optional'}>
        <input className="bv-eingabe" type="email" inputMode="email" value={userForm.contact_email} onChange={e => setze('contact_email', e.target.value)} placeholder="name@beispiel.de" autoComplete="off" />
      </Feld>
      <Feld label="Telefon" zusatz="optional">
        <input className="bv-eingabe" type="tel" inputMode="tel" value={userForm.phone} onChange={e => setze('phone', e.target.value)} placeholder="Für Rückfragen" autoComplete="off" />
      </Feld>

      <Abschnitt titel="Rollen" rechts={userForm.rollen.length > 1 ? anzahl(userForm.rollen.length, 'Rolle', 'Rollen') : undefined} />
      <Hinweis oben>Was die Person darf, kommt aus ihren Rollen. Mehrere zählen zusammen.</Hinweis>
      <RollenAuswahl k={k} werte={userForm.rollen} onChange={rollen => setze('rollen', rollen)} />
      {(neuDazu.length > 0 || neuWeg.length > 0) && (
        <div className="bv-notiz" role="status" style={{ marginTop: 12 }}>
          <b>Bisher andere Rechte als die Rollen</b>
          {neuDazu.length > 0 && <p>Mit dem Speichern kommt dazu: {aufzaehlung(neuDazu)}.</p>}
          {neuWeg.length > 0 && <p>Mit dem Speichern fällt weg: {aufzaehlung(neuWeg)}. Braucht die Person das weiter, gib ihr eine Rolle, die es enthält, oder lege eine eigene Rolle an.</p>}
        </div>
      )}

      <Abschnitt titel="Darf" rechts={`${n} von ${rechte.length}`} />
      {teilnehmend
        ? <Hinweis oben>Teilnehmende bekommen Unitas über die Ausbildungen. Weitere Rechte gibt es nur befristet.</Hinweis>
        : <RechteAnzeige rechte={rechte} werte={soll} />}

      <Abschnitt titel="Befristete Rechte" rechts={tempListe.length ? anzahl(tempListe.length, 'aktiv', 'aktiv') : undefined} />
      {tempListe.length === 0
        ? <Hinweis oben>Keine. Zum Beispiel Lager für vier Stunden, etwa für eine Aushilfe.</Hinweis>
        : (
          <div className="bv-flaeche">
            {tempListe.map(([key, val]) => (
              <div key={key} className="bv-z">
                <span className="bv-tx"><b>{rechtName(key)}</b><small>läuft ab {inDauer(zeitpunktBefristung(val.until) - Date.now())}</small></span>
                <button type="button" className="bv-knopf" onClick={() => removeTempPerm(key)}>Entfernen</button>
              </div>
            ))}
          </div>
        )}
      <Feld label="Recht befristet geben">
        <Auswahl value={tempPermKey} onChange={setTempPermKey} label="Recht befristet geben">
          <option value="">Recht wählen</option>
          {tempWahl.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Auswahl>
      </Feld>
      <div className="bv-segmente" style={{ marginTop: 10 }} role="group" aria-label="Für wie lange">
        {DAUERN.map(opt => (
          <button key={opt.h} type="button" className="bv-seg" disabled={!tempPermKey} onClick={() => addTempPerm(tempPermKey, opt.h)}>{opt.l}</button>
        ))}
      </div>
      {tempPermKey && <Hinweis>Für wie lange? Ein Tipp auf die Dauer gibt das Recht.</Hinweis>}

      <Abschnitt titel="Zugang" />
      <div className="bv-flaeche">
        <SchalterZeile titel="Gesperrt" unter="Kann sich nicht anmelden" an={userForm.disabled} onChange={v => setze('disabled', v)} />
        <SchalterZeile titel="Zugang befristen" unter="Endet automatisch an einem Datum" an={!!userForm.expires_at}
          onChange={v => setze('expires_at', v ? fmtDateTimeLocal(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()) : '')} />
      </div>
      {/* Supervisor vergibt nur der Betreiber direkt in PocketBase, nie die App */}
      {editingUser?.supervisor && <Hinweis>Supervisor: Dieses Recht wird nur direkt in PocketBase vergeben.</Hinweis>}
      {userForm.expires_at && (
        <Feld label="Endet am">
          <input className="bv-eingabe" type="datetime-local" value={userForm.expires_at} onChange={e => setze('expires_at', e.target.value)} />
        </Feld>
      )}

      {editingUser && (!platzhalter || !istSelbst) && (
        <>
          <Abschnitt titel="Aktionen" />
          {!platzhalter && <Hinweis oben>Das Passwort legt die Person selbst fest. Hat sie es vergessen oder keine Willkommens-E-Mail bekommen, schick ihr den Link.</Hinweis>}
          <div className="bv-flaeche">
            {!platzhalter && (
              <>
                <div className="bv-willkommen"><WillkommenKnopf userId={editingUser.id} label="Willkommens-E-Mail erneut senden" /></div>
                <button type="button" className="bv-z aktion" onClick={passwortLinkSenden} disabled={linkLaeuft}>
                  <span className="bv-tx">{linkLaeuft ? 'Wird gesendet…' : 'Passwort-Link senden'}</span>
                </button>
              </>
            )}
            {!istSelbst && (
              <button type="button" className="bv-z gefahr" onClick={() => deleteUser(editingUser.id)}>
                <span className="bv-tx">Benutzer löschen</span><Icon n="kreuz" className="bv-klein" />
              </button>
            )}
          </div>
          {!istSelbst && <Hinweis>Löschen ist endgültig. Besser: oben unter Zugang sperren.</Hinweis>}
        </>
      )}
    </Seite>
  )
}
