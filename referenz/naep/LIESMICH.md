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

## Die Zuordnung Bogen → Norm

`src/katalog/aelrdNaep.ts` ordnet jede Angabe des gedruckten Bogens einem Ort
in der Norm zu — oder sagt, warum es keinen gibt. Stand heute:

| | Angaben |
|---|---|
| gehen in die Norm | 214 |
| bleiben im Responda-Anhang | 110 |
| brauchen erst einen Umbau der Maske | 45 |
| sind das zweite Kästchen derselben Angabe | 3 |

**Der Anhang ist kein Streuverlust, sondern vier Blöcke.** Von den 110
Einträgen entfallen 43 auf Dinge, die die Norm als Ganzes nicht führt: die
Psyche bei der Übergabe (14), den Befundblock Kreislauf (12), die Neurologie
bei der Übergabe (9) und den Befundblock Atemwege (8). Der Rest sind einzelne
Optionen — Tachypnoe, Bradypnoe, CO-Hb, invasiver Druck, Tracerdiagnose.

**Umbau** heißt: die Angabe gehört in die Norm, aber der Bogen hat die falsche
Form. Meist ein Freitext, wo die Norm eine Auswahl führt (Bewusstsein,
Pupillenweite, NACA), manchmal ein Haken, wo sie eine Bewertung je Gliedmaße
verlangt. `umbauFelder()` gibt die Liste aus; sie ist die Arbeitsliste für den
Umbau der Erfassungsmaske.

**Erzwungene Vollständigkeit.** `src/lib/__tests__/aelrdNaep.test.ts` schlägt
fehl, sobald ein Feld oder eine Option des Bogens keine Zuordnung hat, sobald
eine Zuordnung auf ein Feld zeigt, das es nicht mehr gibt, und sobald ein Code
in der Norm nicht existiert oder nicht zu der Auswahl gehört, unter der er
steht. Es gibt keinen dritten Zustand neben "hat ein Ziel" und "gehört in den
Anhang" — nichts kann stillschweigend liegenbleiben.

## Was der Bogen zweimal fragt

Der amtliche Vordruck hat für drei Angaben zwei Kästchen: den ROSC-Zeitpunkt
(im Reanimationsblock und bei den Defibrillationszeiten), die
Entlastungspunktion (unter „Atemweg" und unter „Sonstige") und die mechanische
Thoraxkompression (unter „Reanimation" und unter „Medizintechnik"). Wer ihn von
Hand ausfüllt, schreibt denselben Wert zweimal hin.

In der App wird jede dieser Angaben **einmal** erfasst. Beim Drucken füllt
`spiegelAnwenden()` beide Kästchen aus derselben Quelle — das Papier sieht aus
wie immer, die Daten gibt es nur einmal. Welche Seite die Quelle ist, steht in
`src/katalog/aelrdSpiegel.ts`, jeweils mit Begründung.

Ein Test hält das offen: er meldet jedes Ziel der Norm, das zwei Angaben des
Bogens trägt, und verlangt dafür entweder eine erklärte Spiegelung oder einen
benannten Grund (etwa, dass der Bogen Stridor insp. und exsp. trennt, wo die
Norm nur „Stridor" kennt). Eine neue Doppelerfassung fällt damit beim ersten
Testlauf auf, statt erst im Protokoll.

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
