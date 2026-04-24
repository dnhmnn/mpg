export interface VitalRow {
  zeit: string
  rr_sys: string; rr_dia: string; hf: string; spo2: string
  af: string; temp: string; bz: string; etco2: string; schmerz: string
  o2: string
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
  neu_sprachstoerung?: boolean; neu_demenz?: boolean; neu_meningismus?: boolean
  neu_seitenzeichen?: boolean; neu_kein_laecheln?: boolean; neu_sehstoerung?: boolean
  neu_querschnitt?: boolean; neu_babinski?: boolean; neu_vorbestehend?: boolean; neu_sonstige?: string
  ext_r_arm?: string; ext_l_arm?: string; ext_r_bein?: string; ext_l_bein?: string
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
  erstdiagnose_text?: string
  lag_flach?: boolean; lag_schock?: boolean; lag_ok_hoch?: boolean
  lag_ssl?: boolean; lag_sitzend?: boolean; lag_haengend?: boolean
  rean?: boolean; rean_beginn?: string; rean_ende?: string; rean_defib?: string
  immo_hws?: boolean; immo_spineboard?: boolean; immo_vakuum?: boolean
  verlauf?: VitalRow[]
  medications?: Medication[]
  zugang_art?: string; zugang_gauge?: string; zugang_region?: string
  zugang_peripher?: boolean; zugang_intraossar?: boolean; zugang_transnasal?: boolean; zugang_erschwert?: boolean
  inf_art?: string; inf_menge?: string
  verletz_text?: string
  v_keine?: boolean
  v_sht?: string; v_gesicht?: string; v_hals?: string; v_thorax?: string; v_abdomen?: string
  v_ws?: string; v_becken?: string; v_obext?: string; v_untext?: string; v_weich?: string
  v_verbrennung?: boolean; v_verbrennung_grad?: string; v_verbrennung_pct?: string
  v_veraetzung?: boolean; v_verschuettung?: boolean; v_einklemmung?: boolean
  v_inhalation?: boolean; v_elektrounfall?: boolean; v_ertrinken?: boolean
  v_tauchunfall?: boolean; v_haemo_schock?: boolean; v_sonstige?: string
  v_trauma_stumpf?: boolean; v_trauma_penetr?: boolean
  v_sturz_eben?: boolean; v_sturz_unter3m?: boolean; v_sturz_ueber3m?: boolean
  v_vt_fussgaenger?: boolean; v_vt_escooter?: boolean; v_vt_fahrrad?: boolean
  v_vt_ebike?: boolean; v_vt_motorrad?: boolean; v_vt_pkw?: boolean
  v_vt_lkw?: boolean; v_vt_bus?: boolean
  v_gew_schlag?: boolean; v_gew_schuss?: boolean; v_gew_stich?: boolean
  v_gew_sonstige?: boolean; v_gew_verbrechen?: boolean
  e_keine?: boolean
  e_zns_schlaganfall?: boolean; e_zns_tia?: boolean; e_zns_blutung?: boolean; e_zns_lyse?: boolean
  e_zns_krampf?: boolean; e_zns_status_epilept?: boolean; e_zns_meningitis?: boolean; e_zns_synkope?: boolean; e_zns_sonstige?: boolean
  e_hk_acs?: boolean; e_hk_stemi_vw?: boolean; e_hk_stemi_hw?: boolean
  e_hk_tachy?: boolean; e_hk_brady?: boolean; e_hk_embolie?: boolean
  e_hk_ortho?: boolean; e_hk_insuff?: boolean; e_hk_hypert?: boolean
  e_hk_kard_schock?: boolean; e_hk_schrittmacher?: boolean; e_hk_sonstige?: boolean
  e_atm_asthma?: boolean; e_atm_status_asthm?: boolean; e_atm_copd?: boolean
  e_atm_pneumonie?: boolean; e_atm_hypervent?: boolean; e_atm_aspiration?: boolean
  e_atm_haemoptysen?: boolean; e_atm_sonstige?: boolean
  e_abd_akut?: boolean; e_abd_gi_ob?: boolean; e_abd_gi_un?: boolean
  e_abd_kolik?: boolean; e_abd_enteritis?: boolean; e_abd_sonstige?: boolean
  e_psy_psychose?: boolean; e_psy_angst?: boolean
  e_psy_intox_akzid?: boolean; e_psy_intox_alkohol?: boolean; e_psy_intox_drogen?: boolean
  e_psy_intox_medis?: boolean; e_psy_intox_sonstige?: boolean
  e_psy_entzug?: boolean; e_psy_suizid?: boolean; e_psy_krise?: boolean; e_psy_sonstige?: boolean
  e_stw_hypo?: boolean; e_stw_hyper?: boolean; e_stw_exsiccose?: boolean
  e_stw_uraemie?: boolean; e_stw_sonstige?: boolean
  e_paed_fieberkrampf?: boolean; e_paed_pseudokrupp?: boolean; e_paed_sids?: boolean
  e_gyn_schwanger?: boolean; e_gyn_geburt?: boolean; e_gyn_eklampsie?: boolean
  e_gyn_blutung?: boolean; e_gyn_sonstige?: boolean
  e_anaphylaxie?: boolean; e_hitze?: boolean; e_unterkuehlung?: boolean
  e_sepsis?: boolean; e_influenza?: boolean; e_hepatitis_hiv?: boolean
  e_lumbago?: boolean; e_epistaxis?: boolean; e_soziales?: boolean
  e_behandlungskompl?: boolean; e_weitere_sonstige?: boolean
  // Beatmung
  beat_manuell?: boolean; beat_maschinell?: boolean; beat_niv?: boolean; beat_notfallnarkose?: boolean
  beat_fio2?: string; beat_af?: string; beat_peep?: string; beat_pmax?: string; beat_amv?: string
  // Defibrillation
  defi_aed?: boolean; defi_defi?: boolean; defi_mono?: boolean; defi_bi?: boolean
  defi_erstanw_laie?: boolean; defi_erstanw_fr?: boolean; defi_erstanw_rd?: boolean; defi_erstanw_arzt?: boolean
  defi_zeitpunkt?: string; defi_rosc?: string; defi_anzahl?: string; defi_energie?: string
  // Übergabe
  uebergabe_ziel?: string
  uebergabe_name?: string
  bemerkungen?: string
  // Einsatzverlauf Besonderheiten
  ev_transport_sondersignal?: boolean; ev_zwangseinweisung?: boolean; ev_transportverweigerung?: boolean
  ev_nur_untersuchung?: boolean; ev_manv?: boolean; ev_lna?: boolean; ev_schwerlast?: boolean
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
  neu_sprachstoerung: false, neu_demenz: false, neu_meningismus: false,
  neu_seitenzeichen: false, neu_kein_laecheln: false, neu_sehstoerung: false,
  neu_querschnitt: false, neu_babinski: false, neu_vorbestehend: false, neu_sonstige: '',
  ext_r_arm: '', ext_l_arm: '', ext_r_bein: '', ext_l_bein: '',
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
  erstdiagnose_text: '',
  lag_flach: false, lag_schock: false, lag_ok_hoch: false,
  lag_ssl: false, lag_sitzend: false, lag_haengend: false,
  rean: false, rean_beginn: '', rean_ende: '', rean_defib: '',
  immo_hws: false, immo_spineboard: false, immo_vakuum: false,
  verlauf: [],
  medications: [],
  zugang_art: '', zugang_gauge: '', zugang_region: '',
  zugang_peripher: false, zugang_intraossar: false, zugang_transnasal: false, zugang_erschwert: false,
  inf_art: '', inf_menge: '',
  verletz_text: '',
  v_keine: false,
  v_sht: '', v_gesicht: '', v_hals: '', v_thorax: '', v_abdomen: '',
  v_ws: '', v_becken: '', v_obext: '', v_untext: '', v_weich: '',
  v_verbrennung: false, v_verbrennung_grad: '', v_verbrennung_pct: '',
  v_veraetzung: false, v_verschuettung: false, v_einklemmung: false,
  v_inhalation: false, v_elektrounfall: false, v_ertrinken: false,
  v_tauchunfall: false, v_haemo_schock: false, v_sonstige: '',
  v_trauma_stumpf: false, v_trauma_penetr: false,
  v_sturz_eben: false, v_sturz_unter3m: false, v_sturz_ueber3m: false,
  v_vt_fussgaenger: false, v_vt_escooter: false, v_vt_fahrrad: false,
  v_vt_ebike: false, v_vt_motorrad: false, v_vt_pkw: false,
  v_vt_lkw: false, v_vt_bus: false,
  v_gew_schlag: false, v_gew_schuss: false, v_gew_stich: false,
  v_gew_sonstige: false, v_gew_verbrechen: false,
  e_keine: false,
  e_zns_schlaganfall: false, e_zns_tia: false, e_zns_blutung: false, e_zns_lyse: false,
  e_zns_krampf: false, e_zns_status_epilept: false, e_zns_meningitis: false, e_zns_synkope: false, e_zns_sonstige: false,
  e_hk_acs: false, e_hk_stemi_vw: false, e_hk_stemi_hw: false,
  e_hk_tachy: false, e_hk_brady: false, e_hk_embolie: false,
  e_hk_ortho: false, e_hk_insuff: false, e_hk_hypert: false,
  e_hk_kard_schock: false, e_hk_schrittmacher: false, e_hk_sonstige: false,
  e_atm_asthma: false, e_atm_status_asthm: false, e_atm_copd: false,
  e_atm_pneumonie: false, e_atm_hypervent: false, e_atm_aspiration: false,
  e_atm_haemoptysen: false, e_atm_sonstige: false,
  e_abd_akut: false, e_abd_gi_ob: false, e_abd_gi_un: false,
  e_abd_kolik: false, e_abd_enteritis: false, e_abd_sonstige: false,
  e_psy_psychose: false, e_psy_angst: false,
  e_psy_intox_akzid: false, e_psy_intox_alkohol: false, e_psy_intox_drogen: false,
  e_psy_intox_medis: false, e_psy_intox_sonstige: false,
  e_psy_entzug: false, e_psy_suizid: false, e_psy_krise: false, e_psy_sonstige: false,
  e_stw_hypo: false, e_stw_hyper: false, e_stw_exsiccose: false,
  e_stw_uraemie: false, e_stw_sonstige: false,
  e_paed_fieberkrampf: false, e_paed_pseudokrupp: false, e_paed_sids: false,
  e_gyn_schwanger: false, e_gyn_geburt: false, e_gyn_eklampsie: false,
  e_gyn_blutung: false, e_gyn_sonstige: false,
  e_anaphylaxie: false, e_hitze: false, e_unterkuehlung: false,
  e_sepsis: false, e_influenza: false, e_hepatitis_hiv: false,
  e_lumbago: false, e_epistaxis: false, e_soziales: false,
  e_behandlungskompl: false, e_weitere_sonstige: false,
  beat_manuell: false, beat_maschinell: false, beat_niv: false, beat_notfallnarkose: false,
  beat_fio2: '', beat_af: '', beat_peep: '', beat_pmax: '', beat_amv: '',
  defi_aed: false, defi_defi: false, defi_mono: false, defi_bi: false,
  defi_erstanw_laie: false, defi_erstanw_fr: false, defi_erstanw_rd: false, defi_erstanw_arzt: false,
  defi_zeitpunkt: '', defi_rosc: '', defi_anzahl: '', defi_energie: '',
  uebergabe_ziel: '', uebergabe_name: '', bemerkungen: '',
  ev_transport_sondersignal: false, ev_zwangseinweisung: false, ev_transportverweigerung: false,
  ev_nur_untersuchung: false, ev_manv: false, ev_lna: false, ev_schwerlast: false,
  signature: '', photos: []
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
