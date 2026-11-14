# Hub im Dunkelrot-Design, App-Auswahl und „Neu in Responda“. Einführung

Notiz für den Owner. Was neu ist, was schon vor den Schritten in PocketBase geht, und in welcher
Reihenfolge du es einführst. Regeln und Felder im Einzelnen: `docs/pocketbase-regeln.md`,
Abschnitt „Hub und Hinweise“.

## 1. Was neu ist

Der Hub hat das Dunkelrot der Benutzerverwaltung bekommen und neue Symbole für alle Apps (Entwurf
„Farbkacheln“). Jeder Benutzer legt unter „Apps anpassen“ selbst fest, welche seiner Apps im Hub
stehen und in welcher Reihenfolge; die Auswahl gilt auf allen Geräten. Wer sie ohne Netz ändert,
behält sie auf dem Gerät, und Responda schreibt sie ins Konto, sobald wieder Netz da ist (geht
nur verloren, wenn er sich vorher abmeldet). Nach einem Update schreibst
du als Supervisor eine kurze Info („Neu in Responda“), die jeder Benutzer einmal sieht, wenn er den
Hub (oder die Lernbar) öffnet.

## 2. Was schon vor den Schritten geht

Die App läuft auch ohne die neuen Felder und ohne die neue Sammlung. Nichts geht kaputt:

- **Hub im neuen Design:** sofort nach dem Veröffentlichen der App.
- **App-Auswahl:** geht, aber nur auf dem Gerät. „Apps anpassen“ sagt dann „Nur auf diesem Gerät
  gespeichert“. Beim Abmelden leert die App den Gerätespeicher; die Auswahl ist dann weg. Sobald
  das Feld `hub_apps` da ist, übernimmt Responda die Auswahl vom Gerät beim nächsten Öffnen ins
  Konto.
- **Hinweise:** erscheinen nicht. Der Reiter „Hinweise“ auf der Supervisor-Seite sagt, dass die
  Sammlung `responda_hinweise` fehlt, und „Neuer Hinweis“ ist ausgegraut.

## 3. Schritte in dieser Reihenfolge

1. **Feld `hub_apps` an `users`.** PocketBase → Collections → `users` → Fields → New field:
   Typ **JSON**, Name `hub_apps`, nicht Pflicht (Nonempty aus), **Max size 4000**. Speichern.
2. **Feld `hinweis_gesehen_am` an `users`.** Typ **Date**, Name `hinweis_gesehen_am`, nicht
   Pflicht. Speichern. **Vor dem ersten Hinweis** (Schritt 6): Ohne das Feld merkt sich nur das
   Gerät, dass jemand den Hinweis gesehen hat, und nach dem Abmelden kommt er noch einmal.
3. **Neue Sammlung `responda_hinweise`.** New collection → Typ **Base**, Name
   `responda_hinweise`. Felder:
   - `titel`: Plain text, **Nonempty** an, Max length **120**
   - `text`: Plain text, Max length **5000**
   - `veroeffentlicht`: Bool
   - `veroeffentlicht_am`: Date
   - `erstellt_von`: Plain text, Max length **120**
   - `created` und `updated` (Autodate) legt PocketBase selbst an; stehen lassen. Aus `updated`
     nimmt Responda beim Veröffentlichen die Serverzeit, damit eine falsch gehende Uhr deines
     Geräts die Reihenfolge der Hinweise nicht durcheinanderbringt.

   Dann **API Rules** (vor dem Speichern eintragen; ohne Regel, also mit Schloss, sieht nur der
   Superuser etwas). Die fünf Regeln stehen wörtlich in `docs/pocketbase-regeln.md`,
   „responda_hinweise: API-Regeln“: List/Search und View gleich (angemeldet, nur veröffentlichte,
   Supervisor alle), Create und Update nur Supervisor mit aktivem Konto, Delete dazu nur
   Unveröffentlichtes. Jede Regel einzeln kopieren, ohne Zeilenumbruch.
4. **An den Regeln von `users` ändert sich nichts.** Die Update-Regel verbietet beim eigenen Konto
   nur eine Liste heikler Felder (Rechte, Rollen, Organisation, Sperre, Supervisor). `hub_apps` und
   `hinweis_gesehen_am` stehen nicht darauf, also darf jeder sie an sich selbst schreiben, fremde
   Konten nur wer sie heute schon ändern darf. Geprüft gegen PocketBase 0.28.4 und 0.40.5.
5. **App veröffentlichen.** Push auf `main`, das Prüfnetz (`npm run verify`, GitHub-Prüfung) muss
   grün sein. Die Schritte 1 bis 3 können auch danach kommen (Abschnitt 2), Schritt 2 aber in jedem
   Fall vor Schritt 6.
6. **Ersten Hinweis veröffentlichen.** In Responda als Supervisor: Profil (oben rechts im Hub) →
   Supervisor, oder direkt `/supervisor?tab=hinweise` → Reiter **Hinweise** → **Neuer Hinweis**.
   Titel und Text aus `docs/hinweise/2026-11-hub-und-apps.md` einfügen, die Vorschau „So erscheint
   er nach dem Anmelden“ ansehen, **Veröffentlichen** und die Rückfrage bestätigen.
7. **Mit einem Testkonto prüfen.** Anmelden, Hub öffnen: Nach der Begrüßung erscheint das Blatt
   „Neu in Responda“ einmal. „Verstanden“ drücken, Seite neu laden: Es kommt nicht wieder. Auch
   nicht nach Ab- und Anmelden (dann ist Schritt 2 richtig gemacht).

Vor dem Veröffentlichen am iPhone (Safari, iOS 26) ansehen, wie in CLAUDE.md beschrieben: Hub und
„Apps anpassen“, kurze und lange Seite, jeweils oben, beim Scrollen und ganz unten. Die
Statusleiste ist weich dunkelrot über dem roten Kopf und hell, wenn der Kopf weggescrollt ist; die
Safari-Leiste unten ist nie rot. Nach der Begrüßung und nach dem Schließen jedes Blatts (auch
„Neu in Responda“) bleibt keine Farbe hängen.

## 4. Nach jedem weiteren Update

- Claude legt für das Update eine Datei `docs/hinweise/<datum>-<thema>.md` nach der Vorlage
  `docs/hinweise/vorlage.md` an (Titel und Text, fertig zum Kopieren).
- Du kopierst Titel und Text in Supervisor → Hinweise → **Neuer Hinweis**, siehst die Vorschau an
  und veröffentlichst.
- Wer wann was sieht:
  - Jeder sieht nur den **neuesten** veröffentlichten Hinweis, einmal. Wer zwei Updates verpasst
    hat, sieht nur den neueren; schreib also in den neuen, was aus dem älteren noch wichtig ist.
  - Wer nach der Veröffentlichung angelegt wird, sieht den Hinweis nicht.
  - Lernbar-Benutzer sehen ihn in der Lernbar (sie landen nach dem Login dort). Wer nur Unitas
    öffnet und nie den Hub, sieht ihn erst, wenn er den Hub öffnet.
  - Einen Tippfehler korrigierst du mit „Bearbeiten“ (auch veröffentlicht). Wer den Hinweis schon
    bestätigt hat, sieht die Korrektur nicht.
  - **Zurückziehen und wieder veröffentlichen** behält das erste Datum: Niemand sieht ihn deswegen
    ein zweites Mal. Für eine neue Info immer einen **neuen** Hinweis anlegen.
  - Löschen geht nur bei Entwürfen und zurückgezogenen Hinweisen.
  - Das Datum eines Hinweises richtet sich nach der Serverzeit. Geht die Uhr deines Geräts mehr
    als 2 Minuten falsch, steht das nach dem Veröffentlichen in der Liste; am Hinweis ändert das
    nichts.
  - Unter „Erstellt von“ speichert Responda deinen Namen (ohne Namen „Supervisor“), nie deine
    E-Mail-Adresse: Technisch kann jeder angemeldete Benutzer veröffentlichte Hinweise samt
    diesem Feld abrufen.

## 5. Zurücknehmen

- Einen Hinweis zurückziehen: Supervisor → Hinweise → **Zurückziehen**. Er erscheint dann bei
  niemandem mehr, der ihn noch nicht gesehen hat.
- Ganz ohne Hinweise: die Sammlung `responda_hinweise` löschen. Die App zeigt dann nichts mehr und
  meldet keinen Fehler; der Reiter „Hinweise“ sagt, dass die Sammlung fehlt.
- Ohne die Felder an `users` (gelöscht oder nie angelegt) fällt die App auf das Gerät zurück:
  App-Auswahl und Bestätigung gelten nur dort und gehen beim Abmelden verloren.
