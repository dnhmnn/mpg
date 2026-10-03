// Optionslisten für die Felder, die der Bogen als Freitext führt.
//
// 37 Felder des Bogens sind Textzeilen, für die die Norm eine Auswahl kennt:
// "Bewusstsein" ist auf dem Papier eine Linie, in DIVI 6.0 die Auswahl wach /
// getrübt / bewusstlos / analgosediert. Die Listen stehen deshalb NICHT hier,
// sondern werden aus dem Katalog der Norm gelesen — über die Zuordnung in
// aelrdNaep.ts, die ohnehin gepflegt wird. Eine zweite Liste wäre eine Liste,
// die irgendwann abweicht.
//
// Das spart zweimal: tippen statt schreiben, und der Wert ist später ohne
// Rätselraten in den DIVI-Datensatz zu übernehmen.

import { umbauFelder } from './aelrdNaep'
import { naepAlleEingaben, type NaepOption } from './naep'

export type NormOption = { wert: string; text: string; punkte?: number }

function optionenJeCode(): Map<string, NaepOption[]> {
  const aus = new Map<string, NaepOption[]>()
  for (const e of naepAlleEingaben()) {
    if (e.art === 'auswahl') aus.set(e.code, e.optionen)
    if (e.art === 'auswahlgruppe') for (const a of e.auswahlen) aus.set(a.code, e.optionen)
  }
  return aus
}

const register = (() => {
  const codes = optionenJeCode()
  const aus = new Map<string, NormOption[]>()
  for (const f of umbauFelder()) {
    const optionen = codes.get(f.naep)
    if (!optionen) continue
    aus.set(
      f.id,
      optionen.map((o) => ({ wert: o.term, text: o.term, punkte: o.numerisch })),
    )
  }
  return aus
})()

/**
 * Die Auswahl, die die Norm für dieses Freitextfeld vorsieht — oder nichts,
 * wenn es keine gibt (Diagnoselisten, Zahlen, Fragen).
 *
 * Gespeichert wird der Klartext der Norm, nicht ihr Code: so bleibt das Feld
 * mit dem alten Formular und dem Ausdruck verträglich.
 */
export function normOptionen(feldId: string): NormOption[] | undefined {
  return register.get(feldId)
}

/** Felder, die durch die Norm eine Auswahl bekommen. */
export function felderMitNormOptionen(): string[] {
  return [...register.keys()]
}
