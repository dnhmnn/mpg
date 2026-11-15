// Hub im Dunkelrot-Design: nur, was über BV_CSS (benutzer/stil.ts) hinausgeht.
// Klassen mit "hub-". Farben über die Tokens aus globals.css (hell, dunkel, System, Retro).
// Der Hub selbst ist eine statische Seite (Seite statisch, CLAUDE.md, „Statische Seiten“): Er rollt
// nicht, die Apps stehen auf Seiten zum Wischen. Fest am Rand ist nur der rote Streifen oben aus
// BV_CSS; die Überlagerungen (.hub-ueber) gibt es nur, solange ein Blatt offen ist.

export const HUB_CSS = `
/* Kopf: Zeichen links (etwas größer als die Knöpfe), Organisation voll ausgeschrieben darunter,
   dann der Gruß */
.bv .hub-zeichen{ width: 52px; height: 52px; padding: 7px; }
.hub-zeichen img{ display: block; width: 100%; height: 100%; object-fit: contain; }
.hub-gruss{ margin: 14px 2px 0; font-size: 30px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; color: var(--lbf-kopf-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hub-gruss em{ font-style: italic; }
/* Luft im Kopf (Hub.tsx, AppSeiten meldet sie): Platz, der unter den Apps übrig ist, höchstens 32 px */
.hub-luft{ display: block; }
.bv .hub-kopfknopf svg{ width: 22px; height: 22px; }
.bv .hub-ini{ font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }
/* Sehr niedrige Bildschirme (Telefon quer): ohne Gruß, Zeichen so groß wie die Knöpfe */
@media (max-height: 559px){
  .bv .hub-zeichen{ width: 44px; height: 44px; padding: 6px; }
  .bv.statisch .hub-gruss, .bv.statisch .hub-luft{ display: none; }
}
/* Äußerst schmal (Seitenzoom 300 %): Zeichen so groß wie die Knöpfe, damit es mit der Glocke in eine Zeile passt */
@media (max-width: 159px){
  .bv .hub-zeichen{ width: 44px; height: 44px; padding: 6px; }
}

/* Apps: füllen den Platz unter dem Kopf, rechts in der Überschrift „Anpassen“ */
.hub-apps{ flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
/* Die Überschrift bricht um, wenn der Platz nicht reicht (Zoom), statt „Anpassen“ abzuschneiden:
   zuerst rückt „N von M“ unter „Anpassen“ (rechts; von rechts gefüllt, „Anpassen“ zuerst), reicht es
   auch dafür nicht, rückt der rechte Teil unter „Apps“. Sonst eine Zeile wie bisher. Zeilenabstand
   12 px: „Anpassen“ ist 44 px hoch und ragt 12 px über seine Zeile, ohne andere Zeilen zu überdecken. */
.hub-apps > .bv-ab{ flex: none; flex-wrap: wrap; row-gap: 12px; }
.bv-ab .hub-apps-rechts{ flex: 1 1 0; display: flex; flex-direction: row-reverse; flex-wrap: wrap; align-items: center; column-gap: 4px; row-gap: 12px; }
.bv-ab .hub-apps-zahl{ order: 1; }
.bv .hub-anpassen{ min-height: 44px; margin: -12px -10px -12px 0; padding: 0 10px; border-radius: 12px;
  font-size: 14px; font-weight: 700; color: var(--lbf-akzent); white-space: nowrap; }
.bv .hub-anpassen:active{ background: rgba(var(--lbf-grau-rgb), 0.1); }

/* Seiten zum Wischen (AppSeiten.tsx). Höhe der Reihen und Spalten setzt die Rechnung
   (src/lib/hubSeiten.ts); Innenabstand der Seite 4 px für den Fokusrahmen */
.hub-seiten-rahmen{ flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
.hub-seiten{ flex: 1 1 0; min-height: 0; display: flex; margin: 0 -4px; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y;
  scrollbar-width: none; }
.hub-seiten::-webkit-scrollbar{ display: none; }
.hub-seite{ flex: 0 0 100%; min-width: 0; display: grid; column-gap: 6px; row-gap: 16px; align-content: start; padding: 4px;
  scroll-snap-align: start; scroll-snap-stop: always; }
.hub-steuerung{ flex: none; height: 44px; margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bv .hub-blaettern{ width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--lbf-akzent); flex-shrink: 0; }
.bv .hub-blaettern:disabled{ color: var(--bv-text-2); opacity: 0.35; }
.bv .hub-blaettern:active:not(:disabled){ background: rgba(var(--lbf-grau-rgb), 0.1); }
.hub-punkte{ flex: 1; min-width: 0; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.hub-punkte i{ display: block; width: 7px; height: 7px; border-radius: 50%; background: rgba(var(--lbf-grau-rgb), 0.35); }
.hub-punkte i.an{ background: var(--lbf-akzent); }
/* Notausgang (AppSeiten meldet, dass nicht einmal eine Reihe passt): alle Apps untereinander, Kopf und
   Blatt rollen innen (Seite rolltInnen, BV_CSS). Rahmen und Band so hoch wie ihr Inhalt. */
.bv.rollt-innen .hub-apps, .bv.rollt-innen .hub-seiten-rahmen, .bv.rollt-innen .hub-seiten{ flex: none; }
.hub-sr{ position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* Kachel: das Symbol ist die Fläche, keine Karte dahinter */
.bv .hub-kachel{ display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0; min-height: 44px; padding: 4px 2px 2px; border-radius: 14px; text-align: center; }
.hub-kachel .hub-icon{ width: 60px !important; height: 60px !important; filter: drop-shadow(0 1px 2px rgba(26,14,8,0.18)); transition: transform 120ms ease-out; }
@media (min-width: 600px){ .hub-kachel .hub-icon{ width: 64px !important; height: 64px !important; } }
.bv .hub-kachel:active .hub-icon{ transform: scale(0.96); }
.hub-kachel-name{ display: block; max-width: 100%; font-size: 12.5px; font-weight: 700; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hub-kachel-bis{ display: block; font-size: 11px; line-height: 14px; color: var(--bv-text-2); margin-top: -5px; }
[data-theme="dark"] .hub-kachel .hub-icon{ filter: none; }
@media (prefers-color-scheme: dark){ :root:not([data-theme]) .hub-kachel .hub-icon{ filter: none; } }

/* Glocke im roten Kopf (Glocke.tsx): Abzeichen hell mit dunkelroter Zahl, ohne Bewegung */
.bv .hub-glocke{ position: relative; }
.bv .hub-glocke svg.bv-i{ width: 22px; height: 22px; }
.hub-glocke-zahl{ position: absolute; top: -3px; right: -3px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  background: var(--lbf-kopf-text); color: var(--lbf-kopf); box-shadow: 0 0 0 2px var(--lbf-kopf);
  font-size: 11.5px; font-weight: 700; font-style: normal; line-height: 20px; letter-spacing: 0; text-align: center;
  font-variant-numeric: tabular-nums; pointer-events: none; }

/* Blatt „Neuigkeiten“ hinter der Glocke (GlockeBlatt.tsx) */
.hub-glocke-inhalt{ padding-top: 4px; }
.hub-glocke-inhalt > .bv-flaeche + .bv-flaeche{ margin-top: 16px; }
.hub-glocke-inhalt .bv-leer{ padding: 28px 12px 32px; margin: 0; }
/* Gesperrte Medizinprodukte: die einzige Farbe in den Zeilen */
.hub-signal{ color: var(--lbf-signal); }

/* Mitteilung der Organisation: ruhige Karte oben im Blatt (Mitteilung.tsx) */
.hub-mitteilung{ padding: 14px 16px 10px; }
.hub-mitteilung small{ display: block; font-size: 13px; color: var(--bv-text-2); overflow-wrap: anywhere; }
.hub-mitteilung h3{ font-size: 17px; font-weight: 700; line-height: 1.25; margin: 4px 0 0; overflow-wrap: anywhere; }
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

/* Blätter (Glocke, Kurzbefehle, Profil): nur im DOM, solange offen */
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
/* Der Titel ist nur der Fokusanker beim Öffnen (tabIndex -1): kein Rahmen, auch wenn das Blatt von
   selbst aufgeht. Knöpfe und Zeilen behalten ihren (.bv :focus-visible in BV_CSS). */
.bv .hub-blatt-kopf h2:focus-visible{ outline: none; }
.bv .hub-textknopf{ min-height: 44px; padding: 0 12px; border-radius: 12px; font-size: 15px; font-weight: 700; color: var(--lbf-akzent); }
.bv .hub-zu{ width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--lbf-text); }
.hub-zu i{ width: 32px; height: 32px; border-radius: 50%; background: rgba(var(--lbf-grau-rgb), 0.16); display: grid; place-items: center; }
.bv .hub-zu svg.bv-i{ width: 18px; height: 18px; }
.hub-blatt-inhalt{ overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 4px 16px calc(20px + env(safe-area-inset-bottom)); }
@media (min-width: 640px){ .hub-blatt-inhalt{ padding-bottom: 20px; } }
/* Safari am iPhone im Browser: Die schwebende Leiste liegt unten über dem Blatt. Wie auf der statischen
   Seite (BV_CSS) bleiben Knöpfe und Zeilen darüber, nur wo das Blatt unten sitzt (schmaler als 640 px).
   Quer steht Safaris Leiste oben, dort genügt der Rand wie bisher. */
@media (max-width: 639px){
  @supports (-webkit-touch-callout: none){
    @media not all and (display-mode: standalone){
      .hub-blatt-inhalt{ padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
    }
  }
}
@media (max-width: 639px) and (max-height: 559px) and (orientation: landscape){
  .hub-blatt-inhalt{ padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
}
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
