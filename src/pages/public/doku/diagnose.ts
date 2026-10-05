// Tracerdiagnose und führende Diagnose hängen zusammen.
//
// Der Bogen führt zwei Schreiblinien übereinander. Gewählt wird aber einmal:
// aus den Organgruppen der Norm (E01) die Gruppe, daraus die Diagnose. Beides
// soll dastehen — die Gruppe als führende Diagnose, die Diagnose als
// Tracerdiagnose. Zusammen sind sie genau ein Eintrag der Norm: die Gruppe ist
// dort die Auswahl, die Diagnose ihre Option.
//
// Geschrieben wird deshalb beides auf einmal. Was von Hand dasteht, bleibt
// aber stehen: nachgezogen wird nur, was leer ist oder selbst ein
// Gruppenname — alles andere hat jemand getippt und gemeint.

import { TRACER_GRUPPEN, tracerGruppeVon } from '../../../katalog/tracerdiagnosen'
import type { Werte } from './DokuFeld'

const TRACER = 'tracerdiagnose'
const GRUPPE = 'fuehrende_diagnose'

function text(werte: Werte, id: string): string {
  return typeof werte[id] === 'string' ? (werte[id] as string).trim() : ''
}

/** Ob ein Text der Name einer Organgruppe ist. */
export function istGruppenname(wert: string): boolean {
  const gesucht = wert.trim()
  return TRACER_GRUPPEN.some((g) => g.titel === gesucht)
}

/**
 * Die Diagnose setzen — und die Gruppe mit, wenn die Zeile frei ist.
 *
 * Eine von Hand geschriebene führende Diagnose wird nicht überschrieben.
 */
export function diagnoseSetzen(werte: Werte, diagnose: string): Werte {
  const neu = diagnose.trim()
  const alteGruppe = tracerGruppeVon(text(werte, TRACER))?.titel ?? ''
  const steht = text(werte, GRUPPE)
  const aus: Werte = { ...werte, [TRACER]: neu }

  if (!neu) {
    // Geräumt: die Gruppe geht mit, wenn sie die des geräumten Eintrags war.
    if (steht && steht === alteGruppe) aus[GRUPPE] = ''
    return aus
  }

  const gruppe = tracerGruppeVon(neu)?.titel ?? ''
  if (!gruppe) return aus
  if (!steht || steht === alteGruppe || istGruppenname(steht)) aus[GRUPPE] = gruppe
  return aus
}

/**
 * Die Gruppe eintragen, sobald sie gewählt ist — noch vor der Diagnose.
 *
 * Wer die Organgruppe antippt, hat sie damit gesagt; sie in der führenden
 * Diagnose noch einmal auszuwählen wäre dieselbe Angabe zweimal. Eigenes
 * bleibt auch hier stehen.
 */
export function gruppeVormerken(werte: Werte, gruppe: string): Werte {
  const steht = text(werte, GRUPPE)
  if (steht && !istGruppenname(steht)) return werte
  return { ...werte, [GRUPPE]: gruppe.trim() }
}

/** Die Gruppe allein setzen — etwa zu einer Diagnose, die nicht in der Liste steht. */
export function gruppeSetzen(werte: Werte, gruppe: string): Werte {
  return { ...werte, [GRUPPE]: gruppe.trim() }
}
