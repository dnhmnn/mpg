// Die vier Reiter der Benutzerverwaltung: Benutzer, Rollen, Neuigkeiten, Temporär.

import { getRoleTemplate } from '../../lib/apps'
import { MAX_EIGENE_ROLLEN, eigeneRollen, rollenBezeichnung, rollenFarbe, rollenFuer, rollenKuerzel } from '../../lib/rollen'
import { mitgebracht } from '../../lib/verknuepfung'
import { Abschnitt, Hinweis, Icon } from './bausteine'
import { FeldFehltHinweis, eigeneFeldDa } from './RolleSeite'
import { anzahl, anzahlRechte, anzeigeEmail, aufzaehlung, benutzerStatus, initialen, personen, suchen, type Neuigkeit, type UUser } from './logik'
import type { BvKontext } from './kontext'

export type Unterseite = 'person' | 'rolle' | 'vorlage' | 'verkn' | 'neuigkeit' | 'zugang'
type Oeffne = (seite: Unterseite, id?: string) => void

const AUS_GRUND = 'rgba(var(--lbf-grau-rgb),0.22)'
const AUS_TEXT = 'var(--lbf-text)'

export function BenutzerZeile({ u, k, onClick }: { u: UUser; k: BvKontext; onClick: () => void }) {
  const st = benutzerStatus(u)
  const aus = st?.art === 'gesperrt' || st?.art === 'abgelaufen'
  const mail = anzeigeEmail(u)
  const rolle = rollenBezeichnung(u.role, k.org) + (u.supervisor ? ', Supervisor' : '')
  return (
    <button type="button" className={`bv-z bv-nutzer${aus ? ' aus' : ''}`} onClick={onClick}>
      <span className="bv-ava" aria-hidden="true"
        style={aus ? { background: AUS_GRUND, color: AUS_TEXT } : { background: rollenFarbe(u.role, k.org) }}>
        {initialen(u.name, mail || u.email)}
      </span>
      <span className="bv-tx">
        <b>{u.name || mail || 'Ohne Namen'}{u.id === k.user.id && <span className="bv-du">du</span>}</b>
        {mail && <span className="bv-mail">{mail}</span>}
        <span className="bv-rolle"><span>{rolle}</span>{st && <span className={`bv-st ${st.art}`}>{st.text}</span>}</span>
      </span>
      <Icon n="weiter" className="bv-pfeil" />
    </button>
  )
}

export function BenutzerReiter({ k, q, setQ, oeffne }: { k: BvKontext; q: string; setQ: (q: string) => void; oeffne: Oeffne }) {
  const liste = suchen(k.users, q)
  return (
    <>
      <div className="bv-suche">
        <Icon n="suche" className="bv-klein" />
        <input type="text" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name oder E-Mail suchen" aria-label="Name oder E-Mail suchen" autoComplete="off" />
        {q && <button type="button" aria-label="Suche leeren" onClick={() => setQ('')}><Icon n="kreuz" className="bv-klein" /></button>}
      </div>
      {k.users.length === 0 ? (
        <div className="bv-flaeche" style={{ marginTop: 14 }}>
          <div className="bv-leer">Noch keine Benutzer</div>
          <button type="button" className="bv-z neu" onClick={() => oeffne('person')}><Icon n="plus" />Neuer Benutzer</button>
        </div>
      ) : liste.length === 0 ? (
        <div className="bv-leer">Niemand passt zu „{q.trim()}“</div>
      ) : (
        <div className="bv-flaeche" style={{ marginTop: 14 }}>
          {liste.map(u => <BenutzerZeile key={u.id} u={u} k={k} onClick={() => oeffne('person', u.id)} />)}
        </div>
      )}
      {q && liste.length > 0 && <Hinweis>{anzahl(liste.length, 'Treffer', 'Treffer')} von {k.users.length}</Hinweis>}
    </>
  )
}

export function RollenReiter({ k, oeffne, archivOffen, setArchivOffen, wiederherstellen, laeuft }: {
  k: BvKontext; oeffne: Oeffne; archivOffen: boolean; setArchivOffen: (v: boolean) => void
  wiederherstellen: (id: string) => void; laeuft: string
}) {
  const { org, orgRolePerms, rechte, users } = k
  const feldDa = eigeneFeldDa(k.orgFrisch)
  const eigene = eigeneRollen(k.orgFrisch ?? org)
  const aktive = rollenFuer(org).filter(r => r.eigen)
  const archivierte = eigene.filter(r => r.archiviert).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const vorgegeben = rollenFuer(org).filter(r => !r.eigen)
  const rechteVon = (id: string) => anzahlRechte(getRoleTemplate(id, { role_permissions: orgRolePerms }), rechte)
  const anzahlPersonen = (id: string) => users.filter(u => u.role === id).length
  const voll = aktive.length >= MAX_EIGENE_ROLLEN
  const name = (key: string) => rechte.find(r => r.key === key)?.label ?? key
  const verkn = org ? rechte.map(r => ({ r, mit: mitgebracht(r.key, k.orgVerkn, org) })).filter(x => x.mit.length) : []

  return (
    <>
      <p className="bv-hinweis" style={{ margin: '2px 2px 0' }}>Eine Rolle setzt nur Häkchen vor. Was zählt, sind die Häkchen bei jeder Person.</p>

      <Abschnitt titel="Eigene Rollen" rechts={feldDa ? anzahl(aktive.length, 'Rolle', 'Rollen') : undefined} />
      {!feldDa && (
        <div style={{ marginBottom: 12 }}>
          {k.orgFrisch
            ? <FeldFehltHinweis />
            : <div className="bv-notiz"><b>Organisation nicht geladen</b><p>Ohne Verbindung lassen sich keine Rollen anlegen. Bitte später erneut öffnen.</p></div>}
        </div>
      )}
      <div className="bv-flaeche">
        {aktive.map(r => (
          <button key={r.id} type="button" className="bv-z" onClick={() => oeffne('rolle', r.id)}>
            <span className="bv-feldr" aria-hidden="true" style={{ background: `var(--rolle-${r.farbe})` }}>{rollenKuerzel(r.id, org)}</span>
            <span className="bv-tx"><b>{r.name}</b><small>{anzahl(rechteVon(r.id), 'Recht', 'Rechte')}, {personen(anzahlPersonen(r.id))}</small></span>
            <Icon n="weiter" className="bv-pfeil" />
          </button>
        ))}
        <button type="button" className="bv-z neu" onClick={() => oeffne('rolle')} disabled={!feldDa || voll}><Icon n="plus" />Neue Rolle</button>
      </div>
      {voll && <Hinweis>Höchstens {MAX_EIGENE_ROLLEN} eigene Rollen. Archiviere eine, um Platz zu schaffen.</Hinweis>}

      {archivierte.length > 0 && (
        <>
          <button type="button" className="bv-aufklapp" aria-expanded={archivOffen} onClick={() => setArchivOffen(!archivOffen)}>
            <Icon n={archivOffen ? 'runter' : 'weiter'} className="bv-klein" />Archiviert ({archivierte.length})
          </button>
          {archivOffen && (
            <>
              <div className="bv-flaeche">
                {archivierte.map(r => (
                  <div key={r.id} className="bv-z">
                    <span className="bv-feldr" aria-hidden="true" style={{ background: AUS_GRUND, color: AUS_TEXT }}>{rollenKuerzel(r.id, org)}</span>
                    <span className="bv-tx"><b>{r.name}</b><small>{personen(anzahlPersonen(r.id))}</small></span>
                    <button type="button" className="bv-knopf" disabled={!!laeuft || !feldDa} onClick={() => wiederherstellen(r.id)}>
                      {laeuft === r.id ? 'Läuft…' : 'Wiederherstellen'}
                    </button>
                  </div>
                ))}
              </div>
              <Hinweis>Archivierte Rollen sind nicht mehr wählbar. Wer sie hat, behält sie samt Häkchen.</Hinweis>
            </>
          )}
        </>
      )}

      <Abschnitt titel="Vorlagen" />
      <Hinweis oben>Kommen mit Responda. Änderungen gelten nur für die {k.orgName}.</Hinweis>
      <div className="bv-flaeche">
        {vorgegeben.map(r => {
          const n = rechteVon(r.id)
          return (
            <button key={r.id} type="button" className="bv-z" onClick={() => oeffne('vorlage', r.id)}>
              <span className="bv-feldr" aria-hidden="true" style={{ background: `var(--rolle-${r.farbe})` }}>{rollenKuerzel(r.id, org)}</span>
              <span className="bv-tx"><b>{r.name}</b><small>{n ? `setzt ${anzahl(n, 'Recht', 'Rechte')} vor` : 'setzt keine Rechte vor'}</small></span>
              <Icon n="weiter" className="bv-pfeil" />
            </button>
          )
        })}
      </div>

      <Abschnitt titel="Verknüpfte Rechte" />
      <div className="bv-flaeche">
        {!org ? (
          <button type="button" className="bv-z" onClick={() => oeffne('verkn')}>
            <span className="bv-tx"><b>Organisation nicht geladen</b><small>Es wird nichts mitgebracht</small></span><Icon n="weiter" className="bv-pfeil" />
          </button>
        ) : verkn.length ? verkn.map(x => (
          <button key={x.r.key} type="button" className="bv-z" onClick={() => oeffne('verkn', x.r.key)}>
            <span className="bv-tx"><b>{x.r.label}</b><small>bringt {aufzaehlung(x.mit.map(name))} mit</small></span><Icon n="weiter" className="bv-pfeil" />
          </button>
        )) : (
          <button type="button" className="bv-z" onClick={() => oeffne('verkn')}>
            <span className="bv-tx"><b>Keine Verknüpfungen</b><small>Jedes Recht wird einzeln vergeben</small></span><Icon n="weiter" className="bv-pfeil" />
          </button>
        )}
      </div>
    </>
  )
}

function datum(iso: string): string {
  const d = new Date((iso || '').replace(' ', 'T'))
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function NeuigkeitenReiter({ neuigkeiten, oeffne, loeschen }: { neuigkeiten: Neuigkeit[]; oeffne: Oeffne; loeschen: (id: string) => void }) {
  return (
    <>
      <Abschnitt titel="Veröffentlicht in Unitas" erst rechts={neuigkeiten.length ? anzahl(neuigkeiten.length, 'Beitrag', 'Beiträge') : undefined} />
      {neuigkeiten.length === 0 ? (
        <div className="bv-flaeche">
          <div className="bv-leer">Noch keine Neuigkeiten</div>
          <button type="button" className="bv-z neu" onClick={() => oeffne('neuigkeit')}><Icon n="plus" />Neue Neuigkeit</button>
        </div>
      ) : neuigkeiten.map(n => {
        const url = n.anhang ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}` : null
        const von = [n.erstellt_von, datum(n.created)].filter(Boolean).join(', ')
        return (
          <article key={n.id} className="bv-flaeche">
            {url && <img className="bv-bild" src={url} alt="" />}
            <div style={{ padding: '14px 16px 12px' }}>
              {n.gepinnt && <p className="bv-hinweis" style={{ margin: '0 0 4px', fontWeight: 700 }}>Angeheftet</p>}
              <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, margin: 0 }}>{n.titel}</h3>
              {n.inhalt && <p className="bv-text">{n.inhalt}</p>}
              {von && <p className="bv-hinweis" style={{ margin: '10px 0 0' }}>{von}</p>}
            </div>
            <div className="bv-fuss">
              <button type="button" onClick={() => oeffne('neuigkeit', n.id)}>Bearbeiten</button>
              <button type="button" className="gefahr" onClick={() => loeschen(n.id)}>Löschen</button>
            </div>
          </article>
        )
      })}
    </>
  )
}

export function TempReiter({ k, tempUsers, oeffne }: { k: BvKontext; tempUsers: UUser[]; oeffne: Oeffne }) {
  return (
    <>
      <Abschnitt titel="Zugänge mit Ablaufdatum" erst />
      <Hinweis oben>Echte Konten, die nach Ablauf automatisch nicht mehr gehen.</Hinweis>
      <div className="bv-flaeche">
        {tempUsers.length === 0 && <div className="bv-leer">Keine temporären Zugänge</div>}
        {tempUsers.map(u => <BenutzerZeile key={u.id} u={u} k={k} onClick={() => oeffne('person', u.id)} />)}
        <button type="button" className="bv-z neu" onClick={() => oeffne('zugang')}><Icon n="plus" />Neuer temporärer Zugang</button>
      </div>
    </>
  )
}
