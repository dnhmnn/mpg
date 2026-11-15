// Die Apps im Hub auf Seiten zum Wischen (src/pages/hub/AppSeiten.tsx).
//
// Der Hub rollt nicht (CLAUDE.md, „Statische Seiten“). Die Kacheln füllen den Platz, der unter
// dem Kopf bleibt; passen nicht alle hinein, kommen sie auf mehrere Seiten, mit Pfeilen und
// Punkten darunter. Hier steht nur die Rechnung: wie viele Reihen in die gemessene Höhe passen,
// wie die Apps auf Seiten verteilt werden und welche Seite gerade zu sehen ist.
//
// Die Maße entsprechen HUB_CSS (src/pages/hub/stil.ts): Die Kacheln bekommen ihre Höhe von hier
// (grid-auto-rows), damit Rechnung und Darstellung nicht auseinanderlaufen.
//
// Notausgang: Passt nicht einmal eine ganze Reihe (mit Pfeilen und Punkten, wenn es mehrere Seiten
// braucht), etwa bei Seitenzoom, Zoom 400 % oder einem Telefon quer, gilt der Plan als „passt
// nicht“. Dann stehen alle Apps auf einer Seite untereinander, und das Blatt rollt innen (Seite
// rolltInnen); das Dokument selbst bleibt fest. So bleibt jede App erreichbar.

/** Abstand zwischen zwei Reihen in px (row-gap der Seite). */
export const REIHEN_ABSTAND = 16
/** Innenabstand einer Seite oben und unten zusammen, Platz für den Fokusrahmen (je 4 px). */
export const SEITEN_RAND = 8
/** Höhe der Steuerung unter den Seiten: Pfeile (44 px) und 8 px Abstand darüber. */
export const STEUER_HOEHE = 52

/**
 * Spalten nach der Breite des Fensters: 4 am Telefon, 5 ab 600 px, 6 ab 720 px. Schmaler als
 * 300 px gibt es nur mit Zoom (Telefone haben mindestens 320 px): dann 3, unter 232 px 2, damit
 * die Symbole (60 px) nicht übereinanderliegen.
 */
export function spaltenFuerBreite(breite: number): number {
  return breite >= 720 ? 6 : breite >= 600 ? 5 : breite >= 300 ? 4 : breite >= 232 ? 3 : 2
}

/**
 * Höhe einer Kachel in px: Innenabstand oben 4, Symbol 60 (ab 600 px 64), Abstand 7, Name 18,
 * Innenabstand unten 2. Mit der Zeile „bis 16.11.“ (befristete App) 16 mehr (Abstand 7, Zeile 14,
 * 5 nach oben gezogen).
 */
export function kachelHoehe(breite: number, mitBis: boolean): number {
  const symbol = breite >= 600 ? 64 : 60
  return 4 + symbol + 7 + 18 + 2 + (mitBis ? 16 : 0)
}

/** Wie viele ganze Reihen in eine Höhe passen; 0, wenn nicht einmal eine (oder nichts gemessen ist). */
export function ganzeReihen(hoehe: number, kachel: number, abstand: number = REIHEN_ABSTAND): number {
  if (!(hoehe > 0) || !(kachel > 0)) return 0
  const a = Number.isFinite(abstand) ? Math.max(0, abstand) : 0
  return Math.max(0, Math.floor((hoehe + a) / (kachel + a)))
}

/** Wie viele Reihen in eine Höhe passen; immer mindestens eine. */
export function reihenFuerHoehe(hoehe: number, kachel: number, abstand: number = REIHEN_ABSTAND): number {
  return Math.max(1, ganzeReihen(hoehe, kachel, abstand))
}

export interface SeitenPlan {
  spalten: number
  /** Reihen je Seite */
  reihen: number
  /** Apps je Seite */
  proSeite: number
  seiten: number
  /** Pfeile und Punkte zeigen (nur bei mehr als einer Seite) */
  steuerung: boolean
  /**
   * Passt mindestens eine ganze Reihe hinein (mit Steuerung, wenn es mehrere Seiten braucht)?
   * Sonst Notausgang: alle Apps auf einer Seite, ohne Steuerung, das Blatt rollt innen.
   */
  passt: boolean
}

/**
 * Der Plan für die gemessene freie Höhe. Passt alles auf eine Seite, gibt es keine Steuerung
 * und die ganze Höhe gilt. Sonst geht die Steuerung von der Höhe ab, und es wird neu gerechnet.
 * Bleibt dann keine ganze Reihe übrig, gilt der Notausgang (passt: false).
 */
export function seitenPlan(p: {
  anzahl: number; hoehe: number; spalten: number; kachel: number
  abstand?: number; rand?: number; steuer?: number
}): SeitenPlan {
  const abstand = p.abstand ?? REIHEN_ABSTAND
  const rand = p.rand ?? SEITEN_RAND
  const steuer = p.steuer ?? STEUER_HOEHE
  const spalten = Math.max(1, Math.floor(p.spalten) || 1)
  const anzahl = Math.max(0, Math.floor(p.anzahl) || 0)
  const ohne = ganzeReihen(p.hoehe - rand, p.kachel, abstand)
  if (ohne >= 1 && anzahl <= ohne * spalten) return { spalten, reihen: ohne, proSeite: ohne * spalten, seiten: 1, steuerung: false, passt: true }
  const mit = ganzeReihen(p.hoehe - rand - steuer, p.kachel, abstand)
  if (mit >= 1) {
    const proSeite = mit * spalten
    return { spalten, reihen: mit, proSeite, seiten: Math.ceil(anzahl / proSeite), steuerung: true, passt: true }
  }
  // Notausgang: alle Apps untereinander auf einer Seite
  const reihen = Math.max(1, Math.ceil(anzahl / spalten))
  return { spalten, reihen, proSeite: reihen * spalten, seiten: 1, steuerung: false, passt: false }
}

/** Die Apps der Reihe nach auf Seiten verteilen. Ohne Apps eine leere Seite. */
export function aufSeiten<T>(liste: readonly T[], proSeite: number): T[][] {
  const n = Math.max(1, Math.floor(proSeite) || 1)
  const seiten: T[][] = []
  for (let i = 0; i < liste.length; i += n) seiten.push(liste.slice(i, i + n))
  return seiten.length ? seiten : [[]]
}

/** Eine Seitenzahl in die Grenzen 0 bis seiten - 1 bringen. */
export function seiteBegrenzen(seite: number, seiten: number): number {
  if (!Number.isFinite(seite) || !(seiten >= 1)) return 0
  return Math.min(Math.max(0, Math.floor(seite)), Math.floor(seiten) - 1)
}

/** Welche Seite zu sehen ist, aus der Lage des Wischbereichs (gerundet, also ab halber Strecke die nächste). */
export function seiteAusScroll(scrollLeft: number, breite: number, seiten: number): number {
  if (!(breite > 0) || !Number.isFinite(scrollLeft)) return 0
  return seiteBegrenzen(Math.round(Math.abs(scrollLeft) / breite), seiten)
}

/**
 * Nach einem Umbau (Drehen, andere Fenstergröße, Apps angepasst) die Seite, auf der die erste
 * App der bisherigen Seite jetzt steht; begrenzt auf die neue Seitenzahl.
 */
export function seiteNachUmbau(seite: number, alterProSeite: number, neuerProSeite: number, seiten: number): number {
  const alt = Math.max(1, Math.floor(alterProSeite) || 1)
  const neu = Math.max(1, Math.floor(neuerProSeite) || 1)
  const erste = Math.max(0, Math.floor(seite) || 0) * alt
  return seiteBegrenzen(Math.floor(erste / neu), seiten)
}
