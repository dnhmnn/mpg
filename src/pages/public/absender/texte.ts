// Texte und reine Regeln der gemeinsamen Absender-Felder (Bauplan v2, 4.2, 4.3).
//
// Keine Imports aus React oder PocketBase: die Prüffälle laufen ohne DOM
// (src/lib/__tests__/absenderFelder.test.ts). Die Bauteile NamensFeld,
// AbsenderFeld und Warteschlange holen ihre Sätze von hier, damit an einer
// Stelle steht, was der Mensch liest, und ein Prüffall sicherstellt, dass kein
// neuer Text einen Gedankenstrich trägt.

import { ABSENDER_VOREINSTELLUNG, nameVergleichsform, type AbsenderModus, type FormularArt, type VorlageModus } from '../../../lib/formular/absender'

export { nameVergleichsform } from '../../../lib/formular/absender'
import type { AbsenderAngabe, Grund, NamensErgebnis, Stand } from '../../../lib/formular/api'

/** Wofür ein Namensfeld steht: Absender der Maske, Besatzung, Absender in der Warteschlange. */
export type NamensZweck = 'absender' | 'besatzung' | 'ausstehend'

/**
 * Was die Prüfzeile unter einem Namensfeld sagt.
 * - `leer`, `pruefe`, `stumm`: keine Zeile (`stumm`: alter Server, Formular aus, Organisation fehlt).
 */
export type NamensLage = 'leer' | 'pruefe' | 'stumm' | 'unvollstaendig' | 'eindeutig' | 'mehrfach' | 'unbekannt' | 'ohne_netz' | 'gedrosselt'

/** Nach so langer Tipp-Pause fragt das Feld den Server. */
export const PRUEF_PAUSE_MS = 600

/**
 * Lohnt die Frage an den Server? Nur, wenn der Text ein Leerzeichen oder ein
 * Komma enthält und mindestens 4 Zeichen hat (Vor- und Nachname). Alles
 * andere ist sicher unvollständig; der Server sähe es genauso.
 */
export function namePruefbar(text: string): boolean {
  const t = String(text ?? '').trim()
  return t.length >= 4 && /[\s,  ]/.test(t)
}

/** Lage aus der Antwort von /name. */
export function lageAusErgebnis(r: NamensErgebnis): NamensLage {
  if (!r.vollstaendig) return 'unvollstaendig'
  if (r.eindeutig) return 'eindeutig'
  if (r.gefunden) return 'mehrfach'
  return 'unbekannt'
}

/** Lage aus einem Fehler von /name. */
export function lageAusFehler(grund: Grund): NamensLage {
  if (grund === 'netz') return 'ohne_netz'
  if (grund === 'drossel' || grund === 'server') return 'gedrosselt'
  if (grund === 'name') return 'unvollstaendig'
  return 'stumm'
}

const OHNE_NETZ = 'Ohne Netz. Der Name wird beim Senden geprüft.'
const GEDROSSELT = 'Prüfung gerade nicht möglich. Der Name wird beim Senden geprüft.'
const UNVOLLSTAENDIG = 'Bitte Vor- und Nachnamen eintragen.'

/** Die Sätze der Prüfzeile je Zweck (4.3, Tabelle). `absender` getrennt nach Modus. */
const PRUEFZEILE: Record<'besatzung' | 'absender_passwort' | 'absender_frei' | 'ausstehend', Record<'eindeutig' | 'mehrfach' | 'unbekannt', string>> = {
  besatzung: {
    eindeutig: 'Mitglied erkannt. Findet das Protokoll danach in Unitas.',
    mehrfach: 'Diesen Namen gibt es mehrfach. Steht nur auf dem Bogen.',
    unbekannt: 'Kein Mitglied mit genau diesem Namen. Steht nur auf dem Bogen.',
  },
  absender_passwort: {
    eindeutig: 'Mitglied erkannt. Bitte mit deinem Passwort bestätigen.',
    mehrfach: 'Mitglied erkannt. Bitte mit deinem Passwort bestätigen.',
    unbekannt: 'Kein aktives Mitglied mit genau diesem Namen. Bitte so eintragen, wie er in Responda steht.',
  },
  absender_frei: {
    eindeutig: 'Passt auf ein Mitglied. Wird verknüpft und als nicht bestätigt markiert.',
    mehrfach: 'Wird als Name ohne Konto eingetragen.',
    unbekannt: 'Wird als Name ohne Konto eingetragen.',
  },
  ausstehend: {
    eindeutig: 'Mitglied erkannt. Geht auch ohne Passwort und wartet dann auf die Unterschrift.',
    mehrfach: 'Diesen Namen gibt es mehrfach. Bitte mit Passwort senden.',
    unbekannt: 'Kein aktives Mitglied mit genau diesem Namen. Bitte so eintragen, wie er in Responda steht.',
  },
}

/**
 * Text und Farbe der Prüfzeile. `erkannt` heißt: in Akzentfarbe zeigen
 * (ein Mitglied ist erkannt); sonst warm-grau. Leerer Text: keine Zeile.
 */
export function pruefzeile(lage: NamensLage, zweck: NamensZweck, modus: AbsenderModus): { text: string; erkannt: boolean } {
  if (lage === 'leer' || lage === 'pruefe' || lage === 'stumm') return { text: '', erkannt: false }
  if (lage === 'unvollstaendig') return { text: UNVOLLSTAENDIG, erkannt: false }
  if (lage === 'ohne_netz') return { text: OHNE_NETZ, erkannt: false }
  if (lage === 'gedrosselt') return { text: GEDROSSELT, erkannt: false }
  const tabelle = zweck === 'absender' ? (modus === 'frei' ? 'absender_frei' : 'absender_passwort') : zweck
  const text = PRUEFZEILE[tabelle][lage]
  const erkannt = lage === 'eindeutig' || (tabelle === 'absender_passwort' && lage === 'mehrfach')
  return { text, erkannt }
}

/** Fußzeile der Besatzung: wie viele als Mitglied erkannt sind (4.4). */
export function besatzungFusszeile(erkannt: number): string {
  if (erkannt <= 0) return 'Noch niemand als Mitglied erkannt. Das Protokoll erscheint damit bei niemandem der Besatzung in Unitas.'
  if (erkannt === 1) return 'Ein Besatzungsmitglied ist erkannt und findet das Protokoll in Unitas.'
  return `${erkannt} Besatzungsmitglieder sind erkannt und finden das Protokoll in Unitas.`
}

/**
 * Modus des Formulars aus dem Stand; ohne Stand die Voreinstellung. Eigene Formulare
 * (`eigen`): der Modus der Vorlage (`vorlageModus`, Vorrang vor dem Stand); „anonym“
 * prüfen die Aufrufer vorher selbst (`istAnonymModus`), hier zählt es wie „frei“.
 */
export function modusAusStand(stand: Stand | null, formular: FormularArt, vorlageModus?: VorlageModus): AbsenderModus {
  if (formular === 'eigen') return vorlageModus === 'passwort' ? 'passwort' : 'frei'
  const m = stand?.formulare?.[formular]?.modus
  return m === 'passwort' || m === 'frei' ? m : ABSENDER_VOREINSTELLUNG[formular]
}

/** Ein eigenes Formular ohne Absender (Vorlage „anonym“)? */
export function istAnonymModus(formular: FormularArt, vorlageModus?: VorlageModus): boolean {
  return formular === 'eigen' && vorlageModus === 'anonym'
}

/**
 * Ist eine Person angemeldet erkannt, und sendet sie selbst (nicht „Anderer Absender“)?
 * Bei einem anonymen eigenen Formular nie (dann sendet niemand mit Namen, Plan Vorgänge F6).
 */
export function sendetAngemeldet(stand: Stand | null, anderer: boolean, vorlageModus?: VorlageModus): boolean {
  if (vorlageModus === 'anonym') return false
  return !!stand?.angemeldet && !anderer
}

/**
 * Wer sendet (4.2): angemeldet erkannt und nicht „Anderer Absender“ → mit
 * Token, `absender: null`. Sonst ohne Token mit Namen, im Modus Passwort mit
 * dem Passwort (ein leeres fällt weg; dann antwortet der Server `passwort_noetig`,
 * ohne Netz fragt die Warteschlange später).
 */
export function absenderAngabe(p: { stand: Stand | null; formular: FormularArt; anderer: boolean; name: string; passwort: string; modus?: VorlageModus }): { mitAnmeldung: boolean; absender: AbsenderAngabe } {
  // Anonym: kein Token, kein Name, kein Passwort
  if (istAnonymModus(p.formular, p.modus)) return { mitAnmeldung: false, absender: null }
  if (sendetAngemeldet(p.stand, p.anderer)) return { mitAnmeldung: true, absender: null }
  const name = String(p.name ?? '').trim()
  if (modusAusStand(p.stand, p.formular, p.modus) === 'passwort' && p.passwort) return { mitAnmeldung: false, absender: { name, passwort: p.passwort } }
  return { mitAnmeldung: false, absender: { name } }
}

/** „Als Anna Berg senden“, wenn angemeldet erkannt; sonst `sonst` (Vorgabe „Absenden“). */
export function sendeKnopfText(p: { stand: Stand | null; anderer: boolean; modus?: VorlageModus }, sonst = 'Absenden'): string {
  if (!sendetAngemeldet(p.stand, p.anderer, p.modus)) return sonst
  const name = p.stand!.angemeldet!.name.trim()
  return name ? `Als ${name} senden` : 'Angemeldet senden'
}

/** Kein Passwort eingetragen (Modus Passwort): mit dem Ausweg, ohne Passwort abzulegen (Befund Client-Abläufe 5). */
export const PASSWORT_FEHLT = 'Bitte bestätige mit deinem Passwort. Ist keins zur Hand, lässt es sich auf dem Gerät ablegen.'

/**
 * Was vor dem Senden aus einer Maske schon ohne Server feststeht (4.2).
 * Leer heißt: senden. Ohne Netz oder bei altem Server prüft niemand das
 * Passwort, dann zählt nur der Name.
 */
export function vorDemSenden(p: { stand: Stand | null; alterServer: boolean; formular: FormularArt; anderer: boolean; name: string; passwort: string; online: boolean; modus?: VorlageModus }): string {
  if (istAnonymModus(p.formular, p.modus)) return ''
  if (sendetAngemeldet(p.stand, p.anderer)) return ''
  if (!String(p.name ?? '').trim()) return 'Bitte einen Namen eintragen.'
  if (!p.online || p.alterServer) return ''
  if (modusAusStand(p.stand, p.formular, p.modus) === 'passwort' && !p.passwort) return PASSWORT_FEHLT
  return ''
}

/**
 * Angemeldet erkannt, aber im Namensfeld der Maske (Doku: Feld Unterschrift) steht ein anderer
 * Name: Hinweis, dass der Server den Kontonamen einträgt und wer anders „Anderer Absender“
 * wählt. Leer, wenn nicht angemeldet gesendet wird, das Feld leer ist oder die Namen passen.
 */
export function andererNameHinweis(p: { stand: Stand | null; anderer: boolean; name: string; herkunft: string }): string {
  if (!sendetAngemeldet(p.stand, p.anderer)) return ''
  const feld = String(p.name ?? '').trim()
  const konto = String(p.stand?.angemeldet?.name ?? '').trim()
  if (!feld || !konto || nameVergleichsform(feld) === nameVergleichsform(konto)) return ''
  return `Im Feld ${p.herkunft} steht „${feld}“. Gesendet wird angemeldet als ${konto}, auch im Feld steht danach ${konto}. Gibt ${feld} ab, bitte „Anderer Absender“ wählen.`
}

/** Texte rund um das Senden, ohne Gedankenstriche. */
export const ABSENDER_TEXTE = {
  abschnitt: 'Absender',
  angemeldetVor: 'Du sendest angemeldet als',
  andererAbsender: 'Anderer Absender',
  dochAngemeldet: 'Doch angemeldet senden',
  passwortLabel: 'Dein Passwort für Responda',
  passwortHinweis: 'Das Passwort bestätigt, dass du abgibst. Es wird nicht gespeichert.',
  /** In der Karte der Warteschlange: dort sitzt oft jemand anderes am Gerät. */
  passwortHinweisVon: (name: string) => `Das Passwort bestätigt, dass ${name || 'der Absender'} abgibt. Es wird nicht gespeichert.`,
  passwortVon: (name: string) => name ? `Passwort von ${name}` : 'Passwort des Absenders',
  ablegenOhnePasswort: 'Kein Passwort zur Hand? Auf dem Gerät ablegen',
  ohnePasswortAusweg: 'Es wartet dann oben auf diesem Gerät. Passt der Name genau zu einem Mitglied, geht es dort auch ohne Passwort raus und wartet auf die Unterschrift in Unitas. Oder ein anderes Mitglied sendet mit seinem Namen und Passwort.',
  nochKontoName: (name: string, feld: string) => `Im Feld ${feld} steht noch ${name}, der Name der angemeldeten Person. Gibt jemand anderes ab, bitte dort den eigenen Namen eintragen.`,
  zumFeld: (feld: string) => `Zum Feld ${feld}`,
  alsSenden: (name: string) => name ? `Als ${name} senden` : 'Senden',
  ausFeld: (name: string, feld: string) => name ? `${name}, aus dem Feld ${feld}` : `Noch kein Name. Bitte im Feld ${feld} eintragen.`,
  alterServer: 'Der Server prüft den Absender noch nicht. Es zählt der eingetragene Name.',
  /** Erfolg auf dem alten Weg (Server ohne Formular-Hooks): keine Besatzung verknüpft (Befund Client-Abläufe 1). */
  alterWegGesendet: 'Der Server erkennt die Besatzung gerade noch nicht. Die Leitung kann sie in der Patientenverwaltung nachtragen.',
  ablegen: 'Auf dem Gerät ablegen',
  abmelden: 'Abmelden',
  abgemeldet: 'Abgemeldet. Dieses Gerät sendet nicht mehr in deinem Namen.',
  abmeldenHinweis: 'Fremdes Gerät? Dann hier abmelden.',
  zurueckUnitas: 'Zurück zu Unitas',
  aendernOhneNetz: 'Ohne Netz lässt sich ein abgesendetes Protokoll nicht ändern. Deine Änderungen bleiben in der Maske, bis wieder Netz da ist.',
  aendernAusstehend: 'Das Protokoll wartet noch auf die Unterschrift des Absenders. Ändern geht erst danach.',
  aendernFehler: 'Die Änderung ließ sich nicht speichern. Bitte erneut versuchen.',
  dokuHinweis: 'Abgesendet steht es in Unitas bei der erkannten Besatzung und beim Absender. Danach bleibt einen Tag Zeit, es zu ändern. Ohne Netz wartet es auf dem Gerät.',
  // Warteschlange
  schlangeTitel: 'Wartet auf dem Gerät',
  spaeter: 'Später',
  anzeigen: 'Anzeigen',
  warten: (n: number) => n === 1 ? '1 Eintrag wartet' : `${n} Einträge warten`,
  absenderZeile: (name: string) => name ? `Absender: ${name}` : 'Absender: ohne Namen',
  ohnePasswortSenden: 'Ohne Passwort senden',
  ohnePasswortErklaerung: (name: string) => `Geht ohne Bestätigung raus und wartet auf die Unterschrift von ${name || 'dem Absender'} in Unitas.`,
  /** `hintergrund`: das Gerät sendet nach dem Schließen der Seite selbst (Background Sync, F12). */
  ohnePasswortVonSelbst: (hintergrund: boolean) => hintergrund
    ? 'Nach einer Stunde geht es von selbst so raus. Wird diese Seite vorher geschlossen, geht es meist schon dann so raus, sobald Netz da ist; sonst beim nächsten Öffnen.'
    : 'Nach einer Stunde geht es von selbst so raus.',
  ohnePasswortNurEindeutig: 'Ohne Passwort geht das nur, wenn der Name genau zu einem Mitglied passt.',
  gehtRaus: 'Geht gleich raus.',
  sendet: 'Wird gesendet …',
  aenderungUnterwegs: 'Die Änderung wird in das schon abgesendete Protokoll eingetragen.',
  verwerfen: 'Verwerfen',
  endgueltigVerwerfen: 'Endgültig verwerfen',
  behalten: 'Behalten',
  erneutSenden: 'Erneut senden',
  nameKorrigieren: 'Mit diesem Namen senden',
  ohneServer: 'Wartet auf die Verbindung zum Server.',
  // Eigene Formulare ohne Absender (Vorlage „anonym“)
  anonymHinweis: 'Dieses Formular wird ohne Namen gesendet.',
  absenderAnonym: 'Absender: anonym',
  // Tresor (Plan Vorgänge 5.1)
  unverschluesselt: 'Auf diesem Gerät wird unverschlüsselt gespeichert, weil der Browser es nicht anders zulässt.',
  unlesbar: (n: number) => n === 1 ? 'Ein Eintrag auf diesem Gerät ist unlesbar.' : `${n} Einträge auf diesem Gerät sind unlesbar.`,
} as const
