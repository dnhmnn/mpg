// Temporären Zugang erstellen: ein echtes Konto mit Ablaufdatum. Was der Zugang darf,
// kommt wie bei allen aus den gewählten Rollen.

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { rechteAusRollen, rollenNamen, rollenOrdnen } from '../../lib/rollen'
import { Abschnitt, Feld, Hinweis, Leiste, RechteAnzeige, Seite } from './bausteine'
import { RollenAuswahl } from './PersonSeite'
import { ZUSATZ_FEHLT, anlegeFehler, anzahl, anzahlRechte, genPassword } from './logik'
import type { BvKontext } from './kontext'

const DAUERN = [{ h: 1, l: '1 Std.' }, { h: 4, l: '4 Std.' }, { h: 24, l: '24 Std.' }, { h: 24 * 7, l: '7 Tage' }, { h: 24 * 30, l: '30 Tage' }]

export default function ZugangSeite({ k }: { k: BvKontext }) {
  const { user, org, orgVerkn, orgRolePerms, rechte, showMsg } = k
  const [tempForm, setTempForm] = useState(() => ({
    name: 'Temporärer Zugang',
    email: `temp-${Date.now()}@${user?.organization_id || 'org'}.local`,
    password: genPassword(),
    rollen: ['benutzer'],
    durationHours: 24, customExpiresAt: '',
  }))
  const [savingTemp, setSavingTemp] = useState(false)

  const soll = rechteAusRollen(tempForm.rollen, orgRolePerms, orgVerkn, org)

  async function saveTemp() {
    if (!tempForm.name.trim() || !tempForm.email.trim() || !tempForm.password.trim()) {
      showMsg('Name, E-Mail und Passwort sind Pflicht', 'error'); return
    }
    setSavingTemp(true)
    try {
      const expIso = tempForm.customExpiresAt
        ? new Date(tempForm.customExpiresAt).toISOString()
        : new Date(Date.now() + tempForm.durationHours * 3600 * 1000).toISOString()
      const geordnet = rollenOrdnen(tempForm.rollen)
      const neu = await pb.collection('users').create({
        name: tempForm.name.trim(), email: tempForm.email.trim(),
        password: tempForm.password, passwordConfirm: tempForm.password,
        ...geordnet, permissions: soll,
        organization_id: user!.organization_id, emailVisibility: true,
        disabled: false, expires_at: expIso, permissions_migrated: true,
      })
      k.schliessen()
      await k.loadUsers()
      if (geordnet.zusatzrollen.length && !('zusatzrollen' in neu)) showMsg('Erstellt, aber: ' + ZUSATZ_FEHLT, 'error')
      else showMsg('Temporärer Zugang erstellt')
    } catch (e) { showMsg(anlegeFehler(e, true), 'error') }
    finally { setSavingTemp(false) }
  }

  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); showMsg(`${label} kopiert`) }
    catch { showMsg('Kopieren fehlgeschlagen', 'error') }
  }

  const n = anzahlRechte(soll, rechte)
  const bis = tempForm.customExpiresAt
    ? `bis ${new Date(tempForm.customExpiresAt).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : DAUERN.find(d => d.h === tempForm.durationHours)?.l ?? `${tempForm.durationHours} Std.`

  return (
    <Seite titel="Temporärer Zugang" unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel={rollenNamen(tempForm.rollen, org)} unter={`${anzahl(n, 'Recht', 'Rechte')}, ${bis}`}
        knopf="Zugang erstellen" icon="haken" onClick={saveTemp} laeuft={savingTemp} laeuftText="Erstellt…" />}>
      <Hinweis oben>Ein echtes Konto, das nach Ablauf automatisch nicht mehr geht. Zugangsdaten gibst du selbst weiter.</Hinweis>

      <Abschnitt titel="Zugang" />
      <Feld label="Name" erst>
        <input className="bv-eingabe" value={tempForm.name} onChange={e => setTempForm(p => ({ ...p, name: e.target.value }))} placeholder="z. B. Gast Müller" autoComplete="off" />
      </Feld>
      <Feld label="E-Mail" hinweis="Automatisch erzeugt, zum Anmelden. Es geht keine E-Mail raus.">
        <input className="bv-eingabe mono" type="email" value={tempForm.email} onChange={e => setTempForm(p => ({ ...p, email: e.target.value }))} autoComplete="off" style={{ fontSize: 16 }} />
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

      <Abschnitt titel="Rollen" />
      <Hinweis oben>Was der Zugang darf, kommt aus den Rollen. Mehrere zählen zusammen.</Hinweis>
      <RollenAuswahl k={k} werte={tempForm.rollen} onChange={rollen => setTempForm(p => ({ ...p, rollen }))} />

      <Abschnitt titel="Darf" rechts={`${n} von ${rechte.length}`} />
      <RechteAnzeige rechte={rechte} werte={soll} />
    </Seite>
  )
}
