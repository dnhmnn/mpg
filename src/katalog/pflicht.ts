// Welche Angaben ein Protokoll wirklich braucht.
//
// Der Bogen markiert vierzehn Felder als Pflicht. Das ist die Markierung des
// Papiers, nicht die des Einsatzes — und im Fahrzeug führt sie in die Irre:
//
//   • Name und Geburtsdatum stehen als Pflicht da. Ein bewusstloser Patient
//     ohne Papiere ist aber Alltag. Eine Pflicht, die sich nicht erfüllen
//     lässt, erzeugt "unbekannt" und "01.01.1900" — das ist schlechter als
//     ein leeres Feld, weil es wie eine Angabe aussieht.
//   • Die Übergabezeit gibt es beim Fehleinsatz nicht, und bei einem Tod vor
//     Ort auch nicht.
//   • "Schmerzen" ist bei Bewusstlosen nicht erhebbar — der Bogen führt dafür
//     eigens "NRS nicht beurteilbar", und genau das muss die Pflicht erfüllen.
//
// Deshalb hängen die Angaben hier an Bedingungen, haben Ausweichangaben und
// zwei Stufen:
//
//   PFLICHT  — ohne sie wird nicht abgesendet.
//   ERWARTET — fehlt sie, fragt das Absenden einmal nach. Sie zu erzwingen
//              hieße, Erfundenes zu bekommen.

export type Stufe = 'pflicht' | 'erwartet'

/**
 * Schlüssel des Protokolls, die kein Feld des Bogens sind.
 *
 * Die gezeichnete Unterschrift liegt als Bild unter `signature` und erfüllt
 * die Unterschriftszeile des Bogens. Die Liste steht hier, damit der Prüffall
 * sie kennt und nicht jeder Tippfehler als Ausnahme durchgeht.
 */
export const ZUSATZSCHLUESSEL = ['signature']

export type Regel = {
  feld: string
  stufe: Stufe
  /** Wann die Angabe verlangt wird. Ohne Bedingung: immer. */
  wenn?: (p: Record<string, unknown>) => boolean
  /** Andere Angaben, die sie ebenso gut erfüllen. */
  erfuelltDurch?: string[]
  /** Warum sie verlangt wird — die Maske zeigt es, statt nur rot zu werden. */
  grund: string
}

function gefuellt(w: unknown): boolean {
  if (w === undefined || w === null || w === '' || w === false) return false
  if (Array.isArray(w)) return w.length > 0
  if (typeof w === 'object') return Object.keys(w as object).length > 0
  return true
}

/** Einsatzarten, bei denen es keinen Patienten gibt. */
const OHNE_PATIENT = ['Fehleinsatz', 'vorsorgliche Bereitstellung']

/** Ob überhaupt ein Patient versorgt wurde. */
export function patientVersorgt(p: Record<string, unknown>): boolean {
  const art = String(p.einsatz_art ?? '').trim()
  if (art === '') return true // solange nichts anderes dasteht: ja
  return !OHNE_PATIENT.includes(art)
}

/** Ob transportiert wurde — am Transportziel oder an der Übergabe zu erkennen. */
export function transportiert(p: Record<string, unknown>): boolean {
  return gefuellt(p.transport_ziel) || gefuellt(p.zeit_uebergabe) || gefuellt(p.uebergabe_an)
}

/**
 * Ob eine Übergabe zu dokumentieren ist.
 *
 * Daran hingen die Angaben der Übergabe zuerst am Transportziel — und das
 * steht erst da, wenn es jemand eingetragen hat. Bis dahin war der ganze
 * Übergabe-Zettel unmarkiert: man sah erst, was verlangt wird, nachdem man
 * es schon getan hatte.
 *
 * Ein versorgter Patient wird übergeben; das ist der Regelfall. Der Bogen
 * führt keine Angabe "kein Transport" — gäbe es eine, stünde sie hier.
 */
export function uebergeben(p: Record<string, unknown>): boolean {
  return patientVersorgt(p)
}

/**
 * Ob reanimiert wurde.
 *
 * Die Reanimationssituation für jeden verstauchten Knöchel zu verlangen wäre
 * eine Pflicht ohne Gegenstand. Gefragt wird sie, sobald irgendetwas aus dem
 * Reanimationsblock dasteht.
 */
export function reanimiert(p: Record<string, unknown>): boolean {
  return ['rea_massnahme', 'hdm_durch', 'defi1_zeit', 'rosc_zeit', 'todeszeitpunkt', 'kollaps_durch']
    .some((f) => gefuellt(p[f]))
}

export const REGELN: Regel[] = [
  // ── Immer ───────────────────────────────────────────────────────────────
  {
    feld: 'einsatz_nr', stufe: 'pflicht',
    grund: 'Ohne Einsatznummer ist das Protokoll keinem Einsatz zuzuordnen',
  },
  {
    feld: 'einsatz_datum', stufe: 'pflicht',
    grund: 'Datum des Einsatzes',
  },
  {
    feld: 'zeit_alarm', stufe: 'pflicht',
    grund: 'Die Alarmzeit trägt die ganze Kette der Zeiten',
  },
  {
    feld: 'einsatz_art', stufe: 'pflicht',
    grund: 'Sie entscheidet, was das Protokoll sonst noch braucht',
  },
  {
    feld: 'mannschaft_tf', stufe: 'pflicht',
    grund: 'Wer den Einsatz geführt hat, gehört in jedes Protokoll',
  },
  {
    feld: 'notfallgeschehen', stufe: 'pflicht',
    grund: 'Was geschehen ist, steht in keinem Kreuz',
  },

  // ── Sobald ein Patient versorgt wurde ───────────────────────────────────
  {
    feld: 'zeit_ankunft_ort', stufe: 'pflicht', wenn: patientVersorgt,
    grund: 'Wann die Hilfe da war',
  },
  {
    feld: 'gcs_summe', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['bewusstsein'],
    grund: 'Der Bewusstseinszustand — als GCS oder als Bewusstseinslage',
  },
  {
    feld: 'schmerz', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['schmerz_nicht_beurteilbar'],
    grund: 'Schmerz erheben oder festhalten, dass er nicht beurteilbar war',
  },
  {
    feld: 'hf', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['puls', 'radialispuls'],
    grund: 'Ein Kreislaufwert — Herzfrequenz, Puls oder der tastbare Radialispuls',
  },
  {
    feld: 'spo2', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['af', 'atmung'],
    grund: 'Ein Wert zur Atmung — Sättigung, Atemfrequenz oder der Befund',
  },
  {
    feld: 'nibp_sys', stufe: 'erwartet', wenn: patientVersorgt,
    grund: 'Der Blutdruck ist nicht immer messbar, gehört aber dazu, wo er es ist',
  },

  // ── Erstbefund: was erhoben wurde, gehört hin ───────────────────────────
  // Jede dieser Angaben ist mit einem Griff zu erfüllen — die meisten führen
  // eine Antwort wie "unauffällig" oder "nicht untersucht". Leer zu bleiben
  // heißt dagegen: niemand weiß, ob danach gesehen wurde.
  { feld: 'kreislauf', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Kreislauf — auch die kritische Blutung steht hier' },
  { feld: 'atemwege', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Atemwege' },
  { feld: 'atmung', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Atmung' },
  { feld: 'puls_regelmaessig', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Rhythmisch oder arrhythmisch' },
  { feld: 'radialispuls', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Radialispuls tastbar' },
  { feld: 'rekap_zeit', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Rekapillarisierungszeit' },
  { feld: 'schockzeichen', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Schockzeichen' },
  {
    feld: 'neuro_ohne_befund', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['neuro_auffaelligkeiten'],
    grund: 'Neurologie — ohne path. Befund oder die Auffälligkeit',
  },
  { feld: 'bewusstsein', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Bewusstseinslage' },
  {
    feld: 'pupillen_weite_re', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['pupillen_weite_li'], grund: 'Pupillenweite',
  },
  {
    feld: 'pupillen_licht_re', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['pupillen_licht_li'], grund: 'Lichtreaktion',
  },
  { feld: 'haut', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Haut' },

  // ── Messwerte ───────────────────────────────────────────────────────────
  { feld: 'af', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Atemfrequenz' },
  { feld: 'puls', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Puls' },
  { feld: 'nibp_dia', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Blutdruck diastolisch' },
  { feld: 'bz', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Blutzucker' },
  { feld: 'temp', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Temperatur' },

  // ── Diagnose ────────────────────────────────────────────────────────────
  { feld: 'tracerdiagnose', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Tracerdiagnose' },
  { feld: 'diagnosetext', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Diagnosetext' },

  // ── Maßnahmen ───────────────────────────────────────────────────────────
  // Alle drei führen eine Antwort für "nichts davon" — leer heißt deshalb
  // nicht "nichts gemacht", sondern "nicht dokumentiert".
  { feld: 'medizintechnik', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Medizintechnik — oder "keine Medizintechnik"' },
  { feld: 'erweitertes_monitoring', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Erweitertes Monitoring — oder "kein erw. Monitoring"' },
  { feld: 'lagerung', stufe: 'pflicht', wenn: patientVersorgt, grund: 'Lagerungs- und Rettungstechnik' },
  {
    feld: 'medikation', stufe: 'pflicht', wenn: patientVersorgt,
    erfuelltDurch: ['keine_medikation'],
    grund: 'Medikation — oder "keine Medikation"',
  },
  {
    feld: 'rea_situation', stufe: 'pflicht', wenn: reanimiert,
    grund: 'Die Reanimationssituation',
  },

  // ── Wenn transportiert wurde ────────────────────────────────────────────
  {
    feld: 'zeit_uebergabe', stufe: 'pflicht', wenn: uebergeben,
    grund: 'Nach einem Transport gehört die Übergabezeit ins Protokoll',
  },
  {
    feld: 'transport_ziel', stufe: 'pflicht', wenn: uebergeben,
    grund: 'Wohin transportiert wurde',
  },
  {
    feld: 'uebergabe_an', stufe: 'pflicht', wenn: uebergeben,
    grund: 'An wen übergeben wurde',
  },
  {
    feld: 'uebergabeort', stufe: 'pflicht', wenn: uebergeben,
    grund: 'Wo übergeben wurde',
  },
  {
    // Auch ein Fehleinsatz wird unterschrieben.
    feld: 'unterschrift', stufe: 'pflicht',
    erfuelltDurch: ['signature'],
    grund: 'Die Unterschrift schließt das Protokoll ab',
  },

  // ── Übergabe-Befund: derselbe Befund wie beim Antreffen ─────────────────
  // Er wird erhoben, weil sich etwas geändert haben kann — und gerade die
  // Veränderung ist die Aussage.
  ...([
    ['ub_atemwege', 'Atemwege bei Übergabe'],
    ['ub_atmung', 'Atmung bei Übergabe'],
    ['ub_kreislauf', 'Kreislauf bei Übergabe'],
    ['ub_puls_regelmaessig', 'Rhythmisch oder arrhythmisch bei Übergabe'],
    ['ub_radialispuls', 'Radialispuls bei Übergabe'],
    ['ub_rekap', 'Rekapillarisierungszeit bei Übergabe'],
    ['ub_schockzeichen', 'Schockzeichen bei Übergabe'],
    ['ub_bewusstsein', 'Bewusstseinslage bei Übergabe'],
    ['ub_af', 'Atemfrequenz bei Übergabe'],
    ['ub_spo2', 'Sättigung bei Übergabe'],
    ['ub_hf', 'Herzfrequenz bei Übergabe'],
    ['ub_puls', 'Puls bei Übergabe'],
    ['ub_nibp_sys', 'Blutdruck systolisch bei Übergabe'],
    ['ub_nibp_dia', 'Blutdruck diastolisch bei Übergabe'],
    ['ub_bz', 'Blutzucker bei Übergabe'],
    ['ub_temp', 'Temperatur bei Übergabe'],
  ] as const).map(([feld, grund]): Regel => ({ feld, stufe: 'pflicht', wenn: uebergeben, grund })),
  {
    feld: 'ub_neuro_ohne_befund', stufe: 'pflicht', wenn: uebergeben,
    erfuelltDurch: ['ub_bewusstsein'],
    grund: 'Neurologie bei Übergabe',
  },
  {
    feld: 'ub_pupillen_weite_re', stufe: 'pflicht', wenn: uebergeben,
    erfuelltDurch: ['ub_pupillen_weite_li'], grund: 'Pupillenweite bei Übergabe',
  },
  {
    feld: 'ub_pupillen_licht_re', stufe: 'pflicht', wenn: uebergeben,
    erfuelltDurch: ['ub_pupillen_licht_li'], grund: 'Lichtreaktion bei Übergabe',
  },
  {
    feld: 'ub_gcs_summe', stufe: 'pflicht', wenn: uebergeben,
    erfuelltDurch: ['ub_bewusstsein'],
    grund: 'Bewusstseinszustand bei Übergabe — als GCS oder Bewusstseinslage',
  },
  {
    feld: 'ub_schmerz', stufe: 'pflicht', wenn: uebergeben,
    erfuelltDurch: ['ub_schmerz_nicht_beurteilbar'],
    grund: 'Schmerz bei Übergabe — oder dass er nicht beurteilbar war',
  },

  // ── Erwartet, nie erzwungen ─────────────────────────────────────────────
  {
    feld: 'name', stufe: 'erwartet',
    grund: 'Unbekannte Patienten sind Alltag — erfunden wird der Name nicht',
  },
  {
    feld: 'gebdatum', stufe: 'erwartet',
    grund: 'Wo das Alter bekannt ist, gehört es ins Protokoll',
  },
  {
    feld: 'naca_uebergabe', stufe: 'erwartet', wenn: patientVersorgt,
    grund: 'Der NACA-Score bei Übergabe',
  },
]

export type Stand = { feld: string; stufe: Stufe; grund: string; erfuellt: boolean }

/** Was dieses Protokoll gerade verlangt — und was davon schon dasteht. */
export function pflichtStand(p: Record<string, unknown>): Stand[] {
  return REGELN
    .filter((r) => !r.wenn || r.wenn(p))
    .map((r) => ({
      feld: r.feld,
      stufe: r.stufe,
      grund: r.grund,
      erfuellt: gefuellt(p[r.feld]) || (r.erfuelltDurch ?? []).some((f) => gefuellt(p[f])),
    }))
}

/** Dasselbe als Nachschlagewerk für die Maske. */
export function pflichtKarte(p: Record<string, unknown>): Map<string, Stand> {
  return new Map(pflichtStand(p).map((s) => [s.feld, s]))
}

/** Was dem Absenden im Weg steht. */
export function offenePflicht(p: Record<string, unknown>): Stand[] {
  return pflichtStand(p).filter((s) => s.stufe === 'pflicht' && !s.erfuellt)
}

/** Was fehlt, aber nicht blockiert. */
export function offeneErwartung(p: Record<string, unknown>): Stand[] {
  return pflichtStand(p).filter((s) => s.stufe === 'erwartet' && !s.erfuellt)
}
