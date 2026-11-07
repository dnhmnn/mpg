// Ein ausstehendes Patientenprotokoll ohne Unterschrift abschließen
// (Bauplan v2, 1.8, 4.10; PO-Entscheidung 1, Notausgang).
//
// Für den Fall, dass der Absender nie unterschreibt: kein Konto mehr, kein
// Passwort, nicht mehr im Dienst. Die Leitung oder wer das Recht
// „Patientendokumentation“ hat, schließt es mit Begründung ab. Der Server
// prüft Recht und Begründung (10 bis 500 Zeichen), speichert sie im payload,
// gibt das Protokoll frei und lässt es als nicht bestätigt gekennzeichnet.

import { useEffect, useId, useState } from 'react'
import { istFehler, ohneUnterschrift, TEXTE } from '../lib/formular/api'
import { DIALOG_TEXTE as T, GRUND_MAX, grundPruefen, ohneUnterschriftErklaerung } from '../lib/formular/verwaltung'
import { DialogKnoepfe, DialogMeldung, DialogRahmen } from './UnterschreibenDialog'

const ROT = 'var(--lbf-akzent)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'

export default function OhneUnterschriftDialog(p: {
  id: string
  absenderName: string
  offen: boolean
  onZu: () => void
  /** Nach dem Abschließen: Listen neu laden. Der Dialog bleibt offen, bis `onZu`. */
  onFertig: () => void
  /** Schon abgeschlossen, unterschrieben oder verschwunden (409, 404): die Liste stimmt nicht mehr, neu laden. */
  onVeraltet?: () => void
  /** Wofür, etwa der Name des Patienten. */
  titel?: string
}) {
  const feld = useId()
  const [grund, setGrund] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [fertig, setFertig] = useState(false)
  const [versucht, setVersucht] = useState(false)

  useEffect(() => {
    if (p.offen) { setGrund(''); setFehler(''); setFertig(false); setLaeuft(false); setVersucht(false) }
  }, [p.offen, p.id])

  if (!p.offen) return null

  const pruefung = grundPruefen(grund)

  async function los() {
    if (laeuft || fertig) return
    setVersucht(true)
    if (!pruefung.gueltig) { setFehler(T.grundZuKurz); return }
    setLaeuft(true)
    setFehler('')
    try {
      const r = await ohneUnterschrift(p.id, grund)
      if (istFehler(r)) {
        // Nie stumm: ohne Text des Servers der allgemeine Rückfall
        setFehler(r.text || TEXTE.server)
        if (r.grund === 'schon_bestaetigt' || r.grund === 'nicht_gefunden') p.onVeraltet?.()
        return
      }
      setFertig(true)
      p.onFertig()
    } finally {
      setLaeuft(false)
    }
  }

  const zuKurz = versucht && !pruefung.gueltig

  return (
    <DialogRahmen titel={T.ohneTitel} untertitel={p.titel} beschaeftigt={laeuft} onZu={p.onZu}>
      <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{ohneUnterschriftErklaerung(p.absenderName)}</div>
      {!fertig ? (
        <div style={{ marginTop: 14 }}>
          <label htmlFor={feld} style={{ display: 'block', fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
            {T.grundLabel}
          </label>
          <textarea
            id={feld} value={grund} rows={4} maxLength={GRUND_MAX} disabled={laeuft}
            onChange={(e) => { setGrund(e.target.value); if (fehler === T.grundZuKurz) setFehler('') }}
            placeholder={T.grundPlatzhalter}
            aria-invalid={zuKurz} aria-describedby={`${feld}-zaehler`}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, resize: 'vertical',
              border: `0.5px solid ${zuKurz ? '#d97706' : 'rgba(var(--lbf-rot-rgb),0.2)'}`,
              background: 'var(--lbf-input-bg)', color: TEXT, fontFamily: 'inherit', fontSize: 16, lineHeight: 1.45, outline: 'none',
            }}
          />
          <div id={`${feld}-zaehler`} style={{ fontSize: 11, fontStyle: 'italic', color: pruefung.gueltig ? GRAU : (zuKurz ? 'var(--lbf-warn-text-2)' : GRAU), marginTop: 4, textAlign: 'right' }}>
            {pruefung.zaehler}
          </div>
        </div>
      ) : null}
      {fehler ? <DialogMeldung art="fehler">{fehler}</DialogMeldung> : null}
      {fertig ? <DialogMeldung art="ok">{T.abgeschlossen}</DialogMeldung> : null}
      {fertig ? (
        <DialogKnoepfe neben={T.schliessen} onNeben={p.onZu} />
      ) : (
        <DialogKnoepfe
          haupt={laeuft ? T.schliesstAb : T.abschliessen} onHaupt={() => void los()} hauptAus={laeuft || pruefung.laenge === 0}
          neben={T.abbrechen} onNeben={() => { if (!laeuft) p.onZu() }}
        />
      )}
    </DialogRahmen>
  )
}
