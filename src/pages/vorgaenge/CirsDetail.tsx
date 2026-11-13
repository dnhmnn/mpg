// Eine CIRS-Meldung mit ihrer Bearbeitung: Phase, Meldung, Bewertung,
// Zuständigkeit und Frist, Maßnahmen, Verlauf. Als ganze Seite über der Liste,
// im Stil der Benutzerverwaltung (Bauplan Vorgänge, 3.9): dunkelroter Kopf mit
// Zurück, Flächen mit Zeilen, Status als Wort.
//
// Jeder Schritt wird sofort gespeichert, auf dem frisch gelesenen Stand
// (siehe speichern in CirsVerwaltung). Was der Melder geschrieben hat, ist
// hier nur zu lesen, auch seine eigenen Felder.

import { useEffect, useRef, useState } from 'react'
import {
  HAEUFIGKEITEN, KATEGORIEN, PHASEN, SCHWEREGRADE,
  bewertungSetzen, fallPrioritaet, fristSetzen, geltendeKategorie, gueltigerTag, inTagen,
  istAbgeschlossen, istUeberfaellig, kategorieText, massnahmeAbhaken, massnahmeHinzufuegen, massnahmeStreichen,
  notizHinzufuegen, offeneMassnahmen, phaseName, phaseSetzen, prioritaet, schwereText, tagText,
  zeitText, zustaendigSetzen,
  type Bearbeitung, type Bewertung, type CirsFall, type Haeufigkeit, type Person, type Phase, type Schritt, type Schwere,
} from '../../lib/cirs'
import AngabenAnsicht from '../../components/AngabenAnsicht'
import { Abschnitt, Feld, Hinweis, Leer, Notiz, Seite, VgIcon, WahlZeilen, Zeile } from './bausteine'
import { FristText, KastenHaken, phaseKlasse, prioText, type KernAnzeige } from './cirsTeile'

export type Bearbeiten = (schritt: (b: Bearbeitung, s: Schritt) => Bearbeitung) => Promise<boolean>

interface Props {
  fall: CirsFall
  personen: Person[]
  ich: Person | null
  heute: Date
  speichern: Bearbeiten
  beschaeftigt: boolean
  fehler: string
  onSchliessen: () => void
  onDrucken: (mitMelder: boolean) => void
  /** Bezeichnungen der Kernfelder nach der Einstellung und der eigenen Felder (Rückfall ohne Schnappschuss). */
  anzeige?: { kern: Record<string, KernAnzeige>; eigene: Record<string, string> }
}

function Angabe({ name, wert, leer = 'Nicht angegeben' }: { name: string; wert?: string; leer?: string }) {
  return (
    <div className="vg-angabe">
      <span>{name}</span>
      <p className={wert ? undefined : 'leer'}>{wert || leer}</p>
    </div>
  )
}

export default function CirsDetail({ fall, personen, ich, heute, speichern, beschaeftigt, fehler, onSchliessen, onDrucken, anzeige }: Props) {
  const { meldung: m, bearbeitung: b } = fall
  const zu = istAbgeschlossen(b.phase)
  const offene = offeneMassnahmen(b)
  const kern = (id: string, vorgabe: string): KernAnzeige => anzeige?.kern[id] ?? { label: vorgabe, sichtbar: true }

  // Abschließen braucht einen Vermerk: erst fragen, dann speichern
  const [schliessenAls, setSchliessenAls] = useState<Phase | null>(null)
  const [vermerk, setVermerk] = useState('')
  const [melderZeigen, setMelderZeigen] = useState(false)
  const [entwurf, setEntwurf] = useState<Bewertung>(b.bewertung)
  const [massnahme, setMassnahme] = useState({ text: '', verantwortlich: '', frist: '' })
  const [notiz, setNotiz] = useState('')
  // Zuständig: die Auswahl kurz stehen lassen, bevor sie gespeichert wird; mit
  // den Pfeiltasten wählt man sonst jede Person auf dem Weg dorthin mit aus
  const [zustaendigEntwurf, setZustaendigEntwurf] = useState(b.zustaendig?.id ?? '')
  useEffect(() => { setZustaendigEntwurf(b.zustaendig?.id ?? '') }, [fall.id, b.zustaendig?.id])
  const zuweisenUhr = useRef<number | undefined>(undefined)
  function zuweisen(id: string) {
    window.clearTimeout(zuweisenUhr.current)
    zuweisenUhr.current = undefined
    if (id === (b.zustaendig?.id ?? '')) return
    const p = personen.find((x) => x.id === id) ?? (b.zustaendig?.id === id ? b.zustaendig : null)
    speichern((x, s) => zustaendigSetzen(x, p, s))
  }
  function zustaendigWaehlen(id: string) {
    setZustaendigEntwurf(id)
    window.clearTimeout(zuweisenUhr.current)
    zuweisenUhr.current = window.setTimeout(() => zuweisen(id), 700)
  }
  // Wer die Meldung schließt, solange die Auswahl noch wartet, hat sie trotzdem getroffen
  const zuweisenRef = useRef(zuweisen)
  zuweisenRef.current = zuweisen
  const entwurfRef = useRef(zustaendigEntwurf)
  entwurfRef.current = zustaendigEntwurf
  useEffect(() => () => { if (zuweisenUhr.current !== undefined) zuweisenRef.current(entwurfRef.current) }, [])

  // Die Frist erst übernehmen, wenn sie fertig ist: beim Tippen in ein Datumsfeld
  // entstehen Zwischenstände (Jahr 0002), die sonst gespeichert würden
  const [fristEntwurf, setFristEntwurf] = useState(b.frist ?? '')
  useEffect(() => { setFristEntwurf(b.frist ?? '') }, [fall.id, b.frist])
  const fristGeaendert = fristEntwurf !== (b.frist ?? '')
  const fristTaugt = !fristEntwurf || gueltigerTag(fristEntwurf)
  function fristUebernehmen() {
    if (!fristGeaendert || !fristTaugt || beschaeftigt) return
    speichern((x, s) => fristSetzen(x, fristEntwurf || null, s))
  }

  const bewertungSchluessel = JSON.stringify(b.bewertung)
  useEffect(() => { setEntwurf(b.bewertung) }, [fall.id, bewertungSchluessel]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSchliessenAls(null); setVermerk(''); setMelderZeigen(false); setNotiz(''); setMassnahme({ text: '', verantwortlich: '', frist: '' }) }, [fall.id])

  const bewertungGeaendert = (entwurf.kategorie || undefined) !== (b.bewertung.kategorie || undefined)
    || (entwurf.schwere || undefined) !== (b.bewertung.schwere || undefined)
    || (entwurf.haeufigkeit || undefined) !== (b.bewertung.haeufigkeit || undefined)
  const gemeldeteSchwere = SCHWEREGRADE.find((x) => x.wert === m.schwere)?.wert
  const entwurfPrio = prioritaet(entwurf.schwere || gemeldeteSchwere, entwurf.haeufigkeit)

  async function phaseWaehlen(p: Phase) {
    if (p === b.phase || beschaeftigt) { setSchliessenAls(null); return }
    if (istAbgeschlossen(p)) { setSchliessenAls(p); return }
    setSchliessenAls(null)
    await speichern((x, s) => phaseSetzen(x, p, s))
  }

  async function abschliessen() {
    if (!schliessenAls || !vermerk.trim() || beschaeftigt) return
    if (offene.length && schliessenAls === 'abgeschlossen'
      && !window.confirm(`${offene.length} Maßnahme${offene.length === 1 ? ' ist' : 'n sind'} noch offen. Trotzdem abschließen?`)) return
    const ok = await speichern((x, s) => phaseSetzen(x, schliessenAls, s, vermerk))
    if (ok) { setSchliessenAls(null); setVermerk('') }
  }

  async function massnahmeAnlegen() {
    if (!massnahme.text.trim() || beschaeftigt) return
    if (massnahme.frist && !gueltigerTag(massnahme.frist)) return
    const ok = await speichern((x, s) => massnahmeHinzufuegen(x, massnahme, s))
    if (ok) setMassnahme({ text: '', verantwortlich: '', frist: '' })
  }

  async function notizAnlegen() {
    if (!notiz.trim() || beschaeftigt) return
    const ok = await speichern((x, s) => notizHinzufuegen(x, notiz, s))
    if (ok) setNotiz('')
  }

  function drucken() {
    const melderDa = !!(m.melder_name || m.melder_kontakt)
    onDrucken(melderDa && window.confirm('Name und Kontakt des Melders mitdrucken?\n\nOhne bleibt der Ausdruck anonym.'))
  }

  const verlauf = [...b.verlauf].reverse()
  const ueberfaellig = istUeberfaellig(fall, heute)
  const prio = fallPrioritaet(fall)
  const unterTitel = [phaseName(b.phase), prioText(prio), ueberfaellig ? 'überfällig' : ''].filter(Boolean).join(' · ')

  // Ein Dialog: Fokus auf Zurück, Escape schließt, Tab bleibt im Dialog
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => { dialog.current?.querySelector<HTMLButtonElement>('.bv-kopf button')?.focus() }, [fall.id])
  useEffect(() => { dialog.current?.scrollTo?.(0, 0) }, [fall.id])
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && dialog.current) {
        const ziele = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]')]
        if (!ziele.length) return
        const erstes = ziele[0], letztes = ziele[ziele.length - 1]
        const drin = dialog.current.contains(document.activeElement)
        if (e.shiftKey && (document.activeElement === erstes || !drin)) { e.preventDefault(); letztes.focus() }
        else if (!e.shiftKey && (document.activeElement === letztes || !drin)) { e.preventDefault(); erstes.focus() }
        return
      }
      if (e.key !== 'Escape') return
      if (schliessenAls) setSchliessenAls(null)
      else onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen, schliessenAls])

  const kurzeAngaben = [
    { id: 'datum', vorgabe: 'Ereignis am', wert: tagText(m.datum) },
    { id: 'ort', vorgabe: 'Ort', wert: m.ort },
    { id: 'kategorie', vorgabe: 'Kategorie', wert: m.kategorie ? kategorieText(m.kategorie) : '' },
    { id: 'schwere', vorgabe: 'Schweregrad', wert: m.schwere ? schwereText(m.schwere) : '' },
  ].map((x) => ({ ...x, k: kern(x.id, x.vorgabe) }))
    // Ausgeblendete Felder nur, wenn die Meldung trotzdem einen Wert hat (vor dem Ausblenden gemeldet)
    .filter((x) => x.wert || x.k.sichtbar)
  const texte = [
    { id: 'was', vorgabe: 'Was ist passiert?', wert: m.was },
    { id: 'warum', vorgabe: 'Warum ist es passiert?', wert: m.warum },
    { id: 'folgen', vorgabe: 'Folgen', wert: m.folgen },
    { id: 'vorschlag', vorgabe: 'Vorschlag zur Vermeidung', wert: m.vorschlag },
  ].filter((x) => x.wert)

  const druckKnopf = (
    <button type="button" className="bv-rund hell" aria-label="Drucken" title="Drucken" onClick={drucken}>
      <VgIcon n="drucken" />
    </button>
  )

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={`CIRS-Meldung ${fall.nummer}`} className="ein-overlay">
      <Seite titel={fall.nummer} unter={`Eingegangen ${zeitText(fall.eingang)}`} zurueck={onSchliessen} zurueckLabel="Zurück zur Liste" rechts={druckKnopf}>
        {fehler ? <div role="alert" className="ein-meldung fehler"><span>{fehler}</span></div> : null}

        <div className="bv-flaeche">
          <Zeile
            titel={`${kategorieText(geltendeKategorie(fall))}${m.ort ? ` · ${m.ort}` : ''}`}
            unter={unterTitel}
            rechts={beschaeftigt ? <span className="vg-rechts">Speichert…</span> : undefined}
          />
        </div>

        {/* Phase */}
        <Abschnitt titel="Phase" />
        <WahlZeilen<Phase>
          label="Phase" wert={schliessenAls ?? b.phase} disabled={beschaeftigt}
          optionen={PHASEN.map((p) => ({ wert: p.wert, titel: p.name }))}
          onWahl={(p) => { void phaseWaehlen(p) }}
        />
        {schliessenAls ? (
          <div className="bv-flaeche vg-abstand">
            <div className="ein-innen">
              <Feld label={schliessenAls === 'abgeschlossen' ? 'Ergebnis: Was wurde gelernt oder geändert?' : 'Warum besteht kein Handlungsbedarf?'} erst
                hinweis={schliessenAls === 'abgeschlossen' && offene.length > 0 ? `${offene.length} Maßnahme${offene.length === 1 ? ' ist' : 'n sind'} noch offen.` : undefined}>
                <textarea className="bv-eingabe" value={vermerk} onChange={(e) => setVermerk(e.target.value)} rows={3} autoFocus
                  placeholder={schliessenAls === 'abgeschlossen' ? 'z. B. Checkliste ergänzt, Team in der Dienstbesprechung informiert' : 'z. B. Einzelfall, bereits geregelt durch …'} />
              </Feld>
              <div className="ein-knoepfe">
                <button type="button" className="bv-knopf" onClick={() => setSchliessenAls(null)}>Abbrechen</button>
                <button type="button" className="bv-knopf voll weit" onClick={() => { void abschliessen() }} disabled={!vermerk.trim() || beschaeftigt}>
                  {phaseName(schliessenAls)}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {zu && b.abschluss && !schliessenAls ? (
          <div className="vg-abstand">
            <Notiz titel="Ergebnis">
              <p className="ein-ergebnis">{b.abschluss.text}</p>
              <p>{zeitText(b.abschluss.am)}{b.abschluss.von ? ` · ${b.abschluss.von}` : ''}</p>
            </Notiz>
          </div>
        ) : null}

        {/* Meldung */}
        <Abschnitt titel="Meldung" rechts="wie gemeldet" />
        <div className="bv-flaeche">
          {kurzeAngaben.map((x) => <Angabe key={x.id} name={x.k.label} wert={x.wert} />)}
          {texte.map((x) => <Angabe key={x.id} name={kern(x.id, x.vorgabe).label} wert={x.wert} />)}
          {(m.melder_name || m.melder_kontakt) ? (
            melderZeigen ? (
              <>
                <Angabe name="Melder" wert={m.melder_name} />
                <Angabe name="Kontakt" wert={m.melder_kontakt} />
                <Zeile titel="Angaben zum Melder verbergen" art="akzent" onClick={() => setMelderZeigen(false)} />
              </>
            ) : (
              <Zeile titel="Angaben zum Melder anzeigen" unter="Der Melder hat Namen oder Kontakt angegeben." art="akzent" onClick={() => setMelderZeigen(true)} />
            )
          ) : null}
        </div>
        {fall.eigene ? (
          <>
            <h3 className="bv-gruppe">Weitere Angaben</h3>
            <AngabenAnsicht angaben={fall.eigene} bezeichnung={anzeige?.eigene} nurAusgefuellt aelterTitel="Aus einer früheren Fassung des Formulars" />
          </>
        ) : null}

        {/* Bewertung */}
        <Abschnitt titel="Bewertung" rechts={prioText(entwurfPrio) || undefined} />
        <div className="bv-flaeche">
          <div className="ein-innen">
            <div className="ein-raster" style={{ marginTop: -12 }}>
              <Feld label="Kategorie">
                <div className="bv-auswahl">
                  <select className="bv-eingabe" value={entwurf.kategorie ?? ''} onChange={(e) => setEntwurf((x) => ({ ...x, kategorie: e.target.value || undefined }))}>
                    <option value="">{`Wie gemeldet (${kategorieText(m.kategorie)})`}</option>
                    {KATEGORIEN.map((k) => <option key={k.wert} value={k.wert}>{k.name}</option>)}
                  </select>
                  <VgIcon n="runter" className="bv-klein" />
                </div>
              </Feld>
              <Feld label="Schweregrad">
                <div className="bv-auswahl">
                  <select className="bv-eingabe" value={entwurf.schwere ?? ''} onChange={(e) => setEntwurf((x) => ({ ...x, schwere: (e.target.value || undefined) as Schwere | undefined }))}>
                    <option value="">{`Wie gemeldet (${schwereText(m.schwere)})`}</option>
                    {SCHWEREGRADE.map((s) => <option key={s.wert} value={s.wert}>{`${s.name}, ${s.lang}`}</option>)}
                  </select>
                  <VgIcon n="runter" className="bv-klein" />
                </div>
              </Feld>
              <Feld label="Häufigkeit">
                <div className="bv-auswahl">
                  <select className="bv-eingabe" value={entwurf.haeufigkeit ?? ''} onChange={(e) => setEntwurf((x) => ({ ...x, haeufigkeit: (e.target.value || undefined) as Haeufigkeit | undefined }))}>
                    <option value="">Nicht eingeschätzt</option>
                    {HAEUFIGKEITEN.map((h) => <option key={h.wert} value={h.wert}>{h.name}</option>)}
                  </select>
                  <VgIcon n="runter" className="bv-klein" />
                </div>
              </Feld>
            </div>
            {bewertungGeaendert ? (
              <div className="ein-knoepfe">
                <button type="button" className="bv-knopf" onClick={() => setEntwurf(b.bewertung)}>Verwerfen</button>
                <button type="button" className="bv-knopf voll weit" onClick={() => speichern((x, s) => bewertungSetzen(x, entwurf, s))} disabled={beschaeftigt}>Bewertung übernehmen</button>
              </div>
            ) : null}
          </div>
        </div>
        <Hinweis>Die Priorität ergibt sich aus Schweregrad und Häufigkeit. Die Angaben des Melders bleiben daneben erhalten.</Hinweis>

        {/* Zuständigkeit und Frist */}
        <Abschnitt titel="Zuständigkeit und Frist" />
        <div className="bv-flaeche">
          <div className="ein-innen">
            <Feld label="Zuständig" erst>
              <div className="bv-auswahl">
                <select className="bv-eingabe" id="cirs-zustaendig" value={zustaendigEntwurf}
                  onChange={(e) => zustaendigWaehlen(e.target.value)}
                  onBlur={() => { if (zuweisenUhr.current !== undefined) zuweisen(zustaendigEntwurf) }}>
                  <option value="">Niemand</option>
                  {b.zustaendig && !personen.some((p) => p.id === b.zustaendig!.id) && <option value={b.zustaendig.id}>{b.zustaendig.name}</option>}
                  {personen.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <VgIcon n="runter" className="bv-klein" />
              </div>
            </Feld>
            {ich && b.zustaendig?.id !== ich.id ? (
              <button type="button" className="vg-textknopf" disabled={beschaeftigt}
                onClick={() => { window.clearTimeout(zuweisenUhr.current); zuweisenUhr.current = undefined; speichern((x, s) => zustaendigSetzen(x, ich, s)) }}>
                Mir zuweisen
              </button>
            ) : null}
          </div>
          <div className="ein-innen">
            <Feld label="Frist" erst fehler={fristTaugt ? undefined : 'Kein gültiger Tag.'}
              hinweis={b.frist ? <FristText frist={b.frist} heute={heute} zu={zu} /> : undefined}>
              <div className="bv-reihe">
                <input className={`bv-eingabe${fristTaugt ? '' : ' fehler'}`} id="cirs-frist" type="date" value={fristEntwurf} disabled={beschaeftigt}
                  onChange={(e) => setFristEntwurf(e.target.value)} onBlur={fristUebernehmen}
                  onKeyDown={(e) => { if (e.key === 'Enter') fristUebernehmen() }} />
                {fristGeaendert ? (
                  <button type="button" className="bv-knopf" onMouseDown={(e) => e.preventDefault()} onClick={fristUebernehmen} disabled={!fristTaugt || beschaeftigt}>Übernehmen</button>
                ) : null}
              </div>
            </Feld>
            <div className="ein-knoepfe">
              {[7, 14, 30].map((t) => (
                <button key={t} type="button" className="bv-knopf" onClick={() => speichern((x, s) => fristSetzen(x, inTagen(heute, t), s))} disabled={beschaeftigt}>{`In ${t} Tagen`}</button>
              ))}
              {b.frist ? <button type="button" className="bv-knopf" onClick={() => speichern((x, s) => fristSetzen(x, null, s))} disabled={beschaeftigt}>Keine Frist</button> : null}
            </div>
          </div>
        </div>

        {/* Maßnahmen */}
        <Abschnitt titel="Maßnahmen" rechts={b.massnahmen.length ? `${b.massnahmen.length - offene.length} von ${b.massnahmen.length} erledigt` : undefined} />
        <div className="bv-flaeche">
          {b.massnahmen.length === 0 ? <Leer>Noch keine Maßnahmen.</Leer> : null}
          {b.massnahmen.map((x) => {
            const erledigt = !!x.erledigtAm
            const unter = [
              x.verantwortlich,
              x.frist ? <span key="f">Frist <FristText frist={x.frist} heute={heute} zu={erledigt || zu} /></span> : null,
              erledigt ? `erledigt ${zeitText(x.erledigtAm)}${x.erledigtVon ? `, ${x.erledigtVon}` : ''}` : null,
            ].filter(Boolean)
            return (
              <div key={x.id} className="bv-z">
                <button type="button" role="checkbox" aria-checked={erledigt} className="ein-haken" disabled={beschaeftigt}
                  aria-label={`${erledigt ? 'Wieder öffnen' : 'Erledigt'}: ${x.text}`} title={erledigt ? 'Als offen markieren' : 'Als erledigt abhaken'}
                  onClick={() => speichern((y, s) => massnahmeAbhaken(y, x.id, !erledigt, s))}>
                  <span className="bv-kasten"><KastenHaken /></span>
                </button>
                <span className="bv-tx">
                  <b className={`ein-lang${erledigt ? ' ein-durch' : ''}`}>{x.text}</b>
                  {unter.length ? <small>{unter.map((u, i) => <span key={i}>{i ? ' · ' : ''}{u}</span>)}</small> : null}
                </span>
                {!erledigt ? (
                  <button type="button" className="ein-klein" disabled={beschaeftigt} aria-label={`Streichen: ${x.text}`}
                    onClick={() => { if (window.confirm(`Maßnahme „${x.text}“ streichen?`)) speichern((y, s) => massnahmeStreichen(y, x.id, s)) }}>
                    <VgIcon n="kreuz" className="bv-klein" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="bv-flaeche vg-abstand">
          <div className="ein-innen">
            <Feld label="Neue Maßnahme" erst>
              <input className="bv-eingabe" value={massnahme.text} onChange={(e) => setMassnahme((x) => ({ ...x, text: e.target.value }))} disabled={beschaeftigt}
                onKeyDown={(e) => { if (e.key === 'Enter') void massnahmeAnlegen() }}
                placeholder="z. B. Checkliste um O2-Druck ergänzen" />
            </Feld>
            <div className="ein-raster">
              <Feld label="Verantwortlich" zusatz="freiwillig">
                <input className="bv-eingabe" value={massnahme.verantwortlich} onChange={(e) => setMassnahme((x) => ({ ...x, verantwortlich: e.target.value }))} list="cirs-personen" />
              </Feld>
              <Feld label="Frist der Maßnahme" zusatz="freiwillig">
                <input className="bv-eingabe" type="date" value={massnahme.frist} onChange={(e) => setMassnahme((x) => ({ ...x, frist: e.target.value }))} />
              </Feld>
            </div>
            <datalist id="cirs-personen">{personen.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            <div className="ein-knoepfe">
              <button type="button" className="bv-knopf voll weit" onClick={() => { void massnahmeAnlegen() }} disabled={!massnahme.text.trim() || beschaeftigt}>Maßnahme anlegen</button>
            </div>
          </div>
        </div>

        {/* Verlauf */}
        <Abschnitt titel="Verlauf" />
        <div className="bv-flaeche">
          <div className="ein-innen">
            <Feld label="Notiz für den Verlauf" erst>
              <textarea className="bv-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} placeholder="z. B. Rücksprache mit der Wachleitung" />
            </Feld>
            <div className="ein-knoepfe">
              <button type="button" className="bv-knopf voll" onClick={() => { void notizAnlegen() }} disabled={!notiz.trim() || beschaeftigt}>Notieren</button>
            </div>
          </div>
        </div>
        <div className="bv-flaeche vg-abstand">
          {verlauf.length === 0 ? <Leer>Noch nichts bearbeitet.</Leer> : null}
          {verlauf.map((e) => (
            <div key={e.id} className="bv-z">
              <span className="bv-tx">
                <b className={`ein-lang${e.art === 'notiz' ? ' ein-normal' : ''}`}>{e.text}</b>
                <small>{zeitText(e.am)}{e.von ? ` · ${e.von}` : ''}</small>
              </span>
              {e.art === 'abschluss' ? <span className={phaseKlasse('abgeschlossen')}>Ergebnis</span> : null}
            </div>
          ))}
        </div>
      </Seite>
    </div>
  )
}
