# PocketBase: API-Regeln

Die API-Regeln entscheiden auf dem Server, wer welche Datensätze sieht und
ändert. Die App filtert zusätzlich, ersetzt die Regeln aber nicht: Ohne Regel
kann jeder angemeldete Benutzer per API alles abfragen.

Eintragen in PocketBase: *Collections → Sammlung → Zahnrad → API Rules*.
Jede Regel unten ist gegen PocketBase 0.28.4 und 0.40.5 mit zwei
Organisationen geprüft.

## unitas_neuigkeiten

Neuigkeiten in Unitas. Jede Organisation sieht nur ihre eigenen; anlegen,
ändern und löschen dürfen Supervisor und Benutzer mit dem Recht
Benutzerverwaltung — nur in der eigenen Organisation. Einträge ohne
Organisation sieht niemand mehr (im Admin-Bereich zuordnen oder löschen).

**List/Search**
```
@request.auth.id != "" && organisation_id != "" && organisation_id = @request.auth.organization_id
```

**View**
```
@request.auth.id != "" && organisation_id != "" && organisation_id = @request.auth.organization_id
```

**Create**
```
@request.auth.id != "" && @request.body.organisation_id = @request.auth.organization_id && (@request.auth.supervisor = true || @request.auth.permissions.unitarii = true)
```

**Update**
```
@request.auth.id != "" && organisation_id = @request.auth.organization_id && (@request.auth.supervisor = true || @request.auth.permissions.unitarii = true) && (@request.body.organisation_id:isset = false || @request.body.organisation_id = @request.auth.organization_id)
```

**Delete**
```
@request.auth.id != "" && organisation_id = @request.auth.organization_id && (@request.auth.supervisor = true || @request.auth.permissions.unitarii = true)
```

## cirs_reports

CIRS-Meldungen. Melden darf jeder über die Seite der Organisation; lesen und
bearbeiten nur Supervisor und Benutzer mit dem Recht Vorgänge, nur in der
eigenen Organisation. Dazu gehört der Hook `pb_hooks/cirs.pb.js`.

**Create**
```
organization_id != ""
```

**List/Search**, **View** und **Update**
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.supervisor = true || @request.auth.permissions.dokumente = true)
```

**Delete**: gesperrt — in der Admin-Oberfläche das Schloss stehen lassen
(null), nicht leeren Text eintragen (das hieße „öffentlich“).

Befristete Vorgänge-Rechte sind hier bewusst nicht drin (siehe unten); wer
das Recht nur befristet hat, sieht CIRS-Meldungen über die API nicht.

## Befristete Rechte in Regeln

PocketBase vergleicht das Ablaufdatum (`temp_permissions.<recht>.until`) als
**Text** mit `@now`. Das stimmt nur, wenn beide dasselbe Format haben:
`2026-10-15 08:00:00.000Z` — mit Leerzeichen, nicht mit „T“. Früher speicherte
die App das ISO-Format (`2026-10-15T07:00:00.000Z`); ein am selben Tag
abgelaufenes Recht hätte dann bis Mitternacht (UTC) weiter gegolten.

Seit dem Lager-Paket 4 speichert die Benutzerverwaltung das Ablaufdatum im
PocketBase-Format. Regeln prüfen befristete Rechte deshalb so — nur Einträge im
neuen Format zählen, alte (mit „T“) werden sicher abgelehnt, bis sie neu
vergeben werden:
```
(@request.auth.temp_permissions.<recht>.until ~ " " && @request.auth.temp_permissions.<recht>.until > @now)
```
Geprüft auf PocketBase 0.28.4 und 0.40.5: gültig → erlaubt, eine Minute
abgelaufen → abgelehnt, altes Format → abgelehnt. Die Lager-Regeln unten nutzen
das bereits; für andere Bereiche (z. B. CIRS oben) lässt es sich genauso ergänzen.

## Lager: Buchungen (inventory_transactions, inventory_stock)

Jede Lagerbuchung läuft über `src/lib/lagerBuchung.ts`: Bestand und Journal
gehen als **eine** Sammelbuchung (Batch) an PocketBase — alles oder nichts —,
die erste Journalzeile trägt eine im Gerät vergebene ID. Kommt nach einem
Abbruch dieselbe Buchung noch einmal, lehnt der Server die doppelte ID ab:
gebucht wird genau einmal.

**Einstellungen → Application → Batch API einschalten** (Max. Anfragen 50 oder
mehr). Ohne Batch bucht die App Anfrage für Anfrage; reißt dabei mittendrin die
Verbindung ab, kann eine Buchung teilweise ankommen. Die App meldet das dann
(„Bestand zählen, notfalls per Inventur korrigieren“) und wiederholt nicht.

Felder an `inventory_transactions` (Typ *Plain text*, nicht Pflicht):

- `vorgang` — alle Zeilen einer Buchung tragen dieselbe Nummer; das Logbuch
  fasst sie damit exakt zusammen.
- `storno_von` — eine Rücknahme („Rückgängig“) verweist auf ihre Originalzeile.
- `erfasst_am` (Typ *Date*) — bei offline erfassten Buchungen der echte Zeitpunkt
  der Entnahme; `created` ist dann der Zeitpunkt der Übertragung.

Fehlen die Felder, verwirft PocketBase die Werte ohne Fehler; das Logbuch
fasst dann nach Zeitnähe zusammen und ordnet Rücknahmen derselben Person zu.

Empfohlen an `inventory_stock.quantity`: **Min 0**. Dann scheitert eine
Entnahme, die gleichzeitig ein anderes Gerät schon vorgenommen hat, als Ganzes,
und die App plant mit dem frischen Bestand neu, statt ins Minus zu buchen.

Indizes für das Logbuch (optional): `organization_id, created` und
`organization_id, location_id, created`, dazu `vorgang`.

## Lager: API-Regeln

Seit Paket 4 braucht im Lager nur noch das Gefährliche das Recht **Lager
verwalten**: Artikel und Standorte archivieren oder löschen, die Einstellungen
(`lager_settings`, darunter „Statistik ab Datum“) und volle Bestandszeilen
löschen. Buchen, Artikel und Stammdaten pflegen, Inventur und Bestellen bleiben
beim Recht **Lager**. Buchungen sind unveränderlich: Ein Fehler wird nie
geändert oder gelöscht, sondern mit einer Gegenbuchung (Stornieren) korrigiert.

„Lager verwalten“ haben automatisch die Rollen `admin`, `lager` (Lagerwart) und
`mpg` sowie Supervisor; sonst das Häkchen `permissions.lager_verwalten`. Die App
blendet nur aus (`src/lib/lagerRechte.ts`) — durchgesetzt wird es hier.

Geprüft gegen **PocketBase 0.28.4 und 0.40.5**, mit zwei Organisationen und
Admin, Lagerwart, MPG-Beauftragtem, Helfer (nur Lager), Benutzer ohne Lager,
Supervisor, Ausbildungs-Verwalter, Teilnehmer und einem Admin der anderen
Organisation. Jede Regel wurde mit Einzelanfragen und als Sammelbuchung (Batch)
geprüft: 1278 Prüfungen je Version (auch mit befristeten Rechten), alle bestanden.

Eintragen: *Collections → Sammlung → Zahnrad → API Rules*. **Gesperrt** heißt:
Schloss stehen lassen (null), nicht leeren Text eintragen — leer heißt
„öffentlich“.

### Vorher

1. Felder anlegen (alle nicht Pflicht):
   - `inventory_items.archiviert` und `inventory_locations.archiviert` — *Bool*
   - `inventory_transactions.user_id` — *Plain text* (setzt der Hook aus der
     Anmeldung; bewusst keine Relation: Wird ein Konto gelöscht, würde
     PocketBase sonst still die Journalzeilen ändern)
   - `inventory_transactions.storno_von` — *Plain text* (falls noch nicht da)
   - `lager_settings.statistik_ab` — *Date*
2. `pb_hooks/lager.pb.js` nach **`/opt/pb_hooks`** kopieren und PocketBase neu
   starten (siehe unten).
3. Batch muss an sein (*Einstellungen → Application → Batch API*, siehe
   Abschnitt oben). Ohne Batch bucht die App Anfrage für Anfrage; scheitert
   dabei eine Anfrage, lassen sich die schon geschriebenen Journalzeilen nicht
   mehr löschen — die App meldet die Buchung dann als „teilweise übertragen“.
4. Sind `item_id` oder `location_id` in `inventory_transactions` als Relation
   angelegt: **Cascade delete aus**. Sonst löscht PocketBase beim Löschen eines
   Artikels dessen Buchungen mit — der Hook bemerkt das nicht, weil es keine
   API-Anfrage ist.

### Bausteine

Recht **Lager**:
```
(@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now))
```

Recht **Lager verwalten** (Regeln verlangen es immer zusätzlich zu „Lager“):
```
(@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now))
```

Daraus die vier Regeln, die sich unten wiederholen:

**L — Lesen** (Organisation + Lager)
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now))
```

**A — Anlegen** (nur in der eigenen Organisation)
```
@request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now))
```

**Ä — Ändern** (Organisation + Lager, nicht in eine andere Organisation verschieben)
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)
```

**V — Verwalten** (Organisation + Lager + Lager verwalten)
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now))
```

Befristete Rechte zählen mit (siehe „Befristete Rechte in Regeln“ oben): Wer
„Lager“ oder „Lager verwalten“ befristet bekommen hat, darf bis zum Ablauf —
auf die Sekunde. Befristungen von vor Paket 4 (altes Datumsformat) zählen nicht;
einfach neu vergeben.

### Übersicht

| Collection | List/View | Create | Update | Delete |
|---|---|---|---|---|
| `inventory_items` | öffentlich (vorerst) | A | Artikel/Standorte ¹ | V |
| `inventory_locations` | öffentlich (vorerst) | A | Artikel/Standorte ¹ | V |
| `inventory_stock` | L | A | Ä | Bestand ² |
| `inventory_transactions` | L | Buchung ³ | gesperrt | gesperrt |
| `lager_settings` | L | Einstellungen ⁴ | Einstellungen ⁴ | gesperrt |
| `inventory_audits` | L | A | Inventur ⁵ | Inventur ⁵ |
| `inventory_audit_items` | L | A | Ä | Inventurposition ⁶ |
| `inventory_kits` | L | A | Ä | V |
| `inventory_kit_checks` | L | A | V | V |
| `inventory_orders` | L | A | Ä | V |

**¹ Artikel und Standorte — Update.** Name, Einheit, Soll, Codes usw. darf jeder
mit Lager-Recht ändern; wer `archiviert` mitschickt (archivieren oder
wiederherstellen), braucht „Lager verwalten“.
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id) && (@request.body.archiviert:isset = false || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now)))
```

**² Bestand — Delete.** Die App löscht nach einer Entnahme Zeilen, die auf 0
stehen; das darf jeder mit Lager-Recht. Eine Zeile mit Bestand löschen nur
„Lager verwalten“. PocketBase prüft die Regel gegen den gespeicherten Stand —
auch im selben Batch direkt nach dem Abbuchen auf 0 (geprüft).
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (quantity <= 0 || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now)))
```

**³ Buchungen — Create.** Nur in der eigenen Organisation. Wer schreibt, setzt
der Hook `lager.pb.js` selbst aus der Anmeldung in `user_id` — ein mitgeschickter
Wert wird überschrieben, auch in Sammelbuchungen (geprüft auf 0.28.4 und 0.40.5).
Deshalb verlangt die Regel `user_id` **nicht**: Ältere App-Stände (die iOS-App vor
ihrem nächsten Update, lange offene Tabs) schicken es nicht mit und würden sonst
nicht mehr buchen können. Überträgt jemand eine fremde Offline-Buchung, steht in
`user` die Person, die erfasst hat, in `user_id` die, die überträgt.
```
@request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now))
```
Update und Delete bleiben gesperrt; zusätzlich sperrt der Hook (unten).

Das Stornieren fremder Buchungen prüft nur die App, nicht die Regel: Eine
Gegenbuchung ist eine gewöhnliche neue Buchung, und buchen darf jeder mit
Lager-Recht. Sie steht mit Namen im Logbuch.

**⁴ Einstellungen — Create/Update** (Inventur-Plan, Statistik ab Datum): nur
„Lager verwalten“.
```
@request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now))
```
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)
```

**⁵ Inventuren — Update/Delete.** Eine offene Inventur darf jeder mit
Lager-Recht abschließen, abbrechen oder neu starten. Eine abgeschlossene darf
nur „Lager verwalten“ ändern oder löschen („Zurücksetzen“) — sonst ließe sie
sich wieder öffnen und dann löschen.
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id) && (status != "abgeschlossen" || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now)))
```
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && (status != "abgeschlossen" || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now)))
```

**⁶ Inventurpositionen — Delete.** Positionen einer offenen Inventur
(Abbrechen, Neu starten) darf jeder mit Lager-Recht löschen; die einer
abgeschlossenen oder verwaisten nur „Lager verwalten“. Funktioniert, ob
`audit_id` Text oder Relation ist.
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now)) && ((@collection.inventory_audits.id ?= audit_id && @collection.inventory_audits.status ?!= "abgeschlossen") || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager_verwalten.until ~ " " && @request.auth.temp_permissions.lager_verwalten.until > @now)))
```

### Öffentliches Formular Produktausgabe

`src/pages/public/OrgProduktausgabe.tsx` liest Artikel und Standorte **ohne
Anmeldung**. List und View von `inventory_items` und `inventory_locations`
bleiben deshalb vorerst öffentlich (leer, Schloss offen) — damit kann jeder die
Artikel- und Standortlisten aller Organisationen abfragen. Das schließt
Paket 5, indem die öffentliche Ausgabe über einen Hook läuft. Danach für beide
Collections List und View auf **L**:
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.lager.until ~ " " && @request.auth.temp_permissions.lager.until > @now))
```

Das Formular legt einen Standort „Lager“ an, wenn die Organisation keinen hat.
Das geht ohne Anmeldung nicht mehr (Create verlangt Lager). Betroffen wären nur
Organisationen ganz ohne Standort — die haben auch keine Artikel, das Formular
war dort ohnehin nicht nutzbar.

Das Formular sucht außerdem Benutzer ohne Anmeldung (`users` List) — ebenfalls
Paket 5.

### Hook `pb_hooks/lager.pb.js`

Sperrt Update und Delete von `inventory_transactions` über die API — **auch
für Superuser**, also auch in der Admin-Oberfläche und im Batch. Das ist die
zweite Ebene, falls eine Regel versehentlich geöffnet wird (geprüft: auch bei
offener Regel abgelehnt). Antworten: „Buchungen sind unveränderlich —
Korrekturen als Gegenbuchung (Stornieren) erfassen.“ bzw. „Buchungen dürfen
nicht gelöscht werden.“ Anlegen bleibt möglich.

Datei nach **`/opt/pb_hooks/lager.pb.js`** kopieren und PocketBase neu starten.
Muss eine Buchung ausnahmsweise wirklich weg (etwa Datenschutz): Datei
vorübergehend entfernen, neu starten, löschen, Datei zurück, neu starten — und
den Vorgang festhalten.

### Was PocketBase bei Ablehnung antwortet

- Create: 400 „Failed to create record.“
- Update/Delete eines Datensatzes, den die Regel nicht freigibt: 404
- Gesperrte Aktion (Schloss): 403 „Only superusers can perform this action.“
- Batch: 400 „Batch transaction failed.“ — der ganze Batch wird zurückgerollt,
  auch die erlaubten Teile (geprüft: Bestand unverändert).

### users: Rechte vergeben nur Verantwortliche

Eine Update-Regel wie `id = @request.auth.id || …` lässt jeden Benutzer seine
eigenen `permissions` schreiben — er kann sich damit selbst „Lager verwalten“
oder jedes andere Recht geben, und alle Regeln oben wären wertlos. Die folgende
Regel erlaubt:

- **sich selbst** nur harmlose Felder: Name, Telefon, Benutzername,
  Kontakt-E-Mail, Einführung, Lager-Benachrichtigungen, Passwort (mit altem
  Passwort). Nicht: `permissions`, `temp_permissions`, `role`, `supervisor`,
  `organization_id`, `disabled`, `expires_at`, `permissions_migrated` — auch
  nicht unverändert mitgeschickt.
- **Admin** (Rolle `admin` oder Recht Benutzerverwaltung `unitarii`, auch
  befristet — wie in der App): alle
  Benutzer der eigenen Organisation, auch sich selbst — aber kein
  Supervisor-Recht vergeben, niemanden in eine andere Organisation verschieben
  und Supervisor-Konten gar nicht ändern (sonst könnte ein Admin das Passwort
  eines Supervisors setzen).
- **Supervisor**: alles.
- Alles nur mit **aktivem Konto** (nicht gesperrt, nicht abgelaufen) — sonst
  entsperrte sich ein gesperrter Admin mit seinem alten Token selbst.
- **Ausbildungs-Verwalter** (`ausbildungen_manage`, wie in
  `Ausbildungen.tsx`): Teilnehmer der eigenen Organisation pflegen und einfache
  Benutzer (Rolle `benutzer` oder ohne Rolle) als Teilnehmer verknüpfen — nie
  sich selbst, und niemandem ein Recht neu geben außer Unitas (`lernbar`), Chat, Notizen und
  QR-Codes (seit MPG-Paket 3 nicht mehr „MPG & Einstellungen“, `dashboard`).
  Rechte, die ein verknüpfter Benutzer schon hat, bleiben erlaubt. (Sonst legte
  er einen Teilnehmer mit selbst gewähltem Passwort und Benutzerverwaltung an
  und meldete sich damit an.) Kommt ein neues Recht dazu, gehört es in diese
  Liste.

**Update**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && (@request.body.permissions.dashboard != true || permissions.dashboard = true) && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true) && (@request.body.permissions.mpg_verwalten != true || permissions.mpg_verwalten = true)))
```

**Manage** (Passwort oder E-Mail eines anderen ohne altes Passwort setzen —
Unitarii, Einstellungen, Supervisor-Seite):
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && supervisor != true && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now))))
```

**Create** — ohne passende Regel legt man sich sonst einfach ein zweites Konto
mit Admin-Rechten an:
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (@request.body.organization_id = @request.auth.organization_id && (@request.body.supervisor:isset = false || @request.body.supervisor = false) && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) || (@request.auth.permissions.ausbildungen_manage = true && @request.body.role = "teilnehmer" && @request.body.permissions.dashboard != true && @request.body.permissions.unitarii != true && @request.body.permissions.patienten != true && @request.body.permissions.dokumente != true && @request.body.permissions.einsaetze != true && @request.body.permissions.eks != true && @request.body.permissions.lager != true && @request.body.permissions.lager_verwalten != true && @request.body.permissions.produktausgabe != true && @request.body.permissions.dateien != true && @request.body.permissions.ausbildungen_manage != true && @request.body.permissions.mpg_verwalten != true))))
```

**Delete**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && supervisor != true && id != @request.auth.id && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) || (@request.auth.permissions.ausbildungen_manage = true && role = "teilnehmer"))))
```

**Authentication rule** (unter den API-Regeln bei „Additional auth collection rules“) —
gesperrte und abgelaufene Konten melden sich nicht an und erneuern kein Token:
```
disabled != true && (expires_at = "" || expires_at > @now)
```

List und View von `users` bleiben, wie sie sind (siehe Formular oben).

**Rechte-Übernahme beim ersten Login.** `src/hooks/useAuth.ts` schreibt bei
Konten ohne `permissions_migrated` einmal die Rechte der Rolle in das eigene
Konto — das verbietet die Regel oben. Vorher in PocketBase unter `users` filtern:
```
permissions_migrated != true
```
Ist die Liste leer, gilt die Regel oben. Sonst bei diesen Benutzern in der
PocketBase-Oberfläche die Rechte prüfen und `permissions_migrated` anhaken —
oder übergangsweise diese Update-Regel nehmen, die die Übernahme genau einmal
zulässt (bis dahin kann sich ein solches Konto dabei aber beliebige Rechte
geben):
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && (@request.body.permissions.dashboard != true || permissions.dashboard = true) && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true) && (@request.body.permissions.mpg_verwalten != true || permissions.mpg_verwalten = true)) || (id = @request.auth.id && permissions_migrated != true && @request.body.permissions_migrated = true && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false))
```

## MPG: API-Regeln

Seit MPG-Paket 3 gilt im MPG dasselbe wie im Lager: Nur das Gefährliche braucht
ein eigenes Recht. **Jede Person mit Zugang zum MPG** (Recht „MPG & Einstellungen“,
`permissions.dashboard`) darf prüfen, Mängel melden, Geräte sperren, geringe und
mittlere Mängel beheben, Vermerke ins Gerätebuch schreiben und alles lesen.
**MPG verwalten** braucht es für alles, was ein Gerät freigibt oder den Bestand
ändert: Geräte anlegen, ändern, außer Betrieb nehmen oder löschen, Prüfvorlagen,
Freigeben — auch das Beheben eines Defekts „hoch“ oder „kritisch“, denn es hebt
die Sperre auf — und Meldungen von außen bestätigen oder ablehnen.

„MPG verwalten“ haben automatisch die Rollen `admin` und `mpg`
(MPG-Beauftragte) sowie Supervisor; sonst das Häkchen `permissions.mpg_verwalten`
(Benutzerverwaltung → Rechte → „MPG verwalten“), auch befristet. Die App blendet
nur aus (`src/lib/mpg/rechte.ts`) — durchgesetzt wird es hier.

Nachweise bleiben: Prüfprotokolle und Einträge im Gerätebuch werden nie geändert
oder gelöscht (eine Korrektur ist ein Vermerk dazu), Defekte werden geschlossen
statt gelöscht, und ein Gerät mit Prüfungen, Defekten, bestätigten Meldungen oder
Einträgen im Gerätebuch wird außer Betrieb genommen statt gelöscht.

Gesperrte (`disabled`) und abgelaufene Konten (`expires_at`) dürfen im MPG
nichts mehr — auch nicht mit einem noch gültigen Token — und, mit den neuen
`users`-Regeln, sich weder anmelden noch sich selbst oder andere Konten ändern.

Geprüft gegen **PocketBase 0.28.4 und 0.40.5**, mit zwei Organisationen und
Admin, MPG-Beauftragtem, Helfer, Helfer mit Häkchen, befristetem Recht (gültig,
abgelaufen, altes Datumsformat), gesperrtem und abgelaufenem Konto, Lagerwart,
Teilnehmer ohne MPG, Supervisor, Ausbilder und einem Admin der anderen
Organisation — einzeln und als Sammelbuchung (Batch) so, wie die App schreibt,
dazu Trickanfragen (Text statt Ja/Nein, Formular statt JSON, Herabstufen und
Schließen in einem Zug, Prüfstand ohne Protokoll, vorab belegte Kennungen,
gefälschte Namen, Zurücksetzen auf eine ältere Prüfung, Protokolle in der
Zukunft, vor- und nachgehende Geräte-Uhren, Wiederöffnen und Umhängen von
Defekten, Ablehnen nach teilweisem Bestätigen, gesperrte Admins mit altem Token,
Leeren, Import und Umbenennen von Sammlungen): 275 Prüfungen je Version, alle
bestanden. Gegenprobe mit offenen Regeln und ohne Hook: 174 schlagen an.

### Vorher

Die App läuft auch ohne diese Schritte weiter; sie erkennt selbst, was schon da
ist. Bis dahin schreibt sie ohne Gerätebuch, und „Außer Betrieb nehmen“ zeigt
einen Hinweis statt still nichts zu speichern.

1. Collection **`mpg_ereignisse`** anlegen (*New collection → Base*). Felder,
   keines Pflicht:
   - `organization_id`, `device_id`, `device_name`, `art`, `text`, `bezug`,
     `user_name`, `user_id` — *Plain text*
   - `aenderungen` und `angaben` — *JSON* (`angaben`: die Angaben einer STK oder
     MTK — `art`, `datum`, `ergebnis`, `pruefer`, `firma`, `protokoll`,
     `plakette`, `ausserplanmaessig`, `maengel`, `naechste`, `nachgetragen`)
   - `created` und `updated` (*Autodate*) legt PocketBase schon an — stehen lassen.

   `user_id` setzt der Hook aus der Anmeldung (Text statt Relation: Wird ein
   Konto gelöscht, würde PocketBase sonst still Einträge ändern). Die ID vergibt
   die App (15 Zeichen `a–z0–9`), so kommt nichts doppelt an. Die Regeln noch
   **nicht** eintragen.
2. An **`mpg_devices`** vier Felder anlegen, nicht Pflicht:
   `ausser_betrieb` (*Date*), `ausser_betrieb_grund` (*Plain text*),
   `verbleib` (*Plain text*), `inbetriebnahme` (*Date*, für die erste STK und MTK).

   Empfohlen, ebenfalls *Plain text*, nicht Pflicht: `user_id` an
   `mpg_inspections`, `reported_by_id` und `resolved_by_id` an `mpg_defects`.
   Der Hook trägt dort die Kennung der angemeldeten Person ein — der Name allein
   ließe sich durch Umbenennen des eigenen Kontos verstellen.
3. **Felder prüfen**, auf die sich die Regeln beziehen:
   - `users`: `disabled` (*Bool*) und `expires_at` (*Date*). **Fehlen sie,
     speichert PocketBase die Regeln trotzdem** — Sperre und Ablauf greifen dann
     still nicht. Ist `expires_at` *Plain text*, gilt ein Ablauf erst ab dem
     folgenden Tag (UTC); auf die Sekunde nur als *Date*.
   - `severity` an `mpg_defects`, `reporter_user_id` an
     `mpg_defect_reports` — fehlt eines, lehnt PocketBase das Speichern der
     Regel ab.
   - `mpg_devices` darf nur diese Felder haben (dazu `id`, `created`,
     `updated`): `name`, `type`, `serial_number`, `location`, `interval`, `last_inspection`, `last_inspection_passed`, `next_inspection_due`, `operational`, `has_stk`, `last_stk`, `stk_interval_months`, `has_mtk`, `last_mtk`, `mtk_interval_months`, `ausser_betrieb`, `ausser_betrieb_grund`, `verbleib`, `inbetriebnahme`, `organization_id`. Jedes weitere könnte jeder mit MPG-Zugang
     ändern — dann in die Update-Regel ² nach demselben Muster
     (`@request.body.<feld>:isset = false`) aufnehmen, bevor sie gespeichert wird.
4. `pb_hooks/mpg.pb.js` nach **`/opt/pb_hooks`** kopieren und PocketBase neu
   starten (siehe unten).
5. **Batch API** einschalten, falls aus (*Einstellungen → Application → Batch
   API*, siehe „Lager: Buchungen“).
6. **`users`-Regeln ersetzen** (Abschnitt „users: Rechte vergeben nur
   Verantwortliche“): Update, Create, Manage, Delete und die Authentication rule.
   Neu: Nur aktive Konten ändern Konten, gesperrte und abgelaufene melden sich
   nicht an, und Ausbilder vergeben weder „MPG verwalten“ noch „MPG &
   Einstellungen“.
7. **„MPG verwalten“ vergeben:** Wer außer Admin und MPG-Beauftragten Geräte
   freigibt, Defekte „hoch“/„kritisch“ schließt oder Meldungen bearbeitet
   (Gerätewart, Wachleitung), bekommt in der Benutzerverwaltung das Häkchen
   „MPG verwalten“ — sonst kann nach Schritt 8 niemand sonst ein gesperrtes
   Gerät freigeben. Vorher vergeben schadet nicht.
8. Erst jetzt die Regeln unten eintragen — zuerst die von `mpg_ereignisse`
   (alle fünf auf einmal), dann die übrigen.

Optional, für schnelle Gerätebücher und Logbuch: Indizes auf `mpg_ereignisse`
über `organization_id, created` und `device_id, created`.

### Bausteine

Recht **MPG** (Zugang zum Modul):
```
(@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now))
```

Recht **MPG verwalten** (Regeln verlangen es immer zusätzlich zu „MPG“):
```
(@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now))
```

Daraus die vier Regeln, die sich unten wiederholen:

**R — Lesen** (Organisation + MPG)
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now))
```

**A — Anlegen** (nur in der eigenen Organisation)
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now))
```

**AV — Anlegen mit „MPG verwalten“**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now)) && (@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now))
```

**V — Ändern oder löschen mit „MPG verwalten“** (nicht in eine andere Organisation verschieben)
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now)) && (@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)
```

Jede Regel mit Anmeldung beginnt mit **aktivem Konto** — nicht gesperrt, nicht abgelaufen:
```
@request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now)
```
Die App meldet solche Konten zwar ab; ein noch gültiger Token käme ohne diese Bedingung
aber weiter durch. Die Lager-Regeln haben dieselbe Lücke — dort beim nächsten
Lager-Paket nachziehen.

Befristete Rechte zählen mit, auf die Sekunde (siehe „Befristete Rechte in Regeln“).

### Übersicht

| Collection | List/View | Create | Update | Delete |
|---|---|---|---|---|
| `mpg_devices` | öffentlich (vorerst) ¹ | AV | Gerät ² | V |
| `mpg_inspections` | R | A | gesperrt | gesperrt |
| `mpg_defects` | R | A | Defekt ³ | gesperrt |
| `mpg_defect_reports` | Meldungen ⁴ | öffentlich ⁵ | V | gesperrt |
| `mpg_checklists` | R | AV | V | V |
| `mpg_ereignisse` | R | Gerätebuch ⁶ | gesperrt | gesperrt |

**Gesperrt** heißt: Schloss stehen lassen (null), nicht leeren Text eintragen —
leer heißt „öffentlich“.

**¹ Geräte — List/View.** Das öffentliche Meldeformular
(`src/pages/public/OrgDefektmeldung.tsx`) liest die Geräteliste ohne Anmeldung.
List und View von `mpg_devices` bleiben deshalb vorerst öffentlich (leer,
Schloss offen); das schließt MPG-Paket 4 (Meldung über einen Hook). Danach auf **R**.

**² Geräte — Update.** Mit „MPG verwalten“ alles. Ohne nur der Prüfstand
(`last_inspection`, `last_inspection_passed`, `next_inspection_due`) und
Sperren (`operational` auf `false`) — keine Stammdaten, keine Freigabe, keine
Außerbetriebnahme. „Zuletzt geprüft“ und „bestanden“ prüft zusätzlich der Hook:
Sie müssen zu einem gespeicherten Prüfprotokoll desselben Geräts passen
(Zeitpunkt und Ergebnis). `next_inspection_due` prüft er nicht — die App
berechnet die Fälligkeit selbst aus dem Prüfstand und liest das Feld nicht.
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id) && ((@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now)) || (@request.body.name:isset = false && @request.body.type:isset = false && @request.body.serial_number:isset = false && @request.body.location:isset = false && @request.body.interval:isset = false && @request.body.has_stk:isset = false && @request.body.last_stk:isset = false && @request.body.stk_interval_months:isset = false && @request.body.has_mtk:isset = false && @request.body.last_mtk:isset = false && @request.body.mtk_interval_months:isset = false && @request.body.ausser_betrieb:isset = false && @request.body.ausser_betrieb_grund:isset = false && @request.body.verbleib:isset = false && @request.body.inbetriebnahme:isset = false && @request.body.organization_id:isset = false && (@request.body.operational:isset = false || @request.body.operational = false)))
```

**³ Defekte — Update.** Geringe und mittlere Mängel schließt jeder; einen Defekt
„hoch“ oder „kritisch“ nur „MPG verwalten“. Ohne das Recht lassen sich Schwere,
Gerät, Beschreibung und Melder nicht ändern (sonst ließe sich ein sperrender
Defekt erst herabstufen und dann schließen). PocketBase prüft `severity` am
gespeicherten Stand.
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now)) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id) && ((@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now)) || (severity != "high" && severity != "critical" && @request.body.severity:isset = false && @request.body.device_id:isset = false && @request.body.description:isset = false && @request.body.reported_by:isset = false && @request.body.device_name:isset = false))
```

**⁴ Meldungen von außen — List/View.** Die Organisation mit MPG-Zugang — und wer
selbst gemeldet hat (Unitas zeigt „Meine Meldungen“), auch ohne MPG.
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && organization_id = @request.auth.organization_id && ((@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now)) || reporter_user_id = @request.auth.id)
```

**⁵ Meldungen von außen — Create.** Das Meldeformular legt ohne Anmeldung an
(vorerst — MPG-Paket 4), aber nur als offene Meldung einer Organisation:
```
@request.body.organization_id != "" && @request.body.status = "pending"
```
Delete bleibt gesperrt; Spam löscht der Superuser in der Admin-Oberfläche.

**⁶ Gerätebuch — Create.** Sperren mit Grund und Vermerke schreibt jeder mit
MPG-Zugang; alle anderen Einträge (freigegeben, angelegt, geändert, außer Betrieb,
wieder in Betrieb, gelöscht, STK, MTK) nur „MPG verwalten“. Das Datum der
letzten STK oder MTK am Gerät (`last_stk`, `last_mtk`) und die Inbetriebnahme
sind Stammdaten (Regel ²) — eine Kontrolle eintragen heißt also: Eintrag mit den
Angaben im Gerätebuch, dann das Datum am Gerät, beides mit „MPG verwalten“.
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now)) && ((@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now)) || @request.body.art = "gesperrt" || @request.body.art = "vermerk")
```

### Hook `pb_hooks/mpg.pb.js`

Die zweite Ebene, falls eine Regel versehentlich geöffnet wird. Unveränderlichkeit
und Löschschutz gelten **auch für Superuser**, also auch in der Admin-Oberfläche
und im Batch; Prüfstand, Namen und Status (die Punkte ab „Der Prüfstand“) darf der
Superuser korrigieren:

- `mpg_ereignisse` und `mpg_inspections`: Ändern und Löschen abgelehnt
  („Das Gerätebuch ist unveränderlich — eine Korrektur bitte als Vermerk
  eintragen.“, „Prüfprotokolle sind unveränderlich …“).
- `mpg_defects`: Löschen abgelehnt („Defekte bleiben als Nachweis erhalten …“).
- Auch „Truncate“ (Sammlung leeren), das Löschen und Umbenennen der Sammlungen
  `mpg_ereignisse`, `mpg_inspections`, `mpg_defects` und `mpg_devices` sowie
  ein Import mit „fehlende löschen“, der eine davon entfernen würde, sind
  gesperrt. **Nicht abgedeckt:** Felder einer dieser Sammlungen in der
  Admin-Oberfläche entfernen — dabei gehen deren Werte verloren. Das bitte
  unterlassen.
- `mpg_devices`: Löschen nur ohne Prüfungen, Defekte, bestätigte Meldungen und
  ohne Einträge im Gerätebuch derselben Organisation (außer „angelegt“,
  „geändert“, „gelöscht“) — ein versehentlich angelegtes Gerät darf wieder weg,
  auch wenn jemand ohne Anmeldung eine offene Meldung dazu abgeschickt hat. Gilt
  auch beim Leeren der Sammlung.
- Der Prüfstand eines Geräts (zuletzt geprüft und bestanden) lässt sich nur
  passend zu einem gespeicherten Prüfprotokoll desselben Geräts und derselben
  Organisation setzen. Ein neues Gerät hat noch keinen Prüfstand. Kommt eine
  Prüfung mit älterem Zeitpunkt an als der gespeicherte Stand (andere Geräte-Uhr,
  später gesendet), gehen Protokoll, Defekt und Sperre trotzdem durch, und der
  neuere Stand bleibt stehen — ein durchgefallenes Gerät lässt sich also nicht
  auf eine ältere, bestandene Prüfung zurücksetzen. Zwei Ausnahmen, beide zur
  sicheren Seite: **„nicht bestanden“ setzt sich gegen ein gespeichertes
  „bestanden“ immer durch** (dann wird das Gerät einmal mehr geprüft, statt nach
  einer Reparatur ohne bestandene Prüfung als einsatzbereit zu gelten), und ein
  gespeicherter Stand nach der Serverzeit (Uhr ging vor) zählt nicht als neuer.
  Prüfprotokolle mit einem Datum mehr als eine Stunde in der Zukunft werden
  abgelehnt (Spielraum für eine falsch gehende Geräte-Uhr).
- Nach einer nicht bestandenen STK oder MTK bleibt das Gerät gesperrt, bis eine
  bestandene im Gerätebuch steht: Freigeben und ein späteres Datum der letzten
  Kontrolle am Gerät werden bis dahin abgelehnt — auch, wenn das Häkchen „STK
  erforderlich“ dazwischen ab- und wieder angeschaltet wird (wieder an: gesperrt).
  Die neueste Kontrolle zählt nach ihrem Tag (`angaben.datum`, als JJJJ-MM-TT),
  bei gleichem Tag nach der Eintragszeit; fehlt der Eintrag, zählt ihr Defekt
  („STK nicht bestanden: …“). Es zählen nur Einträge und Defekte der Organisation
  des Geräts; eine nachgetragene ältere Kontrolle zählt nicht, wenn am Gerät schon
  eine neuere bestandene steht.
- Einträge im Gerätebuch gehören zur Organisation ihres Geräts — zu einem Gerät
  einer anderen Organisation wird nichts eingetragen.
- STK, MTK und Inbetriebnahme: kein Datum in der Zukunft (ein Tag Spielraum) —
  ein Tippfehler im Jahr gäbe sonst ein überfälliges Gerät für Jahre frei. Beim
  Ändern zählt nur ein geänderter Wert. Ebenso der Tag einer eingetragenen STK
  oder MTK im Gerätebuch.
- Namen setzt der Server aus der Anmeldung: Prüfer im Protokoll, Name und
  `user_id` im Gerätebuch, Melder und „behoben von“ am Defekt — samt Kennung,
  wenn die empfohlenen Felder angelegt sind. Ein mitgeschickter Wert wird
  überschrieben, auch in Sammelbuchungen. Beim Bestätigen einer Meldung steht als
  Melder der Name aus der Meldung; die Kennung bleibt leer, denn das Formular
  ohne Anmeldung kann sie nicht prüfen.
- Defekte: immer offen angelegt; „behoben“ ist endgültig. Gerät, Melder und
  Organisation bleiben, wie angelegt — ein Defekt lässt sich nicht auf ein
  anderes Gerät umhängen. Nach dem Beheben bleiben auch Beschreibung, Schwere,
  Gerätename, „behoben von“ und die Notiz dazu, wie sie sind.
- Meldungen von außen: Eine bestätigte oder abgelehnte Meldung bleibt, wie sie
  ist — auch der Ablehnungsgrund; Gerät, Melder, Beschreibung und Schwere
  bleiben immer, wie gemeldet. Ablehnen geht nicht mehr, sobald aus der Meldung
  ein Defekt oder Eintrag entstanden ist (eine teilweise gespeicherte
  Bestätigung von einem anderen Gerät) — dann wird sie bestätigt.
- Defekt und Eintrag mit der Kennung einer Meldung von außen (so entsteht aus
  einer Meldung genau ein Defekt) legt nur an, wer die Meldung bearbeiten darf —
  sonst ließe sich das Bestätigen durch eine vorab belegte Kennung blockieren.
  Umgekehrt darf eine Meldung von außen keine Kennung tragen, die schon ein
  Defekt oder Eintrag hat.

Datei nach **`/opt/pb_hooks/mpg.pb.js`** kopieren und PocketBase neu starten.
Muss ein Nachweis ausnahmsweise wirklich weg (etwa Datenschutz): Datei
vorübergehend entfernen, neu starten, löschen, Datei zurück, neu starten — und
den Vorgang festhalten. Die Aufbewahrung nach einer Außerbetriebnahme zeigt die
App am Gerät (5 Jahre nach dem Datum der Außerbetriebnahme).

### users: nur aktive Konten, „MPG verwalten“ vergeben nur Verantwortliche

Ausbildungs-Verwalter dürfen `mpg_verwalten` nicht vergeben — und auch
`dashboard` („MPG & Einstellungen“) nicht mehr, denn das öffnet jetzt das Prüfen
und Sperren von Medizinprodukten. Und alle `users`-Regeln gelten nur noch für
aktive Konten: Ohne das könnte ein gesperrter Admin mit seinem alten Token sich
selbst entsperren oder das Passwort eines anderen Kontos setzen und sich damit
anmelden. Gesperrte und abgelaufene Konten melden sich gar nicht mehr an
(Authentication rule). Die Regeln im Abschnitt „users: Rechte vergeben nur
Verantwortliche“ enthalten das seit Paket 3 — wer sie vorher eingetragen hat,
ersetzt Update, Create, Manage und Delete durch die dortige Fassung und trägt die
Authentication rule ein. Steht als Update-Regel die Übergangsregel, sie durch
die neue Übergangsregel ersetzen.

### users: Benutzerverwaltung auch befristet

Die App öffnet die Benutzerverwaltung auch mit einem **befristeten** Recht
„Benutzerverwaltung“ (`temp_permissions.unitarii`) — die Regeln kannten bisher
nur das dauerhafte. Wer es nur befristet hatte, sah die Seite, aber Anlegen,
Ändern und Löschen scheiterten mit „Failed to create record.“ ohne Grund. Die
Fassungen von Update, Create, Manage und Delete (und der Übergangsregel) im
Abschnitt „users: Rechte vergeben nur Verantwortliche“ prüfen das befristete
Recht jetzt mit — genauso wie die MPG-Regeln. Wer die Regeln schon eingetragen
hat, ersetzt diese vier (bzw. fünf) durch die dortige Fassung.

Geprüft gegen PocketBase 0.28.4 und 0.40.5: Admin, Verwalter, befristeter und
abgelaufener Verwalter, Helfer, befristeter Verwalter einer anderen
Organisation, Supervisor — dazu kein Supervisor-Recht, keine fremde
Organisation, kein fremdes Passwort; die 275 Prüfungen von MPG-Paket 3 bestehen
weiter.

## Eigene Rollen der Organisationen

Neben den vorgegebenen Rollen (Admin, Benutzer, MPG-Beauftragter, Lagerwart,
Ausbilder, Qualitätsmanagement, Teilnehmer) legt eine Organisation in der
Benutzerverwaltung eigene Rollen an, etwa „Kassenwart“. Die Rollen stehen im
JSON-Feld `organizations.eigene_rollen`:
```json
[{ "id": "eigen_k3m9x2qa", "name": "Kassenwart", "hinweis": "Dateien und Vorgänge", "farbe": "cognac", "archiviert": false }]
```
Die Häkchen einer eigenen Rolle stehen wie bei den vorgegebenen in
`organizations.role_permissions[id]`, am Benutzer steht `users.role =
"eigen_k3m9x2qa"`. Die ID ist `eigen_` plus acht Zeichen aus `a–z0–9` und ändert
sich nie; Umbenennen ändert nur `name`.

**Eine Rolle setzt nur Häkchen.** Was zählt, ist immer `users.permissions`. Eine
`eigen_`-ID kommt in keiner Regel vor und gibt auf dem Server kein einziges
Recht; anders als `admin`, `lager` und `mpg`, die in den Regeln oben Rechte ohne
Häkchen geben. Die App verwirft beim Lesen jede Rolle, deren ID nicht dem Muster
entspricht (`src/lib/rollen.ts`): Eine Rolle mit der ID `admin` und dem Namen
„Kassenwart“ ließe einen Admin sonst unwissentlich `role = "admin"` vergeben.

Bisher war die Update-Regel von `organizations` nicht festgehalten. Die App
schreibt dort an drei Stellen: Benutzerverwaltung (`role_permissions`,
`eigene_rollen`, `verknuepfungen`), Vorgänge (`form_config`) und die
Supervisor-Seite (Name, Kürzel, Lizenz, Freischaltung, Anlegen). Die Regeln
unten sperren die Felder von Lizenz, Freischaltung und Stammdaten für alle außer
dem Supervisor; alle übrigen Felder bleiben für Verwalter und
Vorgänge-Bearbeiter offen (siehe „Vorher“, Schritt 4).

### Vorher

1. **Die heutigen Regeln von `organizations` ablesen** und notieren (Update,
   Create, Delete), damit sie sich zurückstellen lassen.
2. **Feld `users.role` prüfen** (*Collections → users → Feld role*):
   - Typ **Plain text**, *Max length* **0** (Standard) oder mindestens
     **14**. Ist sie kleiner, hochsetzen. Sonst antwortet PocketBase beim
     Speichern einer eigenen Rolle mit `validation_max_text_constraint` (siehe
     unten).
   - Typ **Select**: Eigene Rollen lassen sich so nicht speichern. Die App
     erkennt die Antwort (siehe unten) und meldet es. Den Typ ändert PocketBase
     nicht. **Nicht** das Feld löschen und als Text neu anlegen: Dabei gehen alle
     Rollen verloren (geprüft: aus `admin` wird `""`), und jede Regel, die auf
     `role = "admin"` schaut, greift nicht mehr. Stattdessen die Migration unten
     einspielen. Vorher eine Sicherung anlegen (*Settings → Backups*).
3. **Neues Feld in `organizations`:** `eigene_rollen`, Typ **JSON**, nicht
   Pflicht, nicht versteckt (die App liest es). *Max size* beim Standard lassen.
4. **Felder von `organizations` prüfen**, auf die sich die Update-Regel bezieht:
   `org_name`, `org_code`, `logo`, `is_active`, `license_type`, `max_users`,
   `license_valid_until`, `freigeschaltet`, `role_permissions`, `eigene_rollen`,
   `verknuepfungen`, `form_config`. **PocketBase speichert die Regel auch, wenn
   eines fehlt oder anders heißt** (geprüft), der Schutz dieses Felds fehlt dann
   still. Jedes weitere Feld der Sammlung dürfen Verwalter und
   Vorgänge-Bearbeiter ändern. Gehört es zu Lizenz oder Freischaltung, nach
   demselben Muster (`@request.body.<feld>:isset = false`) in die Update-Regel
   aufnehmen, direkt hinter `@request.body.freigeschaltet:isset = false`.
5. **Alte Rollenwerte suchen** (*Collections → users*, Filter unten). Werte wie
   `mitglied` stören die Regeln nicht; die App zeigt sie unverändert an. Vor dem
   optionalen Pattern (unten) muss die Liste leer sein.
6. Erst jetzt die Regeln unten eintragen.

**Migration Select → Plain text.** Datei `1761750000_users_role_text.js` in den
Ordner `pb_migrations` legen. Er liegt neben `pb_data`, sofern PocketBase nicht
mit `--migrationsDir` startet; liegen die Hooks in `/opt/pb_hooks`, ist es
meist `/opt/pb_migrations`. Danach PocketBase neu starten. Die Migration läuft
beim Start genau einmal, als Ganzes oder gar nicht, und tut nichts, wenn `role`
schon Text ist. Von PocketBase selbst angelegte Dateien im Ordner stören nicht:
```js
// Stellt users.role von „Select“ auf „Plain text“ um; die Werte bleiben erhalten.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const alt = users.fields.getByName("role")
  if (!alt || alt.type() !== "select") return // schon Text: nichts zu tun
  if (alt.maxSelect > 1) throw new Error("users.role ist eine Mehrfachauswahl — nicht automatisch umstellbar")
  // 1. Textfeld daneben anlegen, Werte kopieren
  users.fields.add(new TextField({ name: "role_text", max: 0 }))
  app.save(users)
  app.db().newQuery("UPDATE {{users}} SET [[role_text]] = [[role]]").execute()
  // 2. Select entfernen und das Textfeld umbenennen, in einem Speichern (die Regeln bleiben gültig)
  const c = app.findCollectionByNameOrId("users")
  c.fields.removeByName("role")
  c.fields.getByName("role_text").name = "role"
  app.save(c)
})
```
Geprüft auf 0.28.4 und 0.40.5 mit acht Konten (alle vorgegebenen Rollen und
ohne Rolle): Danach ist `role` Plain text, jede Rolle ist erhalten, alle sieben
`users`-Regeln sind unverändert, ein Admin (nur über `role = "admin"`) legt einen
Benutzer mit eigener Rolle an, ein Benutzer ohne Recht gibt sich weiter keine
Rolle, und ein zweiter Start ändert nichts: 22 Prüfungen je Version, alle
bestanden.

### organizations: API-Regeln

| Wer | Was |
|---|---|
| Supervisor | alles, in jeder Organisation; als Einziger anlegen und löschen |
| Admin (`role = "admin"`) oder Benutzerverwaltung (`unitarii`, auch befristet) | nur die eigene Organisation: `role_permissions`, `eigene_rollen`, `verknuepfungen`, `form_config` sowie jedes Feld, das die Regel nicht ausdrücklich sperrt |
| Vorgänge (`dokumente`, auch befristet) | nur die eigene Organisation: `form_config` sowie jedes Feld, das die Regel nicht ausdrücklich sperrt — nicht aber die Rollenfelder |
| alle anderen, auch ohne Anmeldung | lesen |

Name, Kürzel, Logo, aktiv, Lizenz, Obergrenze, Ablauf und Freischaltung ändert
nur der Supervisor, auch nicht unverändert mitgeschickt. Alles nur mit
**aktivem Konto**, wie bei `users`. Wer die Benutzerverwaltung hat, kann ohnehin
jedes Recht vergeben; für die Rollenfelder entsteht dadurch keine neue Macht.

**List/Search** und **View**: unverändert öffentlich (leer, Schloss offen). Die
öffentlichen Seiten lesen ohne Anmeldung (`OrgPublicLayout.tsx` per
`org_code`, `PatientView.tsx`). Damit sind auch `role_permissions` und
`eigene_rollen` öffentlich lesbar; einzelne Felder blendet eine Regel nicht aus.
Rollennamen und Häkchen sind wenig sensibel.

**Update**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (id = @request.auth.organization_id && @request.body.org_name:isset = false && @request.body.org_code:isset = false && @request.body.logo:isset = false && @request.body.is_active:isset = false && @request.body.license_type:isset = false && @request.body.max_users:isset = false && @request.body.license_valid_until:isset = false && @request.body.freigeschaltet:isset = false && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) || ((@request.auth.permissions.dokumente = true || (@request.auth.temp_permissions.dokumente.until ~ " " && @request.auth.temp_permissions.dokumente.until > @now)) && @request.body.role_permissions:isset = false && @request.body.eigene_rollen:isset = false && @request.body.verknuepfungen:isset = false))))
```

**Create**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.supervisor = true
```

**Delete** (die App löscht keine Organisationen; das Schloss stehen zu lassen
geht auch)
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.supervisor = true
```

Ablehnung: Update und Delete 404 („The requested resource wasn't found.“),
Create 400 („Failed to create record.“). Die App meldet bei 404: „Der Server
lässt das Ändern der Organisation nicht zu.“ Eine Sammelbuchung (Batch) mit
einem verbotenen Teil wird ganz abgelehnt.

### users: eigene Rollen

Die `users`-Regeln oben brauchen nichts Neues. Geprüft mit `role` als Plain
text:

- Admin, Verwalter, befristeter Verwalter, Verwalter mit eigener Rolle und
  Supervisor legen Benutzer mit `role = "eigen_k3m9x2qa"` an (die Anfrage aus
  `src/pages/benutzer/PersonSeite.tsx`, `saveUser`) und ändern die Rolle hin und zurück.
- Kein Benutzer ändert seine eigene Rolle: Helfer → eigene Rolle, eigene Rolle →
  `admin`, eigene Rolle → andere eigene Rolle, auch nicht unverändert
  mitgeschickt. Den eigenen Namen ändert er weiter.
- Eine eigene Rolle ohne Häkchen gibt nichts: Ein Mitglied mit eigener Rolle
  legt niemanden an, ändert niemand anderen und gibt sich keine
  Benutzerverwaltung.
- Abgelaufene, gesperrte und fremde Verwalter (andere Organisation) ändern nichts.
- **Ausbildungs-Verwalter** machen einen Benutzer mit eigener Rolle nicht zum
  Teilnehmer und legen keinen mit eigener Rolle an. Die Regel verlangt
  `benutzer`, `""` bzw. `teilnehmer`. Das ist strenger als nötig und unkritisch.
  Bitte nicht mit `role ~ "eigen_"` erweitern (siehe Filter unten).

**Was PocketBase antwortet, wenn `role` nicht passt** (auf 0.28.4 und 0.40.5
gleich). Unterscheiden lässt es sich an `e.response.data.role.code`:

- `role` ist **Select** (Anlegen; beim Ändern dasselbe mit „Failed to update
  record.“):
  ```json
  {"data":{"role":{"code":"validation_invalid_value","message":"Invalid value eigen_k3m9x2qa.","params":{"value":"eigen_k3m9x2qa"}}},"message":"Failed to create record.","status":400}
  ```
- `role` ist Plain text mit zu kleiner *Max length* (hier 10):
  ```json
  {"data":{"role":{"code":"validation_max_text_constraint","message":"Must be no more than 10 character(s).","params":{"max":10}}},"message":"Failed to create record.","status":400}
  ```
- Fehlt das Recht, kommt 400 ohne Feldfehler: `{"data":{},"message":"Failed to create record.","status":400}`.
  Ein Feldfehler an `role` heißt also: Die Regel hätte es erlaubt, das Feld nicht.

**Alte Rollenwerte finden.** Filter in *Collections → users*: Rollen, die weder
vorgegeben sind noch mit `eigen_` beginnen:
```
role != "" && role != "admin" && role != "benutzer" && role != "mpg" && role != "lager" && role != "ausbildung" && role != "qm" && role != "teilnehmer" && role !~ "eigen\_%"
```
Geprüft: Er findet `mitglied`, `Admin`, `eigenxk3m9x2qa` und `xeigen_k3m9x2qa`,
nicht aber die vorgegebenen, die leere Rolle und `eigen_…`. Zu `~` in
PocketBase (geprüft auf beiden Versionen):

- Ohne `%` heißt `~` „enthält“, und `_` zählt als Zeichen: `role ~ "eigen_"`
  findet nur Werte mit `eigen_` darin.
- Mit `%` ist `_` ein Platzhalter für ein beliebiges Zeichen: `role ~ "eigen_%"`
  findet auch `eigenxk3m9x2qa`. Deshalb `\_`.
- `~` unterscheidet nicht nach Groß- und Kleinschreibung: `role ~ "eigen\_%"`
  findet auch `EIGEN_K3M9X2QA`.

**Optional, als Härtung: Pattern an `users.role`**
```
^(admin|benutzer|mpg|lager|ausbildung|qm|teilnehmer|eigen_[a-z0-9]{8})$
```
Dann speichert PocketBase nur noch vorgegebene Rollen, eigene Rollen im
richtigen Muster und die leere Rolle. Abgelehnt werden zum Beispiel `mitglied`,
`EIGEN_K3M9X2QA`, `eigen_abc` und `admin ` (mit Leerzeichen), und zwar mit
`{"data":{"role":{"code":"validation_invalid_format","message":"Invalid value format."}},…}`.
**Vorsicht:** Ein Konto mit einem alten Wert lässt sich danach gar nicht mehr
speichern, auch nicht nur sein Name (geprüft). Deshalb vorher den Filter oben
leeren und mit `role ~ "eigen\_%"` nachsehen, dass jede eigene Rolle genau
`eigen_` plus acht Kleinbuchstaben oder Ziffern ist. Kommt eine neue vorgegebene
Rolle dazu, gehört sie ins Pattern.

### Geprüft

Gegen **PocketBase 0.28.4 und 0.40.5**, mit zwei Organisationen, `logo` als
Datei-Feld (wie in der App) und zusätzlich als Text-Feld. Beteiligt waren
Supervisor, gesperrter Supervisor, Admin, Verwalter, befristeter Verwalter
(gültig, abgelaufen, altes Datumsformat), Verwalter mit eigener Rolle, Mitglied
mit eigener Rolle, Vorgänge-Bearbeiter (dauerhaft, befristet, abgelaufen),
Helfer, Teilnehmer, MPG-Beauftragter ohne Benutzerverwaltung, Ausbilder,
gesperrter und abgelaufener Admin mit altem Token, Admin und Vorgänge-Bearbeiter
der anderen Organisation und ohne Anmeldung.

- **Matrix:** jede dieser Personen mit jedem Feld einzeln und in Kombinationen
  (Rollen mit Freischaltung, Rollen mit `max_users`, `form_config` mit
  `eigene_rollen` bzw. `verknuepfungen`), in der eigenen und der anderen
  Organisation. Erlaubt heißt gespeichert, abgelehnt heißt: Datensatz
  unverändert, auch `updated`. Das sind 1428 Fälle je Version: 144 erlaubt, 1284
  abgelehnt.
- **Trickanfragen:** Formular statt JSON (`max_users`, `freigeschaltet`,
  `eigene_rollen`, `role_permissions`), Logo hochladen, `logo+`, `+logo`,
  `logo-`, `logo` leer oder null, `max_users+`, `max_users-`,
  `org_code:autogenerate`, Freischaltung leeren (`null` oder `[]`, das hieße
  „alles frei“), Rolle mit der ID `admin`, die Vorlage `benutzer` über Vorgänge,
  die Kennung von A auf B ändern, sich selbst nach B verschieben,
  Sammelbuchungen (Batch) mit erlaubten und verbotenen Teilen. Die Antwort des
  Speicherns enthält `eigene_rollen`, so erkennt die App das Feld.
- Lesen ohne Anmeldung (per `org_code`, einzeln, Liste), Anlegen und Löschen nur
  durch den Supervisor, dazu die `users`-Fälle, der Filter, das Pattern, die zu
  kleine *Max length* und `role` als Select.

Zusammen **1601 Prüfungen je Version, alle bestanden**. Gegenprobe mit der
weiten Regel `id = @request.auth.organization_id` (jedes Mitglied darf alles an
der eigenen Organisation, jeder Angemeldete legt an): 702 schlagen an.
