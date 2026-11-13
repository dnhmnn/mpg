// Reiter „Formulare“ unter Vorgänge (Bauplan Vorgänge, 3.4): die
// Standardformulare als ruhige Zeilen, danach die Abschnitte der
// Erweiterungen (E: „Eigene Formulare“), unten der Weg zur Seite der
// Organisation.

import { formularFrei } from '../../lib/freigabe'
import { Abschnitt, Hinweis, Leer, VgIcon, Zeile } from './bausteine'
import { ERWEITERUNGEN } from './erweiterung'
import type { VgKontext } from './kontext'
import { STANDARD_FORMULARE, formularZeile, orgSeiteLink, vorgaengeVoll } from './logik'
import { VG_TEXTE as T } from './texte'

export default function FormulareReiter({ k }: { k: VgKontext }) {
  const frei = STANDARD_FORMULARE.filter((f) => formularFrei(k.org, f.id))
  const voll = vorgaengeVoll(k)
  return (
    <>
      <Abschnitt titel={T.standardformulare} erst />
      {frei.length === 0 ? (
        <div className="bv-flaeche"><Leer>{T.keinFormularFrei}</Leer></div>
      ) : (
        <div className="bv-flaeche">
          {frei.map((f) => (
            <Zeile key={f.id} titel={f.label} unter={formularZeile(f.id, k.cfg)} pfeil onClick={() => k.oeffne('formular', f.id)} />
          ))}
        </div>
      )}

      {/* Eigene Formulare und was sonst zu den Formularen gehört: nur mit Modul und Recht Vorgänge */}
      {voll ? ERWEITERUNGEN.map((e, i) => {
        const F = e.Formulare
        return F ? <F key={i} k={k} /> : null
      }) : null}

      <Hinweis>{T.hinweisAktiv}</Hinweis>
      {k.orgCode ? (
        <div className="bv-flaeche vg-abstand">
          <Zeile
            titel={T.orgSeite} unter={<span className="vg-adresse">{orgSeiteLink(k.orgCode)}</span>}
            onClick={() => window.open(orgSeiteLink(k.orgCode), '_blank', 'noopener,noreferrer')}
            rechts={<VgIcon n="oeffnen" className="vg-icon-rechts" />}
          />
        </div>
      ) : null}
    </>
  )
}
