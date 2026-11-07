// Einstellung der Formulare in `organizations.form_config` (Bauplan v2, 3.1, 3.2).
//
// Jede Änderung liest den Stand frisch vom Server (am Service Worker vorbei,
// `frisch=1`, vite.config.ts) und wendet sie als Funktion darauf an. So
// überschreibt niemand, was ein anderer inzwischen gespeichert hat (nicht
// atomar, aber das Fenster schrumpft auf Millisekunden). Unbekannte Schlüssel
// bleiben unverändert erhalten.

import { pb } from '../pocketbase'
import { DEFAULT_FORM_CONFIG, type FormConfig } from '../../pages/public/formSchema'
import { jsonLesen, type AbsenderModus, type FormularId } from './absender'

const LISTEN = ['hidden_sections', 'hidden_fields', 'required_fields', 'custom_fields', 'hidden_forms'] as const

/**
 * `form_config` lesen: Objekt, Text oder doppelt kodierter Text; kaputt oder
 * leer ergibt die Voreinstellung. Listen, die keine Listen sind, ebenso;
 * alle anderen Schlüssel (auch unbekannte, etwa `absender`) bleiben, wie sie sind.
 */
export function formConfigLesen(roh: unknown): FormConfig {
  const w = jsonLesen(roh)
  const o = w && typeof w === 'object' && !Array.isArray(w) ? w as Record<string, unknown> : {}
  const aus: Record<string, unknown> = { ...o }
  for (const k of LISTEN) aus[k] = Array.isArray(o[k]) ? o[k] : [...(DEFAULT_FORM_CONFIG[k] as unknown[])]
  return aus as unknown as FormConfig
}

/**
 * `form_config` einer Organisation ändern, ohne fremde Änderungen zu
 * überschreiben: frisch lesen, `aendern` auf einer Kopie ausführen, speichern,
 * den gespeicherten Stand zurückgeben. Fehler gehen als Ausnahme an den
 * Aufrufer (Vorgänge zeigt sie mit `orgFehler`).
 */
export async function formConfigAendern(orgId: string, aendern: (cfg: FormConfig) => FormConfig): Promise<FormConfig> {
  const gelesen = await pb.collection('organizations').getOne(orgId, { fields: 'form_config', query: { frisch: '1' }, requestKey: null })
  const alt: FormConfig = { ...DEFAULT_FORM_CONFIG, ...formConfigLesen((gelesen as { form_config?: unknown }).form_config) }
  const neu = aendern(JSON.parse(JSON.stringify(alt)) as FormConfig)
  await pb.collection('organizations').update(orgId, { form_config: neu }, { requestKey: null })
  return neu
}

/** Den Absender-Modus eines Formulars setzen (für `formConfigAendern`); die anderen Formulare bleiben. */
export function absenderSetzen(cfg: FormConfig, formular: FormularId, modus: AbsenderModus): FormConfig {
  const bisher = cfg.absender && typeof cfg.absender === 'object' && !Array.isArray(cfg.absender) ? cfg.absender : {}
  return { ...cfg, absender: { ...bisher, [formular]: modus } }
}
