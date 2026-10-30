// Verknüpfte Rechte (lib/verknuepfung.ts) als ganze Seite: Gibt eine Rolle ein Recht,
// bringt es die verknüpften mit (lib/rollen.ts, rechteAusRollen).

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { NIE_MITGEBRACHT, STANDARD_VERKNUEPFUNGEN, gleicheVerknuepfungen, mitgebracht, verknuepfungen, type Verknuepfungen } from '../../lib/verknuepfung'
import { nachRollenAenderung } from './abgleich'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, SchalterZeile, Seite } from './bausteine'
import { aufzaehlung, orgFehler } from './logik'
import type { BvKontext } from './kontext'

export default function VerknSeite({ k, recht }: { k: BvKontext; recht?: string }) {
  const { org, orgFrisch, orgVerkn, rechte: PERM_LABELS, showMsg } = k
  const rechtName = (key: string) => PERM_LABELS.find(p => p.key === key)?.label ?? key
  // Fehlt das Feld in PocketBase, gilt die Voreinstellung und Speichern bleibt wirkungslos
  const verknFeldDa = !orgFrisch || 'verknuepfungen' in orgFrisch

  const [verknDraft, setVerknDraft] = useState<Verknuepfungen>(orgVerkn)
  const [verknRecht, setVerknRecht] = useState(() =>
    (recht && PERM_LABELS.some(p => p.key === recht) ? recht : undefined)
    ?? Object.keys(orgVerkn).find(key => PERM_LABELS.some(p => p.key === key)) ?? PERM_LABELS[0]?.key ?? 'lager')
  const [savingVerkn, setSavingVerkn] = useState(false)
  const [anwenden, setAnwenden] = useState(false)

  const geaendert = !gleicheVerknuepfungen(verknDraft, orgVerkn)
  const ziele = PERM_LABELS.filter(p => p.key !== verknRecht && !NIE_MITGEBRACHT.includes(p.key))
  const eingestellt = PERM_LABELS.map(r => ({ r, mit: mitgebracht(r.key, verknDraft, org) })).filter(x => x.mit.length)

  function toggleVerkn(von: string, ziel: string, an: boolean) {
    setVerknDraft(d => {
      const liste = (d[von] ?? []).filter(z => z !== ziel)
      const neu = { ...d, [von]: an ? [...liste, ziel] : liste }
      if (!neu[von].length) delete neu[von]
      return neu
    })
  }

  async function saveVerkn() {
    if (!k.user.organization_id) return
    setSavingVerkn(true)
    try {
      const o = await pb.collection('organizations').update(k.user.organization_id, { verknuepfungen: verknDraft })
      k.setOrgFrisch(o)
      if (!('verknuepfungen' in o)) {
        showMsg('Nicht gespeichert: Das Feld „verknuepfungen“ fehlt in PocketBase.', 'error')
        return
      }
      showMsg('Verknüpfungen gespeichert')
    } catch (e) { showMsg(orgFehler(e), 'error') }
    finally { setSavingVerkn(false) }
  }

  // Bestehende Personen nachziehen: Rechte aus ihren Rollen samt verknüpften neu rechnen (lib/rollen.ts)
  async function verknuepfungenAnwenden() {
    // Nur mit frisch geladener Organisation: ihre Verknüpfungen, Rollen und gesperrten Module
    if (!k.user.organization_id || !orgFrisch) return
    setAnwenden(true)
    try {
      const nach = await nachRollenAenderung({
        orgId: k.user.organization_id, rolleId: '', rolleName: '', rp: k.orgRolePerms, v: orgVerkn, org: orgFrisch,
        rechte: PERM_LABELS, hatRolle: () => true, selbst: k.user.id,
      })
      if (!nach.text) { showMsg('Alle haben schon die Rechte ihrer Rollen samt Verknüpfungen'); return }
      await k.loadUsers()
      showMsg(nach.text.trim(), nach.fehler ? 'error' : 'success')
    } catch (e: any) { showMsg('Fehler: ' + (e?.message || e), 'error') }
    finally { setAnwenden(false) }
  }

  const anwendenGesperrt = anwenden || geaendert || !orgFrisch
  return (
    <Seite titel="Verknüpfte Rechte" unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel="Verknüpfte Rechte" unter={geaendert ? 'Geändert, noch nicht gespeichert' : 'Gespeichert'} knopf="Speichern" icon="haken"
        onClick={saveVerkn} laeuft={savingVerkn} disabled={!geaendert} />}>
      <Hinweis oben>
        Gibt eine Rolle ein Recht, bringt es die verknüpften mit. Das gilt auch für befristete Rechte.
      </Hinweis>
      {!verknFeldDa && (
        <div className="bv-notiz" role="alert" style={{ marginBottom: 8 }}>
          <b>Das Feld „verknuepfungen“ fehlt in PocketBase</b>
          <p>Sammlung organizations, Typ JSON. Bis es angelegt ist, gilt die Voreinstellung (Lager bringt Dateien &amp; Schreibstube, MPG und Vorgänge mit), und Änderungen hier werden nicht gespeichert.</p>
        </div>
      )}

      <Feld label="Recht">
        <Auswahl value={verknRecht} onChange={setVerknRecht} label="Recht">
          {PERM_LABELS.map(p => (
            <option key={p.key} value={p.key}>{p.label}{verknDraft[p.key]?.length ? ` (bringt ${verknDraft[p.key].length} mit)` : ''}</option>
          ))}
        </Auswahl>
      </Feld>

      <Abschnitt titel={`${rechtName(verknRecht)} bringt mit`} />
      <div className="bv-flaeche">
        {ziele.map(({ key, label }) => (
          <SchalterZeile key={key} titel={label} an={!!verknDraft[verknRecht]?.includes(key)} onChange={an => toggleVerkn(verknRecht, key, an)} />
        ))}
      </div>
      <Hinweis>Die Benutzerverwaltung wird nie mitgebracht: Wer sie hat, kann jedes Recht vergeben, auch das für Patientendaten.</Hinweis>

      <Abschnitt titel="Eingestellt" />
      <div className="bv-flaeche">
        {eingestellt.length ? eingestellt.map(x => (
          <button key={x.r.key} type="button" className="bv-z" onClick={() => setVerknRecht(x.r.key)} aria-pressed={x.r.key === verknRecht}>
            <span className="bv-tx"><b>{x.r.label}</b><small>bringt {aufzaehlung(x.mit.map(rechtName))} mit</small></span>
            <Icon n="weiter" className="bv-pfeil" />
          </button>
        )) : <div className="bv-z"><span className="bv-tx"><b>Keine Verknüpfungen</b><small>Jedes Recht wird einzeln vergeben</small></span></div>}
        <button type="button" className="bv-z aktion" onClick={() => setVerknDraft(verknuepfungen({ verknuepfungen: STANDARD_VERKNUEPFUNGEN }))}>
          <span className="bv-tx">Auf Standard zurücksetzen</span>
        </button>
      </div>

      <Abschnitt titel="Bestehende Personen" />
      <Hinweis oben>
        Rechnet bei allen die Rechte aus ihren Rollen samt Verknüpfungen neu. Vorher siehst du, wer was bekommt oder verliert.
      </Hinweis>
      <div className="bv-flaeche">
        <button type="button" className="bv-z aktion" onClick={verknuepfungenAnwenden} disabled={anwendenGesperrt}>
          <span className="bv-tx">{anwenden ? 'Wird angewendet…' : 'Verknüpfungen anwenden'}</span>
        </button>
      </div>
      {!orgFrisch
        ? <Hinweis>Die Organisation konnte nicht geladen werden. Ohne Verbindung wird nichts angewendet.</Hinweis>
        : geaendert && <Hinweis>Erst speichern, dann anwenden.</Hinweis>}
    </Seite>
  )
}
