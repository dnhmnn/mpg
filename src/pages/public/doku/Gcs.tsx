// Die Glasgow Coma Scale erheben, nicht eintippen.
//
// Drei Zahlenfelder und eine Summe standen hier. Wer die Skala nicht im Kopf
// hat, trägt nichts ein; wer sie im Kopf hat, rechnet unter Zeitdruck falsch.
// Angetippt öffnet sich das Schema, man wählt je Teil die Antwort, und die
// Summe steht da, bevor man sie gerechnet hat.
//
// Die Punkte stehen an den Antworten, wie die Norm sie führt — eine 4 bei
// "Verbal" heißt "konversationsfähig, verwirrt", und genau das steht da.

import { useState } from 'react'
import { aelrdFeld } from '../../../katalog/aelrd'
import { gcsFelder, gcsSkalen, gcsSchwere, gcsSumme, gcsSummeFeld } from '../../../katalog/gcs'
import type { Werte } from './DokuFeld'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

function zahl(w: unknown): number | null {
  const t = String(w ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function Gcs({ werte, setWerte, vorsatz = '' }: {
  werte: Werte
  setWerte: (f: (v: Werte) => Werte) => void
  /** 'ub_' für die Übergabe — dieselbe Skala, andere Felder. */
  vorsatz?: string
}) {
  const [offen, setOffen] = useState(false)
  const [wahl, setWahl] = useState<Record<string, number | null>>({})

  const skalen = gcsSkalen(vorsatz)
  const summeFeld = gcsSummeFeld(vorsatz)
  const imProtokoll = skalen.map((s) => zahl(werte[s.feld]))
  const summeImProtokoll = zahl(werte[summeFeld])

  function oeffnen() {
    // Was schon dasteht, steht beim Öffnen gewählt da.
    const start: Record<string, number | null> = {}
    skalen.forEach((s, i) => { start[s.feld] = imProtokoll[i] })
    setWahl(start)
    setOffen(true)
  }

  const gewaehlt = skalen.map((s) => wahl[s.feld] ?? null)
  const summe = gcsSumme(gewaehlt)

  function uebernehmen() {
    setWerte((v) => {
      const aus = { ...v }
      skalen.forEach((s) => {
        const p = wahl[s.feld]
        aus[s.feld] = p === null || p === undefined ? '' : String(p)
      })
      aus[summeFeld] = summe === null ? '' : String(summe)
      return aus
    })
    setOffen(false)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        Glasgow Coma Scale
      </div>
      <button
        type="button" onClick={oeffnen}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 12px', background: '#fff', border: `0.5px solid ${LINIE}`,
          borderRadius: 10, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 800, color: summeImProtokoll === null ? GRAU : ROT, lineHeight: 1, minWidth: 34 }}>
          {summeImProtokoll ?? '–'}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TEXT }}>
            {summeImProtokoll === null ? 'GCS erheben' : `GCS ${summeImProtokoll} · ${gcsSchwere(summeImProtokoll)}`}
          </span>
          <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            {imProtokoll.some((p) => p !== null)
              // Die kurzen Namen des Bogens: Augen, Verbal, Motorik — die
              // Überschriften der Norm beginnen zweimal mit "Beste".
              ? skalen.map((s, i) => `${aelrdFeld(s.feld)?.label ?? s.titel} ${imProtokoll[i] ?? '–'}`).join(' · ')
              : 'Schema öffnen, Antworten wählen'}
          </span>
        </span>
        <span style={{ fontSize: 11, fontStyle: 'italic', color: ROT }}>öffnen</span>
      </button>

      {offen ? (
        <div
          role="dialog" aria-label="Glasgow Coma Scale"
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column' }}
        >
          <header style={{ flexShrink: 0, background: '#fff', borderBottom: `0.5px solid ${LINIE}`, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Glasgow Coma Scale</div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                je Teil die beste Antwort · nach DIVI
              </div>
            </div>
            <span style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              minWidth: 54, padding: '4px 8px', borderRadius: 10,
              background: summe === null ? 'rgba(96,8,18,0.06)' : ROT,
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: summe === null ? GRAU : '#fff' }}>
                {summe ?? '–'}
              </span>
              <span style={{ fontSize: 9, fontStyle: 'italic', color: summe === null ? GRAU : 'rgba(255,255,255,0.8)' }}>
                {summe === null ? 'offen' : gcsSchwere(summe)}
              </span>
            </span>
            <button
              type="button" onClick={() => setOffen(false)} aria-label="Schließen"
              style={{ background: 'none', border: 'none', color: GRAU, fontSize: 24, lineHeight: 1, padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ×
            </button>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {skalen.map((s) => (
              <div key={s.feld} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT, marginBottom: 5 }}>
                  {s.titel}
                </div>
                {s.stufen.map((st) => {
                  const an = wahl[s.feld] === st.punkte
                  return (
                    <button
                      key={st.punkte} type="button"
                      onClick={() => setWahl((w) => ({ ...w, [s.feld]: an ? null : st.punkte }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '9px 11px', marginBottom: 4,
                        background: an ? ROT : '#fff',
                        border: `0.5px solid ${an ? ROT : LINIE}`, borderRadius: 9,
                        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, flexShrink: 0, borderRadius: 13,
                        background: an ? '#fff' : 'rgba(96,8,18,0.06)',
                        color: an ? ROT : ROT, fontSize: 14, fontWeight: 800,
                      }}>
                        {st.punkte}
                      </span>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: an ? 700 : 400, color: an ? '#fff' : TEXT }}>
                        {st.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div style={{ flexShrink: 0, background: '#fff', borderTop: `0.5px solid ${LINIE}`, padding: '10px 12px', display: 'flex', gap: 8 }}>
            <button
              type="button" onClick={() => setOffen(false)}
              style={{ flex: 1, padding: '11px 12px', background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 12, color: GRAU, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Abbrechen
            </button>
            <button
              type="button" onClick={uebernehmen}
              style={{
                flex: 2, padding: '11px 12px', border: 'none', borderRadius: 12,
                background: ROT, color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {summe === null ? 'Übernehmen' : `GCS ${summe} übernehmen`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
