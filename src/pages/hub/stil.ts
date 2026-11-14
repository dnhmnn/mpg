// Hub im Dunkelrot-Design: nur, was über BV_CSS (benutzer/stil.ts) hinausgeht.
// Klassen mit "hub-". Farben über die Tokens aus globals.css (hell, dunkel, System, Retro).
// Nichts hiervon ist fest oder klebend am Rand der Seite; die Überlagerungen (.hub-ueber)
// gibt es nur, solange ein Blatt offen ist.

export const HUB_CSS = `
/* Kopf: Zeichen links, Gruß unter der ersten Zeile */
.bv .hub-zeichen{ padding: 8px; }
.hub-zeichen img{ display: block; width: 100%; height: 100%; object-fit: contain; }
.hub-gruss{ margin: 14px 2px 0; font-size: 30px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; color: var(--lbf-kopf-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hub-gruss em{ font-style: italic; }
.bv .hub-kopfknopf svg{ width: 22px; height: 22px; }
.bv .hub-ini{ font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }

/* Raster der Kacheln: das Symbol ist die Fläche, keine Karte dahinter */
.hub-raster{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 6px; margin-top: 2px; }
@media (min-width: 600px){ .hub-raster{ grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (min-width: 720px){ .hub-raster{ grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.bv .hub-kachel{ display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0; min-height: 44px; padding: 4px 2px 2px; border-radius: 14px; text-align: center; }
.hub-kachel .hub-icon{ width: 60px !important; height: 60px !important; filter: drop-shadow(0 1px 2px rgba(26,14,8,0.18)); transition: transform 120ms ease-out; }
@media (min-width: 600px){ .hub-kachel .hub-icon{ width: 64px !important; height: 64px !important; } }
.bv .hub-kachel:active .hub-icon{ transform: scale(0.96); }
.hub-kachel-name{ display: block; max-width: 100%; font-size: 12.5px; font-weight: 700; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hub-kachel-bis{ display: block; font-size: 11px; line-height: 14px; color: var(--bv-text-2); margin-top: -5px; }
[data-theme="dark"] .hub-kachel .hub-icon{ filter: none; }
@media (prefers-color-scheme: dark){ :root:not([data-theme]) .hub-kachel .hub-icon{ filter: none; } }

.hub-signal{ color: var(--lbf-signal); }

/* Mitteilung der Organisation: ruhige Karte oben im Blatt */
.hub-mitteilung{ padding: 14px 16px 10px; }
.hub-mitteilung small{ display: block; font-size: 13px; color: var(--bv-text-2); }
.hub-mitteilung h2{ font-size: 17px; font-weight: 700; line-height: 1.25; margin: 4px 0 0; }
.hub-mitteilung p{ font-size: 15px; line-height: 1.5; margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }

/* Apps anpassen */
.hub-app-zeile.aus b{ color: var(--bv-text-2); }
.hub-steuer{ display: flex; align-items: center; gap: 0; flex-shrink: 0; }
.bv .hub-pfeil{ width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; color: var(--lbf-akzent); }
.bv .hub-pfeil:disabled{ color: var(--bv-text-2); opacity: 0.35; }
.bv .hub-pfeil:active:not(:disabled){ background: rgba(var(--lbf-grau-rgb), 0.1); }
.bv .hub-schalter{ min-width: 55px; height: 44px; display: grid; place-items: center end; }
.bv .hub-schalter:disabled{ opacity: 0.55; }
@media (max-width: 370px){ .bv .hub-pfeil{ width: 40px; } }

/* Profil */
.hub-person{ display: flex; align-items: center; gap: 14px; padding: 4px 2px 0; }
.hub-person-ini{ width: 48px; height: 48px; border-radius: 50%; background: var(--lbf-kopf); color: var(--lbf-kopf-text); display: grid; place-items: center; font-size: 16px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.02em; }
.hub-person b{ display: block; font-size: 17px; font-weight: 700; font-style: italic; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hub-person div > span{ display: block; font-size: 13px; color: var(--bv-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hub-ausweis{ background: var(--lbf-kopf); color: var(--lbf-kopf-text); border-radius: 18px; padding: 16px 18px 18px; margin: 16px 0; }
.hub-ausweis-marke{ display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--lbf-kopf-text-2); }
.hub-ausweis-marke b{ font-weight: 700; letter-spacing: 0.08em; color: var(--lbf-kopf-text); }
.hub-ausweis-name{ font-size: 24px; font-weight: 800; font-style: italic; line-height: 1.15; margin-top: 18px; overflow-wrap: anywhere; }
.hub-ausweis-rolle{ font-size: 13px; color: var(--lbf-kopf-text-2); margin-top: 4px; }
.bv .hub-auf + .bv-z::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.hub-auf{ font-size: 13px; color: var(--bv-text-2); padding: 0 16px 12px 14px; margin-top: -4px; line-height: 1.4; }

/* Blätter (Kurzbefehle, Profil): nur im DOM, solange offen */
.bv.hub-ueber{ position: fixed; inset: 0; z-index: 500; min-height: 0; background: rgba(26,14,8,0.5);
  display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; }
.hub-blatt{ background: var(--warm-bg); border-radius: 24px 24px 0 0; max-height: 85vh; max-height: 85dvh; display: flex; flex-direction: column;
  box-shadow: 0 -6px 30px rgba(26,14,8,0.22); outline: none; }
@media (min-width: 640px){
  .bv.hub-ueber{ justify-content: center; align-items: center; padding: 24px; }
  .hub-blatt{ width: 100%; max-width: 560px; border-radius: 24px; }
}
.hub-blatt-kopf{ display: flex; align-items: center; gap: 4px; padding: 10px 10px 8px 20px; flex-shrink: 0; }
.hub-blatt-kopf h2{ flex: 1; min-width: 0; font-size: 18px; font-weight: 700; margin: 0; outline: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv .hub-textknopf{ min-height: 44px; padding: 0 12px; border-radius: 12px; font-size: 15px; font-weight: 700; color: var(--lbf-akzent); }
.bv .hub-zu{ width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--lbf-text); }
.hub-zu i{ width: 32px; height: 32px; border-radius: 50%; background: rgba(var(--lbf-grau-rgb), 0.16); display: grid; place-items: center; }
.bv .hub-zu svg.bv-i{ width: 18px; height: 18px; }
.hub-blatt-inhalt{ overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 4px 16px calc(20px + env(safe-area-inset-bottom)); }
@media (min-width: 640px){ .hub-blatt-inhalt{ padding-bottom: 20px; } }
.bv .hub-kurz-symbol{ color: var(--lbf-akzent); display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; }

/* Begrüßung nach dem Login: Vollbild im Kopf-Dunkelrot, nur Ausblenden */
@keyframes greetOverlayOut { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes greetNameIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.hub-begruessung{ position: fixed; inset: 0; z-index: 9999; background: var(--lbf-kopf); color: var(--lbf-kopf-text);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px;
  animation: greetOverlayOut 2.4s ease forwards; pointer-events: none; font-family: 'Atkinson Hyperlegible', -apple-system, sans-serif; }
.hub-begruessung span{ font-size: 15px; font-style: italic; color: var(--lbf-kopf-text-2); animation: greetNameIn 0.5s ease-out both; }
.hub-begruessung b{ font-style: italic; font-weight: 800; font-size: clamp(48px, 13vw, 80px); line-height: 1; max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: greetNameIn 0.5s 0.12s ease-out both; }

@media (prefers-reduced-motion: reduce){
  .hub-kachel .hub-icon{ transition: none; }
  .bv .hub-kachel:active .hub-icon{ transform: none; }
  .hub-begruessung span, .hub-begruessung b{ animation: none; }
}
`
