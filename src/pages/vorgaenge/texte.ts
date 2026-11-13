// Texte der Vorgänge-Schale und ihrer Bausteine (Bauplan Vorgänge, 3.4, 3.5, 3.11).
//
// Ruhig und ohne Gedankenstriche. Die Texte der Absender-Wahl „Mitglied mit
// Passwort“ und „Name frei eintragen“ stehen weiter in
// src/lib/formular/verwaltung.ts (ABSENDER_WAHL, VORGAENGE_TEXTE); hier steht
// nur, was neu dazukommt, auch die dritte Art „Anonym“ für eigene Formulare.

export const VG_TEXTE = {
  titel: 'Vorgänge',
  zurueckHub: 'Zurück zum Hub',
  laedt: 'Lädt…',
  keinZugriffTitel: 'Kein Zugriff',
  keinZugriff: 'Vorgänge ist nur mit dem Recht „Vorgänge“ zugänglich. Die Standardformulare einstellen darf außerdem, wer die Benutzerverwaltung verwaltet.',
  nichtGefundenTitel: 'Nicht gefunden',
  nichtGefunden: 'Diese Seite gibt es hier nicht. Vielleicht ist der Link veraltet oder der Eintrag wurde gerade entfernt.',
  reiterAria: 'Bereiche',

  // Reiter „Formulare“ (3.4)
  standardformulare: 'Standardformulare',
  keinFormularFrei: 'Für eure Organisation ist kein Standardformular freigeschaltet.',
  hinweisAktiv: 'Aktive Formulare erscheinen auf der Seite eurer Organisation.',
  orgSeite: 'Seite der Organisation öffnen',
  neuesFormular: 'Neues Formular',

  // Seite eines Standardformulars (3.5)
  oeffentlicherLink: 'Öffentlicher Link',
  erreichbar: 'Über Link und QR-Code erreichbar',
  erreichbarAn: 'Jeder mit dem Link kann das Formular öffnen.',
  absender: 'Absender',
  linkUndQr: 'Link und QR-Code',
  cirsLinkAus: 'Solange das Formular aus ist, nimmt der Link keine Meldungen an.',
  felder: 'Felder',
  festTitel: 'Fest vorgegeben',
  festText: 'Die Patientendokumentation folgt dem Bogen des ÄLRD und ist in allen Organisationen gleich. Felder lassen sich nicht ausblenden, umbenennen oder ergänzen.',
  naep: 'Der NAEP-Export enthält nur die Felder des Bogens.',
  gespeichert: 'Gespeichert',
  orgNichtGeladen: 'Nicht gespeichert: Die Organisation ist noch nicht geladen. Bitte mit Netz erneut öffnen.',

  // Absender-Wahl (3.11)
  absenderAria: 'Absender',
  zaehlungAnzeigen: 'Wer kann es nicht?',
  zaehlungAusblenden: 'Liste ausblenden',
  hinweisBenutzer: 'Ändern lässt sich das in der Benutzerverwaltung.',
  zurBenutzerverwaltung: 'Zur Benutzerverwaltung',

  // Link und QR-Code (3.11)
  linkKopieren: 'Link kopieren',
  kopiert: 'Kopiert',
  kopierenFehler: 'Kopieren ging nicht. Die Adresse steht unter „Link kopieren“ und lässt sich dort markieren.',
  oeffnen: 'Öffnen',
  qrCode: 'QR-Code',
  qrUnter: 'Zum Ausdrucken und Aushängen',
  qrErzeugt: 'QR-Code wird erzeugt…',
  qrFehler: 'Der QR-Code ließ sich nicht erzeugen.',
  bildLaden: 'Bild laden',
  bildLadenUnter: 'Als PNG speichern',
  drucken: 'Drucken',
  druckenUnter: 'Ein Blatt mit QR-Code und Adresse',
  druckBlockiert: 'Das Druckfenster wurde blockiert. Bitte Pop-ups für Responda erlauben.',
  qrDruckHinweis: 'Mit der Kamera des Telefons scannen.',
} as const

/** Vierter Satz unter „Fest vorgegeben“: wie viele frühere eigene Felder es gab (0: kein Satz). */
export function frueherText(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return `Eure früheren eigenen Felder (${n}) bleiben in den Protokollen, in denen sie ausgefüllt wurden, sichtbar und im Ausdruck.`
}

/** Die dritte Art des Absenders, nur für eigene Formulare (PO 6, F6). */
export const ANONYM_WAHL = {
  knopf: 'Anonym',
  erklaerung: 'Ohne Namen, wie bei CIRS. Auch angemeldete Mitglieder senden ohne Namen.',
  anzeige: 'Absender: anonym',
} as const

/** Kurzname der Art für Zeilentexte („Öffentlich · Mitglied mit Passwort“). */
export const MODUS_KURZ = {
  passwort: 'Mitglied mit Passwort',
  frei: 'Name frei eintragen',
  anonym: 'anonym',
} as const
