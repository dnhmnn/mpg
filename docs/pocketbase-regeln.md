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

## Vorsicht bei befristeten Rechten in Regeln

`@request.auth.temp_permissions.<recht>.until > @now` ist **unzuverlässig**:
PocketBase vergleicht das Ablaufdatum als Text, und die App speichert es im
ISO-Format (`2026-10-15T07:00:00.000Z`), `@now` aber mit Leerzeichen
(`2026-10-15 08:00:00.000Z`). Ein am selben Tag abgelaufenes Recht gilt so bis
Mitternacht (UTC) weiter. Befristete Rechte deshalb nicht in Regeln prüfen,
sondern in einem Hook (dort lassen sich die Daten richtig vergleichen).

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
geprüft: 1080 Prüfungen je Version, alle bestanden.

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
(@request.auth.permissions.lager = true || @request.auth.supervisor = true)
```

Recht **Lager verwalten** (Regeln verlangen es immer zusätzlich zu „Lager“):
```
(@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true)
```

Daraus die vier Regeln, die sich unten wiederholen:

**L — Lesen** (Organisation + Lager)
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true)
```

**A — Anlegen** (nur in der eigenen Organisation)
```
@request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true)
```

**Ä — Ändern** (Organisation + Lager, nicht in eine andere Organisation verschieben)
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)
```

**V — Verwalten** (Organisation + Lager + Lager verwalten)
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true)
```

Befristete Rechte (`temp_permissions`) wirken in diesen Regeln nicht (siehe
„Vorsicht bei befristeten Rechten“ oben): Wer Lager nur befristet hat, sieht
die Kachel, bekommt aber keine Daten. Lager dafür dauerhaft vergeben.

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
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id) && (@request.body.archiviert:isset = false || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true))
```

**² Bestand — Delete.** Die App löscht nach einer Entnahme Zeilen, die auf 0
stehen; das darf jeder mit Lager-Recht. Eine Zeile mit Bestand löschen nur
„Lager verwalten“. PocketBase prüft die Regel gegen den gespeicherten Stand —
auch im selben Batch direkt nach dem Abbuchen auf 0 (geprüft).
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (quantity <= 0 || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true))
```

**³ Buchungen — Create.** Nur in der eigenen Organisation. Wer schreibt, setzt
der Hook `lager.pb.js` selbst aus der Anmeldung in `user_id` — ein mitgeschickter
Wert wird überschrieben, auch in Sammelbuchungen (geprüft auf 0.28.4 und 0.40.5).
Deshalb verlangt die Regel `user_id` **nicht**: Ältere App-Stände (die iOS-App vor
ihrem nächsten Update, lange offene Tabs) schicken es nicht mit und würden sonst
nicht mehr buchen können. Überträgt jemand eine fremde Offline-Buchung, steht in
`user` die Person, die erfasst hat, in `user_id` die, die überträgt.
```
@request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true)
```
Update und Delete bleiben gesperrt; zusätzlich sperrt der Hook (unten).

Das Stornieren fremder Buchungen prüft nur die App, nicht die Regel: Eine
Gegenbuchung ist eine gewöhnliche neue Buchung, und buchen darf jeder mit
Lager-Recht. Sie steht mit Namen im Logbuch.

**⁴ Einstellungen — Create/Update** (Inventur-Plan, Statistik ab Datum): nur
„Lager verwalten“.
```
@request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true)
```
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)
```

**⁵ Inventuren — Update/Delete.** Eine offene Inventur darf jeder mit
Lager-Recht abschließen, abbrechen oder neu starten. Eine abgeschlossene darf
nur „Lager verwalten“ ändern oder löschen („Zurücksetzen“) — sonst ließe sie
sich wieder öffnen und dann löschen.
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id) && (status != "abgeschlossen" || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true))
```
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && (status != "abgeschlossen" || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true))
```

**⁶ Inventurpositionen — Delete.** Positionen einer offenen Inventur
(Abbrechen, Neu starten) darf jeder mit Lager-Recht löschen; die einer
abgeschlossenen oder verwaisten nur „Lager verwalten“. Funktioniert, ob
`audit_id` Text oder Relation ist.
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true) && ((@collection.inventory_audits.id ?= audit_id && @collection.inventory_audits.status ?!= "abgeschlossen") || (@request.auth.permissions.lager_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "lager" || @request.auth.role = "mpg" || @request.auth.supervisor = true))
```

### Öffentliches Formular Produktausgabe

`src/pages/public/OrgProduktausgabe.tsx` liest Artikel und Standorte **ohne
Anmeldung**. List und View von `inventory_items` und `inventory_locations`
bleiben deshalb vorerst öffentlich (leer, Schloss offen) — damit kann jeder die
Artikel- und Standortlisten aller Organisationen abfragen. Das schließt
Paket 5, indem die öffentliche Ausgabe über einen Hook läuft. Danach für beide
Collections List und View auf **L**:
```
@request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.permissions.lager = true || @request.auth.supervisor = true)
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
- **Admin** (Rolle `admin` oder Recht Benutzerverwaltung `unitarii`): alle
  Benutzer der eigenen Organisation, auch sich selbst — aber kein
  Supervisor-Recht vergeben, niemanden in eine andere Organisation verschieben
  und Supervisor-Konten gar nicht ändern (sonst könnte ein Admin das Passwort
  eines Supervisors setzen).
- **Supervisor**: alles.
- **Ausbildungs-Verwalter** (`ausbildungen_manage`, wie in
  `Ausbildungen.tsx`): Teilnehmer der eigenen Organisation pflegen und einfache
  Benutzer (Rolle `benutzer` oder ohne Rolle) als Teilnehmer verknüpfen — nie
  sich selbst, und niemandem ein Recht neu geben außer Lernbar, Dashboard,
  Chat, Notizen und QR.
  Rechte, die ein verknüpfter Benutzer schon hat, bleiben erlaubt. (Sonst legte
  er einen Teilnehmer mit selbst gewähltem Passwort und Benutzerverwaltung an
  und meldete sich damit an.) Kommt ein neues Recht dazu, gehört es in diese
  Liste.

**Update**
```
@request.auth.id != "" && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true)))
```

**Manage** (Passwort oder E-Mail eines anderen ohne altes Passwort setzen —
Unitarii, Einstellungen, Supervisor-Seite):
```
@request.auth.id != "" && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && supervisor != true && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true)))
```

**Create** — ohne passende Regel legt man sich sonst einfach ein zweites Konto
mit Admin-Rechten an:
```
@request.auth.id != "" && (@request.auth.supervisor = true || (@request.body.organization_id = @request.auth.organization_id && (@request.body.supervisor:isset = false || @request.body.supervisor = false) && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true) || (@request.auth.permissions.ausbildungen_manage = true && @request.body.role = "teilnehmer" && @request.body.permissions.unitarii != true && @request.body.permissions.patienten != true && @request.body.permissions.dokumente != true && @request.body.permissions.einsaetze != true && @request.body.permissions.eks != true && @request.body.permissions.lager != true && @request.body.permissions.lager_verwalten != true && @request.body.permissions.produktausgabe != true && @request.body.permissions.dateien != true && @request.body.permissions.ausbildungen_manage != true))))
```

**Delete**
```
@request.auth.id != "" && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && supervisor != true && id != @request.auth.id && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true) || (@request.auth.permissions.ausbildungen_manage = true && role = "teilnehmer"))))
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
@request.auth.id != "" && (@request.auth.supervisor = true || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true)) || (id = @request.auth.id && permissions_migrated != true && @request.body.permissions_migrated = true && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false))
```
