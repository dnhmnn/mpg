// Checklisten-Vorlagen (Owner, 26.11.2026: „Checklisten bearbeiten“, „mehr Möglichkeiten“): eigene Vorlagen der
// Organisation (hygiene_vorlagen) und die von Responda (src/lib/hygiene/checklisten.ts, nur lesen, als eigene
// übernehmen). Eine geänderte eigene Vorlage lässt sich auf die Objekte übertragen, die sie unverändert nutzen.
import { useMemo, useState } from 'react'
import { newId } from '../../lib/ids'
import { planeUebertragen, planeVorlage, planeVorlageArchiv, vorlagePruefen, type VorlageDaten } from '../../lib/hygiene/aktionen'
import { STD_VORLAGEN, stdVorlage, uebertragen } from '../../lib/hygiene/checklisten'
import { intervallText } from '../../lib/hygiene/fristen'
import { ARTEN, ART_GRUPPE, ART_NAME, INTERVALLE, MAX_PUNKTE, STD, type HyArt, type HyIntervall, type HyVorlage } from '../../lib/hygiene/typen'
import type { Anfrage } from '../../lib/mpg/schreiben'
import { kalendertag, tagText } from '../../lib/mpg/fristen'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, Seite } from '../benutzer/bausteine'
import type { HyProps } from '../Hygiene'

/** Punkte einer Checkliste bearbeiten: ändern, verschieben, entfernen, hinzufügen. */
export function PunkteEditor({ punkte, onChange, neu, setNeu }: { punkte: string[]; onChange: (p: string[]) => void; neu: string; setNeu: (t: string) => void }) {
  const dazu = () => { if (!neu.trim()) return; onChange([...punkte, neu.trim()]); setNeu('') }
  const schieben = (i: number, um: number) => { const p = [...punkte]; const [e] = p.splice(i, 1); p.splice(i + um, 0, e); onChange(p) }
  return (
    <div className="bv-flaeche">
      {punkte.map((p, i) => (
        <div key={i} className="hy-liste-z">
          <input value={p} onChange={e => onChange(punkte.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Punkt ${i + 1}`} maxLength={200} />
          <button type="button" className="hy-klein" aria-label="Nach oben" disabled={i === 0} onClick={() => schieben(i, -1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 15l6-6 6 6" /></svg></button>
          <button type="button" className="hy-klein" aria-label="Nach unten" disabled={i === punkte.length - 1} onClick={() => schieben(i, 1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg></button>
          <button type="button" className="hy-klein" aria-label="Punkt entfernen" onClick={() => onChange(punkte.filter((_, j) => j !== i))}><Icon n="kreuz" /></button>
        </div>
      ))}
      {punkte.length < MAX_PUNKTE && <div className="hy-liste-z">
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); dazu() } }} placeholder="Punkt hinzufügen" aria-label="Punkt hinzufügen" maxLength={200} />
        <button type="button" className="hy-klein" aria-label="Hinzufügen" disabled={!neu.trim()} onClick={dazu}><Icon n="plus" /></button>
      </div>}
    </div>
  )
}

/** Alle wählbaren Vorlagen: eigene (in Gebrauch) zuerst, dann die von Responda; passende Art jeweils vorn. */
export function vorlagenFuer(eigene: HyVorlage[], art: HyArt): { eigene: HyVorlage[]; std: HyVorlage[] } {
  const vorn = (a: HyVorlage, b: HyVorlage) => Number(b.art === art) - Number(a.art === art) || a.name.localeCompare(b.name, 'de')
  return { eigene: eigene.filter(v => !v.archiviert).sort(vorn), std: [...STD_VORLAGEN].sort((a, b) => Number(b.art === art) - Number(a.art === art)) }
}

/** Vorlage nach Kennung: eigene oder von Responda */
export function vorlageNach(eigene: HyVorlage[], id: string | undefined): HyVorlage | undefined {
  return id ? (id.startsWith(STD) ? stdVorlage(id) : eigene.find(v => v.id === id)) : undefined
}

// ── Liste ────────────────────────────────────────────────────────────────────

export function Vorlagen({ d, orgName, verwalten, oeffne, zurueck }: HyProps) {
  const [archivAuf, setArchivAuf] = useState(false)
  const nutzen = (id: string) => d.objekte.filter(o => o.vorlage_id === id && !o.archiviert).length
  const eigene = d.vorlagen.filter(v => !v.archiviert).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const archiv = d.vorlagen.filter(v => v.archiviert)
  const zeile = (v: HyVorlage) => {
    const n = nutzen(v.id)
    return (
      <button key={v.id} type="button" className="bv-z" onClick={() => oeffne('vorlage', { id: v.id })}>
        <span className="bv-tx"><b>{v.name}</b><small>{[ART_NAME[v.art], `${v.punkte.length} Punkte`, intervallText(v.intervall, v.intervall_tage), n ? `${n} ${n === 1 ? 'Objekt' : 'Objekte'}` : ''].filter(Boolean).join(' · ')}</small></span>
        <Icon n="weiter" className="bv-pfeil" />
      </button>
    )
  }
  return (
    <Seite titel="Checklisten" unter={orgName} zurueck={zurueck}
      rechts={verwalten && d.vorlagenDa ? <button type="button" className="bv-rund hell" aria-label="Neue Checkliste" title="Neue Checkliste" onClick={() => oeffne('vorlage-neu')}><Icon n="plus" /></button> : undefined}>
      <Hinweis oben>Vorlagen für die Checklisten der Objekte. Wird eine eigene Vorlage geändert, lässt sie sich auf die Objekte übertragen, die sie unverändert nutzen.</Hinweis>
      <Abschnitt titel="Eigene Checklisten" rechts={eigene.length || undefined} />
      {!d.vorlagenDa ? (
        <div className="bv-notiz"><b>Noch nicht eingerichtet</b><p>Eigene Checklisten gibt es, sobald der Administrator scripts/hygiene-einrichten.py erneut ausgeführt hat. Bis dahin stehen die Vorlagen von Responda zur Wahl.</p></div>
      ) : eigene.length === 0 ? (
        <div className="bv-notiz"><b>Noch keine eigenen</b><p>{verwalten ? 'Mit Plus eine neue anlegen oder unten eine Vorlage von Responda übernehmen und anpassen.' : 'Eigene Checklisten legt an, wer „Hygiene verwalten“ hat.'}</p></div>
      ) : <div className="bv-flaeche">{eigene.map(zeile)}</div>}
      <Abschnitt titel="Vorlagen von Responda" rechts={STD_VORLAGEN.length} />
      {ARTEN.map(art => {
        const l = STD_VORLAGEN.filter(v => v.art === art)
        if (!l.length) return null
        return (
          <section key={art}>
            <h3 className="bv-gruppe">{ART_GRUPPE[art]}</h3>
            <div className="bv-flaeche">{l.map(v => (
              <button key={v.id} type="button" className="bv-z" onClick={() => oeffne('vorlage', { id: v.id })}>
                <span className="bv-tx"><b>{v.name}</b><small>{`${v.punkte.length} Punkte · ${intervallText(v.intervall, v.intervall_tage)}`}{nutzen(v.id) ? ` · ${nutzen(v.id)} ${nutzen(v.id) === 1 ? 'Objekt' : 'Objekte'}` : ''}</small></span>
                <Icon n="weiter" className="bv-pfeil" />
              </button>
            ))}</div>
          </section>
        )
      })}
      {archiv.length > 0 && <>
        <button type="button" className="bv-aufklapp" aria-expanded={archivAuf} onClick={() => setArchivAuf(!archivAuf)}><Icon n={archivAuf ? 'runter' : 'weiter'} className="bv-klein" />Archiviert ({archiv.length})</button>
        {archivAuf && <div className="bv-flaeche">{archiv.map(zeile)}</div>}
      </>}
    </Seite>
  )
}

// ── Eine Vorlage: ansehen, bearbeiten, neu ───────────────────────────────────

export function VorlageSeite(p: HyProps & { id?: string; von?: string }) {
  const v = vorlageNach(p.d.vorlagen, p.id)
  if (p.id && !v) return <Seite titel="Checkliste" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>{p.d.laedt ? 'Wird geladen …' : !p.d.geladen ? 'Konnte nicht geladen werden. Bitte bei Verbindung erneut öffnen.' : 'Diese Checkliste gibt es nicht mehr.'}</Hinweis></Seite>
  // Von Responda oder ohne Recht: nur ansehen
  if (v && (v.id.startsWith(STD) || !p.verwalten)) return <VorlageAnsicht {...p} v={v} />
  if (!p.verwalten) return <Seite titel="Neue Checkliste" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>Checklisten richtet ein, wer „Hygiene verwalten“ hat.</Hinweis></Seite>
  if (!p.d.vorlagenDa) return <Seite titel="Neue Checkliste" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>Eigene Checklisten gibt es, sobald der Administrator scripts/hygiene-einrichten.py erneut ausgeführt hat.</Hinweis></Seite>
  if (!v && !p.d.geladen) return <Seite titel="Neue Checkliste" unter={p.orgName} zurueck={p.zurueck}><Hinweis oben>Wird geladen …</Hinweis></Seite>
  return <VorlageForm {...p} alt={v} vorbild={vorlageNach(p.d.vorlagen, p.von)} />
}

function VorlageAnsicht({ d, orgName, verwalten, oeffne, zurueck, v }: HyProps & { v: HyVorlage }) {
  const std = v.id.startsWith(STD)
  const n = d.objekte.filter(o => o.vorlage_id === v.id && !o.archiviert).length
  return (
    <Seite titel={v.name} unter={std ? 'Vorlage von Responda' : orgName} zurueck={zurueck}>
      <div className="bv-flaeche" style={{ marginTop: 4 }}>
        <div className="bv-z"><span className="bv-tx"><b>Art</b><small>{ART_NAME[v.art]}</small></span></div>
        <div className="bv-z"><span className="bv-tx"><b>Intervall für neue Objekte</b><small>{intervallText(v.intervall, v.intervall_tage)}</small></span></div>
        {n > 0 && <div className="bv-z"><span className="bv-tx"><b>Genutzt von</b><small>{n} {n === 1 ? 'Objekt' : 'Objekten'}</small></span></div>}
        {v.archiviert && <div className="bv-z"><span className="bv-tx"><b>Archiviert</b><small>seit {tagText(kalendertag(v.archiviert))}</small></span></div>}
      </div>
      <Abschnitt titel="Checkliste" rechts={v.punkte.length} />
      <div className="bv-flaeche">{v.punkte.map((t, i) => <div key={i} className="bv-z"><span className="bv-tx"><b style={{ fontWeight: 400 }}>{t}</b></span></div>)}</div>
      {std && verwalten && d.vorlagenDa && <div className="bv-flaeche" style={{ marginTop: 16 }}>
        <button type="button" className="bv-z aktion" onClick={() => oeffne('vorlage-neu', { von: v.id })}>Als eigene Checkliste übernehmen und anpassen</button>
      </div>}
      {std && <Hinweis>Vorlagen von Responda sind ein Anfang. Maßgeblich ist der Hygieneplan eurer Organisation.</Hinweis>}
    </Seite>
  )
}

function VorlageForm({ d, user, orgName, zurueck, ersetze, alt, vorbild }: HyProps & { alt?: HyVorlage; vorbild?: HyVorlage }) {
  const quelle = alt ?? vorbild
  const [kennung] = useState(() => newId())
  const [f, setF] = useState<VorlageDaten>(() => ({
    name: alt ? alt.name : vorbild ? vorbild.name.replace(/\s*\(.*\)$/, '') : '',
    art: quelle?.art ?? 'fahrzeug', intervall: quelle?.intervall ?? 'monatlich', intervall_tage: quelle?.intervall_tage || 14, punkte: [...(quelle?.punkte ?? [])],
  }))
  const [neuerPunkt, setNeuerPunkt] = useState('')
  const [gesendet, setGesendet] = useState<Anfrage[][] | null>(null)
  const neu = !alt
  const nutzer = useMemo(() => (alt ? uebertragen(alt.id, alt.punkte, d.objekte) : { gleich: [], abweichend: [] }), [alt, d.objekte])

  async function senden(teile: Anfrage[][], erfolg: string) {
    for (let i = 0; i < teile.length; i++) {
      const r = await d.ausfuehren(teile[i], erfolg)
      if (r === 'unklar') { setGesendet(teile.slice(i)); return false }
      if (r !== 'ok') return false
    }
    return true
  }

  async function speichern() {
    if (!user?.organization_id) return
    let teile = gesendet
    if (!teile) {
      const p = vorlagePruefen({ ...f, punkte: neuerPunkt.trim() ? [...f.punkte, neuerPunkt] : f.punkte })
      if ('fehler' in p) { d.melden(p.fehler, true); return }
      const plan = planeVorlage({ id: alt ? alt.id : kennung, neu, daten: p.daten, wer: { organization_id: user.organization_id, name: user.name || '' } })
      teile = [plan]
      const geaendert = alt && JSON.stringify(alt.punkte) !== JSON.stringify(p.daten.punkte)
      if (geaendert && nutzer.gleich.length) {
        const frage = `Die neue Checkliste auf ${nutzer.gleich.length === 1 ? 'das Objekt' : `${nutzer.gleich.length} Objekte`} übertragen, ${nutzer.gleich.length === 1 ? 'das' : 'die'} diese Vorlage unverändert ${nutzer.gleich.length === 1 ? 'nutzt' : 'nutzen'}?`
          + (nutzer.abweichend.length ? `\n\n${nutzer.abweichend.length} mit eigener Anpassung ${nutzer.abweichend.length === 1 ? 'bleibt' : 'bleiben'}, wie ${nutzer.abweichend.length === 1 ? 'es ist' : 'sie sind'}.` : '')
        if (confirm(frage)) {
          const upd = planeUebertragen({ objekte: nutzer.gleich, punkte: p.daten.punkte })
          // Höchstens 50 Anfragen je Sammelbuchung: die Vorlage zuerst, dann die Objekte
          teile = [[...plan, ...upd.slice(0, 49)]]
          for (let i = 49; i < upd.length; i += 50) teile.push(upd.slice(i, i + 50))
        }
      }
    }
    const ok = await senden(teile, neu ? 'Checkliste angelegt' : 'Gespeichert')
    if (ok) { if (neu) ersetze('vorlage', { id: kennung }); else zurueck() }
  }

  async function archiv() {
    if (!alt) return
    if (!alt.archiviert && !confirm(`„${alt.name}“ archivieren? Objekte, die sie nutzen, behalten ihre Checkliste.`)) return
    const r = await d.ausfuehren(planeVorlageArchiv({ id: alt.id, seit: alt.archiviert ? '' : new Date().toISOString() }), alt.archiviert ? 'Wieder in Gebrauch' : 'Archiviert')
    if (r === 'ok') zurueck()
  }

  return (
    <Seite titel={neu ? 'Neue Checkliste' : 'Checkliste bearbeiten'} unter={neu ? (vorbild ? `nach „${vorbild.name}“` : orgName) : alt!.name} zurueck={zurueck}
      leiste={<Leiste titel={f.name.trim() || 'Neue Checkliste'} unter={`${ART_NAME[f.art]} · ${f.punkte.length} Punkte${nutzer.gleich.length ? ` · ${nutzer.gleich.length + nutzer.abweichend.length} Objekte` : ''}`}
        knopf={gesendet ? 'Erneut senden' : neu ? 'Anlegen' : 'Speichern'} onClick={speichern} laeuft={d.busy} />}>
      <fieldset disabled={!!gesendet || d.busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Feld label="Name" erst><input className="bv-eingabe" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="z. B. Löschfahrzeug nach Brandeinsatz" maxLength={120} /></Feld>
        <Feld label="Für" gruppe>
          <div className="bv-segmente" role="group" aria-label="Art" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {ARTEN.map(a => <button key={a} type="button" className="bv-seg" aria-pressed={f.art === a} onClick={() => setF({ ...f, art: a })}>{a === 'rucksack' ? 'Rucksack' : ART_NAME[a]}</button>)}
          </div>
        </Feld>
        <Feld label="Intervall für neue Objekte" gruppe>
          <Auswahl value={f.intervall} onChange={x => setF({ ...f, intervall: x as HyIntervall })} label="Intervall">
            {INTERVALLE.map(i => <option key={i} value={i}>{i === 'tage' ? 'Alle … Tage' : intervallText(i)}</option>)}
          </Auswahl>
        </Feld>
        {f.intervall === 'tage' && <Feld label="Alle wie viele Tage?"><input className="bv-eingabe" type="number" inputMode="numeric" min={1} max={365} value={f.intervall_tage || ''} onChange={e => setF({ ...f, intervall_tage: Number(e.target.value) })} /></Feld>}
        <Abschnitt titel="Checkliste" rechts={f.punkte.length} />
        <PunkteEditor punkte={f.punkte} onChange={punkte => setF({ ...f, punkte })} neu={neuerPunkt} setNeu={setNeuerPunkt} />
      </fieldset>
      {!neu && (nutzer.gleich.length + nutzer.abweichend.length > 0) && <Hinweis>Genutzt von {nutzer.gleich.length + nutzer.abweichend.length} {nutzer.gleich.length + nutzer.abweichend.length === 1 ? 'Objekt' : 'Objekten'}{nutzer.abweichend.length ? `, davon ${nutzer.abweichend.length} von Hand angepasst` : ''}. Beim Speichern fragt Responda, ob die neue Liste übertragen wird.</Hinweis>}
      {gesendet && !d.busy && <Hinweis>Ob das gespeichert wurde, ist unklar. „Erneut senden“ schickt genau diesen Stand und legt nichts doppelt an.</Hinweis>}
      {!neu && <div className="bv-flaeche" style={{ marginTop: 16 }}>
        <button type="button" className={`bv-z ${alt!.archiviert ? 'aktion' : 'gefahr'}`} disabled={d.busy} onClick={archiv}>{alt!.archiviert ? 'Wieder in Gebrauch nehmen' : 'Archivieren'}</button>
      </div>}
      <div className="hy-leiste-luft" />
    </Seite>
  )
}

