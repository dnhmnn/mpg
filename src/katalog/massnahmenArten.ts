// Die Maßnahmen, nach Art geordnet — für die Erfassung, nicht für das Papier.
//
// Der Bogen führt acht Kästen nebeneinander: Medizintechnik, Erweitertes
// Monitoring, Aktive Kühlung und so weiter, jeder mit seinen Kreuzen. Wer
// dokumentiert, denkt aber nicht in Kästen, sondern in Handlungen: um 08:42
// wurde etwas gemacht, und zwar das.
//
// Hier steht deshalb dieselbe Sache als Liste von Arten mit ihren Ausführungen.
// Die Listen werden NICHT abgeschrieben, sondern aus dem Katalog des Bogens
// und der Norm gelesen — eine zweite Liste wäre eine Liste, die irgendwann
// abweicht.
//
// Die Reanimation fehlt mit Absicht: sie ist keine Maßnahme unter anderen,
// sondern hat ihren eigenen Abschnitt mit Zeiten, Defibrillation und ROSC.

import { aelrdFeld } from './aelrd'
import { normOptionen } from './aelrdOptionen'
import { istSpiegelOption } from './aelrdSpiegel'

export type MassnahmeArt = { wert: string; text: string }

export type MassnahmeKategorie = {
  /** Kennung der Kategorie — gleich dem Feld des Bogens, das sie füllt. */
  id: string
  titel: string
  /** Kurzzeichen für die Liste der Einträge. */
  kurz: string
  /**
   * Der Bogen führt hier eine Schreiblinie statt Kreuze.
   *
   * Dann ist die Auswahl ein Vorschlag: eingetragen wird Text, und was die
   * Norm kennt, spart nur das Tippen.
   */
  frei: boolean
  arten: MassnahmeArt[]
}

/** Die Felder des Bogens, die diese Erfassung übernimmt. */
const KATEGORIEN: { feld: string; titel: string; kurz: string }[] = [
  { feld: 'zugaenge', titel: 'Zugang', kurz: 'ZUG' },
  { feld: 'medizintechnik', titel: 'Medizintechnik', kurz: 'TECH' },
  { feld: 'erweitertes_monitoring', titel: 'Erweitertes Monitoring', kurz: 'MON' },
  { feld: 'lagerung', titel: 'Lagerungs- und Rettungstechnik', kurz: 'LAG' },
  { feld: 'aktive_kuehlung', titel: 'Aktive Kühlung', kurz: 'KÜHL' },
  { feld: 'waermeerhalt', titel: 'Wärmeerhalt', kurz: 'WÄRM' },
  { feld: 'blutentnahme', titel: 'Blutentnahme', kurz: 'BLUT' },
  { feld: 'sonstige_massnahme', titel: 'Sonstige', kurz: 'SONST' },
]

export const MASSNAHMEN_KATEGORIEN: MassnahmeKategorie[] = KATEGORIEN.map((k) => {
  const feld = aelrdFeld(k.feld)
  const eigene = feld?.optionen
  const arten = eigene
    ? eigene
        .filter((o) => !istSpiegelOption(k.feld, o.wert))
        .map((o) => ({ wert: o.wert, text: o.text }))
    : (normOptionen(k.feld) ?? []).map((o) => ({ wert: o.wert, text: o.text }))
  return { id: k.feld, titel: k.titel, kurz: k.kurz, frei: !eigene, arten }
})

/** Die Felder des Bogens, die über diese Erfassung laufen. */
export const MASSNAHMEN_FELDER: string[] = MASSNAHMEN_KATEGORIEN.map((k) => k.id)

export function massnahmeKategorie(id: string): MassnahmeKategorie | undefined {
  return MASSNAHMEN_KATEGORIEN.find((k) => k.id === id)
}

/** Der Text einer Art, wie er in der Liste und auf dem Bogen erscheint. */
export function artText(kategorie: string, wert: string): string {
  const k = massnahmeKategorie(kategorie)
  return k?.arten.find((a) => a.wert === wert)?.text ?? wert
}

/**
 * Die rechtliche Begründung einer Maßnahme.
 *
 * Vier Wege, auf denen eine Maßnahme zulässig ist — und die Begründung gehört
 * zur Maßnahme, nicht zum Einsatz: derselbe Einsatz kann eine Basismaßnahme,
 * eine vor Ort delegierte und eine nach § 2a NotSanG erbrachte enthalten.
 *
 * Die Reihenfolge ist die vom Alltag her: das meiste ist Basismaßnahme.
 */
export type Rechtsgrund = {
  wert: string
  text: string
  /** Kurzform für die Liste und die Zeile auf dem Bogen. */
  kurz: string
}

export const RECHTSGRUENDE: Rechtsgrund[] = [
  { wert: 'basis', text: 'Basismaßnahme', kurz: 'Basis' },
  { wert: 'delegiert', text: 'delegiert vor Ort', kurz: 'delegiert' },
  { wert: 'notstand', text: 'gerechtfertigter Notstand', kurz: '§ 34 StGB' },
  { wert: 'notsang_2a', text: 'NotSanG § 2a', kurz: '§ 2a NotSanG' },
]

export function rechtsgrund(wert: string): Rechtsgrund | undefined {
  return RECHTSGRUENDE.find((r) => r.wert === wert)
}
