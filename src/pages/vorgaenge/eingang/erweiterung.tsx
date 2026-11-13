// Erweiterung I der Vorgänge-Schale (Bauplan Vorgänge, 3.8, 3.11): Reiter „Eingang“
// mit der Zahl der neuen Einsendungen, dazu die Seiten `eingang` (Einsendungen eines
// Formulars) und `einsendung` (eine Einsendung). Der Abschluss trägt ERWEITERUNG_I
// in src/pages/vorgaenge/erweiterung.ts ein.

import type { VgErweiterung } from '../erweiterung'
import { vorgaengeVoll } from '../logik'
import { EINGANG_TEXTE } from '../../../lib/formular/eingang'
import EingangReiter from './EingangReiter'
import EinsendungenSeite from './EinsendungenSeite'
import EinsendungSeite from './EinsendungSeite'
import { useNeuZahl } from './useEingang'

export const ERWEITERUNG_I: VgErweiterung = {
  reiter: {
    key: 'eingang',
    label: EINGANG_TEXTE.reiter,
    zeigen: (k) => vorgaengeVoll(k),
    useZahl: useNeuZahl,
    Inhalt: EingangReiter,
  },
  seiten: {
    eingang: EinsendungenSeite,
    einsendung: EinsendungSeite,
  },
}
