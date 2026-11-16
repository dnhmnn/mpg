# Push-Benachrichtigungen. Einführung

Notiz für den Owner. Was neu ist, was schon vor den Schritten auf dem Server geht, und in welcher
Reihenfolge du Push einführst. Sammlungen, Felder, Regeln und Routen im Einzelnen:
`docs/pocketbase-regeln.md`, Abschnitte „hub_notifications: Mitteilungen“ und
„Push-Benachrichtigungen“. Der Push-Dienst selbst (Umgebung, Härtung, Fehlersuche):
`dienste/push/README.md`.

**Push ist keine Alarmierung.** Benachrichtigungen können sich verspäten oder ausbleiben
(Stromsparen, Nicht stören, kein Netz, Neustart des Dienstes). Die App sagt das an jeder Stelle,
an der man Push einstellt.

## 1. Was neu ist

- **Benachrichtigungen auf dem Gerät**, auch wenn Responda geschlossen ist: Telefon, Tablet und
  Rechner. Jede Person schaltet Push auf jedem ihrer Geräte selbst ein, unter Profil (oben rechts
  im Hub) → **Benachrichtigungen** oder Einstellungen → Benachrichtigungen → Push-Benachrichtigungen.
- **Anlässe**: Mitteilung der Organisation (immer), Wartet auf deine Unterschrift, Neues
  Patientenprotokoll, MPG (Gerät gesperrt, Defekt oder Meldung von außen, Prüfungen bald fällig),
  Lager (unter Mindestbestand, abgelaufen, läuft bald ab, offene Produktausgabe), Neue Einsendung,
  CIRS (neu, überfällig), Ausbildung (Zu- und Absagen). Jede Person bekommt nur, was sie in der App
  auch öffnen darf, und schaltet einzelne Anlässe für sich ab.
- **Leitung bestimmt für die Organisation**: Auf der Seite Benachrichtigungen steht für die
  Leitung „Für die Organisation festlegen“. Was dort aus ist, bekommt in der Organisation niemand.
- **Mitteilung an die Organisation** (neu für die Leitung): Auf derselben Seite schickt die
  Leitung (Rolle Leitung) eine Mitteilung an alle Mitglieder der eigenen Organisation, mit
  Vorschau, wie sie im Hub und auf dem Sperrbildschirm erscheint, und Rückfrage vor dem Senden.
  Sie steht im Hub hinter der Glocke und kommt per Push, auch an Teilnehmende und auch in der
  Ruhezeit (lässt sich je Person abschalten). Höchstens drei neue Mitteilungen je Organisation in
  24 Stunden; du als Supervisor bist davon ausgenommen und schickst wie bisher über die
  Supervisor-Seite an jede Organisation.
- **Ruhezeit** je Person (Voreinstellung 22:00 bis 06:00 Uhr, deutsche Zeit): Was in die Ruhezeit
  fällt, kommt an ihrem Ende als eine Nachricht.
- **Morgens und montags**: STK/MTK überfällig und abgelaufene Artikel kommen morgens ab 6 Uhr,
  der Wochenüberblick (Prüfungen bald fällig, Artikel laufen ab, CIRS überfällig) montags ab 7 Uhr.
  Beim allerersten Lauf je Organisation kommt nichts zum Altbestand, nur was danach neu dazukommt.
- **Viele Ereignisse auf einmal**: Mehr als 8 in 10 Minuten fasst Responda zu einer Nachricht
  zusammen.
- **iPhone und iPad**: nur in der App vom Homebildschirm (in Safari: Teilen, dann Zum
  Home-Bildschirm), ab iOS bzw. iPadOS 16.4. Die App erklärt das, wenn jemand es in Safari
  versucht. Die Fassung aus dem App Store (Capacitor) kann noch kein Push.
- **Abgelaufene Anmeldung**: Ist die Anmeldung auf dem Gerät abgelaufen oder hat sich dort jemand
  anderes angemeldet, zeigt das Gerät nur „Es gibt Neues in Responda.“ ohne Einzelheiten. Nach der
  Anmeldung kommen wieder Einzelheiten. Beim Abmelden schaltet Responda Push auf dem Gerät aus
  und schließt angezeigte Benachrichtigungen.
- **Neues Passwort und verlorenes Gerät**: Ein neues Passwort (selbst gesetzt, über den Link oder
  vom Supervisor) meldet alle Geräte der Person beim Server ab, denn alle Anmeldungen sind dann
  ungültig. Nach der nächsten Anmeldung meldet sich das Gerät von selbst wieder an. Ist ein Telefon
  verloren: neues Passwort setzen, das Konto sperren oder das Gerät in der Geräteliste
  (Benachrichtigungen, Angemeldete Geräte) auf einem anderen Gerät abmelden.
- **Datenschutz**: Patientendaten, den Text einer CIRS-Meldung oder eines Defekts und
  E-Mail-Adressen enthalten Benachrichtigungen nie. Die Push-Dienste von Apple, Google, Mozilla
  und Microsoft sehen nur verschlüsselte, gleich große Nachrichten. Datenschutzerklärung
  (Abschnitt 6) und AVV sind ergänzt.

## 2. Was schon vor den Schritten geht

Die App kann vor allem anderen veröffentlicht werden. Nichts geht kaputt:

- Die Seite Benachrichtigungen zeigt „Push ist auf dem Server noch nicht eingerichtet.“ und keinen
  Schalter, solange `push.pb.js` fehlt oder Sammlungen, Felder oder die Umgebung fehlen.
- Formulare, MPG, Lager, CIRS und Mitteilungen gehen wie bisher. Die Hooks schreiben nichts,
  solange Push nicht vollständig eingerichtet ist (einmal je Start eine Warnung im Log).
- Läuft der Dienst nicht (oder hängt er), melden sich Geräte trotzdem an; Benachrichtigungen
  warten in PocketBase und gehen raus, sobald der Dienst wieder antwortet (bis zu 5 Versuche über
  rund eine halbe Stunde). Eine Anfrage, die gerade dann kommt, wartet höchstens eine Sekunde,
  danach einreihen ohne Warten für eine Minute.

## 3. Dienst einrichten (als root auf dem Server)

Im Checkout des Repos auf dem Server (oder nach dem Hochladen von `dienste/push`):

```bash
# 1. Node 24 LTS. Die Pakete der Distribution sind zu alt (Debian 12 und Ubuntu 24.04: 18,
#    Debian 13: 20, beide ohne Pflege); der Dienst startet nicht mit Node unter 22.
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh
apt install -y nodejs
node --version                                   # v24.x

# 2. Benutzer und Verzeichnisse
useradd --system --home /opt/responda-push --shell /usr/sbin/nologin responda-push
mkdir -p /opt/responda-push /etc/responda && chmod 700 /etc/responda

# 3. Dienst kopieren, genau die Versionen aus package-lock.json installieren
cp -r dienste/push/. /opt/responda-push/
rm -rf /opt/responda-push/node_modules
cd /opt/responda-push && npm ci --omit=dev

# 4. Schlüssel und die zwei Umgebungsdateien (Subject https://responda.systems, keine Mail-Adresse)
node schluessel-erzeugen.mjs --ziel /etc/responda
chown root:root /etc/responda/*.env && chmod 600 /etc/responda/*.env
chown -R root:root /opt/responda-push && chmod -R go-w,a+rX /opt/responda-push

# 5. systemd
cp /opt/responda-push/responda-push.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now responda-push

# 6. Prüfen
curl -s http://127.0.0.1:8095/v1/gesund          # {"ok":true}
journalctl -u responda-push -n 20                 # Zeile "ereignis":"start" mit "betrieb":true
```

`schluessel-erzeugen.mjs` schreibt `/etc/responda/push-dienst.env` (für den Dienst) und
`/etc/responda/pocketbase-push.env` (für PocketBase), beide nur für root lesbar. Das Skript zeigt
weder Geheimnis noch privaten Schlüssel und überschreibt nie etwas ohne `--neu`. Die Dateien
gehören nicht ins Repo und nicht in eine Mail.

## 4. PocketBase: Sammlungen, Felder, Regeln

Im Admin von PocketBase (`https://api.responda.systems/_/`), Werte genau wie in
`docs/pocketbase-regeln.md`, „Push-Benachrichtigungen“:

1. **Neue Sammlung `push_geraete`.** New collection → Typ **Base**, Name `push_geraete`. Felder
   (alle Plain text, wenn nicht anders gesagt): `user_id` (Nonempty, Max length 30),
   `organization_id` (Max 30), `endpoint` (Nonempty, Max 1000), `endpoint_hash` (Nonempty, Max 64),
   `p256dh` (Nonempty, Max 200), `auth` (Nonempty, Max 100), `geraet` (Max 80), `gemeldet_am`
   (**Date**). Unter **Indexes** die zwei Zeilen aus der Doku einfügen (der eindeutige Index auf
   `endpoint_hash` ist Pflicht). **API Rules: alle fünf gesperrt lassen** (Schloss). Speichern.
2. **Neue Sammlung `push_warteschlange`.** Typ Base. Felder: `user_id` (Nonempty, Max 30),
   `organization_id` (Max 30), `anlass` (Nonempty, Max 40), `kontext` (**JSON**, Max size 1000),
   `schluessel` (Nonempty, Max 64), `grund` (Max 20), `faellig_am` (**Date**, Nonempty),
   `versuche` (**Number**), `lauf` (Max 20), `buendel` (Max 40). Drei Indizes aus der Doku. Regeln
   gesperrt lassen.
3. **Neue Sammlung `push_merker`.** Typ Base. Felder: `schluessel` (Nonempty, Max 200), `art`
   (Nonempty, Max 40), `organization_id` (Max 30), `wert` (**JSON**, Max size 2000), `bis`
   (**Date**). Drei Indizes aus der Doku (der eindeutige auf `schluessel` ist Pflicht). Regeln
   gesperrt lassen.
4. **Feld `push_einstellungen` an `users`.** Collections → `users` → Fields → New field: Typ
   **JSON**, Name `push_einstellungen`, nicht Pflicht, Max size **2000**, und unter den Optionen des
   Felds **Hidden** einschalten. Speichern.
5. **Feld `push_anlaesse` an `organizations`.** Typ **JSON**, nicht Pflicht, Max size **1000**,
   **Hidden** an. Speichern. (`organizations` ist öffentlich lesbar; ohne Hidden wäre die
   Einstellung der Organisation für jeden lesbar. Die Diagnose warnt dann.)
6. **Regeln von `hub_notifications`.** Collections → `hub_notifications` → Zahnrad → API Rules.
   **Vorher die fünf alten Regeln notieren** (abschreiben oder ein Bild machen). Dann die fünf
   Regeln aus `docs/pocketbase-regeln.md`, „hub_notifications: Mitteilungen“ eintragen, jede
   einzeln und ohne Zeilenumbruch: List/Search und View (angemeldet, eigene Organisation,
   Supervisor alle), Create, Update und Delete (Supervisor oder Leitung der eigenen Organisation,
   aktives Konto). Speichern. Ohne die Update-Regel für die Leitung scheitert in der App
   „Zurückziehen“. Schick mir die notierten alten Regeln (Owner-Frage 12.5), dann gleiche ich
   ab, ob vorher jemand mehr durfte.

**Indizes per Befehl.** Im Index-Dialog des Admins kam es vor, dass die Indizes nicht gespeichert
wurden (etwa wenn mehrere Zeilen in ein Index-Feld kamen). Sicherer setzt sie dieser Befehl, auf
dem Server als root. Er ändert nur die Indizes der drei Sammlungen; Felder und gesperrte Regeln
bleiben (geprüft mit 0.28.4 und 0.40.5). Erwartet ist je Sammlung `OK` mit ihren Indizes.

```bash
PB=https://api.responda.systems
read -r -p 'Superuser-E-Mail: ' SU_MAIL; read -r -s -p 'Passwort: ' SU_PW; echo
TOKEN=$(curl -s -X POST "$PB/api/collections/_superusers/auth-with-password" -H 'Content-Type: application/json' \
  -d "$(printf '{"identity":"%s","password":"%s"}' "$SU_MAIL" "$SU_PW")" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'); unset SU_PW
idx() {
  curl -s -X PATCH "$PB/api/collections/$1" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d "$2" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(sys.argv[1]+":", "OK" if "indexes" in d else "FEHLER"); [print("   ", i) for i in d.get("indexes",[])]; "indexes" in d or print("   ", d)' "$1"
}
idx push_geraete '{"indexes":["CREATE UNIQUE INDEX idx_push_geraete_hash ON push_geraete (endpoint_hash)","CREATE INDEX idx_push_geraete_user ON push_geraete (user_id)"]}'
idx push_warteschlange '{"indexes":["CREATE INDEX idx_push_ws_faellig ON push_warteschlange (faellig_am)","CREATE INDEX idx_push_ws_user ON push_warteschlange (user_id)","CREATE INDEX idx_push_ws_lauf ON push_warteschlange (lauf)"]}'
idx push_merker '{"indexes":["CREATE UNIQUE INDEX idx_push_merker_schluessel ON push_merker (schluessel)","CREATE INDEX idx_push_merker_org_art ON push_merker (organization_id, art)","CREATE INDEX idx_push_merker_bis ON push_merker (bis)"]}'
unset TOKEN
```

An den Regeln von `users` und `organizations` ändert sich nichts: Versteckte Felder kann über die
API niemand schreiben, nur die Push-Routen.

## 5. PocketBase: Umgebung und Hooks

Bei Responda heißt die systemd-Einheit von PocketBase `pocketbase` (vom Owner nachgesehen am
16.11.2026). Auf einem anderen Server findest du den Namen so:

```bash
systemctl list-units --type=service --all | grep -i pocketbase
# Heißt sie anders: die Einheit zum laufenden Programm anzeigen lassen
systemctl status "$(pgrep -f 'pocketbase serve' | head -1)" | head -1
```

Dann:

```bash
systemctl edit pocketbase
# im Editor zwischen den Kommentaren eintragen und speichern:
#   [Service]
#   EnvironmentFile=/etc/responda/pocketbase-push.env
cp pb_hooks/push.pb.js pb_hooks/push-regeln.js pb_hooks/push-fristen.js pb_hooks/push-versand.js pb_hooks/lager-regeln.js /opt/pb_hooks/
systemctl restart pocketbase
systemctl show pocketbase -p EnvironmentFiles     # zeigt /etc/responda/pocketbase-push.env
curl -s https://api.responda.systems/api/health
```

(`/opt/pb_hooks` ist der Hook-Ordner wie bei den bisherigen Hooks. `lager-regeln.js` ist die neue
Fassung; die Lager-Mail an die Leitung bleibt wörtlich gleich.) Läuft PocketBase nicht über
systemd, die drei Werte aus `pocketbase-push.env` in seine Umgebung geben.

**Diagnose** (nur Superuser). Das Passwort wird abgefragt und landet nicht im Verlauf der Shell:

```bash
read -r -p 'Superuser-E-Mail: ' SU_MAIL; read -r -s -p 'Passwort: ' SU_PW; echo
TOKEN=$(curl -s -X POST https://api.responda.systems/api/collections/_superusers/auth-with-password \
  -H 'Content-Type: application/json' \
  -d "$(printf '{"identity":"%s","password":"%s"}' "$SU_MAIL" "$SU_PW")" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s -H "Authorization: $TOKEN" https://api.responda.systems/api/responda/push/diagnose | python3 -m json.tool
unset SU_PW TOKEN
```

Erwartet:

- `sammlungen`: alle drei `true`; `felder`: beide `da: true` und `versteckt: true`;
  `regeln_offen`: leer.
- `dienst`: `konfiguriert`, `erreichbar` und `schluessel_gleich` `true`, `schutzschalter` `false`.
- `regeln.hub_notifications`: die eben eingetragenen Regeln.
- `warnungen`: leer. Jede Warnung ist ein deutscher Satz und sagt, was zu tun ist (z. B. Feld nicht
  versteckt, Create- oder Update-Regel von `hub_notifications` offen, Schlüssel ungleich,
  Prüfbetrieb gesetzt).

## 6. Probe mit dem eigenen Gerät

1. iPhone: Responda in Safari öffnen, Teilen → Zum Home-Bildschirm, dann Responda **vom
   Homebildschirm** öffnen und anmelden. Android und Rechner: einfach im Browser.
2. Profil (oben rechts im Hub) → **Benachrichtigungen** → „Push auf diesem Gerät“ einschalten
   und die Frage des Geräts erlauben.
3. **Probe senden**. Nach wenigen Sekunden erscheint „Responda: Probe“. Tippen öffnet die Seite
   Benachrichtigungen.
4. Unter „Angemeldete Geräte“ steht das Gerät als „Dieses Gerät“.
5. Als Supervisor eine Mitteilung an deine Organisation (Supervisor-Seite) schicken, aktiv: Sie
   kommt als „<Name der Organisation>: <Titel>“ mit dem Text auf das Gerät. Danach löschen.

Kommt nichts: Diagnose (Abschnitt 5), `journalctl -u responda-push -n 50`, und am iPhone
Einstellungen → Mitteilungen → Responda.

## 7. Was Leitungen und Personen einstellen

- **Jede Person** (Seite Benachrichtigungen): Push je Gerät an oder aus, „Probe senden“, Anlässe
  für ihr Konto (gilt auf allen ihren Geräten), Ruhezeit, ob Mitteilungen auch in der Ruhezeit
  kommen, angemeldete Geräte (ein altes Gerät lässt sich hier abmelden; es meldet sich dann nicht
  still wieder an, erst wenn auf ihm jemand Push ausdrücklich wieder einschaltet).
- **Leitung** (Rolle Leitung oder Recht Benutzerverwaltung, auch befristet): „Für die Organisation
  festlegen“, welche Anlässe in der Organisation überhaupt kommen. Die Mitteilung kommt immer.
- **Mitteilung an die Organisation**: nur Rolle Leitung (und du als Supervisor). Benutzerverwaltung
  ohne Rolle Leitung legt Anlässe fest, schickt aber keine Mitteilungen.
- Bitte die Leitungen informieren: was Push ist und was nicht (keine Alarmierung), dass iPhones die
  App vom Homebildschirm brauchen, und dass Mitteilungen an alle gehen, auch nachts, wenn jemand
  das so eingestellt hat (Voreinstellung).

## 8. Schlüssel wechseln, Dienst aktualisieren, Rücknahme, Fehlersuche

**Schlüssel wechseln** (nur wenn nötig, etwa wenn der private Schlüssel bekannt geworden ist): Alle
bisherigen Abos werden ungültig. Die App heilt das beim nächsten Öffnen, wo der Browser es ohne
Tippen erlaubt; sonst zeigt sie „Push neu einschalten“ (Seite Benachrichtigungen und Profil). Den
alten Eintrag des Geräts löscht der Server dabei selbst. Geräte, auf denen die App bis dahin nicht
geöffnet wird, bleiben bis zum Höchstalter von 180 Tagen in der Liste; Sendungen an sie scheitern mit
403, und solange das viele sind, hält der Dienst zur Sicherheit auch das Löschen abgemeldeter Geräte
zurück (Warnung `auth` in der Diagnose). Den Schlüssel deshalb nur wechseln, wenn es sein muss.

```bash
node /opt/responda-push/schluessel-erzeugen.mjs --ziel /etc/responda --neu
chown root:root /etc/responda/*.env && chmod 600 /etc/responda/*.env
systemctl restart responda-push pocketbase
```

**Dienst aktualisieren** (nach einer neuen Fassung von `dienste/push`):

```bash
systemctl stop responda-push
cp -r dienste/push/. /opt/responda-push/
rm -rf /opt/responda-push/node_modules
cd /opt/responda-push && npm ci --omit=dev
chown -R root:root /opt/responda-push && chmod -R go-w,a+rX /opt/responda-push
cp /opt/responda-push/responda-push.service /etc/systemd/system/ && systemctl daemon-reload
systemctl start responda-push && curl -s http://127.0.0.1:8095/v1/gesund
```

Node mit `apt upgrade` aktuell halten; vor dem Ende der Pflege von Node 24 (30.04.2028) wechseln.

**Rücknahme**, genau in dieser Reihenfolge (sonst entzieht iOS die Abos):

1. `push.pb.js` aus `/opt/pb_hooks` entfernen, `systemctl restart pocketbase`. Ab jetzt sendet
   niemand mehr.
2. `systemctl disable --now responda-push`.
3. Erst danach, wenn überhaupt, eine App ohne `sw-push.js` veröffentlichen. Nie einen Service
   Worker ohne Push-Teil ausliefern, solange der Server noch sendet.

Sammlungen und Felder können bleiben. Die Regeln von `hub_notifications` mit der Leitung bleiben
gültig; ohne `push.pb.js` gibt es aber keine Drossel und keine Längenprüfung für die Leitung. Wer
das nicht will, setzt die notierten alten Regeln wieder ein.

**Fehlersuche**:

- **Diagnose** zuerst (Abschnitt 5); sie nennt fast jeden Fehler als Satz.
- **PocketBase meldet 401 vom Dienst**: Die Geheimnisse in den beiden Umgebungsdateien sind
  verschieden. Vergleichen, ohne sie anzuzeigen: siehe `dienste/push/README.md`, Fehlersuche.
- **Warnung `auth`**: Die Push-Dienste lehnen die Signatur ab (VAPID-Schlüssel oder Subject
  prüfen). Solange die Warnung steht, löscht PocketBase keine Geräte.
- **„Der Push-Dienst antwortet gerade nicht“** bei „Probe senden“: Dienst läuft nicht
  (`systemctl status responda-push`) oder PocketBase hat die Umgebung nicht (Abschnitt 5,
  `systemctl show … -p EnvironmentFiles`).
- **iPhone ohne Schalter**, nur der Hinweis zum Homebildschirm: Responda wurde in Safari geöffnet,
  nicht vom Homebildschirm.
- **„Benachrichtigungen sind für Responda abgelehnt“**: in den Einstellungen des Geräts
  (Mitteilungen) oder des Browsers (Website-Einstellungen) erlauben.
- **Leitung bekommt beim Senden 429**: drei Mitteilungen in 24 Stunden sind erreicht; der Text
  sagt, wann die nächste geht.

## 9. Geteilte Geräte

Benachrichtigungen nennen Einzelheiten (Gerätenamen, Titel und Text der Mitteilung, wer zu einer
Ausbildung abgesagt hat) und stehen je nach Einstellung auf dem Sperrbildschirm. Auf Geräten, die
mehrere benutzen (Fahrzeug-Tablet, Wachen-PC), besser kein Push einschalten oder im Betriebssystem
die Vorschau auf dem Sperrbildschirm ausschalten. Wer sich abmeldet, schaltet Push auf dem Gerät
aus; meldet sich jemand anderes an, schaltet Responda Push der vorigen Person dort ab.

## 10. Offene Punkte für dich

- **Regeln, die nicht im Repo stehen** (12.5): die List-Regel von `patients` und die Regeln von
  `ausbildungen_termine_user` stehen in der Diagnose (`regeln`). Bitte schicken, dann gleiche ich
  die Empfänger von „Neues Patientenprotokoll“ und „Ausbildung“ genau daran an.
- **Rechtliches** (12.6): Datenschutzerklärung (Abschnitt 6) und AVV (§ 2, § 5, § 6) vor dem
  Einschalten von Push rechtlich prüfen lassen, auch ob Organisationen, die den AVV schon
  unterschrieben haben, vorher über die neuen Unterauftragsverarbeiter informiert werden müssen.
- Vor dem Veröffentlichen am iPhone (Safari, iOS 26) die Seite Benachrichtigungen ansehen, wie in
  CLAUDE.md beschrieben: kurze und lange Seite, oben, beim Scrollen und ganz unten.
