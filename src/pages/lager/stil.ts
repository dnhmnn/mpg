// Lager im Dunkelrot-Design (Owner, 20.11.2026: „Startseite mit Kacheln“ statt der Leiste mit 16 Knöpfen).
// Rahmen, Zeilen und Abschnitte aus BV_CSS (src/pages/benutzer/stil.ts); hier nur, was das Lager dazu braucht.
// Klassen mit "lg-".

export const LG_CSS = `
/* Standort im roten Kopf: sieht aus wie ein Knopf, darunter liegt die Auswahl des Systems
   (am iPhone das Rad, auch mit vielen Fahrzeugen schnell) */
.lg-standort{ position: relative; display: flex; align-items: center; gap: 10px; margin-top: 16px; min-height: 48px;
  padding: 0 14px; border-radius: 14px; background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); }
.lg-standort svg{ width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.lg-standort .lg-standort-tx{ flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.lg-standort small{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lbf-kopf-text-2); }
.lg-standort b{ font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lg-standort select{ position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font-size: 16px; cursor: pointer; }
.lg-standort:focus-within{ outline: 2px solid var(--lbf-kopf-text); outline-offset: 2px; }

/* Noch nicht übertragene Buchungen */
.bv .lg-offline{ display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; margin-bottom: 14px; padding: 10px 14px;
  border-radius: 14px; background: rgba(217,119,6,0.12); color: #92400e; border: 1px solid rgba(217,119,6,0.35); font-size: 14px; font-weight: 700; }
[data-theme="dark"] .bv .lg-offline{ color: #fbbf24; }
@media (prefers-color-scheme: dark){ :root:not([data-theme]) .bv .lg-offline{ color: #fbbf24; } }

/* Zustand am Standort: drei Zahlen, ein Tipp öffnet den Bestand mit diesem Filter */
.lg-zustand{ display: grid; grid-template-columns: repeat(3, 1fr); background: var(--lbf-card); border-radius: 18px; box-shadow: var(--lbf-shadow); overflow: hidden; }
.bv .lg-zustand button{ display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 14px 14px 12px; min-height: 84px; position: relative; }
.bv .lg-zustand button + button::before{ content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; border-left: 1px solid var(--bv-linie); }
.bv .lg-zustand button:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.lg-zustand small{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; }
.lg-zustand b{ font-size: 32px; font-weight: 800; line-height: 1.05; }
.lg-zustand span{ font-size: 12px; font-style: italic; color: var(--warm-gray); }
.lg-zustand .ok{ color: #16a34a; }
.lg-zustand .bald{ color: #d97706; }
.lg-zustand .ab{ color: var(--lbf-akzent); }

/* Kacheln: die sechs häufigsten Wege */
.lg-kacheln{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (min-width: 700px){ .lg-kacheln{ grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.bv .lg-kachel{ position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-height: 118px; padding: 14px;
  background: var(--lbf-card); border-radius: 18px; box-shadow: var(--lbf-shadow); }
.bv .lg-kachel:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.bv .lg-kachel:focus-visible{ outline: 2px solid var(--lbf-akzent); outline-offset: 2px; }
.lg-kachel-icon{ width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: rgba(var(--lbf-rot-rgb), 0.08); color: var(--lbf-akzent); }
.lg-kachel-icon svg, .lg-z-icon svg{ width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.lg-kachel b{ display: block; font-size: 16px; font-weight: 700; line-height: 1.2; color: var(--lbf-text); }
.lg-kachel small{ display: block; margin-top: 2px; font-size: 12px; font-style: italic; line-height: 1.3; color: var(--warm-gray); }
.lg-kachel small.wichtig{ color: #b45309; font-style: normal; font-weight: 700; }
[data-theme="dark"] .lg-kachel small.wichtig{ color: #fbbf24; }
@media (prefers-color-scheme: dark){ :root:not([data-theme]) .lg-kachel small.wichtig{ color: #fbbf24; } }
.lg-zahl{ position: absolute; top: 12px; right: 12px; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 12px;
  background: var(--lbf-akzent-grund); color: #fff; font-size: 13px; font-weight: 700; display: grid; place-items: center; }

/* Zeilen mit Symbol unter den Kacheln */
.lg-z-icon{ width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent); }
.lg-z-icon svg{ width: 18px; height: 18px; }
.bv .bv-z .lg-weiter{ width: 18px; height: 18px; color: var(--warm-gray); flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bv-tx b{ display: block; font-size: 15px; }
.bv-tx small{ display: block; font-size: 12.5px; color: var(--bv-text-2); margin-top: 1px; }

/* Bestand: Knöpfe oben, Suche, Filter */
.lg-knoepfe{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.bv .lg-knoepfe button{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 64px; border-radius: 14px;
  background: var(--lbf-card); box-shadow: var(--lbf-shadow); color: var(--lbf-akzent); font-size: 13px; font-weight: 700; text-align: center; }
.bv .lg-knoepfe button:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.lg-knoepfe svg{ width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.lg-filter{ display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 10px -16px 14px; padding: 0 16px; }
.lg-filter::-webkit-scrollbar{ display: none; }
.bv .lg-filter button{ flex-shrink: 0; min-height: 36px; padding: 0 14px; border-radius: 18px; font-size: 13px; font-weight: 700;
  background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent); }
.bv .lg-filter button[aria-pressed="true"]{ background: var(--lbf-akzent-grund); color: #fff; }

/* Artikel im Bestand: Zeilen in einer Fläche, links der Zustand als Strich */
.bv .lg-artikel{ display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 10px 10px 10px 16px; position: relative; width: 100%; cursor: pointer; }
.lg-artikel::after{ content: ''; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: var(--lg-strich, #16a34a); }
.bv .lg-artikel + .lg-artikel::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.bv .lg-artikel:active{ background: rgba(var(--lbf-grau-rgb), 0.06); }
.lg-artikel .lg-name{ flex: 1; min-width: 0; }
/* Lange Namen brechen um (höchstens zwei Zeilen), statt schon nach wenigen Zeichen abgeschnitten zu werden */
.lg-artikel .lg-name b{ display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 15px; line-height: 1.25; overflow-wrap: anywhere; }
.lg-artikel .lg-name small{ display: block; font-size: 12px; font-style: italic; color: var(--warm-gray); margin-top: 2px; }
.lg-menge{ text-align: right; flex-shrink: 0; min-width: 40px; }
.lg-menge b{ display: block; font-size: 17px; font-weight: 800; line-height: 1.1; }
.lg-menge small{ display: block; font-size: 10px; text-transform: uppercase; color: var(--warm-gray); }
.bv .lg-pm{ width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-size: 20px; font-weight: 700; line-height: 1; flex-shrink: 0; text-align: center; }
.bv .lg-pm.minus{ background: rgba(220,38,38,0.08); color: #dc2626; }
.bv .lg-pm.plus{ background: rgba(22,163,74,0.10); color: #16a34a; }
.lg-leer{ padding: 40px 16px; text-align: center; color: var(--warm-gray); font-style: italic; }
.lg-leer b{ display: block; font-style: normal; color: var(--lbf-text); margin-bottom: 4px; }
`
