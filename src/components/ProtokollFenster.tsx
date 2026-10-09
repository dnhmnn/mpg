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
import { OrgKontext, type Organization } from '../pages/public/OrgPublicLayout'
import { istDivi } from '../lib/protokoll'
import ProtokollView from './ProtokollView'

const Doku = lazy(() => import('../pages/public/doku/Doku'))

const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

/**
 * Die Maske allein, ohne Rahmen.
 *
 * Die Patientenverwaltung bringt ihr eigenes Fenster mit; dort wird nur der
 * Inhalt gebraucht.
 */
type Ansicht = {
  patientId: string
  /**
   * Die Nutzlast des Protokolls, wenn die aufrufende Seite sie schon hat.
   *
   * An ihr hängt, welche Ansicht richtig ist: Protokolle nach dem
   * ÄLRD-Bogen zeigt die Maske, in der sie erfasst wurden. Die älteren
   * tragen andere Feldnamen — in der neuen Maske stünden sie leer da, so
   * wie ein neues Protokoll im alten Bogen leer steht. Sie behalten darum
   * die gewachsene Ansicht.
   */
  payload?: unknown
  /** Felder antippen, um danach zu fragen — statt sie auszufüllen. */
  markieren?: boolean
  markiert?: string[]
  onMarkieren?: (feldId: string) => void
  /** Felder, zu denen eine Rückfrage offen ist. */
  hervorgehoben?: string[]
  /**
   * Mit der Druckansicht beginnen.
   *
   * Wer das Protokoll nur gezeigt bekommt — der Patient, der Rettungsdienst
   * am Zugangscode —, will den Bogen sehen, nicht die Erfassungsmaske. Von
   * dort führt die Lupe oben rechts ins Formular.
   */
  pdfZuerst?: boolean
  /** Ein Satz, der zum Zugang gehört — etwa, bis wann er gilt. */
  hinweis?: string
}

/** Die alte Fassung in ihrer eigenen Ansicht — sie braucht keine Organisation. */
function alteFassung(payload: unknown) {
  return (
    <div style={{ background: 'var(--warm-bg)', paddingBottom: 24 }}>
      <ProtokollView payload={payload as never} />
    </div>
  )
}

/**
 * Die Maske zu einer bekannten Organisation.
 *
 * Für Seiten ohne Anmeldung: der Zugangscode des Patienten führt auf eine
 * öffentliche Seite, und der Hook für die Organisation hängt am angemeldeten
 * Benutzer — er schickte den Patienten zur Anmeldung.
 */
export function ProtokollInhaltFuerOrg({ org, patientId, payload, pdfZuerst, hinweis, markieren, markiert, onMarkieren, hervorgehoben }: Ansicht & { org: Organization }) {
  if (payload !== undefined && !istDivi(payload)) return alteFassung(payload)
  return (
    <OrgKontext org={org} orgCode={org.org_code}>
      <Suspense fallback={null}>
        <Doku
          protokollId={patientId} nurLesen pdfZuerst={pdfZuerst} hinweis={hinweis}
          markieren={markieren} markiert={markiert} onMarkieren={onMarkieren}
          hervorgehoben={hervorgehoben}
        />
      </Suspense>
    </OrgKontext>
  )
}

export function ProtokollInhalt(eigenschaften: Ansicht) {
  const { org, fehler } = useOrganisation()
  if (eigenschaften.payload !== undefined && !istDivi(eigenschaften.payload)) {
    return alteFassung(eigenschaften.payload)
  }
  if (fehler) return <p style={{ padding: 24, color: GRAU, fontStyle: 'italic' }}>{fehler}</p>
  if (!org) return <p style={{ padding: 24, color: GRAU, fontStyle: 'italic' }}>Lade …</p>
  return <ProtokollInhaltFuerOrg org={org} {...eigenschaften} />
}

export default function ProtokollFenster({ patientId, payload, titel, onSchliessen }: {
  patientId: string
  /** Die Nutzlast, damit die richtige Ansicht gewählt werden kann. */
  payload?: unknown
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
        <ProtokollInhalt patientId={patientId} payload={payload} />
      </div>
    </div>
  )
}
