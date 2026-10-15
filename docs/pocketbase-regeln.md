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

## Vorsicht bei befristeten Rechten in Regeln

`@request.auth.temp_permissions.<recht>.until > @now` ist **unzuverlässig**:
PocketBase vergleicht das Ablaufdatum als Text, und die App speichert es im
ISO-Format (`2026-10-15T07:00:00.000Z`), `@now` aber mit Leerzeichen
(`2026-10-15 08:00:00.000Z`). Ein am selben Tag abgelaufenes Recht gilt so bis
Mitternacht (UTC) weiter. Befristete Rechte deshalb nicht in Regeln prüfen,
sondern in einem Hook (dort lassen sich die Daten richtig vergleichen).
