// Ruhezeit der Person (deutsche Zeit): an/aus, Von und Bis, Mitteilungen auch in der Ruhezeit.
// Uhrzeiten speichern nach dem Tippen (kurz verzögert) bzw. beim Verlassen des Felds.

import { useEffect, useRef, useState } from 'react'
import { Abschnitt } from '../benutzer/bausteine'
import { zeitLesen, zeitText, type PersonEinstellungen, type Ruhe } from '../../lib/push/regeln'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import { ruheJetztText } from './logik'
import { Schalter } from './Schalter'

function ZeitFeld({ label, wert, disabled, probe, onFertig }: {
  label: string; wert: string; disabled: boolean; probe: string; onFertig: (hhmm: string) => void
}) {
  const [v, setV] = useState(wert)
  const gespeichert = useRef(wert)
  const uhr = useRef<number | undefined>(undefined)
  useEffect(() => { gespeichert.current = wert; setV(wert) }, [wert])
  useEffect(() => () => window.clearTimeout(uhr.current), [])

  function fertig(roh: string) {
    window.clearTimeout(uhr.current)
    const m = zeitLesen(String(roh || '').slice(0, 5))
    if (m === null) { setV(gespeichert.current); return }
    const neu = zeitText(m)
    if (neu !== gespeichert.current) { gespeichert.current = neu; onFertig(neu) }
  }

  return (
    <label>
      <span className="bv-label"><span>{label}</span></span>
      <input type="time" step={300} className="bv-eingabe" value={v} disabled={disabled} data-probe={probe}
        onChange={(e) => {
          const x = e.target.value
          setV(x)
          window.clearTimeout(uhr.current)
          uhr.current = window.setTimeout(() => fertig(x), 900)
        }}
        onBlur={(e) => fertig(e.target.value)} />
    </label>
  )
}

export default function RuheAbschnitt({ person, jetzt, onRuhe, onMitteilungInRuhe }: {
  person: PersonEinstellungen
  jetzt: number
  onRuhe: (teil: Partial<Ruhe>) => void
  onMitteilungInRuhe: (an: boolean) => void
}) {
  const r = person.ruhe
  const gerade = ruheJetztText(r, jetzt)
  return (
    <>
      <Abschnitt titel={T.abschnittRuhe} />
      <div className="bv-flaeche">
        <Schalter probe="push-ruhe-schalter" titel={T.ruheTitel} unter={T.ruheUnter} an={r.an} onChange={(an) => onRuhe({ an })} />
        <div className="pu-zeiten">
          <ZeitFeld label={T.ruheVon} wert={r.von} disabled={!r.an} probe="push-ruhe-von" onFertig={(von) => onRuhe({ von })} />
          <ZeitFeld label={T.ruheBis} wert={r.bis} disabled={!r.an} probe="push-ruhe-bis" onFertig={(bis) => onRuhe({ bis })} />
        </div>
        <Schalter probe="push-ruhe-mitteilung" titel={T.ruheMitteilung} unter={person.mitteilung_in_ruhe ? undefined : T.ruheMitteilungUnter}
          an={person.mitteilung_in_ruhe} disabled={!r.an} onChange={onMitteilungInRuhe} />
      </div>
      {gerade && <p className="pu-jetzt" role="status" data-probe="push-ruhe-jetzt">{gerade}</p>}
    </>
  )
}
