// Erweiterung E der Vorgänge-Schale (Bauplan Vorgänge, 3.6, 3.7, 3.11): Abschnitt „Eigene
// Formulare“ im Reiter Formulare, der Abschnitt „Felder“ auf der Seite eines anpassbaren
// Standardformulars und die Seiten des Feld-Editors und des Baukastens. Der Abschluss trägt
// ERWEITERUNG_E in src/pages/vorgaenge/erweiterung.ts ein.
//
// Seiten (`?seite=<name>&id=<id>`):
// - `felder`             Felder eines Standardformulars (`id` = produktausgabe, defektmeldung, cirs)
// - `feld`               ein Feld davon (`<formular>:<kennung>`, neu `<formular>:neu`)
// - `vorlage`            ein eigenes Formular (ohne `id` neu)
// - `vorlage-feld`       ein Feld im Baukasten (`<vorlage>:<feld>`, neu `<vorlage>:neu[.<abschnitt>]`)
// - `vorlage-abschnitt`  ein Abschnitt im Baukasten (`<vorlage>:<abschnitt>`, neu `<vorlage>:neu`)
// - `vorschau`           Vorschau (`<formular>` oder `vorlage:<vorlage>`)

import type { VgErweiterung } from '../erweiterung'
import AbschnittSeite from './AbschnittSeite'
import EigeneListe from './EigeneListe'
import FeldSeite from './FeldSeite'
import FelderSeite, { StandardFelder } from './FelderSeite'
import VorlageFeldSeite from './VorlageFeldSeite'
import VorlageSeite from './VorlageSeite'
import VorschauSeite from './VorschauSeite'

export const ERWEITERUNG_E: VgErweiterung = {
  Formulare: EigeneListe,
  StandardAbschnitt: StandardFelder,
  seiten: {
    felder: FelderSeite,
    feld: FeldSeite,
    vorlage: VorlageSeite,
    'vorlage-feld': VorlageFeldSeite,
    'vorlage-abschnitt': AbschnittSeite,
    vorschau: VorschauSeite,
  },
}
