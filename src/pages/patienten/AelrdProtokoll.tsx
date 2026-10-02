// Seite für das Einsatzprotokoll im ÄLRD-Layout.
//
// Hier liegt der leere Vordruck: zwei A4-Seiten zum Ausdrucken und
// handschriftlichen Ausfüllen. Die Vorschau zeigt denselben Bogen, der
// später auch die erfassten Daten trägt.

import { useMemo, useState } from 'react'
import { aelrdVordruck, aelrdVordruckDrucken } from '../../lib/aelrdProtokoll'
import { AELRD_FELDER, aelrdPflichtfelder, ohneDiviEntsprechung } from '../../katalog/aelrd'

const ROT = '#600812'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

export default function AelrdProtokoll() {
  const [organisation, setOrganisation] = useState('')
  const [blockiert, setBlockiert] = useState(false)
  const vorschau = useMemo(() => aelrdVordruck(organisation), [organisation])

  function drucken() {
    setBlockiert(!aelrdVordruckDrucken(organisation))
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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0e08' }}>Einsatzprotokoll</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            Leerer Vordruck · zwei Seiten A4
          </div>
        </div>

        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU }}>
            Organisation
          </span>
          <input
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="z. B. BRK Ansbach"
            style={{
              padding: '6px 10px',
              background: '#fff',
              border: `0.5px solid ${LINIE}`,
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 13,
              color: '#1a0e08',
              minWidth: 180,
            }}
          />
        </label>

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
          Vordruck drucken
        </button>
      </header>

      {blockiert ? (
        <div style={{ margin: '12px 16px 0', padding: '9px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: '#1a0e08' }}>
          Der Browser hat das Druckfenster blockiert. Pop-ups für diese Seite erlauben, dann erneut drucken.
        </div>
      ) : null}

      <main style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
          Vorschau
        </div>
        <iframe
          title="Vorschau des Vordrucks"
          srcDoc={vorschau}
          style={{
            width: '100%',
            height: '80vh',
            background: '#fff',
            border: `0.5px solid ${LINIE}`,
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        />

        <div style={{ marginTop: 16, background: '#fff', borderRadius: 12, borderLeft: `3px solid ${ROT}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
            Umfang
          </div>
          <div style={{ fontSize: 13, color: '#1a0e08', lineHeight: 1.6 }}>
            {AELRD_FELDER.length} Felder, davon {aelrdPflichtfelder().length} Pflichtfelder.{' '}
            <span style={{ fontStyle: 'italic', color: GRAU }}>
              {ohneDiviEntsprechung().length} Felder des Bogens haben in DIVI 7.1 keine Entsprechung —
              der Bogen folgt DIVI 6.0 und MIND 4.0.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
