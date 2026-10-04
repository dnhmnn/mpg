// Maßnahmen eintragen: Uhrzeit, Art, Ausführung — in dieser Reihenfolge.
//
// Die Uhrzeit steht vorweg und zeigt die aktuelle an. Wer sie so lässt, tippt
// nichts; wer nachträgt, überschreibt sie. Nach jedem Eintrag geht sie zurück
// auf die aktuelle Zeit, denn der nächste Griff ist meist der nächste Moment.
//
// Die Ausführung wird mit einem Tippen eingetragen — kein zweiter Knopf
// dahinter. Ein Griff im Fahrzeug ist einer zu viel.

import { useState } from 'react'
import {
  MASSNAHMEN_KATEGORIEN, RECHTSGRUENDE, artText, massnahmeKategorie, rechtsgrund,
} from '../../../katalog/massnahmenArten'
import { Knopf, type Werte } from './DokuFeld'
import {
  jetztZeit, massnahmeEintragen, massnahmeGrundSetzen, massnahmeStreichen,
  massnahmenAbsteigend, ohneGrund,
} from './massnahmen'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

export default function Massnahmen({ werte, setWerte }: {
  werte: Werte
  setWerte: (f: (v: Werte) => Werte) => void
}) {
  const [zeit, setZeit] = useState('')
  const [kategorie, setKategorie] = useState('')
  const [frei, setFrei] = useState('')
  /**
   * Die Begründung bleibt stehen, bis sie geändert wird.
   *
   * In einem Einsatz ist das meiste auf demselben Weg zulässig. Sie bei jedem
   * Eintrag neu zu wählen wäre ein Griff, der fast immer derselbe ist.
   */
  const [grund, setGrund] = useState('')
  /** Für welchen Eintrag die Begründung gerade nachgetragen wird. */
  const [nachtragen, setNachtragen] = useState('')
  const kat = massnahmeKategorie(kategorie)
  const eintraege = massnahmenAbsteigend(werte)
  const offen = ohneGrund(werte)

  // Leer heißt "jetzt": die Zeit des Eintragens, nicht die des Öffnens.
  const gezeigteZeit = zeit || jetztZeit()

  function eintragen(art: string) {
    if (!kategorie || !art.trim()) return
    setWerte((v) => massnahmeEintragen(v, { zeit: gezeigteZeit, kategorie, art, grund }))
    setZeit('')
    setFrei('')
  }

  return (
    <section
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'clip', marginBottom: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '11px 12px', borderBottom: `0.5px solid ${LINIE}` }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
          Maßnahmen im Verlauf
        </h2>
        <span style={{ fontSize: 11, fontStyle: 'italic', color: eintraege.length > 0 ? ROT : GRAU }}>
          {eintraege.length > 0 ? `${eintraege.length}` : 'keine'}
        </span>
        {offen.length > 0 ? (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b45309', border: '0.5px solid #fde047', background: '#fffbeb', borderRadius: 999, padding: '2px 7px' }}>
            {offen.length}× ohne Begründung
          </span>
        ) : null}
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        {/* 1. Die Uhrzeit */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
              Uhrzeit
            </span>
            <input
              type="time" name="massnahme_zeit" value={gezeigteZeit}
              onChange={(e) => setZeit(e.target.value)}
              style={{ padding: '8px 10px', background: '#fff', border: `1px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 19, fontWeight: 600, color: TEXT }}
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

        {/* 2. Die Art */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
          Art der Maßnahme
        </div>
        <div style={{ marginBottom: kategorie ? 12 : 2 }}>
          {MASSNAHMEN_KATEGORIEN.map((k) => (
            <Knopf
              key={k.id} text={k.titel} an={k.id === kategorie}
              onClick={() => { setKategorie(k.id === kategorie ? '' : k.id); setFrei('') }}
            />
          ))}
        </div>

        {/* 3. Die rechtliche Begründung — sie gehört zur Maßnahme, nicht zum
               Einsatz, und bleibt für die nächsten Einträge stehen. */}
        {kat ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
              Rechtliche Begründung
              {grund ? (
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>
                  gilt für die nächsten Einträge
                </span>
              ) : null}
            </div>
            <div>
              {RECHTSGRUENDE.map((r) => (
                <Knopf
                  key={r.wert} text={r.text} klein an={r.wert === grund}
                  onClick={() => setGrund(r.wert === grund ? '' : r.wert)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* 4. Die Ausführung */}
        {kat ? (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, marginBottom: 4 }}>
              {kat.titel}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5, color: GRAU }}>
                antippen trägt um {gezeigteZeit} ein
              </span>
            </div>
            <div>
              {kat.arten.map((a) => (
                <Knopf key={a.wert} text={a.text} an={false} klein onClick={() => eintragen(a.wert)} />
              ))}
            </div>
            {/* Wo der Bogen eine Schreiblinie führt, muss auch etwas
                Ungelistetes eingetragen werden können. */}
            {kat.frei ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  type="text" value={frei} onChange={(e) => setFrei(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); eintragen(frei) } }}
                  placeholder="oder eigenen Text"
                  style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box' }}
                />
                <button
                  type="button" onClick={() => eintragen(frei)} disabled={!frei.trim()}
                  style={{ padding: '8px 14px', background: frei.trim() ? ROT : 'rgba(96,8,18,0.15)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: frei.trim() ? 'pointer' : 'default' }}
                >
                  Eintragen
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Was schon eingetragen ist — neueste zuerst. */}
        {eintraege.length > 0 ? (
          <div style={{ marginTop: 14, borderTop: `0.5px solid ${LINIE}`, paddingTop: 8 }}>
            {eintraege.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 0', borderBottom: '0.5px solid rgba(96,8,18,0.06)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: ROT, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {m.zeit || '--:--'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontStyle: 'italic', fontWeight: 700, color: TEXT }}>
                    {massnahmeKategorie(m.kategorie)?.frei ? m.art : artText(m.kategorie, m.art)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                    {massnahmeKategorie(m.kategorie)?.titel ?? m.kategorie}
                  </span>
                  {/* Die Begründung — angetippt lässt sie sich ändern, und
                      fehlt sie, sagt die Zeile das statt zu schweigen. */}
                  {nachtragen === m.id ? (
                    <span style={{ display: 'block', marginTop: 3 }}>
                      {RECHTSGRUENDE.map((r) => (
                        <Knopf
                          key={r.wert} text={r.text} klein an={r.wert === m.grund}
                          onClick={() => {
                            setWerte((v) => massnahmeGrundSetzen(v, m.id, r.wert === m.grund ? '' : r.wert))
                            setNachtragen('')
                          }}
                        />
                      ))}
                    </span>
                  ) : (
                    <button
                      type="button" onClick={() => setNachtragen(m.id)}
                      style={{
                        display: 'block', marginTop: 2, padding: 0, background: 'none', border: 'none',
                        fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        color: m.grund ? ROT : '#b45309', textAlign: 'left',
                      }}
                    >
                      {m.grund ? rechtsgrund(m.grund)?.text : 'Rechtliche Begründung fehlt'}
                    </button>
                  )}
                </span>
                <button
                  type="button" onClick={() => setWerte((v) => massnahmeStreichen(v, m.id))}
                  aria-label={`Eintrag ${m.zeit} streichen`}
                  style={{ background: 'none', border: 'none', color: GRAU, fontSize: 19, lineHeight: 1, padding: '0 3px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
