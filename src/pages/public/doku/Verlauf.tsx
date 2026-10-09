// Den Verlauf erfassen: eine Uhrzeit, dazu die Werte dieser Messung.
//
// Dieselbe Reihenfolge wie bei den Maßnahmen — die Uhrzeit steht vorweg und
// zeigt die aktuelle. Danach das Zahlenraster; eingetragen wird, was dasteht.
// Wer nur SpO₂ und Herzfrequenz misst, trägt zwei Zahlen ein und nicht neun.
//
// Was hier entsteht, sind die Spalten des Kurvenblatts: eine Spalte je
// Messung, in der Reihenfolge der Uhr.

import { useState } from 'react'
import { VERLAUFSWERTE } from '../../../katalog/verlaufswerte'
import { bewerten, type Werte } from './DokuFeld'
import {
  jetztZeit,
} from './massnahmen'
import {
  fehlendeZeitpunkte, spaltentext, verlaufEintragen, verlaufSortiert, verlaufStreichen,
} from './verlauf'

const ROT = 'var(--lbf-akzent)'
/** Der Akzent als gefüllte Fläche mit heller Schrift darauf. */
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

const AMPEL: Record<string, { rand: string; grund: string }> = {
  gut: { rand: '#86efac', grund: 'var(--lbf-ok-grund)' },
  warn: { rand: '#fde047', grund: 'var(--lbf-warn-grund)' },
  kritisch: { rand: '#fca5a5', grund: 'var(--lbf-fehler-grund)' },
}

export default function Verlauf({ werte, setWerte }: {
  werte: Werte
  setWerte: (f: (v: Werte) => Werte) => void
}) {
  const [zeit, setZeit] = useState('')
  const [eingabe, setEingabe] = useState<Record<string, string>>({})
  const gezeigteZeit = zeit || jetztZeit()
  const spalten = verlaufSortiert(werte)
  const ohneZeit = fehlendeZeitpunkte(werte)
  const etwasDa = VERLAUFSWERTE.some((v) => String(eingabe[v.id] ?? '').trim() !== '')

  function eintragen() {
    if (!etwasDa) return
    setWerte((v) => verlaufEintragen(v, { zeit: gezeigteZeit, werte: eingabe }))
    setEingabe({})
    setZeit('')
  }

  return (
    <div>
      {/* 1. Die Uhrzeit */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
            Uhrzeit
          </span>
          <input
            type="time" name="verlauf_zeit" value={gezeigteZeit}
            onChange={(e) => setZeit(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--lbf-input-bg)', border: `1px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 19, fontWeight: 600, color: TEXT }}
          />
        </label>
        {zeit ? (
          <button
            type="button" onClick={() => setZeit('')}
            style={{ padding: '9px 12px', marginBottom: 1, background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 999, color: ROT, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Jetzt
          </button>
        ) : (
          <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginBottom: 12 }}>
            aktuelle Uhrzeit
          </span>
        )}
      </div>

      {/* 2. Die Werte dieser Messung */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        Messwerte
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>
          nur was gemessen wurde
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginBottom: 10 }}>
        {VERLAUFSWERTE.map((v) => {
          const wert = eingabe[v.id] ?? ''
          const stand = bewerten(v.id === 'rr_sys' ? 'nibp_sys' : v.id === 'rr_dia' ? 'nibp_dia' : v.id, wert)
          const farbe = stand ? AMPEL[stand] : null
          return (
            <label key={v.id} style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: GRAU, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.label}
              </span>
              <span style={{ position: 'relative', display: 'block' }}>
                <input
                  name={`verlauf_${v.id}`} inputMode="decimal" value={wert}
                  onChange={(e) => setEingabe((s) => ({ ...s, [v.id]: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 30px 8px 9px', background: farbe ? farbe.grund : 'var(--lbf-input-bg)',
                    border: `1px solid ${farbe ? farbe.rand : LINIE}`, borderRadius: 8,
                    fontFamily: 'inherit', fontSize: 19, fontWeight: 600, color: TEXT, boxSizing: 'border-box',
                  }}
                />
                {v.einheit ? (
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: GRAU, pointerEvents: 'none' }}>
                    {v.einheit}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>

      <button
        type="button" onClick={eintragen} disabled={!etwasDa}
        style={{
          width: '100%', padding: '11px 12px',
          background: etwasDa ? ROT_GRUND : 'rgba(var(--lbf-rot-rgb),0.15)', border: 'none', borderRadius: 10,
          color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', cursor: etwasDa ? 'pointer' : 'default',
        }}
      >
        Um {gezeigteZeit} eintragen
      </button>

      {ohneZeit.length > 0 ? (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-warn-text)', lineHeight: 1.45 }}>
          {ohneZeit.join(' und ')} {ohneZeit.length === 1 ? 'hat' : 'haben'} Messwerte, aber keinen Zeitpunkt —
          {ohneZeit.length === 1 ? ' er steht' : ' sie stehen'} deshalb nicht auf der Kurve.
        </div>
      ) : null}

      {/* Die Spalten des Kurvenblatts, in der Reihenfolge der Uhr. */}
      {spalten.length > 0 ? (
        <div style={{ marginTop: 14, borderTop: `0.5px solid ${LINIE}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 2 }}>
            {spalten.length === 1 ? 'Eine Messung' : `${spalten.length} Messungen`}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>
              auf dem Kurvenblatt
            </span>
          </div>
          {spalten.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 0', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: ROT, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {s.zeit || '--:--'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontStyle: 'italic', color: TEXT, lineHeight: 1.4 }}>
                  {spaltentext(s)}
                </span>
                {/* Erstbefund und Übergabe stehen in ihren eigenen Blöcken;
                    hier sind sie nur zu sehen, damit niemand sie ein zweites
                    Mal einträgt. */}
                {s.quelle ? (
                  <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                    aus {s.titel ?? s.quelle} — dort geändert
                  </span>
                ) : null}
              </span>
              {s.quelle ? (
                <span style={{ fontSize: 19, lineHeight: 1, padding: '0 3px', color: 'transparent' }} aria-hidden>×</span>
              ) : (
                <button
                  type="button" onClick={() => setWerte((v) => verlaufStreichen(v, s.id))}
                  aria-label={`Messung ${s.zeit} streichen`}
                  style={{ background: 'none', border: 'none', color: GRAU, fontSize: 19, lineHeight: 1, padding: '0 3px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
