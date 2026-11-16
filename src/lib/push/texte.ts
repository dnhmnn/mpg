// Push-Benachrichtigungen: alle Texte der Oberfläche (Bauplan Push, 6.5).
//
// Ohne Gedankenstriche als Satzverbindung, ohne Emojis. Die Texte der Benachrichtigungen selbst
// baut der Server (pb_hooks/push-regeln.js); hier steht nur, was die App zeigt.

export const PUSH_TEXTE = {
  abschnittGeraet: 'Auf diesem Gerät',
  schalterTitel: 'Push auf diesem Gerät',
  schalterUnter: 'Auch wenn Responda geschlossen ist',
  wirdEingeschaltet: 'Wird eingeschaltet…',
  wirdAusgeschaltet: 'Wird ausgeschaltet…',

  nicht_eingerichtet: 'Push ist auf dem Server noch nicht eingerichtet.',
  dienst_fehlt: 'Der Push-Dienst antwortet gerade nicht. Bitte später erneut versuchen.',
  browser: 'Dieser Browser kann keine Push-Benachrichtigungen empfangen.',
  unsicher: 'Push geht nur über eine sichere Verbindung (https).',
  capacitor: 'In dieser App-Fassung gibt es Push noch nicht. Bitte Responda im Browser oder vom Homebildschirm öffnen.',
  ios_homebildschirm: 'Auf iPhone und iPad kommen Benachrichtigungen nur in der App vom Homebildschirm. In Safari: Teilen, dann Zum Home-Bildschirm. Danach Responda dort öffnen und hier einschalten.',
  ios_alt: 'Dafür braucht es iOS oder iPadOS 16.4 oder neuer.',
  abgelehnt: 'Benachrichtigungen sind für Responda abgelehnt. Erlauben lässt es sich in den Einstellungen des Geräts (Mitteilungen) oder des Browsers (Website-Einstellungen).',
  nicht_erlaubt: 'Benachrichtigungen wurden nicht erlaubt. Zum Einschalten erneut tippen und im Hinweis des Browsers erlauben.',
  keineAlarmierungTitel: 'Keine Alarmierung',
  keineAlarmierung: 'Keine Alarmierung. Push kann sich verspäten oder ausbleiben, etwa bei Stromsparen, Nicht stören oder ohne Netz. Für Einsätze gilt allein die Alarmierung.',

  probeKnopf: 'Probe senden',
  probeLaeuft: 'Sendet…',
  probeGesendet: 'Probe gesendet. Sie sollte gleich erscheinen.',
  probeOhneGeraet: 'Auf diesem Konto ist noch kein Gerät angemeldet.',
  eingeschaltet: 'Push ist auf diesem Gerät an.',
  ausgeschaltet: 'Push ist auf diesem Gerät aus.',
  neu_einschalten: 'Push muss auf diesem Gerät neu eingeschaltet werden.',
  neuEinschaltenKnopf: 'Neu einschalten',
  abgemeldet: 'Dieses Gerät wurde in der Geräteliste abgemeldet. Zum Einschalten hier tippen.',

  einschaltenFehler: 'Push ließ sich auf diesem Gerät nicht einschalten. Bitte erneut versuchen.',
  ausschaltenFehler: 'Push ist auf diesem Gerät aus. Der Server hat es noch nicht erfahren; das holt er beim nächsten Versand nach.',
  netz: 'Keine Verbindung zum Server.',
  server: 'Das hat gerade nicht geklappt. Bitte erneut versuchen.',
  nicht_angemeldet: 'Bitte melde dich an.',
  nicht_berechtigt: 'Dafür fehlt dir das Recht.',
  daten: 'Die Angaben sind unvollständig oder ungültig.',
  nicht_gefunden: 'Dieses Gerät ist hier nicht angemeldet.',
  speichernFehler: 'Nicht gespeichert. Bitte erneut versuchen.',
  laedt: 'Lädt…',

  // Anlässe
  pflichtUnter: 'Kommt immer, solange Push an ist',
  orgAusUnter: 'Von deiner Organisation ausgeschaltet',
  wocheUnter: 'Montags im Wochenüberblick',
  morgensUnter: 'Morgens ab 6 Uhr',
  anlaesseLeer: 'Für dich gibt es gerade keine Anlässe zum Einstellen.',
  anlaesseHinweis: 'Gilt für dein Konto, also für alle deine Geräte.',

  // Ruhezeit
  abschnittRuhe: 'Ruhezeit',
  ruheTitel: 'Ruhezeit',
  ruheUnter: 'Was in dieser Zeit anfällt, kommt an ihrem Ende als eine Nachricht. Deutsche Zeit.',
  ruheVon: 'Von',
  ruheBis: 'Bis',
  ruheMitteilung: 'Mitteilungen der Organisation auch in der Ruhezeit',
  ruheMitteilungUnter: 'Sonst kommen sie am Ende der Ruhezeit',

  // Geräte
  abschnittGeraete: 'Angemeldete Geräte',
  geraeteLeer: 'Noch kein Gerät angemeldet.',
  diesesGeraet: 'Dieses Gerät',
  geraetAbmelden: 'Abmelden',
  geraetAbgemeldet: 'Gerät abgemeldet.',

  // Organisation
  orgZeile: 'Für die Organisation festlegen',
  orgZeileUnter: 'Welche Anlässe in deiner Organisation überhaupt kommen',
  orgTitel: 'Für die Organisation',
  orgHinweis: 'Was hier aus ist, bekommt in der Organisation niemand. Jede Person kann zusätzlich für sich abschalten. Mitteilungen der Organisation kommen immer.',
  modulGesperrt: 'Modul nicht freigeschaltet',

  // Mitteilung an die Organisation (Owner 12.3)
  abschnittMitteilung: 'Mitteilung an die Organisation',
  mitteilungHinweis: 'Erscheint im Hub aller Mitglieder deiner Organisation und kommt per Push auf ihre Geräte.',
  mitteilungTitel: 'Titel',
  mitteilungText: 'Text',
  mitteilungVorschau: 'Vorschau',
  vorschauHub: 'Im Hub',
  vorschauSperr: 'Auf dem Sperrbildschirm',
  vorschauSperrHinweis: 'So erscheint sie, solange jemand auf dem Gerät angemeldet ist. Sonst steht dort nur: Es gibt Neues in Responda.',
  vorschauLeerTitel: 'Titel der Mitteilung',
  mitteilungSenden: 'Senden',
  mitteilungRueckfrage: 'Geht an alle Mitglieder deiner Organisation, auch per Push.',
  mitteilungJetztSenden: 'Jetzt senden',
  mitteilungAbbrechen: 'Abbrechen',
  mitteilungSendet: 'Sendet…',
  mitteilungGesendet: 'Mitteilung gesendet.',
  mitteilungAktiv: 'Aktive Mitteilungen',
  mitteilungKeine: 'Gerade ist keine Mitteilung aktiv.',
  mitteilungZurueckziehen: 'Zurückziehen',
  mitteilungZurueckFrage: 'Mitteilung zurückziehen? Sie verschwindet aus dem Hub. Was schon auf Geräten angekommen ist, bleibt dort.',
  mitteilungZurueckgezogen: 'Mitteilung zurückgezogen.',
  mitteilungTitelLeer: 'Bitte einen Titel eingeben.',
  mitteilungTitelLang: 'Der Titel ist zu lang (höchstens 120 Zeichen).',
  mitteilungTextLang: 'Der Text ist zu lang (höchstens 1000 Zeichen).',
  mitteilungHtml: 'Bitte nur Text eingeben, ohne HTML.',
  mitteilungVerboten: 'Mitteilungen der Organisation schicken nur der Supervisor und die Leitung der eigenen Organisation.',
  mitteilungDrossel: 'Höchstens drei Mitteilungen je Organisation in 24 Stunden. Bitte später erneut senden.',
  mitteilungFehler: 'Die Mitteilung ging nicht raus. Bitte erneut versuchen.',
  mitteilungListeFehler: 'Die aktiven Mitteilungen ließen sich nicht laden.',

  // Wege zur Seite
  seitenTitel: 'Benachrichtigungen',
  profilZeile: 'Benachrichtigungen',
  profilZeileUnter: 'Push auf diesem Gerät, Anlässe und Ruhezeit',
  profilNeuEinschalten: 'Push neu einschalten',
  settingsKarte: 'Push-Benachrichtigungen',
  settingsKarteUnter: 'Auf diesem Gerät einschalten, Anlässe, Ruhezeit',
  settingsGlocke: 'GLOCKE IM HUB',
  settingsGlockeSatz: 'Was die Glocke zählt. Gilt nur auf diesem Gerät.',
} as const

/** „in 3 Minuten“ bzw. „in einer Stunde“ aus Sekunden (wie dauerText in push-regeln.js). */
export function dauerText(sekunden: number): string {
  const s = Math.max(1, Number(sekunden) || 0)
  if (s > 5400) {
    const h = Math.ceil(s / 3600)
    return h === 1 ? 'einer Stunde' : h + ' Stunden'
  }
  const m = Math.max(1, Math.ceil(s / 60))
  return m === 1 ? 'einer Minute' : m + ' Minuten'
}

/** Text der Drossel einer Route mit Wartezeit. */
export function drosselText(sekunden: number): string {
  return 'Gerade kommen sehr viele Anfragen. Bitte in ' + dauerText(sekunden) + ' erneut versuchen.'
}
