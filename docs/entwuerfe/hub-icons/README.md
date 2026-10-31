# Hub-Icons: gemerkter Entwurf „Farbkacheln“

Stand 31.10.2026. Nur Entwurf, noch nicht in der App.

![Vorschau](vorschau.png)

- **Hell:** jede App eine eigene gedeckte LBF-Kachelfarbe, Motiv aus hellen,
  durchscheinenden Flächen, höchstens ein kleines Messing-Detail.
- **Dunkel:** alle Kacheln Bordeaux; der Akzent nimmt die helle App-Farbe auf.

| App | Farbe (hell) |
|---|---|
| Einsätze | rosso |
| EKS | oliva |
| Patienten | terracotta |
| Vorgänge | ardesia |
| Lager | tabacco |
| MPG | petrolio |
| Unitas | senape |
| Ausbildungen | salvia |
| Dateien | grafite |
| Schreibstube | prugna |
| Chat | schiefer |
| Notizen | ocra |
| Benutzer | inchiostro |
| Einstellungen | cappuccino |

## Dateien

- `bau.mjs` erzeugt `icons.json` (hell) und `icons-dunkel.json` (dunkel):
  je App das SVG-Innenleben für `viewBox="0 0 100 100"` samt Hintergrund.
- `vorschau.mjs` zeigt sie im Hub (hell und dunkel) und schreibt `vorschau.png`.

```bash
node docs/entwuerfe/hub-icons/bau.mjs
node docs/entwuerfe/hub-icons/vorschau.mjs
```

## Offen

- MPG: Die Prüfplakette kann in Hub-Größe noch wie ein Drehknopf wirken.
- Senf (Unitas) und Ocker (Notizen) liegen nah beieinander.
- Einsätze und Patienten sind auch im Hellmodus rot. Ob das so bleibt, ist offen.
- Einbau in den Hub ist noch nicht begonnen.

Eigene Zeichnungen. Nichts von Apple übernommen, kein Rotes Kreuz und kein anderes Schutzzeichen.
