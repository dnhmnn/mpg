# Auftragsverarbeitungsvertrag (AVV)
### gemäß Art. 28 Datenschutz-Grundverordnung (DSGVO)

---

## Vertragsparteien

**Auftraggeber (Verantwortlicher):**
[Name der Organisation]
[Straße, Hausnummer]
[PLZ, Ort]
Deutschland
— nachfolgend „Auftraggeber" —

**Auftragnehmer (Auftragsverarbeiter):**
Daniel Heilmann
Alter Keller 5
91541 Rothenburg ob der Tauber
Deutschland
E-Mail: daniel@responda.systems
— nachfolgend „Auftragnehmer" —

---

## § 1 — Gegenstand und Dauer

(1) Der Auftragnehmer verarbeitet personenbezogene Daten im Auftrag des Auftraggebers im Rahmen der Nutzung der Software **Responda** (digitale Einsatzverwaltung für Feuerwehr und Rettungsdienst), bereitgestellt unter `app.responda.systems`.

(2) Die Verarbeitung erfolgt für die Dauer des zwischen den Parteien geschlossenen Nutzungsvertrags. Nach Beendigung des Nutzungsvertrags gelten die Regelungen in § 9 dieses Vertrags.

---

## § 2 — Art, Zweck und Umfang der Verarbeitung

(1) **Zweck:** Digitale Verwaltung von Einsätzen, Patientenprotokollen, Lagerhaltung, Ausbildungen und Personalverwaltung für den Auftraggeber.

(2) **Art der Verarbeitung:** Erhebung, Speicherung, Verarbeitung, Anzeige, Übermittlung (innerhalb des Systems) und Löschung personenbezogener Daten.

(3) **Kategorien betroffener Personen:**
- Mitglieder und Mitarbeitende der Organisation des Auftraggebers
- Patienten und versorgte Personen im Rahmen von Einsätzen
- Dritte, sofern im Rahmen von Einsätzen dokumentiert

(4) **Kategorien personenbezogener Daten:**
- Stammdaten: Name, Vorname, Geburtsdatum, Adresse
- Kontaktdaten: E-Mail-Adresse, Telefonnummer
- Gesundheitsdaten (besondere Kategorie gem. Art. 9 DSGVO): Vitalparameter, Diagnosen, Medikamentengaben, Verletzungen, Behandlungsverläufe im Rahmen von Patientenprotokollen
- Einsatzdaten: Einsatzort, Einsatzstichwort, Einsatzzeitraum
- Ausbildungsdaten: Teilnahmenachweise, Qualifikationen
- Zugangsdaten: Benutzername, gehashtes Passwort

---

## § 3 — Weisungsgebundenheit

(1) Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung des Auftraggebers, es sei denn, er ist durch das Recht der Europäischen Union oder eines Mitgliedstaats zur Verarbeitung verpflichtet (Art. 28 Abs. 3 lit. a DSGVO).

(2) Weisungen erteilt der Auftraggeber in der Regel durch die Konfiguration und Nutzung der Software sowie schriftlich per E-Mail an daniel@responda.systems.

(3) Hält der Auftragnehmer eine Weisung für rechtswidrig, teilt er dies dem Auftraggeber unverzüglich mit.

---

## § 4 — Vertraulichkeit

(1) Der Auftragnehmer stellt sicher, dass die mit der Verarbeitung der Daten befassten Personen zur Vertraulichkeit verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen (Art. 28 Abs. 3 lit. b DSGVO).

(2) Die Vertraulichkeitspflicht gilt über das Ende dieses Vertrags hinaus.

---

## § 5 — Technische und organisatorische Maßnahmen (TOMs)

Der Auftragnehmer trifft geeignete technische und organisatorische Maßnahmen gemäß Art. 32 DSGVO, insbesondere:

**Zutrittskontrolle:**
- Der Server befindet sich in den privaten Räumlichkeiten des Auftragnehmers in Rothenburg ob der Tauber; Zugang nur für den Auftragnehmer persönlich.

**Zugangskontrolle:**
- Starke Passwörter und SSH-Key-Authentifizierung für Server-Zugang
- Keine Nutzung unsicherer Remote-Zugangsprotokolle

**Zugriffskontrolle:**
- Rollenbasiertes Zugriffskonzept in der Software (Benutzer, Supervisor, Admin)
- Jede Organisation ist datentechnisch isoliert (Mandantentrennung per `organization_id`)

**Weitergabekontrolle:**
- Alle Verbindungen verschlüsselt via TLS 1.2/1.3 (HTTPS)
- Keine Weitergabe von Daten an Dritte ohne Weisung des Auftraggebers

**Eingabekontrolle:**
- Protokollierung relevanter Zugriffe und Änderungen im System

**Verfügbarkeitskontrolle:**
- Regelmäßige Datensicherungen (Backups)
- Wiederherstellungskonzept vorhanden

**Trennungskontrolle:**
- Daten verschiedener Auftraggeber werden strikt getrennt verarbeitet und gespeichert

Der Auftragnehmer ist berechtigt, die TOMs dem Stand der Technik entsprechend weiterzuentwickeln, sofern das Schutzniveau nicht unterschritten wird.

---

## § 6 — Unterauftragsverarbeiter

(1) Der Auftragnehmer setzt zum Zeitpunkt des Vertragsschlusses **keine** Unterauftragsverarbeiter ein. Alle Daten werden auf dem eigenen Server des Auftragnehmers in Deutschland verarbeitet.

(2) Beabsichtigt der Auftragnehmer, künftig Unterauftragsverarbeiter einzusetzen oder auszuwechseln, informiert er den Auftraggeber rechtzeitig (mindestens 4 Wochen vor Beginn). Der Auftraggeber kann gegen den Einsatz eines bestimmten Unterauftragsverarbeiters schriftlich Einspruch erheben.

(3) Werden Unterauftragsverarbeiter eingesetzt, stellt der Auftragnehmer sicher, dass diesen dieselben Datenschutzpflichten auferlegt werden wie dem Auftragnehmer selbst.

---

## § 7 — Unterstützungspflichten

(1) Der Auftragnehmer unterstützt den Auftraggeber soweit möglich bei:
- der Erfüllung von Betroffenenanfragen (Auskunft, Berichtigung, Löschung gem. Art. 15–21 DSGVO)
- der Einhaltung der Pflichten aus Art. 32–36 DSGVO (Sicherheit, Datenpannen, Folgenabschätzung)

(2) Der Auftragnehmer meldet dem Auftraggeber Verletzungen des Schutzes personenbezogener Daten **unverzüglich**, spätestens jedoch innerhalb von **24 Stunden** nach Bekanntwerden, an die E-Mail-Adresse des Auftraggebers.

---

## § 8 — Kontrollrechte des Auftraggebers

(1) Der Auftraggeber hat das Recht, die Einhaltung der datenschutzrechtlichen Vorschriften und dieses Vertrags beim Auftragnehmer zu kontrollieren.

(2) Kontrollen werden mit angemessenem Vorlauf (mindestens 5 Werktage) schriftlich angekündigt, soweit keine dringende Verdachtslage besteht.

(3) Der Auftragnehmer stellt dem Auftraggeber alle zur Kontrolle erforderlichen Informationen zur Verfügung.

---

## § 9 — Löschung und Rückgabe nach Vertragsende

(1) Nach Beendigung des Nutzungsvertrags löscht oder gibt der Auftragnehmer — nach Wahl des Auftraggebers — alle personenbezogenen Daten zurück und löscht vorhandene Kopien, sofern nicht eine Verpflichtung zur Speicherung nach dem Recht der EU oder eines Mitgliedstaats besteht (Art. 28 Abs. 3 lit. g DSGVO).

(2) Der Auftraggeber kann einen **Datenexport** (JSON- oder CSV-Format) vor Vertragsende anfordern. Dieser wird innerhalb von 14 Tagen bereitgestellt.

(3) Die vollständige Löschung wird dem Auftraggeber schriftlich bestätigt.

---

## § 10 — Haftung

Die Haftung der Parteien richtet sich nach den gesetzlichen Regelungen der DSGVO sowie dem zwischen den Parteien geschlossenen Nutzungsvertrag.

---

## § 11 — Schlussbestimmungen

(1) Dieser Vertrag unterliegt dem Recht der Bundesrepublik Deutschland.

(2) Änderungen und Ergänzungen bedürfen der Schriftform.

(3) Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam.

(4) Dieser Vertrag ist Bestandteil des zwischen den Parteien geschlossenen Nutzungsvertrags und geht etwaigen anderslautenden Regelungen in diesem vor.

---

## Unterschriften

Ort, Datum: _______________________

**Auftraggeber (Verantwortlicher):**

_______________________
Unterschrift, Name, Funktion

---

Rothenburg ob der Tauber, Datum: _______________________

**Auftragnehmer (Auftragsverarbeiter):**

_______________________
Daniel Heilmann — Responda

---

*Stand: Mai 2026 — Entwurf, noch nicht rechtsverbindlich geprüft.*
