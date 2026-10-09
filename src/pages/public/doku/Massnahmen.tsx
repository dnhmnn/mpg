// Maßnahmen eintragen: Uhrzeit, Art, Ausführung, Begründung — in dieser
// Reihenfolge, und die Begründung schließt ab.
//
// Die Uhrzeit steht vorweg und zeigt die aktuelle an. Wer sie so lässt, tippt
// nichts; wer nachträgt, überschreibt sie. Nach jedem Eintrag geht sie zurück
// auf die aktuelle Zeit, denn der nächste Griff ist meist der nächste Moment.
//
// Die rechtliche Begründung kommt zuletzt und trägt damit ein: sie ist eine
// Aussage über die Maßnahme, die man erst trifft, wenn die Maßnahme dasteht.
// Wer sie im Moment nicht treffen kann, trägt mit "später" ein — die Liste
// sagt dann, dass sie fehlt. Blockiert wird am Patienten nichts.

import { useEffect, useState } from 'react'
import {
  KANUELENGROESSEN, MASSNAHMEN_KATEGORIEN, RECHTSGRUENDE, anlageorte, artText, brauchtAnlage,
  massnahmeKategorie, rechtsgrund,
} from '../../../katalog/massnahmenArten'
import { Knopf, type Werte } from './DokuFeld'
import { pflichtKarte } from '../../../katalog/pflicht'
import {
  besetztePosten, durchName, jetztZeit, massnahmeEintragen, massnahmeGrundSetzen,
  massnahmeStreichen, massnahmenAbsteigend, ohneGrund,
} from './massnahmen'

const ROT = 'var(--lbf-akzent)'
/** Der Akzent als gefüllte Fläche mit heller Schrift darauf. */
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

export default function Massnahmen({ werte, setWerte }: {
  werte: Werte
  setWerte: (f: (v: Werte) => Werte) => void
}) {
  const [zeit, setZeit] = useState('')
  const [kategorie, setKategorie] = useState('')
  const [frei, setFrei] = useState('')
  /** Die gewählte Ausführung — eingetragen wird sie erst mit der Begründung. */
  const [art, setArt] = useState('')
  /** Für welchen Eintrag die Begründung gerade nachgetragen wird. */
  const [nachtragen, setNachtragen] = useState('')
  /**
   * Die gewählte Begründung, solange noch gefragt wird, wer gehandelt hat.
   *
   * Eine Basismaßnahme trägt sich sofort ein; alles andere ist eine
   * persönliche Entscheidung, und dann gehört in das Protokoll, wer sie
   * getroffen hat.
   */
  const [offenerGrund, setOffenerGrund] = useState('')
  /** Beim peripheren Zugang: Kanülengröße und Anlageort, vor der Begründung gewählt. */
  const [groesse, setGroesse] = useState('')
  const [ort, setOrt] = useState('')
  // Was zu einer anderen Kategorie oder Art gehört, passt nicht mehr — also leer.
  useEffect(() => { setGroesse(''); setOrt('') }, [kategorie, art])
  const kat = massnahmeKategorie(kategorie)
  const eintraege = massnahmenAbsteigend(werte)
  const offen = ohneGrund(werte)
  const mannschaft = besetztePosten(werte)
  // Die Felder hinter den Arten tragen keinen Stern mehr — die Maske hat sie
  // übernommen. Also trägt ihn die Art.
  const verlangt = pflichtKarte(werte)

  // Leer heißt "jetzt": die Zeit des Eintragens, nicht die des Öffnens.
  const gezeigteZeit = zeit || jetztZeit()
  /** Die gewählte Ausführung im Klartext — leer, solange keine steht. */
  const gewaehlteArt = art.trim() ? (kat?.frei ? art.trim() : artText(kategorie, art)) : ''

  /** Die Begründung schließt den Eintrag ab — leer heißt "später". */
  function eintragen(grund: string, durch = '') {
    if (!kategorie || !art.trim()) return
    setWerte((v) => massnahmeEintragen(v, { zeit: gezeigteZeit, kategorie, art, grund, durch, groesse, ort }))
    setZeit('')
    setFrei('')
    setArt('')
    setOffenerGrund('')
    // Zurück zur Auswahl: der nächste Griff ist meist eine andere Art, und
    // der Eintrag soll in der Liste zu sehen sein, nicht hinter der Liste
    // der Ausführungen, die ihn gerade erzeugt hat.
    setKategorie('')
  }

  return (
    <div>
      <div>
        {/* 1. Die Uhrzeit */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
              Uhrzeit
            </span>
            <input
              type="time" name="massnahme_zeit" value={gezeigteZeit}
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

        {/* 2. Die Art */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
          Art der Maßnahme
        </div>
        {/*
         * Ist eine Art gewählt, treten die anderen sieben ab.
         *
         * Sie stehen zu lassen kostete zweihundert Pixel, und die
         * Ausführungen — das, was man jetzt antippen will — rutschten damit
         * an den unteren Rand des Bildschirms. Statt ihrer steht eine Zeile
         * mit der gewählten Art; sie führt zurück zur Auswahl.
         */}
        {kat ? (
          <button
            type="button" onClick={() => { setKategorie(''); setFrei(''); setArt('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%', marginBottom: 10,
              padding: '8px 11px', background: 'var(--lbf-akzent-weich)',
              border: `0.5px solid ${LINIE}`, borderRadius: 8,
              fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: ROT, lineHeight: 1 }}>‹</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: ROT }}>
              {kat.titel}
              {verlangt.get(kat.id) && !verlangt.get(kat.id)!.erfuellt ? (
                <span style={{ color: 'var(--lbf-fehler-text-2)', marginLeft: 3 }}>*</span>
              ) : null}
            </span>
            <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>andere Art</span>
          </button>
        ) : (
          <div style={{ marginBottom: 2 }}>
            {MASSNAHMEN_KATEGORIEN.map((k) => {
              const stand = verlangt.get(k.id)
              return (
                <Knopf
                  key={k.id} text={k.titel} an={false}
                  offen={Boolean(stand) && !stand!.erfuellt}
                  onClick={() => { setKategorie(k.id); setFrei(''); setArt('') }}
                />
              )
            })}
          </div>
        )}

        {/* 3. Die Ausführung — sie wählt aus, eingetragen wird mit der
               Begründung darunter. Steht sie, treten die übrigen ab: sonst
               lägen die Begründung auf y=695 und "später" auf y=808 eines
               844 Pixel hohen Bildschirms, also beide am Rand. */}
        {kat ? (
          gewaehlteArt ? (
            <button
              type="button" onClick={() => { setArt(''); setFrei(''); setOffenerGrund('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                padding: '8px 11px', background: ROT_GRUND,
                border: `0.5px solid ${ROT_GRUND}`, borderRadius: 8,
                fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>‹</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#fff' }}>{gewaehlteArt}</span>
              <span style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.75)' }}>andere</span>
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
                Ausführung
              </div>
              <div>
                {kat.arten.map((a) => (
                  <Knopf key={a.wert} text={a.text} klein an={false} onClick={() => setArt(a.wert)} />
                ))}
              </div>
              {/* Wo der Bogen eine Schreiblinie führt, muss auch etwas
                  Ungelistetes eingetragen werden können. */}
              {kat.frei ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input
                    type="text" value={frei}
                    onChange={(e) => setFrei(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setArt(frei) } }}
                    placeholder="oder eigenen Text"
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: 'var(--lbf-input-bg)', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box' }}
                  />
                  <button
                    type="button" onClick={() => setArt(frei)} disabled={!frei.trim()}
                    style={{ padding: '8px 14px', background: frei.trim() ? ROT_GRUND : 'rgba(var(--lbf-rot-rgb),0.15)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: frei.trim() ? 'pointer' : 'default' }}
                  >
                    Übernehmen
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        {/* 3b. Beim peripheren Zugang: Kanülengröße und Anlageort. Die Norm
            führt beides als Art / Ort / Größe — ohne sie gibt es keinen
            vollständigen Eintrag. */}
        {kat && gewaehlteArt && brauchtAnlage(kategorie, art) ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, marginBottom: 4 }}>
              Kanülengröße
            </div>
            <div>
              {KANUELENGROESSEN.map((g) => (
                <Knopf key={g} text={g} klein an={g === groesse} onClick={() => setGroesse(g === groesse ? '' : g)} />
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, margin: '8px 0 4px' }}>
              Anlageort
            </div>
            <div>
              {anlageorte().map((o) => (
                <Knopf key={o.wert} text={o.text} klein an={o.wert === ort} onClick={() => setOrt(o.wert === ort ? '' : o.wert)} />
              ))}
            </div>
            {!(groesse && ort) ? (
              <div style={{ marginTop: 6, fontSize: 12, fontStyle: 'italic', color: GRAU }}>
                Erst Größe und Anlageort wählen — dann folgt die Begründung.
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 4. Die rechtliche Begründung — der abschließende Griff. */}
        {kat && gewaehlteArt && (!brauchtAnlage(kategorie, art) || (groesse && ort)) ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, marginBottom: 4 }}>
              Rechtliche Begründung
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5, color: GRAU }}>
                trägt um {gezeigteZeit} ein
              </span>
            </div>
            <div>
              {RECHTSGRUENDE.map((r) => (
                <Knopf
                  key={r.wert} text={r.text} klein an={r.wert === offenerGrund}
                  onClick={() => {
                    // Basismaßnahme trägt sich sofort ein; sonst wird erst
                    // gefragt, wer gehandelt hat.
                    if (r.wert === 'basis') eintragen(r.wert)
                    else setOffenerGrund(r.wert === offenerGrund ? '' : r.wert)
                  }}
                />
              ))}
            </div>
            {/* Wer sie jetzt nicht treffen kann, soll die Maßnahme trotzdem
                festhalten können — die Liste mahnt sie dann an. */}
            <button
              type="button" onClick={() => eintragen('')}
              style={{ marginTop: 2, padding: '7px 0', background: 'none', border: 'none', color: GRAU, fontFamily: 'inherit', fontSize: 12, fontStyle: 'italic', cursor: 'pointer' }}
            >
              später nachtragen
            </button>

            {/* 5. Wer gehandelt hat — nur, wo es keine Basismaßnahme ist. */}
            {offenerGrund ? (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${LINIE}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, marginBottom: 4 }}>
                  Durchgeführt von
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5, color: GRAU }}>
                    trägt ein
                  </span>
                </div>
                {mannschaft.length > 0 ? (
                  <div>
                    {mannschaft.map((m) => (
                      <Knopf key={m.pos} text={m.name} klein an={false} onClick={() => eintragen(offenerGrund, m.pos)} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.45, marginBottom: 6 }}>
                    Noch niemand auf dem Zettel EINS eingetragen — ohne Besatzung
                    lässt sich niemand benennen.
                  </div>
                )}
                <button
                  type="button" onClick={() => eintragen(offenerGrund)}
                  style={{ marginTop: 2, padding: '7px 0', background: 'none', border: 'none', color: GRAU, fontFamily: 'inherit', fontSize: 12, fontStyle: 'italic', cursor: 'pointer' }}
                >
                  ohne Angabe eintragen
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Was schon eingetragen ist — neueste zuerst. */}
        {eintraege.length > 0 ? (
          <div style={{ marginTop: 14, borderTop: `0.5px solid ${LINIE}`, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU }}>
                {eintraege.length === 1 ? 'Ein Eintrag' : `${eintraege.length} Einträge`}
              </span>
              {offen.length > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--lbf-warn-text-2)', border: '0.5px solid #fde047', background: 'var(--lbf-warn-grund)', borderRadius: 999, padding: '2px 7px' }}>
                  {offen.length}× ohne Begründung
                </span>
              ) : null}
            </div>
            {eintraege.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 0', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: ROT, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {m.zeit || '--:--'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontStyle: 'italic', fontWeight: 700, color: TEXT }}>
                    {massnahmeKategorie(m.kategorie)?.frei ? m.art : artText(m.kategorie, m.art)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                    {massnahmeKategorie(m.kategorie)?.titel ?? m.kategorie}
                    {durchName(werte, m) ? ` · durch ${durchName(werte, m)}` : ''}
                  </span>
                  {brauchtAnlage(m.kategorie, m.art) ? (
                    m.groesse && m.ort ? (
                      <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                        {anlageorte().find((o) => o.wert === m.ort)?.text} · {m.groesse}
                      </span>
                    ) : (
                      // Ältere Einträge ohne Größe und Ort fallen hier auf —
                      // wie die fehlende Begründung darunter.
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lbf-warn-text-2)' }}>
                        Kanülengröße und Anlageort fehlen
                      </span>
                    )
                  ) : null}
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
                        color: m.grund ? ROT : 'var(--lbf-warn-text-2)', textAlign: 'left',
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
    </div>
  )
}
