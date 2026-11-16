// „Mitteilung an die Organisation“ (Owner 12.3): nur Leitung (Rolle admin) und Supervisor, nur an
// die eigene Organisation. Titel, Text, Vorschau (im Hub und auf dem Sperrbildschirm), Senden mit
// Rückfrage, Liste der aktiven Mitteilungen mit „Zurückziehen“. Der Server prüft dasselbe noch
// einmal (push.pb.js: Rolle, eigene Organisation, höchstens drei je 24 Stunden für die Leitung,
// Länge, kein HTML) und schickt bei 429 und 403 einen klaren Text, den die Seite unverändert zeigt.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Abschnitt, Feld, Hinweis } from '../benutzer/bausteine'
import { mitteilungenLaden, mitteilungSenden, mitteilungZurueckziehen, type Mitteilung } from '../../lib/push/api'
import { berlinTeile, zeitText } from '../../lib/push/regeln'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import { MITTEILUNG_TEXT_MAX, MITTEILUNG_TITEL_MAX, mitteilungPruefen, vorschauMitteilung, zeichenZahl, zeitpunktText } from './logik'
import { KeineAlarmierung } from './Schalter'

export default function MitteilungAbschnitt({ orgId, orgName, zeigen }: {
  orgId: string
  orgName: string
  zeigen: (text: string, fehler?: boolean) => void
}) {
  const [titel, setTitel] = useState('')
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<{ feld: 'title' | 'message' | null; text: string } | null>(null)
  const [rueckfrage, setRueckfrage] = useState(false)
  const [sendet, setSendet] = useState(false)
  const [liste, setListe] = useState<Mitteilung[] | null>(null)
  const [listeFehler, setListeFehler] = useState('')
  const [zieht, setZieht] = useState('')
  const rueckRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const laden = useCallback(async () => {
    const r = await mitteilungenLaden(orgId)
    if (r.liste) { setListe(r.liste); setListeFehler('') } else setListeFehler(r.text)
  }, [orgId])
  useEffect(() => { void laden() }, [laden])
  useEffect(() => { if (rueckfrage) rueckRef.current?.focus() }, [rueckfrage])

  const v = vorschauMitteilung({ orgName, titel, text })
  const nT = zeichenZahl(titel)
  const nX = zeichenZahl(text)

  function fragen() {
    const p = mitteilungPruefen(titel, text)
    if (!p.ok) { setFehler({ feld: p.feld, text: p.text }); setRueckfrage(false); return }
    setFehler(null)
    setRueckfrage(true)
  }

  async function senden() {
    setSendet(true)
    const r = await mitteilungSenden(orgId, titel, text)
    setSendet(false)
    setRueckfrage(false)
    if (r.ok) {
      setTitel('')
      setText('')
      setFehler(null)
      zeigen(T.mitteilungGesendet)
      void laden()
    } else {
      setFehler({ feld: null, text: r.text })
    }
  }

  async function zurueckziehen(m: Mitteilung) {
    if (!window.confirm(T.mitteilungZurueckFrage)) return
    setZieht(m.id)
    const r = await mitteilungZurueckziehen(m.id)
    setZieht('')
    if (r.ok) { zeigen(T.mitteilungZurueckgezogen); void laden() } else zeigen(r.text, true)
  }

  const jetzt = berlinTeile(Date.now())

  return (
    <section aria-labelledby={`${id}-titel`} data-probe="push-mitteilung">
      <div className="bv-ab erst"><h2 id={`${id}-titel`}>{T.abschnittMitteilung}</h2></div>
      <Hinweis oben>{T.mitteilungHinweis}</Hinweis>

      <Feld label={T.mitteilungTitel} zusatz={`${nT} von ${MITTEILUNG_TITEL_MAX}`} erst
        fehler={fehler?.feld === 'title' ? fehler.text : undefined}>
        <input className={`bv-eingabe${fehler?.feld === 'title' || nT > MITTEILUNG_TITEL_MAX ? ' fehler' : ''}`} value={titel} data-probe="push-mitteilung-titel"
          autoComplete="off" enterKeyHint="next" aria-invalid={fehler?.feld === 'title' || nT > MITTEILUNG_TITEL_MAX}
          onChange={(e) => { setTitel(e.target.value); setRueckfrage(false) }} />
      </Feld>
      <Feld label={T.mitteilungText} zusatz={`${nX} von ${MITTEILUNG_TEXT_MAX}`}
        fehler={fehler?.feld === 'message' ? fehler.text : undefined}>
        <textarea className={`bv-eingabe pu-text${fehler?.feld === 'message' || nX > MITTEILUNG_TEXT_MAX ? ' fehler' : ''}`} value={text} data-probe="push-mitteilung-text"
          aria-invalid={fehler?.feld === 'message' || nX > MITTEILUNG_TEXT_MAX}
          onChange={(e) => { setText(e.target.value); setRueckfrage(false) }} />
      </Feld>

      <p className="pu-vorschau-titel" id={`${id}-hub`}>{T.vorschauHub}</p>
      <div className="bv-flaeche" aria-labelledby={`${id}-hub`} data-probe="push-mitteilung-vorschau-hub">
        <div className="pu-hub">
          <small>{orgName ? `Mitteilung von ${orgName}` : 'Mitteilung deiner Organisation'}</small>
          <h3 className={titel.trim() ? undefined : 'pu-leer'}>{titel.trim() || T.vorschauLeerTitel}</h3>
          {text.trim() && <p>{text}</p>}
        </div>
      </div>

      <p className="pu-vorschau-titel" id={`${id}-sperr`}>{T.vorschauSperr}</p>
      <div className="pu-sperr" aria-labelledby={`${id}-sperr`} data-probe="push-mitteilung-vorschau-sperr">
        <div className="pu-mitt">
          <img src="/push-symbol-192.png" alt="" />
          <div className="pu-mitt-tx">
            <div className="pu-mitt-kopf"><span>Responda</span><span>{zeitText(jetzt.minutenImTag)}</span></div>
            <b>{titel.trim() ? v.titel : vorschauMitteilung({ orgName, titel: T.vorschauLeerTitel, text: '' }).titel}</b>
            {v.text && <p>{v.text}</p>}
          </div>
        </div>
      </div>
      <Hinweis>{T.vorschauSperrHinweis}</Hinweis>

      {!rueckfrage && (
        <div className="pu-senden">
          <button type="button" className="pu-primaer" data-probe="push-mitteilung-senden" disabled={sendet} onClick={fragen}>{T.mitteilungSenden}</button>
        </div>
      )}
      {rueckfrage && (
        <div className="bv-notiz pu-rueckfrage" ref={rueckRef} tabIndex={-1} role="group" aria-labelledby={`${id}-frage`} data-probe="push-mitteilung-rueckfrage">
          <p id={`${id}-frage`}>{T.mitteilungRueckfrage}</p>
          <div className="pu-knoepfe">
            <button type="button" className="bv-knopf" disabled={sendet} onClick={() => setRueckfrage(false)}>{T.mitteilungAbbrechen}</button>
            <button type="button" className="pu-primaer" disabled={sendet} data-probe="push-mitteilung-jetzt-senden" onClick={() => void senden()}>
              {sendet ? T.mitteilungSendet : T.mitteilungJetztSenden}
            </button>
          </div>
        </div>
      )}
      {fehler && fehler.feld === null && <p className="bv-fehltext" role="alert" data-probe="push-mitteilung-fehler">{fehler.text}</p>}

      <KeineAlarmierung text={T.keineAlarmierung} />

      <Abschnitt titel={T.mitteilungAktiv} rechts={liste && liste.length ? String(liste.length) : undefined} />
      <div className="bv-flaeche" data-probe="push-mitteilung-liste">
        {liste === null && !listeFehler && <div className="pu-zustand" role="status"><p>{T.laedt}</p></div>}
        {listeFehler && <div className="pu-zustand"><p>{listeFehler}</p></div>}
        {liste && !liste.length && <div className="pu-zustand"><p>{T.mitteilungKeine}</p></div>}
        {liste && liste.map((m) => (
          <div key={m.id} className="bv-z pu-geraet" data-probe={`push-mitteilung-${m.id}`}>
            <span className="bv-tx pu-mitteilung" style={{ padding: 0 }}>
              <b>{m.title}</b>
              {zeitpunktText(m.created) && <small>{zeitpunktText(m.created)}</small>}
              {m.message && <p>{m.message}</p>}
            </span>
            <button type="button" className="bv-knopf" disabled={!!zieht} data-probe={`push-mitteilung-zurueckziehen-${m.id}`}
              aria-label={`Mitteilung „${m.title}“ zurückziehen`} onClick={() => void zurueckziehen(m)}>
              {zieht === m.id ? '…' : T.mitteilungZurueckziehen}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
