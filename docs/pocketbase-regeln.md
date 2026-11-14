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

Das Formular sucht keine Benutzer mehr: Den Absender prüft der Server
(`/api/responda/formular/…`, Abschnitt „Öffentliche Formulare: Absender“).

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
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && ((@request.auth.supervisor = true && @request.body.supervisor:isset = false) || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false && (@request.body.permissions.dashboard != true || permissions.dashboard = true) && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true) && (@request.body.permissions.mpg_verwalten != true || permissions.mpg_verwalten = true)))
```

**Manage** (E-Mail eines anderen ohne altes Passwort setzen, etwa bei einer
Person ohne E-Mail nachtragen. Ein fremdes **Passwort** setzt nur der
Supervisor — Admins und Verwalter schicken den Link, siehe „users: Passwörter
legt jeder selbst fest“):
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && supervisor != true && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && @request.body.password:isset = false))
```

**Create** — ohne passende Regel legt man sich sonst einfach ein zweites Konto
mit Admin-Rechten an:
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && ((@request.auth.supervisor = true && (@request.body.supervisor:isset = false || @request.body.supervisor = false)) || (@request.body.organization_id = @request.auth.organization_id && (@request.body.supervisor:isset = false || @request.body.supervisor = false) && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) || (@request.auth.permissions.ausbildungen_manage = true && @request.body.role = "teilnehmer" && @request.body.zusatzrollen:isset = false && @request.body.permissions.dashboard != true && @request.body.permissions.unitarii != true && @request.body.permissions.patienten != true && @request.body.permissions.dokumente != true && @request.body.permissions.einsaetze != true && @request.body.permissions.eks != true && @request.body.permissions.lager != true && @request.body.permissions.lager_verwalten != true && @request.body.permissions.produktausgabe != true && @request.body.permissions.dateien != true && @request.body.permissions.ausbildungen_manage != true && @request.body.permissions.mpg_verwalten != true))))
```

**Delete**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && supervisor != true && id != @request.auth.id && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) || (@request.auth.permissions.ausbildungen_manage = true && role = "teilnehmer"))))
```

**Authentication rule** (unter den API-Regeln bei „Additional auth collection rules“) —
gesperrte und abgelaufene Konten melden sich nicht an und erneuern kein Token:
(setzt die Felder `disabled` und `expires_at` an `users` voraus, siehe „Felder prüfen“ bei MPG-Paket 3)
```
disabled != true && (expires_at = "" || expires_at > @now)
```

List und View von `users`: bis zur Einführung der Absender offen; danach schließt der Owner sie
(Abschnitt „users: List und View schließen“ unter „Öffentliche Formulare: Absender“).

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
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && ((@request.auth.supervisor = true && @request.body.supervisor:isset = false) || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false && (@request.body.permissions.dashboard != true || permissions.dashboard = true) && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true) && (@request.body.permissions.mpg_verwalten != true || permissions.mpg_verwalten = true)) || (id = @request.auth.id && permissions_migrated != true && @request.body.permissions_migrated = true && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.zusatzrollen:isset = false))
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
   - `users`: `disabled` (*Bool*) und `expires_at` (*Date*), beide nicht Pflicht.
     **Vor den Regeln anlegen.** Die Authentication rule lehnt PocketBase ohne
     sie ab („invalid left operand "disabled" - unknown field“); Regeln, die nur
     `@request.auth.disabled` prüfen, speichert es dagegen — Sperre und Ablauf
     greifen dann still nicht. Ohne die Felder verwirft PocketBase außerdem,
     was die App dort schreibt: „Gesperrt“ wirkt nicht, und temporäre Zugänge
     laufen nie ab. Ist `expires_at` *Plain text*, gilt ein Ablauf erst ab dem
     folgenden Tag (UTC); auf die Sekunde nur als *Date*.
     **Nicht *Autodate*:** Ein Autodate-Feld trägt beim Anlegen (und je nach
     Einstellung bei jedem Ändern) die aktuelle Uhrzeit ein. Jede neue Person ist
     dann sofort abgelaufen und kann sich nicht anmelden (geprüft mit 0.28.4 und
     0.40.5; die App meldet es beim Speichern). Abhilfe: unter users → Fields das
     Feld `expires_at` löschen und **im selben Schritt** ein Feld `expires_at` vom
     Typ *Date* anlegen, dann speichern. Die Regeln bleiben gültig, die falschen
     Werte sind danach leer. Temporäre Zugänge bekommen ihr Ablaufdatum neu.
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
  Melder der Name aus der Meldung; die Kennung (`reported_by_id`) nur, wenn der
  Server den Melder bestätigt hat (`reporter_status = "bestaetigt"`: Passwort,
  Anmeldung oder nachgereichte Unterschrift, siehe „Öffentliche Formulare:
  Absender“), sonst bleibt sie leer. `reporter_status` setzt nur der Server; ein
  Update über die API stellt es zurück.
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

### users: Supervisor nur in PocketBase

Supervisor ist der Betreiber von Responda. Das Recht vergibt niemand über die App
oder die Schnittstelle, auch kein Supervisor: Update und Create im Abschnitt
„users: Rechte vergeben nur Verantwortliche“ (und die Übergangsregel) lehnen
jede Anfrage ab, die `supervisor` mitschickt, außer `supervisor = false` beim
Anlegen. Gesetzt oder entzogen wird es nur in der PocketBase-Oberfläche
(Superuser, für den die Regeln nicht gelten). Alles andere darf ein Supervisor
weiter, auch fremde Passwörter (Manage). Die Benutzerverwaltung zeigt keinen
Schalter mehr dafür. Geprüft gegen 0.28.4 und 0.40.5.

### users: Mehrere Rollen je Person

Was jemand darf, kommt aus seinen Rollen; hat jemand mehrere, zählen sie
zusammen (`src/lib/rollen.ts`, `rechteAusRollen`). Die erste Rolle steht wie
bisher in `users.role` und zählt in den Regeln (etwa `role = "admin"`), die
weiteren stehen im neuen Feld **`users.zusatzrollen`** (Typ *JSON*, nicht Pflicht,
z. B. `["ausbildung", "eigen_k3m9x2qa"]`). Die App schreibt das Ergebnis wie bisher
als Kopie nach `users.permissions`; die Regeln prüfen weiter nur diese Kopie.

**Einrichten, in dieser Reihenfolge:**
1. **Zuerst die Regeln:** Update, Create und (falls eingetragen) die
   Übergangsregel durch die Fassung im Abschnitt „users: Rechte vergeben nur
   Verantwortliche“ ersetzen. Neu ist dort `@request.body.zusatzrollen:isset =
   false` im eigenen Zweig und im Zweig der Ausbildungs-Verwalter (sonst könnte
   sich jemand selbst eine Rolle eintragen, und der nächste Abgleich gäbe ihm die
   Rechte), dazu die Supervisor-Sperre (siehe „Supervisor nur in PocketBase“).
   Die Regeln lassen sich schon vor dem Feld speichern.
2. **Dann das Feld:** `users` → Fields → neues Feld `zusatzrollen`, Typ **JSON**,
   nicht Pflicht.

Leitung und Teilnehmende als weitere Rolle wertet die App nie aus: Steht so etwas
in `zusatzrollen`, wurde es eingeschleust.

Ohne das Feld verwirft PocketBase die weiteren Rollen still; die App meldet das
beim Speichern. Zum Zählen nach einer Rolle braucht der Filter Anführungszeichen
um die ID (`zusatzrollen ~ '"fuehrung"'`), sonst zählt `eigen_x` auch `eigen_xy`.
Geprüft gegen 0.28.4 und 0.40.5 (110 Prüfungen, Gegenprobe mit Batch, multipart,
anderen Schreibweisen): Niemand gibt sich selbst Rollen, Ausbildungs-Verwalter
vergeben keine, Admin, Verwalter (auch befristet) und Supervisor schon.

**Leitung und Teilnehmende sind fest.** Die Leitung (`admin`) hat immer alle
Rechte samt Benutzerverwaltung, eine Organisation kann ihr nichts wegnehmen.
Teilnehmende bekommen Unitas über die Ausbildungen. Beide stehen allein.

### users: Passwörter legt jeder selbst fest

In der Benutzerverwaltung setzt niemand mehr das Passwort einer anderen Person.
Die Person legt es selbst fest: über die Willkommens-E-Mail oder den
„Passwort-Link“, beides geht an ihre eigene Adresse. Die App schickt kein
Passwort mehr mit (Benutzerverwaltung, Einstellungen → Benutzer). Damit das
auch über die Schnittstelle gilt, steht in der **Manage**-Regel im Abschnitt
„users: Rechte vergeben nur Verantwortliche“ für Admins und Verwalter
`@request.body.password:isset = false`. Wer die Regel schon eingetragen hat,
ersetzt sie durch die dortige Fassung.

Was bleibt:
- Der **Supervisor** setzt weiter jedes Passwort (Supervisor-Seite).
- Jeder ändert sein **eigenes** Passwort mit dem alten (Einstellungen).
- **Temporäre Zugänge** bekommen ihr Passwort beim Anlegen (Create-Regel,
  unverändert) — es gibt keine Adresse, an die ein Link gehen könnte.
- Fehlt die Bedingung, weist PocketBase ein fremdes Passwort nicht ab; die App
  schickt nur keins mehr.

Geprüft gegen PocketBase 0.28.4 und 0.40.5: Admin, Verwalter und befristeter
Verwalter setzen kein fremdes Passwort mehr (400 `oldPassword`), auch nicht per
Batch, multipart oder mit leerem Passwort; auch nicht bei Teilnehmern über den
Zweig der Ausbildungs-Verwalter. Weiter möglich: Namen und Rechte ändern, eine
E-Mail nachtragen, Personen ohne E-Mail anlegen, temporäre Zugänge, eigenes
Passwort mit dem alten, Supervisor.

**Personen ohne E-Mail.** Die Benutzerverwaltung legt sie mit einer erzeugten
Adresse `ohne-email-<12 Zeichen>@kein-email.intern` an (wie Teilnehmer der
Ausbildungen, Endung `@kein-email.intern`), mit einem Zufallspasswort, das niemand
kennt. Sie können sich nicht anmelden. Die Adresse erscheint nirgends in der App.
Trägt ein Admin später eine E-Mail nach, schickt die App die Willkommens-E-Mail
(`/willkommen/senden`); beim Anlegen schickt der Server sie bei Platzhaltern nicht.

**Bewusst offen gelassen:** Admins und Verwalter dürfen die E-Mail einer
anderen Person weiter ändern (etwa einen Tippfehler korrigieren). Ändert jemand sie auf eine eigene Adresse, schickt sich
den Passwort-Link und stellt die Adresse zurück, hat er doch ein fremdes
Passwort gesetzt. Das ging schon vorher. Schließen lässt es sich mit einer
weiteren Bedingung am Admin-Zweig der Manage-Regel:
`&& (@request.body.email:isset = false || @request.body.email = email || email ~ "%@kein-email.intern")`.
Folge: Eine echte Adresse (auch einen Tippfehler darin) ändert dann nur noch der
Supervisor; Nachtragen bei Personen ohne E-Mail geht weiter. Die App meldet die
Ablehnung verständlich. Geprüft gegen beide Versionen; Stand Oktober 2026 nicht
eingetragen (Entscheidung des Betreibers).

## Eigene Rollen der Organisationen

Neben den vorgegebenen Rollen (Admin, Benutzer, MPG-Beauftragter, Lagerwart,
Ausbilder, Qualitätsmanagement, Teilnehmer) legt eine Organisation in der
Benutzerverwaltung eigene Rollen an, etwa „Kassenwart“. Die Rollen stehen im
JSON-Feld `organizations.eigene_rollen`:
```json
[{ "id": "eigen_k3m9x2qa", "name": "Kassenwart", "hinweis": "Dateien und Vorgänge", "farbe": "cognac", "archiviert": false }]
```
Die Rechte einer eigenen Rolle stehen wie bei den vorgegebenen in
`organizations.role_permissions[id]`, am Benutzer steht `users.role =
"eigen_k3m9x2qa"` oder die ID in `users.zusatzrollen` (siehe „users: Mehrere
Rollen je Person“). Die ID ist `eigen_` plus acht Zeichen aus `a–z0–9` und ändert
sich nie; Umbenennen ändert nur `name`.

**Die Rollen geben die Rechte, die Regeln prüfen die Kopie.** Die App rechnet aus
allen Rollen einer Person ihre Rechte und speichert sie in `users.permissions`;
ändert eine Organisation eine Rolle, zieht die App die Personen mit dieser Rolle
nach Rückfrage nach. Eine `eigen_`-ID kommt in keiner Regel vor; anders als
`admin`, `lager` und `mpg`, die in den Regeln oben Rechte auch ohne die Kopie
geben. Die App verwirft beim Lesen jede Rolle, deren ID nicht dem Muster
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

## Öffentliche Formulare: Absender

Patientendoku (`/doku`, `/patienten`, `/patienten-alt`, `/schnelldoku`), Produktausgabe und
Defektmeldung senden über eigene Routen unter `/api/responda/formular/…`. Der Server
entscheidet, wer Absender ist, und setzt Status, Frist, Absender und Besatzung selbst:

- **angemeldet** (Token eines aktiven Mitglieds dieser Organisation): die angemeldete Person,
  bestätigt. Gilt auch, wenn das öffentliche Formular ausgeschaltet ist (`hidden_forms`
  heißt „öffentlicher Link aus“); dann zählt nur, ob das Modul frei ist.
- **Modus „passwort“** (Voreinstellung der Patientendoku, sofort für alle Organisationen):
  voller Name und Passwort des Mitglieds, bestätigt. Aus der Warteschlange eines Geräts geht es
  auch ohne Passwort als **„Unterschrift ausstehend“**, aber nur, wenn der Name genau zu einem
  Mitglied passt; die Besatzung steht dann nur als Namen da, bis der Absender angemeldet
  unterschreibt.
- **Modus „frei“** (Voreinstellung von Produktausgabe und Defektmeldung): ein Name; passt er
  genau auf ein Mitglied, wird er verknüpft und als „nicht bestätigt“ markiert, sonst „ohne
  Konto“.

Die Wahl steht je Formular in `organizations.form_config.absender`
(`{ "patienten": "passwort", "produktausgabe": "frei", "defektmeldung": "frei" }`); fehlt sie
oder ist sie unlesbar, gilt die Voreinstellung. Schreiben dürfen sie wie bisher alle, die
`form_config` ändern dürfen (Update-Regel von `organizations`).

Den Namensabgleich macht nur der Server (`normName` in `pb_hooks/formular-regeln.js`): Groß
und klein, Leerzeichen, „Berg, Anna“ und „Anna Berg“, Umlaute und ae/oe/ue, ß und ss, Akzente,
Bindestriche und Apostrophe zählen gleich. Dazu Unicode NFKC (Vollbreite, Ligaturen,
mathematische Buchstaben), unsichtbare Zeichen fallen weg (Nullbreiten, Richtungszeichen wie LRM,
Variantenwähler, Füller), und Buchstaben anderer Schriften, die wie lateinische aussehen, zählen
als lateinische (Auszug der Verwechsler nach Unicode UTS 39: „Аnna Berg“ mit kyrillischem А ist
Anna Berg). Ein Name braucht Vor- und Nachnamen. Verknüpfbar ist
ein Konto der Organisation, das nicht gesperrt und nicht abgelaufen ist, keine Teilnehmenden
und kein Supervisor.

### Felder

Anlegen (*Plain text*, nicht Pflicht), **erst wenn die Hooks laufen** (Einführung Schritt 6). Ohne
sie gibt es kein „Unterschrift ausstehend“, alles andere geht:

| Sammlung | Feld | Werte |
|---|---|---|
| `patients` | `absender_status` | `bestaetigt`, `nicht_bestaetigt`, `ohne_konto`, `ausstehend`, `ohne_unterschrift`; leer bei alten Sätzen |
| `product_outputs` | `absender_status` | wie oben (ohne `ohne_unterschrift`) |
| `mpg_defect_reports` | `reporter_status` | wie oben (ohne `ohne_unterschrift`) |

Die Felder sind der Index für „Wartet auf deine Unterschrift“ und die Obergrenze offener
Einträge; die volle Angabe steht in `payload.absender` (Patienten, Produktausgabe:
`{ id, name, status, weg, modus, am, feld }`, bei „ohne Unterschrift“ dazu `abschluss`). Der
Server setzt sie, ein mitgeschickter Wert wird überschrieben. Server und App glauben
`payload.absender` nur, wenn `absender_status` denselben Status trägt; ein `payload.absender`
ohne passendes Feld (aus der Zeit ohne Hooks) gilt als alter Satz.

Vor den Hooks setzt niemand die Felder, und die Create- und Update-Regeln sind offen: Wer sie
vorher anlegt, lässt jeden „bestätigt“ oder „ausstehend“ mit fremdem Absender eintragen. Deshalb
leert der **erste Start** von `formular.pb.js` einmal alle gesetzten Statusfelder (Anzahl im Log,
`[formular] Erster Start`; Merker `responda_formular_start.txt` im Datenverzeichnis, danach nie
wieder). Fehlt `formular.pb.js` später (Rücknahme), hält `formular-felder.pb.js` die Felder dicht.

### Hook-Dateien

| Datei | Zweck |
|---|---|
| `formular-regeln.js` | Regeln als reine Funktionen (Namensabgleich, Absender, Besatzung, Drossel, Datenprüfung). Prüffälle: `src/lib/__tests__/formularRegeln.test.ts` |
| `formular.pb.js` | die Routen unten, der Schutz direkter API-Aufrufe, die gemeinsame Sperre mit der Anmeldung (auth-with-password), der Aufräum-Lauf der Drossel, das einmalige Leeren beim ersten Start |
| `formular-felder.pb.js` | nur ohne `formular.pb.js` (Rücknahme): Statusfelder bleiben leer bzw. wie sie waren, Absender bestehender Sätze bleibt; kommt ohne `formular-regeln.js` aus |
| `mitglieder-namen.pb.js` | kein zweites aktives Mitglied gleichen Namens in einer Organisation (nach `normName`, also auch mit Verwechslern oder unsichtbaren Zeichen); Namen mit gemischten Schriften werden abgewiesen |
| `doku-frist.pb.js` | Frist-Lauf, repariert (las den payload bisher falsch und schloss nie ab), lässt Ausstehendes liegen |
| `mpg.pb.js` | `reported_by_id` nur bei bestätigtem Melder und nur, solange `formular.pb.js` läuft; `reporter_status` fest |

Alle nach **`/opt/pb_hooks`** kopieren, PocketBase neu starten. Ein Syntaxfehler in einer Datei
unter `pb_hooks` hält PocketBase beim Start an (geprüft auf 0.28.4 und 0.40.5): Nach dem Kopieren
`GET /api/health` prüfen. Die CI startet beide Versionen mit `pb_hooks`
(`scripts/hooks-rauchprobe.mjs`). Einführung Schritt für Schritt:
`docs/formulare-absender-einfuehrung.md`.

### Routen

| Route | Wer | Was |
|---|---|---|
| `GET /api/responda/formular/{code}/stand` | alle | Einstellung je Formular, ob „ausstehend“ geht, `angemeldet` bei Mitglieds-Token |
| `POST /api/responda/formular/{code}/name` | alle (gedrosselt) | `{ vollstaendig, gefunden, eindeutig }`, nur ja/nein, keine Liste, keine E-Mail |
| `POST /api/responda/formular/{code}/absenden` | alle (gedrosselt) | ein Weg für alle drei Formulare; Kennung vom Client, doppelt gesendet mit gleichen Daten: `bereits: true` |
| `GET /api/responda/formular/unterschriften` | Mitglied | was auf die eigene Unterschrift wartet |
| `POST /api/responda/formular/unterschreiben` | Mitglied, nur das Ziel selbst | bestätigt nachträglich, Frist ab jetzt, Besatzung wird verknüpft |
| `POST /api/responda/formular/zurueckweisen` | Mitglied, nur das Ziel selbst | „Das war ich nicht“ statt zu unterschreiben. Patientendoku: wartet weiter, aber nicht mehr auf diese Person (`payload.absender.zurueckgewiesen`), die Leitung schließt sie ohne Unterschrift ab. Produktausgabe und Meldung: danach `ohne_konto` unter dem eingetragenen Namen, Kennung geleert |
| `POST /api/responda/formular/ohne-unterschrift` | Leitung, Recht `patienten` (auch befristet), Supervisor | Notausgang für ausstehende Patientenprotokolle, Pflicht-Begründung (10 bis 500 Zeichen), Satz wird freigegeben |
| `GET /api/responda/formular/mitglieder-pruefung` | wer Formulare einstellen darf | `koennen_nicht`: wer nicht mit Passwort bestätigen kann (Name unvollständig, ohne E-Mail); `doppelt`: Namen, die es mehrfach gibt (Passwort geht, Besatzung und „ohne Passwort“ nicht) |
| `GET /api/responda/formular/diagnose` | nur Superuser | `realIP`, IP-Topf, Trusted proxy, Felder, Größe des Speichers |

Antworten im Fehlerfall: `{ "status", "message", "grund", … }`; `message` ist deutsch und
wird in der App unverändert gezeigt. Der Hook gibt nie ein Token aus und schreibt nie Passwort,
Begründung oder Body ins Log. Er ist keine Anmeldung: Konten mit Anmeldung per Passwort und
E-Mail-Code bestätigen ein Formular mit dem Passwort allein.

Frist der Patientenprotokolle: 24 Stunden ab Eingang beim Server (bestätigt, nicht bestätigt,
ohne Konto). „Ausstehend“ hat keine Frist; sie beginnt mit dem Unterschreiben. Solange ein Satz
aussteht, lehnt der Server jede Änderung am payload und jeden Statuswechsel ab, auch von der
Leitung (sonst ließe er sich ohne Unterschrift archivieren).

### Schutz direkter API-Aufrufe

Solange die Create-Regeln der drei Sammlungen offen sind (alte App-Stände legen direkt an),
prüfen Hooks jede API- und Batch-Anfrage (Superuser ausgenommen):

- **Anlegen ohne Mitglieds-Token:** Organisation aktiv und Formular an und öffentlich, sonst
  403; gedrosselt wie die Route. Modus „passwort“: **403** „Diese Fassung der App kann nicht mehr
  absenden. Bitte zuerst den Entwurf speichern, dann die App neu öffnen.“ Modus „frei“: Absender
  nach dem Namen im Satz, leerer Name wird „ohne Konto“. Produktausgabe und Meldung: Ort,
  Artikel und Gerät müssen zur Organisation gehören (Gerät nicht außer Betrieb), Namen und
  Einheiten aus dem Bestand. Status vom Server. Die alte Maske (`ausfueller_name`, auch mit
  `protokoll_version` 2) wird am Feld „Name Ausfüller“ erkannt. Ein abgelehnter Teil rollt den
  ganzen Batch zurück.
- **Anlegen mit Mitglieds-Token:** Modul frei, sonst 403; Absender ist die angemeldete Person.
- **Ändern `patients`:** Absender, Frist, `abgesendet`, Prüfsumme und Änderungsliste bleiben,
  wie der Server sie gesetzt hat, ebenso `absender_status` und `organization_id`. Ohne
  Mitglieds-Token bleibt der Status, und der Inhalt eines bestätigten oder ohne Unterschrift
  abgeschlossenen Satzes lässt sich nicht ändern (403); ebenso eines Satzes, der nicht mehr offen
  oder dessen Frist abgelaufen ist (403, „abgeschlossen“; so überschreibt auch eine übernommene
  Änderung alter App-Stände nichts Freigegebenes). Rückfragen und Stellungnahmen ändern nur
  Mitglieder. Bei solchen gesperrten Sätzen bleiben ohne Mitglieds-Token auch alle anderen Felder
  (Titel, Gegenzeichnung `admin_name`, `admin_datum`, `admin_unterschrift`); bei ausstehenden für
  jeden alle außer payload und Status. Die Gegenzeichnung setzt ohne Mitglieds-Token niemand,
  auch nicht bei offenen Sätzen oder beim Anlegen (der Ausdruck der Patientenverwaltung zeigt sie
  als Bild). Druckname und gezeichnete Unterschrift bleiben beim bestätigten Absender, wenn
  jemand anderes ändert. Die Besatzung behält unveränderte Verknüpfungen; Kennungen übernimmt der
  Server nur aus Anfragen eines Mitglieds, passend zu einem verknüpfbaren Mitglied. Ein leeres
  flaches Feld (`mannschaft_tf` …) heißt „nicht angegeben“: Dann gilt der verschachtelte Name,
  geräumt ist ein Posten erst, wenn beide leer sind. Jede Änderung steht in `payload.aenderungen`. Ein Body nur mit `status` lässt den payload unberührt; ein
  unlesbarer payload führt nie zu einem Fehler.
- **Ändern `product_outputs`:** Absender und Empfänger (`user_id`, `user_name`) bleiben. Ein
  Body nur mit `status` (Lager „Ausbuchen“ im Batch) bleibt unberührt.
- **`mpg_defect_reports`:** `reporter_status` gehört zu den festen Feldern in `mpg.pb.js`.

### Drossel und Sperre

Im Speicher des Servers, nach einem Neustart leer. Anonyme Anfragen zählen je IP-Topf (IPv4 je
Adresse, IPv6 je /64), IPv6 zusätzlich je /48, angemeldete je Konto. Jede Passwortprüfung wird vor
dem Prüfen atomar reserviert, auch gleichzeitige Anfragen prüfen nie mehr als erlaubt. Die
normale Anmeldung (`auth-with-password` von `users`) zählt mit denselben Zählern, sonst ließe
sich die Sperre dort umgehen.

| Zweck | Grenze |
|---|---|
| Namensprüfung | anonym 120 je 5 Minuten, Mitglied 200 |
| Absenden (Route und direkte API) | anonym 60 je 10 Minuten, Mitglied 120 |
| „ausstehend“ | 20 je IP-Topf und Stunde, 10 je Ziel-Mitglied und Stunde, höchstens 20 offen je Ziel |
| Passwort je Konto und IP-Topf | 5 Prüfungen, mit der 5. 15 Minuten Sperre (dieses Konto von dieser Adresse); auch 20 gleichzeitige Anfragen prüfen höchstens 5 |
| Passwort je Konto | 30 Prüfungen über alle Adressen, dann 15 Minuten Sperre für Adressen, die das Konto schon falsch versucht haben; eine Adresse ohne eigene Fehlversuche darf weiter prüfen (niemand sperrt ein Konto aus der Ferne) |
| Passwort je IP-Topf | 30 falsche je 15 Minuten über alle Konten, dann 15 Minuten Sperre; unbekannte Namen zählen nicht; ein richtiges Passwort gibt seinen Platz zurück |
| je IPv6-/48 | Namensprüfung 500, Absenden 240, Passwort 100 je Fenster, höchstens 1 % des Speichers |
| Unterschriften-Liste, Unterschreiben, Mitglieder-Prüfung | 120, 30, 30 je 10 Minuten und Konto |
| Speicher | über 50000 Einträge zuerst sofort aufräumen (höchstens alle 30 Sekunden); bleibt er voll, werden nur anonyme Anfragen abgewiesen |

Ein 429 beim Absenden ist kein Verlust: Die App legt den Eintrag auf das Gerät und versucht es
nach der genannten Zeit erneut. Aufräumen alle 10 Minuten (`responda_formular_aufraeumen`).

### Trusted proxy

Läuft PocketBase hinter einem Proxy, kommen ohne Einstellung alle Anfragen von derselben
internen Adresse, und alle teilen sich einen Topf (gemeinsame Drossel, gemeinsame Sperre).
Deshalb **bevor die Hooks liegen**: unter *Settings → Trusted proxy* den Kopf des Proxys
eintragen (meist `X-Forwarded-For` oder `X-Real-IP`, bei Cloudflare `CF-Connecting-IP`). Ohne
echten Proxy nichts eintragen, sonst ließe sich die Adresse über den Kopf fälschen (geprüft).
Prüfen: `GET /api/responda/formular/diagnose` mit Superuser-Token zeigt bei `realIP` die eigene
öffentliche Adresse und keine `warnung`. Ohne Einstellung schreibt der Hook beim ersten Aufruf
nach dem Start eine Warnung ins Log.

### Rücknahme

Nur `formular.pb.js` aus `/opt/pb_hooks` entfernen und neu starten (`mitglieder-namen.pb.js` kann
bei Bedarf mit raus). Die App erkennt den alten Server und legt wieder direkt an; Geräte, die den
neuen Server in den letzten 24 Stunden gesehen haben, halten ihre Einträge so lange auf dem Gerät.
`doku-frist.pb.js` läuft ohne `formular.pb.js` und sogar ohne `formular-regeln.js` weiter
(eingebauter Rückfall) und lässt ausstehende Protokolle liegen.

Die Felder bleiben, ebenso **`formular-felder.pb.js` und `mpg.pb.js`**: Sie halten die
Statusfelder dicht, solange `formular.pb.js` fehlt (Merker `responda:formular_aktiv` fehlt). Neue
Sätze bekommen kein Statusfeld; bei bestehenden bleiben Feld, Organisation und die Schlüssel des
Servers im payload; bestätigte und ohne Unterschrift abgeschlossene ändert ohne Anmeldung
niemand, ausstehende niemand; `reported_by_id` setzt `mpg.pb.js` dann nie. Wer stattdessen alle
Dateien aus der Sicherung zurückspielt, löscht vorher die drei Felder; bei einer
Wiedereinführung legt er sie wieder erst nach den Hooks an.

### users: List und View schließen

Owner-Schritt 8 der Einführung, frühestens 7 Tage nach dem Kopieren der Hooks. Vorher den
bisherigen Wert von List und View notieren (für die Rücknahme). Voraussetzung: Kein öffentliches
Formular liest `users` mehr (mit diesem Paket erfüllt). Die Routen lesen über den Server und
hängen nicht an dieser Regel.

**List und View**
```
@request.auth.id != "" && (id = @request.auth.id || @request.auth.supervisor = true || (organization_id != "" && organization_id = @request.auth.organization_id && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now)))
```

- Ohne Anmeldung: List 200 mit 0 Einträgen, View 404.
- Mitglieder sehen die Konten ihrer Organisation, Supervisor alle, jeder seinen eigenen Satz
  (auch ohne Organisation, auch gesperrt). Anmelden und Token erneuern gehen weiter.
- Danach `node scripts/emails-verbergen.mjs` (Probelauf, zeigt die Zahl), dann mit
  `--ausfuehren`: setzt `emailVisibility = false` bei allen Konten. Wer die Manage-Regel erfüllt
  (Leitung, Benutzerverwaltung, Supervisor), sieht E-Mails weiter; andere Mitglieder nicht. Neue
  Konten legt die App schon mit `emailVisibility: false` an.
- Ein Filter `email ~ …` trifft verborgene Adressen still nicht; die Suchen der
  Patientenverwaltung gehen deshalb nur noch nach Namen.

Prüfen: ohne Anmeldung liefert `GET /api/collections/users/records` keine Einträge; Anmelden,
Benutzerverwaltung, Patientenverwaltung (Mannschaft nachtragen) und Unitas gehen.

### Geprüft

Gegen **PocketBase 0.28.4 und 0.40.5** mit Sammlungen und Regeln wie in Produktion (offene
Create-Regeln der Formulare, `users`-Regeln dieses Dokuments) und sieben Organisationen (Voreinstellung,
umgekehrte Einstellung, nur Patienten, inaktiv, öffentliche Formulare aus, alles mit Passwort,
Namensbeispiele): Namensabgleich (alle Beispiele, Einschleusung, Gleichlauf PocketBase und Node
Zeichen für Zeichen, ebenso Prüfsumme und IP-Topf), Absender in allen Fällen, Sperre auch bei 20
gleichzeitigen falschen Passwörtern (höchstens 5 Prüfungen), 48 gleichzeitige an 12 Konten
(genau 30 Prüfungen), Anmeldung teilt die Sperre, verteilte Fehlversuche sperren kein Konto aus
der Ferne, Drossel je Topf und Konto, IPv6 je /64 und je /48, Obergrenze des Speichers (auch
sofortiges Aufräumen), Verwechsler und unsichtbare Zeichen im Namens-Hook, Titel und
Gegenzeichnung gesperrter Sätze, leere flache Besatzungsfelder, alte Maske im Modus frei, „ausstehend“ mit allen Grenzen, Unterschreiben (auch zwei
gleichzeitig), ohne Unterschrift abschließen, übernommene Änderungen alter Stände, direkte
API-Aufrufe (Anlegen, Ändern, Batch, Lager „Ausbuchen“, unlesbare payloads), Frist-Lauf über mehr
als 200 offene Protokolle, Namens-Hook, `users` List/View geschlossen und `emailVisibility`, kein
Passwort im Log; dazu eigene Starts ohne `formular.pb.js` (Rücknahme), ohne `formular-regeln.js`,
ohne die Felder `absender_status`/`reporter_status` und ein Lebenslauf auf demselben
Datenverzeichnis (Felder vor den Hooks gefälscht, erster Start leert, Rücknahme hält dicht,
Wiedereinführung leert nicht noch einmal). **781 Prüfungen je Version, alle bestanden.**
Gegenprobe ohne `formular.pb.js`: 315 von 692 schlagen an.

## Eigene Formulare und anpassbare Standardformulare

Organisationen bauen eigene Formulare (`form_templates`, verwaltet unter Vorgänge), Einsendungen
landen in `form_submissions` (Eingang unter Vorgänge). Produktausgabe, Defektmeldung und CIRS
lassen sich je Organisation anpassen (Bezeichnung, Hilfetext, optionale Felder ausblenden,
Pflicht, Reihenfolge, eigene Felder); die Einstellung steht in
`organizations.form_config.formulare.<formular>` und wird geschrieben wie bisher (Update-Regel von
`organizations`). Patientendoku ist fest und hat keine Einstellung. Vertrag:
`pb_hooks/formular-regeln.js` (Abschnitt „Felder“, Zwilling `src/lib/formular/felder.ts`,
Prüffälle `formularFelder.test.ts` und `formularFelderGleichlauf.test.ts`).

### Eigene Formulare: API-Regeln

Recht Vorgänge (`dokumente`, auch befristet nach „Befristete Rechte in Regeln“), Leitung oder
Supervisor, aktives Konto, keine Teilnehmenden; dieselbe Rechnung wie `darfVorgaenge` im Hook. In
den Regeln unten steht dieser Teil jeweils ausgeschrieben (zum Kopieren):
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer" && (@request.auth.supervisor = true || @request.auth.role = "admin" || @request.auth.permissions.dokumente = true || (@request.auth.temp_permissions.dokumente.until ~ " " && @request.auth.temp_permissions.dokumente.until > @now))
```

`form_templates` (Vorlagen). List und View bleiben **öffentlich** (leerer Text): Die öffentlichen
Seiten lesen die Vorlage ohne Anmeldung.

**Vorlagen Create**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer" && (@request.auth.supervisor = true || @request.auth.role = "admin" || @request.auth.permissions.dokumente = true || (@request.auth.temp_permissions.dokumente.until ~ " " && @request.auth.temp_permissions.dokumente.until > @now)) && @request.body.organization_id = @request.auth.organization_id
```

**Vorlagen Update**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer" && (@request.auth.supervisor = true || @request.auth.role = "admin" || @request.auth.permissions.dokumente = true || (@request.auth.temp_permissions.dokumente.until ~ " " && @request.auth.temp_permissions.dokumente.until > @now)) && organization_id = @request.auth.organization_id && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)
```

**Vorlagen Delete**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer" && (@request.auth.supervisor = true || @request.auth.role = "admin" || @request.auth.permissions.dokumente = true || (@request.auth.temp_permissions.dokumente.until ~ " " && @request.auth.temp_permissions.dokumente.until > @now)) && organization_id = @request.auth.organization_id
```

`form_submissions` (Einsendungen). Lesen und ändern nur Berechtigte derselben Organisation;
Echtzeit-Abos folgen dieser Regel (geprüft: ohne Recht und aus fremder Organisation kommt nichts
an). **Delete**: gesperrt (Schloss, null), gelöscht wird nur in der Admin-Oberfläche. **Create**
bleibt vorerst, wie es ist (offen): Alte App-Stände legen direkt an, der Hook in `formular.pb.js`
weist sie ab („später schließen“ unten).

**Einsendungen List, View und Update**
```
@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer" && (@request.auth.supervisor = true || @request.auth.role = "admin" || @request.auth.permissions.dokumente = true || (@request.auth.temp_permissions.dokumente.until ~ " " && @request.auth.temp_permissions.dokumente.until > @now)) && organization_id = @request.auth.organization_id
```

War List oder View von `form_submissions` vorher offen (leerer Text), konnte jeder ohne Anmeldung
alle Einsendungen aller Organisationen lesen; ab Schritt 2 der Einführung ist das zu. Die
Vorprüfung zeigt, wie die Regel heute steht. Steht sie noch offen, antwortet die Liste mit 403
statt Einsendungen anderer Organisationen zu zeigen (Hook, Eintrag im Log); Echtzeit hält nur die
Regel dicht.

`cirs_reports`: Regeln unverändert (oben, „cirs_reports“). Neu prüft der Hook beim Anlegen
Organisation, Modul, Inhalt und eigene Felder.

### Felder

| Sammlung | Feld | Typ | wann | schreibt |
|---|---|---|---|---|
| `form_templates` | `absender` | Plain text | **vor der App** | App: `passwort`, `frei`, `anonym`; fehlt oder unbekannt heißt `frei` |
| `form_templates` | `archiviert` | Bool | **vor der App** | App; archiviert heißt immer inaktiv |
| `form_templates` | `abschnitte` | JSON | **vor der App** | App: `[{ id, titel, hilfe? }]` |
| `form_templates` | `version` | Number | nach den Hooks | nur Hook |
| `form_templates` | `fassungen` | JSON | nach den Hooks | nur Hook: die letzten 10 Fassungen `{ "<version>": { schema, abschnitte, am } }` |
| `form_submissions` | `status` | Plain text | nach den Hooks | Server beim Anlegen `neu`, danach Berechtigte: `neu`, `in_bearbeitung`, `erledigt` |
| `form_submissions` | `notiz` | Plain text | nach den Hooks | Berechtigte, bis 4000 Zeichen |
| `form_submissions` | `absender_status` | Plain text | nach den Hooks | nur Server (wie `product_outputs`) |
| `form_submissions` | `bearbeitung` | JSON | nach den Hooks | nur Hook: `{ verlauf: [{ id, am, von: { id, name }, status_vorher, status, notiz }] }`, höchstens 500 |
| `mpg_defect_reports` | `eigene` | JSON | nach den Hooks | nur Server (Route) |

**Größe der JSON-Felder** (in der Admin-Oberfläche „Max size“, 0 heißt 1 MB): `form_templates.schema`
**2000000**, `form_templates.fassungen` **8000000**, `form_submissions.payload` **2000000**. Die
übrigen (`abschnitte`, `bearbeitung`, `mpg_defect_reports.eigene`) reichen mit der Vorgabe. Zu klein
heißt: Eine große Vorlage oder Einsendung lässt sich nicht speichern („Failed to create record“).
`fassungen` hält der Hook selbst unter 2 000 000 Zeichen (die älteste Fassung fällt zuerst weg, die
aktuelle bleibt immer); die Vorprüfung zeigt, wie groß die Felder heute sein dürfen.

Felder, die die App schreibt, kommen **vor** die App, sonst verwirft PocketBase den Wert still
(die App sagt es, wenn eines fehlt). Felder, die nur der Server setzt, kommen **nach** den Hooks:
vorher könnte sie jeder ohne Anmeldung füllen. `form_submissions.absender_status` leert der erste
Start dieses Pakets einmal (`[formular] Erster Start eigene` im Log, Merker
`responda_eigene_start.txt` im Datenverzeichnis), unabhängig vom Merker des Absender-Pakets.
`template_id` darf Text oder Relation sein.

`form_templates.schema` bleibt eine Liste. Der Hook speichert jedes Feld in der neuen Form
(`{ id, typ, label, hilfe?, pflicht?, aus?, optionen?, einheit?, min?, max?, abschnitt? }`) und
spiegelt dazu die alten Schlüssel (`fieldType`, `required`, `hint`, `options`), damit alte
App-Stände die Vorlage weiter anzeigen. Alte Vorlagen liest der Server und die App wie neue.
Feldtypen: Text, Langtext, Zahl, Datum, Uhrzeit, Auswahl, Mehrfachauswahl, Ja/Nein.

Eigene Angaben eines Standardformulars stehen als `{ v: 1, version, felder, werte, aelter? }` in
`product_outputs.payload.eigene`, `mpg_defect_reports.eigene` und `cirs_reports.payload.eigene`;
`felder` ist ein Schnappschuss der Felder dieser Fassung, Bezeichnungen kommen vom Server, nie vom
Client. Eine Einsendung trägt im payload `{ v: 2, titel, version, abschnitte, felder, werte,
aelter, absender?, absender_modus, abgesendet, eingang_sha256 }`; bei „anonym“ fehlt `absender`.
Alte Einsendungen (flacher payload) bleiben lesbar.

### Hook-Dateien

| Datei | Zweck |
|---|---|
| `formular-regeln.js` | dazu: Felder, Einstellung lesen (`standardKonfig`), Schema prüfen und normalisieren, Werte prüfen (`angabenBauen`), Fassungen, Rechte `darfVorgaenge` |
| `formular.pb.js` | Routen für eigene Formulare (`formular: "eigen"`), eigene Felder in Produktausgabe und Defektmeldung, `form_submissions` direkt anlegen gesperrt, `payload.eigene` beim Ändern fest |
| `eigene-formulare.pb.js` (neu) | Vorlagen prüfen (Schema, Titel, Absender, Fassungen, Konflikt 409, Löschen nur ohne Einsendungen), Einsendungen nur Status und Notiz ändern (mit Verlauf), nie löschen, Liste und Ansicht nur mit Recht; bleibt bei einer Rücknahme liegen und kommt ohne `formular-regeln.js` aus (dann nur Regeln, Einsendungen trotzdem nur Status und Notiz) |
| `cirs.pb.js` | beim Anlegen: Organisation aktiv, CIRS an und öffentlich, „Was ist passiert?“ nicht leer, eigene Felder geprüft; `eigene` bleibt beim Ändern; Rückfall ohne `formular-regeln.js` |
| `formular-felder.pb.js` | ohne `formular.pb.js`: Einsendungen gehen wieder direkt (alter Weg), `status` `neu`, Server-Felder leer |
| `mpg.pb.js` | `mpg_defect_reports.eigene` bleibt beim Ändern, wie gemeldet |

### Routen (zusätzlich)

| Route | Neu |
|---|---|
| `GET /{code}/stand` | `version: 2`; `formulare.eigen` (`an` = Modul Vorgänge frei, `ausstehend` = Feld `form_submissions.absender_status` da); `faehig.eigene_felder` (Defektmeldung nur mit Feld `mpg_defect_reports.eigene`), `faehig.eigene_formulare`, `faehig.eingang` (Felder `status`, `notiz`, `bearbeitung` da) |
| `POST /{code}/name` | `{ formular: "eigen", vorlage, name }`; Vorlage fehlt 400 (`feld: vorlage`), nimmt nichts an 403 `formular_aus` („Dieses Formular ist nicht aktiv.“), anonym 400 (`feld: formular`) |
| `POST /{code}/absenden` | `{ formular: "eigen", vorlage, id, absender, daten: { version, werte } }`. Die Vorlage muss zur Organisation gehören, aktiv und nicht archiviert sein, Modul Vorgänge frei, auch mit Mitglieds-Token. Absender nach der Vorlage: `passwort` und `frei` wie bei der Produktausgabe (auch „ausstehend“), `anonym` ohne Absender, auch mit Token, ein mitgeschickter Name wird verworfen. Pflicht und Werte prüft der Server gegen die Fassung `daten.version`. Als älter gilt nur eine ganze Zahl kleiner als die aktuelle Fassung: daraus nimmt er an, was gültig ist, legt Unpassendes als Text unter `aelter` ab und hält die genannte Fassung im Satz fest (nichts bleibt in einer Warteschlange hängen). Alles andere (fehlt, Text, gleich, größer) prüft er streng wie die aktuelle Fassung, Pflicht eingeschlossen; so lässt sich die Prüfung nicht mit einer falschen Nummer umgehen. Dasselbe gilt für `eigene` der Standardformulare und `payload.eigene` bei CIRS. Fehler 400 `daten` mit `feld: "werte.<Kennung>"` und Text („Bitte „…“ ausfüllen.“, „Bitte „…“ prüfen.“), zu groß (200 000 Zeichen) `feld: "werte"`. Antwort dazu `anonym: true/false`. Produktausgabe und Defektmeldung nehmen `daten.eigene = { version, werte }` (Fehler `feld: "eigene.<Kennung>"`, zu groß ab 60 000 `feld: "eigene"`); Defektmeldung nur mit Feld `eigene`, sonst verworfen |
| `GET /unterschriften`, `POST /unterschreiben`, `POST /zurueckweisen` | auch `formular: "eigen"` (Eintrag mit `vorlage`, `titel`, Zusammenfassung „Titel: erster Wert“); die Obergrenze offener „ausstehend“ zählt Einsendungen mit |
| `GET /diagnose` | `felder` nennt auch die Felder oben |

### Schutz direkter API-Aufrufe (zusätzlich)

- **`form_submissions` anlegen:** nur über die Route; direkt ohne Superuser **403** „Diese Fassung
  der App kann dieses Formular nicht mehr senden. Bitte die Seite neu laden.“
- **`form_submissions` ändern:** nur `status` (`neu`, `in_bearbeitung`, `erledigt`, sonst 400) und
  `notiz` (bis 4000, sonst 400); alles andere (payload, Absender, Vorlage, Organisation) bleibt.
  Jede Änderung von Status oder Notiz steht mit Person und Zeit in `bearbeitung.verlauf` (ohne den
  Text der Notiz). Auch ausstehende Einsendungen lassen sich so bearbeiten.
- **`form_submissions` löschen:** nur Superuser.
- **`form_templates` anlegen und ändern:** Schema geprüft (Kennungen, Arten, Bezeichnung bis 120,
  Hilfetext bis 300, Auswahl 2 bis 30 Optionen ohne Doppelte, Zahlgrenzen, Abschnitte bis 20,
  Felder bis 80), Titel 1 bis 120, Beschreibung bis 500, sonst 400 mit Grund („Die Felder des
  Formulars sind nicht gültig: Feld 3 hat keine Bezeichnung.“). `version` und `fassungen` setzt
  nur der Hook (+1, wenn sich Felder oder Abschnitte ändern; die letzten 10 Fassungen, höchstens
  2 000 000 Zeichen). Ein Body mit `basis_version`, die nicht mehr stimmt: **409** „Das Formular
  wurde inzwischen an anderer Stelle geändert. Bitte neu laden.“ Die Organisation bleibt beim
  Ändern. **Bestandsschutz:** Der alte Baukasten ließ Auswahlfelder mit weniger als zwei Optionen,
  doppelte Optionen und lange Texte zu. Bleibt ein solches gespeichertes Schema (oder ein zu langer
  Titel, eine zu lange Beschreibung) bei einer Änderung inhaltlich gleich, lässt der Hook es stehen;
  so lässt sich eine alte Vorlage weiter aktivieren, deaktivieren und archivieren. Wer Felder
  ändert, muss sie gültig machen.
- **Regeln noch offen:** Stehen Create, Update oder Delete von `form_templates` offen, prüft der
  Hook das Recht selbst (403 „Eigene Formulare verwalten nur Mitglieder mit dem Recht für
  Vorgänge.“). Steht List oder View von `form_submissions` offen, antwortet die Liste ohne Recht
  oder mit Einsendungen anderer Organisationen mit 403 und die Ansicht ohne Recht mit 403 (Eintrag
  im Log). Echtzeit-Abos hält nur die Regel dicht.
- **`form_templates` löschen:** mit Einsendungen **400** „Dieses Formular hat Einsendungen. Bitte
  archivieren statt löschen.“
- **`product_outputs`, `mpg_defect_reports`:** direkt angelegt ohne `payload.eigene` bzw. mit
  leerem `eigene`; beim Ändern bleiben die eigenen Angaben (auch Lager „Ausbuchen“ im Batch).
- **`cirs_reports` anlegen:** Organisation aktiv und CIRS an und öffentlich, sonst 403; „Was ist
  passiert?“ leer: 400; eigene Felder ungültig: 400 mit Text. Ohne `formular-regeln.js` prüft der
  Hook wie früher nur den Status und behält von `payload.eigene` nur `version` und `werte` (bis
  60 000 Zeichen).

### Rücknahme

Nur `formular.pb.js` entfernen: Eigene Formulare senden dann auf dem alten Weg direkt (ohne
Prüfung, `status` `neu`, Server-Felder leer), Vorlagen und Eingang bleiben durch
`eigene-formulare.pb.js` geschützt, CIRS durch `cirs.pb.js`. Die Felder bleiben.

### Geprüft

Gegen **PocketBase 0.28.4 und 0.40.5** mit den Regeln dieses Abschnitts (Hook-Prüfung
`scratchpad/pb/formular-test/pruefen.mjs`, zusätzlich zu den Fällen des Absender-Pakets): **1235
Prüfungen je Version, alle bestanden**, davon 454 für dieses Paket. Geprüft: Vorlagen anlegen und
ändern mit und ohne Recht (befristet gültig und abgelaufen, fremde Organisation, anonym, auch bei
offenen Regeln), jede Regel von `schemaFehler`, Altschlüssel, Fassungen (12 Änderungen, genau 10),
`basis_version` 409, Archivieren, Bestandsschutz, Löschen mit und ohne Einsendungen; Absenden in
allen drei Absender-Arten (anonym auch mit Mitglieds-Token ohne Namen), jeder Feldtyp gültig und
ungültig, Pflicht nur bei der aktuellen Fassung, ältere Fassung mit `aelter`, falsche Fassungsnummer streng, zu groß, doppelt;
Einsendungen nur Status und Notiz mit Verlauf, nie löschen, Liste, Ansicht und Echtzeit nur für
Berechtigte derselben Organisation; Unterschreiben, Zurückweisen und Obergrenze mit eigenen
Formularen; eigene Felder in Produktausgabe (auch Lager „Ausbuchen“ im Batch), Defektmeldung und
CIRS; Gleichlauf goja = Node; Rücknahme, ohne `formular-regeln.js`, ohne die Felder nach den Hooks,
erster Start eigene (auch wenn das Absender-Paket schon lief). Gegenproben auf 0.40.5: ohne
`eigene-formulare.pb.js` schlagen 147 Fälle an, ohne `cirs.pb.js` 15, ohne `formular.pb.js` 495
von 1084. Dazu `scripts/formular-vorpruefung.mjs` (30 Prüfungen je Version) und
`scripts/hooks-rauchprobe.mjs` auf beiden Versionen.

## Öffentliche Formulare: später schließen

Noch **nicht** ausführen. Erst, wenn keine alten App-Stände mehr direkt anlegen (frühestens nach
dem 31.01.2027, dem Enddatum des alten Wegs in der App, `ALTER_SERVER_BIS`) und im Log keine
direkten Anlagen mehr auftauchen:

1. Create-Regel von `patients`, `product_outputs`, `mpg_defect_reports` und `form_submissions`
   auf **gesperrt** (Schloss, null). Dann legt nur noch der Server über die Routen an. Vorher die
   bisherigen Werte notieren.
2. Danach erst, mit eigenen Routen: anonymes Update, View und List von `patients` (Bearbeiten mit
   `?id=`, Patientenzugang `/p/:code`), List/View von `inventory_items` und
   `inventory_locations` (Artikelliste der Produktausgabe), List/View von `mpg_devices`
   (Geräteliste der Defektmeldung).

Rücknahme: die notierten Regeln wieder eintragen.

## Hub und Hinweise

Der Hub merkt sich am Konto, welche Apps jemand sehen will (App-Auswahl), und „Neu in Responda“
zeigt jedem Benutzer nach einem Update einmal eine kurze Info des Supervisors. Dafür zwei neue
Felder an `users` und die neue Sammlung `responda_hinweise`. Schritte in der richtigen
Reihenfolge: `docs/hub-und-hinweise-einfuehrung.md`. Die App läuft schon vorher (Rückhalt auf dem
Gerät, ohne Sammlung erscheint kein Hinweis).

### users: hub_apps und hinweis_gesehen_am

| Feld | Typ | Inhalt |
|---|---|---|
| `hub_apps` | JSON, nicht Pflicht, Max size 4000 | `{ "ausgeblendet": [...], "reihenfolge": [...] }`: App-IDs aus `src/lib/apps.ts`. Ausgeblendete statt sichtbarer Liste, damit neu erteilte Apps von selbst erscheinen (`src/lib/hubApps.ts`) |
| `hinweis_gesehen_am` | Date, nicht Pflicht | `veroeffentlicht_am` des zuletzt bestätigten Hinweises (`src/lib/hinweise.ts`) |

**Keine Regeländerung nötig.** Die Update-Regel aus „users: Rechte vergeben nur
Verantwortliche“ (Fassung mit `zusatzrollen`) erlaubt im eigenen Zweig
(`id = @request.auth.id && …`) alles außer einer **Sperrliste** heikler Felder: `permissions`,
`temp_permissions`, `role`, `supervisor`, `organization_id`, `disabled`, `expires_at`,
`permissions_migrated`, `zusatzrollen`. `hub_apps` und `hinweis_gesehen_am` stehen nicht darauf:
Jeder darf sie an sich selbst schreiben (wie heute schon `einfuehrung`), mit aktivem Konto (die
Bedingung vorn in der Regel). Fremde Konten ändern wie bei jedem Feld nur Admin und Verwalter
(eigene Organisation) und der Supervisor. Der Hook `pb_hooks/mitglieder-namen.pb.js` prüft beim
Ändern nur den Namen. Harmlos: Wer sich selbst Unsinn in die Felder schreibt, ändert nur seinen
eigenen Hub bzw. sieht einen Hinweis nicht. Steht noch die Übergangsregel, gilt dasselbe (gleicher
eigener Zweig).

Ohne die Felder verwirft PocketBase die Werte still; die App merkt sich Auswahl und Bestätigung
dann nur auf dem Gerät (`hub_wahl_<id>`, `hinweis_gesehen_<id>`). Mit Feld steht eine Änderung der
App-Auswahl, die noch nicht im Konto ist (ohne Netz), gekennzeichnet auf dem Gerät
(`hub_wahl_<id>` und `hub_wahl_offen_<id>`): Sie gilt dort vor dem Kontowert und wird beim
nächsten Öffnen des Hubs, wenn das Netz wiederkommt oder die App wieder in den Vordergrund kommt,
ins Konto geschrieben. Die letzte Änderung gewinnt. Beim Abmelden leert die App den
Gerätespeicher: Ohne Felder geht die Auswahl dann verloren, und ein schon bestätigter Hinweis
kann noch einmal erscheinen.

### responda_hinweise: API-Regeln

Neue Sammlung, Typ **Base**, Name `responda_hinweise`:

| Feld | Typ | |
|---|---|---|
| `titel` | Plain text | Nonempty, Max length 120 |
| `text` | Plain text | Max length 5000. Absätze mit Leerzeile, Aufzählung mit „- “, kein HTML (die App zeigt ihn nur als Text) |
| `veroeffentlicht` | Bool | |
| `veroeffentlicht_am` | Date | beim ersten Veröffentlichen gesetzt, nach der **Serverzeit**, bleibt danach |
| `erstellt_von` | Plain text | Max length 120, Name des Supervisors, sonst „Supervisor“; nie die E-Mail. Die App zeigt es nur in der Verwaltung, lesbar ist es aber für jeden Angemeldeten (siehe unten) |
| `created`, `updated` | Autodate | wie PocketBase sie anlegt, nicht löschen: `updated` liefert beim Veröffentlichen die Serverzeit |

Hinweise gelten für alle Organisationen (Betreiber-Info nach Updates). Lesen dürfen angemeldete
Benutzer nur veröffentlichte, der Supervisor alle; schreiben nur der Supervisor mit aktivem Konto;
löschen nur Unveröffentlichtes (ein veröffentlichter Hinweis wird zurückgezogen, nicht gelöscht).

**List/Search**
```
@request.auth.id != "" && (veroeffentlicht = true || @request.auth.supervisor = true)
```

**View**
```
@request.auth.id != "" && (veroeffentlicht = true || @request.auth.supervisor = true)
```

**Create**
```
@request.auth.id != "" && @request.auth.supervisor = true && @request.auth.disabled != true
```

**Update**
```
@request.auth.id != "" && @request.auth.supervisor = true && @request.auth.disabled != true
```

**Delete**
```
@request.auth.id != "" && @request.auth.supervisor = true && @request.auth.disabled != true && veroeffentlicht != true
```

Ohne Anmeldung: Liste leer, Ansicht 404. Ohne eingetragene Regel (Schloss) sieht nur der Superuser
etwas; die App zeigt dann keinen Hinweis und der Supervisor bekommt beim Laden eine Ablehnung.

List und View geben bei veröffentlichten Hinweisen **alle Felder** heraus, auch `erstellt_von`, an
jeden angemeldeten Benutzer aller Organisationen. Die App schreibt dort deshalb nur den Namen des
Supervisors (ohne Namen „Supervisor“), nie seine E-Mail, und das Blatt „Neu in Responda“ fragt nur
`id,titel,text,veroeffentlicht,veroeffentlicht_am` ab.

**Datum nach der Serverzeit.** Welcher Hinweis der neueste ist und wer ihn schon gesehen hat,
entscheidet allein `veroeffentlicht_am`. Ginge die Uhr des Supervisor-Geräts vor, verdeckte ein zu
spät datierter Hinweis jeden späteren. Die Verwaltung veröffentlicht deshalb in zwei Schritten:
erst speichern (in der Liste ohne Änderung), dann `veroeffentlicht: true` mit
`veroeffentlicht_am` = Serverzeit. Die Serverzeit kommt aus `updated` der ersten Antwort (PocketBase
setzt `updated` bei jedem Speichern neu, auch ohne Änderung; geprüft mit 0.28.4 und 0.40.5). Geht
die Uhr des Geräts mehr als 2 Minuten falsch, sagt die Verwaltung das. Ohne `updated` gilt die
Geräte-Uhr.

### Geprüft

Gegen **PocketBase 0.28.4 und 0.40.5** mit den Regeln aus diesem Abschnitt (gelesen aus dieser
Datei) und der Update-Regel von `users` aus „users: Rechte vergeben nur Verantwortliche“: **67
Prüfungen je Version, alle bestanden**. Geprüft: Liste, Ansicht und Filter auf Entwürfe ohne
Anmeldung, als Mitglied, als Leitung (kein Supervisor) und als Supervisor; Anlegen, Ändern,
Veröffentlichen und Löschen (Entwurf, veröffentlicht, zurückgezogen) für alle, dazu ein gesperrter
Supervisor mit noch gültigem Token und Löschen per Batch; Titel leer, 121 Zeichen, 120 Umlaute,
Text 5001 Zeichen. An `users`: eigenes `hub_apps` und `hinweis_gesehen_am` schreiben ja, fremdes
nein, zusammen mit `permissions` nein, `hub_apps` über 4000 Bytes nein, Leitung für ein Mitglied
der eigenen Organisation ja; ohne die Felder 200 mit still verworfenen Werten; ohne Sammlung 404.
Dazu die Browserprobe (gebaute App gegen 0.40.5, Abschnitte 34 bis 37, 103 Prüfungen): Supervisor
→ Hinweise, das Blatt nach dem Login und ohne Login, nach der Einführung, in der Lernbar, nur der
neueste, einmal (auch nach Ab- und Anmelden), neue Konten ohne Blatt, HTML bleibt Text, ohne Feld
am Konto (Gerät), ohne Sammlung und ohne Netz kein Blatt und kein Fehler; Supervisor-Gerät mit
einen Tag vorgehender Uhr (Datum nach der Serverzeit, Satz zur Uhr), Konto ohne Namen
(`erstellt_von` = „Supervisor“), das Blatt fragt nur seine Felder ab.
