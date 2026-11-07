# Absender in den öffentlichen Formularen: Einführung

Notiz für den Owner. Was sich ändert, in welcher Reihenfolge es live geht und wie es sich
zurücknehmen lässt. Regeln, Routen und Felder im Einzelnen: `docs/pocketbase-regeln.md`,
Abschnitt „Öffentliche Formulare: Absender“.

## Was sich ändert

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

## Einführung, Schritt für Schritt

0. **Vorprüfen und Bescheid geben** (nur lesend; ohne `PB_URL` bricht das Skript ab, es gibt
   keinen Vorgabewert):
   ```
   PB_URL=https://api.responda.systems PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORT=… node scripts/formular-vorpruefung.mjs
   ```
   Es zeigt je Organisation, wer nicht mit Passwort bestätigen kann (Name unvollständig, ohne
   E-Mail und damit ohne Passwort) und wessen Name doppelt ist (bestätigt mit Passwort, wird aber
   in der Besatzung und ohne Passwort nicht erkannt); dazu als Hinweis „E-Mail nie bestätigt“
   (vielleicht nie ein Passwort festgelegt). Außerdem: ob die Hooks schon laufen, ob die Felder
   aus Schritt 5 schon da sind, Trusted proxy, offene Protokolle mit abgelaufener Frist (schließt
   der erste Frist-Lauf), alte Entwürfe, ob `users` ohne Anmeldung lesbar ist. Den Organisationen
   Bescheid geben: Namen vervollständigen, Doppelte unterscheiden (etwa mit dem zweiten
   Vornamen), fehlende E-Mails nachtragen. Die Zählung sehen Verantwortliche auch unter
   Vorgänge → Formulare.
1. **Proxy klären, bevor die Hooks liegen.** In PocketBase unter Logs die IP-Spalte ansehen: Steht
   bei allen Anfragen dieselbe interne Adresse (127.0.0.1, 10.x, 172.16 bis 172.31, 192.168.x),
   sitzt ein Proxy davor. Dann unter Settings → Trusted proxy dessen Kopf eintragen (meist
   `X-Forwarded-For` oder `X-Real-IP`, bei Cloudflare `CF-Connecting-IP`). Ohne Proxy nichts
   eintragen.
2. **App veröffentlichen** (Push auf `main`, Netlify). Ohne die Hooks erkennt die App den alten
   Server und legt wie bisher direkt an, mit zwei Unterschieden: Die Besatzung steht nur als
   Namen im Protokoll (die App sucht keine Konten mehr), und wer angemeldet sendet (Unitas
   „Neues Protokoll“, eigenes Telefon), wird nur mit sich selbst verknüpft, wenn sein Name in der
   Besatzung steht. Die übrige Besatzung solcher Protokolle trägt die Leitung in der
   Patientenverwaltung mit „Mannschaft nachtragen“ nach. Diese Zeit deshalb kurz halten.
3. **48 Stunden warten**, damit sich die installierten Apps aktualisieren.
4. **Hooks kopieren:** die bisherigen Dateien in `/opt/pb_hooks` sichern, dann
   `formular-regeln.js`, `formular.pb.js`, `formular-felder.pb.js`, `mitglieder-namen.pb.js`,
   `doku-frist.pb.js` und `mpg.pb.js` dorthin kopieren und PocketBase neu starten. Prüfen:
   - `GET /api/health` liefert 200. Ein Syntaxfehler in einer Hook-Datei hält PocketBase an:
     dann sofort die gesicherten Dateien zurück und neu starten.
   - `GET /api/responda/formular/<org_code>/stand` liefert 200.
   - `GET /api/responda/formular/diagnose` mit Superuser-Token zeigt bei `realIP` die eigene
     öffentliche Adresse und keine `warnung`. Die Felder stehen dort noch auf `false`.
5. **Erst jetzt die Felder anlegen** (*Plain text*, nicht Pflicht): `patients.absender_status`,
   `product_outputs.absender_status`, `mpg_defect_reports.reporter_status`. Danach zeigt
   `diagnose` alle Felder `true`. Ohne sie gibt es kein „Unterschrift ausstehend“, alles andere
   geht.
   **Warum diese Reihenfolge:** Die Felder setzt nur der Server. Gäbe es sie vor den Hooks, könnte
   jeder ohne Anmeldung „bestätigt“ oder „ausstehend“ mit einem fremden Absender hineinschreiben,
   und der Server hielte das später für echt. Wurden sie doch schon früher angelegt: Der erste
   Start der Hooks leert einmal alle gesetzten Werte (Anzahl im Log unter `[formular] Erster
   Start`, Merker `responda_formular_start.txt` im Datenverzeichnis). Diese Sätze gelten danach
   als alte Sätze ohne Absender.
6. **Erste Stunde beobachten:** im Log nach `[formular]` und `[doku_frist]` suchen. Der Frist-Lauf
   zur vollen Stunde schließt den Rückstau aus Schritt 0 ab (Anzahl im Log).
7. **Nach mindestens 7 Tagen: `users` schließen.** Den bisherigen Wert von List und View
   notieren. Dann beide auf diese Regel setzen (auch in `docs/pocketbase-regeln.md`, „users: List
   und View schließen“):
   ```
   @request.auth.id != "" && (id = @request.auth.id || @request.auth.supervisor = true || (organization_id != "" && organization_id = @request.auth.organization_id && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now)))
   ```
   Prüfen: ohne Anmeldung liefert `GET /api/collections/users/records` keine Einträge; Anmelden,
   Benutzerverwaltung, Patientenverwaltung (Mannschaft nachtragen) und Unitas gehen. Danach
   `node scripts/emails-verbergen.mjs` (Probelauf, zeigt die Zahl), dann mit `--ausfuehren`.
   Leitung und Benutzerverwaltung sehen E-Mails weiter, andere Mitglieder nicht.
8. **Später:** Create-Regeln der Formulare schließen (`docs/pocketbase-regeln.md`, „Öffentliche
   Formulare: später schließen“), frühestens nach dem 31.01.2027.

**Die Reihenfolge zählt:** Kämen die Hooks vor der App, würde die heute ausgelieferte App in allen
Organisationen beim Absenden der Patientendoku abgewiesen. Kämen die Felder vor den Hooks, ließen
sie sich fälschen (Schritt 5).

## Rücknahme

Nur `formular.pb.js` aus `/opt/pb_hooks` entfernen und neu starten (`mitglieder-namen.pb.js` kann
bei Bedarf mit raus). Die App nimmt dann den alten Weg (wie in Schritt 2 beschrieben); Geräte, die
den neuen Server in den letzten 24 Stunden gesehen haben, halten ihre Einträge so lange auf dem
Gerät. Ausstehende Protokolle bleiben offen und werden nicht selbst freigegeben (der neue
Frist-Lauf bleibt). „Unterschreiben“, „Das war ich nicht“ und „Ohne Unterschrift abschließen“
gehen erst wieder mit `formular.pb.js`; die App sagt das in den Dialogen.

**`formular-felder.pb.js` und `mpg.pb.js` bleiben liegen.** Sie halten die Statusfelder dicht,
solange `formular.pb.js` fehlt: Neue Sätze bekommen kein Statusfeld, bestehende behalten Feld und
Absender, bestätigte ändert ohne Anmeldung niemand, ausstehende niemand. Wer stattdessen alle
Dateien aus der Sicherung zurückspielt, löscht vorher die drei Felder aus Schritt 5; bei einer
späteren Wiedereinführung legt er sie wieder erst nach den Hooks an.

Die `users`-Regel aus Schritt 7 ist davon unabhängig; zurück geht sie mit den notierten Werten.

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
  Hinweis und wird dort ohne Unterschrift abgeschlossen; Produktausgabe und Defektmeldung stehen
  danach ohne Konto unter dem eingetragenen Namen.
- Sperren bei falschen Passwörtern, für die Bestätigung und die normale Anmeldung gemeinsam:
  Fünf falsche Passwörter für ein Konto von einer Adresse sperren dieses Konto von dort für 15
  Minuten. 30 falsche für ein Konto, von welchen Adressen auch immer, sperren es für alle
  Adressen, die es schon falsch versucht haben; eine Adresse ohne eigene Fehlversuche kommt mit
  dem richtigen Passwort weiter durch (so sperrt niemand ein Konto aus der Ferne, nur weil er den
  Namen kennt). 30 falsche Passwörter von einer Adresse, für beliebige Konten, sperren diese
  Adresse. IPv6 zählt je /64, dazu je /48 höchstens 100. Nach einem Neustart von PocketBase ist
  das zurückgesetzt.
- Die Prüfung der Hooks lief gegen PocketBase 0.28.4 und 0.40.5 (781 Prüfungen je Version, alle
  bestanden), auch der Weg „Felder vor den Hooks, erster Start, Rücknahme, Wiedereinführung“.
