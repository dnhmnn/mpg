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
   * Warum dieser Zettel nicht an der Stelle des Papiers steht.
   *
   * Die Reihenfolge ist sonst die des Bogens; eine Ausnahme braucht einen
   * Grund, den ein Test einfordert.
   */
  ausserDerReihe?: string
  /**
   * Der Zettel führt keine Felder des Bogens, sondern eine eigene Maske.
   *
   * Sonst fiele er heraus — die Verlaufsbeschreibung ist auf dem Papier das
   * Kurvenblatt und hat keine einzelnen Felder.
   */
  maske?: boolean
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
  /** Eigene Kennung des Teils, wo eine Maske ihn füllt. */
  id?: string
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
  {
    id: 'zeiten',
    kurz: 'ZEIT',
    titel: 'Zeiten',
    abschnitte: ['zeiten'],
    /*
     * Der Abschnitt des Bogens führt neben den Einsatzzeiten auch den
     * Symptom-Beginn. Der gehört aber zur Anamnese: er beschreibt den
     * Patienten, nicht den Einsatz, und wird mit ihm erhoben. Hier bleiben
     * die Zeiten, die der Zeitstrahl führt.
     */
    gruppen: [
      {
        id: 'zeiten',
        kennung: '',
        kurz: 'ZEIT',
        titel: 'Zeiten',
        felder: ['zeit_alarm', 'zeit_uebernahme', 'zeit_ankunft_ort', 'zeit_ankunft_patient',
          'zeit_abfahrt', 'zeit_uebergabe', 'zeit_einsatzbereit', 'zeit_ende'],
      },
    ],
  },
  {
    id: 'anamnese',
    kurz: 'ANAM',
    titel: 'Notfallgeschehen und Anamnese',
    abschnitte: ['notfallgeschehen'],
    gruppen: [
      {
        id: 'notfallgeschehen',
        kennung: '',
        kurz: 'ANAM',
        titel: 'Notfallgeschehen und Anamnese',
        // Der Symptom-Beginn steht hinter dem Allgemeinzustand vor dem
        // Ereignis: beides wird im selben Gespräch erfragt.
        felder: ['notfallgeschehen', 'ersthelfermassnahmen', 'az_vor_ereignis',
          'symptombeginn', 'symptombeginn_geschaetzt', 'kollaps_beobachtet',
          'symptombeginn_ueber24h', 'first_responder'],
      },
    ],
  },
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
    /*
     * Fünf Abschnitte des Bogens stehen hier zusammen — untereinander waren
     * das über zweihundert Zeilen, durch die man zu dem einen Feld scrollt,
     * das man braucht. Deshalb dieselben Schritte wie beim Erstbefund: einer
     * zur Zeit, gewechselt über die zweite Zettelreihe.
     *
     * Der Verlauf steht vorne: er ist der Weg, über den die meisten
     * Maßnahmen hereinkommen. Die Reanimation holt sich ihre eigene Angabe
     * aus dem Abschnitt "Weitere Maßnahmen" dazu — auf dem Papier steht sie
     * dort, abgearbeitet wird sie bei der Reanimation.
     */
    gruppen: [
      {
        id: 'massnahmen-verlauf',
        kennung: '',
        kurz: 'V',
        titel: 'Maßnahmen im Verlauf',
        // Die Felder, die die Maske schreibt. Sie zählen hier mit, auch wenn
        // sie nicht einzeln dastehen.
        felder: ['zugaenge', 'medizintechnik', 'erweitertes_monitoring', 'lagerung',
          'aktive_kuehlung', 'waermeerhalt', 'blutentnahme', 'sonstige_massnahme'],
      },
      {
        id: 'massnahmen-medikation',
        kennung: '',
        kurz: 'M',
        titel: 'Medikation',
        felder: ['keine_medikation', 'medikation', 'lysetherapie', 'lyse_zeitpunkt'],
      },
      {
        id: 'massnahmen-reanimation',
        kennung: '',
        kurz: 'R',
        titel: 'Reanimation, Tod, Todesfeststellung',
        felder: ['rea_massnahme', 'rea_situation', 'rea_ursache', 'tod_ursache', 'todesart',
          'kollaps_durch', 'hdm_durch', 'defi1_durch', 'defi1_zeit', 'rosc_zeit',
          'kh_aufnahme', 'leichenschau', 'todeszeitpunkt'],
      },
      {
        id: 'massnahmen-zugaenge',
        kennung: '',
        kurz: 'Z',
        titel: 'Zugänge und Atemweg',
        felder: ['pvk_vorhanden', 'zugang_erschwert', 'atemweg_massnahme',
          'intubation', 'tubus_groesse', 'o2_gabe'],
      },
      {
        id: 'massnahmen-beatmung',
        kennung: '',
        kurz: 'B',
        titel: 'Beatmung und Defibrillation',
        felder: ['beatmung_art', 'beatmung_fio2', 'beatmung_af', 'beatmung_amv',
          'beatmung_peep', 'beatmung_pinsp', 'beatmung_mode', 'beatmung_art2',
          'beatmung_flow', 'beatmung_manuell', 'defi_art', 'defi_joule_1', 'defi_gesamt',
          // Der 1. ROSC wird bei der Reanimation erhoben (rosc_zeit) und auf
          // dem Bogen nur noch einmal bei der Defibrillation gedruckt.
          'defi_joule_letzte', 'pacer_frequenz', 'pacer_intensitaet', 'pacer_mode'],
      },
    ],
  },
  {
    id: 'verlauf',
    kurz: 'VERL',
    titel: 'Verlauf der Messwerte',
    abschnitte: ['verlauf'],
    maske: true,
    ausserDerReihe:
      'Auf dem Papier steht das Kurvenblatt oben auf Seite 2. Geschrieben wird '
      + 'es aber während des Einsatzes, nach den Maßnahmen — und dort steht es '
      + 'deshalb auch in der Maske.',
  },
  {
    id: 'uebergabe',
    kurz: 'ÜBER',
    titel: 'Übergabe-Befund nach xABCDE',
    abschnitte: ['uebergabe_befund', 'uebergabe_neuro'],
    /*
     * Derselbe Befund wie beim Antreffen, dieselbe Reihenfolge.
     *
     * Der Bogen stellt ihn anders — erst Atemwege bis EKG, dann in einem
     * zweiten Kasten Neurologie und Messwerte. Abgearbeitet wird er aber
     * nach demselben Schema wie der Erstbefund, und wer ihn zweimal am Tag
     * erhebt, soll ihn nicht zweimal anders suchen.
     */
    gruppen: [
      { kennung: '', kurz: 'Z', titel: 'Zeitpunkt', felder: ['ub_zeitpunkt'] },
      { kennung: 'x', titel: 'Kritische Blutung', felder: ['ub_kreislauf'] },
      { kennung: 'A', titel: 'Atemwege', felder: ['ub_atemwege'] },
      { kennung: 'B', titel: 'Atmung', felder: ['ub_atmung'] },
      {
        kennung: 'C',
        titel: 'Kreislauf',
        felder: ['ub_puls_regelmaessig', 'ub_radialispuls', 'ub_rekap', 'ub_schockzeichen', 'ub_ekg'],
      },
      {
        kennung: 'D',
        titel: 'Neurologie und Psyche',
        felder: [
          'ub_neuro_ohne_befund', 'ub_bewusstsein',
          'ub_gcs_augen', 'ub_gcs_verbal', 'ub_gcs_motorik', 'ub_gcs_summe',
          'ub_pupillen_weite_re', 'ub_pupillen_weite_li',
          'ub_pupillen_licht_re', 'ub_pupillen_licht_li',
          'ub_psyche',
        ],
      },
      {
        kennung: 'E',
        titel: 'Entkleiden, Schmerz, Untersuchung',
        felder: [
          'ub_schmerz', 'ub_schmerz_nicht_beurteilbar', 'ub_schmerz_tolerabel',
          'ub_untersuchung',
        ],
      },
      {
        // Beim Erstbefund stehen die Messwerte auf einem eigenen Zettel. Hier
        // gehören sie an das Ende desselben.
        kennung: '',
        kurz: 'M',
        titel: 'Messwerte bei Übergabe',
        felder: [
          'ub_af', 'ub_spo2', 'ub_spo2_mit_o2', 'ub_hf', 'ub_puls', 'ub_etco2',
          'ub_nibp_sys', 'ub_nibp_dia', 'ub_ibp_sys', 'ub_ibp_dia', 'ub_bz', 'ub_temp',
        ],
      },
    ],
  },
  {
    id: 'evm',
    kurz: 'EVM',
    titel: 'EVM — Aufklärung und Einwilligung',
    abschnitte: ['evm'],
  },
  {
    id: 'abschluss',
    kurz: 'ENDE',
    titel: 'Abschluss',
    abschnitte: ['abschluss'],
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
            id: g.id ?? `${z.id}-${g.kennung || g.titel}`,
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
          // Ein Teil ohne Felder bleibt, wenn der Zettel eine eigene Maske
          // trägt — sonst gäbe es nichts, woran sie hängen könnte.
          .filter((t) => t.felder.length > 0 || z.maske)
    return { ...z, teile, felder: teile.flatMap((t) => t.felder) }
  }).filter((z) => z.felder.length > 0 || z.maske)
}

/** Die Felder, die ein Zettel aus den Abschnitten des Bogens mitbringt. */
export function felderAusAbschnitten(z: Zettel): string[] {
  return z.abschnitte.flatMap((id) => felderVon(id)).map((f) => f.id)
}

/**
 * Auf welchem Zettel ein Feld steht — für den Sprung dorthin.
 *
 * Wer ein Feld sucht (eine offene Pflicht, eine Rückfrage), braucht nicht das
 * Feld, sondern den Weg: welchen Zettel er aufschlagen muss.
 */
export function zettelVon(feldId: string): { id: string; titel: string } | null {
  for (const z of zettelMitFeldern()) {
    if (z.felder.some((f) => f.id === feldId)) return { id: z.id, titel: z.titel }
  }
  return null
}
