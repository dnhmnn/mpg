// Felder eines Standardformulars (Bauplan Vorgänge 3.6): `?seite=felder&id=<formular>`.
//
// Alle Bausteine in Formularfolge, auch ausgeblendete; eine Zeile öffnet das Feld
// (`feld&id=<formular>:<kennung>`). „Reihenfolge ändern“ zeigt je Zeile zwei Knöpfe, „Fertig“
// speichert die neue Folge auf einmal. Eigene Felder hinzufügen geht erst, wenn der Server sie
// annimmt (`stand.faehig.eigene_felder`).
//
// StandardFelder ist der Abschnitt „Felder“ auf der Seite eines Standardformulars
// (StandardAbschnitt der Erweiterung).

import { useState } from 'react'
import { formularFrei } from '../../../lib/freigabe'
import { FELD_GRENZEN, bausteine, standardKonfig, type StandardFormular } from '../../../lib/formular/felder'
import { standardSetzen } from '../../../lib/formular/einstellung'
import { Abschnitt, Hinweis, Seite, VgIcon, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { standardLabel } from '../logik'
import { NichtDa } from './FeldSeite'
import { bausteinZeile, felderZusammenfassung, istStandardFormular, reihenfolgeAus, verschieben } from './logik'
import { E_TEXTE as T } from './texte'

/** Abschnitt „Felder“ auf der Seite eines Standardformulars: anpassen (mit Recht) und Vorschau. */
export function StandardFelder({ k, formular }: { k: VgKontext; formular: StandardFormular }) {
  const konfig = standardKonfig(k.cfg, formular)
  return (
    <div className="bv-flaeche">
      <Zeile
        titel={k.darfEinstellen ? T.felderAnpassen : T.felderAnsehen} unter={felderZusammenfassung(konfig, formular)}
        pfeil={k.darfEinstellen} onClick={k.darfEinstellen ? () => k.oeffne('felder', formular) : undefined}
      />
      <Zeile titel={T.vorschau} unter={T.vorschauUnter} pfeil onClick={() => k.oeffne('vorschau', formular)} />
    </div>
  )
}

/** Zwei Knöpfe zum Verschieben, 44 px. */
export function Schieber({ oben, unten, onOben, onUnten, name }: { oben: boolean; unten: boolean; onOben: () => void; onUnten: () => void; name: string }) {
  return (
    <span className="vg-schieben">
      <button type="button" className="vg-schieb" disabled={!oben} onClick={onOben} aria-label={`${name} ${T.nachOben}`}><VgIcon n="hoch" /></button>
      <button type="button" className="vg-schieb" disabled={!unten} onClick={onUnten} aria-label={`${name} ${T.nachUnten}`}><VgIcon n="runter" /></button>
    </span>
  )
}

export default function FelderSeite({ k, id }: { k: VgKontext; id?: string }) {
  const [ordnung, setOrdnung] = useState<string[] | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  if (!istStandardFormular(id) || !formularFrei(k.org, id)) return <NichtDa k={k} />
  const formular = id
  if (!k.darfEinstellen) return <NichtDa k={k} titel={T.keinZugriffTitel} text={T.ohneSchreibrecht} />

  const konfig = standardKonfig(k.cfg, formular)
  const alle = bausteine(konfig, formular, { mitAusgeblendeten: true })
  const nach = new Map(alle.map((b) => [b.art === 'kern' ? b.id : b.feld.id, b]))
  const folge = ordnung ?? reihenfolgeAus(konfig, formular)
  const faehig = k.stand?.faehig?.eigene_felder?.[formular] === true
  const voll = konfig.eigene.length >= FELD_GRENZEN.eigene_standard

  async function fertig() {
    if (!ordnung) return
    const alt = reihenfolgeAus(konfig, formular)
    if (JSON.stringify(alt) === JSON.stringify(ordnung)) { setOrdnung(null); return }
    setLaeuft(true)
    const neu = ordnung
    const ok = await k.aendern((c) => standardSetzen(c, formular, (kk) => ({ ...kk, reihenfolge: neu })))
    setLaeuft(false)
    setOrdnung(null)
    if (ok) k.showMsg(T.reihenfolgeGespeichert)
  }

  const umschalter = ordnung
    ? <button type="button" className="vg-textknopf" onClick={() => { void fertig() }} disabled={laeuft}>{T.fertig}</button>
    : <button type="button" className="vg-textknopf" onClick={() => setOrdnung(reihenfolgeAus(konfig, formular))}>{T.reihenfolgeAendern}</button>

  return (
    <Seite titel={T.felderTitel} unter={standardLabel(formular)} zurueck={k.schliessen}>
      <Hinweis oben>{T.felderHinweis}</Hinweis>
      <Abschnitt titel={standardLabel(formular)} erst rechts={umschalter} />
      <div className="bv-flaeche">
        {folge.map((kennung, i) => {
          const b = nach.get(kennung)
          if (!b) return null
          const z = bausteinZeile(b)
          if (ordnung) {
            return (
              <div key={kennung} className="bv-z">
                <span className="bv-tx"><b>{z.titel}</b><small>{z.unter}</small></span>
                <Schieber name={z.titel} oben={i > 0} unten={i < folge.length - 1}
                  onOben={() => setOrdnung(verschieben(folge, i, -1))} onUnten={() => setOrdnung(verschieben(folge, i, 1))} />
              </div>
            )
          }
          return <Zeile key={kennung} titel={z.titel} unter={z.unter} pfeil onClick={() => k.oeffne('feld', `${formular}:${kennung}`)} />
        })}
        {!ordnung ? (
          <Zeile titel={T.eigenesHinzufuegen} art="neu" disabled={!faehig || voll} onClick={() => k.oeffne('feld', `${formular}:neu`)} />
        ) : null}
      </div>
      {!faehig ? <Hinweis>{T.eigeneSpaeter}</Hinweis> : voll ? <Hinweis>{T.eigeneVoll(FELD_GRENZEN.eigene_standard)}</Hinweis> : null}
      {formular !== 'cirs' ? <Hinweis>{T.absenderZuletzt}</Hinweis> : null}

      <div className="bv-flaeche vg-abstand">
        <Zeile titel={T.vorschau} unter={T.vorschauUnter} pfeil onClick={() => k.oeffne('vorschau', formular)} />
      </div>
    </Seite>
  )
}
