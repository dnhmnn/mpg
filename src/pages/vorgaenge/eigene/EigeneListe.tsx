// Abschnitt „Eigene Formulare“ im Reiter Formulare (Bauplan Vorgänge 3.7, Liste).
//
// Je Vorlage eine Zeile: Titel fett, darunter „Aktiv · Name frei eintragen · 3 neu“ bzw.
// „Inaktiv“; eine Zeile öffnet die Vorlage (`?seite=vorlage&id=<id>`). Darunter „Neues
// Formular“. Archivierte stehen eingeklappt unter „Archiviert (n)“. Nur mit Modul und Recht
// Vorgänge (die Schale zeigt den Abschnitt sonst gar nicht; hier noch einmal geprüft).
//
// Die Zahl „neu“ holt die Liste selbst (daten.ts); ohne Recht oder ohne Feld `status` fehlt sie
// still.

import { useCallback, useEffect, useState } from 'react'
import { Abschnitt, Aufklapp, Leer, Notiz, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'
import { neueJeVorlage, vorlagenLaden } from './daten'
import { vorlageZeile } from './logik'
import { E_TEXTE as T } from './texte'

type Rec = Record<string, unknown>

type Zustand = { art: 'laedt' } | { art: 'fehler' } | { art: 'ok'; vorlagen: Rec[] }

export default function EigeneListe({ k }: { k: VgKontext }) {
  const voll = vorgaengeVoll(k)
  const [z, setZ] = useState<Zustand>({ art: 'laedt' })
  const [neu, setNeu] = useState<Record<string, number> | null>(null)
  const [archivOffen, setArchivOffen] = useState(false)
  const [lauf, setLauf] = useState(0)
  const neuLaden = useCallback(() => setLauf((n) => n + 1), [])

  useEffect(() => {
    if (!voll || !k.orgId) return
    let weg = false
    setZ((alt) => (alt.art === 'ok' ? alt : { art: 'laedt' }))
    vorlagenLaden(k.orgId)
      .then((vorlagen) => { if (!weg) setZ({ art: 'ok', vorlagen }) })
      .catch(() => { if (!weg) setZ({ art: 'fehler' }) })
    void neueJeVorlage(k.orgId).then((n) => { if (!weg) setNeu(n) })
    return () => { weg = true }
  }, [voll, k.orgId, lauf])

  if (!voll) return null

  const kopf = <Abschnitt titel={T.eigeneFormulare} />
  const neuZeile = <Zeile titel={T.neuesFormular} art="neu" onClick={() => k.oeffne('vorlage')} />

  if (z.art === 'laedt') {
    return <>{kopf}<div className="bv-flaeche"><Leer>{T.laedt}</Leer></div></>
  }
  if (z.art === 'fehler') {
    return <>{kopf}<Notiz titel={T.eigeneFormulare} knopf={{ text: T.erneut, onClick: neuLaden }}>{T.ladenFehler}</Notiz></>
  }

  const aktuell = z.vorlagen.filter((v) => v.archiviert !== true)
  const archiv = z.vorlagen.filter((v) => v.archiviert === true)
  const zeile = (v: Rec) => {
    const id = String(v.id ?? '')
    const n = neu ? neu[id] ?? 0 : null
    return (
      <Zeile
        key={id} titel={String(v.title ?? '').trim() || T.ohneTitel} unter={vorlageZeile(v, n)} pfeil
        rechts={n ? <span className="vg-zahl" aria-hidden="true">{n}</span> : undefined}
        onClick={() => k.oeffne('vorlage', id)}
      />
    )
  }

  return (
    <>
      {kopf}
      <div className="bv-flaeche">
        {aktuell.length === 0 ? <Leer>{T.keineEigenen}</Leer> : aktuell.map(zeile)}
        {neuZeile}
      </div>
      {archiv.length ? (
        <>
          <Aufklapp titel={T.archiviert(archiv.length)} offen={archivOffen} onUmschalten={() => setArchivOffen(!archivOffen)} />
          {archivOffen ? <div className="bv-flaeche">{archiv.map(zeile)}</div> : null}
        </>
      ) : null}
    </>
  )
}
