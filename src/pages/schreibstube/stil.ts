// Schreibstube im Dunkelrot-Design (Owner, 22.11.2026). Rahmen, Zeilen, Felder aus BV_CSS, Arten-Symbole
// aus DF_CSS (Dateien), das Blatt aus HUB_CSS; hier nur das Eigene. Klassen „ss-“.
export const SS_CSS = `
.ss-neu{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.bv .ss-neu button{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 96px;
  padding: 12px 6px; border-radius: 16px; background: var(--lbf-card); box-shadow: var(--lbf-shadow); color: var(--lbf-text); font-size: 14px; font-weight: 700; }
.bv .ss-neu button:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.ss-neu small{ font-size: 11px; font-weight: 400; font-style: italic; color: var(--bv-text-2); margin-top: -6px; }
.ss-neu .df-art{ width: 44px; height: 44px; border-radius: 12px; }
.ss-neu .df-art svg{ width: 22px; height: 22px; }
.ss-filter{ display: flex; gap: 6px; overflow-x: auto; margin: 12px -4px 0; padding: 2px 4px 4px; scrollbar-width: none; }
.ss-filter::-webkit-scrollbar{ display: none; }
.bv .ss-filter button{ flex: none; min-height: 36px; padding: 0 14px; border-radius: 18px; font-size: 13px; font-weight: 700;
  background: rgba(var(--lbf-rot-rgb), 0.06); color: var(--bv-text-2); }
.bv .ss-filter button[aria-pressed="true"]{ background: var(--lbf-akzent-grund); color: #fff; }
.bv .ss-zeile{ display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; text-align: left; }
.bv .ss-zeile:active{ opacity: 0.7; }
.ss-endung{ flex: none; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bv-text-2); }
.ss-blattfeld{ padding: 12px 14px; display: grid; gap: 10px; }
.ss-blattfeld label{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lbf-akzent); }
.bv .ss-anlegen, .ss-anlegen{ width: 100%; min-height: 50px; border: none; border-radius: 14px; background: var(--lbf-akzent-grund); color: #fff;
  font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 12px; display: flex; align-items: center; justify-content: center; text-align: center; }
.ss-anlegen:disabled{ opacity: 0.45; cursor: default; }
/* Editor als eigene, statische Seite (?seite=bearbeiten): füllt das Blatt, rollt selbst */
.ss-editor{ flex: 1 1 0; min-height: 0; position: relative; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: var(--lbf-shadow); }
.ss-editor > div, .ss-editor iframe{ position: absolute; inset: 0; width: 100% !important; height: 100% !important; border: 0; }
.ss-laedt{ position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; background: var(--lbf-card);
  font-size: 15px; font-style: italic; color: var(--bv-text-2); }
.ss-fehler{ margin: auto; max-width: 420px; text-align: center; }
`
