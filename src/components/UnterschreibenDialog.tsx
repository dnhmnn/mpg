// Einen ausstehenden Eintrag als die angemeldete Person unterschreiben
// (Bauplan v2, 1.7, 4.9).
//
// „Unterschrift ausstehend“ heißt: Das Formular kam ohne Passwort aus der
// Warteschlange eines Geräts, der Name passt genau auf diese Person. Erst mit
// ihrer Unterschrift gilt sie als Absender, beginnt die Frist und wird die
// Besatzung verknüpft. Ob sie unterschreiben darf, entscheidet der Server;
// sein Text steht bei einem Fehler im Dialog.
//
// „Das war ich nicht“: wer den Eintrag nicht abgegeben hat, unterschreibt
// nicht, sondern weist ihn zurück (Route /zurueckweisen). Die Patientendoku
// geht dann an die Leitung („Ohne Unterschrift abschließen“), Produktausgabe,
// Defektmeldung und eigene Formulare stehen danach ohne Konto unter dem
// eingetragenen Namen.
//
// Der Rahmen (`DialogRahmen`) dient auch dem Dialog „Ohne Unterschrift
// abschließen“ (OhneUnterschriftDialog.tsx).

import { useEffect, useId, useRef, useState } from 'react'
import { istFehler, TEXTE, unterschreiben, zurueckweisen } from '../lib/formular/api'
import type { FormularArt } from '../lib/formular/absender'
import { DIALOG_TEXTE as T, UNTERSCHREIBEN_TEXT, ZURUECKGEWIESEN_TEXT, ZURUECKWEISEN_TEXT } from '../lib/formular/verwaltung'

const ROT = 'var(--lbf-akzent)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'

/** Der gemeinsame Rahmen beider Dialoge: Abdunkelung, Karte, Abschnittslabel, Titel. */
export function DialogRahmen({ titel, untertitel, beschaeftigt, onZu, children }: {
  titel: string
  untertitel?: string
  beschaeftigt: boolean
  onZu: () => void
  children: React.ReactNode
}) {
  const kennung = useId()
  const karte = useRef<HTMLDivElement>(null)

  // Escape schließt, solange nichts läuft; der Fokus geht in den Dialog
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && !beschaeftigt) onZu() }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [beschaeftigt, onZu])
  useEffect(() => { karte.current?.focus() }, [])

  return (
    <div
      onClick={() => { if (!beschaeftigt) onZu() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3200, background: 'rgba(26,14,8,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        ref={karte} role="dialog" aria-modal="true" aria-labelledby={kennung} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box',
          background: 'var(--lbf-card)', borderRadius: 14, borderLeft: `3px solid ${ROT}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)', padding: '20px 20px 18px', outline: 'none',
          fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{titel}</div>
        {untertitel ? (
          <div id={kennung} style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: TEXT, lineHeight: 1.25, marginBottom: 12, overflowWrap: 'anywhere' }}>{untertitel}</div>
        ) : <div id={kennung} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{titel}</div>}
        {children}
      </div>
    </div>
  )
}

/** Fehler- oder Erfolgszeile im Dialog. */
export function DialogMeldung({ art, children }: { art: 'fehler' | 'ok'; children: React.ReactNode }) {
  const fehler = art === 'fehler'
  return (
    <div role={fehler ? 'alert' : 'status'} style={{
      marginTop: 12, padding: '8px 11px', borderRadius: 10, fontSize: 13, fontStyle: 'italic', lineHeight: 1.45,
      background: fehler ? 'var(--lbf-warn-grund)' : 'var(--lbf-ok-grund)',
      border: fehler ? '0.5px solid #fde047' : '0.5px solid #bbf7d0',
      color: fehler ? 'var(--lbf-warn-text)' : 'var(--lbf-ok-text)',
    }}>
      {children}
    </div>
  )
}

/** Die Knopfzeile: rechts der Hauptknopf, links davon ein Textknopf. */
export function DialogKnoepfe({ haupt, onHaupt, hauptAus, neben, onNeben }: {
  haupt?: string
  onHaupt?: () => void
  hauptAus?: boolean
  neben: string
  onNeben: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
      <button
        type="button" onClick={onNeben}
        style={{ background: 'none', border: 'none', padding: '8px 2px', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: GRAU, cursor: 'pointer' }}
      >
        {neben}
      </button>
      {haupt ? (
        <button
          type="button" onClick={onHaupt} disabled={hauptAus}
          style={{
            padding: '10px 18px', border: 'none', borderRadius: 10, fontFamily: 'inherit',
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            background: hauptAus ? 'rgba(var(--lbf-rot-rgb),0.25)' : 'var(--lbf-akzent-grund)', color: '#fff',
            cursor: hauptAus ? 'default' : 'pointer',
          }}
        >
          {haupt}
        </button>
      ) : null}
    </div>
  )
}

export default function UnterschreibenDialog(p: {
  /** Auch eigene Formulare (`eigen`, Einsendungen in form_submissions). */
  formular: FormularArt
  id: string
  offen: boolean
  onZu: () => void
  /** Nach dem Unterschreiben: Listen neu laden. Der Dialog bleibt offen, bis `onZu`. */
  onFertig: () => void
  /** Schon unterschrieben oder verschwunden (409, 404): die Liste stimmt nicht mehr, neu laden. */
  onVeraltet?: () => void
  /** Wofür unterschrieben wird, etwa der Name des Patienten. */
  titel?: string
}) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [fertig, setFertig] = useState(false)
  /** „Das war ich nicht“: erst die Rückfrage, dann erledigt. */
  const [zurueck, setZurueck] = useState<'' | 'frage' | 'fertig'>('')

  // Neu geöffnet oder ein anderer Eintrag: von vorn
  useEffect(() => { if (p.offen) { setFehler(''); setFertig(false); setLaeuft(false); setZurueck('') } }, [p.offen, p.id, p.formular])

  if (!p.offen) return null

  async function los() {
    if (laeuft || fertig) return
    setLaeuft(true)
    setFehler('')
    try {
      const r = await unterschreiben(p.formular, p.id)
      if (istFehler(r)) {
        // Nie stumm: ohne Text des Servers der allgemeine Rückfall
        setFehler(r.text || TEXTE.server)
        // Schon unterschrieben oder verschwunden: die Listen stimmen nicht mehr
        if (r.grund === 'schon_bestaetigt' || r.grund === 'nicht_gefunden') p.onVeraltet?.()
        return
      }
      setFertig(true)
      p.onFertig()
    } finally {
      setLaeuft(false)
    }
  }

  async function zurueckweisenLos() {
    if (laeuft || fertig || zurueck === 'fertig') return
    setLaeuft(true)
    setFehler('')
    try {
      const r = await zurueckweisen(p.formular, p.id)
      if (istFehler(r)) {
        setFehler(r.text || TEXTE.server)
        if (r.grund === 'schon_bestaetigt' || r.grund === 'nicht_gefunden') p.onVeraltet?.()
        return
      }
      setZurueck('fertig')
      p.onFertig()
    } finally {
      setLaeuft(false)
    }
  }

  const erledigt = fertig || zurueck === 'fertig'
  return (
    <DialogRahmen titel={zurueck ? T.warIchNicht : T.unterschreibenTitel} untertitel={p.titel} beschaeftigt={laeuft} onZu={p.onZu}>
      <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{zurueck ? ZURUECKWEISEN_TEXT[p.formular] : UNTERSCHREIBEN_TEXT[p.formular]}</div>
      {!zurueck && !erledigt ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.45 }}>{T.warIchNichtHinweis}</div>
          <button
            type="button" onClick={() => { if (!laeuft) { setFehler(''); setZurueck('frage') } }}
            style={{ background: 'none', border: 'none', padding: '6px 0 0', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: ROT, cursor: 'pointer' }}
          >
            {T.warIchNicht}
          </button>
        </div>
      ) : null}
      {fehler ? <DialogMeldung art="fehler">{fehler}</DialogMeldung> : null}
      {fertig ? <DialogMeldung art="ok">{T.unterschrieben}</DialogMeldung> : null}
      {zurueck === 'fertig' ? <DialogMeldung art="ok">{ZURUECKGEWIESEN_TEXT[p.formular]}</DialogMeldung> : null}
      {erledigt ? (
        <DialogKnoepfe neben={T.schliessen} onNeben={p.onZu} />
      ) : zurueck === 'frage' ? (
        <DialogKnoepfe
          haupt={laeuft ? T.weistZurueck : T.warIchNicht} onHaupt={() => void zurueckweisenLos()} hauptAus={laeuft}
          neben={T.zurueck} onNeben={() => { if (!laeuft) { setFehler(''); setZurueck('') } }}
        />
      ) : (
        <DialogKnoepfe
          haupt={laeuft ? T.unterschreibt : T.unterschreiben} onHaupt={() => void los()} hauptAus={laeuft}
          neben={T.abbrechen} onNeben={() => { if (!laeuft) p.onZu() }}
        />
      )}
    </DialogRahmen>
  )
}
