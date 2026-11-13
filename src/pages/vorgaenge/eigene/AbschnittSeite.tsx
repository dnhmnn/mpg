// Ein Abschnitt eines eigenen Formulars (Bauplan Vorgänge 3.7):
// `?seite=vorlage-abschnitt&id=<vorlage>:<abschnitt>`, neu `<vorlage>:neu`.
//
// Titel (Pflicht) und Hilfetext. Der erste Abschnitt nimmt die Felder auf, die schon da sind;
// ein entfernter Abschnitt gibt seine Felder an den davor (beim ersten an den nächsten). Wie
// die Seite eines Felds arbeitet sie auf dem Entwurf der Vorlage; gespeichert wird auf der
// Seite des Formulars.

import { useState } from 'react'
import { FELD_GRENZEN, neueFeldId, type Abschnitt as AbschnittDef } from '../../../lib/formular/felder'
import { Abschnitt, Feld, Hinweis, Leiste, Seite, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'
import { abschnittEntfernen, abschnittPruefen, abschnittSetzen, entwurfMerken, type VorlageEntwurf } from './entwurf'
import { NichtDa } from './FeldSeite'
import { teilAdresse } from './logik'
import { E_TEXTE as T } from './texte'
import { useVorlagenEntwurf } from './VorlageSeite'

export default function AbschnittSeite({ k, id }: { k: VgKontext; id?: string }) {
  const adr = teilAdresse(id)
  // `neu.<abschnitt>` gibt es nur für Felder
  if (!adr || adr.abschnitt) return <NichtDa k={k} />
  if (!vorgaengeVoll(k)) return <NichtDa k={k} titel={T.keinZugriffTitel} text={T.keinZugriff} />
  return <Laden k={k} vorlage={adr.vorlage} teil={adr.teil} />
}

function Laden({ k, vorlage, teil }: { k: VgKontext; vorlage: string; teil: string }) {
  const { z } = useVorlagenEntwurf(k, vorlage)
  if (z.art === 'laedt') {
    return <Seite titel={T.abschnittTitel} unter={k.orgName} zurueck={k.schliessen}><Hinweis oben>{T.laedt}</Hinweis></Seite>
  }
  if (z.art === 'weg') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={T.nichtGefunden} />
  if (z.art === 'fehler') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={z.text} />
  const vorhanden = teil === 'neu' ? null : z.e.abschnitte.find((a) => a.id === teil) ?? null
  if (teil !== 'neu' && !vorhanden) return <NichtDa k={k} titel={T.nichtGefundenTitel} text={T.entwurfWeg} />
  return <Inhalt k={k} schluessel={vorlage} entwurf={z.e} vorhanden={vorhanden} />
}

function Inhalt({ k, schluessel, entwurf, vorhanden }: { k: VgKontext; schluessel: string; entwurf: VorlageEntwurf; vorhanden: AbschnittDef | null }) {
  const neu = !vorhanden
  const [neuId] = useState(() => neueFeldId('a'))
  const start = { titel: vorhanden?.titel ?? '', hilfe: vorhanden?.hilfe ?? '' }
  const [w, setW] = useState(start)
  const [versucht, setVersucht] = useState(false)
  const fehler = abschnittPruefen(w)
  const zeig = (feld: 'titel' | 'hilfe') => (versucht && fehler?.feld === feld ? fehler.text : undefined)
  const geaendert = w.titel !== start.titel || w.hilfe !== start.hilfe
  const voll = neu && entwurf.abschnitte.length >= FELD_GRENZEN.abschnitte
  const formTitel = entwurf.titel.trim() || (entwurf.id ? T.eigeneFormulare : T.neuesFormular)
  const titel = w.titel.trim() || (neu ? T.neuerAbschnitt : T.abschnittTitel)
  const ersterMitFeldern = neu && entwurf.abschnitte.length === 0 && entwurf.felder.length > 0
  const felderDarin = vorhanden ? entwurf.felder.filter((f) => f.abschnitt === vorhanden.id).length : 0
  const pos = vorhanden ? entwurf.abschnitte.findIndex((a) => a.id === vorhanden.id) : -1
  const wohin = T.abschnittEntfernenText(pos, entwurf.abschnitte.length)

  function inDenEntwurf(neuerEntwurf: VorlageEntwurf, meldung: string) {
    entwurfMerken(schluessel, neuerEntwurf)
    k.showMsg(meldung)
    k.schliessen()
  }

  function uebernehmen() {
    setVersucht(true)
    if (fehler || voll) return
    const a: AbschnittDef = { id: vorhanden?.id ?? neuId, titel: w.titel }
    if (w.hilfe.trim()) a.hilfe = w.hilfe
    inDenEntwurf(abschnittSetzen(entwurf, a), neu ? T.abschnittHinzugefuegt : T.abschnittUebernommen)
  }

  function entfernen() {
    if (!vorhanden || !window.confirm(felderDarin ? `${T.abschnittEntfernenFrage} ${wohin}` : T.abschnittEntfernenFrage)) return
    inDenEntwurf(abschnittEntfernen(entwurf, vorhanden.id), T.abschnittEntfernt)
  }

  if (voll) {
    return (
      <Seite titel={T.neuerAbschnitt} unter={formTitel} zurueck={k.schliessen}>
        <Hinweis oben>{T.zuVieleAbschnitte(FELD_GRENZEN.abschnitte)}</Hinweis>
      </Seite>
    )
  }

  return (
    <Seite
      titel={titel} unter={formTitel} zurueck={k.schliessen}
      leiste={<Leiste titel={T.mitFormular} unter={formTitel} knopf={neu ? T.hinzufuegen : T.uebernehmen} icon="haken" onClick={uebernehmen} disabled={!neu && !geaendert} />}
    >
      {ersterMitFeldern ? <Hinweis oben>{T.abschnittErster}</Hinweis> : null}
      <Abschnitt titel={T.abschnittTitel} erst={!ersterMitFeldern} />
      <Feld label={T.abschnittName} erst fehler={zeig('titel')}>
        <input className={`bv-eingabe${zeig('titel') ? ' fehler' : ''}`} type="text" value={w.titel} maxLength={FELD_GRENZEN.titel + 20} autoComplete="off"
          onChange={(ev) => { const v = ev.target.value; setW((x) => ({ ...x, titel: v })) }} />
      </Feld>
      <Feld label={T.hilfetext} zusatz={T.freiwillig} hinweis={T.abschnittHilfeHinweis} fehler={zeig('hilfe')}>
        <textarea className={`bv-eingabe${zeig('hilfe') ? ' fehler' : ''}`} rows={2} value={w.hilfe} maxLength={FELD_GRENZEN.hilfe + 50}
          onChange={(ev) => { const v = ev.target.value; setW((x) => ({ ...x, hilfe: v })) }} />
      </Feld>

      {!neu ? (
        <>
          <Abschnitt titel={T.weiteres} />
          <div className="bv-flaeche">
            <Zeile titel={T.abschnittEntfernen} unter={felderDarin ? wohin : undefined} art="gefahr" onClick={entfernen} />
          </div>
        </>
      ) : null}
      <Hinweis>{T.erstMitSpeichernFormular}</Hinweis>
    </Seite>
  )
}
