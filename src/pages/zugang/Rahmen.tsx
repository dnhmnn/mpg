// Rahmen für Startseite, Anmeldung und die öffentliche Seite einer Organisation: volle dunkelrote
// Fläche, großes Zeichen in der Mitte, darunter helle Karten (src/pages/zugang/stil.ts).
// html und body bleiben die ganze Zeit dunkelrot (useStatusleiste ohne Kopf): oben und unten
// Dunkelrot, auch als App vom Homebildschirm; beim Verlassen stellt der Hook alles zurück.
import React from 'react'
import { useStatusleiste } from '../../hooks/useStatusleiste'
import { Icon } from '../benutzer/bausteine'
import { BV_CSS } from '../benutzer/stil'
import { ZG_CSS } from './stil'

/** Logo einer Organisation: ganz und in seiner eigenen Form auf einer weißen Karte (nie im Kreis abgeschnitten). */
export function OrgLogo({ src }: { src: string }) {
  return <span className="zg-orglogo" aria-hidden="true"><img src={src} alt="" /></span>
}

/** Das Responda-Zeichen im hellen Kreis. */
export function Zeichen({ src, klein }: { src?: string | null; klein?: boolean }) {
  return <span className={`zg-logo${klein ? ' klein' : ''}`} aria-hidden="true"><img src={src || '/logo.svg'} alt="" /></span>
}

export function ZugangRahmen({ zeichen, titel, zeile, zeileKey, zurueck, zurueckLabel = 'Zurück', fuss = true, children }: {
  zeichen: React.ReactNode
  titel: React.ReactNode
  zeile?: React.ReactNode
  /** Wechselt die Zeile (Leitsatz), blendet sie mit diesem Schlüssel neu ein. */
  zeileKey?: string | number
  zurueck?: () => void
  zurueckLabel?: string
  fuss?: boolean
  children?: React.ReactNode
}) {
  useStatusleiste('--lbf-kopf')
  return (
    <div className="bv zg-seite">
      <style>{BV_CSS + ZG_CSS}</style>
      {/* Wie in Seite: als App vom Homebildschirm bis iOS 18 vorn (Uhr und Akku weiß auf Rot beim Rollen),
          sonst hinten (BV_CSS) */}
      <div className="bv-statusleiste" aria-hidden="true" />
      {zurueck && <button type="button" className="zg-zurueck" aria-label={zurueckLabel} onClick={zurueck}><Icon n="zurueck" /></button>}
      <main className="zg-mitte">
        <div className="zg-marke">
          {zeichen}
          <h1 className="zg-name">{titel}</h1>
          {zeile != null && <p className={`zg-zeile${zeileKey != null ? ' wechsel' : ''}`} key={zeileKey}>{zeile}</p>}
        </div>
        {children}
        {fuss && <p className="zg-fuss">© 2025 Responda Systems</p>}
      </main>
    </div>
  )
}
