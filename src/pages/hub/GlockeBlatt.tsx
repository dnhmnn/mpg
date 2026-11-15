// Blatt „Neuigkeiten“ hinter der Glocke im roten Kopf des Hubs.
// Oben die Mitteilung der Organisation (falls ungelesen), darunter die Neuigkeiten aus den Apps
// (useNeuigkeiten.ts), sonst „Nichts Neues.“. Eine Zeile antippen schließt das Blatt und öffnet
// das Modul. „Später“ und „Verstanden“ nehmen die Mitteilung aus dem Blatt; bleibt dann nichts
// übrig, geht das Blatt zu, sonst bleibt es offen und der Fokus springt auf den Titel.
// Rahmen, Fokus und Schließen: Blatt.tsx. Text nur als Text, nie als HTML.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../../types'
import Blatt from './Blatt'
import { mitteilungGezeigt } from './Glocke'
import Mitteilung from './Mitteilung'
import NeuigkeitenZeilen from './NeuigkeitenListe'
import type { Neuigkeit } from './useNeuigkeiten'

export default function GlockeBlatt(p: {
  user: User | null
  neuigkeiten: Neuigkeit[] | null
  mitteilung: { id: string; title: string; message: string } | null
  organisation?: string
  onMitteilungVerstanden: () => void
  onMitteilungSpaeter: () => void
  onClose: () => void
}): JSX.Element {
  const { user, neuigkeiten, mitteilung, onClose } = p
  const navigate = useNavigate()
  const inhalt = useRef<HTMLDivElement>(null)

  // Gesehen ist gesehen: Erst hier, im offenen Blatt (von Hand oder von selbst geöffnet), wird die
  // Mitteilung gemerkt; danach geht das Blatt für sie nicht mehr von selbst auf
  useEffect(() => { mitteilungGezeigt(user?.id, mitteilung?.id) }, [user?.id, mitteilung?.id])

  // Nach „Später“ oder „Verstanden“: Bleibt etwas im Blatt, Fokus auf den Titel (der Knopf
  // verschwindet mit der Karte), sonst zu
  function nachMitteilung(aktion: () => void) {
    if (neuigkeiten?.length) {
      inhalt.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>('h2')?.focus()
      aktion()
    } else {
      aktion()
      onClose()
    }
  }

  function oeffnen(n: Neuigkeit) {
    onClose()
    navigate(n.url)
  }

  const leer = !mitteilung && neuigkeiten !== null && neuigkeiten.length === 0

  return (
    <Blatt titel="Neuigkeiten" probe="hub-neuigkeiten-blatt" onClose={onClose}>
      <div ref={inhalt} className="hub-glocke-inhalt">
        {mitteilung && (
          <Mitteilung titel={mitteilung.title} text={mitteilung.message} organisation={p.organisation}
            onVerstanden={() => nachMitteilung(p.onMitteilungVerstanden)}
            onSpaeter={() => nachMitteilung(p.onMitteilungSpaeter)} />
        )}
        {neuigkeiten?.length ? <NeuigkeitenZeilen liste={neuigkeiten} onWahl={oeffnen} /> : null}
        {neuigkeiten === null && !mitteilung && <p className="bv-leer" role="status">Lädt…</p>}
        {leer && <p className="bv-leer" data-probe="hub-nichts-neues">Nichts Neues.</p>}
      </div>
    </Blatt>
  )
}
