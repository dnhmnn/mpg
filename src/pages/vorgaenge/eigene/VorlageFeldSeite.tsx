// Ein Feld eines eigenen Formulars im Baukasten (Bauplan Vorgänge 3.7):
// `?seite=vorlage-feld&id=<vorlage>:<feld>`, neu `<vorlage>:neu` bzw. `<vorlage>:neu.<abschnitt>`.
//
// Dieselben Angaben wie ein eigenes Feld eines Standardformulars (FeldFormular), dazu der
// Abschnitt, wenn es mehrere gibt. Die Seite arbeitet auf dem Entwurf der Vorlage
// (sessionStorage, entwurf.ts): „Übernehmen“ bzw. „Hinzufügen“ ändert den Entwurf und geht
// zurück; gespeichert wird mit „Speichern“ auf der Seite des Formulars.

import { useState } from 'react'
import { FELD_GRENZEN, neueFeldId, type FeldDef } from '../../../lib/formular/felder'
import { Abschnitt, Hinweis, Leiste, Seite, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'
import { entwurfMerken, feldEntfernen, feldSetzen, type VorlageEntwurf } from './entwurf'
import { FeldFormular, NichtDa } from './FeldSeite'
import { feldAusEntwurf, feldEntwurf, feldPruefen, teilAdresse, type FeldEntwurf } from './logik'
import { E_TEXTE as T } from './texte'
import { useVorlagenEntwurf } from './VorlageSeite'

export default function VorlageFeldSeite({ k, id }: { k: VgKontext; id?: string }) {
  const adr = teilAdresse(id)
  if (!adr) return <NichtDa k={k} />
  if (!vorgaengeVoll(k)) return <NichtDa k={k} titel={T.keinZugriffTitel} text={T.keinZugriff} />
  return <Laden k={k} vorlage={adr.vorlage} teil={adr.teil} abschnitt={adr.abschnitt} />
}

function Laden({ k, vorlage, teil, abschnitt }: { k: VgKontext; vorlage: string; teil: string; abschnitt: string }) {
  const { z } = useVorlagenEntwurf(k, vorlage)
  if (z.art === 'laedt') {
    return <Seite titel={T.feldTitel} unter={k.orgName} zurueck={k.schliessen}><Hinweis oben>{T.laedt}</Hinweis></Seite>
  }
  if (z.art === 'weg') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={T.nichtGefunden} />
  if (z.art === 'fehler') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={z.text} />
  const vorhanden = teil === 'neu' ? null : z.e.felder.find((f) => f.id === teil) ?? null
  if (teil !== 'neu' && !vorhanden) return <NichtDa k={k} titel={T.nichtGefundenTitel} text={T.entwurfWeg} />
  return <Inhalt k={k} schluessel={vorlage} entwurf={z.e} vorhanden={vorhanden} abschnitt={abschnitt} />
}

function Inhalt({ k, schluessel, entwurf, vorhanden, abschnitt }: {
  k: VgKontext
  schluessel: string
  entwurf: VorlageEntwurf
  vorhanden: FeldDef | null
  abschnitt: string
}) {
  const neu = !vorhanden
  // Neues Feld: in den gewählten Abschnitt, sonst in den letzten
  const startAbschnitt = vorhanden?.abschnitt
    ?? (entwurf.abschnitte.some((a) => a.id === abschnitt) ? abschnitt : entwurf.abschnitte[entwurf.abschnitte.length - 1]?.id ?? '')
  const [start] = useState<FeldEntwurf>(() => feldEntwurf(vorhanden, neueFeldId('f'), startAbschnitt))
  const [e, setEState] = useState<FeldEntwurf>(start)
  const [versucht, setVersucht] = useState(false)
  const fehler = feldPruefen(e)
  const geaendert = JSON.stringify(e) !== JSON.stringify(start)
  const voll = neu && entwurf.felder.length >= FELD_GRENZEN.felder
  const setE = (fn: (x: FeldEntwurf) => FeldEntwurf) => setEState((x) => fn(x))
  const formTitel = entwurf.titel.trim() || (entwurf.id ? T.eigeneFormulare : T.neuesFormular)
  const titel = e.label.trim() || (neu ? T.neuesFeld : T.feldTitel)

  /** Den Entwurf der Vorlage ändern, sofort merken und zurück. */
  function inDenEntwurf(neuerEntwurf: VorlageEntwurf, meldung: string) {
    entwurfMerken(schluessel, neuerEntwurf)
    k.showMsg(meldung)
    k.schliessen()
  }

  function uebernehmen() {
    setVersucht(true)
    if (fehler || voll) return
    inDenEntwurf(feldSetzen(entwurf, feldAusEntwurf(e, { mitAbschnitt: true })), neu ? T.feldHinzugefuegt : T.feldUebernommen)
  }

  function entfernen() {
    if (!vorhanden || !window.confirm(T.feldEntfernenFrage)) return
    inDenEntwurf(feldEntfernen(entwurf, vorhanden.id), T.feldEntfernt)
  }

  if (voll) {
    return (
      <Seite titel={T.neuesFeld} unter={formTitel} zurueck={k.schliessen}>
        <Hinweis oben>{T.zuVieleFelder(FELD_GRENZEN.felder)}</Hinweis>
      </Seite>
    )
  }

  return (
    <Seite
      titel={titel} unter={formTitel} zurueck={k.schliessen}
      leiste={<Leiste titel={T.mitFormular} unter={formTitel} knopf={neu ? T.hinzufuegen : T.uebernehmen} icon="haken" onClick={uebernehmen} disabled={!neu && !geaendert} />}
    >
      <FeldFormular e={e} setE={setE} fehler={fehler} versucht={versucht} abschnitte={entwurf.abschnitte} />
      {!neu ? (
        <>
          <Abschnitt titel={T.weiteres} />
          <div className="bv-flaeche">
            <Zeile titel={T.feldEntfernen} art="gefahr" onClick={entfernen} />
          </div>
          <Hinweis>{T.feldEntfernenFrage}</Hinweis>
        </>
      ) : null}
      <Hinweis>{T.erstMitSpeichernFormular}</Hinweis>
    </Seite>
  )
}
