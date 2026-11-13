// Eine Liste von Feldern (Bauplan Vorgänge 4.1): eigene Felder eines Standardformulars oder
// die Felder eines Abschnitts eines eigenen Formulars. Werte und Fehler hält der Aufrufer.

import type { FeldDef } from '../../../lib/formular/felder'
import FeldEingabe from './FeldEingabe'

export default function EigeneFelder({ felder, werte, onWert, fehler = {}, disabled }: {
  felder: FeldDef[]
  werte: Record<string, unknown>
  onWert: (id: string, w: unknown) => void
  fehler?: Record<string, string>
  disabled?: boolean
}) {
  return (
    <>
      {felder.filter((f) => f.aus !== true).map((f) => (
        <FeldEingabe key={f.id} feld={f} wert={werte[f.id]} onWert={(w) => onWert(f.id, w)} fehler={fehler[f.id]} disabled={disabled} />
      ))}
    </>
  )
}
