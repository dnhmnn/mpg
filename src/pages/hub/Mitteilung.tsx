// Mitteilung der Organisation (hub_notifications, useNotifications): ruhige Karte oben im
// Blatt statt schwebendem Fenster. „Verstanden“ merkt sie als gelesen (notification_status),
// „Später“ blendet sie bis zum nächsten Öffnen des Hubs aus. Text nur als Text, nie als HTML.

export default function Mitteilung({ titel, text, organisation, onVerstanden, onSpaeter }: {
  titel: string; text: string; organisation?: string; onVerstanden: () => void; onSpaeter: () => void
}) {
  return (
    <section className="bv-flaeche" data-probe="hub-mitteilung" aria-labelledby="hub-mitteilung-titel" style={{ marginBottom: 6 }}>
      <div className="hub-mitteilung">
        <small>{organisation ? `Mitteilung von ${organisation}` : 'Mitteilung deiner Organisation'}</small>
        <h2 id="hub-mitteilung-titel">{titel}</h2>
        {text && <p>{text}</p>}
      </div>
      <div className="bv-fuss">
        <button type="button" onClick={onSpaeter}>Später</button>
        <button type="button" onClick={onVerstanden}>Verstanden</button>
      </div>
    </section>
  )
}
