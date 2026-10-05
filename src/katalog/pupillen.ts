// Der Pupillenstatus: zwei Augen, zwei Fragen.
//
// Der Bogen führt vier Zeilen — Weite rechts und links, Lichtreaktion rechts
// und links. Untereinander gestellt verliert man die Seite aus dem Blick;
// erhoben werden sie im Seitenvergleich, und genau darum geht es dabei.
//
// Die Antworten stehen nicht hier, sondern kommen aus der Norm (DIVI 6.0),
// über dieselbe Zuordnung, die der Bogen ohnehin führt.

import { normOptionen } from './aelrdOptionen'

export type PupillenFrage = {
  id: 'weite' | 'licht'
  titel: string
  /** Die Felder des Bogens, rechts und links. */
  rechts: string
  links: string
  antworten: { wert: string; text: string }[]
}

function antworten(feld: string): { wert: string; text: string }[] {
  return (normOptionen(feld) ?? []).map((o) => ({ wert: o.wert, text: o.text }))
}

export const PUPILLEN_FRAGEN: PupillenFrage[] = [
  {
    id: 'weite',
    titel: 'Weite',
    rechts: 'pupillen_weite_re',
    links: 'pupillen_weite_li',
    antworten: antworten('pupillen_weite_re'),
  },
  {
    id: 'licht',
    titel: 'Lichtreaktion',
    rechts: 'pupillen_licht_re',
    links: 'pupillen_licht_li',
    antworten: antworten('pupillen_licht_re'),
  },
]

/** Alle vier Felder, die das Schema führt. */
export const PUPILLEN_FELDER = PUPILLEN_FRAGEN.flatMap((f) => [f.rechts, f.links])

/**
 * Ob beide Seiten dasselbe zeigen.
 *
 * Isokor und seitengleich reagierend ist der Regelfall; der Unterschied ist
 * der Befund. Deshalb sagt die Maske ihn, statt vier Wörter nebeneinander zu
 * stellen und den Leser vergleichen zu lassen.
 */
export function seitengleich(werte: Record<string, unknown>): boolean {
  let beantwortet = false
  for (const f of PUPILLEN_FRAGEN) {
    const r = String(werte[f.rechts] ?? '').trim()
    const l = String(werte[f.links] ?? '').trim()
    // Eine Frage, die auf beiden Seiten offen ist, sagt nichts über die
    // Seitengleichheit — eine halb beantwortete sehr wohl.
    if (r === '' && l === '') continue
    if (r !== l) return false
    beantwortet = true
  }
  return beantwortet
}

/** Ob überhaupt etwas erhoben wurde. */
export function pupillenLeer(werte: Record<string, unknown>): boolean {
  return PUPILLEN_FELDER.every((f) => String(werte[f] ?? '').trim() === '')
}

/** Der Befund in einer Zeile, wie man ihn sagt. */
export function pupillenText(werte: Record<string, unknown>): string {
  if (pupillenLeer(werte)) return ''
  const wort = (feld: string, frage: PupillenFrage) => {
    const w = String(werte[feld] ?? '').trim()
    return frage.antworten.find((a) => a.wert === w)?.text ?? w ?? ''
  }
  if (seitengleich(werte)) {
    return PUPILLEN_FRAGEN.map((f) => wort(f.rechts, f)).filter(Boolean).join(', ') + ' — seitengleich'
  }
  const seite = (welche: 'rechts' | 'links') =>
    PUPILLEN_FRAGEN.map((f) => wort(f[welche], f)).filter(Boolean).join(', ') || '–'
  return `rechts ${seite('rechts')} · links ${seite('links')}`
}
