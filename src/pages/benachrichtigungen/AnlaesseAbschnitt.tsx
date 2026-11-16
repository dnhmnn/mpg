// Anlässe der Person, nach Gruppen. Jede Änderung speichert sofort (die Seite reiht die Anfragen);
// gilt für das Konto, also für alle Geräte der Person.

import { Abschnitt, Hinweis } from '../benutzer/bausteine'
import type { StandAnlass } from '../../lib/push/api'
import { PUSH_TEXTE as T } from '../../lib/push/texte'
import { anlassSchalter, gruppieren } from './logik'
import { Schalter } from './Schalter'

export default function AnlaesseAbschnitt({ anlaesse, onSchalter }: {
  anlaesse: StandAnlass[]
  onSchalter: (a: StandAnlass, an: boolean) => void
}) {
  const gruppen = gruppieren(anlaesse)
  if (!gruppen.length) return <><Abschnitt titel="Anlässe" /><div className="bv-notiz"><p>{T.anlaesseLeer}</p></div></>
  return (
    <>
      {gruppen.map((g, i) => (
        <section key={g.key} aria-labelledby={`pu-gruppe-${g.key}`}>
          <div className="bv-ab"><h2 id={`pu-gruppe-${g.key}`}>{g.titel}</h2></div>
          {i === 0 && <Hinweis oben>{T.anlaesseHinweis}</Hinweis>}
          <div className="bv-flaeche">
            {g.anlaesse.map((a) => {
              const s = anlassSchalter(a)
              return <Schalter key={a.key} probe={`push-anlass-${a.key}`} titel={a.titel} unter={s.unter} an={s.an} disabled={s.gesperrt} onChange={(an) => onSchalter(a, an)} />
            })}
          </div>
        </section>
      ))}
    </>
  )
}
