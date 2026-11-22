// Einsätze im Dunkelrot-Design (Owner, 22.11.2026). Rahmen, Zeilen, Felder aus BV_CSS; hier nur das Eigene. Klassen „ez-“.
export const EZ_CSS = `
.ez-suche{ margin-bottom: 4px; }
.ez-zeile-zahl{ font-size: 12px; color: var(--bv-text-2); white-space: nowrap; }
.ez-strich{ width: 3px; align-self: stretch; border-radius: 2px; background: var(--lbf-akzent); flex-shrink: 0; margin: 4px 0; }
.ez-strich.abgeschlossen{ background: #16a34a; }
.ez-strich.abgebrochen{ background: rgba(var(--lbf-grau-rgb), 0.4); }
.ez-kopfzeile{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.ez-pille{ display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 16px; font-size: 13px; font-weight: 700;
  background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); }
.ez-chips{ display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 14px; }
.bv .ez-chip{ display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 6px 0 12px; border-radius: 18px; font-size: 14px; font-weight: 700;
  background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent); }
.bv .ez-chip button{ width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--lbf-akzent); }
.bv .ez-chip.vorschlag{ background: transparent; border: 1px dashed rgba(var(--lbf-rot-rgb), 0.3); padding: 0 12px; }
.bv .bv-z.neu .bv-tx small{ color: var(--bv-text-2); font-weight: 400; }
.ez-leer{ padding: 14px; font-size: 14px; color: var(--bv-text-2); font-style: italic; }
.ez-eingabe-zeile{ display: flex; gap: 8px; padding: 12px 14px; align-items: center; }
.ez-eingabe-zeile .bv-eingabe{ flex: 1; min-width: 0; }
.bv .ez-knopf{ min-height: 44px; padding: 0 16px; border-radius: 12px; background: var(--lbf-akzent-grund); color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.bv .ez-knopf:disabled{ opacity: 0.45; }
.ez-wie{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--bv-text-2); white-space: nowrap; }
.bv .ez-weg{ width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--warm-gray); flex-shrink: 0; }
.bv .ez-weg:active{ background: rgba(var(--lbf-grau-rgb), 0.1); }
.ez-karte{ height: 320px; border-radius: 18px; overflow: hidden; box-shadow: var(--lbf-shadow); position: relative; }
.ez-karte > div{ width: 100%; height: 100%; }
`
