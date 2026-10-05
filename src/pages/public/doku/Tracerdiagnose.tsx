// Die Diagnose antippen statt tippen.
//
// Erst die Organgruppe, dann die Diagnose — und sobald eine steht, treten die
// Listen ab und hinterlassen eine Zeile. Dasselbe Verfahren wie bei den
// Maßnahmen: auf einem Telefon ist der Platz unter dem Daumen das knappste
// Gut, nicht die Zahl der Tipper.
//
// Die Liste ist die der Norm (DIVI 6.0, Abschnitt E01). Sie ist nicht die
// amtliche Tracerdiagnosen-Liste der ÄLRD — der Freitext bleibt deshalb
// erreichbar, damit niemand zu einer Diagnose gezwungen wird, die er nicht
// meint.
//
// Die gewählte Gruppe landet in der führenden Diagnose; dort steht sie als
// eigene Zeile des Bogens und lässt sich auch allein wählen, wenn die
// Diagnose ein eigener Text ist. Die Kopplung steht in diagnose.ts.

import { useState } from 'react'
import { TRACER_GRUPPEN, tracerGruppeVon } from '../../../katalog/tracerdiagnosen'
import { Knopf } from './DokuFeld'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

export default function Tracerdiagnose({ wert, onChange }: {
  wert: string
  onChange: (w: string) => void
}) {
  const [gruppe, setGruppe] = useState('')
  const [frei, setFrei] = useState('')
  const gesetzt = wert.trim()
  const g = TRACER_GRUPPEN.find((x) => x.code === gruppe)
  const ausListe = tracerGruppeVon(gesetzt)

  function waehlen(text: string) {
    onChange(text.trim())
    setGruppe('')
    setFrei('')
  }

  // Steht eine Diagnose, ist das die ganze Anzeige: eine Zeile zum Ändern.
  if (gesetzt) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
          Tracerdiagnose
        </div>
        <button
          type="button" onClick={() => onChange('')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 11px', background: ROT, border: `0.5px solid ${ROT}`, borderRadius: 8,
            fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontStyle: 'italic', fontWeight: 700, color: '#fff' }}>
              {gesetzt}
            </span>
            <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.75)' }}>
              {ausListe ? ausListe.titel : 'eigener Text'}
            </span>
          </span>
          <span style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.75)' }}>ändern</span>
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        Tracerdiagnose
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>
          {g ? 'Diagnose wählen' : 'nach Organgruppe'}
        </span>
      </div>

      {g ? (
        <>
          <button
            type="button" onClick={() => setGruppe('')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%', marginBottom: 8,
              padding: '8px 11px', background: 'rgba(96,8,18,0.05)',
              border: `0.5px solid ${LINIE}`, borderRadius: 8,
              fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: ROT, lineHeight: 1 }}>‹</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: ROT }}>{g.titel}</span>
            <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>andere Gruppe</span>
          </button>
          <div>
            {g.diagnosen.map((d) => (
              <Knopf key={d.code} text={d.text} klein an={false} onClick={() => waehlen(d.text)} />
            ))}
          </div>
        </>
      ) : (
        <div>
          {TRACER_GRUPPEN.map((x) => (
            <Knopf key={x.code} text={x.titel} an={false} onClick={() => setGruppe(x.code)} />
          ))}
        </div>
      )}

      {/* Die Norm führt je Gruppe ein "Sonstige"; die amtliche Kennzahl kann
          ohnehin anders heißen. Der Freitext bleibt deshalb offen. */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          type="text" name="tracerdiagnose" value={frei}
          onChange={(e) => setFrei(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (frei.trim()) waehlen(frei) } }}
          placeholder="oder eigenen Text"
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box' }}
        />
        <button
          type="button" onClick={() => frei.trim() && waehlen(frei)} disabled={!frei.trim()}
          style={{ padding: '8px 14px', background: frei.trim() ? ROT : 'rgba(96,8,18,0.15)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: frei.trim() ? 'pointer' : 'default' }}
        >
          Übernehmen
        </button>
      </div>
    </div>
  )
}

/**
 * Die führende Diagnose: die Organgruppe.
 *
 * Meist steht sie schon, weil die Tracerdiagnose aus einer Gruppe gewählt
 * wurde. Wählbar bleibt sie trotzdem — zu einer Diagnose, die nicht in der
 * Liste steht, gehört die Gruppe von Hand.
 */
export function FuehrendeDiagnose({ wert, onChange }: {
  wert: string
  onChange: (w: string) => void
}) {
  const [frei, setFrei] = useState('')
  const gesetzt = wert.trim()
  const istGruppe = TRACER_GRUPPEN.some((g) => g.titel === gesetzt)

  if (gesetzt) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
          Führende Diagnose
        </div>
        <button
          type="button" onClick={() => onChange('')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 11px', background: 'rgba(96,8,18,0.05)',
            border: `0.5px solid ${LINIE}`, borderRadius: 8,
            fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontStyle: 'italic', fontWeight: 700, color: ROT }}>
              {gesetzt}
            </span>
            <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
              {istGruppe ? 'Organgruppe' : 'eigener Text'}
            </span>
          </span>
          <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>ändern</span>
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        Führende Diagnose
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>
          Organgruppe
        </span>
      </div>
      <div>
        {TRACER_GRUPPEN.map((g) => (
          <Knopf key={g.code} text={g.titel} an={false} onClick={() => onChange(g.titel)} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          type="text" name="fuehrende_diagnose" value={frei}
          onChange={(e) => setFrei(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (frei.trim()) onChange(frei.trim()) } }}
          placeholder="oder eigenen Text"
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box' }}
        />
        <button
          type="button" onClick={() => frei.trim() && onChange(frei.trim())} disabled={!frei.trim()}
          style={{ padding: '8px 14px', background: frei.trim() ? ROT : 'rgba(96,8,18,0.15)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: frei.trim() ? 'pointer' : 'default' }}
        >
          Übernehmen
        </button>
      </div>
    </div>
  )
}
