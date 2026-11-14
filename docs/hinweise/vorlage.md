# Vorlage: „Neu in Responda“ nach einem Update

So legt Claude nach jedem Update den Text an, den der Owner in Supervisor → Hinweise → „Neuer
Hinweis“ kopiert. Dateiname: `docs/hinweise/<JJJJ-MM>-<thema>.md` (z. B. `2026-12-lager-scanner.md`).
Kopiert wird nur, was zwischen den Linien „Titel“ und „Text“ steht.

## Regeln für den Text

- **Titel:** höchstens 120 Zeichen, ein kurzer Satz ohne Punkt am Ende.
- **Text:** höchstens 5000 Zeichen, meist reichen 3 bis 6 Zeilen.
- Du-Form, freundlich und sachlich. Sagen, was sich für die Leute ändert und wo sie es finden;
  nicht, wie es gebaut ist.
- Absätze mit einer **Leerzeile** trennen. Aufzählungspunkte mit „- “ (Minus und Leerzeichen) am
  Zeilenanfang.
- **Kein HTML, kein Markdown-Fett (`**`), keine Links, keine Emojis, keine Gedankenstriche**
  (– oder —). Die App zeigt den Text genau so, wie er dasteht: `<b>` erschiene wörtlich.
- Nur der neueste Hinweis wird gezeigt. Steht im vorigen noch etwas Wichtiges, das gehört hier
  wieder hinein.
- Keine Namen echter Personen, keine Patientendaten.

## Beispiel

Titel:

```
Eigene Formulare unter Vorgänge
```

Text:

```
Unter Vorgänge kann deine Leitung jetzt eigene Formulare anlegen, etwa für Rückmeldungen nach einem Dienst.

- Jedes Formular hat einen eigenen Link und einen QR-Code.
- Einsendungen landen im Eingang und lassen sich dort bearbeiten.

Fragen dazu beantwortet deine Leitung.
```

## Leere Vorlage

Titel:

```

```

Text:

```

```
