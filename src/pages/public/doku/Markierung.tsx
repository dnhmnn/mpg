// Ein Feld der Maske anklicken, um danach zu fragen.
//
// Der Beauftragte liest das Protokoll und stößt auf eine Zahl, die er nicht
// nachvollziehen kann. Er soll sie antippen können — nicht ihren Namen in die
// Rückfrage tippen müssen. Dafür legt sich über das Feld eine Fläche, die den
// Klick fängt: das Feld selbst bleibt unberührt, es wird ja nur gelesen.
//
// Beim Teamführer steht dieselbe Markierung, nur ohne Fläche darüber: er sieht
// damit auf einen Blick, um welches Feld es geht.

import type React from 'react'

const ROT = 'var(--lbf-akzent)'

export function Feldrahmen({ markiert, anklickbar, beschriftung, onKlick, children }: {
  /** Zu diesem Feld steht eine Rückfrage offen. */
  markiert: boolean
  /** Antippen markiert das Feld — nur beim Stellen der Rückfrage. */
  anklickbar?: boolean
  /** Der Feldname, für die Vorlesehilfe. */
  beschriftung?: string
  onKlick?: () => void
  children: React.ReactNode
}) {
  // Ohne Markierung und ohne Klickfläche bleibt das Feld, wie es war: kein
  // zusätzlicher Kasten, keine Verschiebung im Raster.
  if (!markiert && !anklickbar) return <>{children}</>
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 10,
        // Der Umriss statt eines Rahmens: er verschiebt nichts.
        outline: markiert ? `1.5px solid ${ROT}` : `1px dashed rgba(var(--lbf-rot-rgb),0.25)`,
        outlineOffset: 2,
        background: markiert ? 'var(--lbf-akzent-weich)' : undefined,
      }}
    >
      {children}
      {markiert ? (
        // Der Punkt sitzt auf der Ecke, nicht im Feld: er darf keinen Wert
        // verdecken.
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, right: 0, transform: 'translate(50%,-50%)',
            width: 9, height: 9, borderRadius: 5, background: ROT,
          }}
        />
      ) : null}
      {anklickbar ? (
        <button
          type="button" onClick={onKlick} aria-pressed={markiert}
          aria-label={`${beschriftung ?? 'Feld'} ${markiert ? 'nicht mehr markieren' : 'für die Rückfrage markieren'}`}
          style={{
            position: 'absolute', inset: 0,
            // Die Maske ist beim Ansehen stillgelegt; die Klickfläche nicht,
            // sonst käme der Klick nie an.
            pointerEvents: 'auto',
            background: 'transparent', border: 'none', borderRadius: 10,
            cursor: 'pointer', padding: 0, margin: 0,
          }}
        />
      ) : null}
    </div>
  )
}
