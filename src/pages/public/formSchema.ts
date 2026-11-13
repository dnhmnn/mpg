// Einstellung der Formulare (`organizations.form_config`) und Vorlagen eigener Formulare.
//
// Patientendoku: fest (Plan Vorgänge, PO 2). `hidden_sections`, `hidden_fields`,
// `required_fields` und `custom_fields` bleiben im Datensatz stehen, niemand schreibt sie
// mehr; `custom_fields` beschriftet nur noch Werte alter Protokolle
// (src/lib/patientenAltfelder.ts). Produktausgabe, Defektmeldung und CIRS lassen sich je
// Organisation anpassen: `formulare.<formular>` (Plan 1.2), gelesen immer über
// standardKonfig (src/lib/formular/felder.ts), geschrieben über standardSetzen
// (src/lib/formular/einstellung.ts).

import type { AbsenderModus, FormularId } from '../../lib/formular/absender'
import type { Abschnitt, FeldDef, FeldTyp, StandardFormular, StandardKonfig, VorlageModus } from '../../lib/formular/felder'

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
  hidden_forms: string[]
  /** Absender je Formular (Bauplan v2, 3.1); fehlt er, gilt ABSENDER_VOREINSTELLUNG (src/lib/formular/absender.ts). */
  absender?: Partial<Record<FormularId, AbsenderModus>>
  /** Anpassungen der Standardformulare (Plan Vorgänge 1.2); lesen nur über standardKonfig. */
  formulare?: Partial<Record<StandardFormular, StandardKonfig>>
}

export const DEFAULT_FORM_CONFIG: FormConfig = {
  hidden_sections: [],
  hidden_fields: [],
  required_fields: [],
  custom_fields: [],
  hidden_forms: [],
}

/**
 * Ein Feld im `schema` einer Vorlage (form_templates). Neue Form: FeldDef (Plan 1.1);
 * dazu spiegeln Hook und App die alten Schlüssel (`fieldType`, `required`, `hint`,
 * `options`), damit alte Seiten weiter rendern. Alte Vorlagen haben nur die alten
 * Schlüssel. Lesen immer über schemaLesen (felder.ts).
 */
export type TemplateFieldDef = Partial<FeldDef> & {
  id: string
  label?: string
  fieldType?: 'text' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'checkbox'
  options?: string[]
  required?: boolean
  hint?: string
}

/** Eine Vorlage (form_templates). Felder nach `is_active` dürfen in PocketBase fehlen (Einführung, Plan 1.6). */
export interface FormTemplate {
  id: string
  organization_id: string
  title: string
  description: string
  /** Liste der Felder; als JSON auch Text oder doppelt kodiert möglich. */
  schema: TemplateFieldDef[] | string | null
  is_active: boolean
  /** passwort, frei oder anonym; fehlt oder unbekannt: frei. */
  absender?: VorlageModus | string
  archiviert?: boolean
  abschnitte?: Abschnitt[] | string | null
  /** Nur der Hook setzt sie. */
  version?: number
  fassungen?: unknown
  created: string
  updated: string
}

/** Feldarten der alten Vorlagen, wie die alten Seiten sie lesen (Spiegel der neuen). */
export const ALT_FELDART: Record<FeldTyp, NonNullable<TemplateFieldDef['fieldType']>> = {
  text: 'text', langtext: 'textarea', zahl: 'number', datum: 'date', uhrzeit: 'time', auswahl: 'select', mehrfach: 'text', janein: 'checkbox',
}

// Maps sectionId → original step number (1-based)
export const SECTION_STEP_MAP: Record<string, number> = {
  mannschaft: 1, einsatzdaten: 2, zeitstrahl: 3, stammdaten: 4,
  anamnese: 5, naca: 6, gcs: 7, messwerte: 8, neurologie: 9,
  ekg: 10, haut_psyche: 11, erstdiagnose: 12, verlauf: 13,
  verletzungen: 14, atemwege: 15, beatmung: 16, zugang: 17,
  reanimation: 18, uebergabe: 19, unterschrift: 20,
}
