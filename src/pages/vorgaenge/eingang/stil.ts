// Ergänzungen für den Eingang und CIRS unter Vorgänge (Teil I), zusätzlich zu
// BV_CSS und VG_CSS, die die Schale setzt. Klassen "ein-", nur Tokens aus
// globals.css, damit hell, dunkel, System und Retro stimmen.

export const EIN_CSS = `
/* Status als Wort rechts in einer Zeile */
.ein-st{ font-size: 13px; font-weight: 700; white-space: nowrap; flex-shrink: 0; color: var(--lbf-text); }
.ein-st.neu{ color: var(--lbf-akzent); }
.ein-st.erledigt, .ein-st.still{ color: var(--bv-text-2); font-weight: 400; }
.ein-st.warn{ color: var(--lbf-fehler-text-2); }

/* Zweite Zeile unter dem Namen: Zusatz wie „Unterschrift ausstehend“ */
.bv-z small.ein-zusatz, .ein-zusatz{ color: var(--lbf-warn-text-2); font-weight: 700; }
.bv-z small > .ein-block{ display: block; }

/* Meldung über einer Fläche (Fehler, Konflikt), ruhig, mit Knopf */
.ein-meldung{ border-radius: 14px; padding: 10px 14px; font-size: 13.5px; line-height: 1.45; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
.ein-meldung.fehler{ background: var(--lbf-fehler-grund); color: var(--lbf-fehler-text); }
.ein-meldung.ok{ background: var(--lbf-ok-grund); color: var(--lbf-ok-text); }
.ein-meldung > span{ flex: 1; min-width: 0; overflow-wrap: anywhere; }
.bv .ein-meldung button{ font-weight: 700; color: inherit; min-height: 32px; padding: 0 4px; white-space: nowrap; }

/* Eine Fläche mit Innenabstand für Eingaben (Notiz, Bewertung, Maßnahme) */
.ein-innen{ padding: 12px 14px 14px; }
.ein-innen + .ein-innen{ border-top: 1px solid var(--bv-linie); }
.ein-knoepfe{ display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.ein-knoepfe > .bv-knopf.voll{ background: var(--lbf-akzent-grund); border-color: var(--lbf-akzent-grund); color: #fff; }
.ein-knoepfe > .bv-knopf.weit{ flex: 1 1 auto; }

/* Text in einer Zeile, der umbrechen darf (Verlauf, Maßnahmen) */
.bv-z b.ein-lang, .bv-z small.ein-lang{ white-space: pre-wrap; overflow-wrap: anywhere; }
.bv-z b.ein-normal{ font-weight: 400; }
.bv-z b.ein-durch{ text-decoration: line-through; color: var(--bv-text-2); }

/* Kästchen zum Abhaken in einer Zeile (Maßnahmen) */
.bv .ein-haken{ width: 44px; height: 44px; margin: -6px 0 -6px -8px; display: grid; place-items: center; flex-shrink: 0; }

/* Kleiner Knopf rechts in einer Zeile (Entfernen) */
.bv .ein-klein{ width: 44px; height: 44px; margin: -6px -6px -6px 0; display: grid; place-items: center; color: var(--warm-gray); flex-shrink: 0; border-radius: 12px; }

/* Zwei oder drei Auswahlen nebeneinander, auf dem Telefon untereinander */
.ein-raster{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0 12px; }
.ein-raster > .bv-feld{ margin-top: 12px; }

/* Kennzahlen der Auswertung */
.bv .ein-zahl{ font-size: 28px; font-weight: 700; color: var(--lbf-akzent); line-height: 1; white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums; }

/* Balken der Auswertung, eine Farbe */
.ein-balken{ display: grid; grid-template-columns: minmax(110px, 42%) 1fr; align-items: center; gap: 6px 10px; padding: 12px 14px; }
.ein-balken > span{ font-size: 13px; line-height: 1.25; overflow-wrap: anywhere; }
.ein-balken > div{ display: flex; align-items: center; gap: 8px; min-width: 0; }
.ein-balken i{ display: block; height: 10px; background: var(--lbf-akzent); border-radius: 0 4px 4px 0; }
.ein-balken b{ font-size: 13px; }
.ein-balken b.null{ color: var(--bv-text-2); font-weight: 400; }

/* Rechts in einer Zeile: Status über einem kleinen Zusatz */
.ein-rechts{ display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; text-align: right; }
.bv-z .ein-rechts small{ margin-top: 0; font-size: 12px; }
/* Zwei Zeilen Text, dann abgeschnitten (Liste der Meldungen) */
.bv-z small > .ein-block.ein-zwei{ display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; color: var(--lbf-text); margin-top: 3px; }

/* Ganze Seite über der Liste (CIRS-Meldung), mit eigenem Kopf */
.ein-overlay{ position: fixed; inset: 0; z-index: 300; overflow-y: auto; -webkit-overflow-scrolling: touch; background: var(--warm-bg); outline: none; }

/* Ergebnis einer geschlossenen CIRS-Meldung */
.ein-ergebnis{ white-space: pre-wrap; overflow-wrap: anywhere; color: var(--lbf-text) !important; }
`
