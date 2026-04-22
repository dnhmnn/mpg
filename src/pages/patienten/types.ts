export interface VitalRow {
  zeit: string
  rr_sys: string; rr_dia: string; hf: string; spo2: string
  af: string; temp: string; bz: string; etco2: string; schmerz: string
  bemerkung: string
}

export interface Medication {
  name: string
  dose: string
  unit: string
  route: string
  time: string
  note: string
}

export interface PatientPayload {
  einsatz_nr?: string; auftrags_nr?: string; rufname?: string; fahrzeug?: string
  zeit_einsatz?: string; einsatz_art?: string
  einsatz_adresse?: string
  zeit_eintreffen?: string; zeit_transport?: string; zeit_uebergabe?: string
  transport_ziel?: string
  name?: string; vorname?: string; gebdatum?: string; alter?: string
  telefon?: string; mobil?: string; strasse?: string; plz_ort?: string
  kasse?: string; versnr?: string; hausarzt?: string; angehoeriger?: string; infos?: string
  allergien?: string; vorerkrankungen?: string; vormedikation_patient?: string
  notfallgeschehen?: string; verlaufsbeschreibung?: string
  naca?: string
  bewusstsein?: string
  neu_zeit?: string; neu_unauff?: boolean
  pw_r?: string; pw_l?: string; pw_r_entrundet?: boolean; pw_l_entrundet?: boolean
  lr_r?: string; lr_l?: string
  gcs_e?: number; gcs_v?: number; gcs_m?: number
  haut_unauff?: boolean; haut_falten?: boolean; haut_oedeme?: boolean
  haut_dekubitus?: boolean; haut_kaltschweissig?: boolean; haut_exanthem?: boolean
  psy_erregt?: boolean; psy_aggr?: boolean; psy_verlangsamt?: boolean
  psy_depressiv?: boolean; psy_aengstlich?: boolean; psy_euphorisch?: boolean
  psy_wahnhaft?: boolean; psy_verwirrt?: boolean; psy_suizidal?: boolean; psy_motor_unruhig?: boolean
  rr_sys?: string; rr_dia?: string; af?: string; temp?: string
  hf?: string; spo2?: string; bz_mg?: string; schmerz?: string; etco2?: string
  atm_apnoe?: boolean; atm_stridor?: boolean; atm_dyspnoe?: boolean; atm_zyanose?: boolean
  o2?: boolean; o2_nasal?: boolean; o2_maske?: boolean; o2_reservoir?: boolean; o2_flow?: string
  awm_freihalten?: boolean; awm_absaugung?: boolean; awm_opa?: boolean
  awm_npa?: boolean; awm_lma?: boolean; awm_intubation?: boolean
  sr?: boolean; stemi?: boolean; vf?: boolean; asystole?: boolean
  ekg_standort?: string; ekg_persnr?: string
  diag_krampf?: boolean; diag_synkope?: boolean; diag_apoplex?: boolean; diag_sht?: boolean
  diag_acs?: boolean; diag_insuff?: boolean; diag_hypo?: boolean; diag_resp_insuff?: boolean
  lag_flach?: boolean; lag_schock?: boolean; lag_ok_hoch?: boolean
  lag_ssl?: boolean; lag_sitzend?: boolean; lag_haengend?: boolean
  rean?: boolean; rean_beginn?: string; rean_ende?: string; rean_defib?: string
  immo_hws?: boolean; immo_spineboard?: boolean; immo_vakuum?: boolean
  verlauf?: VitalRow[]
  medications?: Medication[]
  zugang_art?: string; zugang_gauge?: string; zugang_region?: string
  inf_art?: string; inf_menge?: string
  verletz_text?: string
  signature?: string; photos?: string[]
}

export interface Patient {
  id: string; status: string; title?: string
  payload: PatientPayload
  admin_name?: string; admin_datum?: string; admin_unterschrift?: string
  organization_id: string; created: string; updated: string
}

export interface Nacherfassung {
  id: string; status: string; organization_id: string
  datum_alarmzeit?: string; datum_einsatzende?: string
  stichwort?: string; kategorie?: string; einsatznummer_ils?: string
  meldebild?: string; adresse?: string
  disponierte_em_fw?: string; disponierte_em_rd?: string
  patienten_daten_erhoben?: boolean
  patient_name?: string; patient_alter_geburtsdatum?: string; patient_nummer_ils?: string
  sachverhalt?: string
  protokollpflichtig?: boolean; protokollpflichtig_begruendung?: string
  verantwortlicher_unterwiesen?: boolean; verantwortlicher_name?: string; verantwortlicher_qualifikation?: string
  nacherfasst_von_name?: string; nacherfasst_von_qualifikation?: string
  nacherfasst_datum?: string; nacherfasst_unterschrift?: string
  created: string
}

export interface NachForm {
  datum_alarmzeit: string; datum_einsatzende: string; stichwort: string; kategorie: string
  einsatznummer_ils: string; meldebild: string; adresse: string
  disponierte_em_fw: string; disponierte_em_rd: string
  patienten_daten_erhoben: string
  patient_name: string; patient_alter_geburtsdatum: string; patient_nummer_ils: string
  sachverhalt: string
  protokollpflichtig: string; protokollpflichtig_begruendung: string
  verantwortlicher_unterwiesen: string; verantwortlicher_name: string; verantwortlicher_qualifikation: string
  nacherfasst_von_name: string; nacherfasst_von_qualifikation: string
}

export const EMPTY_PAYLOAD: PatientPayload = {
  einsatz_nr: '', auftrags_nr: '', rufname: '', fahrzeug: '', zeit_einsatz: '', einsatz_art: '',
  einsatz_adresse: '', zeit_eintreffen: '', zeit_transport: '', zeit_uebergabe: '', transport_ziel: '',
  name: '', vorname: '', gebdatum: '', alter: '', telefon: '', mobil: '',
  strasse: '', plz_ort: '', kasse: '', versnr: '', hausarzt: '', angehoeriger: '', infos: '',
  allergien: '', vorerkrankungen: '', vormedikation_patient: '',
  notfallgeschehen: '', verlaufsbeschreibung: '', naca: '', bewusstsein: '',
  neu_zeit: '', neu_unauff: false,
  pw_r: 'mittel', pw_l: 'mittel', pw_r_entrundet: false, pw_l_entrundet: false,
  lr_r: 'prompt', lr_l: 'prompt',
  gcs_e: 4, gcs_v: 5, gcs_m: 6,
  haut_unauff: false, haut_falten: false, haut_oedeme: false,
  haut_dekubitus: false, haut_kaltschweissig: false, haut_exanthem: false,
  psy_erregt: false, psy_aggr: false, psy_verlangsamt: false, psy_depressiv: false,
  psy_aengstlich: false, psy_euphorisch: false, psy_wahnhaft: false, psy_verwirrt: false,
  psy_suizidal: false, psy_motor_unruhig: false,
  rr_sys: '', rr_dia: '', af: '', temp: '', hf: '', spo2: '', bz_mg: '', schmerz: '', etco2: '',
  atm_apnoe: false, atm_stridor: false, atm_dyspnoe: false, atm_zyanose: false,
  o2: false, o2_nasal: false, o2_maske: false, o2_reservoir: false, o2_flow: '',
  awm_freihalten: false, awm_absaugung: false, awm_opa: false,
  awm_npa: false, awm_lma: false, awm_intubation: false,
  sr: false, stemi: false, vf: false, asystole: false, ekg_standort: '', ekg_persnr: '',
  diag_krampf: false, diag_synkope: false, diag_apoplex: false, diag_sht: false,
  diag_acs: false, diag_insuff: false, diag_hypo: false, diag_resp_insuff: false,
  lag_flach: false, lag_schock: false, lag_ok_hoch: false,
  lag_ssl: false, lag_sitzend: false, lag_haengend: false,
  rean: false, rean_beginn: '', rean_ende: '', rean_defib: '',
  immo_hws: false, immo_spineboard: false, immo_vakuum: false,
  verlauf: [],
  medications: [],
  zugang_art: '', zugang_gauge: '', zugang_region: '',
  inf_art: '', inf_menge: '',
  verletz_text: '', signature: '', photos: []
}

export const EMPTY_NACH: NachForm = {
  datum_alarmzeit: '', datum_einsatzende: '', stichwort: '', kategorie: '',
  einsatznummer_ils: '', meldebild: '', adresse: '',
  disponierte_em_fw: '', disponierte_em_rd: '',
  patienten_daten_erhoben: 'nein',
  patient_name: '', patient_alter_geburtsdatum: '', patient_nummer_ils: '',
  sachverhalt: '',
  protokollpflichtig: 'nein', protokollpflichtig_begruendung: '',
  verantwortlicher_unterwiesen: 'ja', verantwortlicher_name: '', verantwortlicher_qualifikation: '',
  nacherfasst_von_name: '', nacherfasst_von_qualifikation: ''
}

export function parsePayload(p: unknown): PatientPayload {
  if (!p) return { ...EMPTY_PAYLOAD }
  if (typeof p === 'string') { try { return { ...EMPTY_PAYLOAD, ...JSON.parse(p) } } catch { return { ...EMPTY_PAYLOAD } } }
  return { ...EMPTY_PAYLOAD, ...(p as PatientPayload) }
}

export function calcGCS(p: PatientPayload): number | string {
  const t = (p.gcs_e || 0) + (p.gcs_v || 0) + (p.gcs_m || 0)
  return t > 0 ? t : '—'
}

export function fmtDate(s?: string): string {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('de-DE')
}

export function fmtDateTime(s?: string): string {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('de-DE')
}
