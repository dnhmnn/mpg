// Glocke im roten Kopf des Hubs: öffnet das Blatt „Neuigkeiten“ (GlockeBlatt.tsx).
// Rund wie der Knopf der Kurzbefehle, mit kleinem hellem Abzeichen, wenn es Neues gibt
// (Zeilen der Neuigkeiten und eine ungelesene Mitteilung; Regeln in src/lib/hubGlocke.ts).
// Keine Bewegung, kein Blinken: Die Zahl steht einfach da. Aussehen: HUB_CSS (stil.ts, .hub-glocke).
//
// Dazu, wann das Blatt von selbst aufgeht: useMitteilungAutomatisch. Gemerkt wird je Benutzer
// und Mitteilung in sessionStorage (hub_mitteilung_auto), solange das Fenster offen ist; ist der
// Speicher gesperrt, nur im Speicher der laufenden App. Gemerkt wird erst, wenn das Blatt offen ist
// (GlockeBlatt), nicht schon, wenn der Zeitgeber abläuft.

import { useLayoutEffect, useRef } from 'react'
import {
  GLOCKE_AUTO_SCHLUESSEL, amHub, autoGezeigtLesen, autoGezeigtMerken, autoSchluessel, glockeAbzeichen, glockeLabel, mitteilungAutomatisch,
} from '../../lib/hubGlocke'

/** Knopf mit Glocke und Abzeichen. anzahl: glockeAnzahl() aus src/lib/hubGlocke.ts. */
export default function GlockeKnopf(p: { anzahl: number; onClick: () => void }): JSX.Element {
  const zeichen = glockeAbzeichen(p.anzahl)
  return (
    <button type="button" className="bv-rund hub-glocke" aria-label={glockeLabel(p.anzahl)} aria-haspopup="dialog"
      data-probe="hub-glocke" data-anzahl={p.anzahl} onClick={p.onClick}>
      <svg className="bv-i" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {zeichen && <span className="hub-glocke-zahl" aria-hidden="true">{zeichen}</span>}
    </button>
  )
}

/** Gemerkte Mitteilungen (einmal gelesen, danach nur noch im Speicher der laufenden App) */
let gemerkt: string[] | null = null

function gezeigtListe(): string[] {
  if (gemerkt) return gemerkt
  let roh: string | null = null
  try { roh = sessionStorage.getItem(GLOCKE_AUTO_SCHLUESSEL) } catch { /* gesperrt */ }
  gemerkt = autoGezeigtLesen(roh)
  return gemerkt
}

/** Diese Mitteilung hat der Benutzer gesehen: Das Blatt geht für sie nicht mehr von selbst auf. */
export function mitteilungGezeigt(nutzerId: string | null | undefined, mitteilungId: string | null | undefined): void {
  const k = autoSchluessel(nutzerId, mitteilungId)
  if (!k) return
  gemerkt = autoGezeigtMerken(gezeigtListe(), k)
  try { sessionStorage.setItem(GLOCKE_AUTO_SCHLUESSEL, JSON.stringify(gemerkt)) } catch { /* gesperrt oder voll */ }
}

/**
 * Öffnet das Blatt einmal von selbst, wenn eine Mitteilung da ist und nichts im Weg (bereit).
 * Die Seite sagt, wann sie bereit ist: Begrüßung vorbei, keine Einführung, kein „Neu in
 * Responda“, kein Blatt offen (auch nicht dieses), nicht „Apps anpassen“.
 * Gewartet wird kurz (verzoegerung): „Neu in Responda“ geht 700 ms nach dem Bereitsein auf und hat
 * so den Vortritt. Wird die Seite in der Zeit unbereit, zählt der Versuch nicht.
 *
 * Der Zeitgeber hängt an einem Layout-Effekt: Tippt man in der Wartezeit auf eine Kachel und die
 * neue Seite lädt noch, verdeckt React den Hub nur (Suspense) und räumt dabei Layout-Effekte ab,
 * passive nicht. So läuft der Zeitgeber nicht im verdeckten Hub ab. Zusätzlich prüft er beim
 * Ablaufen die Adresse (amHub). Als gesehen gemerkt wird die Mitteilung erst im offenen Blatt.
 */
export function useMitteilungAutomatisch(p: {
  nutzerId: string | null | undefined
  mitteilungId: string | null | undefined
  bereit: boolean
  oeffnen: () => void
  verzoegerung?: number
}): void {
  const { nutzerId, mitteilungId, bereit, verzoegerung = 1200 } = p
  const oeffnenRef = useRef(p.oeffnen)
  oeffnenRef.current = p.oeffnen

  useLayoutEffect(() => {
    if (!mitteilungAutomatisch({ nutzerId, mitteilungId, bereit, schonGezeigt: gezeigtListe() })) return
    const uhr = window.setTimeout(() => {
      // Inzwischen von Hand geöffnet und gesehen: nicht noch einmal
      if (!mitteilungAutomatisch({ nutzerId, mitteilungId, bereit: true, schonGezeigt: gezeigtListe() })) return
      // Schon auf dem Weg zu einer anderen Seite: nicht öffnen, nicht merken
      if (!amHub(window.location.pathname, window.location.search)) return
      oeffnenRef.current()
    }, verzoegerung)
    return () => window.clearTimeout(uhr)
  }, [nutzerId, mitteilungId, bereit, verzoegerung])
}
