// Startseite responda.systems im Dunkelrot-Design: dunkelroter Kopf mit Creme-Schrift,
// Elfenbein-Blatt darunter, weiße Flächen mit Zeilen wie in der App. Feste Farben:
// Die öffentliche Seite folgt nicht dem App-Thema. Klassen mit "rs-", nur auf dieser Seite.

export const RS_CSS = `
:root{ --rs-kopf: #3d0408; }
.rs{
  --rs-feld: #521018;
  --rs-creme: #fde8d8;
  --rs-creme-2: rgba(253,232,216,0.78);
  --rs-blatt: #faf9f7;
  --rs-text: #1a0e08;
  --rs-text-2: #6b5c4d;
  --rs-linie: rgba(139,113,90,0.2);
  --rs-akzent: #600812;
  min-height: 100vh; min-height: 100dvh;
  background: var(--rs-blatt); color: var(--rs-text);
  font-family: 'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px; line-height: 1.45; -webkit-font-smoothing: antialiased;
  /* clip statt hidden: hidden machte .rs zum Scroll-Container, und die Leiste oben klebte nicht */
  overflow-x: clip;
}
.rs *{ box-sizing: border-box; }
.rs a{ color: inherit; text-decoration: none; }
.rs :focus-visible{ outline: 2px solid var(--rs-akzent); outline-offset: 2px; border-radius: 6px; }
.rs .rs-dunkel :focus-visible{ outline-color: var(--rs-creme); }
.rs-innen{ max-width: 1080px; margin: 0 auto; }

/* Safari 26 färbt die Leisten nach dem, was am Rand liegt (wie in der Benutzerverwaltung) */
.rs-statusleiste{ position: fixed; top: 0; left: 0; right: 0; height: max(env(safe-area-inset-top), 2px); background: var(--rs-kopf); z-index: -1; pointer-events: none; }
/* Als App vom Homebildschirm liegt die Seite unter Uhr und Akku: dort vorn und genau so hoch */
@media (display-mode: standalone){ .rs-statusleiste{ z-index: 70; height: env(safe-area-inset-top); } }
.rs-bodenkante{ position: fixed; bottom: 0; left: 0; right: 0; height: max(env(safe-area-inset-bottom), 6px); background: var(--rs-blatt); z-index: 45; pointer-events: none; }

/* Leiste oben */
.rs-nav{ position: sticky; top: 0; z-index: 50; background: var(--rs-kopf); color: var(--rs-creme);
  padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
.rs-nav .rs-innen{ display: flex; align-items: center; gap: 12px; height: 64px; }
.rs-marke{ display: flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 700; font-size: 18px; margin-right: auto; }
.rs-logo{ width: 36px; height: 36px; border-radius: 50%; background: var(--rs-creme); display: grid; place-items: center; flex-shrink: 0; }
.rs-logo img{ width: 24px; height: 24px; display: block; }
.rs-links{ display: none; gap: 4px; }
.rs-links a{ font-size: 15px; font-weight: 700; color: var(--rs-creme-2); padding: 10px 12px; border-radius: 10px; }
.rs-links a:hover{ color: var(--rs-creme); background: var(--rs-feld); }
@media (min-width: 860px){ .rs-links{ display: flex; } }

/* Knöpfe */
.rs-knopf{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px; border-radius: 14px;
  font-size: 16px; font-weight: 700; white-space: nowrap; border: 0; cursor: pointer; font-family: inherit; }
.rs-knopf.creme{ background: var(--rs-creme); color: var(--rs-kopf); }
.rs-knopf.creme:hover{ background: #fff1e6; }
.rs-knopf.rand{ background: transparent; color: var(--rs-creme); box-shadow: inset 0 0 0 1.5px rgba(253,232,216,0.45); }
.rs-knopf.rand:hover{ background: var(--rs-feld); }
.rs-knopf.klein{ min-height: 40px; padding: 0 16px; font-size: 15px; border-radius: 12px; }
.rs-knopf.rot{ background: var(--rs-akzent); color: #fff; }
.rs-knopf.rot:hover{ background: #4c060e; }
.rs-knopf:disabled{ opacity: 0.55; cursor: default; }
.rs-knopf svg{ width: 18px; height: 18px; }

/* Kopf: Einleitung */
.rs-held{ background: var(--rs-kopf); color: var(--rs-creme);
  padding: 28px max(16px, env(safe-area-inset-right)) 76px max(16px, env(safe-area-inset-left)); }
.rs-held .rs-innen{ display: grid; gap: 40px; align-items: center; }
.rs-stand{ display: flex; align-items: flex-start; gap: 10px; font-size: 15px; font-weight: 700; color: var(--rs-creme-2); margin: 0 0 18px; }
.rs-stand i{ width: 8px; height: 8px; margin-top: 7px; border-radius: 50%; background: var(--rs-creme); flex-shrink: 0; }
.rs-held h1{ font-size: clamp(32px, 7.4vw, 54px); line-height: 1.08; letter-spacing: -0.02em; font-weight: 700; margin: 0 0 18px; max-width: 15em; }
.rs-held p.rs-einl{ font-size: clamp(17px, 2.2vw, 20px); line-height: 1.5; color: var(--rs-creme-2); margin: 0 0 30px; max-width: 34em; }
.rs-held .rs-knoepfe{ display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 520px){ .rs-held .rs-knoepfe .rs-knopf{ flex: 1 1 100%; } }
.rs-kacheln{ display: none; }
@media (min-width: 980px){
  .rs-held{ padding-top: 56px; padding-bottom: 112px; }
  .rs-held .rs-innen{ grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
  .rs-kacheln{ display: grid; grid-template-columns: repeat(3, 84px); gap: 18px; justify-content: end; }
}
.rs-kachel{ width: 84px; height: 84px; border-radius: 24px; display: grid; place-items: center; color: var(--rs-creme);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.rs-kachel svg{ width: 38px; height: 38px; }

/* Blatt */
.rs-blatt{ background: var(--rs-blatt); border-radius: 28px 28px 0 0; margin-top: -32px; position: relative;
  padding: 12px max(16px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.rs-ab{ padding-top: 44px; scroll-margin-top: calc(72px + env(safe-area-inset-top)); }
.rs-ab h2{ font-size: clamp(24px, 4vw, 32px); line-height: 1.15; letter-spacing: -0.015em; font-weight: 700; margin: 0 0 8px; }
.rs-ab > .rs-innen > p.rs-unter{ font-size: 17px; color: var(--rs-text-2); margin: 0 0 20px; max-width: 40em; }

/* Weiße Flächen mit Zeilen */
.rs-spalten{ display: grid; gap: 14px; align-items: start; }
@media (min-width: 760px){ .rs-spalten{ grid-template-columns: 1fr 1fr; } }
.rs-flaeche{ background: #fff; border-radius: 20px; box-shadow: 0 1px 4px rgba(26,14,8,0.07); overflow: hidden; }
.rs-z{ display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; position: relative; }
.rs-z + .rs-z::before{ content: ''; position: absolute; top: 0; left: 70px; right: 0; border-top: 1px solid var(--rs-linie); }
.rs-z.ohne + .rs-z.ohne::before{ left: 16px; }
.rs-ic{ width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--rs-creme); flex-shrink: 0; }
.rs-ic svg{ width: 22px; height: 22px; }
.rs-z > div > b{ display: block; font-size: 17px; line-height: 1.3; }
.rs-z > div > span{ display: block; font-size: 15px; line-height: 1.45; color: var(--rs-text-2); margin-top: 2px; }

/* Stand der Entwicklung */
.rs-notiz{ background: #fff; border-radius: 20px; box-shadow: 0 1px 4px rgba(26,14,8,0.07); padding: 20px; display: grid; gap: 10px; max-width: 760px; }
.rs-notiz p{ margin: 0; font-size: 17px; line-height: 1.55; }
.rs-notiz p + p{ color: var(--rs-text-2); font-size: 16px; }

/* Kontakt */
.rs-kontakt{ display: grid; gap: 20px; align-items: start; }
@media (min-width: 860px){ .rs-kontakt{ grid-template-columns: 5fr 7fr; gap: 32px; } }
.rs-kontakt-text p{ font-size: 17px; line-height: 1.55; margin: 0 0 14px; }
.rs-kontakt-text a{ color: var(--rs-akzent); font-weight: 700; border-bottom: 1.5px solid rgba(96,8,18,0.3); }
.rs-form{ background: #fff; border-radius: 20px; box-shadow: 0 1px 4px rgba(26,14,8,0.07); padding: 18px; display: grid; gap: 14px; }
.rs-feld label{ display: block; font-size: 15px; font-weight: 700; margin: 0 2px 6px; }
.rs-feld label small{ font-weight: 400; color: var(--rs-text-2); font-size: 14px; margin-left: 6px; }
.rs-eingabe{ display: block; width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid rgba(139,113,90,0.75); background: #fff;
  padding: 0 14px; font: inherit; font-size: 16px; color: var(--rs-text); outline: none; }
textarea.rs-eingabe{ min-height: 120px; padding: 12px 14px; resize: vertical; line-height: 1.45; }
.rs-eingabe:focus{ border-color: var(--rs-akzent); box-shadow: 0 0 0 1px var(--rs-akzent); }
.rs .rs-eingabe:focus-visible{ outline: none; }
.rs-eingabe::placeholder{ color: var(--rs-text-2); opacity: 1; }
.rs-gesendet{ font-size: 17px; font-weight: 700; color: #166534; margin: 0; }
.rs-fehler{ font-size: 15px; color: #b91c1c; margin: 0; }
.rs-fehler a{ text-decoration: underline; font-weight: 700; }

/* Fuß */
.rs-fuss{ margin-top: 56px; padding: 22px 2px 8px; border-top: 1px solid var(--rs-linie); display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; font-size: 15px; color: var(--rs-text-2); }
.rs-fuss b{ color: var(--rs-text); margin-right: auto; }
@media (max-width: 520px){ .rs-fuss b{ flex-basis: 100%; } }
.rs-fuss button, .rs-fuss a{ display: inline-flex; align-items: center; background: none; border: 0; min-height: 44px; padding: 0; font: inherit; font-size: 15px; color: var(--rs-text-2); cursor: pointer; font-weight: 700; }
.rs-fuss button:hover, .rs-fuss a:hover{ color: var(--rs-akzent); }
`
