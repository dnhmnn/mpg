// Einsendungen eines eigenen Formulars (Bauplan Vorgänge, 3.8.2,
// ?seite=eingang&id=<vorlage>): Reiter Neu, In Bearbeitung, Archiv im Kopf, Suche
// über Absender und Werte, die gezeigte Liste als CSV. Eine Zeile öffnet die
// Einsendung (?seite=einsendung&id=<einsendung>).

import { useMemo, useState } from 'react'
import { Hinweis, Leer, Notiz, Seite, VgIcon, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'
import {
  EINGANG_ANSICHTEN, EINGANG_TEXTE as T, STATUS_NAME, ansichtLabel, csvDateiname, einsendungAnsicht, eingangCsv, felderDa,
  filtern, istAnsicht, sortieren, vorlageArchiviert, vorlageTitel, zaehlen, type EingangAnsicht, type EinsendungAnsicht,
} from '../../../lib/formular/eingang'
import { herunterladen } from '../../../lib/csv'
import { EIN_CSS } from './stil'
import { useVorlageEingang } from './useEingang'

/** Reiter und Suche je Formular für diese Sitzung merken (keine Inhalte der Einsendungen). */
function gemerkt(schluessel: string): string {
  try { return sessionStorage.getItem(schluessel) ?? '' } catch { return '' }
}
function merken(schluessel: string, wert: string) {
  try {
    if (wert) sessionStorage.setItem(schluessel, wert)
    else sessionStorage.removeItem(schluessel)
  } catch { /* privat oder voll: dann eben nicht */ }
}

export default function EinsendungenSeite({ k, id }: { k: VgKontext; id?: string }) {
  const vorlageId = id ?? ''
  const voll = vorgaengeVoll(k)
  const { daten, laedt, fehler, neuLaden } = useVorlageEingang(k, vorlageId)
  const [ansicht, setAnsichtRoh] = useState<EingangAnsicht>(() => {
    const g = gemerkt(`vg_eingang_ansicht_${vorlageId}`)
    return istAnsicht(g) ? g : 'neu'
  })
  const [suche, setSucheRoh] = useState(() => gemerkt(`vg_eingang_suche_${vorlageId}`))
  const setAnsicht = (a: EingangAnsicht) => { setAnsichtRoh(a); merken(`vg_eingang_ansicht_${vorlageId}`, a === 'neu' ? '' : a) }
  const setSuche = (s: string) => { setSucheRoh(s); merken(`vg_eingang_suche_${vorlageId}`, s) }

  const alle = useMemo(() => sortieren(daten.einsendungen.map((r) => einsendungAnsicht(r, daten.vorlage))), [daten.einsendungen, daten.vorlage])
  const zahlen = useMemo(() => zaehlen(daten.einsendungen), [daten.einsendungen])
  const gezeigt = useMemo(() => filtern(alle, ansicht, suche), [alle, ansicht, suche])
  const ohneFelder = daten.einsendungen.length > 0 && !felderDa(daten.einsendungen[0])

  const titel = daten.vorlage ? vorlageTitel(daten.vorlage) : T.eingang

  if (!voll) {
    return (
      <Seite titel={T.eingang} unter={k.orgName} zurueck={k.schliessen}>
        <Notiz titel={T.keinZugriffTitel}>{T.keinZugriff}</Notiz>
      </Seite>
    )
  }
  if (!laedt && !fehler && !daten.gefunden) {
    return (
      <Seite titel={T.nichtGefundenTitel} unter={k.orgName} zurueck={k.schliessen}>
        <Notiz titel={T.nichtGefundenTitel}>{T.vorlageNichtGefunden}</Notiz>
      </Seite>
    )
  }

  function csvLaden() {
    if (!gezeigt.length) { k.showMsg(T.csvLeer); return }
    herunterladen(csvDateiname(titel), eingangCsv(gezeigt.map((a) => a.rec), daten.vorlage), 'text/csv;charset=utf-8')
    k.showMsg(`${gezeigt.length} ${gezeigt.length === 1 ? 'Einsendung' : 'Einsendungen'} als CSV geladen`)
  }

  const csvKnopf = (
    <button type="button" className="bv-rund hell" aria-label={T.csv} title={T.csv} onClick={csvLaden} disabled={laedt || !gezeigt.length}>
      <VgIcon n="laden" />
    </button>
  )

  return (
    <Seite
      titel={titel} unter={T.eingang} zurueck={k.schliessen} rechts={csvKnopf}
      reiter={(
        <nav className="bv-reiter" role="tablist" aria-label={T.eingang}>
          {EINGANG_ANSICHTEN.map((a) => (
            <button key={a.wert} type="button" role="tab" aria-selected={ansicht === a.wert} onClick={() => setAnsicht(a.wert)}>
              {ansichtLabel(a.wert, zahlen)}
            </button>
          ))}
        </nav>
      )}
    >
      <style>{EIN_CSS}</style>
      {daten.vorlage && vorlageArchiviert(daten.vorlage) ? <Hinweis oben>Dieses Formular ist archiviert. Es nimmt nichts mehr an, der Eingang bleibt.</Hinweis> : null}
      {fehler ? (
        <div className="ein-meldung fehler" role="alert">
          <span>{fehler}</span>
          <button type="button" onClick={neuLaden}>{T.erneutLaden}</button>
        </div>
      ) : null}

      <div className="bv-suche">
        <VgIcon n="suche" className="bv-klein" />
        <input
          type="text" enterKeyHint="search" value={suche} onChange={(e) => setSuche(e.target.value)}
          placeholder={T.suchePlatzhalter} aria-label={T.sucheAria} autoComplete="off"
        />
        {suche ? <button type="button" aria-label={T.sucheLeeren} onClick={() => setSuche('')}><VgIcon n="kreuz" className="bv-klein" /></button> : null}
      </div>

      <div className="bv-flaeche" style={{ marginTop: 14 }}>
        {laedt && !alle.length ? (
          <Leer>{T.laedt}</Leer>
        ) : !gezeigt.length ? (
          <Leer>{suche.trim() ? T.leerSuche : T.leer[ansicht]}</Leer>
        ) : (
          gezeigt.map((a) => <EinsendungZeile key={a.id} a={a} onClick={() => k.oeffne('einsendung', a.id)} />)
        )}
      </div>
      {ohneFelder ? <Hinweis>{T.gesperrt}</Hinweis> : null}
    </Seite>
  )
}

function EinsendungZeile({ a, onClick }: { a: EinsendungAnsicht; onClick: () => void }) {
  return (
    <Zeile
      titel={a.name} onClick={onClick} pfeil
      label={`${a.name}, ${a.eingang}, ${STATUS_NAME[a.status]}`}
      unter={(
        <>
          <span className="ein-block">{[a.eingang, a.erster].filter(Boolean).join(' · ')}</span>
          {a.ausstehend ? <span className="ein-block ein-zusatz">Unterschrift ausstehend</span> : null}
        </>
      )}
      rechts={<span className={`ein-st ${a.status === 'neu' ? 'neu' : a.status === 'erledigt' ? 'erledigt' : ''}`}>{STATUS_NAME[a.status]}</span>}
    />
  )
}
