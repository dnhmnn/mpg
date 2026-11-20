# Responda — Designsprache „La Bella Figura"

## Übersicht
Alle UI-Seiten folgen einem einheitlichen italienisch-editorialen Stil. Denke: Corriere della Sera, Ferrari-Dokumente, Milaneser Hochglanz. Reduziert, elegant, nie verspielt.

## Technologie
- **Framework**: React + TypeScript (Vite)
- **Backend**: PocketBase (`https://api.responda.systems`)
- **Font**: Atkinson Hyperlegible — bereits geladen inkl. Italic: `ital,wght@0,400;0,700;1,400;1,700`
- **Routing**: React Router

---

## Farbpalette

| Token / Wert | Verwendung |
|---|---|
| `#600812` | Primärakzent: aktive Tabs, Zahlen, Section-Labels, Buttons, linke Karten-Border |
| `#1a0e08` | Primärtext (warmes Dunkel, kein kaltes Schwarz) |
| `#8a7a68` | Sekundärtext / Warm Cappuccino-Gray → `var(--warm-gray)` |
| `var(--warm-bg)` | Seitenhintergrund: `#faf9f7` (Elfenbein) |
| `#ffffff` | Cards, Header, Tab Bar |
| `#3d0408` | Greeting-Overlay Hintergrund (sehr dunkles Rot) |
| `#fde8d8` | Cream / Greeting-Name Farbe |

### CSS-Variablen (bereits in `globals.css` definiert)
```css
--warm-bg: #faf9f7;   /* Hintergrund */
--warm-gray: #8a7a68; /* Sekundärtext */
```
Dark-Mode-Varianten sind ebenfalls gesetzt (`#0f0a07` / `#9a8a78`).

---

## Typografie-Regeln

| Element | Stil |
|---|---|
| **Seitenhintergrund** | `background: 'var(--warm-bg)'` |
| **Patientennamen / Hauptnamen** | `fontStyle: 'italic', fontWeight: 700, fontSize: 17` |
| **Datum / Uhrzeit / Crew** | `fontStyle: 'italic', fontWeight: 400, color: 'var(--warm-gray)', fontSize: 12` |
| **Section-Header** | `fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812'` |
| **Große Statistik-Zahlen** | `fontSize: 48, fontWeight: 800, color: '#600812'` |
| **Grußname (Übersicht)** | `fontStyle: 'italic', fontWeight: 800, color: '#600812'` |
| **Tags / Hashtags** | `fontStyle: 'italic', fontWeight: 700, color: '#600812', fontSize: 12` |

---

## Komponenten-Patterns

### Header — Masthead-Stil
```tsx
<div style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', height: 60 }}>
  {/* Links: Logo-Kreis #600812, weißes Icon 18px */}
  {/* Mitte: Org/Seitenname bold 15px + italic Datum 11px warm-gray */}
  {/* Rechts: Avatar-Kreis, border '1.5px solid #600812', Initialen in #600812 */}
</div>
```

### Bottom Tab Bar
```tsx
// Aktiver Tab:
{ borderTop: '2px solid #600812', color: '#600812', paddingTop: 10 }
// Inaktiver Tab:
{ borderTop: '2px solid transparent', color: 'var(--warm-gray)' }
// Labels:
{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }
// Container:
{ background: '#fff', borderTop: '0.5px solid rgba(96,8,18,0.12)' }
```

### Karten (Protokolle, Termine, Module)
```tsx
{
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  borderLeft: '3px solid #600812',  // Farbe je nach Status
}
// Status-Farben für borderLeft:
// offen/aktiv:      #600812
// freigegeben/done: #16a34a
// archiviert/past:  rgba(139,113,90,0.4)
// abgesagt:         #dc2626
```

### Karten-Action-Bereich (unterer Streifen)
```tsx
{
  borderTop: '0.5px solid rgba(96,8,18,0.08)',
  background: 'rgba(250,249,247,0.8)',
  padding: '8px 12px',
}
```

### Section-Header
```tsx
<div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
  ABSCHNITT
</div>
```

### Termine-Karte (Programm-Guide-Stil)
```tsx
// Status-Strip oben (3px, farbig nach Status)
// Linke Spalte: Wochentag (9px uppercase) + Tageszahl (30px italic bold #600812) + Monat (9px uppercase)
// Trennlinie: 0.5px solid rgba(96,8,18,0.1)
// Rechte Spalte: Name bold 15px + italic warm-gray Zeilen für Zeit/Ort/Dozent
// Status-Badge: uppercase 10px
```

### Stat-Cards (Übersicht)
```tsx
// Section-Label in Rot oben
// Zahl: fontSize 48, fontWeight 800, color '#600812'
// Beschreibung: italic, warm-gray, fontSize 12
// Kein farbiger left-border — die rote Zahl ist der Akzent
```

### Greeting-Overlay
```tsx
// Hintergrund: #3d0408
// "Servus," klein italic in rgba(253,232,216,0.5)
// Name: #fde8d8, italic bold, fontSize clamp(48px, 13vw, 80px)
// Overlay fährt raus mit opacity-Keyframe greetOverlayOut
```

---

### Seiten im Dunkelrot-Design (Benutzer, Vorgänge und alle weiteren)
- Immer den gemeinsamen Rahmen nehmen: `Seite` aus `src/pages/benutzer/bausteine.tsx`, die Stile
  `BV_CSS` (`src/pages/benutzer/stil.ts`) und `useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })`
  (statische Seiten wie der Hub: `{ statisch: true }`, siehe unten).
  Keinen eigenen Kopf, keine eigene Statusleisten-Lösung bauen.
- Safari am iPhone (iOS 26), festgelegt vom Owner am 14.11.2026 (nicht weiter daran herumprobieren):
  - Die Statusleiste (Uhr, WLAN, Akku) ist dunkelrot, solange der rote Kopf zu sehen ist, und
    zwar weich: Beim Scrollen scheint der Kopf unter Uhr und Akku durch. Kein fester Balken.
  - Ist der Kopf weggescrollt, ist die Statusleiste hell wie die Seite.
  - Unten nie Rot, die Safari-Leiste bleibt durchsichtig.
  - Kurze Seiten: Das helle Blatt ist höher als der Bildschirm, der rote Kopf scrollt also ganz
    weg, bevor das Ende kommt. Der leere Platz am Ende kurzer Seiten ist so gewollt. Bei sehr
    schnellem Wischen bis ans Ende kann unten kurz Rot aufzucken; das bleibt so.
- So ist es gebaut (`useStatusleiste`, `BV_CSS`): html und body sind dunkelrot, solange der rote
  Kopf zu sehen ist, sonst hell. `.bv-blatt` hat eine Mindesthöhe über den Bildschirm hinaus
  (`100lvh` plus 144 px plus Home-Leiste). Im Browser liegt der Streifen `.bv-statusleiste`
  hinter der Seite; als App vom Homebildschirm liegt er nur bis iOS 18 vorn.
- Als App vom Homebildschirm ab iOS 26 (Bilder des Owners, 15. und 19.11.2026): iOS legt oben einen
  Schleier in der Farbe von html/body über den Rand, rund 38 px unter die Uhr-Zeile. Ein roter
  Streifen vorn lag nach dem Wegrollen des Kopfs unter dem hellen Schleier (rosa-grauer Balken).
  Deshalb dort wie im Browser: Streifen hinten (`@supports (-webkit-touch-callout: none) and
  (anchor-name: --a)`, das kann erst Safari 26), rot solange der Kopf zu sehen ist, danach hell.
  Knöpfe und Titel im Kopf beginnen als App 14 px tiefer (hochkant). Seiten mit weißem Kopf
  (Unitas, MPG, Lager …) brauchen nichts: Der Schleier ist dort weiß auf Weiß.
- Warum es keine perfekte Lösung gibt (WebKit, `LocalFrameView::fixedContainerEdges`,
  `Page::updateFixedContainerEdges`): Safari färbt oben und unten mit derselben Farbe, dem
  Hintergrund von `body`; sie steht auch überall, wo die Seite den Bildschirm nicht bedeckt.
  Verschiedene Farben oben und unten gibt es nur mit einem festen Element am Rand, und das macht
  Safari zu einem festen, deckenden Balken. Lange Seiten (Benutzer) fallen nicht auf, weil der
  Kopf vor dem Ende weggescrollt ist.
- Am iPhone ausprobiert und verworfen (nicht noch einmal versuchen):
  - Ein Farbgeber oben (fester roter Streifen, auch zeitweise, oder der Kopf `position: sticky`):
    fester roter Balken, der beim Scrollen Titel und Knöpfe abschneidet.
  - html/body immer hell oder schon hell, solange der Kopf noch zu sehen ist: Statusleiste hell.
  - Ein heller Streifen am unteren Rand (immer oder nur am Ende): Safari-Leiste deckend, am Ende
    wechselte es zwischen hell und rot, zuletzt ein deckender roter Balken.
  - Eine helle Fläche hinter dem Inhalt (`z-index: -1`): Safari findet sie nicht.
  - Ohne Mindesthöhe (kein Leerraum): unten roter Balken am Ende kurzer Seiten.
  - Nachfedern abschalten (`overscroll-behavior`); nur `html` hell, `body` rot.
- Vor dem Veröffentlichen im Telefonformat prüfen: kurze und lange Seite, jeweils oben, beim
  Scrollen und ganz unten.

#### Statische Seiten (der Hub), festgelegt vom Owner am 14.11.2026
- Der Hub rollt nicht, weder am Telefon noch am Tablet oder Computer. Die Apps füllen den Platz
  unter dem Kopf; passen nicht alle, stehen sie auf Seiten zum Wischen mit Pfeilen und Punkten
  (`src/pages/hub/AppSeiten.tsx`, Rechnung in `src/lib/hubSeiten.ts`).
- Gebaut im gemeinsamen Rahmen, nicht als eigene Lösung: `Seite` mit `statisch` (und `titelUnten`
  für den voll ausgeschriebenen Titel), `useStatusleiste('--lbf-kopf', { statisch: true })`, die
  Regeln `.bv.statisch` in `BV_CSS`.
- Oben liegt der feste rote Streifen `.bv-statusleiste` vorn (`z-index` 60, mindestens 12 px hoch)
  und gibt Safari das Rot. Im Browser bleiben html und body die ganze Zeit hell; unten ist nichts fest,
  die Safari-Leiste bleibt also hell. theme-color ist das Dunkelrot.
- Als App vom Homebildschirm (Bild des Owners, 15.11.2026): iOS 26 legt oben einen Schleier in der
  Farbe von html/body über den Rand, rund 38 px unter die Uhr-Zeile, und fragt den roten Streifen
  nicht. Mit hellem html/body lag ein milchiger Verlauf über Logo und Knöpfen. Deshalb sind html und
  body dort dunkelrot (`statusleistenFarben` in `useStatusleiste`), und Zeichen und Knöpfe beginnen
  14 px tiefer (nur hochkant). Unten gibt es als App keine Safari-Leiste. Am iPhone bestätigt (19.11.2026).
  Als App endet das Fenster der Seite am iPhone um die Höhe der Statusleiste vor dem unteren Rand
  (50 px); darunter zeigt iOS Inhalt, der über das Fenster hinausreicht, sonst das Rot von html/body
  als Balken (Bild des Owners, 19.11.2026; rollende Seiten haben das nicht). Eine feste Fläche zeichnet
  iOS dort nicht (ausprobiert). Deshalb hängt als App eine helle Fläche im normalen Fluss direkt unter
  dem Fenster (`.bv.statisch::after`, absolut, `top: 100%`); `useStatusleiste` setzt verschobenes
  Rollen sofort zurück, die statische Seite rollt also weiter nie. Die Ablehnung „Farbgeber oben“
  galt rollenden Seiten (der Balken schnitt beim Scrollen Titel und Knöpfe ab); eine Seite, die
  nicht rollt, hat das Problem nicht.
- Nur solange die statische Seite zu sehen ist, haben html und body `height: 100%`,
  `overflow: hidden` und `overscroll-behavior: none`. Beim Verlassen und beim Wechsel auf eine
  rollende Seite (auch „Apps anpassen“ unter `/hub?seite=apps`) stellt `useStatusleiste` die
  vorherigen Werte wieder her. Ein hängengebliebenes `overflow: hidden` wäre ein schwerer Fehler.
- Unten bleiben 16 px plus Home-Leiste, überall, auch in Safari am iPhone: Safari hält den Platz
  seiner schwebenden Leiste selbst frei (`100dvh` und Rand enden über ihr). Am iPhone gemessen am
  15.11.2026: Ein zusätzlicher Abstand von 64 px schob die Pfeile 100 px über die Leiste und
  kostete eine Reihe Apps, also keinen eigenen Abstand für Safari einbauen. Höhe der Seite `100dvh`.
  Niedriger als 560 px (Telefon quer): Kopf knapper, ohne Gruß; quer steht der Titel in der Zeile
  der Knöpfe.
  Die Blätter (Glocke, Kurzbefehle, Profil) und „Neu in Responda“ halten in Safari am Telefon
  vorerst unten 64 px plus Home-Leiste frei (am Gerät noch nicht angesehen).
- Luft im Kopf (Owner, 15.11.2026): Bleibt unter den Apps Platz, kommen bis zu 32 px davon in den
  Kopf, je zur Hälfte zwischen Datum und Gruß und unter dem Gruß (`.hub-luft`, gemeldet von
  `AppSeiten`, Rechnung `restHoehe`/`kopfLuft` in `src/lib/hubSeiten.ts`). Gemessen wird ohne diese
  Luft, sie kostet also nie eine Reihe; bei langem Namen der Organisation fällt sie weg.
- Notausgang (Zoom, sehr wenig Höhe): Passt nicht einmal eine Reihe Apps samt Pfeilen, stehen alle
  Apps untereinander, und Kopf und Blatt rollen zusammen innen in `.bv` (`Seite` mit `rolltInnen`,
  `.bv.statisch.rollt-innen`); bei Seitenzoom 300 % füllt der Kopf allein fast den Bildschirm. Der rote
  Streifen oben bleibt vorn stehen, das Dokument bleibt fest, html und body bleiben hell.
- Rollende Seiten (Benutzer, Vorgänge, „Apps anpassen“ und alle weiteren) bleiben beim Standard
  oben, ohne Ausnahme.

#### Zugangsseiten ganz in Dunkelrot, festgelegt vom Owner am 19.11.2026
- Startseite (`/`), Anmeldung (`/login`) und die öffentliche Seite einer Organisation (`/<org-code>`) samt
  ihren Hinweisen (Laden, nicht gefunden, keine Verbindung, Formular aus): volle dunkelrote Fläche wie die
  Begrüßung, groß in der Mitte das Responda-Zeichen im hellen Kreis (176 px, unter 700 px Höhe 136 px) bzw.
  das Logo der Organisation ganz und in seiner eigenen Form auf einer weißen Karte (150 px hoch, höchstens
  280 px breit; im Kreis wurden Wappen und breite Schriftzüge abgeschnitten, Owner 19.11.2026), darunter
  helle Karten. Der Owner wollte für den Eingang ausdrücklich keinen Kopf mit Blatt („wirkt wie
  Verwaltung“), sondern „Ganz in Dunkelrot“ mit großem Logo.
- Gebaut mit `ZugangRahmen`, `Zeichen` und `OrgLogo` (`src/pages/zugang/Rahmen.tsx`, Stile `ZG_CSS` in
  `src/pages/zugang/stil.ts`); Felder, Zeilen und Knöpfe aus `BV_CSS`, der Streifen `.bv-statusleiste` wie in
  `Seite`. Keine weitere eigene Lösung bauen.
- Ausnahme von „Unten nie Rot“: html und body sind hier die ganze Zeit dunkelrot (`useStatusleiste('--lbf-kopf')`
  ohne Kopf), also auch Safaris Leiste unten und der untere Rand als App. Gewollt, die ganze Seite ist rot.
  Am iPhone noch anzusehen.
- Die Karte „Wartet auf das Senden“ steht auf diesen Seiten eingebettet in der roten Seite, auf den Formularen
  oben (`OrgPublicLayout`, Zusammenhang `rahmen`). Die öffentlichen Formulare selbst (`/<org-code>/patienten`
  usw.) bleiben, wie sie sind.

#### Website responda.systems, festgelegt vom Owner am 19./20.11.2026
- Ganz in Dunkelrot wie die Zugangsseiten: großes Logo, große helle Schrift (`src/pages/landing/Startseite.tsx`,
  Stile `RS_CSS` in `src/pages/landing/stil.ts`), html und body die ganze Zeit rot (`useStatusleiste('--rs-kopf')`).
- Statt Bereiche zu erklären, läuft ein erfundener Einsatz der „Feuerwehr Musterstadt“ ab (Wohnungsbrand,
  Patientin, Gerät gesperrt, Material, Nachbereitung); auf dem Rechner steht das Telefon und wechselt beim Scrollen
  den Bildschirm, am Telefon steht nach jedem Schritt ein eigenes. Wenig Text („statt es ewig zu erklären“).
- Nicht auf die Website: Einsatzführung (EKS), Einsätze, Ausbildung und Fortbildung (Owner, 20.11.2026).
- Die Bilder der App (`public/website/*.webp`) entstehen aus der gebauten App mit erfundenen Testdaten:
  `node docs/entwuerfe/website/aufnahme.mjs` (Daten in `docs/entwuerfe/website/daten.mjs` und `daten/`), dann
  `node docs/entwuerfe/website/webp.mjs <ordner-mit-png>`. Nie echte Personen, Organisationen oder Patientendaten.

## Keyframes (in globals.css oder inline `<style>`)
```css
@keyframes greetNameIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}
@keyframes greetOverlayOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

---

## Aktuelle Seitenstruktur

| Seite | Pfad | Beschreibung |
|---|---|---|
| Unitas | `src/pages/Unitas.tsx` | Haupt-App für Einsatzkräfte: Übersicht, Protokolle, Vorgänge, Konto |
| Lernbar | `src/pages/Lernbar.tsx` | Feed, Termine, Module |
| Ausbildungen | `src/pages/ausbildungen/Ausbildungen.tsx` | Admin-Verwaltung Ausbildungen |
| Patienten | `src/pages/patienten/Patienten.tsx` | Admin-Protokollverwaltung |
| MPG | `src/pages/mpg/` | Medizinprodukte: Heute (Arbeitsliste, Prüfrunden je Standort), Geräte mit Gerätebuch, Prüfung, Meldungen/Defekte, Fristen (STK/MTK), Vorlagen, Logbuch — eine Adresse je Ansicht unter `/mpg/*`. Rechenkern und Schreibwege in `src/lib/mpg/` (STK/MTK: `fristen.ts`, `kontrollen.ts`; eine überfällige oder nicht bestandene STK oder MTK sperrt), Rechte („MPG verwalten“) in `src/lib/mpg/rechte.ts` |
| Hub | `src/pages/Hub.tsx`, `src/pages/hub/` | Startseite nach dem Login im Dunkelrot-Design, statisch (rollt nicht): Gruß, Organisation voll ausgeschrieben, Glocke mit Neuigkeiten und Mitteilung der Organisation (Blatt), Apps auf Seiten zum Wischen mit Pfeilen (`src/lib/hubSeiten.ts`; Auswahl und Reihenfolge je Benutzer: `src/lib/hubApps.ts`, Feld `users.hub_apps`), Kurzbefehle, Profil. Symbole: `src/lib/hubIcons.ts`, erzeugt mit `npm run hub-icons` aus `docs/entwuerfe/hub-icons/bau.mjs` |
| Benachrichtigungen | `src/pages/Benachrichtigungen.tsx`, `src/pages/benachrichtigungen/` | Push-Benachrichtigungen im Dunkelrot-Design, rollend (`/benachrichtigungen`, aus Profil im Hub und Einstellungen): Push je Gerät mit Probe, Anlässe, Ruhezeit, angemeldete Geräte, Hinweis „Keine Alarmierung“; für die Leitung `?seite=organisation` (Anlässe der Organisation, „Mitteilung an die Organisation“). App-Teil in `src/lib/push/` (Abgleich, Einschalten, API, Texte; Service Worker `public/sw-push.js`), siehe Abschnitt „Push-Benachrichtigungen“ |
| Responda EKS | `src/pages/eks/EKS.tsx` | Einsatzführung aus dem ELW: Atemschutzüberwachung, Einsatztagebuch, Kräfte/FMS, Abschnitte — **voll offline-fähig** (IndexedDB-Ereignislog, siehe `src/lib/eks/`) |

## PocketBase Collections (wichtigste)

| Collection | Zweck |
|---|---|
| `patients` | Protokolle, Status: `offen` → `freigegeben` → `archiviert` |
| `lernbar_beitraege` | Feed-Posts (typ: bild/text/video/quiz), Feld: `organisation_id` |
| `ausbildungen_termine` | Termine |
| `ausbildungen_module` | Lernmodule |
| `organizations` | Organisationen mit Logo, Rollen-Vorlagen (`role_permissions`), eigene Rollen (`eigene_rollen`, nur über `src/lib/rollen.ts` lesen) und verknüpfte Rechte. Update-Regel: Lizenz und Module nur Supervisor, Rollen und Vorlagen Admin/Benutzerverwaltung, Formulare Vorgänge — `docs/pocketbase-regeln.md`, „Eigene Rollen der Organisationen“ |
| `users` | User mit `organization_id`, `organization_name`, `organization_logo`; Rollen: erste in `role`, weitere in `zusatzrollen` (JSON). Was jemand darf, kommt nur aus den Rollen (`src/lib/rollen.ts`, `rechteAusRollen`), gespeichert als Kopie in `permissions`; je Person weicht nur `temp_permissions` ab. Leitung (`admin`) und Teilnehmende sind fest. Passwörter legt jeder selbst fest (Link), nur der Supervisor setzt fremde. Ohne E-Mail: Platzhalter `…@kein-email.intern` (`isPlaceholderEmail`, nie anzeigen: `sichtbareEmail`) — `docs/pocketbase-regeln.md`, „users: Passwörter legt jeder selbst fest“. App-Auswahl im Hub in `hub_apps` (JSON), zuletzt bestätigter Hinweis in `hinweis_gesehen_am`. |
| `eks_events` | EKS-Ereignislog (anhängend, **unveränderlich** — Update/Delete gesperrt). ID wird vom Client vergeben (15× `[a-z0-9]`) |
| `inventory_transactions` | Lager-Journal (**unveränderlich**, Hook `pb_hooks/lager.pb.js`). Buchungen nur über `src/lib/lagerBuchung.ts` (Batch, Client-ID, genau einmal); Korrektur = Gegenbuchung (`storno_von`) |
| `inventory_items`, `inventory_locations` | Lager-Stammdaten; benutzt → `archiviert` statt löschen |
| `mpg_ereignisse` | MPG-Gerätebuch (**unveränderlich**, Hook `pb_hooks/mpg.pb.js`): Sperren, Freigaben, Stammdatenänderungen, Außerbetriebnahme, STK/MTK (mit `angaben`), Vermerke. Geschrieben nur über die Pläne in `src/lib/mpg/aktionen.ts` und `src/lib/mpg/kontrollen.ts`; Korrektur = Vermerk mit `bezug` |
| `responda_hinweise` | „Neu in Responda“: kurze Info des Supervisors nach Updates; jeder sieht den neuesten veröffentlichten einmal (`users.hinweis_gesehen_am`). Logik `src/lib/hinweise.ts`; Regeln `docs/pocketbase-regeln.md`, „Hub und Hinweise“ |
| `hub_notifications` | Mitteilung der Organisation (Glocke im Hub und Push an alle aktiven Konten der Organisation). Anlegen, ändern, zurückziehen: Supervisor (jede Organisation) oder Leitung (`admin`, nur die eigene, höchstens 3 in 24 h); `push.pb.js` prüft das selbst vor dem Speichern, dazu die Regeln aus `docs/pocketbase-regeln.md`, „hub_notifications: Mitteilungen“ |
| `push_geraete`, `push_warteschlange`, `push_merker` | Push: angemeldete Geräte, zurückgehaltene Benachrichtigungen (nur Anlass und Kennungen, nie Text), Merker. **Alle API-Regeln gesperrt**, nur Hooks und Routen `/api/responda/push/*`. Einstellungen in den versteckten Feldern `users.push_einstellungen` und `organizations.push_anlaesse` (nur über die Routen) — `docs/pocketbase-regeln.md`, „Push-Benachrichtigungen“ |
| `mpg_devices`, `mpg_inspections`, `mpg_defects` | MPG; Prüfprotokolle unveränderlich, Defekte nicht löschbar, Gerät mit Nachweisen → `ausser_betrieb` statt löschen. Regeln: `docs/pocketbase-regeln.md`, „MPG: API-Regeln“ |

---

## Neue Version der App (Owner, 19.11.2026)

- Eine neue Fassung übernimmt nicht still: Der Service Worker wartet (`registerType: 'prompt'` in
  `vite.config.ts`), bis jemand im Hinweis „Neue Version von Responda“ auf „Aktualisieren“ tippt;
  dann lädt die App neu. „Später“ blendet den Hinweis eine Stunde aus; wird die App ganz geschlossen,
  gilt die neue Fassung beim nächsten Start.
- Die App fragt beim Start, alle 30 Minuten und beim Zurückkommen aus dem Hintergrund (höchstens alle
  5 Minuten) nach einer neuen Fassung. Rechnung und Speicher: `src/lib/fassungPruefen.ts` (Prüffälle),
  Anmeldung: `src/lib/swAnmelden.ts`, Hinweis: `src/components/NeueFassungHinweis.tsx`.
- Nie in der Einsatzführung eines laufenden Einsatzes (`/eks/:id`): Der Hinweis läge über Knöpfen,
  die im Einsatz gebraucht werden.
- Kein `skipWaiting` in `sw-push.js` oder `sw-formulare.js`; ein Prüffall achtet darauf.

## Push-Benachrichtigungen

- **Push ist keine Alarmierung.** Jede Stelle, an der man Push einstellt, sagt das (Hinweis
  „Keine Alarmierung“). Nie etwas bauen, das sich auf Push als Alarm verlässt.
- Aufbau: PocketBase entscheidet, wer was bekommt (`pb_hooks/push.pb.js` nur Registrierung,
  `push-regeln.js` rein mit Zwilling `src/lib/push/regeln.ts`, `push-fristen.js`, `push-versand.js`).
  Verschlüsselt (RFC 8291) und gesendet wird im eigenen Dienst `dienste/push/` (Node, nur
  `127.0.0.1:8095`, eigene Prüffälle: `cd dienste/push && npm ci && npm test`, die CI prüft mit
  Node 24). Owner-Schritte: `docs/push-einfuehrung.md`.
- Inhalt: nie Patientendaten (bei `patients` nie `title` oder `payload` außer `absender.id`), nie
  Text einer CIRS-Meldung oder eines Defekts, nie E-Mail-Adressen, nie Endpoint oder Schlüssel in
  Logs. Namen nur aus Stammdaten derselben Organisation über die Kennung, nie aus Feldern, die der
  Client setzt. Die Warteschlange speichert keinen Text.
- Empfänger genau wie die API-Regel des Gegenstands (`darfAnlass`); `pushGleichlauf.test.ts` liest
  die Regeln aus `docs/pocketbase-regeln.md` und schlägt an, wenn sie sich ändern.
- `urlSicher` steht dreimal (Server, App, Service Worker) und `HOSTS` zweimal (Server, Dienst);
  `pushDreiwege.test.ts` hält sie gleich.
- Abgelaufene Anmeldung oder andere Person auf dem Gerät: der Service Worker zeigt nur „Es gibt
  Neues in Responda.“ (Owner 12.4). Jede Push zeigt immer eine Benachrichtigung (iOS entzieht sonst
  das Abo); nie einen Service Worker ohne `sw-push.js` ausliefern, solange der Server sendet.
- Rücknahme genau so: erst `push.pb.js` entfernen, dann den Dienst stoppen, erst danach die App.

## PocketBase in Produktion: v0.23.4

Der Server (`api.responda.systems`, systemd-Einheit `pocketbase`, Hooks in `/opt/pb_hooks`)
läuft mit **PocketBase 0.23.4** (Owner, 16.11.2026). Alle Hooks müssen dort laufen; die CI startet
sie mit 0.23.4, 0.28.4 und 0.40.5. Was 0.23.4 nicht kann:
- `$app.store().setFunc` gibt es erst ab 0.26: nur über `speicherSetzen` (in `push-versand.js` und
  `formular-regeln.js`), das ohne `setFunc` liest, rechnet und schreibt.
- `POST /api/crons/{id}` gibt es erst ab 0.24: Läufe von Hand über eigene Routen anstoßen
  (z. B. `POST /api/responda/push/takt`).
- In `onRecordAfterDeleteSuccess` scheitert jeder Datenbankzugriff („transaction has already been
  committed“): Aufräumen nach dem Löschen in `onRecordDeleteRequest` nach `e.next()`, dazu ein
  Sicherheitsnetz im Takt.
- `$os.stat` gibt es nicht (ein Aufruf wirft „Object has no member 'stat'“): ob eine Datei da ist, mit
  `$os.readFile` prüfen (so der Merker „Erster Start“ in `formular.pb.js`; ohne das leerte jeder Neustart
  alle Absender-Status). Die Formular-Hooks sind gegen 0.23.4 und 0.40.5 praktisch geprüft (20.11.2026,
  180 bzw. 183 Fälle).

## Was NICHT zum Stil passt
- iOS-Pill-Indikatoren in der Tab Bar
- Farbige Gradient-Header
- Kalte Grau-Töne (`#8e8e93`, `#f2f2f7`)
- Bounce-Animationen
- Emojis in der UI
- Verspielt wirkende Elemente jeder Art


---

## Prüfung vor dem Veröffentlichen

Responda wird im Einsatz benutzt, und Netlify veröffentlicht jeden Push auf `main`
direkt. Änderungen müssen deshalb durch das Prüfnetz:

```bash
npm run verify     # Typprüfung + Tests + Build — das, was auch die CI ausführt
npm run typecheck  # nur Typen
npm run test       # nur Tests (vitest)
npm run test:watch # beim Entwickeln
```

- `npm run build` prüft die Typen mit. Der Bestand ist **fehlerfrei** — neue
  Typfehler blockieren ab sofort den Build und damit die Veröffentlichung.
- Sicherheitskritische Rechenteile haben Prüffälle, die in der CI laufen:
  `src/lib/eks/atemschutz.ts` (FwDV 7), `src/lib/gs1.ts` (DataMatrix) und
  `src/lib/mpg/` (Prüffristen, Gerätezustand, Prüfergebnis — ob ein Medizinprodukt
  als einsatzbereit gilt). Die Prüffälle stehen in `*selbsttest.ts` und sind auch in der App aufrufbar;
  `src/lib/__tests__/` bindet sie an vitest an.
- Der Push-Dienst (`dienste/push/`) hat eigene Prüffälle (`npm test` dort, Node 22 oder neuer),
  die CI läuft sie mit Node 24. Sie heißen `*.pruefung.mjs`, damit vitest sie nicht aufgreift.
- **Neue Rechenlogik bekommt Prüffälle** — besonders alles, woran im Einsatz eine
  Entscheidung hängt.
- `.github/workflows/pruefung.yml` prüft jeden Pull Request und jeden Push auf
  `main`: Typen, Tests, Build und die Syntax der `pb_hooks`.
