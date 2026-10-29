// Temporären Zugang erstellen: ein echtes Konto mit Ablaufdatum. Logik wie bisher
// (saveTemp); neu ist nur, dass die gewählte Rolle ihre Häkchen vorsetzt.

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { EMPTY_PERMS, getRoleTemplate } from '../../lib/apps'
import { rollenBezeichnung, vorlageBereinigen } from '../../lib/rollen'
import { haken, vorlageMitVerknuepfungen } from '../../lib/verknuepfung'
import { Abschnitt, Feld, Hinweis, Leiste, RechteListe, Seite } from './bausteine'
import { RollenWahl } from './PersonSeite'
import { anlegeFehler, anzahl, anzahlRechte, genPassword } from './logik'
import type { BvKontext } from './kontext'

const DAUERN = [{ h: 1, l: '1 Std.' }, { h: 4, l: '4 Std.' }, { h: 24, l: '24 Std.' }, { h: 24 * 7, l: '7 Tage' }, { h: 24 * 30, l: '30 Tage' }]

export default function ZugangSeite({ k }: { k: BvKontext }) {
  const { user, org, orgVerkn, orgRolePerms, rechte, showMsg } = k
  const [tempForm, setTempForm] = useState(() => ({
    name: 'Temporärer Zugang',
    email: `temp-${Date.now()}@${user?.organization_id || 'org'}.local`,
    password: genPassword(),
    role: 'benutzer',
    permissions: { ...EMPTY_PERMS, lernbar: true } as Record<string, boolean>,
    durationHours: 24, customExpiresAt: '',
  }))
  const [savingTemp, setSavingTemp] = useState(false)

  function rolleWaehlen(role: string) {
    if (role === tempForm.role) return
    // Ein neuer Zugang: Die Rolle bestimmt die Häkchen ganz
    const vorlage = vorlageMitVerknuepfungen(vorlageBereinigen(getRoleTemplate(role, { role_permissions: orgRolePerms })), orgVerkn, org)
    setTempForm(p => ({ ...p, role, permissions: { ...EMPTY_PERMS, ...vorlage } }))
  }

  async function saveTemp() {
    if (!tempForm.name.trim() || !tempForm.email.trim() || !tempForm.password.trim()) {
      showMsg('Name, E-Mail und Passwort sind Pflicht', 'error'); return
    }
    setSavingTemp(true)
    try {
      const expIso = tempForm.customExpiresAt
        ? new Date(tempForm.customExpiresAt).toISOString()
        : new Date(Date.now() + tempForm.durationHours * 3600 * 1000).toISOString()
      await pb.collection('users').create({
        name: tempForm.name.trim(), email: tempForm.email.trim(),
        password: tempForm.password, passwordConfirm: tempForm.password,
        role: tempForm.role, permissions: tempForm.permissions,
        organization_id: user!.organization_id, emailVisibility: true,
        disabled: false, expires_at: expIso, permissions_migrated: true,
      })
      k.schliessen()
      await k.loadUsers()
      showMsg('Temporärer Zugang erstellt')
    } catch (e) { showMsg(anlegeFehler(e, true), 'error') }
    finally { setSavingTemp(false) }
  }

  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); showMsg(`${label} kopiert`) }
    catch { showMsg('Kopieren fehlgeschlagen', 'error') }
  }

  const n = anzahlRechte(tempForm.permissions, rechte)
  const bis = tempForm.customExpiresAt
    ? `bis ${new Date(tempForm.customExpiresAt).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : DAUERN.find(d => d.h === tempForm.durationHours)?.l ?? `${tempForm.durationHours} Std.`

  return (
    <Seite titel="Temporärer Zugang" unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel={rollenBezeichnung(tempForm.role, org)} unter={`${anzahl(n, 'Recht', 'Rechte')}, ${bis}`}
        knopf="Zugang erstellen" icon="haken" onClick={saveTemp} laeuft={savingTemp} laeuftText="Erstellt…" />}>
      <Hinweis oben>Ein echtes Konto, das nach Ablauf automatisch nicht mehr geht. Zugangsdaten gibst du selbst weiter.</Hinweis>

      <Abschnitt titel="Zugang" />
      <Feld label="Name" erst>
        <input className="bv-eingabe" value={tempForm.name} onChange={e => setTempForm(p => ({ ...p, name: e.target.value }))} placeholder="z. B. Gast Müller" autoComplete="off" />
      </Feld>
      <Feld label="E-Mail" hinweis="Automatisch erzeugt, zum Anmelden. Es geht keine E-Mail raus.">
        <input className="bv-eingabe mono" type="email" value={tempForm.email} onChange={e => setTempForm(p => ({ ...p, email: e.target.value }))} autoComplete="off" style={{ fontSize: 15 }} />
      </Feld>
      <Feld label="Passwort">
        <span className="bv-reihe">
          <input className="bv-eingabe mono" type="text" value={tempForm.password} onChange={e => setTempForm(p => ({ ...p, password: e.target.value }))} autoComplete="off" />
          <button type="button" className="bv-knopf gross" onClick={() => setTempForm(p => ({ ...p, password: genPassword() }))}>Neu</button>
          <button type="button" className="bv-knopf gross" onClick={() => copyText(tempForm.password, 'Passwort')}>Kopieren</button>
        </span>
      </Feld>

      <Abschnitt titel="Dauer" />
      <div className="bv-segmente" role="group" aria-label="Dauer">
        {DAUERN.map(opt => (
          <button key={opt.h} type="button" className="bv-seg" aria-pressed={!tempForm.customExpiresAt && tempForm.durationHours === opt.h}
            onClick={() => setTempForm(p => ({ ...p, durationHours: opt.h, customExpiresAt: '' }))}>{opt.l}</button>
        ))}
      </div>
      <Feld label="Oder bis" zusatz="genaues Ende">
        <input className="bv-eingabe" type="datetime-local" value={tempForm.customExpiresAt} onChange={e => setTempForm(p => ({ ...p, customExpiresAt: e.target.value }))} />
      </Feld>

      <Abschnitt titel="Rolle" />
      <Hinweis oben>Die Rolle setzt die Rechte unten vor.</Hinweis>
      <RollenWahl k={k} wert={tempForm.role} onWahl={rolleWaehlen} />

      <Abschnitt titel="Rechte" rechts={`${n} von ${rechte.length}`} />
      <RechteListe rechte={rechte} werte={tempForm.permissions} v={orgVerkn} org={org}
        onChange={(key, an) => setTempForm(p => ({ ...p, permissions: haken(p.permissions, key, an, orgVerkn, org) }))} />
    </Seite>
  )
}
