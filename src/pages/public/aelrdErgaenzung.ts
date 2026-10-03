// Welche Felder des ÄLRD-Bogens in welchem Abschnitt der Patienten-
// dokumentation ergänzt werden.
//
// Das Formular erhebt von den 205 Feldern des Bogens nur einen Teil. Die
// übrigen stehen hier, jedes dem Abschnitt zugeordnet, in den es fachlich
// gehört. Ein Test hält die Zuordnung vollständig — ein vergessenes Feld
// bliebe sonst unerfassbar, und man merkte es erst am leeren Protokoll.

export const AELRD_ERGAENZUNG: Record<string, string[]> = {
  stammdaten: ['geschlecht', 'bmi', 'alter_wert', 'alter_einheit'],

  einsatzdaten: [
    'einsatz_datum', 'leitstelle_nr', 'sondersignal',
    'beteiligtes_rm', 'einsatzort_art', 'versorgung', 'voranmeldung',
  ],

  mannschaft: ['mannschaft_1', 'mannschaft_2', 'mannschaft_3'],

  zeitstrahl: [
    'symptombeginn', 'symptombeginn_geschaetzt', 'kollaps_beobachtet',
    'symptombeginn_ueber24h', 'zeit_ankunft_patient', 'zeit_einsatzbereit', 'zeit_ende',
  ],

  anamnese: ['ersthelfermassnahmen', 'az_vor_ereignis', 'first_responder'],

  messwerte: ['erstbefund_zeitpunkt', 'spo2_mit_o2', 'co_hb', 'puls', 'ibp_sys', 'ibp_dia', 'temp_ort'],

  neurologie: ['neuro_ohne_befund', 'neuro_auffaelligkeiten', 'schmerz_nicht_beurteilbar', 'schmerz_tolerabel'],

  // Der Bogen führt Atemwege und Kreislauf als eigene Befundblöcke; im
  // Formular ist der EKG-/Befund-Abschnitt die passendste Stelle dafür.
  ekg: [
    'atemwege', 'kreislauf', 'puls_regelmaessig', 'radialispuls',
    'rekap_zeit', 'schockzeichen', 'kreislauf_auffaelligkeiten', 'ekg_text',
  ],

  haut_psyche: ['untersuchung'],

  erstdiagnose: ['tracerdiagnose', 'fuehrende_diagnose', 'weitere_diagnosen', 'news_score', 'roter_warnwert'],

  verlauf: ['keine_medikation', 'lysetherapie', 'lyse_zeitpunkt'],

  verletzungen: ['verletzung_zusammenhang', 'verbrennung_1', 'verbrennung_2', 'verbrennung_3'],

  atemwege: ['atemweg_massnahme', 'intubation', 'tubus_groesse'],

  beatmung: [
    'beatmung_mode', 'beatmung_art2', 'beatmung_flow', 'beatmung_manuell',
    'defi_joule_1', 'pacer_frequenz', 'pacer_intensitaet', 'pacer_mode',
  ],

  zugang: [
    'pvk_vorhanden', 'zugaenge', 'zugang_erschwert',
    'lagerung', 'sonstige_massnahme', 'blutentnahme', 'waermeerhalt',
    'erweitertes_monitoring', 'medizintechnik',
  ],

  reanimation: [
    'rea_situation', 'rea_ursache', 'tod_ursache', 'todesart',
    'kollaps_durch', 'hdm_durch', 'defi1_durch',
    'kh_aufnahme', 'leichenschau', 'todeszeitpunkt',
    'rea_massnahme', 'aktive_kuehlung',
  ],

  // Den Übergabe-Befund gibt es im Formular bisher gar nicht: die alte
  // Dokumentation erhebt Vitalwerte nur einmal, der Bogen will sie beim
  // Erstbefund und bei der Übergabe.
  uebergabe: [
    'ub_zeitpunkt', 'ub_atemwege', 'ub_atmung', 'ub_kreislauf',
    'ub_puls_regelmaessig', 'ub_radialispuls', 'ub_rekap', 'ub_schockzeichen',
    'ub_ekg', 'ub_psyche', 'ub_untersuchung',
    'ub_neuro_ohne_befund', 'ub_bewusstsein',
    'ub_gcs_augen', 'ub_gcs_verbal', 'ub_gcs_motorik', 'ub_gcs_summe',
    'ub_pupillen_weite_re', 'ub_pupillen_weite_li',
    'ub_pupillen_licht_re', 'ub_pupillen_licht_li',
    'ub_schmerz', 'ub_schmerz_nicht_beurteilbar', 'ub_schmerz_tolerabel',
    'ub_af', 'ub_spo2', 'ub_spo2_mit_o2', 'ub_hf', 'ub_puls', 'ub_etco2',
    'ub_nibp_sys', 'ub_nibp_dia', 'ub_ibp_sys', 'ub_ibp_dia', 'ub_bz', 'ub_temp',
    'besonderheiten', 'wertsachen', 'aelrd_delegationen',
    'naca_uebergabe', 'notarzt_nachgefordert',
  ],

  unterschrift: ['unterschrift'],
}

/** Alle ergänzten Feld-IDs, flach. */
export function ergaenzteFelder(): string[] {
  return Object.values(AELRD_ERGAENZUNG).flat()
}
