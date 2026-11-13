// Seite eines Standardformulars (Bauplan Vorgänge, 3.5): `?seite=formular&id=<formular>`.
//
// 1. Öffentlicher Link (Schalter, schreibt `hidden_forms`)
// 2. Absender (Patienten, Produktausgabe, Defektmeldung; CIRS ist anonym)
// 3. Link und QR-Code
// 4. Felder: Patientendoku fest (PO 2), die anderen über die Erweiterung (E)
//
// Jede Wahl speichert sofort über k.aendern (frisch gelesen, nacheinander);
// Rückmeldung „Gespeichert“ als Toast. Ohne darfEinstellen nur zum Ansehen.

import { useNavigate } from 'react-router-dom'
import { formularFrei } from '../../lib/freigabe'
import { hatRecht } from '../../lib/apps'
import { absenderModus } from '../../lib/formular/absender'
import { absenderSetzen } from '../../lib/formular/einstellung'
import { VORGAENGE_TEXTE as VT, hatAbsenderWahl } from '../../lib/formular/verwaltung'
import { frueherEigeneFelder } from '../../lib/patientenAltfelder'
import AbsenderWahl from './AbsenderWahl'
import LinkTeilen from './LinkTeilen'
import { Abschnitt, Hinweis, Notiz, SchalterZeile, Seite } from './bausteine'
import { ERWEITERUNGEN } from './erweiterung'
import type { VgKontext } from './kontext'
import {
  formularLink, istAnpassbar, istStandardId, oeffentlichAn, schalterText, standardLabel, versteckteSetzen, type VgModus,
} from './logik'
import { VG_TEXTE as T, frueherText } from './texte'

export default function StandardSeite({ k, id }: { k: VgKontext; id?: string }) {
  const navigate = useNavigate()
  const formular = id ?? ''
  if (!istStandardId(formular) || !formularFrei(k.org, formular)) {
    return (
      <Seite titel={T.nichtGefundenTitel} unter={k.orgName} zurueck={k.schliessen}>
        <Notiz titel={T.nichtGefundenTitel}>{T.nichtGefunden}</Notiz>
      </Seite>
    )
  }

  const label = standardLabel(formular)
  const darf = k.darfEinstellen
  const an = oeffentlichAn(k.cfg, formular)
  const anpassbar = istAnpassbar(formular) ? formular : null
  const FelderAbschnitt = anpassbar ? ERWEITERUNGEN.find((e) => e.StandardAbschnitt)?.StandardAbschnitt : undefined
  const frueher = formular === 'patienten' ? frueherEigeneFelder(k.cfg) : 0

  async function speichern(fn: Parameters<VgKontext['aendern']>[0]) {
    if (await k.aendern(fn)) k.showMsg(T.gespeichert)
  }

  function oeffentlichSetzen(neu: boolean) {
    if (!darf || neu === an) return
    void speichern((c) => ({ ...c, hidden_forms: versteckteSetzen(c.hidden_forms, formular, neu) }))
  }

  function absenderWaehlen(m: VgModus) {
    if (!darf || !hatAbsenderWahl(formular) || m === 'anonym') return
    if (absenderModus(k.cfg, formular) === m) return
    void speichern((c) => absenderSetzen(c, formular, m))
  }

  return (
    <Seite titel={label} unter={k.orgName} zurueck={k.schliessen}>
      {!darf ? <Hinweis oben>{VT.ohneSchreibrecht}</Hinweis> : null}

      <Abschnitt titel={T.oeffentlicherLink} erst />
      <div className="bv-flaeche">
        <SchalterZeile titel={T.erreichbar} unter={schalterText(formular, an)} an={an} onChange={oeffentlichSetzen} disabled={!darf} />
      </div>

      <Abschnitt titel={T.absender} />
      {hatAbsenderWahl(formular) ? (
        <AbsenderWahl
          modi={['passwort', 'frei']} modus={absenderModus(k.cfg, formular)} darf={darf} onWahl={absenderWaehlen}
          label={`${T.absenderAria} ${label}`} pruefung={k.pruefung}
          benutzerLink={hatRecht(k.user, 'unitarii')}
          onBenutzer={() => navigate('/unitarii')}
          onPerson={(pid) => navigate(`/unitarii?seite=person&id=${encodeURIComponent(pid)}`)}
        />
      ) : (
        <Notiz>{VT.cirs}</Notiz>
      )}

      {k.orgCode ? (
        <>
          <Abschnitt titel={T.linkUndQr} />
          <LinkTeilen url={formularLink(k.orgCode, formular)} titel={label} orgName={k.orgName} onMeldung={k.showMsg} />
          {formular === 'cirs' && !an ? <Hinweis>{T.cirsLinkAus}</Hinweis> : null}
        </>
      ) : null}

      {formular === 'patienten' ? (
        <>
          <Abschnitt titel={T.felder} />
          <Notiz titel={T.festTitel}>
            <p>{T.festText}</p>
            {frueher > 0 ? <p>{frueherText(frueher)} {T.naep}</p> : null}
          </Notiz>
        </>
      ) : anpassbar && FelderAbschnitt ? (
        <>
          <Abschnitt titel={T.felder} />
          <FelderAbschnitt k={k} formular={anpassbar} />
        </>
      ) : null}
    </Seite>
  )
}
