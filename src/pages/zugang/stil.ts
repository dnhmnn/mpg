// Zugang ganz in Dunkelrot (Owner, 19.11.2026: „Ganz in Dunkelrot“, nicht wie Verwaltung): Startseite (/),
// Anmeldung (/login) und die öffentliche Seite einer Organisation (/<org-code>) samt ihren Hinweisseiten.
// Volle dunkelrote Fläche wie die Begrüßung nach dem Login, großes Zeichen in der Mitte, darunter helle
// Karten. Felder, Zeilen und Knöpfe aus BV_CSS (die Seite trägt deshalb auch die Klasse "bv").
// Rahmen: src/pages/zugang/Rahmen.tsx. Klassen mit "zg-".

export const ZG_CSS = `
.bv.zg-seite{ background: var(--lbf-kopf); color: var(--lbf-kopf-text); position: relative;
  padding: calc(28px + env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) calc(28px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); }
/* Mitte: steht in der Mitte, solange Platz ist; sonst rollt die Seite */
.zg-mitte{ margin: auto; width: 100%; max-width: 400px; display: flex; flex-direction: column; }

/* Zurück oben links */
.bv .zg-zurueck{ position: absolute; top: calc(12px + env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left));
  width: 44px; height: 44px; border-radius: 50%; background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); display: grid; place-items: center; }
.bv .zg-zurueck:focus-visible{ outline: 2px solid var(--lbf-kopf-text); outline-offset: 2px; }
/* Als App vom Homebildschirm 14 px tiefer, unter dem Schleier von iOS 26 (wie .bv-kopf in BV_CSS) */
@media (display-mode: standalone) and (min-height: 560px){ .bv .zg-zurueck{ top: calc(26px + env(safe-area-inset-top)); } }

/* Fokus: hell auf dem Rot, im Akzent auf den hellen Karten */
.bv.zg-seite :focus-visible{ outline-color: var(--lbf-kopf-text); }
.bv.zg-seite .zg-karte :focus-visible{ outline-color: var(--lbf-akzent); }

/* Zeichen, Name und Zeile */
.zg-marke{ display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 28px; }
/* Groß in der Mitte (Owner, 19.11.2026); auf niedrigen Bildschirmen etwas kleiner, damit die Karte sichtbar bleibt */
.zg-logo{ width: 176px; height: 176px; border-radius: 50%; background: var(--lbf-kopf-text); display: grid; place-items: center;
  padding: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.32); overflow: hidden; }
.zg-logo img{ display: block; width: 100%; height: 100%; object-fit: contain; }
.zg-logo.klein{ width: 152px; height: 152px; padding: 9px; }
/* Logo einer Organisation: nie in den Kreis gezwängt (Wappen und breite Schriftzüge wurden abgeschnitten,
   Owner 19.11.2026), sondern ganz, auf einer weißen Karte in seiner eigenen Form, wie früher auf Hell */
.zg-orglogo{ display: inline-flex; align-items: center; justify-content: center; max-width: 100%; background: #fff;
  border-radius: 22px; padding: 14px 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.32); }
/* Feste Höhe, Breite nach dem Seitenverhältnis (auch bei SVG ohne eigene Größe), höchstens 280 px breit */
.zg-orglogo img{ display: block; height: 150px; width: auto; max-width: min(280px, 100%); object-fit: contain; }
@media (max-height: 700px){
  .zg-orglogo img{ height: 112px; }
  .zg-logo{ width: 136px; height: 136px; padding: 8px; }
  .zg-logo.klein{ width: 112px; height: 112px; padding: 7px; }
}
.zg-name{ width: 100%; -webkit-hyphens: auto; hyphens: auto; margin: 20px 0 0; font-size: 28px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; color: var(--lbf-kopf-text); overflow-wrap: break-word; }
.zg-name em{ font-style: italic; }
.zg-zeile{ width: 100%; margin: 8px 0 0; font-size: 15px; font-style: italic; line-height: 1.4; color: var(--lbf-kopf-text-2); min-height: 21px; }
.zg-zeile b{ font-style: normal; color: var(--lbf-kopf-text); }
/* Der wechselnde Leitsatz hat immer Platz für zwei Zeilen: nichts darunter springt beim Wechsel */
.zg-zeile.wechsel{ animation: zgEin 0.6s ease both; min-height: calc(2 * 1.4em); }
@keyframes zgEin{ from{ opacity: 0; } to{ opacity: 1; } }
@media (prefers-reduced-motion: reduce){ .zg-zeile.wechsel{ animation: none; } }

/* Helle Karte */
.zg-karte{ background: var(--lbf-card); color: var(--lbf-text); border-radius: 20px; padding: 22px 20px;
  box-shadow: 0 10px 34px rgba(0,0,0,0.30); }
.zg-karte + .zg-karte{ margin-top: 14px; }
.zg-karte.zeilen{ padding: 4px 0; overflow: hidden; }
.zg-karte .bv-feld:first-child{ margin-top: 0; }
.zg-ueber{ font-size: 11px; line-height: 1.3; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--lbf-kopf-text-2); margin: 22px 4px 10px; }
.zg-ueber:first-child{ margin-top: 0; }

/* Knöpfe */
.bv .zg-haupt{ width: 100%; min-height: 50px; border-radius: 14px; background: var(--lbf-akzent-grund); color: #fff;
  font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 0 16px; }
.bv .zg-haupt:disabled{ opacity: 0.55; }
.bv .zg-haupt:active:not(:disabled){ opacity: 0.85; }
.bv .zg-zweit{ width: 100%; min-height: 48px; border-radius: 14px; background: rgba(var(--lbf-rot-rgb), 0.07); color: var(--lbf-akzent);
  border: 1px solid rgba(var(--lbf-rot-rgb), 0.16); font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 16px; }
.bv .zg-link{ display: flex; align-items: center; justify-content: center; margin: 10px auto 0; min-height: 44px; padding: 0 12px;
  font-size: 14px; font-weight: 700; color: var(--lbf-akzent); text-align: center; text-decoration: none; }
.bv .zg-link:disabled{ opacity: 0.5; }
.bv .zg-link.hell{ color: var(--lbf-kopf-text); }
.bv a.zg-haupt, .bv a.zg-zweit{ text-decoration: none; }
.bv a.zg-haupt{ color: #fff; }
.zg-abstand{ margin-top: 18px; }
.zg-oder{ display: flex; align-items: center; gap: 12px; margin: 16px 0; font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--bv-text-2); }
.zg-oder::before, .zg-oder::after{ content: ''; flex: 1; border-top: 1px solid var(--bv-linie); }

/* Rückmeldungen */
.zg-meldung{ margin-top: 16px; padding: 11px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; }
.zg-meldung.fehler{ background: var(--lbf-fehler-grund); color: var(--lbf-fehler-text); border: 1px solid rgba(var(--lbf-defekt-rgb), 0.25); }
.zg-meldung.ok{ background: var(--lbf-ok-grund); color: var(--lbf-ok-text); border: 1px solid rgba(22, 163, 74, 0.25); }
.zg-text{ font-size: 15px; line-height: 1.5; margin: 0; }

/* Code-Feld der Anmeldung */
.bv .zg-code{ text-align: center; letter-spacing: 0.25em; font-size: 22px; font-variant-numeric: tabular-nums; }

/* Zeilen mit Symbol (Formulare der Organisation) */
.zg-symbol{ width: 38px; height: 38px; border-radius: 11px; background: rgba(var(--lbf-rot-rgb), 0.08); color: var(--lbf-akzent);
  display: grid; place-items: center; flex-shrink: 0; }
.zg-symbol svg{ width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bv a.bv-z{ color: inherit; text-decoration: none; }
.bv a.bv-z:active{ background: rgba(var(--lbf-grau-rgb), 0.08); }

/* Fuß */
.zg-fuss{ text-align: center; margin: 28px 0 0; font-size: 12px; color: var(--lbf-kopf-text-2); }
`
