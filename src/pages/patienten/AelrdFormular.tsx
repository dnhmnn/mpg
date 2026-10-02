// Erfassungsmaske für das Einsatzprotokoll im ÄLRD-Layout.
//
// Die Maske folgt der Gliederung des Bogens: wer den Papierbogen kennt,
// findet hier dieselben Blöcke in derselben Reihenfolge. Sie schreibt die
// Feldnamen des Bogens — dieselben, die der Ausdruck liest.

import {
  AELRD_ABSCHNITTE,
  aelrdFeld,
  type AelrdAbschnitt,
  type AelrdFeld,
} from '../../katalog/aelrd'

export type Werte = Record<string, unknown>

type Props = {
  werte: Werte
  onChange: (werte: Werte) => void
  seite: 1 | 2
  gesperrt?: boolean
}

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

function istGewaehlt(wert: unknown, option: string): boolean {
  if (Array.isArray(wert)) return wert.map(String).includes(option)
  return String(wert ?? '') === option
}

/** Eine Option an- oder abwählen. Mehrfachfelder sammeln, Radios ersetzen. */
export function umschalten(wert: unknown, option: string, mehrfach: boolean): unknown {
  if (!mehrfach) return String(wert ?? '') === option ? '' : option
  const liste = Array.isArray(wert) ? wert.map(String) : []
  return liste.includes(option) ? liste.filter((w) => w !== option) : [...liste, option]
}

function Beschriftung({ text, hinweis }: { text: string; hinweis?: string }) {
  if (!text) return null
  return (
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU, marginBottom: 3 }}>
      {text}
      {hinweis ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>{hinweis}</span> : null}
    </div>
  )
}

function Kaestchen({ text, an, rund, onClick, gesperrt }: {
  text: string; an: boolean; rund: boolean; onClick: () => void; gesperrt?: boolean
}) {
  return (
    <button
      type="button"
      onClick={gesperrt ? undefined : onClick}
      disabled={gesperrt}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px 3px 5px', margin: '0 4px 4px 0',
        background: an ? ROT : '#fff', color: an ? '#fff' : TEXT,
        border: `0.5px solid ${an ? ROT : LINIE}`, borderRadius: rund ? 14 : 6,
        fontFamily: 'inherit', fontSize: 12, fontWeight: an ? 700 : 400,
        cursor: gesperrt ? 'default' : 'pointer', textAlign: 'left', lineHeight: 1.25,
      }}
    >
      <span aria-hidden style={{
        width: 11, height: 11, flexShrink: 0, borderRadius: rund ? 6 : 2,
        border: `1.5px solid ${an ? '#fff' : 'rgba(96,8,18,0.35)'}`,
        background: an ? '#fff' : 'transparent',
      }} />
      {text}
    </button>
  )
}

function FeldEingabe({ feld, werte, setzen, gesperrt }: {
  feld: AelrdFeld; werte: Werte; setzen: (id: string, wert: unknown) => void; gesperrt?: boolean
}) {
  const wert = werte[feld.id]

  if (feld.typ === 'medikation') return <MedikationTabelle werte={werte} setzen={setzen} gesperrt={gesperrt} />

  if (feld.typ === 'check') {
    return (
      <div style={{ marginBottom: 6 }}>
        <Kaestchen text={feld.label} an={Boolean(wert)} rund={false} gesperrt={gesperrt}
          onClick={() => setzen(feld.id, !wert)} />
      </div>
    )
  }

  if (feld.optionen && feld.optionen.length > 0) {
    const mehrfach = feld.typ === 'mehrfach'
    return (
      <div style={{ marginBottom: 8 }}>
        <Beschriftung text={feld.label} hinweis={feld.hinweis} />
        <div>
          {feld.optionen.map((o) => (
            <Kaestchen key={o.wert} text={o.text} an={istGewaehlt(wert, o.wert)} rund={!mehrfach}
              gesperrt={gesperrt}
              onClick={() => setzen(feld.id, umschalten(wert, o.wert, mehrfach))} />
          ))}
        </div>
      </div>
    )
  }

  if (feld.typ === 'skala') {
    const von = feld.min ?? 0
    const bis = feld.max ?? 10
    return (
      <div style={{ marginBottom: 8 }}>
        <Beschriftung text={feld.label} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {Array.from({ length: bis - von + 1 }, (_, i) => von + i).map((n) => {
            const an = String(wert) === String(n)
            return (
              <button key={n} type="button" disabled={gesperrt}
                onClick={() => setzen(feld.id, an ? '' : n)}
                style={{
                  minWidth: 30, padding: '5px 0',
                  background: an ? ROT : '#fff', color: an ? '#fff' : TEXT,
                  border: `0.5px solid ${an ? ROT : LINIE}`, borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 13, fontWeight: an ? 800 : 400,
                  cursor: gesperrt ? 'default' : 'pointer',
                }}>
                {n}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const typ = feld.typ === 'zahl' ? 'number' : feld.typ === 'datum' ? 'date' : feld.typ === 'zeit' ? 'time' : 'text'
  const stil = {
    width: '100%', padding: '6px 8px', background: '#fff',
    border: `0.5px solid ${LINIE}`, borderRadius: 6,
    fontFamily: 'inherit', fontSize: 14, color: TEXT, boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Beschriftung text={feld.label + (feld.pflicht ? ' *' : '')}
        hinweis={feld.einheit ? `[${feld.einheit}]` : feld.hinweis} />
      {feld.typ === 'langtext' ? (
        <textarea rows={3} disabled={gesperrt}
          value={wert === undefined || wert === null ? '' : String(wert)}
          onChange={(e) => setzen(feld.id, e.target.value)}
          style={{ ...stil, resize: 'vertical', lineHeight: 1.4 }} />
      ) : (
        <input type={typ} min={feld.min} max={feld.max} disabled={gesperrt}
          value={wert === undefined || wert === null ? '' : String(wert)}
          onChange={(e) => setzen(feld.id, e.target.value)}
          style={stil} />
      )}
    </div>
  )
}

const MED_SPALTEN = [
  { id: 'zeit', label: 'Zeit', typ: 'zeit' },
  { id: 'wirkstoff', label: 'Wirkstoff / Handelsname' },
  { id: 'dosis', label: 'Dosis' },
  { id: 'applikation', label: 'Applikation' },
]

function MedikationTabelle({ werte, setzen, gesperrt }: {
  werte: Werte; setzen: (id: string, w: unknown) => void; gesperrt?: boolean
}) {
  const zeilen = Array.isArray(werte.medikation) ? (werte.medikation as Werte[]) : []
  return (
    <div style={{ marginBottom: 8 }}>
      <Beschriftung text="Medikation" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {MED_SPALTEN.map((s) => (
                <th key={s.id} style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ROT, padding: '4px 5px', borderBottom: `0.5px solid ${LINIE}`, whiteSpace: 'nowrap' }}>
                  {s.label}
                </th>
              ))}
              {gesperrt ? null : <th style={{ width: 28 }} />}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => (
              <tr key={i}>
                {MED_SPALTEN.map((s) => (
                  <td key={s.id} style={{ padding: '2px 3px', borderBottom: '0.5px solid rgba(96,8,18,0.06)' }}>
                    <input type={s.typ === 'zeit' ? 'time' : 'text'} disabled={gesperrt}
                      value={z[s.id] === undefined || z[s.id] === null ? '' : String(z[s.id])}
                      onChange={(e) => setzen('medikation', zeilen.map((r, k) => (k === i ? { ...r, [s.id]: e.target.value } : r)))}
                      style={{ width: '100%', minWidth: 70, padding: '4px 5px', border: `0.5px solid ${LINIE}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 12, color: TEXT, boxSizing: 'border-box' }} />
                  </td>
                ))}
                {gesperrt ? null : (
                  <td style={{ padding: '2px 3px' }}>
                    <button type="button" aria-label="Zeile entfernen"
                      onClick={() => setzen('medikation', zeilen.filter((_, k) => k !== i))}
                      style={{ background: 'transparent', border: 'none', color: GRAU, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 2 }}>
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
        <button type="button" onClick={() => setzen('medikation', [...zeilen, {}])}
          style={{ marginTop: 6, padding: '5px 12px', background: '#fff', border: `0.5px solid ${ROT}`, borderRadius: 6, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
          Medikament ergänzen
        </button>
      )}
    </div>
  )
}

function AbschnittBlock({ abschnitt, werte, setzen, gesperrt }: {
  abschnitt: AelrdAbschnitt; werte: Werte; setzen: (id: string, w: unknown) => void; gesperrt?: boolean
}) {
  const felder = abschnitt.felder.map(aelrdFeld).filter(Boolean) as AelrdFeld[]
  if (felder.length === 0) return null
  return (
    <section
      id={`aelrd-${abschnitt.id}`}
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'hidden', marginBottom: 10 }}
    >
      <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ROT, padding: '9px 12px 7px', margin: 0, borderBottom: `0.5px solid ${LINIE}` }}>
        {abschnitt.titel}
      </h2>
      <div style={{ padding: '9px 12px 11px' }}>
        {felder.map((f) => (
          <FeldEingabe key={f.id} feld={f} werte={werte} setzen={setzen} gesperrt={gesperrt} />
        ))}
      </div>
    </section>
  )
}

export default function AelrdFormular({ werte, onChange, seite, gesperrt }: Props) {
  const setzen = (id: string, wert: unknown) => onChange({ ...werte, [id]: wert })
  return (
    <div>
      {AELRD_ABSCHNITTE.filter((a) => a.seite === seite).map((a) => (
        <AbschnittBlock key={a.id} abschnitt={a} werte={werte} setzen={setzen} gesperrt={gesperrt} />
      ))}
    </div>
  )
}
