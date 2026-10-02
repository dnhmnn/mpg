// Das Raster des ÄLRD-Bogens, in Punkt auf dem A4-Blatt.
//
// Diese Zahlen sind nicht geschaetzt, sondern aus der Vorlage vermessen:
// die Blockrahmen des gedruckten Bogens, auf ein Zehntel Punkt genau.
// Wer hier etwas verschiebt, verschiebt es auch auf dem Papier.

import type { Kasten } from './aelrdDruck'

/** Seite 1 — Einsatzdaten, Notfallgeschehen, Erstbefund, Diagnosen. */
export const SEITE1: Record<string, Kasten> = {
  // Band 1: links die Stammdaten mit Protokollkopf, rechts die Einsatzdaten.
  stammdaten: { x: 24.4, y: 17.8, b: 200.1, h: 126.8 },
  person: { x: 24.4, y: 144.6, b: 198.9, h: 19.2 },
  titel: { x: 24.4, y: 163.8, b: 198.9, h: 23.6 },
  kennung: { x: 24.5, y: 187.4, b: 199.9, h: 35.6 },
  einsatzdaten: { x: 224.5, y: 17.8, b: 328.3, h: 205.2 },

  // Band 2: Notfallgeschehen ueber die ganze Blattbreite.
  notfallgeschehen: { x: 24.1, y: 223.3, b: 529.1, h: 237.7 },

  // Band 3: links Erstbefund und Erkrankungen, rechts Neurologie,
  // Untersuchung/Psyche/Verletzungen und der NACA-Score.
  erstbefund: { x: 25.0, y: 461.3, b: 263.5, h: 209.5 },
  erkrankungen: { x: 25.0, y: 670.2, b: 263.8, h: 114.0 },
  // Der Neurologie-Rahmen traegt auch Untersuchung und Psyche — gemessen:
  // NEUROLOGIE bei y 461, Schmerzen 548, UNTERSUCHUNG 564, PSYCHE 596.
  neurologie: { x: 288.6, y: 461.5, b: 264.2, h: 159.4 },
  verletzungen: { x: 288.7, y: 620.6, b: 264.3, h: 142.4 },
  naca: { x: 288.8, y: 763.2, b: 264.3, h: 20.9 },

  // Fusszeile.
  news: { x: 24.4, y: 784.2, b: 528.7, h: 14.0 },
}

/** Seite 2 — Verlauf, Medikation, Massnahmen, Uebergabe. */
export const SEITE2: Record<string, Kasten> = {
  // Band 1: links das Kurvenblatt, Medikation und Reanimation,
  // rechts die Massnahmen ueber die ganze Hoehe.
  verlauf: { x: 30.6, y: 31.0, b: 319.0, h: 277.2 },
  medikation: { x: 30.6, y: 308.2, b: 319.0, h: 145.6 },
  reanimation: { x: 30.6, y: 453.6, b: 319.1, h: 72.5 },
  massnahmen: { x: 349.6, y: 31.0, b: 205.8, h: 495.2 },

  // Band 2: links der Uebergabe-Befund, rechts Neurologie und Messwerte.
  uebergabe: { x: 30.6, y: 526.2, b: 276.0, h: 182.2 },
  neurologieUebergabe: { x: 306.6, y: 526.2, b: 249.0, h: 124.1 },

  // Band 3: Besonderheiten, Wertsachen, Uebergabeziel, Bemerkungen.
  besonderheiten: { x: 306.6, y: 650.3, b: 155.4, h: 58.1 },
  wertsachen: { x: 462.0, y: 650.3, b: 93.6, h: 135.2 },
  uebergabeAn: { x: 31.0, y: 708.4, b: 132.0, h: 77.2 },
  bemerkungen: { x: 163.0, y: 708.4, b: 299.0, h: 77.2 },
}

/**
 * Die Hoehen der Unterbloecke, aus den Trennlinien der Vorlage gemessen.
 * Sie summieren sich genau auf die Hoehe ihres Rahmens — damit sitzt jeder
 * Befundblock auf derselben Zeile wie auf dem Papier und kann nicht wandern,
 * wenn ein Feld einmal mehr Text traegt.
 */
export const HOEHEN = {
  // Erstbefund, Rahmen 461,3–670,8 (209,5 pt)
  ebKopf: 21.6,
  ebAtemwege: 18.7,
  ebAtmung: 26.0,
  ebKreislauf: 40.8,
  ebHaut: 21.9,
  ebEkg: 27.1,
  ebMesswerte: 53.4,

  // Neurologie, Rahmen 461,5–620,9 (159,4 pt)
  nrKopf: 21.4,
  nrPupillen: 26.0,
  nrAuffaelligkeiten: 37.1,
  nrSchmerzen: 17.6,
  nrUntersuchung: 31.2,
  nrPsyche: 26.1,

  // Verletzungen, Rahmen 620,6–763,0 (142,4 pt)
  vrKopf: 22.6,
  vrHaupt: 88.2,
  vrHergang: 31.3,
}

/** Unterblockhöhen der zweiten Seite, aus den Überschriftenpositionen gemessen. */
export const HOEHEN2 = {
  // Massnahmen, Rahmen 31,0–526,2 (495,2 pt)
  maKopf: 33.8,
  maZugaenge: 63.2,
  maAtemweg: 55.2,
  maBeatmung: 55.3,
  maDefi: 87.0,
  maRest: 200.7,

  // Uebergabe-Befund, Rahmen 526,2–708,4 (182,2 pt)
  ubKopf: 19.9,
  ubAtemwege: 17.9,
  ubAtmung: 25.9,
  ubKreislauf: 24.5,
  ubEkg: 24.6,
  ubPsyche: 27.5,
  ubUntersuchung: 41.9,

  // Neurologie Uebergabe, Rahmen 526,2–650,3 (124,1 pt)
  nuKopf: 50.2,
  nuSchmerzen: 18.9,
  nuMesswerte: 55.0,

  // Medikation, Rahmen 308,2–453,8 (145,6 pt)
  mdKopf: 12.0,
  mdListe: 116.2,
  mdLyse: 17.4,
}
