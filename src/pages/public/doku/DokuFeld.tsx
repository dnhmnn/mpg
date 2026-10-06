// Ein Feld des Bogens, so knapp wie es geht.
//
// Der Unterschied zum alten Formular steckt in zwei Entscheidungen:
//
// ZAHLEN STEHEN IM RASTER. Eine Herzfrequenz ist drei Zeichen breit. Sie
// bekam bisher eine ganze Bildschirmzeile mit Überschrift darüber — neun
// Vitalwerte wurden so zu drei Bildschirmhöhen. Hier stehen sie zu dritt
// nebeneinander, mit Zifferntastatur und farbiger Grenze.
//
// FREITEXT WIRD ZUM KNOPF, wo die Norm eine Auswahl kennt. "Bewusstsein" ist
// auf dem Papier eine Linie; getippt wird darauf im Fahrzeug niemand etwas.
// Vier Knöpfe sind schneller und ergeben einen Wert, den der DIVI-Export
// später übernehmen kann.

import type { AelrdFeld } from '../../../katalog/aelrd'
import type { Stand } from '../../../katalog/pflicht'
import { normOptionen } from '../../../katalog/aelrdOptionen'
import { istSpiegelOption } from '../../../katalog/aelrdSpiegel'

export type Werte = Record<string, unknown>

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

/**
 * Grenzwerte für die farbige Rückmeldung. Sie ersetzen keine Beurteilung —
 * sie zeigen nur, dass ein Wert außerhalb des Üblichen liegt, damit ein
 * Zahlendreher auffällt, bevor er im Protokoll steht.
 */
const GRENZEN: Record<string, { gut: [number, number]; warn: [number, number] }> = {
  nibp_sys: { gut: [90, 140], warn: [70, 180] },
  nibp_dia: { gut: [60, 90], warn: [50, 110] },
  hf: { gut: [60, 100], warn: [50, 120] },
  puls: { gut: [60, 100], warn: [50, 120] },
  af: { gut: [12, 20], warn: [10, 29] },
  spo2: { gut: [95, 100], warn: [90, 100] },
  etco2: { gut: [35, 45], warn: [30, 55] },
  temp: { gut: [36, 37.5], warn: [35, 38.5] },
  bz: { gut: [70, 140], warn: [50, 199] },
  gcs_summe: { gut: [15, 15], warn: [9, 15] },
}
// Die Übergabewerte teilen die Grenzen ihrer Erstbefund-Entsprechung.
for (const [id, g] of Object.entries(GRENZEN)) GRENZEN[`ub_${id}`] = g

const AMPEL = {
  gut: { rand: '#86efac', grund: '#f0fdf4' },
  warn: { rand: '#fde047', grund: '#fffbeb' },
  kritisch: { rand: '#fca5a5', grund: '#fef2f2' },
}

export function bewerten(id: string, roh: unknown): 'gut' | 'warn' | 'kritisch' | null {
  const g = GRENZEN[id]
  if (!g) return null
  const t = String(roh ?? '').replace(',', '.')
  if (t === '') return null
  const v = Number(t)
  if (!Number.isFinite(v)) return null
  if (v >= g.gut[0] && v <= g.gut[1]) return 'gut'
  if (v >= g.warn[0] && v <= g.warn[1]) return 'warn'
  return 'kritisch'
}

/** Felder, die im Zahlenraster stehen statt in einer eigenen Zeile. */
/** Ob in einem Feld etwas steht — dieselbe Regel wie im Fortschritt der Seite. */
export function gefuellt(w: unknown): boolean {
  if (w === undefined || w === null || w === '' || w === false) return false
  if (Array.isArray(w)) return w.length > 0
  return true
}

export function istRasterfeld(f: AelrdFeld): boolean {
  return f.typ === 'zahl' && !f.optionen
}

function gewaehlt(wert: unknown, option: string): boolean {
  if (Array.isArray(wert)) return wert.map(String).includes(option)
  return String(wert ?? '') === option
}

function umschalten(wert: unknown, option: string, mehrfach: boolean): unknown {
  if (!mehrfach) return String(wert ?? '') === option ? '' : option
  const liste = Array.isArray(wert) ? wert.map(String) : []
  return liste.includes(option) ? liste.filter((w) => w !== option) : [...liste, option]
}

const eingabe: React.CSSProperties = {
  width: '100%', padding: '9px 10px', background: '#fff',
  border: `0.5px solid ${LINIE}`, borderRadius: 8,
  fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box',
}

/** Rot, solange eine Pflichtangabe fehlt; Bernstein, wenn sie erwartet wird. */
const OFFEN = '#b91c1c'
const ERWARTET = '#b45309'

/** Welche Farbe eine Angabe trägt, die noch aussteht. */
export function standFarbe(stand?: Stand): string | null {
  if (!stand || stand.erfuellt) return null
  return stand.stufe === 'pflicht' ? OFFEN : ERWARTET
}

function Marke({ text, hinweis, stand }: {
  text: string; hinweis?: string; stand?: Stand
}) {
  const farbe = standFarbe(stand)
  const pflicht = Boolean(stand)
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: farbe ?? GRAU, marginBottom: 4 }}>
      {text}
      {/*
       * Der Stern steht am Feld, nicht in einer Legende: wer dokumentiert,
       * liest keine Legende. Rot heißt offen, grau heißt erfüllt — der Stern
       * verschwindet nicht, sonst wüsste man hinterher nicht mehr, dass es
       * eine Pflichtangabe war.
       */}
      {pflicht ? <span style={{ color: farbe ?? GRAU, marginLeft: 3 }}>*</span> : null}
      {/* Der Grund der Regel steht nicht am Feld — er macht die Zeile lang
          und sagt dem, der den Bogen kennt, nichts Neues. Gebraucht wird er
          beim Absenden, wenn eine Angabe wirklich fehlt. */}
      {hinweis ? (
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>{hinweis}</span>
      ) : null}
    </div>
  )
}

export function Knopf({ text, an, onClick, klein, offen }: {
  text: string; an: boolean; onClick: () => void; klein?: boolean
  /**
   * Eine Pflichtangabe, die hinter diesem Knopf noch aussteht.
   *
   * Wo eine Maske die Felder übernimmt — die Maßnahmen etwa —, trägt kein
   * Feld mehr einen Stern. Dann muss ihn der Knopf tragen, sonst ist die
   * Pflicht unsichtbar.
   */
  offen?: boolean
}) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: klein ? '7px 10px' : '8px 12px', margin: '0 5px 5px 0',
        minHeight: klein ? 32 : 36,
        background: an ? ROT : offen ? '#fef2f2' : '#fff', color: an ? '#fff' : TEXT,
        border: `${offen && !an ? 1 : 0.5}px solid ${an ? ROT : offen ? '#b91c1c' : LINIE}`,
        borderRadius: 999,
        fontFamily: 'inherit', fontSize: klein ? 13 : 14, fontWeight: an || offen ? 700 : 400,
        cursor: 'pointer', lineHeight: 1.2,
      }}
    >
      {text}
      {offen && !an ? <span style={{ color: '#b91c1c', marginLeft: 3 }}>*</span> : null}
    </button>
  )
}

/** Eine Zelle des Zahlenrasters. */
export function Rasterzelle({ feld, werte, setzen, stand }: {
  feld: AelrdFeld; werte: Werte; setzen: (id: string, w: unknown) => void; stand?: Stand
}) {
  const wert = werte[feld.id]
  const bewertung = bewerten(feld.id, wert)
  const ampel = bewertung ? AMPEL[bewertung] : null
  const farbe = standFarbe(stand)
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: farbe ?? GRAU, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {feld.label}
        {stand ? <span style={{ marginLeft: 3 }}>*</span> : null}
      </span>
      <span style={{ position: 'relative', display: 'block' }}>
        <input
          name={feld.id}
          inputMode="decimal"
          value={wert === undefined || wert === null ? '' : String(wert)}
          onChange={(e) => setzen(feld.id, e.target.value)}
          style={{
            ...eingabe, padding: '8px 30px 8px 9px', fontSize: 19, fontWeight: 600,
            textAlign: 'left',
            border: `1px solid ${ampel ? ampel.rand : farbe ?? LINIE}`,
            background: ampel ? ampel.grund : farbe === OFFEN ? '#fef2f2' : farbe === ERWARTET ? '#fffbeb' : '#fff',
          }}
        />
        {feld.einheit ? (
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: GRAU, pointerEvents: 'none' }}>
            {feld.einheit}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export default function DokuFeld({ feld, werte, setzen, ohneBeschriftung, stand }: {
  feld: AelrdFeld
  werte: Werte
  setzen: (id: string, w: unknown) => void
  /** Ob und warum diese Angabe gerade verlangt wird. */
  stand?: Stand
  /**
   * Die Beschriftung weglassen, weil die Überschrift darüber sie schon trägt.
   * Unter "x — Kritische Blutung" noch einmal "Kreislauf" zu schreiben sagt
   * nichts und kostet eine Zeile.
   */
  ohneBeschriftung?: boolean
}) {
  const wert = werte[feld.id]
  const farbe = standFarbe(stand)

  if (feld.typ === 'check') {
    return (
      <div style={{ marginBottom: 6 }}>
        <Knopf text={feld.label} an={Boolean(wert)} onClick={() => setzen(feld.id, !wert)} />
      </div>
    )
  }

  if (feld.typ === 'skala') {
    const von = feld.min ?? 0
    const bis = feld.max ?? 10
    return (
      <div style={{ marginBottom: 10 }}>
        {ohneBeschriftung ? null : <Marke text={feld.label} hinweis={`${von}–${bis}`} stand={stand} />}
        <div>
          {Array.from({ length: bis - von + 1 }, (_, i) => von + i).map((n) => (
            <Knopf key={n} text={String(n)} klein an={String(wert ?? '') === String(n)}
              onClick={() => setzen(feld.id, String(wert ?? '') === String(n) ? '' : String(n))} />
          ))}
        </div>
      </div>
    )
  }

  // Eigene Optionen des Bogens oder die Auswahl, die die Norm dafür kennt.
  const eigene = feld.optionen
  const ausNorm = eigene ? undefined : normOptionen(feld.id)
  const optionen = eigene
    ? eigene.filter((o) => !istSpiegelOption(feld.id, o.wert)).map((o) => ({ wert: o.wert, text: o.text }))
    : ausNorm?.map((o) => ({ wert: o.wert, text: o.text }))

  if (optionen && optionen.length > 0) {
    if (optionen.length === 0) return null
    const mehrfach = feld.typ === 'mehrfach'
    return (
      <div style={{ marginBottom: 10 }}>
        {ohneBeschriftung ? null : <Marke text={feld.label} hinweis={ausNorm ? 'nach DIVI' : undefined} stand={stand} />}
        <div>
          {optionen.map((o) => (
            <Knopf key={o.wert} text={o.text} an={gewaehlt(wert, o.wert)}
              onClick={() => setzen(feld.id, umschalten(wert, o.wert, mehrfach))} />
          ))}
        </div>
      </div>
    )
  }

  if (feld.typ === 'langtext') {
    return (
      <div style={{ marginBottom: 10 }}>
        {ohneBeschriftung ? null : <Marke text={feld.label} stand={stand} />}
        <textarea name={feld.id} rows={3}
          value={String(wert ?? '')} onChange={(e) => setzen(feld.id, e.target.value)}
          style={{ ...eingabe, resize: 'vertical', lineHeight: 1.45, border: `0.5px solid ${farbe ?? LINIE}`, background: farbe === OFFEN ? '#fef2f2' : farbe === ERWARTET ? '#fffbeb' : '#fff' }} />
      </div>
    )
  }

  const typ = feld.typ === 'zeit' ? 'time' : feld.typ === 'datum' ? 'date' : feld.typ === 'zahl' ? 'number' : 'text'
  return (
    <div style={{ marginBottom: 10 }}>
      {ohneBeschriftung ? null : <Marke text={feld.label} hinweis={feld.einheit} stand={stand} />}
      <input name={feld.id} type={typ}
        inputMode={feld.typ === 'zahl' ? 'decimal' : undefined}
        value={String(wert ?? '')} onChange={(e) => setzen(feld.id, e.target.value)}
        style={{ ...eingabe, border: `0.5px solid ${farbe ?? LINIE}`, background: farbe === OFFEN ? '#fef2f2' : farbe === ERWARTET ? '#fffbeb' : '#fff' }} />
    </div>
  )
}
