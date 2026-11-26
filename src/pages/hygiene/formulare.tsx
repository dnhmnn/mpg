// Formulare der Hygiene: Desinfektion eintragen (nach Plan oder aus Anlass), Objekt einrichten und
// Vorschläge aus MPG und Lager übernehmen. Geschrieben wird über die Pläne in src/lib/hygiene/aktionen.ts.
import React, { useEffect, useMemo, useState } from 'react'
import { newId } from '../../lib/ids'
import { objektPruefen, planeDurchfuehrung, planeObjektAenderung, planeObjekte, type ObjektDaten } from '../../lib/hygiene/aktionen'
import { checklisteVorschlag, INTERVALL_VORSCHLAG } from '../../lib/hygiene/checklisten'
import { intervallText, standText } from '../../lib/hygiene/fristen'
import { vorschlaegeVon, type Quellen } from '../../lib/hygiene/vorschlaege'
import {
  ANLAESSE, ANLASS_NAME, ARTEN, ART_GRUPPE, ART_NAME, INTERVALLE, MAX_BEMERKUNG, MAX_NAME, NACHTRAG_TAGE, QUELLE_NAME,
  type HyAnlass, type HyArt, type HyIntervall, type HyObjekt, type HyPunktErgebnis,
} from '../../lib/hygiene/typen'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, Seite } from '../benutzer/bausteine'
import { ausgeblendetLesen, ausgeblendetSchreiben, zeitText } from './daten'
import type { HyProps } from '../Hygiene'

/** Zeitpunkt für datetime-local (Ortszeit) */
function lokal(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// ── Desinfektion eintragen ───────────────────────────────────────────────────

export function Durchfuehren({ d, user, orgName, zurueck, ersetze, id, anlass: ausAnlass, vonObjekt }: HyProps & { id: string; anlass: boolean; vonObjekt?: boolean }) {
  const o = d.objekte.find(x => x.id === id)
  // Eine Kennung je Seite: erneutes Senden nach einem Funkloch legt den Nachweis nicht doppelt an
  const [kennung] = useState(() => newId())
  const [punkte, setPunkte] = useState<HyPunktErgebnis[] | null>(() => (o ? o.punkte.map(text => ({ text, erledigt: false })) : null))
  const [anlass, setAnlass] = useState<HyAnlass>(ausAnlass ? 'infektion' : '')
  const [nummer, setNummer] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  const [nachtragen, setNachtragen] = useState(false)
  const [wann, setWann] = useState(() => lokal(new Date()))
  const [gesendet, setGesendet] = useState<ReturnType<typeof planeDurchfuehrung> | null>(null)
  useEffect(() => { if (o && !punkte) setPunkte(o.punkte.map(text => ({ text, erledigt: false }))) }, [o, punkte])

  if (!o || !punkte) return <Seite titel="Desinfektion" unter={orgName} zurueck={zurueck}><Hinweis oben>{d.laedt ? 'Wird geladen …' : !d.geladen ? 'Konnte nicht geladen werden. Bitte bei Verbindung erneut öffnen.' : 'Dieses Objekt gibt es nicht mehr.'}</Hinweis></Seite>
  if (o.archiviert && !gesendet) return <Seite titel="Desinfektion" unter={o.name} zurueck={zurueck}><Hinweis oben>Dieses Objekt ist archiviert. Erst wieder in Gebrauch nehmen.</Hinweis></Seite>
  const s = d.staende.get(o.id)
  const offen = punkte.filter(p => !p.erledigt).length
  const fest = !!gesendet || d.busy
  const jetzt = new Date()
  const frueh = new Date(jetzt.getTime() - NACHTRAG_TAGE * 86_400_000)

  async function speichern() {
    if (!o || !punkte || !user?.organization_id) return
    let plan = gesendet
    if (!plan) {
      let zeitpunkt = new Date()
      if (nachtragen) {
        zeitpunkt = new Date(wann)
        if (isNaN(zeitpunkt.getTime())) { d.melden('Bitte einen vollständigen Zeitpunkt eintragen.', true); return }
        if (zeitpunkt.getTime() > Date.now() + 5 * 60_000) { d.melden('Der Zeitpunkt liegt in der Zukunft.', true); return }
        if (zeitpunkt.getTime() < frueh.getTime()) { d.melden(`Nachtragen geht höchstens ${NACHTRAG_TAGE} Tage zurück.`, true); return }
      }
      if (offen && !confirm(`${offen === 1 ? 'Ein Punkt ist' : `${offen} Punkte sind`} nicht abgehakt. Als unvollständig eintragen? Die Frist läuft dann weiter.`)) return
      plan = planeDurchfuehrung({
        id: kennung, objekt: o, art: ausAnlass ? 'anlass' : 'plan', anlass: ausAnlass ? anlass : '', einsatzNummer: nummer,
        punkte, bemerkung, zeitpunkt: zeitpunkt.toISOString(), wer: { organization_id: user.organization_id, name: user.name || '' },
      })
    }
    const r = await d.ausfuehren(plan, offen ? `Eingetragen — ${offen === 1 ? 'ein Punkt' : `${offen} Punkte`} offen, die Frist läuft weiter` : 'Desinfektion eingetragen')
    if (r === 'ok') { if (vonObjekt) zurueck(); else ersetze('objekt', { id: o.id }) }
    else if (r === 'unklar') setGesendet(plan)
  }

  return (
    <Seite titel={ausAnlass ? 'Aus Anlass' : 'Desinfektion'} unter={o.name} zurueck={zurueck}
      leiste={<Leiste titel={gesendet ? 'Nicht sicher gespeichert' : offen ? `${offen} von ${punkte.length} offen` : 'Alles abgehakt'}
        unter={gesendet ? 'Erneut senden legt nichts doppelt an' : offen ? 'Wird als unvollständig eingetragen' : o.name}
        knopf={gesendet ? 'Erneut senden' : 'Eintragen'} onClick={speichern} laeuft={d.busy} disabled={ausAnlass && !anlass} />}>
      <div className="bv-notiz" style={{ marginTop: 4 }}>
        <b>{[ART_NAME[o.art], o.standort].filter(Boolean).join(' · ')}</b>
        <p>{intervallText(o.intervall, o.intervall_tage)}{s ? ` · ${standText(s)}` : ''}{s?.letzte ? ` · zuletzt ${zeitText(s.letzte.zeitpunkt)}` : ''}</p>
      </div>
      {ausAnlass && <>
        <Abschnitt titel="Anlass" />
        <div className="bv-flaeche" role="radiogroup" aria-label="Anlass">
          {ANLAESSE.map(a => (
            <button key={a} type="button" className="bv-z bv-wahl" role="radio" aria-checked={anlass === a} disabled={fest} onClick={() => setAnlass(a)}>
              <span className="bv-radio" aria-hidden="true" /><span className="bv-tx"><b>{ANLASS_NAME[a]}</b></span>
            </button>
          ))}
        </div>
        <Feld label="Einsatznummer" zusatz="optional" hinweis="Steht am Nachweis und lässt sich unter Nachweise suchen. Keine Namen oder Diagnosen von Patienten.">
          <input className="bv-eingabe" value={nummer} readOnly={fest} onChange={e => setNummer(e.target.value)} placeholder="z. B. 2026-0417" autoCapitalize="none" maxLength={40} />
        </Feld>
      </>}
      <Abschnitt titel="Checkliste" rechts={`${punkte.length - offen} von ${punkte.length}`} />
      <div className="bv-flaeche">
        {punkte.map((p, i) => (
          <button key={i} type="button" className="bv-z hy-punkt" role="checkbox" aria-checked={p.erledigt} disabled={fest}
            onClick={() => setPunkte(punkte.map((x, j) => (j === i ? { ...x, erledigt: !x.erledigt } : x)))}>
            <span className="bv-kasten" aria-hidden="true"><Icon n="haken" /></span>
            <span className="bv-tx"><b>{p.text}</b></span>
          </button>
        ))}
      </div>
      {!fest && <div className="hy-alle">
        <button type="button" className="bv-knopf" onClick={() => setPunkte(punkte.map(x => ({ ...x, erledigt: offen > 0 })))}>{offen > 0 ? 'Alle abhaken' : 'Alle zurücksetzen'}</button>
      </div>}
      <Feld label="Bemerkung" zusatz="optional" hinweis="Keine Namen oder Diagnosen von Patienten.">
        <textarea className="bv-eingabe" rows={3} value={bemerkung} readOnly={fest} maxLength={MAX_BEMERKUNG} onChange={e => setBemerkung(e.target.value)} placeholder="z. B. Flächendesinfektion mit Einwirkzeit, Trage komplett abgezogen" />
      </Feld>
      <div className="bv-flaeche" style={{ marginTop: 16 }}>
        <button type="button" className="bv-z bv-recht" role="switch" aria-checked={nachtragen} disabled={fest} onClick={() => setNachtragen(!nachtragen)}>
          <span className="bv-tx"><b>Nachtragen</b><small>Früher durchgeführt (höchstens {NACHTRAG_TAGE} Tage zurück)</small></span>
          <span className="bv-schalter" aria-hidden="true" />
        </button>
      </div>
      {nachtragen && <Feld label="Durchgeführt am">
        <input className="bv-eingabe" type="datetime-local" value={wann} readOnly={fest} min={lokal(frueh)} max={lokal(jetzt)} onChange={e => setWann(e.target.value)} />
      </Feld>}
      {gesendet && !d.busy && <Hinweis>Ob das gespeichert wurde, ist unklar. „Erneut senden“ schickt genau diesen Stand und legt nichts doppelt an.</Hinweis>}
      <div className="hy-leiste-luft" />
    </Seite>
  )
}

// ── Objekt einrichten ────────────────────────────────────────────────────────

/** Vorbelegung aus einem übernommenen Vorschlag (Seite vorschlaege → neu) */
export type ObjektVorlage = Partial<ObjektDaten>

export function ObjektForm(p: HyProps & { id?: string; vonObjekt?: boolean }) {
  const alt = p.id ? p.d.objekte.find(x => x.id === p.id) : undefined
  if (!p.verwalten) return <Seite titel="Objekt" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>Objekte richtet ein, wer „Hygiene verwalten“ hat.</Hinweis></Seite>
  // Erst bearbeiten, wenn das Objekt geladen ist: Ein Formular mit leeren Feldern würde es beim Speichern überschreiben
  if (p.id && !alt) return <Seite titel="Objekt bearbeiten" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>{p.d.laedt ? 'Wird geladen …' : 'Dieses Objekt gibt es nicht mehr.'}</Hinweis></Seite>
  // Neu erst, wenn die Objekte geladen sind: sonst fiele ein gleichnamiges nicht auf
  if (!p.id && !p.d.geladen) return <Seite titel="Neues Objekt" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>{p.d.ladeFehler ? 'Die Objekte konnten nicht geladen werden. Bitte bei Verbindung erneut öffnen.' : 'Wird geladen …'}</Hinweis></Seite>
  return <ObjektFormInhalt {...p} alt={alt} />
}

function ObjektFormInhalt({ d, user, orgName, zurueck, ersetze, id, alt, vonObjekt }: HyProps & { id?: string; alt?: HyObjekt; vonObjekt?: boolean }) {
  const [kennung] = useState(() => newId())
  const [f, setF] = useState<ObjektDaten>(() => alt ? {
    name: alt.name, art: alt.art, standort: alt.standort, intervall: alt.intervall, intervall_tage: alt.intervall_tage || 14,
    punkte: [...alt.punkte], quelle: alt.quelle, quelle_id: alt.quelle_id, quelle_name: alt.quelle_name,
  } : { name: '', art: 'fahrzeug', standort: '', intervall: INTERVALL_VORSCHLAG.fahrzeug, intervall_tage: 14, punkte: checklisteVorschlag('fahrzeug'), quelle: '', quelle_id: '', quelle_name: '' })
  // Liste noch unberührt? Dann folgt sie beim Wechsel der Art dem Vorschlag
  const [eigeneListe, setEigeneListe] = useState(!!alt)
  const [neuerPunkt, setNeuerPunkt] = useState('')
  // Unklar gesendet: genau dieser Plan wird erneut gesendet, das Formular ist bis dahin fest
  const [gesendet, setGesendet] = useState<ReturnType<typeof planeObjekte> | null>(null)
  const standorte = useMemo(() => [...new Set(d.objekte.map(o => o.standort).concat(d.objekte.filter(o => o.art === 'fahrzeug' || o.art === 'raum').map(o => o.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')), [d.objekte])
  const neu = !id


  const setArt = (art: HyArt) => setF(x => ({ ...x, art, ...(neu && !eigeneListe ? { punkte: checklisteVorschlag(art), intervall: INTERVALL_VORSCHLAG[art] } : {}) }))
  const setPunkt = (i: number, t: string) => { setEigeneListe(true); setF(x => ({ ...x, punkte: x.punkte.map((p, j) => (j === i ? t : p)) })) }
  const schieben = (i: number, um: number) => { setEigeneListe(true); setF(x => { const p = [...x.punkte]; const [e] = p.splice(i, 1); p.splice(i + um, 0, e); return { ...x, punkte: p } }) }
  const weg = (i: number) => { setEigeneListe(true); setF(x => ({ ...x, punkte: x.punkte.filter((_, j) => j !== i) })) }
  const dazu = () => { if (!neuerPunkt.trim()) return; setEigeneListe(true); setF(x => ({ ...x, punkte: [...x.punkte, neuerPunkt.trim()] })); setNeuerPunkt('') }

  async function speichern() {
    if (!user?.organization_id) return
    let plan = gesendet
    if (!plan) {
      const p = objektPruefen({ ...f, punkte: neuerPunkt.trim() ? [...f.punkte, neuerPunkt] : f.punkte })
      if ('fehler' in p) { d.melden(p.fehler, true); return }
      const doppelt = d.objekte.find(o => o.id !== id && !o.archiviert && o.name.toLowerCase() === p.daten.name.toLowerCase())
      if (doppelt && !confirm(`Es gibt schon „${doppelt.name}“. Trotzdem ${neu ? 'anlegen' : 'speichern'}?`)) return
      plan = neu ? planeObjekte({ neu: [{ id: kennung, daten: p.daten }], wer: { organization_id: user.organization_id, name: user.name || '' } }) : planeObjektAenderung({ id: id!, daten: p.daten })
    }
    const r = await d.ausfuehren(plan, neu ? 'Objekt angelegt' : 'Gespeichert')
    if (r === 'ok') { if (vonObjekt && !neu) zurueck(); else ersetze('objekt', { id: neu ? kennung : id! }) }
    else if (r === 'unklar') setGesendet(plan)
  }

  return (
    <Seite titel={neu ? 'Neues Objekt' : 'Objekt bearbeiten'} unter={neu ? orgName : alt!.name} zurueck={zurueck}
      leiste={<Leiste titel={f.name.trim() || (neu ? 'Neues Objekt' : '')} unter={`${ART_NAME[f.art]} · ${intervallText(f.intervall, f.intervall_tage)} · ${f.punkte.length} Punkte`}
        knopf={gesendet ? 'Erneut senden' : neu ? 'Anlegen' : 'Speichern'} onClick={speichern} laeuft={d.busy} />}>
      <fieldset disabled={!!gesendet || d.busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <Feld label="Bezeichnung" erst><input className="bv-eingabe" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="z. B. RTW 83/1, Desinfektionsraum, Notfallrucksack" maxLength={120} /></Feld>
      <Feld label="Art" gruppe>
        <div className="bv-segmente" role="group" aria-label="Art" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {ARTEN.map(a => <button key={a} type="button" className="bv-seg" aria-pressed={f.art === a} onClick={() => setArt(a)}>{a === 'rucksack' ? 'Rucksack' : ART_NAME[a]}</button>)}
        </div>
      </Feld>
      <Feld label="Standort" zusatz={f.art === 'fahrzeug' || f.art === 'raum' ? 'optional' : 'Fahrzeug oder Raum'}>
        <input className="bv-eingabe" list="hy-standorte" value={f.standort} onChange={e => setF({ ...f, standort: e.target.value })} placeholder="z. B. RTW 83/1" maxLength={120} />
        <datalist id="hy-standorte">{standorte.map(s => <option key={s} value={s} />)}</datalist>
      </Feld>
      <Feld label="Intervall" gruppe hinweis={f.intervall === 'benutzung' ? 'Ohne Kalenderfrist: wird nie überfällig, nur nach jeder Benutzung eingetragen.' : 'Desinfektionen aus Anlass setzen die Frist ebenfalls neu.'}>
        <Auswahl value={f.intervall} onChange={v => setF({ ...f, intervall: v as HyIntervall })} label="Intervall">
          {INTERVALLE.map(i => <option key={i} value={i}>{i === 'tage' ? 'Alle … Tage' : intervallText(i)}</option>)}
        </Auswahl>
      </Feld>
      {f.intervall === 'tage' && <Feld label="Alle wie viele Tage?">
        <input className="bv-eingabe" type="number" inputMode="numeric" min={1} max={365} value={f.intervall_tage || ''} onChange={e => setF({ ...f, intervall_tage: Number(e.target.value) })} />
      </Feld>}
      <Abschnitt titel="Checkliste" rechts={f.punkte.length} />
      <div className="bv-flaeche">
        {f.punkte.map((p, i) => (
          <div key={i} className="hy-liste-z">
            <input value={p} onChange={e => setPunkt(i, e.target.value)} aria-label={`Punkt ${i + 1}`} maxLength={200} />
            <button type="button" className="hy-klein" aria-label="Nach oben" disabled={i === 0} onClick={() => schieben(i, -1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 15l6-6 6 6" /></svg></button>
            <button type="button" className="hy-klein" aria-label="Nach unten" disabled={i === f.punkte.length - 1} onClick={() => schieben(i, 1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg></button>
            <button type="button" className="hy-klein" aria-label="Punkt entfernen" onClick={() => weg(i)}><Icon n="kreuz" /></button>
          </div>
        ))}
        <div className="hy-liste-z">
          <input value={neuerPunkt} onChange={e => setNeuerPunkt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); dazu() } }} placeholder="Punkt hinzufügen" aria-label="Punkt hinzufügen" maxLength={200} />
          <button type="button" className="hy-klein" aria-label="Hinzufügen" disabled={!neuerPunkt.trim()} onClick={dazu}><Icon n="plus" /></button>
        </div>
      </div>
      <div className="hy-alle">
        <button type="button" className="bv-knopf" onClick={() => { setEigeneListe(false); setF(x => ({ ...x, punkte: checklisteVorschlag(x.art) })) }}>Vorschlag für {ART_NAME[f.art]} einsetzen</button>
      </div>
      <Hinweis>Die Vorschläge sind nur ein Anfang. Maßgeblich ist der Hygieneplan eurer Organisation (Mittel, Konzentration, Einwirkzeit).</Hinweis>
      {f.quelle && <Hinweis>Verknüpft mit {QUELLE_NAME[f.quelle]}: {f.quelle_name}</Hinweis>}
      </fieldset>
      {gesendet && !d.busy && <Hinweis>Ob das gespeichert wurde, ist unklar. „Erneut senden“ schickt genau diesen Stand und legt nichts doppelt an. Für eine Änderung erst zurück und neu öffnen.</Hinweis>}
      <div className="hy-leiste-luft" />
    </Seite>
  )
}

// ── Vorschläge aus MPG und Lager ─────────────────────────────────────────────

export function Vorschlaege({ d, user, orgName, verwalten, zurueck, ersetze, org }: HyProps & { org: string }) {
  const [q, setQ] = useState<Quellen | null>(null)
  const [fehler, setFehler] = useState<'' | 'route' | 'recht' | 'netz'>('')
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set())
  const [aus, setAus] = useState<string[]>(() => ausgeblendetLesen(org))
  const [ids] = useState(() => new Map<string, string>())
  useEffect(() => {
    if (!verwalten) return
    let aktuell = true
    void d.quellenLaden().then(r => { if (!aktuell) return; if ('q' in r) setQ(r.q); else setFehler(r.grund) })
    return () => { aktuell = false }
  }, [verwalten]) // eslint-disable-line react-hooks/exhaustive-deps
  const liste = useMemo(() => (q ? vorschlaegeVon(q, d.objekte, aus) : []), [q, d.objekte, aus])

  if (!verwalten) return <Seite titel="Vorschläge" unter={orgName} zurueck={zurueck}><Hinweis oben>Vorschläge übernimmt, wer „Hygiene verwalten“ hat.</Hinweis></Seite>
  // Erst mit geladenen Objekten: sonst kämen schon übernommene wieder und würden doppelt angelegt
  if (!d.geladen) return <Seite titel="Vorschläge" unter="Aus MPG und Lager" zurueck={zurueck}><Hinweis oben>{d.ladeFehler ? 'Die Objekte konnten nicht geladen werden. Bitte bei Verbindung erneut öffnen.' : 'Wird geladen …'}</Hinweis></Seite>
  const kennung = (k: string) => { if (!ids.has(k)) ids.set(k, newId()); return ids.get(k)! }
  const umschalten = (k: string) => setGewaehlt(g => { const n = new Set(g); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const auswahl = liste.filter(v => gewaehlt.has(v.schluessel))

  async function uebernehmen() {
    if (!user?.organization_id || !auswahl.length) return
    const wer = { organization_id: user.organization_id, name: user.name || '' }
    let fertig = 0
    // Höchstens 50 je Sammelbuchung; jeder Vorschlag behält seine Kennung (erneut senden legt nichts doppelt an)
    // Wie beim Anlegen von Hand geprüft und gekürzt (Namen aus MPG und Lager können länger sein, als der Server annimmt)
    const geprueft = auswahl.map(v => ({ v, p: objektPruefen({ name: v.name.slice(0, MAX_NAME), art: v.art, standort: v.standort.slice(0, MAX_NAME), intervall: v.intervall, intervall_tage: 0, punkte: v.punkte, quelle: v.quelle, quelle_id: v.quelle_id, quelle_name: v.quelle_name }) }))
    const falsch = geprueft.find(x => 'fehler' in x.p)
    if (falsch) { d.melden(`„${falsch.v.name}“: ${(falsch.p as { fehler: string }).fehler}`, true); return }
    const gut = geprueft.map(x => ({ v: x.v, daten: (x.p as { daten: ObjektDaten }).daten }))
    for (let i = 0; i < gut.length; i += 50) {
      const teil = gut.slice(i, i + 50)
      const plan = planeObjekte({ wer, neu: teil.map(({ v, daten }) => ({ id: kennung(v.schluessel), daten })) })
      const r = await d.ausfuehren(plan, `${fertig + teil.length} ${fertig + teil.length === 1 ? 'Objekt' : 'Objekte'} übernommen`)
      if (r !== 'ok') return
      fertig += teil.length
    }
    setGewaehlt(new Set())
    ersetze('objekte')
  }
  function ausblenden() {
    const neu = [...aus, ...auswahl.map(v => v.schluessel)]
    ausgeblendetSchreiben(org, neu)
    setAus(neu)
    setGewaehlt(new Set())
  }

  const gruppen = ARTEN.map(art => ({ art, l: liste.filter(v => v.art === art) })).filter(g => g.l.length)
  return (
    <Seite titel="Vorschläge" unter="Aus MPG und Lager" zurueck={zurueck}
      leiste={<Leiste titel={auswahl.length ? `${auswahl.length} ausgewählt` : 'Nichts ausgewählt'} unter="Mit Checkliste und Intervall als Vorschlag, später anpassbar"
        knopf="Übernehmen" onClick={uebernehmen} laeuft={d.busy} disabled={!auswahl.length} />}>
      <Hinweis oben>Am Namen erkannt, deshalb nur Vorschläge: Wähle aus, was ihr reinigt und desinfiziert. Checkliste und Intervall lassen sich danach je Objekt anpassen.</Hinweis>
      {fehler ? (
        <div className="bv-notiz" style={{ marginTop: 14 }}><b>Keine Vorschläge</b><p>{fehler === 'route' ? 'Der Server kennt die Vorschläge noch nicht. Der Administrator spielt pb_hooks/hygiene.pb.js ein.' : fehler === 'recht' ? 'Vorschläge sieht, wer „Hygiene verwalten“ hat.' : 'Keine Verbindung zum Server. Bitte später erneut öffnen.'}</p></div>
      ) : !q ? <Hinweis>Wird geladen …</Hinweis> : !liste.length ? (
        <div className="bv-notiz" style={{ marginTop: 14 }}><b>Keine neuen Vorschläge</b><p>Alles aus MPG und Lager ist schon übernommen oder ausgeblendet.</p></div>
      ) : gruppen.map(g => {
        const alle = g.l.every(v => gewaehlt.has(v.schluessel))
        return (
          <section key={g.art}>
            <Abschnitt titel={ART_GRUPPE[g.art]} rechts={<button type="button" style={{ color: 'var(--lbf-akzent)', fontWeight: 700, fontSize: 13 }} onClick={() => setGewaehlt(x => { const n = new Set(x); g.l.forEach(v => (alle ? n.delete(v.schluessel) : n.add(v.schluessel))); return n })}>{alle ? 'Keine' : 'Alle'}</button>} />
            <div className="bv-flaeche">
              {g.l.map(v => (
                <button key={v.schluessel} type="button" className="bv-z hy-wahl" role="checkbox" aria-checked={gewaehlt.has(v.schluessel)} onClick={() => umschalten(v.schluessel)}>
                  <span className="bv-kasten" aria-hidden="true"><Icon n="haken" /></span>
                  <span className="bv-tx"><b>{v.name}</b><small><span className="hy-herkunft">{v.herkunft}</span>{v.standort ? ` · ${v.standort}` : ''} · {intervallText(v.intervall)}</small></span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
      {auswahl.length > 0 && <div className="bv-flaeche" style={{ marginTop: 16 }}><button type="button" className="bv-z gefahr" onClick={ausblenden}>Ausgewählte nicht mehr vorschlagen</button></div>}
      <div className="hy-leiste-luft" />
    </Seite>
  )
}
