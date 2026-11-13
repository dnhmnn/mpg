// Ein begonnenes Protokoll liegt auf dem Gerät, aber niemand dieser Organisation ist angemeldet
// (öffentliche Seite, geteiltes Tablet). Dann setzt die Maske den Entwurf nicht von selbst ein,
// sondern fragt zuerst, ohne Patientendaten zu zeigen (Review F7). Erst „Fortsetzen“ zeigt den
// Inhalt; „Verwerfen“ löscht ihn nach einer zweiten Rückfrage.
//
// Solange die Frage offen ist, zeigt die Maske nichts anderes und schreibt keinen Entwurf: sonst
// überschriebe ein neues Protokoll den liegenden.
//
// Dazu ein schlichter Zustand „Gespeichertes wird geladen …“, solange der Tresor noch öffnet
// (Review F6): der Entwurf wird erst danach gelesen.

import { useState } from 'react'
import { standText } from './entwurf'

const ROT = 'var(--lbf-akzent)'
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'var(--lbf-border)'

export const ENTWURF_FRAGE_TEXTE = {
  titel: 'Begonnenes Protokoll auf diesem Gerät',
  stand: (stand: string) => {
    const t = standText(stand)
    return t ? `Zuletzt geändert ${t}.` : ''
  },
  erklaerung: 'Es kann von einer anderen Person stammen. Den Inhalt zeigt die Maske erst nach „Fortsetzen“.',
  fortsetzen: 'Fortsetzen',
  verwerfen: 'Verwerfen und neu beginnen',
  verwerfenFrage: 'Das begonnene Protokoll wird von diesem Gerät gelöscht und lässt sich nicht wiederherstellen.',
  endgueltig: 'Endgültig verwerfen',
  zurueck: 'Zurück',
  laedt: 'Gespeichertes wird geladen …',
} as const

const T = ENTWURF_FRAGE_TEXTE

const rahmen: React.CSSProperties = {
  background: 'var(--lbf-card)', border: `0.5px solid ${LINIE}`, borderRadius: 12, padding: '16px 16px 14px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)', maxWidth: 520, margin: '16px auto', boxSizing: 'border-box',
}

export function SpeicherLaedt() {
  return (
    <div style={rahmen} role="status">
      <div style={{ fontSize: 13, fontStyle: 'italic', color: GRAU }}>{T.laedt}</div>
    </div>
  )
}

export default function EntwurfFrage({ stand, onFortsetzen, onVerwerfen }: { stand: string; onFortsetzen: () => void; onVerwerfen: () => void }) {
  const [sicher, setSicher] = useState(false)
  const knopf: React.CSSProperties = {
    background: ROT_GRUND, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  }
  const leise: React.CSSProperties = {
    background: 'none', border: 'none', padding: '6px 0', color: ROT, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  }
  return (
    <section style={rahmen} aria-labelledby="entwurf-frage-titel" data-entwurf-frage="">
      <h2 id="entwurf-frage-titel" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>{T.titel}</h2>
      {T.stand(stand) ? <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, marginTop: 4 }}>{T.stand(stand)}</div> : null}
      <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, margin: '10px 0 14px' }}>{T.erklaerung}</p>
      {sicher ? (
        <div style={{ borderTop: `0.5px solid ${LINIE}`, paddingTop: 12 }}>
          <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, margin: '0 0 10px' }}>{T.verwerfenFrage}</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={knopf} onClick={onVerwerfen}>{T.endgueltig}</button>
            <button type="button" style={leise} onClick={() => setSicher(false)}>{T.zurueck}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={knopf} onClick={onFortsetzen}>{T.fortsetzen}</button>
          <button type="button" style={leise} onClick={() => setSicher(true)}>{T.verwerfen}</button>
        </div>
      )}
    </section>
  )
}
