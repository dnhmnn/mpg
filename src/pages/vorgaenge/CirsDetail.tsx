// Eine CIRS-Meldung mit ihrer Bearbeitung: Phase, Meldung, Bewertung,
// Zuständigkeit und Frist, Maßnahmen, Verlauf.
//
// Jeder Schritt wird sofort gespeichert — auf dem frisch gelesenen Stand
// (siehe speichern in CirsVerwaltung). Was der Melder geschrieben hat, ist
// hier nur zu lesen.

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  HAEUFIGKEITEN, KATEGORIEN, PHASEN, SCHWEREGRADE,
  bewertungSetzen, fallPrioritaet, fristSetzen, fristUeberschritten, geltendeKategorie, gueltigerTag, inTagen,
  istAbgeschlossen, istUeberfaellig, kategorieName, massnahmeAbhaken, massnahmeHinzufuegen, massnahmeStreichen,
  notizHinzufuegen, offeneMassnahmen, phaseName, phaseSetzen, prioritaet, schwereName, tagText, tageBisFrist,
  zeitText, zustaendigSetzen,
  type Bearbeitung, type Bewertung, type CirsFall, type Haeufigkeit, type Person, type Phase, type Schritt, type Schwere,
  type VerlaufArt,
} from '../../lib/cirs'
import {
  Marke, PhaseMarke, PrioMarke, SCHRIFT, abschnittKopf, eingabe, feldName, karte, knopfLeise, knopfRand, knopfVollWenn, pik,
} from './cirsTeile'

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
}

const VERLAUF_ZEICHEN: Record<VerlaufArt, React.ReactNode> = {
  phase: <><polyline points="9 18 15 12 9 6" /></>,
  zustaendig: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 16 0v1" /></>,
  frist: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  bewertung: <><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></>,
  massnahme: <><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  notiz: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  abschluss: <><polyline points="20 6 9 17 4 12" /></>,
}

function Abschnitt({ titel, rechts, children }: { titel: string; rechts?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={abschnittKopf}>{titel}</div>
        {rechts}
      </div>
      <div style={{ ...karte, padding: '14px 16px' }}>{children}</div>
    </section>
  )
}

function Angabe({ name, wert }: { name: string; wert?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={feldName}>{name}</div>
      <div style={{ fontSize: 14, color: wert ? 'var(--lbf-text)' : 'var(--warm-gray)', marginTop: 2, overflowWrap: 'anywhere' }}>{wert || '—'}</div>
    </div>
  )
}

function Absatz({ name, wert }: { name: string; wert?: string }) {
  if (!wert) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={feldName}>{name}</div>
      <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginTop: 3, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{wert}</div>
    </div>
  )
}

function FristText({ frist, heute, zu }: { frist: string; heute: Date; zu: boolean }) {
  const tage = tageBisFrist(frist, heute)
  const ueber = !zu && fristUeberschritten(frist, heute)
  const rest = zu || tage === null ? '' : tage === 0 ? ' · heute fällig' : tage > 0 ? ` · in ${tage} Tag${tage === 1 ? '' : 'en'}` : ` · seit ${-tage} Tag${tage === -1 ? '' : 'en'} überfällig`
  return <span style={{ color: ueber ? 'var(--lbf-fehler-text-2)' : 'inherit', fontWeight: ueber ? 700 : 'inherit' }}>{tagText(frist)}{rest}</span>
}

export default function CirsDetail({ fall, personen, ich, heute, speichern, beschaeftigt, fehler, onSchliessen, onDrucken }: Props) {
  const { meldung: m, bearbeitung: b } = fall
  const zu = istAbgeschlossen(b.phase)
  const offene = offeneMassnahmen(b)

  // Abschließen braucht einen Vermerk — erst fragen, dann speichern
  const [schliessenAls, setSchliessenAls] = useState<Phase | null>(null)
  const [vermerk, setVermerk] = useState('')
  const [melderZeigen, setMelderZeigen] = useState(false)
  const [entwurf, setEntwurf] = useState<Bewertung>(b.bewertung)
  const [massnahme, setMassnahme] = useState({ text: '', verantwortlich: '', frist: '' })
  const [notiz, setNotiz] = useState('')
  // Zuständig: die Auswahl kurz stehen lassen, bevor sie gespeichert wird — mit
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
    if (p === b.phase || beschaeftigt) return
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

  // Ein Dialog: Fokus auf "Zurück", Escape schließt, Tab bleibt im Dialog
  const zurueckKnopf = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => { zurueckKnopf.current?.focus() }, [fall.id])
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

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cirs-detail-titel"
      style={{ position: 'fixed', inset: 0, background: 'var(--warm-bg)', zIndex: 300, overflowY: 'auto', fontFamily: SCHRIFT }}>
      {/* Kopf */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button ref={zurueckKnopf} onClick={onSchliessen} aria-label="Zurück zur Liste" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--lbf-akzent)', display: 'flex' }}>
          {pik(<polyline points="15 18 9 12 15 6" />)}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="cirs-detail-titel" style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fall.nummer}</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>Eingegangen {zeitText(fall.eingang)}</div>
        </div>
        {beschaeftigt && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Speichern…</div>}
        <button onClick={drucken} style={{ ...knopfRand, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}>
          {pik(<><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>, 15)}
          Drucken
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px calc(40px + env(safe-area-inset-bottom))' }}>
        {fehler && (
          <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', color: 'var(--lbf-fehler-text)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{fehler}</div>
        )}

        {/* Titelzeile */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', lineHeight: 1.25 }}>
            {kategorieName(geltendeKategorie(fall))}{m.ort ? ` · ${m.ort}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <PhaseMarke phase={b.phase} />
            <PrioMarke prio={fallPrioritaet(fall)} />
            {istUeberfaellig(fall, heute) && <Marke grund="var(--lbf-fehler-grund)" schrift="var(--lbf-fehler-text)">Überfällig</Marke>}
          </div>
        </div>

        {/* Phase */}
        <Abschnitt titel="Phase">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PHASEN.map((p) => {
              const aktiv = p.wert === b.phase
              return (
                <button key={p.wert} onClick={() => phaseWaehlen(p.wert)} disabled={beschaeftigt} aria-pressed={aktiv}
                  style={{
                    padding: '8px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: aktiv ? 'default' : 'pointer',
                    border: aktiv ? '1px solid transparent' : '1px solid rgba(var(--lbf-rot-rgb),0.18)',
                    background: aktiv ? 'var(--lbf-akzent-grund)' : 'none', color: aktiv ? '#fff' : 'var(--lbf-akzent)',
                  }}>{p.name}</button>
              )
            })}
          </div>
          {schliessenAls && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={feldName}>{schliessenAls === 'abgeschlossen' ? 'Ergebnis — was wurde gelernt oder geändert?' : 'Warum besteht kein Handlungsbedarf?'}</span>
                <textarea value={vermerk} onChange={(e) => setVermerk(e.target.value)} rows={3} autoFocus
                  placeholder={schliessenAls === 'abgeschlossen' ? 'z.B. Checkliste ergänzt, Team in der Dienstbesprechung informiert' : 'z.B. Einzelfall, bereits geregelt durch …'}
                  style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
              </label>
              {schliessenAls === 'abgeschlossen' && offene.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--lbf-warn-text)', marginTop: 6 }}>
                  {offene.length} Maßnahme{offene.length === 1 ? ' ist' : 'n sind'} noch offen.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setSchliessenAls(null)} style={knopfRand}>Abbrechen</button>
                <button onClick={abschliessen} disabled={!vermerk.trim() || beschaeftigt}
                  style={{ ...knopfVollWenn(!!vermerk.trim() && !beschaeftigt), flex: 1 }}>
                  {phaseName(schliessenAls)}
                </button>
              </div>
            </div>
          )}
          {zu && b.abschluss && !schliessenAls && (
            <div style={{ marginTop: 14, borderLeft: '3px solid #16a34a', background: 'var(--lbf-ok-grund)', borderRadius: '0 8px 8px 0', padding: '10px 12px' }}>
              <div style={{ ...feldName, color: 'var(--lbf-ok-text)' }}>Ergebnis</div>
              <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginTop: 3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{b.abschluss.text}</div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>{zeitText(b.abschluss.am)}{b.abschluss.von ? ` · ${b.abschluss.von}` : ''}</div>
            </div>
          )}
        </Abschnitt>

        {/* Meldung */}
        <Abschnitt titel="Meldung" rechts={<span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>wie gemeldet</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            <Angabe name="Ereignis am" wert={tagText(m.datum)} />
            <Angabe name="Ort" wert={m.ort} />
            <Angabe name="Kategorie" wert={m.kategorie ? kategorieName(m.kategorie) : undefined} />
            <Angabe name="Schweregrad" wert={m.schwere ? schwereName(m.schwere) : undefined} />
          </div>
          <Absatz name="Was ist passiert?" wert={m.was} />
          <Absatz name="Warum ist es passiert?" wert={m.warum} />
          <Absatz name="Folgen" wert={m.folgen} />
          <Absatz name="Vorschlag zur Vermeidung" wert={m.vorschlag} />
          {(m.melder_name || m.melder_kontakt) && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--lbf-border-light)' }}>
              {melderZeigen ? (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Angabe name="Melder" wert={m.melder_name} />
                  <Angabe name="Kontakt" wert={m.melder_kontakt} />
                  <button onClick={() => setMelderZeigen(false)} style={knopfLeise}>Verbergen</button>
                </div>
              ) : (
                <button onClick={() => setMelderZeigen(true)} style={knopfLeise}>Melder hat Namen oder Kontakt angegeben — anzeigen</button>
              )}
            </div>
          )}
        </Abschnitt>

        {/* Bewertung */}
        <Abschnitt titel="Bewertung" rechts={<PrioMarke prio={entwurfPrio} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={feldName}>Kategorie</span>
              <select value={entwurf.kategorie ?? ''} onChange={(e) => setEntwurf((x) => ({ ...x, kategorie: e.target.value || undefined }))} style={eingabe}>
                <option value="">Wie gemeldet ({kategorieName(m.kategorie)})</option>
                {KATEGORIEN.map((k) => <option key={k.wert} value={k.wert}>{k.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={feldName}>Schweregrad</span>
              <select value={entwurf.schwere ?? ''} onChange={(e) => setEntwurf((x) => ({ ...x, schwere: (e.target.value || undefined) as Schwere | undefined }))} style={eingabe}>
                <option value="">Wie gemeldet ({schwereName(m.schwere)})</option>
                {SCHWEREGRADE.map((s) => <option key={s.wert} value={s.wert}>{s.name} — {s.lang}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={feldName}>Häufigkeit</span>
              <select value={entwurf.haeufigkeit ?? ''} onChange={(e) => setEntwurf((x) => ({ ...x, haeufigkeit: (e.target.value || undefined) as Haeufigkeit | undefined }))} style={eingabe}>
                <option value="">Nicht eingeschätzt</option>
                {HAEUFIGKEITEN.map((h) => <option key={h.wert} value={h.wert}>{h.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 10, lineHeight: 1.5 }}>
            Die Priorität ergibt sich aus Schweregrad und Häufigkeit. Die Angaben des Melders bleiben daneben erhalten.
          </div>
          {bewertungGeaendert && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setEntwurf(b.bewertung)} style={knopfRand}>Verwerfen</button>
              <button onClick={() => speichern((x, s) => bewertungSetzen(x, entwurf, s))} disabled={beschaeftigt} style={{ ...knopfVollWenn(!beschaeftigt), flex: 1 }}>Bewertung übernehmen</button>
            </div>
          )}
        </Abschnitt>

        {/* Zuständigkeit und Frist */}
        <Abschnitt titel="Zuständigkeit und Frist">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="cirs-zustaendig" style={feldName}>Zuständig</label>
              <select id="cirs-zustaendig" value={zustaendigEntwurf}
                onChange={(e) => zustaendigWaehlen(e.target.value)}
                onBlur={() => { if (zuweisenUhr.current !== undefined) zuweisen(zustaendigEntwurf) }} style={eingabe}>
                <option value="">Niemand</option>
                {b.zustaendig && !personen.some((p) => p.id === b.zustaendig!.id) && <option value={b.zustaendig.id}>{b.zustaendig.name}</option>}
                {personen.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {ich && b.zustaendig?.id !== ich.id && (
                <button onClick={() => { window.clearTimeout(zuweisenUhr.current); zuweisenUhr.current = undefined; speichern((x, s) => zustaendigSetzen(x, ich, s)) }} disabled={beschaeftigt} style={{ ...knopfLeise, alignSelf: 'flex-start' }}>Mir zuweisen</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="cirs-frist" style={feldName}>Frist</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="cirs-frist" type="date" value={fristEntwurf} disabled={beschaeftigt}
                  onChange={(e) => setFristEntwurf(e.target.value)} onBlur={fristUebernehmen}
                  onKeyDown={(e) => { if (e.key === 'Enter') fristUebernehmen() }}
                  style={{ ...eingabe, flex: 1, width: 'auto', borderColor: fristTaugt ? undefined : 'var(--lbf-fehler-text-2)' }} />
                {fristGeaendert && (
                  <button onMouseDown={(e) => e.preventDefault()} onClick={fristUebernehmen} disabled={!fristTaugt || beschaeftigt}
                    style={{ ...knopfVollWenn(fristTaugt && !beschaeftigt), padding: '8px 12px' }}>Übernehmen</button>
                )}
              </div>
              {!fristTaugt && <div style={{ fontSize: 12, color: 'var(--lbf-fehler-text-2)' }}>Kein gültiger Tag.</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[7, 14, 30].map((t) => (
                  <button key={t} onClick={() => speichern((x, s) => fristSetzen(x, inTagen(heute, t), s))} disabled={beschaeftigt} style={knopfLeise}>+{t} Tage</button>
                ))}
                {b.frist && <button onClick={() => speichern((x, s) => fristSetzen(x, null, s))} disabled={beschaeftigt} style={{ ...knopfLeise, color: 'var(--warm-gray)', background: 'none' }}>Keine</button>}
              </div>
              {b.frist && <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}><FristText frist={b.frist} heute={heute} zu={zu} /></div>}
            </div>
          </div>
        </Abschnitt>

        {/* Maßnahmen */}
        <Abschnitt titel="Maßnahmen" rechts={b.massnahmen.length ? <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{b.massnahmen.length - offene.length} von {b.massnahmen.length} erledigt</span> : undefined}>
          {b.massnahmen.length === 0 && <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 12 }}>Noch keine Maßnahmen.</div>}
          {b.massnahmen.map((x) => {
            const erledigt = !!x.erledigtAm
            return (
              <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '0.5px solid var(--lbf-border-light)' }}>
                <button onClick={() => speichern((y, s) => massnahmeAbhaken(y, x.id, !erledigt, s))} disabled={beschaeftigt}
                  aria-label={`${erledigt ? 'Wieder öffnen' : 'Erledigt'}: ${x.text}`} title={erledigt ? 'Als offen markieren' : 'Als erledigt abhaken'} aria-pressed={erledigt}
                  style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                    border: erledigt ? 'none' : '1.5px solid rgba(var(--lbf-rot-rgb),0.3)', background: erledigt ? '#16a34a' : 'none', color: '#fff' }}>
                  {erledigt && pik(<polyline points="20 6 9 17 4 12" />, 14)}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: erledigt ? 'var(--warm-gray)' : 'var(--lbf-text)', textDecoration: erledigt ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{x.text}</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>
                    {x.verantwortlich}
                    {x.frist && <>{x.verantwortlich ? ' · ' : ''}Frist <FristText frist={x.frist} heute={heute} zu={erledigt || zu} /></>}
                    {erledigt && <>{x.verantwortlich || x.frist ? ' · ' : ''}erledigt {zeitText(x.erledigtAm)}{x.erledigtVon ? `, ${x.erledigtVon}` : ''}</>}
                  </div>
                </div>
                {!erledigt && (
                  <button onClick={() => { if (window.confirm(`Maßnahme „${x.text}" streichen?`)) speichern((y, s) => massnahmeStreichen(y, x.id, s)) }}
                    disabled={beschaeftigt} aria-label={`Streichen: ${x.text}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}>
                    {pik(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>, 15)}
                  </button>
                )}
              </div>
            )
          })}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <input value={massnahme.text} onChange={(e) => setMassnahme((x) => ({ ...x, text: e.target.value }))} disabled={beschaeftigt}
              onKeyDown={(e) => { if (e.key === 'Enter') massnahmeAnlegen() }}
              placeholder="Neue Maßnahme, z.B. Checkliste um O2-Druck ergänzen" style={eingabe} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={massnahme.verantwortlich} onChange={(e) => setMassnahme((x) => ({ ...x, verantwortlich: e.target.value }))}
                placeholder="Verantwortlich" list="cirs-personen" style={{ ...eingabe, flex: '2 1 160px', width: 'auto' }} />
              <input type="date" value={massnahme.frist} onChange={(e) => setMassnahme((x) => ({ ...x, frist: e.target.value }))}
                aria-label="Frist der Maßnahme" style={{ ...eingabe, flex: '1 1 140px', width: 'auto' }} />
              <button onClick={massnahmeAnlegen} disabled={!massnahme.text.trim() || beschaeftigt}
                style={{ ...knopfVollWenn(!!massnahme.text.trim() && !beschaeftigt), flex: '1 1 110px' }}>Anlegen</button>
            </div>
            <datalist id="cirs-personen">{personen.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </div>
        </Abschnitt>

        {/* Verlauf */}
        <Abschnitt titel="Verlauf">
          <div style={{ display: 'flex', gap: 8, marginBottom: verlauf.length ? 14 : 0 }}>
            <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} placeholder="Notiz für den Verlauf, z.B. Rücksprache mit der Wachleitung"
              style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5, flex: 1 }} />
            <button onClick={notizAnlegen} disabled={!notiz.trim() || beschaeftigt}
              style={{ ...knopfVollWenn(!!notiz.trim() && !beschaeftigt), alignSelf: 'flex-end' }}>Notieren</button>
          </div>
          {verlauf.length === 0 && <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 12 }}>Noch nichts bearbeitet.</div>}
          {verlauf.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '0.5px solid var(--lbf-border-light)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: e.art === 'abschluss' ? 'var(--lbf-ok-grund)' : 'rgba(var(--lbf-rot-rgb),0.07)', color: e.art === 'abschluss' ? 'var(--lbf-ok-text)' : 'var(--lbf-akzent)' }}>
                {pik(VERLAUF_ZEICHEN[e.art] ?? VERLAUF_ZEICHEN.notiz, 13)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--lbf-text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontWeight: e.art === 'notiz' ? 400 : 600 }}>{e.text}</div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 1 }}>{zeitText(e.am)} · {e.von}</div>
              </div>
            </div>
          ))}
        </Abschnitt>
      </div>
    </div>
  )
}
