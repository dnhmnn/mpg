// Der Einsatz-Zeitstrahl: aus Alarmzeit, Ausrückdauer, Fahrzeit und
// Versorgungsdauer die Kette der Statuszeiten.
//
// Das alte Formular rechnete sie so, und die Rechnung ist dieselbe geblieben.
// Neu ist, was danach passiert: die berechneten Zeiten stehen als VORSCHLAG
// da und wandern erst auf Knopfdruck in die Zeiten des Protokolls.
//
// Das ist kein Schnörkel. Der Bogen dokumentiert gemessene Zeiten; eine
// gerechnete als gemessene einzutragen wäre eine Behauptung. Übernommen
// werden sie trotzdem gern — man ändert danach, was anders war.

import { minuten, uhrzeit } from '../../../katalog/verlaufswerte'
import type { Werte } from './DokuFeld'

export type Zeitstrahl = {
  /** Alarmzeit als HH:MM — der Anker der ganzen Kette. */
  alarm: string
  /** Alarm → Status 3, in Minuten. */
  ausruecken: number
  /** Status 3 → Status 4, in Minuten. Aus der Route oder von Hand. */
  fahrt: number | null
  /** Status 4 → Übergabe, in Minuten. */
  versorgung: number
}

/** Ein Halt der Kette. */
export type Halt = {
  id: string
  /** Die Zahl im Kreis: Status 3, 4, 1, 2 — oder ein Zeichen. */
  marke: string
  titel: string
  unter: string
  /** HH:MM, leer solange die Fahrzeit fehlt. */
  zeit: string
  /** Das Feld des Bogens, in das dieser Halt gehört. */
  feld: string
  /** Was bis zum nächsten Halt vergeht. */
  bisNaechster?: string
}

/**
 * Die Kette, wie der Funk sie zählt.
 *
 * Status 3 heißt ausgerückt, 4 am Einsatzort, 1 wieder frei, 2 am Standort.
 * Die Zuordnung zu den Zeiten des Bogens steht hier, damit sie an einer
 * Stelle steht und nicht in der Maske verstreut.
 */
export function kette(z: Zeitstrahl): Halt[] {
  const start = minuten(z.alarm)
  const nach = (m: number | null): string =>
    start === null || m === null ? '' : uhrzeit(start + m)

  const bisStatus3 = z.ausruecken
  const bisStatus4 = z.fahrt === null ? null : bisStatus3 + z.fahrt
  const bisUebergabe = bisStatus4 === null ? null : bisStatus4 + z.versorgung
  const bisStatus1 = bisUebergabe
  const bisStatus2 = bisStatus1 === null || z.fahrt === null ? null : bisStatus1 + z.fahrt

  const fahrt = z.fahrt === null ? null : `${z.fahrt} min`
  return [
    {
      id: 'alarm', marke: '!', titel: 'Alarm', unter: 'Meldungseingang',
      zeit: z.alarm.trim(), feld: 'zeit_alarm', bisNaechster: `${z.ausruecken} min`,
    },
    {
      id: 'status3', marke: '3', titel: 'Status 3', unter: 'Ausgerückt',
      zeit: nach(bisStatus3), feld: 'zeit_uebernahme', bisNaechster: fahrt ?? undefined,
    },
    {
      id: 'status4', marke: '4', titel: 'Status 4', unter: 'Am Einsatzort',
      zeit: nach(bisStatus4), feld: 'zeit_ankunft_ort', bisNaechster: `${z.versorgung} min`,
    },
    // Zwei Zeiten, die der Bogen führt und die Kette nicht rechnen kann: wann
    // der Patient erreicht war und wann es vom Einsatzort fortging. Sie
    // stehen hier, damit alle Zeiten an einer Stelle stehen — gerechnet wird
    // nichts für sie, eingetragen schon.
    {
      id: 'ankunft_patient', marke: '·', titel: 'Ankunft Patient', unter: 'Patient erreicht',
      zeit: '', feld: 'zeit_ankunft_patient',
    },
    {
      id: 'abfahrt', marke: '·', titel: 'Abfahrt', unter: 'Vom Einsatzort',
      zeit: '', feld: 'zeit_abfahrt',
    },
    {
      id: 'uebergabe', marke: '✓', titel: 'Übergabe', unter: 'Patient übergeben',
      zeit: nach(bisUebergabe), feld: 'zeit_uebergabe',
    },
    {
      id: 'status1', marke: '1', titel: 'Status 1', unter: 'Wieder frei',
      zeit: nach(bisStatus1), feld: 'zeit_einsatzbereit', bisNaechster: fahrt ?? undefined,
    },
    {
      id: 'status2', marke: '2', titel: 'Status 2', unter: 'Am Standort',
      zeit: nach(bisStatus2), feld: 'zeit_ende',
    },
  ]
}

/** Die Felder des Bogens, die der Zeitstrahl führt — sie stehen nicht noch einmal. */
export function zeitstrahlFelder(): string[] {
  return kette({ alarm: '', ausruecken: 0, fahrt: null, versorgung: 0 }).map((h) => h.feld)
}

/** Die Halte, die eine Zeit haben und sie in ein Feld des Bogens tragen können. */
export function uebertragbar(z: Zeitstrahl): Halt[] {
  return kette(z).filter((h) => h.zeit !== '' && h.id !== 'alarm')
}

/**
 * Die berechneten Zeiten in das Protokoll übernehmen.
 *
 * Was dort schon steht, bleibt: eine eingetragene Zeit ist gemessen, eine
 * gerechnete nur geschätzt — die gemessene gilt.
 */
export function zeitenUebernehmen(werte: Werte, z: Zeitstrahl): Werte {
  const aus = { ...werte }
  for (const h of uebertragbar(z)) {
    const steht = typeof aus[h.feld] === 'string' ? (aus[h.feld] as string).trim() : ''
    if (!steht) aus[h.feld] = h.zeit
  }
  return aus
}

/** Wie viele Zeiten eine Übernahme setzen würde. */
export function offeneUebernahme(werte: Werte, z: Zeitstrahl): number {
  return uebertragbar(z).filter((h) => {
    const steht = typeof werte[h.feld] === 'string' ? (werte[h.feld] as string).trim() : ''
    return !steht
  }).length
}
