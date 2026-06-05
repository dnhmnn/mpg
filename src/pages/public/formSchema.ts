export interface FieldDef {
  id: string
  label: string
  canHide: boolean
  canRequire: boolean
}

export interface SectionDef {
  id: string
  title: string
  canHide: boolean
  fields: FieldDef[]
}

export interface CustomFieldDef {
  id: string
  sectionId: string
  label: string
  fieldType: 'text' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'textarea'
  options?: string[]
  required: boolean
}

export interface FormConfig {
  hidden_sections: string[]
  hidden_fields: string[]
  required_fields: string[]
  custom_fields: CustomFieldDef[]
}

export const DEFAULT_FORM_CONFIG: FormConfig = {
  hidden_sections: [],
  hidden_fields: [],
  required_fields: [],
  custom_fields: [],
}

// Maps sectionId → original step number (1-based)
export const SECTION_STEP_MAP: Record<string, number> = {
  mannschaft: 1, einsatzdaten: 2, zeitstrahl: 3, stammdaten: 4,
  anamnese: 5, naca: 6, gcs: 7, messwerte: 8, neurologie: 9,
  ekg: 10, haut_psyche: 11, erstdiagnose: 12, verlauf: 13,
  verletzungen: 14, atemwege: 15, beatmung: 16, zugang: 17,
  reanimation: 18, uebergabe: 19, unterschrift: 20,
}

export const ORGPATIENTEN_SCHEMA: SectionDef[] = [
  { id: 'mannschaft', title: 'Mannschaft', canHide: false, fields: [] },
  {
    id: 'einsatzdaten', title: 'Einsatzdaten', canHide: true,
    fields: [
      { id: 'einsatz_nr',    label: 'Einsatz-Nr.',          canHide: false, canRequire: true  },
      { id: 'auftrags_nr',   label: 'Auftrags-Nr. (ILS)',   canHide: true,  canRequire: false },
      { id: 'rufname',       label: 'Rufname',               canHide: true,  canRequire: false },
      { id: 'fahrzeug',      label: 'Fahrzeug / Einheit',    canHide: true,  canRequire: false },
      { id: 'einsatz_art',   label: 'Einsatzart / Stichwort',canHide: true,  canRequire: true  },
      { id: 'einsatz_adresse',label: 'Einsatzort / Adresse', canHide: true,  canRequire: true  },
      { id: 'transport_ziel',label: 'Transportziel',         canHide: true,  canRequire: false },
    ],
  },
  { id: 'zeitstrahl', title: 'Einsatz-Zeitstrahl', canHide: true, fields: [] },
  {
    id: 'stammdaten', title: 'Pat-Stammdaten', canHide: false,
    fields: [
      { id: 'name',         label: 'Name',         canHide: false, canRequire: false },
      { id: 'vorname',      label: 'Vorname',       canHide: false, canRequire: false },
      { id: 'gebdatum',     label: 'Geb.-Datum',    canHide: false, canRequire: false },
      { id: 'alter',        label: 'Alter',          canHide: true,  canRequire: false },
      { id: 'telefon',      label: 'Telefon',        canHide: true,  canRequire: false },
      { id: 'mobil',        label: 'Mobil',          canHide: true,  canRequire: false },
      { id: 'strasse',      label: 'Straße',         canHide: true,  canRequire: false },
      { id: 'plz_ort',      label: 'PLZ, Ort',       canHide: true,  canRequire: false },
      { id: 'kasse',        label: 'Kasse',          canHide: true,  canRequire: false },
      { id: 'versnr',       label: 'Vers.-Nr.',      canHide: true,  canRequire: false },
      { id: 'hausarzt',     label: 'Hausarzt',       canHide: true,  canRequire: false },
      { id: 'angehoeriger', label: 'Angehöriger',    canHide: true,  canRequire: false },
    ],
  },
  {
    id: 'anamnese', title: 'Notfallgeschehen / Anamnese', canHide: false,
    fields: [
      { id: 'notfallgeschehen',      label: 'Notfallgeschehen',              canHide: false, canRequire: false },
      { id: 'verlaufsbeschreibung',  label: 'Verlaufsbeschreibung',          canHide: true,  canRequire: false },
      { id: 'vorerkrankungen',       label: 'Vorerkrankungen',               canHide: true,  canRequire: false },
      { id: 'vormedikation_patient', label: 'Dauermedikation (Freitext)',    canHide: true,  canRequire: false },
      { id: 'allergien',             label: 'Allergien / Unverträglichkeiten',canHide: true, canRequire: false },
    ],
  },
  {
    id: 'naca', title: 'NACA / Bewusstsein / Verdachtsdiagnose', canHide: true,
    fields: [
      { id: 'naca',              label: 'NACA-Score',                   canHide: true, canRequire: false },
      { id: 'bewusstsein',       label: 'Bewusstsein',                  canHide: true, canRequire: false },
      { id: 'erstdiagnose_text', label: 'Verdachtsdiagnose / Erstdiagnose', canHide: true, canRequire: false },
    ],
  },
  { id: 'gcs',         title: 'Glasgow Coma Scale',                    canHide: true, fields: [] },
  {
    id: 'messwerte', title: 'Messwerte / Atmung', canHide: true,
    fields: [
      { id: 'rr_sys',  label: 'RR syst. (mmHg)',   canHide: true, canRequire: false },
      { id: 'rr_dia',  label: 'RR diast. (mmHg)',  canHide: true, canRequire: false },
      { id: 'hf',      label: 'HF (/min)',           canHide: true, canRequire: false },
      { id: 'af',      label: 'AF (/min)',            canHide: true, canRequire: false },
      { id: 'spo2',    label: 'SpO₂ (%)',             canHide: true, canRequire: false },
      { id: 'etco2',   label: 'etCO₂ (mmHg)',         canHide: true, canRequire: false },
      { id: 'temp',    label: 'Temperatur (°C)',       canHide: true, canRequire: false },
      { id: 'bz_mg',   label: 'BZ (mg/dl)',            canHide: true, canRequire: false },
      { id: 'schmerz', label: 'Schmerz (0–10)',        canHide: true, canRequire: false },
      { id: 'o2_flow', label: 'O₂ Flow (l/min)',       canHide: true, canRequire: false },
    ],
  },
  {
    id: 'neurologie', title: 'Neurologie', canHide: true,
    fields: [
      { id: 'neu_sonstige', label: 'Sonstige Neurologie',    canHide: true, canRequire: false },
      { id: 'neu_zeit',     label: 'Zeitpunkt Symptombeginn',canHide: true, canRequire: false },
    ],
  },
  {
    id: 'ekg', title: 'Rhythmus / EKG', canHide: true,
    fields: [
      { id: 'ekg_standort', label: 'EKG Standort', canHide: true, canRequire: false },
      { id: 'ekg_persnr',   label: 'EKG Pers-Nr.', canHide: true, canRequire: false },
    ],
  },
  { id: 'haut_psyche',  title: 'Haut / Psyche',                        canHide: true, fields: [] },
  { id: 'erstdiagnose', title: 'Erstdiagnose / Diagnose-Kategorien',    canHide: true, fields: [] },
  { id: 'verlauf',      title: 'Verlauf',                               canHide: true, fields: [] },
  {
    id: 'verletzungen', title: 'Verletzungen / Trauma', canHide: true,
    fields: [
      { id: 'v_verbrennung_grad', label: 'Verbrennung Grad',    canHide: true, canRequire: false },
      { id: 'v_verbrennung_pct',  label: 'Verbrennung %',       canHide: true, canRequire: false },
      { id: 'v_sonstige',         label: 'Sonstige Verletzungen',canHide: true, canRequire: false },
      { id: 'verletz_text',       label: 'Freitext Verletzungen',canHide: true, canRequire: false },
    ],
  },
  { id: 'atemwege',  title: 'Atemwege / Lagerung / Immobilisation', canHide: true, fields: [] },
  { id: 'beatmung',  title: 'Beatmung / Defibrillation',             canHide: true, fields: [] },
  {
    id: 'zugang', title: 'Zugang / Infusion / Medikamente', canHide: true,
    fields: [
      { id: 'zugang_art',    label: 'Zugang Art',       canHide: true, canRequire: false },
      { id: 'zugang_region', label: 'Zugang Region',    canHide: true, canRequire: false },
      { id: 'zugang_gauge',  label: 'Gauge',             canHide: true, canRequire: false },
      { id: 'inf_art',       label: 'Infusion Art',      canHide: true, canRequire: false },
      { id: 'inf_menge',     label: 'Infusion Menge (ml)',canHide: true, canRequire: false },
    ],
  },
  {
    id: 'reanimation', title: 'Reanimation', canHide: true,
    fields: [
      { id: 'rean_beginn', label: 'Beginn Reanimation', canHide: true, canRequire: false },
      { id: 'rean_ende',   label: 'Ende Reanimation',   canHide: true, canRequire: false },
      { id: 'rean_defib',  label: 'Defibrillationen',   canHide: true, canRequire: false },
    ],
  },
  {
    id: 'uebergabe', title: 'Übergabe / Besonderheiten', canHide: true,
    fields: [
      { id: 'uebergabe_ziel',  label: 'Übergabe Ziel',       canHide: true, canRequire: false },
      { id: 'uebergabe_name',  label: 'Übergabe an (Name)',   canHide: true, canRequire: false },
      { id: 'bemerkungen',     label: 'Bemerkungen',          canHide: true, canRequire: false },
    ],
  },
  {
    id: 'unterschrift', title: 'Unterschrift', canHide: false,
    fields: [
      { id: 'ausfueller_name', label: 'Name Ausfüller', canHide: true, canRequire: false },
    ],
  },
]
