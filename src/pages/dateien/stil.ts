// Dateien im Dunkelrot-Design (Owner, 22.11.2026). Rahmen, Zeilen, Felder aus BV_CSS, das Blatt aus HUB_CSS;
// hier nur das Eigene. Klassen „df-“.
export const DF_CSS = `
.df-pfad{ display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 14px; }
.bv .df-pfad button{ min-height: 32px; padding: 0 10px; border-radius: 16px; font-size: 13px; font-weight: 700; background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.df-pfad span{ color: var(--lbf-kopf-text-2); font-size: 13px; }
.df-knoepfe{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.bv .df-knoepfe button{ display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border-radius: 14px;
  background: var(--lbf-card); box-shadow: var(--lbf-shadow); color: var(--lbf-akzent); font-size: 14px; font-weight: 700; }
.bv .df-knoepfe button:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.df-knoepfe svg, .df-art svg{ width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.df-art{ width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0; background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent); }
.df-art.ordner{ background: rgba(201,164,92,0.18); color: #8a6420; }
.df-art.pdf{ background: rgba(192,57,43,0.10); color: #b03a2e; }
.df-art.tabelle{ background: rgba(22,163,74,0.10); color: #15803d; }
.df-art.praesentation{ background: rgba(217,119,6,0.12); color: #b45309; }
.df-art.bild{ background: rgba(37,99,235,0.10); color: #1d4ed8; }
[data-theme="dark"] .df-art.ordner{ color: #e0b76a; } [data-theme="dark"] .df-art.pdf{ color: #f08a7e; } [data-theme="dark"] .df-art.tabelle{ color: #4ade80; }
[data-theme="dark"] .df-art.praesentation{ color: #fbbf24; } [data-theme="dark"] .df-art.bild{ color: #93c5fd; }
@media (prefers-color-scheme: dark){ :root:not([data-theme]) .df-art.ordner{ color: #e0b76a; } :root:not([data-theme]) .df-art.pdf{ color: #f08a7e; }
  :root:not([data-theme]) .df-art.tabelle{ color: #4ade80; } :root:not([data-theme]) .df-art.praesentation{ color: #fbbf24; } :root:not([data-theme]) .df-art.bild{ color: #93c5fd; } }
.bv .df-zeile{ display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; min-height: 44px; text-align: left; }
.bv .df-zeile:active{ opacity: 0.7; }
.bv .df-mehr{ width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--warm-gray); flex-shrink: 0; }
.bv .df-mehr:active{ background: rgba(var(--lbf-grau-rgb), 0.1); }
.df-mehr svg{ width: 20px; height: 20px; fill: currentColor; }
.bv .bv-z .bv-tx b{ overflow-wrap: anywhere; }
.df-ziehen{ position: fixed; inset: 0; z-index: 400; background: rgba(26,14,8,0.45); display: grid; place-items: center; pointer-events: none; }
.df-ziehen div{ background: var(--warm-bg); border-radius: 20px; padding: 28px 32px; font-size: 17px; font-weight: 700; color: var(--lbf-akzent); border: 2px dashed rgba(var(--lbf-rot-rgb), 0.4); }
.df-eingabe{ display: flex; gap: 8px; padding: 12px 14px; }
.df-eingabe .bv-eingabe{ flex: 1; min-width: 0; }
.bv .df-ok{ min-height: 46px; padding: 0 16px; border-radius: 14px; background: var(--lbf-akzent-grund); color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.bv .df-ok:disabled{ opacity: 0.45; }
.df-hoch{ margin-bottom: 12px; }
.df-hoch .bv-z small.fehler{ color: var(--lbf-fehler-text-2); }
`
