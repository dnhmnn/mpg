// Die Diagnosen zur Auswahl, nach Organgruppen.
//
// Der ÄLRD-Bogen führt an der Stelle eine Schreiblinie: "Tracerdiagnose". Die
// Tracerdiagnose selbst ist eine Kennzahl der bayerischen ÄLRD und steht in
// keinem Katalog, den diese App hat — siehe den Anhang-Vermerk in
// aelrdNaep.ts.
//
// Was es gibt, ist die Liste der Erkrankungen aus DIVI 6.0: Abschnitt E01,
// neun Organgruppen mit ihren Diagnosen. Die wird hier abgeleitet, damit
// angetippt statt getippt werden kann. Sie ist NICHT die amtliche
// Tracerdiagnosen-Liste — wird die nachgereicht, tritt sie an diese Stelle,
// und nur diese Datei ändert sich.
//
// Abgeleitet, nicht abgeschrieben: eine zweite Liste wäre eine Liste, die
// irgendwann abweicht.

import { naepAbschnitt } from './naep'

export type TracerDiagnose = {
  /** Der Code der Norm — er macht die Auswahl später exportfähig. */
  code: string
  text: string
}

export type TracerGruppe = {
  code: string
  titel: string
  diagnosen: TracerDiagnose[]
}

export const TRACER_GRUPPEN: TracerGruppe[] = (() => {
  const abschnitt = naepAbschnitt('E01')
  if (!abschnitt?.formular) return []
  return abschnitt.formular
    .map((e) => {
      if (e.art !== 'auswahl' || !e.term) return null
      return {
        code: e.code,
        titel: e.term,
        diagnosen: e.optionen.map((o) => ({ code: o.code, text: o.term })),
      }
    })
    .filter(Boolean) as TracerGruppe[]
})()

/** Die Gruppe, in der eine Diagnose steht — für die eingeklappte Anzeige. */
export function tracerGruppeVon(text: string): TracerGruppe | undefined {
  const gesucht = text.trim()
  if (!gesucht) return undefined
  return TRACER_GRUPPEN.find((g) => g.diagnosen.some((d) => d.text === gesucht))
}

/** Der Code der Norm zu einer gewählten Diagnose, falls sie aus der Liste stammt. */
export function tracerCode(text: string): string {
  const gesucht = text.trim()
  for (const g of TRACER_GRUPPEN) {
    const d = g.diagnosen.find((x) => x.text === gesucht)
    if (d) return d.code
  }
  return ''
}
