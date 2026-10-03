// Felder des ÄLRD-Bogens für die Patientendokumentation.
//
// Sie rendern als native Formularelemente mit name-Attribut — collectData()
// in OrgPatienten sammelt alles mit name über das DOM ein, ohne eigenen
// Zustand. Deshalb braucht hier nichts an React-State zu hängen.
//
// Mehrfachauswahl kann sich nicht denselben name teilen (Checkboxen würden
// einander überschreiben). Sie schreibt deshalb `feld__option` als Boolean;
// mehrfachZusammenfassen() in lib/aelrdFormular macht daraus wieder eine
// Liste, bevor gespeichert wird.

import { aelrdFeld, type AelrdFeld } from '../../katalog/aelrd'
import { field, inp, lbl, ta } from './pubStyles'

const ROT = '#600812'

type Props = {
  /** Feld-IDs aus dem ÄLRD-Katalog. */
  ids: string[]
  /** Blendet ein Feld aus, wenn die Organisation es abgewählt hat. */
  hide?: (id: string) => boolean
  /** Vorbelegung aus einem geladenen Entwurf. */
  werte?: Record<string, unknown>
}

function vorgabe(werte: Record<string, unknown> | undefined, id: string): string {
  const w = werte?.[id]
  return w === undefined || w === null ? '' : String(w)
}

function istGewaehlt(werte: Record<string, unknown> | undefined, id: string, option: string): boolean {
  const w = werte?.[id]
  if (Array.isArray(w)) return w.map(String).includes(option)
  return String(w ?? '') === option
}

function Optionen({ feld, werte }: { feld: AelrdFeld; werte?: Record<string, unknown> }) {
  const mehrfach = feld.typ === 'mehrfach'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {(feld.optionen ?? []).map((o) => (
        <label
          key={o.wert}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', border: '1.5px solid rgba(96,8,18,0.15)',
            borderRadius: 18, background: '#fff',
            fontSize: 14, color: '#1a0e08', cursor: 'pointer',
          }}
        >
          {/* Mehrfachwahl braucht technisch Kästchen — gezeichnet wird
              trotzdem der runde Knopf des Bogens. */}
          <input
            type={mehrfach ? 'checkbox' : 'radio'}
            name={mehrfach ? `${feld.id}__${o.wert}` : feld.id}
            value={mehrfach ? undefined : o.wert}
            defaultChecked={istGewaehlt(werte, feld.id, o.wert)}
            style={{ accentColor: ROT, width: 16, height: 16, borderRadius: '50%' }}
          />
          {o.text}
        </label>
      ))}
    </div>
  )
}

function Skala({ feld, werte }: { feld: AelrdFeld; werte?: Record<string, unknown> }) {
  const von = feld.min ?? 0
  const bis = feld.max ?? 10
  const gewaehlt = vorgabe(werte, feld.id)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {Array.from({ length: bis - von + 1 }, (_, i) => von + i).map((n) => (
        <label
          key={n}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 40, padding: '8px 0', border: '1.5px solid rgba(96,8,18,0.15)',
            borderRadius: 8, background: '#fff', fontSize: 15, cursor: 'pointer',
          }}
        >
          <input
            type="radio" name={feld.id} value={String(n)}
            defaultChecked={gewaehlt === String(n)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          {n}
        </label>
      ))}
    </div>
  )
}

function EinFeld({ feld, werte }: { feld: AelrdFeld; werte?: Record<string, unknown> }) {
  if (feld.typ === 'check') {
    return (
      <div style={field}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#1a0e08', cursor: 'pointer' }}>
          <input
            type="checkbox" name={feld.id}
            defaultChecked={Boolean(werte?.[feld.id])}
            style={{ accentColor: ROT, width: 18, height: 18 }}
          />
          {feld.label}
        </label>
      </div>
    )
  }

  const beschriftung = feld.label + (feld.pflicht ? ' *' : '') + (feld.einheit ? ` [${feld.einheit}]` : '')

  if (feld.optionen && feld.optionen.length > 0) {
    return (
      <div style={field}>
        <label style={lbl}>{beschriftung}</label>
        <Optionen feld={feld} werte={werte} />
      </div>
    )
  }

  if (feld.typ === 'skala') {
    return (
      <div style={field}>
        <label style={lbl}>{beschriftung}</label>
        <Skala feld={feld} werte={werte} />
      </div>
    )
  }

  if (feld.typ === 'langtext') {
    return (
      <div style={field}>
        <label style={lbl}>{beschriftung}</label>
        <textarea name={feld.id} defaultValue={vorgabe(werte, feld.id)} style={ta} />
      </div>
    )
  }

  const typ = feld.typ === 'zahl' ? 'number' : feld.typ === 'datum' ? 'date' : feld.typ === 'zeit' ? 'time' : 'text'
  return (
    <div style={field}>
      <label style={lbl}>{beschriftung}</label>
      <input
        type={typ} name={feld.id} defaultValue={vorgabe(werte, feld.id)}
        min={feld.min} max={feld.max} style={inp}
      />
    </div>
  )
}

/** Eine Reihe von ÄLRD-Feldern, in der Reihenfolge des Bogens. */
export default function AelrdFelder({ ids, hide, werte }: Props) {
  return (
    <>
      {ids
        .filter((id) => !hide?.(id))
        .map((id) => aelrdFeld(id))
        .filter(Boolean)
        .map((feld) => (
          <EinFeld key={feld!.id} feld={feld!} werte={werte} />
        ))}
    </>
  )
}
