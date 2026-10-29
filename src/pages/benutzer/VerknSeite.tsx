// Verknüpfte Rechte (lib/verknuepfung.ts) als ganze Seite. Die Logik ist die
// bisherige aus dem Blatt „Verknüpfte Rechte“ in Unitarii.tsx.

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { NIE_MITGEBRACHT, STANDARD_VERKNUEPFUNGEN, ergaenzen, gleicheVerknuepfungen, mitgebracht, verknuepfungen, type Verknuepfungen } from '../../lib/verknuepfung'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, SchalterZeile, Seite } from './bausteine'
import { aufzaehlung, orgFehler, type UUser } from './logik'
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

  // Bestehende Benutzer nachziehen: fehlende verknüpfte Rechte ergänzen, nichts wegnehmen
  async function verknuepfungenAnwenden() {
    // Nur mit frisch geladener Organisation: ihre Verknüpfungen und gesperrten Module
    if (!k.user.organization_id || !orgFrisch) return
    setAnwenden(true)
    try {
      const liste = await pb.collection('users').getFullList<UUser>({
        filter: pb.filter('organization_id = {:o}', { o: k.user.organization_id }),
        fields: 'id,name,email,permissions,supervisor', requestKey: null,
      })
      // Supervisor dürfen ohnehin alles
      const plan = liste.filter(u => !u.supervisor)
        .map(u => ({ u, dazu: ergaenzen(u.permissions, orgVerkn, org).dazu }))
        .filter(x => x.dazu.length)
      if (!plan.length) { showMsg('Alle Benutzer haben die verknüpften Rechte schon'); return }
      const zeilen = plan.slice(0, 12).map(x => `• ${x.u.name || x.u.email}: ${x.dazu.map(rechtName).join(', ')}`)
      if (plan.length > 12) zeilen.push(`… und ${plan.length - 12} weitere`)
      if (!confirm(`Bei ${plan.length} ${plan.length === 1 ? 'Benutzer' : 'Benutzern'} werden Rechte ergänzt:\n\n${zeilen.join('\n')}\n\nWeggenommen wird nichts.`)) return
      let ok = 0
      let fehler = 0
      for (const x of plan) {
        try {
          // Frisch lesen, damit eine Änderung von nebenan nicht verloren geht
          const frisch = await pb.collection('users').getOne<UUser>(x.u.id, { fields: 'id,permissions', requestKey: null })
          const { rechte, dazu } = ergaenzen(frisch.permissions, orgVerkn, org)
          if (dazu.length) await pb.collection('users').update(x.u.id, { permissions: rechte }, { requestKey: null })
          ok++
        } catch { fehler++ }
      }
      await k.loadUsers()
      showMsg(fehler
        ? `${ok} ergänzt, ${fehler} nicht gespeichert`
        : `Bei ${ok} ${ok === 1 ? 'Benutzer' : 'Benutzern'} ergänzt`, fehler ? 'error' : 'success')
    } catch (e: any) { showMsg('Fehler: ' + (e?.message || e), 'error') }
    finally { setAnwenden(false) }
  }

  const anwendenGesperrt = anwenden || geaendert || !orgFrisch
  return (
    <Seite titel="Verknüpfte Rechte" unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel="Verknüpfte Rechte" unter={geaendert ? 'Geändert, noch nicht gespeichert' : 'Gespeichert'} knopf="Speichern" icon="haken"
        onClick={saveVerkn} laeuft={savingVerkn} disabled={!geaendert} />}>
      <Hinweis oben>
        Wer ein Recht bekommt, bekommt die verknüpften gleich mit angehakt: beim Anlegen, beim Bearbeiten, über die Rolle und bei befristeten Rechten. Danach lässt sich jedes einzeln wieder abwählen.
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
      <Hinweis>Die Benutzerverwaltung wird nie mitgebracht: Wer sie hat, kann jedes Recht vergeben, auch das für Patientendaten. Sie wird immer einzeln vergeben.</Hinweis>

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

      <Abschnitt titel="Bestehende Benutzer" />
      <Hinweis oben>
        Ergänzt bei allen Benutzern die verknüpften Rechte, die ihnen noch fehlen, etwa bei allen mit Lager. Es zählen die dauerhaften Rechte; weggenommen wird nichts. Vorher siehst du, wer was bekommt.
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
