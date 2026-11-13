# Öffentliche Formulare: Absender, eigene Formulare, anpassbare Formulare. Einführung

Notiz für den Owner. Was sich ändert, in welcher Reihenfolge es live geht und wie es sich
zurücknehmen lässt. Zwei Pakete, **eine** Reihenfolge: das Absender-Paket (Absender in
Patientendoku, Produktausgabe und Defektmeldung) und das Paket Vorgänge (eigene Formulare mit
Eingang, anpassbare Standardformulare, Patientendoku fest). Regeln, Routen und Felder im
Einzelnen: `docs/pocketbase-regeln.md`, Abschnitte „Öffentliche Formulare: Absender“ und „Eigene
Formulare und anpassbare Standardformulare“.

Wer die Einführung des Absender-Pakets schon begonnen hat: Erledigte Schritte bleiben gültig. Was
dazukommt, steht unten als **Neu** in den Schritten 0, 2, 5, 6 und 7; diese Teile in der hier
genannten Reihenfolge nachholen (Schritt 2 vor dem Veröffentlichen der App mit Vorgänge neu).

## Was sich ändert

Absender-Paket:

- Patientendoku, Produktausgabe und Defektmeldung senden über eigene Routen des Servers. Der
  Server prüft, wer absendet, und setzt Status, Frist, Absender und Besatzung selbst.
- **Patientendoku verlangt ab dem Kopieren der Hooks das Passwort des Absenders**, in allen
  Organisationen (Voreinstellung „Mitglied mit Passwort“). Wer in Unitas angemeldet ist, braucht
  kein Passwort („Neues Protokoll“ in Unitas). Produktausgabe und Defektmeldung bleiben bei „Name
  frei eintragen“. Umstellen lässt sich das je Formular unter Vorgänge → Formulare.
- Ohne Netz bleibt ein Protokoll auf dem Gerät. Ist der Absender danach nicht mehr da, geht es als
  „Unterschrift ausstehend“ raus, wenn der Name genau zu einem Mitglied passt; der Absender
  unterschreibt dann angemeldet in Unitas. Die Leitung oder wer das Recht Patienten hat, kann es
  notfalls „Ohne Unterschrift abschließen“, mit Begründung.
- Zwei aktive Mitglieder gleichen Namens in einer Organisation gehen nicht mehr. „Gleich“ heißt
  auch: mit unsichtbaren Zeichen, in Vollbreite oder mit Buchstaben anderer Schriften, die wie
  lateinische aussehen (kyrillisches А). Namen, die Schriften mischen, nimmt der Server nicht an.
- Der Frist-Lauf (Protokolle nach 24 Stunden selbst abschließen) lief bisher nie. Repariert
  schließt er beim ersten Lauf den ganzen Rückstau auf einmal ab.

Paket Vorgänge (neu):

- **Eigene Formulare** der Organisationen (`form_templates`) mit Abschnitten, Pflichtfeldern,
  Hilfetexten, aktiv/inaktiv, Link und QR-Code, verwaltet unter Vorgänge. Neue Formulare starten
  inaktiv mit „Name frei eintragen“. Absender je Formular: „Mitglied mit Passwort“, „Name frei
  eintragen“ oder „Anonym“. Anonym heißt: Der Server speichert keinen Namen und kein Konto, auch
  wenn ein angemeldetes Mitglied sendet.
- Jedes eigene Formular hat einen **Eingang** (`form_submissions`): neu, in Bearbeitung, erledigt,
  interne Notiz, Verlauf, Archiv, Druck, CSV. Lesen und ändern nur Mitglieder mit dem Recht
  Vorgänge derselben Organisation; gelöscht wird nichts (nur ein Superuser in der
  Admin-Oberfläche). Ein Formular mit Einsendungen lässt sich nur archivieren, nicht löschen.
- Einsendungen gehen über die Route des Servers. Er prüft Formular, Organisation, Modul Vorgänge,
  Absender und jedes Feld und setzt Status und Absender selbst. **Bisher legte die öffentliche Seite
  Einsendungen ohne jede Prüfung an, und je nach Regel waren alle Einsendungen aller
  Organisationen ohne Anmeldung lesbar.** Schritt 0 zeigt, wie es heute steht; Schritt 2 schließt
  es.
- **Produktausgabe, Defektmeldung und CIRS** lassen sich je Organisation anpassen: Bezeichnung,
  Hilfetext, optionale Felder ausblenden, Pflicht, Reihenfolge, eigene Felder. Felder, an denen
  Responda hängt (Positionen, Lager, Gerät, Beschreibung, Schweregrad, „Was ist passiert?“),
  bleiben. Eigene Angaben stehen im Datensatz und erscheinen in Lager, MPG-Eingang und CIRS.
- **Patientendoku ist fest**, ohne Feld-Editor. Werte früherer eigener Felder bleiben in den
  Protokollen sichtbar und im Ausdruck.
- CIRS: Der Server prüft beim Anlegen jetzt Organisation, Modul, Inhalt und eigene Felder.
- Ohne Netz abgeschickte Formulare und begonnene Protokolle liegen verschlüsselt auf dem Gerät
  (Hinweise unten).

## Einführung, Schritt für Schritt

0. **Vorprüfen und Bescheid geben** (nur lesend; ohne `PB_URL` bricht das Skript ab, es gibt
   keinen Vorgabewert):
   ```
   PB_URL=https://api.responda.systems PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORT=… node scripts/formular-vorpruefung.mjs
   ```
   Es zeigt je Organisation, wer nicht mit Passwort bestätigen kann (Name unvollständig, ohne
   E-Mail und damit ohne Passwort) und wessen Name doppelt ist (bestätigt mit Passwort, wird aber
   in der Besatzung und ohne Passwort nicht erkannt); dazu als Hinweis „E-Mail nie bestätigt“
   (vielleicht nie ein Passwort festgelegt). Außerdem: ob die Hooks schon laufen, welche Felder
   schon da sind, Trusted proxy, offene Protokolle mit abgelaufener Frist (schließt der erste
   Frist-Lauf), alte Entwürfe, ob `users` ohne Anmeldung lesbar ist. Den Organisationen Bescheid
   geben: Namen vervollständigen, Doppelte unterscheiden (etwa mit dem zweiten Vornamen), fehlende
   E-Mails nachtragen. Die Zählung sehen Verantwortliche auch unter Vorgänge → Formulare.
   **Neu**, Abschnitt „EIGENE FORMULARE“ der Ausgabe: **die heutigen Regeln von `form_templates`,
   `form_submissions` und `cirs_reports` notieren** (für eine Rücknahme; die Ausgabe nennt jede
   Regel und ob sie schon wie in der Doku steht), welche Felder `form_templates` und
   `form_submissions` schon haben, ob `template_id` Text oder Relation ist (beides geht), wie groß
   die JSON-Felder sein dürfen und ob Einsendungen ohne Anmeldung lesbar sind.
1. **Proxy klären, bevor die Hooks liegen.** In PocketBase unter Logs die IP-Spalte ansehen: Steht
   bei allen Anfragen dieselbe interne Adresse (127.0.0.1, 10.x, 172.16 bis 172.31, 192.168.x),
   sitzt ein Proxy davor. Dann unter Settings → Trusted proxy dessen Kopf eintragen (meist
   `X-Forwarded-For` oder `X-Real-IP`, bei Cloudflare `CF-Connecting-IP`). Ohne Proxy nichts
   eintragen.
2. **Neu, vor der App:**
   - Felder anlegen (nicht Pflicht): `form_templates.absender` (*Plain text*),
     `form_templates.archiviert` (*Bool*), `form_templates.abschnitte` (*JSON*). Die App schreibt
     sie; fehlen sie, verwirft PocketBase den Wert still (die App sagt es dann).
   - Größe der JSON-Felder („Max size“): `form_templates.schema` auf 2000000,
     `form_submissions.payload` auf 2000000.
   - Regeln setzen, genau wie in `docs/pocketbase-regeln.md`, „Eigene Formulare: API-Regeln“:
     `form_templates` Create, Update und Delete (List und View bleiben leer, also öffentlich);
     `form_submissions` List, View und Update, Delete gesperrt (Schloss). Create von
     `form_submissions` bleibt vorerst, wie es ist.
   - Prüfen: ohne Anmeldung liefert `GET /api/collections/form_submissions/records` keine
     Einträge. Vorprüfung noch einmal: alle Regeln „[wie in der Doku]“.
   War List oder View von `form_submissions` bisher offen, ist das ab jetzt zu. Die heute
   ausgelieferte App liest Einsendungen nirgends, ihr fehlt nichts.
3. **App veröffentlichen** (Push auf `main`, Netlify). Ohne die Hooks erkennt die App den alten
   Server und legt wie bisher direkt an, mit zwei Unterschieden: Die Besatzung steht nur als
   Namen im Protokoll (die App sucht keine Konten mehr), und wer angemeldet sendet (Unitas
   „Neues Protokoll“, eigenes Telefon), wird nur mit sich selbst verknüpft, wenn sein Name in der
   Besatzung steht. Die übrige Besatzung solcher Protokolle trägt die Leitung in der
   Patientenverwaltung mit „Mannschaft nachtragen“ nach. Diese Zeit deshalb kurz halten.
   Eigene Formulare senden bis zu den Hooks wie heute direkt. Eigene Felder in den
   Standardformularen bietet die App erst an, wenn der Server umgestellt ist; Status und Notiz im
   Eingang ebenso.
4. **48 Stunden warten**, damit sich die installierten Apps aktualisieren.
5. **Hooks kopieren:** die bisherigen Dateien in `/opt/pb_hooks` sichern, vorher einmal
   `node scripts/hooks-rauchprobe.mjs --bin <pfad/zu/pocketbase>` gegen eine Kopie laufen lassen
   (startet ein leeres Wegwerf-PocketBase mit den Dateien). Dann `formular-regeln.js`,
   `formular.pb.js`, `formular-felder.pb.js`, `mitglieder-namen.pb.js`, `doku-frist.pb.js`,
   `mpg.pb.js` und **neu** `eigene-formulare.pb.js` und `cirs.pb.js` (geändert) dorthin kopieren
   und PocketBase neu starten. Prüfen:
   - `GET /api/health` liefert 200. Ein Syntaxfehler in einer Hook-Datei hält PocketBase an:
     dann sofort die gesicherten Dateien zurück und neu starten.
   - `GET /api/responda/formular/<org_code>/stand` liefert 200 mit `"version": 2`.
   - `GET /api/responda/formular/diagnose` mit Superuser-Token zeigt bei `realIP` die eigene
     öffentliche Adresse und keine `warnung`. Die Felder aus Schritt 6 stehen dort noch auf
     `false`, die aus Schritt 2 auf `true`.
6. **Erst jetzt die Felder, die nur der Server setzt** (nicht Pflicht):
   - Absender-Paket (*Plain text*): `patients.absender_status`, `product_outputs.absender_status`,
     `mpg_defect_reports.reporter_status`.
   - **Neu:** `form_submissions.status`, `form_submissions.notiz`, `form_submissions.absender_status`
     (*Plain text*), `form_submissions.bearbeitung` (*JSON*), `form_templates.version` (*Number*),
     `form_templates.fassungen` (*JSON*, Max size 8000000), `mpg_defect_reports.eigene` (*JSON*).

   Danach zeigt `diagnose` alle Felder `true`. Ohne die Statusfelder gibt es kein „Unterschrift
   ausstehend“, ohne `status`, `notiz` und `bearbeitung` keinen Status im Eingang, ohne `version`
   und `fassungen` keine Fassungen, ohne `mpg_defect_reports.eigene` keine eigenen Felder in der
   Defektmeldung; alles andere geht.
   **Warum diese Reihenfolge:** Diese Felder setzt nur der Server. Gäbe es sie vor den Hooks,
   könnte jeder ohne Anmeldung „bestätigt“ oder „ausstehend“ mit einem fremden Absender, einen
   Status oder eine Fassung hineinschreiben, und der Server hielte das später für echt. Wurden sie
   doch schon früher angelegt: Der erste Start der Hooks leert einmal alle gesetzten Statusfelder
   (Anzahl im Log unter `[formular] Erster Start`, Merker `responda_formular_start.txt` im
   Datenverzeichnis); für `form_submissions.absender_status` gilt dasselbe mit eigenem Merker
   (`[formular] Erster Start eigene`, `responda_eigene_start.txt`), auch wenn das Absender-Paket
   schon lief. Diese Sätze gelten danach als alte Sätze ohne Absender.
7. **Erste Stunde beobachten:** im Log nach `[formular]`, `[doku_frist]` und **neu** `[eigene]`
   und `[cirs]` suchen. Der Frist-Lauf zur vollen Stunde schließt den Rückstau aus Schritt 0 ab
   (Anzahl im Log). Ein Eintrag „List-Regel von form_submissions zeigt fremde Einsendungen“ heißt:
   Die Regel aus Schritt 2 fehlt.
8. **Nach mindestens 7 Tagen: `users` schließen.** Den bisherigen Wert von List und View
   notieren. Dann beide auf diese Regel setzen (auch in `docs/pocketbase-regeln.md`, „users: List
   und View schließen“):
   ```
   @request.auth.id != "" && (id = @request.auth.id || @request.auth.supervisor = true || (organization_id != "" && organization_id = @request.auth.organization_id && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now)))
   ```
   Prüfen: ohne Anmeldung liefert `GET /api/collections/users/records` keine Einträge; Anmelden,
   Benutzerverwaltung, Patientenverwaltung (Mannschaft nachtragen) und Unitas gehen. Danach
   `node scripts/emails-verbergen.mjs` (Probelauf, zeigt die Zahl), dann mit `--ausfuehren`.
   Leitung und Benutzerverwaltung sehen E-Mails weiter, andere Mitglieder nicht.
9. **Später:** Create-Regeln der Formulare schließen, auch die von `form_submissions`
   (`docs/pocketbase-regeln.md`, „Öffentliche Formulare: später schließen“), frühestens nach dem
   31.01.2027.

**Die Reihenfolge zählt:** Kämen die Hooks vor der App, würde die heute ausgelieferte App in allen
Organisationen beim Absenden der Patientendoku abgewiesen. Kämen die Felder aus Schritt 6 vor den
Hooks, ließen sie sich fälschen. Kämen die Felder aus Schritt 2 nach der App, gingen Absender-Art,
Archiv und Abschnitte neuer Formulare still verloren.

## Rücknahme

Nur `formular.pb.js` aus `/opt/pb_hooks` entfernen und neu starten (`mitglieder-namen.pb.js` kann
bei Bedarf mit raus). Die App nimmt dann den alten Weg (wie in Schritt 3 beschrieben); Geräte, die
den neuen Server in den letzten 24 Stunden gesehen haben, halten ihre Einträge so lange auf dem
Gerät. Ausstehende Protokolle bleiben offen und werden nicht selbst freigegeben (der neue
Frist-Lauf bleibt). „Unterschreiben“, „Das war ich nicht“ und „Ohne Unterschrift abschließen“
gehen erst wieder mit `formular.pb.js`; die App sagt das in den Dialogen. Eigene Formulare senden
dann wieder direkt, ungeprüft wie früher; neue Einsendungen stehen auf „neu“, ohne Absender.

**`formular-felder.pb.js`, `mpg.pb.js`, `eigene-formulare.pb.js` und `cirs.pb.js` bleiben liegen.**
Sie halten die Statusfelder dicht, solange `formular.pb.js` fehlt: Neue Sätze bekommen kein
Statusfeld, bestehende behalten Feld und Absender, bestätigte ändert ohne Anmeldung niemand,
ausstehende niemand. Vorlagen bleiben geprüft und mit Einsendungen unlöschbar, Einsendungen nur
in Status und Notiz änderbar und nie löschbar, CIRS weiter geprüft. Wer stattdessen alle Dateien
aus der Sicherung zurückspielt, löscht vorher die Felder aus Schritt 6; bei einer späteren
Wiedereinführung legt er sie wieder erst nach den Hooks an. Die Regeln aus Schritt 2 können
bleiben (sie schließen nur, was offen nicht sein sollte); zurück gehen sie mit den notierten
Werten aus Schritt 0.

Die `users`-Regel aus Schritt 8 ist davon unabhängig; zurück geht sie mit den notierten Werten.

## Hinweise

- Konten mit Anmeldung per Passwort und E-Mail-Code bestätigen ein Formular mit dem Passwort
  allein. Die Bestätigung ist keine Anmeldung, der Server gibt dabei kein Token aus.
- Mitglieder ohne E-Mail (Platzhalter `…@kein-email.intern`) haben kein Passwort, das jemand
  kennt. Sie können nicht mit Passwort bestätigen und nicht selbst unterschreiben; für sie gibt
  es „Ohne Unterschrift abschließen“. Abhilfe: E-Mail nachtragen, dann legt die Person ihr
  Passwort selbst fest. Im Formular bietet die App ohne Passwort „Auf dem Gerät ablegen“ an;
  die Karte „Wartet auf dem Gerät“ sendet dann bei eindeutigem Namen ohne Passwort
  („Unterschrift ausstehend“), oder ein anderes Mitglied sendet mit seinem Passwort.
- Wer in Unitas einen Eintrag zum Unterschreiben findet, den er nicht abgegeben hat, wählt „Das
  war ich nicht“. Ein Patientenprotokoll erscheint dann in der Patientenverwaltung mit diesem
  Hinweis und wird dort ohne Unterschrift abgeschlossen; Produktausgabe, Defektmeldung und
  Einsendungen eigener Formulare stehen danach ohne Konto unter dem eingetragenen Namen.
- Sperren bei falschen Passwörtern, für die Bestätigung und die normale Anmeldung gemeinsam:
  Fünf falsche Passwörter für ein Konto von einer Adresse sperren dieses Konto von dort für 15
  Minuten. 30 falsche für ein Konto, von welchen Adressen auch immer, sperren es für alle
  Adressen, die es schon falsch versucht haben; eine Adresse ohne eigene Fehlversuche kommt mit
  dem richtigen Passwort weiter durch (so sperrt niemand ein Konto aus der Ferne, nur weil er den
  Namen kennt). 30 falsche Passwörter von einer Adresse, für beliebige Konten, sperren diese
  Adresse. IPv6 zählt je /64, dazu je /48 höchstens 100. Nach einem Neustart von PocketBase ist
  das zurückgesetzt.
- **Fassungen:** Ändert eine Organisation ein Formular, bekommt es eine neue Fassung. Jede
  Einsendung trägt die Felder, mit denen sie gesendet wurde, und sieht danach aus wie gesendet.
  Pflichtfelder prüft der Server nur bei der aktuellen Fassung: Ein Eintrag, der ohne Netz auf dem
  Gerät wartete, während jemand das Formular änderte, geht trotzdem raus; was nicht mehr passt,
  steht unter „Aus einer früheren Fassung“, und die Einsendung trägt die Nummer, mit der sie
  gesendet wurde. Als früher gilt nur eine Nummer kleiner als die aktuelle; alles andere (keine,
  Text, größer) prüft der Server streng, sonst ließe sich die Pflicht mit einer erfundenen Nummer
  umgehen. Gespeichert bleiben die letzten 10 Fassungen.
- **Alte Vorlagen** aus dem bisherigen Baukasten liest der Server wie neue. Hat eine davon Felder,
  die die neuen Regeln nicht mehr zulassen (etwa eine Auswahl mit nur einer Option), lässt sie
  sich weiter aktivieren, deaktivieren und archivieren; wer ihre Felder ändert, muss sie gültig
  machen.
- **Speicher auf dem Gerät:** Die Warteschlange und begonnene Protokolle liegen verschlüsselt im
  Browser (AES-GCM, Schlüssel über die Web-Schnittstelle nicht exportierbar). Das heißt: kein
  Klartext auf dem Gerät, eine Suche nach Namen in den Browser-Dateien oder ein Blick in die
  Entwicklerwerkzeuge findet nichts. **Es schützt nicht**, wenn jemand die Dateien des Browsers
  selbst ausliest (Sicherung, ausgelesenes Gerät, Werkzeug mit Dateizugriff): Der Browser legt
  auch den „nicht exportierbaren“ Schlüssel als Bytes in seine IndexedDB-Dateien, neben das
  Chiffrat (mit Chromium nachgeprüft). Dagegen helfen nur Gerätesperre und
  Geräteverschlüsselung; das sollte jede Organisation für ihre Tablets vorgeben. Gegen Schadcode
  auf der Seite selbst hilft es ebenfalls nicht. Wo der Browser das nicht zulässt (etwa ohne
  sichere Verbindung), wird wie bisher unverschlüsselt gespeichert; die Karte der Warteschlange
  sagt das. Ein begonnenes Protokoll wird nach einem Tag nicht mehr angeboten und beim nächsten
  Start der App entfernt (auch das der alten Maske). Ohne Anmeldung eines Mitglieds setzt die
  Maske es nicht von selbst ein, sondern fragt zuerst („Begonnenes Protokoll auf diesem Gerät“,
  ohne Patientendaten). Öffnet der Tresor langsam, wartet die Maske einige Sekunden auf ihn; ein
  dabei unterlegener Entwurf bleibt unter eigenem Schlüssel und wird später angeboten.
- **Zwischenspeicher des Service Workers:** Antworten des Servers liegen unverschlüsselt im Cache
  `api-cache`, damit die App kurz ohne Netz weiterläuft. Ausgenommen sind alle Sammlungen mit
  Patienten- oder Gesundheitsdaten und Personen: `patients`, `patient_docs_nacherfassung`,
  `access_logs`, `audit_logs`, `users`, `einsaetze`, `einsatz_personen`, `chat_messages`,
  `chat_channel_keys`, `user_keys`, `notizen` (Liste in `src/lib/zwischenspeicherRegel.ts`). Ohne
  Netz zeigt die App diese deshalb nicht aus einem alten Stand; Unitas und die
  Patientenverwaltung sagen dann, dass die Protokolle ohne Netz nicht geladen werden können, und
  laden nach, sobald Netz da ist. Übrige Antworten können Namen von Mitgliedern enthalten (etwa
  eingebettete Konten über `expand`). Antworten älter als 24 Stunden verwendet die App nicht mehr
  und löscht sie bei jedem Start. Beim Abmelden, beim Wechsel der angemeldeten Person und beim
  Start ohne Anmeldung (auch nach einer Umleitung auf `/login`) löscht die App den Rest, zehn
  Sekunden später noch einmal (für Anfragen, die beim Abmelden noch liefen); nur die Organisation
  bleibt (für die öffentlichen Formulare ohne Netz). Dateien unter `/api/files/` sind nicht
  ausgenommen (die Adresse nennt die Sammlung nur über ihre Kennung); Patientenprotokolle
  legt die App keine Dateien an.
- **Versand im Hintergrund:** Android und Chrome senden abgelegte Formulare auch nach dem
  Schließen der Seite, sobald wieder Netz da ist. Im Modus „Mitglied mit Passwort“ geht ein
  Eintrag dabei nur als „Unterschrift ausstehend“ raus, und nur, wenn der Name genau ein Mitglied
  trifft; nie mit Passwort oder Anmeldung. Solange ein Fenster der App offen ist, auch verdeckt
  (etwa beim Wechsel in den Passwortmanager), sendet der Hintergrund solche Einträge und Einträge
  angemeldeter Mitglieder nicht: Dann fragt die Karte nach dem Passwort. Anonyme Formulare gehen
  ohne Namen raus. iOS und Firefox können das nicht; dort sagt die App nach dem Ablegen, dass die
  Seite später mit Netz wieder geöffnet werden muss.
- **Rechtlich prüfen:** Datenschutzerklärung und AVV sind angepasst (Auslieferung der App über
  Netlify, Dienste Dritter, Speicher auf dem Gerät). Beide Texte vor dem Veröffentlichen
  rechtlich prüfen lassen. Ist in PocketBase ein eigener Text `datenschutz` gesetzt, gilt dieser
  statt des Standardtexts und muss von Hand angepasst werden.
- **Logs in PocketBase:** unter Settings → Logs nachsehen, wie lange Logs bleiben und ob
  IP-Adressen gespeichert werden; die Datenschutzerklärung muss dazu passen.
- Die Prüfung der Hooks lief gegen PocketBase 0.28.4 und 0.40.5 (1235 Prüfungen je Version, alle
  bestanden: die Fälle des Absender-Pakets und 454 für Vorgänge), auch die Wege
  „Felder vor den Hooks, erster Start, Rücknahme, Wiedereinführung“ und „Absender-Paket lief
  schon, dieses Paket startet zum ersten Mal“.
- **Bekannte Grenzen (Randfälle, bewusst noch offen):**
  - Öffnet der verschlüsselte Speicher in der alten Maske `/<org>/patienten-alt` erst nach mehr
    als rund zehn Sekunden (sehr langsames Gerät, zweiter Tab hält die Sperre), bietet die Maske
    einen dort liegenden Entwurf nicht mehr an. Tippt man dann ein neues Protokoll, kann es den
    alten Entwurf überschreiben. Die neue Maske `/<org>/doku` bietet ihn in diesem Fall an.
  - Scheitert das Schreiben in IndexedDB (bekannter iOS-Fehler) oder tippt jemand während des
    Umzugs weiter, kann eine ältere Teilkopie desselben Protokolls als eigener Entwurf
    aufgehoben werden. Nach dem Absenden erscheint sie dann noch einmal als „Begonnenes
    Protokoll“ und verfällt nach einem Tag. Ohne Anmeldung kommt sie erst nach der Rückfrage
    und lässt sich dort verwerfen.
  - Background Sync wiederholt Chrome nur wenige Male. Bleibt eine Seite mit der Karte lange
    verdeckt und wird dann vom System beendet, geht ein Eintrag im Modus Passwort erst beim
    nächsten Öffnen raus. Ein Fenster ohne Karte (etwa EKS) hält den Versand nicht auf.
