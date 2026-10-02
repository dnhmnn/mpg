// Die Felder des bayerischen ÄLRD-Einsatzprotokolls (NIDA/medDV),
// so wie sie auf dem Bogen stehen — Beschriftung und Optionsreihenfolge
// woertlich aus der Vorlage vermessen.
//
// Warum ein zweiter Katalog neben divi.ts:
// Der Bogen folgt DIVI 6.0 / MIND 4.0, divi.ts bildet DIVI 7.1 ab. Die
// Optionslisten sind nicht deckungsgleich — der Bogen kennt ATEMWEGE und
// KREISLAUF als eigene Befundbloecke, 7.1 nicht; 7.1 kennt dafuer Felder,
// die der Bogen nicht zeigt. Die beiden zu vermischen wuerde beide
// verfaelschen. Dieser Katalog ist das, was gedruckt wird; divi.ts bleibt
// die Referenz auf die neuere Norm.
//
// ZUORDNUNG: Wo ein Feld in 7.1 eine Entsprechung hat, steht sie als
// `divi`-Verweis daneben. Felder ohne Verweis gibt es in 7.1 nicht.

import type { Feld, Option } from './divi'

export type AelrdFeld = Feld & {
  /** Die entsprechende Feld-ID in divi.ts, falls es eine gibt. */
  divi?: string
}

function radio(id: string, label: string, texte: string[], divi?: string): AelrdFeld {
  return {
    id,
    label,
    typ: 'radio',
    divi,
    optionen: texte.map((t) => ({ wert: schluessel(t), text: t })),
  }
}

function mehrfach(id: string, label: string, texte: string[], divi?: string): AelrdFeld {
  return {
    id,
    label,
    typ: 'mehrfach',
    divi,
    optionen: texte.map((t) => ({ wert: schluessel(t), text: t })),
  }
}

/**
 * Aus dem Optionstext einen stabilen Speicherwert machen.
 *
 * Die Vergleichszeichen muessen uebersetzt werden, nicht weggeworfen:
 * sonst werden aus "< 40" und "> 40" beide der Wert "40", und BMI unter
 * und ueber 40 waeren im Protokoll nicht mehr zu unterscheiden. Dasselbe
 * gilt fuer die Sturzhoehen "< 3m" und ">= 3m".
 */
export function schluessel(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/>=|≥/g, ' ab ')
    .replace(/<=|≤/g, ' bis ')
    .replace(/>/g, ' ueber ')
    .replace(/</g, ' unter ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ─────────────────────────────────────────────────────────────────────────
// Seite 1
// ─────────────────────────────────────────────────────────────────────────

export const AELRD_FELDER: AelrdFeld[] = [
  // ── Stammdaten ────────────────────────────────────────────────────────
  { id: 'name', label: 'Name', typ: 'text', divi: 'name', pflicht: true },
  { id: 'vorname', label: 'Vorname', typ: 'text', divi: 'vorname' },
  { id: 'gebdatum', label: 'Geburtsdatum', typ: 'datum', divi: 'gebdatum', pflicht: true },
  { id: 'strasse', label: 'Straße', typ: 'text', divi: 'strasse' },
  { id: 'plz_ort', label: 'PLZ / Ort', typ: 'text', divi: 'plz_ort' },
  { id: 'kasse', label: 'Kasse / Nr.', typ: 'text', divi: 'kasse' },
  { id: 'versnr', label: 'Vers.-Nr.', typ: 'text', divi: 'versnr' },

  radio('geschlecht', 'Geschlecht', ['männlich', 'divers', 'weiblich'], 'geschlecht'),
  radio('bmi', 'BMI', ['< 40', '> 40'], 'bmi'),
  { id: 'alter_wert', label: 'Alter', typ: 'zahl', divi: 'alter_wert', min: 0, max: 130 },
  radio('alter_einheit', 'Alter in', ['Jahre', '1-7 Tg', '8-28 Tg'], 'alter_einheit'),

  // ── Einsatzkennung ────────────────────────────────────────────────────
  { id: 'einsatz_nr', label: 'Einsatz Nr.', typ: 'text', divi: 'einsatz_nr', pflicht: true },
  { id: 'leitstelle_nr', label: 'Leitst. Nr.', typ: 'text', divi: 'leitstelle' },
  { id: 'rufname', label: 'Rufname', typ: 'text', divi: 'fahrzeug' },
  { id: 'standort', label: 'Standort', typ: 'text', divi: 'standort' },

  // ── Einsatztechnische Daten ───────────────────────────────────────────
  { id: 'einsatz_datum', label: 'Einsatz-Datum', typ: 'datum', divi: 'einsatz_datum', pflicht: true },
  radio('sondersignal', 'Sondersignal', ['Anfahrt', 'Transport']),
  { id: 'beteiligtes_rm', label: 'beteiligtes RM', typ: 'text' },
  { id: 'einsatzort_art', label: 'Art des Einsatzortes', typ: 'text', divi: 'einsatzstelle' },
  { id: 'transport_von', label: 'Transport von', typ: 'text' },
  { id: 'transport_ziel', label: 'Transportziel', typ: 'text', divi: 'transport_ziel' },
  { id: 'einsatz_art', label: 'Einsatz-Art', typ: 'text', divi: 'einsatz_art' },
  { id: 'versorgung', label: 'Versorgung', typ: 'text' },
  { id: 'voranmeldung', label: 'Voranmeldung', typ: 'check', divi: 'voranmeldung' },

  // ── Symptom-Beginn und Zeiten ─────────────────────────────────────────
  { id: 'symptombeginn_geschaetzt', label: 'geschätzt', typ: 'check', divi: 'symptombeginn_art' },
  { id: 'kollaps_beobachtet', label: 'Kollaps beobachtet', typ: 'check', divi: 'kollaps_beobachtet' },
  { id: 'symptombeginn_ueber24h', label: 'vor > 24 Stunden', typ: 'check', divi: 'symptombeginn_ueber24h' },
  { id: 'symptombeginn', label: 'Symptom-Beginn', typ: 'datum', divi: 'symptombeginn_zeit' },
  { id: 'zeit_alarm', label: 'Alarm', typ: 'zeit', divi: 'zeit_alarm', pflicht: true },
  { id: 'zeit_ankunft_ort', label: 'Ankunft (E.-Ort)', typ: 'zeit', divi: 'zeit_ankunft_einsatzort', pflicht: true },
  { id: 'zeit_ankunft_patient', label: 'Ankunft (Patient)', typ: 'zeit', divi: 'zeit_ankunft_patient' },
  { id: 'zeit_abfahrt', label: 'Abfahrt', typ: 'zeit', divi: 'zeit_abfahrt' },
  { id: 'zeit_uebergabe', label: 'Übergabe', typ: 'zeit', divi: 'zeit_uebergabe', pflicht: true },
  { id: 'zeit_einsatzbereit', label: 'Einsatzbereit', typ: 'zeit' },
  { id: 'zeit_ende', label: 'Ende', typ: 'zeit', divi: 'zeit_ende' },

  // ── Notfallgeschehen ──────────────────────────────────────────────────
  { id: 'notfallgeschehen', label: 'Notfallgeschehen, Anamnese, Erstbefund, Vormedikation, Vorbehandlung', typ: 'langtext', divi: 'notfallgeschehen', pflicht: true },
  radio('ersthelfermassnahmen', 'Ersthelfermaßnahmen (Laien)', ['suffizient', 'insuffizient', 'keine'], 'ersthelfermassnahmen'),
  { id: 'az_vor_ereignis', label: 'AZ des Pat. vor Ereignis', typ: 'text', divi: 'az_vor_ereignis' },
  { id: 'first_responder', label: 'First Responder', typ: 'check', divi: 'first_responder_vor_ort' },

  // ── Erstbefund ────────────────────────────────────────────────────────
  { id: 'erstbefund_zeitpunkt', label: 'Zeitpunkt', typ: 'zeit', divi: 'neuro_zeitpunkt' },
  radio('atemwege', 'Atemwege', [
    'frei', 'gefährdet', 'Stridor exsp.',
    'nicht untersucht', 'nicht beurteilbar', 'Stridor insp.', 'Atemwegsverlegung',
  ]),
  radio('atmung', 'Atmung', [
    'unauffällig', 'Tachypnoe', 'Rasselgeräusche', 'Apnoe',
    'nicht untersucht', 'nicht beurteilbar', 'Bradypnoe', 'Schnappatmung', 'Spastik',
    'Belastungsdyspnoe', 'Ruhedyspnoe', 'Beatmung', 'Hyperventilation', 'Zyanose', 'Sonstige',
  ], 'atmung'),
  radio('kreislauf', 'Kreislauf', ['unauffällig', 'nicht untersucht', 'Blutung']),
  { id: 'puls_regelmaessig', label: 'Puls regelmäßig:', typ: 'text', divi: 'hf_rhythmus' },
  { id: 'radialispuls', label: 'Radialispuls tastbar', typ: 'text' },
  { id: 'rekap_zeit', label: 'Rekap. Zeit:', typ: 'text', divi: 'rekap_zeit' },
  { id: 'schockzeichen', label: 'Schockzeichen', typ: 'text' },
  { id: 'kreislauf_auffaelligkeiten', label: 'path. Auffälligkeiten:', typ: 'langtext' },
  radio('haut', 'Haut', [
    'unauffällig', 'Oedeme', 'kaltschweißig', 'stehende Hautfalten',
    'nicht untersucht', 'nicht beurteilbar', 'Dekubitus', 'Exantheme', 'Sonstige',
  ], 'haut'),
  radio('ekg', 'EKG', ['kein EKG', 'Sinusrhythmus', 'nicht beurteilbar'], 'ekg_rhythmus'),
  { id: 'ekg_text', label: 'EKG-Befund', typ: 'langtext', divi: 'ekg_befund' },

  // ── Messwerte initial ─────────────────────────────────────────────────
  { id: 'af', label: 'AF', typ: 'zahl', einheit: '/Min', divi: 'af', pflicht: true, min: 0, max: 80 },
  { id: 'spo2', label: 'SpO₂', typ: 'zahl', einheit: '%', divi: 'spo2', pflicht: true, min: 0, max: 100 },
  { id: 'spo2_mit_o2', label: 'mit O₂?:', typ: 'text', divi: 'spo2_bedingung' },
  { id: 'co_hb', label: 'CO Hb', typ: 'zahl', einheit: '%' },
  { id: 'hf', label: 'HF', typ: 'zahl', einheit: '/Min', divi: 'hf', pflicht: true, min: 0, max: 300 },
  { id: 'puls', label: 'Puls', typ: 'zahl', einheit: '/Min', min: 0, max: 300 },
  { id: 'etco2', label: 'etCO₂', typ: 'zahl', einheit: 'mmHg', divi: 'etco2', min: 0, max: 150 },
  { id: 'nibp_sys', label: 'NIBP systolisch', typ: 'zahl', einheit: 'mmHg', divi: 'rr_sys', pflicht: true, min: 0, max: 300 },
  { id: 'nibp_dia', label: 'NIBP diastolisch', typ: 'zahl', einheit: 'mmHg', divi: 'rr_dia', min: 0, max: 200 },
  { id: 'ibp_sys', label: 'IBP systolisch', typ: 'zahl', einheit: 'mmHg' },
  { id: 'ibp_dia', label: 'IBP diastolisch', typ: 'zahl', einheit: 'mmHg' },
  { id: 'bz', label: 'BZ', typ: 'zahl', einheit: 'mg/dl', divi: 'bz', min: 0, max: 1000 },
  { id: 'temp', label: 'Temp.', typ: 'zahl', einheit: '°C', divi: 'temp', min: 20, max: 45 },
  { id: 'temp_ort', label: 'Messort Temperatur', typ: 'text' },

  // ── Neurologie ────────────────────────────────────────────────────────
  { id: 'neuro_ohne_befund', label: 'ohne path. Befund', typ: 'check', divi: 'neuro_ohne_befund' },
  { id: 'bewusstsein', label: 'Bewusstsein:', typ: 'text', divi: 'bewusstsein' },
  { id: 'gcs_augen', label: 'Augen', typ: 'zahl', divi: 'gcs_augen', min: 1, max: 4 },
  { id: 'gcs_verbal', label: 'Verbal', typ: 'zahl', divi: 'gcs_verbal', min: 1, max: 5 },
  { id: 'gcs_motorik', label: 'Motorik', typ: 'zahl', divi: 'gcs_motorik', min: 1, max: 6 },
  { id: 'gcs_summe', label: 'Summe', typ: 'zahl', divi: 'gcs_summe', pflicht: true, min: 3, max: 15 },
  { id: 'pupillen_weite_re', label: 'Weite rechts', typ: 'text', divi: 'pupillenweite_rechts' },
  { id: 'pupillen_weite_li', label: 'Weite links', typ: 'text', divi: 'pupillenweite_links' },
  { id: 'pupillen_licht_re', label: 'Lichtreaktion rechts', typ: 'text', divi: 'lichtreaktion_rechts' },
  { id: 'pupillen_licht_li', label: 'Lichtreaktion links', typ: 'text', divi: 'lichtreaktion_links' },
  radio('neuro_auffaelligkeiten', 'Auffälligkeiten', [
    'keine', 'nicht untersucht', 'nicht beurteilbar', 'Gesichtslähmung',
    'Kopfschmerzen', 'Gangunsicherheit / Schwindel', 'Herdblick', 'Motorik Arme',
    'Demenz', 'Querschnittssymptomatik', 'Sensibilitätsstörung', 'Motorik Beine',
    'Sehstörung', 'Babinski Zeichen', 'Übelkeit / Erbrechen', 'Sprachstörung',
    'Meningismus', 'vorbestehende neurologische Defizite', 'Sonstige',
  ], 'neuro_auffaelligkeiten'),
  { id: 'schmerz', label: 'Schmerzen', typ: 'skala', divi: 'schmerz', pflicht: true, min: 0, max: 10 },
  { id: 'schmerz_nicht_beurteilbar', label: 'NRS nicht beurteilbar', typ: 'check' },
  { id: 'schmerz_tolerabel', label: 'tolerabler Schmerz', typ: 'text', divi: 'schmerzerleben' },

  // ── Untersuchung und Psyche ───────────────────────────────────────────
  { id: 'untersuchung', label: 'Untersuchung', typ: 'langtext' },
  radio('psyche', 'Psyche', [
    'unauffällig', 'aggressiv', 'verwirrt', 'verlangsamt', 'suizidal',
    'nicht untersucht', 'nicht beurteilbar', 'depressiv', 'erregt', 'euphorisch', 'Sonstige',
    'wahnhaft', 'ängstlich', 'motorisch unruhig',
  ], 'psyche'),

  // ── Verletzungen ──────────────────────────────────────────────────────
  { id: 'verletzung_zusammenhang', label: 'Zusammenhang mit', typ: 'text' },
  { id: 'verletzungsmuster', label: 'Verletzungsmuster', typ: 'text' },
  { id: 'verl_sht', label: 'SHT', typ: 'text', divi: 'verl_schaedel_hirn' },
  { id: 'verl_gesicht', label: 'Gesicht', typ: 'text', divi: 'verl_gesicht' },
  { id: 'verl_hws', label: 'HWS', typ: 'text', divi: 'verl_hws' },
  { id: 'verl_thorax', label: 'Thorax', typ: 'text', divi: 'verl_thorax' },
  { id: 'verl_abdomen', label: 'Abdomen', typ: 'text', divi: 'verl_abdomen' },
  { id: 'verl_bws_lws', label: 'BWS / LWS', typ: 'text', divi: 'verl_bws_lws' },
  { id: 'verl_becken', label: 'Becken', typ: 'text', divi: 'verl_becken' },
  { id: 'verl_obere_extr', label: 'obere Extr.', typ: 'text', divi: 'verl_obere_extremitaeten' },
  { id: 'verl_untere_extr', label: 'untere Extr.', typ: 'text', divi: 'verl_untere_extremitaeten' },
  { id: 'verl_weichteile', label: 'Weichteile', typ: 'text', divi: 'verl_weichteile' },
  radio('unfallmechanismus', 'Unfallmechanismus', ['stumpf', 'penetrierend', 'nicht bekannt']),
  radio('spezielle_traumata', 'Spezielle Traumata', [
    'Inhalationstrauma', 'Tauchunfall',
    'Elektrounfall', 'sonstige (Strahlen, Barotrauma)',
    '(beinahe-) Ertrinken', 'Verätzung',
  ], 'unfall_weitere'),
  { id: 'verbrennung_1', label: 'I°', typ: 'zahl', einheit: '%', divi: 'verbrennung_grad1_kof', min: 0, max: 100 },
  { id: 'verbrennung_2', label: 'II°', typ: 'zahl', einheit: '%', divi: 'verbrennung_grad2_kof', min: 0, max: 100 },
  { id: 'verbrennung_3', label: 'III°', typ: 'zahl', einheit: '%', divi: 'verbrennung_grad3_kof', min: 0, max: 100 },
  radio('unfallhergang', 'Unfallhergang', [
    'Motorradfahrer', 'Fußgänger angefahren', 'Schlag', 'Explosion/Verpuffung',
    'PKW-Insasse', 'Fahrrad', 'sonstiger Verkehrsunfall', 'Schuss', 'Verschüttung',
    'LKW-Insasse', 'E-Bike / Pedelec', 'Stich', 'andere Unfallarten',
    'Bus-Insasse', 'E-Scooter',
  ], 'unfall_verkehrsteilnehmer'),
  radio('sturz', 'Sturz', ['ebenerdig', '< 3m', '>= 3m', 'nicht bekannt'], 'unfall_sturz'),

  // ── Erkrankungen und Score ────────────────────────────────────────────
  { id: 'tracerdiagnose', label: 'Tracerdiagnose', typ: 'text' },
  { id: 'fuehrende_diagnose', label: 'führende Diagnose', typ: 'text' },
  { id: 'weitere_diagnosen', label: 'weitere Diagnosen', typ: 'langtext' },
  { id: 'diagnosetext', label: 'Diagnosetext', typ: 'langtext', divi: 'erstdiagnose_text' },
  { id: 'naca_initial', label: 'NACA SCORE initial', typ: 'text', divi: 'naca' },
  { id: 'news_score', label: 'NEWS Score (berechnet/manuell)', typ: 'text', divi: 'news2' },
  { id: 'roter_warnwert', label: 'Roter Warnwert', typ: 'text' },
]

const register = new Map(AELRD_FELDER.map((f) => [f.id, f]))

/** Ein Feld des Bogens anhand seiner ID. */
export function aelrdFeld(id: string): AelrdFeld | undefined {
  return register.get(id)
}

/** Die Optionen eines Feldes, oder eine leere Liste. */
export function aelrdOptionen(id: string): Option[] {
  return register.get(id)?.optionen ?? []
}

/** Felder des Bogens, die in DIVI 7.1 keine Entsprechung haben. */
export function ohneDiviEntsprechung(): AelrdFeld[] {
  return AELRD_FELDER.filter((f) => !f.divi)
}

/** Pflichtfelder des Bogens. */
export function aelrdPflichtfelder(): AelrdFeld[] {
  return AELRD_FELDER.filter((f) => f.pflicht)
}

// ─────────────────────────────────────────────────────────────────────────
// Seite 2 — Verlauf, Maßnahmen, Übergabe
// ─────────────────────────────────────────────────────────────────────────

export const AELRD_FELDER2: AelrdFeld[] = [
  // ── Medikation und Lyse ───────────────────────────────────────────────
  { id: 'keine_medikation', label: 'keine Medikation', typ: 'check', divi: 'medikation_keine' },
  { id: 'medikation', label: 'Medikation', typ: 'medikation', divi: 'medikation' },
  radio('lysetherapie', 'Lysetherapie', ['vor Kreislaufstillstand', 'nach Kreislaufstillstand', 'nach ROSC'], 'lysetherapie'),
  { id: 'lyse_zeitpunkt', label: 'Zeitpunkt Lyse', typ: 'zeit', divi: 'lysetherapie_beginn' },

  // ── Reanimation / Tod ─────────────────────────────────────────────────
  { id: 'rea_situation', label: 'Reanimationssituation', typ: 'text', divi: 'rea_ergebnis' },
  { id: 'rea_ursache', label: 'Vermutete Ursache Rea', typ: 'text', divi: 'rea_ursache' },
  { id: 'tod_ursache', label: 'Vermutete Ursache Tod', typ: 'text' },
  { id: 'todesart', label: 'Todesart', typ: 'text', divi: 'todesart' },
  { id: 'kollaps_durch', label: 'Kollaps beobachtet durch', typ: 'text', divi: 'kollaps_beobachtet_durch' },
  { id: 'hdm_durch', label: 'HDM gestartet durch', typ: 'text', divi: 'hdm_beginn_durch' },
  { id: 'defi1_durch', label: '1. Defibrillation durch', typ: 'text', divi: 'erste_defi_durch' },
  { id: 'defi1_zeit', label: 'Zeitpunkt Defibrillation', typ: 'zeit', divi: 'defi_erster_schock' },
  { id: 'rosc_zeit', label: 'Zeitpunkt ROSC', typ: 'zeit', divi: 'rosc_zeitpunkt' },
  { id: 'kh_aufnahme', label: 'Krankenhausaufnahme', typ: 'text' },
  { id: 'leichenschau', label: 'Leichenschau durchgeführt', typ: 'text' },
  { id: 'todeszeitpunkt', label: 'Todeszeitpunkt', typ: 'zeit', divi: 'todeszeitpunkt' },

  // ── Maßnahmen ─────────────────────────────────────────────────────────
  { id: 'pvk_vorhanden', label: 'PVK vorhanden', typ: 'check' },
  { id: 'zugaenge', label: 'Zugänge', typ: 'langtext', divi: 'zugang_art' },
  radio('zugang_erschwert', 'Zugang erschwert', ['unmöglich', '> 2 Vers.', 'Verfahrenswechsel'], 'zugang_erschwert'),
  radio('atemweg_massnahme', 'Atemweg', [
    'Absaugen', '> 2 Intub.-Versuche',
    'Atemwege freimachen', 'Maskenbeatm. unmöglich',
    'Entlastungspunktion', 'Verfahrenswechsel',
  ], 'atemweg_massnahmen'),
  { id: 'intubation', label: 'Intubation', typ: 'text' },
  { id: 'tubus_groesse', label: 'Größe', typ: 'text', divi: 'tubus_groesse' },
  { id: 'o2_gabe', label: 'O₂-Gabe', typ: 'zahl', einheit: 'Liter/min', divi: 'o2_flow' },
  radio('beatmung_art', 'Beatmung', ['Spontanatmung', 'kontrollierte Beatmung'], 'beatmung_art'),
  { id: 'beatmung_fio2', label: 'FiO₂', typ: 'zahl', einheit: '%', divi: 'beatmung_fio2' },
  { id: 'beatmung_af', label: 'AF', typ: 'zahl', divi: 'beatmung_af' },
  { id: 'beatmung_amv', label: 'AMV', typ: 'zahl', divi: 'beatmung_amv' },
  { id: 'beatmung_peep', label: 'PEEP', typ: 'zahl', divi: 'beatmung_peep' },
  { id: 'beatmung_pinsp', label: 'P insp', typ: 'zahl', divi: 'beatmung_pmax' },
  { id: 'beatmung_mode', label: 'Mode', typ: 'text' },
  { id: 'beatmung_art2', label: 'Art', typ: 'text' },
  { id: 'beatmung_flow', label: 'Flow l/min', typ: 'zahl' },
  radio('beatmung_manuell', 'manuell', ['Demandventil', 'Rückatmung']),
  radio('defi_art', 'Defibrillation', ['monophasisch', 'biphasisch']),
  { id: 'defi_joule_1', label: 'Joule 1. Defibrillation', typ: 'zahl' },
  { id: 'defi_gesamt', label: 'Defibrillationen Gesamt', typ: 'zahl', divi: 'defi_anzahl' },
  { id: 'defi_joule_letzte', label: 'Joule letzte Defibrillation', typ: 'zahl', divi: 'defi_energie_max' },
  { id: 'rosc_1', label: '1. ROSC', typ: 'zeit', divi: 'rosc_zeitpunkt' },
  { id: 'pacer_frequenz', label: 'Frequenz', typ: 'zahl' },
  { id: 'pacer_intensitaet', label: 'Intensität', typ: 'zahl' },
  { id: 'pacer_mode', label: 'Mode', typ: 'text' },
  radio('rea_massnahme', 'Reanimation', ['Herzdruckmassage', 'Feedbacksystem', 'mechanische Thoraxkompression'], 'rea_erweitert'),
  radio('aktive_kuehlung', 'Aktive Kühlung', ['Infusion', 'Kühlpackungen', 'technisch', 'andere']),
  { id: 'lagerung', label: 'Lagerungs- und Rettungstechnik', typ: 'langtext', divi: 'lagerung' },
  radio('sonstige_massnahme', 'Sonstige', ['Thoraxdrainage /', 'Entlastungspunktion', 'Magensonde']),
  radio('blutentnahme', 'Blutentnahme', ['venös', 'arteriell']),
  radio('waermeerhalt', 'Wärmeerhalt', ['passiv', 'aktiv'], 'lagerung'),
  radio('erweitertes_monitoring', 'Erweitertes Monitoring', [
    'kein erw. Monitoring', '12-Kanal EKG', 'invasiver RR', 'Kapnometrie', 'ZVD', 'ICP',
    '12-Kanal EKG vorhanden/durch Andere', 'sonstiges Monitoring',
  ], 'weitere_massnahmen'),
  radio('medizintechnik', 'Medizintechnik', [
    'keine Medizintechnik', 'Spritzenpumpe(n)', 'Ultraschall (Sono/Echo)', 'Notfallpacer',
    'Funk EKG Übermittlung', 'Videolaryngoskopie', 'Transportinkubator', 'ECMO',
    'mechanische Thoraxkompression', 'andere MedTech',
  ], 'weitere_massnahmen'),

  // ── Übergabe-Befund ───────────────────────────────────────────────────
  { id: 'ub_zeitpunkt', label: 'Zeitpunkt', typ: 'zeit', divi: 'ub_zeitpunkt' },
  radio('ub_atemwege', 'Atemwege', [
    'frei', 'Stridor insp.', 'Stridor exsp.',
    'nicht untersucht', 'nicht beurteilbar', 'Atemwegsverlegung', 'gefährdet',
  ]),
  radio('ub_atmung', 'Atmung', [
    'unauffällig', 'Spastik', 'Rasselgeräusche', 'Apnoe', 'Sonstige',
    'nicht untersucht', 'nicht beurteilbar', 'Ruhedyspnoe', 'Schnappatmung', 'Beatmung',
    'Belastungsdyspnoe', 'Tachypnoe', 'Zyanose', 'Hyperventilation', 'Bradypnoe',
  ], 'ub_atmung'),
  radio('ub_kreislauf', 'Kreislauf', ['unauffällig', 'nicht untersucht']),
  { id: 'ub_puls_regelmaessig', label: 'Puls regelmäßig:', typ: 'text' },
  { id: 'ub_radialispuls', label: 'Radialispuls tastbar', typ: 'text' },
  { id: 'ub_rekap', label: 'Rekap. Zeit:', typ: 'text' },
  { id: 'ub_schockzeichen', label: 'Schockzeichen', typ: 'text' },
  radio('ub_ekg', 'EKG', ['kein EKG', 'Sinusrhythmus']),
  radio('ub_psyche', 'Psyche', [
    'aggressiv', 'verwirrt', 'verlangsamt', 'suizidal', 'nicht beurteilbar',
    'unauffällig', 'depressiv', 'erregt', 'euphorisch', 'Sonstige', 'nicht untersucht',
    'wahnhaft', 'ängstlich', 'motorisch unruhig',
  ]),
  { id: 'ub_untersuchung', label: 'Untersuchung Übergabe', typ: 'langtext' },

  // ── Neurologie und Messwerte bei Übergabe ─────────────────────────────
  { id: 'ub_neuro_ohne_befund', label: 'ohne path. Befund', typ: 'check' },
  { id: 'ub_bewusstsein', label: 'Bewusstsein:', typ: 'text', divi: 'ub_bewusstsein' },
  { id: 'ub_gcs_augen', label: 'Augen', typ: 'zahl', min: 1, max: 4 },
  { id: 'ub_gcs_verbal', label: 'Verbal', typ: 'zahl', min: 1, max: 5 },
  { id: 'ub_gcs_motorik', label: 'Motorik', typ: 'zahl', min: 1, max: 6 },
  { id: 'ub_gcs_summe', label: 'Summe', typ: 'zahl', divi: 'ub_gcs', min: 3, max: 15 },
  { id: 'ub_pupillen_weite_re', label: 'Weite rechts', typ: 'text', divi: 'ub_pupillenweite_rechts' },
  { id: 'ub_pupillen_weite_li', label: 'Weite links', typ: 'text', divi: 'ub_pupillenweite_links' },
  { id: 'ub_pupillen_licht_re', label: 'Lichtreaktion rechts', typ: 'text', divi: 'ub_lichtreaktion_rechts' },
  { id: 'ub_pupillen_licht_li', label: 'Lichtreaktion links', typ: 'text', divi: 'ub_lichtreaktion_links' },
  { id: 'ub_schmerz', label: 'Schmerzen', typ: 'skala', divi: 'ub_schmerz', min: 0, max: 10 },
  { id: 'ub_schmerz_nicht_beurteilbar', label: 'NRS nicht beurteilbar', typ: 'check' },
  { id: 'ub_schmerz_tolerabel', label: 'tolerabler Schmerz', typ: 'text', divi: 'ub_schmerzerleben' },
  { id: 'ub_af', label: 'AF', typ: 'zahl', einheit: '/Min', divi: 'ub_af' },
  { id: 'ub_spo2', label: 'SpO₂', typ: 'zahl', einheit: '%', divi: 'ub_spo2' },
  { id: 'ub_spo2_mit_o2', label: 'mit O₂?:', typ: 'text' },
  { id: 'ub_hf', label: 'HF', typ: 'zahl', einheit: '/Min', divi: 'ub_hf' },
  { id: 'ub_puls', label: 'Puls', typ: 'zahl', einheit: '/Min' },
  { id: 'ub_etco2', label: 'etCO₂', typ: 'zahl', einheit: 'mmHg', divi: 'ub_etco2' },
  { id: 'ub_nibp_sys', label: 'NIBP systolisch', typ: 'zahl', einheit: 'mmHg', divi: 'ub_rr_sys' },
  { id: 'ub_nibp_dia', label: 'NIBP diastolisch', typ: 'zahl', einheit: 'mmHg', divi: 'ub_rr_dia' },
  { id: 'ub_ibp_sys', label: 'IBP systolisch', typ: 'zahl', einheit: 'mmHg' },
  { id: 'ub_ibp_dia', label: 'IBP diastolisch', typ: 'zahl', einheit: 'mmHg' },
  { id: 'ub_bz', label: 'BZ', typ: 'zahl', einheit: 'mg/dl' },
  { id: 'ub_temp', label: 'Temp.', typ: 'zahl', einheit: '°C' },

  // ── Fußblöcke ─────────────────────────────────────────────────────────
  { id: 'besonderheiten', label: 'Einsatzverlauf - Besonderheiten', typ: 'langtext', divi: 'besonderheiten' },
  { id: 'wertsachen', label: 'Wertsachen', typ: 'langtext' },
  { id: 'uebergabe_an', label: 'Übergabe an', typ: 'text', divi: 'uebergabe_name' },
  { id: 'uebergabeort', label: 'Übergabeort', typ: 'text', divi: 'uebergabe_ziel' },
  { id: 'aelrd_delegationen', label: 'ÄLRD Delegationen', typ: 'langtext' },
  { id: 'bemerkungen', label: 'Bemerkungen (z.B. Hausarzt)', typ: 'langtext', divi: 'bemerkungen' },
  { id: 'naca_uebergabe', label: 'NACA SCORE Übergabe', typ: 'text' },
  { id: 'notarzt_nachgefordert', label: 'Notarzt nachgefordert', typ: 'check' },
  { id: 'unterschrift', label: 'Unterschrift', typ: 'text', divi: 'ausfueller_name' },
]

for (const f of AELRD_FELDER2) register.set(f.id, f)
AELRD_FELDER.push(...AELRD_FELDER2)
