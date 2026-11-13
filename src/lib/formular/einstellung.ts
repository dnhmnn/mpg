// Einstellung der Formulare in `organizations.form_config` (Bauplan v2, 3.1, 3.2;
// anpassbare Standardformulare: Plan Vorgänge 1.2, `standardSetzen`).
//
// Jede Änderung liest den Stand frisch vom Server (am Service Worker vorbei,
// `frisch=1`, vite.config.ts) und wendet sie als Funktion darauf an. So
// überschreibt niemand, was ein anderer inzwischen gespeichert hat (nicht
// atomar, aber das Fenster schrumpft auf Millisekunden). Unbekannte Schlüssel
// bleiben unverändert erhalten.

import { pb } from '../pocketbase'
import { DEFAULT_FORM_CONFIG, type FormConfig } from '../../pages/public/formSchema'
import { jsonLesen, type AbsenderModus, type FormularId } from './absender'
import { standardKonfig, type StandardFormular, type StandardKonfig } from './felder'

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

// ── Anpassbare Standardformulare (Plan Vorgänge 1.2, 3.6) ────────────────────

/**
 * Was an einer Einstellung die Prüfung der Werte ändert: die eigenen Felder ohne
 * Bezeichnung und Hilfetext (Anlegen, Löschen, Art, Optionen, Pflicht, aus, Grenzen)
 * und `aus`/`pflicht` der Kernfelder. Bezeichnung, Hilfetext und Reihenfolge zählen nicht.
 */
function pruefStand(k: StandardKonfig): string {
  const eigene = k.eigene.map((d) => {
    const x: Record<string, unknown> = { ...d }
    delete x.label
    delete x.hilfe
    return x
  })
  const kern: Record<string, { aus?: boolean; pflicht?: boolean }> = {}
  for (const id of Object.keys(k.felder).sort()) {
    const e = k.felder[id]
    const x: { aus?: boolean; pflicht?: boolean } = {}
    if (typeof e.aus === 'boolean') x.aus = e.aus
    if (typeof e.pflicht === 'boolean') x.pflicht = e.pflicht
    if (Object.keys(x).length) kern[id] = x
  }
  return JSON.stringify({ eigene, kern })
}

/**
 * Die Einstellung eines Standardformulars ändern (für `formConfigAendern`): lesen über
 * standardKonfig, `aendern` auf einer Kopie, Ergebnis wieder normalisiert (Unzulässiges
 * fällt weg). `version` zählt um eins hoch, wenn sich an der Prüfung der Werte etwas
 * ändert (pruefStand); Bezeichnung, Hilfetext und Reihenfolge lassen sie stehen. Die
 * anderen Formulare und alle anderen Schlüssel bleiben, wie sie sind.
 */
export function standardSetzen(cfg: FormConfig, f: StandardFormular, aendern: (k: StandardKonfig) => StandardKonfig): FormConfig {
  const alt = standardKonfig(cfg, f)
  const roh = aendern(JSON.parse(JSON.stringify(alt)) as StandardKonfig)
  // Nachsichtig lesen wie der Server: was nicht passt, fällt hier schon weg
  const neu = standardKonfig({ formulare: { [f]: roh } }, f)
  neu.version = pruefStand(neu) === pruefStand(alt) ? alt.version : alt.version + 1
  const bisher = cfg.formulare && typeof cfg.formulare === 'object' && !Array.isArray(cfg.formulare) ? cfg.formulare : {}
  return { ...cfg, formulare: { ...bisher, [f]: neu } }
}
