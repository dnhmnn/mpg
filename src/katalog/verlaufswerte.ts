// Die Messwerte des Verlaufs — was auf dem Kurvenblatt eingetragen wird.
//
// Der Bogen hat drei übereinanderliegende Gitter mit eigenen Skalen. Jedes
// führt seine Werte mit einem eigenen Zeichen; die Zeichen stehen in der
// Spalte links neben dem Gitter als Legende.
//
// Die Skalen stehen hier als Zahlen, nicht als Beschriftung: nur so lässt
// sich ein Messwert auf eine Höhe im Gitter rechnen. Abgelesen sind sie an den
// Pfeilen der Vorlage — sechs Felder je Gitter, und die Pfeile sitzen auf den
// Linien dazwischen.

/** Die Form, mit der ein Wert ins Gitter gezeichnet wird. */
export type Zeichen =
  | 'fuenfeck'        // SpO₂ — Fünfeck, offen
  | 'sechseck'        // AF — Sechseck, offen
  | 'sechseck_voll'   // CO-Hb — Sechseck, gefüllt
  | 'kuppel_voll'     // HF — Halbkreis, gefüllt
  | 'kuppel'          // Puls — Halbkreis, offen
  | 'fuenfeck_voll'   // CO₂ — Fünfeck, gefüllt
  | 'druck'           // RR — systolisch und diastolisch, verbunden
  | 'stufe'           // O₂-Gabe — Stufenlinie

export type Verlaufswert = {
  id: string
  label: string
  einheit?: string
  /** Das Gitter, in dem der Wert steht. */
  gitter: 'spo2' | 'af' | 'hf'
  zeichen: Zeichen
  farbe: string
  min: number
  max: number
  /** Der zweite Wert, wo einer allein nichts sagt — der diastolische Druck. */
  zweiterWert?: string
}

export type Gitter = {
  id: 'spo2' | 'af' | 'hf'
  hoehe: number
  /** Beschriftung links, von oben nach unten — auf den Linien der Vorlage. */
  skala: { text: string; wert: number }[]
  /** Rechte Beschriftung, wo der Bogen eine zweite Skala führt. */
  skalaRechts?: { text: string; wert: number }[]
  /** Der Wertebereich von unten nach oben. */
  von: number
  bis: number
  vonRechts?: number
  bisRechts?: number
}

/**
 * Die drei Gitter mit ihren Skalen.
 *
 * Sechs Felder, sieben Linien. Beim Kreislauf-Gitter stehen fünf Pfeile
 * (250 bis 50) auf den Linien 1 bis 5 — also 50 je Feld, 0 unten und 300
 * oben. Die übrigen beiden Skalen sind nach demselben Muster gelesen.
 */
export const GITTER: Gitter[] = [
  {
    id: 'spo2',
    hoehe: 26,
    von: 70,
    bis: 100,
    skala: [{ text: '90 →', wert: 90 }, { text: '80 →', wert: 80 }],
  },
  {
    id: 'af',
    hoehe: 34,
    von: 0,
    bis: 30,
    skala: [{ text: '20 →', wert: 20 }, { text: '10 →', wert: 10 }],
  },
  {
    id: 'hf',
    hoehe: 132,
    von: 0,
    bis: 300,
    vonRechts: 0,
    bisRechts: 60,
    skala: [250, 200, 150, 100, 50].map((n) => ({ text: `${n} →`, wert: n })),
    skalaRechts: [50, 40, 30, 20, 10].map((n) => ({ text: `${n}`, wert: n })),
  },
]

export const VERLAUFSWERTE: Verlaufswert[] = [
  { id: 'spo2', label: 'SpO₂', einheit: '%', gitter: 'spo2', zeichen: 'fuenfeck', farbe: '#1d4ed8', min: 0, max: 100 },
  { id: 'af', label: 'AF', einheit: '/Min', gitter: 'af', zeichen: 'sechseck', farbe: '#4d7c0f', min: 0, max: 80 },
  { id: 'o2', label: 'O₂-Gabe', einheit: 'l/Min', gitter: 'af', zeichen: 'stufe', farbe: '#000000', min: 0, max: 30 },
  { id: 'cohb', label: 'CO-Hb', einheit: '%', gitter: 'af', zeichen: 'sechseck_voll', farbe: '#000000', min: 0, max: 100 },
  { id: 'hf', label: 'HF', einheit: '/Min', gitter: 'hf', zeichen: 'kuppel_voll', farbe: '#dc2626', min: 0, max: 300 },
  { id: 'puls', label: 'Puls', einheit: '/Min', gitter: 'hf', zeichen: 'kuppel', farbe: '#dc2626', min: 0, max: 300 },
  {
    id: 'rr_sys', label: 'RR systolisch', einheit: 'mmHg', gitter: 'hf', zeichen: 'druck',
    farbe: '#4d7c0f', min: 0, max: 300, zweiterWert: 'rr_dia',
  },
  { id: 'rr_dia', label: 'RR diastolisch', einheit: 'mmHg', gitter: 'hf', zeichen: 'druck', farbe: '#4d7c0f', min: 0, max: 300 },
  { id: 'etco2', label: 'CO₂', einheit: 'mmHg', gitter: 'hf', zeichen: 'fuenfeck_voll', farbe: '#15803d', min: 0, max: 60 },
]

export function verlaufswert(id: string): Verlaufswert | undefined {
  return VERLAUFSWERTE.find((v) => v.id === id)
}

export function gitterVon(id: string): Gitter | undefined {
  return GITTER.find((g) => g.id === id)
}

/**
 * Die Höhe im Gitter, auf der ein Wert steht — 0 oben, `hoehe` unten.
 *
 * Werte außerhalb der Skala geben nichts zurück: sie an den Rand zu kleben
 * hieße, eine Messung zu zeigen, die so nicht gemacht wurde.
 */
export function hoeheImGitter(wertId: string, zahl: number): number | null {
  const w = verlaufswert(wertId)
  const g = w && gitterVon(w.gitter)
  if (!w || !g) return null
  // Das Kreislauf-Gitter trägt zwei Skalen; CO₂ gehört auf die rechte.
  const rechts = w.id === 'etco2' && g.bisRechts !== undefined
  const von = rechts ? g.vonRechts! : g.von
  const bis = rechts ? g.bisRechts! : g.bis
  if (!Number.isFinite(zahl) || zahl < von || zahl > bis) return null
  return ((bis - zahl) / (bis - von)) * g.hoehe
}

/** Der Anteil von oben, auf dem ein Wert im Gitter steht — 0 oben, 1 unten. */
export function hoeheAnteil(g: Gitter, wert: number, rechts = false): number {
  const von = rechts ? g.vonRechts ?? g.von : g.von
  const bis = rechts ? g.bisRechts ?? g.bis : g.bis
  return (bis - wert) / (bis - von)
}
