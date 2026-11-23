// MPG im Dunkelrot-Design (Owner, 22.11.2026: Startseite mit Kacheln). Rahmen, Zeilen und Abschnitte aus
// BV_CSS; hier nur das Eigene. Klassen „mp-“. Die Karten der Geräte und Fälle bleiben aus teile.tsx.
export const MP_CSS = `
/* Am Rechner stehen Liste und Gerät nebeneinander: breiter als die übrigen Seiten (760 px) */
.bv:has(.mp-innen) > .bv-blatt > .bv-innen, .bv:has(.mp-innen) > .bv-kopf > .bv-kopf-innen{ max-width: 1180px; }
.mp-rechts{ display: contents; }
/* Marken im roten Kopf (Zustand, Schwere): auf hellem Grund, damit jede Farbe lesbar bleibt */
.mp-kopf-marke{ display: inline-flex; flex-shrink: 0; border-radius: 8px; background: var(--lbf-card); }
.mp-reiter:empty{ display: none; }
/* Zahlen im roten Kopf der Startseite */
.mp-zahlen{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.bv .mp-zahlen button{ display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; min-height: 86px; padding: 12px 12px 10px;
  border-radius: 16px; background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); text-align: left; }
.bv .mp-zahlen button:active{ opacity: 0.8; }
.bv .mp-zahlen button:disabled{ opacity: 1; cursor: default; }
.bv .mp-zahlen button:focus-visible{ outline: 2px solid var(--lbf-kopf-text); outline-offset: 2px; }
.mp-zahlen small{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--lbf-kopf-text-2); }
.mp-zahlen b{ font-size: 32px; font-weight: 800; line-height: 1.05; }
.mp-zahlen span{ font-size: 12px; font-style: italic; color: var(--lbf-kopf-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.bv .mp-zahlen button.warn{ box-shadow: inset 0 0 0 1.5px rgba(253, 232, 216, 0.6); }
/* Kacheln: die Bereiche */
.mp-kacheln{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 4px; }
@media (min-width: 760px){ .mp-kacheln{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.bv .mp-kachel{ position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-height: 118px; padding: 14px;
  background: var(--lbf-card); border-radius: 18px; box-shadow: var(--lbf-shadow); text-decoration: none; color: inherit; text-align: left; }
.bv .mp-kachel:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }
.bv .mp-kachel:focus-visible{ outline: 2px solid var(--lbf-akzent); outline-offset: 2px; }
.mp-kachel-icon{ width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: rgba(var(--lbf-rot-rgb), 0.08); color: var(--lbf-akzent); }
.mp-kachel b{ display: block; font-size: 16px; font-weight: 700; line-height: 1.2; color: var(--lbf-text); }
.mp-kachel small{ display: block; margin-top: 2px; font-size: 12px; font-style: italic; line-height: 1.3; color: var(--warm-gray); }
.mp-kachel small.wichtig{ color: var(--lbf-fehler-text); font-style: normal; font-weight: 700; }
.mp-zahl{ position: absolute; top: 12px; right: 12px; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 12px;
  background: var(--lbf-akzent-grund); color: #fff; font-size: 13px; font-weight: 700; display: grid; place-items: center; }
/* Zeilen mit Symbol (Einrichtung) */
.mp-z-icon{ width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent); }
.bv a.bv-z{ text-decoration: none; color: inherit; }
`
