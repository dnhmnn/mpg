// Eine Person anlegen oder bearbeiten — als ganze Seite.
// Die Speicherlogik stammt aus Unitarii.tsx (saveUser). Ein Passwort setzt hier niemand:
// Die Person legt es selbst fest (Willkommens-E-Mail, Passwort-Link). Ohne E-Mail bekommt
// sie eine Platzhalter-Adresse und kann sich nicht anmelden, bis eine E-Mail nachgetragen ist.

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { EMPTY_PERMS, PERM_LABELS, befristungBis, getRoleTemplate, isPlaceholderEmail, neuePlatzhalterEmail, ohneRechte, zeitpunktBefristung } from '../../lib/apps'
import { eigeneRollen, nurAngehakt, rollenBezeichnung, rollenFarbe, rollenFuer, vorlageBereinigen, wegfallendeRollenrechte, type RollenEintrag } from '../../lib/rollen'
import { haken, mitgebracht, vorlageMitVerknuepfungen } from '../../lib/verknuepfung'
import { zufallsPasswort } from '../../lib/passwort'
import { willkommenSenden } from '../../lib/willkommen'
import WillkommenKnopf from '../../components/WillkommenKnopf'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, RechteListe, SchalterZeile, Seite } from './bausteine'
import { anlegeFehler, anmeldeAdresse, anzahl, anzahlRechte, aufzaehlung, fmtDateTimeLocal, inDauer, initialen, type UUser } from './logik'
import type { BvKontext } from './kontext'

type TempRechte = Record<string, { until: string; granted_by?: string }>

const DAUERN = [{ h: 1, l: '1 Std.' }, { h: 4, l: '4 Std.' }, { h: 12, l: '12 Std.' }, { h: 24, l: '24 Std.' }, { h: 24 * 7, l: '7 Tage' }]

/** Hinweis unter einer Rolle: vorgegebene mit ihrem Text, eigene mit Beschreibung oder den Rechten, die sie vorsetzt */
export function rollenHinweis(r: RollenEintrag, k: Pick<BvKontext, 'org' | 'orgRolePerms' | 'rechte'>): string {
  if (!r.eigen) return r.hinweis
  const eigen = eigeneRollen(k.org).find(e => e.id === r.id)
  if (!eigen) return r.hinweis // gelöschte Rolle
  const vorne = eigen.archiviert ? 'Archiviert. ' : ''
  if (eigen.hinweis) return vorne + eigen.hinweis
  const t = getRoleTemplate(r.id, { role_permissions: k.orgRolePerms })
  const namen = k.rechte.filter(x => t[x.key] === true).map(x => x.label)
  return vorne + (namen.length ? namen.join(', ') : 'Setzt keine Rechte vor')
}

/** Rollen als Auswahl: vorgegebene, dann die eigenen der Organisation */
export function RollenWahl({ k, wert, onWahl }: { k: BvKontext; wert: string; onWahl: (id: string) => void }) {
  const rollen = rollenFuer(k.org, { aktuelle: wert })
  const zeile = (r: RollenEintrag) => (
    <button key={r.id} type="button" role="radio" aria-checked={r.id === wert} className="bv-z bv-wahl" onClick={() => onWahl(r.id)}>
      <span className="bv-radio" aria-hidden="true" />
      <span className="bv-tx">
        <b><i className="bv-punkt" style={{ background: `var(--rolle-${r.farbe})` }} aria-hidden="true" />{r.name}</b>
        <small>{rollenHinweis(r, k)}</small>
      </span>
    </button>
  )
  const eigene = rollen.filter(r => r.eigen)
  return (
    <>
      <div className="bv-flaeche" role="radiogroup" aria-label="Rolle">{rollen.filter(r => !r.eigen).map(zeile)}</div>
      {eigene.length > 0 && (
        <>
          <h3 className="bv-gruppe">Eigene Rollen der {k.orgName}</h3>
          <div className="bv-flaeche" role="radiogroup" aria-label="Eigene Rollen">{eigene.map(zeile)}</div>
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
      role: u.role || 'benutzer',
      permissions: { ...EMPTY_PERMS, ...(u.permissions || {}) } as Record<string, boolean>,
      supervisor: !!u.supervisor, disabled: !!u.disabled,
      expires_at: fmtDateTimeLocal(u.expires_at),
      temp_permissions: cleanTemp,
    } : {
      name: '', email: '', contact_email: '', phone: '',
      // Die voreingestellte Rolle setzt ihre Häkchen gleich — wie beim Wechsel der Rolle.
      // Sonst bekam ein neuer Benutzer ausdrücklich überall „nein“ und sah nach dem Anmelden nichts.
      role: 'benutzer',
      permissions: { ...EMPTY_PERMS, ...vorlageMitVerknuepfungen(getRoleTemplate('benutzer', { role_permissions: orgRolePerms }), orgVerkn, org) } as Record<string, boolean>,
      supervisor: false, disabled: false, expires_at: '',
      temp_permissions: {} as TempRechte,
    }
  })
  const [savingUser, setSavingUser] = useState(false)
  const [linkLaeuft, setLinkLaeuft] = useState(false)
  const [tempPermKey, setTempPermKey] = useState('')

  const rechtName = (key: string) => rechte.find(p => p.key === key)?.label ?? PERM_LABELS.find(p => p.key === key)?.label ?? key
  const setze = <K extends keyof typeof userForm>(feld: K, wert: (typeof userForm)[K]) => setUserForm(p => ({ ...p, [feld]: wert }))

  function rolleWaehlen(role: string) {
    // Dieselbe Rolle noch einmal angetippt: nichts tun, sonst nähme die Vorlage einzeln gesetzte Häkchen weg
    if (role === userForm.role) return
    const vorlage = vorlageMitVerknuepfungen(vorlageBereinigen(getRoleTemplate(role, { role_permissions: orgRolePerms })), orgVerkn, org)
    // Neue Person: Die Rolle bestimmt die Häkchen ganz (nichts bleibt von einer vorher angetippten Rolle).
    // Bestehende Person: nur ergänzen. Was sie einzeln hat, nimmt ein Rollenwechsel nicht still weg.
    setUserForm(p => ({ ...p, role, permissions: editingUser ? { ...p.permissions, ...nurAngehakt(vorlage) } : { ...EMPTY_PERMS, ...vorlage } }))
  }

  function addTempPerm(key: string, hours: number) {
    if (!key) return
    const until = befristungBis(Date.now() + hours * 3600 * 1000)
    const von = user?.name || user?.email || ''
    setUserForm(p => {
      const temp = { ...p.temp_permissions, [key]: { until, granted_by: von } }
      // Verknüpfte Rechte gelten genauso lange — außer sie sind schon dauerhaft oder länger da
      for (const z of mitgebracht(key, orgVerkn, org)) {
        if (p.permissions[z]) continue
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
    if (ohneRechte({ ...userForm, supervisor: editingUser ? userForm.supervisor : false })
      && !confirm(`${userForm.name.trim()} hat kein einziges Recht und sieht nach dem Anmelden nichts. Trotzdem speichern?`)) return
    setSavingUser(true)
    try {
      const expIso = userForm.expires_at ? new Date(userForm.expires_at).toISOString() : null
      const base: Record<string, unknown> = {
        name: userForm.name.trim(),
        ...(adresse.email ? { email: adresse.email } : {}),
        contact_email: userForm.contact_email.trim(),
        phone: userForm.phone.trim(), role: userForm.role,
        permissions: userForm.permissions, disabled: userForm.disabled,
        expires_at: expIso,
        temp_permissions: userForm.temp_permissions,
      }
      if (user?.supervisor) base.supervisor = userForm.supervisor

      if (editingUser) {
        // Kein Passwort von hier: Das legt die Person selbst fest (Willkommens-E-Mail, Passwort-Link)
        await pb.collection('users').update(editingUser.id, base)
        if (adresse.nachgetragen) {
          // Bisher ohne E-Mail: Jetzt kommt die Willkommens-E-Mail mit dem Link zum eigenen Passwort
          const w = await willkommenSenden(editingUser.id)
          showMsg(w.ok ? `Gespeichert. ${w.text}` : `Gespeichert, aber die Willkommens-E-Mail ging nicht raus: ${w.text}`, w.ok ? 'success' : 'error')
        } else showMsg('Benutzer gespeichert')
      } else {
        // Kein Passwort vom Verwalter: Der Benutzer legt es über die Willkommens-E-Mail fest
        const unbekannt = zufallsPasswort()
        await pb.collection('users').create({
          ...base,
          password: unbekannt,
          passwordConfirm: unbekannt,
          organization_id: user!.organization_id,
          emailVisibility: true,
          // Die Rechte stehen schon fest — die Übernahme beim ersten Login (useAuth) entfällt
          permissions_migrated: true,
        })
        showMsg(isPlaceholderEmail(adresse.email)
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

  const n = anzahlRechte(userForm.permissions, rechte)
  const tempListe = Object.entries(userForm.temp_permissions)
  const rolleName = rollenBezeichnung(userForm.role, org)
  const weg = wegfallendeRollenrechte(editingUser?.role, userForm.role, userForm.permissions)
  const wegVergebbar = weg.filter(x => rechte.some(r => r.key === x))
  const tempWahl = rechte.filter(p => !userForm.permissions[p.key] && !userForm.temp_permissions[p.key])

  return (
    <Seite titel={editingUser ? (editingUser.name || 'Benutzer bearbeiten') : 'Neuer Benutzer'} unter={k.orgName} zurueck={k.schliessen}
      rechts={editingUser ? <span className="bv-ava" aria-hidden="true" style={{ background: userForm.disabled ? 'rgba(var(--lbf-grau-rgb),0.45)' : rollenFarbe(userForm.role, org) }}>{initialen(userForm.name, userForm.email)}</span> : undefined}
      leiste={<Leiste titel={rolleName} unter={anzahl(n, 'Recht', 'Rechte') + (tempListe.length ? `, ${tempListe.length} befristet` : '')}
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

      <Abschnitt titel="Rolle" />
      <Hinweis oben>{editingUser ? 'Ein Rollenwechsel setzt die Häkchen der neuen Rolle dazu. Was die Person schon hat, bleibt, bis du es unten ausschaltest.' : 'Die Rolle setzt die Rechte unten vor.'}</Hinweis>
      <RollenWahl k={k} wert={userForm.role} onWahl={rolleWaehlen} />
      {weg.length > 0 && (
        <div className="bv-notiz" role="status" style={{ marginTop: 12 }}>
          <b>Mit dem Wechsel fällt etwas weg</b>
          <p>Die bisherige Rolle gab auf dem Server auch ohne Häkchen: {aufzaehlung(weg.map(rechtName))}. Mit der neuen Rolle fehlt das, solange es unten nicht angehakt ist.</p>
          {wegVergebbar.length > 0 && (
            <button type="button" className="bv-knopf" onClick={() => setUserForm(p => ({ ...p, permissions: wegVergebbar.reduce((acc, key) => haken(acc, key, true, orgVerkn, org), p.permissions) }))}>
              Häkchen setzen
            </button>
          )}
        </div>
      )}

      <Abschnitt titel="Rechte" rechts={`${n} von ${rechte.length}`} />
      <Hinweis oben>
        {editingUser
          ? 'Was hier angehakt ist, darf die Person. Die Rolle setzt nur vor.'
          : `Vorbelegt durch die Rolle ${rolleName}. Jeder Schalter lässt sich einzeln ändern.`}
      </Hinweis>
      <RechteListe rechte={rechte} werte={userForm.permissions} v={orgVerkn} org={org}
        onChange={(key, an) => setUserForm(p => ({ ...p, permissions: haken(p.permissions, key, an, orgVerkn, org) }))} />

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
        {user?.supervisor && (
          <SchalterZeile titel="Supervisor" unter="Voller Zugriff auf alles" an={userForm.supervisor} onChange={v => setze('supervisor', v)} />
        )}
      </div>
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
