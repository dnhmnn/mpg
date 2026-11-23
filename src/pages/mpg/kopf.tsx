// Roter Kopf des MPG im Dunkelrot-Design (Owner, 22.11.2026: Startseite mit Kacheln, jeder Bereich eine
// eigene Seite mit Zurück). Der Rahmen (MpgLayout) zeigt einen Kopf (Seite aus benutzer/bausteine); die
// Ansicht, die gerade vorne ist, meldet Titel, Zurück, Knöpfe rechts und Reiter darunter (MpgKopf).
// Melden mehrere (Liste und Gerät auf dem Telefon), gilt die tiefste. Steht ein Detail am Rechner neben
// der Liste (ImBereich), zeigt es seinen Kopf klein in seiner Spalte; oben bleibt der Kopf der Liste.
// Knöpfe und Reiter kommen per Portal in den Kopf, damit sie zur Ansicht gehören (frische Werte).
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface KopfEintrag {
  id: number
  /** 0 Startseite, 1 Bereich (Geräte, Meldungen …), 2 Einzelnes (Gerät, Prüfung, Fall …) */
  tiefe: number
  titel: string
  unter?: string
  /** Wohin Zurück führt, wenn es keinen Verlauf gibt (sonst ein Schritt zurück) */
  zurueck: string
  /** Immer genau dorthin statt einen Schritt zurück (Startseite → Hub) */
  fest?: boolean
}

export interface KopfKontextWert {
  melden: (e: KopfEintrag) => void
  weg: (id: number) => void
  sieger: number | null
  rechtsZiel: HTMLElement | null
  reiterZiel: HTMLElement | null
}

export const KopfKontext = createContext<KopfKontextWert | null>(null)
/** Ansicht steht am Rechner neben der Liste (Gerät, Prüfung, Fall): Kopf klein in der Spalte */
export const ImBereich = createContext(false)

let naechste = 0

/** Wer gewinnt: die größte Tiefe, bei gleicher Tiefe die zuletzt gemeldete. */
export function siegerVon(eintraege: Iterable<KopfEintrag>): KopfEintrag | null {
  let s: KopfEintrag | null = null
  for (const e of eintraege) if (!s || e.tiefe > s.tiefe || (e.tiefe === s.tiefe && e.id > s.id)) s = e
  return s
}

/** Gleicher Inhalt? (Dann wird nicht neu gezeichnet.) */
export function gleicherKopf(a: KopfEintrag | undefined, b: KopfEintrag): boolean {
  return !!a && a.tiefe === b.tiefe && a.titel === b.titel && a.unter === b.unter && a.zurueck === b.zurueck && a.fest === b.fest
}

/**
 * Meldet den Kopf dieser Ansicht. `klein` zeigt ihn, wenn die Ansicht am Rechner neben der Liste steht
 * (dort ohne eigenen roten Kopf), etwa der bisherige Kopf mit Titel und Knöpfen.
 */
export function MpgKopf({ tiefe = 2, titel, unter, zurueck = '/mpg', fest, rechts, reiter, klein }: {
  tiefe?: number; titel: string; unter?: string; zurueck?: string; fest?: boolean
  rechts?: ReactNode; reiter?: ReactNode; klein?: ReactNode
}) {
  const k = useContext(KopfKontext)
  const imBereich = useContext(ImBereich)
  const [id] = useState(() => ++naechste)
  const aktiv = !!k && !imBereich
  useLayoutEffect(() => {
    if (!aktiv) return
    k!.melden({ id, tiefe, titel, unter, zurueck, fest })
  }, [aktiv, id, tiefe, titel, unter, zurueck, fest]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!aktiv) return
    return () => k!.weg(id)
  }, [aktiv, id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!aktiv) return <>{klein ?? null}</>
  if (k!.sieger !== id) return null
  return (
    <>
      {rechts && k!.rechtsZiel ? createPortal(rechts, k!.rechtsZiel) : null}
      {reiter && k!.reiterZiel ? createPortal(reiter, k!.reiterZiel) : null}
    </>
  )
}
