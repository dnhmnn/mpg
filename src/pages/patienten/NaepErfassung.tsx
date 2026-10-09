// Seite für die normtreue Erfassung nach DIVI 6.0.
//
// Die Maske ist aus dem Metamodell der DIVI erzeugt, nicht abgeschrieben. Was
// hier erfasst wird, trägt bereits die Codes der Norm — der Export ist
// deshalb kein Übersetzen, sondern ein Umschreiben derselben Werte in XML.
//
// Der Weg daneben bleibt, wie er ist: /protokoll-2 erfasst für den gedruckten
// ÄLRD-Bogen, der Felder kennt, die die Norm nicht hat (CO-Hb, IBP,
// Tracerdiagnose). Diese Seite ist für die Übermittlung, nicht für den Druck.

import { useMemo, useState } from 'react'
import NaepFormular, { leererZustand, type NaepZustand } from './NaepFormular'
import { naepDatenXml, naepDateiname, naepExportHinweise } from '../../lib/naepExport'
import {
  NAEP_ABSCHNITTE,
  NAEP_VERSION,
  naepAlleEingaben,
  naepAbschnitteFlach,
} from '../../katalog/naep'

const ROT = 'var(--lbf-akzent)'
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'var(--lbf-border)'

/** Wie viele Angaben der Zustand trägt — für die Anzeige, nicht für die Logik. */
export function erfassteAngaben(z: NaepZustand): number {
  const gefuellt = (w: unknown): boolean => {
    if (w === undefined || w === null || w === '') return false
    if (Array.isArray(w)) return w.length > 0
    if (typeof w === 'object') return Object.values(w as object).some(gefuellt)
    return true
  }
  return Object.values(z.werte).filter(gefuellt).length + Object.keys(z.leer).length
}

export default function NaepErfassung() {
  const [zustand, setZustand] = useState<NaepZustand>(leererZustand)
  const [protokollNr, setProtokollNr] = useState('')

  const hinweise = useMemo(() => naepExportHinweise(zustand), [zustand])
  const angaben = erfassteAngaben(zustand)

  function herunterladen() {
    const xml = naepDatenXml(zustand)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = naepDateiname(protokollNr)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, background: 'var(--lbf-card)',
        borderBottom: `0.5px solid ${LINIE}`, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Einsatzprotokoll — Datensatz</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            DIVI {NAEP_VERSION} · {angaben} {angaben === 1 ? 'Angabe' : 'Angaben'} erfasst
          </div>
        </div>

        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU }}>
            Protokoll-Nr.
          </span>
          <input
            value={protokollNr}
            onChange={(e) => setProtokollNr(e.target.value)}
            placeholder="für den Dateinamen"
            style={{ padding: '6px 10px', background: 'var(--lbf-input-bg)', border: `0.5px solid ${LINIE}`, borderRadius: 6, fontFamily: 'inherit', fontSize: 13, color: TEXT, minWidth: 150 }}
          />
        </label>

        <button type="button" onClick={herunterladen}
          style={{ padding: '8px 16px', background: ROT_GRUND, border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
          Datensatz erzeugen
        </button>
      </header>

      {hinweise.length > 0 ? (
        <div style={{ margin: '12px 16px 0', padding: '9px 12px', background: 'var(--lbf-card)', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: TEXT }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>
            {hinweise.length === 1 ? 'Ein Block geht nicht mit' : `${hinweise.length} Blöcke gehen nicht mit`}
          </div>
          {hinweise.map((h) => (
            <div key={h} style={{ fontStyle: 'italic', color: GRAU }}>{h}</div>
          ))}
        </div>
      ) : null}

      <main style={{ padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 210px', gap: 16, alignItems: 'start' }}>
        <div>
          <NaepFormular zustand={zustand} onChange={setZustand} />
        </div>

        <nav style={{ position: 'sticky', top: 74, background: 'var(--lbf-card)', borderRadius: 12, borderLeft: `3px solid ${ROT}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
            Abschnitte
          </div>
          {NAEP_ABSCHNITTE.map((a) => (
            <a key={a.code} href={`#naep-${a.code}`}
              style={{ display: 'block', fontSize: 12, color: TEXT, textDecoration: 'none', padding: '3px 0', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' }}>
              {a.titel}
            </a>
          ))}
          <div style={{ marginTop: 10, fontSize: 11, fontStyle: 'italic', color: GRAU, lineHeight: 1.5 }}>
            {naepAbschnitteFlach().length} Abschnitte, {naepAlleEingaben().length} Angaben — aus dem
            Metamodell der DIVI erzeugt.
          </div>
        </nav>
      </main>
    </div>
  )
}
