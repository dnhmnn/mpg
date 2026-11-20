// Website responda.systems ganz in Dunkelrot (Owner, 19.11.2026): wie der Eingang der App, großes Logo,
// große helle Schrift, die App in Telefonrahmen gezeigt statt in Listen und Kacheln. Feste Farben: Die
// öffentliche Seite folgt nicht dem App-Thema. Klassen mit "rs-", nur auf dieser Seite.

export const RS_CSS = `
:root{ --rs-kopf: #3d0408; }
.rs{
  --rs-tief: #300306;
  --rs-feld: #521018;
  --rs-creme: #fde8d8;
  --rs-creme-2: rgba(253,232,216,0.76);
  --rs-creme-3: rgba(253,232,216,0.56);
  --rs-linie: rgba(253,232,216,0.16);
  --rs-blatt: #faf9f7;
  --rs-text: #1a0e08;
  --rs-text-2: #6b5c4d;
  --rs-akzent: #600812;
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
.rs-nav .rs-innen{ display: flex; align-items: center; gap: 8px; height: 64px; }
.rs-marke{ display: flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 700; font-size: 18px; margin-right: auto; letter-spacing: 0.01em; }
.rs-marke .rs-mini{ width: 34px; height: 34px; border-radius: 50%; background: var(--rs-creme); display: grid; place-items: center; padding: 3px; }
.rs-mini img{ width: 100%; height: 100%; object-fit: contain; display: block; }
.rs-links{ display: none; gap: 2px; }
.rs-links a{ display: flex; align-items: center; min-height: 44px; padding: 0 12px; font-size: 15px; font-weight: 700; color: var(--rs-creme-2); border-radius: 10px; }
.rs-links a:hover{ color: var(--rs-creme); }
@media (min-width: 860px){ .rs-links{ display: flex; } }

/* Knöpfe */
.rs-knopf{ display: inline-flex; align-items: center; justify-content: center; min-height: 50px; padding: 0 24px; border-radius: 999px;
  font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; border: 0; text-align: center; }
.rs-knopf.creme{ background: var(--rs-creme); color: var(--rs-akzent); }
.rs-knopf.rand{ background: transparent; color: var(--rs-creme); box-shadow: inset 0 0 0 1.5px rgba(253,232,216,0.5); }
.rs-knopf.rot{ background: var(--rs-akzent); color: #fff; border-radius: 14px; }
.rs-knopf.klein{ min-height: 40px; padding: 0 16px; font-size: 14px; }
.rs-knopf:disabled{ opacity: 0.6; cursor: default; }

/* Erste Ansicht: großes Logo in der Mitte */
.rs-held{ text-align: center; padding: clamp(40px, 9vh, 96px) 0 0; }
.rs-gross{ width: clamp(150px, 26vw, 208px); height: clamp(150px, 26vw, 208px); border-radius: 50%; background: var(--rs-creme); margin: 0 auto;
  display: grid; place-items: center; padding: 12px; box-shadow: 0 18px 60px rgba(0,0,0,0.4); }
.rs-gross img{ width: 100%; height: 100%; object-fit: contain; display: block; }
.rs-stand{ display: inline-flex; align-items: center; gap: 10px; margin: 34px 0 0; padding: 7px 16px; border-radius: 999px;
  font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: var(--rs-creme-2); box-shadow: inset 0 0 0 1px var(--rs-linie); }
.rs-stand i{ width: 7px; height: 7px; border-radius: 50%; background: var(--rs-creme); opacity: 0.85; }
.rs-held h1{ margin: 18px 0 0; font-size: clamp(54px, 11vw, 104px); line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
.rs-claim{ margin: 18px auto 0; max-width: 820px; font-size: clamp(22px, 3.4vw, 34px); line-height: 1.22; font-weight: 700; letter-spacing: -0.01em; }
.rs-claim em{ font-style: italic; color: var(--rs-creme-2); }
.rs-einl{ margin: 16px auto 0; max-width: 620px; font-size: clamp(16px, 2vw, 19px); font-style: italic; color: var(--rs-creme-2); }
.rs-knoepfe{ display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 30px; }

/* Drei Telefone unter der ersten Ansicht */
.rs-schau{ position: relative; display: flex; justify-content: center; align-items: flex-end; gap: 0; margin-top: clamp(48px, 8vh, 80px);
  padding: 0 16px; height: clamp(420px, 62vw, 640px); overflow: hidden; }
.rs-schau .rs-telefon{ width: clamp(200px, 30vw, 300px); flex-shrink: 0; }
.rs-schau .rs-telefon.seite{ width: clamp(170px, 25vw, 256px); opacity: 0.9; margin-bottom: -40px; }
.rs-schau .rs-telefon.links{ margin-right: -28px; z-index: 1; }
.rs-schau .rs-telefon.mitte{ z-index: 2; }
.rs-schau .rs-telefon.rechts{ margin-left: -28px; z-index: 1; }
/* Unten ins nächste Band auslaufen */
.rs-schau::after{ content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 120px; background: linear-gradient(rgba(48,3,6,0), var(--rs-tief)); z-index: 3; pointer-events: none; }

/* Telefonrahmen */
.rs-telefon{ margin: 0; border-radius: 44px; padding: 9px; background: #140405;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(253,232,216,0.10); }
.rs-telefon img{ display: block; width: 100%; height: auto; border-radius: 35px; aspect-ratio: 390 / 844; object-fit: cover; background: #faf9f7; }

/* Bänder */
.rs-band{ padding: clamp(64px, 11vh, 120px) 0; }
.rs-band.tief{ background: var(--rs-tief); }
.rs-band h2{ margin: 0; font-size: clamp(32px, 5vw, 52px); line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; }
.rs-band h2 em{ font-style: italic; color: var(--rs-creme-2); }
.rs-ueber{ margin: 0 0 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--rs-creme-3); }
.rs-lead{ margin: 18px 0 0; max-width: 640px; font-size: clamp(17px, 2vw, 20px); color: var(--rs-creme-2); }

/* Der Einsatz: Schritte mit Uhrzeit; auf dem Rechner steht das Telefon und wechselt den Bildschirm, auf dem
   Telefon steht nach jedem Schritt ein eigenes */
.rs-lead{ margin-bottom: 0; }
.rs-einsatz{ margin-top: clamp(40px, 7vh, 72px); }
.rs-schritte{ list-style: none; margin: 0; padding: 0; position: relative; }
.rs-schritte::before{ content: ''; position: absolute; top: 12px; bottom: 12px; left: 7px; border-left: 1px solid var(--rs-linie); }
.rs-schritt{ position: relative; padding: 0 0 72px 40px; }
.rs-schritt::before{ content: ''; position: absolute; left: 0; top: 10px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--rs-tief); box-shadow: inset 0 0 0 2px var(--rs-creme-3); transition: background 0.3s, box-shadow 0.3s; }
.rs-schritt.aktiv::before{ background: var(--rs-creme); box-shadow: inset 0 0 0 2px var(--rs-creme); }
.rs-zeit{ display: block; font-size: clamp(30px, 4.4vw, 46px); line-height: 1; font-weight: 800; font-style: italic; letter-spacing: -0.02em;
  color: var(--rs-creme-3); font-variant-numeric: tabular-nums; transition: color 0.3s; }
.rs-schritt.aktiv .rs-zeit{ color: var(--rs-creme); }
.rs-schritt h3{ margin: 10px 0 0; font-size: clamp(26px, 3.4vw, 36px); line-height: 1.1; font-weight: 800; letter-spacing: -0.015em; }
.rs-schritt p{ margin: 12px 0 0; font-size: 18px; color: var(--rs-creme-2); max-width: 500px; }
.rs-schritt .rs-telefon.inline{ width: min(300px, 76vw); margin: 28px 0 0; }
.rs-buehne{ display: none; }
@media (min-width: 900px){
  .rs-einsatz{ display: grid; grid-template-columns: 1fr 340px; gap: 80px; align-items: start; }
  .rs-schritt{ min-height: 72vh; display: flex; flex-direction: column; justify-content: center; padding-bottom: 0; }
  .rs-schritt:first-child{ min-height: 56vh; justify-content: flex-start; padding-top: 6vh; }
  .rs-schritt::before{ top: auto; }
  .rs-schritt .rs-telefon.inline{ display: none; }
  .rs-buehne{ display: block; position: sticky; top: calc(50vh - 360px); }
  .rs-buehne .rs-telefon{ width: 340px; position: relative; }
  .rs-buehne .rs-telefon img{ transition: opacity 0.45s ease; }
  .rs-buehne .rs-telefon img:not(:first-child){ position: absolute; top: 9px; left: 9px; width: calc(100% - 18px); }
  .rs-buehne .rs-telefon img{ opacity: 0; }
  .rs-buehne .rs-telefon img.an{ opacity: 1; }
}
@media (min-width: 900px) and (max-height: 820px){ .rs-buehne{ top: 84px; } .rs-buehne .rs-telefon{ width: 300px; } .rs-einsatz{ grid-template-columns: 1fr 300px; } }
@media (prefers-reduced-motion: reduce){ .rs-buehne .rs-telefon img, .rs-schritt::before, .rs-zeit{ transition: none; } }

/* Raster mit feinen Linien (Weitere Bereiche, Für wen, Verlass) */
.rs-raster{ display: grid; grid-template-columns: 1fr; margin-top: 40px; border-top: 1px solid var(--rs-linie); }
.rs-raster > div{ padding: 22px 0; border-bottom: 1px solid var(--rs-linie); }
.rs-raster b{ display: block; font-size: 19px; line-height: 1.3; }
.rs-raster span{ display: block; margin-top: 6px; font-size: 16px; color: var(--rs-creme-2); }
@media (min-width: 720px){
  .rs-raster{ grid-template-columns: 1fr 1fr; column-gap: 56px; }
}
@media (min-width: 1000px){ .rs-raster.drei{ grid-template-columns: 1fr 1fr 1fr; } }

/* Stand */
.rs-zitat{ margin: 28px 0 0; max-width: 760px; font-size: clamp(20px, 2.6vw, 26px); line-height: 1.4; font-style: italic; color: var(--rs-creme); }
.rs-zitat + p{ margin: 16px 0 0; max-width: 640px; color: var(--rs-creme-2); }

/* Kontakt: helle Karte auf Rot */
.rs-kontakt{ display: grid; gap: 40px; margin-top: 36px; }
.rs-kontakt-text p{ margin: 0 0 14px; font-size: 18px; color: var(--rs-creme-2); }
.rs-kontakt-text a{ color: var(--rs-creme); font-weight: 700; text-decoration: underline; text-decoration-color: rgba(253,232,216,0.4); text-underline-offset: 3px; }
@media (min-width: 860px){ .rs-kontakt{ grid-template-columns: 1fr 1.1fr; gap: 64px; } }
.rs-form{ background: var(--rs-blatt); color: var(--rs-text); border-radius: 24px; padding: 26px 22px; box-shadow: 0 18px 60px rgba(0,0,0,0.35); }
.rs-feld + .rs-feld{ margin-top: 16px; }
.rs-feld label{ display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin: 0 2px 6px; }
.rs-feld label small{ font-weight: 400; color: var(--rs-text-2); font-size: 13px; }
.rs-eingabe{ display: block; width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid rgba(139,113,90,0.4); background: #fff;
  padding: 0 14px; font: inherit; font-size: 16px; color: var(--rs-text); outline: none; }
textarea.rs-eingabe{ min-height: 110px; padding: 12px 14px; resize: vertical; }
.rs-eingabe:focus{ border-color: var(--rs-akzent); box-shadow: 0 0 0 1px var(--rs-akzent); }
.rs-eingabe::placeholder{ color: #8a7a68; }
.rs-form .rs-knopf{ margin-top: 20px; width: 100%; }
.rs-fehler{ margin: 14px 0 0; font-size: 14px; color: #9b1c1c; }
.rs-fehler a{ color: inherit; text-decoration: underline; }
.rs-gesendet{ margin: 0; font-size: 18px; font-weight: 700; color: var(--rs-text); }

/* Fuß */
.rs-fuss{ display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 28px 0 calc(28px + env(safe-area-inset-bottom)); border-top: 1px solid var(--rs-linie); }
.rs-fuss b{ margin-right: auto; font-size: 15px; }
.rs-fuss a, .rs-fuss button{ display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; font: inherit; font-size: 14px; font-weight: 700;
  color: var(--rs-creme-2); background: none; border: 0; cursor: pointer; border-radius: 8px; }
.rs-fuss a:hover, .rs-fuss button:hover{ color: var(--rs-creme); }

@media (prefers-reduced-motion: reduce){ .rs-nav{ transition: none; } }
`
