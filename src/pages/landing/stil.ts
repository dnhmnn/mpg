// Website responda.systems ganz in Dunkelrot (Owner, 19.11.2026): wie der Eingang der App, großes Logo,
// große helle Schrift. Feste Farben: Die öffentliche Seite folgt nicht dem App-Thema. Klassen mit "rs-", nur auf
// dieser Seite. Szene am Scrollen (Owner, 26.11.2026): Klassen „rs-sz-“, die Bewegung setzt Startseite.tsx.
// Designrunde 27.11.2026: ein durchgehendes Rot ohne Bänder, Höhen aus 100svh (Rückfall 100vh), nichts Festes am
// unteren Rand (Safari übernähme es als Balken), Einblenden nur über Deckkraft und wenig Weg.

export const RS_CSS = `
:root{ --rs-kopf: #3d0408; }
.rs{
  --rs-feld: #521018;
  --rs-creme: #fde8d8;
  --rs-creme-2: rgba(253,232,216,0.76);
  --rs-creme-3: rgba(253,232,216,0.56);
  --rs-linie: rgba(253,232,216,0.16);
  --rs-blatt: #faf9f7;
  --rs-text: #1a0e08;
  --rs-text-2: #6b5c4d;
  --rs-akzent: #600812;
  position: relative;
  min-height: 100vh; min-height: 100dvh;
  background: var(--rs-kopf); color: var(--rs-creme);
  font-family: 'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 17px; line-height: 1.5; -webkit-font-smoothing: antialiased;
  /* clip statt hidden: hidden machte .rs zum Scroll-Container, und die Leiste oben klebte nicht */
  overflow-x: clip;
}
.rs *{ box-sizing: border-box; }
.rs a{ color: inherit; text-decoration: none; }
.rs :focus-visible{ outline: 2px solid var(--rs-creme); outline-offset: 3px; border-radius: 8px; }
.rs .rs-hell :focus-visible{ outline-color: var(--rs-akzent); }
.rs-innen{ max-width: 1120px; margin: 0 auto; padding: 0 max(20px, env(safe-area-inset-right)) 0 max(20px, env(safe-area-inset-left)); }
.rs section[id]{ scroll-margin-top: calc(64px + env(safe-area-inset-top)); }

/* Maß für die Bildschirmhöhe (scroll.ts): nie fixed */
.rs-mass{ position: absolute; top: 0; left: 0; width: 100%; height: 100vh; visibility: hidden; pointer-events: none; }
@supports (height: 100svh){ .rs-mass{ height: 100svh; } }

/* Nur für Screenreader */
.rs-sr{ position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* Sprunglinks: erst bei Fokus sichtbar, absolut (nie fixed) */
.rs-sprung{ position: absolute; z-index: 60; left: 12px; top: calc(env(safe-area-inset-top) + 10px); padding: 10px 18px; border-radius: 999px;
  background: var(--rs-creme); color: var(--rs-akzent) !important; font-size: 15px; font-weight: 700;
  width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.rs-szene > .rs-sprung{ top: 10px; }
.rs-sprung:focus, .rs-sprung:focus-visible{ width: auto; height: auto; overflow: visible; clip-path: none; }

/* Wie in der App: fester Streifen hinter Uhr und Akku (als App vom Homebildschirm bis iOS 18 vorn) */
.rs-statusleiste{ position: fixed; top: 0; left: 0; right: 0; height: max(env(safe-area-inset-top), 2px); background: var(--rs-kopf); z-index: -1; pointer-events: none; }
@media (display-mode: standalone){ .rs-statusleiste{ z-index: 70; height: env(safe-area-inset-top); } }
@supports (-webkit-touch-callout: none) and (anchor-name: --a){ @media (display-mode: standalone){ .rs-statusleiste{ z-index: -1; } } }

/* Leiste oben */
/* Voll deckend: Safari 26 färbt den Bereich unter der Uhr nach der Leiste oben; eine durchscheinende Leiste
   (Rot mit Weichzeichner) konnte es nicht lesen und nahm Hell (Bild des Owners, 20.11.2026) */
.rs-nav{ position: sticky; top: 0; z-index: 50; background: var(--rs-kopf);
  border-bottom: 1px solid transparent; padding-top: env(safe-area-inset-top); transition: border-color 0.2s; }
.rs-nav.unter{ border-bottom-color: var(--rs-linie); }
.rs-nav .rs-innen{ display: flex; align-items: center; gap: 4px; height: 64px; }
.rs-marke{ display: flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 700; font-size: 18px; margin-right: auto; letter-spacing: 0.01em; }
.rs-marke .rs-mini{ width: 34px; height: 34px; border-radius: 50%; background: var(--rs-creme); display: grid; place-items: center; padding: 3px; }
@media (max-width: 359px){ .rs-marke-name{ display: none; } }
.rs-mini img{ width: 100%; height: 100%; object-fit: contain; display: block; }
.rs-links{ display: none; gap: 2px; margin-right: 8px; }
.rs-links a{ display: flex; align-items: center; min-height: 44px; padding: 0 12px; font-size: 15px; font-weight: 700; color: var(--rs-creme-2); border-radius: 10px; }
.rs-links a:hover{ color: var(--rs-creme); }
@media (min-width: 860px){ .rs-links{ display: flex; } }
.rs-anmelden{ display: flex; align-items: center; min-height: 44px; padding: 0 10px; font-size: 14px; font-weight: 700; color: var(--rs-creme-2); border-radius: 10px; }
.rs-anmelden:hover{ color: var(--rs-creme); }
@media (min-width: 860px){ .rs-anmelden{ font-size: 15px; padding: 0 12px; } }

/* Knöpfe */
.rs-knopf{ display: inline-flex; align-items: center; justify-content: center; min-height: 50px; padding: 0 24px; border-radius: 999px;
  font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; border: 0; text-align: center; }
.rs-knopf.creme{ background: var(--rs-creme); color: var(--rs-akzent); }
.rs-knopf.rot{ background: var(--rs-akzent); color: #fff; }
.rs-knopf.klein{ min-height: 40px; padding: 0 16px; font-size: 14px; }
.rs-knopf:disabled{ opacity: 0.6; cursor: default; }

/* Überzeile (wie der Abschnittskopf der Designsprache, hell auf Rot) */
.rs-vorzeile{ margin: 34px 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--rs-creme-2); }

/* Erste Ansicht: großes Logo in der Mitte */
.rs-held{ text-align: center; padding: clamp(40px, 9vh, 96px) 0 0; }
.rs-gross{ width: clamp(150px, 26vw, 208px); height: clamp(150px, 26vw, 208px); border-radius: 50%; background: var(--rs-creme); margin: 0 auto;
  display: grid; place-items: center; padding: 12px; box-shadow: 0 18px 60px rgba(0,0,0,0.4); }
.rs-gross img{ width: 100%; height: 100%; object-fit: contain; display: block; }
.rs-held h1{ margin: 18px 0 0; font-size: clamp(54px, 11vw, 104px); line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
.rs-claim{ margin: 18px auto 0; max-width: 820px; font-size: clamp(22px, 3.4vw, 34px); line-height: 1.22; font-weight: 700; letter-spacing: -0.01em; }
.rs-claim em{ font-style: italic; color: var(--rs-creme); }
.rs-einl{ margin: 16px auto 0; max-width: 620px; font-size: clamp(16px, 2vw, 19px); font-style: italic; color: var(--rs-creme-2); }
.rs-knoepfe{ display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 30px; }

/* Telefonrahmen */
.rs-telefon{ margin: 0; border-radius: 44px; padding: 9px; background: #140405;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(253,232,216,0.10); }

.rs-ueber{ margin: 0 0 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--rs-creme-3); }
.rs-lead{ margin: 18px 0 0; max-width: 640px; font-size: clamp(17px, 2vw, 20px); color: var(--rs-creme-2); }

/* ── Szene am Scrollen ── */
.rs-szene{ position: relative; height: calc(var(--n, 17) * 100vh); }
@supports (height: 100svh){ .rs-szene{ height: calc(var(--n, 17) * 100svh); } }
.rs-anker{ position: absolute; left: 0; width: 1px; height: 1px; pointer-events: none; top: calc(var(--ab, 1.86) * 100vh); }
@supports (height: 100svh){ .rs-anker{ top: calc(var(--ab, 1.86) * 100svh); } }
.rs-sz-bild{ position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; }
.rs-sz-held{ position: absolute; inset: 0; z-index: 4; will-change: opacity, transform; }
.rs-sz-held .rs-held{ padding-top: calc(env(safe-area-inset-top) + 64px + clamp(16px, 4.5vh, 56px)); }
.rs-sz-held .rs-gross{ width: clamp(84px, 13vh, 150px); height: clamp(84px, 13vh, 150px); }
@media (min-width: 900px) and (max-height: 900px){ .rs-sz-held .rs-gross{ width: 80px; height: 80px; padding: 6px; } }
.rs-sz-held .rs-vorzeile{ margin-top: clamp(14px, 3vh, 30px); }
.rs-sz-held h1{ font-size: clamp(48px, min(11vw, 11vh), 104px); margin-top: clamp(8px, 1.6vh, 18px); }
.rs-sz-held .rs-claim{ font-size: clamp(20px, min(3.4vw, 3.6vh), 34px); margin-top: clamp(8px, 1.6vh, 18px); }
.rs-sz-held .rs-einl{ margin-top: clamp(8px, 1.4vh, 16px); }
.rs-sz-held .rs-knoepfe{ margin-top: clamp(14px, 2.6vh, 30px); }
@media (max-height: 700px){ .rs-sz-held .rs-einl{ display: none; } }
@media (max-height: 520px){ .rs-sz-held .rs-gross, .rs-sz-held .rs-vorzeile{ display: none; } }
.rs-sz-hinweis{ position: absolute; z-index: 4; left: 0; right: 0; top: calc(72% - 30px); margin: 0; text-align: center;
  font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--rs-creme-3); pointer-events: none; }
@media (max-width: 899px), (max-height: 639px){ .rs-sz-hinweis{ display: none; } }
/* Einsatzjacke: dunkler Stoff, Reflexstreifen, Reißverschluss, Brusttasche vor dem Handy */
.rs-sz-jacke, .rs-sz-vorn{ position: absolute; left: 0; right: 0; top: 72%; bottom: 0; will-change: transform, opacity; }
.rs-sz-jacke{ z-index: 1;
  background: repeating-linear-gradient(90deg, rgba(253,232,216,0.022) 0 1px, transparent 1px 5px), linear-gradient(180deg, #2a0408, #1a0204 70%);
  box-shadow: 0 -24px 48px rgba(0,0,0,0.35); border-top: 1px solid rgba(253,232,216,0.08); }
.rs-sz-reflex{ position: absolute; left: 0; right: 0; top: 30%; height: clamp(22px, 3.4vh, 32px);
  background: linear-gradient(180deg, #a59c92, #ece5dc 30%, #d6cec4 55%, #f3eee7 75%, #9c9389);
  box-shadow: 0 1px 0 rgba(0,0,0,0.4), 0 -1px 0 rgba(0,0,0,0.3); opacity: 0.92; }
.rs-sz-reflex::before, .rs-sz-reflex::after{ content: ''; position: absolute; left: 0; right: 0; height: 2px; background: rgba(96,8,18,0.55); }
.rs-sz-reflex::before{ top: 28%; } .rs-sz-reflex::after{ bottom: 28%; }
.rs-sz-naht{ position: absolute; top: 0; bottom: 0; left: calc(50% - var(--hw, 300px) / 2 - min(22vw, 260px)); width: 12px;
  background: repeating-linear-gradient(180deg, #120102 0 3px, #4a3a36 3px 5px); box-shadow: 0 0 0 3px #120102; opacity: 0.9; }
.rs-sz-vorn{ z-index: 3; pointer-events: none; }
.rs-sz-tasche{ position: absolute; top: 10%; bottom: -24px; left: calc(50% - var(--hw, 300px) / 2 - 30px); width: calc(var(--hw, 300px) + 60px);
  border-radius: 18px 18px 0 0;
  background: repeating-linear-gradient(90deg, rgba(253,232,216,0.03) 0 1px, transparent 1px 5px), linear-gradient(180deg, #4a0f17, #2c060b);
  box-shadow: 0 -12px 26px rgba(0,0,0,0.55), inset 0 2px 0 rgba(253,232,216,0.14); }
.rs-sz-tasche::before{ content: ''; position: absolute; inset: 10px 10px 0; border: 1.5px dashed rgba(253,232,216,0.34); border-bottom: 0; border-radius: 12px 12px 0 0; }
/* Klappe der Tasche, nach vorn umgeschlagen */
.rs-sz-tasche::after{ content: ''; position: absolute; left: 0; right: 0; top: 0; height: 17%; border-radius: 18px 18px 8px 8px;
  background: linear-gradient(180deg, #5a1520, #3f0b12); box-shadow: 0 8px 14px rgba(0,0,0,0.4), inset 0 -2px 0 rgba(0,0,0,0.25); }
.rs-sz-reflex.klein{ left: calc(50% - var(--hw, 300px) / 2 - 30px); right: auto; width: calc(var(--hw, 300px) + 60px); }
.rs-szene.ruhig .rs-sz-jacke, .rs-szene.ruhig .rs-sz-vorn{ display: none; }
/* Das Handy */
.rs-sz-handy{ position: absolute; z-index: 2; left: calc(50% - var(--hw, 300px) / 2); top: var(--oben, 10vh); width: var(--hw, 300px);
  transform-origin: 50% 70%; will-change: transform, opacity; }
.rs-sz-handy .rs-telefon{ position: relative; width: 100%; }
.rs-sz-schein{ position: absolute; left: -60%; right: -60%; top: -20%; bottom: -20%; opacity: 0; pointer-events: none;
  background: radial-gradient(closest-side, rgba(253,232,216,0.16), rgba(253,232,216,0) 70%); }
.rs-sz-schirm{ position: relative; border-radius: 35px; overflow: hidden; aspect-ratio: 390 / 844; background: #050101; }
.rs-sz-schirm img.rs-sz-app{ position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; background: #faf9f7; }
/* Bildschirm geht an wie Responda selbst: Dunkelrot, das Zeichen im runden hellen Kreis */
.rs-sz-zeichen{ position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: #3d0408; opacity: 0; }
.rs-sz-zeichen span{ width: 42%; height: auto; min-height: 0; aspect-ratio: 1; border-radius: 50%; background: var(--rs-creme); display: grid; place-items: center; padding: 6%; }
.rs-sz-zeichen img{ display: block; width: 100%; height: 100%; object-fit: contain; aspect-ratio: auto; border-radius: 0; background: none; }
.rs-sz-aus{ position: absolute; inset: 0; z-index: 6; background: linear-gradient(155deg, #1b1414 0%, #060303 38%, #020101 100%); }
/* Texte: am Rechner links neben dem Handy, am Telefon darunter */
.rs-sz-texte{ position: absolute; z-index: 4; display: grid; left: 20px; right: 20px; bottom: max(22px, calc(env(safe-area-inset-bottom) + 14px)); pointer-events: none; }
.rs-sz-text{ grid-area: 1 / 1; align-self: end; opacity: 0; visibility: hidden; will-change: opacity, transform; }
.rs-sz-titel{ margin: 0; font-size: clamp(26px, 7.4vw, 34px); line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; }
.rs-sz-titel em{ font-style: italic; color: var(--rs-creme); }
.rs-sz-text .rs-lead{ margin-top: 10px; font-size: 16px; }
.rs-sz-text .rs-ueber{ margin-bottom: 10px; font-size: 12px; letter-spacing: 0.14em; }
.rs-szene.knapp .rs-sz-text .rs-lead{ display: none; }
.rs-szene.breit .rs-sz-texte{ top: 0; bottom: 0; left: max(20px, calc(50% - 540px)); right: auto; width: min(44vw, 500px); align-items: center; }
.rs-szene.breit .rs-sz-text{ align-self: center; }
.rs-szene.breit .rs-sz-titel{ font-size: clamp(36px, 4.4vw, 56px); }
.rs-szene.breit .rs-sz-text .rs-lead{ font-size: clamp(17px, 1.6vw, 20px); margin-top: 18px; }
.rs-nr{ margin-right: 10px; color: var(--rs-creme); }
.rs-neu{ margin-left: 12px; padding: 2px 7px; border-radius: 6px; box-shadow: inset 0 0 0 1px var(--rs-creme-3); color: var(--rs-creme); letter-spacing: 0.12em; }
/* Kapitelmoment: großer Name mittig, das Handy tritt blass zurück */
.rs-sz-kapitel{ position: absolute; inset: 0; z-index: 4; display: grid; place-content: center; text-align: center;
  padding: calc(env(safe-area-inset-top) + 64px) 20px 0; opacity: 0; visibility: hidden; pointer-events: none; will-change: opacity, transform; }
.rs-sz-kapitel .rs-vorzeile{ margin: 0; }
.rs-sz-kapitelname{ margin: 10px 0 0; font-size: clamp(40px, min(10.5vw, 15vh), 128px); font-weight: 800; line-height: 0.98; letter-spacing: -0.03em; }
.rs-sz-kapitelname em{ font-style: italic; color: var(--rs-creme); }
.rs-sz-kapitelapps{ display: none; margin: 18px auto 0; max-width: 34ch; font-size: clamp(17px, 1.6vw, 19px); font-style: italic; color: var(--rs-creme-2); }
.rs-szene.breit .rs-sz-kapitelapps{ display: block; }
/* Kapitelzeile: nur am Rechner, unter der Leiste auf der Achse der Texte */
.rs-sz-kapitelzeile{ display: none; position: absolute; z-index: 5; top: calc(env(safe-area-inset-top) + 84px); left: max(20px, calc(50% - 540px)); gap: 20px; opacity: 0; visibility: hidden; }
@media (min-width: 900px){ .rs-szene.breit .rs-sz-kapitelzeile{ display: flex; } }
.rs-sz-kapitelzeile button{ position: relative; display: none; align-items: center; min-height: 44px; padding: 0; background: none; border: 0; cursor: pointer;
  font: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--rs-creme-3); }
.rs-sz-kapitelzeile button[aria-current]{ display: flex; color: var(--rs-creme); }
.rs-sz-kapitelzeile button:hover{ color: var(--rs-creme); }
.rs-sz-kapitelzeile button i{ position: absolute; left: 0; right: 0; bottom: 10px; height: 1px; background: var(--rs-creme); transform-origin: left; transform: scaleX(0); }
.rs-sz-kz-von{ margin-left: 4px; letter-spacing: 0.08em; color: var(--rs-creme-3); }
@media (min-width: 1100px){
  .rs-sz-kapitelzeile button{ display: flex; }
  .rs-sz-kz-von{ display: none; }
}
/* Schluss: der Satz des Einstiegs, allein auf Rot */
.rs-sz-schluss{ position: absolute; inset: 0; z-index: 4; display: grid; place-content: center; justify-items: center; text-align: center;
  padding: calc(env(safe-area-inset-top) + 64px) 20px 0; pointer-events: none; }
.rs-sz-schlusssatz{ margin: 0; font-size: clamp(40px, min(7vw, 11vh), 96px); font-weight: 800; line-height: 1.02; letter-spacing: -0.03em; }
.rs-sz-schlusssatz .z1, .rs-sz-schlusssatz .z2{ display: block; opacity: 0; }
.rs-sz-schlusssatz em{ font-style: italic; color: var(--rs-creme); }
.rs-sz-schluss .rs-knopf{ margin-top: clamp(24px, 4vh, 40px); pointer-events: auto; opacity: 0; visibility: hidden; }

/* ── Nach der Szene: ein Rot, große Schrift, ruhige Einblendung ── */
.rs-js .rs-ein{ opacity: 0; transform: translate3d(0, 24px, 0);
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) calc(var(--i, 0) * 80ms), transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) calc(var(--i, 0) * 80ms); }
.rs-js .rs-ein.da{ opacity: 1; transform: none; }
.rs-teil{ padding: clamp(96px, 16vh, 180px) 0; text-align: center; }
.rs-teil.erst{ padding-top: clamp(24px, 6vh, 64px); }
.rs-schmal{ max-width: 920px; margin: 0 auto; }
.rs-teil h2{ font: inherit; }

/* Grundsätze als Lesezeilen: hellen beim Hochrollen auf (nur Deckkraft) */
.rs-teil h2.rs-vorzeile{ margin: 0 0 clamp(40px, 8vh, 72px); font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--rs-creme-3); }
.rs-lesen{ display: grid; gap: clamp(56px, 11vh, 120px); }
.rs-zeile h3{ margin: 0; font-size: clamp(40px, min(7.2vw, 11vh), 96px); line-height: 1.02; font-weight: 800; letter-spacing: -0.025em; }
.rs-zeile h3 em{ font-style: italic; color: var(--rs-creme); }
.rs-zeile p{ margin: 16px auto 0; max-width: 36ch; font-size: clamp(17px, 1.6vw, 20px); line-height: 1.45; color: var(--rs-creme-2); }
@media (min-width: 900px){ .rs-zeile p{ max-width: 64ch; } }

/* Für wen: ein Satz */
.rs-teil h2.rs-vorzeile.rs-ein{ margin-bottom: 0; }
.rs-satz{ margin: clamp(28px, 5vh, 48px) auto 0; max-width: 920px; font-size: clamp(28px, 4.6vw, 56px); line-height: 1.18; font-weight: 700; letter-spacing: -0.015em; }
.rs-satz em{ font-style: italic; font-weight: 800; color: var(--rs-creme); }
.rs-satz-zeile{ margin: 18px 0 0; font-size: 20px; color: var(--rs-creme-2); }

/* Kontakt als Schlussbild */
.rs-anker-hier{ display: block; height: 0; scroll-margin-top: calc(64px + env(safe-area-inset-top)); }
.rs-kontaktbild .rs-gross{ width: clamp(96px, 14vw, 128px); height: clamp(96px, 14vw, 128px); padding: 8px; }
.rs-js .rs-zeichen-ein{ transform: scale(0.94); transition: opacity 0.9s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.9s cubic-bezier(0.22, 0.61, 0.36, 1); }
.rs-js .rs-zeichen-ein.da{ transform: scale(1); }
.rs-kontaktbild .rs-vorzeile{ margin-top: clamp(28px, 5vh, 44px); }
.rs-kontaktbild h2{ margin: 12px 0 0; font-size: clamp(44px, 7vw, 88px); line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
.rs-kontaktbild h2 em{ font-style: italic; color: var(--rs-creme); }
.rs-kontakt-satz{ margin: clamp(18px, 3vh, 28px) auto 0; max-width: 30ch; font-size: clamp(19px, 2.2vw, 24px); line-height: 1.4; color: var(--rs-creme); }
.rs-kontakt-kosten{ margin: 12px 0 0; font-size: 17px; font-style: italic; color: var(--rs-creme-2); }
.rs-direkt{ margin: 20px 0 0; font-size: 17px; font-style: italic; color: var(--rs-creme-2); }
.rs-direkt a{ color: var(--rs-creme); text-decoration: underline; text-decoration-color: rgba(253,232,216,0.5); text-underline-offset: 3px; }

/* Formular: helle Karte auf Rot */
.rs-form{ background: var(--rs-blatt); color: var(--rs-text); border-radius: 24px; padding: 28px 24px; box-shadow: 0 18px 60px rgba(0,0,0,0.35);
  max-width: 560px; margin: clamp(28px, 5vh, 44px) auto 0; text-align: left; }
.rs-feld{ scroll-margin-top: calc(88px + env(safe-area-inset-top)); }
.rs-feld + .rs-feld{ margin-top: 16px; }
.rs-feld label{ display: flex; justify-content: space-between; align-items: baseline; margin: 0 2px 6px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--rs-akzent); }
.rs-feld label small{ font-size: 13px; font-weight: 400; font-style: italic; letter-spacing: 0; text-transform: none; color: var(--rs-text-2); }
.rs-eingabe{ display: block; width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid #8a7a68; background: #fff;
  padding: 0 14px; font: inherit; font-size: 16px; color: var(--rs-text); outline: none; }
textarea.rs-eingabe{ min-height: 110px; padding: 12px 14px; resize: vertical; }
.rs-eingabe:focus{ border-color: var(--rs-akzent); box-shadow: 0 0 0 1px var(--rs-akzent); }
.rs-eingabe::placeholder{ color: #6b5c4d; }
.rs-form .rs-knopf{ margin-top: 20px; width: 100%; }
.rs-form-hinweis{ margin: 12px 0 0; font-size: 14px; color: var(--rs-text-2); }
.rs-form-hinweis button{ padding: 0; border: 0; background: none; font: inherit; color: var(--rs-akzent); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.rs-fehler{ margin: 14px 0 0; font-size: 14px; color: #9b1c1c; }
.rs-fehler a{ color: inherit; text-decoration: underline; }
.rs-gesendet{ margin: 0 0 4px; font-size: 18px; font-weight: 700; color: var(--rs-text); }
.rs-gesendet:empty{ margin: 0; }

/* Fuß: zentriert, ruhiger Abschluss */
.rs-fuss{ display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
  padding: clamp(72px, 12vh, 120px) 20px calc(28px + env(safe-area-inset-bottom)); }
.rs-fuss b{ font-size: 15px; }
.rs-fuss-zeichen{ width: 44px; height: 44px; border-radius: 50%; background: var(--rs-creme); padding: 4px; display: grid; place-items: center; }
.rs-fuss-links{ display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0 4px; }
.rs-fuss-links a, .rs-fuss-links button{ display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; font: inherit; font-size: 14px; font-weight: 700;
  color: var(--rs-creme-2); background: none; border: 0; cursor: pointer; border-radius: 8px; }
.rs-fuss-links a:hover, .rs-fuss-links button:hover{ color: var(--rs-creme); }
.rs-fuss-links span{ color: var(--rs-creme-3); }
.rs-bildhinweis{ margin: 0; font-size: 12px; font-style: italic; color: var(--rs-creme-3); }

@media (prefers-reduced-motion: reduce){
  .rs-nav{ transition: none; }
  .rs-js .rs-ein, .rs-js .rs-zeichen-ein{ transform: none; transition: opacity 0.3s; }
}
`
