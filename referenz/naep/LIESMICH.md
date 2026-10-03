# NAEP — der offizielle DIVI-Datensatz

Die Schemata und Beispiele der DIVI für den Austausch von Notarzt-Einsatz-
protokollen. Sie liegen hier als Referenz, nicht als Code: Noch liest und
schreibt die App sie nicht.

## Was hier liegt

| Datei | Inhalt |
|---|---|
| `naep-metamodell-6.0-1.00-NoVar-01012021.xml` | Das vollständige Protokoll als Modell: 32 Abschnitte, 70 Felder, 117 Auswahlen mit 451 Optionen, 22 Fragen — jedes mit offiziellem Code |
| `xsd/naep-meta.xsd` | Wie ein solches Modell aufgebaut sein darf |
| `xsd/naep-dokument.xsd` | Austauschformat, ausführlich (mit Titeln und Klartext) |
| `xsd/naep-daten.xsd` | Austauschformat, kompakt (nur Codes) |
| `xsd/naep-strukturen-std.xsd` | Die strukturierten Teile: Stammdaten, Einsatzdaten, Einsatzort, Medikation, Erstdiagnosen (ICD-10) |
| `beispiele/` | Je ein gefülltes, leeres und unbearbeitetes Protokoll in beiden Formaten |

## Wie sich das zu unserem Katalog verhält

`src/katalog/aelrd.ts` ist vom gedruckten ÄLRD-Bogen abgelesen. Beide gehen
auf DIVI 6.0 zurück, sind aber nicht dasselbe:

**Der Bogen ist eine erweiterte Variante.** Er führt Optionen, die das
Basismodell nicht kennt — Tachypnoe, Bradypnoe, Gesichtslähmung,
Kopfschmerzen, Gangunsicherheit. Umgekehrt fehlen ihm einige der Norm,
etwa "Seitenzeichen" und "kein Lächeln".

**Die Norm ist hierarchisch, unser Katalog flach.** Im Modell ist "Dyspnoe"
eine Option mit einem Zusatz darunter, der Stridor, Zyanose und Spastik
führt. Bei uns stehen alle auf einer Ebene. Dasselbe bei Haut, EKG und den
Erkrankungen.

**"nicht untersucht" ist in der Norm keine Option**, sondern ein eigenes
`<leer>`-Element am Abschnitt. Wir führen es als Auswahlmöglichkeit.

**Die Codes fehlen uns.** Jedes offizielle Feld hat einen kurzen Schlüssel
(`DEF` für RRsys, `G0F` für den NACA-Score). Unsere Feldnamen sind lesbar,
aber nicht die der Norm.

## Was daraus folgen kann

Für einen Export ins NAEP-Format braucht es eine Zuordnung unserer Felder
auf die offiziellen Codes. Die lässt sich nicht erraten — die Namen weichen
ab, und die Verschachtelung muss nachgebildet werden. Es sind rund 160
Einträge, also Handarbeit, aber überschaubare.

Der Nutzen wäre, Protokolle an eine ÄLRD-Stelle oder ins Register
übermitteln zu können. Heute liegen die Daten nur in unserer eigenen
Payload.
