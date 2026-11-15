// Mitteilung der Organisation (hub_notifications, useNotifications): ruhige Karte oben im Blatt
// „Neuigkeiten“ hinter der Glocke. „Verstanden“ merkt sie als gelesen (notification_status),
// „Später“ stellt sie bis zum nächsten Öffnen des Hubs zurück. Text nur als Text, nie als HTML.
// Aussehen: HUB_CSS in stil.ts (.hub-mitteilung).

import { useId } from 'react'

export default function Mitteilung({ titel, text, organisation, onVerstanden, onSpaeter }: {
  titel: string; text: string; organisation?: string; onVerstanden: () => void; onSpaeter: () => void
}): JSX.Element {
  const id = useId()
  return (
    <section className="bv-flaeche" data-probe="hub-mitteilung" aria-labelledby={id}>
      <div className="hub-mitteilung">
        <small>{organisation ? `Mitteilung von ${organisation}` : 'Mitteilung deiner Organisation'}</small>
        <h3 id={id}>{titel}</h3>
        {text && <p>{text}</p>}
      </div>
      <div className="bv-fuss">
        <button type="button" data-probe="hub-mitteilung-spaeter" onClick={onSpaeter}>Später</button>
        <button type="button" data-probe="hub-mitteilung-verstanden" onClick={onVerstanden}>Verstanden</button>
      </div>
    </section>
  )
}
