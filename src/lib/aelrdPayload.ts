// Übersetzung der gewachsenen Protokoll-Payload auf die Felder des ÄLRD-Bogens.
//
// Die App führt ihre Protokolle seit jeher unter eigenen Feldnamen. Der Bogen
// erwartet andere. Ohne diese Übersetzung druckt er echte Protokolle halb
// leer — die Daten stünden in der Payload, nur unter einem Namen, den der
// Ausdruck nicht kennt.
//
// GRUNDSATZ: Nur übersetzen, was eindeutig ist. Ein falsch befülltes Feld in
// einem Einsatzprotokoll ist schlimmer als ein leeres. Was sich nicht sicher
// zuordnen lässt, wandert beschriftet in den Anamnese-Freitext — der Block
// heißt auf dem Bogen ausdrücklich „Notfallgeschehen, Anamnese, Erstbefund,
// Vormedikation, Vorbehandlung" und ist genau dafür da.

import type { Payload } from './aelrdDruck'
import { aelrdFeld } from '../katalog/aelrd'

/** Feldnamen, die in beiden Welten gleich heißen. */
const GLEICH = [
  'name', 'vorname', 'gebdatum', 'strasse', 'plz_ort', 'kasse', 'versnr',
  'einsatz_nr', 'auftrags_nr', 'rufname', 'standort', 'transport_ziel', 'einsatz_art',
  'zeit_uebergabe', 'notfallgeschehen', 'bewusstsein',
  'mannschaft_tf', 'mannschaft_1', 'mannschaft_2', 'mannschaft_3', 'mannschaft',
  'hf', 'spo2', 'af', 'temp', 'etco2', 'schmerz',
  'verlauf', 'bemerkungen', 'uebergabe_name',
] as const

/** Felder, die nur anders heißen. */
const UMBENANNT: Record<string, string> = {
  zeit_einsatz: 'zeit_alarm',
  zeit_eintreffen: 'zeit_ankunft_ort',
  zeit_transport: 'zeit_abfahrt',
  rr_sys: 'nibp_sys',
  rr_dia: 'nibp_dia',
  bz_mg: 'bz',
  naca: 'naca_initial',
  erstdiagnose_text: 'diagnosetext',
  gcs_e: 'gcs_augen',
  gcs_v: 'gcs_verbal',
  gcs_m: 'gcs_motorik',
  pw_r: 'pupillen_weite_re',
  pw_l: 'pupillen_weite_li',
  lr_r: 'pupillen_licht_re',
  lr_l: 'pupillen_licht_li',
  o2_flow: 'o2_gabe',
  einsatz_adresse: 'transport_von',
  uebergabe_ziel: 'uebergabeort',
  uebergabe_name: 'uebergabe_an',
  beat_fio2: 'beatmung_fio2',
  beat_af: 'beatmung_af',
  beat_peep: 'beatmung_peep',
  beat_pmax: 'beatmung_pinsp',
  beat_amv: 'beatmung_amv',
  defi_anzahl: 'defi_gesamt',
  defi_energie: 'defi_joule_letzte',
  defi_zeitpunkt: 'defi1_zeit',
  defi_rosc: 'rosc_1',
  rean_beginn: 'rosc_zeit',
  verletz_text: 'verletzungsmuster',
}

/** Boolesche Flags, die eine Option des Bogens setzen. Erster Treffer gewinnt. */
const FLAGS: Record<string, Array<[string, string]>> = {
  psyche: [
    ['psy_erregt', 'erregt'],
    ['psy_aggr', 'aggressiv'],
    ['psy_verlangsamt', 'verlangsamt'],
    ['psy_depressiv', 'depressiv'],
    ['psy_aengstlich', 'aengstlich'],
    ['psy_euphorisch', 'euphorisch'],
    ['psy_wahnhaft', 'wahnhaft'],
    ['psy_verwirrt', 'verwirrt'],
    ['psy_suizidal', 'suizidal'],
    ['psy_motor_unruhig', 'motorisch_unruhig'],
  ],
  haut: [
    ['haut_unauff', 'unauffaellig'],
    ['haut_falten', 'stehende_hautfalten'],
    ['haut_oedeme', 'oedeme'],
    ['haut_dekubitus', 'dekubitus'],
    ['haut_kaltschweissig', 'kaltschweissig'],
    ['haut_exanthem', 'exantheme'],
  ],
  atmung: [
    ['atm_apnoe', 'apnoe'],
    ['atm_stridor', 'spastik'],
    ['atm_dyspnoe', 'ruhedyspnoe'],
    ['atm_zyanose', 'zyanose'],
  ],
  ekg: [
    ['sr', 'sinusrhythmus'],
  ],
  unfallmechanismus: [
    ['v_trauma_stumpf', 'stumpf'],
    ['v_trauma_penetr', 'penetrierend'],
  ],
  sturz: [
    ['v_sturz_eben', 'ebenerdig'],
    ['v_sturz_unter3m', 'unter_3m'],
    ['v_sturz_ueber3m', 'ab_3m'],
  ],
  unfallhergang: [
    ['v_vt_motorrad', 'motorradfahrer'],
    ['v_vt_fussgaenger', 'fussgaenger_angefahren'],
    ['v_vt_pkw', 'pkw_insasse'],
    ['v_vt_fahrrad', 'fahrrad'],
    ['v_vt_lkw', 'lkw_insasse'],
    ['v_vt_ebike', 'e_bike_pedelec'],
    ['v_vt_bus', 'bus_insasse'],
    ['v_vt_escooter', 'e_scooter'],
    ['v_gew_schlag', 'schlag'],
    ['v_gew_schuss', 'schuss'],
    ['v_gew_stich', 'stich'],
  ],
  spezielle_traumata: [
    ['v_inhalation', 'inhalationstrauma'],
    ['v_tauchunfall', 'tauchunfall'],
    ['v_elektrounfall', 'elektrounfall'],
    ['v_ertrinken', 'beinahe_ertrinken'],
    ['v_veraetzung', 'veraetzung'],
  ],
  beatmung_art: [
    ['beat_maschinell', 'kontrollierte_beatmung'],
  ],
  defi_art: [
    ['defi_mono', 'monophasisch'],
    ['defi_bi', 'biphasisch'],
  ],
}

/** Verletzungsregionen: alter Name → Feld des Bogens. */
const VERLETZUNGEN: Record<string, string> = {
  v_sht: 'verl_sht',
  v_gesicht: 'verl_gesicht',
  v_hals: 'verl_hws',
  v_thorax: 'verl_thorax',
  v_abdomen: 'verl_abdomen',
  v_ws: 'verl_bws_lws',
  v_becken: 'verl_becken',
  v_obext: 'verl_obere_extr',
  v_untext: 'verl_untere_extr',
  v_weich: 'verl_weichteile',
}

/**
 * Texte, die der Bogen nicht als eigenes Feld führt. Sie gehören in den
 * Anamnese-Block, nicht in den Papierkorb.
 */
const IN_DIE_ANAMNESE: Array<[string, string]> = [
  ['allergien', 'Allergien'],
  ['vorerkrankungen', 'Vorerkrankungen'],
  ['vormedikation_patient', 'Vormedikation'],
  ['verlaufsbeschreibung', 'Verlauf'],
  ['hausarzt', 'Hausarzt'],
  ['angehoeriger', 'Angehörige'],
]

function leer(wert: unknown): boolean {
  return wert === undefined || wert === null || wert === '' || wert === false
}

/**
 * Die gesetzten Optionen einer Flag-Liste.
 *
 * Bei Einfachwahl zaehlt der erste Treffer. Bei Mehrfachwahl muessen alle
 * mit: die alte Payload fuehrt Haut, Atmung und Psyche als einzelne
 * Schalter, von denen mehrere zugleich gesetzt sein koennen. Nur den ersten
 * zu nehmen hiesse, blass UND kaltschweissig auf blass zu verkuerzen.
 */
function gesetzteOptionen(payload: Payload, feldId: string, paare: Array<[string, string]>): unknown {
  const treffer = paare.filter(([flag]) => payload[flag]).map(([, option]) => option)
  if (treffer.length === 0) return undefined
  return aelrdFeld(feldId)?.typ === 'mehrfach' ? treffer : treffer[0]
}

/** Die Medikamentenliste in die Spalten des Bogens bringen. */
function medikationUmschreiben(payload: Payload): Payload[] | undefined {
  const roh = payload.medications
  if (!Array.isArray(roh)) return undefined
  return (roh as Payload[]).map((m) => ({
    zeit: m.time ?? '',
    wirkstoff: m.name ?? '',
    dosis: [m.dose, m.unit].filter(Boolean).join(' '),
    applikation: m.route ?? '',
  }))
}

/**
 * Ein Protokoll der App in die Felder des ÄLRD-Bogens übersetzen.
 * Unbekannte Felder bleiben unangetastet — sie schaden dem Ausdruck nicht
 * und gehen so auch nicht verloren.
 */
export function aelrdAusPayload(payload: Payload): Payload {
  const aus: Payload = {}

  for (const feld of GLEICH) {
    if (!leer(payload[feld])) aus[feld] = payload[feld]
  }

  for (const [alt, neu] of Object.entries(UMBENANNT)) {
    if (!leer(payload[alt]) && leer(aus[neu])) aus[neu] = payload[alt]
  }

  for (const [feld, paare] of Object.entries(FLAGS)) {
    const treffer = gesetzteOptionen(payload, feld, paare)
    if (treffer !== undefined && leer(aus[feld])) aus[feld] = treffer
  }

  for (const [alt, neu] of Object.entries(VERLETZUNGEN)) {
    if (!leer(payload[alt])) aus[neu] = payload[alt]
  }

  // Die GCS-Summe steht in der alten Payload nicht; sie ergibt sich aus den
  // drei Teilwerten. Ohne sie bliebe das auffaelligste Feld des Bogens leer.
  const e = Number(payload.gcs_e) || 0
  const v = Number(payload.gcs_v) || 0
  const m = Number(payload.gcs_m) || 0
  if (e + v + m > 0) aus.gcs_summe = e + v + m

  const meds = medikationUmschreiben(payload)
  if (meds && meds.length > 0) aus.medikation = meds

  // Was der Bogen nicht als Feld fuehrt, an die Anamnese anhaengen statt
  // es beim Drucken fallen zu lassen.
  const anhaenge = IN_DIE_ANAMNESE.filter(([feld]) => !leer(payload[feld])).map(
    ([feld, beschriftung]) => `${beschriftung}: ${String(payload[feld])}`,
  )
  if (anhaenge.length > 0) {
    const vorhanden = typeof aus.notfallgeschehen === 'string' ? aus.notfallgeschehen : ''
    aus.notfallgeschehen = [vorhanden, ...anhaenge].filter(Boolean).join('\n\n')
  }

  return aus
}

/** Welche Felder der Payload die Übersetzung nicht abbildet. */
export function nichtUebernommen(payload: Payload): string[] {
  const bekannt = new Set<string>([
    ...GLEICH,
    ...Object.keys(UMBENANNT),
    ...Object.values(FLAGS).flat().map(([flag]) => flag),
    ...Object.keys(VERLETZUNGEN),
    ...IN_DIE_ANAMNESE.map(([feld]) => feld),
    'medications', 'protokoll_version',
  ])
  return Object.keys(payload).filter((k) => !bekannt.has(k) && !leer(payload[k]))
}
