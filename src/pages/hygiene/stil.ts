// Hygiene im Dunkelrot-Design (Owner, 23.11.2026). Rahmen, Zeilen und Abschnitte aus BV_CSS; hier nur
// das Eigene. Klassen „hy-“. Zahlen im Kopf und Kacheln wie im MPG (MP_CSS), hier für sich.
export const HY_CSS = `
.hy-zahlen{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.bv .hy-zahlen button{ display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; min-height: 86px; padding: 12px 12px 10px;
  border-radius: 16px; background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); text-align: left; }
.bv .hy-zahlen button:active{ opacity: 0.8; }
.bv .hy-zahlen button:focus-visible{ outline: 2px solid var(--lbf-kopf-text); outline-offset: 2px; }
.bv .hy-zahlen button.warn{ box-shadow: inset 0 0 0 1.5px rgba(253, 232, 216, 0.6); }
.hy-zahlen small{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--lbf-kopf-text-2); }
.hy-zahlen b{ font-size: 32px; font-weight: 800; line-height: 1.05; }
.hy-zahlen span{ font-size: 12px; font-style: italic; color: var(--lbf-kopf-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.hy-kacheln{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 4px; }
@media (min-width: 760px){ .hy-kacheln{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.bv .hy-kachel{ position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-height: 112px; padding: 14px;
  background: var(--lbf-card); border-radius: 18px; box-shadow: var(--lbf-shadow); color: inherit; text-align: left; }
.bv .hy-kachel:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.bv .hy-kachel:focus-visible{ outline: 2px solid var(--lbf-akzent); outline-offset: 2px; }
.hy-kachel-icon{ width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: rgba(var(--lbf-rot-rgb), 0.08); color: var(--lbf-akzent); }
.hy-kachel b{ display: block; font-size: 16px; font-weight: 700; line-height: 1.2; color: var(--lbf-text); }
.hy-kachel small{ display: block; margin-top: 2px; font-size: 12px; font-style: italic; line-height: 1.3; color: var(--warm-gray); }
.hy-zahl{ position: absolute; top: 12px; right: 12px; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 12px;
  background: var(--lbf-akzent-grund); color: #fff; font-size: 13px; font-weight: 700; display: grid; place-items: center; }
/* Strich links an Zeilen: Lage */
.hy-strich{ width: 3px; align-self: stretch; border-radius: 2px; flex-shrink: 0; margin: 4px 0; background: rgba(var(--lbf-grau-rgb), 0.4); }
.hy-strich.ueberfaellig{ background: #dc2626; }
.hy-strich.heute, .hy-strich.offen{ background: var(--lbf-akzent); }
.hy-strich.bald{ background: var(--lbf-akzent); opacity: 0.45; }
.hy-strich.ok{ background: #16a34a; }
/* Marke rechts: kurz, groß geschrieben */
.hy-marke{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; color: var(--bv-text-2); }
.hy-marke.ueberfaellig{ color: var(--lbf-fehler-text); }
.hy-marke.heute, .hy-marke.offen{ color: var(--lbf-akzent); }
.hy-marke.ok{ color: #16a34a; }
.hy-z-icon{ width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent); }
/* Checkliste beim Durchführen */
.bv .hy-punkt{ align-items: flex-start; padding-top: 12px; padding-bottom: 12px; }
.bv .hy-punkt .bv-kasten{ margin-top: 1px; }
.bv .hy-punkt[aria-checked="false"] .bv-tx b{ font-weight: 400; }
.hy-alle{ display: flex; justify-content: flex-end; margin: 8px 2px 0; }
/* Nachweis: nicht erledigter Punkt mit sichtbarem Kreuz */
.bv .hy-mangel{ border-color: var(--lbf-fehler-text); background: var(--lbf-card); color: var(--lbf-fehler-text); }
.bv .hy-mangel svg{ opacity: 1; }
/* Einrichten: Punkte der Checkliste */
.hy-liste-z{ display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 14px; position: relative; }
.hy-liste-z + .hy-liste-z::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.hy-liste-z input{ flex: 1; min-width: 0; border: none; background: transparent; font: inherit; font-size: 15px; color: var(--lbf-text); padding: 8px 0; }
.hy-liste-z input:focus{ outline: none; }
.hy-liste-z:focus-within{ background: rgba(var(--lbf-rot-rgb), 0.04); }
.bv .hy-klein{ width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: var(--bv-text-2); flex-shrink: 0; }
.bv .hy-klein:disabled{ opacity: 0.3; }
.bv .hy-klein svg{ width: 18px; height: 18px; }
/* Vorschläge: Auswahl */
.bv .hy-wahl{ align-items: flex-start; padding-top: 11px; padding-bottom: 11px; }
.hy-herkunft{ font-style: italic; }
.hy-leiste-luft{ height: 8px; }
`
