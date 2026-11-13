// Vorschau eines Formulars (Bauplan Vorgänge 3.6, 3.7): `?seite=vorschau&id=<formular>` für ein
// Standardformular, `?seite=vorschau&id=vorlage:<id|neu>` für ein eigenes Formular (aus dem
// Entwurf, auch ungespeichert).
//
// Das Formular erscheint mit den Darstellungsteilen der öffentlichen Seiten (FeldEingabe,
// FormularInhalt) in seiner Reihenfolge. Kernblöcke, die hier nicht bedienbar sind
// (Positionen, Verbrauchsort, Gerät, Schweregrad), stehen als ruhige Platzhalter da, der
// Absender als Beispiel. Eingeben lässt sich alles, gesendet wird nichts; „Eingaben prüfen“
// zeigt, was beim Senden fehlen würde.

import { useState } from 'react'
import { KATEGORIEN, SCHWEREGRADE } from '../../../lib/cirs'
import { absenderModus } from '../../../lib/formular/absender'
import { ABSENDER_WAHL } from '../../../lib/formular/verwaltung'
import { bausteine, pflichtText, standardKonfig, type Baustein, type FeldDef, type StandardFormular, type VorlageModus } from '../../../lib/formular/felder'
import { formularFrei } from '../../../lib/freigabe'
import { field, inp, lbl, PubSection, sel, ta } from '../../public/pubStyles'
import FeldEingabe from '../../public/felder/FeldEingabe'
import FormularInhalt from '../../public/felder/FormularInhalt'
import { eigeneFelder, feldElementId, felderPruefen, gruppieren } from '../../public/felder/pruefen'
import { Hinweis, Seite, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { standardLabel, vorgaengeVoll } from '../logik'
import { ANONYM_WAHL } from '../texte'
import { NichtDa } from './FeldSeite'
import { vorschauAdresse } from './logik'
import { E_TEXTE as T } from './texte'
import { useVorlagenEntwurf } from './VorlageSeite'

const hilfeStil: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.45, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }
const fehlerStil: React.CSSProperties = { fontSize: 12, color: 'var(--lbf-fehler-text-2)', marginTop: 6, lineHeight: 1.4 }

/** Heute in Ortszeit, wie in den Formularen. */
function heute(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Ein ruhiger Platzhalter für einen Block, der in der Vorschau nicht bedienbar ist. */
function Platzhalter({ titel, text }: { titel?: string; text: string }) {
  return <div className="vg-platzhalter">{titel ? <b>{titel}</b> : null}{text}</div>
}

/** Absender als Beispiel, unten im Formular. */
function AbsenderBeispiel({ modus }: { modus: VorlageModus }) {
  const text = modus === 'anonym' ? T.platzhalterAnonym : ABSENDER_WAHL[modus].erklaerung
  return (
    <PubSection title={T.absender} open>
      <Platzhalter titel={modus === 'anonym' ? ANONYM_WAHL.anzeige : ABSENDER_WAHL[modus].anzeige} text={text} />
    </PubSection>
  )
}

/** Der gesperrte Sendeknopf und „Eingaben prüfen“. */
function Senden({ onPruefen, fehlerZahl }: { onPruefen: () => void; fehlerZahl: number | null }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 12px' }}>
        <button type="button" disabled aria-disabled="true" title={T.vorschauHinweis}
          style={{ background: 'rgba(var(--lbf-rot-rgb),0.15)', border: 'none', color: '#fff', padding: '13px 28px', borderRadius: 12, fontWeight: 700, fontSize: 15, fontFamily: 'inherit', opacity: 0.8 }}>
          {T.vorschauSenden}
        </button>
      </div>
      <div className="bv-flaeche">
        <Zeile titel={T.vorschauPruefen} unter={fehlerZahl === null ? T.vorschauPruefenUnter : fehlerZahl === 0 ? T.vorschauAllesDa : T.vorschauFehlt(fehlerZahl)} art="akzent" onClick={onPruefen} />
      </div>
    </>
  )
}

export default function VorschauSeite({ k, id }: { k: VgKontext; id?: string }) {
  const adr = vorschauAdresse(id)
  if (!adr) return <NichtDa k={k} />
  if (adr.art === 'standard') {
    if (!formularFrei(k.org, adr.formular)) return <NichtDa k={k} />
    return <StandardVorschau k={k} formular={adr.formular} />
  }
  if (!vorgaengeVoll(k)) return <NichtDa k={k} titel={T.keinZugriffTitel} text={T.keinZugriff} />
  return <VorlageVorschau k={k} vorlage={adr.vorlage} />
}

// ── Standardformular ────────────────────────────────────────────────────────

/** Die Platzhalter der Kernblöcke, die die Vorschau nicht nachbaut. */
const BLOCK_TEXT: Record<string, string> = {
  positionen: T.platzhalterPositionen,
  lager_id: T.platzhalterLager,
  device_id: T.platzhalterGeraet,
  severity: T.platzhalterSchwere,
}

function StandardVorschau({ k, formular }: { k: VgKontext; formular: StandardFormular }) {
  const konfig = standardKonfig(k.cfg, formular)
  const bs = bausteine(konfig, formular)
  const eigene = eigeneFelder(bs)
  // Das Datum steht in den Formularen schon auf heute
  const [kern, setKern] = useState<Record<string, string>>(() => ({ datum: heute() }))
  const [werte, setWerte] = useState<Record<string, unknown>>({})
  const [fehler, setFehler] = useState<Record<string, string>>({})
  const [gepruefT, setGeprueft] = useState<number | null>(null)

  function pruefen() {
    // Eigene Felder nach den Regeln des Servers, Kernfelder nur auf Pflicht (die Bedienung der Blöcke fehlt hier)
    const p = felderPruefen(eigene, werte)
    const alle: Record<string, string> = { ...p.fehler }
    for (const b of bs) {
      if (b.art !== 'kern' || BLOCK_TEXT[b.id] || !(b.pflicht || b.kern.fest)) continue
      if (!String(kern[b.id] ?? '').trim()) alle[b.id] = pflichtText({ id: b.id, typ: 'text', label: b.label })
    }
    setFehler(alle)
    setGeprueft(Object.keys(alle).length)
  }

  function kernEingabe(b: Extract<Baustein, { art: 'kern' }>) {
    if (BLOCK_TEXT[b.id]) return <Platzhalter text={BLOCK_TEXT[b.id]} />
    const elId = feldElementId(b.id)
    const wert = kern[b.id] ?? ''
    const an = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const v = e.target.value
      setKern((p) => ({ ...p, [b.id]: v }))
    }
    const rahmen: React.CSSProperties = fehler[b.id] ? { borderColor: 'var(--lbf-fehler-text-2)' } : {}
    if (b.id === 'datum') return <input id={elId} style={{ ...inp, ...rahmen }} type="date" value={wert} onChange={an} />
    if (formular === 'cirs' && b.id === 'kategorie') {
      return <select id={elId} style={{ ...sel, ...rahmen }} value={wert} onChange={an}><option value="">{T.bitteWaehlen}</option>{KATEGORIEN.map((x) => <option key={x.wert} value={x.wert}>{x.name}</option>)}</select>
    }
    if (formular === 'cirs' && b.id === 'schwere') {
      return <select id={elId} style={{ ...sel, ...rahmen }} value={wert} onChange={an}><option value="">{T.bitteWaehlen}</option>{SCHWEREGRADE.map((x) => <option key={x.wert} value={x.wert}>{`${x.name} (${x.lang})`}</option>)}</select>
    }
    if (['was', 'warum', 'folgen', 'vorschlag', 'description'].includes(b.id)) return <textarea id={elId} style={{ ...ta, ...rahmen }} value={wert} onChange={an} />
    return <input id={elId} style={{ ...inp, ...rahmen }} type="text" value={wert} onChange={an} />
  }

  /** Ein Kernfeld; in einem eigenen Block (Positionen, Gerät, Beschreibung …) steht die Bezeichnung schon als Titel. */
  function kernFeld(b: Extract<Baustein, { art: 'kern' }>, imBlock: boolean) {
    const pflicht = b.pflicht || b.kern.fest
    return (
      <div key={b.id} style={imBlock ? undefined : field}>
        {imBlock ? null : (
          <label htmlFor={feldElementId(b.id)} style={lbl}>
            {b.label}{pflicht ? ' *' : ''}
            {b.hilfe ? <span style={hilfeStil}>{b.hilfe}</span> : null}
          </label>
        )}
        {imBlock && b.hilfe ? <div style={{ ...hilfeStil, margin: '0 0 10px' }}>{b.hilfe}</div> : null}
        {kernEingabe(b)}
        {fehler[b.id] ? <div role="alert" style={fehlerStil}>{fehler[b.id]}</div> : null}
      </div>
    )
  }

  const modus: VorlageModus | null = formular === 'cirs' ? null : absenderModus(k.cfg, formular)

  return (
    <Seite titel={T.vorschau} unter={standardLabel(formular)} zurueck={k.schliessen}>
      <Hinweis oben>{T.vorschauHinweis}</Hinweis>
      <div data-vorschau="">
        {gruppieren(bs, formular).map((g, gi) => (
          <PubSection key={`g-${gi}`} title={g.block ? `${g.titel}${g.teile[0]?.art === 'kern' && (g.teile[0].pflicht || g.teile[0].kern.fest) ? ' *' : ''}` : g.titel} open>
            {g.teile.map((b) => (b.art === 'kern'
              ? kernFeld(b, g.block !== null)
              : <FeldEingabe key={b.feld.id} feld={b.feld} wert={werte[b.feld.id]} onWert={(w) => setWerte((p) => ({ ...p, [b.feld.id]: w }))} fehler={fehler[b.feld.id]} />))}
          </PubSection>
        ))}
        {modus ? <AbsenderBeispiel modus={modus} /> : null}
      </div>
      <Senden onPruefen={pruefen} fehlerZahl={gepruefT} />
    </Seite>
  )
}

// ── Eigenes Formular ────────────────────────────────────────────────────────

function VorlageVorschau({ k, vorlage }: { k: VgKontext; vorlage: string }) {
  const { z } = useVorlagenEntwurf(k, vorlage)
  const [werte, setWerte] = useState<Record<string, unknown>>({})
  const [fehler, setFehler] = useState<Record<string, string>>({})
  const [geprueft, setGeprueft] = useState<number | null>(null)

  if (z.art === 'laedt') {
    return <Seite titel={T.vorschau} unter={k.orgName} zurueck={k.schliessen}><Hinweis oben>{T.laedt}</Hinweis></Seite>
  }
  if (z.art === 'weg') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={T.nichtGefunden} />
  if (z.art === 'fehler') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={z.text} />

  const e = z.e
  const felder: FeldDef[] = e.felder
  const sichtbar = felder.filter((f) => f.aus !== true)
  const titel = e.titel.trim() || T.neuesFormular

  function pruefen() {
    const p = felderPruefen(felder, werte)
    setFehler(p.fehler)
    setGeprueft(Object.keys(p.fehler).length)
  }

  return (
    <Seite titel={T.vorschau} unter={titel} zurueck={k.schliessen}>
      <Hinweis oben>{T.vorschauHinweis}</Hinweis>
      <div data-vorschau="">
        {sichtbar.length === 0 ? (
          <Platzhalter text={T.vorschauOhneFelder} />
        ) : (
          <FormularInhalt
            schema={{ abschnitte: e.abschnitte, felder }} werte={werte} fehler={fehler} beschreibung={e.beschreibung}
            onWert={(id, w) => setWerte((p) => ({ ...p, [id]: w }))}
          />
        )}
        <AbsenderBeispiel modus={e.absender} />
      </div>
      {sichtbar.length ? <Senden onPruefen={pruefen} fehlerZahl={geprueft} /> : null}
    </Seite>
  )
}
