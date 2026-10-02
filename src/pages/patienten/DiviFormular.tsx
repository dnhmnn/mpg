// Eingabemaske fuer die Protokollfassung 2.0 (DIVI 7.1).
//
// Die Maske liest dasselbe Raster wie der Ausdruck: Baender von oben nach
// unten, darin Saeulen von links nach rechts. Wer den Papierbogen kennt,
// findet hier alles an derselben Stelle. Das ist der ganze Zweck dieser
// Datei — sie erfindet keine eigene Ordnung.

import { useMemo } from 'react'
import {
  MEDIKATION_SPALTEN,
  VERLAUF_SPALTEN,
  rasterDerSeite,
  type Abschnitt,
  type Feld,
  type Gruppe,
} from '../../katalog/divi'

export type Werte = Record<string, unknown>

type Props = {
  werte: Werte
  onChange: (werte: Werte) => void
  /** Welche Seite des Bogens gezeigt wird. */
  seite: 1 | 2
  /** Nur lesen, z. B. bei freigegebenen Protokollen. */
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

/** Eine Option an- oder abwaehlen. Mehrfachfelder sammeln, Radios ersetzen. */
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

function Kaestchen({
  text,
  an,
  rund,
  onClick,
  gesperrt,
}: {
  text: string
  an: boolean
  rund: boolean
  onClick: () => void
  gesperrt?: boolean
}) {
  return (
    <button
      type="button"
      onClick={gesperrt ? undefined : onClick}
      disabled={gesperrt}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px 3px 5px',
        margin: '0 4px 4px 0',
        background: an ? ROT : '#fff',
        color: an ? '#fff' : TEXT,
        border: `0.5px solid ${an ? ROT : LINIE}`,
        borderRadius: rund ? 14 : 6,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: an ? 700 : 400,
        cursor: gesperrt ? 'default' : 'pointer',
        textAlign: 'left',
        lineHeight: 1.25,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 11,
          height: 11,
          flexShrink: 0,
          borderRadius: rund ? 6 : 2,
          border: `1.5px solid ${an ? '#fff' : 'rgba(96,8,18,0.35)'}`,
          background: an ? '#fff' : 'transparent',
        }}
      />
      {text}
    </button>
  )
}

function FeldEingabe({
  feld,
  werte,
  setzen,
  gesperrt,
  gruppentitel,
}: {
  feld: Feld
  werte: Werte
  setzen: (id: string, wert: unknown) => void
  gesperrt?: boolean
  gruppentitel?: string
}) {
  const wert = werte[feld.id]
  const norm = (t: string) => t.toLowerCase().replace(/[^a-zäöüß]/g, '')
  const beschriftung = gruppentitel && norm(feld.label) === norm(gruppentitel) ? '' : feld.label

  if (feld.typ === 'verlauf') return <VerlaufTabelle werte={werte} setzen={setzen} gesperrt={gesperrt} />
  if (feld.typ === 'medikation') return <MedikationTabelle werte={werte} setzen={setzen} gesperrt={gesperrt} />

  if (feld.typ === 'check') {
    return (
      <div style={{ marginBottom: 6 }}>
        <Kaestchen
          text={feld.label}
          an={Boolean(wert)}
          rund={false}
          gesperrt={gesperrt}
          onClick={() => setzen(feld.id, !wert)}
        />
        {feld.hinweis ? <div style={{ fontSize: 10, color: GRAU, fontStyle: 'italic' }}>{feld.hinweis}</div> : null}
      </div>
    )
  }

  if (feld.optionen && feld.optionen.length > 0) {
    const mehrfach = feld.typ === 'mehrfach'
    return (
      <div style={{ marginBottom: 8 }}>
        <Beschriftung text={beschriftung} hinweis={feld.hinweis} />
        <div>
          {feld.optionen.map((o) => (
            <Kaestchen
              key={o.wert}
              text={o.hinweis ? `${o.text} · ${o.hinweis}` : o.text}
              an={istGewaehlt(wert, o.wert)}
              rund={!mehrfach}
              gesperrt={gesperrt}
              onClick={() => setzen(feld.id, umschalten(wert, o.wert, mehrfach))}
            />
          ))}
        </div>
      </div>
    )
  }

  if (feld.typ === 'skala') {
    const von = feld.min ?? 0
    const bis = feld.max ?? 10
    const stufen = Array.from({ length: bis - von + 1 }, (_, i) => von + i)
    return (
      <div style={{ marginBottom: 8 }}>
        <Beschriftung text={beschriftung} hinweis={feld.hinweis} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {stufen.map((n) => {
            const an = String(wert) === String(n)
            return (
              <button
                key={n}
                type="button"
                disabled={gesperrt}
                onClick={() => setzen(feld.id, an ? '' : n)}
                style={{
                  minWidth: 30,
                  padding: '5px 0',
                  background: an ? ROT : '#fff',
                  color: an ? '#fff' : TEXT,
                  border: `0.5px solid ${an ? ROT : LINIE}`,
                  borderRadius: 6,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: an ? 800 : 400,
                  cursor: gesperrt ? 'default' : 'pointer',
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const gemeinsam = {
    disabled: gesperrt,
    value: wert === undefined || wert === null ? '' : String(wert),
    onChange: (e: { target: { value: string } }) => setzen(feld.id, e.target.value),
    style: {
      width: '100%',
      padding: '6px 8px',
      background: '#fff',
      border: `0.5px solid ${LINIE}`,
      borderRadius: 6,
      fontFamily: 'inherit',
      fontSize: 14,
      color: TEXT,
      boxSizing: 'border-box' as const,
    },
  }

  const typ =
    feld.typ === 'zahl' ? 'number' : feld.typ === 'datum' ? 'date' : feld.typ === 'zeit' ? 'time' : 'text'

  return (
    <div style={{ marginBottom: 8 }}>
      <Beschriftung
        text={beschriftung + (feld.pflicht ? ' *' : '')}
        hinweis={feld.einheit ? `[${feld.einheit}]` : feld.hinweis}
      />
      {feld.typ === 'langtext' ? (
        <textarea rows={3} {...gemeinsam} style={{ ...gemeinsam.style, resize: 'vertical', lineHeight: 1.4 }} />
      ) : (
        <input type={typ} min={feld.min} max={feld.max} {...gemeinsam} />
      )}
    </div>
  )
}

function VerlaufTabelle({ werte, setzen, gesperrt }: { werte: Werte; setzen: (id: string, w: unknown) => void; gesperrt?: boolean }) {
  const zeilen = Array.isArray(werte.verlauf) ? (werte.verlauf as Werte[]) : []
  const aendern = (i: number, spalte: string, wert: unknown) => {
    const neu = zeilen.map((z, k) => (k === i ? { ...z, [spalte]: wert } : z))
    setzen('verlauf', neu)
  }
  return (
    <Tabelle
      spalten={VERLAUF_SPALTEN}
      zeilen={zeilen}
      gesperrt={gesperrt}
      aendern={aendern}
      hinzufuegen={() => setzen('verlauf', [...zeilen, {}])}
      entfernen={(i) => setzen('verlauf', zeilen.filter((_, k) => k !== i))}
      knopf="Messung ergänzen"
    />
  )
}

function MedikationTabelle({ werte, setzen, gesperrt }: { werte: Werte; setzen: (id: string, w: unknown) => void; gesperrt?: boolean }) {
  const zeilen = Array.isArray(werte.medikation) ? (werte.medikation as Werte[]) : []
  const aendern = (i: number, spalte: string, wert: unknown) => {
    setzen('medikation', zeilen.map((z, k) => (k === i ? { ...z, [spalte]: wert } : z)))
  }
  return (
    <Tabelle
      spalten={MEDIKATION_SPALTEN}
      zeilen={zeilen}
      gesperrt={gesperrt}
      aendern={aendern}
      hinzufuegen={() => setzen('medikation', [...zeilen, {}])}
      entfernen={(i) => setzen('medikation', zeilen.filter((_, k) => k !== i))}
      knopf="Medikament ergänzen"
    />
  )
}

function Tabelle({
  spalten,
  zeilen,
  aendern,
  hinzufuegen,
  entfernen,
  knopf,
  gesperrt,
}: {
  spalten: Feld[]
  zeilen: Werte[]
  aendern: (i: number, spalte: string, wert: unknown) => void
  hinzufuegen: () => void
  entfernen: (i: number) => void
  knopf: string
  gesperrt?: boolean
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {spalten.map((s) => (
                <th
                  key={s.id}
                  style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ROT, padding: '4px 5px', borderBottom: `0.5px solid ${LINIE}`, whiteSpace: 'nowrap' }}
                >
                  {s.label}
                </th>
              ))}
              {gesperrt ? null : <th style={{ width: 28 }} />}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => (
              <tr key={i}>
                {spalten.map((s) => (
                  <td key={s.id} style={{ padding: '2px 3px', borderBottom: '0.5px solid rgba(96,8,18,0.06)' }}>
                    {s.typ === 'check' ? (
                      <input
                        type="checkbox"
                        disabled={gesperrt}
                        checked={Boolean(z[s.id])}
                        onChange={(e) => aendern(i, s.id, e.target.checked)}
                      />
                    ) : (
                      <input
                        type={s.typ === 'zahl' ? 'number' : s.typ === 'zeit' ? 'time' : 'text'}
                        disabled={gesperrt}
                        value={z[s.id] === undefined || z[s.id] === null ? '' : String(z[s.id])}
                        onChange={(e) => aendern(i, s.id, e.target.value)}
                        style={{ width: '100%', minWidth: 54, padding: '4px 5px', border: `0.5px solid ${LINIE}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 12, color: TEXT, boxSizing: 'border-box' }}
                      />
                    )}
                  </td>
                ))}
                {gesperrt ? null : (
                  <td style={{ padding: '2px 3px' }}>
                    <button
                      type="button"
                      onClick={() => entfernen(i)}
                      aria-label="Zeile entfernen"
                      style={{ background: 'transparent', border: 'none', color: GRAU, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 2 }}
                    >
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
        <button
          type="button"
          onClick={hinzufuegen}
          style={{ marginTop: 6, padding: '5px 12px', background: '#fff', border: `0.5px solid ${ROT}`, borderRadius: 6, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}
        >
          {knopf}
        </button>
      )}
    </div>
  )
}

function GruppeBlock({ gruppe, werte, setzen, gesperrt }: { gruppe: Gruppe; werte: Werte; setzen: (id: string, w: unknown) => void; gesperrt?: boolean }) {
  return (
    <div style={{ marginBottom: 4 }}>
      {gruppe.titel ? (
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT, margin: '8px 0 5px' }}>
          {gruppe.titel}
        </div>
      ) : null}
      {gruppe.felder.map((f) => (
        <FeldEingabe key={f.id} feld={f} werte={werte} setzen={setzen} gesperrt={gesperrt} gruppentitel={gruppe.titel} />
      ))}
    </div>
  )
}

function AbschnittBlock({ abschnitt, werte, setzen, gesperrt }: { abschnitt: Abschnitt; werte: Werte; setzen: (id: string, w: unknown) => void; gesperrt?: boolean }) {
  return (
    <section
      id={`divi-${abschnitt.id}`}
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'hidden' }}
    >
      <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ROT, padding: '9px 12px 7px', margin: 0, borderBottom: `0.5px solid ${LINIE}` }}>
        {abschnitt.titel}
      </h2>
      <div style={{ padding: '9px 12px 11px' }}>
        {abschnitt.gruppen.map((g) => (
          <GruppeBlock key={g.id} gruppe={g} werte={werte} setzen={setzen} gesperrt={gesperrt} />
        ))}
      </div>
    </section>
  )
}

export default function DiviFormular({ werte, onChange, seite, gesperrt }: Props) {
  const raster = useMemo(() => rasterDerSeite(seite), [seite])
  const setzen = (id: string, wert: unknown) => onChange({ ...werte, [id]: wert })

  return (
    <div style={{ background: 'var(--warm-bg)' }}>
      {raster.map((band) => (
        <div
          key={band.zeile}
          style={{ display: 'grid', gridTemplateColumns: band.saeulen.map((s) => `${s.spanne}fr`).join(' '), gap: 10, marginBottom: 10, alignItems: 'start' }}
        >
          {band.saeulen.map((saeule) => (
            <div key={saeule.spalte} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {saeule.abschnitte.map((a) => (
                <AbschnittBlock key={a.id} abschnitt={a} werte={werte} setzen={setzen} gesperrt={gesperrt} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
