// Ein Feld eines Formulars nach seiner Art (Bauplan Vorgänge 4.1), im Stil der übrigen
// öffentlichen Formulare (pubStyles): Text, Langtext, Zahl (Ziffernfeld, Komma erlaubt),
// Datum, Uhrzeit, Auswahl (bis 5 Optionen als Zeilen mit Punkt, sonst Liste),
// Mehrfachauswahl (Zeilen mit Kästchen), Ja/Nein (zwei Knöpfe; nochmal tippen leert,
// wenn das Feld nicht Pflicht ist).
//
// Bezeichnung fett, Hilfetext darunter in Zweitfarbe, Pflicht als „ *“, Fehler darunter.
// Jeder Text als React-Text, nie als HTML (Bezeichnungen kommen von der Organisation).
// Das erste bedienbare Element trägt die Kennung feldElementId(feld.id) (Fokus nach einem
// Fehler, siehe pruefen.ts).

import { useId } from 'react'
import type { FeldDef } from '../../../lib/formular/felder'
import { FELD_GRENZEN } from '../../../lib/formular/felder'
import { field, inp, lbl, sel, ta } from '../pubStyles'
import { feldElementId } from './pruefen'

const AKZENT = 'var(--lbf-akzent)'
const GRAU = 'var(--warm-gray)'
const TEXT = 'var(--lbf-text)'
const RAND = 'var(--lbf-border)'

/** Ab so vielen Optionen eine Auswahlliste statt Zeilen. */
const ZEILEN_BIS = 5

const hilfeStil: React.CSSProperties = { fontSize: 12, color: GRAU, marginTop: 4, lineHeight: 1.45, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }
const fehlerStil: React.CSSProperties = { fontSize: 12, color: 'var(--lbf-fehler-text-2)', marginTop: 6, lineHeight: 1.4 }

function zeileStil(an: boolean, disabled?: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44, padding: '10px 14px', borderRadius: 10,
    border: `1.5px solid ${an ? AKZENT : RAND}`, background: an ? 'var(--lbf-akzent-weich)' : 'var(--lbf-card)',
    cursor: disabled ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 15, color: TEXT,
    opacity: disabled ? 0.6 : 1, boxSizing: 'border-box',
  }
}

function Punkt({ an }: { an: boolean }) {
  return (
    <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${an ? AKZENT : 'rgba(var(--lbf-rot-rgb),0.25)'}`, display: 'grid', placeItems: 'center', boxSizing: 'border-box' }}>
      {an ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lbf-akzent-grund)' }} /> : null}
    </span>
  )
}

function Kaestchen({ an }: { an: boolean }) {
  return (
    <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${an ? 'var(--lbf-akzent-grund)' : 'rgba(var(--lbf-rot-rgb),0.25)'}`, background: an ? 'var(--lbf-akzent-grund)' : 'transparent', display: 'grid', placeItems: 'center', boxSizing: 'border-box' }}>
      {an ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}
    </span>
  )
}

function text(w: unknown): string {
  if (typeof w === 'string') return w
  if (typeof w === 'number' && Number.isFinite(w)) return String(w).replace('.', ',')
  return ''
}

export default function FeldEingabe({ feld, wert, onWert, fehler, disabled }: {
  feld: FeldDef
  wert: unknown
  /** Neuer Wert; leer heißt '' (Texte), [] (Mehrfach) oder null (Ja/Nein). */
  onWert: (w: unknown) => void
  fehler?: string
  disabled?: boolean
}) {
  const roh = useId()
  const elId = feldElementId(feld.id)
  const labelId = `${roh}-l`
  const hilfeId = `${roh}-h`
  const fehlerId = `${roh}-f`
  const beschrieben = [feld.hilfe ? hilfeId : '', fehler ? fehlerId : ''].filter(Boolean).join(' ') || undefined
  const pflicht = feld.pflicht === true
  const rahmen: React.CSSProperties = fehler ? { borderColor: 'var(--lbf-fehler-text-2)' } : {}
  const opt = feld.optionen ?? []
  const gruppe = feld.typ === 'janein' || feld.typ === 'mehrfach' || (feld.typ === 'auswahl' && opt.length <= ZEILEN_BIS)

  const kopf = (
    <>
      <span id={labelId}>{feld.label}{pflicht ? ' *' : ''}</span>
      {feld.hilfe ? <span id={hilfeId} style={{ ...hilfeStil, display: 'block' }}>{feld.hilfe}</span> : null}
    </>
  )
  const fehlerZeile = fehler ? <div id={fehlerId} role="alert" style={fehlerStil}>{fehler}</div> : null

  // Zeilen, Kästchen und Ja/Nein: eine Gruppe mit Namen, kein <label> um die Knöpfe
  if (gruppe) {
    let inhalt: React.ReactNode = null
    if (feld.typ === 'janein') {
      const w = wert === true ? true : wert === false ? false : null
      const knopf = (ja: boolean, erster: boolean) => {
        const an = w === ja
        return (
          <button
            key={ja ? 'ja' : 'nein'} id={erster ? elId : undefined} type="button" aria-pressed={an} disabled={disabled}
            onClick={() => onWert(an ? (pflicht ? ja : null) : ja)}
            style={{ ...zeileStil(an, disabled), justifyContent: 'center', fontWeight: 700, color: an ? AKZENT : TEXT }}
          >
            {ja ? 'Ja' : 'Nein'}
          </button>
        )
      }
      inhalt = <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>{knopf(true, true)}{knopf(false, false)}</div>
    } else if (feld.typ === 'mehrfach') {
      const gewaehlt = Array.isArray(wert) ? (wert as unknown[]).filter((x): x is string => typeof x === 'string') : []
      inhalt = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          {opt.map((o, i) => {
            const an = gewaehlt.includes(o)
            return (
              <button
                key={o} id={i === 0 ? elId : undefined} type="button" role="checkbox" aria-checked={an} disabled={disabled}
                onClick={() => onWert(an ? gewaehlt.filter((x) => x !== o) : opt.filter((x) => x === o || gewaehlt.includes(x)))}
                style={zeileStil(an, disabled)}
              >
                <Kaestchen an={an} /><span style={{ fontWeight: an ? 700 : 400, minWidth: 0, overflowWrap: 'anywhere' }}>{o}</span>
              </button>
            )
          })}
        </div>
      )
    } else {
      const w = typeof wert === 'string' ? wert : ''
      inhalt = (
        <div role="radiogroup" aria-labelledby={labelId} aria-describedby={beschrieben} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          {opt.map((o, i) => {
            const an = w === o
            return (
              <button
                key={o} id={i === 0 ? elId : undefined} type="button" role="radio" aria-checked={an} disabled={disabled}
                onClick={() => onWert(an && !pflicht ? '' : o)}
                style={zeileStil(an, disabled)}
              >
                <Punkt an={an} /><span style={{ fontWeight: an ? 700 : 400, minWidth: 0, overflowWrap: 'anywhere' }}>{o}</span>
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <div style={field} role={feld.typ === 'auswahl' ? undefined : 'group'} aria-labelledby={feld.typ === 'auswahl' ? undefined : labelId} aria-describedby={feld.typ === 'auswahl' ? undefined : beschrieben}>
        <div style={lbl}>{kopf}</div>
        {inhalt}
        {fehlerZeile}
      </div>
    )
  }

  const gemeinsam = {
    id: elId, disabled, 'aria-invalid': fehler ? true : undefined, 'aria-describedby': beschrieben,
  } as const
  let eingabe: React.ReactNode
  if (feld.typ === 'langtext') {
    eingabe = <textarea {...gemeinsam} style={{ ...ta, ...rahmen }} rows={4} maxLength={FELD_GRENZEN.langtext} value={text(wert)} onChange={(e) => onWert(e.target.value)} />
  } else if (feld.typ === 'auswahl') {
    eingabe = (
      <select {...gemeinsam} style={{ ...sel, ...rahmen }} value={typeof wert === 'string' ? wert : ''} onChange={(e) => onWert(e.target.value)}>
        <option value="">Bitte wählen</option>
        {opt.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  } else if (feld.typ === 'zahl') {
    eingabe = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input {...gemeinsam} style={{ ...inp, ...rahmen, flex: 1, minWidth: 0 }} type="text" inputMode="decimal" autoComplete="off" value={text(wert)} onChange={(e) => onWert(e.target.value)} />
        {feld.einheit ? <span style={{ fontSize: 15, color: GRAU, marginTop: 6, flexShrink: 0, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }}>{feld.einheit}</span> : null}
      </div>
    )
  } else {
    const typ = feld.typ === 'datum' ? 'date' : feld.typ === 'uhrzeit' ? 'time' : 'text'
    eingabe = <input {...gemeinsam} style={{ ...inp, ...rahmen }} type={typ} maxLength={typ === 'text' ? FELD_GRENZEN.text : undefined} value={text(wert)} onChange={(e) => onWert(e.target.value)} />
  }
  return (
    <div style={field}>
      <label htmlFor={elId} style={lbl}>{kopf}</label>
      {eingabe}
      {fehlerZeile}
    </div>
  )
}
