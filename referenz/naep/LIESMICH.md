# NAEP — der offizielle DIVI-Datensatz

Die Schemata und Beispiele der DIVI für den Austausch von Notarzt-Einsatz-
protokollen. Sie sind die Quelle, aus der `src/katalog/naep.ts` erzeugt wird
(`python3 werkzeug/naep-katalog-erzeugen.py`) und gegen die der Export geprüft
wird (`werkzeug/naep-pruefen.sh`).

## Was hier liegt

| Datei | Inhalt |
|---|---|
| `naep-metamodell-6.0-1.00-NoVar-01012021.xml` | Das vollständige Protokoll als Modell: 32 Abschnitte, 70 Felder, 117 Auswahlen mit 451 Optionen, 22 Fragen — jedes mit offiziellem Code |
| `xsd/naep-meta.xsd` | Wie ein solches Modell aufgebaut sein darf |
| `xsd/naep-dokument.xsd` | Austauschformat, ausführlich (mit Titeln und Klartext) |
| `xsd/naep-daten.xsd` | Austauschformat, kompakt (nur Codes) |
| `xsd/naep-strukturen-std.xsd` | Die strukturierten Teile: Stammdaten, Einsatzdaten, Einsatzort, Medikation, Erstdiagnosen (ICD-10) |
| `beispiele/` | Je ein gefülltes, leeres und unbearbeitetes Protokoll in beiden Formaten |

## Zwei Wege, ein Protokoll

**`/datensatz` erfasst normtreu.** Die Maske ist aus dem Metamodell erzeugt,
nicht abgeschrieben: dieselben Abschnitte, dieselbe Verschachtelung, dieselben
Codes. Was dort erfasst wird, trägt bereits die Schlüssel der Norm — der
Export schreibt sie nur in XML um. `src/lib/naepExport.ts` erzeugt das
kompakte Format `naep-daten.xml`.

**`/protokoll-2` erfasst für den Druck.** Der ÄLRD-Bogen
(`src/katalog/aelrd.ts`) ist vom Papier abgelesen und führt Felder, die die
Norm nicht hat — CO-Hb, invasive Blutdruckmessung, Tracerdiagnose. Er ist eine
erweiterte Variante von DIVI 6.0, kein Teil davon.

Beide gehen auf DIVI 6.0 zurück und sind doch nicht dasselbe:

**Der Bogen führt eigene Optionen** — Tachypnoe, Bradypnoe,
Gesichtslähmung, Kopfschmerzen, Gangunsicherheit. Umgekehrt fehlen ihm
einige der Norm, etwa "Seitenzeichen" und "kein Lächeln".

**Die Norm ist hierarchisch, der Bogen flach.** Im Modell ist "Dyspnoe" eine
Option mit einem Zusatz darunter, der Stridor, Zyanose und Spastik führt. Auf
dem Bogen stehen alle auf einer Ebene. Dasselbe bei Haut, EKG und den
Erkrankungen.

**"nicht untersucht" ist in der Norm keine Option**, sondern ein eigenes
`<leer>`-Element am Abschnitt. Der Bogen führt es als Auswahlmöglichkeit.

## Wo der Export an die Grenzen des Schemas stößt

**Die strukturierten Blöcke sind ganz oder gar nicht.**
`naep-strukturen-std.xsd` verlangt in `PatStammdaten` Patient, Adresse und
Versicherung je einmal, und ihre Felder sind `TypText` mit `minLength="1"`.
Ein Patient mit Namen aber ohne Kassen-Nr. ist deshalb keine Teilmenge der
Norm, sondern eine Datei, die die Zielstelle zurückweist. Der Export lässt
einen solchen Block weg, schickt aber alles mit, was im Modell darunter hängt
(Geschlecht, Alter), und `naepExportHinweise()` sagt vorher, was fehlt — die
Maske zeigt das über dem Formular an.

**`Applikation` braucht einen Code, den die Unterlagen nicht liefern.** Das
Element ist `TypCodeTerm`: `code` und `term` sind beide `use="required"`. Das
Beispiel der DIVI schreibt `code="ROA.01" term="i.v."`, einen Schlüssel aus
einem Verzeichnis, das hier nicht mitliegt. Die Maske fragt beide ab; ohne
Code bleibt das Element weg, die Einzeldosis geht trotzdem mit.

**Leer wird nie geraten.** Ein Abschnitt, den niemand angesehen hat, wird
`<nb/>` — nicht bearbeitet. `<leer>` steht nur dort, wo es jemand angekreuzt
hat, denn es ist eine Aussage über den Patienten: untersucht und nichts
gefunden.

## Prüfen

```
werkzeug/naep-pruefen.sh export.xml
```

Dasselbe läuft in `src/lib/__tests__/naepMaske.test.ts` gegen das echte
Schema, sobald `xmllint` vorhanden ist: ein vollständig ausgefülltes, ein
leeres und ein unbearbeitetes Protokoll.
