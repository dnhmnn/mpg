// Ein Protokoll ansehen — in der Maske, in der es erfasst wurde.
//
// Nicht in einer zweiten Darstellung davon: wer in Unitas oder in der
// Patientenverwaltung "Ansehen" drückt, soll dasselbe sehen wie der, der es
// ausgefüllt hat. Dieselben Zettel, dieselben Schritte, dieselben Masken —
// nur dass nichts geschrieben wird.
//
// Zwei Darstellungen für dasselbe Protokoll hießen zwei Gliederungen, und
// damit zwei Stellen, an denen etwas fehlen kann.

import { lazy, Suspense } from 'react'
import { useOrganisation } from '../hooks/useOrganisation'
import { OrgKontext } from '../pages/public/OrgPublicLayout'

const Doku = lazy(() => import('../pages/public/doku/Doku'))

const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

/**
 * Die Maske allein, ohne Rahmen.
 *
 * Die Patientenverwaltung bringt ihr eigenes Fenster mit; dort wird nur der
 * Inhalt gebraucht.
 */
export function ProtokollInhalt({ patientId }: { patientId: string }) {
  const { org, fehler } = useOrganisation()
  if (fehler) return <p style={{ padding: 24, color: GRAU, fontStyle: 'italic' }}>{fehler}</p>
  if (!org) return <p style={{ padding: 24, color: GRAU, fontStyle: 'italic' }}>Lade …</p>
  return (
    <OrgKontext org={org} orgCode={org.org_code}>
      <Suspense fallback={null}>
        <Doku protokollId={patientId} nurLesen />
      </Suspense>
    </OrgKontext>
  )
}

export default function ProtokollFenster({ patientId, titel, onSchliessen }: {
  patientId: string
  /** Die Überschrift des Fensters — meist der Name des Patienten. */
  titel?: string
  onSchliessen: () => void
}) {
  return (
    <div
      role="dialog" aria-label="Protokoll"
      /*
       * Über allem, was die aufrufende Seite stapelt.
       *
       * Unitas legt seinen Kopf auf 100 und die Leiste darunter auf 3000, die
       * Patientenverwaltung ihre Fenster auf 3100. Lag dieses Fenster
       * darunter, verdeckte der fremde Kopf den Schließen-Knopf — das Fenster
       * ließ sich öffnen und nicht mehr zumachen.
       */
      style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column' }}
    >
      <header style={{ flexShrink: 0, background: '#fff', borderBottom: `0.5px solid ${LINIE}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontStyle: 'italic', color: 'var(--text)' }}>
            {titel || 'Protokoll'}
          </div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            so, wie es erfasst wurde · nur ansehen
          </div>
        </div>
        <button
          type="button" onClick={onSchliessen} aria-label="Schließen"
          style={{ background: 'none', border: 'none', color: GRAU, fontSize: 26, lineHeight: 1, padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ×
        </button>
      </header>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ProtokollInhalt patientId={patientId} />
      </div>
    </div>
  )
}
