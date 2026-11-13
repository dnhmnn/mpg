// Erweiterungen der Vorgänge-Schale (Bauplan Vorgänge, 3.11, F14).
//
// E (eigene Formulare, Feld-Editor) und I (Eingang) liefern je eine
// Erweiterung aus src/pages/vorgaenge/eigene/erweiterung.tsx und
// src/pages/vorgaenge/eingang/erweiterung.tsx; beide stehen in ERWEITERUNGEN.
// Die Erweiterungen importieren aus dieser Datei nur Typen, ein Kreis zur
// Laufzeit entsteht nicht.
//
// Was die Schale daraus macht:
// - `Formulare`: im Reiter Formulare nach „Standardformulare“, nur mit Modul
//   und Recht Vorgänge. Rendert seine Überschrift (Abschnitt) selbst.
// - `StandardAbschnitt`: auf der Seite eines anpassbaren Standardformulars
//   unter der Überschrift „Felder“, für alle, die die Seite sehen; ohne
//   `k.darfEinstellen` nur zum Ansehen. Die Patientendoku hat keinen (PO 2).
// - `reiter`: ein Reiter zwischen Formulare und CIRS, nur mit Modul und Recht
//   Vorgänge und wenn `zeigen(k)` true ist. `useZahl` ruft die Schale bei
//   jedem Rendern auf, in der festen Folge dieser Liste (die Liste ist konstant,
//   also regelkonform); die Zahl steht am Reiter, 0 heißt keine Zahl. Sie ruft
//   es auch ohne Recht oder Modul Vorgänge und auf Unterseiten auf: Dann gibt
//   `useZahl` 0 zurück und abonniert nichts (vorgaengeVoll(k) aus ./logik).
// - `seiten`: ganze Seiten unter `?seite=<name>&id=<id>`. Jede Seite rendert ihre
//   eigene <Seite …> (Bausteine) und prüft ihre Rechte selbst. Namen: E `felder`,
//   `feld`, `vorlage`, `vorlage-feld`, `vorlage-abschnitt`, `vorschau`; I
//   `eingang`, `einsendung` (weitere mit Präfix `cirs-`). `formular` gehört der
//   Schale und lässt sich nicht überschreiben.
//
// Den Knopf „Neues Formular“ im Kopf zeigt die Schale nur, wenn es die Seite
// `vorlage` gibt.

import type { ComponentType } from 'react'
import type { VgKontext } from './kontext'
import type { StandardFormular } from './logik'
import { ERWEITERUNG_E } from './eigene/erweiterung'
import { ERWEITERUNG_I } from './eingang/erweiterung'

export type { StandardFormular } from './logik'

export interface VgReiter {
  key: string
  label: string
  zeigen: (k: VgKontext) => boolean
  useZahl?: (k: VgKontext) => number
  Inhalt: ComponentType<{ k: VgKontext }>
}

export interface VgErweiterung {
  /** E: Abschnitt „Eigene Formulare“ im Reiter Formulare. */
  Formulare?: ComponentType<{ k: VgKontext }>
  /** E: „Felder“ auf der Seite eines Standardformulars (Produktausgabe, Defektmeldung, CIRS). */
  StandardAbschnitt?: ComponentType<{ k: VgKontext; formular: StandardFormular }>
  /** I: Reiter Eingang. */
  reiter?: VgReiter
  /** Ganze Seiten unter `?seite=<name>`. */
  seiten?: Record<string, ComponentType<{ k: VgKontext; id?: string }>>
}

export const ERWEITERUNGEN: VgErweiterung[] = [ERWEITERUNG_E, ERWEITERUNG_I]
