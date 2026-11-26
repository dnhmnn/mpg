// Seiten der Hygiene zum Ansehen: Start (Zahlen, Kacheln, was jetzt dran ist), Objekte, ein Objekt,
// Nachweise und ein Nachweis. Formulare in formulare.tsx.
import React, { useMemo, useState } from 'react'
import { kalendertag, plusTage, tagText } from '../../lib/mpg/fristen'
import { LAGE_RANG, intervallText, istFaellig, standText, zaehle, type HyLage, type HyStand } from '../../lib/hygiene/fristen'
import { planeArchiv } from '../../lib/hygiene/aktionen'
import { ANLASS_NAME, ARTEN, ART_GRUPPE, ART_NAME, QUELLE_NAME, type HyDurchfuehrung, type HyObjekt } from '../../lib/hygiene/typen'
import { namensSchluessel } from '../../lib/hygiene/vorschlaege'
import { Abschnitt, Hinweis, Icon, Seite } from '../benutzer/bausteine'
import { uhrText, zeitText } from './daten'
import type { HyProps } from '../Hygiene'

const MARKE: Record<HyLage, string> = { ueberfaellig: 'Überfällig', offen: 'Noch nie', heute: 'Heute', bald: 'Bald', ok: 'In Ordnung', benutzung: 'Nach Benutzung' }

/** Kleine Linien-Symbole der Hygiene */
export function Sym({ n }: { n: 'spruehen' | 'anlass' | 'liste' | 'nachweis' | 'vorschlag' | 'plus' }) {
  const p: Record<string, React.ReactNode> = {
    spruehen: <><path d="M9 7h6v3H9z" /><path d="M10 10v2h4v-2" /><rect x="8" y="12" width="8" height="9" rx="2" /><path d="M15 7l3-2M17 9h3M15 4.5L17 3" /></>,
    anlass: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
    liste: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    nachweis: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 14l2 2 3-4" /></>,
    vorschlag: <><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.4 5.6l-2.1 2.1M21 12h-3" /><path d="M9 18h6M10 21h4" /><path d="M8.5 15a5 5 0 1 1 7 0c-.6.6-1 1.3-1 2v1h-5v-1c0-.7-.4-1.4-1-2z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[n]}</svg>
}

function ObjektZeile({ o, s, onClick, mitArt }: { o: HyObjekt; s: HyStand | undefined; onClick: () => void; mitArt?: boolean }) {
  const lage = s?.lage ?? 'offen'
  const unter = [mitArt ? ART_NAME[o.art] : '', o.standort, s ? standText(s) : '', s?.unvollstaendig ? `${s.unvollstaendig.offen} offen` : ''].filter(Boolean).join(' · ')
  return (
    <button type="button" className="bv-z" onClick={onClick}>
      <span className={`hy-strich ${o.archiviert ? '' : lage}`} aria-hidden="true" />
      <span className="bv-tx"><b>{o.name}</b><small>{unter}</small></span>
      {!o.archiviert && (lage === 'ueberfaellig' || lage === 'heute' || lage === 'offen') && <span className={`hy-marke ${lage}`}>{MARKE[lage]}</span>}
      <Icon n="weiter" className="bv-pfeil" />
    </button>
  )
}

const ordnen = (a: { o: HyObjekt; s?: HyStand }, b: { o: HyObjekt; s?: HyStand }) =>
  LAGE_RANG[a.s?.lage ?? 'offen'] - LAGE_RANG[b.s?.lage ?? 'offen'] || (a.s?.tage ?? 0) - (b.s?.tage ?? 0) || a.o.name.localeCompare(b.o.name, 'de')

// ── Start ────────────────────────────────────────────────────────────────────

export function Start({ d, orgName, verwalten, oeffne, zurHub }: HyProps) {
  const mit = d.aktiv.map(o => ({ o, s: d.staende.get(o.id) }))
  const z = zaehle(mit.map(x => x.s?.lage ?? 'offen'))
  const dran = mit.filter(x => istFaellig(x.s?.lage ?? 'offen')).sort(ordnen)
  const bald = mit.filter(x => x.s?.lage === 'bald').sort(ordnen)
  const heute = d.dfs.filter(x => kalendertag(x.zeitpunkt) === d.heute).length
  // Striche statt Nullen, bis einmal geladen ist (auch nach einem Ladefehler)
  const zahl = (n: number) => (d.geladen ? String(n) : '–')
  const zahlen = (
    <div className="hy-zahlen">
      <button type="button" className={z.ueberfaellig ? 'warn' : ''} onClick={() => oeffne('objekte', { lage: 'ueberfaellig' })}><small>Überfällig</small><b>{zahl(z.ueberfaellig)}</b><span>{z.ueberfaellig === 1 ? 'Objekt' : 'Objekte'}</span></button>
      <button type="button" onClick={() => oeffne('objekte', { lage: 'faellig' })}><small>Jetzt dran</small><b>{zahl(z.faellig)}</b><span>zu erledigen</span></button>
      <button type="button" onClick={() => oeffne('objekte')}><small>In Ordnung</small><b>{zahl(z.ok)}</b><span>von {d.geladen ? d.aktiv.length : '–'}</span></button>
    </div>
  )
  return (
    <Seite titel="Hygiene" unter={orgName} zurueck={zurHub} zurueckLabel="Zurück zur Übersicht" reiter={zahlen}>
      {d.fehlt ? (
        <div className="bv-notiz" style={{ marginTop: 4 }}><b>Hygiene ist am Server noch nicht eingerichtet</b><p>Die Sammlungen für Objekte und Nachweise fehlen. Der Administrator richtet sie mit scripts/hygiene-einrichten.py ein.</p></div>
      ) : d.ladeFehler && !d.geladen ? (
        <div className="bv-notiz" style={{ marginTop: 4 }}><b>Keine Verbindung</b><p>Objekte und Nachweise konnten nicht geladen werden.</p>
          <p><button type="button" className="bv-knopf" style={{ marginTop: 6 }} onClick={() => { void d.laden() }}>Erneut laden</button></p></div>
      ) : (
        <>
          <div className="hy-kacheln">
            <button type="button" className="hy-kachel" onClick={() => oeffne('objekte', { waehlen: '1' })}>
              <span className="hy-kachel-icon"><Sym n="spruehen" /></span><span><b>Desinfektion eintragen</b><small>Objekt wählen, Checkliste abhaken</small></span>
            </button>
            <button type="button" className="hy-kachel" onClick={() => oeffne('objekte', { waehlen: '1', anlass: '1' })}>
              <span className="hy-kachel-icon"><Sym n="anlass" /></span><span><b>Aus Anlass</b><small>z. B. nach Infektionstransport</small></span>
            </button>
            <button type="button" className="hy-kachel" onClick={() => oeffne('objekte')}>
              <span className="hy-kachel-icon"><Sym n="liste" /></span><span><b>Objekte</b><small>Fahrzeuge, Räume, Rucksäcke, Geräte</small></span>
              {!d.laedt && d.aktiv.length > 0 && <span className="hy-zahl">{d.aktiv.length}</span>}
            </button>
            <button type="button" className="hy-kachel" onClick={() => oeffne('nachweise')}>
              <span className="hy-kachel-icon"><Sym n="nachweis" /></span><span><b>Nachweise</b><small>{heute ? `heute ${heute} eingetragen` : 'Wer hat wann desinfiziert'}</small></span>
            </button>
          </div>
          {d.ladeFehler && <Hinweis oben>Keine Verbindung: Es steht der zuletzt geladene Stand da.</Hinweis>}
          {!d.laedt && d.aktiv.length === 0 ? (
            <div className="bv-notiz" style={{ marginTop: 18 }}>
              <b>Noch keine Objekte</b>
              <p>{verwalten ? 'Lege Fahrzeuge, Räume, Rucksäcke oder Geräte an, oder übernimm Vorschläge aus MPG und Lager.' : 'Objekte mit Intervall und Checkliste richtet ein, wer „Hygiene verwalten“ hat.'}</p>
            </div>
          ) : (
            <>
              <Abschnitt titel="Zu tun" rechts={d.laedt ? undefined : dran.length || 'nichts'} />
              {d.laedt ? <Hinweis>Wird geladen …</Hinweis> : dran.length === 0
                ? <div className="bv-notiz"><b>Alles in Ordnung</b><p>Nichts ist heute fällig oder überfällig.</p></div>
                : <div className="bv-flaeche">{dran.map(({ o, s }) => <ObjektZeile key={o.id} o={o} s={s} mitArt onClick={() => oeffne('durchfuehren', { id: o.id })} />)}</div>}
              {bald.length > 0 && <>
                <Abschnitt titel="Bald fällig" rechts={bald.length} />
                <div className="bv-flaeche">{bald.map(({ o, s }) => <ObjektZeile key={o.id} o={o} s={s} mitArt onClick={() => oeffne('objekt', { id: o.id })} />)}</div>
              </>}
            </>
          )}
          {verwalten && <>
            <Abschnitt titel="Einrichten" />
            <div className="bv-flaeche">
              <button type="button" className="bv-z" onClick={() => oeffne('vorschlaege')}>
                <span className="hy-z-icon"><Sym n="vorschlag" /></span>
                <span className="bv-tx"><b>Vorschläge aus MPG und Lager</b><small>Geräte, Fahrzeuge, Räume, Rucksäcke und Mehrweg-Material übernehmen</small></span>
                <Icon n="weiter" className="bv-pfeil" />
              </button>
              <button type="button" className="bv-z" onClick={() => oeffne('neu')}>
                <span className="hy-z-icon"><Sym n="plus" /></span>
                <span className="bv-tx"><b>Objekt anlegen</b><small>Mit Intervall und Checkliste</small></span>
                <Icon n="weiter" className="bv-pfeil" />
              </button>
            </div>
          </>}
          <Hinweis>Überfälliges wird nur angezeigt, nichts wird gesperrt. Maßgeblich ist der Hygieneplan eurer Organisation.</Hinweis>
        </>
      )}
    </Seite>
  )
}

// ── Objekte ──────────────────────────────────────────────────────────────────

export function Objekte({ d, orgName, verwalten, oeffne, zurueck, filter, waehlen, anlass }: HyProps & { filter: string; waehlen: boolean; anlass: boolean }) {
  const [suche, setSuche] = useState('')
  const [archivAuf, setArchivAuf] = useState(false)
  const s = namensSchluessel(suche)
  const passt = (o: HyObjekt) => !s || namensSchluessel(`${o.name} ${o.standort} ${ART_NAME[o.art]}`).includes(s)
  const passtLage = (st?: HyStand) => !filter || (filter === 'ueberfaellig' ? st?.lage === 'ueberfaellig' : filter === 'faellig' ? (st?.lage === 'heute' || st?.lage === 'offen') : true)
  const mit = d.aktiv.filter(passt).map(o => ({ o, s: d.staende.get(o.id) })).filter(x => passtLage(x.s))
  const archiv = d.objekte.filter(o => o.archiviert && passt(o))
  const titel = waehlen ? (anlass ? 'Aus Anlass' : 'Desinfektion eintragen') : filter === 'ueberfaellig' ? 'Überfällig' : filter === 'faellig' ? 'Jetzt dran' : 'Objekte'
  const tippen = (o: HyObjekt) => waehlen ? oeffne('durchfuehren', { id: o.id, ...(anlass ? { anlass: '1' } : {}) }) : oeffne('objekt', { id: o.id })
  return (
    <Seite titel={titel} unter={waehlen ? 'Objekt wählen' : orgName} zurueck={zurueck}
      rechts={verwalten && !waehlen ? <button type="button" className="bv-rund hell" aria-label="Objekt anlegen" title="Objekt anlegen" onClick={() => oeffne('neu')}><Icon n="plus" /></button> : undefined}>
      <div className="bv-suche" style={{ marginBottom: 4 }}>
        <Icon n="suche" />
        <input type="search" placeholder="Name, Standort oder Art" aria-label="Objekte suchen" value={suche} onChange={e => setSuche(e.target.value)} />
        {suche && <button type="button" aria-label="Suche leeren" onClick={() => setSuche('')}><Icon n="kreuz" /></button>}
      </div>
      {d.ladeFehler && <Hinweis>Keine Verbindung: Es steht der zuletzt geladene Stand da.</Hinweis>}
      {d.laedt || (!d.geladen && d.ladeFehler) ? <Hinweis>{d.laedt ? 'Wird geladen …' : 'Die Objekte konnten nicht geladen werden.'}</Hinweis> : mit.length === 0 ? (
        <div className="bv-notiz" style={{ marginTop: 14 }}><b>{suche || filter ? 'Nichts gefunden' : 'Noch keine Objekte'}</b><p>{suche ? 'Anders suchen oder die Suche leeren.' : filter ? 'Gerade ist hier nichts.' : verwalten ? 'Mit Plus ein Objekt anlegen oder auf der Startseite Vorschläge aus MPG und Lager übernehmen.' : 'Objekte richtet ein, wer „Hygiene verwalten“ hat.'}</p></div>
      ) : ARTEN.map(art => {
        const teil = mit.filter(x => x.o.art === art).sort(ordnen)
        if (!teil.length) return null
        return (
          <section key={art}>
            <Abschnitt titel={ART_GRUPPE[art]} rechts={teil.length} />
            <div className="bv-flaeche">{teil.map(({ o, s }) => <ObjektZeile key={o.id} o={o} s={s} onClick={() => tippen(o)} />)}</div>
          </section>
        )
      })}
      {!waehlen && !filter && archiv.length > 0 && <>
        <button type="button" className="bv-aufklapp" aria-expanded={archivAuf} onClick={() => setArchivAuf(!archivAuf)}><Icon n={archivAuf ? 'runter' : 'weiter'} className="bv-klein" />Archiviert ({archiv.length})</button>
        {archivAuf && <div className="bv-flaeche">{archiv.map(o => <ObjektZeile key={o.id} o={o} s={undefined} mitArt onClick={() => oeffne('objekt', { id: o.id })} />)}</div>}
      </>}
    </Seite>
  )
}

// ── Ein Objekt ───────────────────────────────────────────────────────────────

export function Objekt({ d, orgName, verwalten, oeffne, zurueck, id }: HyProps & { id: string }) {
  const o = d.objekte.find(x => x.id === id)
  if (!o) return <Seite titel="Objekt" unter={orgName} zurueck={zurueck}><Hinweis oben>{d.laedt ? 'Wird geladen …' : !d.geladen ? 'Konnte nicht geladen werden. Bitte bei Verbindung erneut öffnen.' : 'Dieses Objekt gibt es nicht mehr.'}</Hinweis></Seite>
  const s = d.staende.get(o.id)
  const verlauf = d.dfs.filter(x => x.objekt_id === o.id)
  async function archiv() {
    if (!o) return
    if (!o.archiviert && !confirm(`„${o.name}“ archivieren? Es wird nicht mehr fällig. Die Nachweise bleiben erhalten.`)) return
    const r = await d.ausfuehren(planeArchiv({ id: o.id, seit: o.archiviert ? '' : new Date().toISOString() }), o.archiviert ? 'Wieder in Gebrauch' : 'Archiviert')
    if (r === 'ok' && !o.archiviert) zurueck()
  }
  return (
    <Seite titel={o.name} unter={[ART_NAME[o.art], o.standort].filter(Boolean).join(' · ')} zurueck={zurueck}>
      {o.archiviert ? (
        <div className="bv-notiz" style={{ marginTop: 4 }}><b>Archiviert</b><p>Seit {tagText(kalendertag(o.archiviert))}. Es wird nicht mehr fällig; die Nachweise bleiben.</p></div>
      ) : (
        <div className="bv-notiz" style={{ marginTop: 4 }}>
          <b className={`hy-marke ${s?.lage ?? 'offen'}`} style={{ fontSize: 12 }}>{s ? standText(s) : '—'}</b>
          <p>{s?.letzte ? `Zuletzt vollständig am ${zeitText(s.letzte.zeitpunkt)} von ${s.letzte.user_name || 'Unbekannt'}.` : 'Noch keine vollständige Desinfektion eingetragen.'}</p>
          {s?.unvollstaendig && <p style={{ color: 'var(--lbf-fehler-text)' }}>Am {zeitText(s.unvollstaendig.zeitpunkt)} unvollständig: {s.unvollstaendig.offen === 1 ? 'ein Punkt' : `${s.unvollstaendig.offen} Punkte`} offen. Die Frist läuft weiter.</p>}
        </div>
      )}
      {!o.archiviert && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="bv-knopf gross" style={{ flex: '2 1 180px', background: 'var(--lbf-akzent-grund)', color: '#fff', borderColor: 'var(--lbf-akzent-grund)' }} onClick={() => oeffne('durchfuehren', { id: o.id, von: 'objekt' })}>Desinfektion eintragen</button>
          <button type="button" className="bv-knopf gross" style={{ flex: '1 1 120px' }} onClick={() => oeffne('durchfuehren', { id: o.id, anlass: '1', von: 'objekt' })}>Aus Anlass</button>
        </div>
      )}
      <Abschnitt titel="Plan" />
      <div className="bv-flaeche">
        <div className="bv-z"><span className="bv-tx"><b>Intervall</b><small>{intervallText(o.intervall, o.intervall_tage)}</small></span></div>
        {o.standort && <div className="bv-z"><span className="bv-tx"><b>Standort</b><small>{o.standort}</small></span></div>}
        {o.quelle && <div className="bv-z"><span className="bv-tx"><b>Verknüpft</b><small>{QUELLE_NAME[o.quelle]}: {o.quelle_name || '—'}</small></span></div>}
      </div>
      <Abschnitt titel="Checkliste" rechts={o.punkte.length} />
      <div className="bv-flaeche">{o.punkte.map((t, i) => <div key={i} className="bv-z"><span className="bv-tx"><b style={{ fontWeight: 400 }}>{t}</b></span></div>)}</div>
      <Abschnitt titel="Verlauf" rechts={verlauf.length || undefined} />
      {verlauf.length === 0 ? <Hinweis>Noch keine Desinfektion eingetragen.</Hinweis> : (
        <div className="bv-flaeche">{verlauf.slice(0, 30).map(x => <NachweisZeile key={x.id} x={x} ohneObjekt onClick={() => oeffne('nachweis', { id: x.id })} />)}</div>
      )}
      {verlauf.length > 30 && <Hinweis>Die letzten 30. Alle stehen unter Nachweise.</Hinweis>}
      {verwalten && <>
        <Abschnitt titel="Einrichten" />
        <div className="bv-flaeche">
          {!o.archiviert && <button type="button" className="bv-z aktion" onClick={() => oeffne('bearbeiten', { id: o.id, von: 'objekt' })}>Bearbeiten</button>}
          <button type="button" className={`bv-z ${o.archiviert ? 'aktion' : 'gefahr'}`} disabled={d.busy} onClick={archiv}>{o.archiviert ? 'Wieder in Gebrauch nehmen' : 'Archivieren'}</button>
        </div>
      </>}
    </Seite>
  )
}

// ── Nachweise ────────────────────────────────────────────────────────────────

function NachweisZeile({ x, onClick, ohneObjekt }: { x: HyDurchfuehrung; onClick: () => void; ohneObjekt?: boolean }) {
  const unter = [ohneObjekt ? zeitText(x.zeitpunkt) : uhrText(x.zeitpunkt), x.user_name || 'Unbekannt', x.anlass ? ANLASS_NAME[x.anlass] : '', x.offen ? `${x.offen} offen` : ''].filter(Boolean).join(' · ')
  return (
    <button type="button" className="bv-z" onClick={onClick}>
      <span className={`hy-strich ${x.offen ? 'ueberfaellig' : 'ok'}`} aria-hidden="true" />
      <span className="bv-tx"><b>{ohneObjekt ? (x.anlass ? 'Aus Anlass' : 'Nach Plan') : x.objekt_name}</b><small>{unter}</small></span>
      <Icon n="weiter" className="bv-pfeil" />
    </button>
  )
}

export function Nachweise({ d, orgName, oeffne, zurueck }: HyProps) {
  const [suche, setSuche] = useState('')
  const [tage, setTage] = useState(60)
  const s = namensSchluessel(suche)
  const gruppen = useMemo(() => {
    const g = new Map<string, HyDurchfuehrung[]>()
    for (const x of d.dfs) {
      if (s && !namensSchluessel(`${x.objekt_name} ${x.user_name} ${x.einsatz_nummer}`).includes(s)) continue
      const t = kalendertag(x.zeitpunkt) || ''
      if (!g.has(t)) g.set(t, [])
      g.get(t)!.push(x)
    }
    return [...g]
  }, [d.dfs, s])
  const sichtbar = s ? gruppen : gruppen.slice(0, tage)
  const tagTitel = (t: string) => t === d.heute ? 'Heute' : t === plusTage(d.heute, -1) ? 'Gestern' : tagText(t)
  return (
    <Seite titel="Nachweise" unter={orgName} zurueck={zurueck}>
      <div className="bv-suche" style={{ marginBottom: 4 }}>
        <Icon n="suche" />
        <input type="search" placeholder="Objekt, Person oder Einsatznummer" aria-label="Nachweise suchen" value={suche} onChange={e => setSuche(e.target.value)} />
        {suche && <button type="button" aria-label="Suche leeren" onClick={() => setSuche('')}><Icon n="kreuz" /></button>}
      </div>
      {d.laedt || (!d.geladen && d.ladeFehler) ? <Hinweis>{d.laedt ? 'Wird geladen …' : 'Die Nachweise konnten nicht geladen werden.'}</Hinweis> : gruppen.length === 0
        ? <div className="bv-notiz" style={{ marginTop: 14 }}><b>{suche ? 'Nichts gefunden' : 'Noch keine Nachweise'}</b><p>{suche ? 'Anders suchen oder die Suche leeren.' : 'Jede eingetragene Desinfektion steht hier.'}</p></div>
        : sichtbar.map(([t, l]) => (
          <section key={t}>
            <Abschnitt titel={tagTitel(t)} rechts={l.length} />
            <div className="bv-flaeche">{l.map(x => <NachweisZeile key={x.id} x={x} onClick={() => oeffne('nachweis', { id: x.id })} />)}</div>
          </section>
        ))}
      {sichtbar.length < gruppen.length && <div className="hy-alle"><button type="button" className="bv-knopf" onClick={() => setTage(t => t + 60)}>Ältere anzeigen</button></div>}
      <Hinweis>Nachweise lassen sich nicht ändern oder löschen. In der App stehen die letzten 400 Tage; ältere bleiben am Server erhalten.</Hinweis>
    </Seite>
  )
}

export function Nachweis({ d, orgName, oeffne, zurueck, id }: HyProps & { id: string }) {
  const x = d.dfs.find(y => y.id === id)
  if (!x) return <Seite titel="Nachweis" unter={orgName} zurueck={zurueck}><Hinweis oben>{d.laedt ? 'Wird geladen …' : !d.geladen ? 'Konnte nicht geladen werden. Bitte bei Verbindung erneut öffnen.' : 'Diesen Nachweis gibt es hier nicht (älter als 400 Tage?).'}</Hinweis></Seite>
  const objekt = d.objekte.find(o => o.id === x.objekt_id)
  const nachgetragen = x.created && Math.abs(new Date(x.created.replace(' ', 'T')).getTime() - new Date(x.zeitpunkt.replace(' ', 'T')).getTime()) > 30 * 60_000
  const zeilen: [string, string][] = [
    ['Durchgeführt', zeitText(x.zeitpunkt)],
    ...(nachgetragen ? [['Eingetragen', zeitText(x.created)] as [string, string]] : []),
    ['Von', x.user_name || 'Unbekannt'],
    ['Art', x.anlass ? `Aus Anlass: ${ANLASS_NAME[x.anlass]}` : 'Nach Plan'],
    ...(x.einsatz_nummer ? [['Einsatznummer', x.einsatz_nummer] as [string, string]] : []),
    ...(x.bemerkung ? [['Bemerkung', x.bemerkung] as [string, string]] : []),
  ]
  return (
    <Seite titel={x.objekt_name} unter={x.offen ? `Unvollständig: ${x.offen} offen` : 'Vollständig'} zurueck={zurueck}>
      <div className="bv-flaeche" style={{ marginTop: 4 }}>
        {zeilen.map(([k, v]) => <div key={k} className="bv-z"><span className="bv-tx"><b>{k}</b><small style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{v}</small></span></div>)}
      </div>
      <Abschnitt titel="Checkliste" rechts={`${x.punkte.length - x.offen} von ${x.punkte.length}`} />
      <div className="bv-flaeche">
        {x.punkte.map((p, i) => (
          <div key={i} className="bv-z" role="checkbox" aria-checked={p.erledigt} aria-disabled="true">
            <span className={p.erledigt ? 'bv-kasten' : 'bv-kasten hy-mangel'}><Icon n={p.erledigt ? 'haken' : 'kreuz'} /></span>
            <span className="bv-tx"><b style={{ fontWeight: 400, color: p.erledigt ? undefined : 'var(--lbf-fehler-text)' }}>{p.text}</b>{!p.erledigt && <small>nicht erledigt</small>}</span>
          </div>
        ))}
      </div>
      {objekt && <div className="bv-flaeche" style={{ marginTop: 16 }}>
        <button type="button" className="bv-z aktion" onClick={() => oeffne('objekt', { id: objekt.id })}>Zum Objekt<Icon n="weiter" className="bv-pfeil" /></button>
      </div>}
      <Hinweis>Nachweise lassen sich nicht ändern oder löschen.</Hinweis>
    </Seite>
  )
}
