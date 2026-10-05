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

/**
 * Die beiden Fragen für einen Erhebungszeitpunkt.
 *
 * Wie bei der GCS erhebt der Bogen den Status zweimal; `vorsatz` ist 'ub_'
 * für die Übergabe. Die Antworten kommen in beiden Fällen aus den Feldern des
 * Erstbefunds — die Übergabe führt die Norm nicht, die Antworten sind aber
 * dieselben.
 */
export function pupillenFragen(vorsatz = ''): PupillenFrage[] {
  return [
    {
      id: 'weite',
      titel: 'Weite',
      rechts: `${vorsatz}pupillen_weite_re`,
      links: `${vorsatz}pupillen_weite_li`,
      antworten: antworten('pupillen_weite_re'),
    },
    {
      id: 'licht',
      titel: 'Lichtreaktion',
      rechts: `${vorsatz}pupillen_licht_re`,
      links: `${vorsatz}pupillen_licht_li`,
      antworten: antworten('pupillen_licht_re'),
    },
  ]
}

export const PUPILLEN_FRAGEN: PupillenFrage[] = pupillenFragen()

/** Alle vier Felder, die das Schema führt. */
export function pupillenFelder(vorsatz = ''): string[] {
  return pupillenFragen(vorsatz).flatMap((f) => [f.rechts, f.links])
}

export const PUPILLEN_FELDER = pupillenFelder()

/**
 * Ob beide Seiten dasselbe zeigen.
 *
 * Isokor und seitengleich reagierend ist der Regelfall; der Unterschied ist
 * der Befund. Deshalb sagt die Maske ihn, statt vier Wörter nebeneinander zu
 * stellen und den Leser vergleichen zu lassen.
 */
export function seitengleich(werte: Record<string, unknown>, vorsatz = ''): boolean {
  let beantwortet = false
  for (const f of pupillenFragen(vorsatz)) {
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
export function pupillenLeer(werte: Record<string, unknown>, vorsatz = ''): boolean {
  return pupillenFelder(vorsatz).every((f) => String(werte[f] ?? '').trim() === '')
}

/** Der Befund in einer Zeile, wie man ihn sagt. */
export function pupillenText(werte: Record<string, unknown>, vorsatz = ''): string {
  if (pupillenLeer(werte, vorsatz)) return ''
  const wort = (feld: string, frage: PupillenFrage) => {
    const w = String(werte[feld] ?? '').trim()
    return frage.antworten.find((a) => a.wert === w)?.text ?? w ?? ''
  }
  const fragen = pupillenFragen(vorsatz)
  if (seitengleich(werte, vorsatz)) {
    return fragen.map((f) => wort(f.rechts, f)).filter(Boolean).join(', ') + ' — seitengleich'
  }
  const seite = (welche: 'rechts' | 'links') =>
    fragen.map((f) => wort(f[welche], f)).filter(Boolean).join(', ') || '–'
  return `rechts ${seite('rechts')} · links ${seite('links')}`
}
