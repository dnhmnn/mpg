// Ein Feld eines Standardformulars (Bauplan Vorgänge 3.6): `?seite=feld&id=<formular>:<kennung>`.
//
// Kernfeld: Bezeichnung, Hilfetext, „Im Formular zeigen“ (nur abschaltbare), „Pflichtfeld“
// (nur wählbare), „Auf Vorgabe zurücksetzen“. Eigenes Feld (`e_…`, neu: `:neu`): Art,
// Bezeichnung, Hilfetext, Pflicht, aus, Optionen bzw. Einheit und Grenzen, „Feld entfernen“.
// Gespeichert wird mit der Leiste über k.aendern (form_config frisch gelesen, standardSetzen
// zählt die Fassung).
//
// FeldFormular ist auch der Inhalt der Seite eines Felds im Baukasten (VorlageFeldSeite).

import { useState } from 'react'
import { formularFrei } from '../../../lib/freigabe'
import {
  FELD_GRENZEN, FELD_TYPEN, FELD_TYP_NAME, neueFeldId, standardKonfig,
  type Abschnitt as AbschnittDef, type FeldTyp, type KernFeld,
} from '../../../lib/formular/felder'
import { standardSetzen } from '../../../lib/formular/einstellung'
import { Abschnitt, Auswahl, Feld, Hinweis, Leiste, Notiz, SchalterZeile, Seite, VgIcon, WahlZeilen, Zeile, ZahlFeld } from '../bausteine'
import type { VgKontext } from '../kontext'
import { standardLabel } from '../logik'
import {
  eigenesEntfernen, eigenesSetzen, feldAdresse, feldAusEntwurf, feldEntwurf, feldPruefen, kernFeld, kernSetzen,
  type FeldEntwurf, type FeldFehler,
} from './logik'
import { E_TEXTE as T, FELD_TYP_SATZ } from './texte'

/** Nicht gefunden: die Seite im Stil der Schale. */
export function NichtDa({ k, titel = 'Nicht gefunden', text = 'Diese Seite gibt es hier nicht. Vielleicht ist der Link veraltet oder der Eintrag wurde gerade entfernt.' }: { k: VgKontext; titel?: string; text?: string }) {
  return (
    <Seite titel={titel} unter={k.orgName} zurueck={k.schliessen}>
      <Notiz titel={titel}>{text}</Notiz>
    </Seite>
  )
}

/**
 * Die Angaben eines eigenen Felds (Standardformular oder eigenes Formular). `abschnitte`:
 * nur im Baukasten, dann lässt sich der Abschnitt wählen.
 */
export function FeldFormular({ e, setE, fehler, abschnitte, versucht }: {
  e: FeldEntwurf
  setE: (fn: (x: FeldEntwurf) => FeldEntwurf) => void
  fehler: FeldFehler | null
  abschnitte?: AbschnittDef[]
  /** Nach dem ersten Speicherversuch zeigt es auch Fehler, die noch niemand berührt hat. */
  versucht: boolean
}) {
  const f = (feld: FeldFehler['feld']) => (fehler && fehler.feld === feld && versucht ? fehler.text : undefined)
  const optionen = e.typ === 'auswahl' || e.typ === 'mehrfach'

  function typSetzen(typ: FeldTyp) {
    setE((x) => ({ ...x, typ, optionen: (typ === 'auswahl' || typ === 'mehrfach') && x.optionen.filter((o) => o.trim()).length === 0 ? ['', ''] : x.optionen }))
  }

  return (
    <>
      <Abschnitt titel={T.art} erst />
      <WahlZeilen<FeldTyp>
        label={T.artAria} wert={e.typ} onWahl={typSetzen}
        optionen={FELD_TYPEN.map((t) => ({ wert: t, titel: FELD_TYP_NAME[t], unter: FELD_TYP_SATZ[t] }))}
      />

      <Abschnitt titel={T.feldTitel} />
      <Feld label={T.bezeichnung} erst fehler={f('label')}>
        <input className={`bv-eingabe${f('label') ? ' fehler' : ''}`} type="text" value={e.label} maxLength={FELD_GRENZEN.label + 20} autoComplete="off"
          onChange={(ev) => { const v = ev.target.value; setE((x) => ({ ...x, label: v })) }} />
      </Feld>
      <Feld label={T.hilfetext} zusatz={T.freiwillig} hinweis={T.hilfeHinweis} fehler={f('hilfe')}>
        <textarea className={`bv-eingabe${f('hilfe') ? ' fehler' : ''}`} rows={2} value={e.hilfe} maxLength={FELD_GRENZEN.hilfe + 50}
          onChange={(ev) => { const v = ev.target.value; setE((x) => ({ ...x, hilfe: v })) }} />
      </Feld>

      {optionen ? (
        <>
          <Abschnitt titel={T.optionenTitel} />
          <div className="vg-liste">
            {e.optionen.map((o, i) => (
              <div key={i} className="bv-reihe">
                <input className={`bv-eingabe${f('optionen') && (!o.trim() || o.trim().length > FELD_GRENZEN.option) ? ' fehler' : ''}`} type="text" value={o}
                  aria-label={T.option(i + 1)} placeholder={T.option(i + 1)} maxLength={FELD_GRENZEN.option + 20} autoComplete="off"
                  onChange={(ev) => { const v = ev.target.value; setE((x) => ({ ...x, optionen: x.optionen.map((y, j) => (j === i ? v : y)) })) }} />
                <button type="button" className="bv-knopf" aria-label={T.optionEntfernen(i + 1)} disabled={e.optionen.length <= 1}
                  onClick={() => setE((x) => ({ ...x, optionen: x.optionen.filter((_, j) => j !== i) }))}>
                  <VgIcon n="kreuz" className="bv-klein" />
                </button>
              </div>
            ))}
          </div>
          {f('optionen') ? <p className="bv-fehltext" role="alert">{f('optionen')}</p> : null}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="bv-knopf" disabled={e.optionen.length >= FELD_GRENZEN.optionen}
              onClick={() => setE((x) => ({ ...x, optionen: [...x.optionen, ''] }))}>
              <VgIcon n="plus" className="bv-klein" />{T.optionHinzufuegen}
            </button>
          </div>
          <Hinweis>{T.optionenHinweis}</Hinweis>
        </>
      ) : null}

      {e.typ === 'zahl' ? (
        <>
          <Abschnitt titel={FELD_TYP_NAME.zahl} />
          <Feld label={T.einheit} erst zusatz={T.freiwillig} hinweis={T.einheitHinweis} fehler={f('einheit')}>
            <input className={`bv-eingabe${f('einheit') ? ' fehler' : ''}`} type="text" value={e.einheit} maxLength={FELD_GRENZEN.einheit + 8} autoComplete="off"
              onChange={(ev) => { const v = ev.target.value; setE((x) => ({ ...x, einheit: v })) }} />
          </Feld>
          <Feld label={T.kleinster} zusatz={T.freiwillig} fehler={f('min')}>
            <ZahlFeld wert={e.min} onWert={(n) => setE((x) => ({ ...x, min: n }))} />
          </Feld>
          <Feld label={T.groesster} zusatz={T.freiwillig} fehler={f('max')}>
            <ZahlFeld wert={e.max} onWert={(n) => setE((x) => ({ ...x, max: n }))} />
          </Feld>
        </>
      ) : null}

      {abschnitte && abschnitte.length > 1 ? (
        <>
          <Abschnitt titel={T.abschnittZuordnen} />
          <Auswahl value={e.abschnitt} onChange={(v) => setE((x) => ({ ...x, abschnitt: v }))} label={T.abschnittZuordnen}>
            {abschnitte.map((a) => <option key={a.id} value={a.id}>{a.titel || T.abschnittOhneTitel}</option>)}
          </Auswahl>
        </>
      ) : null}

      <Abschnitt titel={T.imFormularTitel} />
      <div className="bv-flaeche">
        <SchalterZeile titel={T.pflichtfeld} unter={e.typ === 'janein' && e.pflicht ? T.pflichtJaNein : e.pflicht ? T.pflichtAn : T.pflichtAus} an={e.pflicht}
          onChange={(an) => setE((x) => ({ ...x, pflicht: an }))} />
        <SchalterZeile titel={T.imFormular} unter={e.aus ? T.imFormularAus : T.imFormularAn} an={!e.aus}
          onChange={(an) => setE((x) => ({ ...x, aus: !an }))} />
      </div>
    </>
  )
}

/** Gleiche Angaben? (für „Noch nicht gespeichert“) */
function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function FeldSeite({ k, id }: { k: VgKontext; id?: string }) {
  const adr = feldAdresse(id)
  if (!adr || !formularFrei(k.org, adr.formular)) return <NichtDa k={k} />
  if (!k.darfEinstellen) return <NichtDa k={k} titel={T.keinZugriffTitel} text={T.ohneSchreibrecht} />
  const kern = kernFeld(adr.formular, adr.kennung)
  if (kern) return <KernSeite k={k} formular={adr.formular} kern={kern} />
  return <EigenSeite k={k} formular={adr.formular} kennung={adr.kennung} />
}

function KernSeite({ k, formular, kern }: { k: VgKontext; formular: Parameters<typeof standardKonfig>[1]; kern: KernFeld }) {
  const konfig = standardKonfig(k.cfg, formular)
  const e0 = konfig.felder[kern.id] ?? {}
  const start = { label: e0.label ?? '', hilfe: e0.hilfe ?? '', aus: e0.aus === true, pflicht: typeof e0.pflicht === 'boolean' ? e0.pflicht : kern.pflichtVor }
  const [w, setW] = useState(start)
  const [laeuft, setLaeuft] = useState(false)
  const geaendert = !gleich(w, start)
  const labelLang = w.label.trim().length > FELD_GRENZEN.label
  const hilfeLang = w.hilfe.trim().length > FELD_GRENZEN.hilfe
  const anzeige = w.label.trim() || kern.label
  const istVorgabe = !w.label.trim() && !w.hilfe.trim() && !w.aus && w.pflicht === kern.pflichtVor

  async function speichern() {
    if (labelLang || hilfeLang) return
    setLaeuft(true)
    const ok = await k.aendern((c) => standardSetzen(c, formular, (kk) => kernSetzen(kk, kern, w)))
    setLaeuft(false)
    if (ok) { k.showMsg(T.feldGespeichert); k.schliessen() }
  }

  return (
    <Seite titel={anzeige} unter={standardLabel(formular)} zurueck={k.schliessen}
      leiste={<Leiste titel={geaendert ? T.nichtGespeichertFeld : anzeige} unter={standardLabel(formular)} knopf={T.speichern} icon="haken" onClick={speichern} laeuft={laeuft} disabled={!geaendert || labelLang || hilfeLang} />}>
      {kern.fest ? <Hinweis oben>{T.festHinweis}</Hinweis> : null}
      {formular === 'cirs' && (kern.id === 'kategorie' || kern.id === 'schwere') ? <Hinweis oben>{T.festeListe}</Hinweis> : null}
      {!kern.pflichtWaehlbar && kern.ausErlaubt ? <Hinweis oben>{T.personNie}</Hinweis> : null}

      <Abschnitt titel={T.feldTitel} erst />
      <Feld label={T.bezeichnung} erst hinweis={T.vorgabe(kern.label)} fehler={labelLang ? T.labelLang : undefined}>
        <input className={`bv-eingabe${labelLang ? ' fehler' : ''}`} type="text" value={w.label} placeholder={kern.label} autoComplete="off"
          onChange={(ev) => { const v = ev.target.value; setW((x) => ({ ...x, label: v })) }} />
      </Feld>
      <Feld label={T.hilfetext} zusatz={T.freiwillig} hinweis={T.hilfeHinweis} fehler={hilfeLang ? T.hilfeLang : undefined}>
        <textarea className={`bv-eingabe${hilfeLang ? ' fehler' : ''}`} rows={2} value={w.hilfe}
          onChange={(ev) => { const v = ev.target.value; setW((x) => ({ ...x, hilfe: v })) }} />
      </Feld>

      {kern.ausErlaubt || kern.pflichtWaehlbar ? (
        <>
          <Abschnitt titel={T.imFormularTitel} />
          <div className="bv-flaeche">
            {kern.ausErlaubt ? (
              <SchalterZeile titel={T.imFormular} unter={w.aus ? T.imFormularAus : T.imFormularAn} an={!w.aus} onChange={(an) => setW((x) => ({ ...x, aus: !an }))} />
            ) : null}
            {kern.pflichtWaehlbar ? (
              <SchalterZeile titel={T.pflichtfeld} unter={w.pflicht ? T.pflichtAn : T.pflichtAus} an={w.pflicht} disabled={w.aus} onChange={(an) => setW((x) => ({ ...x, pflicht: an }))} />
            ) : null}
          </div>
        </>
      ) : null}

      <Abschnitt titel={T.weiteres} />
      <div className="bv-flaeche">
        <Zeile titel={T.zuruecksetzen} unter={T.zuruecksetzenUnter} art="akzent" disabled={istVorgabe}
          onClick={() => setW({ label: '', hilfe: '', aus: false, pflicht: kern.pflichtVor })} />
      </div>
      {geaendert ? <Hinweis>{T.erstMitSpeichern}</Hinweis> : null}
    </Seite>
  )
}

function EigenSeite({ k, formular, kennung }: { k: VgKontext; formular: Parameters<typeof standardKonfig>[1]; kennung: string }) {
  const konfig = standardKonfig(k.cfg, formular)
  const vorhanden = kennung === 'neu' ? null : konfig.eigene.find((d) => d.id === kennung) ?? null
  const [neuId] = useState(() => neueFeldId('e'))
  const [startE] = useState(() => feldEntwurf(vorhanden, neuId))
  const [e, setEState] = useState<FeldEntwurf>(startE)
  const [versucht, setVersucht] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  // Beim Öffnen festhalten: Nach dem Entfernen soll bis zum Schließen nicht „gibt es nicht“ aufblitzen
  const [warDa] = useState(!!vorhanden)

  if (kennung !== 'neu' && !warDa) return <NichtDa k={k} />

  const neu = kennung === 'neu'
  const faehig = k.stand?.faehig?.eigene_felder?.[formular] === true
  const voll = neu && konfig.eigene.length >= FELD_GRENZEN.eigene_standard
  const fehler = feldPruefen(e)
  const geaendert = !gleich(e, startE)
  const setE = (fn: (x: FeldEntwurf) => FeldEntwurf) => setEState((x) => fn(x))
  const titel = e.label.trim() || (neu ? T.neuesFeld : T.feldTitel)

  async function speichern() {
    setVersucht(true)
    if (fehler || voll || (neu && !faehig)) return
    setLaeuft(true)
    const d = feldAusEntwurf(e)
    const ok = await k.aendern((c) => standardSetzen(c, formular, (kk) => eigenesSetzen(kk, d)))
    setLaeuft(false)
    if (ok) { k.showMsg(neu ? T.feldHinzugefuegt : T.feldGespeichert); k.schliessen() }
  }

  async function entfernen() {
    if (!window.confirm(T.feldEntfernenFrage)) return
    setLaeuft(true)
    const ok = await k.aendern((c) => standardSetzen(c, formular, (kk) => eigenesEntfernen(kk, kennung)))
    setLaeuft(false)
    if (ok) { k.showMsg(T.feldEntfernt); k.schliessen() }
  }

  if (neu && !faehig) {
    return (
      <Seite titel={T.neuesFeld} unter={standardLabel(formular)} zurueck={k.schliessen}>
        <Notiz titel={T.eigenesHinzufuegen}>{T.eigeneSpaeter}</Notiz>
      </Seite>
    )
  }
  if (voll) {
    return (
      <Seite titel={T.neuesFeld} unter={standardLabel(formular)} zurueck={k.schliessen}>
        <Notiz titel={T.eigenesHinzufuegen}>{T.eigeneVoll(FELD_GRENZEN.eigene_standard)}</Notiz>
      </Seite>
    )
  }

  return (
    <Seite titel={titel} unter={standardLabel(formular)} zurueck={k.schliessen}
      leiste={<Leiste titel={geaendert || neu ? T.nichtGespeichertFeld : titel} unter={standardLabel(formular)} knopf={neu ? T.hinzufuegen : T.speichern} icon="haken" onClick={speichern} laeuft={laeuft} disabled={!neu && !geaendert} />}>
      <FeldFormular e={e} setE={setE} fehler={fehler} versucht={versucht} />
      {!neu ? (
        <>
          <Abschnitt titel={T.weiteres} />
          <div className="bv-flaeche">
            <Zeile titel={T.feldEntfernen} art="gefahr" onClick={() => { void entfernen() }} disabled={laeuft} />
          </div>
          <Hinweis>{T.feldEntfernenFrage}</Hinweis>
        </>
      ) : null}
    </Seite>
  )
}

