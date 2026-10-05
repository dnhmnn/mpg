// Den Pupillenstatus im Seitenvergleich erheben.
//
// Vier Zeilen untereinander — Weite rechts, Weite links, Lichtreaktion
// rechts, Lichtreaktion links — verlieren genau das, worum es geht: die
// Seite. Angetippt öffnet sich deshalb eine Maske mit zwei Spalten, rechts
// und links nebeneinander, Frage für Frage.
//
// Der Regelfall ist seitengleich. Dafür gibt es einen Schalter: einmal
// gewählt, steht die Antwort auf beiden Seiten.

import { useState } from 'react'
import {
  PUPILLEN_FELDER, PUPILLEN_FRAGEN, pupillenLeer, pupillenText, seitengleich,
} from '../../../katalog/pupillen'
import type { Werte } from './DokuFeld'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

export default function Pupillen({ werte, setWerte }: {
  werte: Werte
  setWerte: (f: (v: Werte) => Werte) => void
}) {
  const [offen, setOffen] = useState(false)
  const [wahl, setWahl] = useState<Record<string, string>>({})
  const [gekoppelt, setGekoppelt] = useState(true)

  const befund = pupillenText(werte)

  function oeffnen() {
    const start: Record<string, string> = {}
    for (const f of PUPILLEN_FELDER) start[f] = String(werte[f] ?? '')
    setWahl(start)
    // Was dasteht, entscheidet über den Schalter: ein Seitenunterschied
    // wird nicht beim Öffnen weggebügelt.
    setGekoppelt(pupillenLeer(werte) || seitengleich(werte))
    setOffen(true)
  }

  function waehlen(frage: typeof PUPILLEN_FRAGEN[number], seite: 'rechts' | 'links', wert: string) {
    setWahl((w) => {
      const aus = { ...w }
      const feld = frage[seite]
      const neu = aus[feld] === wert ? '' : wert
      aus[feld] = neu
      if (gekoppelt) aus[seite === 'rechts' ? frage.links : frage.rechts] = neu
      return aus
    })
  }

  function uebernehmen() {
    setWerte((v) => {
      const aus = { ...v }
      for (const f of PUPILLEN_FELDER) aus[f] = wahl[f] ?? ''
      return aus
    })
    setOffen(false)
  }

  const vorschau = pupillenText(wahl)

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        Pupillen
      </div>
      <button
        type="button" onClick={oeffnen}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 12px', background: '#fff', border: `0.5px solid ${LINIE}`,
          borderRadius: 10, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {/* Zwei Kreise sagen auf einen Blick, was vier Wörter erst nach dem
            Lesen sagen. */}
        <span style={{ display: 'inline-flex', gap: 5, flexShrink: 0 }}>
          {(['rechts', 'links'] as const).map((seite) => {
            const weite = String(werte[PUPILLEN_FRAGEN[0][seite]] ?? '')
            const gross = weite === 'weit' ? 15 : weite === 'eng' ? 6 : weite === '' ? 9 : 11
            return (
              <span key={seite} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 10, border: `1px solid ${weite ? ROT : LINIE}`,
              }}>
                <span style={{
                  width: gross, height: gross, borderRadius: gross / 2,
                  background: weite ? ROT : 'transparent',
                  border: weite ? 'none' : `1px dashed ${LINIE}`,
                }} />
              </span>
            )
          })}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TEXT }}>
            {befund ? 'Pupillen' : 'Pupillen erheben'}
          </span>
          <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: befund ? ROT : GRAU }}>
            {befund || 'Weite und Lichtreaktion, im Seitenvergleich'}
          </span>
        </span>
        <span style={{ fontSize: 11, fontStyle: 'italic', color: ROT }}>öffnen</span>
      </button>

      {offen ? (
        <div
          role="dialog" aria-label="Pupillenstatus"
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column' }}
        >
          <header style={{ flexShrink: 0, background: '#fff', borderBottom: `0.5px solid ${LINIE}`, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Pupillenstatus</div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                {vorschau || 'Weite und Lichtreaktion · nach DIVI'}
              </div>
            </div>
            <button
              type="button" onClick={() => setOffen(false)} aria-label="Schließen"
              style={{ background: 'none', border: 'none', color: GRAU, fontSize: 24, lineHeight: 1, padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ×
            </button>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <button
              type="button" onClick={() => setGekoppelt((g) => !g)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginBottom: 12,
                padding: '9px 11px', background: gekoppelt ? 'rgba(96,8,18,0.05)' : '#fff',
                border: `0.5px solid ${gekoppelt ? ROT : LINIE}`, borderRadius: 9,
                fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                background: gekoppelt ? ROT : 'transparent', border: `1px solid ${gekoppelt ? ROT : LINIE}`,
                color: '#fff', fontSize: 13, fontWeight: 800, lineHeight: 1,
              }}>
                {gekoppelt ? '✓' : ''}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TEXT }}>Beide Seiten gleich</span>
                <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                  {gekoppelt ? 'eine Antwort gilt für rechts und links' : 'jede Seite für sich'}
                </span>
              </span>
            </button>

            {PUPILLEN_FRAGEN.map((frage) => (
              <div key={frage.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT, marginBottom: 5 }}>
                  {frage.titel}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: gekoppelt ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {(gekoppelt ? (['rechts'] as const) : (['rechts', 'links'] as const)).map((seite) => (
                    <div key={seite}>
                      {!gekoppelt ? (
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU, marginBottom: 4 }}>
                          {seite}
                        </div>
                      ) : null}
                      {frage.antworten.map((a) => {
                        const an = wahl[frage[seite]] === a.wert
                        return (
                          <button
                            key={a.wert} type="button"
                            onClick={() => waehlen(frage, seite, a.wert)}
                            style={{
                              display: 'block', width: '100%', padding: '9px 11px', marginBottom: 4,
                              background: an ? ROT : '#fff',
                              border: `0.5px solid ${an ? ROT : LINIE}`, borderRadius: 9,
                              fontFamily: 'inherit', fontSize: 15, fontWeight: an ? 700 : 400,
                              color: an ? '#fff' : TEXT, textAlign: 'left', cursor: 'pointer',
                            }}
                          >
                            {a.text}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
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
              Übernehmen
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
