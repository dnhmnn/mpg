# Responda Push-Dienst

Kleiner Dienst auf dem Server von PocketBase. Er nimmt von PocketBase fertige Benachrichtigungen an
und stellt sie über die Push-Dienste der Hersteller zu (Apple, Google, Mozilla, Microsoft).
PocketBase entscheidet, wer was bekommt; der Dienst prüft nur Form und Größe, erkennt Doppelte,
füllt jede Nachricht auf eine einheitliche Größe auf, verschlüsselt sie Ende zu Ende (Web Push,
RFC 8291), signiert mit dem VAPID-Schlüssel (RFC 8292) und sendet.

Warum ein eigener Dienst: Die JavaScript-Umgebung von PocketBase kann die nötige Kryptographie
nicht (ECDH P-256, HKDF, AES-128-GCM, ES256). Der private VAPID-Schlüssel liegt so nur hier.

**Push ist keine Alarmierung.** Nachrichten können sich verspäten oder ausbleiben. Was noch nicht
gesendet ist, geht bei einem Neustart des Dienstes verloren (bewusst: nur im Speicher).

Die ganze Einführung (PocketBase-Sammlungen, Hooks, Probe mit dem eigenen Gerät) steht in
`docs/push-einfuehrung.md`. Hier steht nur der Dienst selbst.

## Was der Dienst tut und lässt

- Hört nur auf `127.0.0.1` (oder `::1`), Port 8095. Er startet mit keiner anderen Adresse.
- Jede Anfrage außer `/v1/gesund` braucht das gemeinsame Geheimnis (gleich in beiden
  Umgebungsdateien).
- Sendet nur an die Push-Dienste der vier Hersteller (`fcm.googleapis.com`, `*.push.apple.com`,
  `push.services.mozilla.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`), nur über
  https auf Port 443. Weiterleitungen folgt er nicht.
- Hat keinen Zugang zu PocketBase. PocketBase holt jede Minute ab, welche Geräte nicht mehr
  erreichbar sind (nur Antworten 404 und 410), und löscht sie selbst.
- Schutz vor Massenlöschung: Kommen viele Antworten 401 oder 403 (falscher Schlüssel, falsches
  Subject), meldet er eine Warnung `auth` und hält alle Löschungen bis zu 24 Stunden zurück.
- Das Protokoll (journald) enthält nie Inhalte, Push-Adressen oder Schlüssel, nur Anzahlen,
  Status-Codes, den Host des Push-Dienstes und die Kennung des Geräts.

## Voraussetzungen

- Derselbe Linux-Server wie PocketBase, mit systemd.
- **Node.js 24 LTS** (mindestens 22; ältere Versionen lehnt der Dienst beim Start ab). Die Pakete
  der Distribution sind meist zu alt (Debian 12 und Ubuntu 24.04: Node 18, Debian 13: Node 20, beide
  ohne Pflege). Deshalb Node von NodeSource oder nodejs.org.
- Ausgehend https (Port 443) zu den Hosts oben.

## Einrichten

Alles als root, im Checkout des Repos auf dem Server (oder nach dem Hochladen von `dienste/push`).

```bash
# 1. Node 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh
apt install -y nodejs
node --version                                   # v24.x

# 2. Benutzer und Verzeichnisse
useradd --system --home /opt/responda-push --shell /usr/sbin/nologin responda-push
mkdir -p /opt/responda-push /etc/responda && chmod 700 /etc/responda

# 3. Dienst kopieren und Abhängigkeiten installieren (genau die Versionen aus package-lock.json)
cp -r dienste/push/. /opt/responda-push/
rm -rf /opt/responda-push/node_modules
cd /opt/responda-push && npm ci --omit=dev

# 4. Schlüssel und die zwei Umgebungsdateien erzeugen (Subject: https://responda.systems)
node schluessel-erzeugen.mjs --ziel /etc/responda
chown root:root /etc/responda/*.env && chmod 600 /etc/responda/*.env
chown -R root:root /opt/responda-push && chmod -R go-w,a+rX /opt/responda-push

# 5. systemd
cp /opt/responda-push/responda-push.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now responda-push

# 6. Prüfen
curl -s http://127.0.0.1:8095/v1/gesund          # {"ok":true}
journalctl -u responda-push -n 20                 # Zeile "ereignis":"start" mit "betrieb":true
systemd-analyze security responda-push            # Bewertung der Härtung, erwartet "OK"
```

`schluessel-erzeugen.mjs` schreibt:

| Datei | Für | Inhalt |
|---|---|---|
| `/etc/responda/push-dienst.env` | diesen Dienst | Adresse, Port, Geheimnis, VAPID-Schlüsselpaar, Subject, Grenzen |
| `/etc/responda/pocketbase-push.env` | PocketBase | `RESPONDA_PUSH_URL`, `RESPONDA_PUSH_GEHEIMNIS`, `RESPONDA_PUSH_SCHLUESSEL` (öffentlicher Schlüssel) |

Beide gehören root und sind nur für root lesbar (0600). systemd liest sie als root, bevor es die
Rechte abgibt; der Dienst selbst kann sie weder lesen noch ändern. Geheimnis und privater Schlüssel
stehen nie in der Ausgabe des Skripts. Das Skript überschreibt nie etwas ohne `--neu`.

## PocketBase anbinden

PocketBase braucht die Datei `pocketbase-push.env` in seiner systemd-Einheit. Der Name dieser
Einheit heißt bei Responda `pocketbase` (vom Owner nachgesehen am 16.11.2026). Auf einem anderen
Server findet man ihn so:

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
systemctl restart pocketbase
systemctl show pocketbase -p EnvironmentFiles   # zeigt /etc/responda/pocketbase-push.env
curl -s https://api.responda.systems/api/health
```

Läuft PocketBase nicht über systemd (etwa in Docker), die drei Werte aus `pocketbase-push.env` in
die Umgebung des Containers geben. Die Hook-Dateien und die Diagnose als Superuser
(`GET /api/responda/push/diagnose`) beschreibt `docs/push-einfuehrung.md`.

## Umgebung des Dienstes

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `PUSH_HOST` | `127.0.0.1` | nur `127.0.0.1` oder `::1` |
| `PUSH_PORT` | `8095` | Port |
| `PUSH_GEHEIMNIS` | (Pflicht) | mindestens 32 Zeichen, das Skript erzeugt 64 Hex-Zeichen; gleich wie `RESPONDA_PUSH_GEHEIMNIS` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | (Pflicht) | Schlüsselpaar P-256, base64url; müssen zueinander passen |
| `VAPID_SUBJECT` | (Pflicht) | `https://responda.systems`; steht in jeder Sendung an die Hersteller, also keine persönliche Mail-Adresse |
| `PUSH_GLEICHZEITIG` | `8` | höchstens so viele Sendungen zugleich |
| `PUSH_WARTESCHLANGE_MAX` | `10000` | darüber antwortet der Dienst 503, PocketBase versucht es später |
| `PUSH_BETRIEB` | | steht fest als `1` in der Einheit, nicht in der Datei |
| `PUSH_TEST_HOSTS`, `PUSH_TEST_CA` | | nur für Prüfungen; mit `PUSH_BETRIEB=1` startet der Dienst nicht |

## Schlüssel wechseln

Nur wenn nötig (etwa wenn der private Schlüssel bekannt geworden ist): Mit neuen Schlüsseln sind
alle bisherigen Abos ungültig, jedes Gerät muss Push neu einschalten. Die App heilt das beim
nächsten Öffnen, wo der Browser es ohne Tippen erlaubt; sonst zeigt sie „Push neu einschalten“.

```bash
node /opt/responda-push/schluessel-erzeugen.mjs --ziel /etc/responda --neu
chown root:root /etc/responda/*.env && chmod 600 /etc/responda/*.env
systemctl restart responda-push pocketbase
```

## Aktualisieren

```bash
systemctl stop responda-push
cp -r dienste/push/. /opt/responda-push/
rm -rf /opt/responda-push/node_modules
cd /opt/responda-push && npm ci --omit=dev
chown -R root:root /opt/responda-push && chmod -R go-w,a+rX /opt/responda-push
cp /opt/responda-push/responda-push.service /etc/systemd/system/ && systemctl daemon-reload
systemctl start responda-push && curl -s http://127.0.0.1:8095/v1/gesund
```

Beim Stoppen nimmt der Dienst nichts Neues mehr an und wartet laufende Sendungen höchstens
10 Sekunden ab. Was danach noch wartet, entfällt. Node mit `apt upgrade` aktuell halten; vor dem
Ende der Pflege von Node 24 (30.04.2028) auf die nächste LTS-Version wechseln.

## Rücknahme

Genau in dieser Reihenfolge, sonst entzieht iOS die Abos:

1. `push.pb.js` aus den PocketBase-Hooks entfernen und PocketBase neu starten. Ab jetzt sendet
   niemand mehr.
2. `systemctl disable --now responda-push`
3. Erst danach, wenn überhaupt, die App ohne `sw-push.js` veröffentlichen. Nie einen Service Worker
   ohne Push-Teil ausliefern, solange der Server noch sendet.

## Fehlersuche

```bash
journalctl -u responda-push -n 50
```

Jede Zeile ist JSON. Ereignisse: `start`, `auftrag` (Anzahl angenommen, doppelt, abgelehnt),
`sendung` (nur Fehler, Wiederholungen und `weg`), `bilanz`, `warnung`, `abgewiesen` (falsches
Geheimnis), `voll`, `beenden`, `ende`. Startet der Dienst nicht, steht der Grund in einer Zeile
„Responda Push-Dienst startet nicht: …“.

Stand abfragen (nur Zahlen; das Geheimnis erscheint dabei nicht in der Prozessliste):

```bash
curl -s -H @<(printf 'Authorization: Bearer %s\n' "$(sed -n 's/^PUSH_GEHEIMNIS=//p' /etc/responda/push-dienst.env)") http://127.0.0.1:8095/v1/stand
```

Häufige Fälle:

- **PocketBase meldet 401 vom Dienst**: Die Geheimnisse in den beiden Dateien sind verschieden.
  Vergleichen, ohne sie anzuzeigen:
  `[ "$(sed -n 's/^PUSH_GEHEIMNIS=//p' /etc/responda/push-dienst.env)" = "$(sed -n 's/^RESPONDA_PUSH_GEHEIMNIS=//p' /etc/responda/pocketbase-push.env)" ] && echo gleich || echo verschieden`
- **Warnung `auth`** (Journal, `/v1/stand`, Diagnose in PocketBase): Die Push-Dienste lehnen die
  Signatur ab. VAPID-Schlüsselpaar und `VAPID_SUBJECT` prüfen. Solange die Warnung steht, löscht
  PocketBase keine Geräte.
- **Diagnose: Schlüssel ungleich**: `RESPONDA_PUSH_SCHLUESSEL` in `pocketbase-push.env` passt nicht
  zu `VAPID_PUBLIC_KEY`; Geräte könnten sich nicht anmelden. Beide Dateien stammen aus demselben
  Lauf des Skripts; nach `--neu` beide Dienste neu starten.
- **`voll`**: Mehr als `PUSH_WARTESCHLANGE_MAX` Nachrichten warten; meist sind die Push-Dienste
  gerade nicht erreichbar (Netz, Firewall für ausgehendes https).

## Prüfungen (Entwicklung)

```bash
cd dienste/push && npm ci && npm test
```

Node 22 oder neuer und `openssl` (für das Prüfzertifikat des falschen Endpunkts; ohne `openssl`
werden diese Fälle mit Meldung übersprungen). Die CI (`.github/workflows/pruefung.yml`) prüft mit
Node 24. Der falsche Endpunkt für die Browserprobe: `node test/fake-endpunkt.mjs --port <port>
--ca-ziel <verzeichnis>` (Beschreibung im Kopf der Datei).
