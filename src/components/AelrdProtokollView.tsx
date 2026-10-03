// Anzeige eines Protokolls der Fassung 2.0, erzeugt aus dem Feldkatalog.
//
// WARUM AUS DEM KATALOG: Die gewachsene Anzeige zählt ihre Felder einzeln
// auf. Von den 205 Feldern des Bogens zeigte sie fünfzehn — der Rest war
// erfasst, gespeichert, gedruckt, aber am Bildschirm unsichtbar. Wer die
// Liste von Hand pflegt, vergisst Felder und merkt es nie.
//
// Hier wird jeder Abschnitt des Bogens durchlaufen. Ein neues Feld im
// Katalog erscheint damit von selbst, ohne dass jemand daran denken muss.

import { AELRD_ABSCHNITTE, aelrdFeld, type AelrdFeld } from '../katalog/aelrd'
import { PubSection, PubWrap, lbl, inp } from '../pages/public/pubStyles'

type Props = {
  payload: Record<string, unknown>
  changedFields?: Set<string>
  tfChangedFields?: Set<string>
}

const aktiv: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', border: '0.5px solid transparent',
  borderRadius: 999, padding: '.2rem .6rem', background: 'var(--accent)',
  fontSize: '.9rem', margin: '2px', color: '#fff', fontWeight: 700,
}
const ruhend: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', border: '0.5px solid var(--border-medium)',
  borderRadius: 999, padding: '.2rem .6rem', background: 'var(--bg-subtle)',
  fontSize: '.9rem', margin: '2px', color: 'var(--text)', fontWeight: 400,
}

/** Geänderte Felder bleiben wie gewohnt markiert: gelb vom Melder, grün vom Teamführer. */
function markierung(schluessel: string, cf?: Set<string>, tf?: Set<string>): React.CSSProperties {
  if (cf?.has(schluessel)) return { background: 'rgba(234,179,8,0.1)', borderLeft: '3px solid #d97706', paddingLeft: 8, borderRadius: 4, marginLeft: -8 }
  if (tf?.has(schluessel)) return { background: 'rgba(22,163,74,0.07)', borderLeft: '3px solid #16a34a', paddingLeft: 8, borderRadius: 4, marginLeft: -8 }
  return {}
}

function istGewaehlt(wert: unknown, option: string): boolean {
  if (Array.isArray(wert)) return wert.map(String).includes(option)
  return String(wert ?? '') === option
}

function Wert({ feld, payload, cf, tf }: { feld: AelrdFeld; payload: Record<string, unknown>; cf?: Set<string>; tf?: Set<string> }) {
  const wert = payload[feld.id]
  const stil = markierung(feld.id, cf, tf)

  if (feld.typ === 'check') {
    return (
      <div style={stil}>
        <span style={wert ? aktiv : ruhend}>{feld.label}</span>
      </div>
    )
  }

  if (feld.optionen && feld.optionen.length > 0) {
    return (
      <div style={{ ...stil, marginBottom: '.75rem' }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{feld.label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {feld.optionen.map((o) => (
            <span key={o.wert} style={istGewaehlt(wert, o.wert) ? aktiv : ruhend}>{o.text}</span>
          ))}
        </div>
      </div>
    )
  }

  const text = wert === undefined || wert === null || wert === '' ? '' : String(wert)
  return (
    <div style={stil}>
      <label style={lbl}>
        {feld.label}{feld.einheit ? ` [${feld.einheit}]` : ''}
        <div style={{ ...inp, color: text ? 'var(--text)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', marginTop: 6, whiteSpace: 'pre-wrap' }}>
          {text || '—'}
        </div>
      </label>
    </div>
  )
}

function Medikation({ payload }: { payload: Record<string, unknown> }) {
  const zeilen = Array.isArray(payload.medikation) ? (payload.medikation as Record<string, unknown>[]) : []
  if (zeilen.length === 0) return <div style={{ color: 'var(--text-secondary)' }}>Keine Medikation dokumentiert.</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          {['Zeit', 'Wirkstoff', 'Dosis', 'Applikation'].map((t) => (
            <th key={t} style={{ textAlign: 'left', ...lbl, padding: '4px 6px', borderBottom: '0.5px solid var(--border)' }}>{t}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z, i) => (
          <tr key={i}>
            {['zeit', 'wirkstoff', 'dosis', 'applikation'].map((s) => (
              <td key={s} style={{ padding: '4px 6px', borderBottom: '0.5px solid var(--border-subtle, rgba(0,0,0,0.06))' }}>
                {z[s] === undefined || z[s] === null ? '—' : String(z[s])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const raster: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem',
}

export default function AelrdProtokollView({ payload, changedFields: cf, tfChangedFields: tf }: Props) {
  return (
    <PubWrap>
      {AELRD_ABSCHNITTE.map((abschnitt) => {
        const felder = abschnitt.felder.map(aelrdFeld).filter(Boolean) as AelrdFeld[]
        if (felder.length === 0) return null
        // Optionsfelder und Freitexte brauchen die volle Breite, kurze Werte
        // stehen nebeneinander.
        const breit = felder.filter((f) => f.optionen?.length || f.typ === 'langtext' || f.typ === 'medikation')
        const schmal = felder.filter((f) => !breit.includes(f))
        return (
          <PubSection key={abschnitt.id} title={`${abschnitt.titel} · Seite ${abschnitt.seite}`}>
            {schmal.length > 0 ? (
              <div style={raster}>
                {schmal.map((f) => <Wert key={f.id} feld={f} payload={payload} cf={cf} tf={tf} />)}
              </div>
            ) : null}
            {breit.map((f) =>
              f.typ === 'medikation'
                ? <Medikation key={f.id} payload={payload} />
                : <Wert key={f.id} feld={f} payload={payload} cf={cf} tf={tf} />,
            )}
          </PubSection>
        )
      })}
    </PubWrap>
  )
}
