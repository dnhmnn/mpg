// Erfassungsmaske für den DIVI-Datensatz, erzeugt aus dem Metamodell.
//
// Sie schreibt die Codes der Norm als Schlüssel — dieselben, die der Export
// erwartet. Dadurch braucht es zwischen Eingabe und Austauschdatei keine
// Übersetzung, und was hier erfasst wird, ist genau das, was übermittelt wird.
//
// Die Verschachtelung der Norm bleibt erhalten: Unterangaben erscheinen erst,
// wenn die Option gewählt ist, zu der sie gehören. Wer „unauffällig" ankreuzt,
// bekommt die Dyspnoe-Merkmale gar nicht erst zu sehen.

import {
  NAEP_ABSCHNITTE,
  NAEP_FRAGETYPEN,
  type NaepAbschnitt,
  type NaepEingabe,
  type NaepLeer,
  type NaepOption,
} from '../../katalog/naep'
import { naepStruktur, type NaepStrukturFeld } from '../../katalog/naepStrukturen'

/** Werte des Protokolls, nach NAEP-Code abgelegt. */
export type NaepWerte = Record<string, unknown>

export type NaepZustand = {
  werte: NaepWerte
  /** Abschnitt- oder Auswahl-Code → Code der gewählten leer-Angabe. */
  leer: Record<string, string>
  /** Abschnitte, die gar nicht bearbeitet wurden. */
  nichtBearbeitet: string[]
  sonstiges: Record<string, { code: string; text: string }>
}

type Props = {
  zustand: NaepZustand
  onChange: (z: NaepZustand) => void
  /** Nur die Abschnitte mit diesen Codes zeigen. */
  nur?: string[]
  gesperrt?: boolean
}

const ROT = 'var(--lbf-akzent)'
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'var(--lbf-border)'

function gewaehlt(wert: unknown, code: string): boolean {
  if (Array.isArray(wert)) return wert.map(String).includes(code)
  return String(wert ?? '') === code
}

/** Eine Option an- oder abwählen. */
export function umschalten(wert: unknown, code: string, mehrfach: boolean): unknown {
  if (!mehrfach) return String(wert ?? '') === code ? '' : code
  const liste = Array.isArray(wert) ? wert.map(String) : []
  return liste.includes(code) ? liste.filter((w) => w !== code) : [...liste, code]
}

function Beschriftung({ text, hinweis }: { text: string; hinweis?: string }) {
  if (!text) return null
  return (
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU, marginBottom: 3 }}>
      {text}
      {hinweis ? (
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 5, fontStyle: 'italic' }}>
          {hinweis}
        </span>
      ) : null}
    </div>
  )
}

function Knopf({ text, an, rund, onClick, gesperrt, klein }: {
  text: string; an: boolean; rund: boolean; onClick: () => void; gesperrt?: boolean; klein?: boolean
}) {
  return (
    <button
      type="button" onClick={gesperrt ? undefined : onClick} disabled={gesperrt}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: klein ? '2px 7px 2px 5px' : '3px 8px 3px 5px', margin: '0 4px 4px 0',
        background: an ? ROT_GRUND : 'var(--lbf-card)', color: an ? '#fff' : TEXT,
        border: `0.5px solid ${an ? ROT_GRUND : LINIE}`, borderRadius: rund ? 14 : 6,
        fontFamily: 'inherit', fontSize: klein ? 11 : 12, fontWeight: an ? 700 : 400,
        cursor: gesperrt ? 'default' : 'pointer', textAlign: 'left', lineHeight: 1.25,
      }}
    >
      <span aria-hidden style={{
        width: 11, height: 11, flexShrink: 0, borderRadius: rund ? 6 : 2,
        border: `1.5px solid ${an ? '#fff' : 'rgba(var(--lbf-rot-rgb),0.35)'}`,
        background: an ? '#fff' : 'transparent',
      }} />
      {text}
    </button>
  )
}

const eingabeStil: React.CSSProperties = {
  width: '100%', padding: '6px 8px', background: 'var(--lbf-input-bg)',
  border: `0.5px solid ${LINIE}`, borderRadius: 6,
  fontFamily: 'inherit', fontSize: 14, color: TEXT, boxSizing: 'border-box',
}

/** Eine Einrückung, die zeigt: das hier hängt an der Angabe darüber. */
function Unter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginLeft: 14, paddingLeft: 10, borderLeft: `2px solid ${LINIE}`, marginBottom: 8 }}>
      {children}
    </div>
  )
}

export default function NaepFormular({ zustand, onChange, nur, gesperrt }: Props) {
  const setzen = (code: string, wert: unknown) =>
    onChange({ ...zustand, werte: { ...zustand.werte, [code]: wert } })

  const setzeLeer = (code: string, leerCode: string | null) => {
    const leer = { ...zustand.leer }
    if (leerCode === null) delete leer[code]
    else leer[code] = leerCode
    onChange({ ...zustand, leer })
  }

  const setzeSonstiges = (code: string, s: { code: string; text: string } | null) => {
    const sonstiges = { ...zustand.sonstiges }
    if (s === null || !s.text) delete sonstiges[code]
    else sonstiges[code] = s
    onChange({ ...zustand, sonstiges })
  }

  const umschaltenNichtBearbeitet = (code: string) => {
    const dabei = zustand.nichtBearbeitet.includes(code)
    onChange({
      ...zustand,
      nichtBearbeitet: dabei
        ? zustand.nichtBearbeitet.filter((c) => c !== code)
        : [...zustand.nichtBearbeitet, code],
    })
  }

  // ── Einzelne Eingabearten ───────────────────────────────────────────────

  function Feld({ e }: { e: Extract<NaepEingabe, { art: 'feld' }> }) {
    const typ = e.typ === 'Zahl' ? 'number' : e.typ === 'Zeit' ? 'time' : e.typ === 'Datum' ? 'date' : 'text'
    const einheit = e.einheit ? ` [${e.einheit}]` : ''
    return (
      <div style={{ marginBottom: 8 }}>
        <Beschriftung text={(e.term || e.code) + einheit} hinweis={e.hinweis} />
        <input
          type={typ} disabled={gesperrt}
          min={e.min !== undefined ? Number(e.min) : undefined}
          max={e.max !== undefined ? Number(e.max) : undefined}
          step={e.typ === 'Zahl' ? 'any' : undefined}
          value={zustand.werte[e.code] === undefined || zustand.werte[e.code] === null ? '' : String(zustand.werte[e.code])}
          onChange={(ev) => setzen(e.code, ev.target.value)}
          style={eingabeStil}
        />
      </div>
    )
  }

  function LeerKnoepfe({ code, leer }: { code: string; leer: NaepLeer[] }) {
    if (leer.length === 0) return null
    return (
      <div style={{ marginBottom: 6 }}>
        {leer.map((l) => (
          <Knopf
            key={l.code} text={l.term} an={zustand.leer[code] === l.code} rund klein gesperrt={gesperrt}
            onClick={() => setzeLeer(code, zustand.leer[code] === l.code ? null : l.code)}
          />
        ))}
      </div>
    )
  }

  function Optionen({ code, optionen, mehrfach, sonstiges }: {
    code: string; optionen: NaepOption[]; mehrfach: boolean; sonstiges?: NaepLeer
  }) {
    const wert = zustand.werte[code]
    return (
      <>
        <div>
          {optionen.map((o) => (
            <Knopf
              key={o.code}
              text={o.numerisch !== undefined ? `${o.term} (${o.numerisch})` : o.term}
              an={gewaehlt(wert, o.code)} rund={!mehrfach} gesperrt={gesperrt}
              onClick={() => setzen(code, umschalten(wert, o.code, mehrfach))}
            />
          ))}
        </div>
        {/* Was unter einer gewählten Option hängt, erscheint erst dann. */}
        {optionen
          .filter((o) => o.zusatz && gewaehlt(wert, o.code))
          .map((o) => (
            <Unter key={`z-${o.code}`}>
              {o.zusatz!.kinder.map((k) => <Eingabe key={k.code} e={k} />)}
            </Unter>
          ))}
        {sonstiges ? (
          <div style={{ marginTop: 4 }}>
            <Beschriftung text={sonstiges.term} />
            <input
              type="text" disabled={gesperrt}
              value={zustand.sonstiges[code]?.text ?? ''}
              onChange={(ev) => setzeSonstiges(code, { code: sonstiges.code, text: ev.target.value })}
              style={eingabeStil}
            />
          </div>
        ) : null}
      </>
    )
  }

  function Eingabe({ e }: { e: NaepEingabe }): React.ReactElement | null {
    if (e.art === 'feld') {
      return (
        <>
          <Feld e={e} />
          {e.zusatz ? <Unter>{e.zusatz.kinder.map((k) => <Eingabe key={k.code} e={k} />)}</Unter> : null}
        </>
      )
    }

    if (e.art === 'auswahl') {
      return (
        <div style={{ marginBottom: 10 }}>
          <Beschriftung text={e.term || ''} />
          <LeerKnoepfe code={e.code} leer={e.leer} />
          {zustand.leer[e.code] ? null : (
            <Optionen code={e.code} optionen={e.optionen} mehrfach={e.mehrfach} sonstiges={e.sonstiges} />
          )}
          {e.zusatz ? <Unter>{e.zusatz.kinder.map((k) => <Eingabe key={k.code} e={k} />)}</Unter> : null}
        </div>
      )
    }

    if (e.art === 'auswahlgruppe') {
      // Mehrere Auswahlen teilen sich eine Optionsliste — Arm links, Arm rechts.
      return (
        <div style={{ marginBottom: 10 }}>
          <Beschriftung text={e.term || ''} />
          {e.auswahlen.map((a) => (
            <div key={a.code} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 3 }}>{a.term}</div>
              <Optionen code={a.code} optionen={e.optionen} mehrfach={false} />
            </div>
          ))}
        </div>
      )
    }

    if (e.art === 'frage') {
      const typ = NAEP_FRAGETYPEN[e.typ] ?? NAEP_FRAGETYPEN['j_opt']
      const wert = zustand.werte[e.code]
      return (
        <div style={{ marginBottom: 10 }}>
          <Beschriftung text={e.term || ''} />
          <div>
            {typ.antworten.map((a) => (
              <Knopf
                key={a.code} text={a.term} an={String(wert ?? '') === a.code} rund gesperrt={gesperrt}
                onClick={() => setzen(e.code, String(wert ?? '') === a.code ? '' : a.code)}
              />
            ))}
          </div>
          {/* Unterangaben gelten nur, wenn bejaht wurde. */}
          {e.wennJa && String(wert) === 'J' ? (
            <Unter>{e.wennJa.map((k) => <Eingabe key={k.code} e={k} />)}</Unter>
          ) : null}
        </div>
      )
    }

    if (e.art === 'freitext') {
      const wert = zustand.werte[e.code]
      const text = Array.isArray(wert) ? wert.join('\n') : String(wert ?? '')
      return (
        <div style={{ marginBottom: 8 }}>
          <textarea
            rows={5} disabled={gesperrt} value={text}
            onChange={(ev) => setzen(e.code, ev.target.value.split('\n'))}
            style={{ ...eingabeStil, resize: 'vertical', lineHeight: 1.4 }}
          />
        </div>
      )
    }

    if (e.art === 'struktur') return <Struktur e={e} />

    if (e.art === 'gruppe') {
      return (
        <div style={{ marginBottom: 10 }}>
          <Beschriftung text={e.term || ''} />
          {e.kinder.map((k) => <Eingabe key={k.code} e={k} />)}
        </div>
      )
    }

    if (e.art === 'oder') {
      // Entweder-oder: Alter in Jahren ODER in Tagen, nicht beides.
      return (
        <div style={{ marginBottom: 10 }}>
          <Beschriftung text={e.term || ''} hinweis={e.kinder.length > 1 ? 'eines davon' : undefined} />
          <LeerKnoepfe code={e.code} leer={e.leer} />
          {zustand.leer[e.code] ? null : e.kinder.map((k) => <Eingabe key={k.code} e={k} />)}
        </div>
      )
    }

    return null
  }

  function Struktur({ e }: { e: Extract<NaepEingabe, { art: 'struktur' }> }) {
    const def = naepStruktur(e.typ)
    if (!def) return null
    const werte = (zustand.werte[e.code] ?? {}) as Record<string, unknown>
    const setzeStruktur = (pfad: string, wert: unknown) =>
      setzen(e.code, { ...werte, [pfad]: wert })

    const liste = (werte[def.liste?.pfad ?? ''] ?? []) as Record<string, unknown>[]
    const setzeListe = (neu: Record<string, unknown>[]) =>
      setzen(e.code, { ...werte, [def.liste!.pfad]: neu })

    const feld = (f: NaepStrukturFeld, wert: unknown, aendern: (w: unknown) => void) => {
      if (f.typ === 'jaNein') {
        return (
          <div key={f.pfad} style={{ marginBottom: 8 }}>
            <Knopf text={f.label} an={wert === 'ja'} rund={false} gesperrt={gesperrt}
              onClick={() => aendern(wert === 'ja' ? 'nein' : 'ja')} />
          </div>
        )
      }
      const typ = f.typ === 'zahl' ? 'number' : f.typ === 'datum' ? 'date' : f.typ === 'zeit' ? 'time' : 'text'
      return (
        <div key={f.pfad} style={{ marginBottom: 8 }}>
          <Beschriftung text={f.label + (f.pflicht ? ' *' : '')} hinweis={f.hinweis} />
          <input type={typ} disabled={gesperrt} pattern={f.muster}
            value={wert === undefined || wert === null ? '' : String(wert)}
            onChange={(ev) => aendern(ev.target.value)} style={eingabeStil} />
        </div>
      )
    }

    return (
      <div style={{ marginBottom: 12 }}>
        {e.term ? <Beschriftung text={e.term} /> : null}
        {def.felder.map((f) => feld(f, werte[f.pfad], (w) => setzeStruktur(f.pfad, w)))}

        {def.liste ? (
          <>
            {liste.map((zeile, i) => (
              <div key={i} style={{ border: `0.5px solid ${LINIE}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {def.liste!.titel} {i + 1}
                  </span>
                  {gesperrt ? null : (
                    <button type="button" aria-label="Eintrag entfernen"
                      onClick={() => setzeListe(liste.filter((_, k) => k !== i))}
                      style={{ background: 'transparent', border: 'none', color: GRAU, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>
                      ×
                    </button>
                  )}
                </div>
                {def.liste!.felder.map((f) =>
                  feld(f, zeile[f.pfad], (w) =>
                    setzeListe(liste.map((z, k) => (k === i ? { ...z, [f.pfad]: w } : z)))))}
              </div>
            ))}
            {gesperrt ? null : (
              <button type="button" onClick={() => setzeListe([...liste, {}])}
                style={{ padding: '5px 12px', background: 'var(--lbf-card)', border: `0.5px solid ${ROT}`, borderRadius: 6, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                {def.liste.titel} ergänzen
              </button>
            )}
          </>
        ) : null}
      </div>
    )
  }

  // ── Abschnitte ──────────────────────────────────────────────────────────

  function Abschnitt({ a, tiefe }: { a: NaepAbschnitt; tiefe: number }) {
    const unbearbeitet = zustand.nichtBearbeitet.includes(a.code)
    return (
      <section
        id={`naep-${a.code}`}
        style={{
          background: 'var(--lbf-card)', borderRadius: 12, marginBottom: 10,
          boxShadow: tiefe === 0 ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
          borderLeft: `3px solid ${ROT}`,
          marginLeft: tiefe * 10, overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 12px 7px', borderBottom: `0.5px solid ${LINIE}` }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ROT, margin: 0, flex: 1 }}>
            {a.titel}
            <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: GRAU, marginLeft: 6 }}>{a.code}</span>
          </h2>
          {gesperrt ? null : (
            <Knopf text="nicht bearbeitet" an={unbearbeitet} rund={false} klein
              onClick={() => umschaltenNichtBearbeitet(a.code)} />
          )}
        </div>

        {unbearbeitet ? null : (
          <div style={{ padding: '9px 12px 11px' }}>
            {a.hinweis ? (
              <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginBottom: 8 }}>{a.hinweis}</div>
            ) : null}
            <LeerKnoepfe code={a.code} leer={a.leer ?? []} />
            {zustand.leer[a.code] ? null : (a.formular ?? []).map((e) => <Eingabe key={e.code} e={e} />)}
            {a.verlauf ? <Verlauf a={a} /> : null}
          </div>
        )}

        {unbearbeitet ? null : (a.kinder ?? []).map((k) => <Abschnitt key={k.code} a={k} tiefe={tiefe + 1} />)}
      </section>
    )
  }

  function Verlauf({ a }: { a: NaepAbschnitt }) {
    const v = a.verlauf!
    const reihen = (zustand.werte[v.code] ?? []) as NaepWerte[]
    const setzeReihen = (neu: NaepWerte[]) => setzen(v.code, neu)
    const spalten = v.spalten
    return (
      <div>
        <LeerKnoepfe code={v.code} leer={v.leer} />
        {zustand.leer[v.code] ? null : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {spalten.map((s) => (
                      <th key={s.code} style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ROT, padding: '4px 5px', borderBottom: `0.5px solid ${LINIE}`, whiteSpace: 'nowrap' }}>
                        {s.art === 'feld' ? s.term : s.art === 'auswahl' ? s.term || 'Maßnahme' : s.code}
                      </th>
                    ))}
                    {gesperrt ? null : <th style={{ width: 28 }} />}
                  </tr>
                </thead>
                <tbody>
                  {reihen.map((reihe, i) => (
                    <tr key={i}>
                      {spalten.map((s) => (
                        <td key={s.code} style={{ padding: '2px 3px', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' }}>
                          {s.art === 'auswahl' ? (
                            <div style={{ minWidth: 170 }}>
                              {s.optionen.map((o) => (
                                <Knopf key={o.code} text={o.term} klein rund={!s.mehrfach} gesperrt={gesperrt}
                                  an={gewaehlt(reihe[s.code], o.code)}
                                  onClick={() => setzeReihen(reihen.map((r, k) =>
                                    k === i ? { ...r, [s.code]: umschalten(r[s.code], o.code, s.mehrfach) } : r))} />
                              ))}
                            </div>
                          ) : (
                            <input
                              type={s.art === 'feld' && s.typ === 'Zeit' ? 'time' : s.art === 'feld' && s.typ === 'Zahl' ? 'number' : 'text'}
                              disabled={gesperrt}
                              value={reihe[s.code] === undefined || reihe[s.code] === null ? '' : String(reihe[s.code])}
                              onChange={(ev) => setzeReihen(reihen.map((r, k) => (k === i ? { ...r, [s.code]: ev.target.value } : r)))}
                              style={{ width: '100%', minWidth: 66, padding: '4px 5px', border: `0.5px solid ${LINIE}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 12, color: TEXT, boxSizing: 'border-box' }}
                            />
                          )}
                        </td>
                      ))}
                      {gesperrt ? null : (
                        <td style={{ padding: '2px 3px' }}>
                          <button type="button" aria-label="Messung entfernen"
                            onClick={() => setzeReihen(reihen.filter((_, k) => k !== i))}
                            style={{ background: 'transparent', border: 'none', color: GRAU, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gesperrt ? null : (
              <button type="button" onClick={() => setzeReihen([...reihen, {}])}
                style={{ marginTop: 6, padding: '5px 12px', background: 'var(--lbf-card)', border: `0.5px solid ${ROT}`, borderRadius: 6, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                Messung ergänzen
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  const zuZeigen = nur ? NAEP_ABSCHNITTE.filter((a) => nur.includes(a.code)) : NAEP_ABSCHNITTE
  return <div>{zuZeigen.map((a) => <Abschnitt key={a.code} a={a} tiefe={0} />)}</div>
}

/** Ein leerer Zustand. */
export function leererZustand(): NaepZustand {
  return { werte: {}, leer: {}, nichtBearbeitet: [], sonstiges: {} }
}
