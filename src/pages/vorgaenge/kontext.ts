// Was jede Seite unter Vorgänge von der Schale (src/pages/Vorgaenge.tsx) bekommt
// (Bauplan Vorgänge, 3.11). Die Seiten der Erweiterungen (E: eigene Formulare,
// I: Eingang) arbeiten nur hierüber mit der Schale.

import type { User } from '../../types'
import type { FormConfig } from '../public/formSchema'
import type { MitgliederPruefung, Stand } from '../../lib/formular/api'

export interface VgKontext {
  user: User
  /** Die Organisation frisch geladen, bis dahin (oder ohne Netz) die vom Login; null ohne Organisation. */
  org: Record<string, unknown> | null
  orgId: string
  orgCode: string
  orgName: string
  /** Angezeigter Stand von `organizations.form_config` (sofort nach einer Änderung, dann der gespeicherte). */
  cfg: FormConfig
  /**
   * Eine Änderung an `form_config`: sofort zeigen, auf dem frisch gelesenen Stand
   * speichern (formConfigAendern), alle Änderungen nacheinander. true = gespeichert.
   * Einen Fehler zeigt die Schale selbst (Toast mit orgFehler) und zeigt danach
   * wieder den gespeicherten Stand; eine Erfolgsmeldung gibt der Aufrufer.
   */
  aendern: (fn: (c: FormConfig) => FormConfig) => Promise<boolean>
  /** darfFormulareEinstellen(user): Leitung, Benutzerverwaltung, Vorgänge, Supervisor. */
  darfEinstellen: boolean
  /** hatRecht(user, 'dokumente'): Recht Vorgänge, auch befristet. */
  darfVorgaenge: boolean
  /** modulFrei(org, 'dokumente'): Modul Vorgänge für die Organisation freigeschaltet. */
  vorgaengeFrei: boolean
  /** Zählung der Mitglieder, die nicht mit Passwort bestätigen können; einmal je Seitenaufruf, sonst null. */
  pruefung: MitgliederPruefung | null
  /** GET /stand mit Anmeldung (für `faehig`); null, solange er fehlt oder ohne Netz. */
  stand: Stand | null
  /** Rückmeldung als Toast; `fehler` hält sie länger und färbt sie. */
  showMsg: (text: string, fehler?: boolean) => void
  /** Eine Seite öffnen (`?seite=<seite>&id=<id>`), mit Eintrag im Verlauf. */
  oeffne: (seite: string, id?: string) => void
  /** Die offene Seite ersetzen, ohne Eintrag im Verlauf (etwa nach dem ersten Speichern: `vorlage` mit neuer Kennung). */
  ersetze: (seite: string, id?: string) => void
  /** Zurück: einen Schritt im Verlauf, wenn die Seite von hier geöffnet wurde, sonst zur Liste. */
  schliessen: () => void
  /** Der Reiter der Hauptseite (`formulare`, `cirs` oder der einer Erweiterung). */
  tab: string
  setTab: (t: string) => void
}
