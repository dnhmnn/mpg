// Rollen als ganze Seite: eine eigene Rolle anlegen oder bearbeiten, und die
// Rechte einer vorgegebenen Rolle für diese Organisation anpassen.
//
// Was jemand darf, kommt aus seinen Rollen. Gespeichert wird eine Rolle in der
// Organisation: eigene_rollen (Name, Beschreibung, Farbe) und role_permissions[id]
// (Rechte), beides in einem einzigen Update. Danach bekommen alle mit dieser Rolle
// die neuen Rechte (nach Rückfrage, abgleich.ts).

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { EMPTY_PERMS, FESTE_ROLLEN, getRoleTemplate } from '../../lib/apps'
import {
  MAX_HINWEIS, ROLLEN_FARBEN, eigeneRollen, freieFarbe, hatRolle, pruefeRollenName, rolleAendern, rolleAnlegen, rolleEntfernen, rolleInfo,
  rollenFuer, vorlageBereinigen, type RollenFarbe,
} from '../../lib/rollen'
import { haken } from '../../lib/verknuepfung'
import { nachRollenAenderung } from './abgleich'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, RechteAnzeige, RechteListe, Seite } from './bausteine'
import { anzahl, anzahlRechte, orgFehler, personen as personenText } from './logik'
import type { BvKontext } from './kontext'

type Vorlagen = Record<string, Record<string, boolean>>

export const FELD_FEHLT = 'Nicht gespeichert: Das Feld „eigene_rollen“ fehlt in PocketBase (Sammlung organizations, Typ JSON).'

/** Ist das Feld eigene_rollen in PocketBase angelegt? Nur an der frisch geladenen Organisation erkennbar. */
export function eigeneFeldDa(orgFrisch: Record<string, unknown> | null): boolean {
  return !!orgFrisch && 'eigene_rollen' in orgFrisch
}

/** Die Organisation frisch lesen — vor jedem Schreiben, damit nichts von nebenan verloren geht */
export async function orgLesen(orgId: string): Promise<Record<string, unknown>> {
  return pb.collection('organizations').getOne(orgId, { requestKey: null })
}

export function FeldFehltHinweis() {
  return (
    <div className="bv-notiz">
      <b>Eigene Rollen sind noch nicht eingerichtet</b>
      <p>In PocketBase fehlt bei der Sammlung <code>organizations</code> das Feld <code>eigene_rollen</code> (Typ JSON, nicht Pflicht). Ist es angelegt, lassen sich hier eigene Rollen anlegen.</p>
      <p>Außerdem muss das Feld <code>role</code> bei <code>users</code> vom Typ Text („Plain text“) sein, nicht eine Auswahlliste.</p>
    </div>
  )
}

export function EigeneRolleSeite({ k, rolleId }: { k: BvKontext; rolleId?: string }) {
  const { org, orgRolePerms, orgVerkn, rechte, showMsg } = k
  const orgId = k.user.organization_id || ''
  const eigene = eigeneRollen(k.orgFrisch ?? org)
  const vorhanden = rolleId ? eigene.find(r => r.id === rolleId) : undefined
  const feldDa = eigeneFeldDa(k.orgFrisch)

  const [name, setName] = useState(vorhanden?.name ?? '')
  const [hinweis, setHinweis] = useState(vorhanden?.hinweis ?? '')
  const [farbe, setFarbe] = useState<RollenFarbe>(vorhanden?.farbe ?? (rolleId ? 'senape' : freieFarbe(eigene)))
  const [von, setVon] = useState('benutzer')
  const [draft, setDraft] = useState<Record<string, boolean>>(() =>
    ({ ...EMPTY_PERMS, ...getRoleTemplate(rolleId ?? 'benutzer', { role_permissions: orgRolePerms }) }))
  const [beruehrt, setBeruehrt] = useState(false)
  const [versucht, setVersucht] = useState(false)
  const [nameFehlerServer, setNameFehlerServer] = useState('')
  const [saving, setSaving] = useState(false)
  const [entfernt, setEntfernt] = useState(false)
  // Beim Öffnen festhalten: Nach dem Löschen soll bis zum Schließen nicht „gibt es nicht mehr“ aufblitzen
  const [vorhandenStart] = useState(vorhanden)
  const [eigeneStart] = useState(eigene)

  if (rolleId && !vorhandenStart) {
    return (
      <Seite titel="Rolle" unter={k.orgName} zurueck={k.schliessen}>
        <div className="bv-notiz"><b>Diese Rolle gibt es nicht mehr</b><p>Sie wurde gelöscht oder die Organisation ist nicht geladen.</p></div>
      </Seite>
    )
  }

  // Gegen den Stand beim Öffnen; beim Speichern prüft rolleAnlegen/rolleAendern frisch
  const pruef = pruefeRollenName(name, eigeneStart, rolleId)
  // tsconfig ohne strict: Nur der in-Operator grenzt die Prüfung sicher ein
  const pruefFehler = 'grund' in pruef ? pruef : null
  const sauberName = 'name' in pruef ? pruef.name : ''
  const nameFehler = nameFehlerServer || (pruefFehler && (versucht || (beruehrt && pruefFehler.grund !== 'leer')) ? pruefFehler.text : '')
  const n = anzahlRechte(draft, rechte)
  const personen = rolleId ? k.users.filter(u => hatRolle(u, rolleId)).length : 0
  const farbName = ROLLEN_FARBEN.find(f => f.id === farbe)?.name ?? ''

  function uebernehmen(id: string) {
    setVon(id)
    // Nur Rechte, die hier als Schalter zu sehen sind — nichts Unsichtbares in die neue Vorlage
    const sichtbar = new Set(rechte.map(r => r.key))
    const v = vorlageBereinigen(getRoleTemplate(id, { role_permissions: orgRolePerms }))
    setDraft({ ...EMPTY_PERMS, ...(id === '' ? {} : Object.fromEntries(Object.entries(v).filter(([key]) => sichtbar.has(key)))) })
  }

  async function speichern() {
    setVersucht(true)
    if (pruefFehler || !orgId) return
    setSaving(true)
    try {
      // 1. Frisch lesen
      const frisch = await orgLesen(orgId)
      if (!('eigene_rollen' in frisch)) { k.setOrgFrisch(frisch); showMsg(FELD_FEHLT, 'error'); return }
      const liste = eigeneRollen(frisch)
      // 2. Anlegen oder ändern — auf dem frischen Stand
      const erg = rolleId
        ? rolleAendern(liste, rolleId, { name, hinweis, farbe })
        : rolleAnlegen(liste, { name, hinweis, farbe })
      if ('fehler' in erg) {
        const p = pruefeRollenName(name, liste, rolleId)
        if ('text' in p) setNameFehlerServer(p.text)
        else showMsg('Nicht gespeichert: ' + erg.fehler, 'error')
        return
      }
      const id: string = rolleId ?? ('id' in erg ? String(erg.id) : '')
      if (!id) return
      // 3. Die Häkchen der Rolle neben die der anderen Rollen
      const rp: Vorlagen = { ...((frisch.role_permissions as Vorlagen | undefined) ?? {}), [id]: vorlageBereinigen(draft) }
      // 4. Ein einziges Update mit beiden Feldern
      const o = await pb.collection('organizations').update(orgId, { eigene_rollen: erg.rollen, role_permissions: rp }, { requestKey: null })
      // 5. PocketBase verwirft unbekannte Felder stillschweigend — nachsehen
      k.setOrgFrisch(o)
      if (!('eigene_rollen' in o)) { showMsg(FELD_FEHLT, 'error'); return }
      const rpNeu = (o.role_permissions as Vorlagen | undefined) ?? {}
      k.setOrgRolePerms(rpNeu)
      // Wer die Rolle hat, bekommt die neuen Rechte (nach Rückfrage)
      const nach = rolleId
        ? await nachRollenAenderung({ orgId, rolleId: id, rolleName: sauberName, rp: rpNeu, v: orgVerkn, org: o, rechte, hatRolle: u => hatRolle(u, id), selbst: k.user.id })
        : { text: '', fehler: false }
      if (nach.text) await k.loadUsers()
      showMsg((rolleId ? 'Rolle gespeichert.' : `Rolle „${sauberName}“ angelegt.`) + nach.text, nach.fehler ? 'error' : 'success')
      k.schliessen()
    } catch (e) { showMsg(orgFehler(e), 'error') }
    finally { setSaving(false) }
  }

  async function entfernen() {
    const rolle = vorhanden ?? vorhandenStart
    if (!rolleId || !rolle || !orgId) return
    setEntfernt(true)
    try {
      // Frisch zählen, als erste oder weitere Rolle: Wer sie noch hat, behält sie — dann nur archivieren.
      // Die Anführungszeichen grenzen die ID im JSON ab (sonst zählte eigen_x auch eigen_xy).
      const zaehlen = (filter: string) => pb.collection('users').getList(1, 1, { filter, fields: 'id', requestKey: null }).then(r => r.totalItems)
      const belegt = await zaehlen(pb.filter('organization_id = {:o} && (role = {:r} || zusatzrollen ~ {:q})', { o: orgId, r: rolleId, q: `"${rolleId}"` }))
        // Ohne Feld zusatzrollen lehnt PocketBase den Filter ab: dann gibt es nur erste Rollen
        .catch(() => zaehlen(pb.filter('organization_id = {:o} && role = {:r}', { o: orgId, r: rolleId })))
      const frage = belegt > 0
        ? `Noch ${belegt === 1 ? '1 Person hat' : `${belegt} Personen haben`} die Rolle „${rolle.name}“. Sie wird deshalb nur archiviert: Sie ist nicht mehr wählbar, wer sie hat, behält sie samt Rechten. Archivieren?`
        : `Rolle „${rolle.name}“ löschen? Niemand hat sie.`
      if (!confirm(frage)) return
      const frisch = await orgLesen(orgId)
      if (!('eigene_rollen' in frisch)) { k.setOrgFrisch(frisch); showMsg(FELD_FEHLT, 'error'); return }
      const erg = rolleEntfernen(eigeneRollen(frisch), (frisch.role_permissions as Vorlagen | undefined) ?? {}, rolleId, belegt)
      if (erg.art === 'nichts') { k.setOrgFrisch(frisch); showMsg('Diese Rolle gibt es nicht mehr.', 'error'); return }
      const o = await pb.collection('organizations').update(orgId, { eigene_rollen: erg.rollen, role_permissions: erg.rolePermissions }, { requestKey: null })
      k.setOrgFrisch(o)
      if (!('eigene_rollen' in o)) { showMsg(FELD_FEHLT, 'error'); return }
      k.setOrgRolePerms((o.role_permissions as Vorlagen | undefined) ?? {})
      showMsg(erg.art === 'geloescht'
        ? `Rolle „${rolle.name}“ gelöscht`
        : `Rolle „${rolle.name}“ archiviert. ${anzahl(belegt, 'Person behält', 'Personen behalten')} sie.`)
      k.schliessen()
    } catch (e) { showMsg(orgFehler(e), 'error') }
    finally { setEntfernt(false) }
  }

  const titel = rolleId ? (vorhandenStart?.name ?? 'Rolle') : 'Neue Rolle'
  return (
    <Seite titel={titel} unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel={anzahl(n, 'Recht', 'Rechte')} unter={sauberName || name.trim() || titel} knopf="Rolle speichern" icon="haken"
        onClick={speichern} laeuft={saving} disabled={!feldDa} />}>
      {!feldDa && <div style={{ marginBottom: 20 }}><FeldFehltHinweis /></div>}

      <Abschnitt titel="Rolle" erst />
      <Feld label="Name" erst fehler={nameFehler || undefined}>
        <input className={`bv-eingabe${nameFehler ? ' fehler' : ''}`} value={name} maxLength={60} autoComplete="off" placeholder="z. B. Gruppenführerin"
          aria-invalid={!!nameFehler}
          onChange={e => { setName(e.target.value); setBeruehrt(true); setNameFehlerServer('') }} />
      </Feld>
      <Feld label="Beschreibung" zusatz="optional" hinweis="Steht bei der Auswahl unter dem Namen.">
        <textarea className="bv-eingabe" value={hinweis} maxLength={MAX_HINWEIS} rows={2} placeholder="Wofür die Rolle gedacht ist" onChange={e => setHinweis(e.target.value)} />
      </Feld>
      <Feld label="Farbe" zusatz={farbName} gruppe hinweis="Erkennungsfarbe in der Liste und bei der Auswahl.">
        <div className="bv-farben" role="radiogroup" aria-label="Farbe">
          {ROLLEN_FARBEN.map(f => (
            <button key={f.id} type="button" className="bv-farbe" role="radio" aria-checked={f.id === farbe} aria-label={f.name} onClick={() => setFarbe(f.id)}>
              <i style={{ background: `var(--rolle-${f.id})` }} />
            </button>
          ))}
        </div>
      </Feld>
      {!rolleId && (
        <Feld label="Rechte übernehmen von" hinweis="Setzt die Schalter unten wie bei dieser Rolle. Danach lässt sich jeder einzeln ändern.">
          <Auswahl value={von} onChange={uebernehmen} label="Rechte übernehmen von">
            <option value="">Keiner Rolle, alles aus</option>
            {rollenFuer(org).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Auswahl>
        </Feld>
      )}

      <Abschnitt titel="Rechte" rechts={`${n} von ${rechte.length}`} />
      <Hinweis oben>Was jede Person mit dieser Rolle darf. Ändern gilt für alle, die sie haben; vorher fragt die App nach.</Hinweis>
      <RechteListe rechte={rechte} werte={draft} v={orgVerkn} org={org} onChange={(key, an) => setDraft(p => haken(p, key, an, orgVerkn, org))} />

      {rolleId && (
        <>
          <Abschnitt titel="Personen" rechts={personenText(personen)} />
          <Hinweis oben>
            {personen > 0
              ? 'Wer die Rolle hat, behält sie beim Archivieren samt Rechten. Sie ist danach nur nicht mehr wählbar.'
              : 'Niemand hat diese Rolle. Löschen entfernt sie samt Vorlage.'}
          </Hinweis>
          {vorhanden?.archiviert ? (
            <div className="bv-notiz" role="status"><b>Diese Rolle ist archiviert</b><p>Sie ist nicht wählbar. Wiederherstellen geht im Reiter Rollen unter „Archiviert“.</p></div>
          ) : (
            <div className="bv-flaeche">
              {/* Archivieren lässt sich rückgängig machen: Akzent statt Rot. Löschen ist endgültig. */}
              <button type="button" className={`bv-z${personen > 0 ? ' akzent' : ' gefahr'}`} onClick={entfernen} disabled={entfernt || !feldDa}>
                <span className="bv-tx">{entfernt ? 'Wird geprüft…' : personen > 0 ? 'Rolle archivieren' : 'Rolle löschen'}</span>
                <Icon n="kreuz" className="bv-klein" />
              </button>
            </div>
          )}
        </>
      )}
    </Seite>
  )
}

/** Eine vorgegebene Rolle (Einsatzkraft, Führung, …): ihre Rechte für diese Organisation */
export function VorlageSeite({ k, rolle }: { k: BvKontext; rolle: string }) {
  const { org, orgRolePerms, orgVerkn, rechte, showMsg } = k
  const info = rolleInfo(rolle, org)
  const fest = FESTE_ROLLEN.includes(rolle)
  const [templateDraft, setTemplateDraft] = useState<Record<string, boolean>>(() =>
    ({ ...EMPTY_PERMS, ...getRoleTemplate(rolle, { role_permissions: orgRolePerms }) }))
  const [savingTemplate, setSavingTemplate] = useState(false)
  const n = anzahlRechte(templateDraft, rechte)
  const personen = k.users.filter(u => hatRolle(u, rolle)).length

  function resetTemplateDraft() {
    setTemplateDraft({ ...EMPTY_PERMS, ...getRoleTemplate(rolle, null) })
  }

  async function saveRoleTemplate() {
    const orgId = k.user.organization_id
    if (!orgId || fest) return
    setSavingTemplate(true)
    try {
      // Frisch lesen: role_permissions trägt auch die Rechte der eigenen Rollen
      const frisch = await orgLesen(orgId)
      const updated: Vorlagen = { ...((frisch.role_permissions as Vorlagen | undefined) ?? {}), [rolle]: vorlageBereinigen(templateDraft) }
      const o = await pb.collection('organizations').update(orgId, { role_permissions: updated }, { requestKey: null })
      k.setOrgFrisch(o)
      const rpNeu = (o.role_permissions as Vorlagen | undefined) ?? updated
      k.setOrgRolePerms(rpNeu)
      // Wer die Rolle hat, bekommt die neuen Rechte (nach Rückfrage)
      const nach = await nachRollenAenderung({ orgId, rolleId: rolle, rolleName: info?.name ?? rolle, rp: rpNeu, v: orgVerkn, org: o, rechte, hatRolle: u => hatRolle(u, rolle), selbst: k.user.id })
      if (nach.text) await k.loadUsers()
      showMsg('Rolle gespeichert.' + nach.text, nach.fehler ? 'error' : 'success')
      k.schliessen()
    } catch (e) { showMsg(orgFehler(e), 'error') }
    finally { setSavingTemplate(false) }
  }

  if (fest) {
    return (
      <Seite titel={info?.name ?? rolle} unter={k.orgName} zurueck={k.schliessen}>
        <Abschnitt titel="Rolle" erst rechts={personenText(personen)} />
        <Hinweis oben>{info?.hinweis} Diese Rolle ist fest und lässt sich nicht anpassen.</Hinweis>
        <Abschnitt titel="Darf" rechts={rolle === 'admin' ? `${n} von ${rechte.length}` : undefined} />
        {rolle === 'admin'
          ? <RechteAnzeige rechte={rechte} werte={templateDraft} />
          : <Hinweis oben>Teilnehmende bekommen Unitas über die Ausbildungen. Weitere Rechte gibt es nur befristet.</Hinweis>}
      </Seite>
    )
  }

  return (
    <Seite titel={info?.name ?? rolle} unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel={anzahl(n, 'Recht', 'Rechte')} unter={info?.name ?? rolle} knopf="Rolle speichern" icon="haken" onClick={saveRoleTemplate} laeuft={savingTemplate} />}>
      <Abschnitt titel="Rolle" erst rechts={personenText(personen)} />
      <Hinweis oben>{info?.hinweis} Kommt mit Responda. Änderungen gelten nur für die {k.orgName}.</Hinweis>

      <Abschnitt titel="Rechte" rechts={`${n} von ${rechte.length}`} />
      <Hinweis oben>Was jede Person mit dieser Rolle darf. Ändern gilt für alle, die sie haben; vorher fragt die App nach.</Hinweis>
      <RechteListe rechte={rechte} werte={templateDraft} v={orgVerkn} org={org} onChange={(key, an) => setTemplateDraft(p => haken(p, key, an, orgVerkn, org))} />

      <Abschnitt titel="Standard" />
      <div className="bv-flaeche">
        <button type="button" className="bv-z aktion" onClick={resetTemplateDraft}><span className="bv-tx">Auf Standard zurücksetzen</span></button>
      </div>
      <Hinweis>Setzt die Schalter auf die Voreinstellung von Responda. Gespeichert wird erst mit „Rolle speichern“.</Hinweis>
    </Seite>
  )
}
