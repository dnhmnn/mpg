// Ergänzungen zum Stil der Benutzerverwaltung (src/pages/benutzer/stil.ts, BV_CSS)
// für Vorgänge. Die Schale setzt BV_CSS + VG_CSS einmal; Seiten von E und I
// nutzen die Klassen "bv-" und diese "vg-". Alles über die Tokens aus
// globals.css, damit hell, dunkel, System und Retro stimmen.

export const VG_CSS = `
/* Wahl als Zeilen: die Erklärung ganz zeigen (bv-wahl kürzt auf zwei Zeilen) */
.bv .vg-wahl small{ display: block; -webkit-line-clamp: unset; overflow: visible; }
.bv .vg-wahl{ align-items: flex-start; padding-top: 12px; padding-bottom: 12px; }
.bv .vg-wahl > .bv-radio{ margin-top: 1px; }

/* Rechts in einer Zeile: ein Wort oder eine Zahl, ruhig */
.vg-rechts{ font-size: 13px; color: var(--bv-text-2); white-space: nowrap; flex-shrink: 0; }
.vg-rechts.akzent{ color: var(--lbf-akzent); font-weight: 700; }
.vg-zahl{ font-size: 13px; font-weight: 700; color: var(--lbf-akzent); white-space: nowrap; flex-shrink: 0; }
.bv svg.vg-icon-rechts{ width: 20px; height: 20px; color: var(--lbf-akzent); }

/* Lange Adressen umbrechen, nie waagrecht scrollen */
.bv-z small.vg-adresse, .vg-adresse{ overflow-wrap: anywhere; word-break: break-all; }

/* QR-Code: weißes Feld, auch im Dunkelmodus (sonst liest die Kamera schlecht) */
.vg-qr{ position: relative; display: flex; justify-content: center; padding: 14px 16px 16px; }
.vg-qr::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.vg-qr img{ display: block; width: min(240px, 100%); height: auto; aspect-ratio: 1; background: #fff; border-radius: 12px; padding: 8px; image-rendering: pixelated; }
.vg-qr p{ margin: 0; font-size: 14px; color: var(--bv-text-2); }
.bv .vg-qr + .bv-z::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }

/* Angaben: Bezeichnung über dem Wert (Eingang, Ansichten) */
.vg-angabe{ position: relative; padding: 10px 14px; }
.vg-angabe + .vg-angabe::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.vg-angabe > span{ display: block; font-size: 13px; color: var(--bv-text-2); line-height: 1.3; }
.vg-angabe > p{ margin: 2px 0 0; font-size: 15px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
.vg-angabe > p.leer{ color: var(--bv-text-2); }

/* Reihenfolge ändern: zwei Knöpfe je Zeile, 44 px */
.vg-schieben{ display: flex; gap: 4px; flex-shrink: 0; }
.bv .vg-schieb{ width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; color: var(--lbf-akzent); border: 1px solid var(--bv-linie); background: var(--lbf-card); }
.bv .vg-schieb:disabled{ opacity: 0.35; }
.bv .vg-schieb svg{ width: 20px; height: 20px; }

/* Textknopf rechts neben einer Überschrift („Reihenfolge ändern“, „Fertig“) */
.bv .vg-textknopf{ min-height: 44px; padding: 0 4px; font-size: 14px; font-weight: 700; color: var(--lbf-akzent); white-space: nowrap; }
.bv .vg-textknopf:disabled{ opacity: 0.45; }

/* Ruhiger Platzhalter (Vorschau: Kernblöcke, die hier nicht bedienbar sind) */
.vg-platzhalter{ border: 1px dashed var(--bv-feldrand); border-radius: 14px; padding: 12px 14px; font-size: 14px; line-height: 1.4; color: var(--bv-text-2); }
.vg-platzhalter b{ display: block; color: var(--lbf-text); font-size: 15px; margin-bottom: 2px; }

/* Eine Reihe von Eingaben untereinander (Optionen einer Auswahl) */
.vg-liste > .bv-reihe + .bv-reihe{ margin-top: 8px; }

/* Abstand nach einer Fläche, wenn ein Hinweis folgt */
.vg-abstand{ margin-top: 12px; }
`
