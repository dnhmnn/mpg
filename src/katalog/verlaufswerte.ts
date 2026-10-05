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
  /**
   * Die Felder in der Höhe.
   *
   * Die Vorlage hat ein feines Netz: zwischen zwei beschrifteten Linien liegt
   * noch eine. Beim Kreislauf sind das zwölf Felder zu je 25, bei den oberen
   * beiden sechs zu je fünf.
   */
  zeilen: number
  /**
   * Der Anteil an der Höhe, die der Kasten für die Gitter übrig lässt.
   *
   * Feste Höhen standen hier einmal — und ließen vierzig Prozent des Kastens
   * leer. Die Vorlage füllt ihn ganz aus, also rechnet der Ausdruck die Höhen
   * aus dem Kasten. Die Verhältnisse sind die der Vorlage.
   */
  anteil: number
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
    anteil: 26 / 192,
    zeilen: 6,
    von: 70,
    bis: 100,
    skala: [{ text: '90 →', wert: 90 }, { text: '80 →', wert: 80 }],
  },
  {
    id: 'af',
    anteil: 34 / 192,
    zeilen: 6,
    von: 0,
    bis: 30,
    skala: [{ text: '20 →', wert: 20 }, { text: '10 →', wert: 10 }],
  },
  {
    id: 'hf',
    anteil: 132 / 192,
    zeilen: 12,
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
 * Wo ein Wert im Gitter steht — 0 ganz oben, 1 ganz unten.
 *
 * Ein Anteil statt einer Höhe: wie hoch das Gitter gedruckt wird, entscheidet
 * der Kasten des Bogens, nicht der Katalog.
 *
 * Werte außerhalb der Skala geben nichts zurück: sie an den Rand zu kleben
 * hieße, eine Messung zu zeigen, die so nicht gemacht wurde.
 */
export function anteilImGitter(wertId: string, zahl: number): number | null {
  const w = verlaufswert(wertId)
  const g = w && gitterVon(w.gitter)
  if (!w || !g) return null
  // Das Kreislauf-Gitter trägt zwei Skalen; CO₂ gehört auf die rechte.
  const rechts = w.id === 'etco2' && g.bisRechts !== undefined
  const von = rechts ? g.vonRechts! : g.von
  const bis = rechts ? g.bisRechts! : g.bis
  if (!Number.isFinite(zahl) || zahl < von || zahl > bis) return null
  return hoeheAnteil(g, zahl, rechts)
}

/** Der Anteil von oben, auf dem ein Wert im Gitter steht — 0 oben, 1 unten. */
export function hoeheAnteil(g: Gitter, wert: number, rechts = false): number {
  const von = rechts ? g.vonRechts ?? g.von : g.von
  const bis = rechts ? g.bisRechts ?? g.bis : g.bis
  return (bis - wert) / (bis - von)
}

/**
 * Die Zeitachse des Kurvenblatts.
 *
 * Die Vorlage hat ein festes Netz und schreibt die Uhrzeiten darunter — alle
 * sechs Felder eine. Die Punkte sitzen also auf ihrer Uhrzeit, nicht in der
 * Reihenfolge der Eingabe: zwei Messungen im Abstand von einer Minute stehen
 * nebeneinander, zwei im Abstand einer Stunde weit auseinander.
 */
export const SPALTEN = 36

/** Alle wieviel Felder eine Uhrzeit unter dem Gitter steht. */
export const SPALTEN_JE_BESCHRIFTUNG = 6

/** Die Schritte, aus denen die Achse ihren wählt — Minuten je Feld. */
export const SCHRITTE = [2.5, 5, 10, 15, 30]

export type Zeitachse = {
  /** Minute des Tages, auf der das Gitter links beginnt. */
  start: number
  /** Minuten je Feld. */
  schritt: number
}

/** Minuten des Tages aus "HH:MM"; null, wenn es keine Uhrzeit ist. */
export function minuten(zeit: string): number | null {
  const t = /^(\d{1,2}):(\d{2})$/.exec(zeit.trim())
  if (!t) return null
  const h = Number(t[1])
  const m = Number(t[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** "HH:MM" aus Minuten des Tages — über Mitternacht hinaus zählt es weiter. */
export function uhrzeit(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Die Achse zu einer Reihe von Uhrzeiten.
 *
 * Sie beginnt auf der Viertelstunde vor der ersten Messung und wählt den
 * kleinsten Schritt, in dem alle Messungen auf das Blatt passen. Reicht auch
 * der größte nicht, bleibt es beim größten — dann stehen die spätesten
 * Messungen am rechten Rand, statt dass das Gitter die Zeit verfälscht.
 */
export function zeitachse(zeiten: string[]): Zeitachse | null {
  const werte = zeiten.map(minuten).filter((m): m is number => m !== null)
  if (werte.length === 0) return null
  const erste = Math.min(...werte)
  const letzte = Math.max(...werte)
  const viertel = Math.floor(erste / 15) * 15
  const waehlen = (von: number) => {
    const spanne = letzte - von
    return SCHRITTE.find((s) => spanne <= s * SPALTEN) ?? SCHRITTE[SCHRITTE.length - 1]
  }
  // Ein Vorlauf, wenn die erste Messung sonst auf dem linken Rand säße: ihr
  // Zeichen wäre halb abgeschnitten, und das Blatt begänne mitten im Einsatz.
  const start = erste - viertel < 2 * waehlen(viertel) ? viertel - 15 : viertel
  return { start, schritt: waehlen(start) }
}

/** Wo eine Uhrzeit auf der Achse steht — in Prozent der Gitterbreite. */
export function stelle(achse: Zeitachse, zeit: string): number | null {
  const m = minuten(zeit)
  if (m === null) return null
  const anteil = (m - achse.start) / (achse.schritt * SPALTEN)
  if (anteil < 0 || anteil > 1) return null
  return anteil * 100
}

/**
 * Erstbefund und Übergabe gehören auf dieselbe Kurve.
 *
 * Der Bogen erhebt dieselben Messwerte dreimal: beim Antreffen, im Verlauf
 * und bei der Übergabe. Nur den Verlauf zu zeichnen hieße, den ersten und den
 * letzten Punkt wegzulassen — und gerade die beiden sagen am meisten.
 *
 * Eingetragen werden sie nicht; sie stehen schon in ihren Feldern. Sie werden
 * gelesen und mitgezeichnet, und zwar auf ihrem eigenen Zeitpunkt.
 */
export type Herkunft = 'verlauf' | 'erstbefund' | 'uebergabe'

/** Welches Feld des Bogens welchen Wert der Kurve trägt. */
const AUS_FELDERN: { quelle: Herkunft; zeit: string; titel: string; felder: Record<string, string> }[] = [
  {
    quelle: 'erstbefund',
    zeit: 'erstbefund_zeitpunkt',
    titel: 'Erstbefund',
    felder: {
      spo2: 'spo2', af: 'af', o2: 'o2_gabe', cohb: 'co_hb', hf: 'hf', puls: 'puls',
      rr_sys: 'nibp_sys', rr_dia: 'nibp_dia', etco2: 'etco2',
    },
  },
  {
    quelle: 'uebergabe',
    zeit: 'ub_zeitpunkt',
    titel: 'Übergabe',
    felder: {
      spo2: 'ub_spo2', af: 'ub_af', hf: 'ub_hf', puls: 'ub_puls',
      rr_sys: 'ub_nibp_sys', rr_dia: 'ub_nibp_dia', etco2: 'ub_etco2',
    },
  },
]


export type Verlaufsspalte = {
  id: string
  /** HH:MM */
  zeit: string
  /** Messwerte als Text, wie sie eingegeben wurden. */
  werte: Record<string, string>
  /** Woher die Spalte kommt. Ohne Angabe: im Verlauf eingetragen. */
  quelle?: Herkunft
  /** Die Überschrift, unter der sie im Bogen steht. */
  titel?: string
}

/** Eine Zahl, wie sie eingegeben wurde — mit Komma oder Punkt. */
function alsZahl(text: unknown): number | null {
  const t = String(text ?? '').replace(',', '.').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Die Spalten aus Erstbefund und Übergabe — gelesen, nicht eingetragen.
 *
 * Ohne Zeitpunkt gibt es keine Spalte: ein Punkt ohne Uhrzeit hätte auf dem
 * Kurvenblatt keine Stelle, und ihn an den Rand zu setzen wäre erfunden.
 */
export function spaltenAusFeldern(werte: Record<string, unknown>): Verlaufsspalte[] {
  const aus: Verlaufsspalte[] = []
  for (const q of AUS_FELDERN) {
    const zeit = typeof werte[q.zeit] === 'string' ? (werte[q.zeit] as string).trim() : ''
    if (!zeit) continue
    const gelesen: Record<string, string> = {}
    for (const [ziel, feld] of Object.entries(q.felder)) {
      const t = String(werte[feld] ?? '').trim()
      if (t !== '' && alsZahl(t) !== null) gelesen[ziel] = t
    }
    if (Object.keys(gelesen).length === 0) continue
    aus.push({ id: q.quelle, zeit, werte: gelesen, quelle: q.quelle, titel: q.titel })
  }
  return aus
}

/** Die Spalten, die im Verlauf eingetragen wurden. */
export function eingetrageneSpalten(werte: Record<string, unknown>): Verlaufsspalte[] {
  const v = werte.verlauf
  if (!Array.isArray(v)) return []
  return v
    .filter((e): e is Verlaufsspalte =>
      Boolean(e) && typeof e === 'object'
      && typeof (e as Verlaufsspalte).id === 'string'
      && typeof (e as Verlaufsspalte).zeit === 'string',
    )
    .map((e) => ({ ...e, werte: e.werte && typeof e.werte === 'object' ? e.werte : {} }))
}

/** Alles, was auf der Kurve steht: Verlauf, Erstbefund und Übergabe. */
export function kurvenspalten(werte: Record<string, unknown>): Verlaufsspalte[] {
  return [...eingetrageneSpalten(werte), ...spaltenAusFeldern(werte)]
    .sort((a, b) => a.zeit.localeCompare(b.zeit))
}



/**
 * Erstbefund oder Übergabe, die Messwerte führen, aber keinen Zeitpunkt.
 *
 * Sie fehlen damit auf der Kurve. Das stillschweigend zu tun hieße, ein
 * Blatt zu drucken, auf dem der erste Befund schlicht nicht vorkommt.
 */
export function fehlendeZeitpunkte(werte: Record<string, unknown>): string[] {
  const aus: string[] = []
  for (const q of AUS_FELDERN) {
    const zeit = typeof werte[q.zeit] === 'string' ? (werte[q.zeit] as string).trim() : ''
    if (zeit) continue
    const hatWerte = Object.values(q.felder).some((feld) => alsZahl(werte[feld]) !== null)
    if (hatWerte) aus.push(q.titel)
  }
  return aus
}
