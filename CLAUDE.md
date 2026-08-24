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
| Responda EKS | `src/pages/eks/EKS.tsx` | Einsatzführung aus dem ELW: Atemschutzüberwachung, Einsatztagebuch, Kräfte/FMS, Abschnitte — **voll offline-fähig** (IndexedDB-Ereignislog, siehe `src/lib/eks/`) |

## PocketBase Collections (wichtigste)

| Collection | Zweck |
|---|---|
| `patients` | Protokolle, Status: `offen` → `freigegeben` → `archiviert` |
| `lernbar_beitraege` | Feed-Posts (typ: bild/text/video/quiz), Feld: `organisation_id` |
| `ausbildungen_termine` | Termine |
| `ausbildungen_module` | Lernmodule |
| `organizations` | Organisationen mit Logo |
| `users` | User mit `organization_id`, `organization_name`, `organization_logo` |
| `eks_events` | EKS-Ereignislog (anhängend, **unveränderlich** — Update/Delete gesperrt). ID wird vom Client vergeben (15× `[a-z0-9]`) |

---

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
  `src/lib/eks/atemschutz.ts` (FwDV 7) und `src/lib/gs1.ts` (DataMatrix).
  Die Prüffälle stehen in `*selbsttest.ts` und sind auch in der App aufrufbar;
  `src/lib/__tests__/` bindet sie an vitest an.
- **Neue Rechenlogik bekommt Prüffälle** — besonders alles, woran im Einsatz eine
  Entscheidung hängt.
- `.github/workflows/pruefung.yml` prüft jeden Pull Request und jeden Push auf
  `main`: Typen, Tests, Build und die Syntax der `pb_hooks`.
