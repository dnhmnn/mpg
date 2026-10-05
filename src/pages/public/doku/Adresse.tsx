// Eine Adresse in drei Feldern — Straße, PLZ, Ort.
//
// Gedruckt wird daraus die eine Zeile, die der Bogen führt. Unter den Feldern
// steht sie, damit zu sehen ist, was auf dem Papier landet.

import { adresseLesen, type Adressteil } from './adresse'
import type { Werte } from './DokuFeld'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

const eingabe: React.CSSProperties = {
  width: '100%', padding: '9px 10px', background: '#fff',
  border: `0.5px solid ${LINIE}`, borderRadius: 8,
  fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box',
}

function Teil({ feld, teil, titel, wert, breit, onChange }: {
  feld: string; teil: Adressteil; titel: string; wert: string; breit?: boolean
  onChange: (teil: Adressteil, w: string) => void
}) {
  return (
    <label style={{ display: 'block', gridColumn: breit ? 'span 2' : undefined }}>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: GRAU, marginBottom: 3 }}>
        {titel}
      </span>
      <input
        type="text" name={`${feld}_${teil}`} value={wert}
        inputMode={teil === 'plz' ? 'numeric' : undefined}
        onChange={(e) => onChange(teil, e.target.value)}
        style={eingabe}
      />
    </label>
  )
}

export default function Adresse({ feld, label, werte, onSetzen }: {
  feld: string
  label: string
  werte: Werte
  onSetzen: (teil: Adressteil, wert: string) => void
}) {
  const a = adresseLesen(werte, feld)
  const zeile = String(werte[feld] ?? '')
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Teil feld={feld} teil="strasse" titel="Straße und Nr." wert={a.strasse} breit onChange={onSetzen} />
        <Teil feld={feld} teil="plz" titel="PLZ" wert={a.plz} onChange={onSetzen} />
        <Teil feld={feld} teil="ort" titel="Ort" wert={a.ort} breit onChange={onSetzen} />
      </div>
      {/* Was auf dem Bogen stehen wird — eine Zeile, wie der Vordruck sie führt. */}
      {zeile ? (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: ROT, marginTop: 5 }}>
          auf dem Bogen: {zeile}
        </div>
      ) : null}
    </div>
  )
}
