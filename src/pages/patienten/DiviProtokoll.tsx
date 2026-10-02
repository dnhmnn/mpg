// Seite fuer die Protokollfassung 2.0 (DIVI 7.1).
//
// Oben der Umschalter zwischen Vorder- und Rueckseite, darunter die Maske im
// Raster des Vordrucks. Der Ausdruck entsteht aus denselben Werten.

import { useState } from 'react'
import DiviFormular, { type Werte } from './DiviFormular'
import { diviDrucken } from '../../lib/diviDruck'
import { DIVI_VERSION, pflichtfelder } from '../../katalog/divi'
import { NEUE_FASSUNG, mitFassung } from '../../lib/protokoll'

const ROT = '#600812'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

/** Welche Pflichtfelder sind noch leer? */
export function offenePflichtfelder(werte: Werte): string[] {
  return pflichtfelder()
    .filter((f) => {
      const w = werte[f.id]
      if (Array.isArray(w)) return w.length === 0
      return w === undefined || w === null || w === ''
    })
    .map((f) => f.label)
}

export default function DiviProtokoll() {
  const [werte, setWerte] = useState<Werte>({})
  const [seite, setSeite] = useState<1 | 2>(1)
  const [blockiert, setBlockiert] = useState(false)

  const offen = offenePflichtfelder(werte)

  function drucken() {
    const ok = diviDrucken(mitFassung(werte, NEUE_FASSUNG))
    setBlockiert(!ok)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#fff',
          borderBottom: `0.5px solid ${LINIE}`,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0e08' }}>Notfall-Einsatzprotokoll</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            Fassung 2.0 · DIVI {DIVI_VERSION}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto' }}>
          {([1, 2] as const).map((n) => {
            const aktiv = seite === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSeite(n)}
                style={{
                  padding: '9px 16px 7px',
                  background: 'transparent',
                  border: 'none',
                  borderTop: `2px solid ${aktiv ? ROT : 'transparent'}`,
                  color: aktiv ? ROT : GRAU,
                  fontFamily: 'inherit',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {n === 1 ? 'Vorderseite' : 'Rückseite'}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={drucken}
          style={{
            padding: '8px 16px',
            background: ROT,
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          Drucken
        </button>
      </header>

      {blockiert ? (
        <div style={{ margin: '12px 16px 0', padding: '9px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: '#1a0e08' }}>
          Der Browser hat das Druckfenster blockiert. Pop-ups für diese Seite erlauben, dann erneut drucken.
        </div>
      ) : null}

      {offen.length > 0 ? (
        <div style={{ margin: '12px 16px 0', padding: '9px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: '#1a0e08' }}>
          <span style={{ fontWeight: 700 }}>{offen.length} Pflichtfeld{offen.length === 1 ? '' : 'er'} offen:</span>{' '}
          <span style={{ fontStyle: 'italic', color: GRAU }}>{offen.join(', ')}</span>
        </div>
      ) : null}

      <main style={{ padding: 16 }}>
        <DiviFormular werte={werte} onChange={setWerte} seite={seite} />
      </main>
    </div>
  )
}
