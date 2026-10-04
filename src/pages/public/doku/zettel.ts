// Welche Blöcke des Bogens auf einem Zettel zusammenstehen.
//
// Der Katalog in aelrd.ts bildet das Papier ab und bleibt, wie er ist — er
// treibt den Ausdruck. Wie die Maske diese Blöcke bündelt, ist eine Frage der
// Bedienung und steht deshalb hier: so lässt sich die Gliederung ändern, ohne
// den Bogen anzufassen.
//
// Die Reihenfolge ist die des Papiers. Wo mehrere Blöcke zusammengehen,
// steht der Zettel an der Stelle des ersten von ihnen.

import { AELRD_ABSCHNITTE, aelrdFeld, type AelrdFeld } from '../../../katalog/aelrd'
import { istSpiegelFeld } from '../../../katalog/aelrdSpiegel'

export type Zettel = {
  id: string
  /** Kurzzeichen am Rand — höchstens fünf Zeichen. */
  kurz: string
  titel: string
  /** Die Blöcke des Bogens, die hier zusammenstehen. */
  abschnitte: string[]
  /**
   * Eine eigene Gliederung statt der Abschnitte des Bogens.
   *
   * Der Erstbefund steht auf dem Papier nach Organsystemen; abgearbeitet wird
   * er aber nach xABCDE. Hier wird deshalb nach dem Schema gruppiert — dieselben
   * Felder, andere Reihenfolge.
   */
  gruppen?: ZettelGruppe[]
}

export type ZettelGruppe = {
  /** Der Buchstabe des Schemas: x, A, B, C, D, E. */
  kennung: string
  titel: string
  /** Kurzzeichen für die Leiste, wenn der Buchstabe fehlt. */
  kurz?: string
  /** Feld-Kennungen des Bogens, in der Reihenfolge der Abarbeitung. */
  felder: string[]
}

export const ZETTEL: Zettel[] = [
  { id: 'patient', kurz: 'PAT', titel: 'Patient und Einsatznummer', abschnitte: ['stammdaten', 'kennung'] },
  { id: 'einsatz', kurz: 'EINS', titel: 'Einsatz und Besatzung', abschnitte: ['einsatzdaten', 'besatzung'] },
  { id: 'zeiten', kurz: 'ZEIT', titel: 'Zeiten', abschnitte: ['zeiten'] },
  { id: 'anamnese', kurz: 'ANAM', titel: 'Notfallgeschehen und Anamnese', abschnitte: ['notfallgeschehen'] },
  {
    id: 'befund',
    kurz: 'BEF',
    titel: 'Erstbefund nach xABCDE',
    abschnitte: ['erstbefund', 'neurologie', 'untersuchung', 'verletzungen'],
    gruppen: [
      { kennung: '', kurz: 'Z', titel: 'Zeitpunkt', felder: ['erstbefund_zeitpunkt'] },
      {
        // Der Bogen führt keine eigene Angabe "kritische Blutung". Was er
        // führt, ist die Option "Blutung" im Kreislauf-Feld — und genau die
        // steht hier als erster Schritt, bevor der Atemweg kommt.
        kennung: 'x',
        titel: 'Kritische Blutung',
        felder: ['kreislauf'],
      },
      { kennung: 'A', titel: 'Atemwege', felder: ['atemwege'] },
      { kennung: 'B', titel: 'Atmung', felder: ['atmung'] },
      {
        kennung: 'C',
        titel: 'Kreislauf',
        felder: [
          'puls_regelmaessig', 'radialispuls', 'rekap_zeit', 'schockzeichen',
          'kreislauf_auffaelligkeiten', 'ekg', 'ekg_text',
        ],
      },
      {
        kennung: 'D',
        titel: 'Neurologie und Psyche',
        felder: [
          'neuro_ohne_befund', 'bewusstsein',
          'gcs_augen', 'gcs_verbal', 'gcs_motorik', 'gcs_summe',
          'pupillen_weite_re', 'pupillen_weite_li', 'pupillen_licht_re', 'pupillen_licht_li',
          'neuro_auffaelligkeiten',
          'psyche',
        ],
      },
      {
        kennung: 'E',
        titel: 'Entkleiden, Schmerz, Verletzungen',
        felder: [
          // Die Haut stand zuerst bei C — Rekap-Zeit und Blässe gehören zum
          // Kreislauf. Gesehen wird sie aber erst, wenn der Patient entkleidet
          // ist, und dann vollständig: Ödeme, Dekubitus, Exantheme.
          'haut',
          // Der Schmerz stand im Abschnitt Neurologie des Bogens und war
          // deshalb zuerst bei D. Erhoben wird er beim Entkleiden.
          'schmerz', 'schmerz_nicht_beurteilbar', 'schmerz_tolerabel',
          'untersuchung',
          'verletzung_zusammenhang', 'verletzungsmuster',
          'verl_sht', 'verl_gesicht', 'verl_hws', 'verl_thorax', 'verl_abdomen',
          'verl_bws_lws', 'verl_becken', 'verl_obere_extr', 'verl_untere_extr', 'verl_weichteile',
          'unfallmechanismus', 'spezielle_traumata',
          'verbrennung_1', 'verbrennung_2', 'verbrennung_3',
          'unfallhergang', 'sturz',
        ],
      },
    ],
  },
  { id: 'messwerte', kurz: 'VITAL', titel: 'Messwerte initial', abschnitte: ['messwerte'] },
  { id: 'diagnosen', kurz: 'DIAG', titel: 'Erkrankungen und Score', abschnitte: ['diagnosen'] },
  {
    id: 'massnahmen',
    kurz: 'MASS',
    titel: 'Maßnahmen, Medikation, Beatmung',
    abschnitte: ['medikation', 'reanimation', 'zugaenge', 'beatmung', 'massnahmen'],
  },
  {
    id: 'uebergabe',
    kurz: 'ÜBER',
    titel: 'Übergabe und Abschluss',
    abschnitte: ['uebergabe_befund', 'uebergabe_neuro', 'abschluss'],
  },
]

/** Ein Teil eines Zettels mit seinen Feldern. */
export type ZettelTeil = {
  id: string
  titel: string
  /** Der Buchstabe des Schemas, falls es einem folgt. */
  kennung?: string
  /** Kurzzeichen für den Umschalter oben im Zettel. */
  kurz: string
  felder: AelrdFeld[]
}

function felderVon(abschnittId: string): AelrdFeld[] {
  const a = AELRD_ABSCHNITTE.find((x) => x.id === abschnittId)
  if (!a) return []
  return a.felder
    .filter((id) => !istSpiegelFeld(id))
    .map(aelrdFeld)
    .filter(Boolean) as AelrdFeld[]
}

/**
 * Die Zettel mit ihren Teilen und Feldern.
 *
 * Ein Zettel ohne Felder bekommt keinen Reiter — die Verlaufsbeschreibung
 * etwa ist auf dem Papier das Kurvenblatt und führt keine.
 */
export function zettelMitFeldern(): (Zettel & { teile: ZettelTeil[]; felder: AelrdFeld[] })[] {
  return ZETTEL.map((z) => {
    const teile: ZettelTeil[] = z.gruppen
      ? z.gruppen
          .map((g) => ({
            id: `${z.id}-${g.kennung || g.titel}`,
            titel: g.titel,
            kennung: g.kennung,
            // Der Buchstabe ist das Kurzzeichen; der Zeitpunkt vorweg hat
            // keinen und bekommt ein eigenes, damit die Leiste schmal bleibt.
            kurz: g.kennung || g.kurz || g.titel.slice(0, 1),
            felder: g.felder.map(aelrdFeld).filter(Boolean) as AelrdFeld[],
          }))
          .filter((t) => t.felder.length > 0)
      : z.abschnitte
          .map((id) => ({
            id,
            titel: AELRD_ABSCHNITTE.find((a) => a.id === id)?.titel ?? id,
            // Das Kurzzeichen des Abschnitts gibt es im Katalog bereits.
            kurz: AELRD_ABSCHNITTE.find((a) => a.id === id)?.kurz ?? id.slice(0, 4).toUpperCase(),
            felder: felderVon(id),
          }))
          .filter((t) => t.felder.length > 0)
    return { ...z, teile, felder: teile.flatMap((t) => t.felder) }
  }).filter((z) => z.felder.length > 0)
}

/** Die Felder, die ein Zettel aus den Abschnitten des Bogens mitbringt. */
export function felderAusAbschnitten(z: Zettel): string[] {
  return z.abschnitte.flatMap((id) => felderVon(id)).map((f) => f.id)
}
