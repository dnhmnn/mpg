// Seite für das Einsatzprotokoll im ÄLRD-Layout.
//
// Zwei Betriebsarten: der leere Vordruck zum Ausdrucken und Ausfüllen von
// Hand, oder die Erfassung am Gerät. Beide erzeugen denselben Bogen.

import { useMemo, useState } from 'react'
import AelrdFormular, { type Werte } from './AelrdFormular'
import { aelrdDrucken, aelrdHtml, aelrdVordruck, aelrdVordruckDrucken } from '../../lib/aelrdProtokoll'
import { AELRD_FELDER, aelrdPflichtfelder, ohneDiviEntsprechung } from '../../katalog/aelrd'
import { NEUE_FASSUNG, mitFassung } from '../../lib/protokoll'

const ROT = 'var(--lbf-akzent)'
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'var(--lbf-border)'

type Art = 'vordruck' | 'erfassung'

/** Welche Pflichtfelder sind noch leer? */
export function offenePflichtfelder(werte: Werte): string[] {
  return aelrdPflichtfelder()
    .filter((f) => {
      const w = werte[f.id]
      return Array.isArray(w) ? w.length === 0 : w === undefined || w === null || w === ''
    })
    .map((f) => f.label)
}

function Knopf({ text, aktiv, onClick }: { text: string; aktiv: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px 7px', background: 'transparent', border: 'none',
        borderTop: `2px solid ${aktiv ? ROT : 'transparent'}`,
        color: aktiv ? ROT : GRAU, fontFamily: 'inherit', fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
      }}
    >
      {text}
    </button>
  )
}

export default function AelrdProtokoll() {
  const [art, setArt] = useState<Art>('vordruck')
  const [seite, setSeite] = useState<1 | 2>(1)
  const [organisation, setOrganisation] = useState('')
  const [werte, setWerte] = useState<Werte>({})
  const [blockiert, setBlockiert] = useState(false)

  const vorschau = useMemo(
    () => (art === 'vordruck' ? aelrdVordruck(organisation) : aelrdHtml(werte, { organisation })),
    [art, organisation, werte],
  )
  const offen = offenePflichtfelder(werte)

  function drucken() {
    const ok =
      art === 'vordruck'
        ? aelrdVordruckDrucken(organisation)
        : aelrdDrucken(mitFassung(werte, NEUE_FASSUNG), { organisation })
    setBlockiert(!ok)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, background: 'var(--lbf-card)',
        borderBottom: `0.5px solid ${LINIE}`, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lbf-text)' }}>Einsatzprotokoll</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            Responda · zwei Seiten A4
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          <Knopf text="Vordruck" aktiv={art === 'vordruck'} onClick={() => setArt('vordruck')} />
          <Knopf text="Erfassen" aktiv={art === 'erfassung'} onClick={() => setArt('erfassung')} />
        </div>

        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU }}>
            Organisation
          </span>
          <input
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="z. B. BRK Ansbach"
            style={{ padding: '6px 10px', background: 'var(--lbf-input-bg)', border: `0.5px solid ${LINIE}`, borderRadius: 6, fontFamily: 'inherit', fontSize: 13, color: 'var(--lbf-text)', minWidth: 160 }}
          />
        </label>

        <button type="button" onClick={drucken}
          style={{ padding: '8px 16px', background: ROT_GRUND, border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
          Drucken
        </button>
      </header>

      {blockiert ? (
        <div style={{ margin: '12px 16px 0', padding: '9px 12px', background: 'var(--lbf-card)', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: 'var(--lbf-text)' }}>
          Der Browser hat das Druckfenster blockiert. Pop-ups für diese Seite erlauben, dann erneut drucken.
        </div>
      ) : null}

      {art === 'erfassung' && offen.length > 0 ? (
        <div style={{ margin: '12px 16px 0', padding: '9px 12px', background: 'var(--lbf-card)', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: 'var(--lbf-text)' }}>
          <span style={{ fontWeight: 700 }}>{offen.length} Pflichtfeld{offen.length === 1 ? '' : 'er'} offen:</span>{' '}
          <span style={{ fontStyle: 'italic', color: GRAU }}>{offen.join(', ')}</span>
        </div>
      ) : null}

      <main style={{ padding: 16, display: 'grid', gridTemplateColumns: art === 'erfassung' ? '1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
        {art === 'erfassung' ? (
          <div>
            <div style={{ display: 'flex', marginBottom: 10 }}>
              <Knopf text="Seite 1" aktiv={seite === 1} onClick={() => setSeite(1)} />
              <Knopf text="Seite 2" aktiv={seite === 2} onClick={() => setSeite(2)} />
            </div>
            <AelrdFormular werte={werte} onChange={setWerte} seite={seite} />
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
            Vorschau
          </div>
          <iframe
            title="Vorschau des Protokolls"
            srcDoc={vorschau}
            // Papierflaeche des Bogens bleibt weiss
            style={{ width: '100%', height: '80vh', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
          />

          <div style={{ marginTop: 16, background: 'var(--lbf-card)', borderRadius: 12, borderLeft: `3px solid ${ROT}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
              Umfang
            </div>
            <div style={{ fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.6 }}>
              {AELRD_FELDER.length} Felder, davon {aelrdPflichtfelder().length} Pflichtfelder.{' '}
              <span style={{ fontStyle: 'italic', color: GRAU }}>
                {ohneDiviEntsprechung().length} Felder des Bogens haben in DIVI 7.1 keine
                Entsprechung — der Bogen folgt DIVI 6.0 und MIND 4.0.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
